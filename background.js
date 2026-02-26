// background.js — WA Bulk AI Service Worker v2.0

// ─── State ────────────────────────────────────────────────────────────────────
let campaignRunning = false;
let shouldStop      = false;
let waTabId         = null;

// ─── Keepalive + Birthday Alarms ──────────────────────────────────────────────
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });

// Birthday check: daily at 8 AM
chrome.alarms.get('birthday-check', alarm => {
  if (!alarm) {
    const next8am = new Date();
    next8am.setHours(8, 0, 0, 0);
    if (next8am <= new Date()) next8am.setDate(next8am.getDate() + 1);
    chrome.alarms.create('birthday-check', { when: next8am.getTime(), periodInMinutes: 24 * 60 });
  }
});

// Daily digest: daily at 9 AM
chrome.alarms.get('daily-digest', alarm => {
  if (!alarm) {
    const next9am = new Date();
    next9am.setHours(9, 0, 0, 0);
    if (next9am <= new Date()) next9am.setDate(next9am.getDate() + 1);
    chrome.alarms.create('daily-digest', { when: next9am.getTime(), periodInMinutes: 24 * 60 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepalive') return;

  if (alarm.name.startsWith('scheduled-campaign-')) {
    const stored = await chrome.storage.local.get('scheduledCampaign');
    if (stored.scheduledCampaign) {
      console.log('[WA] Running scheduled campaign');
      await chrome.storage.local.remove('scheduledCampaign');
      runCampaign(stored.scheduledCampaign).catch(console.error);
    }
  }

  if (alarm.name === 'birthday-check') {
    checkBirthdays().catch(console.error);
  }

  if (alarm.name === 'daily-digest') {
    generateDigest().catch(console.error);
  }

  if (alarm.name.startsWith('drip-')) {
    executeDripStep(alarm.name).catch(console.error);
  }

  if (alarm.name.startsWith('meeting-alert-')) {
    handleMeetingAlert(alarm.name).catch(console.error);
  }

  if (alarm.name.startsWith('followup-')) {
    const phone = alarm.name.replace('followup-', '');
    const stored = await chrome.storage.local.get('contacts');
    const contacts = stored.contacts || [];
    const contact = contacts.find(c => c.phone === phone);
    if (contact) {
      chrome.notifications.create(`fu-${phone}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⏰ Follow-up Due — WA Bulk AI',
        message: `Time to follow up with ${contact.name || contact.phone}`,
        priority: 2
      });
      console.log('[WA] Follow-up notification for', phone);
    }
  }
});

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[WA] Message:', msg.type);

  // Async handlers — return true so Chrome keeps channel open
  const async_handlers = {
    QUICK_SEND:          () => quickSend(msg.data),
    SCAN_REPLIES:        () => scanReplies(msg.data),
    SEND_REPLY:          () => sendReplyToContact(msg.data),
    GENERATE_AI_REPLY:   () => generateAIReply(msg.data.replyText, msg.data.contactName, msg.data.apiKey),
    SCHEDULE_CAMPAIGN:   () => scheduleCampaign(msg.data),
    GET_ANALYTICS:       () => getAnalytics(),
    CLEAR_ANALYTICS:     () => clearAnalytics(),
    GET_AI_AUTO_REPLY:   () => getAIAutoReply(msg.data),
    SET_FOLLOWUP:        () => setFollowup(msg.data),
    CLEAR_FOLLOWUP:      () => clearFollowup(msg.data),
    TEST_WEBHOOK:        () => testWebhook(msg.data),
    // Drip campaigns
    SAVE_DRIP_SEQ:       () => saveDripSeq(msg.data),
    DELETE_DRIP_SEQ:     () => deleteDripSeq(msg.data),
    ENROLL_DRIP:         () => enrollDrip(msg.data),
    UNENROLL_DRIP:       () => unenrollDrip(msg.data),
    GET_DRIP:            () => getDrip(),
    // DNC
    GET_DNC:             () => getDNC(),
    ADD_DNC:             () => addDNC(msg.data),
    REMOVE_DNC:          () => removeDNC(msg.data),
    CLEAR_DNC:           () => clearDNC(),
    GET_GOOGLE_MEET_LINK:   () => getGoogleMeetLink(),
    TRANSCRIBE_VOICE_NOTE:  () => transcribeAudio(msg.data),
    SAVE_MEETING:           () => saveMeeting(msg.data),
    GET_MEETINGS:           () => getMeetings(),
    DELETE_MEETING:         () => deleteMeeting(msg.data),
    TRANSLATE_TEXT:         () => translateText(msg.data),
  };

  if (async_handlers[msg.type]) {
    async_handlers[msg.type]()
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // Sync handlers
  switch (msg.type) {
    case 'START_CAMPAIGN':
      if (campaignRunning) { sendResponse({ success: false, error: 'Already running' }); return false; }
      runCampaign(msg.data).catch(e => broadcastProgress({ status: 'error', error: e.message }));
      sendResponse({ success: true });
      return false;

    case 'STOP_CAMPAIGN':
      shouldStop = true; campaignRunning = false;
      sendResponse({ success: true });
      return false;

    case 'PING':
      sendResponse({ ready: true });
      return false;
  }
  return false;
});

// ─── Bulk Campaign ────────────────────────────────────────────────────────────
async function runCampaign(data) {
  campaignRunning = true;
  shouldStop = false;

  const { contacts, template, templateB, abEnabled, imageUrl, imageMime, imageName, settings } = data;
  console.log('[WA] Campaign start:', contacts.length, 'contacts, A/B:', abEnabled);

  await broadcastProgress({ status: 'starting', total: contacts.length, currentIndex: 0 });

  try {
    waTabId = await findOrCreateWATab(settings.stealthMode);
  } catch (e) {
    await broadcastProgress({ status: 'error', error: 'Cannot open WhatsApp Web: ' + e.message });
    campaignRunning = false;
    return;
  }

  await sleep(2000);
  const results = [];
  let aSent = 0, bSent = 0, aReplies = 0, bReplies = 0;

  // Load DNC list once before campaign
  const dncStored = await chrome.storage.local.get('dnc');
  const dncSet = new Set((dncStored.dnc || []).map(p => p.replace(/[^0-9]/g, '')));

  for (let i = 0; i < contacts.length; i++) {
    if (shouldStop) break;
    const contact = contacts[i];

    // Skip DNC contacts
    const phoneCleanCheck = (contact.phone || '').replace(/[^0-9]/g, '');
    if (dncSet.has(phoneCleanCheck)) {
      results.push({ contact: contact.name || contact.phone, phone: contact.phone, status: 'skipped', error: 'DNC — contact opted out', variant: 'A' });
      await broadcastProgress({ status: 'sent', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant: 'A', results: [...results] });
      continue;
    }

    // A/B assignment — alternate or random 50/50
    const useB = abEnabled && templateB && (i % 2 === 1);
    const variant = useB ? 'B' : 'A';

    await broadcastProgress({ status: 'personalizing', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant });

    const chosenTemplate = useB ? templateB : template;
    const message = await buildMessage(chosenTemplate, contact, settings);

    await broadcastProgress({ status: 'sending', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant, preview: message.substring(0, 60) });

    const result = await sendWhatsAppMessage(waTabId, contact.phone, message, settings.stealthMode, imageUrl || null, imageMime, imageName);
    console.log('[WA] Result for', contact.phone, ':', result.success, result.error || '');

    if (useB) bSent++; else aSent++;

    results.push({ contact: contact.name || contact.phone, phone: contact.phone, status: result.success ? 'sent' : 'failed', error: result.error || null, message, variant });

    await broadcastProgress({ status: result.success ? 'sent' : 'failed', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant, results: [...results] });

    if (i < contacts.length - 1 && !shouldStop) {
      const delaySec = randomInt(settings.minDelay, settings.maxDelay);
      for (let s = delaySec; s > 0; s--) {
        if (shouldStop) break;
        await broadcastProgress({ status: 'waiting', currentIndex: i, total: contacts.length, nextIn: s });
        await sleep(1000);
      }
    }
  }

  campaignRunning = false;

  // Update analytics
  await updateAnalytics(results, abEnabled ? { aSent, bSent, aReplies, bReplies } : null, settings.campaignName || '', template.substring(0, 80));

  // Notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'WA Bulk AI — Campaign Complete',
    message: `Sent ${results.filter(r => r.status === 'sent').length}/${results.length} messages`
  });

  await broadcastProgress({ status: 'completed', total: contacts.length, results, abStats: abEnabled ? { aSent, bSent } : null });
}

// ─── Quick Send ───────────────────────────────────────────────────────────────
async function quickSend(data) {
  const { phone, message, stealthMode } = data;
  console.log('[WA] Quick send to:', phone);

  // DNC check
  const dncStored = await chrome.storage.local.get('dnc');
  const phoneClean = (phone || '').replace(/[^0-9]/g, '');
  if ((dncStored.dnc || []).map(p => p.replace(/[^0-9]/g, '')).includes(phoneClean)) {
    return { success: false, error: 'DNC — this number has opted out' };
  }

  const tabId = await findOrCreateWATab();
  await sleep(1500);
  const result = await sendWhatsAppMessage(tabId, phone, message, stealthMode || false);
  return result;
}

// ─── Schedule Campaign ────────────────────────────────────────────────────────
async function scheduleCampaign(data) {
  const { timestamp, campaignData } = data;
  const delay = timestamp - Date.now();
  if (delay < 0) return { success: false, error: 'Schedule time is in the past' };

  await chrome.storage.local.set({ scheduledCampaign: campaignData });
  const alarmName = `scheduled-campaign-${timestamp}`;
  chrome.alarms.create(alarmName, { when: timestamp });

  console.log('[WA] Campaign scheduled for', new Date(timestamp).toLocaleString());
  return { success: true };
}

// ─── Reply Scanner ────────────────────────────────────────────────────────────
async function scanReplies(data) {
  const { contacts, apiKey } = data;
  console.log('[WA] Scanning replies for', contacts.length, 'contacts');

  const tabId = await findOrCreateWATab();
  const replies = [];

  for (const contact of contacts) {
    if (!contact.phone) continue;
    const phoneClean = contact.phone.replace(/[^0-9]/g, '');

    // Open the chat
    await chrome.tabs.update(tabId, { url: `https://web.whatsapp.com/send?phone=${phoneClean}`, active: true });
    await waitForTabLoad(tabId);
    await sleep(3500);

    // Ask content script to read last message
    const result = await sendMessageToTab(tabId, { type: 'READ_LAST_MESSAGE' }, 3);
    console.log('[WA] Last message from', contact.phone, ':', result);

    if (result?.text && result.isIncoming) {
      let aiSuggestion = null, category = null;
      if (apiKey) {
        try {
          aiSuggestion = await generateAIReply(result.text, contact.name || contact.phone, apiKey);
        } catch (e) { console.warn('[WA] AI reply failed:', e.message); }
        try {
          category = await classifyReply(result.text, apiKey);
        } catch (e) { console.warn('[WA] Classify failed:', e.message); }
      }

      // Auto-update pipeline stage based on classification
      let autoStage = null;
      if (category) {
        const stageMap = { 'Interested': 'interested', 'Not Interested': 'lost', 'Needs Callback': 'interested' };
        autoStage = stageMap[category] || null;
        if (autoStage) {
          const stored = await chrome.storage.local.get('contacts');
          const allContacts = stored.contacts || [];
          const ci = allContacts.findIndex(c => c.phone === contact.phone);
          if (ci >= 0) {
            allContacts[ci].stage = autoStage;
            if (category === 'Needs Callback') {
              allContacts[ci].tags = [...new Set([...(allContacts[ci].tags || []), '🔄 Follow-up'])];
            }
            await chrome.storage.local.set({ contacts: allContacts });
            console.log('[WA] Auto-staged', contact.phone, '→', autoStage);
          }
        }
      }

      // Opt-out detection
      const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'remove', "don't contact", 'do not contact', 'opt out', 'optout', 'please remove'];
      const textLower = result.text.toLowerCase();
      const isOptOut = OPT_OUT_KEYWORDS.some(kw => textLower.includes(kw));
      if (isOptOut) {
        const dncStored2 = await chrome.storage.local.get(['dnc', 'contacts']);
        const dnc2 = dncStored2.dnc || [];
        const phoneClean2 = contact.phone.replace(/[^0-9]/g, '');
        if (!dnc2.includes(phoneClean2)) {
          dnc2.push(phoneClean2);
          await chrome.storage.local.set({ dnc: dnc2 });
        }
        // Tag contact as DNC + set stage to lost
        const allC2 = dncStored2.contacts || [];
        const ci2 = allC2.findIndex(c => c.phone === contact.phone);
        if (ci2 >= 0) {
          allC2[ci2].stage = 'lost';
          allC2[ci2].tags = [...new Set([...(allC2[ci2].tags || []), '❌ DNC'])];
          await chrome.storage.local.set({ contacts: allC2 });
        }
        console.log('[WA] Opt-out detected for', contact.phone);
      }

      // Update replyTimestamps for Smart Send Time feature
      const rtStored = await chrome.storage.local.get('contacts');
      const rtContacts = rtStored.contacts || [];
      const rtIdx = rtContacts.findIndex(c => c.phone === contact.phone);
      if (rtIdx >= 0) {
        if (!rtContacts[rtIdx].replyTimestamps) rtContacts[rtIdx].replyTimestamps = [];
        rtContacts[rtIdx].replyTimestamps.push(Date.now());
        await chrome.storage.local.set({ contacts: rtContacts });
      }

      const replyEntry = {
        contact: contact.name || contact.phone,
        phone: contact.phone,
        replyText: result.text,
        aiSuggestion, category, autoStage,
        isOptOut,
        timestamp: Date.now()
      };
      replies.push(replyEntry);

      // Fire webhook on each reply if configured
      const settingsStored = await chrome.storage.local.get('settings');
      const wh = settingsStored.settings?.webhookUrl;
      if (wh) {
        sendWebhook('reply_received', { contact: replyEntry.contact, phone: replyEntry.phone, replyText: replyEntry.replyText, category, autoStage, ts: Date.now() }, wh).catch(() => {});
      }
    }
    await sleep(1000);
  }

  // Update reply count in analytics
  if (replies.length > 0) {
    const stored = await chrome.storage.local.get('analytics');
    const analytics = stored.analytics || { totalSent: 0, totalFailed: 0, totalReplies: 0, campaigns: [] };
    analytics.totalReplies += replies.length;
    await chrome.storage.local.set({ analytics });
  }

  return { success: true, replies };
}

// ─── Send Reply ───────────────────────────────────────────────────────────────
async function sendReplyToContact(data) {
  const { phone, message, originalText } = data;

  const tabId = await findOrCreateWATab();
  const phoneClean = phone.replace(/[^0-9]/g, '');
  const url = `https://web.whatsapp.com/send?phone=${phoneClean}`;
  await chrome.tabs.update(tabId, { url, active: true });
  await sleep(800);
  await waitForTabLoad(tabId);
  await sleep(5000);

  const response = await sendMessageToTab(tabId, {
    type: 'QUOTED_REPLY',
    originalText: originalText || '',
    replyMessage: message
  }, 4);
  return response || { success: false, error: 'No response from WA page' };
}

// ─── AI Reply Generator ───────────────────────────────────────────────────────
async function generateAIReply(replyText, contactName, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are helping reply to a WhatsApp message from ${contactName}.

Their message: "${replyText}"

Write a short, friendly, natural reply (max 2 sentences). Be helpful and conversational.
Return ONLY the reply text, nothing else.`
      }]
    })
  });
  if (!response.ok) throw new Error('API error ' + response.status);
  const d = await response.json();
  return d.content?.[0]?.text?.trim() || null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
async function updateAnalytics(results, abStats, campaignName = '', templatePreview = '') {
  const stored = await chrome.storage.local.get(['analytics', 'settings']);
  const a = stored.analytics || { totalSent: 0, totalFailed: 0, totalReplies: 0, campaigns: [] };
  const settings = stored.settings || {};

  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  a.totalSent   += sent;
  a.totalFailed += failed;
  const campaignEntry = {
    date: new Date().toLocaleDateString(), total: results.length, sent, failed, abStats, ts: Date.now(),
    name: campaignName,
    templatePreview,
    results: results.map(r => ({ phone: r.phone, contact: r.contact, status: r.status, variant: r.variant || 'A', error: r.error || null }))
  };
  a.campaigns.push(campaignEntry);
  if (a.campaigns.length > 15) a.campaigns = a.campaigns.slice(-15);

  await chrome.storage.local.set({ analytics: a });

  // Fire webhook if configured
  if (settings.webhookUrl) {
    sendWebhook('campaign_complete', { sent, failed, total: results.length, abStats, ts: Date.now() }, settings.webhookUrl).catch(() => {});
  }
}

async function getAnalytics() {
  const stored = await chrome.storage.local.get('analytics');
  return { success: true, analytics: stored.analytics || { totalSent: 0, totalFailed: 0, totalReplies: 0, campaigns: [] } };
}

async function clearAnalytics() {
  await chrome.storage.local.set({ analytics: { totalSent: 0, totalFailed: 0, totalReplies: 0, campaigns: [] } });
  return { success: true };
}

// ─── WA Tab & Message Sending ─────────────────────────────────────────────────
async function sendWhatsAppMessage(tabId, phone, message, stealthMode = false, imageUrl = null, imageMime = 'image/jpeg', imageName = 'image.jpg') {
  try {
    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (!phoneClean) return { success: false, error: 'Invalid phone number' };

    if (imageUrl) {
      // Navigate to the chat, then inject image via content script
      const chatUrl = `https://web.whatsapp.com/send?phone=${phoneClean}`;
      await chrome.tabs.update(tabId, { url: chatUrl, active: !stealthMode });
      await sleep(800);
      await waitForTabLoad(tabId);
      await sleep(5000);
      const response = await sendMessageToTab(tabId, { type: 'SEND_WITH_IMAGE', imageData: imageUrl, imageMime, imageName, caption: message }, 4);
      return response || { success: false, error: 'No response from WA page — is WA Web logged in?' };
    }

    // Text-only: open chat, then type via content script
    const url = `https://web.whatsapp.com/send?phone=${phoneClean}`;
    await chrome.tabs.update(tabId, { url, active: !stealthMode });
    await sleep(800); // let navigation start before checking load status
    await waitForTabLoad(tabId);
    await sleep(5000); // wait for WA React app to fully initialize
    const response = await sendMessageToTab(tabId, { type: 'TYPE_AND_SEND', message }, 5);
    return response || { success: false, error: 'No response from WA page — is WA Web logged in?' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function sendMessageToTab(tabId, message, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      console.warn(`[WA] Tab msg attempt ${i}/${retries} failed:`, e.message);
      if (i < retries) await sleep(2000);
    }
  }
  return null;
}

async function waitForTabLoad(tabId, timeout = 25000) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
  } catch (e) {}

  return new Promise(resolve => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, timeout);
    const fn = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(fn);
        clearTimeout(timer);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(fn);
  });
}

async function findOrCreateWATab(stealthMode = false) {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    if (!stealthMode) await chrome.tabs.update(tabs[0].id, { active: true });
    return tabs[0].id;
  }
  // Create tab — in stealth mode open it inactive
  const tab = await chrome.tabs.create({ url: 'https://web.whatsapp.com', active: !stealthMode });
  await sleep(6000);
  return tab.id;
}

// ─── AI Personalization ───────────────────────────────────────────────────────
function fillTemplate(template, contact) {
  let msg = template;
  for (const [k, v] of Object.entries(contact)) {
    if (v != null) msg = msg.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
  }
  return msg;
}

async function buildMessage(template, contact, settings) {
  let base = fillTemplate(template, contact);

  // Link click tracking — append ?wa_ref=PHONE to any URLs in the message
  if (settings.linkTracking && contact.phone) {
    const phoneClean = contact.phone.replace(/[^0-9]/g, '');
    base = base.replace(/https?:\/\/[^\s]+/g, url => {
      try {
        const u = new URL(url);
        u.searchParams.set('wa_ref', phoneClean);
        return u.toString();
      } catch { return url; }
    });
  }

  if (!settings.aiEnabled || !settings.apiKey) return base;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `Personalize this WhatsApp message for the contact. Make it feel natural and personal. Keep the same intent. Max 300 chars. Return ONLY the message.\n\nContact: ${JSON.stringify(contact)}\n\nMessage:\n${base}` }]
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
    return d.content?.[0]?.text?.trim() || base;
  } catch (e) {
    console.warn('[WA] AI failed:', e.message);
    return base;
  }
}

// ─── Follow-up Alarms ─────────────────────────────────────────────────────────
async function setFollowup({ phone, timestamp }) {
  const alarmName = `followup-${phone}`;
  chrome.alarms.clear(alarmName);
  if (timestamp && timestamp > Date.now()) {
    chrome.alarms.create(alarmName, { when: timestamp });
    console.log('[WA] Follow-up set for', phone, new Date(timestamp).toLocaleString());
  }
  return { success: true };
}

async function clearFollowup({ phone }) {
  chrome.alarms.clear(`followup-${phone}`);
  return { success: true };
}

// ─── AI Reply Classifier ──────────────────────────────────────────────────────
async function classifyReply(text, apiKey) {
  if (!apiKey) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: `Classify this WhatsApp reply into exactly ONE of these categories:\nInterested\nNot Interested\nQuestion\nNeeds Callback\nOther\n\nReply: "${text}"\n\nReturn ONLY the category name.` }]
    })
  });
  if (!response.ok) return null;
  const d = await response.json();
  const cat = d.content?.[0]?.text?.trim();
  const valid = ['Interested', 'Not Interested', 'Question', 'Needs Callback', 'Other'];
  return valid.includes(cat) ? cat : 'Other';
}

// ─── Birthday Auto-Sender ─────────────────────────────────────────────────────
async function checkBirthdays() {
  const stored = await chrome.storage.local.get(['contacts', 'settings']);
  const allContacts = stored.contacts || [];
  const settings = stored.settings || {};

  if (!settings.birthday?.enabled || !settings.birthday?.message) {
    console.log('[WA] Birthday sender disabled or no message');
    return;
  }

  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const bDayContacts = allContacts.filter(c => {
    if (!c.birthday) return false;
    const bday = String(c.birthday).trim();
    const mmdd = bday.length > 5 ? bday.slice(5) : bday; // handles YYYY-MM-DD and MM-DD
    return mmdd === todayMMDD;
  });

  if (!bDayContacts.length) { console.log('[WA] No birthdays today'); return; }
  console.log('[WA] Birthday contacts today:', bDayContacts.length);

  const tabId = await findOrCreateWATab();
  await sleep(2000);

  for (const contact of bDayContacts) {
    const msg = settings.birthday.message.replace(/\{name\}/gi, contact.name || contact.phone);
    await sendWhatsAppMessage(tabId, contact.phone, msg);
    await sleep(5000);
  }

  chrome.notifications.create({
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: '🎂 Birthday Messages Sent — WA Bulk AI',
    message: `Sent birthday wishes to ${bDayContacts.length} contact(s)`
  });
}

// ─── AI Auto Reply ────────────────────────────────────────────────────────────
async function getAIAutoReply({ text, prompt, apiKey }) {
  if (!apiKey) return { reply: null };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: `${prompt}\n\nMessage received: "${text}"\n\nReply (max 2 sentences, natural tone):` }]
      })
    });
    if (!response.ok) return { reply: null };
    const d = await response.json();
    return { reply: d.content?.[0]?.text?.trim() || null };
  } catch (e) {
    console.warn('[WA] AI auto-reply failed:', e.message);
    return { reply: null };
  }
}

// ─── Drip Campaigns ───────────────────────────────────────────────────────────
async function saveDripSeq({ sequence }) {
  const stored = await chrome.storage.local.get('drip_sequences');
  let seqs = stored.drip_sequences || [];
  const idx = seqs.findIndex(s => s.id === sequence.id);
  if (idx >= 0) seqs[idx] = sequence; else seqs.push(sequence);
  await chrome.storage.local.set({ drip_sequences: seqs });
  return { success: true };
}

async function deleteDripSeq({ id }) {
  const stored = await chrome.storage.local.get(['drip_sequences', 'drip_enrollments']);
  let seqs = (stored.drip_sequences || []).filter(s => s.id !== id);
  let enrolls = stored.drip_enrollments || [];

  // Cancel all alarms for this sequence
  enrolls.filter(e => e.seqId === id).forEach(e => {
    chrome.alarms.clear(`drip-${e.seqId}-${e.phone}-${e.step}`);
  });
  enrolls = enrolls.filter(e => e.seqId !== id);

  await chrome.storage.local.set({ drip_sequences: seqs, drip_enrollments: enrolls });
  return { success: true };
}

async function enrollDrip({ contacts, seqId }) {
  const stored = await chrome.storage.local.get(['drip_sequences', 'drip_enrollments', 'dnc']);
  const seq = (stored.drip_sequences || []).find(s => s.id === seqId);
  if (!seq || !seq.steps?.length) return { success: false, error: 'Sequence not found or empty' };

  const dncSet = new Set((stored.dnc || []).map(p => p.replace(/[^0-9]/g, '')));
  let enrolls = stored.drip_enrollments || [];
  let enrolled = 0;

  for (const contact of contacts) {
    const phoneClean = (contact.phone || '').replace(/[^0-9]/g, '');
    if (dncSet.has(phoneClean)) continue;
    // Don't double-enroll same phone in same sequence
    if (enrolls.find(e => e.phone === phoneClean && e.seqId === seqId)) continue;

    const step0 = seq.steps[0];
    const delayMs = step0.delay * (step0.unit === 'days' ? 86400000 : 3600000);
    const nextAt = Date.now() + delayMs;

    enrolls.push({ phone: phoneClean, name: contact.name || phoneClean, seqId, step: 0, nextAt, enrolledAt: Date.now() });
    chrome.alarms.create(`drip-${seqId}-${phoneClean}-0`, { when: nextAt });
    enrolled++;
  }

  await chrome.storage.local.set({ drip_enrollments: enrolls });
  console.log('[WA] Drip enrolled', enrolled, 'contacts in seq', seqId);
  return { success: true, enrolled };
}

async function unenrollDrip({ phone, seqId }) {
  const phoneClean = (phone || '').replace(/[^0-9]/g, '');
  const stored = await chrome.storage.local.get('drip_enrollments');
  let enrolls = stored.drip_enrollments || [];
  const entry = enrolls.find(e => e.phone === phoneClean && e.seqId === seqId);
  if (entry) chrome.alarms.clear(`drip-${seqId}-${phoneClean}-${entry.step}`);
  enrolls = enrolls.filter(e => !(e.phone === phoneClean && e.seqId === seqId));
  await chrome.storage.local.set({ drip_enrollments: enrolls });
  return { success: true };
}

async function getDrip() {
  const stored = await chrome.storage.local.get(['drip_sequences', 'drip_enrollments']);
  return { success: true, sequences: stored.drip_sequences || [], enrollments: stored.drip_enrollments || [] };
}

async function executeDripStep(alarmName) {
  // alarm name: drip-{seqId}-{phone}-{stepIndex}
  const parts = alarmName.split('-');
  if (parts.length < 4) return;
  const [, seqId, phone, stepStr] = parts;
  const stepIndex = parseInt(stepStr);
  const seqIdNum = parseInt(seqId);

  const stored = await chrome.storage.local.get(['drip_sequences', 'drip_enrollments']);
  const seq = (stored.drip_sequences || []).find(s => s.id === seqIdNum);
  let enrolls = stored.drip_enrollments || [];
  const enrollIdx = enrolls.findIndex(e => e.phone === phone && e.seqId === seqIdNum);

  if (!seq || enrollIdx < 0) { console.warn('[WA] Drip: seq or enrollment not found', alarmName); return; }

  const step = seq.steps[stepIndex];
  if (!step) { console.warn('[WA] Drip: step not found', stepIndex); return; }

  console.log(`[WA] Drip step ${stepIndex} for ${phone} in seq "${seq.name}"`);

  const tabId = await findOrCreateWATab();
  await sleep(2000);
  await sendWhatsAppMessage(tabId, phone, step.template);

  // Schedule next step or remove enrollment
  const nextStepIndex = stepIndex + 1;
  if (nextStepIndex < seq.steps.length) {
    const nextStep = seq.steps[nextStepIndex];
    const delayMs = nextStep.delay * (nextStep.unit === 'days' ? 86400000 : 3600000);
    const nextAt = Date.now() + delayMs;
    enrolls[enrollIdx].step = nextStepIndex;
    enrolls[enrollIdx].nextAt = nextAt;
    chrome.alarms.create(`drip-${seqIdNum}-${phone}-${nextStepIndex}`, { when: nextAt });
    console.log(`[WA] Drip: next step ${nextStepIndex} scheduled for ${new Date(nextAt).toLocaleString()}`);
  } else {
    // All steps done — remove enrollment
    enrolls.splice(enrollIdx, 1);
    console.log(`[WA] Drip: sequence complete for ${phone}`);
  }

  await chrome.storage.local.set({ drip_enrollments: enrolls });
}

// ─── DNC Management ───────────────────────────────────────────────────────────
async function getDNC() {
  const stored = await chrome.storage.local.get('dnc');
  return { success: true, dnc: stored.dnc || [] };
}

async function addDNC({ phones }) {
  const stored = await chrome.storage.local.get('dnc');
  const existing = stored.dnc || [];
  const toAdd = (Array.isArray(phones) ? phones : [phones])
    .map(p => p.replace(/[^0-9]/g, ''))
    .filter(p => p && !existing.includes(p));
  const updated = [...existing, ...toAdd];
  await chrome.storage.local.set({ dnc: updated });
  return { success: true, total: updated.length };
}

async function removeDNC({ phone }) {
  const phoneClean = phone.replace(/[^0-9]/g, '');
  const stored = await chrome.storage.local.get('dnc');
  const updated = (stored.dnc || []).filter(p => p !== phoneClean);
  await chrome.storage.local.set({ dnc: updated });
  return { success: true };
}

async function clearDNC() {
  await chrome.storage.local.set({ dnc: [] });
  return { success: true };
}

// ─── Webhook / Zapier ─────────────────────────────────────────────────────────
async function sendWebhook(event, data, webhookUrl) {
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, ts: Date.now(), source: 'wa-bulk-ai' })
    });
    console.log('[WA] Webhook fired:', event, res.status);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.warn('[WA] Webhook failed:', e.message);
    return { ok: false, error: e.message };
  }
}

async function testWebhook({ webhookUrl }) {
  if (!webhookUrl) return { success: false, error: 'No webhook URL provided' };
  const r = await sendWebhook('test', { message: 'WA Bulk AI test ping', ts: Date.now() }, webhookUrl);
  return r?.ok ? { success: true } : { success: false, error: `HTTP ${r?.status || 'error'}: ${r?.error || 'Request failed'}` };
}

// ─── Daily Business Digest ────────────────────────────────────────────────────
async function generateDigest() {
  const stored = await chrome.storage.local.get(['analytics', 'contacts', 'settings']);
  const settings = stored.settings || {};
  if (!settings.digestEnabled) { console.log('[WA] Digest disabled'); return; }

  const a = stored.analytics || { totalSent: 0, totalFailed: 0, totalReplies: 0, campaigns: [] };
  const contacts = stored.contacts || [];

  // Stats for today
  const todayStr = new Date().toLocaleDateString();
  const todayCampaigns = a.campaigns.filter(c => c.date === todayStr);
  const todaySent   = todayCampaigns.reduce((s, c) => s + c.sent, 0);
  const todayFailed = todayCampaigns.reduce((s, c) => s + c.failed, 0);

  // CRM summary
  const stageCounts = { new: 0, contacted: 0, interested: 0, converted: 0, lost: 0 };
  contacts.forEach(c => { const s = c.stage || 'new'; if (stageCounts[s] !== undefined) stageCounts[s]++; });

  // Follow-ups due today
  const today = new Date(); today.setHours(23,59,59,999);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const dueFu = contacts.filter(c => c.followUpDate && new Date(c.followUpDate) >= todayStart && new Date(c.followUpDate) <= today).length;

  const msgLines = [
    `📅 ${todayStr}`,
    todaySent   > 0 ? `✅ Sent today: ${todaySent}` : null,
    todayFailed > 0 ? `❌ Failed today: ${todayFailed}` : null,
    `📊 Pipeline — 🟠 Interested: ${stageCounts.interested} | 🟢 Converted: ${stageCounts.converted}`,
    dueFu > 0 ? `⏰ Follow-ups due: ${dueFu}` : null,
    `📋 Total contacts: ${contacts.length}`,
  ].filter(Boolean).join('\n');

  chrome.notifications.create(`digest-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '📊 Daily Business Digest — WA Bulk AI',
    message: msgLines
  });

  // Also fire webhook with digest data
  if (settings.webhookUrl) {
    sendWebhook('daily_digest', { todaySent, todayFailed, stageCounts, followUpsDue: dueFu, totalContacts: contacts.length, ts: Date.now() }, settings.webhookUrl).catch(() => {});
  }

  console.log('[WA] Daily digest sent');
}

// ─── Google Meet Auto-Link ────────────────────────────────────────────────────
async function getGoogleMeetLink() {
  return new Promise(resolve => {
    let meetTabId = null;

    const done = (result) => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      if (meetTabId) chrome.tabs.remove(meetTabId).catch(() => {});
      resolve(result);
    };

    // Google Meet room URL: https://meet.google.com/abc-defg-hij
    const MEET_PATTERN = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

    const onUpdated = (tabId, changeInfo) => {
      if (tabId !== meetTabId) return;
      const url = changeInfo.url || '';
      if (MEET_PATTERN.test(url)) {
        done({ success: true, link: url.split('?')[0] });
      } else if (url.includes('accounts.google.com') || url.includes('/authError')) {
        done({ success: false, error: 'Not logged into Google. Sign in to Google in Chrome first.' });
      }
    };

    const timer = setTimeout(() => {
      done({ success: false, error: 'Timeout — sign in to Google in Chrome and try again.' });
    }, 20000);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.create({ url: 'https://meet.google.com/new', active: false })
      .then(tab => { meetTabId = tab.id; })
      .catch(e => done({ success: false, error: e.message }));
  });
}

// ─── Meeting Alerts ───────────────────────────────────────────────────────────
async function saveMeeting({ contactName, title, datetime, platform, link, alertMinutes }) {
  const id      = Date.now().toString();
  const meeting = { id, contactName, title, datetime, platform, link, alertMinutes, createdAt: Date.now() };

  const stored   = await chrome.storage.local.get('scheduledMeetings');
  const meetings = stored.scheduledMeetings || [];
  meetings.push(meeting);
  if (meetings.length > 100) meetings.splice(0, meetings.length - 100);
  await chrome.storage.local.set({ scheduledMeetings: meetings });

  if (alertMinutes > 0 && datetime > Date.now()) {
    const alertAt = datetime - alertMinutes * 60 * 1000;
    if (alertAt > Date.now()) {
      chrome.alarms.create(`meeting-alert-${id}`, { when: alertAt });
      console.log('[WA] Meeting alert set for', new Date(alertAt).toLocaleString());
    }
  }
  return { success: true, id };
}

async function getMeetings() {
  const stored = await chrome.storage.local.get('scheduledMeetings');
  return { success: true, meetings: stored.scheduledMeetings || [] };
}

async function deleteMeeting({ id }) {
  chrome.alarms.clear(`meeting-alert-${id}`);
  const stored   = await chrome.storage.local.get('scheduledMeetings');
  const meetings = (stored.scheduledMeetings || []).filter(m => m.id !== id);
  await chrome.storage.local.set({ scheduledMeetings: meetings });
  return { success: true };
}

async function handleMeetingAlert(alarmName) {
  const id       = alarmName.replace('meeting-alert-', '');
  const stored   = await chrome.storage.local.get('scheduledMeetings');
  const meeting  = (stored.scheduledMeetings || []).find(m => m.id === id);
  if (!meeting) return;

  const dt      = new Date(meeting.datetime);
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const minsLeft = Math.round((meeting.datetime - Date.now()) / 60000);
  const whenTxt  = minsLeft <= 1 ? 'Starting now!' : `Starting in ${minsLeft} min`;

  chrome.notifications.create(`meeting-notif-${id}`, {
    type:               'basic',
    iconUrl:            'icons/icon48.png',
    title:              `📅 ${whenTxt} — ${meeting.contactName}`,
    message:            `${meeting.title}\n${timeStr} · ${dateStr} · ${meeting.platform}${meeting.link ? '\n' + meeting.link : ''}`,
    priority:           2,
    requireInteraction: true
  });

  // Auto-send reminder WhatsApp message to the contact
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    const reminder = `⏰ *Meeting Reminder*\n\n*${meeting.title}* is starting ${minsLeft <= 1 ? 'now!' : `in ${minsLeft} minutes!`}\n📆 ${dateStr} · 🕐 ${timeStr} · 💻 ${meeting.platform}${meeting.link ? `\n🔗 ${meeting.link}` : ''}`;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'SEND_MEETING_REMINDER', reminder, contactName: meeting.contactName }).catch(() => {});
  }
}

// ─── Text Translation (Google Translate unofficial API) ───────────────────────
async function translateText({ text, targetLang = 'en' }) {
  if (!text) return { success: false, error: 'No text provided' };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const translated = (data[0] || []).map(s => s?.[0] || '').join('').trim();
    const detected   = data[2] || '';
    return { success: true, translated, detected };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Voice Note Transcription (Groq Whisper — Free) ──────────────────────────
async function transcribeAudio({ base64, mimeType }) {
  const stored = await chrome.storage.local.get('settings');
  const apiKey = stored.settings?.groqApiKey;
  if (!apiKey) return { success: false, error: 'Groq API key not set. Add it in Settings → Groq Key.' };

  try {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext  = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('webm') ? 'webm' :
                 mimeType.includes('mp4') || mimeType.includes('aac') ? 'mp4' : 'ogg';
    const blob = new Blob([bytes], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error?.message || `API error ${res.status}` };
    }
    const data = await res.json();
    return { success: true, text: data.text?.trim() || '(no speech detected)' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function broadcastProgress(data) {
  try { await chrome.storage.local.set({ campaignProgress: { ...data, ts: Date.now() } }); } catch (e) {}
  try { chrome.runtime.sendMessage({ type: 'PROGRESS', data }); } catch (e) {}

}

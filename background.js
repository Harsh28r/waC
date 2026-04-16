// background.js — WA Bulk AI Service Worker v2.0

// ─── State ────────────────────────────────────────────────────────────────────
let campaignRunning = false;
let shouldStop      = false;
let waTabId         = null;
const __waRecentSendGuard = new Map();
const NOTIFICATION_FEED_KEY = 'waNotificationFeed';
const NOTIFICATION_FEED_MAX = 200;

async function appendNotificationFeed(entry) {
  try {
    const stored = await chrome.storage.local.get(NOTIFICATION_FEED_KEY);
    const feed = Array.isArray(stored[NOTIFICATION_FEED_KEY]) ? stored[NOTIFICATION_FEED_KEY] : [];
    feed.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), ...entry });
    if (feed.length > NOTIFICATION_FEED_MAX) feed.length = NOTIFICATION_FEED_MAX;
    await chrome.storage.local.set({ [NOTIFICATION_FEED_KEY]: feed });
  } catch (e) {
    console.warn('[WA] appendNotificationFeed failed:', e.message);
  }
}

// ─── Context Menu: right-click any phone number → Open on WhatsApp ───────────
chrome.contextMenus.create({
  id: 'wa-open-chat',
  title: 'Send on WhatsApp',
  contexts: ['selection']
}, () => { void chrome.runtime.lastError; });

chrome.contextMenus.create({
  id: 'wa-copy-send',
  title: 'WA Bulk AI: Quick Send to this number',
  contexts: ['selection']
}, () => { void chrome.runtime.lastError; });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'wa-open-chat' && info.menuItemId !== 'wa-copy-send') return;
  const text = (info.selectionText || '').trim();
  const digits = text.replace(/[\s\-\(\)\+\.]/g, '').replace(/[^0-9]/g, '');
  if (!digits || digits.length < 7) {
    chrome.notifications.create('wa-ctx-err', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'WA Bulk AI — No Phone Number',
      message: 'Select a phone number (e.g. +91 98765 43210) then right-click → Send on WhatsApp.'
    });
    return;
  }
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url: `https://web.whatsapp.com/send?phone=${digits}`, active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url: `https://web.whatsapp.com/send?phone=${digits}`, active: true });
  }
});

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

  if (alarm.name.startsWith('chat-reminder-')) {
    handleChatReminderAlert(alarm.name).catch(console.error);
  }

  if (alarm.name.startsWith('task-')) {
    handleTaskAlarm(alarm.name).catch(console.error);
  }

  if (alarm.name.startsWith('smart-fu-')) {
    const id = alarm.name.replace('smart-fu-', '');
    executeSmartFollowup(id).catch(console.error);
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
      appendNotificationFeed({
        type: 'followup',
        title: `Follow-up Due — ${contact.name || contact.phone}`,
        message: `Time to follow up with ${contact.name || contact.phone}`
      });
      console.log('[WA] Follow-up notification for', phone);
    }
  }
});

// ─── Flag images as data URLs (work in all contexts, no CSP issues) ───────────
const FLAG_ISOS = ['in','us','gb','jp','cn','de','fr','au','br','mx','it','es','ru','kr','nl','ae','sa','sg','my','id','ph','vn','tr','pk','ir','eg','ng','za','ke','ma','dz','tn','sd','gh','tz','ug','rw','cm','pt','pl','se','no','dk','fi','ie','nz','bd','lk','np'];
const FLAG_CDN = 'https://flagcdn.com/w40';

async function fetchFlagAsDataUrl(iso) {
  const url = `${FLAG_CDN}/${iso}.png`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

async function getFlagUrls() {
  const stored = await chrome.storage.local.get('flagUrls');
  if (stored.flagUrls && Object.keys(stored.flagUrls).length >= 40) return stored.flagUrls;
  const flagUrls = {};
  for (const iso of FLAG_ISOS) {
    const dataUrl = await fetchFlagAsDataUrl(iso);
    if (dataUrl) flagUrls[iso] = dataUrl;
  }
  await chrome.storage.local.set({ flagUrls });
  return flagUrls;
}

// ─── License: 7-day premium trial (once) OR Pro key ─────────────────────────────
// IMPORTANT: keep this secret in sync with key-generator.js → LICENSE_SECRET
const LICENSE_SECRET = 'wabulkai-secret-2024-xK9mP3qR';
const TRIAL_DAYS = 7;
/** Shown when user hits APIs without trial or Pro */
const LICENSE_REQUIRED_MSG = 'Start your 7-day premium trial or activate a license key in Settings to use bulk messaging, AI, drip, and related features.';

/** HMAC-SHA256 first 8 hex chars using SubtleCrypto (works in MV3 service worker) */
async function hmac8(payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(LICENSE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
}

/** Strip junk from paste: unicode dashes, ZWSP, whitespace; optional prefix before WABAI-… */
function normalizeLicenseKeyInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r?\n/g, '')
    .trim();
  const upper = s.toUpperCase();
  const m = upper.match(/WABAI-[A-Z0-9]+-[A-Z]+-\d+-[A-F0-9]{8}/);
  return m ? m[0] : upper.replace(/\s+/g, '');
}

/** Validate a license key and return { valid, userId, plan, expiresAt } */
async function validateLicenseKey(key) {
  if (!key || typeof key !== 'string') return { valid: false, reason: 'No key' };
  key = normalizeLicenseKeyInput(key);
  if (!key.startsWith('WABAI-')) return { valid: false, reason: 'Bad format' };
  const parts = key.split('-');
  // Expected: WABAI - USRxxxxxx - PLAN - expiresAt(unix sec) - sig(8 chars)
  if (parts.length !== 5 || parts[0] !== 'WABAI') return { valid: false, reason: 'Bad format' };
  const [, userId, plan, expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!expiresAt) return { valid: false, reason: 'Bad expiry' };

  const payload     = `${userId}|${plan.toLowerCase()}|${expiresAt}`;
  const expectedSig = await hmac8(payload);
  if (sig !== expectedSig) {
    return { valid: false, reason: 'Invalid key — typo or key was made with a different LICENSE_SECRET than this extension build' };
  }
  if (Date.now() / 1000 > expiresAt) return { valid: false, reason: 'Key expired', expired: true };

  return { valid: true, userId, plan: plan.toLowerCase(), expiresAt };
}

async function activateLicense(key) {
  const result = await validateLicenseKey(key);
  if (!result.valid) return { success: false, error: result.reason };
  const license = {
    plan:        result.plan === 'pro' ? 'pro' : 'free',
    key:         key.trim().toUpperCase(),
    userId:      result.userId,
    expiresAt:   result.expiresAt * 1000, // convert to ms
    activatedAt: Date.now(),
    trialUsed:   true,
  };
  await chrome.storage.local.set({ license });
  return { success: true, userId: result.userId, plan: license.plan, expiresAt: license.expiresAt };
}
async function getLicense() {
  const { license = {} } = await chrome.storage.local.get('license');
  const plan      = license.plan || 'free';
  const trialEnd  = license.trialEnd || 0;
  const trialUsed = license.trialUsed || false;
  const expiresAt = license.expiresAt || 0;   // pro key expiry (ms)
  const now       = Date.now();

  // If pro key has expired, revert to free
  if (plan === 'pro' && expiresAt && now > expiresAt) {
    await chrome.storage.local.set({ license: { ...license, plan: 'free' } });
    return getLicense();
  }
  // If trial has expired, revert to free
  if (plan === 'trial' && now >= trialEnd) {
    await chrome.storage.local.set({ license: { ...license, plan: 'free', trialUsed: true } });
    return getLicense();
  }

  const proActive = plan === 'pro' && expiresAt && now <= expiresAt;
  const inTrial = plan === 'trial' && trialEnd && now < trialEnd;
  const canUsePro = !!(proActive || inTrial);
  let displayPlan = 'free';
  if (proActive) displayPlan = 'pro';
  else if (inTrial) displayPlan = 'trial';
  return {
    plan: displayPlan,
    canUsePro,
    trialUsed: !!trialUsed,
    userId: license.userId || null,
    trialEnd: inTrial ? trialEnd : null,
    trialDaysLeft: inTrial ? Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000))) : 0,
    expiresAt: proActive ? expiresAt : null,
    daysLeft: proActive && expiresAt ? Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)) : null,
  };
}

async function denyIfUnlicensed() {
  const lic = await getLicense();
  return lic.canUsePro ? null : LICENSE_REQUIRED_MSG;
}
async function startTrialIfEligible() {
  const { license = {} } = await chrome.storage.local.get('license');
  if (license.trialUsed || license.plan === 'pro' || (license.plan === 'trial' && Date.now() < (license.trialEnd || 0)))
    return { started: false, ...(await getLicense()) };
  const trialEnd = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  await chrome.storage.local.set({
    license: { ...license, plan: 'trial', trialEnd, trialUsed: true },
  });
  return { started: true, ...(await getLicense()) };
}

// ─── MAIN world on WA tab (CSP blocks content-script inline <script>) ───────────
/** Bump when wa-page-main.js behavior changes — stale tabs otherwise keep old IIFE forever. */
const WA_PAGE_MAIN_API_VERSION = 12;

async function ensureWaPageMainApi(tabId) {
  let versionOk = false;
  try {
    const chk = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (v) =>
        typeof window.__waBulkPageMain === 'object' &&
        window.__waBulkPageMain != null &&
        window.__waBulkPageMain.__apiVersion === v,
      args: [WA_PAGE_MAIN_API_VERSION]
    });
    versionOk = !!(chk && chk[0] && chk[0].result === true);
  } catch (e) {
    return { error: 'scripting check: ' + e.message };
  }
  if (versionOk) return null;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          if (window.__waFileInputObserver) {
            window.__waFileInputObserver.disconnect();
            window.__waFileInputObserver = null;
          }
        } catch (e) {}
        window.__waInputsPatched = null;
        delete window.__waBulkPageMain;
      }
    });
  } catch (e) {
    /* ignore */
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['wa-page-main.js'] });
  } catch (e) {
    return { error: 'load wa-page-main.js: ' + e.message };
  }
  return null;
}

async function executeWaPageMain(tabId, method, payload) {
  const args = (payload && payload.args) || [];
  const prep = await ensureWaPageMainApi(tabId);
  if (prep && prep.error) return prep;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [method, args],
      func: (method, args) => {
        const api = window.__waBulkPageMain;
        if (!api) return { error: 'API missing' };
        const fn = api[method];
        if (typeof fn !== 'function') return { error: 'unknown method: ' + String(method) };
        return fn.apply(api, args);
      }
    });
    return result;
  } catch (e) {
    return { error: 'exec: ' + e.message };
  }
}

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'WA_PAGE_MAIN_EXEC') console.log('[WA] Message:', msg.type);

  if (msg.type === 'WA_PAGE_MAIN_EXEC') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ error: 'No tab — open web.whatsapp.com' });
      return false;
    }
    executeWaPageMain(tabId, msg.method, msg.payload || {})
      .then(sendResponse)
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  // Async handlers — return true so Chrome keeps channel open
  const async_handlers = {
    GET_LICENSE:         () => getLicense(),
    ACTIVATE_LICENSE:    () => activateLicense(msg.data),
    START_TRIAL:         () => startTrialIfEligible(),
    GET_FLAG_URLS:       () => getFlagUrls(),
    QUICK_SEND:          () => quickSend(msg.data),
    SCAN_REPLIES:        () => scanReplies(msg.data),
    SEND_REPLY:          () => sendReplyToContact(msg.data),
    OPEN_CHAT_QUOTED:    () => openChatQuoted(msg.data),
    OPEN_CHAT:           () => openChat(msg.data),
    OPEN_CHAT_BY_NAME:   () => openChatByName(msg.data),
    GENERATE_AI_REPLY:   () => generateAIReply(msg.data.replyText, msg.data.contactName, msg.data.apiKey, msg.data.provider),
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
    SAVE_CHAT_REMINDER:     () => saveChatReminder(msg.data),
    GET_CHAT_REMINDERS:     () => getChatReminders(msg.data),
    DELETE_CHAT_REMINDER:   () => deleteChatReminder(msg.data),
    GET_NOTIFICATION_FEED:  () => getNotificationFeed(),
    CLEAR_NOTIFICATION_FEED: () => clearNotificationFeed(),
    TRANSLATE_TEXT:         () => translateText(msg.data),
    SET_TASK_ALARM:         () => setTaskAlarm(msg.data),
    CANCEL_TASK_ALARM:      () => cancelTaskAlarm(msg.data),
    GET_STAGED_MEDIA:       () => getStagedMediaPayload(msg.data?.key),
    // Smart follow-ups
    SAVE_SMART_FOLLOWUP:    () => saveSmartFollowup(msg.data),
    GET_SMART_FOLLOWUPS:    () => getSmartFollowups(),
    DELETE_SMART_FOLLOWUP:  () => deleteSmartFollowup(msg.data),
    // Chat export
    EXPORT_CHAT_CSV:        () => exportChatCSV(msg.data),
    // Status poster
    POST_WA_STATUS:         () => postWaStatus(msg.data),
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
  const denied = await denyIfUnlicensed();
  if (denied) {
    await broadcastProgress({ status: 'error', error: denied });
    return;
  }
  campaignRunning = true;
  shouldStop = false;

  const { contacts, template, templateB, abEnabled, settings } = data;
  const { imageUrl: resolvedUrl, imageMime, imageName, stagingKey } = await resolveInlineOrStagedMedia(data);
  let imageUrl = resolvedUrl;
  console.log('[WA] Campaign start:', contacts.length, 'contacts, A/B:', abEnabled, imageUrl ? '(with media)' : '(text only)');

  const campaignStartTime = Date.now();
  await broadcastProgress({ status: 'starting', total: contacts.length, currentIndex: 0, campaignStartTime, sentCount: 0 });

  try {
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

    const batchSize  = Math.max(5, settings.batchSize  || 20);
    const batchPause = Math.max(30, settings.batchPause || 300);
    let batchCount = 0; // tracks contacts processed in current batch (excluding skipped DNC)

    for (let i = 0; i < contacts.length; i++) {
    if (shouldStop) break;
    const contact = contacts[i];

    // Skip DNC contacts (don't count toward batch)
    const phoneCleanCheck = (contact.phone || '').replace(/[^0-9]/g, '');
    if (dncSet.has(phoneCleanCheck)) {
      results.push({ contact: contact.name || contact.phone, phone: contact.phone, status: 'skipped', error: 'DNC — contact opted out', variant: 'A' });
      const sc0 = results.filter(r => r.status === 'sent').length;
      await broadcastProgress({ status: 'skipped', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant: 'A', results: [...results], sentCount: sc0 });
      continue;
    }

    // A/B assignment — alternate or random 50/50
    const useB = abEnabled && templateB && (i % 2 === 1);
    const variant = useB ? 'B' : 'A';

    const scBefore = results.filter(r => r.status === 'sent').length;
    await broadcastProgress({ status: 'personalizing', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant, sentCount: scBefore });

    const chosenTemplate = useB ? templateB : template;
    const message = await buildMessage(chosenTemplate, contact, settings);

    await broadcastProgress({ status: 'sending', currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant, preview: message.substring(0, 60), sentCount: scBefore });

      const result = await sendWhatsAppMessage(waTabId, contact.phone, message, settings.stealthMode, imageUrl || null, imageMime, imageName, stagingKey || null);
    console.log('[WA] Result for', contact.phone, ':', result.success, result.error || '');
    if ((imageUrl || stagingKey) && !result.success && result.error) {
      chrome.storage.local.set({ lastMediaError: result.error });
    }

    // Native WhatsApp Poll (tap options) — only on WA Web, sent after main message/media
    const ro = settings.replyOptions;
    if (result?.success && !result.dedupGuard && ro?.enabled && ro.mode === 'poll') {
      const pollLines = (ro.lines || []).map(s => String(s).trim()).filter(Boolean);
      if (pollLines.length >= 2) {
        const pqRaw = (ro.pollQuestion && String(ro.pollQuestion).trim()) ? ro.pollQuestion : 'Quick question — tap one option:';
        const pollQuestion = fillTemplate(pqRaw, contact);
        await sleep(1800);
        const pollRes = await sendMessageToTab(waTabId, {
          type: 'SEND_POLL',
          requestId: `poll_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          pollQuestion,
          pollOptions: pollLines.slice(0, 12)
        }, 6);
        if (!pollRes || !pollRes.success) {
          console.warn('[WA] Poll send failed:', pollRes?.error || pollRes);
        }
      }
    }

    if (useB) bSent++; else aSent++;
    batchCount++;

    // Detect invalid/not-found numbers vs other failures
    const isInvalid = !result.success && result.error && (
      result.error.includes('No search result') ||
      result.error.includes('not found') ||
      result.error.includes('Chat did not open')
    );
    const resultStatus = result.success ? 'sent' : (isInvalid ? 'invalid' : 'failed');

    results.push({ contact: contact.name || contact.phone, phone: contact.phone, status: resultStatus, error: result.error || null, message, variant });

    const scAfter = results.filter(r => r.status === 'sent').length;
    await broadcastProgress({ status: resultStatus, currentIndex: i, total: contacts.length, contact: contact.name || contact.phone, phone: contact.phone, variant, results: [...results], campaignStartTime, sentCount: scAfter });

    const isLastContact = (i === contacts.length - 1);
    if (!isLastContact && !shouldStop) {
      // ── Batch long break: after every batchSize messages, take a long pause ──
      if (batchCount >= batchSize) {
        batchCount = 0;
        console.log(`[WA] Batch of ${batchSize} done — pausing ${batchPause}s before next batch`);
        for (let s = batchPause; s > 0; s--) {
          if (shouldStop) break;
          await broadcastProgress({ status: 'batch_pause', currentIndex: i, total: contacts.length, nextIn: s, batchPause, campaignStartTime, sentCount: scAfter, results: [...results] });
          await sleep(1000);
        }
      } else {
        // Normal between-message delay (random between min and max)
        const delaySec = randomInt(settings.minDelay, settings.maxDelay);
        for (let s = delaySec; s > 0; s--) {
          if (shouldStop) break;
          await broadcastProgress({ status: 'waiting', currentIndex: i, total: contacts.length, nextIn: s, campaignStartTime, sentCount: scAfter });
          await sleep(1000);
        }
      }
    }
    }

    // If campaign was stopped early, mark remaining contacts as not_sent
    if (shouldStop && results.length < contacts.length) {
      for (let i = results.length; i < contacts.length; i++) {
        const contact = contacts[i];
        results.push({ contact: contact.name || contact.phone, phone: contact.phone, status: 'not_sent', error: 'Campaign stopped', variant: 'A' });
      }
    }

    campaignRunning = false;

    // Update analytics (only count actually-processed contacts, not not_sent)
    const processedResults = results.filter(r => r.status !== 'not_sent');
    await updateAnalytics(processedResults, abEnabled ? { aSent, bSent, aReplies, bReplies } : null, settings.campaignName || '', template.substring(0, 80));

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'WA Bulk AI — Campaign Complete',
      message: `Sent ${results.filter(r => r.status === 'sent').length}/${contacts.length} messages`
    });

    await broadcastProgress({ status: 'completed', total: contacts.length, results, abStats: abEnabled ? { aSent, bSent } : null, campaignStartTime, campaignDurationMs: Date.now() - campaignStartTime, sentCount: results.filter(r => r.status === 'sent').length });
  } finally {
    campaignRunning = false;
    await removeStagingKey(stagingKey);
  }
}

// ─── Quick Send ───────────────────────────────────────────────────────────────
async function quickSend(data) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  const { phone, message, stealthMode } = data;
  console.log('[WA-DBG] quickSend: imageStagingKey=', data.imageStagingKey, 'inlineImageLen=', (data.imageUrl||'').length);
  const { imageUrl: resolvedImg, imageMime, imageName, stagingKey } = await resolveInlineOrStagedMedia(data);
  const imageUrl = resolvedImg;
  console.log('[WA-DBG] quickSend: resolvedImageLen=', (imageUrl||'').length, 'stagingKey=', stagingKey);
  console.log('[WA] Quick send to:', phone, imageUrl ? '(with media)' : '(text only)');

  const dncStored = await chrome.storage.local.get('dnc');
  const phoneClean = (phone || '').replace(/[^0-9]/g, '');
  if ((dncStored.dnc || []).map(p => p.replace(/[^0-9]/g, '')).includes(phoneClean)) {
    return { success: false, error: 'DNC — this number has opted out' };
  }

  try {
    const tabId = await findOrCreateWATab();
    await sleep(1500);
    const result = await sendWhatsAppMessage(tabId, phone, message || '', stealthMode || false, imageUrl || null, imageMime || 'image/jpeg', imageName || 'image.jpg', stagingKey || null);
    if ((imageUrl || stagingKey) && !result.success && result.error) {
      chrome.storage.local.set({ lastMediaError: result.error });
    }
    return result;
  } finally {
    await removeStagingKey(stagingKey);
  }
}

// ─── Schedule Campaign ────────────────────────────────────────────────────────
async function scheduleCampaign(data) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied, replies: [] };
  const { contacts, apiKey, provider } = data;
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
          aiSuggestion = await generateAIReply(result.text, contact.name || contact.phone, apiKey, provider);
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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

// ─── Open Chat (navigate only, no send) ──────────────────────────────────────
async function openChat(data) {
  const phoneClean = (data.phone || '').replace(/[^0-9]/g, '');
  if (!phoneClean) return { success: false, error: 'Invalid phone' };
  const tabId = await findOrCreateWATab();
  await chrome.tabs.update(tabId, { url: `https://web.whatsapp.com/send?phone=${phoneClean}`, active: true });
  return { success: true };
}

// ─── Open Chat by Name (groups / chats without phone number) ─────────────────
async function openChatByName(data) {
  const tabId = await findOrCreateWATab();
  await chrome.tabs.update(tabId, { active: true });
  const response = await sendMessageToTab(tabId, { type: 'OPEN_CHAT_BY_NAME', data }, 4);
  return response || { success: false, error: 'No response from WA page' };
}

// ─── Open Chat & Quote (no auto-send) ────────────────────────────────────────
async function openChatQuoted(data) {
  const { phone, originalText } = data;

  const tabId = await findOrCreateWATab();
  const phoneClean = phone.replace(/[^0-9]/g, '');
  const url = `https://web.whatsapp.com/send?phone=${phoneClean}`;
  await chrome.tabs.update(tabId, { url, active: true });
  await sleep(800);
  await waitForTabLoad(tabId);
  await sleep(5000);

  const response = await sendMessageToTab(tabId, {
    type: 'OPEN_CHAT_QUOTED',
    originalText: originalText || ''
  }, 4);
  return response || { success: false, error: 'No response from WA page' };
}

// ─── AI Reply Generator ───────────────────────────────────────────────────────
async function generateAIReply(replyText, contactName, apiKey, provider) {
  const denied = await denyIfUnlicensed();
  if (denied) return null;
  const prompt = `You are helping reply to a WhatsApp message from ${contactName}.\n\nTheir message: "${replyText}"\n\nWrite a short, friendly, natural reply (max 2 sentences). Be helpful and conversational. Return ONLY the reply text, nothing else.`;
  const useGemini = (provider || 'gemini') === 'gemini';
  if (useGemini && apiKey) {
    const out = await getGeminiReply('You are a helpful assistant. Reply naturally and briefly.', replyText, apiKey);
    return out.reply || null;
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
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

/** Resolve staged image/video — content scripts cannot use chrome.storage.session (extension contexts only). */
async function getStagedMediaPayload(key) {
  if (!key) return null;
  try {
    const s = await chrome.storage.session.get(key);
    const p = s?.[key];
    if (p?.imageData) return p;
  } catch (_e) {}
  try {
    const l = await chrome.storage.local.get(key);
    const p = l?.[key];
    if (p?.imageData) return p;
    if (p?.chunked && p.chunks > 0) {
      const chunkKeys = Array.from({ length: p.chunks }, (_, i) => `${key}_c${i}`);
      const chunkData = await chrome.storage.local.get(chunkKeys);
      const imageData = chunkKeys.map(k => chunkData[k] || '').join('');
      return { imageData, imageMime: p.imageMime, imageName: p.imageName, caption: p.caption };
    }
  } catch (_e) {}
  return null;
}

/** When OPEN_AND_SEND fails, only use /send?phone + SEND_WITH_IMAGE if chat never opened. If we already ran sendImageWithCaption in-tab, a second path duplicates the image (content script state resets on navigation, so requestId dedup is lost). */
function shouldHardNavMediaFallback(response) {
  if (response == null) return true;
  if (response.success) return false;
  const err = String(response.error || '');
  return /no search result|chat did not open|not logged in|scan qr/i.test(err);
}

// ─── WA Tab & Message Sending (navigate per contact — reliable) ─
async function sendWhatsAppMessage(tabId, phone, message, stealthMode = false, imageUrl = null, imageMime = 'image/jpeg', imageName = 'image.jpg', stagingKey = null) {
  try {
    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (!phoneClean) return { success: false, error: 'Invalid phone number' };
    const hasMedia = !!(imageUrl || stagingKey);
    const sig = `${phoneClean}|${hasMedia ? 'M' : 'T'}|${String(message || '').trim()}`;
    const now = Date.now();
    const prev = __waRecentSendGuard.get(sig);
    if (prev && (now - prev) < 15000) return { success: true, dedupGuard: true };
    __waRecentSendGuard.set(sig, now);
    const requestId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${phoneClean.slice(-6)}`;

    if (hasMedia) {
      const isVideo = (imageMime || '').startsWith('video/');
      const name = imageName || (isVideo ? 'video.mp4' : 'image.jpg');

      // Determine which storage key content.js should read from.
      // Prefer storing a fresh waSendImage entry so session storage is the fast path.
      // If both session and local fail (file too large for per-item quota), fall back to
      // the staging key that sidepanel already wrote — content.js can read it directly.
      let imageKeyToUse = stagingKey || null; // fallback if storage writes fail
      const dataLen = (imageUrl || '').length;
      console.log('[WA-DBG] sendWhatsAppMessage: hasMedia=true, imageUrlLen=', dataLen, 'stagingKey=', stagingKey, 'isVideo=', isVideo);

      if (imageUrl) {
        const payload = { imageData: imageUrl, imageMime, imageName: name, caption: message || '' };
        try {
          await chrome.storage.session.set({ waSendImage: payload });
          imageKeyToUse = 'waSendImage';
          console.log('[WA-DBG] stored in SESSION as waSendImage');
        } catch (_e1) {
          console.log('[WA-DBG] session storage failed:', _e1.message, '— trying local');
          try {
            await chrome.storage.local.set({ waSendImage: payload });
            imageKeyToUse = 'waSendImage';
            console.log('[WA-DBG] stored in LOCAL as waSendImage');
          } catch (_e2) {
            console.log('[WA-DBG] local storage also failed:', _e2.message, '— using stagingKey fallback:', stagingKey);
            // Both storage writes failed (file too large for per-item quota).
            // Use staging key if available — content.js reads chunked data from it directly.
            if (!stagingKey) {
              return { success: false, error: 'Could not store media for send — file is too large. Use a smaller image or compress the video.' };
            }
            // imageKeyToUse already set to stagingKey above
          }
        }
      }

      console.log('[WA-DBG] imageKeyToUse=', imageKeyToUse);
      if (!imageKeyToUse) {
        return { success: false, error: 'No media storage key — attach the file again and retry.' };
      }

      await sleep(120);
      // Fast path: in-tab navigation via sidebar search (no full WA reload)
      const fastPayload = {
        type: 'OPEN_AND_SEND',
        requestId,
        phone: phoneClean,
        imageKey: imageKeyToUse,
        imageMime,
        imageName: name,
        caption: message || '',
        message: message || ''
      };
      if (dataLen > 0 && dataLen < 120000) fastPayload.imageData = imageUrl;
      // Give more retries for video — content script waits up to 45 s for WA to process
      let response = await sendMessageToTab(tabId, fastPayload, isVideo ? 8 : 5);

      // Fallback: hard nav + SEND_WITH_IMAGE only when sidebar search failed to open chat.
      // Do NOT run after media-send errors — that produced "one bare image + one with caption" duplicates.
      if (shouldHardNavMediaFallback(response)) {
        await chrome.tabs.update(tabId, { url: `https://web.whatsapp.com/send?phone=${phoneClean}`, active: !stealthMode });
        await sleep(800);
        await waitForTabLoad(tabId);
        await waitForWAReady(tabId, isVideo ? 18000 : 14000);
        // Dismiss any "invalid phone number" popup WA shows after URL navigation
        await sendMessageToTab(tabId, { type: 'DISMISS_DIALOG' }, 2).catch(() => {});
        await sleep(300);
        const navPayload = {
          type: 'SEND_WITH_IMAGE',
          requestId,
          imageKey: imageKeyToUse,
          imageMime,
          imageName: name,
          caption: message || ''
        };
        if (dataLen > 0 && dataLen < 120000) navPayload.imageData = imageUrl;
        response = await sendMessageToTab(tabId, navPayload, 8);
      }
      return response || { success: false, error: 'No response from WA page — is WA Web logged in?' };
    }

    // Text: one OPEN_AND_SEND only — retries here re-ran full type+send and caused double messages.
    const response = await sendMessageToTab(
      tabId,
      { type: 'OPEN_AND_SEND', requestId, phone: phoneClean, message: message || '' },
      5
    );
    return response || { success: false, error: 'Could not send — check WA Web is open and logged in' };
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
      if (i < retries) await sleep(600);
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

/** Poll content script PING until WA is ready (replaces fixed sleep after hard-nav reload).
 *  WA loads from PWA cache in ~2-4 s — no reason to wait 8-9 s unconditionally. */
async function waitForWAReady(tabId, maxMs = 18000) {
  const deadline = Date.now() + maxMs;
  await sleep(1500); // minimum boot time
  while (Date.now() < deadline) {
    try {
      const r = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (r?.ready) return true;
    } catch (_) {}
    await sleep(700);
  }
  return false;
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
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Trim odd whitespace from templates so Lexical does not echo blocks; \n\n\n+ often reads as “repeated” promo. */
function normalizeCampaignMessage(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trimEnd();
}

async function resolveInlineOrStagedMedia(data) {
  let imageUrl = data.imageUrl || null;
  let imageMime = data.imageMime || 'image/jpeg';
  let imageName = data.imageName || 'image.jpg';
  const key = data.imageStagingKey || null;
  if (key) {
    try {
      const r = await chrome.storage.local.get(key);
      const p = r[key];
      if (p?.imageData) {
        imageUrl = p.imageData;
        imageMime = p.imageMime || imageMime;
        imageName = p.imageName || imageName;
      } else if (p?.chunked && p.chunks > 0) {
        // Large file stored in chunks — reassemble
        const chunkKeys = Array.from({ length: p.chunks }, (_, i) => `${key}_c${i}`);
        const chunkData = await chrome.storage.local.get(chunkKeys);
        imageUrl = chunkKeys.map(k => chunkData[k] || '').join('');
        imageMime = p.imageMime || imageMime;
        imageName = p.imageName || imageName;
      }
    } catch (_) {}
  }
  return { imageUrl, imageMime, imageName, stagingKey: key };
}

/** Remove a staging key and all its chunk keys from chrome.storage.local. */
async function removeStagingKey(key) {
  if (!key) return;
  try {
    const r = await chrome.storage.local.get(key);
    const meta = r[key];
    if (meta?.chunked && meta.chunks > 0) {
      const chunkKeys = Array.from({ length: meta.chunks }, (_, i) => `${key}_c${i}`);
      await chrome.storage.local.remove([key, ...chunkKeys]);
    } else {
      await chrome.storage.local.remove(key);
    }
  } catch (_) {}
}

function fillTemplateValue(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => (x == null ? '' : String(x))).join(', ');
  if (typeof v === 'object') return '';
  return String(v);
}

/** Placeholder fill — use function replacer so values with `$` / `$$` / `$&` don't duplicate text. */
function fillTemplate(template, contact) {
  let msg = template;
  for (const [k, v] of Object.entries(contact)) {
    if (!k || typeof k !== 'string') continue;
    const repl = fillTemplateValue(v);
    msg = msg.replace(new RegExp(`\\{${escapeRegExp(k)}\\}`, 'gi'), () => repl);
  }
  return normalizeCampaignMessage(msg);
}

/** Plain-text “button-like” choices for campaigns (poll mode uses native WA Poll instead). */
function formatReplyOptionsBlock(replyOptions) {
  const ro = replyOptions;
  if (!ro || !ro.enabled) return '';
  if (ro.mode === 'poll') return '';
  const lines = (ro.lines || []).map(s => String(s).trim()).filter(Boolean);
  if (!lines.length) return '';
  const fmt = ro.format || 'numbered';
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let out = '\n\n';
  const hdr = (ro.header && String(ro.header).trim()) ? String(ro.header).trim() : 'Reply with a number:';
  out += hdr + (hdr.endsWith(':') ? '' : ':') + '\n';
  lines.forEach((line, i) => {
    if (fmt === 'bullet') out += `• ${line}\n`;
    else if (fmt === 'emoji') out += `${emojis[i] || `${i + 1}.`} ${line}\n`;
    else out += `${i + 1}. ${line}\n`;
  });
  return out.trimEnd();
}

function appendReplyOptionsToMessage(body, settings) {
  const extra = formatReplyOptionsBlock(settings?.replyOptions);
  if (!extra) return normalizeCampaignMessage(body);
  return normalizeCampaignMessage(String(body || '') + extra);
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

  const useGemini = (settings.aiProvider || 'gemini') === 'gemini';
  const apiKey = useGemini ? (settings.geminiApiKey || '') : (settings.apiKey || '');
  if (!settings.aiEnabled || !apiKey) return appendReplyOptionsToMessage(base, settings);

  const prompt = `Personalize this WhatsApp message for the contact. Make it feel natural and personal. Keep the same intent. Max 300 chars. Return ONLY the message.\n\nContact: ${JSON.stringify(contact)}\n\nMessage:\n${base}`;
  try {
    if (useGemini) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
        })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error?.message || 'API ' + res.status);
      const raw = d.candidates?.[0]?.content?.parts?.[0]?.text;
      return appendReplyOptionsToMessage((raw && typeof raw === 'string') ? raw.trim() : base, settings);
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
    return appendReplyOptionsToMessage(d.content?.[0]?.text?.trim() || base, settings);
  } catch (e) {
    console.warn('[WA] AI failed:', e.message);
    return appendReplyOptionsToMessage(base, settings);
  }
}

// ─── Follow-up Alarms ─────────────────────────────────────────────────────────
async function setFollowup({ phone, timestamp }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  const alarmName = `followup-${phone}`;
  chrome.alarms.clear(alarmName);
  if (timestamp && timestamp > Date.now()) {
    chrome.alarms.create(alarmName, { when: timestamp });
    console.log('[WA] Follow-up set for', phone, new Date(timestamp).toLocaleString());
  }
  return { success: true };
}

async function clearFollowup({ phone }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  chrome.alarms.clear(`followup-${phone}`);
  return { success: true };
}

// ─── AI Reply Classifier ──────────────────────────────────────────────────────
async function classifyReply(text, apiKey) {
  if (!apiKey) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
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
  if (await denyIfUnlicensed()) { console.log('[WA] Birthday check skipped: no license'); return; }
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
const DEFAULT_AI_AUTO_REPLY_PROMPT = `You are a helpful assistant replying to WhatsApp messages. Use the conversation context: read the recent chat and reply in a way that makes sense. Don't repeat the same phrase every time — vary your replies based on what they said (e.g. answer their question, refer to earlier messages). Reply naturally and briefly (1-2 sentences). Return ONLY the reply text, no quotes or labels.`;

function formatChatHistoryForPrompt(chatHistory) {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return '';
  const lines = chatHistory.map(m => {
    const who = m.role === 'user' ? 'Them' : 'Me';
    return `${who}: ${(m.text || '').trim()}`;
  }).filter(s => s.length > 0);
  return lines.join('\n');
}

async function getGeminiReply(instruction, userMessage, apiKey, chatHistory) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  let block = `${instruction}\n\n---\n`;
  const historyStr = formatChatHistoryForPrompt(chatHistory);
  if (historyStr) block += `Recent conversation:\n${historyStr}\n\n`;
  block += `Latest message from them: "${(userMessage || '').trim()}"\n\nReply to the latest message (use context; don't say the same thing every time). Only the reply text:`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: block }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.8 }
    })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { reply: null, error: d.error?.message || 'API ' + res.status };
  const raw = d.candidates?.[0]?.content?.parts?.[0]?.text;
  return { reply: (raw && typeof raw === 'string') ? raw.trim() : null };
}

async function getAIAutoReply({ text, prompt, apiKey, provider, chatHistory }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { reply: null, error: denied };
  const key = (apiKey || '').trim();
  if (!key) return { reply: null, error: 'No API key' };
  const instruction = (prompt && prompt.trim()) ? prompt.trim() : DEFAULT_AI_AUTO_REPLY_PROMPT;
  const useGemini = (provider || 'gemini') === 'gemini';
  const historyStr = formatChatHistoryForPrompt(chatHistory);
  const userBlock = historyStr
    ? `Recent conversation:\n${historyStr}\n\nLatest message from them: "${(text || '').trim()}"\n\nReply to the latest message (use context; vary your reply). Only the reply text:`
    : `Message from user: "${(text || '').trim()}"\n\nYour reply (only the reply text):`;
  try {
    if (useGemini) {
      return await getGeminiReply(instruction, text, key, chatHistory);
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        messages: [{ role: 'user', content: `${instruction}\n\n---\n${userBlock}` }]
      })
    });
    const d = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[WA] AI auto-reply API error:', response.status, d.error || response.statusText);
      return { reply: null, error: d.error?.message || 'API error ' + response.status };
    }
    const raw = d.content?.[0]?.text;
    return { reply: (raw && typeof raw === 'string') ? raw.trim() : null };
  } catch (e) {
    console.warn('[WA] AI auto-reply failed:', e.message);
    return { reply: null, error: e.message };
  }
}

// ─── Drip Campaigns ───────────────────────────────────────────────────────────
async function saveDripSeq({ sequence }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  const stored = await chrome.storage.local.get('drip_sequences');
  let seqs = stored.drip_sequences || [];
  const idx = seqs.findIndex(s => s.id === sequence.id);
  if (idx >= 0) seqs[idx] = sequence; else seqs.push(sequence);
  await chrome.storage.local.set({ drip_sequences: seqs });
  return { success: true };
}

async function deleteDripSeq({ id }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: true, sequences: [], enrollments: [] };
  const stored = await chrome.storage.local.get(['drip_sequences', 'drip_enrollments']);
  return { success: true, sequences: stored.drip_sequences || [], enrollments: stored.drip_enrollments || [] };
}

async function executeDripStep(alarmName) {
  const denied = await denyIfUnlicensed();
  if (denied) { console.warn('[WA] Drip step skipped:', denied); return; }
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

  const enrollment = enrolls[enrollIdx];
  const contact = { phone, name: enrollment.name || phone };
  const message = fillTemplate(step.template, contact);

  console.log(`[WA] Drip step ${stepIndex} for ${phone} in seq "${seq.name}"`);

  const tabId = await findOrCreateWATab();
  await sleep(2000);
  await sendWhatsAppMessage(tabId, phone, message);

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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  if (!webhookUrl) return { success: false, error: 'No webhook URL provided' };
  const r = await sendWebhook('test', { message: 'WA Bulk AI test ping', ts: Date.now() }, webhookUrl);
  return r?.ok ? { success: true } : { success: false, error: `HTTP ${r?.status || 'error'}: ${r?.error || 'Request failed'}` };
}

// ─── Daily Business Digest ────────────────────────────────────────────────────
async function generateDigest() {
  if (await denyIfUnlicensed()) { console.log('[WA] Digest skipped: no license'); return; }
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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
  if (await denyIfUnlicensed()) return;
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
  appendNotificationFeed({
    type: 'meeting',
    title: `${whenTxt} — ${meeting.contactName}`,
    message: `${meeting.title} • ${timeStr} • ${dateStr}`
  });

  // Auto-send reminder WhatsApp message to the contact
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    const reminder = `⏰ *Meeting Reminder*\n\n*${meeting.title}* is starting ${minsLeft <= 1 ? 'now!' : `in ${minsLeft} minutes!`}\n📆 ${dateStr} · 🕐 ${timeStr} · 💻 ${meeting.platform}${meeting.link ? `\n🔗 ${meeting.link}` : ''}`;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'SEND_MEETING_REMINDER', reminder, contactName: meeting.contactName }).catch(() => {});
  }
}

// ─── Per-Chat Reminder Alerts ──────────────────────────────────────────────────
async function saveChatReminder({ contactName, title, remindAt, note = '' }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  if (!contactName || !title || !remindAt) {
    return { success: false, error: 'Missing reminder fields' };
  }
  const when = Number(remindAt);
  if (!Number.isFinite(when) || when <= Date.now()) {
    return { success: false, error: 'Reminder time must be in the future' };
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reminder = { id, contactName, title, note, remindAt: when, createdAt: Date.now() };
  const stored = await chrome.storage.local.get('chatReminders');
  const reminders = stored.chatReminders || [];
  reminders.push(reminder);
  if (reminders.length > 300) reminders.splice(0, reminders.length - 300);
  await chrome.storage.local.set({ chatReminders: reminders });
  chrome.alarms.create(`chat-reminder-${id}`, { when });
  return { success: true, id };
}

async function getChatReminders({ contactName } = {}) {
  const stored = await chrome.storage.local.get('chatReminders');
  let reminders = stored.chatReminders || [];
  if (contactName) {
    const needle = String(contactName).toLowerCase().trim();
    reminders = reminders.filter(r => String(r.contactName || '').toLowerCase() === needle);
  }
  reminders = reminders.filter(r => r.remindAt > Date.now()).sort((a, b) => a.remindAt - b.remindAt);
  return { success: true, reminders };
}

async function deleteChatReminder({ id }) {
  if (!id) return { success: false, error: 'Reminder id missing' };
  chrome.alarms.clear(`chat-reminder-${id}`);
  const stored = await chrome.storage.local.get('chatReminders');
  const reminders = (stored.chatReminders || []).filter(r => r.id !== id);
  await chrome.storage.local.set({ chatReminders: reminders });
  return { success: true };
}

async function handleChatReminderAlert(alarmName) {
  const id = alarmName.replace('chat-reminder-', '');
  const stored = await chrome.storage.local.get('chatReminders');
  const reminder = (stored.chatReminders || []).find(r => r.id === id);
  if (!reminder) return;

  const whenDt = new Date(reminder.remindAt);
  const timeStr = whenDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = whenDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const noteSuffix = reminder.note ? `\n📝 ${reminder.note}` : '';

  chrome.notifications.create(`chat-reminder-notif-${id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/chat-reminder-icon.png'),
    title: `Reminder — ${reminder.contactName}`,
    message: `${reminder.title}\n${dateStr} · ${timeStr}${noteSuffix}`,
    priority: 2,
    requireInteraction: true
  });
  appendNotificationFeed({
    type: 'reminder',
    title: `Reminder — ${reminder.contactName}`,
    message: `${reminder.title} • ${dateStr} • ${timeStr}${reminder.note ? ` • ${reminder.note}` : ''}`
  });

  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SHOW_CHAT_REMINDER_ALERT',
      data: {
        id: reminder.id,
        contactName: reminder.contactName,
        title: reminder.title,
        note: reminder.note || '',
        dateStr,
        timeStr
      }
    }).catch(() => {});
  }

  const remaining = (stored.chatReminders || []).filter(r => r.id !== id);
  await chrome.storage.local.set({ chatReminders: remaining });
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
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
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

// ─── Task Alarms ──────────────────────────────────────────────────────────────
async function setTaskAlarm({ taskId, title, when }) {
  await chrome.alarms.create('task-' + taskId, { when });
  console.log('[WA] Task alarm set:', taskId, new Date(when).toLocaleString());
  return { success: true };
}

async function cancelTaskAlarm({ taskId }) {
  await chrome.alarms.clear('task-' + taskId);
  return { success: true };
}

async function handleTaskAlarm(alarmName) {
  const taskId = alarmName.replace('task-', '');
  const { waTasks = [] } = await chrome.storage.local.get('waTasks');
  const task = waTasks.find(t => t.id === taskId);
  if (!task || task.done) return;
  chrome.notifications.create('task-notif-' + taskId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '⏰ Task Reminder — WA Bulk AI',
    message: task.title,
    priority: 2
  });
  appendNotificationFeed({
    type: 'task',
    title: 'Task Reminder',
    message: task.title
  });
  console.log('[WA] Task alarm fired:', task.title);
}

async function getNotificationFeed() {
  const stored = await chrome.storage.local.get(NOTIFICATION_FEED_KEY);
  const items = Array.isArray(stored[NOTIFICATION_FEED_KEY]) ? stored[NOTIFICATION_FEED_KEY] : [];
  return { success: true, items };
}

async function clearNotificationFeed() {
  await chrome.storage.local.set({ [NOTIFICATION_FEED_KEY]: [] });
  return { success: true };
}

// ─── Smart Follow-up Sequences ────────────────────────────────────────────────
/** Rule: { id, name, contacts:[{phone,name}], delayDays, message, condition:'no_reply'|'always', createdAt, status:'active'|'done' } */
async function saveSmartFollowup(rule) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  if (!rule || !rule.contacts?.length || !rule.message || !rule.delayDays) {
    return { success: false, error: 'Missing required fields (contacts, message, delayDays)' };
  }
  const id = rule.id || ('sfu-' + Date.now());
  rule.id = id;
  rule.createdAt = rule.createdAt || Date.now();
  rule.status = 'active';

  const stored = await chrome.storage.local.get('smartFollowups');
  const rules = stored.smartFollowups || [];
  const idx = rules.findIndex(r => r.id === id);
  if (idx >= 0) rules[idx] = rule; else rules.push(rule);
  await chrome.storage.local.set({ smartFollowups: rules });

  // Schedule alarm: fire after delayDays from now
  const when = Date.now() + rule.delayDays * 24 * 60 * 60 * 1000;
  chrome.alarms.create(`smart-fu-${id}`, { when });
  console.log('[WA] Smart follow-up scheduled:', rule.name, 'in', rule.delayDays, 'days');
  return { success: true, id };
}

async function getSmartFollowups() {
  const stored = await chrome.storage.local.get('smartFollowups');
  return { success: true, rules: stored.smartFollowups || [] };
}

async function deleteSmartFollowup({ id }) {
  chrome.alarms.clear(`smart-fu-${id}`);
  const stored = await chrome.storage.local.get('smartFollowups');
  const rules = (stored.smartFollowups || []).filter(r => r.id !== id);
  await chrome.storage.local.set({ smartFollowups: rules });
  return { success: true };
}

async function executeSmartFollowup(id) {
  const denied = await denyIfUnlicensed();
  if (denied) { console.warn('[WA] Smart follow-up skipped:', denied); return; }

  const stored = await chrome.storage.local.get(['smartFollowups', 'replies']);
  const rules = stored.smartFollowups || [];
  const rule = rules.find(r => r.id === id);
  if (!rule || rule.status !== 'active') return;

  const repliedPhones = new Set((stored.replies || []).map(r => (r.phone || '').replace(/[^0-9]/g, '')));

  const tabId = await findOrCreateWATab();
  await sleep(2000);
  let sent = 0;

  for (const contact of (rule.contacts || [])) {
    const phoneClean = (contact.phone || '').replace(/[^0-9]/g, '');
    if (!phoneClean) continue;
    // Condition: skip if they already replied (no_reply mode)
    if (rule.condition === 'no_reply' && repliedPhones.has(phoneClean)) {
      console.log('[WA] Smart FU: skipping', phoneClean, '(already replied)');
      continue;
    }
    const msg = (rule.message || '').replace(/\{name\}/gi, contact.name || contact.phone);
    await sendWhatsAppMessage(tabId, phoneClean, msg);
    sent++;
    await sleep(3000);
  }

  // Mark as done
  const idx = rules.findIndex(r => r.id === id);
  if (idx >= 0) { rules[idx].status = 'done'; rules[idx].sentCount = sent; rules[idx].executedAt = Date.now(); }
  await chrome.storage.local.set({ smartFollowups: rules });

  chrome.notifications.create(`smart-fu-done-${id}`, {
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: 'Smart Follow-up Done — WA Bulk AI',
    message: `Sent ${sent} follow-up messages for "${rule.name || 'Follow-up'}"`
  });
  console.log('[WA] Smart follow-up executed:', id, 'sent:', sent);
}

// ─── Chat Export ──────────────────────────────────────────────────────────────
async function exportChatCSV({ phone, name }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  const phoneClean = (phone || '').replace(/[^0-9]/g, '');
  if (!phoneClean) return { success: false, error: 'Invalid phone' };

  const tabId = await findOrCreateWATab();
  await chrome.tabs.update(tabId, { url: `https://web.whatsapp.com/send?phone=${phoneClean}`, active: true });
  await waitForTabLoad(tabId);
  await sleep(4000);

  const res = await sendMessageToTab(tabId, { type: 'READ_CHAT_MESSAGES', limit: 200 }, 4);
  if (!res || !res.messages) return { success: false, error: 'Could not read chat messages' };

  const header = 'Time,From,Message\n';
  const rows = res.messages.map(m => {
    const time = m.time || '';
    const from = m.from === 'me' ? (name || 'Me') : (name || phone);
    const msg = (m.text || '').replace(/"/g, '""');
    return `"${time}","${from}","${msg}"`;
  }).join('\n');

  return { success: true, csv: header + rows, count: res.messages.length };
}

// ─── WhatsApp Status Poster ───────────────────────────────────────────────────
async function postWaStatus({ text, imageDataUrl, imageMime }) {
  const denied = await denyIfUnlicensed();
  if (denied) return { success: false, error: denied };
  if (!text && !imageDataUrl) return { success: false, error: 'Provide text or image for status' };

  const tabId = await findOrCreateWATab();
  await chrome.tabs.update(tabId, { active: true });
  await sleep(1500);

  const res = await sendMessageToTab(tabId, {
    type: 'POST_WA_STATUS',
    text: text || '',
    imageData: imageDataUrl || null,   // full data URL (data:image/...;base64,...)
    imageMime: imageMime || 'image/jpeg'
  }, 5);
  return res || { success: false, error: 'No response from WA page' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function broadcastProgress(data) {
  try { await chrome.storage.local.set({ campaignProgress: { ...data, ts: Date.now() } }); } catch (e) {}
  try { chrome.runtime.sendMessage({ type: 'PROGRESS', data }); } catch (e) {}

}

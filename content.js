// content.js — Injected into web.whatsapp.com v2.0

// ─── Selectors ────────────────────────────────────────────────────────────────
const SEL = {
  sendButton: [
    'button[data-testid="compose-btn-send"]',
    '[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'span[data-icon="send"]'
  ],
  msgContainer: [
    '[data-testid="msg-container"]',
    '.message-in',
    '.message-out'
  ],
  outgoingIndicator: [
    '[data-icon="msg-dblcheck"]',
    '[data-icon="msg-check"]',
    '[data-icon="msg-time"]',
    '[data-testid="msg-dblcheck"]',
    '[data-testid="msg-check"]'
  ],
  msgText: [
    '.selectable-text.copyable-text',
    'span.selectable-text',
    '.copyable-text span'
  ],
  qrCode: ['canvas[aria-label]', '[data-testid="qrcode"]'],
  invalidDialog: ['[data-animate-modal-popup]', '[data-testid="popup-contents"]'],
  attachBtn: [
    '[data-testid="clip"]',
    '[data-testid="attach-menu-plus"]',
    'span[data-icon="attach-menu-plus"]'
  ],
  imageInput: 'input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]',
  captionInput: [
    'div[contenteditable="true"][data-tab="11"]',
    '[data-testid="media-caption-input-container"] div[contenteditable]'
  ],
  newChatBtn: [
    '[data-testid="new-chat-btn"]',
    '[aria-label="New chat"]',
    '[title="New chat"]',
    'span[data-icon="new-chat-outline"]'
  ],
  searchInput: [
    '[data-testid="search-input"]',
    'div[contenteditable][data-tab="3"]',
    '[aria-label="Search input textbox"]'
  ],
  composeBox: [
    'div[contenteditable][data-tab="10"]',
    '[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable]'
  ]
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findEl(selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const s of list) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

async function waitForEl(selectors, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = findEl(selectors);
    if (el) return el;
    await sleep(300);
  }
  return null;
}

// ─── Click Send ───────────────────────────────────────────────────────────────
async function clickSend() {
  if (findEl(SEL.qrCode)) return { success: false, error: 'WA Web not logged in — scan QR first' };

  const deadline = Date.now() + 13000;
  while (Date.now() < deadline) {
    const dialog = findEl(SEL.invalidDialog);
    if (dialog) {
      const t = dialog.textContent.toLowerCase();
      if (t.includes('invalid') || t.includes('not') || t.includes('error')) {
        const btn = dialog.querySelector('button');
        if (btn) btn.click();
        return { success: false, error: 'Phone not on WhatsApp or invalid number' };
      }
    }

    const sendBtn =
      document.querySelector('footer._ak1i button[data-testid="compose-btn-send"]') ||
      document.querySelector('footer._ak1i button[aria-label="Send"]') ||
      document.querySelector('footer._ak1i span[data-icon="send"]') ||
      findEl(SEL.sendButton);
    if (sendBtn) {
      await sleep(400);
      sendBtn.click();
      await sleep(800);
      return { success: true };
    }
    await sleep(300);
  }
  return { success: false, error: 'Timed out — send button not found' };
}

// ─── Read Last Message ────────────────────────────────────────────────────────
async function readLastMessage() {
  await sleep(1000);

  const containers = Array.from(document.querySelectorAll(SEL.msgContainer.join(', ')));
  if (!containers.length) return { text: null, isIncoming: false };

  const last = containers[containers.length - 1];

  // Outgoing messages have delivery indicators (check marks / clock)
  const isOutgoing = SEL.outgoingIndicator.some(s => last.querySelector(s));

  // Get text
  let text = '';
  for (const s of SEL.msgText) {
    const el = last.querySelector(s);
    if (el?.innerText?.trim()) { text = el.innerText.trim(); break; }
  }

  return { text, isIncoming: !isOutgoing };
}

// ─── Get Unread Sidebar Contacts ──────────────────────────────────────────────
async function getUnreadContacts() {
  const unreadBadges = document.querySelectorAll('[data-testid="icon-unread-count"], [aria-label*="unread"]');
  const names = [];
  unreadBadges.forEach(badge => {
    const row = badge.closest('[data-testid="cell-frame-container"]');
    const nameEl = row?.querySelector('[data-testid="cell-frame-title"]');
    if (nameEl) names.push(nameEl.textContent.trim());
  });
  return { names };
}

// ─── Navigate to a phone number using WA sidebar search (no page reload) ──────
async function openChatByPhone(phone) {
  if (findEl(SEL.qrCode)) return { success: false, error: 'WA Web not logged in — scan QR first' };

  // Dismiss any open dialog / chat
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  await sleep(400);

  // Click "New chat" icon to open the search pane
  const newChatBtn = findEl(SEL.newChatBtn);
  if (newChatBtn) { newChatBtn.click(); await sleep(700); }

  // Find the search input
  const searchInput = await waitForEl(SEL.searchInput, 6000);
  if (!searchInput) return { success: false, error: 'Search input not found' };

  // Clear and type the phone number
  searchInput.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(200);
  document.execCommand('insertText', false, phone);
  await sleep(2200); // wait for search results

  // Click the first result (contact or "Message +XXXX")
  const firstResult = document.querySelector('[data-testid="cell-frame-container"]');
  if (!firstResult) return { success: false, error: 'No search result for ' + phone };
  firstResult.click();
  await sleep(1500);
  return { success: true };
}

// ─── Send Image (with file URL) ───────────────────────────────────────────────
async function sendWithCaption(caption) {
  // Caption is already in the input via the ?text= URL parameter
  // Just click send on the media preview
  const sendBtn = await waitForEl(SEL.sendButton, 8000);
  if (!sendBtn) return { success: false, error: 'Media send button not found' };
  sendBtn.click();
  await sleep(800);
  return { success: true };
}

// ─── Insert text with proper line-break handling for WA Lexical editor ─────────
async function insertMessageText(el, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      document.execCommand('insertText', false, lines[i]);
      await sleep(30);
    }
    if (i < lines.length - 1) {
      // Shift+Enter = line break in WA (plain Enter sends the message)
      el.dispatchEvent(new KeyboardEvent('keydown',  { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
      el.dispatchEvent(new KeyboardEvent('keyup',    { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
      await sleep(30);
    }
  }
}

// ─── Send Image from base64 data with caption ─────────────────────────────────
async function sendImageWithCaption(imageData, imageMime, imageName, caption) {
  if (findEl(SEL.qrCode)) return { success: false, error: 'WA Web not logged in — scan QR first' };

  // Wait for chat to be ready
  const header = await waitForEl(['#main header', '#main [data-testid="conversation-header"]'], 12000);
  if (!header) return { success: false, error: 'Chat did not open' };
  await sleep(600);

  // Convert base64 to File object
  const base64 = imageData.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: imageMime || 'image/jpeg' });
  const file = new File([blob], imageName || 'image.jpg', { type: imageMime || 'image/jpeg' });

  // Approach 1: drag-and-drop onto the chat area (most reliable — triggers WA's native handler)
  const chatArea = document.querySelector('#main');
  if (chatArea) {
    const dt = new DataTransfer();
    dt.items.add(file);
    chatArea.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await sleep(100);
    chatArea.dispatchEvent(new DragEvent('dragover',  { bubbles: true, cancelable: true, dataTransfer: dt }));
    await sleep(100);
    chatArea.dispatchEvent(new DragEvent('drop',      { bubbles: true, cancelable: true, dataTransfer: dt }));
    await sleep(2500);
  }

  // Fallback: file input injection (if drag-drop didn't open the preview)
  if (!findEl(SEL.captionInput)) {
    const fileInput = document.querySelector(SEL.imageInput);
    if (!fileInput) return { success: false, error: 'Image input not found' };
    const dt2 = new DataTransfer();
    dt2.items.add(file);
    fileInput.files = dt2.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(2500);
  }

  // Type caption in media preview caption box
  if (caption) {
    const captionEl = await waitForEl(SEL.captionInput, 6000);
    if (captionEl) {
      captionEl.focus();
      await sleep(300);
      await insertMessageText(captionEl, caption);
      await sleep(400);
    }
  }

  // Click send in media preview
  const sendBtn = await waitForEl(SEL.sendButton, 8000);
  if (!sendBtn) return { success: false, error: 'Media send button not found' };
  sendBtn.click();
  await sleep(1000);
  return { success: true };
}

// ─── WA Web Privacy Mode (JS-based for dynamic React DOM) ────────────────────
let privacyStyleEl    = null;
let privacyObserver   = null;
let privacyDebounce   = null;
const PVT = 'data-wa-prv'; // marker attribute so we don't double-process

// Multiple selector fallbacks — WA Web changes testids between versions
const PRIVACY_TARGETS = [
  // ── Each individual chat row (try multiple selectors) ──
  '[data-testid="cell-frame-container"]',
  '#pane-side [role="listitem"]',
  '#pane-side [tabindex="-1"]',
  // ── Each message bubble ──
  '[data-testid="msg-container"]',
  '.message-in',
  '.message-out',
  // ── Chat header ──
  '#main header',
  // ── Profile pictures ──
  'img[src*="blob:"]',
  // ── Status thumbnails ──
  '[data-testid="status-v3-thumbnail"]',
];

// Badge-only CSS — no blur here, all blur is applied via JS
const PRIVACY_BADGE_CSS = `
  #wa-prv-badge {
    position: fixed;
    bottom: 14px;
    right: 14px;
    background: rgba(13,17,23,0.92);
    color: #f85149;
    border: 1px solid #f85149;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 700;
    z-index: 99999;
    pointer-events: none;
    letter-spacing: 0.4px;
    box-shadow: 0 2px 12px rgba(248,81,73,0.25);
  }
`;

function blurEl(el) {
  if (el.hasAttribute(PVT)) return;  // already handled
  if (el.offsetWidth < 10) return;   // skip invisible / tiny elements
  el.setAttribute(PVT, '1');
  el.style.filter     = 'blur(7px)';
  el.style.transition = 'filter 0.15s ease';
  const show = () => { el.style.filter = 'none'; };
  const hide = () => { el.style.filter = 'blur(7px)'; };
  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  el._prvShow = show;
  el._prvHide = hide;
}

function unblurAll() {
  document.querySelectorAll(`[${PVT}]`).forEach(el => {
    el.removeAttribute(PVT);
    el.style.filter     = '';
    el.style.transition = '';
    if (el._prvShow) { el.removeEventListener('mouseenter', el._prvShow); delete el._prvShow; }
    if (el._prvHide) { el.removeEventListener('mouseleave', el._prvHide); delete el._prvHide; }
  });
}

function scanAndBlur() {
  PRIVACY_TARGETS.forEach(sel => {
    document.querySelectorAll(sel).forEach(blurEl);
  });
}

function setWAPrivacy(on) {
  if (on) {
    if (privacyStyleEl) return; // already on

    // Inject badge CSS + badge element
    privacyStyleEl = document.createElement('style');
    privacyStyleEl.id = 'wa-bulk-ai-privacy';
    privacyStyleEl.textContent = PRIVACY_BADGE_CSS;
    document.head.appendChild(privacyStyleEl);

    const badge = document.createElement('div');
    badge.id = 'wa-prv-badge';
    badge.textContent = '🔒  ON';
    document.body.appendChild(badge);

    // Blur elements already in the DOM
    scanAndBlur();

    // Watch for new elements (virtual list, React re-renders, chat switches)
    privacyObserver = new MutationObserver(() => {
      clearTimeout(privacyDebounce);
      privacyDebounce = setTimeout(scanAndBlur, 150);
    });
    privacyObserver.observe(document.body, { childList: true, subtree: true });

  } else {
    if (privacyStyleEl) { privacyStyleEl.remove(); privacyStyleEl = null; }
    if (privacyObserver) { privacyObserver.disconnect(); privacyObserver = null; }
    clearTimeout(privacyDebounce);
    const badge = document.getElementById('wa-prv-badge');
    if (badge) badge.remove();
    unblurAll();
  }
}

// Restore privacy state if page was reloaded
chrome.storage.local.get('privacyOn', d => {
  if (d.privacyOn) setWAPrivacy(true);
});

// ─── Auto Reply Bot ───────────────────────────────────────────────────────────
let autoReplyObserver = null;
let autoReplyConfig   = null;
let arLastIncoming    = null;
let arReplying        = false;
let arCheckTimer      = null;

function getMessageText(el) {
  for (const s of SEL.msgText) {
    const t = el.querySelector(s);
    if (t?.innerText?.trim()) return t.innerText.trim();
  }
  return null;
}

async function startAutoReply(config) {
  stopAutoReply();
  autoReplyConfig = config;

  const chatMain = document.querySelector('#main');
  if (!chatMain) return { success: false, error: 'No chat open — open a WhatsApp conversation first' };

  // Snapshot last incoming message so we don't reply to old ones
  const existing = Array.from(document.querySelectorAll('.message-in'));
  arLastIncoming = existing.length ? getMessageText(existing[existing.length - 1]) : null;

  autoReplyObserver = new MutationObserver(() => {
    clearTimeout(arCheckTimer);
    arCheckTimer = setTimeout(checkAndReply, 800);
  });
  autoReplyObserver.observe(chatMain, { childList: true, subtree: true });
  return { success: true };
}

function stopAutoReply() {
  if (autoReplyObserver) { autoReplyObserver.disconnect(); autoReplyObserver = null; }
  clearTimeout(arCheckTimer);
  autoReplyConfig = null;
  arLastIncoming  = null;
  arReplying      = false;
}

async function checkAndReply() {
  if (!autoReplyConfig || arReplying) return;

  const incoming = Array.from(document.querySelectorAll('.message-in'));
  if (!incoming.length) return;

  const last = incoming[incoming.length - 1];
  const text = getMessageText(last);
  if (!text || text === arLastIncoming) return;

  // Keyword filter
  if (autoReplyConfig.keyword) {
    const keywords = autoReplyConfig.keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (!keywords.some(kw => text.toLowerCase().includes(kw))) {
      arLastIncoming = text;
      return;
    }
  }

  arLastIncoming = text;
  arReplying = true;

  await sleep(autoReplyConfig.delay * 1000);

  // ── Business hours check ─────────────────────────────────────
  const bh = autoReplyConfig.bizHours;
  if (bh?.enabled) {
    const now = new Date();
    const [sh, sm] = (bh.startTime || '09:00').split(':').map(Number);
    const [eh, em] = (bh.endTime   || '18:00').split(':').map(Number);
    const nowMins   = now.getHours() * 60 + now.getMinutes();
    const inHours   = (bh.days || [1,2,3,4,5]).includes(now.getDay()) &&
                      nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
    if (!inHours) {
      const outsideMsg = bh.outsideMsg || "Thanks for reaching out! We're currently outside business hours and will reply soon.";
      const sent = await typeAndSend(outsideMsg);
      chrome.runtime.sendMessage({ type: 'AUTO_REPLY_LOG', data: { incoming: text, reply: outsideMsg, success: sent, ts: Date.now(), bizHours: true } });
      arReplying = false;
      return;
    }
  }

  let replyText;
  if (autoReplyConfig.mode === 'template') {
    replyText = autoReplyConfig.template || 'Thanks for your message!';
  } else {
    const r = await new Promise(res =>
      chrome.runtime.sendMessage({ type: 'GET_AI_AUTO_REPLY', data: { text, prompt: autoReplyConfig.prompt, apiKey: autoReplyConfig.apiKey } }, res)
    );
    replyText = r?.reply || autoReplyConfig.template || 'Thanks for your message!';
  }

  const sent = await typeAndSend(replyText);
  chrome.runtime.sendMessage({ type: 'AUTO_REPLY_LOG', data: { incoming: text, reply: replyText, success: sent, ts: Date.now() } });
  arReplying = false;
}

async function typeAndSend(text) {
  // Scope strictly to the chat compose area — NOT the search bar
  const input =
    document.querySelector('#main footer [data-lexical-editor="true"]') ||
    document.querySelector('#main footer div[contenteditable="true"]') ||
    document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
    document.querySelector('div[contenteditable="true"][data-tab="10"]');

  if (!input) return false;

  input.focus();
  await sleep(300);

  // Method 1: DataTransfer paste — works with WhatsApp Web's Lexical editor
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    input.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    }));
  } catch (e) {}

  await sleep(500);

  // Method 2: execCommand fallback if paste didn't insert anything
  if (!input.innerText?.trim()) {
    document.execCommand('insertText', false, text);
    await sleep(500);
  }

  const result = await clickSend();
  return result.success;
}

// ─── Insert Text (no send) ────────────────────────────────────────────────────
async function insertText(text) {
  const input =
    document.querySelector('#main footer [data-lexical-editor="true"]') ||
    document.querySelector('#main footer div[contenteditable="true"]') ||
    document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
    document.querySelector('div[contenteditable="true"][data-tab="10"]');
  if (!input) return false;
  input.focus();
  await sleep(100);
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch (e) {
    document.execCommand('insertText', false, text);
  }
  return true;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Quick Reply Templates ─────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  { id: 'dft-1', name: 'Hi 👋',    text: 'Hi! How are you? 😊' },
  { id: 'dft-2', name: 'Thanks',   text: 'Thank you! 🙏' },
  { id: 'dft-3', name: 'On way',   text: "I'm on my way!" },
  { id: 'dft-4', name: 'Later',    text: "I'll get back to you shortly." },
  { id: 'dft-5', name: 'Noted ✅', text: 'Noted! I will take care of it.' },
];

function getTemplates() {
  return new Promise(resolve =>
    chrome.storage.local.get('quickReplyTemplates', d => {
      const saved = d.quickReplyTemplates;
      resolve(saved && saved.length ? saved : DEFAULT_TEMPLATES);
    })
  );
}
function saveTemplates(templates) {
  return new Promise(resolve => chrome.storage.local.set({ quickReplyTemplates: templates }, resolve));
}

// ─── Quick Reply Strip (chip bar above compose area) ───────────────────────────
const STRIP_ID  = 'wa-qr-strip';
let   stripData = [];      // in-memory cache of templates
let   stripVisible = true;  // strip is open by default

function renderStripChips() {
  const row = document.querySelector('#wa-qr-strip .wqrs-row');
  if (!row) return;
  // Only update HTML — clicks are handled by the delegated listener on the row
  if (!stripData.length) {
    row.innerHTML = `
      <span style="color:#4a5a65;font-size:12px;padding:0 4px">No quick replies yet —</span>
      <button class="wqrs-add-chip" id="wqrs-add-btn">＋ Add first one</button>`;
  } else {
    row.innerHTML = stripData.map(t => `
      <div class="wqrs-chip" data-id="${t.id}" title="${escapeHtml(t.text)}">
        <div>
          <div class="wqrs-chip-name">${escapeHtml(t.name)}</div>
          <div class="wqrs-chip-preview">${escapeHtml(t.text.substring(0, 35))}${t.text.length > 35 ? '…' : ''}</div>
        </div>
        <button class="wqrs-chip-del" data-id="${t.id}" title="Remove">×</button>
      </div>`).join('') +
      `<button class="wqrs-add-chip" id="wqrs-add-btn">＋ New</button>`;
  }
}

function openAddForm() {
  const form = document.getElementById('wqrs-inline-form');
  if (!form) return;
  form.classList.add('wqrs-form-open');
  document.getElementById('wqrs-fname')?.focus();
}

function closeAddForm() {
  const form = document.getElementById('wqrs-inline-form');
  if (!form) return;
  form.classList.remove('wqrs-form-open');
  const n = document.getElementById('wqrs-fname');
  const t = document.getElementById('wqrs-ftext');
  if (n) n.value = '';
  if (t) t.value = '';
}

function injectQuickReplyStrip() {
  // Re-inject if disconnected (navigated to new chat)
  const existing = document.getElementById(STRIP_ID);
  if (existing && document.body.contains(existing)) return;
  if (existing) existing.remove();

  const footer = document.querySelector('#main footer');
  if (!footer) return;

  const strip = document.createElement('div');
  strip.id = STRIP_ID;
  strip.innerHTML = `
    <div class="wqrs-row"></div>
    <div class="wqrs-inline-form" id="wqrs-inline-form">
      <div class="wqrs-form-title">⚡ New Quick Reply</div>
      <input id="wqrs-fname" placeholder="Name  (e.g. Greeting)" autocomplete="off">
      <textarea id="wqrs-ftext" rows="3" placeholder="Message text…"></textarea>
      <div class="wqrs-form-btns">
        <button class="wqrs-form-save" id="wqrs-fsave">Save</button>
        <button class="wqrs-form-cancel" id="wqrs-fcancel">Cancel</button>
      </div>
    </div>`;
  footer.parentNode.insertBefore(strip, footer);

  // ── Delegated click handler on the chip row (survives innerHTML replacements) ──
  strip.querySelector('.wqrs-row').addEventListener('click', async e => {
    e.stopPropagation();
    // Delete button
    const del = e.target.closest('.wqrs-chip-del');
    if (del) {
      stripData = stripData.filter(x => x.id !== del.dataset.id);
      await saveTemplates(stripData);
      renderStripChips();
      return;
    }
    // ＋ New / ＋ Add first one
    if (e.target.closest('.wqrs-add-chip')) {
      openAddForm();
      return;
    }
    // Template chip
    const chip = e.target.closest('.wqrs-chip');
    if (chip) {
      const t = stripData.find(x => x.id === chip.dataset.id);
      if (t) await insertText(t.text);
    }
  }, true); // capture phase so WA can't block us

  // ── Inline form buttons ──
  strip.querySelector('#wqrs-fsave').addEventListener('click', async e => {
    e.stopPropagation();
    const name = strip.querySelector('#wqrs-fname').value.trim();
    const text = strip.querySelector('#wqrs-ftext').value.trim();
    if (!name || !text) return;
    stripData.push({ id: Date.now().toString(), name, text });
    await saveTemplates(stripData);
    renderStripChips();
    closeAddForm();
  }, true);
  strip.querySelector('#wqrs-fcancel').addEventListener('click', e => {
    e.stopPropagation();
    closeAddForm();
  }, true);

  if (stripVisible) {
    strip.classList.add('wqrs-open');
    getTemplates().then(t => { stripData = t; renderStripChips(); });
  }
  // Keep ⚡ button in sync
  document.getElementById('wa-qr-btn')?.classList.toggle('active', stripVisible);
}

async function toggleQuickReplyStrip() {
  let strip = document.getElementById(STRIP_ID);
  if (!strip) { injectQuickReplyStrip(); strip = document.getElementById(STRIP_ID); }
  if (!strip) return;

  stripVisible = !strip.classList.contains('wqrs-open');

  if (stripVisible) {
    stripData = await getTemplates();
    renderStripChips();
    strip.classList.add('wqrs-open');
  } else {
    strip.classList.remove('wqrs-open');
    closeAddForm();
  }

  // Toggle active highlight on ⚡ button
  document.getElementById('wa-qr-btn')?.classList.toggle('active', stripVisible);
}

// ─── Audio Interceptor (runs in page main-world via injected script) ─────────
const capturedAudio = new Map(); // blobUrl → { base64, mimeType }

function injectAudioInterceptor() {
  if (document.getElementById('wa-audio-interceptor')) return;
  const script = document.createElement('script');
  script.id = 'wa-audio-interceptor';
  script.textContent = `(function(){
    if (window.__waAudioIntercept) return;
    window.__waAudioIntercept = true;
    const _orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(obj) {
      const url = _orig(obj);
      if (obj instanceof Blob && obj.type && obj.type.includes('audio')) {
        const r = new FileReader();
        r.onload = function() {
          window.postMessage({ __waAudioCapture: true, url, b64: r.result.split(',')[1], mime: obj.type }, '*');
        };
        r.readAsDataURL(obj);
      }
      return url;
    };
  })();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  window.addEventListener('message', e => {
    if (e.data?.__waAudioCapture) {
      capturedAudio.set(e.data.url, { base64: e.data.b64, mimeType: e.data.mime });
    }
  });
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ─── Voice Note Transcription ─────────────────────────────────────────────────
const VOICE_ICON_SELS = [
  '[data-icon="audio-play"]', '[data-icon="ptt-play"]',
  '[data-testid="audio-play-btn"]', '[data-testid="audio-player"]',
  '[data-icon="audio-stop"]', '[data-icon="ptt-stop"]'
];
const MSG_CONTAINER_SELS = '[data-testid="msg-container"], .message-in, .message-out';

function injectTranscribeButtons() {
  const found = new Set();

  // Detect by any audio element in a message
  document.querySelectorAll('audio').forEach(el => {
    const c = el.closest(MSG_CONTAINER_SELS);
    if (c) found.add(c);
  });

  // Detect by WhatsApp's audio play icons
  VOICE_ICON_SELS.forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const c = el.closest(MSG_CONTAINER_SELS);
        if (c) found.add(c);
      });
    } catch (e) {}
  });

  found.forEach(container => {
    if (container.dataset.waVoiceScanned) return;
    container.dataset.waVoiceScanned = '1';
    if (container.querySelector('.wa-transcribe-btn')) return;
    const SVG_MIC = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="0.5" width="5" height="7" rx="2.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 6a4.5 4.5 0 009 0" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M6 10.5v1M4.5 11.5h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;
    const btn = document.createElement('button');
    btn.className   = 'wa-transcribe-btn';
    btn.innerHTML   = SVG_MIC;
    btn.dataset.tip = 'Transcribe voice note';
    btn.addEventListener('click', () => transcribeVoiceNote(container, btn));
    container.appendChild(btn);
  });
}

function getPlayBtn(msgContainer) {
  for (const sel of VOICE_ICON_SELS) {
    const el = msgContainer.querySelector(sel);
    if (el) return el.closest('button') || el;
  }
  return null;
}

async function transcribeVoiceNote(msgContainer, btn) {
  btn.disabled = true;
  msgContainer.querySelector('.wa-transcription-result')?.remove();

  const stored  = await new Promise(r => chrome.storage.local.get('settings', r));
  const groqKey = stored.settings?.groqApiKey;

  // Try Groq only if key is set AND we already have a blob URL (interceptor captured it)
  let result = null;
  if (groqKey) {
    const audio = msgContainer.querySelector('audio');
    const url   = audio?.src?.startsWith('blob:')        ? audio.src
                : audio?.currentSrc?.startsWith('blob:') ? audio.currentSrc
                : capturedAudio.size ? [...capturedAudio.keys()].pop() : null;
    if (url) {
      btn.innerHTML = SVG_SPIN;
      try {
        const data = capturedAudio.get(url) || await fetch(url).then(async r => {
          const b = await r.blob();
          return { base64: await blobToBase64(b), mimeType: b.type || 'audio/ogg' };
        });
        result = await new Promise(resolve =>
          chrome.runtime.sendMessage({ type: 'TRANSCRIBE_VOICE_NOTE', data }, resolve)
        );
      } catch (e) {}
    }
  }

  // Default / fallback: free Web Speech API (no key needed)
  if (!result?.success) {
    result = await transcribeWithWebSpeech(msgContainer, btn);
  }

  const bubble = document.createElement('div');
  bubble.className = 'wa-transcription-result';
  const SVG_MIC2 = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="0.5" width="5" height="7" rx="2.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 6a4.5 4.5 0 009 0" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M6 10.5v1M4.5 11.5h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;
  if (result?.success) {
    btn.innerHTML   = SVG_CHECK;
    btn.dataset.tip = 'Transcribed';
    bubble.textContent = result.text;
  } else {
    btn.innerHTML   = SVG_MIC2;
    btn.dataset.tip = 'Transcribe voice note';
    btn.disabled       = false;
    bubble.style.color = '#f85149';
    bubble.textContent = result?.error || 'Transcription failed.';
    setTimeout(() => bubble.remove(), 6000);
  }
  btn.insertAdjacentElement('afterend', bubble);
}

// ── Free method: Web Speech API — plays audio, mic picks it up ────────────────
async function transcribeWithWebSpeech(msgContainer, btn) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    return { success: false, error: 'Speech recognition not available in this browser.' };
  }

  const SVG_WAVE = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5h1.5M3 2.5v6M5 4v3M7 1.5v8M9 3.5v4M10 5.5h.5" stroke="#00a884" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  btn.innerHTML = SVG_WAVE;

  return new Promise(resolve => {
    const recognition = new Recognition();
    recognition.continuous     = true;
    recognition.interimResults = false;
    let transcript = '', done = false;

    const finish = () => {
      if (done) return; done = true;
      try { recognition.stop(); } catch (e) {}
      resolve({
        success: true,
        text: transcript.trim() || '(nothing heard — make sure your speakers are on and not muted)'
      });
    };

    recognition.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ';
      }
    };
    recognition.onerror = e => {
      done = true;
      if (e.error === 'not-allowed') resolve({ success: false, error: 'Mic access denied — allow microphone in Chrome and retry.' });
      else resolve({ success: false, error: 'Recognition error: ' + e.error });
    };
    recognition.onend = finish;
    recognition.start();

    // Play the voice note ~300 ms after recognition starts
    setTimeout(() => {
      const audio   = msgContainer.querySelector('audio');
      const playBtn = getPlayBtn(msgContainer);

      if (audio) {
        audio.currentTime = 0;
        audio.volume      = 1;
        audio.play().catch(() => { if (playBtn) playBtn.click(); });
        audio.onended = () => setTimeout(finish, 500);
      } else if (playBtn) {
        playBtn.click();
        setTimeout(() => {
          const a = msgContainer.querySelector('audio');
          if (a) a.onended = () => setTimeout(finish, 500);
        }, 300);
      } else {
        resolve({ success: false, error: 'Could not find audio player in this message.' });
      }
      setTimeout(finish, 180000); // 3-min safety cap
    }, 300);
  });
}

// ─── Meeting Scheduler ────────────────────────────────────────────────────────
const MEETING_BTN_ID   = 'wa-meeting-btn';
const MEETING_MODAL_ID = 'wa-meeting-modal';
let meetingBtnObserver = null;

function injectMeetingStyles() {
  const existing = document.getElementById('wa-meeting-styles');
  if (existing && existing.dataset.v === '2') return;
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'wa-meeting-styles';
  style.dataset.v = '2';
  style.textContent = `
    #wa-meeting-bar {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 0 6px !important;
      margin-right: 2px !important;
      background: transparent !important;
      border: none !important;
      height: auto !important;
      box-sizing: border-box !important;
      z-index: 9999 !important;
      pointer-events: auto !important;
      flex-shrink: 0 !important;
    }
    /* ── Unified icon button style ── */
    .wa-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #8696a0;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s, transform 0.1s;
      position: relative;
    }
    .wa-icon-btn:hover {
      background: #2a3942;
      color: #e9edef;
      transform: scale(1.1);
    }
    .wa-icon-btn:active { transform: scale(0.95); }
    .wa-icon-btn-primary {
      background: transparent;
      color: #00a884;
    }
    .wa-icon-btn-primary:hover {
      background: #005c4b !important;
      color: #00a884 !important;
    }
    /* Tooltip */
    .wa-icon-btn::after {
      content: attr(data-tip);
      position: absolute;
      top: calc(100% + 7px);
      left: 50%;
      transform: translateX(-50%);
      background: #111b21;
      color: #e9edef;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      padding: 4px 9px;
      border-radius: 6px;
      border: 1px solid #2a3942;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .wa-icon-btn:hover::after { opacity: 1; }
    /* Divider between bar button groups */
    .wa-bar-divider {
      width: 1px;
      height: 18px;
      background: #3b4a54;
      flex-shrink: 0;
      opacity: 0.5;
    }

    #wa-meeting-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #wa-meeting-modal .wm-box {
      background: #202c33;
      border-radius: 14px;
      padding: 24px 26px 20px;
      width: 350px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #wa-meeting-modal .wm-title {
      color: #e9edef;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #wa-meeting-modal .wm-label {
      color: #8696a0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 5px;
    }
    #wa-meeting-modal .wm-input {
      width: 100%;
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      color: #e9edef;
      padding: 9px 12px;
      font-size: 13px;
      margin-bottom: 13px;
      box-sizing: border-box;
      font-family: inherit;
      outline: none;
    }
    #wa-meeting-modal .wm-input:focus { border-color: #00a884; }
    #wa-meeting-modal .wm-input::placeholder { color: #4a5a65; }
    #wa-meeting-modal .wm-row { display: flex; gap: 10px; }
    #wa-meeting-modal .wm-row > div { flex: 1; }
    #wa-meeting-modal .wm-btns { display: flex; gap: 10px; margin-top: 6px; }
    #wa-meeting-modal .wm-btn-send {
      flex: 1;
      background: #00a884;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    #wa-meeting-modal .wm-btn-send:hover:not(:disabled) { background: #02c09a; }
    #wa-meeting-modal .wm-btn-send:disabled { opacity: 0.6; cursor: default; }
    #wa-meeting-modal .wm-btn-cancel {
      flex: 1;
      background: transparent;
      color: #8696a0;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      padding: 11px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    #wa-meeting-modal .wm-btn-cancel:hover { background: #2a3942; }
    #wa-meeting-modal .wm-status {
      font-size: 12px;
      margin-top: 9px;
      text-align: center;
      min-height: 16px;
    }
    #wa-meeting-modal select.wm-input option { background: #2a3942; }
    #wa-meeting-modal .wm-link-row { display: flex; gap: 8px; align-items: flex-start; }
    #wa-meeting-modal .wm-link-row .wm-input { flex: 1; margin-bottom: 13px; }
    #wa-meeting-modal .wm-regen {
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      color: #00a884;
      font-size: 18px;
      cursor: pointer;
      padding: 7px 10px;
      margin-bottom: 13px;
      line-height: 1;
      flex-shrink: 0;
    }
    #wa-meeting-modal .wm-regen:hover { background: #3b4a54; }
    #wa-meeting-modal .wm-auto-badge {
      display: inline-block;
      background: #005c4b;
      color: #00a884;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      margin-left: 6px;
      vertical-align: middle;
    }
    /* #wa-qr-btn, #wa-card-btn, #wa-export-btn use .wa-icon-btn */
    /* ── Quick Reply Panel ── */
    #wa-qr-panel {
      position: fixed;
      background: #202c33;
      border: 1px solid #3b4a54;
      border-radius: 12px;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
      z-index: 99998;
      width: 340px;
      max-height: 460px;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    .wqr-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 14px; color: #e9edef; font-size: 13px; font-weight: 700;
      border-bottom: 1px solid #2a3942; flex-shrink: 0;
    }
    .wqr-close {
      background: none; border: none; color: #8696a0; cursor: pointer;
      font-size: 15px; padding: 2px 6px; border-radius: 4px; line-height: 1;
    }
    .wqr-close:hover { background: #2a3942; color: #e9edef; }
    .wqr-search-wrap { padding: 8px 10px 4px; flex-shrink: 0; }
    .wqr-search {
      width: 100%; background: #2a3942; border: 1px solid #3b4a54;
      border-radius: 8px; color: #e9edef; padding: 7px 12px; font-size: 12px;
      box-sizing: border-box; outline: none; font-family: inherit;
    }
    .wqr-search::placeholder { color: #4a5a65; }
    .wqr-search:focus { border-color: #00a884; }
    .wqr-list { flex: 1; overflow-y: auto; padding: 4px 8px; }
    .wqr-empty { color: #8696a0; text-align: center; padding: 16px; font-size: 12px; }
    .wqr-item { padding: 8px 10px; border-radius: 8px; margin-bottom: 3px; border: 1px solid transparent; }
    .wqr-item:hover { background: #2a3942; border-color: #3b4a54; }
    .wqr-item-name { color: #e9edef; font-size: 12px; font-weight: 700; margin-bottom: 2px; }
    .wqr-item-text { color: #8696a0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wqr-item-actions { display: flex; gap: 6px; margin-top: 5px; }
    .wqr-insert {
      background: #005c4b; color: #00a884; border: none; border-radius: 6px;
      padding: 3px 10px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .wqr-insert:hover { background: #00a884; color: #fff; }
    .wqr-delete {
      background: none; border: none; color: #4a5a65;
      cursor: pointer; font-size: 12px; padding: 3px 7px; border-radius: 4px;
    }
    .wqr-delete:hover { background: #3b4a54; color: #f85149; }
    .wqr-add { padding: 10px 10px 12px; border-top: 1px solid #2a3942; flex-shrink: 0; }
    .wqr-add-title { color: #00a884; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 7px; }
    .wqr-finput {
      width: 100%; background: #2a3942; border: 1px solid #3b4a54; border-radius: 8px;
      color: #e9edef; padding: 7px 10px; font-size: 12px; margin-bottom: 6px;
      box-sizing: border-box; font-family: inherit; outline: none;
    }
    .wqr-finput:focus { border-color: #00a884; }
    .wqr-finput::placeholder { color: #4a5a65; }
    .wqr-ftextarea { resize: none; }
    .wqr-save-btn {
      width: 100%; background: #00a884; color: #fff; border: none;
      border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700;
      cursor: pointer; font-family: inherit;
    }
    .wqr-save-btn:hover { background: #02c09a; }

    /* ── Quick Reply Strip (above compose bar) ── */
    #wa-qr-strip {
      display: none;
      flex-direction: column;
      background: #111b21;
      border-top: 1px solid #2a3942;
      flex-shrink: 0;
      position: relative;
      z-index: 100;
      pointer-events: auto;
    }
    #wa-qr-strip.wqrs-open { display: flex; }
    #wa-qr-strip * { pointer-events: auto; }
    .wqrs-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: #2a3942 transparent;
      flex-wrap: nowrap;
    }
    .wqrs-row::-webkit-scrollbar { height: 3px; }
    .wqrs-row::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 2px; }
    .wqrs-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 16px;
      padding: 4px 6px 4px 12px;
      color: #e9edef;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      max-width: 200px;
      transition: border-color 0.15s;
      user-select: none;
    }
    .wqrs-chip:hover { border-color: #00a884; }
    .wqrs-chip-name { overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
    .wqrs-chip-preview { color: #8696a0; font-size: 10px; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
    .wqrs-chip-del {
      background: none; border: none; color: #4a5a65;
      cursor: pointer; font-size: 14px; padding: 0 4px 0 2px;
      line-height: 1; display: flex; align-items: center; flex-shrink: 0;
    }
    .wqrs-chip-del:hover { color: #f85149; }
    .wqrs-add-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: 1px dashed #3b4a54;
      border-radius: 16px;
      padding: 4px 12px;
      color: #00a884;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s;
    }
    .wqrs-add-chip:hover { border-color: #00a884; background: #1a2c27; }
    /* Inline add-template form (slides open inside the strip) */
    .wqrs-inline-form {
      display: none;
      flex-direction: column;
      gap: 7px;
      padding: 10px 12px 12px;
      border-top: 1px solid #2a3942;
      background: #1a2228;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .wqrs-inline-form.wqrs-form-open { display: flex; }
    .wqrs-form-title { color: #e9edef; font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .wqrs-inline-form input, .wqrs-inline-form textarea {
      background: #2a3942; border: 1px solid #3b4a54; border-radius: 8px;
      color: #e9edef; padding: 7px 10px; font-size: 12px; outline: none;
      font-family: inherit; box-sizing: border-box; width: 100%; resize: none;
    }
    .wqrs-inline-form input:focus, .wqrs-inline-form textarea:focus { border-color: #00a884; }
    .wqrs-inline-form input::placeholder, .wqrs-inline-form textarea::placeholder { color: #4a5a65; }
    .wqrs-form-btns { display: flex; gap: 6px; margin-top: 2px; }
    .wqrs-form-save {
      flex: 1; background: #00a884; color: #fff; border: none; border-radius: 8px;
      padding: 8px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .wqrs-form-save:hover { background: #02c09a; }
    .wqrs-form-cancel {
      background: #2a3942; color: #8696a0; border: 1px solid #3b4a54;
      border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; font-family: inherit;
    }
    .wqrs-form-cancel:hover { background: #3b4a54; color: #e9edef; }
    /* active state for ⚡ button */
    #wa-qr-btn.active { background: #005c4b !important; color: #00a884 !important; }

    /* ── Voice Note Transcription ── */
    .wa-transcribe-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; margin-top: 5px; margin-left: 2px;
      background: #2a3942; border: 1px solid #3b4a54; border-radius: 50%;
      color: #8696a0; cursor: pointer; transition: background 0.15s, color 0.15s;
      flex-shrink: 0; position: relative;
    }
    .wa-transcribe-btn:hover:not(:disabled) { background: #3b4a54; color: #e9edef; }
    .wa-transcribe-btn:disabled { opacity: 0.6; cursor: default; }
    .wa-transcribe-btn::after {
      content: attr(data-tip);
      position: absolute; bottom: calc(100% + 5px); left: 50%;
      transform: translateX(-50%); background: #111b21; color: #e9edef;
      font-size: 10px; white-space: nowrap; padding: 3px 7px; border-radius: 5px;
      border: 1px solid #2a3942; pointer-events: none; opacity: 0; transition: opacity 0.15s;
      z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .wa-transcribe-btn:hover::after { opacity: 1; }
    .wa-transcription-result {
      margin-top: 5px; background: #1f2c34; border-left: 3px solid #00a884;
      border-radius: 0 8px 8px 0; padding: 6px 10px; color: #e9edef;
      font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.5; max-width: 280px; word-wrap: break-word;
    }
    /* ── Message Translation ── */
    .wa-translate-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; margin-top: 4px; margin-left: 2px;
      background: #2a3942; border: 1px solid #3b4a54; border-radius: 50%;
      color: #8696a0; cursor: pointer; transition: background 0.15s, color 0.15s;
      flex-shrink: 0; position: relative;
    }
    .wa-translate-btn:hover:not(:disabled) { background: #3b4a54; color: #e9edef; }
    .wa-translate-btn:disabled { opacity: 0.6; cursor: default; }
    .wa-translate-btn::after {
      content: attr(data-tip);
      position: absolute; bottom: calc(100% + 5px); left: 50%;
      transform: translateX(-50%); background: #111b21; color: #e9edef;
      font-size: 10px; white-space: nowrap; padding: 3px 7px; border-radius: 5px;
      border: 1px solid #2a3942; pointer-events: none; opacity: 0; transition: opacity 0.15s;
      z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .wa-translate-btn:hover::after { opacity: 1; }
    .wa-translation-result {
      margin-top: 4px; background: #1f2c34; border-left: 3px solid #025c6b;
      border-radius: 0 8px 8px 0; padding: 5px 10px; color: #aebac1;
      font-size: 12px; font-style: italic; line-height: 1.4;
      max-width: 280px; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    /* ── Label Filter Bar ── */
    #wa-label-bar {
      position: fixed !important; display: flex !important; align-items: center !important;
      gap: 6px !important; padding: 5px 10px !important; background: #111b21 !important;
      border-bottom: 1px solid #2a3942 !important; z-index: 9997 !important;
      overflow-x: auto !important; box-sizing: border-box !important;
    }
    .wa-label-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 14px; font-size: 11px; font-weight: 600;
      cursor: pointer; white-space: nowrap; border: 1px solid transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: all 0.15s; color: #8696a0; background: #2a3942;
    }
    .wa-label-chip.active { background: #005c4b; color: #00a884; border-color: #00a884; }
    .wa-label-chip:hover:not(.active) { background: #3b4a54; color: #e9edef; }
    /* #wa-card-btn, #wa-export-btn use .wa-icon-btn */
    /* ── Contact Card Panel ── */
    #wa-card-panel {
      position: fixed; background: #202c33; border: 1px solid #3b4a54;
      border-radius: 12px; box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
      z-index: 99998; width: 280px; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .wcp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 14px; color: #e9edef; font-size: 13px; font-weight: 700;
      border-bottom: 1px solid #2a3942;
    }
    .wcp-close { background: none; border: none; color: #8696a0; cursor: pointer; font-size: 15px; padding: 2px 6px; border-radius: 4px; }
    .wcp-close:hover { background: #2a3942; color: #e9edef; }
    .wcp-body { padding: 10px 14px; }
    .wcp-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid #2a3942; }
    .wcp-row:last-child { border-bottom: none; }
    .wcp-key { color: #8696a0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0; margin-right: 8px; }
    .wcp-val { color: #e9edef; font-size: 12px; font-weight: 500; text-align: right; word-break: break-word; }
    .wcp-stage { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .wcp-stage-new { background: #2a3942; color: #8696a0; }
    .wcp-stage-contacted { background: #003740; color: #2196f3; }
    .wcp-stage-interested { background: #2d2000; color: #ffa000; }
    .wcp-stage-converted { background: #003320; color: #00a884; }
    .wcp-stage-lost { background: #2d0000; color: #f85149; }
    .wcp-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .wcp-tag { background: #2a3942; color: #8696a0; border-radius: 8px; padding: 2px 7px; font-size: 10px; font-weight: 600; }
    .wcp-empty { color: #8696a0; font-size: 12px; text-align: center; padding: 16px 0; }
    /* ── Hover Reply Button ── */
    #wa-hover-reply {
      position: fixed;
      width: 26px; height: 26px;
      border-radius: 50%;
      background: #233138;
      border: 1px solid #3b4a54;
      color: #aebac1;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      z-index: 99990;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.1s, background 0.1s, color 0.1s;
      box-shadow: 0 1px 6px rgba(0,0,0,0.45);
    }
    #wa-hover-reply.whr-visible {
      opacity: 1;
      pointer-events: auto;
    }
    #wa-hover-reply:hover {
      background: #00a884;
      color: #fff;
      border-color: #00a884;
    }
    #wa-hover-reply::after {
      content: 'Reply';
      position: absolute;
      bottom: calc(100% + 5px);
      left: 50%;
      transform: translateX(-50%);
      background: #111b21; color: #e9edef;
      font-size: 10px; font-weight: 600; white-space: nowrap;
      padding: 3px 7px; border-radius: 5px; border: 1px solid #2a3942;
      pointer-events: none; opacity: 0; transition: opacity 0.1s;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #wa-hover-reply.whr-visible:hover::after { opacity: 1; }

    /* ── Chat Pin Button (sits next to WA's chevron-down button) ── */
    .wa-pin-btn {
      width: 20px; height: 20px;
      background: none; border: none;
      cursor: pointer; padding: 0;
      color: #8696a0;
      font-size: 14px; line-height: 20px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      opacity: 1;
      pointer-events: all !important;
    }
    .wa-pin-btn.pinned { color: #d29922 !important; }
    .wa-pin-btn:hover  { color: #00a884 !important; }
  `;
  document.head.appendChild(style);
}

function getContactName() {
  const selectors = [
    '[data-testid="conversation-info-header-chat-title"]',
    '#main header span[dir="auto"]',
    '#main header span[title]',
    '[data-testid="conversation-header"] span[title]'
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    const text = el?.textContent?.trim() || el?.getAttribute('title')?.trim();
    if (text) return text;
  }
  return 'Contact';
}

function generateJitsiLink(title, contact) {
  const clean = s => s.replace(/[^a-zA-Z0-9]/g, '');
  const room  = clean(title).substring(0, 14) +
                clean(contact).substring(0, 10) +
                Math.random().toString(36).substring(2, 7).toUpperCase();
  return 'https://meet.jit.si/' + room;
}

function openMeetingModal() {
  if (document.getElementById(MEETING_MODAL_ID)) return;

  const contactName = getContactName();
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  const defaultTitle = 'Meeting with ' + contactName;
  const autoLink = generateJitsiLink(defaultTitle, contactName);

  const modal = document.createElement('div');
  modal.id = MEETING_MODAL_ID;
  modal.innerHTML = `
    <div class="wm-box">
      <div class="wm-title">📅 Schedule Meeting — ${contactName}</div>

      <div class="wm-label">Meeting Title</div>
      <input class="wm-input" id="wm-mtitle" placeholder="e.g. Business Discussion" value="${defaultTitle}">

      <div class="wm-row">
        <div>
          <div class="wm-label">Date</div>
          <input type="date" class="wm-input" id="wm-date" value="${dateStr}">
        </div>
        <div>
          <div class="wm-label">Time</div>
          <input type="time" class="wm-input" id="wm-time" value="${timeStr}">
        </div>
      </div>

      <div class="wm-label">Platform</div>
      <select class="wm-input" id="wm-platform">
        <option value="jitsi">Jitsi Meet (Auto-link, Free)</option>
        <option value="googlemeet">Google Meet (Auto-link)</option>
        <option value="zoom">Zoom (Paste link)</option>
        <option value="teams">Microsoft Teams (Paste link)</option>
        <option value="whatsapp">WhatsApp Call</option>
        <option value="phone">Phone Call</option>
        <option value="inperson">In Person</option>
      </select>

      <div id="wm-link-section">
        <div class="wm-label" id="wm-link-label">
          Meeting Link <span class="wm-auto-badge">AUTO-GENERATED</span>
        </div>
        <div class="wm-link-row">
          <input class="wm-input" id="wm-link" value="${autoLink}" readonly style="color:#00a884;font-size:11px">
          <button class="wm-regen" id="wm-regen" title="Generate new link">🔄</button>
        </div>
      </div>

      <div class="wm-label">Notes <span style="text-transform:none;font-weight:400;color:#4a5a65">(optional)</span></div>
      <input class="wm-input" id="wm-notes" placeholder="Agenda, topics to discuss...">

      <div class="wm-label">Reminder Alert</div>
      <select class="wm-input" id="wm-alert">
        <option value="0">No reminder</option>
        <option value="15" selected>15 minutes before</option>
        <option value="30">30 minutes before</option>
        <option value="60">1 hour before</option>
        <option value="1440">1 day before</option>
      </select>

      <div class="wm-btns">
        <button class="wm-btn-cancel" id="wm-cancel">Cancel</button>
        <button class="wm-btn-send" id="wm-send">🔗 Generate & Send</button>
      </div>
      <div class="wm-status" id="wm-status"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => { if (e.target === modal) closeMeetingModal(); });
  document.getElementById('wm-cancel').addEventListener('click', closeMeetingModal);
  document.getElementById('wm-send').addEventListener('click', sendMeetingInvite);

  async function applyPlatform(platform) {
    const linkInput   = document.getElementById('wm-link');
    const linkLabel   = document.getElementById('wm-link-label');
    const regenBtn    = document.getElementById('wm-regen');
    const linkSection = document.getElementById('wm-link-section');
    const sendBtn     = document.getElementById('wm-send');

    if (['whatsapp', 'phone', 'inperson'].includes(platform)) {
      linkSection.style.display = 'none';
      sendBtn.textContent = '📨 Send Invite';
      return;
    }

    linkSection.style.display = '';

    if (platform === 'jitsi') {
      const title = document.getElementById('wm-mtitle').value || defaultTitle;
      linkInput.value       = generateJitsiLink(title, contactName);
      linkInput.readOnly    = true;
      linkInput.style.color = '#00a884';
      linkInput.style.fontSize = '11px';
      regenBtn.style.display = '';
      linkLabel.innerHTML   = 'Meeting Link <span class="wm-auto-badge">AUTO-GENERATED</span>';
      sendBtn.textContent   = '🔗 Generate & Send';

    } else if (platform === 'googlemeet') {
      linkInput.value       = 'Generating Google Meet link…';
      linkInput.readOnly    = true;
      linkInput.style.color = '#8696a0';
      linkInput.style.fontSize = '11px';
      regenBtn.style.display = '';
      regenBtn.textContent  = '⏳';
      regenBtn.disabled     = true;
      linkLabel.innerHTML   = 'Meeting Link <span class="wm-auto-badge">AUTO-GENERATED</span>';
      sendBtn.textContent   = '🔗 Generate & Send';
      sendBtn.disabled      = true;

      const res = await new Promise(resolve =>
        chrome.runtime.sendMessage({ type: 'GET_GOOGLE_MEET_LINK' }, resolve)
      );
      regenBtn.textContent = '🔄';
      regenBtn.disabled    = false;
      sendBtn.disabled     = false;
      if (res?.success) {
        linkInput.value       = res.link;
        linkInput.style.color = '#00a884';
      } else {
        linkInput.value       = '';
        linkInput.readOnly    = false;
        linkInput.style.color = '';
        linkInput.style.fontSize = '';
        linkInput.placeholder = 'Could not auto-generate. Paste link manually.';
        const statusEl = document.getElementById('wm-status');
        statusEl.style.color = '#f85149';
        statusEl.textContent  = res?.error || 'Google Meet generation failed. Sign in to Google first.';
      }

    } else {
      // Zoom / Teams — manual paste
      linkInput.value          = '';
      linkInput.readOnly       = false;
      linkInput.style.color    = '';
      linkInput.style.fontSize = '';
      linkInput.placeholder    = 'Paste your meeting link here...';
      regenBtn.style.display   = 'none';
      linkLabel.innerHTML      = 'Meeting Link <span style="text-transform:none;font-weight:400;color:#4a5a65">(optional)</span>';
      sendBtn.textContent      = '📨 Send Invite';
    }
  }

  // Platform change → update link field
  document.getElementById('wm-platform').addEventListener('change', function () {
    applyPlatform(this.value);
  });

  // Regen button
  document.getElementById('wm-regen').addEventListener('click', async () => {
    const platform = document.getElementById('wm-platform').value;
    if (platform === 'googlemeet') {
      await applyPlatform('googlemeet');
    } else {
      const title = document.getElementById('wm-mtitle').value || defaultTitle;
      document.getElementById('wm-link').value = generateJitsiLink(title, contactName);
    }
  });

  document.getElementById('wm-mtitle').focus();
}

function closeMeetingModal() {
  const m = document.getElementById(MEETING_MODAL_ID);
  if (m) m.remove();
}

async function sendMeetingInvite() {
  const title    = document.getElementById('wm-mtitle').value.trim()   || 'Meeting';
  const date     = document.getElementById('wm-date').value;
  const time     = document.getElementById('wm-time').value;
  const platformVal = document.getElementById('wm-platform').value;
  const platformNames = { jitsi:'Jitsi Meet', googlemeet:'Google Meet', zoom:'Zoom',
    teams:'Microsoft Teams', whatsapp:'WhatsApp Call', phone:'Phone Call', inperson:'In Person' };
  const platform = platformNames[platformVal] || platformVal;
  const link     = document.getElementById('wm-link').value.trim();
  const notes    = document.getElementById('wm-notes').value.trim();
  const statusEl = document.getElementById('wm-status');
  const sendBtn  = document.getElementById('wm-send');

  if (!date || !time) {
    statusEl.style.color = '#f85149';
    statusEl.textContent = 'Please fill in date and time.';
    return;
  }

  const dt = new Date(`${date}T${time}`);
  const formattedDate = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  let msg = `📅 *Meeting Invitation*\n\n`;
  msg += `*${title}*\n\n`;
  msg += `📆 *Date:* ${formattedDate}\n`;
  msg += `🕐 *Time:* ${formattedTime}\n`;
  msg += `💻 *Platform:* ${platform}`;
  if (link)  msg += `\n🔗 *Link:* ${link}`;
  if (notes) msg += `\n\n📝 *Notes:* ${notes}`;
  msg += `\n\nPlease confirm your availability. Looking forward to connecting! 🙏`;

  statusEl.style.color = '#00a884';
  statusEl.textContent = 'Sending…';
  sendBtn.disabled = true;

  const ok = await typeAndSend(msg);
  if (ok) {
    statusEl.textContent = '✅ Meeting invite sent!';

    // Save meeting + set reminder alarm
    const alertMins = parseInt(document.getElementById('wm-alert').value) || 0;
    chrome.runtime.sendMessage({
      type: 'SAVE_MEETING',
      data: {
        contactName: getContactName(),
        title,
        datetime: new Date(`${date}T${time}`).getTime(),
        platform: platformNames[platformVal] || platformVal,
        link,
        alertMinutes: alertMins
      }
    });

    setTimeout(closeMeetingModal, 1200);
  } else {
    statusEl.style.color = '#f85149';
    statusEl.textContent = 'Failed to send. Make sure a chat is open.';
    sendBtn.disabled = false;
  }
}

// ── Meeting bar: inject directly into WA header DOM (before call buttons) ────
function positionMeetingBar() {
  const bar    = document.getElementById('wa-meeting-bar');
  const header = document.querySelector('#main header');
  if (!bar) return;
  if (!header) { bar.style.display = 'none'; return; }

  // Find the right-side action container inside the header
  // WA's header has a flex row; the right side holds call/search/menu buttons
  const callBtn =
    header.querySelector('[data-testid="audio-call"]') ||
    header.querySelector('[data-testid="video-call"]') ||
    header.querySelector('[data-icon="audio-call"]') ||
    header.querySelector('[data-icon="video-call"]') ||
    header.querySelector('[data-testid="search"]') ||
    header.querySelector('[data-icon="search"]');

  // Find the parent container that holds all the right-side buttons
  let actionsContainer = null;
  if (callBtn) {
    // Walk up to find the flex container that holds all action buttons
    actionsContainer = callBtn.closest('[role="group"]') ||
                       callBtn.closest('div:has(> [data-testid])') ||
                       callBtn.parentElement;
  } else {
    // Try common header container selectors
    actionsContainer =
      header.querySelector('[data-testid="conversation-header-actions"]') ||
      header.querySelector('[role="group"]');
  }

  // If bar isn't already in the header, move it there
  if (actionsContainer && bar.parentElement !== actionsContainer) {
    bar.style.position = 'relative';
    bar.style.top  = '';
    bar.style.left = '';
    // Insert before the first child of the actions container (left of call buttons)
    if (callBtn && actionsContainer.contains(callBtn)) {
      // Insert before the call button's direct-child ancestor in the container
      let ref = callBtn;
      while (ref.parentElement !== actionsContainer) ref = ref.parentElement;
      actionsContainer.insertBefore(bar, ref);
    } else {
      actionsContainer.insertBefore(bar, actionsContainer.firstChild);
    }
    bar.style.display = 'flex';
  } else if (!actionsContainer) {
    // Absolute fallback: if we can't find the action container, keep fixed position
    const hRect = header.getBoundingClientRect();
    const barW  = bar.offsetWidth || 130;
    bar.style.position = 'fixed';
    bar.style.display  = 'flex';
    bar.style.top      = (hRect.top + (hRect.height - 26) / 2) + 'px';
    bar.style.left     = (hRect.right - barW - 200) + 'px';
  }
}

function ensureMeetingBar() {
  injectMeetingStyles();

  // If bar exists but got detached from the DOM (WA re-rendered header), remove it
  const existing = document.getElementById('wa-meeting-bar');
  if (existing && !document.body.contains(existing)) {
    existing.remove();
  }

  if (!document.getElementById('wa-meeting-bar')) {
    const bar = document.createElement('div');
    bar.id = 'wa-meeting-bar';
    const mkBtn = (id, svg, tip, cls, handler) => {
      const b = document.createElement('button');
      b.id = id;
      b.className = 'wa-icon-btn' + (cls ? ' ' + cls : '');
      b.innerHTML = svg;
      b.dataset.tip = tip;
      b.addEventListener('click', e => { e.stopPropagation(); handler(e); });
      return b;
    };

    const SVG_CAL  = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 6.5h13" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.5V4M11 1.5V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="5.5" cy="9.5" r=".7" fill="currentColor"/><circle cx="8" cy="9.5" r=".7" fill="currentColor"/><circle cx="10.5" cy="9.5" r=".7" fill="currentColor"/><circle cx="5.5" cy="12" r=".7" fill="currentColor"/><circle cx="8" cy="12" r=".7" fill="currentColor"/></svg>`;
    const SVG_BOLT = `<svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><path d="M8.5 1L2 8.5h5.5L5.5 13l7-7.5H7L8.5 1z"/></svg>`;
    const SVG_PER  = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.75" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 14.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
    const SVG_EXP  = `<svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5v9M4.5 8l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12v1a.5.5 0 00.5.5h10a.5.5 0 00.5-.5v-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;

    const div1 = document.createElement('div'); div1.className = 'wa-bar-divider';

    bar.appendChild(mkBtn(MEETING_BTN_ID, SVG_CAL,  'Schedule Meeting', 'wa-icon-btn-primary', openMeetingModal));
    bar.appendChild(div1);
    bar.appendChild(mkBtn('wa-qr-btn',     SVG_BOLT, 'Quick Reply Templates', '', toggleQuickReplyStrip));
    bar.appendChild(mkBtn('wa-card-btn',   SVG_PER,  'Contact Card (CRM)',    '', openCardPanel));
    bar.appendChild(mkBtn('wa-export-btn', SVG_EXP,  'Export Chat as .txt',   '', exportChat));

    // Append to body first, then positionMeetingBar will move it into the header
    document.body.appendChild(bar);
  }
  positionMeetingBar();
}

// Poll every 400ms — meeting bar + transcribe buttons + translate buttons + label bar + audio interceptor
injectAudioInterceptor(); // run immediately on load
setInterval(() => {
  ensureMeetingBar();
  injectQuickReplyStrip();
  injectTranscribeButtons();
  injectTranslateButtons();
  injectHoverReply();
  ensureLabelFilterBar();
  if (currentLabelFilter !== 'all') {
    applyLabelFilter(currentLabelFilter);
    startLabelObserver();
  }
  applyVirtualPins();
  startVpinObserver();
  injectChatPinButtons();
  injectAudioInterceptor();
}, 400);

// ─── Message Translation ──────────────────────────────────────────────────────
function injectTranslateButtons() {
  document.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out').forEach(container => {
    if (container.dataset.waTranslateScanned) return;

    let textEl = null;
    for (const s of ['.selectable-text.copyable-text', 'span.selectable-text', '.copyable-text span']) {
      const el = container.querySelector(s);
      if (el?.innerText?.trim()) { textEl = el; break; }
    }
    if (!textEl) return;

    container.dataset.waTranslateScanned = '1';
    if (container.querySelector('.wa-translate-btn')) return;

    const SVG_GLOB = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><ellipse cx="6" cy="6" rx="2" ry="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 6h9M2 4h8M2 8h8" stroke="currentColor" stroke-width="1.1"/></svg>`;
    const btn = document.createElement('button');
    btn.className   = 'wa-translate-btn';
    btn.innerHTML   = SVG_GLOB;
    btn.dataset.tip = 'Translate to English';
    btn.addEventListener('click', () => translateMessage(container, btn, textEl));
    container.appendChild(btn);
  });
}

const SVG_SPIN = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.2" stroke-dasharray="6 6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 5.5 5.5" to="360 5.5 5.5" dur="0.8s" repeatCount="indefinite"/></circle></svg>`;
const SVG_CHECK = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l3 3 4-5" stroke="#00a884" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

async function translateMessage(container, btn, textEl) {
  btn.disabled = true;
  btn.innerHTML = SVG_SPIN;
  container.querySelector('.wa-translation-result')?.remove();

  const text = textEl.innerText.trim();
  if (!text) { btn.disabled = false; btn.textContent = '🌐 Translate'; return; }

  try {
    const url  = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // data[0] = array of [translated_chunk, original_chunk, ...]
    const translated = (data[0] || []).map(s => s?.[0] || '').join('').trim();

    const SVG_GLOB2 = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><ellipse cx="6" cy="6" rx="2" ry="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 6h9M2 4h8M2 8h8" stroke="currentColor" stroke-width="1.1"/></svg>`;
    if (translated && translated.toLowerCase() !== text.toLowerCase()) {
      const bubble = document.createElement('div');
      bubble.className   = 'wa-translation-result';
      bubble.textContent = translated;
      btn.insertAdjacentElement('afterend', bubble);
      btn.innerHTML = SVG_CHECK;
      btn.dataset.tip = 'Translated';
    } else {
      btn.innerHTML = SVG_GLOB2;
      btn.dataset.tip = 'Already English';
      btn.disabled    = false;
    }
  } catch (e) {
    const SVG_GLOB3 = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><ellipse cx="6" cy="6" rx="2" ry="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 6h9M2 4h8M2 8h8" stroke="currentColor" stroke-width="1.1"/></svg>`;
    btn.innerHTML = SVG_GLOB3;
    btn.dataset.tip = 'Translate failed – retry';
    btn.disabled    = false;
  }
}

// ─── Conversation Label Filter Bar ───────────────────────────────────────────
let currentLabelFilter = 'all';

function ensureLabelFilterBar() {
  const pane = document.querySelector('#pane-side');
  if (!pane) {
    const existing = document.getElementById('wa-label-bar');
    if (existing) existing.remove();
    return;
  }

  if (!document.getElementById('wa-label-bar')) {
    const bar = document.createElement('div');
    bar.id = 'wa-label-bar';
    bar.innerHTML = `
      <button class="wa-label-chip active" data-filter="all">All</button>
      <button class="wa-label-chip" data-filter="unread">🔴 Unread</button>
      <button class="wa-label-chip" data-filter="waiting">⏳ Waiting</button>
      <button class="wa-label-chip" data-filter="mentions">@ Mentions</button>
    `;
    document.body.appendChild(bar);

    bar.querySelectorAll('.wa-label-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentLabelFilter = chip.dataset.filter;
        bar.querySelectorAll('.wa-label-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applyLabelFilter(currentLabelFilter);
        // Start observer to re-apply as WhatsApp re-renders the virtual list
        if (currentLabelFilter !== 'all') {
          startLabelObserver();
        } else {
          stopLabelObserver();
          // Reset all rows
          getVisibleChatRows().forEach(r => r.style.removeProperty('display'));
        }
      });
    });
  }
  positionLabelBar();
}

function positionLabelBar() {
  const bar  = document.getElementById('wa-label-bar');
  const pane = document.querySelector('#pane-side');
  if (!bar || !pane) return;
  const r = pane.getBoundingClientRect();
  bar.style.top   = r.top + 'px';
  bar.style.left  = r.left + 'px';
  bar.style.width = r.width + 'px';
}

// Selectors that find individual chat row containers in the sidebar
const CHAT_ROW_SEL = [
  '[data-testid="cell-frame-container"]',
  '#pane-side [role="listitem"]',
  '#pane-side [tabindex="-1"]',
].join(', ');

function getVisibleChatRows() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return [];
  // Try specific testid first, then role, then any focusable descendant
  let rows = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"]'));
  if (!rows.length) rows = Array.from(pane.querySelectorAll('[role="listitem"]'));
  if (!rows.length) rows = Array.from(pane.querySelectorAll('[tabindex="-1"]')).filter(el =>
    el.offsetHeight > 30 && el.children.length > 0
  );
  return rows;
}

function rowMatchesFilter(row, filter) {
  if (filter === 'all') return true;
  if (filter === 'unread') {
    return !!(
      row.querySelector('[data-testid="icon-unread-count"]') ||
      row.querySelector('[aria-label*="unread"]') ||
      row.querySelector('.unread-count') ||
      row.querySelector('span[data-icon="unread-count"]')
    );
  }
  if (filter === 'waiting') {
    const hasSent   = !!(
      row.querySelector('[data-icon="msg-dblcheck"]') ||
      row.querySelector('[data-icon="msg-check"]') ||
      row.querySelector('[data-icon="msg-time"]') ||
      row.querySelector('[data-testid="msg-dblcheck"]') ||
      row.querySelector('[data-testid="msg-check"]')
    );
    const hasUnread = !!row.querySelector('[data-testid="icon-unread-count"]');
    return hasSent && !hasUnread;
  }
  if (filter === 'mentions') {
    // Look for WhatsApp's @ mention badge or @ in preview text
    return !!(
      row.querySelector('[data-icon="at-mentioned"]') ||
      row.querySelector('[data-testid="at-mentioned"]') ||
      (row.textContent || '').match(/@\w/)
    );
  }
  return true;
}

let labelObserver = null;

function applyLabelFilter(filter) {
  const rows = getVisibleChatRows();
  rows.forEach(row => {
    const show = rowMatchesFilter(row, filter);
    row.style.setProperty('display', show ? '' : 'none', 'important');
  });
}

function startLabelObserver() {
  if (labelObserver) return;
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  labelObserver = new MutationObserver(() => {
    if (currentLabelFilter !== 'all') applyLabelFilter(currentLabelFilter);
  });
  labelObserver.observe(pane, { childList: true, subtree: true });
}

function stopLabelObserver() {
  if (labelObserver) { labelObserver.disconnect(); labelObserver = null; }
}

// ─── Virtual Pin (up to 8 pinned chats in WA Web list) ───────────────────────
let vpinObserver   = null;
let vpinDebounce   = null;

function applyVirtualPins() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return;

  chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
    // Remove stale badges first
    pane.querySelectorAll('.wa-vpin-badge').forEach(b => b.remove());
    if (!pinnedChats.length) return;

    const rows = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"]'));
    if (!rows.length) return;

    const pinnedNames  = new Set(pinnedChats.map(p => (p.name  || '').toLowerCase().trim()));
    const pinnedPhones = new Set(pinnedChats.map(p => (p.phone || '').replace(/\D/g, '')));

    const matched = [];
    rows.forEach(row => {
      const nameEl    = row.querySelector('[data-testid="cell-frame-title"]');
      const nameText  = (nameEl?.textContent || '').trim().toLowerCase();
      const digits    = nameText.replace(/\D/g, '');
      const isVPin    = pinnedNames.has(nameText) ||
                        (digits.length >= 7 && pinnedPhones.has(digits));
      if (!isVPin) return;

      // Add 📌 badge
      const badge = document.createElement('span');
      badge.className = 'wa-vpin-badge';
      badge.textContent = '📌';
      badge.style.cssText = 'position:absolute;top:6px;right:6px;font-size:11px;z-index:2;pointer-events:none';
      row.style.position = 'relative';
      row.appendChild(badge);
      matched.push(row);
    });

    // Move matched rows to the very top of the list
    if (!matched.length) return;
    const parent = rows[0].parentElement;
    if (!parent) return;
    // Insert in reverse so first pin ends up at top
    [...matched].reverse().forEach(row => parent.insertBefore(row, parent.firstChild));
  });
}

function startVpinObserver() {
  if (vpinObserver) return;
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  vpinObserver = new MutationObserver(() => {
    clearTimeout(vpinDebounce);
    vpinDebounce = setTimeout(applyVirtualPins, 350);
  });
  vpinObserver.observe(pane, { childList: true, subtree: true });
}

// Re-apply when pins change from sidepanel
chrome.storage.onChanged.addListener(changes => {
  if (changes.pinnedChats) applyVirtualPins();
});

// ─── Contact Card Panel ───────────────────────────────────────────────────────
function closeCardPanel() {
  const p = document.getElementById('wa-card-panel');
  if (p) p.remove();
}

async function openCardPanel() {
  if (document.getElementById('wa-card-panel')) { closeCardPanel(); return; }

  const contactName = getContactName();
  const stored      = await new Promise(r => chrome.storage.local.get('contacts', r));
  const contacts    = stored.contacts || [];

  const contact = contacts.find(c => {
    const name = (c.name || '').toLowerCase();
    const cn   = contactName.toLowerCase();
    return name && (cn.includes(name) || name.includes(cn));
  });

  const stageLabels = { new: 'New', contacted: 'Contacted', interested: 'Interested', converted: 'Converted', lost: 'Lost' };
  const stageClass  = { new: 'new', contacted: 'contacted', interested: 'interested', converted: 'converted', lost: 'lost' };

  let bodyHtml;
  if (contact) {
    const stage    = contact.stage || 'new';
    const tagsHtml = contact.tags?.length
      ? `<div class="wcp-tags">${contact.tags.map(t => `<span class="wcp-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';
    bodyHtml = `
      <div class="wcp-row"><span class="wcp-key">Name</span><span class="wcp-val">${escapeHtml(contact.name || '—')}</span></div>
      <div class="wcp-row"><span class="wcp-key">Phone</span><span class="wcp-val">${escapeHtml(contact.phone || '—')}</span></div>
      ${contact.email   ? `<div class="wcp-row"><span class="wcp-key">Email</span><span class="wcp-val">${escapeHtml(contact.email)}</span></div>` : ''}
      ${contact.company ? `<div class="wcp-row"><span class="wcp-key">Company</span><span class="wcp-val">${escapeHtml(contact.company)}</span></div>` : ''}
      <div class="wcp-row"><span class="wcp-key">Stage</span><span class="wcp-val"><span class="wcp-stage wcp-stage-${stageClass[stage] || 'new'}">${stageLabels[stage] || stage}</span></span></div>
      ${contact.notes ? `<div class="wcp-row" style="flex-direction:column;gap:3px"><span class="wcp-key">Notes</span><span class="wcp-val" style="text-align:left">${escapeHtml(contact.notes)}</span></div>` : ''}
      ${tagsHtml ? `<div class="wcp-row" style="flex-direction:column;gap:4px"><span class="wcp-key">Tags</span>${tagsHtml}</div>` : ''}
    `;
  } else {
    bodyHtml = `<div class="wcp-empty">No CRM data found for<br><strong style="color:#e9edef">${escapeHtml(contactName)}</strong><br><br>Add them in the CRM tab of the side panel.</div>`;
  }

  const panel = document.createElement('div');
  panel.id = 'wa-card-panel';
  panel.innerHTML = `
    <div class="wcp-header">
      <span>👤 ${escapeHtml(contactName)}</span>
      <button class="wcp-close">✕</button>
    </div>
    <div class="wcp-body">${bodyHtml}</div>
  `;
  document.body.appendChild(panel);

  // Position below the meeting bar (now in the header area)
  const bar = document.getElementById('wa-meeting-bar');
  if (bar) {
    const r = bar.getBoundingClientRect();
    panel.style.top   = (r.bottom + 8) + 'px';
    panel.style.right = '14px';
  } else {
    panel.style.top   = '60px';
    panel.style.right = '14px';
  }

  panel.querySelector('.wcp-close').addEventListener('click', closeCardPanel);
  setTimeout(() => {
    document.addEventListener('click', function outside(e) {
      if (!panel.contains(e.target) && e.target.id !== 'wa-card-btn') {
        closeCardPanel();
        document.removeEventListener('click', outside);
      }
    }, true);
  }, 0);
}

// ─── Chat Export ──────────────────────────────────────────────────────────────
function exportChat() {
  const contactName = getContactName();
  const containers  = document.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out');
  if (!containers.length) return;

  const lines = [`WhatsApp Chat Export — ${contactName}`, `Exported: ${new Date().toLocaleString()}`, '─'.repeat(50), ''];

  containers.forEach(c => {
    const isOut = ['[data-icon="msg-dblcheck"]', '[data-icon="msg-check"]', '[data-icon="msg-time"]'].some(s => c.querySelector(s));
    let text = '';
    for (const s of ['.selectable-text.copyable-text', 'span.selectable-text', '.copyable-text span']) {
      const el = c.querySelector(s);
      if (el?.innerText?.trim()) { text = el.innerText.trim(); break; }
    }
    // Try to extract timestamp from data-pre-plain-text attr (e.g. "[2:30 PM, 25/2/2026] You: ")
    const copyEl = c.querySelector('[data-pre-plain-text]');
    const tsMatch = copyEl?.getAttribute('data-pre-plain-text')?.match(/\[(.+?)\]/);
    const ts = tsMatch ? tsMatch[1] : '';
    if (text) lines.push(`[${ts || '—'}] ${isOut ? 'You' : contactName}: ${text}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `WA_${contactName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Hover Reply Feature ──────────────────────────────────────────────────────
let hoverReplyTarget = null;
let hideReplyTimer   = null;

const SVG_REPLY_ARROW = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 5.5L4.5 2.5M1.5 5.5L4.5 8.5M1.5 5.5H7.5a4 4 0 014 4V11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Find the actual bubble element (narrower than the full-width msg container)
function getBubbleEl(msgContainer) {
  // Try WA-specific bubble class names first
  const waSelectors = [
    '.tail-container',
    '[class*="tail-container"]',
    '[class*="message-box"]',
    '[class*="focusable-list-item"]',
  ];
  for (const sel of waSelectors) {
    const el = msgContainer.querySelector(sel);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40) return el;
    }
  }
  // Fall back: walk up from text element to find narrower ancestor
  const text = msgContainer.querySelector('.selectable-text, .copyable-text');
  if (!text) return null;
  const cW = msgContainer.getBoundingClientRect().width;
  if (!cW) return null;
  let node = text.parentElement;
  while (node && node !== msgContainer) {
    const w = node.getBoundingClientRect().width;
    if (w > 60 && w < cW * 0.85) return node;
    node = node.parentElement;
  }
  return null;
}

function ensureHoverReplyBtn() {
  if (document.getElementById('wa-hover-reply')) return;
  const btn = document.createElement('button');
  btn.id        = 'wa-hover-reply';
  btn.innerHTML = SVG_REPLY_ARROW;
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    if (hoverReplyTarget) triggerNativeReply(hoverReplyTarget);
  });
  btn.addEventListener('mouseenter', () => {
    clearTimeout(hideReplyTimer);
    btn.classList.add('whr-visible');
  });
  btn.addEventListener('mouseleave', scheduleHideReply);
}

function scheduleHideReply() {
  clearTimeout(hideReplyTimer);
  hideReplyTimer = setTimeout(() => {
    const b = document.getElementById('wa-hover-reply');
    if (b) b.classList.remove('whr-visible');
    hoverReplyTarget = null;
  }, 300);
}

function showReplyBtnFor(msgContainer) {
  const btn = document.getElementById('wa-hover-reply');
  if (!btn) return;

  const bubble = getBubbleEl(msgContainer);
  const r = (bubble || msgContainer).getBoundingClientRect();

  // WA places its emoji btn to the RIGHT of incoming bubbles, LEFT of outgoing
  const isOut = msgContainer.classList.contains('message-out') ||
                !!msgContainer.closest('.message-out') ||
                !!msgContainer.querySelector(
                  '[data-icon="msg-dblcheck"],[data-icon="msg-check"],[data-icon="msg-time"],' +
                  '[data-testid="msg-dblcheck"],[data-testid="msg-check"]'
                );

  const TOP = r.top + 4;
  if (isOut) {
    // Outgoing: place to the LEFT of bubble, beyond WA's own emoji btn
    btn.style.top  = TOP + 'px';
    btn.style.left = (r.left - 58) + 'px';
  } else {
    // Incoming: place to the RIGHT of bubble, beyond WA's own emoji btn
    btn.style.top  = TOP + 'px';
    btn.style.left = (r.right + 32) + 'px';
  }
  btn.classList.add('whr-visible');
}

function injectHoverReply() {
  ensureHoverReplyBtn();
  // Bind to all messages — text, images, videos, stickers, documents, etc.
  document.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out').forEach(c => {
    if (c.dataset.waHoverReplyBound) return;
    c.dataset.waHoverReplyBound = '1';

    c.addEventListener('mouseenter', () => {
      clearTimeout(hideReplyTimer);
      hoverReplyTarget = c;
      showReplyBtnFor(c);
    });
    c.addEventListener('mouseleave', e => {
      if (e.relatedTarget?.id === 'wa-hover-reply') return;
      scheduleHideReply();
    });
  });
}

// ─── Chat Row Pin Button ──────────────────────────────────────────────────────

async function tryNativePin(row) {
  // Open WA's right-click context menu on the chat row
  const r = row.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  await sleep(400);

  // Find "Pin chat" or "Unpin chat" in the menu
  const PIN_SELS = [
    '[data-testid="mi-msg-pin"]',
    '[aria-label="Pin chat"]', '[aria-label="Unpin chat"]',
    '[aria-label*="Pin"]',
  ];
  for (const sel of PIN_SELS) {
    const item = document.querySelector(sel);
    if (item) { item.click(); return; }
  }
  // Fallback: search menu items by text
  const item = [...document.querySelectorAll('[role="menuitem"], li')]
    .find(el => /^(pin|unpin)/i.test(el.textContent.trim()));
  if (item) item.click();
  // Dismiss menu if pin item not found
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function injectChatPinButtons() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  pane.querySelectorAll('[data-testid="cell-frame-container"]').forEach(cell => {
    if (cell.dataset.pinInjected) return;
    // Find the chevron-down button WA shows on hover — inject our btn right before it
    const chevron = cell.querySelector('span[data-icon="ic-chevron-down-menu"]')?.closest('button');
    if (!chevron) return;
    const nameEl = cell.querySelector('[data-testid="cell-frame-title"], span[title][dir="auto"]');
    const name = nameEl?.textContent?.trim() || '';
    if (!name) return;
    cell.dataset.pinInjected = '1';
    // Extract phone from WA's data-id (format: "12345678901@c.us")
    const dataId = cell.dataset.id || '';
    const phone = dataId.split('@')[0] || name.replace(/\D/g, '') || name;
    const btn = document.createElement('button');
    btn.className = 'wa-pin-btn'; btn.textContent = '📌'; btn.title = 'Pin chat';
    // Insert right before the chevron so it sits in the same hover-visible container
    chevron.parentElement.insertBefore(btn, chevron);
    chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
      if (pinnedChats.some(p => p.name.toLowerCase() === name.toLowerCase()))
        btn.classList.add('pinned');
    });
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      chrome.storage.local.get('pinnedChats', async ({ pinnedChats = [] }) => {
        const n = nameEl?.textContent?.trim() || '';
        const already = pinnedChats.some(p => p.name.toLowerCase() === n.toLowerCase());
        if (already) {
          await tryNativePin(cell.parentElement || cell);
          pinnedChats = pinnedChats.filter(p => p.name.toLowerCase() !== n.toLowerCase());
          btn.classList.remove('pinned'); btn.title = 'Pin chat';
        } else {
          if (pinnedChats.length >= 8) { btn.title = 'Max 8 pins!'; setTimeout(() => btn.title = 'Pin chat', 1500); return; }
          if (pinnedChats.length < 3) await tryNativePin(cell.parentElement || cell);
          pinnedChats.push({ phone, name: n });
          btn.classList.add('pinned'); btn.title = 'Unpin';
        }
        chrome.storage.local.set({ pinnedChats });
        applyVirtualPins();
      });
    });
  });
}

async function triggerNativeReply(msgContainer) {
  console.log('[WA-Reply] triggerNativeReply called');
  document.getElementById('wa-hover-reply')?.classList.remove('whr-visible');

  msgContainer.scrollIntoView({ block: 'center', behavior: 'instant' });
  await sleep(200);

  const bubble = getBubbleEl(msgContainer) || msgContainer;
  const rect   = bubble.getBoundingClientRect();
  const cx     = Math.round(rect.left + rect.width / 2);
  const cy     = Math.round(rect.top  + rect.height / 2);

  // ── Helpers ──
  const reveal = el => {
    if (!el) return () => {};
    const s = el.style;
    const prev = { op: s.opacity, pe: s.pointerEvents, vis: s.visibility, dis: s.display };
    s.setProperty('opacity',        '1',       'important');
    s.setProperty('pointer-events', 'auto',    'important');
    s.setProperty('visibility',     'visible', 'important');
    if (getComputedStyle(el).display === 'none') s.setProperty('display', 'flex', 'important');
    return () => { s.opacity = prev.op; s.pointerEvents = prev.pe; s.visibility = prev.vis; s.display = prev.dis; };
  };

  // Reveal an element AND all its ancestors up to root (WA hides parent containers too)
  const revealChain = (el, stopAt) => {
    const restores = [];
    let node = el;
    while (node && node !== stopAt && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') {
        restores.push(reveal(node));
      }
      node = node.parentElement;
    }
    return () => restores.forEach(r => r());
  };

  // Search roots: message container + ancestors + list-item wrapper
  const buildRoots = () => {
    const roots = new Set();
    let node = msgContainer;
    for (let i = 0; i < 6; i++) {
      if (!node) break;
      roots.add(node);
      node = node.parentElement;
    }
    for (const sel of ['[data-testid^="list-item"]', '[data-id]', '[class*="focusable-list-item"]']) {
      const li = msgContainer.closest(sel);
      if (li) { roots.add(li); if (li.parentElement) roots.add(li.parentElement); }
    }
    return [...roots];
  };

  const REPLY_SELS = [
    '[data-testid="msg-action-reply"]',
    '[aria-label="Reply"]', '[aria-label*="eply"]',
    '[data-icon="reply-refreshed"]', '[data-icon="reply"]',
    'button[title="Reply"]', 'button[title*="eply"]',
  ];

  const findReplyBtn = root => {
    for (const sel of REPLY_SELS) {
      const el = root.querySelector(sel);
      if (el && !el.closest('[data-testid="quoted-msg"]')) {
        // If it's an icon, walk up to the clickable button
        return el.closest('button, [role="button"]') || el;
      }
    }
    return null;
  };

  // Find "Reply" in any open WA popup/context menu (multi-language)
  const REPLY_RE = /^(reply|responder|répondre|antworten|rispondi|balas|ответить)$/i;
  const findReplyMenuItem = async (maxWait = 5) => {
    for (let i = 0; i < maxWait; i++) {
      await sleep(250);
      const item =
        document.querySelector('[data-testid="mi-msg-reply"]') ||
        [...document.querySelectorAll('[role="menuitem"], [role="option"]')].find(el =>
          REPLY_RE.test(el.textContent.trim())
        ) ||
        [...document.querySelectorAll('li[tabindex], li[role]')].find(el =>
          el.querySelector('[data-icon="reply-refreshed"], [data-icon="reply"]') ||
          REPLY_RE.test(el.textContent.trim())
        );
      if (item) return item;
    }
    return null;
  };

  // ── Method 1: Dispatch hover events → wait for React to render action bar ──
  console.log('[WA-Reply] Method 1: hover simulation');
  const hoverOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
  for (const target of [bubble, msgContainer]) {
    // Pointer events (React 17+ listens to these)
    target.dispatchEvent(new PointerEvent('pointerover',  { ...hoverOpts, pointerId: 1, pointerType: 'mouse', relatedTarget: document.body }));
    target.dispatchEvent(new PointerEvent('pointerenter', { ...hoverOpts, pointerId: 1, pointerType: 'mouse', bubbles: false, relatedTarget: document.body }));
    target.dispatchEvent(new PointerEvent('pointermove',  { ...hoverOpts, pointerId: 1, pointerType: 'mouse' }));
    // Mouse events (fallback for older React)
    target.dispatchEvent(new MouseEvent('mouseover',  { ...hoverOpts, relatedTarget: document.body }));
    target.dispatchEvent(new MouseEvent('mouseenter', { ...hoverOpts, bubbles: false, relatedTarget: document.body }));
    target.dispatchEvent(new MouseEvent('mousemove',  hoverOpts));
  }

  // Wait & scan for the action bar to appear (React renders async)
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(300);
    for (const root of buildRoots()) {
      const actionBar = root.querySelector('[data-testid="msg-action-bar"]');
      for (const r of [actionBar, root].filter(Boolean)) {
        const btn = findReplyBtn(r);
        if (btn) {
          console.log('[WA-Reply] M1: found reply btn', btn.outerHTML.slice(0, 80));
          const restore = revealChain(btn, root);
          btn.click();
          await sleep(80);
          restore();
          return;
        }
      }
      // Force-reveal the action bar and retry
      if (actionBar) {
        const restore = revealChain(actionBar, root);
        await sleep(100);
        const btn = findReplyBtn(actionBar);
        if (btn) {
          console.log('[WA-Reply] M1: found reply btn after reveal');
          btn.click(); await sleep(80); restore(); return;
        }
        restore();
      }
    }
  }

  // ── Method 2: Find chevron/down arrow in action bar → click → Reply from dropdown ──
  console.log('[WA-Reply] Method 2: chevron → dropdown');
  const MORE_ICONS = ['down', 'down-context', 'chevron', 'chevron-down', 'msg-more', 'menu'];
  for (const root of buildRoots()) {
    for (const name of MORE_ICONS) {
      const icon = root.querySelector(`[data-icon="${name}"]`);
      if (!icon || icon.closest('[data-testid="quoted-msg"]')) continue;
      const moreBtn = icon.closest('button, [role="button"], span[data-testid]') || icon.parentElement;
      if (!moreBtn) continue;

      console.log('[WA-Reply] M2: clicking chevron', name);
      const restore = revealChain(moreBtn, root);
      moreBtn.dispatchEvent(new PointerEvent('pointerdown', { ...hoverOpts, pointerId: 1, pointerType: 'mouse' }));
      moreBtn.dispatchEvent(new PointerEvent('pointerup',   { ...hoverOpts, pointerId: 1, pointerType: 'mouse' }));
      moreBtn.click();
      await sleep(100);
      restore();

      const dropReply = await findReplyMenuItem(6);
      if (dropReply) {
        console.log('[WA-Reply] M2: clicking Reply menu item');
        dropReply.click();
        return;
      }
      // Close stale menu
      document.body.click();
      await sleep(100);
    }
  }

  // ── Method 3: Right-click context menu → Reply ──
  console.log('[WA-Reply] Method 3: context menu');
  bubble.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 2, buttons: 2
  }));

  const ctxReply = await findReplyMenuItem(6);
  if (ctxReply) {
    console.log('[WA-Reply] M3: clicking Reply from context menu');
    ctxReply.click();
    return;
  }
  // Close context menu
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  await sleep(100);

  // ── Method 4: Brute-force — find ANY element with reply icon/testid in entire msg row ──
  console.log('[WA-Reply] Method 4: brute-force scan');
  const row = msgContainer.closest('[data-testid^="conv-msg"], [class*="focusable-list-item"]') || msgContainer.parentElement?.parentElement;
  if (row) {
    // Force-reveal everything in the row that's hidden
    const hiddenEls = row.querySelectorAll('[style*="opacity: 0"], [style*="visibility: hidden"], [style*="display: none"]');
    const restores = [...hiddenEls].map(el => reveal(el));
    await sleep(100);

    const btn = findReplyBtn(row);
    if (btn) {
      console.log('[WA-Reply] M4: brute-force found reply btn');
      btn.click();
      await sleep(80);
      restores.forEach(r => r());
      return;
    }
    restores.forEach(r => r());
  }

  console.warn('[WA-Reply] All methods failed for message:', msgContainer.textContent?.slice(0, 50));
}

// ─── Bulk Message Send (reliable Lexical editor input) ────────────────────────
async function sendBulkMessage(text) {
  if (findEl(SEL.qrCode)) return { success: false, error: 'Not logged in — scan QR first' };

  // 1. Wait for the chat header — confirms the chat is fully open
  const header = await waitForEl(['#main header', '#main [data-testid="conversation-header"]'], 12000);
  if (!header) return { success: false, error: 'Chat did not open' };
  await sleep(600);

  // 2. Find compose box
  const input =
    document.querySelector('#main footer [data-lexical-editor="true"]') ||
    document.querySelector('#main footer div[contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"][data-tab="10"]');
  if (!input) return { success: false, error: 'Compose box not found' };

  // 3. Click + focus to activate
  input.click();
  input.focus();
  await sleep(400);

  // 4. Insert text with proper newline handling (Shift+Enter for line breaks)
  await insertMessageText(input, text);
  await sleep(400);

  // 5. If nothing was inserted, fall back to paste event
  if (!input.textContent?.trim()) {
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      await sleep(400);
    } catch (_) {}
  }

  // 6. Wait for the send button — it only appears when WA sees text in the box
  const sendBtn = await waitForEl([
    'button[data-testid="compose-btn-send"]',
    '[data-testid="compose-btn-send"]',
    '#main footer button[aria-label="Send"]',
    '#main footer span[data-icon="send"]'
  ], 6000);

  if (!sendBtn) return { success: false, error: 'Send button not found — text was not accepted' };

  await sleep(200);
  sendBtn.click();
  await sleep(800);
  return { success: true };
}

// ─── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CLICK_SEND') {
    clickSend().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'TYPE_AND_SEND') {
    sendBulkMessage(msg.message).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'SEND_WITH_IMAGE') {
    sendImageWithCaption(msg.imageData, msg.imageMime, msg.imageName, msg.caption).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'OPEN_AND_SEND') {
    (async () => {
      const nav = await openChatByPhone(msg.phone);
      if (!nav.success) return sendResponse(nav);
      if (msg.imageData) {
        sendResponse(await sendImageWithCaption(msg.imageData, msg.imageMime, msg.imageName, msg.caption));
      } else {
        const ok = await typeAndSend(msg.message);
        sendResponse({ success: !!ok });
      }
    })().catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'OPEN_CHAT_QUOTED') {
    // Respond immediately so the message channel closes cleanly
    sendResponse({ success: true });

    // Do the work in the background (fire-and-forget)
    (async () => {
      const header = await waitForEl(['#main header', '#main [data-testid="conversation-header"]'], 12000);
      if (!header) return;
      await sleep(1000);

      if (msg.originalText) {
        const snippet = msg.originalText.trim().substring(0, 40).toLowerCase();
        const containers = Array.from(document.querySelectorAll(
          '[data-testid="msg-container"], .message-in, .message-out'
        ));
        for (let i = containers.length - 1; i >= 0; i--) {
          const txt = containers[i].textContent?.toLowerCase() || '';
          if (txt.includes(snippet)) {
            containers[i].scrollIntoView({ block: 'center', behavior: 'instant' });
            await sleep(300);
            containers[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
            await sleep(200);
            const replyBtn = document.getElementById('wa-hover-reply');
            if (replyBtn) {
              replyBtn.click();
            } else {
              await triggerNativeReply(containers[i]);
            }
            break;
          }
        }
      }
    })().catch(e => console.warn('[WA] OPEN_CHAT_QUOTED:', e.message));
    return false;
  }

  if (msg.type === 'QUOTED_REPLY') {
    sendResponse({ success: true });
    (async () => {
      const header = await waitForEl(['#main header', '#main [data-testid="conversation-header"]'], 12000);
      if (!header) return;
      await sleep(1000);

      let targetMsg = null;
      if (msg.originalText) {
        const snippet = msg.originalText.trim().substring(0, 40).toLowerCase();
        const containers = Array.from(document.querySelectorAll(
          '[data-testid="msg-container"], .message-in, .message-out'
        ));
        for (let i = containers.length - 1; i >= 0; i--) {
          const txt = containers[i].textContent?.toLowerCase() || '';
          if (txt.includes(snippet)) { targetMsg = containers[i]; break; }
        }
      }

      if (targetMsg) {
        await triggerNativeReply(targetMsg);
        await sleep(800);
      }

      await sendBulkMessage(msg.replyMessage);
    })().catch(e => console.warn('[WA] QUOTED_REPLY:', e.message));
    return false;
  }

  if (msg.type === 'READ_LAST_MESSAGE') {
    readLastMessage().then(sendResponse).catch(e => sendResponse({ text: null, isIncoming: false }));
    return true;
  }

  if (msg.type === 'GET_UNREAD_CONTACTS') {
    getUnreadContacts().then(sendResponse).catch(() => sendResponse({ names: [] }));
    return true;
  }

  if (msg.type === 'SET_PRIVACY') {
    setWAPrivacy(msg.on);
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'START_AUTO_REPLY') {
    startAutoReply(msg.config).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'STOP_AUTO_REPLY') {
    stopAutoReply();
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'SEND_MEETING_REMINDER') {
    // Only send if the open chat matches the contact
    const openContact = getContactName();
    if (openContact && msg.contactName && openContact.toLowerCase().includes(msg.contactName.toLowerCase().split(' ')[0])) {
      typeAndSend(msg.reminder).then(() => sendResponse({ success: true }));
    } else {
      sendResponse({ success: false, reason: 'Different chat open' });
    }
    return true;
  }

  if (msg.type === 'PING') {
    sendResponse({ ready: true });
    return false;
  }
});

// ─── Pinned Chats Bar (injected into WhatsApp Web left panel) ─────────────────
function renderPinnedBar() {
  const bar = document.getElementById('wa-ext-pin-bar');
  if (!bar) return;
  chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
    if (!pinnedChats.length) {
      bar.innerHTML = '<span style="font-size:11px;color:#8696a0;padding:2px 4px">📌 No pinned chats — add from extension</span>';
      return;
    }
    bar.innerHTML = pinnedChats.map(p => `
      <div data-wa-pin="${escapeHtml(p.phone)}" style="display:inline-flex;align-items:center;gap:4px;background:#2a373f;border-radius:12px;padding:3px 8px 3px 6px;cursor:pointer;font-size:11px;color:#e9edef;max-width:120px;flex-shrink:0">
        <span style="width:16px;height:16px;border-radius:50%;background:#00a884;color:#111b21;font-size:8px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${escapeHtml((p.name||p.phone)[0].toUpperCase())}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${escapeHtml(p.name||p.phone)}</span>
        <span data-wa-unpin="${escapeHtml(p.phone)}" style="color:#8696a0;font-size:11px;flex-shrink:0;padding:0 2px;line-height:1">✕</span>
      </div>`).join('');

    bar.querySelectorAll('[data-wa-pin]').forEach(chip => {
      chip.addEventListener('click', e => {
        if (e.target.closest('[data-wa-unpin]')) return;
        openChatByPhone(chip.dataset.waPin);
      });
    });

    bar.querySelectorAll('[data-wa-unpin]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
          chrome.storage.local.set({ pinnedChats: pinnedChats.filter(p => p.phone !== btn.dataset.waUnpin) });
        });
      });
    });
  });
}

function initPinnedBar() {
  if (document.getElementById('wa-ext-pin-bar')) return;
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  const bar = document.createElement('div');
  bar.id = 'wa-ext-pin-bar';
  bar.style.cssText = 'background:#111b21;border-bottom:1px solid #2a373f;padding:6px 10px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;min-height:34px;box-sizing:border-box';
  pane.insertBefore(bar, pane.firstChild);
  renderPinnedBar();
}

// ─── Pin icon SVG (same as WA's native pin icon) ─────────────────────────────
const _PIN_SVG = `<svg viewBox="0 0 20 20" height="20" width="20" preserveAspectRatio="xMidYMid meet" fill="none"><path d="M13.5 4.5V11L15.2708 12.7708C15.3403 12.8403 15.3958 12.9201 15.4375 13.0104C15.4792 13.1007 15.5 13.2014 15.5 13.3125V13.746C15.5 13.9597 15.4281 14.1388 15.2844 14.2833C15.1406 14.4278 14.9625 14.5 14.75 14.5H10.75V19.125C10.75 19.3375 10.6785 19.5156 10.5356 19.6594C10.3927 19.8031 10.2156 19.875 10.0044 19.875C9.79313 19.875 9.61458 19.8031 9.46875 19.6594C9.32292 19.5156 9.25 19.3375 9.25 19.125V14.5H5.25C5.0375 14.5 4.85938 14.4278 4.71563 14.2833C4.57188 14.1388 4.5 13.9597 4.5 13.746V13.3125C4.5 13.2014 4.52083 13.1007 4.5625 13.0104C4.60417 12.9201 4.65972 12.8403 4.72917 12.7708L6.5 11V4.5H6.25C6.0375 4.5 5.85938 4.42854 5.71563 4.28563C5.57188 4.14271 5.5 3.96563 5.5 3.75438C5.5 3.54313 5.57188 3.36458 5.71563 3.21875C5.85938 3.07292 6.0375 3 6.25 3H13.75C13.9625 3 14.1406 3.07146 14.2844 3.21437C14.4281 3.35729 14.5 3.53437 14.5 3.74562C14.5 3.95687 14.4281 4.13542 14.2844 4.28125C14.1406 4.42708 13.9625 4.5 13.75 4.5H13.5ZM6.625 13H13.375L12 11.625V4.5H8V11.625L6.625 13Z" fill="currentColor"></path></svg>`;

function _getCurrentChatInfo() {
  const name = document.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent?.trim() || '';
  if (!name) return null;
  // Try to grab phone from subtitle (shown for contacts as "+91 98765 43210")
  const subtitle = document.querySelector('[data-testid="conversation-info-header-subtitle"]')?.textContent?.trim() || '';
  const phoneMatch = subtitle.match(/\+?[\d][\d\s\-]{7,}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/[\s\-]/g, '') : name;
  return { name, phone };
}

function _updatePinHeaderBtn() {
  const btn = document.getElementById('wa-ext-pin-btn');
  if (!btn) return;
  const info = _getCurrentChatInfo();
  if (!info) return;
  chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
    const pinned = pinnedChats.some(p => p.name === info.name);
    btn.style.color    = pinned ? '#00a884' : '#8696a0';
    btn.dataset.pinned = pinned ? '1' : '';
    btn.title = pinned ? 'Unpin from extension bar' : 'Pin to extension bar (up to 8)';
  });
}

function initPinHeaderBtn() {
  const info = _getCurrentChatInfo();
  if (!info) return;

  let btn = document.getElementById('wa-ext-pin-btn');
  if (!btn) {
    // Find the container that holds the action buttons in the chat header.
    // Strategy: find any known button inside #main header, then use its parent.
    // Try every known WA Web selector, then fall back to any button/role in header
    const anchor =
      document.querySelector('#main header [data-testid="menu"]') ||
      document.querySelector('#main header [data-testid="search"]') ||
      document.querySelector('#main header [data-testid="audio-call"]') ||
      document.querySelector('#main header [data-testid="video-call"]') ||
      document.querySelector('#main header [aria-label="Menu"]') ||
      document.querySelector('#main header [aria-label="More options"]') ||
      document.querySelector('#main header [aria-label="Search"]') ||
      document.querySelector('#main header [aria-label="Voice call"]') ||
      document.querySelector('#main header [aria-label="Video call"]') ||
      document.querySelector('#main header button') ||
      document.querySelector('#main header [role="button"]') ||
      document.querySelector('#main header > div:last-child > span') ||
      document.querySelector('#main header > div:last-child > div');

    // Hard fallback: append directly onto the header itself
    const container = anchor ? anchor.parentElement : document.querySelector('#main header');
    if (!container) { console.log('[WA-PIN] no header found at all'); return; }
    console.log('[WA-PIN] injecting pin btn, container:', container.tagName, container.className?.slice(0,50));

    btn = document.createElement('button');
    btn.id = 'wa-ext-pin-btn';
    btn.style.cssText = 'background:none;border:none;cursor:pointer;color:#8696a0;padding:8px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;transition:color .2s;flex-shrink:0';
    btn.innerHTML = _PIN_SVG;

    btn.addEventListener('click', () => {
      const cur = _getCurrentChatInfo();
      if (!cur) return;
      chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
        const idx = pinnedChats.findIndex(p => p.name === cur.name);
        if (idx >= 0) {
          pinnedChats.splice(idx, 1);
          chrome.storage.local.set({ pinnedChats });
        } else {
          if (pinnedChats.length >= 8) {
            btn.style.color = '#f15c6d';
            setTimeout(() => _updatePinHeaderBtn(), 1500);
            return;
          }
          pinnedChats.push(cur);
          chrome.storage.local.set({ pinnedChats });
        }
      });
    });

    if (anchor) container.insertBefore(btn, anchor);
    else container.appendChild(btn);
  }

  _updatePinHeaderBtn();
}

// ─── Task Management Panel ────────────────────────────────────────────────────
const TASK_PANEL_ID = 'wa-ext-task-panel';
let _taskPanelFilter = 'today';

function _localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _getTodayStr() { return _localDateStr(new Date()); }
function _getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return _localDateStr(d); }

function _taskDateStr(task) {
  if (task.date === 'today') return _getTodayStr();
  if (task.date === 'tomorrow') return _getTomorrowStr();
  return task.date;
}

function _taskMatchesFilter(task, filter) {
  if (filter === 'done') return task.done;
  if (task.done) return false;
  if (filter === 'today') return _taskDateStr(task) === _getTodayStr();
  if (filter === 'tomorrow') return _taskDateStr(task) === _getTomorrowStr();
  return true; // 'all'
}

function _genTaskId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _setTaskAlarm(task) {
  if (!task.time || task.done) { console.log('[WA-TASK] alarm skipped — no time or done', task.id); return; }
  const dateStr = _taskDateStr(task);
  const when = new Date(dateStr + 'T' + task.time + ':00').getTime();
  console.log('[WA-TASK] alarm when:', new Date(when).toLocaleString(), '| now:', new Date().toLocaleString(), '| future?', when > Date.now());
  if (when <= Date.now()) { console.log('[WA-TASK] alarm skipped — time already passed'); return; }
  chrome.runtime.sendMessage({ type: 'SET_TASK_ALARM', data: { taskId: task.id, title: task.title, when } },
    r => { console.log('[WA-TASK] alarm set response:', r, chrome.runtime.lastError?.message); });
}

function _cancelTaskAlarm(taskId) {
  chrome.runtime.sendMessage({ type: 'CANCEL_TASK_ALARM', data: { taskId } }, () => void chrome.runtime.lastError);
}

function injectTaskStyles() {
  if (document.getElementById('wa-task-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa-task-styles';
  s.textContent = `
    #wa-ext-task-panel {
      display: flex; flex-direction: column; flex: 1;
      width: 100%; height: 100%; background: #0b141a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden; box-sizing: border-box;
    }
    #wa-ext-task-panel .wt-header { padding: 20px 20px 0; flex-shrink: 0; }
    #wa-ext-task-panel .wt-title { font-size: 20px; font-weight: 700; color: #e9edef; margin: 0 0 14px; }
    #wa-ext-task-panel .wt-tabs { display: flex; gap: 4px; margin-bottom: 14px; }
    #wa-ext-task-panel .wt-tab {
      padding: 5px 14px; border-radius: 14px; border: none;
      background: #1f2c34; color: #8696a0; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background .15s, color .15s;
    }
    #wa-ext-task-panel .wt-tab.active { background: #00a884; color: #fff; }
    #wa-ext-task-panel .wt-tab:hover:not(.active) { background: #2a3942; color: #e9edef; }
    #wa-ext-task-panel .wt-add-form {
      padding: 0 20px 12px; flex-shrink: 0; border-bottom: 1px solid #1f2c34;
    }
    #wa-ext-task-panel .wt-form-row { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
    #wa-ext-task-panel .wt-input {
      flex: 1; background: #1f2c34; border: 1px solid #2a3942; border-radius: 8px;
      padding: 7px 10px; color: #e9edef; font-size: 13px; outline: none; min-width: 0;
    }
    #wa-ext-task-panel .wt-input:focus { border-color: #00a884; }
    #wa-ext-task-panel .wt-select {
      background: #1f2c34; border: 1px solid #2a3942; border-radius: 8px;
      padding: 7px 8px; color: #e9edef; font-size: 12px; outline: none; cursor: pointer;
    }
    #wa-ext-task-panel .wt-select:focus { border-color: #00a884; }
    #wa-ext-task-panel .wt-add-btn {
      background: #00a884; border: none; border-radius: 8px; padding: 7px 16px;
      color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0;
      transition: background .15s;
    }
    #wa-ext-task-panel .wt-add-btn:hover { background: #008f72; }
    #wa-ext-task-panel .wt-list { flex: 1; overflow-y: auto; padding: 10px 20px 20px; }
    #wa-ext-task-panel .wt-list::-webkit-scrollbar { width: 4px; }
    #wa-ext-task-panel .wt-list::-webkit-scrollbar-track { background: transparent; }
    #wa-ext-task-panel .wt-list::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 4px; }
    #wa-ext-task-panel .wt-empty { color: #8696a0; font-size: 13px; text-align: center; margin-top: 40px; }
    #wa-ext-task-panel .wt-task-item {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
      border-radius: 10px; background: #1f2c34; margin-bottom: 7px; transition: background .12s;
    }
    #wa-ext-task-panel .wt-task-item:hover { background: #2a3942; }
    #wa-ext-task-panel .wt-task-cb {
      width: 18px; height: 18px; border-radius: 50%; border: 2px solid #8696a0;
      background: transparent; cursor: pointer; flex-shrink: 0; margin-top: 1px;
      display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s;
    }
    #wa-ext-task-panel .wt-task-cb.done { border-color: #00a884; background: #00a884; }
    #wa-ext-task-panel .wt-task-cb.done::after {
      content: ''; width: 8px; height: 5px;
      border-left: 2px solid #fff; border-bottom: 2px solid #fff;
      transform: rotate(-45deg) translate(1px, -1px); display: block;
    }
    #wa-ext-task-panel .wt-task-body { flex: 1; min-width: 0; }
    #wa-ext-task-panel .wt-task-title { font-size: 13px; color: #e9edef; line-height: 1.4; word-break: break-word; }
    #wa-ext-task-panel .wt-task-title.done { text-decoration: line-through; color: #8696a0; }
    #wa-ext-task-panel .wt-task-meta { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
    #wa-ext-task-panel .wt-badge { font-size: 10px; padding: 2px 7px; border-radius: 8px; font-weight: 600; }
    #wa-ext-task-panel .wt-badge-date { background: #2a3942; color: #8696a0; }
    #wa-ext-task-panel .wt-badge-time { background: #1a2c2a; color: #00a884; }
    #wa-ext-task-panel .wt-badge-high   { background: #3d1a1a; color: #f28b82; }
    #wa-ext-task-panel .wt-badge-medium { background: #2d2a14; color: #f9bc2a; }
    #wa-ext-task-panel .wt-badge-low    { background: #1a2c1a; color: #57d17a; }
    #wa-ext-task-panel .wt-task-actions { display: flex; gap: 2px; flex-shrink: 0; }
    #wa-ext-task-panel .wt-action-btn {
      background: none; border: none; cursor: pointer; padding: 5px; border-radius: 6px;
      color: #8696a0; display: flex; align-items: center; justify-content: center;
      transition: color .15s, background .15s; font-size: 13px; line-height: 1;
    }
    #wa-ext-task-panel .wt-action-btn:hover { background: #3b4a54; color: #e9edef; }
    #wa-ext-task-panel .wt-action-btn.alarm-on { color: #00a884; }
  `;
  document.head.appendChild(s);
}

function renderTaskPanel() {
  const panel = document.getElementById(TASK_PANEL_ID);
  if (!panel) return;
  const listEl = panel.querySelector('#wt-task-list');
  if (!listEl) return;

  chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
    const tasks = waTasks.filter(t => _taskMatchesFilter(t, _taskPanelFilter));
    if (!tasks.length) {
      const labels = { today: 'today', tomorrow: 'tomorrow', all: 'pending', done: 'completed' };
      listEl.innerHTML = `<div class="wt-empty">No ${labels[_taskPanelFilter] || _taskPanelFilter} tasks</div>`;
      return;
    }

    tasks.sort((a, b) => {
      const da = _taskDateStr(a) + (a.time || '99:99');
      const db = _taskDateStr(b) + (b.time || '99:99');
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const today = _getTodayStr();
    const tomorrow = _getTomorrowStr();

    listEl.innerHTML = tasks.map(task => {
      const dateStr = _taskDateStr(task);
      const dateLbl = dateStr === today ? 'Today' : dateStr === tomorrow ? 'Tomorrow' : dateStr;
      const prioMap  = { high: 'wt-badge-high', medium: 'wt-badge-medium', low: 'wt-badge-low' };
      const prioLbl  = task.priority ? task.priority[0].toUpperCase() + task.priority.slice(1) : '';
      const alarmTs  = task.time ? new Date(dateStr + 'T' + task.time + ':00').getTime() : 0;
      const hasAlarm = !task.done && alarmTs > Date.now();
      return `
        <div class="wt-task-item" data-task-id="${task.id}">
          <div class="wt-task-cb ${task.done ? 'done' : ''}" data-wt-toggle="${task.id}"></div>
          <div class="wt-task-body">
            <div class="wt-task-title ${task.done ? 'done' : ''}">${escapeHtml(task.title)}</div>
            <div class="wt-task-meta">
              <span class="wt-badge wt-badge-date">${dateLbl}</span>
              ${task.time ? `<span class="wt-badge wt-badge-time">⏰ ${task.time}</span>` : ''}
              ${prioLbl ? `<span class="wt-badge ${prioMap[task.priority] || ''}">${prioLbl}</span>` : ''}
            </div>
          </div>
          <div class="wt-task-actions">
            <button class="wt-action-btn${hasAlarm ? ' alarm-on' : ''}" data-wt-alarm="${task.id}" title="${hasAlarm ? 'Alarm set' : 'No alarm'}">🔔</button>
            <button class="wt-action-btn" data-wt-del="${task.id}" title="Delete">🗑️</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-wt-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.wtToggle;
        chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
          const task = waTasks.find(t => t.id === id);
          if (!task) return;
          task.done = !task.done;
          if (task.done) _cancelTaskAlarm(id);
          else _setTaskAlarm(task);
          chrome.storage.local.set({ waTasks });
        });
      });
    });

    listEl.querySelectorAll('[data-wt-del]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.wtDel;
        _cancelTaskAlarm(id);
        chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
          chrome.storage.local.set({ waTasks: waTasks.filter(t => t.id !== id) });
        });
      });
    });
  });
}

function _isChatOpen() {
  return !!(
    document.getElementById('main') ||
    document.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
    document.querySelector('[data-testid="conversation-compose-box-input"]') ||
    document.querySelector('[data-testid="compose-btn-send"]') ||
    document.querySelector('[data-testid="audio-input-send"]')
  );
}

/**
 * Find the WhatsApp intro / "Download WhatsApp for Windows" section.
 * It lives in the RIGHT pane — never inside #pane-side (sidebar).
 */
function _findIntroSection() {
  // Multiple strategies, most-specific first
  // 1. WA's intro section has a known data-testid in some builds
  const byTestId = document.querySelector('[data-testid="intro-md-beta-message"]');
  if (byTestId) {
    // Walk up to the nearest <section> or full-height container
    let el = byTestId;
    while (el && el.tagName !== 'SECTION' && el.parentElement) el = el.parentElement;
    if (el?.tagName === 'SECTION' && !el.closest('#pane-side')) return el;
  }
  // 2. Any <section> NOT inside the sidebar
  for (const sec of document.querySelectorAll('section')) {
    if (sec.closest('#pane-side')) continue;  // skip sidebar sections
    if (sec.closest('#main'))      continue;  // skip chat-view sections
    if (sec.closest('#wa-ext-task-panel')) continue; // skip our own
    return sec;
  }
  return null;
}

function initTaskPanel() {
  if (document.getElementById(TASK_PANEL_ID)) { renderTaskPanel(); return; }
  if (_isChatOpen()) return;

  const section = _findIntroSection();
  if (!section) { console.log('[WA-TASK] intro section not found'); return; }

  injectTaskStyles();

  // Hide the WA intro screen, insert task panel as sibling
  section.style.display = 'none';
  section.dataset.waTaskHidden = '1';    // flag so we can restore later

  const parent = section.parentElement;
  const panel = document.createElement('div');
  panel.id = TASK_PANEL_ID;
  // Fill the same space the intro section occupied
  panel.style.cssText = `
    display:flex; flex-direction:column; flex:1;
    width:100%; height:100%;
    background:#0b141a; overflow:hidden; z-index:10;
  `;
  panel.innerHTML = `
    <div class="wt-header">
      <div class="wt-title">📋 Tasks</div>
      <div class="wt-tabs">
        <button class="wt-tab${_taskPanelFilter === 'today'    ? ' active' : ''}" data-wt-filter="today">Today</button>
        <button class="wt-tab${_taskPanelFilter === 'tomorrow' ? ' active' : ''}" data-wt-filter="tomorrow">Tomorrow</button>
        <button class="wt-tab${_taskPanelFilter === 'all'      ? ' active' : ''}" data-wt-filter="all">All</button>
        <button class="wt-tab${_taskPanelFilter === 'done'     ? ' active' : ''}" data-wt-filter="done">Done</button>
      </div>
    </div>
    <div class="wt-add-form">
      <div class="wt-form-row">
        <input type="text" class="wt-input" id="wt-new-title" placeholder="New task…" autocomplete="off">
        <button class="wt-add-btn" id="wt-add-btn">Add</button>
      </div>
      <div class="wt-form-row">
        <select class="wt-select" id="wt-new-date">
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="custom">Custom…</option>
        </select>
        <input type="date" class="wt-input" id="wt-new-date-custom" style="display:none;max-width:150px">
        <input type="time" class="wt-select" id="wt-new-time" title="Alarm time (optional)">
        <select class="wt-select" id="wt-new-priority">
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>
    <div class="wt-list" id="wt-task-list"></div>
  `;

  // Insert right after the hidden section (same position in parent)
  section.insertAdjacentElement('afterend', panel);

  // Tab switching
  panel.querySelectorAll('[data-wt-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      _taskPanelFilter = tab.dataset.wtFilter;
      panel.querySelectorAll('[data-wt-filter]').forEach(t =>
        t.classList.toggle('active', t.dataset.wtFilter === _taskPanelFilter)
      );
      renderTaskPanel();
    });
  });

  // Custom date toggle
  const dateSelect = panel.querySelector('#wt-new-date');
  const dateCustom = panel.querySelector('#wt-new-date-custom');
  dateSelect.addEventListener('change', () => {
    dateCustom.style.display = dateSelect.value === 'custom' ? '' : 'none';
    if (dateSelect.value === 'custom' && !dateCustom.value) dateCustom.value = _getTodayStr();
  });

  // Add task
  const doAddTask = () => {
    const titleEl = panel.querySelector('#wt-new-title');
    const title   = titleEl.value.trim();
    if (!title) return;
    const dateVal    = dateSelect.value === 'custom' ? (dateCustom.value || _getTodayStr()) : dateSelect.value;
    const time       = panel.querySelector('#wt-new-time').value || '';
    const priority   = panel.querySelector('#wt-new-priority').value || 'medium';
    const task = { id: _genTaskId(), title, date: dateVal, time, priority, done: false, createdAt: Date.now() };
    chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
      waTasks.push(task);
      chrome.storage.local.set({ waTasks }, () => {
        _setTaskAlarm(task);
        titleEl.value = '';
      });
    });
  };

  panel.querySelector('#wt-add-btn').addEventListener('click', doAddTask);
  panel.querySelector('#wt-new-title').addEventListener('keydown', e => { if (e.key === 'Enter') doAddTask(); });

  console.log('[WA-TASK] panel injected — replaced intro section');
  renderTaskPanel();
}

function _removeTaskPanel() {
  const p = document.getElementById(TASK_PANEL_ID);
  if (p) p.remove();
  // Restore any hidden intro sections
  document.querySelectorAll('[data-wa-task-hidden="1"]').forEach(sec => {
    sec.style.display = '';
    delete sec.dataset.waTaskHidden;
  });
}

function _syncTaskPanel() {
  const chatOpen = _isChatOpen();
  if (chatOpen) {
    _removeTaskPanel();
  } else if (!document.getElementById(TASK_PANEL_ID)) {
    const sec = _findIntroSection();
    console.log('[WA-TASK] _syncTaskPanel — chatOpen:', chatOpen, 'section:', !!sec, 'panel:', !!document.getElementById(TASK_PANEL_ID));
    if (sec) initTaskPanel();
  }
}

// ─── Single observer: re-inject pin bar + pin header button ──────────────────
let _pinBtnLastChat = '';
let _lastChatOpenState = null;
const _pinBarObserver = new MutationObserver(() => {
  // Re-inject bar if WA re-renders #pane-side
  if (document.querySelector('#pane-side') && !document.getElementById('wa-ext-pin-bar')) {
    initPinnedBar();
  }
  // Inject / refresh header pin button when chat opens or changes
  const curChat = document.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent?.trim() || '';
  if (curChat && (!document.getElementById('wa-ext-pin-btn') || curChat !== _pinBtnLastChat)) {
    _pinBtnLastChat = curChat;
    initPinHeaderBtn();
  }
  // Task panel: remove when chat opens (state-change only)
  const chatOpenNow = _isChatOpen();
  if (_lastChatOpenState !== chatOpenNow) {
    _lastChatOpenState = chatOpenNow;
    if (chatOpenNow) {
      _removeTaskPanel();
      console.log('[WA-TASK] chat opened, panel removed');
    }
  }
  // Continuously retry injection: no chat + intro section present + panel missing
  if (!chatOpenNow && !document.getElementById(TASK_PANEL_ID)) {
    const sec = _findIntroSection();
    if (sec) {
      console.log('[WA-TASK] injecting task panel (intro section found)');
      initTaskPanel();
    }
  }
});
_pinBarObserver.observe(document.body, { childList: true, subtree: true });
initPinnedBar();
console.log('[WA-TASK] content script ready — observer active');

// Live-sync: update both bar, header button, and task list when storage changes
chrome.storage.onChanged.addListener(changes => {
  if (changes.pinnedChats) { renderPinnedBar(); _updatePinHeaderBtn(); }
  if (changes.waTasks)     { renderTaskPanel(); }
});

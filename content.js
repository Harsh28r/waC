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

    const sendBtn = findEl(SEL.sendButton);
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
    badge.textContent = '🔒 Privacy Mode ON';
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
  const composeSelectors = [
    'footer div[contenteditable="true"]',
    '#main footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="1"]',
    '[data-testid="conversation-compose-box-input"]'
  ];

  let input = null;
  for (const s of composeSelectors) {
    input = document.querySelector(s);
    if (input) break;
  }
  if (!input) return false;

  input.focus();
  await sleep(200);
  document.execCommand('insertText', false, text);
  await sleep(600);

  const result = await clickSend();
  return result.success;
}

// ─── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CLICK_SEND') {
    clickSend().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
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

  if (msg.type === 'PING') {
    sendResponse({ ready: true });
    return false;
  }
});

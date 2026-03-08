// content.js — Injected into web.whatsapp.com v2.0

// ─── Selectors ────────────────────────────────────────────────────────────────
const SEL = {
  sendButton: [
    'button[data-testid="compose-btn-send"]',
    '[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'span[data-icon="send"]',
    'span[data-icon="send-light"]'
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
    '[data-testid="selectable-text"]',
    '.selectable-text.copyable-text',
    'span.selectable-text',
    '.copyable-text span',
    '.copyable-text',
    '[class*="selectable-text"]',
    '[class*="copyable-text"]'
  ],
  qrCode: ['canvas[aria-label]', '[data-testid="qrcode"]'],
  invalidDialog: ['[data-animate-modal-popup]', '[data-testid="popup-contents"]'],
  attachBtn: [
    'footer [data-testid="clip"]',
    'footer [data-testid="attach-menu-plus"]',
    'footer span[data-icon="attach-menu-plus"]',
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

// Find first element matching predicate in document and all shadow roots (for WA Web's React/drawer)
function findInDocumentAndShadowRoots(predicate, root = document) {
  if (!root) return null;
  const walk = (node) => {
    if (predicate(node)) return node;
    const children = node.children || node.querySelectorAll ? Array.from(node.children || []) : [];
    for (let i = 0; i < children.length; i++) {
      const found = walk(children[i]);
      if (found) return found;
    }
    if (node.shadowRoot) {
      const found = walk(node.shadowRoot);
      if (found) return found;
    }
    return null;
  };
  const start = root.body || root;
  return walk(start);
}

function findElIncludingShadow(selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const s of list) {
    try {
      const el = document.querySelector(s) || findInDocumentAndShadowRoots(el => el.matches && el.matches(s));
      if (el) return el;
    } catch (_) {}
  }
  return null;
}

async function waitForElIncludingShadow(selectors, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = findElIncludingShadow(selectors);
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

// ─── Open Chat by Name (groups + contacts via sidebar search) ─────────────────
async function openChatByName(name) {
  if (findEl(SEL.qrCode)) return { success: false, error: 'WA Web not logged in — scan QR first' };

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  await sleep(400);

  const searchInput = await waitForEl(SEL.searchInput, 6000);
  if (!searchInput) return { success: false, error: 'Search input not found' };

  searchInput.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(200);
  document.execCommand('insertText', false, name);
  await sleep(2200);

  // Try exact name match first
  const rows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  for (const row of rows) {
    const rowName = row.querySelector('[data-testid="cell-frame-title"]')?.textContent?.trim() || '';
    if (rowName.toLowerCase() === name.toLowerCase()) {
      row.click();
      await sleep(600);
      return { success: true };
    }
  }
  // Fallback: click first result
  const first = document.querySelector('[data-testid="cell-frame-container"]');
  if (!first) return { success: false, error: 'Chat not found: ' + name };
  first.click();
  await sleep(600);
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

// ─── Send Image or Video from base64 data with caption ───────────────────────
const WA_MEDIA_DEBUG = true; // set false to silence
function _mediaLog(...a) { if (WA_MEDIA_DEBUG) console.warn('[WA-MEDIA]', ...a); }

async function sendImageWithCaption(imageData, imageMime, imageName, caption) {
  _mediaLog('sendImageWithCaption start, dataLen:', (imageData || '').length);
  if (findEl(SEL.qrCode)) return { success: false, error: 'WA Web not logged in — scan QR first' };

  const header = await waitForEl(['#main header', '#main [data-testid="conversation-header"]'], 12000);
  if (!header) { _mediaLog('FAIL: chat header not found'); return { success: false, error: 'Chat did not open' }; }
  _mediaLog('chat open');
  await sleep(800);

  const mime = imageMime || 'image/jpeg';
  const isVideo = mime.startsWith('video/');
  const defaultName = imageName || (isVideo ? 'video.mp4' : 'image.jpg');

  const commaIdx = (imageData || '').indexOf(',');
  const base64 = commaIdx >= 0 ? (imageData || '').slice(commaIdx + 1).trim() : (imageData || '').trim();
  if (!base64) return { success: false, error: 'Invalid media data' };
  let binary;
  try { binary = atob(base64.replace(/\s/g, '')); } catch (e) { _mediaLog('FAIL: atob', e); return { success: false, error: 'Invalid file data' }; }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([new Blob([bytes], { type: mime })], defaultName, { type: mime });
  _mediaLog('file created', defaultName, file.size, 'bytes');

  const attachBtn = findEl(SEL.attachBtn);
  if (!attachBtn) { _mediaLog('FAIL: attach button not found'); return { success: false, error: 'Attach button not found' }; }
  _mediaLog('attach btn found, clicking');
  attachBtn.click();
  await sleep(1200);

  const acceptImageOrVideo = (el) => el.type === 'file' && (!el.accept || /image|video/.test(el.accept));
  const findFileInput = () => {
    const inDrawer = (sel) => { const d = document.querySelector(sel); return d ? d.querySelector('input[type="file"]') : null; };
    return findInDocumentAndShadowRoots(el => el.tagName === 'INPUT' && acceptImageOrVideo(el)) ||
      document.querySelector(SEL.imageInput) ||
      document.querySelector('footer input[accept*="image"]') ||
      document.querySelector('footer input[accept*="video"]') ||
      inDrawer('[data-testid="drawer-right"]') || inDrawer('[role="dialog"]') || inDrawer('[class*="drawer"]') ||
      document.querySelector('#main input[accept*="image"]') ||
      document.querySelector('#main input[accept*="video"]') ||
      document.querySelector('input[accept*="image"]') ||
      document.querySelector('input[accept*="video"]') ||
      findInDocumentAndShadowRoots(el => el.tagName === 'INPUT' && el.type === 'file') ||
      document.querySelector('#main input[type="file"]') ||
      document.querySelector('input[type="file"]');
  };
  let fileInput = findFileInput();
  for (let i = 0; !fileInput && i < 8; i++) {
    await sleep(400);
    fileInput = findFileInput();
  }
  if (!fileInput) { _mediaLog('FAIL: file input not found'); return { success: false, error: 'File input not found — try again' }; }
  _mediaLog('file input found, setting files');

  fileInput.focus?.();
  fileInput.value = '';
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(isVideo ? 5000 : 3000);

  // Step 3: Wait for media preview (caption area or send button)
  const captionSelectors = [
    '[data-testid="media-caption-input-container"] div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="11"]',
    '#main div[contenteditable="true"]'
  ];
  let captionEl = null;
  for (const sel of captionSelectors) {
    captionEl = document.querySelector(sel);
    if (captionEl && captionEl.closest('#main')) break;
  }
  if (!captionEl) await sleep(2000);

  if (caption && String(caption).trim()) {
    captionEl = captionEl || document.querySelector('[data-testid="media-caption-input-container"] div[contenteditable]') || document.querySelector('div[contenteditable][data-tab="11"]');
    if (captionEl) {
      captionEl.focus();
      await sleep(400);
      await insertMessageText(captionEl, String(caption).trim());
      await sleep(500);
    }
  }

  const sendBtn = await waitForElIncludingShadow(SEL.sendButton, 12000);
  if (!sendBtn) { _mediaLog('FAIL: send button not found after media attach'); return { success: false, error: 'Send button not found — is media preview open?' }; }
  _mediaLog('send btn found, clicking');
  sendBtn.click();
  await sleep(1500);
  _mediaLog('done');
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
let arLastIncomingByChat = {};
let arRepliedAtByChat    = {};
let arPerChatPollerTimer = null;
let arPollTimer = null;
const AR_PER_CHAT_COOLDOWN_MS = 45000;
const AR_POLL_INTERVAL_MS = 3000;

function getCurrentChatKey() {
  const info = typeof _getCurrentChatInfo === 'function' ? _getCurrentChatInfo() : null;
  if (info?.name) return info.name;
  const title = document.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent?.trim()
    || document.querySelector('#main header span[dir="auto"]')?.textContent?.trim() || '';
  return title;
}

function getMessageText(el) {
  for (const s of SEL.msgText) {
    const nodes = el.querySelectorAll(s);
    for (const t of nodes) {
      const txt = (t.innerText || t.textContent || '').trim();
      if (txt && txt.length > 0) return txt;
    }
  }
  const copyable = el.querySelector('[class*="copyable"]');
  if (copyable) {
    const txt = (copyable.innerText || copyable.textContent || '').trim();
    if (txt) return txt;
  }
  const fallback = (el.innerText || el.textContent || '').trim();
  return fallback || null;
}

function getIncomingMessageContainers() {
  const main = document.querySelector('#main');
  if (!main) return [];
  const all = main.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out');
  const bubbles = [];
  const seen = new Set();
  for (const el of all) {
    const root = el.closest('.message-in, .message-out') || el;
    if (seen.has(root)) continue;
    seen.add(root);
    const isIn = root.classList.contains('message-in') || root.closest('.message-in');
    const isOut = root.classList.contains('message-out') || root.closest('.message-out');
    if (isOut) continue;
    if (isIn) { bubbles.push(root); continue; }
    const hasOutgoing = SEL.outgoingIndicator.some(s => root.querySelector(s));
    if (!hasOutgoing) bubbles.push(root);
  }
  return bubbles;
}

/** Last N messages in order (oldest first): { role: 'user'|'assistant', text } — user = them, assistant = me */
function getRecentChatHistory(maxMessages = 12) {
  const all = document.querySelectorAll('[data-testid="msg-container"], .message-in, .message-out');
  const list = [];
  for (const el of all) {
    const txt = getMessageText(el);
    if (!txt || txt.length > 500) continue;
    const isOut = el.classList.contains('message-out') || SEL.outgoingIndicator.some(s => el.querySelector(s));
    list.push({ role: isOut ? 'assistant' : 'user', text: txt });
  }
  const slice = list.slice(-maxMessages);
  return slice;
}

async function startAutoReply(config) {
  stopAutoReply();
  autoReplyConfig = config;

  const chatMain = document.querySelector('#main');
  if (!config.perChat && !chatMain) return { success: false, error: 'No chat open — open a WhatsApp conversation first' };

  if (chatMain) {
    const existing = getIncomingMessageContainers();
    arLastIncoming = existing.length ? getMessageText(existing[existing.length - 1]) : null;
    autoReplyObserver = new MutationObserver(() => {
      clearTimeout(arCheckTimer);
      arCheckTimer = setTimeout(checkAndReply, 800);
    });
    autoReplyObserver.observe(chatMain, { childList: true, subtree: true });
    arPollTimer = setInterval(checkAndReply, AR_POLL_INTERVAL_MS);
  }

  if (config.perChat) {
    arPerChatPollerTimer = setInterval(perChatPollUnread, 6000);
  }
  return { success: true };
}

async function perChatPollUnread() {
  if (!autoReplyConfig?.perChat || arReplying) return;
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  const rows = getVisibleChatRows();
  for (const row of rows) {
    if (!rowMatchesFilter(row, 'unread')) continue;
    const name = getChatName(row);
    if (!name) continue;
    if (arRepliedAtByChat[name] && (Date.now() - arRepliedAtByChat[name] < AR_PER_CHAT_COOLDOWN_MS)) continue;
    row.click();
    await sleep(1500);
    await checkAndReply();
    break;
  }
}

function stopAutoReply() {
  if (autoReplyObserver) { autoReplyObserver.disconnect(); autoReplyObserver = null; }
  clearTimeout(arCheckTimer);
  if (arPerChatPollerTimer) { clearInterval(arPerChatPollerTimer); arPerChatPollerTimer = null; }
  if (arPollTimer) { clearInterval(arPollTimer); arPollTimer = null; }
  autoReplyConfig = null;
  arLastIncoming  = null;
  arReplying      = false;
  arLastIncomingByChat = {};
  arRepliedAtByChat    = {};
}

async function checkAndReply() {
  if (!autoReplyConfig || arReplying) return;

  if (autoReplyConfig.perChat) {
    const key = getCurrentChatKey();
    if (key) arLastIncoming = arLastIncomingByChat[key] ?? null;
  }

  const incoming = getIncomingMessageContainers();
  if (!incoming.length) return;

  const last = incoming[incoming.length - 1];
  const text = getMessageText(last);
  if (!text || text === arLastIncoming) return;

  // Keyword filter: if message doesn't match, either skip or reply (fixed text or AI)
  let usedNoKeywordReply = false; // true = message had no keyword; we still reply (fixed or AI)
  if (autoReplyConfig.keyword) {
    const keywords = autoReplyConfig.keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (!keywords.some(kw => text.toLowerCase().includes(kw))) {
      const noKeywordReply = (autoReplyConfig.noKeywordReply || '').trim();
      const noKeywordUseAI = !!autoReplyConfig.noKeywordUseAI;
      if (!noKeywordReply && !noKeywordUseAI) {
        arLastIncoming = text;
        if (autoReplyConfig.perChat) { const k = getCurrentChatKey(); if (k) arLastIncomingByChat[k] = text; }
        return;
      }
      usedNoKeywordReply = true;
    }
  }

  arLastIncoming = text;
  if (autoReplyConfig.perChat) { const k = getCurrentChatKey(); if (k) arLastIncomingByChat[k] = text; }
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
      if (autoReplyConfig.perChat) { const k = getCurrentChatKey(); if (k) arRepliedAtByChat[k] = Date.now(); }
      chrome.runtime.sendMessage({ type: 'AUTO_REPLY_LOG', data: { incoming: text, reply: outsideMsg, success: sent, ts: Date.now(), bizHours: true } });
      arReplying = false;
      return;
    }
  }

  let replyText;
  const noKeywordUseAI = !!autoReplyConfig.noKeywordUseAI;
  const chatHistory = getRecentChatHistory(12);

  if (usedNoKeywordReply && noKeywordUseAI) {
    const r = await new Promise(res =>
      chrome.runtime.sendMessage({ type: 'GET_AI_AUTO_REPLY', data: { text, prompt: autoReplyConfig.prompt, apiKey: autoReplyConfig.apiKey, provider: autoReplyConfig.provider, chatHistory } }, res)
    );
    replyText = (r && r.reply && r.reply.trim()) ? r.reply.trim() : ((autoReplyConfig.noKeywordReply || '').trim() || 'How can I help you?');
    if (!r?.reply && r?.error) console.warn('[WA] AI auto-reply (no-keyword):', r.error);
  } else if (usedNoKeywordReply && (autoReplyConfig.noKeywordReply || '').trim()) {
    replyText = (autoReplyConfig.noKeywordReply || '').trim();
  } else if (autoReplyConfig.mode === 'template') {
    replyText = autoReplyConfig.template || 'Thanks for your message!';
  } else {
    const r = await new Promise(res =>
      chrome.runtime.sendMessage({ type: 'GET_AI_AUTO_REPLY', data: { text, prompt: autoReplyConfig.prompt, apiKey: autoReplyConfig.apiKey, provider: autoReplyConfig.provider, chatHistory } }, res)
    );
    replyText = (r && r.reply && r.reply.trim()) ? r.reply.trim() : (autoReplyConfig.template || 'Thanks for your message! I\'ll get back to you soon.');
    if (!r?.reply && r?.error) console.warn('[WA] AI auto-reply:', r.error);
  }

  const sent = await typeAndSend(replyText);
  if (autoReplyConfig.perChat) { const k = getCurrentChatKey(); if (k) arRepliedAtByChat[k] = Date.now(); }
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
  script.src = chrome.runtime.getURL('audio-interceptor.js');
  script.onload = function() { script.remove(); };
  (document.head || document.documentElement).appendChild(script);

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
      width: 28px; height: 28px;
      border-radius: 50%;
      background: #233138;
      border: 1px solid #3b4a54;
      color: #aebac1;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      z-index: 2147483646;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.15s, visibility 0.15s, background 0.1s, color 0.1s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    #wa-hover-reply.whr-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    #wa-hover-reply:hover {
      background: #00a884;
      color: #fff;
      border-color: #00a884;
    }
    #wa-hover-reply::after {
      content: var(--whr-tip, 'Reply');
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

    /* ── Chat Pin Button (right side of each chat row) ── */
    .wa-pin-btn {
      position: absolute;
      right: 10px; top: 50%; transform: translateY(-50%);
      height: 26px;
      background: rgba(17,27,33,.9); border: none; border-radius: 13px;
      cursor: pointer; padding: 0 8px 0 6px; z-index: 5;
      color: #8696a0;
      font-size: 11px; font-weight: 600; letter-spacing: .3px;
      display: flex; align-items: center; justify-content: center; gap: 4px;
      flex-shrink: 0;
      opacity: 0;
      pointer-events: all !important;
      transition: opacity .15s, color .15s, background .15s;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,.35);
    }
    .wa-pin-btn.wa-pin-visible { opacity: 1; }
    .wa-pin-btn.pinned { opacity: 1 !important; color: #00a884 !important; background: rgba(0,168,132,.15) !important; }
    .wa-pin-btn:hover  { color: #00a884 !important; background: rgba(0,168,132,.25) !important; }
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

// ─── Open Unknown Chat (chat with unsaved number) ────────────────────────────
const WA_FLAG_CDN = 'https://flagcdn.com/w40';
const WA_COUNTRY_CODES = [
  { code: '91', dial: '+91', iso: 'in' }, { code: '1', dial: '+1', iso: 'us' },
  { code: '44', dial: '+44', iso: 'gb' }, { code: '81', dial: '+81', iso: 'jp' },
  { code: '86', dial: '+86', iso: 'cn' }, { code: '49', dial: '+49', iso: 'de' },
  { code: '33', dial: '+33', iso: 'fr' }, { code: '61', dial: '+61', iso: 'au' },
  { code: '55', dial: '+55', iso: 'br' }, { code: '52', dial: '+52', iso: 'mx' },
  { code: '39', dial: '+39', iso: 'it' }, { code: '34', dial: '+34', iso: 'es' },
  { code: '971', dial: '+971', iso: 'ae' }, { code: '966', dial: '+966', iso: 'sa' },
  { code: '65', dial: '+65', iso: 'sg' }, { code: '60', dial: '+60', iso: 'my' },
  { code: '62', dial: '+62', iso: 'id' }, { code: '63', dial: '+63', iso: 'ph' },
  { code: '92', dial: '+92', iso: 'pk' }, { code: '880', dial: '+880', iso: 'bd' },
  { code: '94', dial: '+94', iso: 'lk' }, { code: '977', dial: '+977', iso: 'np' },
  { code: '234', dial: '+234', iso: 'ng' }, { code: '27', dial: '+27', iso: 'za' },
  { code: '254', dial: '+254', iso: 'ke' }, { code: '20', dial: '+20', iso: 'eg' },
  { code: '90', dial: '+90', iso: 'tr' }, { code: '31', dial: '+31', iso: 'nl' },
  { code: '48', dial: '+48', iso: 'pl' }, { code: '351', dial: '+351', iso: 'pt' },
];

function injectUnknownChatStyles() {
  if (document.getElementById('wa-unk-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa-unk-styles';
  s.textContent = `
    #wa-unk-fab {
      position: absolute;
      bottom: 18px;
      right: 18px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #00a884;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,.35);
      z-index: 1000;
      transition: transform .15s, background .15s;
    }
    #wa-unk-fab:hover { background: #06cf9c; transform: scale(1.08); }
    #wa-unk-fab:active { transform: scale(0.95); }
    #wa-unk-fab svg { pointer-events: none; }

    #wa-unk-panel {
      position: absolute;
      bottom: 76px;
      right: 18px;
      width: 300px;
      background: #1f2c34;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,.45);
      z-index: 1001;
      padding: 0;
      overflow: hidden;
      animation: unkSlideUp .2s ease;
    }
    @keyframes unkSlideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .wa-unk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid #2a3942;
    }
    .wa-unk-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #e9edef;
    }
    .wa-unk-close {
      background: none;
      border: none;
      color: #8696a0;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s;
    }
    .wa-unk-close:hover { background: #2a3942; color: #e9edef; }
    .wa-unk-body {
      padding: 16px;
    }
    .wa-unk-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .wa-unk-cc, .wa-unk-country {
      width: 82px;
      flex-shrink: 0;
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      color: #e9edef;
      font-size: 12px;
      padding: 6px 4px;
      outline: none;
      transition: border-color .15s;
      cursor: pointer;
    }
    .wa-unk-flag {
      width: 32px; height: 22px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      background: #2a3942; border: 1px solid #3b4a54; border-radius: 4px;
      overflow: hidden;
    }
    .wa-unk-flag-img { width: 100%; height: 100%; object-fit: cover; }
    .wa-unk-recent-item .wa-unk-flag-img { width: 18px; height: 12px; vertical-align: middle; margin-right: 4px; }
    .wa-unk-country option { font-size: 12px; padding: 4px; }
    .wa-unk-country:focus, .wa-unk-cc:focus { border-color: #00a884; }
    .wa-unk-phone {
      flex: 1;
      min-width: 0;
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      color: #e9edef;
      font-size: 14px;
      padding: 10px 12px;
      outline: none;
      transition: border-color .15s;
    }
    .wa-unk-phone:focus { border-color: #00a884; }
    .wa-unk-phone::placeholder { color: #8696a0; }
    .wa-unk-msg {
      width: 100%;
      background: #2a3942;
      border: 1px solid #3b4a54;
      border-radius: 8px;
      color: #e9edef;
      font-size: 13px;
      padding: 10px 12px;
      outline: none;
      resize: none;
      height: 60px;
      margin-bottom: 12px;
      transition: border-color .15s;
      box-sizing: border-box;
    }
    .wa-unk-msg:focus { border-color: #00a884; }
    .wa-unk-msg::placeholder { color: #8696a0; }
    .wa-unk-submit {
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      border: none;
      background: #00a884;
      color: #111b21;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, transform .1s;
    }
    .wa-unk-submit:hover { background: #06cf9c; }
    .wa-unk-submit:active { transform: scale(0.97); }
    .wa-unk-submit:disabled { opacity: .5; cursor: not-allowed; }
    .wa-unk-hint {
      font-size: 11px;
      color: #8696a0;
      margin-top: 8px;
      text-align: center;
    }
    .wa-unk-recent {
      border-top: 1px solid #2a3942;
      padding: 10px 16px;
      max-height: 120px;
      overflow-y: auto;
    }
    .wa-unk-recent-title {
      font-size: 11px;
      color: #8696a0;
      text-transform: uppercase;
      letter-spacing: .5px;
      margin-bottom: 6px;
    }
    .wa-unk-recent-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background .15s;
      color: #e9edef;
      font-size: 13px;
    }
    .wa-unk-recent-item:hover { background: #2a3942; }
    .wa-unk-recent-del {
      background: none;
      border: none;
      color: #8696a0;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .wa-unk-recent-del:hover { color: #f15c6d; }
  `;
  document.head.appendChild(s);
}

function injectUnknownChatFab() {
  injectUnknownChatStyles();
  const side = document.getElementById('side');
  if (!side) return;
  // Make side relative for FAB positioning
  if (getComputedStyle(side).position === 'static') side.style.position = 'relative';
  if (document.getElementById('wa-unk-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'wa-unk-fab';
  fab.title = 'Chat with unsaved number';
  fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 00-1.02.24l-2.2 2.2a15.05 15.05 0 01-6.59-6.58l2.2-2.2a1 1 0 00.25-1.03A11.36 11.36 0 018.5 4a1 1 0 00-1-1H4a1 1 0 00-1 1 17 17 0 0017 17 1 1 0 001-1v-3.5a1 1 0 00-1-1z" fill="#111b21"/>
    <path d="M15 3h2v3h3v2h-3v3h-2V8h-3V6h3V3z" fill="#111b21"/>
  </svg>`;
  fab.addEventListener('click', e => {
    e.stopPropagation();
    toggleUnknownChatPanel();
  });
  side.appendChild(fab);
}

function toggleUnknownChatPanel() {
  const existing = document.getElementById('wa-unk-panel');
  if (existing) { existing.remove(); return; }
  openUnknownChatPanel();
}

function openUnknownChatPanel() {
  if (document.getElementById('wa-unk-panel')) return;
  const side = document.getElementById('side');
  if (!side) return;

  const panel = document.createElement('div');
  panel.id = 'wa-unk-panel';

  chrome.runtime.sendMessage({ type: 'GET_FLAG_URLS' }, (flagUrls) => {
    const urls = flagUrls || {};
    const flagSrc = (iso) => urls[iso] || (WA_FLAG_CDN + '/' + iso + '.png');

    chrome.storage.local.get('unkRecentNums', ({ unkRecentNums = [] }) => {
      panel.innerHTML = `
      <div class="wa-unk-header">
        <h3>💬 Chat with Number</h3>
        <button class="wa-unk-close" id="wa-unk-close-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      <div class="wa-unk-body">
        <div class="wa-unk-row">
          <span class="wa-unk-flag" id="wa-unk-flag" title="Country"><img src="${flagSrc('in')}" alt="" class="wa-unk-flag-img"></span>
          <select class="wa-unk-country" id="wa-unk-cc" title="Country">${WA_COUNTRY_CODES.map(c => `<option value="${c.code}" ${c.code === '91' ? 'selected' : ''}>${c.dial}</option>`).join('')}</select>
          <input class="wa-unk-phone" id="wa-unk-phone" placeholder="10-digit number" autocomplete="tel" maxlength="10" inputmode="numeric" />
        </div>
        <textarea class="wa-unk-msg" id="wa-unk-msg" placeholder="Message (optional)"></textarea>
        <button class="wa-unk-submit" id="wa-unk-go">Open Chat</button>
        <div class="wa-unk-hint">No need to save contact — just type and go</div>
      </div>
      ${unkRecentNums.length ? `
        <div class="wa-unk-recent">
          <div class="wa-unk-recent-title">Recent</div>
          ${unkRecentNums.map((r, i) => {
            const info = WA_COUNTRY_CODES.find(c => c.dial === r.cc || c.code === (r.cc || '').replace('+', ''));
            const iso = r.iso || (info && info.iso) || 'in';
            return `
            <div class="wa-unk-recent-item" data-idx="${i}" data-num="${r.full}">
              <span><img src="${flagSrc(iso)}" alt="" class="wa-unk-flag-img"> ${r.cc} ${r.phone}</span>
              <button class="wa-unk-recent-del" data-delidx="${i}">&times;</button>
            </div>
          `; }).join('')}
        </div>
      ` : ''}
    `;
      side.appendChild(panel);

      const ccInput    = panel.querySelector('#wa-unk-cc');
      const phoneInput = panel.querySelector('#wa-unk-phone');
      const msgInput   = panel.querySelector('#wa-unk-msg');
      const goBtn      = panel.querySelector('#wa-unk-go');
      const closeBtn   = panel.querySelector('#wa-unk-close-btn');
      const flagSpan   = panel.querySelector('#wa-unk-flag');

      ccInput.addEventListener('change', () => {
        const c = WA_COUNTRY_CODES.find(x => x.code === ccInput.value);
        if (flagSpan && c) {
          let img = flagSpan.querySelector('.wa-unk-flag-img');
          const src = flagSrc(c.iso);
          if (img) img.src = src;
          else flagSpan.innerHTML = `<img src="${src}" alt="" class="wa-unk-flag-img">`;
        }
      });

      phoneInput.focus();

    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });

    closeBtn.addEventListener('click', () => panel.remove());

    goBtn.addEventListener('click', () => _openUnknownChat(ccInput, phoneInput, msgInput, panel));

    // Enter to submit
    phoneInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') _openUnknownChat(ccInput, phoneInput, msgInput, panel);
    });
    msgInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _openUnknownChat(ccInput, phoneInput, msgInput, panel);
      }
    });

    // Recent clicks
    panel.querySelectorAll('.wa-unk-recent-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.classList.contains('wa-unk-recent-del')) return;
        const num = item.dataset.num;
        window.open(`https://web.whatsapp.com/send?phone=${num}`, '_self');
        panel.remove();
      });
    });

    // Recent delete
    panel.querySelectorAll('.wa-unk-recent-del').forEach(del => {
      del.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(del.dataset.delidx);
        chrome.storage.local.get('unkRecentNums', ({ unkRecentNums = [] }) => {
          unkRecentNums.splice(idx, 1);
          chrome.storage.local.set({ unkRecentNums });
          panel.remove();
          openUnknownChatPanel();
        });
      });
    });
    });
  });
}

function _openUnknownChat(ccInput, phoneInput, msgInput, panel) {
  const cc    = (ccInput.value || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  const phone = (phoneInput.value || '').replace(/\D/g, '');
  const full  = cc + phone;
  const digits = full.replace(/\D/g, '');
  if (digits.length < 10) {
    phoneInput.style.borderColor = '#f15c6d';
    phoneInput.focus();
    phoneInput.title = 'Include country code (min 10 digits)';
    setTimeout(() => { phoneInput.style.borderColor = ''; phoneInput.title = ''; }, 2000);
    return;
  }
  if (digits.length > 15) {
    phoneInput.style.borderColor = '#f15c6d';
    phoneInput.focus();
    phoneInput.title = 'Max 15 digits';
    setTimeout(() => { phoneInput.style.borderColor = ''; phoneInput.title = ''; }, 2000);
    return;
  }
  if (digits.startsWith('0')) {
    phoneInput.style.borderColor = '#f15c6d';
    phoneInput.focus();
    phoneInput.title = 'Use country code (e.g. 91), not leading 0';
    setTimeout(() => { phoneInput.style.borderColor = ''; phoneInput.title = ''; }, 2000);
    return;
  }
  const msg  = msgInput.value.trim();

  const countryInfo = WA_COUNTRY_CODES.find(c => c.code === cc) || {};
  const ccDisplay = countryInfo.dial || ('+' + cc);
  const isoDisplay = countryInfo.iso || '';
  chrome.storage.local.get('unkRecentNums', ({ unkRecentNums = [] }) => {
    unkRecentNums = unkRecentNums.filter(r => r.full !== full);
    unkRecentNums.unshift({ cc: ccDisplay, phone: phoneInput.value, full, iso: isoDisplay });
    if (unkRecentNums.length > 10) unkRecentNums = unkRecentNums.slice(0, 10);
    chrome.storage.local.set({ unkRecentNums });
  });

  let url = `https://web.whatsapp.com/send?phone=${full}`;
  if (msg) url += `&text=${encodeURIComponent(msg)}`;
  window.open(url, '_self');
  panel.remove();
}

// Poll every 400ms — meeting bar + transcribe buttons + translate buttons + label bar + audio interceptor
injectAudioInterceptor(); // run immediately on load
const _mainPollInterval = setInterval(() => {
  // Stop polling if extension was reloaded/invalidated
  if (!chrome.runtime?.id) { clearInterval(_mainPollInterval); return; }
  try {
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
    syncNativePinsToStorage();
    injectAudioInterceptor();
    injectUnknownChatFab();
  } catch (e) {
    if (e.message?.includes('Extension context invalidated')) clearInterval(_mainPollInterval);
  }
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
      <button class="wa-label-chip" data-filter="unread">Unread</button>
      <button class="wa-label-chip" data-filter="one-to-one">One to One</button>
      <button class="wa-label-chip" data-filter="groups">Groups</button>
      <button class="wa-label-chip" data-filter="waiting">⏳ Awaiting Reply</button>
      <button class="wa-label-chip" data-filter="mentions">@ Mentions</button>
    `;
    document.body.appendChild(bar);

    bar.querySelectorAll('.wa-label-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentLabelFilter = chip.dataset.filter;
        bar.querySelectorAll('.wa-label-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        function runFilter() {
          applyLabelFilter(currentLabelFilter);
          if (currentLabelFilter === 'all') {
            getVisibleChatRows().forEach(r => { r.style.removeProperty('display'); });
          }
        }
        runFilter();
        setTimeout(runFilter, 150);
        setTimeout(runFilter, 500);
        if (currentLabelFilter !== 'all') {
          startLabelObserver();
        } else {
          stopLabelObserver();
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

// Chat list: find row = parent of cell-frame-container (works across WA versions)
function getVisibleChatRows() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return [];
  const cells = pane.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!cells.length) return [];
  const seen = new Set();
  const rows = [];
  cells.forEach(cell => {
    let row = cell.parentElement;
    if (!row || row === pane) row = cell;
    while (row && row.parentElement && row.parentElement !== pane && row.offsetHeight < 50) {
      row = row.parentElement;
    }
    if (row && !seen.has(row)) {
      seen.add(row);
      rows.push(row);
    }
  });
  return rows.filter(el => el && el.offsetHeight > 0);
}

function rowMatchesFilter(row, filter) {
  if (filter === 'all') return true;
  const text = (row.textContent || '').trim();

  if (filter === 'unread') {
    return !!(
      row.querySelector('[data-testid="icon-unread-count"]') ||
      row.querySelector('[data-testid="icon-unread"]') ||
      row.querySelector('[aria-label*="unread"]') ||
      row.querySelector('[aria-label*="Unread"]') ||
      row.querySelector('.unread-count') ||
      row.querySelector('[data-icon="unread-count"]') ||
      row.querySelector('[data-icon="unread"]') ||
      row.querySelector('span[class*="unread"]') ||
      row.querySelector('[class*="unread"]')
    );
  }
  if (filter === 'one-to-one') return !isRowGroup(row);
  if (filter === 'groups') return isRowGroup(row);

  if (filter === 'waiting') {
    const waitingText = /Waiting for this message/i.test(text);
    const hasSent = !!(
      row.querySelector('[data-icon="msg-dblcheck"]') ||
      row.querySelector('[data-icon="msg-check"]') ||
      row.querySelector('[data-icon="msg-time"]') ||
      row.querySelector('[data-testid="msg-dblcheck"]') ||
      row.querySelector('[data-testid="msg-check"]') ||
      waitingText
    );
    const hasUnread = !!(
      row.querySelector('[data-testid="icon-unread-count"]') ||
      row.querySelector('[data-testid="icon-unread"]')
    );
    return hasSent && !hasUnread;
  }

  if (filter === 'mentions') {
    return !!(
      row.querySelector('[data-icon="at-mentioned"]') ||
      row.querySelector('[data-testid="at-mentioned"]') ||
      row.querySelector('[aria-label*="mention"]') ||
      row.querySelector('[aria-label*="Mention"]') ||
      /@\d{10,}/.test(text) ||
      /@[\w\u00a0-\uffff]+/.test(text)
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

// ─── Chat row selector helper (WA Web changes selectors between versions) ─────
function getChatRows(pane) {
  const SELS = [
    '[data-testid="cell-frame-container"]',
    '[role="listitem"]',
    '#pane-side li',
    '#pane-side [tabindex="-1"]',
  ];
  for (const sel of SELS) {
    const rows = Array.from((pane || document).querySelectorAll(sel));
    if (rows.length > 0) return rows;
  }
  return [];
}

function getChatName(row) {
  const el =
    row.querySelector('[data-testid="cell-frame-title"]') ||
    row.querySelector('span[title][dir="auto"]') ||
    row.querySelector('[dir="auto"][title]') ||
    row.querySelector('span[title]');
  return el ? (el.title || el.textContent || '').trim() : '';
}

function getRowDataId(row) {
  if (row.dataset?.id) return row.dataset.id;
  const inRow = row.querySelector && row.querySelector('[data-id]');
  if (inRow && inRow.dataset?.id) return inRow.dataset.id;
  const withId = row.closest && row.closest('[data-id]');
  if (withId && withId.dataset.id) return withId.dataset.id;
  let el = row;
  for (let i = 0; i < 20; i++) {
    if (!el) break;
    if (el.dataset?.id) return el.dataset.id;
    el = el.parentElement;
  }
  return '';
}

function isRowGroup(row) {
  const id = getRowDataId(row);
  if (id.endsWith('@g.us')) return true;
  // Fallback: WA Web often uses group avatar/icon in the row
  if (row.querySelector && (
    row.querySelector('[data-icon*="group"]') ||
    row.querySelector('[data-icon="default-group"]') ||
    row.querySelector('[data-icon="group"]') ||
    row.querySelector('[aria-label*="roup"]') ||
    row.querySelector('[title*="roup"]')
  )) return true;
  return false;
}

// ─── Virtual Pin (up to 8 pinned chats in WA Web list) ───────────────────────
let vpinObserver   = null;
let vpinDebounce   = null;

function applyVirtualPins() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return;

  chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
    // Clean up previous virtual pin icons
    pane.querySelectorAll('.wa-vpin-icon').forEach(b => b.remove());
    pane.querySelectorAll('[data-wa-vpinned]').forEach(el => { delete el.dataset.waVpinned; });

    if (!pinnedChats.length) return;

    // First 3 are natively pinned by WA — we only need virtual handling for 4-6
    const virtualPins = pinnedChats.slice(3); // chats at index 3,4,5
    if (!virtualPins.length) return;

    const vpOrder = new Map();
    virtualPins.forEach((p, i) => {
      vpOrder.set((p.name || '').toLowerCase().trim(), i);
      const digits = (p.phone || '').replace(/\D/g, '');
      if (digits.length >= 7) vpOrder.set('phone:' + digits, i);
    });

    const rows = getChatRows(pane);
    if (!rows.length) return;

    // Find the last natively-pinned row (WA shows native pins at top with pin icon)
    let lastNativePin = null;
    for (const row of rows) {
      if (row.querySelector('[data-icon="pinned2"],[data-icon="pin-refreshed-thin"],[aria-label="Pinned chat"]')) lastNativePin = row;
    }

    const matched = [];
    rows.forEach(row => {
      const nameText = getChatName(row).toLowerCase();
      const digits   = nameText.replace(/\D/g, '');

      let order = vpOrder.get(nameText);
      if (order === undefined && digits.length >= 7) order = vpOrder.get('phone:' + digits);
      if (order === undefined) return;

      row.dataset.waVpinned = '1';

      // Inject WA-style pin icon if WA doesn't already show one
      const hasNativePin = row.querySelector('[data-icon="pinned2"],[data-icon="pin-refreshed-thin"],[aria-label="Pinned chat"]');
      if (!hasNativePin) {
        const icon = document.createElement('span');
        icon.className = 'wa-vpin-icon';
        icon.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="#8696a0"><path d="M11.2 3.6V8.8l1.42 1.42c.06.06.1.12.13.19.03.07.05.15.05.23v.35c0 .17-.06.32-.17.44-.12.12-.27.17-.44.17H8.6v3.72c0 .17-.06.32-.18.43a.6.6 0 01-.43.18.6.6 0 01-.43-.18.6.6 0 01-.18-.43V11.6H3.8c-.17 0-.32-.06-.44-.17a.59.59 0 01-.17-.44v-.35c0-.08.02-.16.05-.23.03-.07.07-.13.13-.19L4.8 8.8V3.6h-.2c-.17 0-.32-.06-.44-.17a.6.6 0 01-.17-.43.6.6 0 01.17-.43c.12-.12.27-.17.44-.17h7.6c.17 0 .32.06.44.17.12.12.17.27.17.44a.6.6 0 01-.17.43c-.12.11-.27.17-.44.17h-.2zM5.3 10.4h5.4L9.6 9.3V3.6H6.4v5.7L5.3 10.4z"/></svg>`;
        icon.style.cssText = 'position:absolute;bottom:12px;right:12px;z-index:2;pointer-events:none;opacity:.6;display:flex;align-items:center';
        row.style.position = 'relative';
        row.appendChild(icon);
      }

      matched.push({ row, order });
    });

    if (!matched.length) return;

    // Move virtual-pinned rows right after the last native pin
    matched.sort((a, b) => a.order - b.order);
    const parent = rows[0].parentElement;
    if (!parent) return;

    // Insert after last native pin, or at top if no native pins found
    let insertRef = lastNativePin ? lastNativePin.nextSibling : parent.firstChild;
    matched.forEach(({ row }) => {
      parent.insertBefore(row, insertRef);
      insertRef = row.nextSibling;
    });
  });
}

function startVpinObserver() {
  if (vpinObserver) return;
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  vpinObserver = new MutationObserver(() => {
    clearTimeout(vpinDebounce);
    vpinDebounce = setTimeout(applyVirtualPins, 500);
  });
  vpinObserver.observe(pane, { childList: true, subtree: true });
}

// Re-apply when pins change from sidepanel
chrome.storage.onChanged.addListener(changes => {
  if (changes.pinnedChats) applyVirtualPins();
});

// ─── Sync WA native pins → extension Quick Pin ────────────────────────────────
let _lastNativePinKey = '';

function syncNativePinsToStorage() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return;

  // Start from the pin icon and walk UP to find name + data-id
  // This works regardless of what WA Web calls the chat row element
  const pinIcons = pane.querySelectorAll(
    '[data-icon="pinned2"],[data-icon="pin-refreshed-thin"],[aria-label="Pinned chat"]'
  );

  const nativePins = [];
  pinIcons.forEach(icon => {
    let name = '', dataId = '', el = icon;

    // Walk up max 20 levels to find name + data-id
    for (let i = 0; i < 20; i++) {
      el = el.parentElement;
      if (!el) break;

      // Grab data-id as soon as we find it
      if (!dataId && el.dataset.id) dataId = el.dataset.id;

      // Try all known name selectors
      if (!name) {
        const nameEl =
          el.querySelector('[data-testid="cell-frame-title"]') ||
          el.querySelector('span[title][dir="auto"]') ||
          el.querySelector('[dir="auto"][title]');
        if (nameEl) name = (nameEl.title || nameEl.textContent || '').trim();
      }

      if (name && dataId) break;
    }

    if (!name) return;
    const isGroup = dataId.endsWith('@g.us');
    const phone   = dataId.split('@')[0] || name;
    // Avoid duplicates
    if (!nativePins.some(p => p.name === name)) {
      nativePins.push({ phone, name, isGroup });
    }
  });

  const key = nativePins.map(p => p.name).join('|');
  if (key === _lastNativePinKey) return;
  _lastNativePinKey = key;

  chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
    const virtualOnly = pinnedChats.filter(p =>
      !nativePins.some(n => n.name.toLowerCase() === p.name.toLowerCase())
    );
    const merged = [...nativePins, ...virtualOnly].slice(0, 6);
    chrome.storage.local.set({ pinnedChats: merged });
  });
}

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
  const text = msgContainer.querySelector('.selectable-text, .copyable-text');
  if (text) {
    const cW = msgContainer.getBoundingClientRect().width;
    if (cW) {
      let node = text.parentElement;
      while (node && node !== msgContainer) {
        const w = node.getBoundingClientRect().width;
        if (w > 60 && w < cW * 0.85) return node;
        node = node.parentElement;
      }
    }
  }
  // Messages with only link preview / quoted preview: use preview block or container
  const preview = msgContainer.querySelector('[data-testid="link-preview"],[data-testid="quoted-msg"],[data-testid="quoted-message"],[class*="link-preview"],[class*="quoted"]');
  if (preview) {
    const rect = preview.getBoundingClientRect();
    if (rect.width > 40) return preview;
  }
  return msgContainer;
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
  let r = (bubble || msgContainer).getBoundingClientRect();
  if (r.width < 10) {
    r = msgContainer.getBoundingClientRect();
    if (r.width < 10) return;
  }

  const isOut = msgContainer.classList.contains('message-out') ||
                !!msgContainer.closest('.message-out') ||
                !!msgContainer.querySelector(
                  '[data-icon="msg-dblcheck"],[data-icon="msg-check"],[data-icon="msg-time"],' +
                  '[data-testid="msg-dblcheck"],[data-testid="msg-check"]'
                );

  // Position vertically centered on top edge of bubble
  const TOP = r.top + Math.min(r.height / 2 - 13, 6);
  if (isOut) {
    btn.style.top  = TOP + 'px';
    btn.style.left = (r.left - 36) + 'px';   // left of outgoing bubble
  } else {
    btn.style.top  = TOP + 'px';
    btn.style.left = (r.right + 10) + 'px';  // right of incoming bubble
  }

  // Update tooltip: "Go to original" if message is a reply, else "Reply"
  // Walk up to outermost msg-container to check for quoted preview
  const _msgSel = '[data-testid="msg-container"], .message-in, .message-out';
  let _root = msgContainer;
  { let el = msgContainer.parentElement, lim = 12;
    while (el && lim-- > 0) { if (el.matches(_msgSel)) _root = el; if (el.id === 'main') break; el = el.parentElement; } }
  const hasQuote = !!(
    _root.querySelector('[data-testid="quoted-msg"],[data-testid="quoted-message"],[data-testid*="quot"],[class*="quoted"],[aria-label="Quoted message"]') ||
    _root.querySelector('button [data-testid="selectable-text"]')
  );
  btn.style.setProperty('--whr-tip', hasQuote ? '"Go to original"' : '"Reply"');

  btn.classList.add('whr-visible');
}

const HOVER_MSG_SEL = '[data-testid="msg-container"], .message-in, .message-out, [class*="message-in"], [class*="message-out"], [class*="MessageIn"], [class*="MessageOut"]';

function getOutermostMessageContainer(el) {
  if (!el || !el.matches(HOVER_MSG_SEL)) return el;
  let root = el;
  let parent = el.parentElement;
  for (let i = 0; i < 15 && parent; i++) {
    if (parent.id === 'main' || parent.getAttribute('role') === 'application') break;
    if (parent.matches(HOVER_MSG_SEL)) root = parent;
    parent = parent.parentElement;
  }
  return root;
}

function injectHoverReply() {
  ensureHoverReplyBtn();
  const main = document.getElementById('main');
  if (!main) return;
  if (main.dataset.waHoverReplyDelegated) return;
  main.dataset.waHoverReplyDelegated = '1';

  // Delegated: mouseover/mouseout so hover on preview/link card/quoted block still finds msg container
  main.addEventListener('mouseover', (e) => {
    const c = e.target.closest(HOVER_MSG_SEL);
    if (!c) return;
    if (c === hoverReplyTarget) return;
    clearTimeout(hideReplyTimer);
    hoverReplyTarget = c;
    showReplyBtnFor(c);
  });

  main.addEventListener('mouseout', (e) => {
    if (e.relatedTarget?.id === 'wa-hover-reply') return;
    if (e.relatedTarget?.closest?.(HOVER_MSG_SEL)) return;
    scheduleHideReply();
  });

  // Double-click message = same as reply button: open in chat bar as reply preview
  // Use capture so we run before WhatsApp and reliably get the message
  main.addEventListener('dblclick', (e) => {
    const c = e.target.closest(HOVER_MSG_SEL);
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('wa-hover-reply')?.classList.remove('whr-visible');
    const msg = getOutermostMessageContainer(c);
    triggerNativeReply(msg);
  }, true);
}

// ─── Chat Row Pin Button ──────────────────────────────────────────────────────

function countNativePins() {
  return document.querySelectorAll('#pane-side [data-icon="pinned2"],[data-icon="pin-refreshed-thin"],[aria-label="Pinned chat"]').length;
}

async function tryNativePin(row) {
  const r = row.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  await sleep(400);
  const PIN_SELS = [
    '[data-testid="mi-msg-pin"]', '[data-testid="mi-msg-unpin"]',
    '[aria-label="Pin chat"]', '[aria-label="Unpin chat"]', '[aria-label*="Pin"]',
  ];
  for (const sel of PIN_SELS) {
    const item = document.querySelector(sel);
    if (item) { item.click(); return true; }
  }
  const item = [...document.querySelectorAll('[role="menuitem"], li')]
    .find(el => /^(pin|unpin)/i.test(el.textContent.trim()));
  if (item) { item.click(); return true; }
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return false;
}

function injectChatPinButtons() {
  const pane = document.querySelector('#pane-side');
  if (!pane) return;
  getChatRows(pane).forEach(cell => {
    if (cell.dataset.pinInjected) return;
    const name = getChatName(cell);
    if (!name) return;
    cell.dataset.pinInjected = '1';

    // Make cell relative so our absolute-positioned button works
    if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';

    // Extract phone
    const dataId = cell.closest('[data-id]')?.dataset.id || '';
    const phone = dataId.split('@')[0] || name.replace(/\D/g, '') || name;

    const btn = document.createElement('button');
    btn.className = 'wa-pin-btn';
    btn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M11.2 3.6V8.8l1.42 1.42c.06.06.1.12.13.19.03.07.05.15.05.23v.35c0 .17-.06.32-.17.44-.12.12-.27.17-.44.17H8.6v3.72c0 .17-.06.32-.18.43a.6.6 0 01-.43.18.6.6 0 01-.43-.18.6.6 0 01-.18-.43V11.6H3.8c-.17 0-.32-.06-.44-.17a.59.59 0 01-.17-.44v-.35c0-.08.02-.16.05-.23.03-.07.07-.13.13-.19L4.8 8.8V3.6h-.2c-.17 0-.32-.06-.44-.17a.6.6 0 01-.17-.43.6.6 0 01.17-.43c.12-.12.27-.17.44-.17h7.6c.17 0 .32.06.44.17.12.12.17.27.17.44a.6.6 0 01-.17.43c-.12.11-.27.17-.44.17h-.2zM5.3 10.4h5.4L9.6 9.3V3.6H6.4v5.7L5.3 10.4z"/></svg><span class="wa-pin-label">Pin</span>`;

    // Append directly on the cell — CSS handles positioning
    cell.appendChild(btn);

    // JS hover — reliable across all WA DOM structures
    cell.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('pinned')) {
        btn.querySelector('.wa-pin-label').textContent = 'Pin';
        btn.classList.add('wa-pin-visible');
      }
    });
    cell.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('pinned')) btn.classList.remove('wa-pin-visible');
    });

    // Check if already pinned
    chrome.storage.local.get('pinnedChats', ({ pinnedChats = [] }) => {
      if (pinnedChats.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        btn.classList.add('pinned', 'wa-pin-visible');
        btn.querySelector('.wa-pin-label').textContent = 'Pinned';
      }
    });

    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      chrome.storage.local.get('pinnedChats', async ({ pinnedChats = [] }) => {
        const n = getChatName(cell);
        const idx = pinnedChats.findIndex(p => p.name.toLowerCase() === n.toLowerCase());
        if (idx >= 0) {
          // Unpin: use native unpin for first 3 (they're natively pinned)
          if (idx < 3) {
            const chatRow = cell.closest('[role="listitem"]') || cell.parentElement || cell;
            await tryNativePin(chatRow);
          }
          pinnedChats.splice(idx, 1);
          btn.classList.remove('pinned');
          btn.querySelector('.wa-pin-label').textContent = 'Pin';
        } else {
          if (pinnedChats.length >= 6) {
            const lbl = btn.querySelector('.wa-pin-label');
            lbl.textContent = 'Max 6!';
            setTimeout(() => { lbl.textContent = 'Pin'; }, 1500);
            return;
          }
          // Pin: use WA native pin only if WA hasn't already reached its 3-pin limit
          if (countNativePins() < 3) {
            const chatRow = cell.closest('[role="listitem"]') || cell.parentElement || cell;
            await tryNativePin(chatRow);
          }
          pinnedChats.push({ phone, name: n });
          btn.classList.add('wa-pin-visible');
          btn.classList.add('pinned');
          btn.querySelector('.wa-pin-label').textContent = 'Pinned';
        }
        chrome.storage.local.set({ pinnedChats });
        applyVirtualPins();
      });
    });
  });
}

// Focus compose input so user can type after reply preview opens (like mobile swipe-to-reply)
function focusComposeAfterReply() {
  const input =
    document.querySelector('#main footer [data-lexical-editor="true"]') ||
    document.querySelector('#main footer div[contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
    document.querySelector('[data-testid="conversation-compose-box-input"]');
  if (input) {
    input.focus();
    input.click();
  }
}

async function triggerNativeReply(msgContainer) {
  document.getElementById('wa-hover-reply')?.classList.remove('whr-visible');

  // Always open this message in the chat bar as reply preview (like mobile swipe-to-reply).
  // Scroll message into view and trigger native Reply so it appears above the compose input.
  msgContainer.scrollIntoView({ block: 'center', behavior: 'instant' });
  await sleep(200);

  const bubble = getBubbleEl(msgContainer) || msgContainer;
  const rect   = bubble.getBoundingClientRect();
  const cx     = Math.round(rect.left + rect.width / 2);
  const cy     = Math.round(rect.top  + rect.height / 2);
  const coords = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };

  /* ── helpers ───────────────────────────────────────────── */
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

  // Walk up from the message container to collect every plausible DOM root
  const buildRoots = () => {
    const roots = new Set();
    let node = msgContainer;
    for (let i = 0; i < 8; i++) {          // go up to 8 levels
      if (!node) break;
      roots.add(node);
      node = node.parentElement;
    }
    const listItem = msgContainer.closest('[data-testid^="list-item"], [data-id], [role="row"]');
    if (listItem) { roots.add(listItem); if (listItem.parentElement) roots.add(listItem.parentElement); }
    return [...roots];
  };

  const REPLY_SELS = [
    '[data-testid="msg-action-reply"]',
    '[aria-label="Reply"]', '[aria-label*="eply"]',
    '[data-icon="reply-refreshed"]', '[data-icon="reply"]',
    'button[title="Reply"]', 'button[title="reply"]',
    '[aria-label="Responder"]', '[aria-label="Répondre"]', '[aria-label="Antworten"]',
  ];

  const findReplyBtn = root => {
    for (const sel of REPLY_SELS) {
      const el = root.querySelector(sel);
      if (el && !el.closest('[data-testid="quoted-msg"]')) {
        const btn = el.closest('button, [role="button"], span[role="button"]') || el;
        return btn;
      }
    }
    return null;
  };

  // Multi-language "Reply" text matching for dropdown menu items
  const REPLY_TEXTS = /^(reply|responder|répondre|antworten|rispondi|balas|yanıtla|回复|返信|답장)$/i;

  const findMenuItem = async (retries = 6) => {
    for (let i = 0; i < retries; i++) {
      await sleep(300);
      // Direct test-id
      const mi = document.querySelector('[data-testid="mi-msg-reply"]');
      if (mi) return mi;
      // By reply icon — most reliable in WA Web 2025
      const replyIcon = document.querySelector('[data-icon="reply-refreshed"], [data-icon="reply"]');
      if (replyIcon) {
        const btn = replyIcon.closest('[role="button"], button, li, [role="option"], [role="menuitem"]') || replyIcon.parentElement;
        if (btn?.offsetParent) return btn;
      }
      // Role=menuitem / option / button with reply text
      for (const el of document.querySelectorAll('[role="menuitem"], [role="option"], [role="button"]')) {
        if (REPLY_TEXTS.test(el.textContent.trim())) return el;
      }
      // <li> with reply icon or text
      for (const li of document.querySelectorAll('li')) {
        if (li.querySelector('[data-icon="reply-refreshed"], [data-icon="reply"]')) return li;
        if (REPLY_TEXTS.test(li.textContent.trim())) return li;
      }
      // Popup/overlay containers (WA Web 2025 uses data-animate-popup or role=listbox)
      for (const el of document.querySelectorAll('[data-animate-popup] *, [role="menu"] *, [role="listbox"] *, [data-js-addon] *')) {
        if (REPLY_TEXTS.test(el.textContent.trim()) && el.offsetParent) return el;
      }
      // Last resort: any visible element with exactly "Reply" text
      for (const el of document.querySelectorAll('span, div')) {
        if (REPLY_TEXTS.test(el.textContent.trim()) && el.offsetParent && el.getBoundingClientRect().width > 30) return el;
      }
    }
    return null;
  };

  const dismissMenu = () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  };

  /* ── Method 3 first: Right-click context menu → Reply (doesn't need hover) ── */
  const ctxTargets = [
    bubble.querySelector('.copyable-text, .selectable-text, [dir="ltr"], [dir="auto"], [data-testid="selectable-text"]') || bubble,
    bubble,
    msgContainer,
  ].filter((el, i, arr) => el && arr.indexOf(el) === i);
  for (const ctxTarget of ctxTargets) {
    const tRect = ctxTarget.getBoundingClientRect();
    if (tRect.width < 5 || tRect.height < 5) continue;
    const tc = { bubbles: true, cancelable: true, clientX: Math.round(tRect.left + tRect.width / 2), clientY: Math.round(tRect.top + tRect.height / 2) };
    ctxTarget.dispatchEvent(new MouseEvent('contextmenu', tc));
    const menuReply = await findMenuItem(4);
    if (menuReply) {
      menuReply.click();
      await sleep(150);
      focusComposeAfterReply();
      return;
    }
    dismissMenu();
    await sleep(200);
  }

  /* ── simulate real hover on the msg row ──────────────── */
  const hoverTargets = [msgContainer, bubble];
  const listRow = msgContainer.closest('[data-testid^="list-item"], [role="row"], [data-id]');
  if (listRow) hoverTargets.unshift(listRow);
  for (const t of hoverTargets) {
    t.dispatchEvent(new PointerEvent('pointerover',  { ...coords, pointerId: 1, bubbles: true }));
    t.dispatchEvent(new PointerEvent('pointerenter', { ...coords, pointerId: 1, bubbles: false }));
    t.dispatchEvent(new MouseEvent('mouseover',  coords));
    t.dispatchEvent(new MouseEvent('mouseenter', { ...coords, bubbles: false }));
    t.dispatchEvent(new MouseEvent('mousemove',  coords));
  }

  /* ── Method 1: Direct reply btn in action bar ────────── */
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(350);
    const roots = buildRoots();
    for (const root of roots) {
      // Try direct reply button
      const replyBtn = findReplyBtn(root);
      if (replyBtn) {
        const restore = reveal(replyBtn);
        replyBtn.click();
        await sleep(80);
        restore();
        await sleep(150);
        focusComposeAfterReply();
        console.log('[WA-REPLY] method 1 — direct reply button');
        return;
      }
      // Check for action bar and force-reveal it
      const actionBar = root.querySelector('[data-testid="msg-action-bar"]');
      if (actionBar) {
        const restore = reveal(actionBar);
        await sleep(120);
        const btn = findReplyBtn(actionBar);
        if (btn) {
          const r2 = reveal(btn);
          btn.click();
          await sleep(80);
          r2(); restore();
          await sleep(150);
          focusComposeAfterReply();
          console.log('[WA-REPLY] method 1 — revealed action bar reply');
          return;
        }
        restore();
      }
    }
    // Re-hover harder between attempts
    if (attempt < 2) {
      for (const t of hoverTargets) {
        t.dispatchEvent(new PointerEvent('pointermove', { ...coords, pointerId: 1, bubbles: true }));
        t.dispatchEvent(new MouseEvent('mousemove', coords));
      }
    }
  }

  /* ── Method 2: Click "▾" / more-options chevron → Reply ── */
  const MORE_ICONS = ['down-context', 'down', 'msg-more', 'menu', 'chevron-down'];
  for (const root of buildRoots()) {
    for (const iconName of MORE_ICONS) {
      const icon = root.querySelector(`[data-icon="${iconName}"]`);
      if (!icon || icon.closest('[data-testid="quoted-msg"]')) continue;
      const moreBtn = icon.closest('button, [role="button"], span') || icon.parentElement;
      if (!moreBtn) continue;
      const restoreMore = reveal(moreBtn);
      moreBtn.click();
      const dropReply = await findMenuItem(5);
      if (dropReply) {
        dropReply.click();
        restoreMore();
        await sleep(150);
        focusComposeAfterReply();
        console.log('[WA-REPLY] method 2 — chevron dropdown → Reply');
        return;
      }
      dismissMenu();
      restoreMore();
      break; // only try the first chevron found per root
    }
  }

  /* ── Method 4: Double-click / double-click simulation ── */
  const checkQuotedInCompose = () =>
    document.querySelector('#main footer [data-testid="quoted-message"], #main footer [data-testid="compose-box-quote"], #main [data-testid="conversation-compose-box"] [data-testid*="quot"], [class*="quoted-message"]');

  bubble.dispatchEvent(new MouseEvent('dblclick', { ...coords, detail: 2 }));
  await sleep(350);
  if (checkQuotedInCompose()) {
    focusComposeAfterReply();
    return;
  }
  // Some WA versions react to two quick clicks instead of dblclick
  bubble.dispatchEvent(new MouseEvent('click', coords));
  await sleep(80);
  bubble.dispatchEvent(new MouseEvent('click', coords));
  await sleep(350);
  if (checkQuotedInCompose()) {
    focusComposeAfterReply();
    return;
  }

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
    (async () => {
      let imageData = msg.imageData, imageMime = msg.imageMime, imageName = msg.imageName, caption = msg.caption;
      if (msg.imageKey) {
        const stored = await chrome.storage.session.get(msg.imageKey);
        const p = stored[msg.imageKey];
        if (p) { imageData = p.imageData; imageMime = p.imageMime; imageName = p.imageName; caption = p.caption ?? caption; }
      }
      if (!imageData) return sendResponse({ success: false, error: 'No image data (check session storage)' });
      sendResponse(await sendImageWithCaption(imageData, imageMime, imageName, caption));
    })().catch(e => sendResponse({ success: false, error: e.message }));
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

  if (msg.type === 'OPEN_CHAT_BY_NAME') {
    openChatByName(msg.data.name).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'PING') {
    sendResponse({ ready: true });
    return false;
  }
});

// ─── Pinned Chats Bar (injected into WhatsApp Web left panel) ─────────────────
// Pin bar removed — pins are shown inline in the chat list like WA native

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
    btn.title = pinned ? 'Unpin from extension bar' : 'Pin to extension bar (up to 6)';
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
      chrome.storage.local.get('pinnedChats', async ({ pinnedChats = [] }) => {
        const idx = pinnedChats.findIndex(p => p.name === cur.name);
        if (idx >= 0) {
          // Unpin: trigger native unpin for first 3
          if (idx < 3) {
            const chatRow = document.querySelector('#pane-side [data-testid="cell-frame-container"]');
            // find the actual row for this chat
            const rows = document.querySelectorAll('#pane-side [data-testid="cell-frame-container"]');
            for (const r of rows) {
              const n = r.querySelector('[data-testid="cell-frame-title"]')?.textContent?.trim();
              if (n && n.toLowerCase() === cur.name.toLowerCase()) {
                const listRow = r.closest('[role="listitem"]') || r.parentElement || r;
                await tryNativePin(listRow);
                break;
              }
            }
          }
          pinnedChats.splice(idx, 1);
          chrome.storage.local.set({ pinnedChats });
        } else {
          if (pinnedChats.length >= 6) {
            btn.style.color = '#f15c6d';
            setTimeout(() => _updatePinHeaderBtn(), 1500);
            return;
          }
          // Native pin only if WA hasn't reached its 3-pin limit
          if (countNativePins() < 3) {
            const rows = document.querySelectorAll('#pane-side [data-testid="cell-frame-container"]');
            for (const r of rows) {
              const n = r.querySelector('[data-testid="cell-frame-title"]')?.textContent?.trim();
              if (n && n.toLowerCase() === cur.name.toLowerCase()) {
                const listRow = r.closest('[role="listitem"]') || r.parentElement || r;
                await tryNativePin(listRow);
                break;
              }
            }
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
  const ds = _taskDateStr(task);
  if (filter === 'today') return ds === _getTodayStr();
  if (filter === 'tomorrow') return ds === _getTomorrowStr();
  if (filter === 'later') return ds !== _getTodayStr() && ds !== _getTomorrowStr();
  return true; // 'all'
}

function _genTaskId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _setTaskAlarm(task) {
  if (!task.time || task.done) return;
  const dateStr = _taskDateStr(task);
  const when = new Date(dateStr + 'T' + task.time + ':00').getTime();
  if (when <= Date.now()) return;
  chrome.runtime.sendMessage({ type: 'SET_TASK_ALARM', data: { taskId: task.id, title: task.title, when } }, () => {});
}

function _cancelTaskAlarm(taskId) {
  chrome.runtime.sendMessage({ type: 'CANCEL_TASK_ALARM', data: { taskId } }, () => void chrome.runtime.lastError);
}

function injectTaskStyles() {
  if (document.getElementById('wa-task-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa-task-styles';
  s.textContent = `
    /* ── Panel Shell ── */
    #wa-ext-task-panel {
      display: flex; flex-direction: row; flex: 1;
      width: 100%; height: 100%; background: #0b141a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden; box-sizing: border-box;
    }
    /* ── Left Sidebar ── */
    #wa-ext-task-panel .wt-sidebar {
      width: 200px; min-width: 200px; flex-shrink: 0;
      background: #111b21; border-right: 1px solid #1f2c34;
      display: flex; flex-direction: column; padding: 24px 0;
    }
    #wa-ext-task-panel .wt-sidebar-title {
      font-size: 18px; font-weight: 700; color: #e9edef;
      padding: 0 20px 20px; display: flex; align-items: center; gap: 8px;
    }
    #wa-ext-task-panel .wt-sidebar-title svg { opacity: .7; }
    #wa-ext-task-panel .wt-nav-item {
      padding: 10px 20px; cursor: pointer; display: flex; align-items: center;
      justify-content: space-between; color: #8696a0; font-size: 14px; font-weight: 500;
      transition: background .12s, color .12s; border-left: 3px solid transparent;
    }
    #wa-ext-task-panel .wt-nav-item:hover { background: #1a2730; color: #e9edef; }
    #wa-ext-task-panel .wt-nav-item.active {
      background: #1a2730; color: #00a884; border-left-color: #00a884; font-weight: 600;
    }
    #wa-ext-task-panel .wt-nav-count {
      background: #2a3942; color: #8696a0; border-radius: 10px;
      padding: 1px 8px; font-size: 11px; font-weight: 600; min-width: 18px; text-align: center;
    }
    #wa-ext-task-panel .wt-nav-item.active .wt-nav-count { background: #005c4b; color: #00a884; }
    /* ── Main Content ── */
    #wa-ext-task-panel .wt-main {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
    }
    #wa-ext-task-panel .wt-content-header {
      padding: 24px 28px 0; flex-shrink: 0;
    }
    #wa-ext-task-panel .wt-section-title {
      font-size: 20px; font-weight: 700; color: #e9edef; margin: 0;
    }
    #wa-ext-task-panel .wt-content-scroll {
      flex: 1; overflow-y: auto; padding: 16px 28px 28px;
    }
    #wa-ext-task-panel .wt-content-scroll::-webkit-scrollbar { width: 5px; }
    #wa-ext-task-panel .wt-content-scroll::-webkit-scrollbar-track { background: transparent; }
    #wa-ext-task-panel .wt-content-scroll::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 4px; }
    /* ── Task Row ── */
    #wa-ext-task-panel .wt-task-row {
      display: flex; align-items: flex-start; gap: 12px; padding: 12px 0;
      border-bottom: 1px solid #1a2730; transition: background .1s; cursor: default;
    }
    #wa-ext-task-panel .wt-task-row:last-of-type { border-bottom: none; }
    #wa-ext-task-panel .wt-task-row:hover { background: rgba(255,255,255,.02); margin: 0 -8px; padding: 12px 8px; border-radius: 8px; }
    #wa-ext-task-panel .wt-cb {
      width: 20px; height: 20px; border-radius: 50%; border: 2px solid #3b4a54;
      background: transparent; cursor: pointer; flex-shrink: 0; margin-top: 2px;
      display: flex; align-items: center; justify-content: center;
      transition: border-color .15s, background .15s;
    }
    #wa-ext-task-panel .wt-cb:hover { border-color: #00a884; }
    #wa-ext-task-panel .wt-cb.done { border-color: #00a884; background: #00a884; }
    #wa-ext-task-panel .wt-cb.done::after {
      content: ''; width: 8px; height: 5px;
      border-left: 2px solid #fff; border-bottom: 2px solid #fff;
      transform: rotate(-45deg) translate(1px, -1px); display: block;
    }
    #wa-ext-task-panel .wt-task-info { flex: 1; min-width: 0; }
    #wa-ext-task-panel .wt-task-name {
      font-size: 14px; color: #e9edef; line-height: 1.4; word-break: break-word;
    }
    #wa-ext-task-panel .wt-task-name.done { text-decoration: line-through; color: #667781; }
    #wa-ext-task-panel .wt-task-desc {
      font-size: 12px; color: #667781; margin-top: 2px; line-height: 1.3;
    }
    #wa-ext-task-panel .wt-task-tags {
      display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; align-items: center;
    }
    #wa-ext-task-panel .wt-tag {
      font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
    }
    #wa-ext-task-panel .wt-tag-time { background: #0d2b26; color: #00a884; }
    #wa-ext-task-panel .wt-tag-high { background: #3d1a1a; color: #f28b82; }
    #wa-ext-task-panel .wt-tag-medium { background: #2d2a14; color: #f9bc2a; }
    #wa-ext-task-panel .wt-tag-low { background: #1a2c1a; color: #57d17a; }
    #wa-ext-task-panel .wt-tag-date { background: #1f2c34; color: #8696a0; }
    #wa-ext-task-panel .wt-del-btn {
      background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px;
      color: #667781; opacity: 0; transition: opacity .15s, color .15s;
      display: flex; align-items: center; justify-content: center;
    }
    #wa-ext-task-panel .wt-task-row:hover .wt-del-btn { opacity: 1; }
    #wa-ext-task-panel .wt-del-btn:hover { color: #f15c6d; }
    /* ── + Add task link ── */
    #wa-ext-task-panel .wt-add-link {
      display: inline-flex; align-items: center; gap: 4px; padding: 10px 0;
      color: #00a884; font-size: 13px; font-weight: 600; cursor: pointer;
      background: none; border: none; transition: color .12s;
    }
    #wa-ext-task-panel .wt-add-link:hover { color: #06cf9c; }
    /* ── Inline Add Form ── */
    #wa-ext-task-panel .wt-inline-form {
      background: #1a2730; border: 1px solid #2a3942; border-radius: 12px;
      padding: 16px; margin: 8px 0 4px; display: none;
      animation: wtFormIn .15s ease;
    }
    @keyframes wtFormIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
    #wa-ext-task-panel .wt-inline-form.open { display: block; }
    #wa-ext-task-panel .wt-form-field {
      background: #111b21; border: 1px solid #2a3942; border-radius: 8px;
      padding: 9px 12px; color: #e9edef; font-size: 13px; outline: none;
      width: 100%; box-sizing: border-box; font-family: inherit;
    }
    #wa-ext-task-panel .wt-form-field:focus { border-color: #00a884; }
    #wa-ext-task-panel .wt-form-field::placeholder { color: #667781; }
    #wa-ext-task-panel .wt-form-field + .wt-form-field { margin-top: 8px; }
    #wa-ext-task-panel .wt-form-pills {
      display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; align-items: center;
    }
    #wa-ext-task-panel .wt-pill {
      padding: 5px 14px; border-radius: 16px; border: 1px solid #2a3942;
      background: #111b21; color: #8696a0; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all .12s;
    }
    #wa-ext-task-panel .wt-pill:hover { border-color: #00a884; color: #e9edef; }
    #wa-ext-task-panel .wt-pill.active { background: #005c4b; border-color: #00a884; color: #fff; }
    #wa-ext-task-panel .wt-remind-row {
      display: flex; align-items: center; gap: 8px; margin-top: 12px;
      color: #8696a0; font-size: 12px; cursor: pointer;
    }
    #wa-ext-task-panel .wt-remind-row:hover { color: #e9edef; }
    #wa-ext-task-panel .wt-remind-row svg { flex-shrink: 0; }
    #wa-ext-task-panel .wt-form-submit {
      margin-top: 14px; background: #00a884; border: none; border-radius: 8px;
      padding: 9px 24px; color: #fff; font-size: 13px; font-weight: 700;
      cursor: pointer; transition: background .12s;
    }
    #wa-ext-task-panel .wt-form-submit:hover { background: #06cf9c; }
    #wa-ext-task-panel .wt-form-actions {
      display: flex; align-items: center; gap: 8px; margin-top: 14px;
    }
    #wa-ext-task-panel .wt-form-cancel {
      background: none; border: none; color: #667781; font-size: 12px; font-weight: 600;
      cursor: pointer; padding: 9px 14px; border-radius: 8px; transition: color .12s;
    }
    #wa-ext-task-panel .wt-form-cancel:hover { color: #e9edef; }
    /* ── Empty state ── */
    #wa-ext-task-panel .wt-empty {
      color: #667781; font-size: 13px; padding: 8px 0; font-style: italic;
    }
    /* ── Priority select in form ── */
    #wa-ext-task-panel .wt-priority-row {
      display: flex; gap: 6px; margin-top: 10px; align-items: center;
    }
    #wa-ext-task-panel .wt-priority-row span { color: #667781; font-size: 11px; font-weight: 600; margin-right: 2px; }
    /* ── Date input for custom ── */
    #wa-ext-task-panel .wt-date-input {
      background: #111b21; border: 1px solid #2a3942; border-radius: 8px;
      padding: 5px 10px; color: #e9edef; font-size: 12px; outline: none;
      margin-left: 4px; display: none;
    }
    #wa-ext-task-panel .wt-date-input:focus { border-color: #00a884; }
    /* ── Time input ── */
    #wa-ext-task-panel .wt-time-input {
      background: #111b21; border: 1px solid #2a3942; border-radius: 8px;
      padding: 5px 10px; color: #e9edef; font-size: 12px; outline: none;
    }
    #wa-ext-task-panel .wt-time-input:focus { border-color: #00a884; }
  `;
  document.head.appendChild(s);
}

function _formatDateNice(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const nth = n => n + (['','st','nd','rd'][n % 10 > 3 ? 0 : (n - n % 10 !== 10) * n % 10] || 'th');
  return `${days[d.getDay()]} ${nth(d.getDate())} ${months[d.getMonth()]}`;
}

function renderTaskPanel() {
  const panel = document.getElementById(TASK_PANEL_ID);
  if (!panel) return;

  chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
    const today    = _getTodayStr();
    const tomorrow = _getTomorrowStr();

    // Bucket tasks
    const buckets = { today: [], tomorrow: [], later: [], done: [] };
    waTasks.forEach(t => {
      if (t.done) { buckets.done.push(t); return; }
      const ds = _taskDateStr(t);
      if (ds === today)         buckets.today.push(t);
      else if (ds === tomorrow) buckets.tomorrow.push(t);
      else                      buckets.later.push(t);
    });
    // Sort each bucket by time
    const sortBucket = arr => arr.sort((a, b) => {
      const ta = a.time || '99:99', tb = b.time || '99:99';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    Object.values(buckets).forEach(sortBucket);

    // Update sidebar counts
    panel.querySelectorAll('[data-wt-nav]').forEach(nav => {
      const key = nav.dataset.wtNav;
      const cnt = nav.querySelector('.wt-nav-count');
      if (cnt && buckets[key]) cnt.textContent = buckets[key].length;
      nav.classList.toggle('active', key === _taskPanelFilter);
    });

    // Render content
    const content = panel.querySelector('.wt-content-scroll');
    if (!content) return;

    const sectionTitle = { today: 'Today', tomorrow: 'Tomorrow', later: 'Later', done: 'Completed' }[_taskPanelFilter] || 'Today';
    const headerEl = panel.querySelector('.wt-section-title');
    if (headerEl) headerEl.textContent = sectionTitle;

    const tasks = buckets[_taskPanelFilter] || [];
    const prioTag  = { high: 'wt-tag-high', medium: 'wt-tag-medium', low: 'wt-tag-low' };

    let html = '';
    if (!tasks.length) {
      html = `<div class="wt-empty">No tasks yet</div>`;
    } else {
      html = tasks.map(task => {
        const dateStr = _taskDateStr(task);
        const dateLbl = dateStr === today ? '' : dateStr === tomorrow ? '' : _formatDateNice(dateStr);
        return `
          <div class="wt-task-row" data-task-id="${task.id}">
            <div class="wt-cb ${task.done ? 'done' : ''}" data-wt-toggle="${task.id}"></div>
            <div class="wt-task-info">
              <div class="wt-task-name ${task.done ? 'done' : ''}">${escapeHtml(task.title)}</div>
              ${task.description ? `<div class="wt-task-desc">${escapeHtml(task.description)}</div>` : `<div class="wt-task-desc" style="opacity:.4">Description</div>`}
              <div class="wt-task-tags">
                ${task.time ? `<span class="wt-tag wt-tag-time">⏰ ${task.time}</span>` : ''}
                ${task.priority && task.priority !== 'medium' ? `<span class="wt-tag ${prioTag[task.priority] || ''}">${task.priority}</span>` : ''}
                ${dateLbl ? `<span class="wt-tag wt-tag-date">${dateLbl}</span>` : ''}
              </div>
            </div>
            <button class="wt-del-btn" data-wt-del="${task.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>`;
      }).join('');
    }

    // Add task form (inline, collapsed by default)
    html += `
      <button class="wt-add-link" id="wt-add-link-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add task
      </button>
      <div class="wt-inline-form" id="wt-inline-form">
        <input type="text" class="wt-form-field" id="wt-f-title" placeholder="Task name" autocomplete="off">
        <input type="text" class="wt-form-field" id="wt-f-desc" placeholder="Description (optional)" autocomplete="off">
        <div class="wt-form-pills" id="wt-f-pills">
          <span class="wt-pill${_taskPanelFilter === 'today' || _taskPanelFilter === 'done' ? ' active' : ''}" data-wt-pill="today">Today</span>
          <span class="wt-pill${_taskPanelFilter === 'tomorrow' ? ' active' : ''}" data-wt-pill="tomorrow">Tomorrow</span>
          <span class="wt-pill" data-wt-pill="custom">Set date</span>
          <input type="date" class="wt-date-input" id="wt-f-date-custom">
        </div>
        <div class="wt-remind-row" id="wt-f-remind-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          Remind me
          <input type="time" class="wt-time-input" id="wt-f-time" title="Set reminder time">
        </div>
        <div class="wt-priority-row">
          <span>Priority</span>
          <span class="wt-pill" data-wt-prio="low">Low</span>
          <span class="wt-pill active" data-wt-prio="medium">Medium</span>
          <span class="wt-pill" data-wt-prio="high">High</span>
        </div>
        <div class="wt-form-actions">
          <button class="wt-form-submit" id="wt-f-submit">Add task</button>
          <button class="wt-form-cancel" id="wt-f-cancel">Cancel</button>
        </div>
      </div>`;

    content.innerHTML = html;

    /* ── Wire up interactions ── */
    // Toggle done
    content.querySelectorAll('[data-wt-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.wtToggle;
        chrome.storage.local.get('waTasks', ({ waTasks: ts = [] }) => {
          const task = ts.find(t => t.id === id);
          if (!task) return;
          task.done = !task.done;
          if (task.done) _cancelTaskAlarm(id); else _setTaskAlarm(task);
          chrome.storage.local.set({ waTasks: ts });
        });
      });
    });
    // Delete
    content.querySelectorAll('[data-wt-del]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.wtDel;
        _cancelTaskAlarm(id);
        chrome.storage.local.get('waTasks', ({ waTasks: ts = [] }) => {
          chrome.storage.local.set({ waTasks: ts.filter(t => t.id !== id) });
        });
      });
    });

    // + Add task toggle
    const addLink = content.querySelector('#wt-add-link-btn');
    const form    = content.querySelector('#wt-inline-form');
    addLink?.addEventListener('click', () => {
      form.classList.toggle('open');
      if (form.classList.contains('open')) content.querySelector('#wt-f-title')?.focus();
    });
    content.querySelector('#wt-f-cancel')?.addEventListener('click', () => {
      form.classList.remove('open');
    });

    // Date pills
    let _formDate = (_taskPanelFilter === 'tomorrow') ? 'tomorrow' : 'today';
    const dateCustom = content.querySelector('#wt-f-date-custom');
    content.querySelectorAll('[data-wt-pill]').forEach(pill => {
      pill.addEventListener('click', () => {
        content.querySelectorAll('[data-wt-pill]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        _formDate = pill.dataset.wtPill;
        dateCustom.style.display = _formDate === 'custom' ? 'inline-block' : 'none';
        if (_formDate === 'custom' && !dateCustom.value) dateCustom.value = _getTodayStr();
      });
    });

    // Priority pills
    let _formPrio = 'medium';
    content.querySelectorAll('[data-wt-prio]').forEach(pill => {
      pill.addEventListener('click', () => {
        content.querySelectorAll('[data-wt-prio]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        _formPrio = pill.dataset.wtPrio;
      });
    });

    // Submit
    const doSubmit = () => {
      const title = content.querySelector('#wt-f-title')?.value.trim();
      if (!title) return;
      const desc = content.querySelector('#wt-f-desc')?.value.trim() || '';
      const dateVal = _formDate === 'custom' ? (dateCustom.value || _getTodayStr()) : _formDate;
      const time = content.querySelector('#wt-f-time')?.value || '';
      const task = {
        id: _genTaskId(), title, description: desc,
        date: dateVal, time, priority: _formPrio,
        done: false, createdAt: Date.now()
      };
      chrome.storage.local.get('waTasks', ({ waTasks: ts = [] }) => {
        ts.push(task);
        chrome.storage.local.set({ waTasks: ts }, () => {
          _setTaskAlarm(task);
          form.classList.remove('open');
        });
      });
    };
    content.querySelector('#wt-f-submit')?.addEventListener('click', doSubmit);
    content.querySelector('#wt-f-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
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
  if (!section) return;

  injectTaskStyles();

  // Hide the WA intro screen, insert task panel as sibling
  section.style.display = 'none';
  section.dataset.waTaskHidden = '1';

  const panel = document.createElement('div');
  panel.id = TASK_PANEL_ID;
  panel.innerHTML = `
    <!-- Sidebar -->
    <div class="wt-sidebar">
      <div class="wt-sidebar-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        Tasks
      </div>
      <div class="wt-nav-item active" data-wt-nav="today">
        <span>Today</span>
        <span class="wt-nav-count">0</span>
      </div>
      <div class="wt-nav-item" data-wt-nav="tomorrow">
        <span>Tomorrow</span>
        <span class="wt-nav-count">0</span>
      </div>
      <div class="wt-nav-item" data-wt-nav="later">
        <span>Later</span>
        <span class="wt-nav-count">0</span>
      </div>
      <div class="wt-nav-item" data-wt-nav="done">
        <span>Completed</span>
        <span class="wt-nav-count">0</span>
      </div>
    </div>
    <!-- Main Content -->
    <div class="wt-main">
      <div class="wt-content-header">
        <h2 class="wt-section-title">Today</h2>
      </div>
      <div class="wt-content-scroll"></div>
    </div>
  `;

  section.insertAdjacentElement('afterend', panel);

  // Sidebar navigation
  panel.querySelectorAll('[data-wt-nav]').forEach(nav => {
    nav.addEventListener('click', () => {
      _taskPanelFilter = nav.dataset.wtNav;
      renderTaskPanel();
    });
  });

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
    if (sec) initTaskPanel();
  }
}

// ─── Single observer: pin header button + task panel ──────────────────────────
let _pinBtnLastChat = '';
let _lastChatOpenState = null;
const _pinBarObserver = new MutationObserver(() => {
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
    if (chatOpenNow) _removeTaskPanel();
  }
  // Continuously retry injection: no chat + intro section present + panel missing
  if (!chatOpenNow && !document.getElementById(TASK_PANEL_ID)) {
    const sec = _findIntroSection();
    if (sec) initTaskPanel();
  }
});
_pinBarObserver.observe(document.body, { childList: true, subtree: true });

// Live-sync: update pins, header button, and task list when storage changes
chrome.storage.onChanged.addListener(changes => {
  if (changes.pinnedChats) { applyVirtualPins(); _updatePinHeaderBtn(); }
  if (changes.waTasks)     { renderTaskPanel(); }
});

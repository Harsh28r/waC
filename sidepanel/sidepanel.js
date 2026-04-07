// sidepanel.js — WA Bulk AI v2.0

// Set to false when you're ready to show all features (Phase 2).
const PHASE1_ONLY = false;

// ─── State ────────────────────────────────────────────────────────────────────
let contacts    = [];
let results     = [];
let replies     = [];
let isRunning   = false;
let privacyOn   = false;
let pinnedChats = [];   // max 6 virtual pinned chats
const PIN_MAX   = 6;
let settings    = { apiKey: '', geminiApiKey: '', openaiApiKey: '', aiProvider: 'gemini', aiEnabled: false, minDelay: 15, maxDelay: 45, dailyLimit: 100, stealthMode: false, autoPrivacy: false };

// ─── Suppress "message channel closed" runtime.lastError warnings ─────────────
// MV3 service workers can terminate before responding; this wrapper ensures
// chrome.runtime.lastError is always read so Chrome doesn't log it as unchecked.
{
  const _orig = chrome.runtime.sendMessage.bind(chrome.runtime);
  chrome.runtime.sendMessage = function(msg, cb) {
    return _orig(msg, cb
      ? function(...a) { cb(...a); void chrome.runtime.lastError; }
      : function()     { void chrome.runtime.lastError; });
  };
}

// ─── Country codes (dial + flag via iso; img src from GET_FLAG_URLS data URLs) ─
const COUNTRY_CODES = [
  { code: '91', dial: '+91', iso: 'in' }, { code: '1', dial: '+1', iso: 'us' },
  { code: '44', dial: '+44', iso: 'gb' }, { code: '81', dial: '+81', iso: 'jp' },
  { code: '86', dial: '+86', iso: 'cn' }, { code: '49', dial: '+49', iso: 'de' },
  { code: '33', dial: '+33', iso: 'fr' }, { code: '61', dial: '+61', iso: 'au' },
  { code: '55', dial: '+55', iso: 'br' }, { code: '52', dial: '+52', iso: 'mx' },
  { code: '39', dial: '+39', iso: 'it' }, { code: '34', dial: '+34', iso: 'es' },
  { code: '7', dial: '+7', iso: 'ru' }, { code: '82', dial: '+82', iso: 'kr' },
  { code: '31', dial: '+31', iso: 'nl' }, { code: '971', dial: '+971', iso: 'ae' },
  { code: '966', dial: '+966', iso: 'sa' }, { code: '65', dial: '+65', iso: 'sg' },
  { code: '60', dial: '+60', iso: 'my' }, { code: '62', dial: '+62', iso: 'id' },
  { code: '63', dial: '+63', iso: 'ph' }, { code: '84', dial: '+84', iso: 'vn' },
  { code: '90', dial: '+90', iso: 'tr' }, { code: '92', dial: '+92', iso: 'pk' },
  { code: '98', dial: '+98', iso: 'ir' }, { code: '20', dial: '+20', iso: 'eg' },
  { code: '234', dial: '+234', iso: 'ng' }, { code: '27', dial: '+27', iso: 'za' },
  { code: '254', dial: '+254', iso: 'ke' }, { code: '212', dial: '+212', iso: 'ma' },
  { code: '213', dial: '+213', iso: 'dz' }, { code: '216', dial: '+216', iso: 'tn' },
  { code: '249', dial: '+249', iso: 'sd' }, { code: '233', dial: '+233', iso: 'gh' },
  { code: '255', dial: '+255', iso: 'tz' }, { code: '256', dial: '+256', iso: 'ug' },
  { code: '250', dial: '+250', iso: 'rw' }, { code: '237', dial: '+237', iso: 'cm' },
  { code: '351', dial: '+351', iso: 'pt' }, { code: '48', dial: '+48', iso: 'pl' },
  { code: '46', dial: '+46', iso: 'se' }, { code: '47', dial: '+47', iso: 'no' },
  { code: '45', dial: '+45', iso: 'dk' }, { code: '358', dial: '+358', iso: 'fi' },
  { code: '353', dial: '+353', iso: 'ie' }, { code: '64', dial: '+64', iso: 'nz' },
  { code: '880', dial: '+880', iso: 'bd' }, { code: '94', dial: '+94', iso: 'lk' },
  { code: '977', dial: '+977', iso: 'np' },
];

function getFullPhoneFromCountryAndNumber(countryCode, numberOnly) {
  const cc = (countryCode || '').replace(/\D/g, '');
  const num = (numberOnly || '').replace(/\D/g, '');
  return cc + num;
}

// ─── Phone validation (country code required, E.164: 10–15 digits) ────────────
const PHONE_MIN = 10;
const PHONE_MAX = 15;

/** Normalize phone to digits-only — no spaces, no +. WhatsApp needs digits only. */
function normalizePhoneToDigits(val) {
  if (val == null) return '';
  const s = typeof val === 'number' ? (Number.isInteger(val) && val >= 1e9 ? String(val) : String(Math.round(val))) : String(val);
  return s.replace(/[^0-9]/g, '');
}

/** Parse phones from blast textarea: newlines, commas, semicolons. 10 digits → prepend default CC. */
function parsePhonesForBlast(raw, defaultCC = '91') {
  const tokens = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const phones = [];
  for (const t of tokens) {
    let digits = t.replace(/[^0-9+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (!digits) continue;
    if (digits.length === 10) digits = (defaultCC || '91').replace(/\D/g, '') + digits;
    if (digits.length >= 10) phones.push(digits);
  }
  return [...new Set(phones)];
}

/** Normalize phone to digits-only (no + or spaces) — always use before storing or sending */
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function validatePhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits.length) return { valid: false, error: 'Enter a phone number with country code' };
  if (digits.length < PHONE_MIN) return { valid: false, error: `Include country code (min ${PHONE_MIN} digits, e.g. 91 for India)` };
  if (digits.length > PHONE_MAX) return { valid: false, error: `Number too long (max ${PHONE_MAX} digits)` };
  if (digits.startsWith('0')) return { valid: false, error: 'Use country code instead of leading 0 (e.g. 91… not 0…)' };
  return { valid: true };
}

// ─── Phase 1 only: hide Phase 2 tabs/panels so user sees only Contacts, Sender, Tasks, Settings ──
if (typeof PHASE1_ONLY !== 'undefined' && PHASE1_ONLY) {
  document.body.classList.add('phase1-only');
  const teaser = document.getElementById('phase1Teaser');
  if (teaser) teaser.style.display = 'block';
}

// ─── Privacy Mode ─────────────────────────────────────────────────────────────
const privacyBtn = document.getElementById('privacyBtn');
const app        = document.querySelector('.app');

// Load saved privacy state
chrome.storage.local.get('privacyOn', d => {
  if (d.privacyOn) setPrivacy(true);
});

privacyBtn.addEventListener('click', () => setPrivacy(!privacyOn));

document.getElementById('closePanelBtn')?.addEventListener('click', () => window.close());

// Keyboard shortcut: Ctrl+Shift+H to toggle privacy instantly
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    setPrivacy(!privacyOn);
  }
});

function setPrivacy(on) {
  privacyOn = on;
  chrome.storage.local.set({ privacyOn });

  if (on) {
    app.classList.add('privacy-mode');
    privacyBtn.classList.add('active');
    privacyBtn.textContent = '🔒';
    privacyBtn.title = 'Privacy ON — Click to reveal (Ctrl+Shift+H)';
  } else {
    app.classList.remove('privacy-mode');
    privacyBtn.classList.remove('active');
    privacyBtn.textContent = '👁️';
    privacyBtn.title = 'Toggle Privacy Mode (Ctrl+Shift+H)';
  }

  // Also blur/unblur WhatsApp Web tab itself
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_PRIVACY', on }).catch(() => {});
    });
  });
}

function flagSrc(flagUrls, iso) {
  return (flagUrls && flagUrls[iso]) || `https://flagcdn.com/w40/${iso}.png`;
}

// ─── Compact country picker (flag + dial, scrollable list) ────────────────────
function initCountryPicker(wrapId, hiddenId, defaultCode = '91', flagUrls = {}) {
  const wrap = document.getElementById(wrapId);
  let hidden = document.getElementById(hiddenId);
  if (!wrap) return;
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = hiddenId;
    hidden.value = defaultCode;
    wrap.appendChild(hidden);
  } else {
    hidden.value = hidden.value || defaultCode;
  }
  const current = COUNTRY_CODES.find(c => c.code === hidden.value) || COUNTRY_CODES[0];
  wrap.innerHTML = '';
  wrap.appendChild(hidden);

  const box = document.createElement('div');
  box.className = 'country-picker-box';
  box.setAttribute('tabindex', '0');
  const valueSpan = document.createElement('span');
  valueSpan.className = 'country-picker-value';
  valueSpan.innerHTML = `<img src="${flagSrc(flagUrls, current.iso)}" alt="" class="country-flag-img"> ${current.dial}`;
  const arrow = document.createElement('span');
  arrow.className = 'country-picker-arrow';
  arrow.textContent = '▾';
  box.appendChild(valueSpan);
  box.appendChild(arrow);

  const list = document.createElement('div');
  list.className = 'country-picker-list';
  COUNTRY_CODES.forEach(c => {
    const opt = document.createElement('div');
    opt.className = 'country-picker-option';
    opt.dataset.code = c.code;
    opt.innerHTML = `<img src="${flagSrc(flagUrls, c.iso)}" alt="" class="country-flag-img"> ${c.dial}`;
    opt.addEventListener('click', () => {
      hidden.value = c.code;
      valueSpan.innerHTML = `<img src="${flagSrc(flagUrls, c.iso)}" alt="" class="country-flag-img"> ${c.dial}`;
      list.classList.remove('open');
      box.focus();
    });
    list.appendChild(opt);
  });

  box.addEventListener('click', (e) => {
    e.stopPropagation();
    list.classList.toggle('open');
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') list.classList.remove('open');
  });
  document.addEventListener('click', () => list.classList.remove('open'));

  wrap.appendChild(box);
  wrap.appendChild(list);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function renderPlanBadge() {
  chrome.runtime.sendMessage({ type: 'GET_LICENSE' }, (lic) => {
    if (chrome.runtime.lastError || !lic) return;
    const el = document.getElementById('planPill');
    if (!el) return;
    if (lic.plan === 'pro') { el.textContent = 'Pro'; el.className = 'plan-pill pro'; }
    else if (lic.plan === 'trial' && lic.trialDaysLeft) { el.textContent = `Trial · ${lic.trialDaysLeft}d`; el.className = 'plan-pill trial'; }
    else { el.textContent = 'Free'; el.className = 'plan-pill'; }
  });
}

chrome.storage.local.get(['contacts','settings','results','replies','pinnedChats'], (d) => {
  if (d.contacts)    { contacts    = d.contacts.map(c => crmDefaults(c)); renderContacts(); }
  if (d.settings)    { settings    = { ...settings, ...d.settings }; applySettings(); }
  if (d.results)     { results     = d.results;  renderLastResults(); }
  if (d.replies)     { replies     = d.replies;  renderReplies(); }
  if (d.pinnedChats) { pinnedChats = d.pinnedChats; renderPinnedChats(); }
  renderPlanBadge();
  if (typeof updateLastMediaErrorDisplay === 'function') updateLastMediaErrorDisplay();
  chrome.runtime.sendMessage({ type: 'GET_FLAG_URLS' }, (flagUrls) => {
    const urls = flagUrls || {};
    initCountryPicker('manualCountry-wrap', 'manualCountry', '91', urls);
    initCountryPicker('pin-country-wrap', 'pin-country', '91', urls);
    initCountryPicker('qs-country-wrap', 'qs-country', '91', urls);
    initCountryPicker('qs-blast-country-wrap', 'qs-blast-country', '91', urls);
    initCountryPicker('qs-blast-country-wrap', 'qs-blast-country', '91', urls);
  });
});

chrome.storage.local.get('campaignProgress', (d) => {
  if (d.campaignProgress) handleProgress(d.campaignProgress);
});

loadAnalytics();

// ─── Tab Switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(`panel-${t.dataset.tab}`).classList.add('active');
    if (t.dataset.tab === 'analytics') loadAnalytics();
    if (t.dataset.tab === 'pipeline')  renderPipeline();
    if (t.dataset.tab === 'dashboard') renderDashboard();
    if (t.dataset.tab === 'report') initReportTab();
    if (t.dataset.tab === 'tasks') { ensureTaskNotificationPermission(); renderTasks(); }
    if (t.dataset.tab === 'auto') {
      chrome.storage.local.get('settings', (d) => { if (d.settings) settings = { ...settings, ...d.settings }; });
    }
  });
});

// ─── TASKS TAB (syncs with waTasks, notifications via background alarms) ───────
let taskSpFilter = 'today';

function taskLocalDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function taskGetTodayStr() { return taskLocalDateStr(new Date()); }
function taskGetTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return taskLocalDateStr(d); }
function taskDateStr(t) {
  if (t.date === 'today') return taskGetTodayStr();
  if (t.date === 'tomorrow') return taskGetTomorrowStr();
  return t.date || taskGetTodayStr();
}
function taskGenId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function ensureTaskNotificationPermission() {
  if (chrome.notifications) chrome.notifications.getPermissionLevel?.(() => {});
}

function setTaskAlarm(task) {
  if (!task.time || task.done) return;
  const when = new Date(taskDateStr(task) + 'T' + task.time + ':00').getTime();
  if (when <= Date.now()) return;
  chrome.runtime.sendMessage({ type: 'SET_TASK_ALARM', data: { taskId: task.id, title: task.title, when } }, () => {});
}
function cancelTaskAlarm(taskId) {
  chrome.runtime.sendMessage({ type: 'CANCEL_TASK_ALARM', data: { taskId } }, () => {});
}

function renderTasks() {
  const listEl = document.getElementById('task-sp-list');
  const formEl = document.getElementById('task-sp-form');
  if (!listEl) return;
  chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
    const today = taskGetTodayStr(), tomorrow = taskGetTomorrowStr();
    const buckets = { today: [], tomorrow: [], later: [], done: [] };
    waTasks.forEach(t => {
      if (t.done) { buckets.done.push(t); return; }
      const ds = taskDateStr(t);
      if (ds === today) buckets.today.push(t);
      else if (ds === tomorrow) buckets.tomorrow.push(t);
      else buckets.later.push(t);
    });
    const sortByTime = (a, b) => ((a.time || '99:99') < (b.time || '99:99') ? -1 : 1);
    Object.values(buckets).forEach(arr => arr.sort(sortByTime));
    const tasks = buckets[taskSpFilter] || [];
    const prioClass = { high: 'task-prio-high', medium: '', low: 'task-prio-low' };
    if (!tasks.length) {
      listEl.innerHTML = '<div class="empty-state">No tasks in this list.</div>';
    } else {
      listEl.innerHTML = tasks.map(t => `
        <div class="task-sp-item card p-6 mb-4 row align-center gap-6" data-task-id="${t.id}">
          <input type="checkbox" class="task-sp-done" ${t.done ? 'checked' : ''} data-id="${t.id}" title="Mark done">
          <div class="flex-1 min-w-0">
            <div class="task-sp-title ${t.done ? 'done' : ''}">${esc(t.title)}</div>
            ${t.description ? `<div class="muted-text text-12">${esc(t.description)}</div>` : ''}
            <div class="row gap-4 mt-2">
              ${t.time ? `<span class="muted-text text-11">⏰ ${t.time}</span>` : ''}
              ${t.priority && t.priority !== 'medium' ? `<span class="text-11 ${prioClass[t.priority]}">${t.priority}</span>` : ''}
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm task-sp-del" data-id="${t.id}" title="Delete">✕</button>
        </div>
      `).join('');
    }
    listEl.querySelectorAll('.task-sp-done').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        const ts = [...waTasks];
        const task = ts.find(x => x.id === id);
        if (!task) return;
        task.done = !!cb.checked;
        if (task.done) cancelTaskAlarm(id); else setTaskAlarm(task);
        chrome.storage.local.set({ waTasks: ts }, () => renderTasks());
      });
    });
    listEl.querySelectorAll('.task-sp-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        cancelTaskAlarm(id);
        chrome.storage.local.set({ waTasks: waTasks.filter(t => t.id !== id) }, () => renderTasks());
      });
    });
  });
}

document.querySelectorAll('.task-sp-nav').forEach(btn => {
  btn.addEventListener('click', () => {
    taskSpFilter = btn.dataset.taskFilter;
    document.querySelectorAll('.task-sp-nav').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTasks();
  });
});
document.getElementById('task-sp-addBtn')?.addEventListener('click', () => {
  const form = document.getElementById('task-sp-form');
  if (form) { form.style.display = 'block'; form.querySelector('#task-sp-title')?.focus(); }
});
document.getElementById('task-sp-cancel')?.addEventListener('click', () => {
  const form = document.getElementById('task-sp-form');
  if (form) form.style.display = 'none';
});
document.getElementById('task-sp-save')?.addEventListener('click', () => {
  const title = document.getElementById('task-sp-title')?.value?.trim();
  if (!title) return;
  const desc = document.getElementById('task-sp-desc')?.value?.trim() || '';
  const dateRadio = document.querySelector('input[name="task-sp-date"]:checked');
  const dateVal = dateRadio?.value === 'custom' ? (document.getElementById('task-sp-date-custom')?.value || taskGetTodayStr()) : (dateRadio?.value || 'today');
  const time = document.getElementById('task-sp-time')?.value?.trim() || '';
  const priority = document.getElementById('task-sp-priority')?.value || 'medium';
  const task = { id: taskGenId(), title, description: desc, date: dateVal, time, priority, done: false, createdAt: Date.now() };
  chrome.storage.local.get('waTasks', ({ waTasks = [] }) => {
    waTasks.push(task);
    chrome.storage.local.set({ waTasks }, () => {
      setTaskAlarm(task);
      document.getElementById('task-sp-form').style.display = 'none';
      document.getElementById('task-sp-title').value = '';
      document.getElementById('task-sp-desc').value = '';
      document.getElementById('task-sp-time').value = '';
      renderTasks();
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.waTasks) renderTasks();
});

// ─── DATA REPORT TAB (Excel/CSV → Power BI–style analysis) ─────────────────────
function initReportTab() {
  const box = document.getElementById('reportUploadBox');
  const input = document.getElementById('reportFileInput');
  if (!box || !input) return;
  box.onclick = () => input.click();
  input.onchange = (e) => { if (e.target.files[0]) handleReportFile(e.target.files[0]); e.target.value = ''; };
  box.ondragover = (e) => { e.preventDefault(); box.classList.add('drag-over'); };
  box.ondragleave = () => box.classList.remove('drag-over');
  box.ondrop = (e) => { e.preventDefault(); box.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleReportFile(e.dataTransfer.files[0]); };
}

function parseCSVToRows(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] != null ? vals[idx] : '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

function handleReportFile(file) {
  const out = document.getElementById('reportOutput');
  if (!out) return;
  out.innerHTML = '<div class="muted-text">Analyzing…</div>';
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.csv')) {
    const r = new FileReader();
    r.onload = () => {
      const data = parseCSVToRows(r.result);
      if (!data) { out.innerHTML = '<div class="empty-state">CSV needs at least 2 rows.</div>'; return; }
      renderDataReport(data.headers, data.rows, out);
    };
    r.readAsText(file);
    return;
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const r = new FileReader();
    r.onload = () => {
      const ab = r.result;
      let data = null;
      if (typeof XLSX !== 'undefined') {
        try {
          const wb = XLSX.read(ab, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (aoa.length >= 2) {
            const headers = aoa[0].map(h => String(h || '').trim());
            const rows = aoa.slice(1).map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = row[i] != null ? String(row[i]).trim() : ''; });
              return obj;
            });
            data = { headers, rows };
          }
        } catch (e) { console.warn(e); }
      }
      if (!data) { out.innerHTML = '<div class="empty-state">Could not read Excel. Save as CSV in Excel and upload the CSV.</div>'; return; }
      renderDataReport(data.headers, data.rows, out);
    };
    r.readAsArrayBuffer(file);
    return;
  }
  out.innerHTML = '<div class="empty-state">Use a .csv or .xlsx file.</div>';
}

function inferType(vals) {
  const nonEmpty = vals.filter(v => v != null && String(v).trim() !== '');
  if (!nonEmpty.length) return 'string';
  let num = 0, date = 0;
  for (const v of nonEmpty) {
    const s = String(v).trim();
    if (/^-?\d*\.?\d+$/.test(s) || /^-?\d+$/.test(s)) num++;
    else if (!isNaN(new Date(s).getTime()) && s.length >= 6) date++;
  }
  if (num >= nonEmpty.length * 0.8) return 'number';
  if (date >= nonEmpty.length * 0.5) return 'date';
  return 'string';
}

function analyzeColumn(colName, rows) {
  const vals = rows.map(r => r[colName]);
  const nonEmpty = vals.filter(v => v != null && String(v).trim() !== '');
  const type = inferType(vals);
  const uniques = new Set(nonEmpty.map(v => String(v).trim())).size;
  const res = { type, count: rows.length, nonEmpty: nonEmpty.length, nulls: rows.length - nonEmpty.length, uniques };
  if (type === 'number') {
    const nums = nonEmpty.map(v => parseFloat(String(v).replace(/,/g, ''))).filter(n => !isNaN(n));
    res.min = nums.length ? Math.min(...nums) : null;
    res.max = nums.length ? Math.max(...nums) : null;
    res.sum = nums.length ? nums.reduce((a, b) => a + b, 0) : null;
    res.mean = nums.length ? res.sum / nums.length : null;
  }
  if (type === 'string' || type === 'date') {
    const counts = {};
    nonEmpty.forEach(v => { const k = String(v).trim(); counts[k] = (counts[k] || 0) + 1; });
    res.valueCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }
  return res;
}

function renderDataReport(headers, rows, container) {
  const totalRows = rows.length;
  const totalCols = headers.length;
  const analyses = {};
  headers.forEach(h => { analyses[h] = analyzeColumn(h, rows); });
  let html = `
    <div class="report-summary row gap-8 mb-10" style="flex-wrap:wrap">
      <div class="card p-6 report-card"><div class="report-card-value">${totalRows.toLocaleString()}</div><div class="report-card-label">Rows</div></div>
      <div class="card p-6 report-card"><div class="report-card-value">${totalCols}</div><div class="report-card-label">Columns</div></div>
      <div class="card p-6 report-card"><div class="report-card-value">${(totalRows * totalCols).toLocaleString()}</div><div class="report-card-label">Cells</div></div>
    </div>
    <div class="section-title mb-6">Column analysis</div>
  `;
  headers.forEach(col => {
    const a = analyses[col];
    const pct = totalRows ? Math.round((a.nonEmpty / totalRows) * 100) : 0;
    html += `<div class="card p-8 mb-8 report-column">
      <div class="row justify-between align-center mb-4"><strong>${esc(col)}</strong><span class="muted-text">${a.type} · ${a.nonEmpty} filled (${pct}%) · ${a.uniques} unique</span></div>`;
    if (a.nulls) html += `<div class="hint mb-4">${a.nulls} empty</div>`;
    if (a.type === 'number' && a.min != null) {
      html += `<div class="row gap-8 mb-2"><span>Min</span><span>${Number(a.min).toLocaleString()}</span></div>
        <div class="row gap-8 mb-2"><span>Max</span><span>${Number(a.max).toLocaleString()}</span></div>
        <div class="row gap-8 mb-2"><span>Sum</span><span>${Number(a.sum).toLocaleString()}</span></div>
        <div class="row gap-8 mb-2"><span>Avg</span><span>${Number(a.mean).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>`;
      const range = a.max - a.min || 1;
      html += `<div class="report-bar-wrap mt-4"><div class="report-bar" style="width:${((a.mean - a.min) / range * 100)}%"></div></div><div class="hint mt-2">Mean position in range</div>`;
    }
    if ((a.type === 'string' || a.type === 'date') && a.valueCounts && a.valueCounts.length) {
      const maxCount = a.valueCounts[0][1];
      html += '<div class="report-bars mt-4">';
      a.valueCounts.forEach(([label, count]) => {
        const w = maxCount ? (count / maxCount * 100) : 0;
        const safe = esc(label).substring(0, 40) + (label.length > 40 ? '…' : '');
        html += `<div class="report-bar-row"><span class="report-bar-label" title="${esc(label)}">${safe}</span><div class="report-bar-wrap"><div class="report-bar" style="width:${w}%"></div></div><span class="report-bar-count">${count}</span></div>`;
      });
      html += '</div>';
    }
    html += '</div>';
  });
  container.innerHTML = html;
}

// ─── CSV Upload ───────────────────────────────────────────────────────────────
document.getElementById('chooseFileBtn').addEventListener('click', () => document.getElementById('csvFile').click());
document.getElementById('uploadBox').addEventListener('click', (e) => {
  if (['upload-icon','upload-title','upload-hint'].some(c => e.target.classList.contains(c))) document.getElementById('csvFile').click();
});
document.getElementById('csvFile').addEventListener('change', (e) => {
  if (e.target.files[0]) { readFile(e.target.files[0]); e.target.value = ''; }
});

const uploadBox = document.getElementById('uploadBox');
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag-over'); });
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag-over'));
uploadBox.addEventListener('drop', e => {
  e.preventDefault(); uploadBox.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) readFile(f);
});

function readFile(f) {
  const name = (f.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const r = new FileReader();
    r.onload = e => {
      const ab = e.target.result;
      if (typeof XLSX === 'undefined') return showToast('Excel support loading… try again or use CSV', 'err');
      try {
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!aoa || aoa.length < 2) return showToast('Excel needs at least 2 rows', 'err');
        const headers = aoa[0].map(h => String(h || '').trim().toLowerCase());
        const rows = aoa.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] != null ? String(row[i]).trim() : ''; });
          return obj;
        });
        importFromRows(headers, rows);
      } catch (err) {
        console.warn(err);
        showToast('Could not read Excel — save as CSV and try again', 'err');
      }
    };
    r.readAsArrayBuffer(f);
    return;
  }
  const r = new FileReader();
  r.onload = e => importCSV(e.target.result);
  r.readAsText(f);
}

function importFromRows(headers, rows) {
  const phoneKey = headers.find(h => ['phone','phonenumber','mobile','number','tel'].includes(h));
  if (!phoneKey) return showToast('File must have a "phone" column', 'err');
  const defaultCc = (document.getElementById('manualCountry')?.value || '91').replace(/\D/g, '');
  const added = [];
  let skipped = 0;
  for (const c of rows) {
    let digits = normalizePhoneToDigits(c[phoneKey]);
    if (!digits) continue;
    if (digits.length === 10) {
      const rawVal = String(c[phoneKey] || '').trim();
      if (!rawVal.startsWith('+')) digits = defaultCc + digits;
    }
    if (digits.length < 10) { skipped++; continue; }
    const phone = digits;
    const contact = { ...c, phone, name: c.name || c.Name || phone, status: 'pending' };
    added.push(crmDefaults(contact));
  }
  if (!added.length) return showToast(`No valid phone numbers (need 10+ digits). ${skipped ? `Skipped ${skipped} invalid.` : ''}`, 'err');
  contacts = [...contacts, ...added];
  saveContacts(); renderContacts(); updatePreviewPicker();
  showToast(`✓ Added ${added.length} contacts`);
}

function importCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return showToast('CSV must have at least 2 rows', 'err');
  const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const phoneKey = headers.find(h => ['phone','phonenumber','mobile','number','tel'].includes(h));
  if (!phoneKey) return showToast('CSV must have a "phone" column', 'err');

  const defaultCc = (document.getElementById('manualCountry')?.value || '91').replace(/\D/g, '');
  const added = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const c = {};
    headers.forEach((h, idx) => c[h] = (vals[idx] || '').trim());
    let digits = normalizePhoneToDigits(c[phoneKey]);
    if (!digits) continue;
    if (digits.length === 10 && !(c[phoneKey] || '').trim().startsWith('+')) digits = defaultCc + digits;
    if (digits.length < 10) { skipped++; continue; }
    c.phone = digits;
    if (!c.name) c.name = digits;
    c.status = 'pending';
    added.push(crmDefaults(c));
  }

  contacts = [...contacts, ...added];
  saveContacts(); renderContacts(); updatePreviewPicker();
  showToast(skipped ? `✓ Added ${added.length} (skipped ${skipped} invalid)` : `✓ Added ${added.length} contacts`);
}

function splitCSVLine(line) {
  const res = []; let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

// ─── Manual Add ───────────────────────────────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', addManual);
document.getElementById('manualPhone').addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });

function addManual() {
  const name   = document.getElementById('manualName').value.trim();
  const cc     = (document.getElementById('manualCountry')?.value || '91').replace(/\D/g, '');
  const number = document.getElementById('manualPhone').value.trim().replace(/\D/g, '');
  const phone  = getFullPhoneFromCountryAndNumber(cc, number);
  const v = validatePhone(phone);
  if (!v.valid) return showToast(v.error, 'err');
  contacts.push(crmDefaults({ name: name || phone, phone, status: 'pending' }));
  saveContacts(); renderContacts(); updatePreviewPicker();
  document.getElementById('manualName').value = document.getElementById('manualPhone').value = '';
}

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!contacts.length) return;
  if (confirm(`Delete all ${contacts.length} contacts?`)) {
    contacts = []; saveContacts(); renderContacts(); updatePreviewPicker();
  }
});

// ─── CRM helpers ──────────────────────────────────────────────────────────────
const STAGES = ['new','contacted','interested','converted','lost'];
const STAGE_LABELS = { new:'🔵 New', contacted:'🟡 Contacted', interested:'🟠 Interested', converted:'🟢 Converted', lost:'⚫ Lost' };
const PRESET_TAGS = ['🔥 Hot Lead','❄️ Cold','⭐ VIP','👤 Customer','🔄 Follow-up','❌ DNC'];
const expandedSet = new Set(); // tracks which contact indices are expanded

function crmDefaults(c) {
  return { stage:'new', tags:[], notes:[], followUpDate:null, lastContacted:null, lastMessage:'', leadScore:null, replyTimestamps:[], ...c };
}

function scoreBadgeHTML(score) {
  if (score === null || score === undefined) return '';
  const cls = score >= 70 ? 'score-green' : score >= 40 ? 'score-yellow' : 'score-red';
  return `<span class="score-badge ${cls}" title="Lead Score">${score}</span>`;
}

function formatHour(h) {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function contactCardHTML(c, i) {
  const stage = c.stage || 'new';
  const tags  = c.tags  || [];
  const notes = c.notes || [];
  const fuDate = c.followUpDate ? new Date(c.followUpDate) : null;
  const fuOverdue = fuDate && fuDate < new Date();
  const expanded = expandedSet.has(i);
  const optHour = getOptimalHour(c.replyTimestamps);

  return `<div class="contact-card" data-i="${i}">
    <div class="contact-card-header" data-expand="${i}">
      <div class="avatar">${(c.name||c.phone||'?')[0].toUpperCase()}</div>
      <div class="contact-info" style="flex:1;min-width:0">
        <div class="row gap-6" style="flex-wrap:wrap">
          <span class="contact-name">${esc(c.name||c.phone)}</span>
          <span class="stage-badge stage-${stage}">${stage}</span>
          <span class="status-chip ${c.status||'pending'}">${c.status||'pending'}</span>
          ${scoreBadgeHTML(c.leadScore)}
        </div>
        <div class="contact-phone">${c.phone}</div>
        ${tags.length ? `<div class="tag-row">${tags.map(t=>`<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${fuDate ? `<div class="followup-badge${fuOverdue?' overdue':''}">⏰ ${fuOverdue?'Overdue! ':'Follow-up: '}${fuDate.toLocaleDateString()}</div>` : ''}
      </div>
      <div class="card-right">
        <button class="pin-btn${isPinned(c.phone)?' pinned':''}" data-pin="${i}" title="${isPinned(c.phone)?'Unpin':'Pin chat'}">📌</button>
        <button class="expand-btn${expanded?' open':''}" data-expand="${i}">▾</button>
        <button class="remove-btn" data-remove="${i}">✕</button>
      </div>
    </div>
    <div class="crm-detail" id="crm-${i}" style="display:${expanded?'flex':'none'}">
      <div class="crm-row">
        <span class="crm-label">Stage</span>
        <select class="input crm-select" data-stage-i="${i}">
          ${STAGES.map(s=>`<option value="${s}"${stage===s?' selected':''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="crm-row">
        <span class="crm-label">Tags</span>
        <div class="tag-editor">
          ${tags.map((t,ti)=>`<span class="tag-chip">${esc(t)}<button class="remove-tag" data-rtag-i="${i}" data-ti="${ti}">×</button></span>`).join('')}
          <select class="tag-add-sel" data-addtag-i="${i}">
            <option value="">+ Tag</option>
            ${PRESET_TAGS.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="crm-row crm-col">
        <span class="crm-label">Notes</span>
        ${notes.map((n,ni)=>`
          <div class="note-item">
            <div class="note-text">${esc(n.text)}</div>
            <div class="row justify-between mt-4">
              <span class="note-time">${new Date(n.ts).toLocaleString()}</span>
              <button class="remove-btn" data-rnote-i="${i}" data-ni="${ni}">✕</button>
            </div>
          </div>`).join('')}
        <div class="row gap-6 mt-4">
          <input type="text" class="input note-input" id="noteinp-${i}" placeholder="Add a note...">
          <button class="btn btn-outline btn-sm" data-addnote-i="${i}">+ Add</button>
        </div>
      </div>
      <div class="crm-row">
        <span class="crm-label">⏰ Remind</span>
        <div class="row gap-6" style="flex:1">
          <input type="datetime-local" class="input" style="flex:1;font-size:11px;padding:5px 7px" id="fuinp-${i}" value="${fuDate?fuDate.toISOString().slice(0,16):''}">
          <button class="btn btn-outline btn-sm" data-setfu-i="${i}">Set</button>
          ${fuDate?`<button class="btn btn-danger btn-sm" data-clrfu-i="${i}">✕</button>`:''}
        </div>
      </div>
      ${optHour !== null ? `<div class="crm-row"><span class="crm-label">⏰ Best time</span><span class="hint">~${formatHour(optHour)} (${(c.replyTimestamps||[]).length} repl${(c.replyTimestamps||[]).length !== 1 ? 'ies' : 'y'})</span></div>` : ''}
      ${c.lastContacted ? `<div class="hint mt-2">Last contacted: ${new Date(c.lastContacted).toLocaleString()}</div>` : ''}
    </div>
  </div>`;
}

// ─── Pinned Chats ─────────────────────────────────────────────────────────────
function isPinned(phone) { return pinnedChats.some(p => p.phone === phone); }

function pinChat(contact) {
  if (pinnedChats.length >= PIN_MAX) return showToast(`Max ${PIN_MAX} pins reached`, 'err');
  if (isPinned(contact.phone)) return;
  pinnedChats.push({ phone: contact.phone, name: contact.name || contact.phone });
  chrome.storage.local.set({ pinnedChats });
  renderPinnedChats(); renderContacts();
  showToast(`📌 Pinned ${contact.name || contact.phone}`);
}

function unpinChat(phone) {
  pinnedChats = pinnedChats.filter(p => p.phone !== phone);
  chrome.storage.local.set({ pinnedChats });
  renderPinnedChats(); renderContacts();
}

function renderPinnedChats() {
  const list  = document.getElementById('pinnedChipList');
  const count = document.getElementById('pinnedCount');
  count.textContent = `${pinnedChats.length}/${PIN_MAX}`;
  list.innerHTML = pinnedChats.map(p => `
    <div class="pinned-chip" data-pin-open="${esc(p.phone)}" data-pin-name="${esc(p.name||p.phone)}" data-is-group="${p.isGroup?'1':'0'}" title="Open chat: ${esc(p.name)}${p.isGroup?' (Group)':''}">
      <div class="pinned-chip-avatar">${(p.name||p.phone)[0].toUpperCase()}</div>
      <span class="pinned-chip-name">${esc(p.name||p.phone)}</span>
      <button class="pinned-chip-remove" data-pin-remove="${esc(p.phone)}" title="Unpin">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-pin-remove]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); unpinChat(btn.dataset.pinRemove); });
  });
  list.querySelectorAll('[data-pin-open]').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.closest('[data-pin-remove]')) return;
      const isGroup = chip.dataset.isGroup === '1';
      if (isGroup) {
        chrome.runtime.sendMessage({ type: 'OPEN_CHAT_BY_NAME', data: { name: chip.dataset.pinName } });
      } else {
        chrome.runtime.sendMessage({ type: 'OPEN_CHAT', data: { phone: chip.dataset.pinOpen } });
      }
      showToast('Opening chat…');
    });
  });
}

// ─── Manual Quick-Pin handler ─────────────────────────────────────────────────
document.getElementById('pinAddBtn').addEventListener('click', () => {
  const nameEl   = document.getElementById('pin-name');
  const phoneEl  = document.getElementById('pin-phone');
  const cc       = (document.getElementById('pin-country')?.value || '91').replace(/\D/g, '');
  const number   = phoneEl.value.trim().replace(/\D/g, '');
  const phone    = getFullPhoneFromCountryAndNumber(cc, number);
  const name     = nameEl.value.trim() || phone;
  const v = validatePhone(phone);
  if (!v.valid) return showToast(v.error, 'err');
  pinChat({ name, phone });
  nameEl.value = '';
  phoneEl.value = '';
});

document.getElementById('pin-phone').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('pinAddBtn').click();
});

function renderContacts() {
  document.getElementById('contactCount').textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`;
  const csvCountEl = document.getElementById('qs-blastCsvCount');
  if (csvCountEl) csvCountEl.textContent = `${contacts.length} contacts`;
  const list = document.getElementById('contactList');
  if (!contacts.length) { list.innerHTML = '<div class="empty-state">No contacts yet.<br>Upload a CSV or add one manually.</div>'; return; }
  list.innerHTML = contacts.map((c, i) => contactCardHTML(crmDefaults(c), i)).join('');
  attachContactListEvents();
  renderPipeline();
}

function attachContactListEvents() {
  const list = document.getElementById('contactList');

  // Expand toggle
  list.querySelectorAll('[data-expand]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const i = +el.dataset.expand;
      if (expandedSet.has(i)) expandedSet.delete(i); else expandedSet.add(i);
      renderContacts();
    });
  });

  // Pin / unpin contact
  list.querySelectorAll('[data-pin]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.pin;
      const c = contacts[i];
      if (isPinned(c.phone)) unpinChat(c.phone);
      else pinChat(c);
    });
  });

  // Remove contact
  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.remove;
      contacts.splice(i, 1);
      expandedSet.clear();
      saveContacts(); renderContacts(); updatePreviewPicker();
    });
  });

  // Stage change
  list.querySelectorAll('[data-stage-i]').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.stageI;
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].stage = sel.value;
      contacts[i].leadScore = calcLeadScore(contacts[i]);
      saveContacts(); renderContacts();
    });
  });

  // Add tag
  list.querySelectorAll('[data-addtag-i]').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.addtagI;
      const tag = sel.value;
      if (!tag) return;
      contacts[i] = crmDefaults(contacts[i]);
      if (!contacts[i].tags.includes(tag)) contacts[i].tags.push(tag);
      contacts[i].leadScore = calcLeadScore(contacts[i]);
      saveContacts(); renderContacts();
    });
  });

  // Remove tag
  list.querySelectorAll('[data-rtag-i]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.rtagI, ti = +btn.dataset.ti;
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].tags.splice(ti, 1);
      contacts[i].leadScore = calcLeadScore(contacts[i]);
      saveContacts(); renderContacts();
    });
  });

  // Add note
  list.querySelectorAll('[data-addnote-i]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.addnoteI;
      const inp = document.getElementById(`noteinp-${i}`);
      const text = inp?.value?.trim();
      if (!text) return;
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].notes.unshift({ text, ts: Date.now() });
      saveContacts(); renderContacts();
    });
  });

  // Remove note
  list.querySelectorAll('[data-rnote-i]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.rnoteI, ni = +btn.dataset.ni;
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].notes.splice(ni, 1);
      saveContacts(); renderContacts();
    });
  });

  // Set follow-up
  list.querySelectorAll('[data-setfu-i]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.setfuI;
      const inp = document.getElementById(`fuinp-${i}`);
      const val = inp?.value;
      if (!val) return showToast('Pick a date/time first', 'err');
      const ts = new Date(val).getTime();
      if (ts <= Date.now()) return showToast('Must be in the future', 'err');
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].followUpDate = ts;
      saveContacts(); renderContacts();
      chrome.runtime.sendMessage({ type: 'SET_FOLLOWUP', data: { phone: contacts[i].phone, timestamp: ts } });
      showToast(`⏰ Reminder set for ${new Date(ts).toLocaleString()}`);
    });
  });

  // Clear follow-up
  list.querySelectorAll('[data-clrfu-i]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.clrfuI;
      contacts[i] = crmDefaults(contacts[i]);
      const phone = contacts[i].phone;
      contacts[i].followUpDate = null;
      saveContacts(); renderContacts();
      chrome.runtime.sendMessage({ type: 'CLEAR_FOLLOWUP', data: { phone } });
    });
  });

  // Enter key on note input
  list.querySelectorAll('.note-input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const i = inp.id.replace('noteinp-', '');
        list.querySelector(`[data-addnote-i="${i}"]`)?.click();
      }
    });
  });
}

function saveContacts() { chrome.storage.local.set({ contacts }); }

// ─── Compose Tab ──────────────────────────────────────────────────────────────
document.getElementById('msgTemplate').addEventListener('input', () => {
  const len = document.getElementById('msgTemplate').value.length;
  document.getElementById('charCount').textContent = `${len} chars`;
  document.getElementById('waLimit').textContent = len > 1000 ? '⚠️ Long message' : '';
  updatePreview();
});

// Image file picker
let campaignImageData = null; // base64 data URL
let campaignImageName = null;
let campaignImageMime = null;

document.getElementById('imagePickBtn').addEventListener('click', () => {
  document.getElementById('imageFile').click();
});

document.getElementById('imageFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const isVideo = (file.type || '').startsWith('video/');
  const reader = new FileReader();
  reader.onload = ev => {
    campaignImageData = ev.target.result;
    campaignImageName = file.name;
    campaignImageMime = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');
    document.getElementById('imageFileName').textContent = file.name;
    const preview = document.getElementById('imagePreview');
    const imgEl = document.getElementById('imagePreviewImg');
    const videoLabel = document.getElementById('videoPreviewLabel');
    const videoNameEl = document.getElementById('videoFileName');
    if (isVideo) {
      imgEl.style.display = 'none';
      if (videoLabel && videoNameEl) {
        videoNameEl.textContent = file.name;
        videoLabel.style.display = 'block';
      }
    } else {
      imgEl.src = campaignImageData;
      imgEl.style.display = 'block';
      if (videoLabel) videoLabel.style.display = 'none';
    }
    preview.style.display = 'block';
    document.getElementById('imageClearBtn').style.display = '';
    const hint = document.getElementById('captionHint');
    if (hint) hint.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('imageClearBtn').addEventListener('click', () => {
  campaignImageData = campaignImageName = campaignImageMime = null;
  document.getElementById('imageFile').value = '';
  document.getElementById('imageFileName').textContent = 'No file chosen';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imagePreviewImg').src = '';
  document.getElementById('imagePreviewImg').style.display = 'none';
  const v = document.getElementById('videoPreviewLabel');
  if (v) v.style.display = 'none';
  document.getElementById('imageClearBtn').style.display = 'none';
  document.getElementById('imagePreviewImg').src = '';
  document.getElementById('videoPreviewEl').src = '';
  document.getElementById('videoPreviewEl').style.display = 'none';
  document.getElementById('imagePreviewImg').style.display = '';
  const hint = document.getElementById('captionHint');
  if (hint) hint.style.display = 'none';
});

// A/B Testing toggle
document.getElementById('abEnabled').addEventListener('change', e => {
  document.getElementById('abPanel').style.display = e.target.checked ? 'block' : 'none';
});

// AI toggle
document.getElementById('aiEnabled').addEventListener('change', e => {
  settings.aiEnabled = e.target.checked;
  const st = document.getElementById('aiStatus');
  if (e.target.checked) {
    const hasKey = (settings.aiProvider === 'gemini' ? settings.geminiApiKey : settings.apiKey) || '';
    st.textContent = hasKey ? '✓ AI will personalize each message' : '⚠️ Add API key in Settings tab first';
    st.style.color = hasKey ? '#25D366' : '#d29922';
  } else {
    st.textContent = 'Template variables only'; st.style.color = '#8b949e';
  }
  chrome.storage.local.set({ settings });
});

// Preview
document.getElementById('previewPicker').addEventListener('change', updatePreview);
function updatePreviewPicker() {
  const sel = document.getElementById('previewPicker');
  sel.innerHTML = '<option value="">Select contact for preview...</option>';
  contacts.forEach((c, i) => sel.innerHTML += `<option value="${i}">${esc(c.name||c.phone)}</option>`);
}
function updatePreview() {
  const idx = document.getElementById('previewPicker').value;
  const tpl = document.getElementById('msgTemplate').value;
  const box = document.getElementById('previewBubble');
  if (idx === '' || !tpl) { box.textContent = 'Write a template and select a contact to preview.'; return; }
  const c = contacts[+idx];
  let msg = tpl;
  for (const [k, v] of Object.entries(c)) msg = msg.replace(new RegExp(`\\{${k}\\}`, 'gi'), v || '');
  box.textContent = msg;
}

// Schedule button
document.getElementById('scheduleBtn').addEventListener('click', () => {
  const timeVal = document.getElementById('scheduleTime').value;
  if (!timeVal) return showResult('scheduleResult', '⛔ Pick a date/time first', 'err');
  const ts = new Date(timeVal).getTime();
  if (ts <= Date.now()) return showResult('scheduleResult', '⛔ Time must be in the future', 'err');

  const template  = document.getElementById('msgTemplate').value.trim();
  const templateB = document.getElementById('msgTemplateB').value.trim();
  const abEnabled = document.getElementById('abEnabled').checked;
  if (!contacts.length) return showResult('scheduleResult', '⛔ Add contacts first', 'err');
  if (!template)        return showResult('scheduleResult', '⛔ Write a message template first', 'err');

  const delaySec = parseInt(document.getElementById('minDelay')?.value) || 15;

  const scheduleCampaignName = document.getElementById('campaignName')?.value?.trim() || '';
  chrome.runtime.sendMessage({
    type: 'SCHEDULE_CAMPAIGN',
    data: {
      timestamp: ts,
      campaignData: {
        contacts, template, templateB, abEnabled,
        imageUrl: campaignImageData || null,
        imageMime: campaignImageMime || 'image/jpeg',
        imageName: campaignImageName || 'image.jpg',
        settings: { ...settings, minDelay: delaySec, maxDelay: delaySec, campaignName: scheduleCampaignName }
      }
    }
  }, resp => {
    if (resp?.success) showResult('scheduleResult', `✓ Scheduled for ${new Date(ts).toLocaleString()}`, 'ok');
    else showResult('scheduleResult', '⛔ ' + (resp?.error || 'Failed'), 'err');
  });
});

// ─── QUICK SENDER TAB ─────────────────────────────────────────────────────────
document.getElementById('qs-message').addEventListener('input', e => {
  document.getElementById('qs-charcount').textContent = `${e.target.value.length} chars`;
});

// Quick Sender image picker (shares campaignImageData with Compose)
document.getElementById('qs-imagePickBtn')?.addEventListener('click', () => document.getElementById('qs-imageFile')?.click());
document.getElementById('qs-imageFile')?.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (!f) return;
  const isVideo = (f.type || '').startsWith('video/');
  const r = new FileReader();
  r.onload = ev => {
    campaignImageData = ev.target.result;
    campaignImageName = f.name;
    campaignImageMime = f.type || (isVideo ? 'video/mp4' : 'image/jpeg');
    document.getElementById('qs-imageFileName').textContent = f.name;
    document.getElementById('qs-imageClearBtn').style.display = '';
  };
  r.readAsDataURL(f);
});
document.getElementById('qs-imageClearBtn')?.addEventListener('click', () => {
  campaignImageData = campaignImageName = campaignImageMime = null;
  document.getElementById('qs-imageFile').value = '';
  document.getElementById('qs-imageFileName').textContent = 'No file';
  document.getElementById('qs-imageClearBtn').style.display = 'none';
});

document.getElementById('qs-sendBtn').addEventListener('click', async () => {
  const cc      = (document.getElementById('qs-country')?.value || '91').replace(/\D/g, '');
  const number  = document.getElementById('qs-phone').value.trim().replace(/\D/g, '');
  const phone   = getFullPhoneFromCountryAndNumber(cc, number);
  const message = document.getElementById('qs-message').value.trim();
  const v = validatePhone(phone);
  if (!v.valid) return showResult('qs-result', '⛔ ' + v.error, 'err');
  // Allow image-only (caption from Compose) or text-only
  let imageUrl = campaignImageData || document.getElementById('imagePreviewImg')?.src;
  if (imageUrl && !imageUrl.startsWith('data:')) imageUrl = null;
  if (!message && !imageUrl) return showResult('qs-result', '⛔ Enter a message or attach image in Compose tab', 'err');

  const btn = document.getElementById('qs-sendBtn');
  btn.disabled = true; btn.textContent = '⏳ Sending...';
  showResult('qs-result', '📤 Opening WhatsApp Web...', 'info');

  let finalMsg = message;
  const aiOn = document.getElementById('qs-aiEnabled').checked;
  const qsAiKey = (settings.aiProvider === 'gemini' ? settings.geminiApiKey : settings.apiKey) || '';
  if (aiOn && qsAiKey && message) {
    showResult('qs-result', '🤖 AI rewriting message...', 'info');
    const r = await new Promise(res => chrome.runtime.sendMessage({ type: 'GENERATE_AI_REPLY', data: { replyText: message, contactName: phone, apiKey: qsAiKey, provider: settings.aiProvider || 'gemini' } }, res));
    if (r) finalMsg = r;
  }

  chrome.runtime.sendMessage({ type: 'QUICK_SEND', data: { phone, message: finalMsg || '', imageUrl: imageUrl || null, imageMime: campaignImageMime || 'image/jpeg', imageName: campaignImageName || 'image.jpg', stealthMode: settings.stealthMode } }, resp => {
    btn.disabled = false; btn.textContent = '⚡ Send Now';
    if (resp?.success) {
      showResult('qs-result', '✓ Message sent!', 'ok');
      document.getElementById('qs-phone').value = document.getElementById('qs-message').value = '';
      if (imageUrl) { campaignImageData = campaignImageName = campaignImageMime = null; document.getElementById('qs-imageFileName').textContent = 'No file'; document.getElementById('qs-imageClearBtn').style.display = 'none'; document.getElementById('qs-imageFile').value = ''; }
    } else {
      showResult('qs-result', '⛔ ' + (resp?.error || 'Send failed'), 'err');
    }
  });
});

// Parse phones for blast: flexible formats — newline, comma, semicolon; 10-digit gets default country
function parsePhonesForBlast(raw, defaultCountry = '91') {
  const cc = (defaultCountry || '91').replace(/\D/g, '');
  const tokens = raw.split(/[\n,;]+/).map(t => t.trim().replace(/[^0-9+]/g, '')).filter(Boolean);
  const phones = [];
  for (const t of tokens) {
    let digits = t.replace(/^\+/, '').replace(/\D/g, '');
    if (digits.length === 10 && !t.startsWith('+')) digits = cc + digits;
    if (digits.length >= 10) phones.push(digits);
  }
  return [...new Set(phones)];
}

// Blast to CSV contacts — single handler: upload CSV → Quick Blast → send to all
document.getElementById('qs-blastFromCsvBtn')?.addEventListener('click', () => {
  const msg = document.getElementById('qs-blast-msg').value.trim();
  if (!contacts.length) return showResult('qs-blast-result', '⛔ Upload a CSV in Contacts tab first', 'err');
  if (!msg && !campaignImageData) return showResult('qs-blast-result', '⛔ Enter a message or attach image above', 'err');
  const blastContacts = contacts.filter(c => (c.phone || '').replace(/\D/g, '').length >= 10).map(c => ({ ...crmDefaults(c), status: 'pending' }));
  if (!blastContacts.length) return showResult('qs-blast-result', '⛔ No valid phone numbers in imported contacts', 'err');
  const delaySec = parseInt(document.getElementById('qs-blast-delay')?.value) || 20;
  const d = Math.max(5, Math.min(300, delaySec));
  showResult('qs-blast-result', `🚀 Blasting to ${blastContacts.length} CSV contacts (${d}s between each)...`, 'info');
  chrome.runtime.sendMessage({
    type: 'START_CAMPAIGN',
    data: {
      contacts: blastContacts,
      template: msg || '',
      abEnabled: false,
      imageUrl: campaignImageData || null,
      imageMime: campaignImageMime || 'image/jpeg',
      imageName: campaignImageName || 'image.jpg',
      settings: { ...settings, minDelay: d, maxDelay: d }
    }
  }, resp => {
    if (resp?.success) {
      isRunning = true; setRunningUI(true);
      showResult('qs-blast-result', `✓ Blast started for ${blastContacts.length} contacts`, 'ok');
    } else {
      showResult('qs-blast-result', '⛔ ' + (resp?.error || 'Failed'), 'err');
    }
  });
});

// Multi-number blast (paste numbers)
document.getElementById('qs-blastBtn').addEventListener('click', () => {
  const phonesRaw = document.getElementById('qs-phones').value.trim();
  const msg       = document.getElementById('qs-blast-msg').value.trim();
  if (!phonesRaw) return showResult('qs-blast-result', '⛔ Enter phone numbers', 'err');
  if (!msg)       return showResult('qs-blast-result', '⛔ Enter a message', 'err');

  const defaultCc = (document.getElementById('qs-blast-country')?.value || '91').replace(/\D/g, '');
  const phones = parsePhonesForBlast(phonesRaw, defaultCc);
  if (!phones.length) return showResult('qs-blast-result', '⛔ No valid phone numbers found (need 10+ digits each)', 'err');

  const invalid = phones.filter(p => !validatePhone(p).valid);
  if (invalid.length) return showResult('qs-blast-result', `⛔ Invalid: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`, 'err');

  const blastContacts = phones.map(p => ({ name: p, phone: p, status: 'pending' }));
  const delaySec = parseInt(document.getElementById('qs-blast-delay')?.value) || 20;
  const d = Math.max(5, Math.min(300, delaySec));

  showResult('qs-blast-result', `🚀 Starting blast to ${phones.length} numbers (${d}s between each)...`, 'info');

  chrome.runtime.sendMessage({
    type: 'START_CAMPAIGN',
    data: {
      contacts: blastContacts,
      template: msg,
      abEnabled: false,
      imageUrl: campaignImageData || null,
      imageMime: campaignImageMime || 'image/jpeg',
      imageName: campaignImageName || 'image.jpg',
      settings: { ...settings, minDelay: d, maxDelay: d }
    }
  }, resp => {
    if (resp?.success) {
      isRunning = true; setRunningUI(true);
      showResult('qs-blast-result', `✓ Campaign started for ${phones.length} numbers`, 'ok');
    } else {
      showResult('qs-blast-result', '⛔ ' + (resp?.error || 'Failed'), 'err');
    }
  });
});

// ─── REPLIES TAB ──────────────────────────────────────────────────────────────
document.getElementById('scanRepliesBtn').addEventListener('click', scanForReplies);

function scanForReplies() {
  const sentContacts = results.filter(r => r.status === 'sent').map(r => ({ name: r.contact, phone: r.phone }));
  if (!sentContacts.length) { showToast('Run a campaign first, then scan for replies', 'err'); return; }

  const btn = document.getElementById('scanRepliesBtn');
  btn.disabled = true; btn.textContent = '⏳ Scanning...';
  document.getElementById('scanInfo').style.display = 'block';
  document.getElementById('scanStatus').textContent = `Scanning ${sentContacts.length} contacts for replies...`;

  chrome.runtime.sendMessage({
    type: 'SCAN_REPLIES',
    data: { contacts: sentContacts, apiKey: (settings.aiProvider === 'gemini' ? settings.geminiApiKey : settings.apiKey) || '', provider: settings.aiProvider || 'gemini' }
  }, resp => {
    btn.disabled = false; btn.textContent = '🔍 Scan';
    document.getElementById('scanInfo').style.display = 'none';

    if (resp?.success && resp.replies) {
      replies = resp.replies;
      chrome.storage.local.set({ replies });
      renderReplies();
      showToast(`Found ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}`);
    } else {
      showToast('Scan failed: ' + (resp?.error || 'Unknown error'), 'err');
    }
  });
}

function renderReplies() {
  document.getElementById('replyCount').textContent = `${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'} found`;
  const list = document.getElementById('replyList');
  if (!replies.length) {
    list.innerHTML = '<div class="empty-state">No replies yet.<br>Run a campaign first, then click "Scan" to check for replies.</div>';
    return;
  }

  list.innerHTML = replies.map((r, i) => `
    <div class="reply-row card-list" style="max-height:none;border-radius:8px;margin-bottom:8px;position:relative">
      <div class="reply-hover-actions">
        ${r.aiSuggestion ? `<div class="hover-suggestion">${esc(r.aiSuggestion.substring(0,80))}${r.aiSuggestion.length>80?'…':''}</div>` : ''}
        <div class="hover-actions-row">
          <button class="btn btn-green btn-sm" data-i="${i}" data-action="open">💬 Open Chat</button>
          <button class="btn btn-outline btn-sm" data-i="${i}" data-action="skip">Dismiss</button>
        </div>
      </div>
      <div class="reply-header">
        <div class="avatar blue">${(r.contact||r.phone||'?')[0].toUpperCase()}</div>
        <div class="reply-contact-name">${esc(r.contact||r.phone)}</div>
        ${r.category ? `<span class="cat-badge cat-${r.category.toLowerCase().replace(/ /g,'-')}">${r.category}</span>` : ''}
        <div class="reply-time">${new Date(r.timestamp).toLocaleTimeString()}</div>
      </div>
      ${r.autoStage ? `<div class="hint mt-4 mb-4">✅ Auto-moved to <span class="stage-badge stage-${r.autoStage}">${r.autoStage}</span> stage</div>` : ''}
      <div class="reply-text-box">${esc(r.replyText)}</div>
      ${r.aiSuggestion ? `
        <div>
          <div class="reply-ai-label">🤖 AI Suggested Reply</div>
          <textarea class="reply-suggestion-input" id="reply-input-${i}" rows="2">${esc(r.aiSuggestion)}</textarea>
        </div>
        <div class="reply-actions">
          <button class="btn btn-green btn-sm" data-i="${i}" data-action="send">✓ Send Reply</button>
          <button class="btn btn-outline btn-sm" data-i="${i}" data-action="skip">Skip</button>
        </div>
      ` : `
        <div class="reply-actions">
          <button class="btn btn-outline btn-sm" data-i="${i}" data-action="open">💬 Open Chat</button>
          <button class="btn btn-outline btn-sm" data-i="${i}" data-action="skip">Dismiss</button>
        </div>
      `}
    </div>`).join('');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      if (btn.dataset.action === 'send') {
        const msg = document.getElementById(`reply-input-${i}`)?.value?.trim();
        if (!msg) return;
        btn.disabled = true; btn.textContent = '⏳';
        chrome.runtime.sendMessage({ type: 'SEND_REPLY', data: { phone: replies[i].phone, message: msg, originalText: replies[i].replyText } }, resp => {
          if (resp?.success) { replies.splice(i, 1); chrome.storage.local.set({ replies }); renderReplies(); showToast('Reply sent!'); }
          else { btn.disabled = false; btn.textContent = '✓ Send Reply'; showToast('Send failed: ' + resp?.error, 'err'); }
        });
      } else if (btn.dataset.action === 'open') {
        btn.disabled = true; btn.textContent = '⏳';
        chrome.runtime.sendMessage({ type: 'OPEN_CHAT_QUOTED', data: { phone: replies[i].phone, originalText: replies[i].replyText } }, resp => {
          btn.disabled = false; btn.textContent = '💬 Open Chat';
          if (!resp?.success) showToast('Could not open chat: ' + (resp?.error || 'unknown'), 'err');
        });
      } else {
        replies.splice(i, 1); chrome.storage.local.set({ replies }); renderReplies();
      }
    });
  });
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAnalytics);
document.getElementById('clearAnalyticsBtn').addEventListener('click', () => {
  if (!confirm('Clear all analytics data?')) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_ANALYTICS' }, () => { loadAnalytics(); showToast('Analytics cleared'); });
});

function loadAnalytics() {
  chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' }, resp => {
    if (!resp?.analytics) return;
    const a = resp.analytics;
    document.getElementById('a-campaigns').textContent = a.campaigns.length;
    document.getElementById('a-sent').textContent      = a.totalSent;
    document.getElementById('a-failed').textContent    = a.totalFailed;
    document.getElementById('a-replies').textContent   = a.totalReplies;

    const total = a.totalSent + a.totalFailed;
    const successPct = total > 0 ? Math.round(a.totalSent / total * 100) : 0;
    const replyPct   = a.totalSent > 0 ? Math.round(a.totalReplies / a.totalSent * 100) : 0;

    document.getElementById('successRate').textContent = successPct + '%';
    document.getElementById('replyRate').textContent   = replyPct + '%';
    document.getElementById('successBar').style.width  = successPct + '%';
    document.getElementById('replyBar').style.width    = Math.min(replyPct, 100) + '%';

    const hist = document.getElementById('campaignHistory');
    if (!a.campaigns.length) { hist.innerHTML = '<div class="empty-state">No campaigns run yet.</div>'; return; }
    hist.innerHTML = [...a.campaigns].reverse().map(c => `
      <div class="history-row">
        <span class="history-date">${c.date}</span>
        <span class="history-stats">Total: ${c.total}</span>
        <span class="history-badge">✓ ${c.sent}</span>
        ${c.failed > 0 ? `<span class="history-badge" style="background:#3a1a1a;color:#f85149">✗ ${c.failed}</span>` : ''}
        ${c.abStats ? `<span class="history-badge" style="background:#2a1a3a;color:#bc8cff">A/B</span>` : ''}
      </div>`).join('');
  });
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function applySettings() {
  document.getElementById('aiProvider').value     = settings.aiProvider   || 'gemini';
  document.getElementById('geminiApiKey').value  = settings.geminiApiKey || '';
  document.getElementById('apiKey').value        = settings.apiKey      || '';
  document.getElementById('openaiApiKey').value  = settings.groqApiKey || '';
  document.getElementById('aiEnabled').checked   = settings.aiEnabled   || false;
  const delay = settings.minDelay || 15;
  document.getElementById('minDelay').value = delay;
  const maxEl = document.getElementById('maxDelay');
  if (maxEl) maxEl.value = delay;
  document.getElementById('dailyLimit').value    = settings.dailyLimit  || 100;
  document.getElementById('stealthMode').checked = settings.stealthMode || false;
  document.getElementById('autoPrivacy').checked = settings.autoPrivacy || false;

  // Business hours
  const bh = settings.bizHours || {};
  document.getElementById('bizHoursEnabled').checked = bh.enabled || false;
  document.getElementById('bizHoursPanel').style.display = bh.enabled ? 'block' : 'none';
  document.getElementById('bizStart').value  = bh.startTime || '09:00';
  document.getElementById('bizEnd').value    = bh.endTime   || '18:00';
  document.getElementById('bizOutMsg').value = bh.outsideMsg || '';
  const activeDays = bh.days || [1,2,3,4,5];
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.toggle('active', activeDays.includes(+btn.dataset.day));
  });

  // Birthday
  const bp = settings.birthday || {};
  document.getElementById('birthdayEnabled').checked = bp.enabled || false;
  document.getElementById('birthdayPanel').style.display = bp.enabled ? 'block' : 'none';
  document.getElementById('birthdayMsg').value = bp.message || "Happy Birthday {name}! 🎂 Wishing you a wonderful day!";

  // Phase 3 settings
  document.getElementById('webhookUrl').value  = settings.webhookUrl    || '';
  document.getElementById('linkTracking').checked  = settings.linkTracking  || false;
  document.getElementById('digestEnabled').checked = settings.digestEnabled || false;
}

document.getElementById('toggleGeminiKey').addEventListener('click', () => {
  const inp = document.getElementById('geminiApiKey');
  const btn = document.getElementById('toggleGeminiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
});
document.getElementById('toggleKey').addEventListener('click', () => {
  const inp = document.getElementById('apiKey');
  const btn = document.getElementById('toggleKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
});

document.getElementById('testKey').addEventListener('click', async () => {
  const provider = document.getElementById('aiProvider').value;
  const key = provider === 'gemini' ? document.getElementById('geminiApiKey').value.trim() : document.getElementById('apiKey').value.trim();
  if (!key) return showResult('keyResult', '⛔ Enter an API key first', 'err');
  showResult('keyResult', '⏳ Testing...', 'info');
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi' }] }], generationConfig: { maxOutputTokens: 5 } }) });
      if (res.ok) showResult('keyResult', '✓ Gemini API key is valid!', 'ok');
      else { const d = await res.json(); showResult('keyResult', '⛔ ' + (d.error?.message || 'Invalid key'), 'err'); }
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] })
      });
      if (res.ok) showResult('keyResult', '✓ Claude API key is valid!', 'ok');
      else { const d = await res.json(); showResult('keyResult', '⛔ ' + (d.error?.message || 'Invalid key'), 'err'); }
    }
  } catch (e) { showResult('keyResult', '⛔ Network error: ' + e.message, 'err'); }
});

document.getElementById('anthropicLink').addEventListener('click', e => { e.preventDefault(); chrome.tabs.create({ url: 'https://console.anthropic.com' }); });

// Business hours toggle
document.getElementById('bizHoursEnabled').addEventListener('change', e => {
  document.getElementById('bizHoursPanel').style.display = e.target.checked ? 'block' : 'none';
});
document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

// Birthday toggle
document.getElementById('birthdayEnabled').addEventListener('change', e => {
  document.getElementById('birthdayPanel').style.display = e.target.checked ? 'block' : 'none';
});

// ─── Webhook Test ──────────────────────────────────────────────────────────────
document.getElementById('testWebhookBtn').addEventListener('click', () => {
  const url = document.getElementById('webhookUrl').value.trim();
  if (!url) return showResult('webhookResult', '⛔ Enter a webhook URL first', 'err');
  showResult('webhookResult', '⏳ Testing...', 'info');
  chrome.runtime.sendMessage({ type: 'TEST_WEBHOOK', data: { webhookUrl: url } }, resp => {
    if (resp?.success) showResult('webhookResult', '✓ Webhook OK!', 'ok');
    else showResult('webhookResult', '⛔ ' + (resp?.error || 'Failed'), 'err');
  });
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  settings.aiProvider   = document.getElementById('aiProvider').value || 'gemini';
  settings.geminiApiKey = document.getElementById('geminiApiKey').value.trim();
  settings.apiKey       = document.getElementById('apiKey').value.trim();
  settings.groqApiKey   = document.getElementById('openaiApiKey').value.trim();
  settings.aiEnabled    = document.getElementById('aiEnabled').checked;
  const delaySec = parseInt(document.getElementById('minDelay')?.value) || 15;
  settings.minDelay = settings.maxDelay = delaySec;
  settings.dailyLimit  = parseInt(document.getElementById('dailyLimit').value)|| 100;
  settings.stealthMode = document.getElementById('stealthMode').checked;
  settings.autoPrivacy = document.getElementById('autoPrivacy').checked;

  // Business hours
  const days = [];
  document.querySelectorAll('.day-btn.active').forEach(btn => days.push(+btn.dataset.day));
  settings.bizHours = {
    enabled:    document.getElementById('bizHoursEnabled').checked,
    startTime:  document.getElementById('bizStart').value,
    endTime:    document.getElementById('bizEnd').value,
    days,
    outsideMsg: document.getElementById('bizOutMsg').value.trim()
  };

  // Birthday
  settings.birthday = {
    enabled: document.getElementById('birthdayEnabled').checked,
    message: document.getElementById('birthdayMsg').value.trim() || "Happy Birthday {name}! 🎂 Wishing you a wonderful day!"
  };

  // Phase 3
  settings.webhookUrl    = document.getElementById('webhookUrl').value.trim();
  settings.linkTracking  = document.getElementById('linkTracking').checked;
  settings.digestEnabled = document.getElementById('digestEnabled').checked;

  chrome.storage.local.set({ settings });
  showResult('saveResult', '✓ Settings saved', 'ok');
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!results.length) return showToast('No results to export yet', 'err');
  const rows = [['Contact','Phone','Status','Variant','Error','Message']];
  results.forEach(r => rows.push([r.contact||'', r.phone||'', r.status||'', r.variant||'A', r.error||'', (r.message||'').replace(/\n/g,' ')]));
  const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `wa-results-${Date.now()}.csv` });
  a.click();
});

// ─── Campaign Controls ────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', startCampaign);
document.getElementById('stopBtn').addEventListener('click', stopCampaign);

function showError(msg) {
  document.getElementById('progressArea').style.display = 'block';
  document.getElementById('progressLabel').textContent  = '⛔ ' + msg;
  document.getElementById('progressBar').style.width    = '0%';
  document.getElementById('progressNums').textContent   = '';
  setStatus('Error', 'error');
  setTimeout(() => { document.getElementById('progressArea').style.display = 'none'; setStatus('Idle',''); }, 5000);
}

function startCampaign() {
  const template  = document.getElementById('msgTemplate').value.trim();
  const templateB = document.getElementById('msgTemplateB').value.trim();
  const abEnabled = document.getElementById('abEnabled').checked;
  // Recover image from preview DOM if state was lost (e.g. tab switch)
  let imageUrl = campaignImageData || null;
  if (!imageUrl) {
    const previewImg = document.getElementById('imagePreviewImg');
    if (previewImg?.src?.startsWith('data:')) {
      imageUrl = previewImg.src;
      const m = imageUrl.match(/^data:([^;]+);/);
      if (m) campaignImageMime = m[1];
      if (!campaignImageName) campaignImageName = 'image.jpg';
    }
  }
  const imageMime = campaignImageMime || 'image/jpeg';
  const imageName = campaignImageName || 'image.jpg';

  if (!contacts.length) return showError('Add contacts first (Contacts tab)');
  if (!template && !imageUrl) return showError('Write a message template (Compose tab) or attach image/video');
  if (abEnabled && !templateB) return showError('Write Message B for A/B testing');
  const campaignAiKey = (settings.aiProvider === 'gemini' ? settings.geminiApiKey : settings.apiKey) || '';
  if (settings.aiEnabled && !campaignAiKey) return showError('Add API key in Settings (Gemini free or Claude)');

  const delaySec = parseInt(document.getElementById('minDelay')?.value) || 15;
  if (delaySec < 5) return showError('Delay must be at least 5 seconds');

  contacts = contacts.map(c => ({ ...c, status: 'pending' }));
  results = []; saveContacts(); renderContacts(); renderLastResults();

  // Auto-enable privacy mode if setting is on
  if (settings.autoPrivacy && !privacyOn) setPrivacy(true);

  isRunning = true; setRunningUI(true);
  setStatus('Starting', 'running');
  setProgress('🚀 Starting campaign...', 0, 0, contacts.length);

  const campaignName = document.getElementById('campaignName')?.value?.trim() || '';
  chrome.runtime.sendMessage({
    type: 'START_CAMPAIGN',
    data: { contacts, template, templateB, abEnabled, imageUrl, imageMime, imageName, settings: { ...settings, minDelay: delaySec, maxDelay: delaySec, campaignName } }
  }, resp => {
    if (chrome.runtime.lastError) { showError('Start failed: ' + chrome.runtime.lastError.message); setRunningUI(false); isRunning = false; }
  });
}

function stopCampaign() {
  chrome.runtime.sendMessage({ type: 'STOP_CAMPAIGN' });
  isRunning = false; setRunningUI(false); setStatus('Stopped', '');
}

// ─── Progress Listener ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'PROGRESS')       handleProgress(msg.data);
  if (msg.type === 'AUTO_REPLY_LOG') addArLogEntry(msg.data);
});
function updateLastMediaErrorDisplay() {
  chrome.storage.local.get('lastMediaError', d => {
    const el = document.getElementById('lastMediaError');
    if (!el) return;
    const txt = d.lastMediaError || '';
    el.textContent = txt;
    el.style.display = txt ? 'block' : 'none';
  });
}

chrome.storage.onChanged.addListener(changes => {
  if (changes.campaignProgress) handleProgress(changes.campaignProgress.newValue);
  if (changes.lastMediaError) updateLastMediaErrorDisplay();
  // Sync pins added/removed from the WA Web sidebar pin buttons
  if (changes.pinnedChats) {
    pinnedChats = changes.pinnedChats.newValue || [];
    renderPinnedChats();
    renderContacts();
  }
});

function handleProgress(data) {
  if (!data) return;
  const pct = data.total ? Math.round(((data.currentIndex + 1) / data.total) * 100) : 0;
  const varBadge = document.getElementById('variantBadge');

  switch (data.status) {
    case 'starting':
      setStatus('Starting', 'running');
      setProgress('🚀 Opening WhatsApp Web...', 0, 0, data.total);
      break;

    case 'personalizing':
      setStatus('Personalizing', 'running');
      setProgress(`🤖 AI personalizing for ${data.contact}...`, pct, data.currentIndex+1, data.total);
      if (data.variant) { varBadge.style.display='inline'; varBadge.textContent='Variant '+data.variant; }
      updateContactStatus(data.phone, data.contact, 'personalizing');
      break;

    case 'sending':
      setStatus('Sending', 'running');
      setProgress(`📤 Sending to ${data.contact}...`, pct, data.currentIndex+1, data.total);
      updateContactStatus(data.phone, data.contact, 'sending');
      break;

    case 'sent':
    case 'failed':
      updateContactStatus(data.phone, data.contact, data.status);
      if (data.status === 'failed' && data.results?.length) {
        const last = data.results[data.results.length - 1];
        if (last?.error) setProgress(`❌ ${data.contact}: ${last.error}`, pct, data.currentIndex+1, data.total);
      }
      if (data.status === 'sent' && data.phone) {
        const ci = contacts.findIndex(c => c.phone === data.phone);
        if (ci >= 0) {
          contacts[ci] = crmDefaults(contacts[ci]);
          contacts[ci].lastContacted = Date.now();
          if (data.preview) contacts[ci].lastMessage = data.preview;
          if (contacts[ci].stage === 'new') contacts[ci].stage = 'contacted';
          saveContacts();
        }
      }
      if (data.results) { results = data.results; renderLastResults(); chrome.storage.local.set({ results }); }
      break;

    case 'waiting':
      setStatus('Waiting', 'waiting');
      setProgress(`⏳ Next in ${data.nextIn}s...`, pct, data.currentIndex+1, data.total);
      break;

    case 'error':
      isRunning = false; setRunningUI(false);
      showError(data.error || 'Unknown error');
      break;

    case 'completed':
      isRunning = false; setRunningUI(false);
      setStatus('Completed', 'completed');
      varBadge.style.display = 'none';
      document.getElementById('progressArea').style.display = 'none';
      if (data.results) { results = data.results; renderLastResults(); chrome.storage.local.set({ results }); }
      // Switch to settings to show results
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="settings"]').classList.add('active');
      document.getElementById('panel-settings').classList.add('active');
      loadAnalytics();
      break;
  }
}

function updateContactStatus(phone, name, status) {
  const idx = contacts.findIndex(c => c.phone === phone || c.name === name);
  if (idx >= 0) { contacts[idx].status = status; renderContacts(); }
}

function renderLastResults() {
  const sent    = results.filter(r => r.status === 'sent').length;
  const failed  = results.filter(r => r.status === 'failed').length;
  const pending = Math.max(0, contacts.length - results.length);
  document.getElementById('statSent').textContent    = sent;
  document.getElementById('statFailed').textContent  = failed;
  document.getElementById('statPending').textContent = pending;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function setRunningUI(running) {
  document.getElementById('startBtn').style.display = running ? 'none' : 'flex';
  document.getElementById('stopBtn').style.display  = running ? 'flex' : 'none';
  if (!running) document.getElementById('progressArea').style.display = 'none';
}

function setStatus(text, type) {
  const el = document.getElementById('statusPill');
  el.textContent = '● ' + text;
  el.className = 'status-pill' + (type ? ' ' + type : '');
}

function setProgress(label, pct, cur, total) {
  document.getElementById('progressArea').style.display = 'block';
  document.getElementById('progressLabel').textContent  = label;
  document.getElementById('progressBar').style.width    = pct + '%';
  document.getElementById('progressNums').textContent   = total ? `${cur} / ${total}` : '';
}

function showResult(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'result-msg ' + (type || '');
  el.style.display = 'block';
  if (type !== 'info') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showToast(msg, type = 'ok') {
  setStatus(msg, type === 'err' ? 'error' : 'completed');
  setTimeout(() => setStatus(isRunning ? 'Running' : 'Idle', isRunning ? 'running' : ''), 3000);
}

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str || '')));
  return d.innerHTML;
}

// ─── PIPELINE TAB ────────────────────────────────────────────────────────────
let pipelineFilter = 'all';

// Stage filter buttons
document.getElementById('stageFilterRow').addEventListener('click', e => {
  const btn = e.target.closest('[data-sf]');
  if (!btn) return;
  pipelineFilter = btn.dataset.sf;
  document.querySelectorAll('.sfbtn').forEach(b => {
    b.classList.toggle('sf-active', b.dataset.sf === pipelineFilter);
  });
  renderPipeline();
});

// Click summary box to filter
document.getElementById('pipelineSummary').addEventListener('click', e => {
  const box = e.target.closest('[data-pf]');
  if (!box) return;
  pipelineFilter = box.dataset.pf;
  document.querySelectorAll('.sfbtn').forEach(b => {
    b.classList.toggle('sf-active', b.dataset.sf === pipelineFilter);
  });
  renderPipeline();
});

function renderPipeline() {
  // Update summary counts
  const counts = { new:0, contacted:0, interested:0, converted:0, lost:0 };
  contacts.forEach(c => { const s = c.stage || 'new'; if (counts[s] !== undefined) counts[s]++; });
  STAGES.forEach(s => {
    const el = document.getElementById(`ps-${s}`);
    if (el) el.textContent = counts[s];
  });

  // Follow-up due today banner
  const today = new Date(); today.setHours(23,59,59,999);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const due = contacts.filter(c => c.followUpDate && new Date(c.followUpDate) >= todayStart && new Date(c.followUpDate) <= today);
  const banner = document.getElementById('fuDueBanner');
  if (banner) {
    banner.style.display = due.length ? 'block' : 'none';
    const ct = document.getElementById('fuDueCount');
    if (ct) ct.textContent = due.length;
  }

  const list = document.getElementById('pipelineList');
  if (!list) return;

  const filtered = pipelineFilter === 'all'
    ? [...contacts]
    : contacts.filter(c => (c.stage || 'new') === pipelineFilter);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No contacts in "${pipelineFilter}" stage.</div>`;
    return;
  }

  list.innerHTML = filtered.map((c, fi) => {
    const i = contacts.indexOf(c);
    const stage   = c.stage || 'new';
    const tags    = c.tags  || [];
    const notes   = c.notes || [];
    const fuDate  = c.followUpDate ? new Date(c.followUpDate) : null;
    const fuOver  = fuDate && fuDate < new Date();
    const lastNote = notes[0]?.text || '';

    const moveBtns = STAGES.filter(s => s !== stage)
      .map(s => `<button class="move-btn mv-${s}" data-move-i="${i}" data-move-s="${s}">${STAGE_LABELS[s]}</button>`).join('');

    return `<div class="pipeline-card">
      <div class="pipeline-card-top">
        <div class="avatar" style="width:28px;height:28px;font-size:12px">${(c.name||c.phone||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="pipeline-card-name">${esc(c.name||c.phone)}</div>
          <div class="pipeline-card-phone">${c.phone}</div>
        </div>
        ${scoreBadgeHTML(c.leadScore)}
        <span class="stage-badge stage-${stage}">${stage}</span>
      </div>
      ${tags.length ? `<div class="tag-row">${tags.map(t=>`<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${lastNote ? `<div class="pipeline-card-note">"${esc(lastNote.substring(0,80))}${lastNote.length>80?'…':''}"</div>` : ''}
      ${fuDate ? `<div class="pipeline-card-fu${fuOver?' overdue':''}">⏰ ${fuOver?'Overdue! ':'Remind: '}${fuDate.toLocaleDateString()}</div>` : ''}
      <div class="pipeline-move-row">${moveBtns}</div>
    </div>`;
  }).join('');

  // Move stage buttons
  list.querySelectorAll('[data-move-i]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.moveI;
      const s = btn.dataset.moveS;
      contacts[i] = crmDefaults(contacts[i]);
      contacts[i].stage = s;
      contacts[i].leadScore = calcLeadScore(contacts[i]);
      saveContacts(); renderPipeline(); renderContacts();
      showToast(`Moved to ${s}`);
    });
  });
}

// ─── TEMPLATE LIBRARY ────────────────────────────────────────────────────────
let templates = [];

chrome.storage.local.get('templates', d => { templates = d.templates || []; renderTemplates(); });

document.getElementById('tpl-saveBtn').addEventListener('click', () => {
  const name = document.getElementById('tpl-name').value.trim();
  const msg  = document.getElementById('tpl-msg').value.trim();
  if (!name) return showResult('tpl-saveResult', '⛔ Enter a template name', 'err');
  if (!msg)  return showResult('tpl-saveResult', '⛔ Enter a message', 'err');
  templates.push({ id: Date.now(), name, message: msg });
  chrome.storage.local.set({ templates });
  document.getElementById('tpl-name').value = '';
  document.getElementById('tpl-msg').value  = '';
  renderTemplates();
  showResult('tpl-saveResult', '✓ Template saved!', 'ok');
});

function renderTemplates() {
  const list = document.getElementById('tpl-list');
  if (!list) return;
  if (!templates.length) {
    list.innerHTML = '<div class="empty-state" style="border:1px solid #21262d;border-radius:8px">No templates yet.</div>';
    return;
  }
  list.innerHTML = templates.map((t, i) => `
    <div class="template-card">
      <div class="template-name">${esc(t.name)}</div>
      <div class="template-preview">${esc(t.message)}</div>
      <div class="template-actions">
        <button class="btn btn-green btn-sm" data-tuse="${i}">⚡ Use</button>
        <button class="btn btn-outline btn-sm" data-tedit="${i}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" data-tdel="${i}">✕</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-tuse]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = templates[+btn.dataset.tuse];
      document.getElementById('qs-message').value = t.message;
      document.getElementById('qs-charcount').textContent = `${t.message.length} chars`;
      showToast(`Template "${t.name}" loaded into Quick Sender`);
    });
  });

  list.querySelectorAll('[data-tedit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.tedit;
      document.getElementById('tpl-name').value = templates[i].name;
      document.getElementById('tpl-msg').value  = templates[i].message;
      templates.splice(i, 1);
      chrome.storage.local.set({ templates });
      renderTemplates();
    });
  });

  list.querySelectorAll('[data-tdel]').forEach(btn => {
    btn.addEventListener('click', () => {
      templates.splice(+btn.dataset.tdel, 1);
      chrome.storage.local.set({ templates });
      renderTemplates();
    });
  });
}

// ─── GOOGLE SHEETS IMPORT ─────────────────────────────────────────────────────
// Load saved sheet URL on init
chrome.storage.local.get('sheetsUrl', d => {
  if (d.sheetsUrl) document.getElementById('sheets-url').value = d.sheetsUrl;
});

document.getElementById('sheets-importBtn').addEventListener('click', () => importFromSheets(false));
document.getElementById('sheets-resyncBtn').addEventListener('click', () => importFromSheets(true));

async function importFromSheets(isResync) {
  const urlVal = document.getElementById('sheets-url').value.trim();
  if (!urlVal) return showResult('sheets-result', '⛔ Paste a Google Sheets URL first', 'err');

  // Extract sheet ID and optional gid from URL
  const idMatch  = urlVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = urlVal.match(/[?&]gid=(\d+)/);
  if (!idMatch) return showResult('sheets-result', '⛔ Not a valid Google Sheets URL', 'err');

  const sheetId = idMatch[1];
  const gid     = gidMatch ? gidMatch[1] : '0';
  const csvUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const btn = document.getElementById('sheets-importBtn');
  const rBtn = document.getElementById('sheets-resyncBtn');
  btn.disabled = rBtn.disabled = true;
  showResult('sheets-result', '⏳ Fetching sheet...', 'info');

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} — make sure the sheet is shared publicly`);
    const csv = await res.text();
    if (!csv.trim()) throw new Error('Sheet appears to be empty');

    // Save URL for re-sync
    chrome.storage.local.set({ sheetsUrl: urlVal });

    // If re-sync, clear existing contacts first
    if (isResync) contacts = [];

    const before = contacts.length;
    importCSV(csv);
    const added = contacts.length - before;
    showResult('sheets-result', `✓ ${isResync ? 'Re-synced' : 'Imported'} ${added} contacts from Google Sheets`, 'ok');
  } catch (e) {
    showResult('sheets-result', '⛔ ' + e.message, 'err');
  } finally {
    btn.disabled = rBtn.disabled = false;
  }
}

// ─── AUTO REPLY TAB ───────────────────────────────────────────────────────────
let autoReplyActive = false;
let arLogEntries    = [];

// Mode switching
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const mode = tab.dataset.mode;
    document.getElementById('arTemplateMode').style.display = mode === 'template' ? 'block' : 'none';
    document.getElementById('arAIMode').style.display       = mode === 'ai'       ? 'block' : 'none';
  });
});

// Delay slider label
document.getElementById('arDelay').addEventListener('input', e => {
  const v = e.target.value;
  document.getElementById('arDelayLabel').textContent = `${v}s`;
});

// One-click Start automatic chat (no template, no manual config)
document.getElementById('arAutoChatBtn')?.addEventListener('click', () => {
  document.getElementById('arFullyAuto').checked = true;
  document.getElementById('arPerChat').checked = true;
  document.getElementById('arNoKeywordUseAI').checked = true;
  document.getElementById('arKeyword').value = '';
  const aiTab = document.querySelector('.mode-tab[data-mode="ai"]');
  if (aiTab) { document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active')); aiTab.classList.add('active'); document.getElementById('arTemplateMode').style.display = 'none'; document.getElementById('arAIMode').style.display = 'block'; }
  document.getElementById('arToggle').checked = true;
  startAutoReplyBot();
});

// Fully automatic: sync options when toggled
document.getElementById('arFullyAuto')?.addEventListener('change', e => {
  if (e.target.checked) {
    document.getElementById('arPerChat').checked = true;
    document.getElementById('arNoKeywordUseAI').checked = true;
    document.getElementById('arKeyword').value = '';
    const aiTab = document.querySelector('.mode-tab[data-mode="ai"]');
    if (aiTab) { document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active')); aiTab.classList.add('active'); document.getElementById('arTemplateMode').style.display = 'none'; document.getElementById('arAIMode').style.display = 'block'; }
  }
});

// Toggle checkbox
document.getElementById('arToggle').addEventListener('change', async e => {
  if (!e.target.checked) { stopAutoReplyBot(); return; }
  const aiEnabled = document.getElementById('aiEnabled')?.checked;
  if (aiEnabled) {
    const lic = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_LICENSE' }, r));
    if (!lic.canUsePro) {
      if (!lic.trialUsed) {
        const started = await new Promise(r => chrome.runtime.sendMessage({ type: 'START_TRIAL' }, r));
        if (started?.started) { showToast(`Pro trial started — ${started.trialDaysLeft} days left`, 'ok'); renderPlanBadge(); }
      } else {
        showToast('AI Auto Reply is a Pro feature. Upgrade at wabulkai.com', 'err');
        e.target.checked = false;
        return;
      }
    }
  }
  startAutoReplyBot();
});

// Start / Stop buttons
document.getElementById('arStartBtn').addEventListener('click', () => {
  document.getElementById('arToggle').checked = true;
  startAutoReplyBot();
});
document.getElementById('arStopBtn').addEventListener('click', () => {
  document.getElementById('arToggle').checked = false;
  stopAutoReplyBot();
});

// Clear log
document.getElementById('arClearLog').addEventListener('click', () => {
  arLogEntries = [];
  renderArLog();
});

function startAutoReplyBot() {
  const mode     = document.querySelector('.mode-tab.active')?.dataset.mode || 'template';
  const template = document.getElementById('arTemplate').value.trim() || "Thanks for your message! I'll get back to you soon.";
  const prompt   = document.getElementById('arPrompt').value.trim()   || 'Reply naturally and briefly to the message.';
  const delay    = parseInt(document.getElementById('arDelay').value)  || 2;
  const keyword  = document.getElementById('arKeyword').value.trim();
  const noKeywordReply = document.getElementById('arNoKeywordReply')?.value?.trim() || '';
  const noKeywordUseAI = !!document.getElementById('arNoKeywordUseAI')?.checked;

  const provider = settings.aiProvider || 'gemini';
  const apiKey = provider === 'gemini' ? (settings.geminiApiKey || '') : (settings.apiKey || '');
  if ((mode === 'ai' || noKeywordUseAI) && !apiKey) {
    showToast(provider === 'gemini' ? 'Add Gemini API key in Settings (free at aistudio.google.com)' : 'Add Claude API key in Settings first', 'err');
    document.getElementById('arToggle').checked = false;
    return;
  }

  const perChat = !!document.getElementById('arPerChat')?.checked;
  const fullyAuto = !!document.getElementById('arFullyAuto')?.checked;
  if (fullyAuto && !apiKey) {
    showToast('Fully automatic needs an AI key (Settings → Gemini or Claude)', 'err');
    document.getElementById('arToggle').checked = false;
    return;
  }
  const config = {
    mode: fullyAuto ? 'ai' : mode,
    template,
    prompt: fullyAuto ? (prompt || 'Reply naturally and briefly. Be helpful and concise.') : prompt,
    delay,
    keyword: fullyAuto ? '' : keyword,
    noKeywordReply: fullyAuto ? '' : noKeywordReply,
    noKeywordUseAI: fullyAuto ? true : noKeywordUseAI,
    apiKey,
    provider,
    bizHours: settings.bizHours || null,
    perChat: fullyAuto ? true : perChat,
    processAllUnread: !!fullyAuto
  };

  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
    if (!tabs.length) {
      showToast('Open WhatsApp Web first', 'err');
      document.getElementById('arToggle').checked = false;
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'START_AUTO_REPLY', config }, resp => {
      if (resp?.success) {
        autoReplyActive = true;
        document.getElementById('arStartBtn').style.display = 'none';
        document.getElementById('arStopBtn').style.display  = 'block';
        const acBtn = document.getElementById('arAutoChatBtn');
        if (acBtn) acBtn.style.display = 'none';
        document.getElementById('arPulseDot').style.display = 'inline-block';
        document.getElementById('arStatusText').textContent = fullyAuto ? 'Bot active — fully automatic (all chats)' : (perChat ? `Bot active — ${mode} (all chats)` : `Bot active — ${mode} mode`);
        addArLogEntry({ incoming: null, reply: '🟢 Bot started (' + mode + ' mode)', success: true, ts: Date.now(), system: true });
      } else {
        document.getElementById('arToggle').checked = false;
        showToast(resp?.error || 'Could not start bot — is WhatsApp Web open?', 'err');
      }
    });
  });
}

function stopAutoReplyBot() {
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTO_REPLY' }, () => {}));
  });
  autoReplyActive = false;
  document.getElementById('arStartBtn').style.display = 'block';
  document.getElementById('arStopBtn').style.display  = 'none';
  const acBtn = document.getElementById('arAutoChatBtn');
  if (acBtn) acBtn.style.display = '';
  document.getElementById('arPulseDot').style.display = 'none';
  document.getElementById('arStatusText').textContent = 'Bot is off';
  addArLogEntry({ incoming: null, reply: '🔴 Bot stopped', success: true, ts: Date.now(), system: true });
}

function addArLogEntry(data) {
  arLogEntries.unshift(data);
  if (arLogEntries.length > 60) arLogEntries.pop();
  renderArLog();
}

function renderArLog() {
  const el = document.getElementById('arLog');
  if (!arLogEntries.length) {
    el.innerHTML = '<div class="empty-state">No auto-replies yet.</div>';
    return;
  }
  el.innerHTML = arLogEntries.map(e => {
    if (e.system) {
      return `<div class="ar-log-system">${esc(e.reply)} — ${new Date(e.ts).toLocaleTimeString()}</div>`;
    }
    return `<div class="ar-log-item">
      <span class="ar-log-time">${new Date(e.ts).toLocaleTimeString()}</span>
      <div class="ar-log-in">📥 ${esc((e.incoming||'').substring(0, 60))}${(e.incoming||'').length > 60 ? '…' : ''}</div>
      <div class="ar-log-out">${e.success ? '✅' : '❌'} ${esc((e.reply||'').substring(0, 60))}${(e.reply||'').length > 60 ? '…' : ''}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Drip Campaigns, Segments, DNC, Advanced Analytics
// ═══════════════════════════════════════════════════════════════════

// ─── DRIP CAMPAIGNS TAB ───────────────────────────────────────────────────────
let dripSequences  = [];
let dripEnrollments = [];
let dripBuilderSteps = []; // temp state while building

// Init drip data
chrome.runtime.sendMessage({ type: 'GET_DRIP' }, resp => {
  if (resp?.success) {
    dripSequences   = resp.sequences   || [];
    dripEnrollments = resp.enrollments || [];
    renderDripSeqList();
    renderDripEnrollList();
  }
});

// Tab switch loads drip fresh
document.querySelectorAll('.tab').forEach(t => {
  if (t.dataset.tab === 'drip') {
    t.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'GET_DRIP' }, resp => {
        if (resp?.success) {
          dripSequences   = resp.sequences   || [];
          dripEnrollments = resp.enrollments || [];
          renderDripSeqList();
          renderDripEnrollList();
        }
      });
    });
  }
});

document.getElementById('drip-refreshBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_DRIP' }, resp => {
    if (resp?.success) {
      dripSequences   = resp.sequences   || [];
      dripEnrollments = resp.enrollments || [];
      renderDripSeqList();
      renderDripEnrollList();
      showToast('Drip data refreshed');
    }
  });
});

// Add step to builder
document.getElementById('drip-addStepBtn').addEventListener('click', () => {
  dripBuilderSteps.push({ delay: 1, unit: 'days', template: '' });
  renderDripSteps();
});

// Clear builder
document.getElementById('drip-clearBuilderBtn').addEventListener('click', () => {
  dripBuilderSteps = [];
  document.getElementById('drip-name').value = '';
  renderDripSteps();
});

function renderDripSteps() {
  const container = document.getElementById('drip-steps');
  if (!dripBuilderSteps.length) {
    container.innerHTML = '<div class="hint" style="text-align:center;padding:12px">No steps yet. Click "+ Add Step" to begin.</div>';
    return;
  }
  container.innerHTML = dripBuilderSteps.map((step, i) => `
    <div class="drip-step-card" data-step="${i}">
      <div class="drip-step-num">Step ${i + 1}</div>
      <div class="drip-step-row">
        <span class="label-sm" style="flex-shrink:0">Send after</span>
        <input type="number" class="input drip-delay-inp" data-si="${i}" value="${step.delay}" min="1" style="width:60px;padding:4px 6px;text-align:center">
        <select class="input drip-unit-sel" data-si="${i}" style="width:80px;padding:4px 6px">
          <option value="hours"${step.unit==='hours'?' selected':''}>Hours</option>
          <option value="days"${step.unit==='days'?' selected':''}>Days</option>
        </select>
        <button class="drip-step-del" data-sdel="${i}" title="Remove step">✕</button>
      </div>
      <textarea class="textarea drip-tpl-inp" data-si="${i}" rows="2"
        placeholder="Message for step ${i+1}. Use {name}, {phone}, etc.">${esc(step.template)}</textarea>
    </div>`).join('');

  container.querySelectorAll('.drip-delay-inp').forEach(inp => {
    inp.addEventListener('input', () => { dripBuilderSteps[+inp.dataset.si].delay = +inp.value || 1; });
  });
  container.querySelectorAll('.drip-unit-sel').forEach(sel => {
    sel.addEventListener('change', () => { dripBuilderSteps[+sel.dataset.si].unit = sel.value; });
  });
  container.querySelectorAll('.drip-tpl-inp').forEach(ta => {
    ta.addEventListener('input', () => { dripBuilderSteps[+ta.dataset.si].template = ta.value; });
  });
  container.querySelectorAll('[data-sdel]').forEach(btn => {
    btn.addEventListener('click', () => {
      dripBuilderSteps.splice(+btn.dataset.sdel, 1);
      renderDripSteps();
    });
  });
}
renderDripSteps(); // render empty state

// Save sequence
document.getElementById('drip-saveSeqBtn').addEventListener('click', () => {
  const name = document.getElementById('drip-name').value.trim();
  if (!name) return showResult('drip-saveResult', '⛔ Enter a sequence name', 'err');
  if (!dripBuilderSteps.length) return showResult('drip-saveResult', '⛔ Add at least one step', 'err');
  if (dripBuilderSteps.some(s => !s.template.trim())) return showResult('drip-saveResult', '⛔ All steps need a message', 'err');

  const sequence = { id: Date.now(), name, steps: dripBuilderSteps.map(s => ({ ...s })) };
  chrome.runtime.sendMessage({ type: 'SAVE_DRIP_SEQ', data: { sequence } }, resp => {
    if (resp?.success) {
      dripSequences.push(sequence);
      dripBuilderSteps = [];
      document.getElementById('drip-name').value = '';
      renderDripSteps();
      renderDripSeqList();
      showResult('drip-saveResult', `✓ Sequence "${name}" saved (${sequence.steps.length} steps)`, 'ok');
    } else {
      showResult('drip-saveResult', '⛔ Save failed', 'err');
    }
  });
});

function renderDripSeqList() {
  const list = document.getElementById('drip-seqList');
  if (!dripSequences.length) {
    list.innerHTML = '<div class="empty-state">No sequences yet. Build one above.</div>';
    return;
  }
  list.innerHTML = dripSequences.map((seq, i) => `
    <div class="drip-seq-card">
      <div class="drip-seq-name">${esc(seq.name)}</div>
      <div class="drip-seq-meta">${seq.steps.length} step${seq.steps.length !== 1 ? 's' : ''} — ${seq.steps.map((s,si) => `Step ${si+1}: +${s.delay}${s.unit[0]}`).join(' → ')}</div>
      <div class="drip-seq-actions">
        <button class="btn btn-green btn-sm" data-denroll="${i}">▶ Enroll All Contacts</button>
        <button class="btn btn-outline btn-sm" data-dedit="${i}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" data-ddel="${i}">✕ Delete</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-denroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const seq = dripSequences[+btn.dataset.denroll];
      if (!contacts.length) return showToast('Add contacts first', 'err');
      btn.disabled = true; btn.textContent = '⏳ Enrolling...';
      chrome.runtime.sendMessage({ type: 'ENROLL_DRIP', data: { contacts, seqId: seq.id } }, resp => {
        btn.disabled = false; btn.textContent = '▶ Enroll All Contacts';
        if (resp?.success) {
          showToast(`✓ Enrolled ${resp.enrolled} contacts in "${seq.name}"`);
          chrome.runtime.sendMessage({ type: 'GET_DRIP' }, r => {
            if (r?.success) { dripEnrollments = r.enrollments || []; renderDripEnrollList(); }
          });
        } else {
          showToast(resp?.error || 'Enroll failed', 'err');
        }
      });
    });
  });

  list.querySelectorAll('[data-dedit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const seq = dripSequences[+btn.dataset.dedit];
      document.getElementById('drip-name').value = seq.name;
      dripBuilderSteps = seq.steps.map(s => ({ ...s }));
      renderDripSteps();
      // Switch to builder (scroll up)
      document.getElementById('drip-name').scrollIntoView({ behavior: 'smooth' });
    });
  });

  list.querySelectorAll('[data-ddel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const seq = dripSequences[+btn.dataset.ddel];
      if (!confirm(`Delete sequence "${seq.name}"? This will also unenroll all contacts.`)) return;
      chrome.runtime.sendMessage({ type: 'DELETE_DRIP_SEQ', data: { id: seq.id } }, resp => {
        if (resp?.success) {
          dripSequences.splice(+btn.dataset.ddel, 1);
          dripEnrollments = dripEnrollments.filter(e => e.seqId !== seq.id);
          renderDripSeqList(); renderDripEnrollList();
          showToast(`Sequence "${seq.name}" deleted`);
        }
      });
    });
  });
}

function renderDripEnrollList() {
  const list = document.getElementById('drip-enrollList');
  if (!dripEnrollments.length) {
    list.innerHTML = '<div class="empty-state">No active enrollments.</div>';
    return;
  }
  list.innerHTML = dripEnrollments.map((e, i) => {
    const seq = dripSequences.find(s => s.id === e.seqId);
    const nextDate = e.nextAt ? new Date(e.nextAt).toLocaleString() : '—';
    return `<div class="drip-enroll-row">
      <div class="drip-enroll-name">${esc(e.name || e.phone)}</div>
      <div class="drip-enroll-seq">${esc(seq?.name || 'Unknown Seq')}</div>
      <div style="font-size:10px;color:#8b949e">Step ${e.step + 1}/${seq?.steps?.length || '?'}</div>
      <div class="drip-enroll-next">⏰ ${nextDate}</div>
      <button class="btn btn-danger btn-sm" data-unenroll="${i}">Unenroll</button>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-unenroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const e = dripEnrollments[+btn.dataset.unenroll];
      chrome.runtime.sendMessage({ type: 'UNENROLL_DRIP', data: { phone: e.phone, seqId: e.seqId } }, resp => {
        if (resp?.success) {
          dripEnrollments.splice(+btn.dataset.unenroll, 1);
          renderDripEnrollList();
          showToast('Unenrolled');
        }
      });
    });
  });
}

// ─── CONTACT SEGMENTS ─────────────────────────────────────────────────────────
let segments = [];
let activeSegmentFilter = null;

chrome.storage.local.get('segments', d => { segments = d.segments || []; renderSegments(); });

document.getElementById('seg-saveBtn').addEventListener('click', () => {
  const name = document.getElementById('seg-name').value.trim();
  if (!name) return showToast('Enter a segment name', 'err');

  const stages   = [...document.getElementById('seg-stages').selectedOptions].map(o => o.value);
  const statuses = [...document.getElementById('seg-statuses').selectedOptions].map(o => o.value);

  segments.push({ id: Date.now(), name, filter: { stages, statuses } });
  chrome.storage.local.set({ segments });
  document.getElementById('seg-name').value = '';
  document.getElementById('seg-stages').selectedIndex = -1;
  document.getElementById('seg-statuses').selectedIndex = -1;
  renderSegments();
  showToast(`✓ Segment "${name}" saved`);
});

document.getElementById('seg-clearFilterBtn').addEventListener('click', () => {
  activeSegmentFilter = null;
  document.getElementById('seg-clearFilterBtn').style.display = 'none';
  renderContacts();
});

function applySegmentFilter(contactList, filter) {
  return contactList.filter(c => {
    if (filter.stages?.length && !filter.stages.includes(c.stage || 'new')) return false;
    if (filter.statuses?.length && !filter.statuses.includes(c.status || 'pending')) return false;
    return true;
  });
}

function getSegmentCount(seg) {
  return applySegmentFilter(contacts, seg.filter).length;
}

function renderSegments() {
  const list = document.getElementById('seg-list');
  if (!segments.length) {
    list.innerHTML = '<div class="muted-text" style="font-size:11px">No segments yet.</div>';
    return;
  }
  list.innerHTML = segments.map((seg, i) => {
    const count = getSegmentCount(seg);
    const isActive = activeSegmentFilter?.id === seg.id;
    return `<div class="segment-chip${isActive?' active':''}" data-segi="${i}">
      ${esc(seg.name)}<span class="segment-chip-count">${count}</span>
      <button class="remove-tag" data-segdel="${i}" title="Delete segment">×</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.segment-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.dataset.segdel !== undefined) return;
      const i = +chip.dataset.segi;
      if (activeSegmentFilter?.id === segments[i].id) {
        activeSegmentFilter = null;
        document.getElementById('seg-clearFilterBtn').style.display = 'none';
      } else {
        activeSegmentFilter = segments[i];
        document.getElementById('seg-clearFilterBtn').style.display = 'inline-flex';
        showToast(`Filtering: ${segments[i].name} (${getSegmentCount(segments[i])} contacts)`);
      }
      renderSegments();
      renderContactsFiltered();
    });
  });

  list.querySelectorAll('[data-segdel]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.segdel;
      if (activeSegmentFilter?.id === segments[i].id) {
        activeSegmentFilter = null;
        document.getElementById('seg-clearFilterBtn').style.display = 'none';
      }
      segments.splice(i, 1);
      chrome.storage.local.set({ segments });
      renderSegments();
      renderContactsFiltered();
    });
  });

  // Show blast button if a segment is active
  const blastRow = document.getElementById('seg-blastRow');
  if (blastRow) blastRow.remove();
  if (activeSegmentFilter) {
    const filtered = applySegmentFilter(contacts, activeSegmentFilter.filter);
    if (filtered.length) {
      const row = document.createElement('div');
      row.id = 'seg-blastRow';
      row.className = 'seg-blast-row';
      row.innerHTML = `<span class="hint"><strong style="color:#25D366">${filtered.length}</strong> contacts match "${esc(activeSegmentFilter.name)}"</span>
        <button class="btn btn-green btn-sm" id="seg-blastBtn">🚀 Blast to Segment</button>`;
      document.getElementById('seg-list').after(row);
      document.getElementById('seg-blastBtn').addEventListener('click', () => {
        const template = document.getElementById('msgTemplate').value.trim();
        if (!template) { showToast('Write a template in the Compose tab first', 'err'); return; }
        const delaySec = parseInt(document.getElementById('minDelay')?.value) || 15;
        filtered.forEach(c => c.status = 'pending');
        saveContacts();
        isRunning = true; setRunningUI(true); setStatus('Starting', 'running');
        chrome.runtime.sendMessage({
          type: 'START_CAMPAIGN',
          data: { contacts: filtered, template, abEnabled: false, settings: { ...settings, minDelay: delaySec, maxDelay: delaySec } }
        }, resp => {
          if (!resp?.success) { showError(resp?.error || 'Failed'); setRunningUI(false); isRunning = false; }
        });
      });
    }
  }
}

function renderContactsFiltered() {
  if (!activeSegmentFilter) { renderContacts(); return; }
  const filtered = applySegmentFilter(contacts, activeSegmentFilter.filter);
  document.getElementById('contactCount').textContent = `${filtered.length} of ${contacts.length} contacts`;
  const list = document.getElementById('contactList');
  if (!filtered.length) { list.innerHTML = '<div class="empty-state">No contacts match this segment.</div>'; return; }
  list.innerHTML = filtered.map(c => {
    const i = contacts.indexOf(c);
    return contactCardHTML(crmDefaults(c), i);
  }).join('');
  attachContactListEvents();
}

// ─── DNC MANAGEMENT ───────────────────────────────────────────────────────────
let dncList = [];

function loadDNC() {
  chrome.runtime.sendMessage({ type: 'GET_DNC' }, resp => {
    dncList = resp?.dnc || [];
    renderDNC();
  });
}

// Load on settings tab switch
document.querySelectorAll('.tab').forEach(t => {
  if (t.dataset.tab === 'settings') t.addEventListener('click', loadDNC);
});
loadDNC();

document.getElementById('dnc-addBtn').addEventListener('click', () => {
  const val = document.getElementById('dnc-addInput').value.trim().replace(/[^0-9+]/g, '');
  if (!val) return showToast('Enter a phone number to block', 'err');
  chrome.runtime.sendMessage({ type: 'ADD_DNC', data: { phones: [val] } }, () => {
    document.getElementById('dnc-addInput').value = '';
    loadDNC();
    showToast(`🚫 ${val} blocked`);
  });
});

document.getElementById('dnc-clearBtn').addEventListener('click', () => {
  if (!dncList.length) return;
  if (!confirm(`Remove all ${dncList.length} numbers from DNC list?`)) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_DNC' }, () => { loadDNC(); showToast('DNC list cleared'); });
});

function renderDNC() {
  document.getElementById('dnc-count').textContent = `${dncList.length} blocked`;
  const list = document.getElementById('dnc-list');
  if (!dncList.length) {
    list.innerHTML = '<div class="empty-state">No blocked numbers.</div>';
    return;
  }
  list.innerHTML = dncList.map((p, i) => `
    <div class="dnc-row">
      <span class="dnc-phone">+${p}</span>
      <span class="dnc-badge">BLOCKED</span>
      <button class="btn btn-outline btn-sm" data-dncrem="${i}" style="font-size:10px;padding:2px 8px">Unblock</button>
    </div>`).join('');

  list.querySelectorAll('[data-dncrem]').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = dncList[+btn.dataset.dncrem];
      chrome.runtime.sendMessage({ type: 'REMOVE_DNC', data: { phone } }, () => {
        loadDNC();
        showToast(`✓ ${phone} unblocked`);
      });
    });
  });
}

// ─── ADVANCED ANALYTICS CHARTS ────────────────────────────────────────────────
function drawBarChart(canvasId, days) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 10, bottom: 22, left: 8, right: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  if (!days.length) {
    ctx.fillStyle = '#484f58';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No campaign data yet', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...days.map(d => d.sent + d.failed), 1);
  const colW   = chartW / days.length;
  const barW   = Math.max(colW * 0.55, 8);

  days.forEach((d, i) => {
    const x      = PAD.left + i * colW + (colW - barW) / 2;
    const sentH  = (d.sent   / maxVal) * chartH;
    const failH  = (d.failed / maxVal) * chartH;
    const totalH = sentH + failH;

    // Failed (red) below sent
    if (failH > 0) {
      ctx.fillStyle = '#da3633aa';
      ctx.fillRect(x, PAD.top + chartH - totalH, barW, failH);
    }
    // Sent (green) on top
    if (sentH > 0) {
      ctx.fillStyle = '#25D366cc';
      ctx.fillRect(x, PAD.top + chartH - sentH, barW, sentH - failH);
    }
    // Total bar if nothing
    if (!sentH && !failH) {
      ctx.fillStyle = '#21262d';
      ctx.fillRect(x, PAD.top + chartH - 4, barW, 4);
    }

    // Date label
    ctx.fillStyle = '#8b949e';
    ctx.font      = '9px sans-serif';
    ctx.textAlign = 'center';
    const label   = d.dateStr.slice(-5); // MM/DD
    ctx.fillText(label, x + barW / 2, H - 4);
  });

  // Legend
  ctx.fillStyle = '#25D366';
  ctx.fillRect(PAD.left, 1, 8, 8);
  ctx.fillStyle = '#c9d1d9';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Sent', PAD.left + 11, 9);

  ctx.fillStyle = '#da3633';
  ctx.fillRect(PAD.left + 42, 1, 8, 8);
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText('Failed', PAD.left + 53, 9);
}

function drawFunnel(canvasId, stageCounts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const stages = [
    { key: 'new',       label: '🔵 New',       color: '#58a6ff' },
    { key: 'contacted', label: '🟡 Contacted',  color: '#d29922' },
    { key: 'interested',label: '🟠 Interested', color: '#f0883e' },
    { key: 'converted', label: '🟢 Converted',  color: '#25D366' },
    { key: 'lost',      label: '⚫ Lost',       color: '#484f58' },
  ];

  const maxVal = Math.max(...stages.map(s => stageCounts[s.key] || 0), 1);
  const rowH = H / stages.length;
  const PAD  = { left: 70, right: 50 };
  const maxW = W - PAD.left - PAD.right;

  stages.forEach((s, i) => {
    const count = stageCounts[s.key] || 0;
    const barW  = (count / maxVal) * maxW;
    const y     = i * rowH;
    const cy    = y + rowH / 2;

    // Bar
    ctx.fillStyle = s.color + '33';
    ctx.fillRect(PAD.left, y + 3, maxW, rowH - 6);
    ctx.fillStyle = s.color;
    if (barW > 0) ctx.fillRect(PAD.left, y + 3, barW, rowH - 6);

    // Label left
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(s.label, PAD.left - 4, cy + 4);

    // Count right
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'left';
    ctx.fillText(count, PAD.left + maxW + 5, cy + 4);
  });
}

// Hook into loadAnalytics to draw charts + dashboard
const _origLoadAnalytics = loadAnalytics;
loadAnalytics = function() {
  _origLoadAnalytics();
  renderDashboard();
  // Fetch contacts for funnel
  chrome.storage.local.get(['analytics', 'contacts'], d => {
    const a = d.analytics || { campaigns: [] };
    const allContacts = d.contacts || [];

    // Build 7-day data
    const today = new Date();
    const days7 = [];
    for (let k = 6; k >= 0; k--) {
      const d2 = new Date(today);
      d2.setDate(today.getDate() - k);
      const dateStr = d2.toLocaleDateString();
      const dayCamps = a.campaigns.filter(c => c.date === dateStr);
      days7.push({
        dateStr,
        sent:   dayCamps.reduce((s, c) => s + (c.sent   || 0), 0),
        failed: dayCamps.reduce((s, c) => s + (c.failed || 0), 0),
      });
    }
    drawBarChart('chart-activity', days7);

    // Build funnel
    const stageCounts = { new: 0, contacted: 0, interested: 0, converted: 0, lost: 0 };
    allContacts.forEach(c => { const s = c.stage || 'new'; if (stageCounts[s] !== undefined) stageCounts[s]++; });
    drawFunnel('chart-funnel', stageCounts);
  });
};

// ═══════════════════════════════════════════════════════════════════
// PHASE 5 — AI Lead Scoring, Smart Send Time, Dashboard, PDF Reports
// ═══════════════════════════════════════════════════════════════════

// ─── AI LEAD SCORING ─────────────────────────────────────────────────────────
function calcLeadScore(contact) {
  // DNC tag → score 0
  if ((contact.tags || []).includes('❌ DNC')) return 0;

  const stage = contact.stage || 'new';
  const base  = { new:20, contacted:40, interested:65, converted:90, lost:5 }[stage] || 20;

  let bonus = 0;
  const tags = contact.tags || [];
  if (tags.includes('🔥 Hot Lead'))  bonus += 15;
  if (tags.includes('⭐ VIP'))        bonus += 10;
  if (tags.includes('👤 Customer'))  bonus += 8;
  if (tags.includes('🔄 Follow-up')) bonus += 5;
  if ((contact.notes || []).length > 0) bonus += 5;

  if (contact.lastContacted) {
    const daysSince = (Date.now() - contact.lastContacted) / 86400000;
    if (daysSince < 7)  bonus += 10;
    else if (daysSince < 30) bonus += 5;
  }

  if (contact.status === 'sent')   bonus += 5;
  if (contact.status === 'failed') bonus -= 5;

  return Math.min(100, Math.max(1, base + bonus));
}

// "Score All" button
document.getElementById('scoreAllBtn').addEventListener('click', () => {
  let changed = 0;
  contacts.forEach(c => {
    const newScore = calcLeadScore(c);
    if (c.leadScore !== newScore) { c.leadScore = newScore; changed++; }
  });
  saveContacts();
  renderContacts();
  renderPipeline();
  showToast(`🏆 Scored ${contacts.length} contacts (${changed} updated)`);
});

// ─── SMART SEND TIME ─────────────────────────────────────────────────────────
function getOptimalHour(timestamps) {
  if (!timestamps?.length) return null;
  const freq = {};
  timestamps.forEach(ts => {
    const h = new Date(ts).getHours();
    freq[h] = (freq[h] || 0) + 1;
  });
  return +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

document.getElementById('smartScheduleBtn').addEventListener('click', () => {
  const allTs = contacts.flatMap(c => c.replyTimestamps || []);
  const optHour = getOptimalHour(allTs);

  if (optHour === null) {
    showToast('No reply data yet — scan replies after a campaign first', 'err');
    return;
  }

  const now  = new Date();
  const next = new Date();
  next.setHours(optHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  // Format for datetime-local: YYYY-MM-DDTHH:MM
  const iso = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('scheduleTime').value = iso;
  showToast(`⏰ Smart Schedule set to ~${formatHour(optHour)} (${allTs.length} data points)`);
});

// ─── MULTI-CAMPAIGN DASHBOARD ─────────────────────────────────────────────────
let dashboardFilter = 'all';

function renderDashboard() {
  const el = document.getElementById('dashboard-campaigns');
  if (!el) return;

  Promise.all([
    new Promise(res => chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' }, res)),
    new Promise(res => chrome.storage.local.get('scheduledCampaign', d => res(d.scheduledCampaign || null)))
  ]).then(([analyticsResp, scheduled]) => {
    if (!analyticsResp?.analytics) return;
    const a = analyticsResp.analytics;

    let campaigns = [...a.campaigns].reverse();

    const now = new Date();
    if (dashboardFilter === 'today') {
      const todayStr = now.toLocaleDateString();
      campaigns = campaigns.filter(c => c.date === todayStr);
    } else if (dashboardFilter === 'week') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      campaigns = campaigns.filter(c => (c.ts || 0) >= weekAgo);
    } else if (dashboardFilter === 'month') {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      campaigns = campaigns.filter(c => (c.ts || 0) >= monthAgo);
    }

    let html = '';

    // Scheduled campaign banner
    if (scheduled) {
      html += `<div class="dashboard-card" id="db-scheduled-card">
        <div class="row justify-between align-center mb-6">
          <div>
            <span class="history-badge" style="background:#2a2a1a;color:#d29922;border:1px solid #d2992240">⏳ Scheduled</span>
            <span class="muted-text" style="font-size:11px;margin-left:8px">${(scheduled.contacts||[]).length} contacts queued</span>
          </div>
          <button class="btn btn-danger btn-sm" id="db-cancelScheduled" style="font-size:11px;padding:4px 10px">Cancel</button>
        </div>
        <div class="hint">Template: ${esc((scheduled.template || '').substring(0, 60))}${(scheduled.template||'').length > 60 ? '…' : ''}</div>
      </div>`;
    }

    if (!campaigns.length && !scheduled) {
      el.innerHTML = '<div class="empty-state">No campaigns yet. Run or schedule a campaign to see it here.</div>';
      return;
    }

    html += campaigns.map((c, i) => {
      const name = c.name ? esc(c.name) : `Campaign`;
      const pct  = c.total > 0 ? Math.round(c.sent / c.total * 100) : 0;
      const resultRows = (c.results || []).slice(0, 200).map(r => `
        <div class="campaign-result-row">
          <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9d1d9">${esc(r.contact || r.phone)}</span>
          <span class="status-chip ${r.status}" style="flex-shrink:0">${r.status === 'sent' ? '✓ sent' : r.status === 'failed' ? '✗ failed' : '⊘ skip'}</span>
          ${r.error ? `<span class="hint" style="font-size:10px;flex-shrink:0;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((r.error||'').substring(0,30))}</span>` : ''}
        </div>`).join('');

      return `<div class="dashboard-card">
        <div class="row justify-between align-center mb-4">
          <div style="flex:1;min-width:0">
            <div class="section-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
            <div class="hint" style="font-size:10px">${c.date} · ${c.total} contacts</div>
          </div>
          <button class="btn btn-danger btn-sm" data-db-del="${c.ts || i}" style="font-size:10px;padding:3px 8px;margin-left:8px;flex-shrink:0">Delete</button>
        </div>
        ${c.templatePreview ? `<div class="hint mb-6" style="font-style:italic;font-size:11px">"${esc(c.templatePreview)}${(c.templatePreview||'').length >= 80 ? '…' : ''}"</div>` : ''}
        <div class="row gap-6 mb-6 align-center">
          <div style="flex:1;height:5px;background:#21262d;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:#25D366;border-radius:3px;transition:width .4s"></div>
          </div>
          <span style="font-size:10px;color:#8b949e;white-space:nowrap;flex-shrink:0">✓${c.sent} ✗${c.failed}</span>
        </div>
        ${(c.results||[]).length ? `
          <button class="btn btn-outline btn-sm db-expand-btn" data-db-expand="${i}" style="width:100%;font-size:11px">▸ Expand ${c.results.length} Results</button>
          <div id="db-results-${i}" style="display:none;margin-top:6px;max-height:200px;overflow-y:auto;border:1px solid #21262d;border-radius:6px">
            ${resultRows}
          </div>` : ''}
      </div>`;
    }).join('');

    el.innerHTML = html;

    // Cancel scheduled
    const cancelBtn = document.getElementById('db-cancelScheduled');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (!confirm('Cancel scheduled campaign?')) return;
        chrome.storage.local.remove('scheduledCampaign');
        chrome.alarms.getAll(alarms => {
          alarms.filter(al => al.name.startsWith('scheduled-campaign-')).forEach(al => chrome.alarms.clear(al.name));
        });
        showToast('Scheduled campaign cancelled');
        renderDashboard();
      });
    }

    // Delete campaign buttons
    el.querySelectorAll('[data-db-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ts = +btn.dataset.dbDel;
        chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' }, r2 => {
          if (!r2?.analytics) return;
          r2.analytics.campaigns = r2.analytics.campaigns.filter(c => c.ts !== ts);
          chrome.storage.local.set({ analytics: r2.analytics });
          showToast('Campaign deleted');
          renderDashboard();
        });
      });
    });

    // Expand/collapse results
    el.querySelectorAll('[data-db-expand]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx   = btn.dataset.dbExpand;
        const resDiv = document.getElementById(`db-results-${idx}`);
        if (!resDiv) return;
        const isOpen = resDiv.style.display !== 'none';
        resDiv.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? `▸ Expand Results` : '▾ Collapse Results';
      });
    });
  });
}

// Dashboard filter buttons
document.getElementById('db-filter-row').addEventListener('click', e => {
  const btn = e.target.closest('[data-dbf]');
  if (!btn) return;
  dashboardFilter = btn.dataset.dbf;
  document.querySelectorAll('[data-dbf]').forEach(b => b.classList.toggle('sf-active', b.dataset.dbf === dashboardFilter));
  renderDashboard();
});

document.getElementById('db-refreshBtn').addEventListener('click', renderDashboard);

// ─── SVG CHART HELPERS (for PDF report) ──────────────────────────────────────
function svgBarChart(days, width, height) {
  if (!days.length) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="white"/><text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#8b949e" font-size="13">No data</text></svg>`;

  const PAD    = { top: 20, bottom: 28, left: 10, right: 10 };
  const chartW = width  - PAD.left - PAD.right;
  const chartH = height - PAD.top  - PAD.bottom;
  const maxVal = Math.max(...days.map(d => d.sent + d.failed), 1);
  const colW   = chartW / days.length;
  const barW   = Math.max(colW * 0.55, 10);

  let bars = '';
  days.forEach((d, i) => {
    const x      = PAD.left + i * colW + (colW - barW) / 2;
    const sentH  = (d.sent   / maxVal) * chartH;
    const failH  = (d.failed / maxVal) * chartH;
    const totalH = sentH + failH;

    if (failH > 0) bars += `<rect x="${x.toFixed(1)}" y="${(PAD.top+chartH-totalH).toFixed(1)}" width="${barW.toFixed(1)}" height="${failH.toFixed(1)}" fill="#da363388" rx="2"/>`;
    if (sentH > 0) bars += `<rect x="${x.toFixed(1)}" y="${(PAD.top+chartH-sentH).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(sentH-failH,0).toFixed(1)}" fill="#25D366bb" rx="2"/>`;
    if (!sentH && !failH) bars += `<rect x="${x.toFixed(1)}" y="${(PAD.top+chartH-4).toFixed(1)}" width="${barW.toFixed(1)}" height="4" fill="#e0e0e0" rx="2"/>`;
    bars += `<text x="${(x+barW/2).toFixed(1)}" y="${height-6}" text-anchor="middle" fill="#8b949e" font-size="10">${d.dateStr.slice(-5)}</text>`;
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="white"/>
    ${bars}
    <rect x="${PAD.left}" y="4" width="10" height="10" fill="#25D366" rx="2"/>
    <text x="${PAD.left+14}" y="13" fill="#555" font-size="10">Sent</text>
    <rect x="${PAD.left+50}" y="4" width="10" height="10" fill="#da3633" rx="2"/>
    <text x="${PAD.left+64}" y="13" fill="#555" font-size="10">Failed</text>
  </svg>`;
}

function svgFunnel(stageCounts, width, height) {
  const stages = [
    { key:'new',        label:'New',        color:'#58a6ff' },
    { key:'contacted',  label:'Contacted',  color:'#d29922' },
    { key:'interested', label:'Interested', color:'#f0883e' },
    { key:'converted',  label:'Converted',  color:'#25D366' },
    { key:'lost',       label:'Lost',       color:'#8b949e' },
  ];
  const maxVal  = Math.max(...stages.map(s => stageCounts[s.key] || 0), 1);
  const rowH    = height / stages.length;
  const PAD     = { left: 80, right: 50 };
  const maxBarW = width - PAD.left - PAD.right;

  let rows = '';
  stages.forEach((s, i) => {
    const count = stageCounts[s.key] || 0;
    const barW  = (count / maxVal) * maxBarW;
    const y = i * rowH;
    const cy = y + rowH / 2;
    rows += `<rect x="${PAD.left}" y="${(y+3).toFixed(1)}" width="${maxBarW}" height="${(rowH-6).toFixed(1)}" fill="${s.color}22" rx="3"/>`;
    if (barW > 0) rows += `<rect x="${PAD.left}" y="${(y+3).toFixed(1)}" width="${barW.toFixed(1)}" height="${(rowH-6).toFixed(1)}" fill="${s.color}" rx="3"/>`;
    rows += `<text x="${PAD.left-6}" y="${(cy+4).toFixed(1)}" text-anchor="end" fill="#555" font-size="11">${s.label}</text>`;
    rows += `<text x="${(PAD.left+maxBarW+8)}" y="${(cy+4).toFixed(1)}" fill="#8b949e" font-size="11">${count}</text>`;
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="white"/>
    ${rows}
  </svg>`;
}

// ─── CUSTOM REPORT & PDF EXPORT ───────────────────────────────────────────────
function generateReport({ from, to, allContacts, analytics }) {
  const fromTs = from ? new Date(from).getTime() : 0;
  const toTs   = to   ? new Date(to + 'T23:59:59').getTime() : Date.now();

  const filteredCampaigns = analytics.campaigns.filter(c => {
    const t = c.ts || 0;
    return t >= fromTs && t <= toTs;
  });

  const totalSent   = filteredCampaigns.reduce((s, c) => s + (c.sent   || 0), 0);
  const totalFailed = filteredCampaigns.reduce((s, c) => s + (c.failed || 0), 0);
  const successRate = (totalSent + totalFailed) > 0 ? Math.round(totalSent / (totalSent + totalFailed) * 100) : 0;

  const stageCounts = { new:0, contacted:0, interested:0, converted:0, lost:0 };
  allContacts.forEach(c => { const s = c.stage || 'new'; if (stageCounts[s] !== undefined) stageCounts[s]++; });

  const today = new Date();
  const days7 = [];
  for (let k = 6; k >= 0; k--) {
    const d2 = new Date(today);
    d2.setDate(today.getDate() - k);
    const dateStr = d2.toLocaleDateString();
    const dayCamps = analytics.campaigns.filter(c => c.date === dateStr);
    days7.push({ dateStr, sent: dayCamps.reduce((s,c)=>s+(c.sent||0),0), failed: dayCamps.reduce((s,c)=>s+(c.failed||0),0) });
  }

  const stageColors = { New:'#58a6ff', Contacted:'#d29922', Interested:'#f0883e', Converted:'#25D366', Lost:'#8b949e' };
  const stageData   = [['New',stageCounts.new],['Contacted',stageCounts.contacted],['Interested',stageCounts.interested],['Converted',stageCounts.converted],['Lost',stageCounts.lost]];
  const maxStage    = Math.max(...stageData.map(s=>s[1]), 1);

  const topCampaigns = [...filteredCampaigns].reverse().slice(0, 10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WA Bulk AI Report — ${new Date().toLocaleDateString()}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#1a1a2e;padding:32px;font-size:14px;line-height:1.5}
.rpt-header{border-bottom:3px solid #25D366;padding-bottom:16px;margin-bottom:24px}
.rpt-title{font-size:28px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
.rpt-sub{font-size:12px;color:#8b949e}
.sec-title{font-size:15px;font-weight:700;color:#1a1a2e;margin:24px 0 12px;border-left:4px solid #25D366;padding-left:10px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:8px}
.stat-card{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:16px;text-align:center}
.stat-card.green{border-color:#25D366}.stat-card.red{border-color:#da3633}.stat-card.blue{border-color:#58a6ff}
.snum{font-size:28px;font-weight:800;color:#1a1a2e}
.stat-card.green .snum{color:#25D366}.stat-card.red .snum{color:#da3633}.stat-card.blue .snum{color:#58a6ff}
.slabel{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8b949e;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#f0f0f0;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#555}
td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
tr:hover td{background:#f8f9fa}
.badge-s{background:#e8f8f0;color:#25D366;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700}
.badge-f{background:#ffe8e8;color:#da3633;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700}
.stage-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.stage-lbl{width:90px;font-size:12px;color:#555}
.stage-wrap{flex:1;height:14px;background:#f0f0f0;border-radius:7px;overflow:hidden}
.stage-bar{height:100%;border-radius:7px}
.stage-cnt{width:36px;text-align:right;font-size:12px;font-weight:700;color:#1a1a2e}
@media print{body{padding:16px}.no-print{display:none!important}svg{page-break-inside:avoid}.stats-grid{page-break-inside:avoid}}
</style>
</head>
<body>
<div class="rpt-header">
  <div class="rpt-title">📊 WA Bulk AI Report</div>
  <div class="rpt-sub">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; Total contacts: ${allContacts.length}${from||to ? ` &nbsp;·&nbsp; Period: ${from||'start'} → ${to||'now'}`:''}</div>
</div>

<div class="stats-grid">
  <div class="stat-card"><div class="snum">${filteredCampaigns.length}</div><div class="slabel">Campaigns</div></div>
  <div class="stat-card green"><div class="snum">${totalSent}</div><div class="slabel">Total Sent</div></div>
  <div class="stat-card red"><div class="snum">${totalFailed}</div><div class="slabel">Total Failed</div></div>
  <div class="stat-card blue"><div class="snum">${successRate}%</div><div class="slabel">Success Rate</div></div>
</div>

<div class="sec-title">📈 7-Day Activity</div>
${svgBarChart(days7, 700, 140)}

<div class="sec-title">🎯 Pipeline Funnel</div>
${svgFunnel(stageCounts, 700, 160)}

${topCampaigns.length ? `
<div class="sec-title">📋 Top Campaigns</div>
<table>
  <tr><th>Campaign</th><th>Date</th><th>Sent</th><th>Failed</th><th>Rate</th></tr>
  ${topCampaigns.map(c=>{const r=c.total>0?Math.round(c.sent/c.total*100):0;return`<tr><td>${c.name||'Campaign'}</td><td>${c.date}</td><td><span class="badge-s">✓ ${c.sent}</span></td><td><span class="badge-f">✗ ${c.failed}</span></td><td>${r}%</td></tr>`;}).join('')}
</table>` : ''}

<div class="sec-title">👥 Contact Breakdown by Stage</div>
${stageData.map(([label,count])=>`
  <div class="stage-row">
    <div class="stage-lbl">${label}</div>
    <div class="stage-wrap"><div class="stage-bar" style="width:${Math.round(count/maxStage*100)}%;background:${stageColors[label]}"></div></div>
    <div class="stage-cnt">${count}</div>
  </div>`).join('')}

<div class="no-print" style="margin-top:32px;text-align:center">
  <button id="rpt-print-btn" type="button" style="padding:10px 28px;background:#25D366;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer">🖨 Print / Save as PDF</button>
</div>
</body></html>`;
}

document.getElementById('generateReportBtn').addEventListener('click', () => {
  const from = document.getElementById('reportFrom').value;
  const to   = document.getElementById('reportTo').value;

  chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' }, resp => {
    if (!resp?.analytics) return showToast('No analytics data yet', 'err');
    chrome.storage.local.get('contacts', d => {
      const allContacts = (d.contacts || []).map(crmDefaults);
      // CSP: no inline script — use external script blob so report tab can print
      const printScript = "window.addEventListener('load',function(){setTimeout(window.print,400);});var b=document.getElementById('rpt-print-btn');if(b)b.addEventListener('click',function(){window.print();});";
      const scriptBlob = new Blob([printScript], { type: 'application/javascript' });
      const scriptUrl = URL.createObjectURL(scriptBlob);
      const htmlWithScript = generateReport({ from, to, allContacts, analytics: resp.analytics })
        .replace('</body></html>', '<script src="' + scriptUrl + '"><\/script></body></html>');
      const blob = new Blob([htmlWithScript], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      chrome.tabs.create({ url });
      showToast('📄 Report opened in new tab');
    });
  });
});

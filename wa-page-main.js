/* Runs in page MAIN world via chrome.scripting — bypasses WA Web CSP (inline scripts are blocked). */
(function () {
  var WA_B64_HOLDER_ID = '__wa_ext_media_b64_hold';
  var SEL_IMAGE = 'input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]';

  function setInputFilesFromDataTransfer(input, fileList) {
    try {
      input.value = '';
    } catch (e) {}
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
    if (desc && desc.set) {
      try {
        desc.set.call(input, fileList);
        return true;
      } catch (e) {}
    }
    try {
      input.files = fileList;
      return true;
    } catch (e2) {}
    try {
      Object.defineProperty(input, 'files', {
        configurable: true,
        enumerable: true,
        get: function () {
          return fileList;
        }
      });
      return true;
    } catch (e3) {}
    return false;
  }

  function collectInputs() {
    var out = [];
    function walk(node) {
      if (!node) return;
      if (node.tagName === 'INPUT' && node.type === 'file') out.push(node);
      var kids = node.children ? Array.from(node.children) : [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
      if (node.shadowRoot) walk(node.shadowRoot);
    }
    walk(document.body || document.documentElement);
    return out;
  }

  function scoreInp(inp) {
    var a = (inp.accept || '').toLowerCase();
    var inAttach =
      !!(inp.closest('footer') || inp.closest('[data-testid="conversation-panel-footer"]') || inp.closest('#main footer'));
    var ctx = (
      (inp.closest('[data-testid]') && inp.closest('[data-testid]').getAttribute('data-testid') || '') +
      (inp.getAttribute('aria-label') || '') + (inp.id || '') + (inp.name || '')
    ).toLowerCase();
    if (/sticker/.test(ctx)) return -1000;
    if (/video\/(mp4|3gpp|quicktime)/.test(a) && /image/.test(a)) return 500;
    if (a.indexOf('image/*') >= 0 && a.indexOf('video') >= 0) return 450;
    if (inp.hasAttribute('multiple') && /image/.test(a) && /video/.test(a)) return 400;
    if (inp.hasAttribute('multiple') && /image/.test(a)) return 55;
    if (/webp/.test(a) && !/video/.test(a) && a.indexOf('image/*') < 0) return -80;
    if (a.indexOf('image/*') >= 0) return 60 + (inAttach ? 120 : 0);
    if (a.indexOf('image') >= 0 && /video/.test(a)) return 55 + (inAttach ? 100 : 0);
    if (a === 'image/*') return 58 + (inAttach ? 115 : 0);
    return inAttach ? 25 : 0;
  }

  function sortedGalleryCandidates(inputs) {
    var scored = inputs.map(function (inp) {
      return { inp: inp, s: scoreInp(inp) };
    });
    scored = scored.filter(function (x) {
      return x.s > -200;
    });
    scored.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      if (a.inp.compareDocumentPosition(b.inp) & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
      if (b.inp.compareDocumentPosition(a.inp) & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      return 0;
    });
    return scored.map(function (x) {
      return x.inp;
    });
  }

  function lastInDocumentOrder(nodes) {
    if (!nodes || !nodes.length) return null;
    var best = nodes[0];
    for (var i = 1; i < nodes.length; i++) {
      if (best.compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING) best = nodes[i];
    }
    return best;
  }

  function pickGalleryInput(inputs) {
    var best = null;
    var bestS = -99999;
    for (var i = 0; i < inputs.length; i++) {
      var s = scoreInp(inputs[i]);
      if (s > bestS) { bestS = s; best = inputs[i]; }
    }
    var good = inputs.filter(function (x) { return scoreInp(x) >= 45; });
    var input = lastInDocumentOrder(good);
    if (!input && best && bestS >= 50) input = best;
    if (!input) {
      try {
        var exact = document.querySelector(SEL_IMAGE);
        if (exact && scoreInp(exact) > -500) input = exact;
      } catch (e) {}
    }
    if (!input && best && bestS > 0) input = best;
    if (!input && best && bestS > -200) input = best;
    if (!input) {
      var ok = inputs.filter(function (x) { return scoreInp(x) > -200; });
      input = lastInDocumentOrder(ok) || ok[0] || inputs[inputs.length - 1] || null;
    }
    return input;
  }

  window.__waBulkPageMain = {
    __apiVersion: 6,

    patchFileInputs: function () {
      if (!window.__waInputsPatched) window.__waInputsPatched = [];
      var n = 0;
      document.querySelectorAll('input[type="file"]').forEach(function (inp) {
        if (inp._waBulkClickPatched) return;
        inp._origClick = inp.click.bind(inp);
        inp.click = function () {};
        inp._waBulkClickPatched = true;
        window.__waInputsPatched.push(inp);
        n++;
      });
      if (!window.__waFileInputObserver) {
        window.__waFileInputObserver = new MutationObserver(function () {
          if (!window.__waInputsPatched) window.__waInputsPatched = [];
          document.querySelectorAll('input[type="file"]').forEach(function (inp) {
            if (inp._waBulkClickPatched) return;
            inp._origClick = inp.click.bind(inp);
            inp.click = function () {};
            inp._waBulkClickPatched = true;
            window.__waInputsPatched.push(inp);
          });
        });
        window.__waFileInputObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
      }
      return { patched: n, totalTracked: window.__waInputsPatched.length };
    },

    galleryInject: function (mime, name, pickIndex) {
      var holder = document.getElementById(WA_B64_HOLDER_ID);
      if (!holder || typeof holder.value !== 'string' || !holder.value.length) return { error: 'no b64 holder' };
      var b64 = holder.value;
      holder.value = '';
      var inputs = collectInputs();
      var candidates = sortedGalleryCandidates(inputs);
      var idx = pickIndex == null || pickIndex === '' ? 0 : Math.max(0, parseInt(pickIndex, 10) || 0);
      var input = candidates[idx];
      if (input == null && candidates.length === 0) input = pickGalleryInput(inputs);
      else if (input == null) {
        return { error: 'pickIndex_oob', nCand: candidates.length, pickIndex: idx };
      }
      if (!input) {
        return {
          error: 'no file input',
          nInputs: inputs.length,
          nCand: candidates.length,
          pickIndex: idx,
          debug: inputs.map(function (i) {
            return { accept: (i.accept || '').slice(0, 60), s: scoreInp(i) };
          })
        };
      }
      function restoreClick(inp) {
        if (!inp || !inp._origClick) return;
        inp.click = inp._origClick;
        delete inp._origClick;
        delete inp._waBulkClickPatched;
      }
      restoreClick(input);
      if (window.__waInputsPatched) {
        window.__waInputsPatched.forEach(function (i) {
          if (i !== input) restoreClick(i);
        });
      }
      var bin;
      try {
        bin = atob(b64.replace(/\s/g, ''));
      } catch (e) {
        return { error: 'atob: ' + (e && e.message) };
      }
      var u = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
      var f = new File([new Blob([u], { type: mime || 'image/jpeg' })], name || 'image.jpg', { type: mime || 'image/jpeg' });
      var dt = new DataTransfer();
      dt.items.add(f);
      if (!setInputFilesFromDataTransfer(input, dt.files)) {
        return { error: 'files setter failed on all strategies', accept: (input.accept || '').slice(0, 80) };
      }
      try {
        input.focus();
      } catch (e2) {}
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      try {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: null }));
      } catch (e3) {}
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      return {
        ok: true,
        accept: (input.accept || '').slice(0, 100),
        score: scoreInp(input),
        nInputs: inputs.length,
        pickIndex: idx,
        nCand: candidates.length
      };
    },

    dragDrop: function (mime, name) {
      var holder = document.getElementById(WA_B64_HOLDER_ID);
      if (!holder || !holder.value) return { error: 'no b64 holder' };
      var b64 = holder.value;
      holder.value = '';
      var bin = atob(b64.replace(/\s/g, ''));
      var u = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
      var file = new File([new Blob([u], { type: mime || 'image/jpeg' })], name || 'image.jpg', { type: mime || 'image/jpeg' });
      var dt = new DataTransfer();
      dt.items.add(file);
      var z =
        document.querySelector('[data-testid="conversation-panel-body"]') ||
        document.querySelector('[data-testid="conversation-panel-wrapper"]') ||
        document.querySelector('#main .copyable-area') ||
        document.querySelector('#main [role="application"]') ||
        document.querySelector('#main') ||
        document.body;
      try {
        dt.dropEffect = 'copy';
        dt.effectAllowed = 'all';
      } catch (e0) {}
      ['dragenter', 'dragover', 'drop'].forEach(function (type) {
        var ev;
        try {
          ev = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true, composed: true });
        } catch (e1) {
          ev = document.createEvent('DragEvent');
          ev.initDragEvent(type, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
          try {
            Object.defineProperty(ev, 'dataTransfer', { get: function () { return dt; } });
          } catch (e2) {}
        }
        try {
          z.dispatchEvent(ev);
        } catch (e3) {}
      });
      try {
        var foot = document.querySelector('#main footer') || document.querySelector('footer');
        if (foot && foot !== z) {
          try {
            foot.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, composed: true }));
          } catch (e4a) {}
        }
      } catch (e4) {}
      return { ok: true };
    },

    insertCaption: function (text) {
      if (!text) return { found: false };
      function cap() {
        var dialogs = document.querySelectorAll('[role="dialog"]');
        var d, i;
        for (d = 0; d < dialogs.length; d++) {
          if (!dialogs[d].querySelector('[aria-label="Remove attachment"], [aria-label*="thumbnail"], [aria-label*="video thumbnail"], [data-testid="media-caption-input-container"]')) continue;
          var named = dialogs[d].querySelector('[data-testid="media-caption-input-container"] div[contenteditable]');
          if (named) return named;
          var t11 = dialogs[d].querySelector('div[contenteditable][data-tab="11"]');
          if (t11) return t11;
          var t10 = dialogs[d].querySelector('div[contenteditable][data-tab="10"]');
          if (t10) return t10;
          var ce = dialogs[d].querySelector('div[contenteditable="true"]');
          if (ce) return ce;
        }
        var t10 = document.querySelector('div[contenteditable][data-tab="10"]');
        if (t10 && !t10.closest('footer')) return t10;
        var t11g = document.querySelector('div[contenteditable][data-tab="11"]');
        if (t11g) return t11g;
        var named2 = document.querySelector('[data-testid="media-caption-input-container"] div[contenteditable]');
        if (named2) return named2;
        var all = document.querySelectorAll('div[contenteditable="true"]');
        for (i = 0; i < all.length; i++) {
          if (!all[i].closest('footer') && all[i].offsetParent) return all[i];
        }
        return null;
      }
      var el = cap();
      if (!el) return { found: false };
      el.focus();
      var bev = new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true });
      var prevented = !el.dispatchEvent(bev);
      if (!prevented) document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
      var inserted = (el.innerText || el.textContent || '').trim();
      return { found: true, inserted: inserted.slice(0, 80) };
    },

    stickerOff: function () {
      var dialogs = document.querySelectorAll('[role="dialog"]');
      for (var d = 0; d < dialogs.length; d++) {
        var sws = dialogs[d].querySelectorAll('[role="switch"][aria-checked="true"]');
        for (var i = 0; i < sws.length; i++) {
          var sw = sws[i];
          var box = sw.closest('div');
          var t = ((sw.getAttribute('aria-label') || '') + ' ' + (box ? box.innerText : '')).slice(0, 120).toLowerCase();
          if (/sticker|send as sticker|convert to sticker/.test(t)) sw.click();
        }
      }
      return { ok: true };
    },

    sendEnterCap: function () {
      var el = null;
      var dialogs = document.querySelectorAll('[role="dialog"]');
      for (var d = 0; d < dialogs.length && !el; d++) {
        if (!dialogs[d].querySelector('[aria-label="Remove attachment"], [aria-label*="thumbnail"], [data-testid="media-caption-input-container"]')) continue;
        el =
          dialogs[d].querySelector('[data-testid="media-caption-input-container"] div[contenteditable]') ||
          dialogs[d].querySelector('div[contenteditable][data-tab="11"]') ||
          dialogs[d].querySelector('div[contenteditable][data-tab="10"]') ||
          null;
      }
      if (!el) {
        var t10 = document.querySelector('div[contenteditable][data-tab="10"]');
        el = (t10 && !t10.closest('footer'))
          ? t10
          : document.querySelector('div[contenteditable][data-tab="11"]') ||
            document.querySelector('[data-testid="media-caption-input-container"] div[contenteditable]') ||
            null;
      }
      if (!el) {
        var all = document.querySelectorAll('div[contenteditable="true"]');
        for (var i = 0; i < all.length; i++) {
          if (!all[i].closest('footer') && all[i].offsetParent) { el = all[i]; break; }
        }
      }
      if (!el) return { ok: false };
      el.focus();
      ['keydown', 'keypress', 'keyup'].forEach(function (t) {
        el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      });
      return { ok: true };
    },

    clickSend: function () {
      var dialogs = document.querySelectorAll('[role="dialog"]');
      for (var d = 0; d < dialogs.length; d++) {
        var b = dialogs[d].querySelector('[aria-label="Send"][role="button"], div[aria-label="Send"], button[aria-label="Send"], span[data-icon="wds-ic-send-filled"]');
        if (b) { b.click(); return { ok: 'dialog-send' }; }
      }
      var allSend = Array.prototype.slice.call(document.querySelectorAll('div[aria-label="Send"][role="button"], span[data-icon="wds-ic-send-filled"]'));
      var mediaBtn = allSend.find(function (x) { return !x.closest('footer'); }) || allSend[0];
      if (mediaBtn) { mediaBtn.click(); return { ok: 'div-aria-send' }; }
      var any = document.querySelector('[aria-label="Send"]');
      if (any) { any.click(); return { ok: 'aria-send' }; }
      return { error: 'none' };
    },

    sendEnterCap2: function () {
      var el = document.querySelector('[data-testid="media-caption-input-container"] div[contenteditable]') ||
        document.querySelector('div[contenteditable][data-tab="11"]');
      if (!el) return { ok: false };
      el.focus();
      ['keydown', 'keypress', 'keyup'].forEach(function (t) {
        el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      });
      return { ok: true };
    }
  };
})();

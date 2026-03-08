// Runs in page (main) world to capture audio blob URLs. Injected via script src to satisfy CSP.
(function(){
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
})();

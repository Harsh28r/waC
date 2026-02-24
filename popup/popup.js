// popup.js

document.getElementById('openPanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
});

document.getElementById('openWA').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com' });
  window.close();
});

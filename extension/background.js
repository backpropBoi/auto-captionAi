let wsConnections = {}; // optional mapping per tabId if needed

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.action === 'START_CAPTIONS') {
    // simply forward to content script by executing content script in active tab
    chrome.tabs.query({active:true,currentWindow:true}, (tabs) => {
      if (!tabs[0]) return;
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['content_ws_client.js','word_renderer.js']
      });
    });
  } else if (msg.action === 'STOP_CAPTIONS') {
    // send message to content scripts to stop (content script listens for storage changes)
    chrome.storage.local.set({ enabled: false });
  }
});

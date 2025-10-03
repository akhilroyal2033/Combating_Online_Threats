// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateStats") {
    // Optionally persist stats here using chrome.storage
    chrome.storage.local.set({ stats: request.stats }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }
});
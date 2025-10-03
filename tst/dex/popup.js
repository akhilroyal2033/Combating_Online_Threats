// popup.js
let stats = { analyzed: 0, fakes: 0, reals: 0, uncertain: 0 };

function updateDisplay() {
  document.getElementById("analyzed").textContent = stats.analyzed;
  document.getElementById("fakes").textContent = stats.fakes;
  document.getElementById("reals").textContent = stats.reals;
  document.getElementById("uncertain").textContent = stats.uncertain;
}

// Listen for stats updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateStats") {
    stats = message.stats;
    updateDisplay();
  }
});

// Load initial stats when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getStats" }, (response) => {
      if (response && response.stats) {
        stats = response.stats;
        updateDisplay();
      }
    });
  }
});
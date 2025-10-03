// === Create Floating Log Panel ===
const logPanel = document.createElement("div");
logPanel.style.position = "fixed";
logPanel.style.bottom = "20px";
logPanel.style.right = "20px";
logPanel.style.width = "320px";
logPanel.style.maxHeight = "250px";
logPanel.style.overflowY = "auto";
logPanel.style.background = "rgba(15, 23, 42, 0.9)";
logPanel.style.color = "#eee";
logPanel.style.fontFamily = "monospace";
logPanel.style.fontSize = "12px";
logPanel.style.padding = "10px";
logPanel.style.borderRadius = "8px";
logPanel.style.zIndex = "9999";
logPanel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
logPanel.innerHTML = "<b>Deepfake Logs</b><br>";
document.body.appendChild(logPanel);

let stats = { analyzed: 0, fakes: 0, reals: 0, mossafe:0, possiblescam:0, susscam:0, uncertain: 0 };
chrome.runtime.sendMessage({ action: "updateStats", stats });

function addLog(msg, color = "#ccc") {
  const line = document.createElement("div");
  line.style.color = color;
  line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

async function analyzeImage(imgElement) {
  const imgSrc = imgElement.src;
  if (!imgSrc || imgSrc.startsWith('data:')) {
    addLog("Skipping non-loadable image", "#facc15");
    return;
  }

  addLog(`Analyzing image: ${imgSrc.substring(imgSrc.lastIndexOf('/') + 1)}`, "#4ade80");
  stats.analyzed++;
  chrome.runtime.sendMessage({ action: "updateStats", stats });

  try {
    const response = await fetch(imgSrc);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('image', blob, 'image.jpg');

    const apiResponse = await fetch("http://localhost:5000/api/analyze", {
      method: "POST",
       headers: {
        "Authorization": "Bearer c7d9f235-1976-40e4-a90f-172bfa408404"
      },
      body: formData
    });

    if (!apiResponse.ok) {
      throw new Error(`API error: ${apiResponse.status}`);
    }

    const result = await apiResponse.json();
    addLog(`Result: ${result.verdict}`, "#93c5fd");

    // Update stats based on verdict
    if (result.label === "fake") stats.fakes++;
    else if (result.label === "real") stats.reals++;
    else if (result.verdict.includes("No scam detected")) stats.mossafe++;
    else if (result.verdict.includes("Suspicious content")) stats.susscam++;
    else if (result.verdict.includes("Likely Scam detected")) stats.possiblescam++;
    else stats.uncertain++;
    chrome.runtime.sendMessage({ action: "updateStats", stats });

    return result;
  } catch (err) {
    addLog("API Error: " + err.message, "#f87171");
    return null;
  }
}

function highlightImageContainer(container, result) {
  // Remove existing badges
  const existingBadge = container.querySelector('.deepfake-badge');
  if (existingBadge) existingBadge.remove();

  let badgeText, badgeColor;
  if (result.label === "fake") {
    badgeText = `FAKE (${(result.confidence * 100).toFixed(0)}%)`;
    badgeColor = "#ef4444"; // red
    container.style.border = "3px solid #ef4444";
    container.style.borderRadius = "8px";
  } else if (result.label === "real") {
    badgeText = `REAL (${(result.confidence * 100).toFixed(0)}%)`;
    badgeColor = "#10b981"; // green
    container.style.border = "3px solid #10b981";
    container.style.borderRadius = "8px";
  }
  else if (result.verdict.includes("Suspicious content")){
    badgeText = 'Suspicious content';
    badgeColor = "#f59e0b";
    container.style.border = "3px solid #f59e0b";
    container.style.borderRadius = "8px";
  }
  else if (result.verdict.includes("Likely Scam detected")){
    badgeText = 'Possible Scam';
    badgeColor = "#ef4444";
    container.style.border = "3px solid #ef4444"
    container.style.borderRadius = "8px"
  }
  else if (result.verdict.includes("No scam detected")){
    badgeText = 'Mostly Safe';
    badgeColor = "#10b981";
    container.style.border = "3px solid #10b981"
    container.style.borderRadius = "8px"
  }
  else {
    badgeText = `UNCERTAIN (${(result.confidence * 100).toFixed(0)}%)`;
    badgeColor = "#f59e0b"; // orange
    container.style.border = "3px solid #f59e0b";
    container.style.borderRadius = "8px";
  }

  const badge = document.createElement("span");
  badge.className = "deepfake-badge";
  badge.style.position = "absolute";
  badge.style.top = "5px";
  badge.style.right = "5px";
  badge.style.backgroundColor = badgeColor;
  badge.style.color = "white";
  badge.style.padding = "4px 8px";
  badge.style.borderRadius = "4px";
  badge.style.fontSize = "12px";
  badge.style.fontWeight = "bold";
  badge.style.zIndex = "10";
  badge.innerText = badgeText;
  container.style.position = "relative";
  container.appendChild(badge);

  // addLog(`Marked as ${result.label} with ${(result.confidence * 100).toFixed(0)}% confidence`, badgeColor);
}

const observer = new MutationObserver(async (mutations) => {
  for (let mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(async (node) => {
        if (node.nodeType === 1) {
          // Look for image elements in WhatsApp message containers
          let imgElements = [];
          if (node.tagName === 'IMG' && node.src.startsWith('blob:')) {
            imgElements.push(node);
          } else if (node.querySelectorAll) {
            imgElements = [...imgElements, ...Array.from(node.querySelectorAll('img[src*="blob:"]'))];
          }

          for (let img of imgElements) {
            // Check if already processed
            if (img.closest('.deepfake-processed')) continue;

            // Use the direct parent of the image for tighter bordering (only around the image)
            const container = img.parentElement;
            if (container) {
              container.classList.add('deepfake-processed');
              const result = await analyzeImage(img);
              if (result) {
                highlightImageContainer(container, result);
              }
            }
          }
        }
      });
    }
  }
});

function startObserver() {
  const chatContainer = document.querySelector("#main");
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
    addLog("Deepfake Detector started. Monitoring WhatsApp images...");
  } else {
    addLog("Chat container not found. Retrying...", "#facc15");
    setTimeout(startObserver, 2000);
  }
}

startObserver();

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStats") {
    sendResponse({ stats });
  }
});
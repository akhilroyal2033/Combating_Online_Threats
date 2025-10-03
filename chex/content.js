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
logPanel.innerHTML = "<b>Hate SpeechLogs</b><br>";
// document.body.appendChild(logPanel);

function addLog(msg, color = "#ccc") {
  const line = document.createElement("div");
  line.style.color = color;
  line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

async function analyzeMessage(text) {
  addLog(`Analyzing: "${text}"`, "#4ade80"); // green
  try {
    const response = await fetch("http://localhost:7200/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer c7d9f235-1976-40e4-a90f-172bfa408404"
      },
      body: JSON.stringify({ text })
    });
    const result = await response.json();
    addLog(`Result: Hate=${result.prediction.hate_speech.toFixed(2)}, Offensive=${result.prediction.offensive_language.toFixed(2)}, Safe=${result.prediction.neither.toFixed(2)}`, "#93c5fd"); // blue
    return result;
  } catch (err) {
    addLog("API Error: " + err.message, "#f87171"); // red
    return null;
  }
}

function highlightMessage(element, category, toxicWords = [], suggestions = {}) {
  if (category === "hate_speech") {
    element.style.backgroundColor = "rgba(239, 68, 68, 0.3)";
    addLog("Hate Speech detected!", "#ef4444");
  } else if (category === "offensive_language") {
    element.style.backgroundColor = "rgba(245, 158, 11, 0.3)";
    addLog("Offensive language detected!", "#f59e0b");
  } else {
    element.style.backgroundColor = "rgba(16, 185, 129, 0.3)";
    addLog("Safe message", "#10b981");
  }

  if (toxicWords.length > 0) {
    toxicWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      element.innerHTML = element.innerHTML.replace(
        regex,
        `<span style="background:rgba(239,68,68,0.6);color:white;padding:2px 4px;border-radius:4px;">${word}</span>`
      );
      addLog(`Flagged word: "${word}" → Suggestion: ${suggestions[word]?.join(", ") || "none"}`, "#fbbf24");
    });
  }
}

let toxicStreak = 0;
let crisisPopupCount = 0;
let recentToxicMessages = []; // store last 5 toxic messages
function showCrisisPopup() {
  if (document.getElementById("crisisPopup")) return; 
  crisisPopupCount++;

  const popup = document.createElement("div");
  popup.id = "crisisPopup";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100%";
  popup.style.height = "100%";
  popup.style.background = "rgba(0,0,0,0.85)";
  popup.style.color = "#fff";
  popup.style.display = "flex";
  popup.style.flexDirection = "column";
  popup.style.justifyContent = "center";
  popup.style.alignItems = "center";
  popup.style.zIndex = "10000";
  popup.style.fontFamily = "sans-serif";
  popup.innerHTML = `
<div style="background: #F9FAFB; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: 'Helvetica Neue', Arial, sans-serif;">
  <h2 style="color: #1F2937; font-size: 20px; font-weight: 600; margin-bottom: 20px; letter-spacing: 0.25px;">Mental Health Notice</h2>
  <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Our system has identified concerning patterns in this chat that may indicate abusive or emotional distress. Support resources are available to assist you.</p>
  <div style="display: flex; gap: 16px; justify-content: center;">
    <button id="btnEmergency" style="background: #B91C1C; padding: 10px 20px; border: none; border-radius: 6px; color: #FFFFFF; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;">Emergency Services</button>
    <button id="btnCounseling" style="background: #1E40AF; padding: 10px 20px; border: none; border-radius: 6px; color: #FFFFFF; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;">Free Counseling Support</button>
    <button id="relCal" style="background: #16A34A; padding: 10px 20px; border: none; border-radius: 6px; color: #FFFFFF; font-size: 14px; font-weight: 500; cursor: pointer;">Call Relative</button>
    <button id="btnClose" style="background: #374151; padding: 10px 20px; border: none; border-radius: 6px; color: #FFFFFF; font-size: 14px; font-weight: 500; cursor: pointer;">Ignore & Close</button>
  </div>
</div>
  `;

  document.body.appendChild(popup);

  document.getElementById("btnEmergency").onclick = () => {
    alert("Opening Dailer to Dail Emergency Helpline (100/112)...");
    window.location.href = "tel:100";

  };

  document.getElementById("btnCounseling").onclick = () => {
    window.open("https://akhilroyal.rf.gd/counsiling", "_blank");
  };
  document.getElementById("btnClose").onclick = () => {
    document.body.removeChild(popup);
  };
  document.getElementById("relCal").onclick = () => {
    chrome.storage.local.get("relativeNumber", (data) => {
      if (data.relativeNumber) {
        alert("Calling relative: " + data.relativeNumber);
        window.location.href = "tel:" + data.relativeNumber;
      } else {
        alert("No relative number saved. Please add one in the extension popup.");
      }
    });
  };
  if (crisisPopupCount > 1) {
    notifyRelative();
  }

}

function checkEscalation(category, text) {
  if (category === "hate_speech" || category === "offensive_language") {
    toxicStreak++;
    recentToxicMessages.push(text);

    // keep only last 5
    if (recentToxicMessages.length > 5) {
      recentToxicMessages.shift();
    }

    if (toxicStreak >= 5) {
      addLog("⚠Escalation triggered: 5 continuous toxic messages!", "#dc2626");
      showCrisisPopup();
      toxicStreak = 0; // reset after showing popup
    }
  } else {
    toxicStreak = 0; // reset if a safe message breaks the streak
  }
}

function notifyRelative() {
  chrome.storage.local.get("relativeNumber", (data) => {
    if (!data.relativeNumber) {
      addLog("⚠ No relative number saved, cannot notify.", "#f87171");
      return;
    }

    const payload = {
      to: data.relativeNumber,
      text: "Alert: Your family member has shown repeated signs of distress.\n\nLast 5 concerning messages:\n" + 
        recentToxicMessages.map((m, i) => `${i+1}. ${m}`).join("\n")
    };

    fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        "Authorization": "Bearer 727f86cb60059d62bb906d816cb44ab87d71ce04eaa807c22b73cd4a8d73ac3e",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      addLog("Relative notified with last 5 toxic messages.", "#10b981");
    })
    .catch(err => {
      addLog("Failed to notify relative: " + err.message, "#ef4444");
    });
  });
}

const observer = new MutationObserver(async (mutations) => {
  for (let mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(async (node) => {
        if (node.nodeType === 1) {
          const msgTextElement = node.querySelector("span.selectable-text span");
          if (msgTextElement) {
            const text = msgTextElement.innerText.trim();
            if (text) {
              const result = await analyzeMessage(text);
              if (result && result.prediction) {
                let predictions = result.prediction;
                let maxCategory = Object.keys(predictions).reduce((a, b) =>
                  predictions[a] > predictions[b] ? a : b
                );
                highlightMessage(msgTextElement, maxCategory, result.toxic_words, result.suggestions);

                checkEscalation(maxCategory);
              }
            }
          }
        }
      });
    }
  }
});

function startObserver() {
  const chatContainer = document.querySelector("#main .copyable-area");
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
    addLog("Detector started. Monitoring WhatsApp messages...");
  } else {
    addLog("Chat container not found. Retrying...", "#facc15");
    setTimeout(startObserver, 2000);
  }
}
startObserver();

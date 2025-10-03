// Placeholder – can connect with content.js via chrome.storage
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stats").innerText = "Extension active on WhatsApp Web!";

  const input = document.getElementById("relativeNumber");
  const saveBtn = document.getElementById("saveRelative");

  // Load saved number
  chrome.storage.local.get("relativeNumber", (data) => {
    if (data.relativeNumber) {
      input.value = data.relativeNumber;
    }
  });

  // Save new number
  saveBtn.addEventListener("click", () => {
    const number = input.value.trim();
    if (number) {
      chrome.storage.local.set({ relativeNumber: number }, () => {
        alert("Relative number saved: " + number);
      });
    }
  });
});

const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const dot        = document.getElementById("dot");
const statusText = document.getElementById("statusText");

function setUI(active) {
  dot.classList.toggle("active", active);
  statusText.textContent = active ? "Aktiv - işləyir..." : "Dayandırılıb";
  statusText.classList.toggle("active", active);
  startBtn.disabled = active;
  stopBtn.disabled  = !active;
}

// Saxlanılmış vəziyyəti yüklə
chrome.storage.local.get("sniperActive", (data) => {
  setUI(!!data.sniperActive);
});

startBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "start" });
  chrome.storage.local.set({ sniperActive: true });
  setUI(true);
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stop" });
  chrome.storage.local.set({ sniperActive: false });
  setUI(false);
});

/**
 * MIDA Sniper - Background Service Worker
 * Popup-dan gələn əmrləri bütün aktiv tab-a (+ onun frame-lərinə) çatdırır.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "start" && msg.action !== "stop") return;

  // Aktiv tab-ı tap
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;

    // allFrames: true → ana frame + bütün iframe-lərə göndər
    chrome.tabs.sendMessage(tabId, { action: msg.action }, { frameId: undefined });

    // chrome.scripting ilə də inject et (əgər content script hələ yüklənməyibsə)
    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        files: ["content.js"],
      },
      () => {
        // Inject sonrası yenidən göndər
        chrome.tabs.sendMessage(tabId, { action: msg.action });
      }
    );
  });
});

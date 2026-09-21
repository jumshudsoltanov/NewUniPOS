(function () {
  "use strict";

  console.log(
    "%c[MIDA Sniper] 🚀 YENİ SCRIPT YÜKLƏNDİ v14 | " + location.href,
    "color: cyan; font-weight: bold;",
  );

  window.confirm = () => true;
  window.alert = () => {};

  let active = false;
  let inProcess = false;

  function clickOnce(el, label) {
    if (!el || el.disabled || el.dataset.sniperDone) return false;
    el.dataset.sniperDone = "true";
    el.click();
    console.log("[MIDA Sniper] ✅", label, "| frame:", location.href);
    return true;
  }

  // ─── Axtar düyməsini tap ──────────────────────────────────────────────────
  function findAxtarBtn() {
    return (
      document.getElementById("search") ||
      Array.from(
        document.querySelectorAll("button, a, input[type=button]"),
      ).find((b) => (b.innerText || b.value || "").trim().includes("Axtar"))
    );
  }

  // ─── Seç görünənə qədər hər 300ms yoxla ──────────────────────────────────
  function waitForSec() {
    console.log("[MIDA Sniper] 🔍 Seç gözlənilir...");
    const poll = setInterval(() => {
      if (!active) {
        clearInterval(poll);
        inProcess = false;
        return;
      }
      const el = document.querySelector(
        ".btn.btn-primary.look:not([data-sniper-done])",
      );
      if (el) {
        clearInterval(poll);
        clickOnce(el, "Seç");
        setTimeout(() => {
          inProcess = false;
        }, 3000);
      }
    }, 300);
    setTimeout(() => {
      clearInterval(poll);
      inProcess = false;
    }, 10000);
  }

  // ─── Axtar listener ───────────────────────────────────────────────────────
  function attachAxtarListener() {
    const btn = findAxtarBtn();
    if (!btn) {
      setTimeout(attachAxtarListener, 500);
      return;
    }

    console.log("[MIDA Sniper] 👂 Axtar tapıldı | frame:", location.href);

    function onTrigger(src) {
      if (!active || inProcess) return;
      inProcess = true;
      console.log("[MIDA Sniper] 🖱️ Axtar tetiklendi (" + src + ")!");
      waitForSec();
    }

    // Klik ilə
    btn.addEventListener("click", () => onTrigger("klik"));

    // Enter ilə (bütün input sahələrindən)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onTrigger("Enter");
    });

    // Form submit ilə
    const form = btn.closest("form");
    if (form) {
      form.addEventListener("submit", () => onTrigger("form submit"));
    }
  }

  // ─── Hər frame öz içindəki bütün düymələri idarə edir ───────────────────
  function startSniper() {
    if (active) return;
    active = true;
    inProcess = false;
    chrome.storage.local.set({ sniperActive: true });
    console.log("[MIDA Sniper] 🟢 Aktiv | frame:", location.href);

    // Axtar listener — hər frameda qoy (hansında varsa orda tutacaq)
    attachAxtarListener();

    // btnRegister + disagree — hər frameda yoxla
    setTimeout(() => {
      if (!active) return;
      clickOnce(document.getElementById("btnRegister"), "Təsdiqlə");
      setTimeout(() => {
        if (!active) return;
        clickOnce(
          document.getElementById("agree") ||
            document.querySelector('[id*="agree"]') ||
            document.querySelector('[name*="agree"]') ||
            document.querySelector("button.btn-success"),
          "Razıyam (agree)",
        );
      }, 700);
    }, 700);
  }

  function stopSniper() {
    active = false;
    inProcess = false;
    chrome.storage.local.set({ sniperActive: false });
    console.log("[MIDA Sniper] 🔴 Dayandırıldı");
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "start") startSniper();
    if (msg.action === "stop") stopSniper();
  });

  chrome.storage.local.get("sniperActive", (data) => {
    if (data.sniperActive) startSniper();
  });
})();

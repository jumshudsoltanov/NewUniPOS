/**
 * iOS Safari "Add to Home Screen" — real viewport hundurluyu.
 */
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

const MAX_SAFE_TOP = 59;
const MAX_SAFE_BOTTOM = 40;

function readSafeInsets() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;pointer-events:none";
  document.documentElement.appendChild(el);
  const cs = getComputedStyle(el);
  let top = Math.min(parseInt(cs.paddingTop, 10) || 0, MAX_SAFE_TOP);
  let bottom = Math.min(parseInt(cs.paddingBottom, 10) || 0, MAX_SAFE_BOTTOM);
  el.remove();
  return { top, bottom };
}

export function applyIosViewportFix() {
  const root = document.documentElement;
  const h = Math.round(window.innerHeight);
  const safe = readSafeInsets();

  root.style.setProperty("--app-height", `${h}px`);
  root.style.setProperty("--app-width", `${window.innerWidth}px`);
  root.style.setProperty("--safe-top", `${safe.top}px`);
  root.style.setProperty("--safe-bottom", `${safe.bottom}px`);

  if (isIOS) {
    root.classList.add("ios-device");
    if (isStandalone) root.classList.add("ios-standalone");
  }
}

export function initIosViewportFix() {
  applyIosViewportFix();

  window.addEventListener("resize", applyIosViewportFix);
  window.addEventListener("orientationchange", () => {
    setTimeout(applyIosViewportFix, 100);
    setTimeout(applyIosViewportFix, 350);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyIosViewportFix);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyIosViewportFix);
    window.visualViewport.addEventListener("scroll", () => window.scrollTo(0, 0));
  }

  if (isIOS) {
    window.addEventListener("pageshow", applyIosViewportFix);
  }
}

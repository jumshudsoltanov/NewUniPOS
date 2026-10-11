/**
 * KONSOL NƏZARƏTİ (Node / Electron main / backend prosesi)
 * ========================================================
 *
 * PROBLEM:
 * Layihədə 1100-dən çox `console.*` çağırışı var və onların bir hissəsi isti
 * yollardadır (sinxron dövrü hər 2 saniyə, sifariş əməliyyatları, çap). Bu,
 * POS-u iki yolla yavaşladır:
 *
 *   1. Arqumentlərin qurulması — şablon sətirləri, `JSON.stringify(...)`,
 *      massiv `.map(...)` çağırışları hər dəfə hesablanır.
 *   2. Yazma özü — backend prosesinin çıxışı main prosesə ötürülür, o da
 *      electron-log vasitəsilə DİSKƏ yazır. Disk yazması UI thread-ini
 *      bloklayır, yəni loq nə qədər çoxdursa pəncərə bir o qədər çox donur.
 *
 * HƏLL:
 * İstehsalat rejimində səs-küylü konsol metodları boş funksiya ilə əvəz olunur.
 * Çağırış yerləri silinmir (1100 yeri mexaniki silmək kodu sındırardı — onlarla
 * yer mötərizəsiz `if` və `.catch(err => console.error(...))` formasındadır),
 * amma heç bir iş görülmür.
 *
 * NƏ SAXLANILIR:
 * Yalnız `console.error`. O, nadir hallarda işləyir və proqram çökəndə səbəbi
 * tapmaq üçün yeganə vasitədir — onu da söndürmək nasazlığı görünməz edərdi.
 *
 * İDARƏETMƏ:
 *   UNIPOS_DEBUG=1   → bütün loglar geri qayıdır (nasazlıq axtarışı üçün)
 *   UNIPOS_SILENT=1  → `console.error` də susdurulur (tam sükut)
 *
 * DEV REJİMİ DƏ SAKİTDİR. Əvvəl dev-də hər şey görünürdü, amma sinxronizasiya
 * hər açılışda yüzlərlə sətir yazırdı və terminalda həqiqətən lazım olan şeyi
 * (xəta, öz `console.error`-un) tapmaq mümkün olmurdu. İndi `npm start` təmiz
 * açılır; loglara baxmaq lazım olanda:
 *
 *   PowerShell:  $env:UNIPOS_DEBUG=1; npm start
 *   Git Bash:    UNIPOS_DEBUG=1 npm start
 */

const NOISY_METHODS = [
  "log",
  "info",
  "debug",
  "warn",
  "trace",
  "table",
  "dir",
  "group",
  "groupCollapsed",
  "groupEnd",
  "count",
  "countReset",
  "time",
  "timeEnd",
  "timeLog",
  "assert",
];

let applied = false;

function noop() {}

/**
 * @param {object} opts
 * @param {boolean} opts.isProduction  paketlənmiş rejimdirmi
 * @param {string}  [opts.label]       loga yazılacaq qısa ad
 */
function applyConsolePolicy(opts = {}) {
  if (applied) return { silenced: false, reason: "artıq tətbiq olunub" };
  applied = true;

  const debugOn = process.env.UNIPOS_DEBUG === "1";
  const fullSilence = process.env.UNIPOS_SILENT === "1";
  const isProduction = opts.isProduction === true;

  if (debugOn) {
    return { silenced: false, reason: "UNIPOS_DEBUG=1" };
  }

  for (const m of NOISY_METHODS) {
    if (typeof console[m] === "function") console[m] = noop;
  }
  if (fullSilence && typeof console.error === "function") {
    console.error = noop;
  }

  return {
    silenced: true,
    mode: isProduction ? "istehsalat" : "dev",
    reason: fullSilence ? "tam sükut (UNIPOS_SILENT=1)" : "yalnız console.error aktiv",
  };
}

module.exports = { applyConsolePolicy };

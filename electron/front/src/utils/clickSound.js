/**
 * `?inline` — fayl ayrıca yazılmır, `data:` URI kimi paketə hopdurulur.
 *
 * VACİBDİR: paketlənmiş proqram səhifəni `file://` ilə yükləyir, `fetch()` isə
 * `file:` sxemini qəbul etmir ("URL scheme must be http or https"). Yəni adi
 * import ilə səs dev-də işləyər, quraşdırılmış proqramda SƏSSİZ uğursuz olardı.
 * `data:` URI hər iki rejimdə oxunur. Fayl 34 KB-dır, paketə təsiri cüzidir.
 */
import clickSoundUrl from "../assets/sounds/click.mp3?inline";

/**
 * DÜYMƏ SƏSİ
 * ==========
 *
 * Proqramda basılan hər düymə qısa klik səsi verir. Səs komponentlərə
 * əlavə edilmir — sənədə BİR dinləyici qoşulur və hansı elementə basıldığını
 * özü müəyyən edir. Belə olanda yüzlərlə `onClick`-ə toxunmaq lazım gəlmir
 * və yeni əlavə olunan düymələr də avtomatik səs verir.
 *
 * NİYƏ `<audio>` DEYİL, Web Audio:
 * `new Audio(...).play()` hər dəfə yeni element yaradır, faylı yenidən
 * dekodlayır və əvvəlki səs bitməyibsə üst-üstə düşmür. Kassada düymələrə
 * sürətlə basılır, ona görə fayl BİR DƏFƏ dekod olunub yaddaşda saxlanılır;
 * hər klik yalnız hazır buferi oxudur (praktiki olaraq pulsuz).
 *
 * İDARƏETMƏ (localStorage):
 *   pos_click_sound   "0" → səs söndürülür (default: açıq)
 *   pos_click_volume  0–1 arası ədəd (default: 0.35)
 */

/** Brauzer istifadəçi toxunmayana qədər səsə icazə vermir */
let audioCtx = null;
let buffer = null;
let decoding = false;
let lastPlayedAt = 0;

/** Eyni toxunuşdan iki səs çıxmasın (pointerdown + sintetik click) */
const MIN_GAP_MS = 60;

/** Səs açıqdırmı (default: açıq) */
export function isClickSoundEnabled() {
  try {
    return localStorage.getItem("pos_click_sound") !== "0";
  } catch {
    return true;
  }
}

const isEnabled = isClickSoundEnabled;

function getVolume() {
  try {
    const v = Number(localStorage.getItem("pos_click_volume"));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {
    /* localStorage əlçatmazdır */
  }
  return 0.35;
}

export function setClickSoundEnabled(on) {
  try {
    localStorage.setItem("pos_click_sound", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function setClickSoundVolume(v) {
  try {
    localStorage.setItem("pos_click_volume", String(v));
  } catch {
    /* ignore */
  }
}

/** data: URI-dən baytlar — fetch istifadə etmirik (paketlənmiş proqramda file:// altında etibarsızdır) */
function dataUriToArrayBuffer(uri) {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const meta = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  const dec = decodeURIComponent(payload);
  const out = new Uint8Array(dec.length);
  for (let i = 0; i < dec.length; i++) out[i] = dec.charCodeAt(i);
  return out.buffer;
}

/** Ehtiyat: Web Audio alınmayanda adi <audio> elementi */
let fallbackAudio = null;
function playFallbackAudio() {
  try {
    if (!fallbackAudio) {
      fallbackAudio = new Audio(clickSoundUrl);
      fallbackAudio.preload = "auto";
    }
    const a = fallbackAudio.cloneNode(true);
    a.volume = getVolume();
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch((e) => diag("<audio> çalınmadı: " + (e?.message || e)));
    if (diagPlays < 3) { diagPlays++; diag("çalındı (<audio>) vol=" + getVolume()); }
  } catch (e) {
    diag("<audio> ehtiyatı alınmadı: " + (e?.message || e));
  }
}

let decodeFailed = false;
let diagPlays = 0;
/** Diaqnostika — paketlənmiş proqramda main.log-a düşür (bax: main.js console-message) */
function diag(msg) {
  const line = "[CLICK-SOUND] " + msg;
  try { console.warn(line); } catch { /* yox */ }
  try { window.electronAPI?.logToMain?.(line); } catch { /* yox */ }
}

/** Faylı bir dəfə yükləyib dekod edir */
async function ensureBuffer() {
  if (buffer || decoding || decodeFailed) return;
  decoding = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { decodeFailed = true; return; }
    if (!audioCtx) audioCtx = new Ctx();
    let bytes = null;
    if (typeof clickSoundUrl === "string" && clickSoundUrl.startsWith("data:")) {
      bytes = dataUriToArrayBuffer(clickSoundUrl);
    } else {
      const res = await fetch(clickSoundUrl);
      bytes = await res.arrayBuffer();
    }
    if (!bytes) throw new Error("səs məlumatı boşdur");
    // Safari/köhnə Chromium callback formasını da dəstəkləyir
    buffer = await new Promise((resolve, reject) => {
      const r = audioCtx.decodeAudioData(bytes, resolve, reject);
      if (r && typeof r.then === "function") r.then(resolve, reject);
    });
    diag(`hazır: ${buffer.duration.toFixed(3)}s, ctx=${audioCtx.state}, sampleRate=${audioCtx.sampleRate}, enabled=${isEnabled()}, volume=${getVolume()}`);
  } catch (e) {
    decodeFailed = true;
    diag("Web Audio dekod alınmadı, <audio> ehtiyatına keçilir: " + (e?.message || e));
  } finally {
    decoding = false;
  }
}

/** Klik səsini çalır */
export function playClickSound() {
  if (!isEnabled()) {
    if (diagPlays < 3) { diagPlays++; diag("səs ayarı bağlıdır (pos_click_sound=0)"); }
    return;
  }

  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;

  if (decodeFailed) {
    playFallbackAudio();
    return;
  }

  if (!buffer) {
    // Hələ hazır deyil — ilk toxunuşda yüklə; bu dəfə ehtiyat ilə çal
    ensureBuffer();
    playFallbackAudio();
    return;
  }

  try {
    // Brauzer kontekstı dayandıra bilər (arxa fon, enerji qənaəti, istifadəçi jesti gözləmə)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buffer;
    gain.gain.value = getVolume();
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    if (diagPlays < 3) { diagPlays++; diag(`çalındı (WebAudio) ctx=${audioCtx.state} vol=${getVolume()}`); }
  } catch (e) {
    diag("Web Audio çalınmadı, <audio> ehtiyatı: " + (e?.message || e));
    playFallbackAudio();
  }
}

/* ------------------------------------------------------------------ *
 *  Qlobal dinləyici
 * ------------------------------------------------------------------ */

/** Səs verən elementlər */
const CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  "summary",
  "label",
  "select",
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  ".btn",
  ".nav-link",
  // Layihənin öz "basıla bilən" sinifləri — `cursor: pointer` yoxlamasına
  // etibar etmək azdır, sinif CSS-də təsadüfən təyin olunmaya bilər
  ".cursor-pointer",
  ".operation-item",
  "[data-click-sound]",
].join(",");

/**
 * Elementin "basıla bilən" olub-olmadığı.
 *
 * Yalnız selektora baxmaq azdır: POS-da masa kartı, menyu məhsulu və bir çox
 * başqa şey `onClick`-li `div`-dir, DOM-da isə bunu görmək mümkün deyil.
 * Ona görə `cursor: pointer` də yoxlanılır — belə elementlər praktiki olaraq
 * həmişə basıla biləndir.
 */
function isClickable(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.closest("[data-no-click-sound]")) return false;
  if (el.closest(CLICKABLE_SELECTOR)) return true;
  try {
    return window.getComputedStyle(el).cursor === "pointer";
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Sənədə bir dəfə qoşulur. `App.jsx` çağırır.
 * @returns {() => void} dinləyicini söndürən funksiya
 */
export function installGlobalClickSound() {
  if (installed || typeof document === "undefined") return () => {};
  installed = true;

  const onPointerDown = (e) => {
    // Yalnız əsas düymə / toxunuş; sağ klik və orta klik səs verməsin
    if (e.button != null && e.button !== 0) return;
    if (!isClickable(e.target)) {
      if (diagPlays < 3) diag(`toxunuş basıla bilən element deyil: <${e.target?.tagName?.toLowerCase()} class="${String(e.target?.className || "").slice(0, 40)}">`);
      return;
    }
    playClickSound();
  };

  // `click` yox, `pointerdown`: səs barmaq qalxmadan çıxsın, cavab ani hiss olunsun.
  // `capture` — komponent `stopPropagation()` etsə belə səs itməsin.
  document.addEventListener("pointerdown", onPointerDown, { capture: true });

  /**
   * Faylı DƏRHAL hazırla, ilk toxunuşu gözləmədən.
   *
   * Əvvəl `ensureBuffer()` yalnız ilk `pointerdown`-da çağırılırdı, ona görə
   * proqram açılandan sonra basılan BİRİNCİ düymə həmişə səssiz qalırdı —
   * dekod hələ bitməmiş olurdu. Brauzerin avtomatik səs qadağası yalnız səsin
   * ÇALINMASINA aiddir; `decodeAudioData` dayandırılmış kontekstdə də işləyir,
   * `resume()` isə onsuz da ilk toxunuşda baş verir (bax: playClickSound).
   */
  diag(`quraşdırıldı: enabled=${isEnabled()}, url=${String(clickSoundUrl).slice(0, 30)}…, len=${String(clickSoundUrl).length}`);
  ensureBuffer();

  installed = true;
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, { capture: true });
    installed = false;
  };
}

export default playClickSound;

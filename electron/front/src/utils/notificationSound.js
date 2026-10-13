/**
 * BİLDİRİŞ SƏSİ
 * =============
 *
 * Əsas səs: `assets/sounds/notification.wav` (mixkit "happy bells").
 * Fayl Vite tərəfindən paketə salınır; `base: './'` olduğundan quraşdırılmış
 * proqramda `file://` ilə də oxunur. `<audio>` elementi BİR DƏFƏ yaradılır,
 * hər çağırışda klonlanıb oxudulur ki, təkrarlar üst-üstə düşəndə kəsilməsin.
 *
 * Ehtiyat: fayl oxuna bilməsə (köhnə build, blok olunmuş avtoplay və s.)
 * brauzerin Web Audio ilə qısa siqnal çalınır — səs heç vaxt tam itmir.
 */
import notificationWavUrl from "../assets/sounds/notification.wav";

let baseAudio = null;

function getBaseAudio() {
  if (baseAudio) return baseAudio;
  try {
    const a = new Audio(notificationWavUrl);
    a.preload = "auto";
    baseAudio = a;
  } catch {
    baseAudio = null;
  }
  return baseAudio;
}

/** Ehtiyat siqnal (880 Hz → 440 Hz, yarım saniyə) */
function beepOnce(volume = 0.1) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => {
      try { ctx.close(); } catch { /* bağlanmadı */ }
    }, 1000);
  } catch {
    /* səs çalına bilmədi — kritik deyil */
  }
}

/** Faylı bir dəfə oxut; alınmasa ehtiyat siqnal */
function playFileOnce(volume) {
  const base = getBaseAudio();
  if (!base) {
    beepOnce(volume);
    return;
  }
  try {
    const a = base.cloneNode(true);
    a.volume = Math.max(0, Math.min(1, volume));
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => beepOnce(volume));
    }
  } catch {
    beepOnce(volume);
  }
}

/** Faylı əvvəlcədən yüklə (ilk bildirişdə gecikmə olmasın) */
export function preloadNotificationSound() {
  try {
    const a = getBaseAudio();
    if (a) a.load();
  } catch {
    /* nəzərə alınmır */
  }
}

/**
 * Bildiriş səsi.
 * @param {object} [opts]
 * @param {number} [opts.times=1]    neçə dəfə təkrarlansın
 * @param {number} [opts.gapMs=900]  təkrarlar arası fasilə
 * @param {number} [opts.volume=0.6] səs səviyyəsi (0–1)
 */
export function playNotificationSound(opts = {}) {
  const times = Math.max(1, Math.min(Number(opts.times) || 1, 5));
  const gapMs = Number(opts.gapMs) > 0 ? Number(opts.gapMs) : 900;
  const volume = Number(opts.volume) > 0 ? Math.min(1, Number(opts.volume) * 4) : 0.6;

  playFileOnce(volume);
  for (let i = 1; i < times; i++) {
    setTimeout(() => playFileOnce(volume), i * gapMs);
  }
}

/**
 * QR sifarişi üçün: kassir ekranın yanında olmaya bilər, ona görə üç dəfə.
 */
export function playQrOrderSound() {
  playNotificationSound({ times: 3, gapMs: 1200, volume: 0.2 });
}

export default playNotificationSound;

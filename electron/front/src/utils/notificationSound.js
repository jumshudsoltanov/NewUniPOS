/**
 * BİLDİRİŞ SƏSİ
 * =============
 *
 * Səs faylı işlətmirik — brauzerin öz səs mühərriki (Web Audio) ilə qısa siqnal
 * yaradılır. Belə olanda paketə əlavə fayl düşmür və səs heç vaxt "yüklənmədi"
 * vəziyyətinə düşmür.
 *
 * Bu kod əvvəl yalnız `KitchenDisplay.jsx` içində idi; QR sifarişi üçün də
 * lazım olduğundan ortaq fayla çıxarıldı.
 */

/** Bir qısa siqnal (880 Hz → 440 Hz, yarım saniyə) */
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
    // Kontekst açıq qalmasın — saatlarla işləyən POS-da yığılır
    setTimeout(() => {
      try { ctx.close(); } catch { /* bağlanmadı */ }
    }, 1000);
  } catch {
    /* səs çalına bilmədi — kritik deyil */
  }
}

/**
 * Bildiriş səsi.
 * @param {object} [opts]
 * @param {number} [opts.times=1]    neçə dəfə təkrarlansın
 * @param {number} [opts.gapMs=900]  təkrarlar arası fasilə
 * @param {number} [opts.volume=0.1] səs səviyyəsi (0–1)
 */
export function playNotificationSound(opts = {}) {
  const times = Math.max(1, Math.min(Number(opts.times) || 1, 5));
  const gapMs = Number(opts.gapMs) > 0 ? Number(opts.gapMs) : 900;
  const volume = Number(opts.volume) > 0 ? Number(opts.volume) : 0.1;

  beepOnce(volume);
  for (let i = 1; i < times; i++) {
    setTimeout(() => beepOnce(volume), i * gapMs);
  }
}

/**
 * QR sifarişi üçün: kassir ekranın yanında olmaya bilər, ona görə üç dəfə.
 */
export function playQrOrderSound() {
  playNotificationSound({ times: 3, gapMs: 900, volume: 0.15 });
}

export default playNotificationSound;

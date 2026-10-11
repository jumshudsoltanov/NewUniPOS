/**
 * QR SİFARİŞİ ÜÇÜN OFİSİANT
 * =========================
 *
 * `POST /api/sale` endpointi `waiterId` sahəsini məcburi tələb edir, QR-dan
 * gələn sifarişin isə ofisiantı yoxdur. Ofisiant belə seçilir:
 *
 *   1. Admin panelində `is_qr_user = 1` qoyulmuş ofisiant varsa O işlənir.
 *      Bu bayraq ofisiant siyahısı ilə birlikdə API-dən sinxronlaşır
 *      (bax: data/WaitersData.js).
 *
 *   2. Panelde seçim edilməyibsə "QR Sifariş" adlı lokal ofisiant yaradılır.
 *      `is_local = 1` qoyulur ki, admin panelə geri sinxronlaşmasın.
 *
 * DİQQƏT: bu yalnız `direct` rejimə aiddir. `manual` rejimdə sifarişi
 * bildirişlər bölməsindən kim təsdiqləyirsə həmin ofisiant yazılır.
 *
 * Bax: QR_ORDER_POS_PLAN.md
 */

const WaitersModel = require("../model/WaitersModel");

const QR_WAITER_NAME = "QR Sifariş";

/**
 * profileId -> { id, name, source, at } keşi.
 *
 * Panelde seçim dəyişəndə POS-u yenidən başlatmağa məcbur etməmək üçün keş
 * qısa ömürlüdür. Sorğu özü indekslidir, ona görə bu baha deyil.
 */
const CACHE_TTL_MS = 60000;
const cache = new Map();

/**
 * QR ofisiantını tapır, lazım gəlsə lokal olanı yaradır.
 * @returns {Promise<{id:number, name:string, source:"panel"|"local"}|null>}
 */
async function resolveQrWaiter(profileId) {
  const pid = Number(profileId);
  if (!pid) return null;

  const hit = cache.get(pid);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { id: hit.id, name: hit.name, source: hit.source };
  }

  try {
    // 1) Admin panelində seçilmiş ofisiant
    const chosen = await WaitersModel.findOne({
      where: { profile_id: pid, is_qr_user: 1 },
      attributes: ["id", "name"],
      order: [["id", "ASC"]],
    });

    let result;
    if (chosen) {
      result = { id: chosen.id, name: chosen.name || QR_WAITER_NAME, source: "panel" };
    } else {
      // 2) Lokal ehtiyat ofisiant
      let waiter = await WaitersModel.findOne({
        where: { profile_id: pid, name: QR_WAITER_NAME },
        attributes: ["id", "name"],
      });
      if (!waiter) {
        waiter = await WaitersModel.create({
          profile_id: pid,
          name: QR_WAITER_NAME,
          is_local: 1,
        });
        console.log(`[QR] "${QR_WAITER_NAME}" ofisiantı yaradıldı (id: ${waiter.id})`);
      }
      result = { id: waiter.id, name: waiter.name || QR_WAITER_NAME, source: "local" };
    }

    cache.set(pid, { ...result, at: Date.now() });
    return result;
  } catch (err) {
    console.warn("[QR] Ofisiant təmin edilə bilmədi:", err?.message);
    // Keş varsa köhnə dəyərlə davam et — sifariş itməsin
    if (hit) return { id: hit.id, name: hit.name, source: hit.source };
    return null;
  }
}

/**
 * Köhnə ad — yalnız id qaytarır.
 * @returns {Promise<number|null>}
 */
async function ensureQrWaiter(profileId) {
  const w = await resolveQrWaiter(profileId);
  return w ? w.id : null;
}

/** Ofisiant siyahısı yenilənəndən sonra çağırılır */
function clearQrWaiterCache() {
  cache.clear();
}

module.exports = {
  resolveQrWaiter,
  ensureQrWaiter,
  clearQrWaiterCache,
  QR_WAITER_NAME,
};

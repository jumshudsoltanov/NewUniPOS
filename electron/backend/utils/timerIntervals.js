/**
 * TAYMER İNTERVALLARI — təhlükəsiz oxuma/yazma
 * ============================================
 *
 * PROBLEM (tapılan real qüsur):
 * `products.timer_intervals` sütunu `DataTypes.JSON`-dur, lakin yazarkən dəyər
 * əvvəlcə `JSON.stringify(...)` ilə mətnə çevrilib sonra JSON sütununa verilirdi.
 * Sequelize onu BİR DƏFƏ DƏ kodlayırdı, nəticədə bazada boş massiv `[]` əvəzinə
 * ikiqat kodlanmış `"[]"` mətni qalırdı.
 *
 * Oxuyan tərəf isə sadəcə `!!item.product.timer_intervals` yoxlayırdı. Boş olmayan
 * mətn həmişə doğrudur, ona görə Coca Cola, kabab kimi adi məhsullar da "taymerli
 * məhsul" sayılırdı və masaya göndəriləndə TAYMER ÖZÜ BAŞLAYIRDI.
 *
 * Bu modul hər iki tərəfi düzəldir:
 *   • oxuma  — nə qədər qatlı kodlanmış olsa da düzgün massivə açır
 *   • yazma  — təmiz massiv qaytarır (boşdursa null), beləliklə yeni zibil yaranmır
 */

const MAX_DECODE_DEPTH = 5;

/**
 * İstənilən formadakı dəyəri (massiv, JSON mətn, iç-içə kodlanmış mətn, null)
 * real massivə açır.
 * @returns {Array|null} boş olmayan massiv, yoxsa null
 */
function parseTimerIntervals(raw) {
  if (raw === null || raw === undefined) return null;

  let value = raw;
  let depth = 0;
  while (typeof value === "string" && depth < MAX_DECODE_DEPTH) {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
    depth += 1;
  }

  if (!Array.isArray(value) || value.length === 0) return null;
  return value;
}

/**
 * Məhsulun HƏQİQİ interval taymeri varmı?
 * Köhnə `!!timer_intervals` yoxlamasının əvəzidir — boş `[]` və ikiqat kodlanmış
 * `"[]"` artıq doğru saymır.
 */
function hasTimerIntervals(raw) {
  return parseTimerIntervals(raw) !== null;
}

/**
 * JSON sütununa yazmaq üçün normal dəyər.
 * Sequelize JSON sütununu özü kodlayır, ona görə BURADA `JSON.stringify`
 * ÇAĞIRMAQ OLMAZ — məhz o, ikiqat kodlanmaya səbəb olurdu.
 * @returns {Array|null}
 */
function normalizeTimerIntervalsForStorage(raw) {
  return parseTimerIntervals(raw);
}

module.exports = {
  parseTimerIntervals,
  hasTimerIntervals,
  normalizeTimerIntervalsForStorage,
};

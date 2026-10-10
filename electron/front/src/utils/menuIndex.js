/**
 * Menyu indeksi — performans üçün mərkəzi köməkçi.
 *
 * Problem: taymer/qiymət hesablamaları hər saniyə hər sifariş sətri üçün
 * `menuData.find(m => Number(m.id) === ...)` çağırırdı. Menyuda minlərlə məhsul
 * olduqda bu, saniyədə yüz minlərlə iterasiya deməkdir və POS-u dondurur.
 *
 * Həll: массив referansına bağlı Map indeksi (WeakMap keş) — axtarış O(1).
 * Redux-dan gələn menyu массivi fetch arası dəyişmədiyi üçün indeks bir dəfə qurulur.
 */

const indexCache = new WeakMap(); // menuArray -> Map<id, product>

/** Massiv üçün id→məhsul Map-ı qaytarır (ilk çağırışda qurur, sonra keşdən) */
export function getMenuIndex(menuArray) {
  if (!Array.isArray(menuArray) || menuArray.length === 0) return null;
  let map = indexCache.get(menuArray);
  if (!map) {
    map = new Map();
    for (let i = 0; i < menuArray.length; i++) {
      const p = menuArray[i];
      const id = Number(p?.id);
      if (!Number.isNaN(id)) map.set(id, p);
    }
    indexCache.set(menuArray, map);
  }
  return map;
}

/** O(1) məhsul axtarışı — köhnə `.find(m => Number(m.id) === Number(id))` əvəzi */
export function findMenuItemById(menuArray, id) {
  const map = getMenuIndex(menuArray);
  if (!map) return undefined;
  const n = Number(id);
  if (Number.isNaN(n)) return undefined;
  return map.get(n);
}

/**
 * timer_intervals parse keşi.
 *
 * Problem: hər tick-də hər sətir üçün `JSON.parse(intervals)` işləyirdi.
 * Eyni string həmişə eyni nəticə verdiyi üçün nəticəni keşləyirik.
 * Qaytarılan массив MUTATE EDİLMƏMƏLİDİR (oxumaq üçündür; sort lazımdırsa kopyala).
 */
const parsedIntervalsCache = new Map(); // raw string -> array | null
const PARSE_CACHE_LIMIT = 1000;

/**
 * Nə verilsə (string, iç-içə JSON string, массив, null) normal массив və ya null qaytarır.
 */
export function parseTimerIntervals(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
  if (typeof raw !== "string") return null;

  const cached = parsedIntervalsCache.get(raw);
  if (cached !== undefined) return cached;

  let out = raw;
  let guard = 0;
  while (typeof out === "string" && guard++ < 5) {
    try {
      out = JSON.parse(out);
    } catch {
      out = null;
      break;
    }
  }
  const result = Array.isArray(out) && out.length > 0 ? out : null;

  if (parsedIntervalsCache.size >= PARSE_CACHE_LIMIT) parsedIntervalsCache.clear();
  parsedIntervalsCache.set(raw, result);
  return result;
}

/**
 * Məhsulun HƏQİQİ interval taymeri varmı?
 *
 * Köhnə kodda bir çox yerdə sadəcə `!!timer_intervals` yoxlanılırdı. Bazada bəzi
 * adi məhsullar (Coca Cola, kabab və s.) bu sahədə BOŞ massivi `"[]"` mətni kimi
 * saxlayır — boş olmayan mətn isə həmişə doğrudur. Nəticədə həmin məhsullar
 * "taymerli" sayılır, taymer özü başlayır və məbləğ səhv hesablanırdı.
 */
export function hasTimerIntervals(raw) {
  return parseTimerIntervals(raw) !== null;
}

/** Sətir üçün intervalları tapır: əvvəl sətrin özündən, sonra məhsuldan, sonra menyudan */
export function resolveItemIntervals(item, menuArray) {
  // Diqqət: köhnə davranışla eyni olsun deyə yalnız falsy olduqda menyuya baxırıq
  let intervals = item?.timer_intervals || item?.product?.timer_intervals;
  if (!intervals) {
    const catItem = findMenuItemById(menuArray, item?.product_id || item?.id);
    if (catItem) intervals = catItem.timer_intervals;
  }
  return parseTimerIntervals(intervals);
}

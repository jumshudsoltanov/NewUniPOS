/**
 * BooksSlice və TablesSlice-də eyni çek üçün taymer məlumatı fərqli ola bilər:
 * tickTimer yalnız TablesSlice-i yeniləyir. Çek ekranında masa kartı ilə eyni
 * saat və qazanc göstərilsin deyə aktiv taymerdə TablesSlice üstünlük verilir.
 *
 * PERFORMANS: bu selektor `useSelector` içindən çağırılır, yəni HƏR dispatch-da
 * HƏR masa komponenti üçün bir dəfə işləyir. Əvvəl hər çağırışda bütün kitablar +
 * bütün zallar × masalar × sifarişlər xətti şəkildə skan olunurdu — 100 masada bu,
 * saniyədə on minlərlə iterasiya deməkdir. İndi slice referansına bağlı
 * uuid/id → sifariş indeksi qurulur (massiv dəyişməyincə təkrar qurulmur) və
 * axtarış O(1) olur.
 */

import { findMenuItemById, parseTimerIntervals } from "./menuIndex";

const booksIndexCache = new WeakMap(); // booksArray -> Map<key, order>
const tablesIndexCache = new WeakMap(); // tableGroupsArray -> Map<key, order>

function addOrderKeys(map, order) {
  if (order?.uuid != null) {
    const k = String(order.uuid);
    if (!map.has(k)) map.set(k, order);
  }
  if (order?.id != null) {
    const k = String(order.id);
    if (!map.has(k)) map.set(k, order);
  }
}

function getBooksIndex(booksData) {
  if (!Array.isArray(booksData) || booksData.length === 0) return null;
  let map = booksIndexCache.get(booksData);
  if (!map) {
    map = new Map();
    for (let i = 0; i < booksData.length; i++) addOrderKeys(map, booksData[i]);
    booksIndexCache.set(booksData, map);
  }
  return map;
}

function getTablesIndex(tableGroupsData) {
  if (!Array.isArray(tableGroupsData) || tableGroupsData.length === 0) return null;
  let map = tablesIndexCache.get(tableGroupsData);
  if (!map) {
    map = new Map();
    for (let h = 0; h < tableGroupsData.length; h++) {
      const tables = tableGroupsData[h]?.tables;
      if (!tables) continue;
      for (let t = 0; t < tables.length; t++) {
        const orders = tables[t]?.orders;
        if (!orders) continue;
        for (let o = 0; o < orders.length; o++) addOrderKeys(map, orders[o]);
      }
    }
    tablesIndexCache.set(tableGroupsData, map);
  }
  return map;
}

export function selectLiveTimerData(state, orderUuid) {
  if (!orderUuid) return null;
  const key = String(orderUuid);

  const booksRaw = state.BooksSlice?.books;
  const booksData = Array.isArray(booksRaw) ? booksRaw : booksRaw?.data;
  const booksIndex = getBooksIndex(booksData);
  const fromBooks = booksIndex ? booksIndex.get(key) || null : null;

  const tg = state.TablesSlice?.tableGroups?.data;
  const tablesIndex = getTablesIndex(tg);
  const fromTables = tablesIndex ? tablesIndex.get(key) || null : null;

  if (!fromBooks && !fromTables) return null;

  if (fromBooks && fromTables) {
    const tablesLooksLive =
      fromTables.is_timer_status === 1 ||
      Number(fromTables.rate_per_minute || 0) > 0 ||
      (fromTables.is_timer_clock &&
        String(fromTables.is_timer_clock) !== "" &&
        fromTables.is_timer_clock !== "00:00:00") ||
      (fromTables.orders_items &&
        fromTables.orders_items.some((item) => Number(item.is_timer_status) === 1));
    if (tablesLooksLive) {
      return fromTables;
    }
  }

  return fromBooks || fromTables;
}

/**
 * BooksSlice-dan konkret sifarişi O(1) tapır.
 *
 * PERFORMANS: əvvəl masa komponentləri bütün `state.BooksSlice`-a abunə olurdu.
 * `tickTimer` hər saniyə slice-ı dəyişdiyi üçün bu, taymeri olmayan masaları da
 * saniyədə bir dəfə yenidən render etdirirdi (React.memo-nu da keçərək, çünki
 * memo yalnız props-u qoruyur, useSelector abunəliyini yox). Bu selektor yalnız
 * həmin bir sifariş obyektini qaytarır — referans dəyişməyincə render olmur.
 */
export function selectBookOrder(state, orderUuid, orderId) {
  const booksRaw = state.BooksSlice?.books;
  const booksData = Array.isArray(booksRaw) ? booksRaw : booksRaw?.data;
  const index = getBooksIndex(booksData);
  if (!index) return null;
  if (orderUuid != null) {
    const byUuid = index.get(String(orderUuid));
    if (byUuid) return byUuid;
  }
  if (orderId != null) {
    const byId = index.get(String(orderId));
    if (byId) return byId;
  }
  return null;
}

/**
 * Ekranda ümumiyyətlə işləyən taymer var?
 *
 * PERFORMANS: `App.jsx` hər saniyə `tickBooks()` + `tickTables()` dispatch edirdi —
 * restoranda heç bir saatlıq hesablaşma olmasa belə. Hər dispatch bütün mount
 * olunmuş komponentlərin BÜTÜN `useSelector` selektorlarını yenidən işlədir, yəni
 * POS heç nə etmədən saniyədə iki dəfə tam yenidən qiymətləndirmə dövrünə düşürdü.
 *
 * Bu funksiya cavabı massiv referansına bağlı keşləyir: taymer yoxdursa massivlər
 * dəyişmir, cavab keşdən gəlir və saniyəlik yoxlama praktiki olaraq pulsuzdur.
 * Taymer varsa massiv hər saniyə dəyişir, amma hesablama bir dəfə (komponent
 * sayından asılı olmayaraq) aparılır.
 */
// array -> { menu, flag }. Menyu referansı da saxlanılır: menyu sifarişlərdən
// SONRA yüklənə bilər və o halda "taymer məhsulu" təyini dəyişir — yoxsa köhnə
// `false` nəticəsi keşdə qalıb taymeri heç vaxt başlatmazdı.
const liveTimerFlagCache = new WeakMap();

function orderLooksTimed(order, menuArray) {
  if (Number(order?.is_timer_status) === 1) return true;
  const items = order?.orders_items;
  if (!items || items.length === 0) return false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (Number(it?.product?.hourly_price || 0) > 0) return true;
    if (parseTimerIntervals(it?.product?.timer_intervals) !== null) return true;
    const catItem = findMenuItemById(menuArray, it?.product_id || it?.id);
    if (catItem) {
      if (Number(catItem.hourly_price || 0) > 0) return true;
      if (parseTimerIntervals(catItem.timer_intervals) !== null) return true;
    }
  }
  return false;
}

export function hasAnyLiveTimer(state) {
  const menuArray = state?.OrderSlice?.menu || state?.MenuSlice?.data || null;

  const tg = state?.TablesSlice?.tableGroups?.data;
  if (Array.isArray(tg) && tg.length > 0) {
    const entry = liveTimerFlagCache.get(tg);
    let cached = entry && entry.menu === menuArray ? entry.flag : undefined;
    if (cached === undefined) {
      cached = false;
      outer: for (let h = 0; h < tg.length; h++) {
        const tables = tg[h]?.tables;
        if (!tables) continue;
        for (let t = 0; t < tables.length; t++) {
          const orders = tables[t]?.orders;
          if (!orders) continue;
          for (let o = 0; o < orders.length; o++) {
            if (orderLooksTimed(orders[o], menuArray)) {
              cached = true;
              break outer;
            }
          }
        }
      }
      liveTimerFlagCache.set(tg, { menu: menuArray, flag: cached });
    }
    if (cached) return true;
  }

  const booksRaw = state?.BooksSlice?.books;
  const booksData = Array.isArray(booksRaw) ? booksRaw : booksRaw?.data;
  if (Array.isArray(booksData) && booksData.length > 0) {
    const entry = liveTimerFlagCache.get(booksData);
    let cached = entry && entry.menu === menuArray ? entry.flag : undefined;
    if (cached === undefined) {
      cached = false;
      for (let i = 0; i < booksData.length; i++) {
        if (orderLooksTimed(booksData[i], menuArray)) {
          cached = true;
          break;
        }
      }
      liveTimerFlagCache.set(booksData, { menu: menuArray, flag: cached });
    }
    if (cached) return true;
  }

  return false;
}

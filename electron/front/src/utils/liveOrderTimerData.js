/**
 * BooksSlice və TablesSlice-də eyni çek üçün taymer məlumatı fərqli ola bilər:
 * tickTimer yalnız TablesSlice-i yeniləyir. Çek ekranında masa kartı ilə eyni
 * saat və qazanc göstərilsin deyə aktiv taymerdə TablesSlice üstünlük verilir.
 */
export function selectLiveTimerData(state, orderUuid) {
  if (!orderUuid) return null;

  let fromBooks = null;
  const booksData = Array.isArray(state.BooksSlice.books)
    ? state.BooksSlice.books
    : state.BooksSlice.books?.data;
  if (booksData) {
    const order = booksData.find((o) => String(o.uuid) === String(orderUuid) || String(o.id) === String(orderUuid));
    if (order) {
      fromBooks = order;
    }
  }

  let fromTables = null;
  const tg = state.TablesSlice.tableGroups?.data;
  if (tg) {
    for (const hall of tg) {
      for (const t of hall.tables || []) {
        const order = t.orders?.find((o) => String(o.uuid) === String(orderUuid) || String(o.id) === String(orderUuid));
        if (order) {
          fromTables = order;
          break;
        }
      }
      if (fromTables) break;
    }
  }

  if (!fromBooks && !fromTables) return null;

  if (fromBooks && fromTables) {
    const tablesLooksLive =
      fromTables.is_timer_status === 1 ||
      Number(fromTables.rate_per_minute || 0) > 0 ||
      (fromTables.is_timer_clock &&
        String(fromTables.is_timer_clock) !== "" &&
        fromTables.is_timer_clock !== "00:00:00") ||
      (fromTables.orders_items && fromTables.orders_items.some(item => Number(item.is_timer_status) === 1));
    if (tablesLooksLive) {
      return fromTables;
    }
  }

  return fromBooks || fromTables;
}

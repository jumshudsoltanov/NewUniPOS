import api from "./apiConfig";
import { findMenuItemById } from "./menuIndex";
import { processAndPrintOrders } from "./printerHelpers.jsx";
import { addNotification } from "./notificationService";
import { t } from "./translations";

/**
 * QR SİFARİŞİNİN POS-A YAZILMASI
 * ==============================
 *
 * Hər iki rejim (`direct` və `manual`) bu modulu işlədir. Fərq yalnız masanın
 * haradan gəlməsindədir: `direct`-də QR-dan, `manual`-da ofisiantın seçdiyi.
 *
 * Addımlar:
 *   1. Masada açıq çek varsa ona əlavə edilir, yoxdursa yeni çek açılır
 *   2. Məhsullar yazılır — qiymət POS-un ÖZ bazasından götürülür
 *   3. Mətbəxə avtomatik çap edilir (kassir "Göndər" basmır)
 *
 * Bax: QR_ORDER_POS_PLAN.md
 */

const HANDLED_KEY = "pos_qr_handled_uuids";
const HANDLED_LIMIT = 200;
export const QR_TERMINAL_ID = "QR-01";

/* ------------------------------------------------------------------ *
 *  Təkrarın qarşısı
 * ------------------------------------------------------------------ */

/**
 * Bulud ack gəlməyəndə EYNİ `orderUuid` ilə təkrar göndərir. `orders-items`
 * endpointində idempotentlik olmadığı üçün təkrar emal məhsulları ikiqat yazar.
 */
export function isQrOrderHandled(orderUuid) {
  if (!orderUuid) return false;
  try {
    const list = JSON.parse(localStorage.getItem(HANDLED_KEY) || "[]");
    return list.includes(orderUuid);
  } catch {
    return false;
  }
}

export function markQrOrderHandled(orderUuid) {
  if (!orderUuid) return;
  try {
    const list = JSON.parse(localStorage.getItem(HANDLED_KEY) || "[]");
    if (list.includes(orderUuid)) return;
    list.push(orderUuid);
    localStorage.setItem(
      HANDLED_KEY,
      JSON.stringify(list.slice(-HANDLED_LIMIT)),
    );
  } catch {
    /* localStorage əlçatmazdır */
  }
}

/* ------------------------------------------------------------------ *
 *  Gözləyən sifarişlər (manual rejim)
 * ------------------------------------------------------------------ */

const PENDING_PREFIX = "pos_qr_pending_";

export function savePendingQrOrder(order) {
  try {
    localStorage.setItem(PENDING_PREFIX + order.orderUuid, JSON.stringify(order));
  } catch { /* yer yoxdur */ }
}

export function getPendingQrOrder(orderUuid) {
  try {
    const raw = localStorage.getItem(PENDING_PREFIX + orderUuid);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Bildirişlər panelində "Qəbul et / Rədd et" düymələrinin göstərilməsi BURAYA
 * baxır. `status === "new"` ilə yoxlamaq olmazdı: panel bağlananda bütün
 * bildirişlər `old` olur və gözləyən sifariş qəbul edilə bilməz qalırdı.
 */
export function isQrOrderPending(orderUuid) {
  if (!orderUuid) return false;
  try {
    return localStorage.getItem(PENDING_PREFIX + orderUuid) != null;
  } catch {
    return false;
  }
}

export function removePendingQrOrder(orderUuid) {
  try {
    localStorage.removeItem(PENDING_PREFIX + orderUuid);
  } catch { /* nəzərə alınmır */ }
}

/* ------------------------------------------------------------------ *
 *  QR ofisiantı
 * ------------------------------------------------------------------ */

/**
 * `direct` rejimin ofisiantı: admin panelində `is_qr_user = 1` seçilmiş
 * ofisiant, seçim yoxdursa "QR Sifariş" adlı lokal ofisiant.
 *
 * Nəticə `localStorage`-də SAXLANILMIR: panelde seçim dəyişəndə POS köhnə
 * ofisiantı işlətməyə davam edərdi. Backend-in özündə 60 saniyəlik keş var,
 * ona görə hər sifarişdə sorğu vermək baha deyil.
 *
 * @returns {Promise<{id:number, name:string}>}
 */
export async function resolveQrWaiter(profileId) {
  const res = await api.get(`/qr/waiter-id/${profileId}`);
  const d = res?.data?.data || {};
  const id = Number(d.waiterId || 0);
  if (!id) throw new Error("QR ofisiantı alınmadı");
  return { id, name: d.waiterName || "QR Sifariş" };
}

/* ------------------------------------------------------------------ *
 *  Qiymət — POS-un öz bazasından
 * ------------------------------------------------------------------ */

/**
 * Buludun göndərdiyi qiymət qonağın GÖRDÜYÜ qiymətdir. Çekə həmişə POS-un
 * cari qiyməti yazılmalıdır, əks halda menyu dəyişəndə uyğunsuzluq yaranır.
 *
 * @returns {{ productList: Array, priceDiffs: Array }}
 */
export function buildProductList(order, menuCatalog) {
  const priceDiffs = [];
  const productList = (order.items || []).map((it) => {
    const local = findMenuItemById(menuCatalog, it.product_id);
    const localPrice = local ? Number(local.price) : null;
    const qrPrice = Number(it.price || 0);
    const finalPrice = localPrice != null && !Number.isNaN(localPrice) ? localPrice : qrPrice;

    if (localPrice != null && Math.abs(localPrice - qrPrice) > 0.005) {
      priceDiffs.push({
        name: it.name || local?.name || String(it.product_id),
        qrPrice,
        localPrice,
      });
    }

    return {
      product_id: it.product_id,
      quantity: Number(it.quantity) || 1,
      price: finalPrice,
      comment: it.comment || null,
      portion_name: it.portion_name || null,
      // DİQQƏT: `orders_items.modifiers` sütunu `DataTypes.JSON`-dur.
      // Sequelize onu ÖZÜ kodlayır, ona görə buraya MASSİV verilir.
      // `JSON.stringify` etsək ikiqat kodlanma olur və sütunda
      // `"[{...}]"` qalır (POS-un öz sətirləri isə `[{...}]` saxlayır).
      modifiers:
        Array.isArray(it.modifiers) && it.modifiers.length
          ? it.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              price: Number(m.price) || 0,
              count: Number(m.count) || 1,
              printer_details: [],
            }))
          : null,
    };
  });

  return { productList, priceDiffs };
}

/* ------------------------------------------------------------------ *
 *  Əsas funksiya
 * ------------------------------------------------------------------ */

/**
 * QR sifarişini POS bazasına yazır və mətbəxə çap edir.
 *
 * @param {object} p
 * @param {object} p.order          socket-dən gələn sifariş
 * @param {object} p.table          { id, name, hall_id, hall_name }
 * @param {number} p.profileId
 * @param {Array}  p.activeOrders   açıq çeklər (BooksSlice)
 * @param {Array}  p.menuCatalog    menyu (OrderSlice.menu)
 * @param {object} p.menuWithCategories  çap yönləndirməsi üçün
 * @param {object} [p.waiter]        { id, name } — verilməzsə QR ofisiantı işlənir.
 *                                   `manual` rejimdə sifarişi təsdiqləyən ofisiant verilir.
 * @returns {Promise<{orderUuid:string, checkId:number, appended:boolean, priceDiffs:Array, waiter:object}>}
 */
export async function writeQrOrderToPos({
  order,
  table,
  profileId,
  activeOrders,
  menuCatalog,
  menuWithCategories,
  waiter,
}) {
  // `manual` rejimdə qəbul edən ofisiant, `direct`-də panelde seçilmiş QR ofisiantı
  const effectiveWaiter =
    waiter?.id > 0 ? { id: Number(waiter.id), name: waiter.name || "" } : await resolveQrWaiter(profileId);
  const waiterId = effectiveWaiter.id;
  const { productList, priceDiffs } = buildProductList(order, menuCatalog);

  if (productList.length === 0) {
    throw new Error("Sifarişdə məhsul yoxdur");
  }

  // 1) Masada açıq çek varsa ona əlavə et (bax: plan 6.6 / sual 1)
  const existing = (activeOrders || []).find(
    (o) => Number(o.table_id) === Number(table.id) && Number(o.status) === 1,
  );

  let orderUuid;
  let checkId;
  let appended = false;

  if (existing) {
    orderUuid = existing.uuid;
    checkId = existing.id;
    appended = true;
  } else {
    const head = await api.post("/sale", {
      uuid: order.orderUuid,
      profileId,
      tableId: table.id,
      hallId: table.hall_id ?? 0,
      waiterId,
      terminalId: QR_TERMINAL_ID,
      guestCount: order.guestCount ?? 0,
      sale_type: "dine_in",
      status: 1,
      is_selected: 1,
    });
    if (head?.data?.message !== "success") {
      throw new Error(head?.data?.data || "Çek yaradıla bilmədi");
    }
    orderUuid = head.data.data.uuid;
    checkId = head.data.count;
  }

  // 2) Məhsullar
  await api.post(`/orders-items/${orderUuid}/items`, {
    profileId,
    waiterId,
    productList,
  });

  // Bu nöqtədən sonra sifariş bazadadır — çap uğursuz olsa belə `accepted` sayılır
  markQrOrderHandled(order.orderUuid);

  // 3) Mətbəxə AVTOMATİK çap (kassir "Göndər" basmır)
  try {
    printQrOrderToKitchen({
      order,
      table,
      checkId,
      orderUuid,
      waiterId,
      waiterName: effectiveWaiter.name,
      productList,
      menuCatalog,
      menuWithCategories,
    });
  } catch (err) {
    addNotification(
      t("qr_sifarisi_cap_olunmadi"),
      `${table.name || ""} — ${err?.message || ""}`,
      { type: "error", category: "printer", orderId: orderUuid },
    );
  }

  return { orderUuid, checkId, appended, priceDiffs, waiter: effectiveWaiter };
}

/**
 * Mətbəx çapı.
 *
 * `processAndPrintOrders` yönləndirməni ÖZÜ edir: hər sətir üçün əvvəlcə
 * məhsulun `printer_details`-inə, yoxdursa kateqoriyanınkına baxır və hər
 * printerə ayrıca çap işi yaradır. Yəni "hər məhsul öz printerinə düşsün"
 * üçün əlavə kod lazım deyil.
 */
function printQrOrderToKitchen({
  order,
  table,
  checkId,
  orderUuid,
  waiterId,
  waiterName,
  productList,
  menuCatalog,
  menuWithCategories,
}) {
  const itemsForPrinting = productList.map((pl) => {
    const local = findMenuItemById(menuCatalog, pl.product_id);
    return {
      ...pl,
      id: pl.product_id,
      name: local?.name || String(pl.product_id),
      count: pl.quantity,
      category_id: local?.category_id ?? null,
      printer_details: local?.printer_details || [],
      modifiers: Array.isArray(pl.modifiers) ? pl.modifiers : [],
    };
  });

  const printContext = {
    uuid: orderUuid,
    id: checkId,
    table: { id: table.id, name: table.name, hall_id: table.hall_id ?? 0 },
    hall: { id: table.hall_id ?? 0, name: table.hall_name || order.hallName || "" },
    waiter: { id: waiterId, name: waiterName || "QR Sifariş" },
    sale_type: "dine_in",
    guest_count: order.guestCount ?? 0,
    note: order.note || null,
    start_date: new Date().toISOString(),
  };

  processAndPrintOrders(itemsForPrinting, printContext, menuWithCategories);
}

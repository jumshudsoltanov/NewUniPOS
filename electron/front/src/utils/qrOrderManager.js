import { toast } from "react-toastify";
import { addNotification } from "./notificationService";
import { playQrOrderSound } from "./notificationSound";
import { t } from "./translations";
import { initQrSocket, sendQrStatus } from "./qrSocket";
import {
  isQrOrderHandled,
  markQrOrderHandled,
  savePendingQrOrder,
  getPendingQrOrder,
  removePendingQrOrder,
  writeQrOrderToPos,
} from "./qrOrderIntake";

/**
 * QR SİFARİŞLƏRİNİN İDARƏSİ
 * =========================
 *
 * Bildirişlər paneli İKİ yerdə render olunur (Header və Check), ona görə
 * qəbul/rədd məntiqi komponentlərdə deyil, burada saxlanılır. Hər iki panel
 * bu moduldan `acceptQrOrder` / `rejectQrOrder` çağırır.
 *
 * Socket və masa seçmə modalı `App.jsx`-də bir dəfə quraşdırılır.
 *
 * Bax: QR_ORDER_POS_PLAN.md
 */

/**
 * App.jsx-in verdiyi kontekst. Redux-u birbaşa oxumuruq ki, bu modul
 * komponentlərdən asılı olmasın.
 */
let ctx = null;

/**
 * @param {object} c
 * @param {() => object} c.getProfile            cari profil (id, is_qr_order_* bayraqları)
 * @param {() => Array}  c.getActiveOrders       açıq çeklər
 * @param {() => Array}  c.getMenuCatalog        məhsul kataloqu
 * @param {() => object} c.getMenuWithCategories çap yönləndirməsi üçün
 * @param {() => object} c.getLoginedWaiter       cari ofisiant ({ id, name })
 * @param {(order) => Promise<object|null>} c.requestTable  masa seçmə modalını açır
 * @param {() => void}   [c.onOrdersChanged]     POS siyahılarını yeniləmək
 */
export function configureQrOrderManager(c) {
  ctx = c;
}

/**
 * Bildirişlər panelini yeniləməyə məcbur edir.
 *
 * "Qəbul et / Rədd et" düymələri gözləyən sifarişin mövcudluğuna baxır, ona
 * görə sifariş emal olunan kimi panelə xəbər verilməlidir — əks halda düymələr
 * növbəti bildirişə qədər ekranda qalır.
 */
function refreshNotificationPanel() {
  try {
    window.dispatchEvent(new CustomEvent("newNotification"));
  } catch { /* pəncərə yoxdur */ }
}

/**
 * Sifarişin rejimi.
 *
 * Bulud hər `qr:order:new` ilə `mode` göndərir ("manual" | "direct") və o,
 * restoranın icazəsindən hesablanır. Ona üstünlük veririk: belə olanda
 * panelde rejim dəyişəndə POS-un profili yeniləməsini gözləmək lazım gəlmir.
 * Sahə gəlməsə profil bayraqlarına qayıdılır.
 */
function readOrderMode(order) {
  const m = String(order?.mode || "").toLowerCase();
  if (m === "manual" || m === "direct") return m;
  return readMode();
}

/** Profilin QR rejimini oxuyur */
function readMode() {
  const p = ctx?.getProfile?.() || {};
  const direct = Number(p.is_qr_order_direct) === 1;
  const manual = Number(p.is_qr_order_manual) === 1;
  if (direct && manual) {
    // İkisi birdən aktivdirsə manual üstün tutulur — kassirin nəzarəti qalsın
    return "manual";
  }
  if (direct) return "direct";
  if (manual) return "manual";
  return "off";
}

/* ------------------------------------------------------------------ *
 *  Socket-dən gələn sifariş
 * ------------------------------------------------------------------ */

export async function handleIncomingQrOrder(order) {
  if (!order?.orderUuid) return;

  // Bulud ack gəlməyəndə eyni sifarişi təkrar göndərir
  if (isQrOrderHandled(order.orderUuid)) {
    console.warn("[QR] Təkrar sifariş atıldı:", order.orderUuid);
    return;
  }

  // Profildə QR tamam sönülüdürsə sifariş qəbul edilmir — buludun `mode`-u
  // bunu keçə bilməz, əks halda söndürülmüş kassaya sifariş yazılardı
  if (readMode() === "off") {
    await sendQrStatus({
      orderUuid: order.orderUuid,
      status: "rejected",
      reason: "QR sifariş qəbulu söndürülüb",
    });
    return;
  }

  const mode = readOrderMode(order);

  if (mode === "off") {
    await sendQrStatus({
      orderUuid: order.orderUuid,
      status: "rejected",
      reason: "QR sifariş qəbulu söndürülüb",
    });
    return;
  }

  if (mode === "manual") {
    // Bildirişlər bölməsinə düşsün + səs
    savePendingQrOrder(order);
    const itemCount = (order.items || []).reduce(
      (n, it) => n + (Number(it.quantity) || 1),
      0,
    );
    addNotification(
      t("yeni_qr_sifarisi"),
      order.note || "",
      {
        type: "info",
        category: "qr_order",
        orderId: order.orderUuid,
        dedupeKey: `qr-${order.orderUuid}`,
        // Panel bunları çip kimi göstərir (bax: NotificationSidebar.jsx)
        meta: {
          tableName: order.tableName || t("masa_secilmeyib"),
          hallName: order.hallName || "",
          itemCount,
          total: Number(order.total || 0),
        },
      },
    );
    playQrOrderSound();
    return;
  }

  // direct — masa QR-dan gəlir, dərhal yaz və çap et
  const table = {
    id: order.tableId,
    name: order.tableName,
    hall_id: order.hallId ?? 0,
    hall_name: order.hallName || "",
  };

  if (!table.id) {
    await sendQrStatus({
      orderUuid: order.orderUuid,
      status: "failed",
      reason: "Sifarişdə masa yoxdur",
    });
    return;
  }

  await commitQrOrder(order, table);
}

/* ------------------------------------------------------------------ *
 *  Qəbul / rədd (bildirişlər panelindən)
 * ------------------------------------------------------------------ */

/** Masa modalı açıq olan sifarişlər — ikinci klik eyni sifarişi təkrar açmasın */
const acceptInFlight = new Set();

export async function acceptQrOrder(orderUuid) {
  if (acceptInFlight.has(orderUuid)) return;
  const order = getPendingQrOrder(orderUuid);
  if (!order) {
    toast.error(t("qr_sifarisi_yazila_bilmedi"));
    return;
  }
  if (isQrOrderHandled(orderUuid)) {
    removePendingQrOrder(orderUuid);
    return;
  }

  acceptInFlight.add(orderUuid);
  try {
    // Masa seçmə modalı. QR-dan masa gəlibsə əvvəlcədən seçilmiş göstərilir.
    const table = await ctx?.requestTable?.(order);
    if (!table) return; // ofisiant modalı bağladı

    // `manual` rejimdə çek QR ofisiantının deyil, TƏSDİQLƏYƏN ofisiantın adına
    // yazılır — satış onun hesabatına düşsün
    const logined = ctx?.getLoginedWaiter?.();
    await commitQrOrder(order, table, logined?.id > 0 ? logined : undefined);
  } finally {
    acceptInFlight.delete(orderUuid);
  }
}

export async function rejectQrOrder(orderUuid, reason) {
  removePendingQrOrder(orderUuid);
  markQrOrderHandled(orderUuid);
  refreshNotificationPanel();
  await sendQrStatus({
    orderUuid,
    status: "rejected",
    reason: reason || "Ofisiant rədd etdi",
  });
  toast.info(t("qr_sifarisi_redd_edildi"));
}

/* ------------------------------------------------------------------ *
 *  Ortaq yazma
 * ------------------------------------------------------------------ */

/**
 * @param {object} order
 * @param {object} table
 * @param {object} [waiter] verilməzsə QR ofisiantı (`direct` rejim) işlənir
 */
async function commitQrOrder(order, table, waiter) {
  const profile = ctx?.getProfile?.() || {};
  try {
    const { checkId, appended, priceDiffs } = await writeQrOrderToPos({
      order,
      table,
      profileId: profile.id,
      activeOrders: ctx?.getActiveOrders?.() || [],
      menuCatalog: ctx?.getMenuCatalog?.() || [],
      menuWithCategories: ctx?.getMenuWithCategories?.() || null,
      waiter,
    });

    removePendingQrOrder(order.orderUuid);
    refreshNotificationPanel();
    await sendQrStatus({ orderUuid: order.orderUuid, status: "accepted", checkId });

    toast.success(
      `${t("qr_sifarisi_qebul_edildi")}${appended ? ` — ${t("movcud_ceke_elave_olundu")}` : ""}`,
    );

    if (priceDiffs.length > 0) {
      addNotification(
        t("qiymet_ferqi_var"),
        priceDiffs
          .map((d) => `${d.name}: ${d.qrPrice.toFixed(2)} → ${d.localPrice.toFixed(2)} ₼`)
          .join(", "),
        { type: "warning", category: "qr_order", orderId: order.orderUuid },
      );
    }

    ctx?.onOrdersChanged?.();
  } catch (err) {
    console.error("[QR] Sifariş yazıla bilmədi:", err);
    await sendQrStatus({
      orderUuid: order.orderUuid,
      status: "failed",
      reason: err?.message || "POS xətası",
    });
    addNotification(t("qr_sifarisi_yazila_bilmedi"), err?.message || "", {
      type: "error",
      category: "qr_order",
      orderId: order.orderUuid,
    });
    toast.error(t("qr_sifarisi_yazila_bilmedi"));
  }
}

/* ------------------------------------------------------------------ *
 *  Başlatma
 * ------------------------------------------------------------------ */

export function startQrOrders() {
  // İkinci qapı: `App.jsx` onsuz da yoxlayır, lakin bu modul başqa yerdən də
  // çağırıla bilər — söndürülmüş halda buluda qoşulmaq olmaz
  const mode = readMode();
  if (mode === "off") {
    console.warn("[QR] Hər iki rejim sönülüdür — socket açılmır");
    return null;
  }
  return initQrSocket({
    onNewOrder: handleIncomingQrOrder,
    onReady: (info) => console.warn("[QR] Hazır:", info),
    onError: (err) => console.warn("[QR] Xəta:", err?.message),
  });
}

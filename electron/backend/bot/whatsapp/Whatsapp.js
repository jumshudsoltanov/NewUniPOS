const axios = require("axios");
const LoginModel = require("../../model/LoginModel");
const OrdersModel = require("../../model/OrdersModel");
// Association-ların qurulması üçün lazy require istifadə olunur
let _OrdersItemsModel = null;
let _ProductsModel = null;
function getOrdersItemsModel() {
  if (!_OrdersItemsModel) _OrdersItemsModel = require("../../model/OrdersItemsModel");
  return _OrdersItemsModel;
}
function getProductsModel() {
  if (!_ProductsModel) _ProductsModel = require("../../model/ProductsModel");
  return _ProductsModel;
}

const DEFAULT_WPBOT_URL = "https://wpbot.unipos.tech/send-bulk-messages";
const DEFAULT_WPBOT_USER = "uni_pos_bot";

const SAPI_URL = "https://sapi.unipos.tech/api/notifications/internal-send";
const SAPI_KEY = "pos_unipos_9Kx72mLpQ4vNzRj8wT";

function getWpbotUrl() {
  return process.env.WPBOT_URL || DEFAULT_WPBOT_URL;
}

function getWpbotUser() {
  return process.env.WPBOT_USER || DEFAULT_WPBOT_USER;
}

const { isActionDenied, isBlockEmptyCheckDelete } = require("./whatsappConfig");

/**
 * @param {string} [action]
 * @returns {boolean} true = WhatsApp göndərmə
 */
function shouldSkipWhatsapp(action) {
  return isActionDenied(action);
}

function isWhatsappDebug() {
  return (
    process.env.WHATSAPP_DEBUG === "1" || process.env.WHATSAPP_DEBUG === "true"
  );
}

function logWhatsappDebug(msg, extra) {
  if (!isWhatsappDebug()) return;
  if (extra !== undefined) console.log("[WhatsApp]", msg, extra);
  else console.log("[WhatsApp]", msg);
}

/** SQLite/Sequelize bəzən TINYINT Buffer qaytarır */
function normalizeNotifyFlag(v) {
  if (v == null) return 0;
  if (Buffer.isBuffer(v)) return v.length ? Number(v[0]) : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (!Number.isNaN(n) && n === 1) return 1;
  if (String(v).trim() === "1" || String(v).toLowerCase() === "true") return 1;
  return 0;
}

function sanitizeReceiver(num) {
  if (num == null) return "";
  return String(num).replace(/[^0-9]/g, "");
}

/**
 * @param {object} opts
 * @returns {string}
 */
function buildWhatsappMessage({
  action,
  waiterName,
  details,
  orderDisplayId,
  restaurantName,
  terminalId,
  tableLabel,
  orderAmount,
  orderItems,
  orderId,
}) {
  const rest =
    restaurantName && String(restaurantName).trim()
      ? String(restaurantName).trim()
      : "Naməlum";

  const lines = [
    `*🔔 ${rest} - MƏLUMATLANDIRMA 🔔*`,
    "",
    `Əməliyyat: *${action || "—"}*`,
    `İstifadəçi adı: *${waiterName || "Naməlum"}*`,
    `Order ID: *${orderDisplayId}*`,
  ];

  // details içindən məbləği, səbəbi, qeydi ayır
  const detailsStr = details ? String(details).trim() : "";

  // "USTALAR: 9 ₼ | Qeyd: Ödənişsiz: USTALAR. TEBRIZ USTA" kimi gələn details-i parse et
  if (detailsStr) {
    // Pipe ilə ayrılmış hissələr varsa
    const parts = detailsStr.split(" | ");
    const mainPart = parts[0] || "";
    const notePart = parts.slice(1).join(" | ");

    // "Ödənişsiz: USTALAR. TEBRIZ USTA" kimi note-dan səbəb və qeydi çıxar
    let sebeb = "";
    let qeyd = "";
    if (notePart) {
      // "Qeyd: Ödənişsiz: USTALAR. TEBRIZ USTA" → "Ödənişsiz: USTALAR. TEBRIZ USTA"
      const noteClean = notePart.replace(/^Qeyd:\s*/i, "");
      // "Ödənişsiz: USTALAR. TEBRIZ USTA" → sebeb=USTALAR, qeyd=TEBRIZ USTA
      const unpaidMatch = noteClean.match(/^Ödənişsiz:\s*([^.]+)\.\s*(.*)$/);
      if (unpaidMatch) {
        sebeb = unpaidMatch[1].trim();
        qeyd = unpaidMatch[2].trim();
      } else {
        qeyd = noteClean;
      }
    } else if (mainPart) {
      // Pipe yoxdur, sadə details
      // "USTALAR: 9 ₼" kimi - bu ödəniş metodudur
    }

    if (sebeb) lines.push(`Səbəb: *${sebeb}*`);
    if (mainPart && !notePart) lines.push(`Ətraflı: ${mainPart}`);
  }

  if (orderAmount != null && orderAmount !== "" && Number(orderAmount) > 0) {
    lines.push(`Məbləğ: ${Number(orderAmount).toFixed(2)} AZN`);
  }

  // Note-dan qeydi çıxar (Ödənişsiz: USTALAR. TEBRIZ USTA → TEBRIZ USTA)
  if (detailsStr) {
    const parts = detailsStr.split(" | ");
    const notePart = parts.slice(1).join(" | ");
    if (notePart) {
      const noteClean = notePart.replace(/^Qeyd:\s*/i, "");
      const unpaidMatch = noteClean.match(/^Ödənişsiz:\s*[^.]+\.\s*(.*)$/);
      const qeyd = unpaidMatch ? unpaidMatch[1].trim() : noteClean;
      if (qeyd) lines.push(`Qeyd: ${qeyd}`);
    }
  }

  if (tableLabel) {
    lines.push(`Masa: ${tableLabel}`);
  }

  if (terminalId != null && String(terminalId).trim() !== "") {
    lines.push(`Terminal adı: ${String(terminalId).trim()}`);
  }

  // Məhsullar — eyni ad+qiymət+portion olanları birləşdir
  if (Array.isArray(orderItems) && orderItems.length > 0) {
    const merged = [];
    for (const item of orderItems) {
      const name = item.product_name || item.name || `Məhsul #${item.product_id}`;
      const price = Number(item.price) || 0;
      const portion = item.portion_name || "";
      const isGift = item.is_gift ? 1 : 0;
      const key = `${name}||${price}||${portion}||${isGift}`;
      const existing = merged.find(m => m.key === key);
      if (existing) {
        existing.count += Number(item.count) || 1;
      } else {
        merged.push({ key, name, price, portion, isGift, count: Number(item.count) || 1 });
      }
    }
    lines.push("", "🛒 *Məhsullar:*");
    merged.forEach((item, i) => {
      const total = (item.count * item.price).toFixed(2);
      const portionSuffix = item.portion ? ` (${item.portion})` : "";
      const giftSuffix = item.isGift ? " 🎁" : "";
      lines.push(`${i + 1}. ${item.name}${portionSuffix}${giftSuffix} — ${item.count} x ${item.price} = *${total} AZN*`);
    });
  }

  return lines.join("\n");
}

/**
 * Push notification göndər — sapi.unipos.tech
 */
async function sendPushNotification({ profileId, title, body, action, orderId, orderUuid, waiterName, tableLabel, orderAmount, details }) {
  try {
    await axios.post(
      SAPI_URL,
      {
        profile_id: profileId,
        title,
        body,
        type: "info",
        data: {
          action: String(action || ""),
          order_id: String(orderId || ""),
          order_uuid: String(orderUuid || orderId || ""),
          waiter_name: String(waiterName || ""),
          table: String(tableLabel || ""),
          amount: String(orderAmount != null ? Number(orderAmount).toFixed(2) : ""),
          details: String(details || ""),
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": SAPI_KEY,
        },
        timeout: 8000,
      }
    );
    console.log("[Push] Bildiriş göndərildi, profile_id:", profileId);
  } catch (err) {
    console.error("[Push] Bildiriş göndərilə bilmədi:", err.message);
  }
}

/**
 * @param {string} receiver
 * @param {string} message
 */
async function sendBulkMessage(receiver, message) {
  const clean = sanitizeReceiver(receiver);
  if (!clean || !message) return null;

  const payload = [
    {
      user: getWpbotUser(),
      receiver: clean,
      message,
    },
  ];

  const url = getWpbotUrl();
  logWhatsappDebug("POST", {
    url,
    user: getWpbotUser(),
    receiver: clean,
    len: message.length,
  });

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    logWhatsappDebug("OK", response.status);
    const tail = clean.length > 4 ? `***${clean.slice(-4)}` : "****";
    console.log("[WhatsApp] wpbot OK, HTTP", response.status, "receiver", tail);
    return response.data;
  } catch (err) {
    const st = err.response?.status;
    const data = err.response?.data;
    console.error(
      "[WhatsApp] API xətası:",
      err.message,
      st != null ? `HTTP ${st}` : "",
      data != null ? JSON.stringify(data).slice(0, 500) : "",
    );
    throw err;
  }
}

async function notifyOrderLogWhatsapp({
  orderId,
  profileId,
  action,
  waiterName,
  details,
  is_whatsapp_notify: waNotifyBody,
  whatsapp_chat_number: waNumberBody,
  restaurant_name: restaurantNameBody,
  terminal_id: terminalIdBody,
}) {
  if (!orderId) return;

  // profileId həll et
  let resolvedProfileId = profileId != null && profileId !== "" ? Number(profileId) : null;
  if (Number.isNaN(resolvedProfileId)) resolvedProfileId = null;

  // Order məlumatlarını oxu — yeni yaradılan order hələ DB-də olmaya bilər, 3 cəhd et
  let order = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 300));
    order = await OrdersModel.findOne({
      where: { uuid: orderId },
      attributes: ["id", "profile_id", "table_id", "hall_id", "terminal_id", "total", "amount", "uuid"],
    }).catch(() => null);
    if (order) break;
  }

  if (resolvedProfileId == null && order?.profile_id != null) {
    resolvedProfileId = Number(order.profile_id);
  }
  if (resolvedProfileId == null || Number.isNaN(resolvedProfileId)) return;

  // Profili oxu (paranoid: false — deleted_at olan profillər də oxunsun)
  const profile = await LoginModel.findByPk(resolvedProfileId, { paranoid: false }).catch(() => null);

  // ── WhatsApp ──────────────────────────────────────────────────
  const waOn = (() => {
    if (waNotifyBody !== undefined && waNotifyBody !== null) return normalizeNotifyFlag(waNotifyBody) === 1;
    return profile ? normalizeNotifyFlag(profile.is_whatsapp_notify) === 1 : false;
  })();
  const chatNumber = waNumberBody != null && String(waNumberBody).trim() !== ""
    ? String(waNumberBody).trim()
    : profile?.whatsapp_chat_number != null ? String(profile.whatsapp_chat_number).trim() : "";

  // Boş çek silinəndə bütün bildirişləri blokla (WhatsApp + Push)
  if (action === "Çek silindi" && isBlockEmptyCheckDelete()) {
    try {
      const itemCount = await getOrdersItemsModel().count({ where: { order_id: orderId }, paranoid: false });
      if (itemCount === 0) {
        console.log("[WhatsApp] Boş çek silindi — bildiriş bloklandı (orderId:", orderId, ")");
        return;
      }
    } catch (e) {
      console.warn("[WhatsApp] Boş çek yoxlaması xətası:", e.message);
    }
  }

  if (waOn && chatNumber && !shouldSkipWhatsapp(action)) {
    try {
      // Məhsulları oxu
      let orderItems = [];
      try {
        const items = await getOrdersItemsModel().findAll({
          where: { order_id: orderId },
          attributes: ["product_id", "count", "price", "is_gift", "portion_name"],
          include: [{ model: getProductsModel(), as: "product", attributes: ["name"], required: false }],
        });
        orderItems = items.map(item => ({
          product_id: item.product_id,
          product_name: item.product?.name || null,
          count: item.count,
          price: item.price,
          is_gift: item.is_gift,
          portion_name: item.portion_name,
        }));
      } catch (e) {
        console.warn("[WhatsApp] Məhsullar oxuna bilmədi:", e.message);
      }

      const restaurantName = restaurantNameBody && String(restaurantNameBody).trim()
        ? String(restaurantNameBody).trim()
        : profile?.restaurant_name ? String(profile.restaurant_name).trim() : "Naməlum";

      const terminalIdResolved = terminalIdBody && String(terminalIdBody).trim()
        ? String(terminalIdBody).trim()
        : order?.terminal_id ? String(order.terminal_id).trim() : "";

      let tableLabel = "";
      if (order?.table_id) {
        try {
          const { QueryTypes } = require("sequelize");
          const db = require("../../database/config");
          const rows = await db.sequelize.query(
            `SELECT t.name AS table_name, h.name AS hall_name
             FROM tables t LEFT JOIN table_groups h ON t.hall_id = h.id
             WHERE t.id = :tableId LIMIT 1`,
            { replacements: { tableId: order.table_id }, type: QueryTypes.SELECT }
          );
          if (rows[0]) {
            tableLabel = [rows[0].hall_name, rows[0].table_name].filter(Boolean).join(" — ");
          }
        } catch (e) {
          console.warn("[WhatsApp] Masa məlumatı oxuna bilmədi:", e.message);
        }
      }

      const message = buildWhatsappMessage({
        action, waiterName, details,
        orderDisplayId: order?.id != null ? String(order.id) : "—",
        orderId: order?.uuid || orderId,
        restaurantName, terminalId: terminalIdResolved, tableLabel,
        orderAmount: order?.total ?? order?.amount,
        orderItems,
      });

      setImmediate(() => sendBulkMessage(chatNumber, message).catch(err => console.error("[WhatsApp] Göndərmə xətası:", err.message)));
    } catch (err) {
      console.error("[WhatsApp] Xəta:", err.message);
    }
  }

  // ── Push Notification ─────────────────────────────────────────
  const pushOn = profile && normalizeNotifyFlag(profile.is_push_notify) === 1;

  if (pushOn) {
    const orderDisplayId = order?.id != null ? String(order.id) : "—";
    const pushBody = action || "Yeni bildiriş";

    // tableLabel WP blokunda hesablanır, push da eyni scope-da olduğu üçün yenidən hesablayaq
    let pushTableLabel = "";
    if (order?.table_id) {
      try {
        const { QueryTypes } = require("sequelize");
        const db = require("../../database/config");
        const rows = await db.sequelize.query(
          `SELECT t.name AS table_name, h.name AS hall_name
           FROM tables t LEFT JOIN table_groups h ON t.hall_id = h.id
           WHERE t.id = :tableId LIMIT 1`,
          { replacements: { tableId: order.table_id }, type: QueryTypes.SELECT }
        );
        if (rows[0]) {
          pushTableLabel = [rows[0].hall_name, rows[0].table_name].filter(Boolean).join(" — ");
        }
      } catch (_) {}
    }

    setImmediate(() => sendPushNotification({
      profileId: resolvedProfileId,
      title: action,
      body: pushBody,
      action,
      orderId: orderDisplayId,
      orderUuid: order?.uuid || orderId,
      waiterName: waiterName || "",
      tableLabel: pushTableLabel,
      orderAmount: order?.total ?? order?.amount,
      details: details || "",
    }));
  }
}

module.exports = {
  notifyOrderLogWhatsapp,
  shouldSkipWhatsapp,
  buildWhatsappMessage,
  sendBulkMessage,
  sendPushNotification,
  sanitizeReceiver,
  getWpbotUrl,
  getWpbotUser,
};

const axios = require("axios");
const LoginModel = require("../../model/LoginModel");
const OrdersModel = require("../../model/OrdersModel");
const TablesModel = require("../../model/TablesModel");
const TableGroupsModel = require("../../model/TableGroupsModel");

const DEFAULT_WPBOT_URL = "https://wpbot.unipos.tech/send-bulk-messages";
const DEFAULT_WPBOT_USER = "uni_pos_bot";

function getWpbotUrl() {
  return process.env.WPBOT_URL || DEFAULT_WPBOT_URL;
}

function getWpbotUser() {
  return process.env.WPBOT_USER || DEFAULT_WPBOT_USER;
}

const { isActionDenied } = require("./whatsappConfig");

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
}) {
  const timeStr = new Date().toLocaleString("az-AZ", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  const rest =
    restaurantName && String(restaurantName).trim()
      ? String(restaurantName).trim()
      : "Naməlum";
  const term =
    terminalId != null && String(terminalId).trim() !== ""
      ? String(terminalId).trim()
      : "Naməlum";

  const lines = [
    "🔔 *POS — əməliyyat jurnalı*",
    "",
    `🏪 *Restoran:* ${rest}`,
    `🖥️ *Terminal ID:* \`${term}\``,
    `🆔 *Çek №:* \`#${orderDisplayId}\``,
  ];

  if (tableLabel) {
    lines.push(`🍽️ *Masa / zal:* ${tableLabel}`);
  }

  lines.push(
    "",
    `⚙️ *Əməliyyat:* ${action || "—"}`,
    `👤 *Ofisiant:* ${waiterName || "Naməlum"}`,
    "",
    "📝 *Ətraflı:*",
    details && String(details).trim() ? `_${String(details).trim()}_` : "_—_",
    "",
    `🕒 _${timeStr}_`,
  );

  return lines.join("\n");
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
      timeout: 10000,
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

/**
 * Order log yazıldıqdan sonra WhatsApp bildirişi.
 * Profil sətiri lokal DB-da olmasa belə, bodidən gələn is_whatsapp_notify + whatsapp_chat_number kifayətdir.
 * @param {{ orderId: string, profileId?: number|null, action: string, waiterName?: string, details?: string, is_whatsapp_notify?: unknown, whatsapp_chat_number?: unknown, restaurant_name?: unknown, terminal_id?: unknown }} params
 */
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
  if (!orderId) {
    logWhatsappDebug("skip: orderId yoxdur");
    return;
  }
  if (shouldSkipWhatsapp(action)) {
    logWhatsappDebug("skip: action siyahıda (WhatsApp göndərilmir)", action);
    return;
  }

  let resolvedProfileId =
    profileId != null && profileId !== "" ? Number(profileId) : null;
  if (Number.isNaN(resolvedProfileId)) resolvedProfileId = null;

  const order = await OrdersModel.findOne({
    where: { uuid: orderId },
    attributes: ["id", "profile_id", "table_id", "hall_id", "terminal_id"],
    include: [
      {
        model: TablesModel,
        as: "table",
        attributes: ["id", "name"],
        required: false,
        include: [
          {
            model: TableGroupsModel,
            as: "hall",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      },
    ],
  });

  if (resolvedProfileId == null && order?.profile_id != null) {
    resolvedProfileId = Number(order.profile_id);
  }

  if (resolvedProfileId == null || Number.isNaN(resolvedProfileId)) {
    logWhatsappDebug("skip: profileId tapılmadı (body və sifarişdə yoxdur)", {
      orderId,
    });
    return;
  }

  const profile =
    resolvedProfileId != null && !Number.isNaN(resolvedProfileId)
      ? await LoginModel.findByPk(resolvedProfileId)
      : null;

  const hasWaInBody =
    (waNotifyBody !== undefined && waNotifyBody !== null) ||
    (waNumberBody != null && String(waNumberBody).trim() !== "");

  if (!profile && !hasWaInBody) {
    logWhatsappDebug(
      "skip: profil DB-də yoxdur və bodidə WhatsApp sahələri yoxdur",
      { resolvedProfileId },
    );
    console.warn(
      "[WhatsApp] SKIP: lokal profiles cədvəlində id=",
      resolvedProfileId,
      "yoxdur; jurnal POST-da is_whatsapp_notify və whatsapp_chat_number göndərin və ya Master terminalda yenidən login edin.",
    );
    return;
  }

  const notifyFromBody = waNotifyBody !== undefined && waNotifyBody !== null;
  const numberFromBody =
    waNumberBody != null && String(waNumberBody).trim() !== "";

  const notifyOn = notifyFromBody
    ? normalizeNotifyFlag(waNotifyBody) === 1
    : profile
      ? normalizeNotifyFlag(profile.is_whatsapp_notify) === 1
      : false;

  const chatNumber = numberFromBody
    ? String(waNumberBody).trim()
    : profile?.whatsapp_chat_number != null
      ? String(profile.whatsapp_chat_number).trim()
      : "";

  if (!notifyOn) {
    logWhatsappDebug("skip: is_whatsapp_notify aktiv deyil", {
      resolvedProfileId,
      raw: profile?.is_whatsapp_notify,
      fromBody: waNotifyBody,
    });
    console.warn("[WhatsApp] SKIP: WhatsApp bildirişi aktiv deyil", {
      profileId: resolvedProfileId,
      fromBody: notifyFromBody,
    });
    return;
  }
  if (!chatNumber) {
    logWhatsappDebug("skip: whatsapp_chat_number boşdur", {
      resolvedProfileId,
    });
    console.warn("[WhatsApp] SKIP: whatsapp_chat_number boşdur (body və DB)", {
      profileId: resolvedProfileId,
    });
    return;
  }

  if (!profile) {
    console.log(
      "[WhatsApp] Lokal profil sətiri yoxdur; bodidən nömrə/notify ilə göndərilir (restoran adı bodidən və ya Naməlum).",
    );
  }

  const restaurantName =
    restaurantNameBody != null && String(restaurantNameBody).trim() !== ""
      ? String(restaurantNameBody).trim()
      : profile?.restaurant_name != null &&
          String(profile.restaurant_name).trim() !== ""
        ? String(profile.restaurant_name).trim()
        : "Naməlum";

  const terminalIdResolved =
    terminalIdBody != null && String(terminalIdBody).trim() !== ""
      ? String(terminalIdBody).trim()
      : order?.terminal_id != null && String(order.terminal_id).trim() !== ""
        ? String(order.terminal_id).trim()
        : "";

  let tableLabel = "";
  const t = order?.table;
  if (t) {
    const hallName = t.hall?.name || "";
    const tableName = t.name || "";
    tableLabel = [hallName, tableName].filter(Boolean).join(" — ") || "";
  }

  const orderDisplayId =
    order?.id != null ? String(order.id) : String(orderId).slice(0, 8);

  const message = buildWhatsappMessage({
    action,
    waiterName,
    details,
    orderDisplayId,
    restaurantName,
    terminalId: terminalIdResolved,
    tableLabel,
  });

  await sendBulkMessage(chatNumber, message);
}

module.exports = {
  notifyOrderLogWhatsapp,
  shouldSkipWhatsapp,
  buildWhatsappMessage,
  sendBulkMessage,
  sanitizeReceiver,
  getWpbotUrl,
  getWpbotUser,
};

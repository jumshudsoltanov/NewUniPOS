import { io } from "socket.io-client";

/**
 * QR SİFARİŞİ — BULUD SOCKET KLİENTİ
 * ==================================
 *
 * Bu socket LOKAL master-ə deyil, BULUDA qoşulur. Ona görə `apiConfig.js`-dəki
 * socket məntiqindən tamamilə ayrıdır.
 *
 * Bağlantını kassa özü bayıra doğru açır, yəni router-də port açmağa və ya
 * statik IP almağa ehtiyac yoxdur.
 *
 * Protokol: QR_ORDER_SOCKET_PLAN.md (bulud komandası)
 * POS tərəfi: QR_ORDER_POS_PLAN.md
 */

/**
 * Socket serverinin ünvanı — `qrapi`, yəni POS-un `/api/terminal/login`
 * çağırdığı EYNİ server. `api.unipos.tech` DEYİL: socket orada yoxdur.
 *
 * Lazım gələrsə `localStorage.pos_qr_api_base` ilə dəyişdirilə bilər —
 * belə halda proqramı yenidən qurmağa ehtiyac qalmır.
 */
export const QR_SOCKET_DEFAULT_BASE = "http://46.224.8.157:35627";

export function getQrApiBase() {
  try {
    const override = localStorage.getItem("pos_qr_api_base");
    if (override && override.trim()) return override.trim().replace(/\/+$/, "");
  } catch { /* localStorage əlçatmazdır */ }
  return QR_SOCKET_DEFAULT_BASE;
}

let socket = null;
let currentHandlers = {};

/**
 * Giriş məlumatları POS-un açılışda saxladığı `profile` obyektindədir —
 * `/api/terminal/login`-ə göndərilənin eynisi, ayrıca açar lazım deyil:
 *
 *   username   → restaurantName    (profiles.username)
 *   terminalId → terminalId        (terminal_groups.terminal_id)
 *   password   → terminalPassword  (terminal_groups.terminal_password)
 */
function readCredentials() {
  try {
    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    if (!p.username || !p.terminalId) return null;
    return {
      restaurantName: p.username,
      terminalId: p.terminalId,
      terminalPassword: p.password,
    };
  } catch {
    return null;
  }
}

/**
 * Socket-i başladır. Təkrar çağırılsa mövcud bağlantını qaytarır.
 *
 * @param {object} handlers
 * @param {(order:object)=>void} handlers.onNewOrder  yeni sifariş gələndə
 * @param {(info:object)=>void}  [handlers.onReady]
 * @param {(err:Error)=>void}    [handlers.onError]
 */
export function initQrSocket(handlers = {}) {
  currentHandlers = handlers;
  if (socket) return socket;

  const auth = readCredentials();
  if (!auth) {
    console.warn("[QR_SOCKET] Giriş məlumatları yoxdur — qoşulma atlandı");
    return null;
  }

  socket = io(`${getQrApiBase()}/pos`, {
    auth,
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  socket.on("qr:ready", (info) => {
    console.warn("[QR_SOCKET] Qoşuldu:", info);
    currentHandlers.onReady?.(info);
  });

  socket.on("qr:order:new", (order, ack) => {
    // Ack DƏRHAL göndərilir — bu, "yaddaşa aldım" deməkdir, təsdiq deyil.
    // Gecikdirsək bulud sifarişi təkrar göndərəcək.
    try {
      ack?.({ ok: true });
    } catch { /* ack callback verilməyib */ }

    try {
      currentHandlers.onNewOrder?.(order);
    } catch (e) {
      console.error("[QR_SOCKET] Sifariş emal edilə bilmədi:", e?.message);
    }
  });

  socket.on("connect_error", (err) => {
    // "invalid_credentials" | "too_many_attempts" | "server_error"
    console.warn("[QR_SOCKET] Qoşulma xətası:", err?.message);
    currentHandlers.onError?.(err);
  });

  socket.on("disconnect", (reason) => {
    console.warn("[QR_SOCKET] Bağlantı kəsildi:", reason);
  });

  return socket;
}

/**
 * Nəticəni buluda bildirir.
 * @param {object} payload { orderUuid, status, checkId?, reason? }
 * @returns {Promise<object>} { ok: true } və ya { ok:false, error }
 */
export async function sendQrStatus(payload) {
  if (!socket || !socket.connected) {
    console.warn("[QR_SOCKET] Status göndərilmədi — bağlantı yoxdur:", payload?.status);
    return { ok: false, error: "not_connected" };
  }
  try {
    return await socket.timeout(5000).emitWithAck("qr:order:status", payload);
  } catch (e) {
    console.warn("[QR_SOCKET] Status cavabı gəlmədi:", e?.message);
    return { ok: false, error: "timeout" };
  }
}

export function getQrSocket() {
  return socket;
}

export function isQrSocketConnected() {
  return !!socket?.connected;
}

export function disconnectQrSocket() {
  try {
    socket?.disconnect();
  } catch { /* artıq bağlıdır */ }
  socket = null;
  currentHandlers = {};
}

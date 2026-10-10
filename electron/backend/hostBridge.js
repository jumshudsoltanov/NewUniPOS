/**
 * HOST KÖRPÜSÜ (backend tərəfi)
 * =============================
 * Backend iki rejimdə işləyə bilər:
 *
 *   1. "child"      — ayrı Node prosesi (normal rejim). Electron-un main prosesi
 *                     bloklanmır, çünki bütün DB sorğuları, Sequelize obyekt
 *                     qurulması və JSON serializasiyası bu prosesdə baş verir.
 *                     Renderer onsuz da HTTP ilə localhost:55667-ə müraciət edir,
 *                     yəni frontend-də heç nə dəyişmir.
 *
 *   2. "in-process" — köhnə rejim: main.js backend-i birbaşa `require` edir.
 *                     Ayrı proses hər hansı səbəbdən start götürməzsə main.js
 *                     avtomatik bu rejimə qayıdır, yəni ən pis halda davranış
 *                     bugünkü ilə eynidir.
 *
 * Bu modul hər iki rejimdə eyni API verir ki, backend kodu rejimi bilməsin.
 */

const path = require("path");

const isChildMode = typeof process.send === "function" && process.env.UNIPOS_BACKEND_CHILD === "1";

/** Electron `app` obyektini yalnız in-process rejimdə götürürük */
function electronApp() {
  if (isChildMode) return null;
  try {
    return require("electron")?.app || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 *  Electron-dan oxunan sabit dəyərlər
 *  Child rejimdə main.js onları env ilə ötürür.
 * ------------------------------------------------------------------ */

function getUserDataPath() {
  if (isChildMode) return process.env.UNIPOS_USER_DATA || null;
  try {
    return electronApp()?.getPath?.("userData") || null;
  } catch {
    return null;
  }
}

function getAppVersion() {
  if (isChildMode) return process.env.UNIPOS_APP_VERSION || null;
  try {
    return electronApp()?.getVersion?.() || null;
  } catch {
    return null;
  }
}

function getAppPath() {
  if (isChildMode) return process.env.UNIPOS_APP_PATH || null;
  try {
    return electronApp()?.getAppPath?.() || null;
  } catch {
    return null;
  }
}

/** Frontend `dist` qovluğu — Express statik fayl serveri üçün */
function getFrontendDistPath() {
  const appPath = getAppPath();
  if (appPath) {
    return path.join(appPath, "electron", "front", "dist");
  }
  return path.join(__dirname, "..", "front", "dist");
}

/* ------------------------------------------------------------------ *
 *  Renderer-ə hadisə göndərmək
 * ------------------------------------------------------------------ */

/**
 * Əsas pəncərəyə mesaj göndərir.
 * Child rejimdə main.js-ə ötürülür, o da `mainWindow.webContents.send` edir.
 */
function sendToRenderer(channel, payload) {
  try {
    if (isChildMode) {
      process.send({ __unipos: "event", channel, payload });
      return true;
    }
    const win = global.mainWindow;
    if (win && !win.isDestroyed?.() && win.webContents) {
      win.webContents.send(channel, payload);
      return true;
    }
  } catch {
    /* pəncərə bağlıdır — problem deyil */
  }
  return false;
}

/* ------------------------------------------------------------------ *
 *  RPC: main.js backend-dən məlumat istəyir
 * ------------------------------------------------------------------ */

const rpcHandlers = new Map();

/**
 * main.js-in çağıra biləcəyi funksiya qeyd edir.
 *
 * Reyestr HƏR İKİ rejimdə `global`-a yazılır. Beləliklə in-process rejimdə
 * main.js eyni funksiyaları birbaşa çağıra bilir və backend-in `ipcMain`-ə
 * ayrıca qeydiyyat etməsinə ehtiyac qalmır. Bu, `re-evaluate-role` kanalının
 * iki dəfə qeyd olunub Electron-un xəta verməsi riskini tam aradan qaldırır.
 */
function registerRpc(name, fn) {
  rpcHandlers.set(name, fn);
  try {
    global.__uniposBackendRpc = rpcHandlers;
  } catch {
    /* global yazıla bilmirsə IPC yolu onsuz da işləyir */
  }
}

/* ------------------------------------------------------------------ *
 *  Host hadisələri: main.js backend-ə siqnal göndərir
 * ------------------------------------------------------------------ */

const hostEventHandlers = new Map();

function onHostEvent(name, fn) {
  hostEventHandlers.set(name, fn);
}

/** Backend hazır olduğunu (Express dinləyir) main.js-ə bildirir */
function notifyReady(info) {
  if (!isChildMode) return;
  try {
    process.send({ __unipos: "ready", info: info || null });
  } catch {
    /* kanal bağlıdır */
  }
}

if (isChildMode) {
  process.on("message", async (msg) => {
    if (!msg || typeof msg !== "object") return;

    // main.js → backend funksiya çağırışı
    if (msg.__unipos === "rpc") {
      const { id, method, args } = msg;
      const handler = rpcHandlers.get(method);
      try {
        if (!handler) throw new Error(`Bilinməyən RPC metodu: ${method}`);
        const value = await handler(...(Array.isArray(args) ? args : []));
        process.send({ __unipos: "rpc-res", id, ok: true, value });
      } catch (err) {
        process.send({
          __unipos: "rpc-res",
          id,
          ok: false,
          error: err?.message || String(err),
        });
      }
      return;
    }

    // main.js → backend hadisəsi (cavab gözlənilmir)
    if (msg.__unipos === "host-event") {
      const handler = hostEventHandlers.get(msg.name);
      if (handler) {
        try {
          await handler(msg.payload);
        } catch (err) {
          console.error("[HOST_EVENT_ERR]", msg.name, err?.message);
        }
      }
    }
  });

  /**
   * Main proses ölərsə bu proses də dayanmalıdır — əks halda orfan proses
   * 55667 portunu tutub qalır və proqram bir daha açılmır.
   */
  process.on("disconnect", () => {
    console.warn("[BACKEND_CHILD] Main proses bağlantısı kəsildi — dayanılır");
    process.exit(0);
  });
}

module.exports = {
  isChildMode,
  getUserDataPath,
  getAppVersion,
  getAppPath,
  getFrontendDistPath,
  sendToRenderer,
  registerRpc,
  onHostEvent,
  notifyReady,
};

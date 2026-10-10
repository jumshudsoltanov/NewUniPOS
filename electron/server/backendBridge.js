/**
 * BACKEND KÖRPÜSÜ (main proses tərəfi)
 * ====================================
 * Əvvəl `backend/app.js` birbaşa `require` olunurdu, yəni Express, MariaDB
 * sorğuları, Sequelize model obyektlərinin qurulması, JSON serializasiyası və
 * sinxronizasiya dövrü Electron-un MAIN prosesində — UI-ni idarə edən eyni tək
 * thread-də — işləyirdi. Ağır bir sorğu gedəndə (məs. 100 açıq çek, hər birində
 * sətirlər + məhsul obyektləri) bütün pəncərə donurdu.
 *
 * İndi backend ayrı Node prosesində işləyir. Renderer onsuz da HTTP/socket.io ilə
 * localhost:55667-ə qoşulur, ona görə frontend-də heç nə dəyişmir — sadəcə o
 * trafik artıq main prosesdən keçmir.
 *
 * TƏHLÜKƏSİZLİK TORU: ayrı proses hər hansı səbəbdən (yol, asar, icazə) start
 * götürməzsə, körpü avtomatik köhnə `require` rejiminə qayıdır. Yəni ən pis
 * halda proqram bugünkü kimi işləyir — geriyə getmə riski yoxdur.
 */

const { fork } = require("child_process");
const fs = require("fs");

const RPC_TIMEOUT_MS = 15000;
const READY_TIMEOUT_MS = 60000;
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 60000;

const state = {
  mode: "stopped", // "child" | "inprocess" | "stopped"
  child: null,
  ready: false,
  readyWaiters: [],
  restarts: [],
  shuttingDown: false,
  backendPath: null,
  env: null,
  log: console,
  onEvent: null,
};

let rpcSeq = 0;
const pendingRpc = new Map();

/* ------------------------------------------------------------------ */

function logInfo(...a) {
  try {
    (state.log.info || state.log.log).call(state.log, ...a);
  } catch {
    /* logger yoxdur */
  }
}
function logWarn(...a) {
  try {
    (state.log.warn || state.log.log).call(state.log, ...a);
  } catch {
    /* logger yoxdur */
  }
}
function logError(...a) {
  try {
    (state.log.error || state.log.log).call(state.log, ...a);
  } catch {
    /* logger yoxdur */
  }
}

/** Child-in stdout/stderr-ini electron-log-a yönəldirik ki, loglar itməsin */
function pipeChildOutput(child) {
  const relay = (stream, isErr) => {
    if (!stream) return;
    let buf = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buf += chunk;
      let idx = buf.indexOf("\n");
      while (idx >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.trim()) {
          if (isErr) logWarn("[BACKEND]", line);
          else logInfo("[BACKEND]", line);
        }
        idx = buf.indexOf("\n");
      }
    });
    stream.on("error", () => {});
  };
  relay(child.stdout, false);
  relay(child.stderr, true);
}

function resolveReadyWaiters(ok, err) {
  const waiters = state.readyWaiters;
  state.readyWaiters = [];
  for (const w of waiters) {
    if (ok) w.resolve();
    else w.reject(err || new Error("Backend hazır olmadı"));
  }
}

function rejectAllPendingRpc(reason) {
  for (const [, p] of pendingRpc) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pendingRpc.clear();
}

/** Qısa müddətdə çox dəfə çökübsə artıq restart etmirik */
function tooManyRestarts() {
  const now = Date.now();
  state.restarts = state.restarts.filter((t) => now - t < RESTART_WINDOW_MS);
  return state.restarts.length >= MAX_RESTARTS;
}

/* ------------------------------------------------------------------ */

function startInProcess(reason) {
  if (state.mode === "inprocess") return true;
  logWarn(
    "[BACKEND_BRIDGE] Ayrı proses rejimi alınmadı, köhnə in-process rejimə keçilir:",
    reason || "səbəb bilinmir",
  );
  try {
    require(state.backendPath);
    state.mode = "inprocess";
    state.ready = true;
    resolveReadyWaiters(true);
    return true;
  } catch (err) {
    state.mode = "stopped";
    logError(
      "[BACKEND_BRIDGE] In-process rejim də alınmadı:",
      err && (err.stack || err.message) ? err.stack || err.message : String(err),
    );
    resolveReadyWaiters(false, err);
    return false;
  }
}

function spawnChild() {
  const child = fork(state.backendPath, [], {
    env: {
      ...process.env,
      ...state.env,
      // Electron-u sadə Node kimi işlədir (paketlənmiş proqramda ayrı node yoxdur)
      ELECTRON_RUN_AS_NODE: "1",
      UNIPOS_BACKEND_CHILD: "1",
    },
    execPath: process.execPath,
    // Electron-un öz arqumentləri child-a keçməsin
    execArgv: [],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });

  state.child = child;
  state.mode = "child";
  pipeChildOutput(child);

  child.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.__unipos === "ready") {
      state.ready = true;
      logInfo(
        "[BACKEND_BRIDGE] Backend ayrı prosesdə hazırdır (pid " + child.pid + ")",
      );
      resolveReadyWaiters(true);
      return;
    }

    if (msg.__unipos === "rpc-res") {
      const p = pendingRpc.get(msg.id);
      if (!p) return;
      pendingRpc.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.value);
      else p.reject(new Error(msg.error || "RPC xətası"));
      return;
    }

    if (msg.__unipos === "event") {
      try {
        if (state.onEvent) state.onEvent(msg.channel, msg.payload);
      } catch (err) {
        logWarn("[BACKEND_BRIDGE] Hadisə ötürülə bilmədi:", err && err.message);
      }
    }
  });

  child.on("error", (err) => {
    logError(
      "[BACKEND_BRIDGE] Child proses xətası:",
      (err && err.message) || String(err),
    );
    if (!state.ready && state.mode === "child") {
      // Heç vaxt hazır olmadı — təhlükəsiz rejimə keç
      try {
        child.kill();
      } catch {
        /* artıq ölüb */
      }
      state.child = null;
      startInProcess(
        "child proses start götürmədi: " + ((err && err.message) || ""),
      );
    }
  });

  child.on("exit", (code, signal) => {
    state.child = null;
    rejectAllPendingRpc("Backend prosesi dayandı");

    if (state.shuttingDown) {
      logInfo("[BACKEND_BRIDGE] Backend prosesi normal dayandı");
      return;
    }

    const wasReady = state.ready;
    state.ready = false;

    if (!wasReady) {
      // İlk start uğursuz oldu — bugünkü davranışı qoruyuruq
      startInProcess(
        `child proses hazır olmadan çıxdı (code=${code} signal=${signal})`,
      );
      return;
    }

    if (tooManyRestarts()) {
      logError(
        "[BACKEND_BRIDGE] Backend prosesi təkrar-təkrar çökür — restart dayandırıldı",
      );
      return;
    }

    state.restarts.push(Date.now());
    logWarn(
      `[BACKEND_BRIDGE] Backend prosesi gözlənilmədən dayandı (code=${code} signal=${signal}) — yenidən başladılır`,
    );
    setTimeout(() => {
      if (state.shuttingDown) return;
      try {
        spawnChild();
      } catch (err) {
        startInProcess("restart alınmadı: " + ((err && err.message) || ""));
      }
    }, 1500);
  });

  return child;
}

/* ------------------------------------------------------------------ */

/**
 * Backend-i başladır.
 * @param {object} opts
 * @param {string} opts.backendPath      backend/app.js tam yolu
 * @param {object} opts.env              child-a ötürülən əlavə env dəyərləri
 * @param {function} opts.onEvent        backend-dən gələn hadisə (channel, payload)
 * @param {object} opts.log              electron-log kimi logger
 * @param {boolean} opts.forceInProcess  true → birbaşa köhnə rejim
 */
function start(opts) {
  state.backendPath = opts.backendPath;
  state.env = opts.env || {};
  state.onEvent = opts.onEvent || null;
  state.log = opts.log || console;
  state.shuttingDown = false;

  if (!fs.existsSync(state.backendPath)) {
    logError("[BACKEND_BRIDGE] Backend faylı tapılmadı:", state.backendPath);
    state.mode = "stopped";
    return { mode: "stopped" };
  }

  if (opts.forceInProcess) {
    startInProcess("UNIPOS_BACKEND_IN_PROCESS aktivdir");
    return { mode: state.mode };
  }

  try {
    spawnChild();
    // Uzun müddət "ready" gəlməzsə köhnə rejimə qayıt
    setTimeout(() => {
      if (state.ready || state.mode !== "child" || state.shuttingDown) return;
      logWarn("[BACKEND_BRIDGE] Backend vaxtında hazır olmadı");
      const c = state.child;
      state.child = null;
      try {
        if (c) c.kill();
      } catch {
        /* artıq ölüb */
      }
      startInProcess("ready siqnalı gəlmədi");
    }, READY_TIMEOUT_MS);
  } catch (err) {
    startInProcess("fork alınmadı: " + ((err && err.message) || String(err)));
  }

  return { mode: state.mode };
}

/** Backend hazır olana qədər gözləyir (in-process rejimdə dərhal qayıdır) */
function waitUntilReady(timeoutMs = READY_TIMEOUT_MS) {
  if (state.ready) return Promise.resolve();
  if (state.mode === "stopped") return Promise.reject(new Error("Backend işləmir"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Backend hazır olmadı (timeout)")),
      timeoutMs,
    );
    state.readyWaiters.push({
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
  });
}

/**
 * Backend-dəki funksiyanı çağırır.
 * In-process rejimdə `fallback` funksiyası işlədilir (köhnə birbaşa `require` yolu).
 */
function call(method, args = [], fallback = null) {
  /**
   * Child rejimində, lakin backend hələ hazır deyil (açılışın ilk saniyələri).
   * Burada fallback-a keçmək OLMAZ: fallback backend modullarını MAIN prosesdə
   * `require` edər və ikinci DB bağlantısı açılar — yəni düzəltdiyimiz problem
   * qayıdar. Əvəzinə hazır olmağı gözləyirik (bir neçə yüz millisaniyə).
   * Praktikada bu, açılışda renderer-in backend-dən tez sorğu göndərdiyi
   * yarış halını (`re-evaluate-role` xətası) aradan qaldırır.
   */
  if (state.mode === "child" && state.child && !state.ready) {
    return waitUntilReady(RPC_TIMEOUT_MS).then(
      () => call(method, args, fallback),
      () => {
        if (typeof fallback === "function") return Promise.resolve().then(fallback);
        throw new Error(`Backend hazır olmadı (${method})`);
      },
    );
  }

  if (state.mode !== "child" || !state.child || !state.ready) {
    // In-process rejimdə backend eyni prosesdədir: hostBridge-in reyestrindən
    // funksiyanı birbaşa çağırırıq (bax: backend/hostBridge.js registerRpc)
    try {
      const registry = global.__uniposBackendRpc;
      const handler = registry && registry.get ? registry.get(method) : null;
      if (typeof handler === "function") {
        return Promise.resolve().then(() =>
          handler(...(Array.isArray(args) ? args : [])),
        );
      }
    } catch {
      /* reyestr yoxdursa fallback-a keçirik */
    }
    if (typeof fallback === "function") return Promise.resolve().then(fallback);
    return Promise.reject(new Error(`Backend hazır deyil (${method})`));
  }

  const id = ++rpcSeq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRpc.delete(id);
      reject(new Error(`RPC timeout: ${method}`));
    }, RPC_TIMEOUT_MS);

    pendingRpc.set(id, { resolve, reject, timer });
    try {
      state.child.send({ __unipos: "rpc", id, method, args });
    } catch (err) {
      pendingRpc.delete(id);
      clearTimeout(timer);
      reject(err);
    }
  });
}

/** Backend-ə hadisə göndərir (cavab gözlənilmir) */
function emit(name, payload) {
  if (state.mode !== "child" || !state.child) return false;
  try {
    state.child.send({ __unipos: "host-event", name, payload });
    return true;
  } catch {
    return false;
  }
}

function getMode() {
  return state.mode;
}

function isReady() {
  return state.ready;
}

/**
 * Backend prosesini dayandırır.
 * KRİTİK: bu çağırılmazsa orfan proses 55667 portunu tutub qalır və proqram
 * növbəti dəfə açılanda backend start götürə bilmir.
 */
function stop() {
  state.shuttingDown = true;
  rejectAllPendingRpc("Backend dayandırılır");
  const child = state.child;
  state.child = null;
  state.ready = false;
  if (!child) return;
  try {
    if (child.disconnect) child.disconnect();
  } catch {
    /* kanal bağlıdır */
  }
  try {
    child.kill();
  } catch {
    /* artıq ölüb */
  }
  // Cavab verməzsə məcburi dayandırırıq
  setTimeout(() => {
    try {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    } catch {
      /* artıq ölüb */
    }
  }, 2000);
}

module.exports = { start, stop, call, emit, waitUntilReady, getMode, isReady };

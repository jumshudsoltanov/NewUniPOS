const {
  app,
  Menu,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  nativeImage,
} = require("electron");

const os = require("os");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug";
autoUpdater.autoInstallOnAppQuit = true;
log.info("UniPOS Desktop Application is starting...");

/**
 * Windows: crash log-da `launch-failed` + **exitCode 18** — renderer Chromium sandbox-da
 * işə düşmür; çox vaxt "Run as Administrator" və ya AppLocker/endpoint təhlükəsizliyi ilə
 * uyğunsuzluqdur. Mənbə: https://github.com/electron/electron/issues/49167
 * Tövsiyə: UniPOS-u mümkün olduqca **adminsiz** işlədin. GPU sandbox söndürməsi bir çox
 * maşınlarda bəs edir; bəzi hallarda ortam dəyişəni `UNIPOS_NO_SANDBOX=1` və ya işəsalma
 * arqumenti `--unipos-no-sandbox` (tam `no-sandbox` — yalnız zərurətdə).
 */
app.disableHardwareAcceleration();

if (process.platform === "win32") {
  // Set app user model id so Windows taskbar groups & icons match the desktop shortcut
  app.setAppUserModelId("com.unipos.desktop");
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  app.commandLine.appendSwitch("disable-software-rasterizer");
  app.commandLine.appendSwitch("js-flags", "--max-old-space-size=1024");
  app.commandLine.appendSwitch("renderer-process-limit", "3");
  app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox,NetworkServiceInProcess");
  app.commandLine.appendSwitch("disable-http-cache");
  log.warn("[STARTUP] Stabillik rejimi aktiv: no-sandbox, no-GPU, NetworkServiceSandbox disabled");
}

Menu.setApplicationMenu(null);


const isDev = !app.isPackaged;
let mainWindow = null;
let customerWindow = null;

function getPreloadPath() {
  const appPath = app.getAppPath();
  return isDev
    ? path.join(__dirname, "preload.js")
    : path.join(appPath, "electron", "server", "preload.js");
}

// ─── Print Queue (TCP uğursuz olduqda saxla, qayıdanda yenidən göndər) ───────
const PRINT_QUEUE_FILE = path.join(
  app.getPath ? app.getPath("userData") : os.tmpdir(),
  "print_queue.json",
);

const loadPrintQueue = () => {
  try {
    if (fs.existsSync(PRINT_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(PRINT_QUEUE_FILE, "utf8")) || [];
    }
  } catch (e) {}
  return [];
};

const savePrintQueue = (queue) => {
  try {
    fs.writeFileSync(PRINT_QUEUE_FILE, JSON.stringify(queue), "utf8");
  } catch (e) {}
};

let _printQueue = loadPrintQueue();
let _printQueueRunning = false;

const addToPrintQueue = (job) => {
  job.id = Date.now() + Math.random().toString(36).slice(2);
  job.addedAt = new Date().toISOString();
  job.attempts = 0;
  _printQueue.push(job);
  savePrintQueue(_printQueue);
};

const processPrintQueue = async () => {
  if (_printQueueRunning || _printQueue.length === 0) return;
  _printQueueRunning = true;
  const net = require("net");
  const tryTcp = (buf, ip, port) =>
    new Promise((resolve) => {
      const sock = net.connect(Number(port) || 9100, ip, () => {
        sock.write(buf, () => {
          sock.end();
          resolve(true);
        });
      });
      sock.setTimeout(5000);
      sock.on("error", () => resolve(false));
      sock.on("timeout", () => {
        sock.destroy();
        resolve(false);
      });
    });

  const remaining = [];
  for (const job of _printQueue) {
    if (job.attempts >= 20) continue; // 20 cəhddən sonra sil
    try {
      const buf = Buffer.from(job.bufHex, "hex");
      const ok = await tryTcp(buf, job.ip, job.port);
      if (ok) {
        console.log(
          `[PRINT_QUEUE] Göndərildi: ${job.ip}:${job.port} (${job.id})`,
        );
      } else {
        job.attempts = (job.attempts || 0) + 1;
        remaining.push(job);
      }
    } catch (e) {
      job.attempts = (job.attempts || 0) + 1;
      remaining.push(job);
    }
  }
  _printQueue = remaining;
  savePrintQueue(_printQueue);
  _printQueueRunning = false;
};

// Hər 30 saniyədə bir queue-dəki işləri yenidən göndər
setInterval(() => {
  processPrintQueue().catch(() => {});
}, 30000);
let kitchenWindow = null;
let updateState = { status: null, version: null, progress: 0 };
let isCustomerDisplayManuallyClosed = false; // Global flag

/** İlk tapılan fayl: köhnə static/logo.png çox vaxt yoxdur; UniPOS loqosunu front/src və ya dist-dən götürürük */
let cachedAppIconPath;
function getAppIconPath() {
  if (cachedAppIconPath !== undefined) {
    return cachedAppIconPath || undefined;
  }
  let found = null;
  try {
    const appPath = app.getAppPath();
    // On Windows prefer .ico for correct taskbar icon; on other platforms use .png
    const isWin = process.platform === "win32";
    const candidates = isWin
      ? [
          path.join(__dirname, "..", "static", "images", "logo-build.ico"),
          path.join(__dirname, "..", "static", "images", "logo.png"),
          path.join(__dirname, "..", "static", "images", "logo-build.png"),
          path.join(__dirname, "..", "static", "images", "logo-icon.png"),
          path.join(__dirname, "..", "front", "src", "assets", "images", "unipos_logo.png"),
          path.join(__dirname, "..", "front", "src", "assets", "images", "logo.png"),
          path.join(__dirname, "..", "front", "public", "favicon.png"),
          path.join(__dirname, "..", "front", "dist", "favicon.png"),
          path.join(appPath, "electron", "front", "dist", "favicon.png"),
        ]
      : [
          path.join(__dirname, "..", "static", "images", "logo.png"),
          path.join(__dirname, "..", "front", "src", "assets", "images", "unipos_logo.png"),
          path.join(__dirname, "..", "front", "src", "assets", "images", "logo.png"),
          path.join(__dirname, "..", "front", "public", "favicon.png"),
          path.join(__dirname, "..", "front", "dist", "favicon.png"),
          path.join(appPath, "electron", "front", "dist", "favicon.png"),
        ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        found = p;
        break;
      }
    }
  } catch (e) {
    found = null;
  }
  cachedAppIconPath = found;
  return found || undefined;
}

function browserWindowIconFields() {
  const p = getAppIconPath();
  return p ? { icon: p } : {};
}

/**
 * DevTools pəncərəsinə tətbiq loqosunu tətbiq edir — default Electron ikonu əvəz olunur.
 */
function applyDevToolsIconToWindow(browserWindow) {
  if (!browserWindow?.webContents) return;
  const iconPath = getAppIconPath();
  if (!iconPath || !fs.existsSync(iconPath)) return;
  try {
    const dwc = browserWindow.webContents.devToolsWebContents;
    if (!dwc) return;
    const devWin = BrowserWindow.fromWebContents(dwc);
    if (devWin && !devWin.isDestroyed()) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        devWin.setIcon(img);
      } else {
        devWin.setIcon(iconPath);
      }
    }
  } catch (e) {
    /* devToolsWebContents gec hazır ola bilər */
  }
}

function attachDevToolsIcon(browserWindow) {
  if (!browserWindow || !browserWindow.webContents) return;
  const scheduleApply = () => {
    applyDevToolsIconToWindow(browserWindow);
  };
  browserWindow.webContents.on("devtools-opened", () => {
    scheduleApply();
    [50, 150, 400, 800, 1500].forEach((ms) => setTimeout(scheduleApply, ms));
  });
}

// --- GLOBAL CRASH REPORTER ---
function getCrashLogPrimaryPath() {
  try {
    return path.join(app.getPath("userData"), "UniPOS_Crash_Log.txt");
  } catch (_e) {
    return path.join(os.tmpdir(), "UniPOS_Crash_Log.txt");
  }
}

const CRASH_TMP_LOG = path.join(os.tmpdir(), "UniPOS_Crash_Log.txt");
const MAX_ERR_LOG_CHARS = 12000;

function logErrorToFile(errorType, errorObj) {
  try {
    const timestamp = new Date().toISOString();
    let errorDetails = "";
    if (errorObj instanceof Error) {
      errorDetails = `${errorObj.name}: ${errorObj.message}\n${errorObj.stack}`;
    } else {
      errorDetails = String(errorObj);
    }
    if (errorDetails.length > MAX_ERR_LOG_CHARS) {
      errorDetails =
        errorDetails.slice(0, MAX_ERR_LOG_CHARS) +
        "\n…(qısaldıldı, tam mətn faylda əvvəlki qədər olmayıb)\n";
    }
    const logMessage = `\n[${timestamp}] [${errorType}]\n${errorDetails}\n-----------------------------------\n`;
    fs.appendFileSync(getCrashLogPrimaryPath(), logMessage, "utf8");
    fs.appendFileSync(CRASH_TMP_LOG, logMessage, "utf8");
    const oneLine = errorDetails.replace(/\s+/g, " ").slice(0, 2000);
    log.error(`[CRASH_LOG] ${errorType}: ${oneLine}`);
  } catch (e) {
    console.error("LOGGERS FAILURE", e);
  }
}

process.on("uncaughtException", (error) => {
  logErrorToFile("uncaughtException", error);
  // Do not crash immediately for debugging purposes
});

process.on("unhandledRejection", (reason, promise) => {
  logErrorToFile("unhandledRejection", reason);
});

/** Renderer qəfil çökəndə əsas prosesdə qalmaq; çox uzun/OS xətaları üçün faylda iz + məhdud reload. */
function attachRendererRecovery(browserWindow, label) {
  if (!browserWindow || browserWindow.webContents?.isDestroyed?.()) return;
  const wc = browserWindow.webContents;
  let reloadBurst = [];

  wc.on("render-process-gone", (_event, details) => {
    const msg = `[${label}] reason=${details?.reason ?? "?"} exitCode=${details?.exitCode ?? "n/a"}`;
    logErrorToFile("render-process-gone", msg);
    log.warn("[RENDER_DOWN]", msg);
    if (
      details?.exitCode === 18 &&
      String(details?.reason || "").toLowerCase().includes("launch")
    ) {
      log.warn(
        "[RENDER_DOWN] exitCode 18: Windows-da Admin rejimi və ya sandbox toqquşması ola bilər — proqramı adminsiz işlədin; davam edərsə UNIPOS_NO_SANDBOX=1 və ya --unipos-no-sandbox (main.js şərhlərinə baxın).",
      );
    }
    try {
      _event.preventDefault();
    } catch (_e) {
      /* Electron versiyası dəstəkləməyə bilər */
    }
    const now = Date.now();
    reloadBurst = reloadBurst.filter((t) => now - t < 60000);
    if (reloadBurst.length >= 4) {
      log.error(
        "[RENDER_DOWN] Çox sayda yenidən yükləmə — avtomatik bərpa dayandırıldı:",
        label,
      );
      return;
    }
    reloadBurst.push(now);
    setTimeout(() => {
      try {
        if (browserWindow && !browserWindow.isDestroyed()) {
          browserWindow.reload();
        }
      } catch (re) {
        log.warn("[RENDER_DOWN] reload xətası:", re?.message);
      }
    }, 500);
  });

  wc.on("unresponsive", () => {
    log.warn("[RENDER] unresponsive:", label);
  });

  wc.on("responsive", () => {
    log.info("[RENDER] responsive:", label);
  });
}

if (typeof app?.on === "function") {
  app.on("child-process-gone", (_event, details) => {
    const payload = [
      details?.type,
      details?.reason,
      details?.exitCode,
      details?.serviceName,
    ]
      .filter(Boolean)
      .join(" ");
    logErrorToFile("child-process-gone", payload || String(details || ""));
    log.warn("[CHILD_PROC_GONE]", details);
  });
}
// -----------------------------

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// ----------------------------

function createWindow() {
  const preloadPath = getPreloadPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true, // Start in fullscreen
    ...browserWindowIconFields(),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // file:// → http://localhost sorğularına icazə ver
    },
  });

  attachDevToolsIcon(mainWindow);
  attachRendererRecovery(mainWindow, "cashier");

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/");
  } else {
    const indexPath = path.join(
      appPath,
      "electron",
      "front",
      "dist",
      "index.html",
    );
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error("Index file not found:", indexPath);
    }
  }

  if (!isDev && mainWindow) {
    mainWindow.setKiosk(true);
  }

  global.mainWindow = mainWindow;

  mainWindow.on("closed", () => {
    global.mainWindow = null;
    mainWindow = null;
    if (customerWindow && !customerWindow.isDestroyed()) {
      customerWindow.close();
      customerWindow = null;
    }
    if (kitchenWindow && !kitchenWindow.isDestroyed()) {
      kitchenWindow.close();
      kitchenWindow = null;
    }
  });

  // Auto-start customer/kitchen display if enabled in DB
  setTimeout(() => {
    checkCustomerDisplayAutoStart();
    checkKitchenDisplayAutoStart();
  }, 6000);

  async function checkKitchenDisplayAutoStart() {
    try {
      const LoginModel = require(
        path.join(__dirname, "..", "backend", "model", "LoginModel"),
      );
      const profile = await LoginModel.findOne({ order: [["id", "DESC"]] });

      if (
        profile &&
        profile.is_kitchen_display_active === 1 &&
        profile.kitchen_display_screen_id
      ) {
        console.log(
          "[ELECTRON] Auto-starting Kitchen Display on screen:",
          profile.kitchen_display_screen_id,
        );
        createKitchenWindow(profile.kitchen_display_screen_id);
      }
    } catch (err) {
      console.error(
        "[ELECTRON] Auto-start Kitchen Display Error:",
        err.message,
      );
    }
  }

  let customerDisplayInterval = null;

  async function checkCustomerDisplayAutoStart() {
    try {
      // Clear existing interval if any
      if (customerDisplayInterval) {
        clearInterval(customerDisplayInterval);
      }

      // Initial check & interval setup
      const performCheck = async () => {
        try {
          let isActive = false;
          let screenId = null;

          // Primary: try local DB (works on master)
          try {
            const LoginModel = require(
              path.join(__dirname, "..", "backend", "model", "LoginModel"),
            );
            const profile = await LoginModel.findOne({
              order: [["id", "DESC"]],
            });
            if (profile) {
              isActive = profile.is_customer_display_active === 1;
              screenId = profile.customer_display_screen_id;
            }
          } catch (_dbErr) {
            // DB not available (slave without local DB) — fall through to localStorage
          }

          // Fallback: read from renderer localStorage (works on slave)
          if (!isActive && mainWindow && !mainWindow.isDestroyed()) {
            try {
              const lsData = await mainWindow.webContents.executeJavaScript(`
                (function() {
                  try {
                    var p = JSON.parse(localStorage.getItem('profile') || '{}');
                    return { active: p.is_customer_display_active === 1 ? 1 : 0, screenId: p.customer_display_screen_id || '' };
                  } catch(e) { return { active: 0, screenId: '' }; }
                })()
              `);
              if (lsData && lsData.active === 1 && lsData.screenId) {
                isActive = true;
                screenId = lsData.screenId;
              }
            } catch (_lsErr) {
              /* ignore */
            }
          }

          if (isActive && screenId) {
            // If it's supposed to be active, but manually closed by IPC, do not revive.
            if (isCustomerDisplayManuallyClosed) {
              return;
            }

            // If active and NO customer window exists, revive it.
            if (!customerWindow || customerWindow.isDestroyed()) {
              console.log(
                "[ELECTRON] Auto-reviving/starting Customer Display on screen:",
                screenId,
              );
              createCustomerWindow(screenId);
            }
          } else {
            // If disabled but window is open, close it cleanly
            if (customerWindow && !customerWindow.isDestroyed()) {
              customerWindow.close();
              customerWindow = null;
            }
          }
        } catch (innerErr) {
          console.error(
            "[ELECTRON] Auto-check Customer Display Inner Error:",
            innerErr.message,
          );
        }
      };

      await performCheck(); // Run once immediately
      customerDisplayInterval = setInterval(performCheck, 30000); // Poll every 30 seconds
    } catch (err) {
      console.error(
        "[ELECTRON] Auto-start Customer Display Error:",
        err.message,
      );
    }
  }
}

// IPC Handlers
ipcMain.handle("toggle-fullscreen", () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return !isFullScreen;
  }
  return false;
});

ipcMain.handle("get-fullscreen-state", () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle("open-anydesk", () => {
  // Try common AnyDesk paths
  const anyDeskPaths = [
    "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe",
    "C:\\Program Files\\AnyDesk\\AnyDesk.exe",
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "AnyDesk",
      "AnyDesk.exe",
    ),
  ];

  for (const adPath of anyDeskPaths) {
    if (fs.existsSync(adPath)) {
      exec(`"${adPath}"`, (error) => {
        if (error) {
          console.error(
            "Failed to open AnyDesk:",
            error ? String(error) : "Unknown Error",
          );
        }
      });
      return true;
    }
  }

  // Try running anydesk from PATH
  exec("anydesk", (error) => {
    if (error) {
      console.error(
        "AnyDesk not found in PATH:",
        error ? String(error) : "Unknown Error",
      );
    }
  });
  return true;
});

ipcMain.handle("get-anydesk-id", () => {
  const configPaths = [
    "C:\\ProgramData\\AnyDesk\\system.conf",
    path.join(process.env.APPDATA || "", "AnyDesk", "system.conf"),
    path.join(process.env.LOCALAPPDATA || "", "AnyDesk", "system.conf"),
  ];

  for (const confPath of configPaths) {
    if (fs.existsSync(confPath)) {
      try {
        const content = fs.readFileSync(confPath, "utf8");
        const match = content.match(/ad\.anynet\.id\s*=\s*(\d+)/);
        if (match) return match[1];
      } catch (e) {
        // continue to next path
      }
    }
  }
  return null;
});

ipcMain.handle(
  "install-network-printer",
  async (event, { ip, port, printerName }) => {
    if (!ip || !printerName)
      return { success: false, error: "IP və ya printer adı yoxdur" };
    const portNum = Number(port) || 9100;
    const portName = `UNIPOS_${ip.replace(/\./g, "_")}`;

    // Win8+ (PrintManagement module mövcuddur): Get-PrinterPort / Add-PrinterPort
    const modernScript = [
      `$pn='${portName}'; $pr='${printerName}'; $ip='${ip}'; $po=${portNum}`,
      `if(-not(Get-PrinterPort -Name $pn -EA SilentlyContinue)){Add-PrinterPort -Name $pn -PrinterHostAddress $ip -PortNumber $po}`,
      `if(-not(Get-Printer -Name $pr -EA SilentlyContinue)){`,
      `$dl=@('Generic / Text Only','MS Publisher Imagesetter','Generic IBM Graphics 9pin wide','Generic IBM Graphics 9pin')`,
      `$dr=$null`,
      `foreach($d in $dl){if(Get-PrinterDriver -Name $d -EA SilentlyContinue){$dr=$d;break}}`,
      `if(-not $dr){$dr=(Get-PrinterDriver|Select-Object -First 1).Name}`,
      `if($dr){Add-Printer -Name $pr -DriverName $dr -PortName $pn}`,
      `}`,
      `Write-Output 'DONE'`,
    ].join("; ");

    // Win7 fallback: WScript.Network + WMI yolu
    const win7Script = [
      `$pn='${portName}'; $pr='${printerName}'; $ip='${ip}'; $po=${portNum}`,
      // WMI ilə TCP/IP printer port yarat
      `$wmi=[wmiclass]'Win32_TCPIPPrinterPort'; $port=$wmi.CreateInstance()`,
      `$port.Name=$pn; $port.HostAddress=$ip; $port.PortNumber=$po; $port.Protocol=1`,
      `$port.Put() | Out-Null`,
      // WMI ilə printer yarat
      `$driverName='Generic / Text Only'`,
      `$prWmi=[wmiclass]'Win32_Printer'; $pr2=$prWmi.CreateInstance()`,
      `$pr2.Name=$pr; $pr2.DriverName=$driverName; $pr2.PortName=$pn; $pr2.Shared=$false`,
      `$pr2.Put() | Out-Null`,
      `Write-Output 'DONE_WIN7'`,
    ].join("; ");

    const tryScript = (script, label) =>
      new Promise((resolve) => {
        exec(
          `powershell -WindowStyle Hidden -Command "${script}"`,
          { timeout: 20000 },
          (err, stdout) => {
            if (!err && stdout && (stdout.includes("DONE"))) {
              console.log(`[install-network-printer] ${label}: Quruldu: ${printerName}`);
              resolve({ success: true, printerName });
            } else {
              resolve({ success: false, error: err?.message || "Uğursuz" });
            }
          }
        );
      });

    // Əvvəlcə modern cəhd et, uğursuz olursa Win7 WMI metodunu sına
    let result = await tryScript(modernScript, "Modern");
    if (!result.success) {
      console.warn("[install-network-printer] Modern metod uğursuz, Win7 WMI cəhd edilir...");
      result = await tryScript(win7Script, "Win7-WMI");
    }
    if (!result.success) {
      // Son cəhd: UAC ilə modern script
      result = await new Promise((resolve) => {
        exec(
          `powershell -Command "Start-Process powershell -ArgumentList '-WindowStyle Hidden -Command \\"${modernScript.replace(/"/g, '\\"')}\\"' -Verb RunAs -Wait"`,
          { timeout: 30000 },
          (err2) => {
            if (err2) {
              resolve({ success: false, error: err2.message });
            } else {
              resolve({ success: true, printerName });
            }
          }
        );
      });
    }
    return result;
  },
);

ipcMain.handle("get-com-ports", async () => {
  try {
    const { exec } = require("child_process");
    return await new Promise((resolve) => {
      exec(
        `powershell -Command "Get-WMIObject Win32_SerialPort | Select-Object -ExpandProperty DeviceID"`,
        (err, stdout) => {
          if (err || !stdout.trim()) return resolve([]);
          const ports = stdout
            .trim()
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => /^COM\d+$/i.test(p));
          resolve(ports);
        },
      );
    });
  } catch (e) {
    return [];
  }
});

ipcMain.handle("get-system-printers", async () => {
  try {
    // Əvvəlcə Electron API ilə sına
    if (mainWindow && mainWindow.webContents) {
      try {
        if (typeof mainWindow.webContents.getPrintersAsync === "function") {
          const list = await mainWindow.webContents.getPrintersAsync();
          if (list && list.length >= 0) return list;
        }
      } catch (_) {}
      try {
        if (typeof mainWindow.webContents.getPrinters === "function") {
          const list = mainWindow.webContents.getPrinters();
          if (list && list.length >= 0) return list;
        }
      } catch (_) {}
    }
    // Fallback: PowerShell (Win7 uyumlu — wmi)
    return await new Promise((resolve) => {
      exec(
        `powershell -WindowStyle Hidden -Command "Get-WmiObject -Class Win32_Printer | Select-Object -ExpandProperty Name"`,
        { timeout: 5000 },
        (err, stdout) => {
          if (err || !stdout.trim()) return resolve([]);
          const names = stdout.trim().split("\n").map(n => n.trim()).filter(Boolean);
          resolve(names.map(name => ({ name, description: name, status: 0, isDefault: false })));
        }
      );
    });
  } catch (e) {
    console.error(
      "Error getting system printers:",
      e ? String(e) : "Unknown Printer Error",
    );
    return [];
  }
});

const runPromiseWithTimeout = (promise, timeoutMs, fallback) =>
  new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(typeof fallback === "function" ? fallback() : fallback);
    }, Math.max(250, Number(timeoutMs) || 1000));

    Promise.resolve(promise)
      .then((value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(typeof fallback === "function" ? fallback() : fallback);
      });
  });

const normalizePrinterName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getPrinterDisplayName = (printer) =>
  printer?.local_name || printer?.name || printer?.usb_name || printer?.ip || "Printer";

const buildPrinterCandidates = (printer) => {
  const candidates = [
    printer?.usb_name,
    printer?.local_name,
    printer?.name,
    printer?.printerName,
  ];
  if (printer?.ip) candidates.push(`UNIPOS_${String(printer.ip).replace(/\./g, "_")}`);
  return candidates
    .map((candidate) => String(candidate || "").trim())
    .filter((candidate) => candidate && candidate !== "RASTER");
};

const readWindowsPrintersSnapshot = async () => {
  if (process.platform !== "win32") return [];
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$items=Get-WmiObject -Class Win32_Printer | Select-Object Name,DeviceID,PortName,Status,Default,WorkOffline,PrinterStatus,ExtendedPrinterStatus,PrinterState,DetectedErrorState",
    "if($items){$items | ConvertTo-Json -Compress -Depth 3}",
  ].join("; ");

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -WindowStyle Hidden -Command "${script}"`,
      { timeout: 2500 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) return resolve([]);
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          resolve([]);
        }
      },
    );
  });
};

const readComPortsSnapshot = async () => {
  if (process.platform !== "win32") return [];
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -WindowStyle Hidden -Command "Get-WmiObject Win32_SerialPort | Select-Object -ExpandProperty DeviceID"`,
      { timeout: 1800 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        resolve(
          stdout
            .split(/\r?\n/)
            .map((port) => port.trim().toUpperCase())
            .filter((port) => /^COM\d+$/i.test(port)),
        );
      },
    );
  });
};

const findWindowsPrinterInfo = (printer, windowsPrinters) => {
  const candidates = buildPrinterCandidates(printer).map(normalizePrinterName);
  if (!candidates.length) return null;
  return (
    windowsPrinters.find((item) => {
      const names = [item?.Name, item?.DeviceID].map(normalizePrinterName);
      return names.some((name) => name && candidates.includes(name));
    }) || null
  );
};

const issueMeta = {
  offline: { status: "error", label: "Offline" },
  paper_out: { status: "error", label: "Kağız bitib" },
  paper_low: { status: "warning", label: "Kağız azdır" },
  cover_open: { status: "error", label: "Qapaq açıqdır" },
  paper_jam: { status: "error", label: "Kağız ilişib" },
  cutter_error: { status: "error", label: "Kəsici xətası" },
  service_requested: { status: "error", label: "Servis tələb olunur" },
  paused: { status: "warning", label: "Pauzadadır" },
  busy: { status: "warning", label: "Məşğuldur" },
  queued_jobs: { status: "warning", label: "Növbədə çap var" },
  misconfigured: { status: "error", label: "Tənzimləmə natamamdır" },
  status_unknown: { status: "unknown", label: "Status məlum deyil" },
};

const pushIssue = (issues, code) => {
  if (!issueMeta[code]) return;
  if (!issues.some((issue) => issue.code === code)) {
    issues.push({ code, ...issueMeta[code] });
  }
};

const getWorstStatus = (issues, fallback = "ok") => {
  if (issues.some((issue) => issue.status === "error")) return "error";
  if (issues.some((issue) => issue.status === "warning")) return "warning";
  if (issues.some((issue) => issue.status === "unknown")) return "unknown";
  return fallback;
};

const classifyWindowsPrinter = (info) => {
  const issues = [];
  if (!info) return { issues, online: null, detail: "" };

  const detected = Number(info.DetectedErrorState);
  const printerStatus = Number(info.PrinterStatus);
  const extendedStatus = Number(info.ExtendedPrinterStatus);
  const state = Number(info.PrinterState) || 0;
  const workOffline = String(info.WorkOffline).toLowerCase() === "true" || info.WorkOffline === true;

  if (workOffline || printerStatus === 7 || extendedStatus === 7 || (state & 0x80)) {
    pushIssue(issues, "offline");
  }
  if (detected === 3 || (state & 0x40)) pushIssue(issues, "paper_low");
  if (detected === 4 || (state & 0x10)) pushIssue(issues, "paper_out");
  if (detected === 7 || (state & 0x400000)) pushIssue(issues, "cover_open");
  if (detected === 8 || (state & 0x8)) pushIssue(issues, "paper_jam");
  if (detected === 10 || (state & 0x100000)) pushIssue(issues, "service_requested");
  if (detected === 11 || (state & 0x800)) pushIssue(issues, "service_requested");
  if (state & 0x1) pushIssue(issues, "paused");
  if ([4, 10, 12, 13].includes(extendedStatus) || (state & 0x200)) pushIssue(issues, "busy");

  const statusText = [info.Status, info.PortName].filter(Boolean).join(" • ");
  return {
    issues,
    online: !issues.some((issue) => issue.code === "offline"),
    detail: statusText,
  };
};

const queryNetworkPrinterStatus = async (ip, port, timeoutMs = 1200) => {
  const net = require("net");
  const startedAt = Date.now();
  return new Promise((resolve) => {
    if (!ip) {
      resolve({ online: null, supportsStatus: false, bytes: [], latencyMs: 0 });
      return;
    }

    const socket = new net.Socket();
    const bytes = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve({ latencyMs: Date.now() - startedAt, ...result });
    };

    socket.setTimeout(Math.max(400, Number(timeoutMs) || 1200));
    socket.connect(Number(port) || 9100, ip, () => {
      const statusRequest = Buffer.from([
        0x10, 0x04, 0x01,
        0x10, 0x04, 0x02,
        0x10, 0x04, 0x03,
        0x10, 0x04, 0x04,
      ]);
      socket.write(statusRequest, () => {
        setTimeout(() => {
          finish({ online: true, supportsStatus: bytes.length > 0, bytes });
        }, Math.min(700, Math.max(250, Number(timeoutMs) - 250)));
      });
    });
    socket.on("data", (data) => {
      for (const byte of data.values()) bytes.push(byte);
      if (bytes.length >= 4) {
        finish({ online: true, supportsStatus: true, bytes });
      }
    });
    socket.on("error", () => finish({ online: false, supportsStatus: false, bytes: [] }));
    socket.on("timeout", () => finish({ online: false, supportsStatus: false, bytes: [] }));
  });
};

const parseEscPosIssues = (bytes) => {
  const issues = [];
  if (!Array.isArray(bytes) || bytes.length === 0) return issues;
  const offlineByte = bytes.length >= 2 ? bytes[1] : null;
  const errorByte = bytes.length >= 3 ? bytes[2] : null;
  const paperByte = bytes.length >= 4 ? bytes[3] : bytes[bytes.length - 1];

  if (typeof offlineByte === "number") {
    if (offlineByte & 0x04) pushIssue(issues, "cover_open");
    if (offlineByte & 0x20) pushIssue(issues, "paper_out");
    if (offlineByte & 0x40) pushIssue(issues, "service_requested");
  }
  if (typeof errorByte === "number") {
    if (errorByte & 0x08) pushIssue(issues, "cutter_error");
    if (errorByte & 0x60) pushIssue(issues, "service_requested");
  }
  if (typeof paperByte === "number") {
    if (paperByte & 0x60) pushIssue(issues, "paper_out");
    else if (paperByte & 0x0c) pushIssue(issues, "paper_low");
  }

  return issues;
};

const countQueuedJobsForPrinter = (printer) => {
  const ip = String(printer?.ip || "").trim();
  if (!ip) return 0;
  return _printQueue.filter((job) => String(job.ip || "").trim() === ip).length;
};

const buildPrinterDiagnostic = async (printer, shared, options = {}) => {
  const startedAt = Date.now();
  const connectionType = printer?.connection_type || (printer?.ip ? "network" : "usb");
  const isNetwork =
    connectionType === "network" ||
    (connectionType !== "usb" && connectionType !== "com" && !!printer?.ip);
  const displayName = getPrinterDisplayName(printer);
  const issues = [];
  const sources = [];
  let online = null;
  let detail = "";
  let supportsPaperStatus = false;

  const windowsInfo = findWindowsPrinterInfo(printer, shared.windowsPrinters || []);
  if (windowsInfo) {
    sources.push("windows");
    const windowsStatus = classifyWindowsPrinter(windowsInfo);
    windowsStatus.issues.forEach((issue) => pushIssue(issues, issue.code));
    if (windowsStatus.online !== null) online = windowsStatus.online;
    if (windowsStatus.detail) detail = windowsStatus.detail;
    supportsPaperStatus = true;
  }

  if (isNetwork) {
    if (!printer?.ip) {
      pushIssue(issues, "misconfigured");
    } else {
      sources.push("tcp");
      const networkStatus = await queryNetworkPrinterStatus(
        printer.ip,
        printer.port || 9100,
        Math.min(1600, Number(options.timeoutMs) || 1400),
      );
      online = networkStatus.online;
      if (!networkStatus.online) {
        pushIssue(issues, "offline");
      } else if (networkStatus.supportsStatus) {
        sources.push("escpos");
        supportsPaperStatus = true;
        parseEscPosIssues(networkStatus.bytes).forEach((issue) =>
          pushIssue(issues, issue.code),
        );
      }
      if (!detail) {
        detail = networkStatus.supportsStatus
          ? "ESC/POS status cavabı alındı"
          : "TCP bağlantısı var, sensor statusu cavab vermədi";
      }
    }
  } else if (connectionType === "com") {
    const comPort = String(printer?.usb_name || printer?.com_port || "").trim().toUpperCase();
    sources.push("com");
    if (!/^COM\d+$/i.test(comPort)) {
      pushIssue(issues, "misconfigured");
    } else if ((shared.comPorts || []).includes(comPort)) {
      online = true;
      detail = detail || `${comPort} mövcuddur`;
    } else {
      online = false;
      pushIssue(issues, "offline");
      detail = detail || `${comPort} tapılmadı`;
    }
  } else if (!windowsInfo) {
    pushIssue(issues, "status_unknown");
    detail = "Windows printer statusu tapılmadı";
  }

  const queuedJobs = countQueuedJobsForPrinter(printer);
  if (queuedJobs > 0) pushIssue(issues, "queued_jobs");

  const status = getWorstStatus(issues, online === false ? "error" : "ok");
  const label =
    issues.find((issue) => issue.status === "error")?.label ||
    issues.find((issue) => issue.status === "warning")?.label ||
    (status === "unknown" ? "Status məlum deyil" : online === false ? "Offline" : "Online");

  return {
    id: printer?.id ?? null,
    key: String(printer?.id ?? displayName),
    name: displayName,
    code: printer?.name || printer?.usb_name || printer?.ip || "",
    connectionType,
    ip: printer?.ip || null,
    port: printer?.port || null,
    status,
    online,
    label,
    detail,
    issues,
    sources,
    supportsPaperStatus,
    queuedJobs,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  };
};

ipcMain.handle("get-printer-diagnostics", async (_event, { printers = [], timeoutMs = 3500 } = {}) => {
  const startedAt = Date.now();
  const safePrinters = Array.isArray(printers) ? printers.slice(0, 30) : [];
  try {
    const shared = await runPromiseWithTimeout(
      Promise.all([readWindowsPrintersSnapshot(), readComPortsSnapshot()]).then(
        ([windowsPrinters, comPorts]) => ({ windowsPrinters, comPorts }),
      ),
      2800,
      { windowsPrinters: [], comPorts: [] },
    );

    const diagnostics = await runPromiseWithTimeout(
      Promise.all(
        safePrinters.map((printer) =>
          buildPrinterDiagnostic(printer, shared, { timeoutMs }),
        ),
      ),
      Math.max(1800, Number(timeoutMs) || 3500),
      [],
    );

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      printers: Array.isArray(diagnostics) ? diagnostics : [],
    };
  } catch (error) {
    return {
      success: false,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      error: error?.message || String(error || "Printer diaqnostikası alınmadı"),
      printers: safePrinters.map((printer) => ({
        id: printer?.id ?? null,
        key: String(printer?.id ?? getPrinterDisplayName(printer)),
        name: getPrinterDisplayName(printer),
        status: "unknown",
        online: null,
        label: "Status məlum deyil",
        detail: "Diaqnostika cavab vermədi",
        issues: [{ code: "status_unknown", ...issueMeta.status_unknown }],
        sources: [],
        checkedAt: new Date().toISOString(),
      })),
    };
  }
});

ipcMain.handle("ping-printer", async (_event, { ip, port = 9100 }) => {
  const net = require("net");
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(Number(port), ip, () => {
      socket.destroy();
      resolve({ online: true });
    });
    socket.on("error", () => {
      socket.destroy();
      resolve({ online: false });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ online: false });
    });
  });
});

ipcMain.handle(
  "scan-network-printers",
  async (_event, { baseIp, port = 9100 }) => {
    const net = require("net");
    const found = [];
    const promises = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIp}.${i}`;
      promises.push(
        new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(400);
          socket.connect(port, ip, () => {
            socket.destroy();
            found.push({ ip, port });
            resolve();
          });
          socket.on("error", () => {
            socket.destroy();
            resolve();
          });
          socket.on("timeout", () => {
            socket.destroy();
            resolve();
          });
        }),
      );
    }
    // 30-30 paralel işlət — hamsını birdən açma
    const chunks = [];
    for (let i = 0; i < promises.length; i += 30)
      chunks.push(promises.slice(i, i + 30));
    for (const chunk of chunks) await Promise.all(chunk);
    return found;
  },
);

ipcMain.handle("list-com-ports", async () => {
  return new Promise((resolve) => {
    // PowerShell: Windows-da mövcud COM portlarını siyahıla
    exec(
      `powershell -WindowStyle Hidden -Command "Get-WmiObject Win32_PnPEntity | Where-Object { $_.Name -match 'COM\\d+' } | ForEach-Object { $m = [regex]::Match($_.Name, 'COM\\d+'); if ($m.Success) { $m.Value } } | Sort-Object -Unique"`,
      { timeout: 5000 },
      (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          const ports = stdout.trim().split("\n").map(p => p.trim()).filter(Boolean);
          if (ports.length > 0) return resolve(ports);
        }
        // Fallback: registry-dən oxu
        exec(
          `powershell -WindowStyle Hidden -Command "try { $r = Get-ItemProperty -Path 'HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM' -ErrorAction Stop; $r.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS' } | Select-Object -ExpandProperty Value } catch {}"`,
          { timeout: 5000 },
          (err2, stdout2) => {
            if (!err2 && stdout2 && stdout2.trim()) {
              const ports2 = stdout2.trim().split("\n").map(p => p.trim()).filter(Boolean);
              return resolve(ports2);
            }
            resolve([]);
          }
        );
      }
    );
  });
});

ipcMain.handle("get-screens", () => {
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    id: d.id,
    label: d.label || `Ekran ${index + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
  }));
});

function createCustomerWindow(screenId) {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close();
  }

  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.find((d) => String(d.id) === String(screenId)) ||
    screen.getPrimaryDisplay();

  customerWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    ...browserWindowIconFields(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
      webSecurity: false, // file:// → http://localhost sorğularına icazə ver
    },
  });

  attachDevToolsIcon(customerWindow);
  attachRendererRecovery(customerWindow, "customer-display");

  if (isDev) {
    customerWindow.loadURL("http://localhost:5173/#/customer");
  } else {
    customerWindow.loadFile(
      path.join(app.getAppPath(), "electron", "front", "dist", "index.html"),
      { hash: "/customer" },
    );
  }

  customerWindow.on("closed", () => {
    customerWindow = null;
  });
}

ipcMain.handle("toggle-customer-display", (event, { active, screenId }) => {
  if (!active) {
    if (customerWindow && !customerWindow.isDestroyed()) {
      customerWindow.close();
      customerWindow = null;
    }
    // Flag to true so auto-revive ignores it until turned back on
    isCustomerDisplayManuallyClosed = true;
    return { success: true, active: false };
  }

  isCustomerDisplayManuallyClosed = false; // Turn off the manual override flag

  createCustomerWindow(screenId);

  return { success: true, active: true };
});

ipcMain.handle("toggle-kitchen-display", (event, { active, screenId }) => {
  if (!active) {
    if (kitchenWindow) {
      kitchenWindow.close();
      kitchenWindow = null;
    }
    return { success: true, active: false };
  }

  if (kitchenWindow) {
    kitchenWindow.close();
  }

  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.find((d) => String(d.id) === String(screenId)) ||
    screen.getPrimaryDisplay();

  kitchenWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    ...browserWindowIconFields(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  attachDevToolsIcon(kitchenWindow);
  attachRendererRecovery(kitchenWindow, "kitchen-display");

  if (isDev) {
    kitchenWindow.loadURL("http://localhost:5173/#/kitchen-display");
  } else {
    kitchenWindow.loadFile(
      path.join(app.getAppPath(), "electron", "front", "dist", "index.html"),
      { hash: "/kitchen-display" },
    );
  }

  kitchenWindow.on("closed", () => {
    kitchenWindow = null;
  });

  return { success: true, active: true };
});

function createKitchenWindow(screenId) {
  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.find((d) => String(d.id) === String(screenId)) ||
    screen.getPrimaryDisplay();

  kitchenWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    ...browserWindowIconFields(),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  attachDevToolsIcon(kitchenWindow);
  attachRendererRecovery(kitchenWindow, "kitchen-display");

  if (isDev) {
    kitchenWindow.loadURL("http://localhost:5173/#/kitchen-display");
  } else {
    kitchenWindow.loadFile(
      path.join(app.getAppPath(), "electron", "front", "dist", "index.html"),
      { hash: "/kitchen-display" },
    );
  }

  kitchenWindow.on("closed", () => {
    kitchenWindow = null;
  });
}

/**
 * ZJ və bəzi şəbəkə ESC/POS printerlər:
 * – Kiçik raster blokları (buffer)
 * – Kəsmədən əvvəl daha çox boş sətir
 * – 80mm üçün raster eni: **576** nöqtə (203 dpi standart; 640 bəzi ZJ-da sətirin solunu kəsər,
 *   sağda boş sahə yaradaraq məzmunun dartılmış görünməsinə gətirir — baxılış foto).
 * – leftInsetPx: çap başlığının mexaniki “ölü zonasından” qaçmaq üçün ağ sahə (~20–28px tipikdir).
 * Şəbəkə rejimində printerSettings.printer_label istifadə olunur (printerName boş ola bilər).
 */
function getEscPosRasterCompat(printerName, settings) {
  const paperSize = String(settings?.paper_size || "80");
  const L = String(
    printerName || (settings && settings.printer_label) || "",
  ).toUpperCase();
  // Tam Windows/USB ad nümunələri: "ZJ-80", "ZJ80", "ZJ 80" və s.; L artıq UPPERCASE-dir.
  const zj =
    /ZJ[- ]?80\b/.test(L) ||
    L.includes("ZJ-80") ||
    L.includes("ZJ80") ||
    L.includes("ZJ-") ||
    L.includes(" ZJ") ||
    L.startsWith("ZJ") ||
    /^ZJ-?\d/.test(L) ||
    L.includes("ZJIANG") ||
    L.includes("ZHIJIANG") ||
    L.includes("ZHONGQI") ||
    L.includes("ZQ-") ||
    L.includes("ZQ58") ||
    L.includes("ZQ80") ||
    L.includes("ZJPRINT");
  if (!zj) {
    return {
      chunkRows: 8,
      cutFeedLines: 4,
      trailingExtraLines: 0,
      receiptWidthPx: null,
      leftInsetPx: 0,
      rightInsetPx: 0,
    };
  }
  log.info(
    `[RASTER] ESC/POS uyğunlaşdırma (ZJ / oxşar): "${String(printerName || settings?.printer_label || "").slice(0, 64)}"`,
  );
  if (paperSize === "58") {
    return {
      chunkRows: 8,
      cutFeedLines: 12,
      trailingExtraLines: 10,
      receiptWidthPx: 384,
      leftInsetPx: 14,
      rightInsetPx: 0,
    };
  }
  return {
    chunkRows: 8,
    cutFeedLines: 12,
    trailingExtraLines: 10,
    receiptWidthPx: 576,
    leftInsetPx: 24,
    rightInsetPx: 0,
  };
}

/**
 * Uzun raster çek: capturePage() bir sətirdə ~8k px-dən çox hündürlükdə GPU limiti ilə kəsilə bilər.
 * Hissə-hissə çəkib şaquli birləşdiririk — vahid kağız, bir kəsilmə.
 */
function concatNativeImagesVertically(images) {
  if (!images || images.length === 0) {
    throw new Error("concatNativeImagesVertically: boş şəkil siyahısı");
  }
  const w = images[0].getSize().width;
  let totalH = 0;
  for (const img of images) {
    totalH += img.getSize().height;
  }
  const buf = Buffer.alloc(w * totalH * 4);
  let off = 0;
  for (const img of images) {
    const bmp = img.toBitmap();
    bmp.copy(buf, off);
    off += bmp.length;
  }
  if (off !== buf.length) {
    log.warn(
      `[RASTER] Bitmap birləşmə uzunluğu fərqi: yazılan=${off}, gözlənilən=${buf.length}`,
    );
  }
  return nativeImage.createFromBitmap(buf, {
    width: w,
    height: totalH,
    scaleFactor: 1,
  });
}

let _printReceiptRunning = false;
const _printReceiptQueue = [];

async function processPrintReceiptQueue() {
  if (_printReceiptRunning || _printReceiptQueue.length === 0) return;
  _printReceiptRunning = true;
  
  while (_printReceiptQueue.length > 0) {
    const job = _printReceiptQueue.shift();
    try {
      const result = await executePrintReceipt(job.event, job.data);
      job.resolve(result);
    } catch (err) {
      job.resolve({ success: false, error: String(err.message || err) });
    }
  }
  _printReceiptRunning = false;
}

async function executePrintReceipt(
  event,
  { html, printerName, printerIp, printerPort, printerSettings } = {},
) {
    log.info(`[PRINT-RECEIPT] Yeni çap istəyi: ${printerName}, IP: ${printerIp}, Connection: ${printerSettings?.connection_type}`);
    const settings = printerSettings || {};

    const sendToTcpOnce = (buf, ip, port) =>
      new Promise((resolve) => {
        const net = require("net");
        const sock = net.connect(Number(port) || 9100, ip, () => {
          // Böyük bufferləri parça-parça göndər — printer buffer overflow olmasın
          const CHUNK = 4096;
          let offset = 0;
          const writeNext = () => {
            if (offset >= buf.length) {
              sock.end();
              return resolve({ success: true });
            }
            const chunk = buf.slice(offset, offset + CHUNK);
            offset += CHUNK;
            const canContinue = sock.write(chunk);
            if (canContinue) {
              writeNext();
            } else {
              sock.once("drain", writeNext);
            }
          };
          writeNext();
        });
        sock.setTimeout(30000);
        sock.on("error", (e) => resolve({ success: false, error: e.message }));
        sock.on("timeout", () => {
          sock.destroy();
          resolve({ success: false, error: "Timeout" });
        });
      });

    const sendToTcp = async (buf, ip, port, retries = 3, delayMs = 2000) => {
      let lastErr = "";
      for (let i = 0; i < retries; i++) {
        const result = await sendToTcpOnce(buf, ip, port);
        if (result.success) return result;
        lastErr = result.error || "Bilinməyən xəta";
        console.warn(
          `[TCP] Çap uğursuz (cəhd ${i + 1}/${retries}): ${ip}:${port} — ${lastErr}`,
        );
        if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
      }
      return { success: false, error: lastErr };
    };

    const sendToCom = (buf, portPath, baudRate) =>
      new Promise((resolve) => {
        const comName = portPath.replace(/^\\\\\.\\/i, "").toUpperCase(); // \\.\COM3 → COM3
        const baud = baudRate || settings.baud_rate || "9600";
        const applyMode = () =>
          new Promise((res) => {
            exec(
              `mode ${comName} BAUD=${baud} PARITY=N DATA=8 STOP=1 XON=OFF`,
              { windowsHide: true },
              () => res(),
            );
          });
        applyMode().then(() => {
          const CHUNK = 4096;
          const st = fs.createWriteStream(portPath, { flags: "w" });
          st.on("error", (e) => resolve({ success: false, error: e.message }));
          let offset = 0;
          const writeNext = () => {
            if (offset >= buf.length) {
              st.end();
              return resolve({ success: true });
            }
            const chunk = buf.slice(offset, offset + CHUNK);
            offset += CHUNK;
            const ok = st.write(chunk);
            if (ok) {
              writeNext();
            } else {
              st.once("drain", writeNext);
            }
          };
          writeNext();
        });
      });

    const paperSize = settings.paper_size || "80";
    const rasterSizeCompat = getEscPosRasterCompat(
      printerName || settings.printer_label || "",
      settings,
    );
    let receiptWidthPx = paperSize === "58" ? 384 : 576;
    if (rasterSizeCompat.receiptWidthPx != null) {
      receiptWidthPx = rasterSizeCompat.receiptWidthPx;
      log.info(
        `[RASTER] Kağız ${paperSize}mm — seçilmiş raster eni: ${receiptWidthPx}px`,
      );
    }
    const contentBaseWidth = 330; // Orijinal ölçüyə qaytarıldı (330px)

    const renderHtmlToRasterBuffer = async (htmlContent, s, rasterPrinterLabel = "") => {
      const compat = getEscPosRasterCompat(rasterPrinterLabel, s);
      const CHUNK_ROWS = compat.chunkRows;
      const leftInsetPx = Math.max(
        0,
        Number(compat.leftInsetPx ?? 0) || 0,
      );
      const rightInsetPx = Math.max(
        0,
        Number(compat.rightInsetPx ?? 0) || 0,
      );
      const usableW = Math.max(
        96,
        receiptWidthPx - leftInsetPx - rightInsetPx,
      );
      const zoomLevel = usableW / contentBaseWidth;

      console.log(
        `[RASTER] Çap başlayır: ${receiptWidthPx}px (base ${contentBaseWidth}), inset L/R=${leftInsetPx}/${rightInsetPx}, usableW=${usableW}, zoom=${zoomLevel.toFixed(4)}, chunkRows=${CHUNK_ROWS}`,
      );
      let rasterWindow = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        focusable: false,
        width: receiptWidthPx,
        height: 16000,
        useContentSize: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          offscreen: false,
        },
      });

      const _hdr = s.receipt_header ? String(s.receipt_header).trim() : "";
      const _ftr = s.receipt_footer ? String(s.receipt_footer).trim() : "";
      const headerHtml = _hdr
        ? `<div style="text-align:center; padding-bottom: 10px; font-family: monospace; white-space: pre-wrap; font-weight: bold; font-size: ${s.double_height_header == 1 ? "1.6em" : "1.2em"}; color: black !important;">${_hdr.replace(/</g, "&lt;")}</div>`
        : "";
      const footerHtml = _ftr
        ? `<div style="text-align:center; padding-top: 10px; font-family: monospace; white-space: pre-wrap; margin-bottom: 20px; color: black !important;">${_ftr.replace(/</g, "&lt;")}</div>`
        : "";
      const fontFamily =
        s.font_family && s.font_family !== "Arial"
          ? `"${s.font_family}", Arial, sans-serif`
          : "Arial, sans-serif";

      const printLogo = s.print_logo != null ? Number(s.print_logo) : 1;
      const fastPrint = s.fast_print ? 1 : 0;
      const logoStyle =
        printLogo === 0
          ? `img, svg { display: none !important; }`
          : `img, svg { max-width: 100%; height: auto; display: block; margin: 0 auto; filter: contrast(300%) grayscale(100%); }`;
      const imageQuality = fastPrint ? `image-rendering: pixelated;` : ``;

      const rasterPageHtml = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          margin: 0; padding: 0; background: white !important;
          font-family: ${fontFamily}, sans-serif;
          color: black !important;
          width: ${receiptWidthPx}px;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-print-color-adjust: exact;
          ${imageQuality}
        }
        #zoom-outer {
          width: ${receiptWidthPx}px;
          padding-left: ${leftInsetPx}px;
          padding-right: ${rightInsetPx}px;
          box-sizing: border-box;
          background: white !important;
        }
        #zoom-wrap {
          width: ${contentBaseWidth}px;
          transform-origin: top left;
          transform: scale(${zoomLevel.toFixed(4)});
          padding-bottom: 20px;
        }
        ${logoStyle}
        body, body * { 
          background-color: white !important;
          color: black !important;
          font-weight: 800 !important;
          line-height: 1.2;
        }
        svg { 
          background: white !important;
          shape-rendering: crispEdges !important;
          display: block;
          margin: 10px auto !important;
          width: 80px !important;
          height: 80px !important;
        }
        #zoom-wrap {
          /* QR-ın daxili naxışlarını qorumaq üçün artıq filtrləri yığışdırdıq */
        }
      </style>
    </head><body><div id="zoom-outer"><div id="zoom-wrap">${headerHtml || ""}${htmlContent || ""}${footerHtml || ""}</div></div></body></html>`;

      await new Promise((resolve) => {
        rasterWindow.webContents.once("did-finish-load", resolve);
        rasterWindow.loadURL(
          "data:text/html;base64," +
            Buffer.from(rasterPageHtml, "utf8").toString("base64"),
        );
      });

      // Şəkillərin tam mount olmasını gözlə
      await rasterWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          setTimeout(resolve, 200); // QR-ın tam render olunması üçün saniyə azaldıldı
        });
      `);

      // DPR-i 1-ə sıfırla — Windows display scaling (125%/150%) capture-ı pozmasın
      rasterWindow.webContents.setZoomFactor(1);

      const wrapInfo = await rasterWindow.webContents.executeJavaScript(`
        (function() {
          var wrap = document.getElementById('zoom-wrap');
          var outer = document.getElementById('zoom-outer');
          var rect = wrap.getBoundingClientRect();
          var zoomed = Math.ceil(rect.height);
          // Document hündürlüyünü kontent hündürlüyünə set et
          outer.style.height = (zoomed + 60) + 'px';
          document.body.style.height = (zoomed + 60) + 'px';
          document.documentElement.style.height = (zoomed + 60) + 'px';
          // Scroll-u sıfırla
          window.scrollTo(0, 0);
          return { height: zoomed, raw: wrap.scrollHeight, dpr: window.devicePixelRatio || 1 };
        })();
      `);

      console.log(`[RASTER] H-Detect: LogicH=${wrapInfo.raw}, VisualH=${wrapInfo.height}, DPR=${wrapInfo.dpr}`);

      let captureH = wrapInfo.height + 60;

      /** Chromium/Electron bitmap ~8192px-dən çox olduqda capturePage GPU limiti ilə kəsilə bilər */
      const MAX_SLICE_H = 7200;

      let normalizedImage;

      if (captureH <= MAX_SLICE_H) {
        // ── TƏK PARÇA CAPTURE ──
        rasterWindow.setContentSize(receiptWidthPx, captureH);
        await new Promise((r) => setTimeout(r, 50));

        // Scroll-u sıfırla və hündürlükləri yenilə
        await rasterWindow.webContents.executeJavaScript(`
          (function() {
            var outer = document.getElementById('zoom-outer');
            outer.style.height = '${captureH}px';
            document.body.style.height = '${captureH}px';
            document.documentElement.style.height = '${captureH}px';
            document.body.style.overflow = 'hidden';
            window.scrollTo(0, 0);
          })();
        `);
        await new Promise((r) => setTimeout(r, 50));

        // Tam sahəni capture et — explicit rect ilə, tam əmin olmaq üçün
        const capturedImage = await rasterWindow.webContents.capturePage({
          x: 0,
          y: 0,
          width: receiptWidthPx,
          height: captureH,
        });
        normalizedImage = capturedImage.resize({ width: receiptWidthPx });
        console.log(`[RASTER] Tək parça: captureH=${captureH}, imgSize=${normalizedImage.getSize().width}x${normalizedImage.getSize().height}`);
      } else {
        // ── ÇOXPARÇALI CAPTURE ──
        // Viewport-u sabit saxla, resize etmə, yalnız scroll et.
        console.log(
          `[RASTER] Çox uzun çek (${captureH}px) — çoxparçalı capture (sabit viewport=${MAX_SLICE_H}px)`,
        );

        rasterWindow.setContentSize(receiptWidthPx, MAX_SLICE_H);
        await new Promise((r) => setTimeout(r, 50));

        // Document hündürlüyünü tam captureH-ya set et ki scroll işləsin
        await rasterWindow.webContents.executeJavaScript(`
          (function() {
            var outer = document.getElementById('zoom-outer');
            outer.style.height = '${captureH}px';
            document.body.style.height = '${captureH}px';
            document.documentElement.style.height = '${captureH}px';
            window.scrollTo(0, 0);
          })();
        `);
        await new Promise((r) => setTimeout(r, 50));

        const slices = [];
        let scrollY = 0;
        while (scrollY < captureH) {
          // Scroll et — viewport resize YOX
          await rasterWindow.webContents.executeJavaScript(`
            window.scrollTo(0, ${scrollY});
          `);
          await new Promise((r) => setTimeout(r, 50));

          const rawSlice = await rasterWindow.webContents.capturePage({
            x: 0,
            y: 0,
            width: receiptWidthPx,
            height: Math.min(MAX_SLICE_H, captureH - scrollY),
          });
          const resizedSlice = rawSlice.resize({ width: receiptWidthPx });

          const remainingH = captureH - scrollY;
          if (remainingH < MAX_SLICE_H) {
            // Son parça: yalnız qalan kontenti saxla
            const sliceSize = resizedSlice.getSize();
            const cropH = Math.max(1, Math.ceil(remainingH * sliceSize.height / MAX_SLICE_H));
            const cropped = resizedSlice.crop({
              x: 0,
              y: 0,
              width: sliceSize.width,
              height: Math.min(cropH, sliceSize.height),
            });
            slices.push(cropped);
            console.log(`[RASTER] Son parça: scrollY=${scrollY}, remainingH=${remainingH}, cropH=${cropH}`);
          } else {
            slices.push(resizedSlice);
          }

          scrollY += MAX_SLICE_H;
        }
        normalizedImage = concatNativeImagesVertically(slices);
        console.log(`[RASTER] ${slices.length} parça birləşdirildi, total=${normalizedImage.getSize().height}px`);
      }

      if (!rasterWindow.isDestroyed()) rasterWindow.close();
      rasterWindow = null;

      const bmp = normalizedImage.toBitmap();
      const imgSize = normalizedImage.getSize();
      const imgW = imgSize.width;
      const imgH = imgSize.height;
      const widthBytes = Math.ceil(receiptWidthPx / 8);

      const isRotated = s.rotate_180 == 1;
      const darkLevel = s.darkness ? Number(s.darkness) : 5;
      // Ultra-kəskinlik üçün threshold-u 200-ə qaldırırıq
      const threshold = 200 + (darkLevel - 5) * 10;

      const ESC = 0x1b, GS = 0x1d;
      const parts = [];
      parts.push(Buffer.from([ESC, 0x40]));

      parts.push(Buffer.from([ESC, 0x33, 0x00]));

      // Automatik trim: Sonuncu tünd (qara) sətiri tapırıq
      let lastBlackRow = imgH - 1;
      for (let y = imgH - 1; y >= 0; y--) {
        let hasBlack = false;
        for (let x = 0; x < imgW; x++) {
          const pixelOffset = (y * imgW + x) * 4;
          const gray = 0.299 * bmp[pixelOffset] + 0.587 * bmp[pixelOffset + 1] + 0.114 * bmp[pixelOffset + 2];
          if (gray < threshold) { hasBlack = true; break; }
        }
        if (hasBlack) { lastBlackRow = y; break; }
      }
      
      const trimmedH = Math.min(imgH, lastBlackRow + 60); // 60px əlavə boşluq qalsın
      console.log(`[RASTER] Trim: OriginalH=${imgH}, TrimmedH=${trimmedH}`);

      // Kiçik chunk: bəzi printerlər böyük GS v0 raster bloklarını buffer overflow edir
      // və kağızı ortadan kəsir. ZJ üçün chunkRows daha kiçik (getEscPosRasterCompat).
      for (let rowStart = 0; rowStart < trimmedH; rowStart += CHUNK_ROWS) {
        const rowsToProcess = Math.min(CHUNK_ROWS, trimmedH - rowStart);
        const header = Buffer.from([
          GS, 0x76, 0x30, 0x00,
          widthBytes & 0xff, (widthBytes >> 8) & 0xff,
          rowsToProcess & 0xff, (rowsToProcess >> 8) & 0xff,
        ]);
        parts.push(header);

        for (let r = 0; r < rowsToProcess; r++) {
          const row = rowStart + r;
          const rowData = Buffer.alloc(widthBytes, 0x00);
          const srcY = isRotated ? trimmedH - 1 - row : row;

          for (let col = 0; col < receiptWidthPx; col++) {
            const srcX = isRotated ? receiptWidthPx - 1 - col : col;
            const pixelOffset = (srcY * imgW + srcX) * 4;
            const gray = 0.299 * bmp[pixelOffset] + 0.587 * bmp[pixelOffset+1] + 0.114 * bmp[pixelOffset+2];
            if (gray < threshold) {
              const byteIdx = Math.floor(col / 8);
              const bitIdx = 7 - (col % 8);
              rowData[byteIdx] |= 1 << bitIdx;
            }
          }
          parts.push(rowData);
        }
      }

      parts.push(Buffer.from([ESC, 0x33, 0x1e]));
      const baseTrail = s.trailing_space ? Number(s.trailing_space) : 6;
      const tSpace = baseTrail + compat.trailingExtraLines;
      parts.push(Buffer.from([ESC, 0x64, Math.min(255, tSpace)]));

      const finalCutParts = [];

      // Səs və Pul yeşiyi yuxarıya (çapdan əvvələ) keçirildi.

      const feedBeforeCut = Math.min(255, compat.cutFeedLines);
      const cut = s.cut_mode || "full";
      if (cut === "partial") {
        finalCutParts.push(Buffer.from([ESC, 0x64, feedBeforeCut]));
        finalCutParts.push(Buffer.from([GS, 0x56, 0x01])); // GS V 1 — partial cut
      } else if (cut !== "none") {
        finalCutParts.push(Buffer.from([ESC, 0x64, feedBeforeCut]));
        finalCutParts.push(Buffer.from([GS, 0x56, 0x00])); // GS V 0 — full cut
      }

      const singleJobBuffer = Buffer.concat([...parts, ...finalCutParts]);
      console.log(`[RASTER] Final buffer: ${singleJobBuffer.length} bytes, imgH=${imgH}, trimmedH=${trimmedH}, chunks=${Math.ceil(trimmedH / CHUNK_ROWS)}`);

      // Debug: capture edilən şəkli faylda saxla (diaqnostika üçün)
      try {
        const debugPath = require('path').join(require('os').tmpdir(), 'unipos_last_receipt.png');
        require('fs').writeFileSync(debugPath, normalizedImage.toPNG());
        console.log(`[RASTER-DEBUG] Capture şəkli saxlanıldı: ${debugPath}`);
      } catch (dbgErr) {
        console.warn('[RASTER-DEBUG] Şəkil saxlanmadı:', dbgErr.message);
      }

      const copies = s.copies ? Number(s.copies) : 1;
      if (copies <= 1) return singleJobBuffer;

      const multi = [];
      for (let i = 0; i < copies; i++) multi.push(singleJobBuffer);
      return Buffer.concat(multi);
    };

    // usb_name='RASTER' və ya boşdursa — Raster yolu; əks halda Windows driver
    const forceRaster = !settings.usb_name || settings.usb_name === "RASTER";
    // COM port: connection_type='com' və ya printerName COM\d+ formatındadır
    const isComPort =
      settings.connection_type === "com" ||
      (settings.com_port && /^COM\d+$/i.test(String(settings.com_port).trim())) ||
      (printerName && /^COM\d+$/i.test(String(printerName).trim()));

    // Əgər Windows Driver seçilibsə (usb_name dolu & != RASTER):
    // printerName-i usb_name-ə set et (driver üçün), amma isDirectPrinter=false qalacaq.
    // Bu şəkildə yalnız Windows Driver yolu işə düşəcək, TCP (Raster) eyni anda getməyəcək.
    if (!forceRaster && settings.usb_name && settings.usb_name !== "RASTER") {
      printerName = settings.usb_name;
    }


    log.info(`[PRINT-MODE] isComPort=${isComPort}, forceRaster=${forceRaster}, ConnectionType=${settings.connection_type}, usb_name=${settings.usb_name || '(empty)'}`);

    // isDirectPrinter = Raster/TCP yolu: yalnız COM port VƏ ya usb_name boş/RASTER olduqda.
    // Windows Driver (usb_name dolu & != RASTER) olduqda bu yol KEÇILMIR — driver öz yolundan gedir.
    const isDirectPrinter =
      isComPort ||
      (!!printerIp && !!printerPort && forceRaster);

    if (isDirectPrinter) {
      try {
        const rasterBuf = await renderHtmlToRasterBuffer(
          html,
          settings,
          printerName || settings.printer_label || "",
        );

        // COM port adını al: settings.com_port üstünlüklüdür, sonra printerName
        const comPortName = settings.com_port ||
          (printerName && /^COM\d+$/i.test(String(printerName).trim()) ? printerName : null);

        if (isComPort && comPortName) {
            if (!/^COM\d+$/i.test(String(comPortName).trim())) {
                return { success: false, error: `Yanlış COM port adı: ${comPortName}. COM port COM1, COM2 və s. formatda olmalıdır.` };
            }
          const portPath = `\\\\.\\${String(comPortName).trim().toUpperCase()}`;
          return await sendToCom(rasterBuf, portPath, settings.baud_rate);
        }

        const tcpResult = await sendToTcp(rasterBuf, printerIp, printerPort);
        if (!tcpResult.success) {
          // 3 cəhd uğursuz — queue-ya əlavə et, printer qayıdanda avtomatik göndəriləcək
          addToPrintQueue({
            bufHex: rasterBuf.toString("hex"),
            ip: printerIp,
            port: printerPort,
          });
          console.warn(
            `[print-receipt] Çap uğursuz, queue-ya əlavə edildi: ${printerIp}:${printerPort}`,
          );
        } else {
          // Çap uğurlu oldu — səs və pul yeşiyi əmrlərini ayrıca TCP paketi kimi göndər
          if (settings.sound_notify || settings.cash_drawer || settings.open_drawer_without_print) {
            try {
              const ESC2 = 0x1b;
              const cmdParts = [Buffer.from([ESC2, 0x40])]; // ESC @ - init
              if (settings.sound_notify) {
                cmdParts.push(Buffer.from([ESC2, 0x42, 0x04, 0x01])); // XPrinter Alarm
                cmdParts.push(Buffer.from([ESC2, 0x28, 0x41, 0x04, 0x00, 0x61, 0x03, 0x01, 0x01])); // Epson Beeper
              }
              if (settings.cash_drawer || settings.open_drawer_without_print) {
                cmdParts.push(Buffer.from([ESC2, 0x70, 0x00, 0x19, 0xfa])); // Drawer 1
                cmdParts.push(Buffer.from([ESC2, 0x70, 0x01, 0x19, 0xfa])); // Drawer 2
                cmdParts.push(Buffer.from([ESC2, 0x70, 0x00, 0x40, 0x50])); // Alternativ
              }
              const cmdBuf = Buffer.concat(cmdParts);
              const net3 = require('net');
              await new Promise((res) => {
                const s3 = net3.connect(Number(printerPort) || 9100, printerIp, () => {
                  s3.write(cmdBuf, () => s3.end());
                });
                s3.setTimeout(2000);
                s3.on('error', () => res());
                s3.on('timeout', () => { s3.destroy(); res(); });
                s3.on('close', () => res());
              });
            } catch (_e) { /* non-critical */ }
          }
        }
        return tcpResult;
      } catch (err) {
        console.error("[print-receipt] Raster çap xətası:", err);
        // Render uğurlu olsa amma TCP xətası varsa queue-ya əlavə et
        return { success: false, error: String(err.message || err) };
      }
    }

    // Windows Driver: kağız ölçüsünə görə səhifə genişliyi
    const isSmallPaper = paperSize === "58";
    // 80mm kağız: 72mm çap sahəsi; 58mm kağız: 58mm çap sahəsi
    const pageWidthMm = isSmallPaper ? 58 : 72;
    const pageWidthMicrons = pageWidthMm * 1000;
    // 272px receipt kontent — 96 DPI-da neçə px = pageWidthMm mm
    const driverContentPx = Math.round(pageWidthMm * 96 / 25.4);
    // Scale: 272px-i driverContentPx-ə sığdır (80mm: ~1.0; 58mm: ~0.807)
    const driverScale = driverContentPx / contentBaseWidth;

    let printWindow = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      focusable: false,
      x: -9999,
      y: -9999,
      width: driverContentPx,
      height: 16000,
      ...browserWindowIconFields(),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
      },
    });

    const fontFamilyDriver = settings.font_family && settings.font_family !== "Arial"
      ? `"${settings.font_family}", monospace`
      : "monospace";
    const _hdrD = settings.receipt_header ? String(settings.receipt_header).trim() : "";
    const _ftrD = settings.receipt_footer ? String(settings.receipt_footer).trim() : "";
    const headerHtmlD = _hdrD
      ? `<div style="text-align:center;padding-bottom:8px;font-family:monospace;white-space:pre-wrap;font-weight:${settings.bold_header == 1 ? "bold" : "normal"};font-size:${settings.double_height_header == 1 ? "1.5em" : "1.1em"};">${_hdrD.replace(/</g, "&lt;")}</div>`
      : "";
    const footerHtmlD = _ftrD
      ? `<div style="text-align:center;padding-top:8px;font-family:monospace;white-space:pre-wrap;">${_ftrD.replace(/</g, "&lt;")}</div>`
      : "";
    const printLogoD = settings.print_logo != null ? Number(settings.print_logo) : 1;
    const logoStyleD = printLogoD === 0 ? `img { display: none !important; }` : `img { max-width: 100%; }`;

    const pageHtml = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; background: #fff; width: ${driverContentPx}px; font-family: ${fontFamilyDriver}, sans-serif; color: #000; }
      #driver-outer { width: ${driverContentPx}px; }
      #driver-wrap { width: ${contentBaseWidth}px; transform-origin: top left; transform: scale(${driverScale.toFixed(6)}); }
      .receipt-cut-buffer { height: 10mm; }
      ${logoStyleD}
    </style>
  </head><body><div id="driver-outer"><div id="driver-wrap">${headerHtmlD}${html}${footerHtmlD}</div></div><div class="receipt-cut-buffer"></div></body></html>`;

    await printWindow.loadURL(
      "data:text/html;base64," +
        Buffer.from(pageHtml, "utf8").toString("base64"),
    );

    try {
      await printWindow.webContents.executeJavaScript(`
      new Promise(resolve => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            const imgs = document.querySelectorAll('img');
            if (!imgs.length) return resolve();
            let loaded = 0;
            const check = () => { loaded++; if (loaded >= imgs.length) resolve(); };
            imgs.forEach(img => { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
            setTimeout(resolve, 50);
          }).catch(resolve);
        } else {
          const imgs = document.querySelectorAll('img');
          if (!imgs.length) return resolve();
          let loaded = 0;
          const check = () => { loaded++; if (loaded >= imgs.length) resolve(); };
          imgs.forEach(img => { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
          setTimeout(resolve, 100);
        }
      });
    `);

      const contentHeight = await printWindow.webContents.executeJavaScript(`
      const wrapEl = document.getElementById('driver-wrap');
      const outerEl = document.getElementById('driver-outer');
      const rawH = wrapEl ? wrapEl.scrollHeight : document.body.scrollHeight;
      const scaledH = Math.ceil(rawH * ${driverScale.toFixed(6)});
      const bufEl = document.querySelector('.receipt-cut-buffer');
      const bufH = bufEl ? bufEl.offsetHeight : 0;
      // VACIB: rawH istifadə et (scaledH deyil!) — transform:scale layout-u dəyişmir,
      // Electron print zamanı layout hündürlüyünə baxır, scaledH kiçik olduğu üçün kəsilir.
      var pageH = Math.max(rawH, scaledH) + bufH + 60;
      if (outerEl) outerEl.style.height = pageH + 'px';
      document.body.style.height = pageH + 'px';
      document.body.style.minHeight = pageH + 'px';
      document.documentElement.style.height = pageH + 'px';
      document.body.style.overflow = 'visible';
      var hmm = Math.ceil(pageH * 25.4 / 96) + 20;
      var s = document.createElement('style');
      s.textContent = '@page { size: ${pageWidthMm}mm ' + hmm + 'mm; margin: 0; }';
      document.head.appendChild(s);
      console.log('[DRIVER] rawH=' + rawH + ', scaledH=' + scaledH + ', pageH=' + pageH + ', hmm=' + hmm + 'mm');
      hmm;
    `);

      // ── DİNAMİK REZİZE: pəncərəni dəqiq kontent hündürlüyünə gətir ──
      const driverActualPx = Math.ceil(contentHeight * 96 / 25.4);
      if (driverActualPx > 16000) {
        try {
          const safeHeight = Math.min(driverActualPx + 100, 16300); // 16384 is Windows GDI limit, capping at 16300
          printWindow.setContentSize(driverContentPx, safeHeight);
          await new Promise((r) => setTimeout(r, 50));
          
          // Yenidən ölçüb @page-i yenilə
          await printWindow.webContents.executeJavaScript(`
            (function() {
              var wrapEl = document.getElementById('driver-wrap');
              var outerEl = document.getElementById('driver-outer');
              var rawH = wrapEl ? wrapEl.scrollHeight : document.body.scrollHeight;
              var scaledH = Math.ceil(rawH * ${driverScale.toFixed(6)});
              var bufEl = document.querySelector('.receipt-cut-buffer');
              var bufH = bufEl ? bufEl.offsetHeight : 0;
              var pageH = Math.max(rawH, scaledH) + bufH + 60;
              if (outerEl) outerEl.style.height = pageH + 'px';
              document.body.style.height = pageH + 'px';
              document.body.style.minHeight = pageH + 'px';
              document.documentElement.style.height = pageH + 'px';
              var hmm = Math.ceil(pageH * 25.4 / 96) + 20;
              var existingPageStyle = document.querySelector('style[data-receipt-page]');
              if (existingPageStyle) existingPageStyle.remove();
              var s = document.createElement('style');
              s.setAttribute('data-receipt-page', '1');
              s.textContent = '@page { size: ${pageWidthMm}mm ' + hmm + 'mm; margin: 0; }';
              document.head.appendChild(s);
            })();
          `);
          await new Promise((r) => setTimeout(r, 50));
          console.log('[DRIVER] Uzun çek: pəncərə dinamik resize edildi — ' + driverActualPx + 'px (safe: ' + safeHeight + 'px)');
        } catch (e) {
          console.error("Dinamik resize xətası (hesabat çox uzundur):", e);
        }
      }

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Printing timed out (10s)"));
        }, 10000);

        const printOptions = {
          silent: true,
          deviceName: printerName,
          margins: { marginType: "none" },
          preferCSSPageSize: true,
          pageSize: { width: pageWidthMicrons, height: contentHeight * 1000 },
        };

        try {
          printWindow.webContents.print(
            printOptions,
            (success, errorType) => {
              clearTimeout(timeout);
              if (!success) {
                // Bəzi Electron versiyalarında preferCSSPageSize + pageSize birlikdə
                // işlədikdə çap olunsada false qaytarır (xüsusilə Windows 7/8).
                // Bu halda ikinci print() çağırmaq ƏVƏZINƏ — sadə opsiyalarla yenidən
                // cəhd edirik, lakin errorType-a görə fərqləndiririk:
                // "cancelled" — istifadəçi ləğv etdi → xəta qaytar
                // digər xətalar → sadə opsiyalarla bir dəfə daha cəhd et
                if (errorType === 'cancelled') {
                  reject(new Error('Çap istifadəçi tərəfindən ləğv edildi'));
                  return;
                }
                log.warn(`[PRINT] İlk cəhd uğursuz (${errorType}), sadə opsiyalarla təkrar...`);
                try {
                  // Win7 fallback: pageSize olmadan cəhd et — amma yalnız bir dəfə
                  // İkinci cəhd uğurlu olsa, resolve et. Uğursuz olsa xəta qaytar.
                  printWindow.webContents.print(
                    { silent: true, deviceName: printerName, margins: { marginType: "none" } },
                    (success2, errorType2) => {
                      // success2 === false ola bilər amma çap getmiş ola bilər (Electron bug).
                      // Bu yüzündən: əgər errorType2 açıq xəta deyilsə, uğurlu say.
                      if (!success2 && errorType2 && errorType2 !== 'success') {
                        log.warn(`[PRINT] Fallback da uğursuz: ${errorType2}. Ancaq çap gəlmiş ola bilər.`);
                        // Çap fiziki olaraq getmiş ola bilər, reject etmə — resolve et
                        resolve();
                      } else {
                        resolve();
                      }
                    }
                  );
                } catch (e2) { reject(e2); }
              } else {
                resolve();
              }
            },
          );
        } catch (printErr) {
          clearTimeout(timeout);
          reject(printErr);
        }
      });

      if (!printWindow.isDestroyed()) printWindow.close();

      if (
        printerIp &&
        (settings.sound_notify ||
          settings.cash_drawer ||
          settings.open_drawer_without_print)
      ) {
        try {
          const net2 = require("net");
          const parts2 = [Buffer.from([0x1b, 0x40])];
          if (settings.sound_notify) {
            parts2.push(Buffer.from([0x1b, 0x42, 0x04, 0x01])); // XPrinter Alarm
            parts2.push(
              Buffer.from([
                0x1b, 0x28, 0x41, 0x04, 0x00, 0x61, 0x03, 0x01, 0x01,
              ]),
            ); // Epson Beeper
          }
          if (settings.cash_drawer || settings.open_drawer_without_print) {
            parts2.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])); // XPrinter Drawer 1
            parts2.push(Buffer.from([0x1b, 0x70, 0x01, 0x19, 0xfa])); // XPrinter Drawer 2
            parts2.push(Buffer.from([0x1b, 0x70, 0x00, 0x40, 0x50])); // Alternativ
          }
          const cmdBuf = Buffer.concat(parts2);
          const s2 = net2.connect(
            Number(printerPort) || 9100,
            printerIp,
            () => {
              s2.write(cmdBuf, () => s2.end());
            },
          );
          s2.setTimeout(3000);
          s2.on("error", () => {});
          s2.on("timeout", () => s2.destroy());
        } catch (e2) {
          /* non-critical */
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Receipt printing failed:", error);
      if (!printWindow.isDestroyed()) printWindow.close();
      return { success: false, error: String(error) };
    }
}

ipcMain.handle("print-receipt", async (event, data) => {
  try {
    return await executePrintReceipt(event, data);
  } catch (err) {
    return { success: false, error: String(err.message || err) };
  }
});

ipcMain.handle("get-usb-printers", async () => {
  if (!usb) return [];
  try {
    const list = usb.getDeviceList();
    const result = [];
    for (const d of list) {
      try {
        const vid = d.deviceDescriptor.idVendor.toString(16).padStart(4, "0");
        const pid = d.deviceDescriptor.idProduct.toString(16).padStart(4, "0");
        let serial = "";
        let isPrinter = false;

        try {
          d.open();
          if (d.deviceDescriptor.iSerialNumber > 0) {
            serial = await new Promise((resolve) => {
              d.getStringDescriptor(d.deviceDescriptor.iSerialNumber, (err, data) => {
                resolve(err ? "" : data);
              });
            });
          }
          try {
            isPrinter = d.configDescriptor && d.configDescriptor.interfaces.some(i => i.some(alt => alt.bInterfaceClass === 7));
          } catch(_) {}
          d.close();
        } catch (_) {}

        result.push({
          vid,
          pid,
          serial: serial || "",
          name: `USB Device ${vid}:${pid}${serial ? " [" + serial + "]" : ""}${isPrinter ? " (Printer)" : ""}`,
          isPrinter
        });
      } catch (_) {}
    }
    return result;
  } catch (e) {
    return [];
  }
});

ipcMain.handle("get-memory-info", () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    used: (usedMemory / (1024 * 1024 * 1024)).toFixed(2), // GB
    total: (totalMemory / (1024 * 1024 * 1024)).toFixed(2), // GB
    free: (freeMemory / (1024 * 1024 * 1024)).toFixed(2), // GB
  };
});

ipcMain.handle("get-disk-info", async () => {
  return new Promise((resolve) => {
    exec(
      'wmic logicaldisk where DeviceID="C:" get FreeSpace,Size /format:list',
      (error, stdout) => {
        if (error) {
          // console.error("OS Disk Error:", error); // Sessizləşdirildi
          resolve({ used: 0, total: 0, free: 0 });
          return;
        }

        const lines = stdout.split("\n").filter((line) => line.trim() !== "");
        let freeSpace = 0;
        let totalSize = 0;

        lines.forEach((line) => {
          if (line.startsWith("FreeSpace=")) {
            freeSpace = parseInt(line.split("=")[1]);
          }
          if (line.startsWith("Size=")) {
            totalSize = parseInt(line.split("=")[1]);
          }
        });

        const usedSpace = totalSize - freeSpace;

        resolve({
          used: (usedSpace / (1024 * 1024 * 1024)).toFixed(1), // GB
          total: (totalSize / (1024 * 1024 * 1024)).toFixed(0), // GB
          free: (freeSpace / (1024 * 1024 * 1024)).toFixed(1), // GB
        });
      },
    );
  });
});

ipcMain.handle("get-sync-status", async () => {
  try {
    const SyncService = require(
      path.join(__dirname, "..", "backend", "services", "SyncService"),
    );
    return await SyncService.getSyncStatus();
  } catch (error) {
    console.error("IPC get-sync-status error:", error);
    return {
      isSyncing: false,
      pendingCount: 0,
      syncedCount: 0,
      lastSyncError: null,
      lastSyncErrorAt: null,
      lastSyncErrorOrderPrefix: null,
    };
  }
});

ipcMain.handle("get-local-ip", () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        !iface.address.startsWith("169.254.")
      ) {
        return iface.address;
      }
    }
  }
  return "Unknown";
});

ipcMain.handle("check-internet", async () => {
  const http = require("http");
  const https = require("https");
  // Fast check: try 1.1.1.1 (Cloudflare DNS) with 1.5s timeout — no DNS resolution needed
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    // Try HTTPS first (1.1.1.1)
    const req1 = https.get("https://1.1.1.1", { timeout: 1500 }, () => {
      done(true);
      req1.destroy();
    });
    req1.on("error", () => {});
    req1.on("timeout", () => req1.destroy());

    // Fallback: our sync server
    const req2 = http.get(
      "http://46.224.8.157:35627/api/discover",
      { timeout: 1500 },
      () => {
        done(true);
        req2.destroy();
      },
    );
    req2.on("error", () => {});
    req2.on("timeout", () => req2.destroy());

    // If both fail within 1.8s → offline
    setTimeout(() => done(false), 1800);
  });
});

ipcMain.handle("quit-app", () => {
  app.quit();
});

/** Eyni PC-də iki ayrı POS pəncərəsi üçün: `UniPOS.exe --unipos-instance=kassa2` — hər instansın kassa printer seçimi ayrı saxlanır */
function getUniposInstanceLabel() {
  try {
    const argv = process.argv || [];
    for (const a of argv) {
      if (typeof a === "string" && a.startsWith("--unipos-instance=")) {
        const raw = a.slice("--unipos-instance=".length).trim();
        const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "");
        return safe || "default";
      }
    }
  } catch (_) {
    /* ignore */
  }
  return "default";
}

ipcMain.handle("get-unipos-instance", () => getUniposInstanceLabel());
ipcMain.handle("get-update-state", () => updateState);

// Update idarəetmə IPC-ləri
const _uniposSettingsPath = () => path.join(app.getPath("userData"), "unipos-settings.json");
const _readUniposSettings = () => {
  try { return JSON.parse(fs.readFileSync(_uniposSettingsPath(), "utf8")); } catch { return {}; }
};
const _writeUniposSettings = (data) => {
  try { fs.writeFileSync(_uniposSettingsPath(), JSON.stringify({ ..._readUniposSettings(), ...data }), "utf8"); } catch {}
};

ipcMain.handle("get-auto-update-enabled", () => {
  const s = _readUniposSettings();
  return s.autoUpdateEnabled !== false;
});

ipcMain.handle("set-auto-update-enabled", (_, enabled) => {
  try {
    _writeUniposSettings({ autoUpdateEnabled: !!enabled });
    autoUpdater.autoDownload = !!enabled;
    return { ok: true };
  } catch (e) { return { ok: false, message: e.message }; }
});

ipcMain.handle("check-for-updates-now", () => {
  try {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    return { ok: true };
  } catch (e) { return { ok: false, message: e.message }; }
});

ipcMain.handle("download-specific-version", async (_, version) => {
  try {
    autoUpdater.allowDowngrade = true;
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) { return { ok: false, message: e.message }; }
});

ipcMain.handle("get-github-releases", async () => {
  try {
    const { net } = require("electron");
    return new Promise((resolve) => {
      const request = net.request({
        method: "GET",
        url: "https://api.github.com/repos/jumshudsoltanov/NewUniPOS/releases?per_page=10",
        headers: { "User-Agent": "UniPOS-Desktop" },
      });
      let body = "";
      request.on("response", (response) => {
        response.on("data", (chunk) => { body += chunk.toString(); });
        response.on("end", () => {
          try { resolve({ ok: true, data: JSON.parse(body) }); }
          catch { resolve({ ok: false, message: "Parse xətası" }); }
        });
      });
      request.on("error", (err) => resolve({ ok: false, message: err.message }));
      request.end();
    });
  } catch (e) { return { ok: false, message: e.message }; }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-is-dev", () => {
  return isDev;
});

ipcMain.handle("open-devtools-detached", () => {
  try {
    const openDetached = (win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.openDevTools({ mode: "detach" });
        [100, 300, 600].forEach((ms) =>
          setTimeout(() => applyDevToolsIconToWindow(win), ms),
        );
      }
    };
    openDetached(mainWindow);
    openDetached(customerWindow);
    openDetached(kitchenWindow);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
});

const STATIC_MASTER_IP_PATH = path.join(
  app.getPath("userData"),
  "unipos_master_ip.txt",
);

ipcMain.handle("get-static-master-ip", async () => {
  try {
    if (fs.existsSync(STATIC_MASTER_IP_PATH)) {
      const ip = fs.readFileSync(STATIC_MASTER_IP_PATH, "utf8").trim();
      return ip || null;
    }
  } catch (e) {
    console.warn("[MASTER-IP] Oxuma xətası:", e?.message);
  }
  return null;
});

ipcMain.handle("set-static-master-ip", async (event, ip) => {
  try {
    if (ip && ip.trim()) {
      fs.writeFileSync(STATIC_MASTER_IP_PATH, ip.trim(), "utf8");
      return true;
    } else {
      if (fs.existsSync(STATIC_MASTER_IP_PATH))
        fs.unlinkSync(STATIC_MASTER_IP_PATH);
      return true;
    }
  } catch (e) {
    console.warn("[MASTER-IP] Yazma xətası:", e?.message);
    return false;
  }
});

ipcMain.handle("clear-print-spooler", async () => {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    const scriptBlock = `Stop-Service -Name Spooler -Force; Remove-Item -Path "$env:windir\\System32\\spool\\PRINTERS\\*.*" -Force -Recurse; Start-Service -Name Spooler`;
    const encodedCommand = Buffer.from(scriptBlock, 'utf16le').toString('base64');
    const cmd = `powershell.exe -WindowStyle Hidden -Command "Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}' -Verb RunAs -Wait"`;
    
    exec(cmd, { windowsHide: true }, (error) => {
      if (error) {
        console.error("Clear spooler error:", error);
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle("install-xprinter-driver", async () => {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    const path = require("path");
    const fs = require("fs");
    
    // Check paths for the driver
    const devPath = path.join(__dirname, "..", "source", "XPrinter Driver Setup V7.77.exe");
    const prodPath = path.join(process.resourcesPath, "source", "XPrinter Driver Setup V7.77.exe");
    
    let targetPath = fs.existsSync(prodPath) ? prodPath : (fs.existsSync(devPath) ? devPath : null);
    
    if (!targetPath) {
      return resolve({ success: false, error: "XPrinter Driver Setup V7.77.exe faylı tapılmadı." });
    }
    
    const cmd = `"${targetPath}"`;
    exec(cmd, (error) => {
      if (error) {
        console.error("XPrinter install error:", error);
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle("custom-install-xprinter", async (event, config) => {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    const path = require("path");
    const os = require("os");
    const fs = require("fs");

    try {
      const is64 = os.arch() === "x64";
      const driverFolder = is64 ? "Windows x64" : "Windows NT x86";
      const infFile = is64 ? "XPDRVx64.INF" : "XPDRVx86.INF";

      const devPath = path.join(__dirname, "..", "source", "driver");
      const prodPath = path.join(process.resourcesPath, "source", "driver");
      const baseDriverPath = fs.existsSync(prodPath) ? prodPath : (fs.existsSync(devPath) ? devPath : null);

      if (!baseDriverPath) {
        return resolve({ success: false, error: "Drayver qovluğu (source/driver) tapılmadı!" });
      }

      const infPath = path.join(baseDriverPath, driverFolder, infFile);
      const psScriptPath = path.join(baseDriverPath, "install-printer.ps1");

      if (!fs.existsSync(infPath)) {
        return resolve({ success: false, error: "INF faylı tapılmadı: " + infPath });
      }

      // Generate a script block to execute the ps1 file safely with paths containing spaces
      const scriptBlock = `& '${psScriptPath}' -infPath '${infPath}' -model '${config.model}' -connectionType '${config.connectionType}' -ipAddress '${config.ipAddress || ''}' -comPort '${config.comPort || ''}' -printerName '${config.printerName}'`;
      
      // Convert to UTF-16LE Base64 for EncodedCommand
      const encodedCommand = Buffer.from(scriptBlock, 'utf16le').toString('base64');

      // We run PowerShell with elevated privileges using Start-Process, and Hidden window
      const command = `powershell.exe -Command "Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}' -Verb RunAs -Wait -PassThru"`;

      exec(command, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          console.error("XPrinter custom install error:", error);
          return resolve({ success: false, error: error.message || stderr });
        }
        
        // Auto-open Printer Properties so user can configure Cash Drawer and Beeper
        const propertiesCmd = `rundll32 printui.dll,PrintUIEntry /p /n "${config.printerName}"`;
        exec(propertiesCmd);

        resolve({ success: true });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle("scan-master", async () => {
  return new Promise((resolve) => {
    let resolved = false;

    // Helper to finish the scan and clean up
    const finishScan = (ip) => {
      if (resolved) return;
      resolved = true;
      if (overallTimeout) clearTimeout(overallTimeout);
      if (probeInterval) clearInterval(probeInterval);
      try {
        listener.close();
      } catch (e) {}
      try {
        if (probeSender) probeSender.close();
      } catch (e) {}
      resolve(ip);
    };

    // Ümumi timeout — 20 saniyədən sonra tapılmasa null qaytar
    let overallTimeout = setTimeout(() => {
      if (!resolved) {
        console.log("[SLAVE SCAN] 20s timeout — Master tapılmadı");
        finishScan(null);
      }
    }, 20000);

    // --- 1. UDP Listener ---
    const dgram = require("dgram");
    const listener = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let probeSender = null;
    let probeInterval = null;

    listener.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "master_pos" && data.ip && !resolved) {
          console.log(`[SLAVE UDP] MASTER IP TƏSDİQLƏNDİ: ${data.ip}`);
          finishScan(data.ip);
        }
      } catch (e) {
        console.log("[SLAVE UDP] Parsing Error:", e.message);
      }
    });

    listener.on("error", (err) => {
      console.log("[SLAVE UDP] Listener Error:", err.message);
    });

    try {
      listener.bind({ port: 44444, exclusive: false }, () => {
        // --- Aktiv slave_probe göndər — Master dərhal cavab versin ---
        try {
          probeSender = dgram.createSocket({ type: "udp4", reuseAddr: true });
          probeSender.bind(() => {
            probeSender.setBroadcast(true);

            const sendProbes = () => {
              if (resolved) return;
              const probeMsg = Buffer.from(JSON.stringify({ type: "slave_probe" }));
              // Bütün subnet-lərə probe göndər
              const os = require("os");
              const interfaces = os.networkInterfaces();
              const sentTo = new Set();
              for (const name of Object.keys(interfaces)) {
                const isVirtual = name.toLowerCase().match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
                if (isVirtual) continue;
                for (const iface of interfaces[name]) {
                  if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
                    const ipParts = iface.address.split('.').map(Number);
                    const maskParts = (iface.netmask || "255.255.255.0").split('.').map(Number);
                    const bcast = ipParts.map((p, i) => p | (~maskParts[i] & 255)).join('.');
                    if (!sentTo.has(bcast)) {
                      sentTo.add(bcast);
                      probeSender.send(probeMsg, 0, probeMsg.length, 44444, bcast, () => {});
                    }
                  }
                }
              }
              // Ümumi broadcast da göndər
              probeSender.send(probeMsg, 0, probeMsg.length, 44444, "255.255.255.255", () => {});
              // console.log("[SLAVE UDP] slave_probe göndərildi");
            };

            // Dərhal göndər, sonra hər 3000ms-dən bir
            sendProbes();
            probeInterval = setInterval(sendProbes, 3000);
          });
        } catch (e) {
          console.warn("[SLAVE UDP] Probe sender xətası:", e.message);
        }
      });
    } catch (e) {
      console.log("[SLAVE UDP] Bind error:", e.message);
    }

    // --- 2. TCP Sweep — scan ALL active subnets simultaneously ---
    const os = require("os");
    const http = require("http");
    const net = require("net");
    const interfaces = os.networkInterfaces();

    // Collect every non-virtual, non-link-local IPv4 subnet
    const subnets = [];
    for (const name of Object.keys(interfaces)) {
      const isVirtual = name
        .toLowerCase()
        .match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
      if (isVirtual) continue;
      for (const iface of interfaces[name]) {
        if (
          iface.family === "IPv4" &&
          !iface.internal &&
          !iface.address.startsWith("169.254.")
        ) {
          const subnet = iface.address.split(".").slice(0, 3).join(".");
          if (!subnets.includes(subnet)) subnets.push(subnet);
        }
      }
    }

    if (subnets.length > 0) {
      console.log(
        `[SLAVE TCP] IP Axtarışı başladı. Subnet-lər: ${subnets.join(", ")}`,
      );

      const checkIp = (ip) => {
        return new Promise((res) => {
          if (resolved) return res(null);
          const socket = new net.Socket();
          socket.setTimeout(450);
          socket.on("connect", () => {
            socket.destroy();
            if (resolved) return res(null);
            const req = http.get(
              `http://${ip}:55667/api/discover`,
              { timeout: 700 },
              (response) => {
                let body = "";
                response.on("data", (chunk) => (body += chunk));
                response.on("end", () => {
                  try {
                    const result = JSON.parse(body);
                    if (result.master === true) {
                      console.log(
                        `[SLAVE TCP] MASTER tapıldı: ${ip} (${subnets.find((s) => ip.startsWith(s))})`,
                      );
                      res(ip);
                    } else res(null);
                  } catch (e) {
                    res(null);
                  }
                });
              },
            );
            req.on("error", () => res(null));
            req.on("timeout", () => {
              req.destroy();
              res(null);
            });
          });
          socket.on("timeout", () => {
            socket.destroy();
            res(null);
          });
          socket.on("error", () => {
            socket.destroy();
            res(null);
          });
          socket.connect(55667, ip);
        });
      };

      // Build IP list from ALL subnets
      const ips = [];
      for (const subnet of subnets) {
        for (let i = 1; i <= 254; i++) ips.push(`${subnet}.${i}`);
      }

      // Shuffle so both subnets get scanned interleaved (not sequentially)
      for (let i = ips.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ips[i], ips[j]] = [ips[j], ips[i]];
      }

      const scanBatches = async () => {
        const batchSize = 60;
        for (let i = 0; i < ips.length; i += batchSize) {
          if (resolved) return;
          const batch = ips.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(checkIp));
          const foundIp = results.find((r) => r !== null);
          if (foundIp && !resolved) {
            finishScan(foundIp);
            return;
          }
        }
        setTimeout(() => {
          if (!resolved) finishScan(null);
        }, 300);
      };

      scanBatches();
    } else {
      console.log("[SLAVE TCP] Lokal IPv4 alt şəbəkəsi tapılmadı.");
      setTimeout(() => {
        if (!resolved) finishScan(null);
      }, 1200);
    }
  });
});



// Start backend server with error handling
try {
  const appPath = app.getAppPath();
  const backendPath = isDev
    ? path.join(__dirname, "..", "backend", "app.js")
    : path.join(appPath, "electron", "backend", "app.js");
  if (fs.existsSync(backendPath)) {
    require(backendPath);
  } else {
    console.error("Backend file not found:", backendPath);
  }
} catch (err) {
  log.error(
    "Failed to start backend:",
    err ? err.stack || err.message || err.toString() : "Naməlum xəta",
  );
}

// Open Windows Firewall port 55667 for LAN connections (slave terminals need this)
function ensureFirewallRule() {
  if (process.platform !== "win32") return;
  const ruleName = "UniPOS-Server-55667";
  const check = `netsh advfirewall firewall show rule name="${ruleName}"`;
  exec(check, (err, stdout) => {
    if (stdout && stdout.includes(ruleName)) return; // rule already exists
    const add = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=tcp localport=55667 profile=private,domain`;
    exec(add, (addErr) => {
      if (addErr) {
        log.warn(
          "[FIREWALL] Could not add rule automatically (not admin?):",
          addErr.message,
        );
      } else {
        log.info(
          "[FIREWALL] Rule added: port 55667 now open for LAN connections",
        );
      }
    });
  });
}

app.whenReady().then(() => {
  // Avtomatik startup
  app.setLoginItemSettings({ openAtLogin: true });

  ensureFirewallRule();
  createWindow();

  globalShortcut.register("CommandOrControl+Shift+N", () => {
    try {
      [mainWindow, customerWindow, kitchenWindow].forEach((win) => {
        if (win && !win.isDestroyed())
          win.webContents?.openDevTools({ mode: "detach" });
      });
    } catch (e) {
      log.warn("[DEVTOOLS] Shortcut xətası:", e?.message);
    }
  });

  autoUpdater.on("checking-for-update", () => {
    console.log("[AUTO-UPDATE] Yenilənmə yoxlanılır...");
    updateState = { status: "checking", version: null, progress: 0 };
    if (mainWindow) {
      mainWindow.webContents.send("checking-for-update");
    }
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[AUTO-UPDATE] Yeni versiya tapıldı:", info.version);
    updateState = { status: "found", version: info.version, progress: 0 };
    if (mainWindow) {
      mainWindow.webContents.send("update-available", info);
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[AUTO-UPDATE] Cari versiya ən sonuncudur.");
    updateState = { status: null, version: null, progress: 0 };
  });

  autoUpdater.on("error", (err) => {
    console.error(
      "[AUTO-UPDATE] Xəta baş verdi:",
      err ? err.message || err.toString() : "Naməlum xəta",
    );
    updateState = { status: null, version: null, progress: 0 };
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`[AUTO-UPDATE] Yüklənir: ${percent}%`);
    updateState = {
      status: "downloading",
      version: updateState.version,
      progress: percent,
    };
    if (mainWindow) {
      mainWindow.webContents.send("update-download-progress", percent);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    // autoDownload ayarını yoxla — söndürülübsə avtomatik quraşdırma
    let autoEnabled = true;
    try {
      const _sPath = path.join(app.getPath("userData"), "unipos-settings.json");
      const _s = JSON.parse(fs.readFileSync(_sPath, "utf8"));
      autoEnabled = _s.autoUpdateEnabled !== false;
    } catch {}

    console.log(`[AUTO-UPDATE] Yenilənmə yükləndi. autoEnabled=${autoEnabled}`);
    updateState = { status: "ready", version: info.version, progress: 100, autoEnabled };
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded", { ...info, autoEnabled });
    }
    if (autoEnabled) {
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 5000);
    }
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(true, true);
  });

  // Delay 4s so React has time to mount and register IPC listeners
  setTimeout(() => {
    // autoDownload-u settings faylından oxu
    try {
      const _sPath = path.join(app.getPath("userData"), "unipos-settings.json");
      const _s = JSON.parse(fs.readFileSync(_sPath, "utf8"));
      autoUpdater.autoDownload = _s.autoUpdateEnabled !== false;
    } catch {
      autoUpdater.autoDownload = true;
    }

    if (isDev) {
      // Dev mode: simulate update states for UI testing
      let _devAutoEnabled = true;
      try {
        const _sPath = path.join(app.getPath("userData"), "unipos-settings.json");
        const _s = JSON.parse(fs.readFileSync(_sPath, "utf8"));
        _devAutoEnabled = _s.autoUpdateEnabled !== false;
      } catch {}

      if (mainWindow) mainWindow.webContents.send("checking-for-update");
      setTimeout(() => {
        if (mainWindow)
          mainWindow.webContents.send("update-available", { version: "99.9.9" });
        let p = 0;
        const interval = setInterval(() => {
          p += 20;
          if (mainWindow)
            mainWindow.webContents.send("update-download-progress", p);
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              if (mainWindow)
                mainWindow.webContents.send("update-downloaded", { version: "99.9.9", autoEnabled: _devAutoEnabled });
            }, 500);
          }
        }, 600);
      }, 2000);
    } else {
      if (autoUpdater.autoDownload) {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
          log.error(
            "[AUTO-UPDATE] Xəta:",
            err ? err.message || err.toString() : "Naməlum xəta",
          );
        });
      }
    }
  }, 4000);
  // ----------------------------------

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On most platforms, we want to quit the app completely when windows are closed
  app.quit();
});

// Extra safety: ensure all processes are terminated
app.on("before-quit", () => {
  try {
    globalShortcut.unregister("CommandOrControl+Shift+N");
  } catch (e) {}
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (customerWindow && !customerWindow.isDestroyed()) customerWindow.destroy();
  if (kitchenWindow && !kitchenWindow.isDestroyed()) kitchenWindow.destroy();
});

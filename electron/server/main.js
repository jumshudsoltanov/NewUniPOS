const {
  app,
  Menu,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  nativeImage,
} = require("electron");

// Windows 7 köhnə sertifikat problemi — Node.js-in öz CA bundle istifadə etsin
process.env.NODE_TLS_REJECT_UNAUTHORIZED =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0";

const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug";
autoUpdater.autoInstallOnAppQuit = true;
// autoDownload app tam hazır olandan sonra settings faylından oxunacaq (app.whenReady sonra)
log.info("UniPOS Desktop Application is starting...");

Menu.setApplicationMenu(null);
const os = require("os");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let customerWindow = null;

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
    const candidates = [
      path.join(__dirname, "..", "static", "images", "logo.png"),
      path.join(
        __dirname,
        "..",
        "front",
        "src",
        "assets",
        "images",
        "unipos_logo.png",
      ),
      path.join(
        __dirname,
        "..",
        "front",
        "src",
        "assets",
        "images",
        "logo.png",
      ),
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
const crashLogPath = path.join(app.getPath("userData"), "UniPOS_Crash_Log.txt");

function logErrorToFile(errorType, errorObj) {
  try {
    const timestamp = new Date().toISOString();
    let errorDetails = "";
    if (errorObj instanceof Error) {
      errorDetails = `${errorObj.name}: ${errorObj.message}\n${errorObj.stack}`;
    } else {
      errorDetails = String(errorObj);
    }
    const logMessage = `\n[${timestamp}] [${errorType}]\n${errorDetails}\n-----------------------------------\n`;
    fs.appendFileSync(crashLogPath, logMessage, "utf8");
    fs.appendFileSync(
      path.join(os.tmpdir(), "UniPOS_Crash_Log.txt"),
      logMessage,
      "utf8",
    );
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
  const appPath = app.getAppPath();
  const preloadPath = isDev
    ? path.join(__dirname, "preload.js")
    : path.join(appPath, "electron", "server", "preload.js");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true, // Start in fullscreen
    ...browserWindowIconFields(),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  attachDevToolsIcon(mainWindow);

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

  mainWindow.on("closed", () => {
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
      customerDisplayInterval = setInterval(performCheck, 10000); // Poll every 10 seconds
    } catch (err) {
      console.error(
        "[ELECTRON] Auto-start Customer Display Error:",
        err.message,
      );
    }
  }

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
        preload: preloadPath,
      },
    });

    attachDevToolsIcon(customerWindow);

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

ipcMain.handle("get-screens", () => {
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    id: d.id,
    label: d.label || `Ekran ${index + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
  }));
});

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

  // Reuse the global scope function if available, but since this is outside `createWindow()`,
  // we either move it inside, or duplicate the logic for IPCHandler. It's safer to duplicate
  // creation here so IPC can be called from anywhere, OR we export `createCustomerWindow`.

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
      preload: preloadPath,
    },
  });

  attachDevToolsIcon(customerWindow);

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
    },
  });

  attachDevToolsIcon(kitchenWindow);

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
    },
  });

  attachDevToolsIcon(kitchenWindow);

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

ipcMain.handle(
  "print-receipt",
  async (
    event,
    { html, printerName, printerIp, printerPort, printerSettings } = {},
  ) => {
    const settings = printerSettings || {};

    const sendToTcpOnce = (buf, ip, port) =>
      new Promise((resolve) => {
        const net = require("net");
        const sock = net.connect(Number(port) || 9100, ip, () => {
          sock.write(buf, () => {
            sock.end();
            resolve({ success: true });
          });
        });
        sock.setTimeout(8000);
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

    const sendToCom = (buf, portPath) =>
      new Promise((resolve) => {
        const st = fs.createWriteStream(portPath, { flags: "w" });
        st.on("error", (e) => resolve({ success: false, error: e.message }));
        st.write(buf, (err) => {
          st.end();
          resolve(
            err ? { success: false, error: err.message } : { success: true },
          );
        });
      });

    const paperSize = settings.paper_size || "80";
    const receiptWidthPx = paperSize === "58" ? 384 : 576;
    const contentBaseWidth = 272; // HTML həmişə 272px üçün render olur
    const zoomLevel = receiptWidthPx / contentBaseWidth;

    const renderHtmlToRasterBuffer = async (htmlContent, s) => {
      // offscreen:true Win7/Electron22-də işləmir — show:false + position off-screen istifadə et
      let rasterWindow = new BrowserWindow({
        show: false,
        x: -9999,
        y: -9999,
        width: receiptWidthPx + 40,
        height: 6000,
        ...browserWindowIconFields(),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
        },
      });

      const _hdr = s.receipt_header ? String(s.receipt_header).trim() : "";
      const _ftr = s.receipt_footer ? String(s.receipt_footer).trim() : "";
      const headerHtml = _hdr
        ? `<div style="text-align:center; padding-bottom: 10px; font-family: monospace; white-space: pre-wrap; font-weight: ${s.bold_header == 1 ? "bold" : "normal"}; font-size: ${s.double_height_header == 1 ? "1.5em" : "1.1em"};">${_hdr.replace(/</g, "&lt;")}</div>`
        : "";
      const footerHtml = _ftr
        ? `<div style="text-align:center; padding-top: 10px; font-family: monospace; white-space: pre-wrap; margin-bottom: 20px;">${_ftr.replace(/</g, "&lt;")}</div>`
        : "";
      const fontFamily =
        s.font_family && s.font_family !== "Arial"
          ? `"${s.font_family}", monospace`
          : "monospace";

      const printLogo = s.print_logo != null ? Number(s.print_logo) : 1;
      const fastPrint = s.fast_print ? 1 : 0;
      const logoStyle =
        printLogo === 0
          ? `img { display: none !important; }`
          : `img { max-width: 100%; }`;
      const imageQuality = fastPrint ? `image-rendering: pixelated;` : ``;

      // Win7 uyumluluğu üçün zoom əvəzinə transform:scale istifadə et
      // #zoom-outer: vizual genişliyi receiptWidthPx edir; #zoom-wrap: orijinal contentBaseWidth-də render
      const rasterPageHtml = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          margin: 0; padding: 0; background: #fff;
          font-family: ${fontFamily}, sans-serif;
          color: #000;
          overflow: hidden;
          width: ${receiptWidthPx}px;
        }
        #zoom-outer {
          width: ${receiptWidthPx}px;
          overflow: hidden;
        }
        #zoom-wrap {
          width: ${contentBaseWidth}px;
          transform-origin: top left;
          transform: scale(${zoomLevel.toFixed(4)});
          padding-top: 0px;
          padding-bottom: 30px;
        }
        #zoom-wrap > *:first-child,
        #zoom-wrap > *:first-child > *:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        ${logoStyle}
        body, body * { font-weight: bold; ${imageQuality} }
      </style>
    </head><body><div id="zoom-outer"><div id="zoom-wrap">${headerHtml}${htmlContent}${footerHtml}</div></div></body></html>`;

      await new Promise((resolve) => {
        rasterWindow.webContents.once("did-finish-load", resolve);
        rasterWindow.loadURL(
          "data:text/html;base64," +
            Buffer.from(rasterPageHtml, "utf8").toString("base64"),
        );
      });

      // Fontlar tam yüklənsin — "Aa" artifact-ının qarşısını alır
      await rasterWindow.webContents
        .executeJavaScript(
          `
      new Promise(resolve => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(resolve).catch(resolve);
        } else {
          resolve();
        }
      });
    `,
        )
        .catch(() => {});

      await rasterWindow.webContents.executeJavaScript(`
      new Promise(resolve => {
        const imgs = document.querySelectorAll('img');
        if (!imgs.length) return resolve();
        let loaded = 0;
        const check = () => { loaded++; if (loaded >= imgs.length) resolve(); };
        imgs.forEach(img => {
          if (img.complete) check();
          else { img.onload = check; img.onerror = check; }
        });
        setTimeout(resolve, ${s.fast_print == 1 ? 150 : 1500});
      });
    `);

      const wrapInfo = await rasterWindow.webContents.executeJavaScript(`
      (function() {
        var wrap = document.getElementById('zoom-wrap');
        var outer = document.getElementById('zoom-outer');
        // scrollHeight — scale-dən əvvəlki orijinal hündürlük
        var rawH = wrap.scrollHeight;
        // transform:scale vurulmuş vizual hündürlük
        var zoomed = Math.ceil(rawH * ${zoomLevel.toFixed(4)});
        // outer-in body içindəki mövqeyi
        var rect = outer ? outer.getBoundingClientRect() : { top: 0 };
        return { height: Math.max(zoomed, 200), offsetY: Math.max(0, Math.floor(rect.top)) };
      })();
    `);

      const totalH = wrapInfo.height;
      const captureY = wrapInfo.offsetY;

      rasterWindow.setSize(receiptWidthPx + 40, totalH + captureY + 60);
      await new Promise((r) => setTimeout(r, s.fast_print == 1 ? 80 : 500));

      const capturedImage = await rasterWindow.webContents.capturePage({
        x: 0,
        y: captureY,
        width: receiptWidthPx,
        height: totalH,
      });

      if (!rasterWindow.isDestroyed()) rasterWindow.close();
      rasterWindow = null;

      const pngBuf = capturedImage.toPNG();
      const bmp = nativeImage.createFromBuffer(pngBuf).toBitmap();
      const imgSize = capturedImage.getSize();
      const imgW = imgSize.width;
      const imgH = imgSize.height;
      const widthBytes = Math.ceil(receiptWidthPx / 8);
      const scaleX = imgW / receiptWidthPx;

      const isRotated = s.rotate_180 == 1;
      const darkLevel = s.darkness ? Number(s.darkness) : 5;
      const threshold = 100 + (darkLevel - 1) * 11;

      const ESC = 0x1b,
        GS = 0x1d;
      const parts = [];

      parts.push(Buffer.from([ESC, 0x40]));
      parts.push(Buffer.from([ESC, 0x33, 0x00]));

      for (let row = 0; row < imgH; row++) {
        const rowData = Buffer.alloc(widthBytes, 0x00);
        const srcY = isRotated ? imgH - 1 - row : row;

        for (let col = 0; col < receiptWidthPx; col++) {
          const srcX = Math.min(
            Math.floor((isRotated ? receiptWidthPx - 1 - col : col) * scaleX),
            imgW - 1,
          );
          const pixelOffset = (srcY * imgW + srcX) * 4;
          const r = bmp[pixelOffset] || 0;
          const g = bmp[pixelOffset + 1] || 0;
          const b = bmp[pixelOffset + 2] || 0;

          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          if (gray < threshold) {
            const byteIdx = Math.floor(col / 8);
            const bitIdx = 7 - (col % 8);
            rowData[byteIdx] |= 1 << bitIdx;
          }
        }

        const header = Buffer.from([
          GS,
          0x76,
          0x30,
          0x00,
          widthBytes & 0xff,
          (widthBytes >> 8) & 0xff,
          0x01,
          0x00,
        ]);
        parts.push(header);
        parts.push(rowData);
      }

      parts.push(Buffer.from([ESC, 0x33, 0x1e]));
      const tSpace = s.trailing_space ? Number(s.trailing_space) : 4;
      parts.push(Buffer.from([ESC, 0x64, tSpace]));

      const finalCutParts = [];

      // Səs və Pul Yeşiyi komandaları (XPrinter və Epson standartları birlikdə göndərilir)
      if (s.sound_notify) {
        finalCutParts.push(Buffer.from([ESC, 0x42, 0x04, 0x01])); // XPrinter Alarm
        finalCutParts.push(
          Buffer.from([ESC, 0x28, 0x41, 0x04, 0x00, 0x61, 0x03, 0x01, 0x01]),
        ); // Epson Beeper
      }

      if (s.cash_drawer || s.open_drawer_without_print) {
        finalCutParts.push(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa])); // XPrinter Drawer 1
        finalCutParts.push(Buffer.from([ESC, 0x70, 0x01, 0x19, 0xfa])); // XPrinter Drawer 2
      }

      const cut = s.cut_mode || "full";
      if (cut === "partial") {
        finalCutParts.push(Buffer.from([ESC, 0x64, 0x04])); // Feed 4 lines before cut
        finalCutParts.push(Buffer.from([GS, 0x56, 0x01])); // GS V 1 — partial cut
      } else if (cut !== "none") {
        finalCutParts.push(Buffer.from([ESC, 0x64, 0x04])); // Feed 4 lines before cut
        finalCutParts.push(Buffer.from([GS, 0x56, 0x00])); // GS V 0 — full cut
      }

      const singleJobBuffer = Buffer.concat([...parts, ...finalCutParts]);
      const copies = s.copies ? Number(s.copies) : 1;
      if (copies <= 1) return singleJobBuffer;

      const multi = [];
      for (let i = 0; i < copies; i++) multi.push(singleJobBuffer);
      return Buffer.concat(multi);
    };

    // usb_name='RASTER' və ya boşdursa — Raster yolu; əks halda Windows driver
    const forceRaster = !settings.usb_name || settings.usb_name === "RASTER";
    const isDirectPrinter =
      (printerIp && printerPort && forceRaster) ||
      (printerName && /^COM\d+$/i.test(printerName.trim()));
    if (!forceRaster && settings.usb_name && printerIp && printerPort) {
      printerName = settings.usb_name;
    }

    if (isDirectPrinter) {
      try {
        const rasterBuf = await renderHtmlToRasterBuffer(html, settings);

        if (printerName && /^COM\d+$/i.test(printerName.trim())) {
          const portPath = `\\\\.\\${printerName.trim().toUpperCase()}`;
          return await sendToCom(rasterBuf, portPath);
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
        }
        return tcpResult;
      } catch (err) {
        console.error("[print-receipt] Raster çap xətası:", err);
        // Render uğurlu olsa amma TCP xətası varsa queue-ya əlavə et
        return { success: false, error: String(err.message || err) };
      }
    }

    let printWindow = new BrowserWindow({
      show: false,
      x: -9999,
      y: -9999,
      width: 800,
      height: 1200,
      ...browserWindowIconFields(),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
      },
    });

    const cutBufferMm = 30;
    const pageHtml = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; width: 72mm; }
      .receipt-cut-buffer { min-height: 25mm; }
    </style>
  </head><body><div class="receipt-content">${html}</div><div class="receipt-cut-buffer"></div></body></html>`;

    await printWindow.loadURL(
      "data:text/html;base64," +
        Buffer.from(pageHtml, "utf8").toString("base64"),
    );

    try {
      await printWindow.webContents.executeJavaScript(`
      new Promise(resolve => {
        const imgs = document.querySelectorAll('img');
        if (!imgs.length) return resolve();
        let loaded = 0;
        const check = () => { loaded++; if (loaded >= imgs.length) resolve(); };
        imgs.forEach(img => {
          if (img.complete) check();
          else { img.onload = check; img.onerror = check; }
        });
        setTimeout(resolve, 800);
      });
    `);

      const contentHeight = await printWindow.webContents.executeJavaScript(`
      const h = document.body.scrollHeight;
      const hmm = Math.ceil(h * 25.4 / 96) + ${cutBufferMm};
      const s = document.createElement('style');
      s.textContent = '@page { size: 72mm ' + hmm + 'mm; margin: 0; }';
      document.head.appendChild(s);
      hmm;
    `);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Printing timed out (10s)"));
        }, 10000);

        printWindow.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            margins: { marginType: "none" },
            preferCSSPageSize: true,
            pageSize: { width: 72000, height: contentHeight * 1000 },
          },
          (success, errorType) => {
            clearTimeout(timeout);
            if (!success) reject(errorType || "Print failed");
            else resolve();
          },
        );
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
  },
);

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
          console.error("OS Disk Error:", error);
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

ipcMain.handle("scan-master", async () => {
  return new Promise((resolve) => {
    let resolved = false;

    // Helper to finish the scan and clean up
    const finishScan = (ip) => {
      if (resolved) return;
      resolved = true;
      try {
        listener.close();
      } catch (e) {}
      resolve(ip);
    };

    // --- 1. UDP Listener ---
    const dgram = require("dgram");
    const listener = dgram.createSocket("udp4");

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
      // Don't finishScan(null) here, TCP might still find it
    });

    try {
      listener.bind({ port: 44444, exclusive: false });
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

// ── Yalnız Win7-də GPU flag-ları ──────────────────────────────────────────────
// os.release() Win7-də "6.1.x", Win8-də "6.2.x", Win10-da "10.0.x" qaytarır
if (process.platform === "win32") {
  try {
    const release = os.release() || "";
    const major = parseInt(release.split(".")[0], 10);
    const minor = parseInt(release.split(".")[1], 10);
    const isWin7 = major === 6 && minor <= 1; // 6.0=Vista, 6.1=Win7
    if (isWin7) {
      log.info("[WIN7] Windows 7 aşkarlandı, GPU flag-ları tətbiq edilir...");
      app.commandLine.appendSwitch("disable-gpu");
      app.commandLine.appendSwitch("disable-gpu-compositing");
      app.commandLine.appendSwitch("disable-gpu-sandbox");
      app.commandLine.appendSwitch("use-gl", "swiftshader");
    }
  } catch (_gpuErr) {
    // versiya oxunmasa keç — normal işləmə davam edir
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  console.error(
    "Failed to start backend:",
    err ? err.message || err.toString() : "Naməlum xəta",
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

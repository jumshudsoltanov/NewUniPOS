const { BrowserWindow, app, ipcMain, shell, screen, Menu, globalShortcut } = require("electron");
const { autoUpdater } = require("electron-updater");

Menu.setApplicationMenu(null);
const os = require("os");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let customerWindow = null;
let kitchenWindow = null;

// --- GLOBAL CRASH REPORTER ---
const crashLogPath = path.join(app.getPath('userData'), "UniPOS_Crash_Log.txt");

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
    fs.appendFileSync(path.join(os.tmpdir(), "UniPOS_Crash_Log.txt"), logMessage, "utf8");
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

// --- Single Instance Lock Yığışdırıldı ---
// if (!gotTheLock) {
//   app.quit();
// } else {
//   app.on("second-instance", ...
// }
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
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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
      const LoginModel = require(path.join(__dirname, "..", "backend", "model", "LoginModel"));
      const profile = await LoginModel.findOne({ order: [['id', 'DESC']] });

      if (profile && profile.is_kitchen_display_active === 1 && profile.kitchen_display_screen_id) {
        console.log("[ELECTRON] Auto-starting Kitchen Display on screen:", profile.kitchen_display_screen_id);
        createKitchenWindow(profile.kitchen_display_screen_id);
      }
    } catch (err) {
      console.error("[ELECTRON] Auto-start Kitchen Display Error:", err.message);
    }
  }

  async function checkCustomerDisplayAutoStart() {
    try {
      const LoginModel = require(path.join(__dirname, "..", "backend", "model", "LoginModel"));
      const profile = await LoginModel.findOne({ order: [['id', 'DESC']] });

      if (profile && profile.is_customer_display_active === 1 && profile.customer_display_screen_id) {
        console.log("[ELECTRON] Auto-starting Customer Display on screen:", profile.customer_display_screen_id);

        const displays = screen.getAllDisplays();
        const targetDisplay = displays.find(d => String(d.id) === String(profile.customer_display_screen_id)) || screen.getPrimaryDisplay();

        if (customerWindow) {
          customerWindow.close();
        }

        customerWindow = new BrowserWindow({
          x: targetDisplay.bounds.x,
          y: targetDisplay.bounds.y,
          width: targetDisplay.bounds.width,
          height: targetDisplay.bounds.height,
          fullscreen: true,
          icon: path.join(__dirname, "..", "static", "images", "logo.png"),
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        if (isDev) {
          customerWindow.loadURL("http://localhost:5173/#/customer");
        } else {
          customerWindow.loadFile(path.join(app.getAppPath(), "electron", "front", "dist", "index.html"), { hash: "/customer" });
        }

        customerWindow.on("closed", () => {
          customerWindow = null;
        });
      }
    } catch (err) {
      console.error("[ELECTRON] Auto-start Customer Display Error:", err.message);
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
    path.join(process.env.LOCALAPPDATA || "", "Programs", "AnyDesk", "AnyDesk.exe"),
  ];

  for (const adPath of anyDeskPaths) {
    if (fs.existsSync(adPath)) {
      exec(`"${adPath}"`, (error) => {
        if (error) {
          console.error("Failed to open AnyDesk:", error ? String(error) : "Unknown Error");
        }
      });
      return true;
    }
  }

  // Try running anydesk from PATH
  exec("anydesk", (error) => {
    if (error) {
      console.error("AnyDesk not found in PATH:", error ? String(error) : "Unknown Error");
    }
  });
  return true;
});

ipcMain.handle("get-system-printers", async () => {
  try {
    if (mainWindow && mainWindow.webContents) {
      if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
        return await mainWindow.webContents.getPrintersAsync();
      }
      if (typeof mainWindow.webContents.getPrinters === 'function') {
        return mainWindow.webContents.getPrinters();
      }
    }
    return [];
  } catch (e) {
    console.error("Error getting system printers:", e ? String(e) : "Unknown Printer Error");
    return [];
  }
});

ipcMain.handle("get-screens", () => {
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    id: d.id,
    label: d.label || `Ekran ${index + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
});

ipcMain.handle("toggle-customer-display", (event, { active, screenId }) => {
  if (!active) {
    if (customerWindow) {
      customerWindow.close();
      customerWindow = null;
    }
    return { success: true, active: false };
  }

  // If already open, just focus or move? 
  // For simplicity, let's recreation logic
  if (customerWindow) {
    customerWindow.close();
  }

  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find(d => String(d.id) === String(screenId)) || screen.getPrimaryDisplay();

  customerWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev ? "http://localhost:5173/#/customer" : `file://${path.join(app.getAppPath(), "electron", "front", "dist", "index.html")}#/customer`;

  if (isDev) {
    customerWindow.loadURL("http://localhost:5173/#/customer");
  } else {
    customerWindow.loadFile(path.join(app.getAppPath(), "electron", "front", "dist", "index.html"), { hash: "/customer" });
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
  const targetDisplay = displays.find(d => String(d.id) === String(screenId)) || screen.getPrimaryDisplay();

  kitchenWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    kitchenWindow.loadURL("http://localhost:5173/#/kitchen-display");
  } else {
    kitchenWindow.loadFile(path.join(app.getAppPath(), "electron", "front", "dist", "index.html"), { hash: "/kitchen-display" });
  }

  kitchenWindow.on("closed", () => {
    kitchenWindow = null;
  });

  return { success: true, active: true };
});

function createKitchenWindow(screenId) {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find(d => String(d.id) === String(screenId)) || screen.getPrimaryDisplay();

  kitchenWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    kitchenWindow.loadURL("http://localhost:5173/#/kitchen-display");
  } else {
    kitchenWindow.loadFile(path.join(app.getAppPath(), "electron", "front", "dist", "index.html"), { hash: "/kitchen-display" });
  }

  kitchenWindow.on("closed", () => {
    kitchenWindow = null;
  });
}

ipcMain.handle("print-receipt", async (event, { html, printerName }) => {
  let printWindow = new BrowserWindow({
    show: false,
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
  });

  const htmlContent = `<!DOCTYPE html><html><head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { margin: 0; padding: 0; width: 72mm; }
      body > div { width: 100% !important; max-width: 100% !important; }
    </style>
  </head><body>${html}</body></html>`;

  await printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));

  try {
    // Wait for all images to load (logos, QR etc)
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
        setTimeout(resolve, 3000);
      });
    `);

    // Measure content height and inject exact @page size
    const contentHeight = await printWindow.webContents.executeJavaScript(`
      const h = document.body.scrollHeight;
      const hmm = Math.ceil(h * 25.4 / 96) + 10;
      const s = document.createElement('style');
      s.textContent = '@page { size: 72mm ' + hmm + 'mm; margin: 0; }';
      document.head.appendChild(s);
      hmm;
    `);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Printing timed out (10s)"));
      }, 10000);

      printWindow.webContents.print({
        silent: true,
        deviceName: printerName,
        margins: { marginType: 'none' },
        preferCSSPageSize: true,
        pageSize: { width: 72000, height: contentHeight * 1000 }
      }, (success, errorType) => {
        clearTimeout(timeout);
        if (!success) reject(errorType || "Print failed");
        else resolve();
      });
    });

    if (!printWindow.isDestroyed()) printWindow.close();
    return { success: true };
  } catch (error) {
    console.error("Receipt printing failed:", error);
    if (!printWindow.isDestroyed()) printWindow.close();
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("get-memory-info", () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    used: (usedMemory / (1024 * 1024 * 1024)).toFixed(2), // GB
    total: (totalMemory / (1024 * 1024 * 1024)).toFixed(2), // GB
    free: (freeMemory / (1024 * 1024 * 1024)).toFixed(2) // GB
  };
});

ipcMain.handle("get-disk-info", async () => {
  return new Promise((resolve) => {
    exec('wmic logicaldisk where DeviceID="C:" get FreeSpace,Size /format:list', (error, stdout) => {
      if (error) {
        console.error("OS Disk Error:", error);
        resolve({ used: 0, total: 0, free: 0 });
        return;
      }

      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      let freeSpace = 0;
      let totalSize = 0;

      lines.forEach(line => {
        if (line.startsWith('FreeSpace=')) {
          freeSpace = parseInt(line.split('=')[1]);
        }
        if (line.startsWith('Size=')) {
          totalSize = parseInt(line.split('=')[1]);
        }
      });

      const usedSpace = totalSize - freeSpace;

      resolve({
        used: (usedSpace / (1024 * 1024 * 1024)).toFixed(1), // GB
        total: (totalSize / (1024 * 1024 * 1024)).toFixed(0), // GB
        free: (freeSpace / (1024 * 1024 * 1024)).toFixed(1) // GB
      });
    });
  });
});

ipcMain.handle("get-sync-status", async () => {
  try {
    const SyncService = require(path.join(__dirname, "..", "backend", "services", "SyncService"));
    return await SyncService.getSyncStatus();
  } catch (error) {
    console.error("IPC get-sync-status error:", error);
    return { isSyncing: false, pendingCount: 0 };
  }
});

ipcMain.handle("get-local-ip", () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
        return iface.address;
      }
    }
  }
  return "Unknown";
});

ipcMain.handle("check-internet", async () => {
  const http = require("http");
  return new Promise((resolve) => {
    // Try to reach a reliable public IP or our sync server domain
    const req = http.get("http://46.224.8.157:35627/api/terminal/login", { timeout: 3000 }, (res) => {
      resolve(true);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
});

ipcMain.handle("quit-app", () => {
  app.quit();
});

ipcMain.handle("scan-master", async () => {
  return new Promise((resolve) => {
    let resolved = false;

    // Helper to finish the scan and clean up
    const finishScan = (ip) => {
      if (resolved) return;
      resolved = true;
      try { listener.close(); } catch (e) { }
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

    // --- 2. TCP Sweep (Super fast HTTP Check) ---
    const os = require("os");
    const http = require("http");
    const interfaces = os.networkInterfaces();
    let localSubnet = null;

    for (const name of Object.keys(interfaces)) {
      const isVirtual = name.toLowerCase().match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
      if (isVirtual) continue;
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
          localSubnet = iface.address.split('.').slice(0, 3).join('.');
          break;
        }
      }
      if (localSubnet) break;
    }

    if (localSubnet) {
      console.log(`[SLAVE TCP] IP Axtarışı başladı. Subnet: ${localSubnet}.*`);

      const net = require("net");
      const checkIp = (ip) => {
        return new Promise((res) => {
          if (resolved) return res(null);

          const socket = new net.Socket();
          socket.setTimeout(1000); // Shorter timeout for faster sweep

          socket.on('connect', () => {
            socket.destroy();
            if (resolved) return res(null);

            const startTime = Date.now();
            const req = http.get(`http://${ip}:55667/api/discover`, { timeout: 1500 }, (response) => {
              let body = '';
              response.on('data', chunk => body += chunk);
              response.on('end', () => {
                try {
                  const result = JSON.parse(body);
                  if (result.master === true) {
                    console.log(`[SLAVE TCP] Uğurlu cavab: ${ip} | Müddət: ${Date.now() - startTime}ms`);
                    res(ip);
                  } else res(null);
                } catch (e) { res(null); }
              });
            });
            req.on('error', () => res(null));
            req.on('timeout', () => { req.destroy(); res(null); });
          });

          socket.on('timeout', () => { socket.destroy(); res(null); });
          socket.on('error', () => { socket.destroy(); res(null); });

          socket.connect(55667, ip);
        });
      };

      const ips = [];
      for (let i = 1; i <= 254; i++) ips.push(`${localSubnet}.${i}`);

      const scanBatches = async () => {
        const batchSize = 50; // Increased batch size for speed
        for (let i = 0; i < ips.length; i += batchSize) {
          if (resolved) return;
          const batch = ips.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(checkIp));
          const foundIp = results.find(res => res !== null);

          if (foundIp && !resolved) {
            console.log(`[SLAVE TCP] MASTER IP TƏSDİQLƏNDİ: ${foundIp}`);
            finishScan(foundIp);
            return;
          }
        }

        // If we finished the sweep and no UDP came in, wait a bit longer or fail
        setTimeout(() => {
          if (!resolved) finishScan(null);
        }, 5000);
      };

      scanBatches();
    } else {
      console.log("[SLAVE TCP] Lokal IPv4 alt şəbəkəsi tapılmadı.");
      // If no TCP sweep possible, wait for UDP or timeout
      setTimeout(() => {
        if (!resolved) finishScan(null);
      }, 10000);
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
  console.error("Failed to start backend:", err ? (err.message || err.toString()) : "Naməlum xəta");
}

app.whenReady().then(() => {
  createWindow();

  // Konsolu acmaq ucun qisa yol (Ctrl+Shift+C ve Ctrl+Shift+N)
  const toggleDevTools = () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
    if (customerWindow) customerWindow.webContents.toggleDevTools();
    if (kitchenWindow) kitchenWindow.webContents.toggleDevTools();
  };

  globalShortcut.register('CommandOrControl+Shift+C+N', toggleDevTools);
  globalShortcut.register('CommandOrControl+Shift+N+C', toggleDevTools);

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error("[AUTO-UPDATE] Yenilənmə yoxlanışı zamanı xəta (Böyük ehtimalla GitHub-da release yoxdur):", err ? (err.message || err.toString()) : "Naməlum xəta");
    });
  }

  autoUpdater.on("checking-for-update", () => {
    console.log("[AUTO-UPDATE] Yenilənmə yoxlanılır...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[AUTO-UPDATE] Yeni versiya tapıldı:", info.version);
    if (mainWindow) {
      mainWindow.webContents.send("backend-log", "[AUTO-UPDATE]", `Yeni versiya (${info.version}) tapıldı. Yüklənir...`);
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[AUTO-UPDATE] Cari versiya ən sonuncudur.");
  });

  autoUpdater.on("error", (err) => {
    console.error("[AUTO-UPDATE] Xəta baş verdi:", err ? (err.message || err.toString()) : "Naməlum xəta");
  });

  autoUpdater.on("download-progress", (progressObj) => {
    let log_message = "Yükləmə sürəti: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Yüklənib ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log("[AUTO-UPDATE]", log_message);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[AUTO-UPDATE] Yenilənmə yükləndi. Tətbiq yenidən başladılacaq.");
    if (mainWindow) {
      mainWindow.webContents.send("backend-log", "[AUTO-UPDATE]", "Yenilənmə hazırdır. Tətbiq indi yenidən açıla bilər.");
    }
    // You can also prompt the user here or just call autoUpdater.quitAndInstall()
  });
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
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (customerWindow && !customerWindow.isDestroyed()) customerWindow.destroy();
  if (kitchenWindow && !kitchenWindow.isDestroyed()) kitchenWindow.destroy();
});

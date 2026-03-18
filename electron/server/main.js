const { app, Menu, BrowserWindow, ipcMain, screen, globalShortcut } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("UniPOS Desktop Application is starting...");

Menu.setApplicationMenu(null);
const os = require("os");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let customerWindow = null;
let kitchenWindow = null;
let isCustomerDisplayManuallyClosed = false; // Global flag

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
          const LoginModel = require(path.join(__dirname, "..", "backend", "model", "LoginModel"));
          const profile = await LoginModel.findOne({ order: [['id', 'DESC']] });

          if (profile && profile.is_customer_display_active === 1 && profile.customer_display_screen_id) {
            
            // If it's supposed to be active, but manually closed by IPC, do not revive.
            if (isCustomerDisplayManuallyClosed) {
              return;
            }

            // If active and NO customer window exists, revive it.
            if (!customerWindow || customerWindow.isDestroyed()) {
              console.log("[ELECTRON] Auto-reviving/starting Customer Display on screen:", profile.customer_display_screen_id);
              createCustomerWindow(profile.customer_display_screen_id);
            }
          } else {
             // If disabled in DB but window is open, close it cleanly
             if (customerWindow && !customerWindow.isDestroyed()) {
                 customerWindow.close();
                 customerWindow = null;
             }
          }
        } catch (innerErr) {
           console.error("[ELECTRON] Auto-check Customer Display Inner Error:", innerErr.message);
        }
      };

      await performCheck(); // Run once immediately
      customerDisplayInterval = setInterval(performCheck, 10000); // Poll every 10 seconds
      
    } catch (err) {
      console.error("[ELECTRON] Auto-start Customer Display Error:", err.message);
    }
  }

  function createCustomerWindow(screenId) {
    if (customerWindow && !customerWindow.isDestroyed()) {
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

    if (isDev) {
      customerWindow.loadURL("http://localhost:5173/#/customer");
    } else {
      customerWindow.loadFile(path.join(app.getAppPath(), "electron", "front", "dist", "index.html"), { hash: "/customer" });
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

ipcMain.handle("print-receipt", async (event, { html, printerName, printerIp, printerPort } = {}) => {
  // Network printer (IP) — raw socket ilə birbaşa çap
  if (printerIp && printerPort && (!printerName || printerName === "")) {
    try {
      const net = require("net");
      let text = (html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n\s*\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();
      const escInit = Buffer.from([0x1b, 0x40]);
      const escCut = Buffer.from([0x1d, 0x56, 0x00]);
      const content = Buffer.from(text + "\n\n\n", "utf8");
      const data = Buffer.concat([escInit, content, escCut]);
      return new Promise((res) => {
        const socket = net.connect(Number(printerPort) || 9100, printerIp, () => {
          socket.write(data, () => {
            socket.end();
            res({ success: true });
          });
        });
        socket.setTimeout(5000);
        socket.on("error", (e) => {
          console.error("[PRINT] Raw socket error:", e.message);
          res({ success: false, error: e.message });
        });
        socket.on("timeout", () => {
          socket.destroy();
          res({ success: false, error: "Timeout" });
        });
      });
    } catch (e) {
      console.error("[PRINT] Raw print error:", e);
      return { success: false, error: e?.message || "Raw print failed" };
    }
  }

  let printWindow = new BrowserWindow({
    show: false,
    icon: path.join(__dirname, "..", "static", "images", "logo.png"),
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
  });

  const cutBufferMm = 30;

  const htmlContent = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body {
        margin: 0; padding: 0; width: 72mm;
        font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      body > div { width: 100% !important; max-width: 100% !important; }
      .receipt-content { padding: 0 1mm; box-sizing: border-box; }
      .receipt-cut-buffer { min-height: 25mm; }
    </style>
  </head><body><div class="receipt-content">${html}</div><div class="receipt-cut-buffer"></div></body></html>`;

  await printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));

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

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

const STATIC_MASTER_IP_PATH = path.join(app.getPath("userData"), "unipos_master_ip.txt");

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
      if (fs.existsSync(STATIC_MASTER_IP_PATH)) fs.unlinkSync(STATIC_MASTER_IP_PATH);
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

    // --- 2. TCP Sweep — scan ALL active subnets simultaneously ---
    const os = require("os");
    const http = require("http");
    const net = require("net");
    const interfaces = os.networkInterfaces();

    // Collect every non-virtual, non-link-local IPv4 subnet
    const subnets = [];
    for (const name of Object.keys(interfaces)) {
      const isVirtual = name.toLowerCase().match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
      if (isVirtual) continue;
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
          const subnet = iface.address.split('.').slice(0, 3).join('.');
          if (!subnets.includes(subnet)) subnets.push(subnet);
        }
      }
    }

    if (subnets.length > 0) {
      console.log(`[SLAVE TCP] IP Axtarışı başladı. Subnet-lər: ${subnets.join(', ')}`);

      const checkIp = (ip) => {
        return new Promise((res) => {
          if (resolved) return res(null);
          const socket = new net.Socket();
          socket.setTimeout(450);
          socket.on('connect', () => {
            socket.destroy();
            if (resolved) return res(null);
            const req = http.get(`http://${ip}:55667/api/discover`, { timeout: 700 }, (response) => {
              let body = '';
              response.on('data', chunk => body += chunk);
              response.on('end', () => {
                try {
                  const result = JSON.parse(body);
                  if (result.master === true) {
                    console.log(`[SLAVE TCP] MASTER tapıldı: ${ip} (${subnets.find(s => ip.startsWith(s))})`);
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
          const foundIp = results.find(r => r !== null);
          if (foundIp && !resolved) {
            finishScan(foundIp);
            return;
          }
        }
        setTimeout(() => { if (!resolved) finishScan(null); }, 300);
      };

      scanBatches();
    } else {
      console.log("[SLAVE TCP] Lokal IPv4 alt şəbəkəsi tapılmadı.");
      setTimeout(() => { if (!resolved) finishScan(null); }, 1200);
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
        log.warn("[FIREWALL] Could not add rule automatically (not admin?):", addErr.message);
      } else {
        log.info("[FIREWALL] Rule added: port 55667 now open for LAN connections");
      }
    });
  });
}

app.whenReady().then(() => {
  ensureFirewallRule();
  createWindow();

  // Konsolu acmaq ucun qisa yol (Ctrl+Shift+C ve Ctrl+Shift+N)
  const toggleDevTools = () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
    if (customerWindow) customerWindow.webContents.toggleDevTools();
    if (kitchenWindow) kitchenWindow.webContents.toggleDevTools();
  };

  globalShortcut.register('CommandOrControl+Shift+C+N', toggleDevTools);
  globalShortcut.register('CommandOrControl+Shift+N+C', toggleDevTools);

  autoUpdater.on("checking-for-update", () => {
    console.log("[AUTO-UPDATE] Yenilənmə yoxlanılır...");
    if (mainWindow) {
      mainWindow.webContents.send("checking-for-update");
    }
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[AUTO-UPDATE] Yeni versiya tapıldı:", info.version);
    if (mainWindow) {
      mainWindow.webContents.send("update-available", info);
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[AUTO-UPDATE] Cari versiya ən sonuncudur.");
  });

  autoUpdater.on("error", (err) => {
    console.error("[AUTO-UPDATE] Xəta baş verdi:", err ? (err.message || err.toString()) : "Naməlum xəta");
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`[AUTO-UPDATE] Yüklənir: ${percent}%`);
    if (mainWindow) {
      mainWindow.webContents.send("update-download-progress", percent);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[AUTO-UPDATE] Yenilənmə yükləndi. 5 saniyə sonra quraşdırılır...");
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded", info);
    }
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 5000);
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(true, true);
  });

  // Delay 4s so React has time to mount and register IPC listeners
  setTimeout(() => {
    if (isDev) {
      // Dev mode: simulate update states for UI testing
      if (mainWindow) mainWindow.webContents.send("checking-for-update");
      setTimeout(() => {
        if (mainWindow) mainWindow.webContents.send("update-available", { version: "99.9.9" });
        let p = 0;
        const interval = setInterval(() => {
          p += 20;
          if (mainWindow) mainWindow.webContents.send("update-download-progress", p);
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              if (mainWindow) mainWindow.webContents.send("update-downloaded", {});
            }, 500);
          }
        }, 600);
      }, 2000);
    } else {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error("[AUTO-UPDATE] Yenilənmə yoxlanışı zamanı xəta:", err ? (err.message || err.toString()) : "Naməlum xəta");
      });
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
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (customerWindow && !customerWindow.isDestroyed()) customerWindow.destroy();
  if (kitchenWindow && !kitchenWindow.isDestroyed()) kitchenWindow.destroy();
});

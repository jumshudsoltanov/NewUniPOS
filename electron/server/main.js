const { BrowserWindow, app, ipcMain, shell } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const isDev = !app.isPackaged;
let mainWindow = null;

function createWindow() {
  const appPath = app.getAppPath();
  const preloadPath = isDev
    ? path.join(__dirname, "preload.js")
    : path.join(appPath, "electron", "server", "preload.js");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true, // Start in fullscreen
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

  // Intercept all backend console.logs and pipe them to the frontend DevTools
  const originalLog = console.log;
  console.log = function (...args) {
    originalLog.apply(console, args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-log", "[NODE BACKEND]", ...args);
    }
  };

  const originalError = console.error;
  console.error = function (...args) {
    originalError.apply(console, args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-log", "[NODE ERROR]", ...args);
    }
  };
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
        if (error) console.error("Failed to open AnyDesk:", error);
      });
      return true;
    }
  }

  // Try running anydesk from PATH
  exec("anydesk", (error) => {
    if (error) console.error("AnyDesk not found in PATH:", error);
  });
  return true;
});

ipcMain.handle("print-receipt", async (event, { html, printerName }) => {
  let printWindow = new BrowserWindow({
    show: false,
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
    const SyncService = require("../backend/services/SyncService");
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

ipcMain.handle("scan-master", async () => {
  return new Promise((resolve) => {
    let resolved = false;

    // --- 1. UDP Listener ---
    const dgram = require("dgram");
    const listener = dgram.createSocket("udp4");

    listener.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        console.log(`[SLAVE UDP] Mesaj gəldi: ${msg.toString()} | Göndərən: ${rinfo.address}`);
        if (data.type === "master_pos" && data.ip && !resolved) {
          console.log(`[SLAVE UDP] MASTER IP TƏSDİQLƏNDİ: ${data.ip}`);
          resolved = true;
          try { listener.close(); } catch (e) { }
          resolve(data.ip);
        }
      } catch (e) {
        console.log("[SLAVE UDP] Parsing Error:", e.message);
      }
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
      console.log(`[SLAVE TCP] IP Axtarışı başladı. Subnet: ${localSubnet}.1 - 254`);

      const net = require("net");
      const checkIp = (ip) => {
        return new Promise((res) => {
          const socket = new net.Socket();
          socket.setTimeout(1500);

          socket.on('connect', () => {
            socket.destroy();
            const startTime = Date.now();
            const req = http.get(`http://${ip}:55667/api/discover`, { timeout: 2000 }, (response) => {
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
        const batchSize = 40;
        for (let i = 0; i < ips.length; i += batchSize) {
          if (resolved) return;
          const batch = ips.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(checkIp));
          const foundIp = results.find(res => res !== null);

          if (foundIp && !resolved) {
            console.log(`[SLAVE TCP] MASTER IP TƏSDİQLƏNDİ: ${foundIp}`);
            resolved = true;
            try { listener.close(); } catch (e) { }
            resolve(foundIp);
            return;
          }
        }
      };

      scanBatches();
    } else {
      console.log("[SLAVE TCP] Lokal (Private) IPv4 alt şəbəkəsi tapılmadı.");
    }

    // --- 3. Safety Timeout ---
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { listener.close(); } catch (e) { }
        console.log("[SLAVE] 15 saniyə ərzində Master tapılmadı. Lokal davam edilir...");
        resolve(null);
      }
    }, 15000);
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
  console.error("Failed to start backend:", err);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

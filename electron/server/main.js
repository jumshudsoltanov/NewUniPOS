const { BrowserWindow, app, ipcMain, shell } = require("electron");
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

ipcMain.handle("print-image", async (event, { image, printerName }) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const now = new Date().toLocaleString('az-AZ').replace(/[,]/g, '').replace(/[: ]/g, '_');
  const jobName = `unipos_${now}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${jobName}</title>
        <style>
          @page { margin: 0; }
          body { margin: 0; padding: 0; display: flex; justify-content: flex-start; }
          img { width: 100%; max-width: 100%; height: auto; display: block; }
        </style>
      </head>
      <body>
        <img src="${image}" />
      </body>
    </html>
  `;

  await printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));
  printWindow.setTitle(jobName);

  const options = {
    silent: true,
    deviceName: printerName,
    margins: { marginType: 'none' }
  };

  try {
    // Wait for the image to load and render
    await new Promise(resolve => setTimeout(resolve, 1000));

    await new Promise((resolve, reject) => {
      printWindow.webContents.print(options, (success, errorType) => {
        if (!success) reject(errorType);
        else resolve();
      });
    });

    if (!printWindow.isDestroyed()) printWindow.close();
    return { success: true };
  } catch (error) {
    console.error("Printing failed:", error);
    if (!printWindow.isDestroyed()) printWindow.close();
    return { success: false, error };
  }
});

ipcMain.handle("scan-master", async () => {
  return new Promise((resolve) => {
    const dgram = require("dgram");
    const listener = dgram.createSocket("udp4");
    let resolved = false;

    listener.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "master_pos" && data.ip) {
          if (!resolved) {
            resolved = true;
            listener.close();
            resolve(data.ip);
          }
        }
      } catch (e) { }
    });

    listener.on("error", () => {
      if (!resolved) {
        resolved = true;
        listener.close();
        resolve(null);
      }
    });

    try {
      listener.bind(44444);
    } catch (e) {
      // Port in use or other error
      if (!resolved) resolve(null);
    }

    // Timeout after 5 seconds if no master found
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { listener.close(); } catch (e) { }
        resolve(null);
      }
    }, 5000);
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

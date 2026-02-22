const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
    getFullscreenState: () => ipcRenderer.invoke("get-fullscreen-state"),
    openAnyDesk: () => ipcRenderer.invoke("open-anydesk"),
    printReceipt: (data) => ipcRenderer.invoke("print-receipt", data),
    scanMaster: () => ipcRenderer.invoke("scan-master"),
    getMemoryInfo: () => ipcRenderer.invoke("get-memory-info"),
    getDiskInfo: () => ipcRenderer.invoke("get-disk-info"),
    getSyncStatus: () => ipcRenderer.invoke("get-sync-status"),
    getLocalIp: () => ipcRenderer.invoke("get-local-ip"),
    checkInternet: () => ipcRenderer.invoke("check-internet"),
    onBackendLog: (callback) => ipcRenderer.on("backend-log", (event, ...args) => callback(...args)),
});

const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
    getFullscreenState: () => ipcRenderer.invoke("get-fullscreen-state"),
    openAnyDesk: () => ipcRenderer.invoke("open-anydesk"),
    printImage: (data) => ipcRenderer.invoke("print-image", data),
    scanMaster: () => ipcRenderer.invoke("scan-master"),
});

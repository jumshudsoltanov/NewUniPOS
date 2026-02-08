const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
    toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
    getFullscreenState: () => ipcRenderer.invoke("get-fullscreen-state"),
    openAnyDesk: () => ipcRenderer.invoke("open-anydesk"),
});

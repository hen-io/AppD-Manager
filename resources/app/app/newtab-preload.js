"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("appdNewTab", {
  open: (url) => ipcRenderer.send("appd-newtab-open", String(url)),
  cancel: () => ipcRenderer.send("appd-newtab-cancel"),
  onBad: (show) => ipcRenderer.on("appd-newtab-bad", () => show())
});

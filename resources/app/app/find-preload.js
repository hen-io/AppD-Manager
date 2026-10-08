"use strict";
const { contextBridge, ipcRenderer } = require("electron");
let again = () => {
};
contextBridge.exposeInMainWorld("appdFind", {
  look: (text, forward, next) => {
    again = (onward) => ipcRenderer.send("appd-find", String(text), Boolean(onward), true);
    ipcRenderer.send("appd-find", String(text), Boolean(forward), Boolean(next));
  },
  close: () => ipcRenderer.send("appd-find-close"),
  onCount: (show) => ipcRenderer.on("appd-find-count", (_event, at, of) => show(Number(at) || 0, Number(of) || 0))
});
ipcRenderer.on("appd-find-again", (_event, forward) => again(forward));

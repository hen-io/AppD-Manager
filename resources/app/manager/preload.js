"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "state",
  "save",
  "remove",
  "launch",
  "pickIcon",
  "pickAppsDir",
  "resetAppsDir",
  "openAppsDir",
  "checkUpdate",
  "installUpdate"
]) {
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
}
contextBridge.exposeInMainWorld("appd", api);

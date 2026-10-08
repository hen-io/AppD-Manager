"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "state",
  "save",
  "saveExtensionDefaults",
  "setUnsaved",
  "remove",
  "launch",
  "close",
  "restart",
  "duplicate",
  "clearData",
  "exportApps",
  "importApps",
  "setAppearance",
  "askUnsaved",
  "runningApps",
  "pickIcon",
  "fetchIcons",
  "pickAppsDir",
  "resetAppsDir",
  "openAppsDir",
  "showConfig",
  "showLog",
  "importExtension",
  "removeExtension",
  "openAuthorLink",
  "openProjectPage",
  "exit",
  "openReleasePage",
  "checkUpdate",
  "askUpdate",
  "installUpdate"
]) {
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
}
contextBridge.exposeInMainWorld("appd", api);

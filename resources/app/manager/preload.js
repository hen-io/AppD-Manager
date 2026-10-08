"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "state",
  "save",
  "saveExtensionDefaults",
  "setUnsaved",
  "remove",
  "undoRemove",
  "launch",
  "close",
  "restart",
  "duplicate",
  "clearData",
  "exportApps",
  "importApps",
  "setAppearance",
  "setPrefs",
  "askUnsaved",
  "runningApps",
  "usage",
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
  "releases",
  "openBackups",
  "askUpdate",
  "installUpdate"
]) {
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
}
contextBridge.exposeInMainWorld("appd", api);

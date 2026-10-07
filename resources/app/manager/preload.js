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
  "runningApps",
  "pickIcon",
  "fetchIcons",
  "pickAppsDir",
  "resetAppsDir",
  "openAppsDir",
  "showConfig",
  "pickExtension",
  "describeExtensions",
  "openAuthorLink",
  "openReleasePage",
  "checkUpdate",
  "askUpdate",
  "installUpdate"
]) {
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
}
contextBridge.exposeInMainWorld("appd", api);

"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("appdTabs", {
  ready: () => ipcRenderer.send("appd-tabs-ready"),
  select: (index) => ipcRenderer.send("appd-tabs-select", Number(index)),
  menu: (index) => ipcRenderer.send("appd-tabs-menu", Number(index)),
  close: (index) => ipcRenderer.send("appd-tabs-close", Number(index)),
  hover: (on) => ipcRenderer.send("appd-tabs-hover", Boolean(on)),
  onState: (show) => ipcRenderer.on("appd-tabs-state", (_event, state) => show(state))
});

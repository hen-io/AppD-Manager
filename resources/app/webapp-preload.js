"use strict";
const { ipcRenderer } = require("electron");
const CORNERS = {
  "top-left": "top:12px;left:12px",
  "top-right": "top:12px;right:12px",
  "bottom-left": "bottom:12px;left:12px",
  "bottom-right": "bottom:12px;right:12px"
};
function addButton(corner2) {
  if (window.top !== window || !document.documentElement || document.getElementById("appd-action-button")) return;
  const host = document.createElement("div");
  host.id = "appd-action-button";
  host.style.cssText = `all:initial;position:fixed;${CORNERS[corner2]};z-index:2147483647`;
  const button = document.createElement("button");
  button.textContent = "⋯";
  button.title = "App menu";
  button.style.cssText = "all:initial;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;font:700 20px/1 system-ui,sans-serif;background:rgba(35,38,41,.9);color:#fff;border:1px solid rgba(255,255,255,.3);box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;opacity:.45";
  button.addEventListener("mouseenter", () => {
    button.style.opacity = "1";
  });
  button.addEventListener("mouseleave", () => {
    button.style.opacity = ".45";
  });
  button.addEventListener("click", () => ipcRenderer.send("appd-action-menu"));
  host.attachShadow({ mode: "closed" }).append(button);
  document.documentElement.append(host);
}
const corner = ipcRenderer.sendSync("appd-action-button");
if (CORNERS[corner]) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => addButton(corner));
  else addButton(corner);
}

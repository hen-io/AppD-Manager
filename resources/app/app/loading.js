"use strict";
const { WebContentsView, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const coverWindow = require("./overlay");
module.exports = function showLoadingScreen(window, cfg, iconFile, { plain = false, frameCss = "" } = {}) {
  const dark = cfg.colorScheme === "dark" || cfg.colorScheme !== "light" && nativeTheme.shouldUseDarkColors || cfg.extensions.includes("darkreader");
  const background = dark ? "#15171b" : "#f4f5f8";
  const text = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const types = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
  let logo = `<div class="logo letter">${text((cfg.name.trim()[0] || "?").toUpperCase())}</div>`;
  try {
    const type = !plain && iconFile && types[path.extname(iconFile).toLowerCase()];
    if (type) logo = `<img class="logo" alt="" src="data:${type};base64,${fs.readFileSync(iconFile).toString("base64")}">`;
  } catch {
  }
  const box = plain ? "" : `<div class="box">${logo}<div class="name">${text(cfg.name)}</div><div class="track"><div class="bar"></div></div></div>`;
  const page = `<!doctype html><meta charset="utf-8"><style>
    html, body { height: 100%; margin: 0; background: transparent; }
    body { display: grid; place-items: center; background: ${background}; color: ${dark ? "#e8eaf0" : "#22252b"};
      font: 500 15px system-ui, sans-serif; transition: opacity ${plain ? ".12s" : ".3s"} ease; user-select: none; }
    body.out { opacity: 0; }
    .box { display: grid; justify-items: center; gap: 22px; animation: in .45s ease both; }
    .logo { width: 96px; height: 96px; object-fit: contain; border-radius: 22px; filter: drop-shadow(0 10px 22px rgba(0, 0, 0, .28)); animation: float 2.4s ease-in-out infinite; }
    .letter { display: grid; place-items: center; background: linear-gradient(135deg, #5b8cff, #8a5bff); color: #fff; font-size: 44px; font-weight: 700; }
    .name { max-width: 80vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .02em; opacity: .85; }
    .track { width: 220px; height: 4px; border-radius: 4px; background: ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}; overflow: hidden; }
    .bar { width: 40%; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #5b8cff, #8a5bff); animation: slide 1.25s cubic-bezier(.65, 0, .35, 1) infinite; }
    @keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .logo, .box { animation: none; } }
    ${frameCss}
  </style><body>${box}`;
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  view.setBackgroundColor(background);
  window.contentView.addChildView(view);
  const stopCovering = coverWindow(window, view);
  view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(page));
  const shown = Date.now();
  const fade = plain ? 140 : 320;
  let gone = false;
  const remove = () => {
    if (gone) return;
    gone = true;
    clearTimeout(tooLong);
    setTimeout(() => {
      if (window.isDestroyed()) return;
      view.setBackgroundColor("#00000000");
      view.webContents.executeJavaScript('document.body.classList.add("out")').catch(() => {
      });
      setTimeout(() => {
        if (window.isDestroyed()) return;
        stopCovering();
        window.contentView.removeChildView(view);
        view.webContents.close();
      }, fade);
    }, plain ? 0 : Math.max(0, 500 - (Date.now() - shown)));
  };
  const tooLong = setTimeout(remove, 2e4);
  window.webContents.once("did-stop-loading", remove);
  if (plain) window.once("ready-to-show", () => setTimeout(remove, 60));
};

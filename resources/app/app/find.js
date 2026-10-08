"use strict";
const { WebContentsView, ipcMain, nativeTheme } = require("electron");
const path = require("path");
const WIDTH = 372;
const HEIGHT = 52;
const MARGIN = 12;
const bars = /* @__PURE__ */ new WeakMap();
const owners = /* @__PURE__ */ new WeakMap();
function page(dark) {
  const ink = dark ? "#e8eaf0" : "#22252b";
  const pane = dark ? "#262a31" : "#ffffff";
  const faint = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
  return `<!doctype html><meta charset="utf-8"><style>
    html, body { height: 100%; margin: 0; overflow: hidden; background: ${pane}; color: ${ink}; font: 14px system-ui, sans-serif; }
    body { display: flex; align-items: center; gap: 4px; box-sizing: border-box; padding: 0 8px 0 14px; border: 1px solid ${faint}; border-radius: 14px; }
    input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: inherit; font: inherit; }
    input::placeholder { color: inherit; opacity: .5; }
    #count { flex: none; min-width: 52px; text-align: right; font-size: 12px; opacity: .7; font-variant-numeric: tabular-nums; }
    #count.none { color: #e5484d; opacity: 1; }
    button { flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: none; color: inherit; cursor: pointer; }
    button:hover { background: ${faint}; }
    svg { width: 18px; height: 18px; fill: currentColor; vertical-align: middle; }
  </style><body>
    <input id="text" placeholder="Find in page" spellcheck="false" autofocus>
    <span id="count"></span>
    <button id="up" title="Previous (Shift+Enter)"><svg viewBox="0 0 24 24"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"/></svg></button>
    <button id="down" title="Next (Enter)"><svg viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg></button>
    <button id="close" title="Close (Escape)"><svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>
  <script>
    const text = document.getElementById('text');
    const count = document.getElementById('count');
    const look = (forward, next) => appdFind.look(text.value, forward, next);
    text.addEventListener('input', () => look(true, false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') appdFind.close();
      else if (event.key === 'Enter' || event.key === 'F3') look(!event.shiftKey, true);
      else if (event.key.toLowerCase() === 'g' && event.ctrlKey) look(!event.shiftKey, true);
      else return;
      event.preventDefault();
    });
    document.getElementById('up').addEventListener('click', () => look(false, true));
    document.getElementById('down').addEventListener('click', () => look(true, true));
    document.getElementById('close').addEventListener('click', () => appdFind.close());
    appdFind.onCount((at, of) => {
      count.textContent = text.value ? at + ' of ' + of : '';
      count.classList.toggle('none', Boolean(text.value) && !of);
    });
    window.takeFocus = () => { text.focus(); text.select(); };
  <\/script>`;
}
function place(window, view) {
  if (window.isDestroyed()) return;
  const { width } = window.contentView.getBounds();
  const wide = Math.min(WIDTH, Math.max(160, width - 2 * MARGIN));
  view.setBounds({ x: Math.max(MARGIN, width - wide - MARGIN), y: MARGIN, width: wide, height: HEIGHT });
}
function closeFind(window) {
  const bar = bars.get(window);
  if (!bar) return;
  bars.delete(window);
  window.removeListener("resize", bar.fit);
  if (window.isDestroyed()) return;
  window.webContents.removeListener("found-in-page", bar.found);
  window.webContents.stopFindInPage("clearSelection");
  window.contentView.removeChildView(bar.view);
  bar.view.webContents.close();
  window.webContents.focus();
}
function openFind(window) {
  const open = bars.get(window);
  if (open) {
    open.view.webContents.focus();
    open.view.webContents.executeJavaScript("takeFocus()").catch(() => {
    });
    return;
  }
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "find-preload.js") }
  });
  owners.set(view.webContents, window);
  view.setBackgroundColor("#00000000");
  view.setBorderRadius?.(14);
  const bar = {
    view,
    fit: () => place(window, view),
    found: (_event, result) => {
      if (result.finalUpdate && !view.webContents.isDestroyed()) view.webContents.send("appd-find-count", result.activeMatchOrdinal, result.matches);
    }
  };
  bars.set(window, bar);
  window.contentView.addChildView(view);
  bar.fit();
  window.on("resize", bar.fit);
  window.webContents.on("found-in-page", bar.found);
  view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page(nativeTheme.shouldUseDarkColors))}`).then(() => view.webContents.focus()).catch(() => {
  });
}
function findAgain(window, forward) {
  const bar = bars.get(window);
  if (bar) bar.view.webContents.send("appd-find-again", forward);
  return Boolean(bar);
}
const windowOf = (sender) => {
  const window = owners.get(sender);
  return window && !window.isDestroyed() && bars.get(window)?.view.webContents === sender ? window : null;
};
ipcMain.on("appd-find", (event, text, forward, next) => {
  const window = windowOf(event.sender);
  if (!window) return;
  const wanted = String(text ?? "");
  if (!wanted) {
    window.webContents.stopFindInPage("clearSelection");
    event.sender.send("appd-find-count", 0, 0);
  } else {
    window.webContents.findInPage(wanted, { forward: Boolean(forward), findNext: !next });
  }
});
ipcMain.on("appd-find-close", (event) => {
  const window = windowOf(event.sender);
  if (window) closeFind(window);
});
module.exports = { openFind, closeFind, findAgain, isBar: (contents) => owners.has(contents) };

"use strict";
const { BrowserWindow, Notification, WebContentsView } = require("electron");
const { playSound } = require("../shared/sounds");
const WORLD = 1009;
const ANSWER_MS = 4e3;
function probe(cfg) {
  const source = cfg.alertMatch === "text" ? '(document.body ? document.body.innerText : "")' : '(document.documentElement ? document.documentElement.outerHTML : "")';
  const wanted = JSON.stringify(cfg.alertText);
  if (cfg.alertRegex) return `new RegExp(${wanted}, ${JSON.stringify(cfg.alertCase ? "" : "i")}).test(${source})`;
  return cfg.alertCase ? `${source}.includes(${wanted})` : `${source}.toLowerCase().includes(${wanted}.toLowerCase())`;
}
module.exports = function startAlerts({ cfg, pages, note, icon, show, inUse }) {
  if (!String(cfg.alertText || "").trim()) return;
  const code = probe(cfg);
  let player = null;
  function sound() {
    if (cfg.alertSound === "off") return;
    if (!player) {
      player = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required" } });
      const page = `<script>const playSound = ${playSound.toString()}; const ctx = new AudioContext(); window.play = (name, volume) => { ctx.resume(); playSound(ctx, name, volume); };<\/script>`;
      player.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`).catch(() => {
      });
    }
    const play = () => player.webContents.executeJavaScript(`play(${JSON.stringify(cfg.alertSound)}, ${Number(cfg.alertVolume)})`).catch(() => {
    });
    if (player.webContents.isLoading()) player.webContents.once("did-finish-load", play);
    else play();
  }
  const given = [];
  const allowed = () => {
    const since = Date.now() - cfg.alertPerSeconds * 1e3;
    while (given.length && given[0] < since) given.shift();
    return given.length < cfg.alertMaxCount;
  };
  const shown = /* @__PURE__ */ new Map();
  function alert(page, name, first) {
    if (!cfg.alertWhileInUse && inUse()) return shown.set(page, Date.now());
    if (!allowed()) return;
    given.push(Date.now());
    shown.set(page, Date.now());
    note(`alert: "${cfg.alertText.slice(0, 40)}" found${name ? ` in ${name}` : ""}`);
    sound();
    if (cfg.alertNotify && Notification.isSupported()) {
      const body = cfg.alertMessage || `"${cfg.alertText.slice(0, 80)}"`;
      const notice = new Notification({ title: name && name !== cfg.name ? `${cfg.name} · ${name}` : cfg.name, body, icon, silent: true });
      notice.on("click", () => show(page));
      notice.show();
    }
    if (first && cfg.alertFocus) show(page);
  }
  async function look() {
    for (const { page, name } of pages()) {
      if (!page || page.isDestroyed()) continue;
      const has = await Promise.race([
        page.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]).catch(() => null),
        new Promise((done) => setTimeout(() => done(null), ANSWER_MS))
      ]);
      if (has === null) continue;
      if (!has) shown.delete(page);
      else if (!shown.has(page)) alert(page, name, true);
      else if (cfg.alertRepeatSeconds > 0 && Date.now() - shown.get(page) >= cfg.alertRepeatSeconds * 1e3) alert(page, name, false);
    }
  }
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    await look().catch(() => {
    });
    busy = false;
  }, cfg.alertCheckSeconds * 1e3).unref();
  note(`alerts on: looking for "${cfg.alertText.slice(0, 40)}" every ${cfg.alertCheckSeconds} s`);
};
module.exports.inUse = () => Boolean(BrowserWindow.getFocusedWindow());

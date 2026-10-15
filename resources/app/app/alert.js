"use strict";
const fs = require("fs");
const { BrowserWindow, Notification, WebContentsView } = require("electron");
const { playSound } = require("../shared/sounds");
const ANSWER_MS = 4e3;
const IDLE_MS = 5e3;
function probe(cfg) {
  const html = cfg.alertMatch !== "text";
  const wanted = JSON.stringify(cfg.alertText);
  const test = cfg.alertRegex ? `new RegExp(${wanted}, ${JSON.stringify(cfg.alertCase ? "" : "i")}).test(source)` : cfg.alertCase ? `source.includes(${wanted})` : `source.toLowerCase().includes(${wanted}.toLowerCase())`;
  return `(() => {
    if (!document.documentElement) return false;
    const parts = [${html ? "document.documentElement.outerHTML" : '(document.body ? document.body.innerText : "")'}];
    const text = (root) => {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (/^(SCRIPT|STYLE|TEMPLATE)$/.test(node.parentNode?.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let out = '';
      while (walk.nextNode()) out += walk.currentNode.nodeValue + ' ';
      return out;
    };
    const visit = (root) => {
      for (const element of root.querySelectorAll('*')) {
        if (!element.shadowRoot) continue;
        parts.push(${html ? "element.shadowRoot.innerHTML" : "text(element.shadowRoot)"});
        visit(element.shadowRoot);
      }
    };
    visit(document);
    const source = parts.join('\\n');
    return ${test};
  })()`;
}
module.exports = function startAlerts({ cfg: started, load, configFile, pages, note, icon, show, inUse }) {
  let cfg = started;
  let code = "";
  let stamp = 0;
  const settle = (next) => {
    const was = `${cfg.alertText}|${cfg.alertMatch}|${cfg.alertCase}|${cfg.alertRegex}`;
    cfg = next;
    code = String(cfg.alertText || "").trim() ? probe(cfg) : "";
    if (`${cfg.alertText}|${cfg.alertMatch}|${cfg.alertCase}|${cfg.alertRegex}` !== was) shown.clear();
    note(code ? `alerts on: looking for "${cfg.alertText.slice(0, 40)}" every ${cfg.alertCheckSeconds} s` : "alerts off");
  };
  const reread = () => {
    try {
      const now = fs.statSync(configFile).mtimeMs;
      if (now === stamp) return;
      const first = !stamp;
      stamp = now;
      if (!first) settle(load());
    } catch {
    }
  };
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
  async function has(page) {
    let answered = false;
    for (const frame of page.mainFrame.framesInSubtree) {
      if (frame.isDestroyed?.()) continue;
      const found = await Promise.race([
        frame.executeJavaScript(code).catch(() => null),
        new Promise((done) => setTimeout(() => done(null), ANSWER_MS))
      ]);
      if (found === true) return true;
      if (found === false) answered = true;
    }
    return answered ? false : null;
  }
  async function look() {
    for (const { page, name } of pages()) {
      if (!page || page.isDestroyed()) continue;
      const found = await has(page);
      if (found === null) continue;
      if (!found) shown.delete(page);
      else if (!shown.has(page)) alert(page, name, true);
      else if (cfg.alertRepeatSeconds > 0 && Date.now() - shown.get(page) >= cfg.alertRepeatSeconds * 1e3) alert(page, name, false);
    }
  }
  const round = async () => {
    reread();
    if (code) await look().catch(() => {
    });
    setTimeout(round, code ? cfg.alertCheckSeconds * 1e3 : IDLE_MS).unref?.();
  };
  settle(cfg);
  reread();
  setTimeout(round, 2e3);
};
module.exports.inUse = () => Boolean(BrowserWindow.getFocusedWindow());

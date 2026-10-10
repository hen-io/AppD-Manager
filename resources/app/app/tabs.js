"use strict";
const { View, WebContentsView, app, ipcMain, clipboard, nativeTheme, net } = require("electron");
const fs = require("fs");
const path = require("path");
const barPage = require("./tabbar");
const { paletteVars } = require("../shared/palettes");
const { text } = require("../shared/text");
const t = text.app.tab;
const BAR = { top: 48, bottom: 48, left: 208, leftSmall: 64 };
const UNREAD = /[([](\d{1,5})\+?[)\]]/;
const RETRY_MS = 15e3;
const PICTURES = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon" };
module.exports = function createTabs({ win, cfg, lib, pagePreferences, background, note, startTab = 0, saveTab, onPage, throttle, menu, openExternal }) {
  const container = new View();
  win.contentView.addChildView(container);
  const unloadable = process.platform !== "win32" || cfg.tabInactive !== "pause";
  const mode = unloadable ? cfg.tabInactive : "throttle";
  const bar = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "tabbar-preload.js") }
  });
  bar.setBackgroundColor("#00000000");
  const chrome = new WeakSet([bar.webContents]);
  container.addChildView(bar);
  const tabs = cfg.tabs.map((one, index) => ({
    index,
    cfg: one,
    view: null,
    title: "",
    favicon: "",
    badge: 0,
    audible: false,
    loading: false,
    paused: false,
    pids: [],
    timer: null,
    unloading: false
  }));
  let active = startTab < 0 ? -1 : Math.min(startTab, tabs.length - 1);
  let welcome = null;
  let size = { width: 0, height: 0 };
  let ready = false;
  let finished = false;
  const scale = cfg.tabBarSize / 100;
  const barSize = Math.round((cfg.tabBarPosition === "left" && !cfg.tabShowNames ? BAR.leftSmall : BAR[cfg.tabBarPosition] ?? BAR.top) * scale);
  const autoHide = cfg.tabBarAutoHide;
  let peek = autoHide && active >= 0;
  let peekTimer = null;
  const inset = autoHide ? { top: 0, bottom: 0, left: 0 } : {
    top: cfg.tabBarPosition === "top" ? barSize : 0,
    bottom: cfg.tabBarPosition === "bottom" ? barSize : 0,
    left: cfg.tabBarPosition === "left" ? barSize : 0
  };
  const pageRect = () => ({
    x: inset.left,
    y: inset.top,
    width: Math.max(1, size.width - inset.left),
    height: Math.max(1, size.height - inset.top - inset.bottom)
  });
  const HANDLE = { thick: 8 };
  const barRect = () => {
    if (peek) {
      if (cfg.tabBarPosition === "left") return { x: 0, y: 0, width: HANDLE.thick, height: Math.max(1, size.height) };
      return { x: 0, y: cfg.tabBarPosition === "bottom" ? Math.max(0, size.height - HANDLE.thick) : 0, width: Math.max(1, size.width), height: HANDLE.thick };
    }
    if (cfg.tabBarPosition === "left") return { x: 0, y: 0, width: barSize, height: Math.max(1, size.height) };
    return { x: 0, y: cfg.tabBarPosition === "bottom" ? Math.max(0, size.height - barSize) : 0, width: Math.max(1, size.width), height: barSize };
  };
  function setPeek(on) {
    if (!autoHide || peek === on) return;
    peek = on;
    if (!on) container.addChildView(bar);
    layout();
    push();
  }
  function hover(on) {
    clearTimeout(peekTimer);
    if (on) setPeek(false);
    else if (active >= 0) peekTimer = setTimeout(() => setPeek(true), 500);
  }
  function layout(area) {
    if (area) size = { width: area.width, height: area.height };
    bar.setBounds(barRect());
    const page = pageRect();
    for (const tab of tabs) tab.view?.setBounds(page);
    welcome?.setBounds(page);
  }
  let pushTimer = null;
  function push() {
    if (pushTimer || !ready) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      if (bar.webContents.isDestroyed()) return;
      bar.webContents.send("appd-tabs-state", {
        active,
        peek,
        tabs: tabs.map((tab) => ({
          name: tab.cfg.name,
          favicon: cfg.tabShowIcons ? tab.favicon : "",
          icon: cfg.tabShowIcons ? iconOf(tab.cfg.icon) || appIcon : null,
          display: tab.cfg.display || "",
          badge: tab.badge,
          audible: tab.audible,
          state: tab.paused ? "paused" : !tab.view ? "unloaded" : tab.loading ? "loading" : "live"
        }))
      });
    }, 30);
  }
  const pictures = /* @__PURE__ */ new Map();
  const mdiFile = path.join(lib.appDir(process.env.APPD_ID), "mdi-icons.json");
  let mdi = {};
  try {
    mdi = JSON.parse(fs.readFileSync(mdiFile, "utf8"));
  } catch {
  }
  const fetching = /* @__PURE__ */ new Set();
  function fetchMdi(name) {
    if (fetching.has(name)) return;
    fetching.add(name);
    net.fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`).then((res) => res.ok ? res.text() : "").then((svg) => {
      const outline = /\sd="([^"]+)"/.exec(svg)?.[1];
      if (!outline) return note(`the icon "mdi:${name}" was not found`);
      mdi[name] = outline;
      pictures.delete(`mdi:${name}`);
      try {
        fs.writeFileSync(mdiFile, JSON.stringify(mdi));
      } catch {
      }
      push();
    }).catch(() => {
    }).finally(() => fetching.delete(name));
  }
  function iconOf(value) {
    if (!value) return null;
    const named = /^mdi[:-]([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(value);
    if (named) {
      const name = named[1].toLowerCase();
      if (!mdi[name]) fetchMdi(name);
      return mdi[name] ? { kind: "mdi", value: mdi[name] } : null;
    }
    if (pictures.has(value)) return pictures.get(value);
    let found = null;
    if (/^(https?:\/\/|data:image\/)/i.test(value)) found = { kind: "image", value };
    else if (/[\\/]|\.(png|svg|jpe?g|webp|gif|ico)$/i.test(value)) {
      try {
        const type = PICTURES[path.extname(value).toLowerCase()];
        const file = path.resolve(lib.appDir(process.env.APPD_ID), value);
        if (type) found = { kind: "image", value: `data:${type};base64,${fs.readFileSync(file).toString("base64")}` };
      } catch {
      }
    } else found = { kind: "text", value: [...value].slice(0, 4).join("") };
    pictures.set(value, found);
    return found;
  }
  const owns = (event) => event.sender === bar.webContents;
  ipcMain.on("appd-tabs-ready", (event) => {
    if (!owns(event)) return;
    ready = true;
    push();
  });
  ipcMain.on("appd-tabs-select", (event, index) => owns(event) && select(Number(index)));
  ipcMain.on("appd-tabs-close", (event, index) => owns(event) && closeTab(Number(index)));
  ipcMain.on("appd-tabs-hover", (event, on) => owns(event) && hover(Boolean(on)));
  ipcMain.on("appd-tabs-menu", (event, index) => owns(event) && tabMenu(Number(index)));
  const appIcon = iconOf(lib.iconFile(process.env.APPD_ID, cfg) || "");
  const logo = iconOf(path.join(__dirname, "..", "manager", "icon.png"))?.value || "";
  const managed = cfg.tabTheme === "manager";
  const manager = lib.appearance();
  const look = { ...manager, mode: managed ? manager.mode : cfg.tabTheme };
  const hues = paletteVars(look.palette, look.custom);
  const isDark = () => look.mode === "dark" || look.mode === "system" && nativeTheme.shouldUseDarkColors;
  const loadBar = () => {
    ready = false;
    bar.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(barPage({
      dark: isDark(),
      hues,
      basic: !managed,
      logo,
      position: cfg.tabBarPosition,
      icons: cfg.tabShowIcons,
      badges: cfg.tabShowBadges,
      names: cfg.tabShowNames,
      collapse: cfg.tabCollapseUnloaded,
      scale
    }))}`).catch(() => {
    });
  };
  loadBar();
  if (look.mode === "system") nativeTheme.on("updated", () => !bar.webContents.isDestroyed() && loadBar());
  const signal = (pids, name) => {
    for (const pid of pids) {
      try {
        process.kill(pid, name);
      } catch {
      }
    }
  };
  const pidsOf = (contents) => [...new Set(contents.mainFrame.framesInSubtree.map((frame) => frame.osProcessId))].filter((pid) => pid > 0);
  function wire(tab) {
    const contents = tab.view.webContents;
    contents.on("page-title-updated", (event, title, explicit) => {
      tab.title = title;
      const found = UNREAD.exec(title);
      tab.badge = found ? Number(found[1]) : 0;
      push();
      if (tab.index !== active) return;
      win.emit("page-title-updated", event, title, explicit);
      if (!event.defaultPrevented && !win.isDestroyed()) win.setTitle(title);
    });
    contents.on("page-favicon-updated", (_event, favicons) => {
      tab.favicon = favicons.find((one) => /^https?:|^data:image\//i.test(one)) || "";
      push();
    });
    contents.on("did-start-loading", () => {
      tab.loading = true;
      push();
    });
    contents.on("did-stop-loading", () => {
      tab.loading = false;
      push();
    });
    contents.on("audio-state-changed", () => {
      tab.audible = contents.isCurrentlyAudible();
      push();
    });
    contents.once("destroyed", () => {
      clearTimeout(tab.timer);
      try {
        container.removeChildView(tab.view);
      } catch {
      }
      tab.view = null;
      tab.audible = false;
      tab.loading = false;
      tab.unloading = false;
      push();
      if (tab.index === active && !finished && !tab.leaving) {
        setTimeout(() => {
          if (!win.isDestroyed() && !finished && !tabs[active].view) select(active);
        }, 300);
      }
    });
  }
  function ensure(tab, url = tab.cfg.url) {
    if (tab.view) return tab.view;
    const view = new WebContentsView({ webPreferences: pagePreferences });
    view.setBackgroundColor(background);
    view.setVisible(false);
    view.setBounds(pageRect());
    container.addChildView(view);
    tab.view = view;
    wire(tab);
    onPage(view.webContents, tab);
    view.webContents.loadURL(url).catch(() => {
    });
    if (tab.index !== active) startIdle(tab);
    push();
    return view;
  }
  function setThrottled(tab, on) {
    try {
      tab.view?.webContents.setBackgroundThrottling(on ? true : cfg.backgroundThrottling);
    } catch {
    }
  }
  function startIdle(tab) {
    clearTimeout(tab.timer);
    if (!tab.view || tab.paused) return;
    if (mode === "keep" || tab.cfg.keepAlive) return setThrottled(tab, false);
    setThrottled(tab, true);
    if (mode === "pause" || mode === "unload") tab.timer = setTimeout(() => settle(tab), cfg.tabInactiveAfterSeconds * 1e3);
  }
  function settle(tab) {
    if (!tab.view || tab.index === active || tab.paused || win.isDestroyed()) return;
    const contents = tab.view.webContents;
    if (tab.audible || tab.loading || contents.isCurrentlyAudible() || contents.isDevToolsOpened()) {
      tab.timer = setTimeout(() => settle(tab), RETRY_MS);
      return;
    }
    if (mode === "unload") return unload(tab);
    const pids = pidsOf(contents);
    const others = new Set(tabs.filter((other) => other !== tab && other.view && !other.paused).flatMap((other) => pidsOf(other.view.webContents)));
    for (const frame of win.webContents.mainFrame.framesInSubtree) others.add(frame.osProcessId);
    if (!pids.length || pids.some((pid) => others.has(pid))) {
      note(`tab "${tab.cfg.name}" shares a process with another tab: slowed down, not paused`);
      return;
    }
    tab.pids = pids;
    throttle.hold(pids);
    signal(pids, "SIGSTOP");
    tab.paused = true;
    note(`tab "${tab.cfg.name}" paused`);
    push();
  }
  function resume(tab) {
    if (!tab.paused) return;
    throttle.unhold(tab.pids);
    signal(tab.pids, "SIGCONT");
    tab.pids = [];
    tab.paused = false;
    note(`tab "${tab.cfg.name}" goes on`);
    push();
  }
  function unload(tab) {
    if (!tab.view || tab.index === active) return;
    resume(tab);
    tab.unloading = true;
    note(`tab "${tab.cfg.name}" unloaded`);
    tab.view.webContents.close({ waitForBeforeUnload: true });
  }
  function closeTab(index) {
    const tab = tabs[index];
    if (!tab?.view) return;
    if (tab.index !== active) return unload(tab);
    tab.leaving = true;
    setTimeout(() => {
      tab.leaving = false;
    }, 12e4);
    const contents = tab.view.webContents;
    contents.once("destroyed", () => {
      if (!tab.leaving || finished || win.isDestroyed()) return;
      tab.leaving = false;
      active = -1;
      showWelcome();
      setPeek(false);
      push();
    });
    resume(tab);
    note(`tab "${tab.cfg.name}" closed`);
    contents.close({ waitForBeforeUnload: true });
  }
  function select(index, { focus = true } = {}) {
    if (!(index >= 0 && index < tabs.length) || win.isDestroyed()) return;
    const previous = tabs[active];
    const next = tabs[index];
    clearTimeout(next.timer);
    resume(next);
    const changed = previous !== next;
    active = index;
    ensure(next);
    if (welcome) closeWelcome();
    if (changed && previous?.view) {
      previous.view.setVisible(false);
      startIdle(previous);
    }
    setThrottled(next, false);
    next.view.setVisible(true);
    if (focus) next.view.webContents.focus();
    saveTab(index);
    if (autoHide) setPeek(true);
    if (next.title) {
      const event = { defaultPrevented: false, preventDefault() {
        this.defaultPrevented = true;
      } };
      win.emit("page-title-updated", event, next.title, true);
      if (!event.defaultPrevented) win.setTitle(next.title);
    }
    push();
  }
  function tabMenu(index) {
    const tab = tabs[index];
    if (!tab) return;
    const items = [
      ...tab.view ? [{ label: t.reload, click: () => tab.view?.webContents.reload() }] : [{ label: t.load, click: () => ensure(tab) }],
      ...tab.view ? [{ label: t.close, click: () => closeTab(index) }] : [],
      ...tab.view && tab.index !== active && process.platform !== "win32" ? [{ label: tab.paused ? t.resume : t.pause, click: () => tab.paused ? resume(tab) : settleNow(tab) }] : [],
      { type: "separator" },
      { label: t.copy, click: () => clipboard.writeText(tab.view?.webContents.getURL() || tab.cfg.url) },
      { label: t.browser, click: () => openExternal(tab.view?.webContents.getURL() || tab.cfg.url) }
    ];
    menu(items, bar.webContents);
  }
  function settleNow(tab) {
    const before = mode;
    if (before === "unload") return;
    settle(tab);
  }
  function shortcut(input) {
    if (!input.control || input.alt || input.meta) return false;
    const key = input.key.toLowerCase();
    if (key === "tab" && !input.shift || key === "pagedown") select((active + 1) % tabs.length);
    else if (key === "tab" && input.shift || key === "pageup") select((Math.max(active, 0) - 1 + tabs.length) % tabs.length);
    else if (/^[1-9]$/.test(key) && !input.shift) select(key === "9" ? tabs.length - 1 : Math.min(Number(key) - 1, tabs.length - 1));
    else return false;
    return true;
  }
  function open(url) {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }
    const found = tabs.find((tab) => URL.canParse(tab.cfg.url) && new URL(tab.cfg.url).hostname === host) ?? tabs[Math.max(0, active)];
    select(found.index);
    found.view?.webContents.loadURL(url).catch(() => {
    });
  }
  function start({ url } = {}) {
    if (url) open(url);
    else if (active >= 0) select(active, { focus: false });
    else showWelcome();
    if (!cfg.tabLazyLoad && active >= 0) for (const tab of tabs) ensure(tab);
  }
  function showWelcome() {
    const tint = `${hues["--hue-s"]}`;
    const [paper, ink] = !managed ? isDark() ? ["#202124", "#e8eaed"] : ["#f1f3f4", "#202124"] : isDark() ? [`oklch(14.5% calc(0.03 * ${hues["--vivid"]}) ${tint})`, `oklch(95.5% calc(0.012 * ${hues["--vivid"]}) ${tint})`] : [`oklch(98.2% calc(0.016 * ${hues["--vivid"]}) ${tint})`, `oklch(14% calc(0.025 * ${hues["--vivid"]}) ${tint})`];
    const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const page = `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="${isDark() ? "dark" : "light"}">
      <body style="margin:0;height:100vh;display:grid;place-items:center;background:${paper};color:${ink};font:500 18px system-ui,sans-serif;text-align:center;user-select:none">
      <div>${logo ? `<img src="${logo}" width="72" height="72" style="border-radius:16px;margin-bottom:18px"><br>` : ""}${escape(cfg.name)}
      <div style="margin-top:8px;font:400 15px system-ui,sans-serif;opacity:.65">${escape(t.choose)}</div></div>`;
    welcome = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    chrome.add(welcome.webContents);
    welcome.setBackgroundColor(background);
    container.addChildView(welcome);
    welcome.setBounds(pageRect());
    welcome.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`).catch(() => {
    });
  }
  function closeWelcome() {
    const view = welcome;
    welcome = null;
    try {
      container.removeChildView(view);
      view.webContents.close();
    } catch {
    }
  }
  let closing = false;
  function closeAll(done) {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
    }, 2e3);
    const live = tabs.filter((tab) => tab.view && !tab.view.webContents.isDestroyed());
    for (const tab of tabs) resume(tab);
    if (!live.length) {
      finished = true;
      return setImmediate(done);
    }
    let left = live.length;
    for (const tab of live) {
      tab.view.webContents.once("destroyed", () => {
        if (--left > 0) return;
        finished = true;
        done();
      });
      tab.view.webContents.close({ waitForBeforeUnload: true });
    }
  }
  const releaseAll = () => {
    for (const tab of tabs) signal(tab.pids, "SIGCONT");
  };
  app.on("before-quit", releaseAll);
  process.on("exit", releaseAll);
  return {
    container,
    inset,
    layout,
    start,
    select,
    open,
    shortcut,
    closeAll,
    summary: () => [...tabs.filter((tab) => tab.view), ...tabs.filter((tab) => !tab.view)].map((tab) => ({ name: tab.cfg.name, loaded: Boolean(tab.view) })),
    isChrome: (contents) => chrome.has(contents),
    current: () => {
      const shown = tabs[active]?.view?.webContents;
      return shown && !shown.isDestroyed() ? shown : bar.webContents;
    },
    index: () => active,
    homeUrl: () => (tabs[active] ?? tabs[0]).cfg.url,
    hosts: () => tabs.map((tab) => URL.canParse(tab.cfg.url) ? new URL(tab.cfg.url).hostname : "").filter(Boolean),
    pages: () => tabs.filter((tab) => tab.view && !tab.paused).map((tab) => tab.view.webContents),
    all: () => tabs.filter((tab) => tab.view).map((tab) => tab.view.webContents)
  };
};

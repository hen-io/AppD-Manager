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
const HANDLE = 8;
const SLIDE_MS = 420;
module.exports = function createTabs({ win, cfg, lib, pagePreferences, background, note, startTab = 0, saveTab, onPage, throttle, menu, openExternal }) {
  const mode = process.platform !== "win32" || cfg.tabInactive !== "pause" ? cfg.tabInactive : "throttle";
  const tabs = cfg.tabs.map((one, index) => ({
    index,
    cfg: one,
    view: null,
    pane: null,
    title: "",
    favicon: "",
    badge: 0,
    audible: false,
    loading: false,
    paused: false,
    pids: [],
    timer: null,
    leaving: false
  }));
  const startIndex = startTab < 0 ? -1 : Math.min(startTab, tabs.length - 1);
  const chrome = /* @__PURE__ */ new WeakSet();
  const panes = [];
  let finished = false;
  let closing = false;
  const scale = cfg.tabBarSize / 100;
  const barSize = Math.round((cfg.tabBarPosition === "left" && !cfg.tabShowNames ? BAR.leftSmall : BAR[cfg.tabBarPosition] ?? BAR.top) * scale);
  const autoHide = cfg.tabBarAutoHide;
  const STAY_MS = Math.round(cfg.tabBarHideSeconds * 1e3);
  const inset = autoHide ? { top: 0, bottom: 0, left: 0 } : {
    top: cfg.tabBarPosition === "top" ? barSize : 0,
    bottom: cfg.tabBarPosition === "bottom" ? barSize : 0,
    left: cfg.tabBarPosition === "left" ? barSize : 0
  };
  const isShown = (tab) => Boolean(tab.pane) && tab.pane.tab === tab.index;
  const alive = (pane) => pane.window && !pane.window.isDestroyed();
  const focused = () => panes.find((pane) => alive(pane) && pane.window.isFocused()) ?? main;
  const pageRect = (pane) => ({
    x: inset.left,
    y: inset.top,
    width: Math.max(1, pane.size.width - inset.left),
    height: Math.max(1, pane.size.height - inset.top - inset.bottom)
  });
  const barRect = ({ size, narrow }) => {
    const left = cfg.tabBarPosition === "left";
    if (narrow) return left ? { x: 0, y: 0, width: HANDLE, height: Math.max(1, size.height) } : { x: 0, y: cfg.tabBarPosition === "bottom" ? Math.max(0, size.height - HANDLE) : 0, width: Math.max(1, size.width), height: HANDLE };
    return left ? { x: 0, y: 0, width: barSize, height: Math.max(1, size.height) } : { x: 0, y: cfg.tabBarPosition === "bottom" ? Math.max(0, size.height - barSize) : 0, width: Math.max(1, size.width), height: barSize };
  };
  function layout(pane, area) {
    if (area) pane.size = { width: area.width, height: area.height };
    pane.bar.setBounds(barRect(pane));
    const page = pageRect(pane);
    for (const tab of tabs) if (tab.pane === pane) tab.view?.setBounds(page);
    pane.welcome?.setBounds(page);
  }
  function setPeek(pane, on) {
    if (!autoHide || pane.peek === on) return;
    pane.peek = on;
    clearTimeout(pane.narrowTimer);
    if (on) {
      push();
      pane.narrowTimer = setTimeout(() => {
        pane.narrow = true;
        layout(pane);
      }, SLIDE_MS + 60);
    } else {
      pane.narrow = false;
      pane.container.addChildView(pane.bar);
      layout(pane);
      push();
    }
  }
  function hideSoon(pane) {
    clearTimeout(pane.peekTimer);
    if (pane.tab >= 0) pane.peekTimer = setTimeout(() => setPeek(pane, true), STAY_MS);
  }
  function hover(pane, on) {
    pane.over = on;
    clearTimeout(pane.peekTimer);
    if (on) setPeek(pane, false);
    else hideSoon(pane);
  }
  const shown = () => [
    ...tabs.filter((tab) => tab.cfg.home),
    ...tabs.filter((tab) => !tab.cfg.home && tab.view),
    ...tabs.filter((tab) => !tab.cfg.home && !tab.view)
  ];
  let pushTimer = null;
  function push() {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const list = shown().map((tab) => ({
        index: tab.index,
        name: tab.cfg.name,
        favicon: cfg.tabShowIcons ? tab.favicon : "",
        icon: cfg.tabShowIcons ? iconOf(tab.cfg.icon) || appIcon : null,
        display: tab.cfg.display || "",
        badge: tab.badge,
        audible: tab.audible,
        state: tab.paused ? "paused" : !tab.view ? "unloaded" : tab.loading ? "loading" : "live"
      }));
      for (const pane of panes) {
        if (pane.ready && !pane.bar.webContents.isDestroyed()) pane.bar.webContents.send("appd-tabs-state", { active: pane.tab, peek: pane.peek, tabs: list });
      }
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
  const appIcon = iconOf(lib.iconFile(process.env.APPD_ID, cfg) || "");
  const logo = iconOf(path.join(__dirname, "..", "manager", "icon.png"))?.value || "";
  const managed = cfg.tabTheme === "manager";
  const manager = lib.appearance();
  const look = { ...manager, mode: managed ? manager.mode : cfg.tabTheme };
  const hues = paletteVars(look.palette, look.custom);
  const isDark = () => look.mode === "dark" || look.mode === "system" && nativeTheme.shouldUseDarkColors;
  function loadBar(pane) {
    pane.ready = false;
    pane.bar.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(barPage({
      dark: isDark(),
      hues,
      basic: !managed,
      logo,
      position: cfg.tabBarPosition,
      icons: cfg.tabShowIcons,
      badges: cfg.tabShowBadges,
      names: cfg.tabShowNames,
      collapse: cfg.tabCollapseUnloaded,
      scale,
      slide: SLIDE_MS
    }))}`).catch(() => {
    });
  }
  if (look.mode === "system") nativeTheme.on("updated", () => panes.forEach((pane) => pane.bar.webContents.isDestroyed() || loadBar(pane)));
  function makePane(window, isMain) {
    const bar = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "tabbar-preload.js") }
    });
    const pane = {
      window,
      main: isMain,
      container: new View(),
      bar,
      size: { width: 0, height: 0 },
      tab: -1,
      welcome: null,
      ready: false,
      peek: false,
      narrow: false,
      over: false,
      peekTimer: null,
      narrowTimer: null,
      closing: false
    };
    bar.setBackgroundColor("#00000000");
    chrome.add(bar.webContents);
    pane.container.addChildView(bar);
    bar.webContents.on("input-event", (_event, input) => {
      if (autoHide && input.type.startsWith("mouse")) hover(pane, input.type !== "mouseLeave");
    });
    panes.push(pane);
    loadBar(pane);
    return pane;
  }
  const paneOf = (sender) => panes.find((pane) => pane.bar.webContents === sender);
  ipcMain.on("appd-tabs-ready", (event) => {
    const pane = paneOf(event.sender);
    if (!pane) return;
    pane.ready = true;
    push();
  });
  ipcMain.on("appd-tabs-select", (event, index) => paneOf(event.sender) && select(Number(index)));
  ipcMain.on("appd-tabs-close", (event, index) => paneOf(event.sender) && closeTab(Number(index)));
  ipcMain.on("appd-tabs-hover", (event, on) => {
    const pane = paneOf(event.sender);
    if (pane) hover(pane, Boolean(on));
  });
  ipcMain.on("appd-tabs-menu", (event, index) => {
    const pane = paneOf(event.sender);
    if (pane) tabMenu(Number(index), pane);
  });
  const currentOf = (pane) => {
    const page = tabs[pane.tab]?.view?.webContents;
    return page && !page.isDestroyed() ? page : pane.bar.webContents;
  };
  const main = makePane(win, true);
  win.contentView.addChildView(main.container);
  main.peek = autoHide && startIndex >= 0;
  main.narrow = main.peek;
  const signal = (pids, name) => {
    for (const pid of pids) {
      try {
        process.kill(pid, name);
      } catch {
      }
    }
  };
  const pidsOf = (contents) => [...new Set(contents.mainFrame.framesInSubtree.map((frame) => frame.osProcessId))].filter((pid) => pid > 0);
  function title(tab, event = { defaultPrevented: false, preventDefault() {
    this.defaultPrevented = true;
  } }, explicit = true) {
    const pane = tab.pane;
    if (!tab.title || !isShown(tab) || !alive(pane)) return;
    if (pane.main) {
      win.emit("page-title-updated", event, tab.title, explicit);
      if (!event.defaultPrevented) win.setTitle(tab.title);
    } else pane.window.setTitle(cfg.fixedTitle ? cfg.name : tab.title);
  }
  function wire(tab) {
    const contents = tab.view.webContents;
    contents.on("page-title-updated", (event, value, explicit) => {
      tab.title = value;
      const found = UNREAD.exec(value);
      tab.badge = found ? Number(found[1]) : 0;
      push();
      title(tab, event, explicit);
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
      const pane = tab.pane;
      clearTimeout(tab.timer);
      try {
        pane?.container.removeChildView(tab.view);
      } catch {
      }
      tab.view = null;
      tab.pane = null;
      tab.audible = false;
      tab.loading = false;
      push();
      if (pane && pane.tab === tab.index && !finished && !closing && !tab.leaving && !pane.closing) {
        setTimeout(() => {
          if (alive(pane) && !finished && !tab.view) show(pane, tab);
        }, 300);
      }
    });
  }
  function ensure(tab, pane, url = tab.cfg.url) {
    if (tab.view) return tab.view;
    const view = new WebContentsView({ webPreferences: pagePreferences });
    view.setBackgroundColor(background);
    view.setVisible(false);
    view.setBounds(pageRect(pane));
    pane.container.addChildView(view);
    if (autoHide) pane.container.addChildView(pane.bar);
    tab.view = view;
    tab.pane = pane;
    wire(tab);
    onPage(view.webContents, tab);
    view.webContents.loadURL(url).catch(() => {
    });
    if (!isShown(tab)) startIdle(tab);
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
    if (!tab.view || isShown(tab) || tab.paused || win.isDestroyed()) return;
    const contents = tab.view.webContents;
    if (tab.audible || tab.loading || contents.isCurrentlyAudible() || contents.isDevToolsOpened()) {
      tab.timer = setTimeout(() => settle(tab), RETRY_MS);
      return;
    }
    if (mode === "unload") return unload(tab);
    pause(tab);
  }
  function pause(tab) {
    if (!tab.view || isShown(tab) || tab.paused || win.isDestroyed()) return;
    const pids = pidsOf(tab.view.webContents);
    const others = new Set(tabs.filter((other) => other !== tab && other.view && !other.paused).flatMap((other) => pidsOf(other.view.webContents)));
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
    if (!tab?.paused) return;
    throttle.unhold(tab.pids);
    signal(tab.pids, "SIGCONT");
    tab.pids = [];
    tab.paused = false;
    note(`tab "${tab.cfg.name}" goes on`);
    push();
  }
  function unload(tab) {
    if (!tab.view || isShown(tab)) return;
    resume(tab);
    note(`tab "${tab.cfg.name}" unloaded`);
    tab.view.webContents.close({ waitForBeforeUnload: true });
  }
  function closeTab(index) {
    const tab = tabs[index];
    if (!tab?.view) return;
    if (!isShown(tab)) return unload(tab);
    const pane = tab.pane;
    tab.leaving = true;
    setTimeout(() => {
      tab.leaving = false;
    }, 12e4);
    tab.view.webContents.once("destroyed", () => {
      if (!tab.leaving || finished || !alive(pane)) return;
      tab.leaving = false;
      pane.tab = -1;
      showWelcome(pane);
      setPeek(pane, false);
      push();
    });
    resume(tab);
    note(`tab "${tab.cfg.name}" closed`);
    tab.view.webContents.close({ waitForBeforeUnload: true });
  }
  function show(pane, tab, { focus = true } = {}) {
    const previous = tabs[pane.tab];
    clearTimeout(tab.timer);
    resume(tab);
    pane.tab = tab.index;
    ensure(tab, pane);
    if (pane.welcome) closeWelcome(pane);
    if (previous && previous !== tab && previous.view) {
      previous.view.setVisible(false);
      startIdle(previous);
    }
    setThrottled(tab, false);
    tab.view.setVisible(true);
    if (focus) tab.view.webContents.focus();
    if (pane.main) saveTab(tab.index);
    if (autoHide && !pane.over) hideSoon(pane);
    title(tab);
    push();
  }
  function select(index, { focus = true } = {}) {
    if (!(index >= 0 && index < tabs.length) || win.isDestroyed()) return;
    show(main, tabs[index], { focus });
  }
  function tabMenu(index, pane) {
    const tab = tabs[index];
    if (!tab) return;
    const items = [
      ...tab.view ? [{ label: t.reload, click: () => tab.view?.webContents.reload() }] : [{ label: t.load, click: () => ensure(tab, main) }],
      ...tab.view ? [{ label: t.close, click: () => closeTab(index) }] : [],
      ...tab.view && !isShown(tab) && process.platform !== "win32" ? [{ label: tab.paused ? t.resume : t.pause, click: () => tab.paused ? resume(tab) : pause(tab) }] : [],
      { type: "separator" },
      { label: t.copy, click: () => clipboard.writeText(tab.view?.webContents.getURL() || tab.cfg.url) },
      { label: t.browser, click: () => openExternal(tab.view?.webContents.getURL() || tab.cfg.url) }
    ];
    menu(items, pane.bar.webContents);
  }
  function shortcut(input) {
    if (!input.control || input.alt || input.meta) return false;
    const key = input.key.toLowerCase();
    const order = shown();
    const at = order.findIndex((tab) => tab.index === focused().tab);
    if (key === "tab" && !input.shift || key === "pagedown") select(order[(at + 1) % order.length].index);
    else if (key === "tab" && input.shift || key === "pageup") select(order[(Math.max(at, 0) - 1 + order.length) % order.length].index);
    else if (/^[1-9]$/.test(key) && !input.shift) select(order[key === "9" ? order.length - 1 : Math.min(Number(key) - 1, order.length - 1)].index);
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
    const found = tabs.find((tab) => URL.canParse(tab.cfg.url) && new URL(tab.cfg.url).hostname === host) ?? tabs[Math.max(0, focused().tab)];
    select(found.index);
    found.view?.webContents.loadURL(url).catch(() => {
    });
  }
  function start({ url } = {}) {
    if (url) open(url);
    else if (startIndex >= 0) select(startIndex, { focus: false });
    else showWelcome(main);
    if (cfg.tabLazyLoad || startIndex < 0) return;
    for (const tab of tabs) ensure(tab, main);
  }
  function showWelcome(pane) {
    const tint = `${hues["--hue-s"]}`;
    const [paper, ink] = !managed ? isDark() ? ["#202124", "#e8eaed"] : ["#f1f3f4", "#202124"] : isDark() ? [`oklch(14.5% calc(0.03 * ${hues["--vivid"]}) ${tint})`, `oklch(95.5% calc(0.012 * ${hues["--vivid"]}) ${tint})`] : [`oklch(98.2% calc(0.016 * ${hues["--vivid"]}) ${tint})`, `oklch(14% calc(0.025 * ${hues["--vivid"]}) ${tint})`];
    const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const page = `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="${isDark() ? "dark" : "light"}">
      <body style="margin:0;height:100vh;display:grid;place-items:center;background:${paper};color:${ink};font:500 18px system-ui,sans-serif;text-align:center;user-select:none">
      <div>${logo ? `<img src="${logo}" width="72" height="72" style="border-radius:16px;margin-bottom:18px"><br>` : ""}${escape(cfg.name)}
      <div style="margin-top:8px;font:400 15px system-ui,sans-serif;opacity:.65">${escape(t.choose)}</div></div>`;
    const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    pane.welcome = view;
    chrome.add(view.webContents);
    view.setBackgroundColor(background);
    pane.container.addChildView(view);
    if (autoHide) pane.container.addChildView(pane.bar);
    view.setBounds(pageRect(pane));
    view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`).catch(() => {
    });
  }
  function closeWelcome(pane) {
    const view = pane.welcome;
    pane.welcome = null;
    try {
      pane.container.removeChildView(view);
      view.webContents.close();
    } catch {
    }
  }
  function closeAll(done) {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
    }, 2e3);
    const end = () => {
      finished = true;
      done();
    };
    const live = tabs.filter((tab) => tab.view && !tab.view.webContents.isDestroyed());
    for (const tab of tabs) resume(tab);
    if (!live.length) return setImmediate(end);
    let left = live.length;
    for (const tab of live) {
      tab.view.webContents.once("destroyed", () => {
        if (--left === 0) end();
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
    container: main.container,
    inset,
    layout: (area) => layout(main, area),
    start,
    select,
    open,
    shortcut,
    closeAll,
    summary: () => [...tabs.filter((tab) => tab.view), ...tabs.filter((tab) => !tab.view)].map((tab) => ({ name: tab.cfg.name, loaded: Boolean(tab.view) })),
    isChrome: (contents) => chrome.has(contents),
    current: () => currentOf(main),
    index: () => main.tab,
    homeUrl: () => (tabs[focused().tab] ?? tabs[0]).cfg.url,
    hosts: () => tabs.map((tab) => URL.canParse(tab.cfg.url) ? new URL(tab.cfg.url).hostname : "").filter(Boolean),
    pages: () => tabs.filter((tab) => tab.view && !tab.paused).map((tab) => tab.view.webContents),
    all: () => tabs.filter((tab) => tab.view).map((tab) => tab.view.webContents)
  };
};

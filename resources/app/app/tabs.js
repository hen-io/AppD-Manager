"use strict";
const { View, WebContentsView, app, ipcMain, clipboard } = require("electron");
const path = require("path");
const barPage = require("./tabbar");
const { text } = require("../shared/text");
const t = text.app.tab;
const BAR = { top: 48, bottom: 48, left: 208 };
const UNREAD = /[([](\d{1,5})\+?[)\]]/;
const RETRY_MS = 15e3;
module.exports = function createTabs({ win, cfg, lib, pagePreferences, background, dark, accent, note, startTab = 0, saveTab, onPage, throttle, menu, openExternal }) {
  const container = new View();
  win.contentView.addChildView(container);
  const unloadable = process.platform !== "win32" || cfg.tabInactive !== "pause";
  const mode = unloadable ? cfg.tabInactive : "throttle";
  const bar = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "tabbar-preload.js") }
  });
  bar.setBackgroundColor(background);
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
  let active = Math.min(Math.max(0, startTab), tabs.length - 1);
  let size = { width: 0, height: 0 };
  let ready = false;
  let finished = false;
  const barSize = BAR[cfg.tabBarPosition] ?? BAR.top;
  const inset = {
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
  const barRect = () => {
    if (cfg.tabBarPosition === "left") return { x: 0, y: 0, width: barSize, height: Math.max(1, size.height) };
    return { x: 0, y: cfg.tabBarPosition === "bottom" ? Math.max(0, size.height - barSize) : 0, width: Math.max(1, size.width), height: barSize };
  };
  function layout(area) {
    if (area) size = { width: area.width, height: area.height };
    bar.setBounds(barRect());
    const page = pageRect();
    for (const tab of tabs) tab.view?.setBounds(page);
  }
  let pushTimer = null;
  function push() {
    if (pushTimer || !ready) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      if (bar.webContents.isDestroyed()) return;
      bar.webContents.send("appd-tabs-state", {
        active,
        tabs: tabs.map((tab) => ({
          name: tab.cfg.name,
          favicon: tab.favicon,
          badge: tab.badge,
          audible: tab.audible,
          state: tab.paused ? "paused" : !tab.view ? "unloaded" : tab.loading ? "loading" : "live"
        }))
      });
    }, 30);
  }
  const owns = (event) => event.sender === bar.webContents;
  ipcMain.on("appd-tabs-ready", (event) => {
    if (!owns(event)) return;
    ready = true;
    push();
  });
  ipcMain.on("appd-tabs-select", (event, index) => owns(event) && select(Number(index)));
  ipcMain.on("appd-tabs-menu", (event, index) => owns(event) && tabMenu(Number(index)));
  bar.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(barPage({ dark, accent, position: cfg.tabBarPosition, icons: cfg.tabShowIcons, badges: cfg.tabShowBadges }))}`).catch(() => {
  });
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
      if (tab.index === active && !finished) {
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
  function select(index, { focus = true } = {}) {
    if (!(index >= 0 && index < tabs.length) || win.isDestroyed()) return;
    const previous = tabs[active];
    const next = tabs[index];
    clearTimeout(next.timer);
    resume(next);
    const changed = previous !== next;
    active = index;
    ensure(next);
    if (changed && previous.view) {
      previous.view.setVisible(false);
      startIdle(previous);
    }
    setThrottled(next, false);
    next.view.setVisible(true);
    if (focus) next.view.webContents.focus();
    saveTab(index);
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
      ...tab.view && tab.index !== active ? [{ label: t.unload, click: () => unload(tab) }] : [],
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
    else if (key === "tab" && input.shift || key === "pageup") select((active - 1 + tabs.length) % tabs.length);
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
    const found = tabs.find((tab) => URL.canParse(tab.cfg.url) && new URL(tab.cfg.url).hostname === host) ?? tabs[active];
    select(found.index);
    found.view?.webContents.loadURL(url).catch(() => {
    });
  }
  function start({ url } = {}) {
    if (url) {
      open(url);
    } else {
      select(active, { focus: false });
    }
    if (!cfg.tabLazyLoad) for (const tab of tabs) ensure(tab);
  }
  function closeAll(done) {
    const live = tabs.filter((tab) => tab.view);
    for (const tab of tabs) resume(tab);
    if (!live.length) return done();
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
    current: () => tabs[active].view?.webContents ?? bar.webContents,
    index: () => active,
    homeUrl: () => tabs[active].cfg.url,
    hosts: () => tabs.map((tab) => URL.canParse(tab.cfg.url) ? new URL(tab.cfg.url).hostname : "").filter(Boolean),
    pages: () => tabs.filter((tab) => tab.view && !tab.paused).map((tab) => tab.view.webContents),
    all: () => tabs.filter((tab) => tab.view).map((tab) => tab.view.webContents)
  };
};

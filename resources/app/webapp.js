"use strict";
const { app, BrowserWindow, Menu, WebContentsView, dialog, globalShortcut, ipcMain, nativeTheme, powerSaveBlocker, session, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const extras = require("./extras");
const setUpPermissions = require("./app/permissions");
const showUnreadCount = require("./app/badge");
const keepInTray = require("./app/tray");
const makeTrayApp = require("./app/trayapp");
const { frameOptions, styleFrame, isBare, hasLook, needsHost, wantsIconColour, outsetOf } = require("./app/frame");
const iconColour = require("./app/iconcolour");
const { windowIcon } = require("./app/icondraw");
const watchForUpdate = require("./app/updated");
const openLog = require("./app/log");
const createZoom = require("./app/zoom");
const createThrottle = require("./app/throttle");
const showLoadingScreen = require("./app/loading");
const showDownloads = require("./app/downloads");
const shareScreens = require("./app/share");
const { openFind, findAgain, isBar } = require("./app/find");
const createLinks = require("./app/links");
const createExtensions = require("./app/extensions");
const id = process.env.APPD_ID;
let cfg;
const settingsText = (settings) => JSON.stringify({ ...settings, autostart: void 0 });
let startedWith = "";
try {
  cfg = lib.load(id);
  startedWith = settingsText(cfg);
  lib.writeDesktop(id, cfg);
} catch (e) {
  console.error(`appd: ${e.message}`);
  process.exit(1);
}
if (lib.WINDOWS) Object.assign(cfg, { pauseWhenUnfocused: false, cpuPercent: 100, unfocusedCpuPercent: 100 });
const desktopId = lib.desktopId(id);
app.setName(desktopId);
process.env.CHROME_DESKTOP = `${desktopId}.desktop`;
app.setDesktopName?.(`${desktopId}.desktop`);
if (lib.WINDOWS) app.setAppUserModelId(lib.windowsAppId(id));
app.setPath("userData", lib.profileDir(id));
const HARDWARE_ACCELERATION = [
  "--ignore-gpu-blocklist",
  "--enable-gpu-rasterization",
  "--enable-zero-copy",
  "--enable-features=AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL,AcceleratedVideoEncoder,VaapiIgnoreDriverChecks"
];
const featureLists = { "enable-features": [], "disable-features": [] };
const FRAME_LOOK = ["--enable-transparent-visuals"];
const HOTKEY_DOOR = cfg.trayApp && cfg.trayHotkey && process.env.WAYLAND_DISPLAY ? ["--enable-features=GlobalShortcutsPortal"] : [];
for (const flag of [...cfg.hardwareAcceleration ? HARDWARE_ACCELERATION : [], ...hasLook(cfg) ? FRAME_LOOK : [], ...HOTKEY_DOOR, ...cfg.flags]) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(flag.trim());
  if (!m) console.error(`appd: ignoring flag "${flag}"`);
  else if (m[1] in featureLists) featureLists[m[1]].push(...(m[2] || "").split(","));
  else if (m[2] === void 0) app.commandLine.appendSwitch(m[1]);
  else app.commandLine.appendSwitch(m[1], m[2]);
}
for (const [name, values] of Object.entries(featureLists)) {
  const list = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (list.length) app.commandLine.appendSwitch(name, list.join(","));
}
if (cfg.ignoreCertificateErrors) app.commandLine.appendSwitch("ignore-certificate-errors");
if (cfg.language) {
  app.commandLine.appendSwitch("lang", cfg.language);
  if (!lib.WINDOWS) {
    process.env.APPD_SYSTEM_LANGUAGE ??= process.env.LANGUAGE || "";
    process.env.LANGUAGE = `${cfg.language.replace(/-/g, "_")}:${cfg.language.split("-")[0]}`;
  }
}
if (!cfg.backgroundThrottling) {
  for (const name of ["disable-renderer-backgrounding", "disable-backgrounding-occluded-windows", "disable-background-timer-throttling"]) {
    app.commandLine.appendSwitch(name);
  }
}
if (cfg.jsHeapMb > 0) {
  app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${cfg.jsHeapMb}`);
}
app.userAgentFallback = cfg.userAgent || app.userAgentFallback.split(" ").filter((token) => !/^(Electron|appd[\w-]*)\//i.test(token)).join(" ");
const GOOGLE_SIGN_IN = /^https:\/\/accounts\.(google\.(com|[a-z]{2,3}|com?\.[a-z]{2})|youtube\.com)\//i;
function followGoogleSignIn(wc) {
  const normal = app.userAgentFallback;
  const versionless = normal.replace(/Chrome\/[\d.]+/, "Chrome");
  wc.on("did-navigate", (_event, url) => {
    const wanted = GOOGLE_SIGN_IN.test(url) ? versionless : normal;
    if (wc.getUserAgent() !== wanted) wc.setUserAgent(wanted);
  });
}
const iconFile = lib.iconFile(id, cfg);
let icon = iconFile && /\.png$/i.test(iconFile) ? iconFile : void 0;
const statePath = path.join(lib.profileDir(id), "window-state.json");
const internalHosts = [new URL(cfg.url).hostname, ...cfg.internalHosts];
let win;
function isInternal(url) {
  try {
    const host = new URL(url).hostname;
    return internalHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
const { note, because, takeReason, plain } = openLog(path.join(lib.appDir(id), "events.log"));
const { openExternal, openElsewhere } = createLinks({ id, cfg, lib, note });
const extensions = createExtensions({ id, cfg, lib, note, icon: () => icon });
function restartApp(wc, why = "hard reload, or asked for by the manager") {
  const url = wc && !wc.isDestroyed() ? wc.getURL() : "";
  let settings = cfg;
  try {
    settings = lib.load(id);
  } catch {
  }
  const [execPath, args] = lib.runCommand(id, [...lib.startFlags(settings), .../^https?:\/\//i.test(url) ? [`--appd-url=${url}`] : []]);
  note(`restarting (${why})`);
  throttle.releasePage();
  relaunchWith = { execPath, args };
  app.quit();
}
let relaunchWith = null;
let timedReload = false;
app.on("will-quit", () => {
  if (!relaunchWith) return;
  if ("APPD_SYSTEM_LANGUAGE" in process.env) {
    if (process.env.APPD_SYSTEM_LANGUAGE) process.env.LANGUAGE = process.env.APPD_SYSTEM_LANGUAGE;
    else delete process.env.LANGUAGE;
    delete process.env.APPD_SYSTEM_LANGUAGE;
  }
  app.relaunch(relaunchWith);
});
function mayLeave(wc) {
  const window = BrowserWindow.fromWebContents(wc);
  const options = {
    type: "question",
    title: cfg.name,
    message: "Leave this page?",
    detail: "It may have unsaved changes.",
    buttons: ["Leave", "Stay"],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  };
  const over = window && !window.isDestroyed() && window.isVisible() ? window : null;
  const leave = (over ? dialog.showMessageBoxSync(over, options) : dialog.showMessageBoxSync(options)) === 0;
  if (!leave) {
    note("kept open: the page has unsaved changes");
    relaunchWith = null;
    throttle.stay();
  }
  return leave;
}
const startUrl = (() => {
  const arg = process.argv.find((value) => value.startsWith("--appd-url="));
  const url = arg ? arg.slice("--appd-url=".length) : "";
  return /^https?:\/\//i.test(url) && URL.canParse(url) ? url : cfg.url;
})();
const REFRESH_SERVER_SIDE = `(async () => {
  const hass = document.querySelector('home-assistant')?.hass;
  if (!hass?.callWS || !hass.panels) return 0;
  const boards = Object.values(hass.panels).filter((panel) => panel.component_name === 'lovelace');
  const done = await Promise.allSettled(boards.map((panel) => hass.callWS({
    type: 'lovelace/config', url_path: panel.url_path === 'lovelace' ? null : panel.url_path, force: true,
  })));
  return done.filter((one) => one.status === 'fulfilled').length;
})()`;
async function refreshServerSide(wc) {
  const count = await Promise.race([
    wc.executeJavaScript(REFRESH_SERVER_SIDE).catch(() => 0),
    new Promise((resolve) => setTimeout(() => resolve(0), 4e3))
  ]);
  if (count) note(`Home Assistant asked to read its dashboards anew (${count})`);
}
async function runAction(action, wc) {
  if (!wc || wc.isDestroyed()) return;
  if (action === "clear-cache") {
    const ses = wc.session || session.defaultSession;
    await ses.clearCache().catch(() => {
    });
    await ses.clearCodeCaches({}).catch(() => {
    });
    await ses.clearStorageData({ storages: ["cachestorage", "shadercache", "serviceworkers"] }).catch(() => {
    });
    await refreshServerSide(wc);
    if (wc.isDestroyed()) return;
  }
  if (action !== "clear-cache" && action !== "hard-reload") return;
  let settings = startedWith;
  try {
    settings = settingsText(lib.load(id));
  } catch {
  }
  if (settings !== startedWith) return restartApp(wc);
  because(action === "clear-cache" ? "the cache was emptied" : "hard reload");
  wc.reloadIgnoringCache();
}
function actionIn(argv) {
  const arg = argv.find((value) => value.startsWith("--appd-action="));
  const action = arg ? arg.slice("--appd-action=".length) : "";
  return action in lib.APP_ACTIONS || action in lib.TRAY_ACTIONS ? action : "";
}
let menusOpen = 0;
function popUp(items, wc) {
  menusOpen++;
  Menu.buildFromTemplate(items).popup({
    window: BrowserWindow.fromWebContents(wc) ?? void 0,
    callback: () => {
      menusOpen--;
      trayIcon?.refresh();
    }
  });
}
let trayIcon = null;
const zoom = createZoom(cfg);
function appMenu(wc, inTray = false) {
  const window = BrowserWindow.fromWebContents(wc);
  const sep = { type: "separator" };
  return [
    { label: "Reload", accelerator: "F5", click: () => because("Reload in the menu") || wc.reload() },
    ...Object.entries(lib.APP_ACTIONS).map(([action, label]) => ({ label, click: () => runAction(action, wc) })),
    sep,
    { label: `Go to ${cfg.name}`, accelerator: "Alt+Home", click: () => wc.loadURL(cfg.url) },
    sep,
    { label: "Mute sound", type: "checkbox", checked: wc.isAudioMuted(), click: () => wc.setAudioMuted(!wc.isAudioMuted()) },
    ...cfg.allowZoom ? [
      {
        label: `Reset zoom (${zoom.normalPercent}%)`,
        accelerator: "Ctrl+0",
        enabled: zoom.isChanged(),
        click: () => zoom.reset(wc)
      }
    ] : [],
    ...cfg.trayApp ? [] : [{
      label: "Full screen",
      accelerator: "F11",
      type: "checkbox",
      checked: Boolean(window?.isFullScreen()),
      click: () => window?.setFullScreen(!window.isFullScreen())
    }],
    ...cfg.trayApp && cfg.trayHideOnBlur && trayIcon?.pin ? [sep, {
      label: "Keep open",
      type: "checkbox",
      checked: trayIcon.isPinned(),
      click: () => trayIcon.pin(!trayIcon.isPinned())
    }] : [],
    ...cfg.trayApp && !inTray ? [{ label: "Hide", click: () => window?.hide() }, sep, { label: `Quit ${cfg.name}`, click: () => app.quit() }] : [],
    ...cfg.windowDecorations || cfg.trayApp ? [] : [
      sep,
      { label: "Minimize", click: () => window?.minimize() },
      { label: window?.isMaximized() ? "Restore size" : "Maximize", click: () => window?.isMaximized() ? window.unmaximize() : window?.maximize() },
      { label: "Close window", accelerator: "Alt+F4", click: () => window?.close() }
    ],
    ...extensions.menu()
  ];
}
function showActionMenu(wc) {
  if (wc.isDestroyed()) return;
  popUp(appMenu(wc), wc);
}
ipcMain.on("appd-action-button", (event) => {
  event.returnValue = cfg.actionButton;
});
ipcMain.on("appd-action-menu", (event) => showActionMenu(event.sender));
ipcMain.on("appd-page-filters", (event, url) => {
  let filters = null;
  try {
    if (cfg.extensions.includes("adblock")) filters = extras.pageFilters(String(url));
    const twitch = cfg.extensions.includes("twitch") ? extras.twitchPageScript(String(url)) : null;
    if (twitch) filters = { scripts: [...filters ? filters.scripts : [], twitch], styles: filters ? filters.styles : "" };
  } catch {
  }
  event.returnValue = filters;
});
function shortcut(wc, input) {
  if (isBar(wc)) return false;
  const key = input.key.toLowerCase();
  const ctrl = input.control && !input.alt;
  const history = wc.navigationHistory;
  const window = BrowserWindow.fromWebContents(wc);
  if (window && ctrl && !input.shift && key === "f") openFind(window);
  else if (window && (key === "f3" || ctrl && key === "g")) findAgain(window, !input.shift) || openFind(window);
  else if (ctrl && !input.shift && key === "p") wc.print({}, () => {
  });
  else return pageShortcut(wc, input, key, ctrl, history);
  return true;
}
function pageShortcut(wc, input, key, ctrl, history) {
  if (key === "f5" || ctrl && !input.shift && key === "r") because("F5 or Ctrl+R") || wc.reload();
  else if (ctrl && input.shift && key === "r") because("Ctrl+Shift+R") || wc.reloadIgnoringCache();
  else if (ctrl && input.shift && key === "delete") runAction("clear-cache", wc);
  else if (key === "f12" || ctrl && input.shift && key === "i") wc.toggleDevTools();
  else if (key === "f11") {
    const w = BrowserWindow.fromWebContents(wc);
    w?.setFullScreen(!w.isFullScreen());
  } else if (ctrl && (key === "=" || key === "+")) zoom.zoomBy(wc, 1);
  else if (ctrl && key === "-") zoom.zoomBy(wc, -1);
  else if (ctrl && key === "0") zoom.reset(wc);
  else if (input.alt && !input.control && key === "arrowleft") history.goBack();
  else if (input.alt && !input.control && key === "arrowright") history.goForward();
  else if (input.alt && !input.control && key === "home" && !extensions.isOwnPage(wc)) wc.loadURL(cfg.url);
  else return false;
  return true;
}
function contextMenu(wc, p) {
  const sep = { type: "separator" };
  if (extensions.isOwnPage(wc)) {
    const window = BrowserWindow.fromWebContents(wc);
    return popUp([
      ...p.isEditable ? [{ role: "cut", enabled: p.editFlags.canCut }, { role: "copy", enabled: p.editFlags.canCopy }, { role: "paste", enabled: p.editFlags.canPaste }, sep] : p.selectionText ? [{ role: "copy" }, sep] : [],
      { label: "Reload", click: () => wc.reload() },
      { label: "Close", click: () => window?.close() }
    ], wc);
  }
  const items = p.dictionarySuggestions.map((word) => ({
    label: word,
    click: () => wc.replaceMisspelling(word)
  }));
  items.push(sep);
  if (p.linkURL) {
    items.push(
      { label: "Open Link in Browser", click: () => openExternal(p.linkURL) },
      { label: "Copy Link Address", click: () => clipboard.writeText(p.linkURL) },
      sep
    );
  }
  if (p.mediaType === "image") {
    items.push(
      { label: "Copy Image", click: () => wc.copyImageAt(p.x, p.y) },
      { label: "Copy Image Address", click: () => clipboard.writeText(p.srcURL) },
      sep
    );
  }
  if (p.isEditable) {
    items.push(
      { role: "cut", enabled: p.editFlags.canCut },
      { role: "copy", enabled: p.editFlags.canCopy },
      { role: "paste", enabled: p.editFlags.canPaste },
      { role: "selectAll" },
      sep
    );
  } else if (p.selectionText) {
    items.push({ role: "copy" }, sep);
  }
  items.push(...appMenu(wc));
  popUp(items, wc);
}
app.on("web-contents-created", (_event, wc) => {
  if (!cfg.userAgent) followGoogleSignIn(wc);
  zoom.follow(wc);
  if (cfg.customCss.trim()) {
    wc.on("dom-ready", () => {
      if (/^https?:/i.test(wc.getURL())) wc.insertCSS(cfg.customCss).catch(() => {
      });
    });
  }
  if (cfg.customJs.trim()) {
    wc.on("dom-ready", () => {
      if (/^https?:/i.test(wc.getURL())) wc.executeJavaScript(`try {
${cfg.customJs}
} catch (error) { console.error('Custom JavaScript:', error); }`).catch(() => {
      });
    });
  }
  if (cfg.hideScrollbars) {
    wc.on("frame-created", (_e, { frame }) => {
      frame?.on("dom-ready", () => frame.executeJavaScript(`(() => {
        const style = document.createElement('style');
        style.textContent = '::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }';
        document.documentElement?.append(style);
      })()`).catch(() => {
      }));
    });
  }
  wc.setWindowOpenHandler(({ url }) => {
    const appWindow = { action: "allow", overrideBrowserWindowOptions: { icon, autoHideMenuBar: true, frame: cfg.windowDecorations } };
    if (url === "about:blank") return appWindow;
    const web = /^https?:/i.test(url);
    if (web && cfg.openLinks === "window") return appWindow;
    if (web && cfg.openLinks === "same") {
      wc.loadURL(url);
      return { action: "deny" };
    }
    if (cfg.openLinks === "browser" && isInternal(url)) return appWindow;
    openElsewhere(url);
    return { action: "deny" };
  });
  wc.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && shortcut(wc, input)) event.preventDefault();
  });
  wc.on("context-menu", (_e, params) => isBar(wc) || contextMenu(wc, params));
  wc.on("will-prevent-unload", (event) => {
    if (timedReload) return;
    if (mayLeave(wc)) event.preventDefault();
  });
});
function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}
const throttle = createThrottle(cfg, { note, because });
const homeButtonScript = `(() => {
  if (document.getElementById('appd-home-button')) return;
  const host = document.createElement('div');
  host.id = 'appd-home-button';
  host.style.cssText = 'all:initial;position:fixed;left:${cfg.actionButton === "bottom-left" ? 58 : 16}px;bottom:${cfg.actionButton === "bottom-left" ? 12 : 16}px;z-index:2147483647';
  const button = document.createElement('button');
  button.textContent = ${JSON.stringify(`← ${cfg.name}`)};
  button.title = ${JSON.stringify(`Back to ${cfg.name} (Alt+Home)`)};
  button.style.cssText = 'all:initial;font:600 13px system-ui,sans-serif;padding:8px 14px;border-radius:999px;'
    + 'background:rgba(35,38,41,.9);color:#fff;border:1px solid rgba(255,255,255,.3);'
    + 'box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;opacity:.7';
  button.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
  button.addEventListener('mouseleave', () => { button.style.opacity = '.7'; });
  button.addEventListener('click', () => { location.href = ${JSON.stringify(cfg.url)}; });
  host.attachShadow({ mode: 'closed' }).append(button);
  document.documentElement.append(host);
})()`;
const extension = (name) => cfg.extensions.includes(name);
async function createWindow() {
  const state = readState();
  nativeTheme.themeSource = cfg.colorScheme;
  setUpPermissions(session.defaultSession, { mode: cfg.permissions, isInternal, note });
  const bare = isBare(cfg);
  if (!icon && iconFile) {
    icon = await windowIcon(iconFile, lib.profileDir(id));
    if (icon && lib.WINDOWS) {
      try {
        lib.writeDesktop(id, cfg);
      } catch {
      }
    }
  }
  const lineColour = wantsIconColour(cfg) ? await iconColour(iconFile, path.join(lib.profileDir(id), "icon-colour.json")).catch(() => null) : null;
  const hosted = needsHost(cfg);
  const outset = hosted ? outsetOf(cfg) : 0;
  const dark = !(cfg.colorScheme === "light" && !extension("darkreader"));
  const pagePreferences = {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    backgroundThrottling: cfg.backgroundThrottling,
    spellcheck: cfg.spellcheck,
    v8CacheOptions: "bypassHeatCheck",
    ...cfg.actionButton !== "off" || extension("adblock") || extension("twitch") ? { preload: path.join(__dirname, "webapp-preload.js") } : {}
  };
  if (cfg.language) {
    const wanted = [.../* @__PURE__ */ new Set([cfg.language, cfg.language.split("-")[0], "en"])].join(",");
    session.defaultSession.setUserAgent(app.userAgentFallback, wanted);
  }
  const startsHidden = cfg.closeToTray && cfg.startHidden && !cfg.trayApp;
  win = new BrowserWindow({
    alwaysOnTop: cfg.alwaysOnTop || cfg.trayApp,
    width: cfg.trayApp ? cfg.trayWidth + 2 * outset : state.width || cfg.width,
    height: cfg.trayApp ? cfg.trayHeight + 2 * outset : state.height || cfg.height,
    title: cfg.name,
    icon,
    ...cfg.trayApp ? { show: false, skipTaskbar: true, resizable: false, minimizable: false, maximizable: false, fullscreenable: false } : {},
    ...startsHidden ? { show: false } : {},
    ...dark ? { backgroundColor: "#15171b" } : {},
    frame: !bare,
    ...bare ? frameOptions(cfg) : {},
    webPreferences: hosted ? { sandbox: true, contextIsolation: true, nodeIntegration: false } : pagePreferences
  });
  let host = null;
  if (hosted) {
    const view = new WebContentsView({ webPreferences: pagePreferences });
    view.setBackgroundColor(dark ? "#15171b" : "#ffffff");
    host = { view, contents: win.webContents };
    win.contentView.addChildView(view);
    Object.defineProperty(win, "webContents", { value: view.webContents, configurable: true, enumerable: true });
    view.webContents.on("page-title-updated", (event, title, explicit) => {
      win.emit("page-title-updated", event, title, explicit);
      if (!event.defaultPrevented && !win.isDestroyed()) win.setTitle(title);
    });
    win.on("focus", () => view.webContents.isDestroyed() || view.webContents.focus());
    win.on("closed", () => {
      try {
        view.webContents.close();
      } catch {
      }
    });
  }
  const frame = styleFrame(win, cfg, lineColour, host);
  const sizeUp = () => {
    if (cfg.startMaximized || state.maximized) win.maximize();
    if (cfg.startFullScreen) win.setFullScreen(true);
  };
  if (startsHidden) win.once("show", sizeUp);
  else if (!cfg.trayApp) sizeUp();
  if (cfg.startMuted) win.webContents.setAudioMuted(true);
  if (cfg.keepAwake !== "off") powerSaveBlocker.start(cfg.keepAwake === "display" ? "prevent-display-sleep" : "prevent-app-suspension");
  if (startsHidden) {
  } else if (!cfg.trayApp || cfg.trayShowAtStart) {
    if (cfg.loadingScreen) showLoadingScreen(win, cfg, iconFile, { frameCss: frame.css() });
    else if (frame.wanted) showLoadingScreen(win, cfg, iconFile, { plain: true, frameCss: frame.css() });
  }
  let marked = 0;
  const markUsed = () => {
    if (Date.now() - marked < 3e4) return;
    marked = Date.now();
    lib.markUsed(id);
  };
  markUsed();
  win.on("focus", markUsed);
  win.on("show", markUsed);
  note(`started, opening ${plain(startUrl)}`);
  let showing = "";
  win.webContents.on("did-start-navigation", (details) => {
    if (!details.isMainFrame || details.isSameDocument || !/^https?:/i.test(details.url)) return;
    const again = details.url === showing;
    const why = takeReason() || (again ? "asked for by the page itself, or by the server" : "");
    note(`${again ? "reloading" : "loading"} ${plain(details.url)}${why ? ` - ${why}` : ""}`);
  });
  win.webContents.on("did-navigate", (_e, url) => {
    showing = url;
  });
  let revivals = [];
  win.webContents.on("render-process-gone", (_e, details) => {
    if (throttle.isQuitting() || details.reason === "clean-exit") return;
    revivals = revivals.filter((time) => Date.now() - time < 6e4);
    note(`the page's process is gone (${details.reason})${revivals.length < 3 ? ": loading the page again" : ""}`);
    if (revivals.length >= 3 || win.isDestroyed()) return;
    revivals.push(Date.now());
    because("its process had died");
    win.webContents.reload();
  });
  win.webContents.on("unresponsive", () => note("the page does not respond"));
  if (cfg.unreadBadge) showUnreadCount(win, app);
  showDownloads(session.defaultSession, win, { name: cfg.name, note, folder: cfg.downloadFolder });
  shareScreens(session.defaultSession, {
    note,
    allowed: (request) => cfg.permissions === "all" || cfg.permissions === "app" && isInternal(request.securityOrigin || request.frame?.url || "")
  });
  if (cfg.reloadEverySeconds > 0) {
    setInterval(() => {
      if (win.isDestroyed() || throttle.isPaused() || win.webContents.isLoadingMainFrame()) return;
      if (!/^https?:/i.test(win.webContents.getURL())) return;
      timedReload = true;
      setTimeout(() => {
        timedReload = false;
      }, 3e3);
      because(`every ${cfg.reloadEverySeconds} s (reloadEverySeconds)`);
      win.webContents.reload();
    }, cfg.reloadEverySeconds * 1e3).unref();
  }
  if (cfg.spellcheck && cfg.spellcheckLanguages.length) {
    const known = session.defaultSession.availableSpellCheckerLanguages;
    const wanted = cfg.spellcheckLanguages.map((code) => known.find((one) => one.toLowerCase() === code.trim().toLowerCase())).filter(Boolean);
    if (wanted.length) session.defaultSession.setSpellCheckerLanguages([...new Set(wanted)]);
    if (wanted.length < cfg.spellcheckLanguages.length) note(`spelling: not every language is known (known: ${known.join(", ")})`);
  }
  const trayOptions = {
    name: cfg.name,
    icon,
    note,
    isQuitting: throttle.isQuitting,
    quit: () => app.quit(),
    menu: () => win.isDestroyed() ? [] : appMenu(win.webContents, true),
    isBusy: () => menusOpen > 0,
    because,
    resume: throttle.resumePage,
    outset,
    atHome: startUrl === cfg.url
  };
  if (cfg.trayApp) trayIcon = makeTrayApp(win, cfg, trayOptions);
  else if (cfg.closeToTray) trayIcon = keepInTray(win, trayOptions);
  if (startsHidden && !trayIcon) win.show();
  if (cfg.trayApp && cfg.trayHotkey && trayIcon?.toggle) {
    let taken = false;
    try {
      taken = globalShortcut.register(cfg.trayHotkey, () => trayIcon.toggle());
    } catch (e) {
      note(`the key ${cfg.trayHotkey} could not be asked for (${e.message})`);
    }
    note(taken ? `the key ${cfg.trayHotkey} shows and hides the window` : `the key ${cfg.trayHotkey} was not given to the app (taken by something else, or the desktop does not hand out keys)`);
    app.on("will-quit", () => globalShortcut.unregisterAll());
  }
  if (host) {
    win.on("close", (event) => {
      const page = host.view.webContents;
      if (event.defaultPrevented || page.isDestroyed()) return;
      event.preventDefault();
      throttle.resumePage();
      page.once("destroyed", () => win.isDestroyed() || win.destroy());
      page.close({ waitForBeforeUnload: true });
    });
  }
  if (cfg.fixedTitle) win.on("page-title-updated", (event) => event.preventDefault());
  if (extension("twitch")) await extras.enableTwitchAdBlock().catch(() => {
  });
  if (extension("adblock")) await extras.enableAdBlock(session.defaultSession, {
    hideLeftovers: cfg.adBlockHideLeftovers,
    inPageAds: cfg.adBlockInPageAds,
    annoyances: cfg.adBlockAnnoyances,
    exceptions: cfg.adBlockExceptions
  }).catch((e) => console.error(`appd: no ad blocking: ${e.message}`));
  await extensions.load();
  if (win.isDestroyed()) return;
  if (extension("sponsorblock")) {
    extras.enableSponsorBlock(win.webContents, cfg);
  }
  if (extension("darkreader")) {
    extras.enableDarkMode(win.webContents, { brightness: cfg.darkBrightness, contrast: cfg.darkContrast, sepia: cfg.darkSepia });
  }
  if (throttle.wanted) throttle.watchFocus(win);
  watchForUpdate((version) => {
    if (throttle.isQuitting() || win.isDestroyed()) return;
    restartApp(win.webContents, `AppD-Manager was updated to ${version}`);
  });
  win.on("close", () => {
    if (cfg.trayApp) return;
    const { width, height } = win.getNormalBounds();
    try {
      fs.writeFileSync(statePath, JSON.stringify({ width, height, maximized: win.isMaximized() }));
    } catch {
    }
  });
  win.webContents.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith("data:")) return;
    note(`could not load ${plain(url)}: ${description} (${code}); trying again in 5 seconds`);
    because("another try after it could not be loaded");
    const target = JSON.stringify(url).replace(/</g, "\\u003c");
    win.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
      `<meta name="color-scheme" content="light dark">
       <body style="font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0;text-align:center">
       <p><b>Can't reach <span id="u"></span></b><br>${description}<br><br>Retrying…</p>
       <script>u.textContent = new URL(${target}).host;
       setTimeout(() => location.replace(${target}), 5000)<\/script>`
    ));
  });
  if (cfg.homeButton) {
    win.webContents.on("dom-ready", () => {
      const url = win.webContents.getURL();
      if (/^https?:/i.test(url) && !isInternal(url)) win.webContents.executeJavaScript(homeButtonScript).catch(() => {
      });
    });
  }
  if (cfg.proxy) await session.defaultSession.setProxy({ proxyRules: cfg.proxy }).catch((e) => note(`proxy not set (${e.message})`));
  if (win.isDestroyed()) return;
  win.loadURL(startUrl, startUrl === cfg.url ? void 0 : { extraHeaders: "pragma: no-cache\n" });
  throttle.runLimiter();
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (argv.includes("--appd-action=quit")) return app.quit();
    if (!win) return;
    throttle.resumePage();
    if (argv.includes("--appd-action=restart")) return restartApp(win.webContents);
    const action = actionIn(argv);
    if (action === "toggle") return trayIcon?.toggle ? trayIcon.toggle() : void 0;
    if (action) runAction(action, win.webContents);
    if (trayIcon?.show) trayIcon.show();
    else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    const link = argv.find((value) => value.startsWith("--appd-url="))?.slice("--appd-url=".length);
    if (!action && link && /^https?:\/\//i.test(link) && URL.canParse(link)) {
      because("a link clicked in another app");
      win.webContents.loadURL(link).catch(() => {
      });
    }
    return void 0;
  });
  app.on("window-all-closed", () => app.quit());
  if (lib.WINDOWS) {
    fs.writeFileSync(lib.pidFile(id), String(process.pid));
    app.on("quit", () => fs.rmSync(lib.pidFile(id), { force: true }));
  }
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
}

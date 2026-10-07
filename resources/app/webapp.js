"use strict";
const { app, BrowserWindow, Menu, WebContentsView, ipcMain, nativeTheme, session, shell, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const extras = require("./extras");
const id = process.env.APPD_ID;
let cfg;
try {
  cfg = lib.load(id);
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
for (const flag of [...cfg.hardwareAcceleration ? HARDWARE_ACCELERATION : [], ...cfg.flags]) {
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
const icon = iconFile && /\.png$/i.test(iconFile) ? iconFile : void 0;
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
function openExternal(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
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
  }
  if (action === "clear-cache" || action === "hard-reload") wc.reloadIgnoringCache();
}
function actionIn(argv) {
  const arg = argv.find((value) => value.startsWith("--appd-action="));
  const action = arg ? arg.slice("--appd-action=".length) : "";
  return action in lib.APP_ACTIONS ? action : "";
}
function parseShortcut(text) {
  const parts = String(text || "").split("+").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  return { control: parts.includes("ctrl") || parts.includes("control"), shift: parts.includes("shift"), alt: parts.includes("alt"), key };
}
const menuShortcut = parseShortcut(cfg.menuShortcut);
const customExtensions = [];
async function loadCustomExtensions() {
  const loader = session.defaultSession.extensions || session.defaultSession;
  for (const entry of cfg.customExtensions) {
    const folder = lib.extensionFolder(entry);
    try {
      const info = lib.describeExtension(folder);
      const loaded = await loader.loadExtension(folder, { allowFileAccess: true });
      customExtensions.push({ id: loaded.id, name: info.name, options: info.options });
    } catch (e) {
      console.error(`appd: extension ${folder}: ${e.message}`);
    }
  }
}
function openExtensionSettings(extension2) {
  const [command, args] = lib.managerCommand([`--appd-edit=${id}:${extension2}`]);
  const env = { ...process.env };
  for (const name of ["APPD_ID", "CHROME_DESKTOP", "ELECTRON_RUN_AS_NODE"]) delete env[name];
  require("child_process").spawn(command, args, { detached: true, stdio: "ignore", env }).on("error", () => {
  }).unref();
}
function openExtensionOptions(extension2) {
  const options = new BrowserWindow({ width: 900, height: 700, title: extension2.name, icon, autoHideMenuBar: true });
  options.loadURL(`chrome-extension://${extension2.id}/${extension2.options.replace(/^\/+/, "")}`);
}
function extensionMenu() {
  const items = [
    ...cfg.extensions.map((name) => ({ label: `${lib.EXTENSIONS[name].name} settings…`, click: () => openExtensionSettings(name) })),
    ...customExtensions.map((extension2) => ({
      label: `${extension2.name}${extension2.options ? " options…" : " (no settings page)"}`,
      enabled: Boolean(extension2.options),
      click: () => openExtensionOptions(extension2)
    }))
  ];
  return items.length ? [{ label: "Extensions", submenu: items }, { type: "separator" }] : [];
}
function showActionMenu(wc) {
  if (wc.isDestroyed()) return;
  const window = BrowserWindow.fromWebContents(wc);
  const history = wc.navigationHistory;
  const sep = { type: "separator" };
  const zoom = (step) => wc.setZoomLevel(step === 0 ? 0 : wc.getZoomLevel() + step);
  Menu.buildFromTemplate([
    { label: "Reload", accelerator: "F5", click: () => wc.reload() },
    ...Object.entries(lib.APP_ACTIONS).map(([action, label]) => ({ label, click: () => runAction(action, wc) })),
    sep,
    { label: `Go to ${cfg.name}`, accelerator: "Alt+Home", click: () => wc.loadURL(cfg.url) },
    { label: "Back", accelerator: "Alt+Left", enabled: history.canGoBack(), click: () => history.goBack() },
    { label: "Forward", accelerator: "Alt+Right", enabled: history.canGoForward(), click: () => history.goForward() },
    sep,
    { label: "Copy page address", click: () => clipboard.writeText(wc.getURL()) },
    { label: "Open page in browser", click: () => openExternal(wc.getURL()) },
    sep,
    { label: "Zoom in", accelerator: "Ctrl+Plus", click: () => zoom(0.5) },
    { label: "Zoom out", accelerator: "Ctrl+-", click: () => zoom(-0.5) },
    { label: "Actual size", accelerator: "Ctrl+0", click: () => zoom(0) },
    {
      label: "Full screen",
      accelerator: "F11",
      type: "checkbox",
      checked: Boolean(window?.isFullScreen()),
      click: () => window?.setFullScreen(!window.isFullScreen())
    },
    sep,
    ...extensionMenu(),
    { label: "Developer tools", accelerator: "F12", click: () => wc.toggleDevTools() }
  ]).popup({ window: window ?? void 0 });
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
  const key = input.key.toLowerCase();
  if (menuShortcut && key === menuShortcut.key && input.control === menuShortcut.control && input.shift === menuShortcut.shift && input.alt === menuShortcut.alt) {
    showActionMenu(wc);
    return true;
  }
  const ctrl = input.control && !input.alt;
  const history = wc.navigationHistory;
  if (key === "f5" || ctrl && !input.shift && key === "r") wc.reload();
  else if (ctrl && input.shift && key === "r") wc.reloadIgnoringCache();
  else if (ctrl && input.shift && key === "delete") runAction("clear-cache", wc);
  else if (key === "f12" || ctrl && input.shift && key === "i") wc.toggleDevTools();
  else if (key === "f11") {
    const w = BrowserWindow.fromWebContents(wc);
    w?.setFullScreen(!w.isFullScreen());
  } else if (ctrl && (key === "=" || key === "+")) wc.setZoomLevel(wc.getZoomLevel() + 0.5);
  else if (ctrl && key === "-") wc.setZoomLevel(wc.getZoomLevel() - 0.5);
  else if (ctrl && key === "0") wc.setZoomLevel(0);
  else if (input.alt && !input.control && key === "arrowleft") history.goBack();
  else if (input.alt && !input.control && key === "arrowright") history.goForward();
  else if (input.alt && !input.control && key === "home") wc.loadURL(cfg.url);
  else return false;
  return true;
}
function contextMenu(wc, p) {
  const sep = { type: "separator" };
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
  items.push(
    { label: `Go to ${cfg.name}`, click: () => wc.loadURL(cfg.url) },
    { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: "Reload", click: () => wc.reload() },
    ...Object.entries(lib.APP_ACTIONS).map(([action, label]) => ({ label, click: () => runAction(action, wc) })),
    { label: "Inspect", click: () => wc.inspectElement(p.x, p.y) }
  );
  Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(wc) ?? void 0 });
}
app.on("web-contents-created", (_event, wc) => {
  if (!cfg.userAgent) followGoogleSignIn(wc);
  wc.setWindowOpenHandler(({ url }) => {
    const appWindow = { action: "allow", overrideBrowserWindowOptions: { icon, autoHideMenuBar: true } };
    if (url === "about:blank") return appWindow;
    const web = /^https?:/i.test(url);
    if (web && cfg.openLinks === "window") return appWindow;
    if (web && cfg.openLinks === "same") {
      wc.loadURL(url);
      return { action: "deny" };
    }
    if (cfg.openLinks === "browser" && isInternal(url)) return appWindow;
    openExternal(url);
    return { action: "deny" };
  });
  wc.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && shortcut(wc, input)) event.preventDefault();
  });
  wc.on("context-menu", (_e, params) => contextMenu(wc, params));
});
function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}
let stoppedPids = [];
function pagePids() {
  const pids = /* @__PURE__ */ new Set();
  for (const window of BrowserWindow.getAllWindows()) {
    for (const frame of window.webContents.mainFrame.framesInSubtree) pids.add(frame.osProcessId);
  }
  return [...pids].filter((pid) => pid > 0);
}
function signalAll(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
    }
  }
}
function pausePage() {
  if (stoppedPids.length) return;
  stopLimiter();
  stoppedPids = pagePids();
  signalAll(stoppedPids, "SIGSTOP");
}
function resumePage() {
  signalAll(stoppedPids, "SIGCONT");
  stoppedPids = [];
  runLimiter();
}
const LIMIT_PERIOD_MS = 100;
const LIMIT_MIN_RUN_MS = 2;
const percent = (value) => value > 0 && value < 100 ? value : 100;
const alwaysPercent = percent(cfg.cpuPercent);
const awayPercent = cfg.backgroundThrottling ? Math.min(alwaysPercent, percent(cfg.unfocusedCpuPercent)) : alwaysPercent;
let cpuPercentNow = alwaysPercent;
let limiterTimer = null;
let limitedPids = [];
let quitting = false;
function stopLimiter() {
  clearTimeout(limiterTimer);
  limiterTimer = null;
  signalAll(limitedPids, "SIGCONT");
  limitedPids = [];
}
function runLimiter() {
  stopLimiter();
  if (quitting || cpuPercentNow >= 100 || stoppedPids.length) return;
  const runMs = Math.max(LIMIT_MIN_RUN_MS, LIMIT_PERIOD_MS * cpuPercentNow / 100);
  const periodMs = Math.max(LIMIT_PERIOD_MS, runMs * 100 / cpuPercentNow);
  const slice = () => {
    signalAll(limitedPids, "SIGCONT");
    limitedPids = pagePids();
    limiterTimer = setTimeout(() => {
      signalAll(limitedPids, "SIGSTOP");
      limiterTimer = setTimeout(slice, periodMs - runMs);
    }, runMs);
  };
  slice();
}
function setCpuPercent(value) {
  if (value === cpuPercentNow) return;
  cpuPercentNow = value;
  runLimiter();
}
function releasePage() {
  quitting = true;
  stopLimiter();
  signalAll(stoppedPids, "SIGCONT");
  stoppedPids = [];
}
app.on("before-quit", releasePage);
process.on("exit", releasePage);
function watchFocus(window) {
  const wc = window.webContents;
  const GRACE_MS = 3e3;
  let timer = null;
  let pauseTimer = null;
  let watchdog = null;
  let idleSince = 0;
  let throttled = false;
  let soundCheck = null;
  let cover = null;
  let round = 0;
  const COVER_STEP_MS = 1500;
  const withinMoment = (promise) => Promise.race([
    promise.catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), COVER_STEP_MS))
  ]);
  const showPicture = async (view, picture, width) => {
    const page = '<body style="margin:0;overflow:hidden"><img id="picture" style="display:block">';
    await view.webContents.loadURL(`data:text/html,${encodeURIComponent(page)}`);
    await view.webContents.executeJavaScript(
      `picture.style.width = '${width}px'; picture.src = ${JSON.stringify(picture.toDataURL())}; picture.decode()`
    );
  };
  const dropCover = (view) => {
    try {
      if (!window.isDestroyed()) window.contentView.removeChildView(view);
      view.webContents.close();
    } catch {
    }
  };
  const pause = async () => {
    if (wc.isDevToolsOpened()) return;
    const mine = ++round;
    const overtaken = () => mine !== round || window.isDestroyed();
    stopLimiter();
    const picture = await withinMoment(wc.capturePage());
    if (overtaken()) return;
    if (picture && !picture.isEmpty()) {
      const [width, height] = window.getContentSize();
      const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      view.setBackgroundColor("#00000000");
      view.setBounds({ x: 0, y: 0, width, height });
      cover = view;
      window.contentView.addChildView(view);
      await withinMoment(showPicture(view, picture, width));
      if (overtaken()) return;
    }
    pausePage();
    if (cfg.skipMissedUpdates) dropBacklog();
    watchdog = setInterval(() => {
      if (window.isDestroyed()) clearInterval(watchdog);
      else if (BrowserWindow.getFocusedWindow()) back();
    }, 1e3);
  };
  const away = () => {
    idleSince = Date.now() - GRACE_MS;
    if (awayPercent < alwaysPercent) {
      throttled = true;
      const apply = () => setCpuPercent(wc.isCurrentlyAudible() ? alwaysPercent : awayPercent);
      apply();
      soundCheck = setInterval(apply, 3e3);
    }
    if (cfg.pauseWhenUnfocused) {
      pauseTimer = setTimeout(pause, Math.max(0, cfg.pauseAfterSeconds * 1e3 - GRACE_MS));
    }
  };
  const dropBacklog = () => session.defaultSession.closeAllConnections().catch(() => {
  });
  const back = async () => {
    clearTimeout(timer);
    clearTimeout(pauseTimer);
    clearInterval(watchdog);
    watchdog = null;
    const mine = ++round;
    clearInterval(soundCheck);
    if (cfg.skipMissedUpdates && idleSince && (stoppedPids.length || throttled)) {
      await dropBacklog();
      if (mine !== round || window.isDestroyed()) return;
    }
    resumePage();
    if (throttled) {
      throttled = false;
      setCpuPercent(alwaysPercent);
    }
    const idleMs = idleSince ? Date.now() - idleSince : 0;
    idleSince = 0;
    const reloading = cfg.reloadAfterIdleMinutes > 0 && idleMs >= cfg.reloadAfterIdleMinutes * 6e4 && !window.isDestroyed();
    if (cover) {
      const view = cover;
      cover = null;
      let dropped = false;
      const drop = () => {
        if (dropped) return;
        dropped = true;
        dropCover(view);
      };
      if (reloading) wc.once("did-finish-load", drop);
      setTimeout(drop, reloading ? 1e4 : 300);
    }
    if (reloading) wc.reload();
  };
  window.on("blur", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!window.isDestroyed() && !BrowserWindow.getFocusedWindow()) away();
    }, GRACE_MS);
  });
  window.on("focus", back);
  window.on("restore", back);
  window.on("resize", () => {
    if (!cover) return;
    const [width, height] = window.getContentSize();
    cover.setBounds({ x: 0, y: 0, width, height });
  });
  window.on("close", resumePage);
  window.on("closed", () => {
    clearTimeout(timer);
    clearTimeout(pauseTimer);
    clearInterval(watchdog);
    clearInterval(soundCheck);
  });
}
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
function showLoadingScreen(window) {
  const dark = nativeTheme.shouldUseDarkColors || cfg.extensions.includes("darkreader");
  const text = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const types = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
  let logo = `<div class="logo letter">${text((cfg.name.trim()[0] || "?").toUpperCase())}</div>`;
  try {
    const type = iconFile && types[path.extname(iconFile).toLowerCase()];
    if (type) logo = `<img class="logo" alt="" src="data:${type};base64,${fs.readFileSync(iconFile).toString("base64")}">`;
  } catch {
  }
  const page = `<!doctype html><meta charset="utf-8"><style>
    html, body { height: 100%; margin: 0; background: transparent; }
    body { display: grid; place-items: center; background: ${dark ? "#15171b" : "#f4f5f8"}; color: ${dark ? "#e8eaf0" : "#22252b"};
      font: 500 15px system-ui, sans-serif; transition: opacity .3s ease; user-select: none; }
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
  </style><body><div class="box">${logo}<div class="name">${text(cfg.name)}</div><div class="track"><div class="bar"></div></div></div>`;
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  view.setBackgroundColor(dark ? "#15171b" : "#f4f5f8");
  const fit = () => {
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
  };
  fit();
  window.on("resize", fit);
  window.contentView.addChildView(view);
  view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(page));
  const shown = Date.now();
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
        window.removeListener("resize", fit);
        window.contentView.removeChildView(view);
        view.webContents.close();
      }, 320);
    }, Math.max(0, 500 - (Date.now() - shown)));
  };
  const tooLong = setTimeout(remove, 2e4);
  window.webContents.once("did-stop-loading", remove);
}
async function createWindow() {
  const state = readState();
  nativeTheme.themeSource = cfg.colorScheme;
  if (extension("twitch")) await extras.enableTwitchAdBlock().catch(() => {
  });
  if (extension("adblock")) await extras.enableAdBlock(session.defaultSession, {
    hideLeftovers: cfg.adBlockHideLeftovers,
    inPageAds: cfg.adBlockInPageAds,
    exceptions: cfg.adBlockExceptions
  }).catch((e) => console.error(`appd: no ad blocking: ${e.message}`));
  win = new BrowserWindow({
    width: state.width || cfg.width,
    height: state.height || cfg.height,
    title: cfg.name,
    icon,
    ...extension("darkreader") || cfg.colorScheme === "dark" ? { backgroundColor: "#181a1b" } : {},
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: cfg.backgroundThrottling,
      ...cfg.actionButton !== "off" || extension("adblock") || extension("twitch") ? { preload: path.join(__dirname, "webapp-preload.js") } : {}
    }
  });
  if (cfg.startMaximized || state.maximized) win.maximize();
  if (cfg.fixedTitle) win.on("page-title-updated", (event) => event.preventDefault());
  await loadCustomExtensions();
  if (extension("sponsorblock")) {
    extras.enableSponsorBlock(win.webContents, cfg);
  }
  if (extension("darkreader")) {
    extras.enableDarkMode(win.webContents, { brightness: cfg.darkBrightness, contrast: cfg.darkContrast, sepia: cfg.darkSepia });
  }
  if (cfg.pauseWhenUnfocused || cfg.reloadAfterIdleMinutes > 0 || awayPercent < alwaysPercent) watchFocus(win);
  win.on("close", () => {
    const { width, height } = win.getNormalBounds();
    try {
      fs.writeFileSync(statePath, JSON.stringify({ width, height, maximized: win.isMaximized() }));
    } catch {
    }
  });
  win.webContents.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith("data:")) return;
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
  if (cfg.loadingScreen) showLoadingScreen(win);
  win.loadURL(cfg.url);
  runLimiter();
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (argv.includes("--appd-action=quit")) return app.quit();
    if (!win) return;
    resumePage();
    const action = actionIn(argv);
    if (action) runAction(action, win.webContents);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.on("window-all-closed", () => app.quit());
  if (lib.WINDOWS) {
    fs.writeFileSync(lib.pidFile(id), String(process.pid));
    app.on("quit", () => fs.rmSync(lib.pidFile(id), { force: true }));
  }
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
}

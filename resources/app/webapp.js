"use strict";
const { app, BrowserWindow, Menu, shell, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const id = process.env.APPD_ID;
let cfg;
try {
  cfg = lib.load(id);
  lib.writeDesktop(id, cfg);
} catch (e) {
  console.error(`appd: ${e.message}`);
  process.exit(1);
}
const desktopId = lib.desktopId(id);
app.setName(desktopId);
process.env.CHROME_DESKTOP = `${desktopId}.desktop`;
app.setDesktopName?.(`${desktopId}.desktop`);
app.setPath("userData", lib.profileDir(id));
for (const flag of cfg.flags) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(flag);
  if (!m) console.error(`appd: ignoring flag "${flag}"`);
  else if (m[2] === void 0) app.commandLine.appendSwitch(m[1]);
  else app.commandLine.appendSwitch(m[1], m[2]);
}
if (cfg.jsHeapMb > 0) {
  app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${cfg.jsHeapMb}`);
}
app.userAgentFallback = cfg.userAgent || app.userAgentFallback.split(" ").filter((token) => !/^(Electron|appd[\w-]*)\//i.test(token)).join(" ");
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
function shortcut(wc, input) {
  const key = input.key.toLowerCase();
  const ctrl = input.control && !input.alt;
  const history = wc.navigationHistory;
  if (key === "f5" || ctrl && !input.shift && key === "r") wc.reload();
  else if (ctrl && input.shift && key === "r") wc.reloadIgnoringCache();
  else if (key === "f12" || ctrl && input.shift && key === "i") wc.toggleDevTools();
  else if (key === "f11") {
    const w = BrowserWindow.fromWebContents(wc);
    w?.setFullScreen(!w.isFullScreen());
  } else if (ctrl && (key === "=" || key === "+")) wc.setZoomLevel(wc.getZoomLevel() + 0.5);
  else if (ctrl && key === "-") wc.setZoomLevel(wc.getZoomLevel() - 0.5);
  else if (ctrl && key === "0") wc.setZoomLevel(0);
  else if (input.alt && !input.control && key === "arrowleft") history.goBack();
  else if (input.alt && !input.control && key === "arrowright") history.goForward();
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
    { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: "Reload", click: () => wc.reload() },
    { label: "Inspect", click: () => wc.inspectElement(p.x, p.y) }
  );
  Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(wc) ?? void 0 });
}
app.on("web-contents-created", (_event, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || isInternal(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { icon, autoHideMenuBar: true } };
    }
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
function createWindow() {
  const state = readState();
  win = new BrowserWindow({
    width: state.width || cfg.width,
    height: state.height || cfg.height,
    title: cfg.name,
    icon,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: cfg.backgroundThrottling
    }
  });
  if (state.maximized) win.maximize();
  if (cfg.fixedTitle) win.on("page-title-updated", (event) => event.preventDefault());
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
  win.loadURL(cfg.url);
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.on("window-all-closed", () => app.quit());
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
}

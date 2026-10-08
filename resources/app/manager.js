"use strict";
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, nativeTheme, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const update = require("./update");
const icons = require("./icons");
const desktopFile = `${lib.MANAGER_DESKTOP_ID}.desktop`;
app.setName(lib.MANAGER_DESKTOP_ID);
process.env.CHROME_DESKTOP = desktopFile;
app.setDesktopName?.(desktopFile);
if (lib.WINDOWS) app.setAppUserModelId(lib.windowsAppId("manager"));
app.setPath("userData", lib.managerDataDir);
app.userAgentFallback = app.userAgentFallback.split(" ").filter((token) => !/^(Electron|appd[\w-]*)\//i.test(token)).join(" ");
nativeTheme.themeSource = lib.appearance().mode;
let win;
let pendingEdit = null;
function editRequest(argv) {
  const arg = argv.find((value) => value.startsWith("--appd-edit="));
  const [id, extension = ""] = arg ? arg.slice("--appd-edit=".length).split(":") : [];
  return /^[a-z0-9][a-z0-9_-]*$/.test(id || "") && /^[a-z]*$/.test(extension) ? { id, extension } : null;
}
pendingEdit = editRequest(process.argv);
let lastUse = { at: 0, apps: {} };
const UNDO_MS = 12e3;
lib.emptyTrash();
let unsaved = false;
let leaving = false;
async function mayLeave() {
  if (!unsaved) return true;
  const response = await ask({
    icon: "save",
    buttons: ["Save", "Discard", "Cancel"],
    message: "Save the changes?",
    detail: "The app you are editing has changes that are not saved."
  });
  if (response === 2) return false;
  if (response === 0) return Boolean(await win.webContents.executeJavaScript("saveBeforeClose()").catch(() => false));
  return true;
}
function author() {
  const value = require("./package.json").author || {};
  let name;
  let url;
  let linkText = "";
  if (typeof value === "string") {
    name = value.replace(/\s*[<(].*$/, "").trim();
    url = (/\((https?:[^)]+)\)/.exec(value) || [])[1] || "";
  } else {
    name = String(value.name || "");
    url = String(value.url || "");
    linkText = String(value.linkText || "");
  }
  if (!/^https?:\/\//i.test(url)) url = "";
  if (url && !linkText) linkText = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return { name, url, linkText: url ? linkText : "" };
}
const previews = /* @__PURE__ */ new Map();
function iconPreview(file) {
  if (!file) return null;
  try {
    const { mtimeMs, size } = fs.statSync(file);
    const stamp = `${mtimeMs}:${size}`;
    const kept = previews.get(file);
    if (kept && kept.stamp === stamp) return kept.url;
    let url;
    if (/\.svg$/i.test(file)) url = `data:image/svg+xml;base64,${fs.readFileSync(file).toString("base64")}`;
    else {
      const image = nativeImage.createFromPath(file);
      url = image.isEmpty() ? null : image.resize({ width: 96 }).toDataURL();
    }
    previews.set(file, { stamp, url });
    return url;
  } catch {
    return null;
  }
}
function state() {
  const apps = lib.list().map((id) => {
    try {
      const cfg = lib.load(id);
      return { id, cfg, iconUrl: iconPreview(lib.iconFile(id, cfg)) };
    } catch (e) {
      return { id, error: e.message };
    }
  });
  return {
    apps,
    defaults: lib.fresh(),
    rules: lib.RULES,
    appearance: lib.appearance(),
    prefs: lib.prefs(),
    modes: lib.MODES,
    palettes: lib.PALETTES,
    templates: require("./templates"),
    imported: lib.importedExtensions(),
    extensions: lib.EXTENSIONS,
    sponsorCategories: Object.fromEntries(Object.entries(lib.SPONSOR_CATEGORIES).map(([name, info]) => [name, { ...info, choices: lib.sponsorChoices(name) }])),
    appsDir: lib.appsDir(),
    appsDirFixed: Boolean(process.env.APPD_APPS_DIR),
    version: app.getVersion(),
    updateRepo: update.REPO,
    author: author(),
    edit: pendingEdit,
    runtime: { electron: process.versions.electron, chromium: process.versions.chrome },
    projectUrl: `https://github.com/${update.REPO}`,
    extensionKeys: lib.EXTENSION_KEYS,
    extensionDefaults: lib.extensionDefaults()
  };
}
async function changeAppsDir(dir) {
  if (process.env.APPD_APPS_DIR) throw new Error("The location is fixed by the APPD_APPS_DIR environment variable.");
  const { moved, left } = await lib.moveApps(dir || lib.defaultAppsDir);
  lib.setAppsDir(dir);
  lib.sync();
  const parts = [];
  if (moved.length) parts.push(`Moved ${moved.length === 1 ? "1 app" : `${moved.length} apps`}.`);
  if (left.length) parts.push(`Still in the old folder: ${left.join(", ")}.`);
  return { ...state(), message: parts.join(" "), problem: left.length > 0 };
}
function ask(question) {
  const cancel = question.cancel ?? question.buttons.length - 1;
  return win.webContents.executeJavaScript(`window.ask(${JSON.stringify({ ...question, cancel })})`).catch(() => cancel);
}
async function offerRestart(ids) {
  if (!ids.length) return "";
  const names = ids.map((id) => {
    try {
      return lib.load(id).name;
    } catch {
      return id;
    }
  });
  const one = ids.length === 1;
  const mode = lib.prefs().restartOnSave;
  const kept = one ? "The app keeps its old settings until it is started again." : "The running apps keep their old settings until they are started again.";
  if (mode === "never") return kept;
  const response = mode === "always" ? 0 : await ask({
    icon: "restart",
    buttons: [one ? "Restart now" : "Restart them now", "Later"],
    message: one ? `Restart "${names[0]}" now?` : `Restart ${ids.length} running apps now?`,
    detail: (one ? "The app is running and keeps" : names.join(", ") + " are running and keep") + " the old settings until restarted. Restarting closes the window; anything not saved in the page is lost."
  });
  if (response !== 0) return kept;
  for (const id of ids) restartApp(id);
  return one ? "The app restarts with the new settings, on the page it was on." : "The running apps restart with the new settings, each on the page it was on.";
}
function startApp(id, extra = []) {
  lib.load(id);
  const env = { ...process.env };
  delete env.CHROME_DESKTOP;
  const [command, args] = lib.runCommand(id, extra);
  const child = spawn(command, args, { detached: true, stdio: "ignore", env });
  child.on("error", () => {
  });
  child.unref();
}
const restartApp = (id) => startApp(id, ["--appd-action=restart"]);
const handlers = {
  state() {
    const value = state();
    pendingEdit = null;
    return value;
  },
  async saveExtensionDefaults(input) {
    const loaded = (id) => {
      try {
        const cfg = lib.load(id);
        return JSON.stringify(cfg.extensions.flatMap((name) => (lib.EXTENSION_KEYS[name] || []).map((key) => cfg[key])));
      } catch {
        return "";
      }
    };
    const before = Object.fromEntries(lib.list().filter((id) => lib.runningPid(id)).map((id) => [id, loaded(id)]));
    lib.setExtensionDefaults(input);
    const restart = await offerRestart(Object.keys(before).filter((id) => loaded(id) !== before[id]));
    return { state: state(), restart };
  },
  setUnsaved(value) {
    unsaved = Boolean(value);
  },
  async save(id, input) {
    const cfg = { ...lib.fresh(), ...id ? lib.load(id) : {} };
    for (const key of Object.keys(lib.DEFAULTS)) {
      if (key in input) cfg[key] = input[key];
    }
    if (!cfg.name) throw new Error("Give the app a name.");
    if (!cfg.url) throw new Error("Give the app a URL.");
    id ||= lib.newId(cfg.name);
    lib.save(id, cfg);
    lib.sync();
    const restart = await offerRestart(lib.runningPid(id) ? [id] : []);
    return { id, state: state(), restart };
  },
  async remove(id) {
    lib.checkId(id);
    const response = !lib.prefs().confirmRemove ? 0 : await ask({
      icon: "delete",
      danger: true,
      buttons: ["Remove", "Cancel"],
      message: `Remove "${id}"?`,
      detail: `This deletes ${lib.appDir(id)}, including the app's logins and data, and takes it out of the menu.`
    });
    if (response !== 0) return { removed: false };
    if (lib.close(id)) {
      for (let tries = 0; tries < 30 && lib.runningPid(id); tries++) await new Promise((done) => setTimeout(done, 100));
    }
    const undo = lib.remove(id);
    lib.sync();
    if (undo) setTimeout(() => lib.emptyTrash(id), UNDO_MS + 3e3);
    return { removed: true, undo, state: state() };
  },
  undoRemove(id) {
    lib.restore(id);
    lib.sync();
    return { state: state() };
  },
  setPrefs: (next) => lib.setPrefs(Object(next)),
  setAppearance(next) {
    const now = lib.setAppearance({ ...next.mode ? { mode: String(next.mode) } : {}, ...next.palette ? { palette: String(next.palette) } : {} });
    nativeTheme.themeSource = now.mode;
    return now;
  },
  async exportApps() {
    const { filePath } = await dialog.showSaveDialog(win, {
      title: "Export the apps",
      defaultPath: `appd-manager-apps-${(/* @__PURE__ */ new Date()).toLocaleDateString("sv")}.json`,
      filters: [{ name: "AppD-Manager apps", extensions: ["json"] }]
    });
    if (!filePath) return null;
    const data = lib.exportApps();
    fs.writeFileSync(filePath, JSON.stringify(data));
    return `${data.apps.length} ${data.apps.length === 1 ? "app" : "apps"} exported to ${filePath}.`;
  },
  async importApps() {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Import apps",
      properties: ["openFile"],
      filters: [{ name: "AppD-Manager apps", extensions: ["json"] }]
    });
    if (!filePaths[0]) return null;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    } catch {
      throw new Error("That file cannot be read as exported apps.");
    }
    const { added, skipped } = lib.importApps(data);
    lib.sync();
    const parts = [`${added.length} ${added.length === 1 ? "app" : "apps"} imported${added.length ? `: ${added.join(", ")}` : ""}.`];
    if (skipped.length) parts.push(`Left out: ${skipped.join("; ")}.`);
    return { state: state(), message: parts.join(" "), problem: skipped.length > 0 };
  },
  duplicate(id) {
    const copy = lib.duplicate(id);
    lib.sync();
    return { id: copy, state: state() };
  },
  async clearData(id) {
    lib.checkId(id);
    const response = await ask({
      icon: "delete",
      danger: true,
      buttons: ["Delete the data", "Cancel"],
      message: `Delete the data of "${lib.load(id).name}"?`,
      detail: "This signs the app out everywhere and deletes its cookies, cache and remembered window size. Its settings and icon stay. The app is closed first if it is running."
    });
    if (response !== 0) return false;
    if (lib.close(id)) {
      for (let tries = 0; tries < 50 && lib.runningPid(id); tries++) await new Promise((done) => setTimeout(done, 100));
    }
    lib.clearData(id);
    return true;
  },
  async askUnsaved() {
    const response = await ask({
      icon: "save",
      buttons: ["Save", "Discard", "Cancel"],
      message: "Save the changes?",
      detail: "The app you are editing has changes that are not saved."
    });
    return ["save", "discard", "stay"][response];
  },
  usage() {
    const now = Date.now();
    const use = lib.resourceUse();
    const result = {};
    for (const [id, { memory, cpuSeconds }] of Object.entries(use)) {
      const last = lastUse.apps[id];
      const seconds = (now - lastUse.at) / 1e3;
      result[id] = { memory, cpu: last !== void 0 && seconds > 0.5 ? Math.max(0, (cpuSeconds - last) / seconds * 100) : null };
    }
    lastUse = { at: now, apps: Object.fromEntries(Object.entries(use).map(([id, { cpuSeconds }]) => [id, cpuSeconds])) };
    return result;
  },
  runningApps: () => lib.list().filter((id) => lib.runningPid(id)),
  close(id) {
    lib.checkId(id);
    lib.close(id);
  },
  restart(id) {
    lib.checkId(id);
    restartApp(id);
  },
  launch(id) {
    startApp(id);
  },
  async pickIcon() {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Choose an icon",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "svg"] }]
    });
    return filePaths[0] ? { path: filePaths[0], url: iconPreview(filePaths[0]) } : null;
  },
  fetchIcons: (url) => icons.fetchIcons(url),
  async pickAppsDir() {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Choose the folder that holds your apps",
      defaultPath: lib.appsDir(),
      properties: ["openDirectory", "createDirectory"]
    });
    return filePaths[0] ? changeAppsDir(filePaths[0]) : null;
  },
  resetAppsDir: () => changeAppsDir(null),
  async openAppsDir() {
    fs.mkdirSync(lib.appsDir(), { recursive: true });
    const error = await shell.openPath(lib.appsDir());
    if (error) throw new Error(error);
  },
  async importExtension() {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Choose the folder of an unpacked extension (it holds manifest.json)",
      properties: ["openDirectory"]
    });
    if (!filePaths[0]) return null;
    lib.importExtension(filePaths[0]);
    return { state: state() };
  },
  async removeExtension(name) {
    const info = lib.importedExtensions()[name];
    const response = await ask({
      icon: "delete",
      danger: true,
      buttons: ["Remove", "Cancel"],
      message: `Remove the extension "${info ? info.name : name}"?`,
      detail: "It is taken out of the library and out of every app that uses it."
    });
    if (response !== 0) return null;
    lib.removeImportedExtension(String(name));
    return { state: state() };
  },
  openProjectPage() {
    shell.openExternal(`https://github.com/${update.REPO}`);
  },
  async exit() {
    const running = lib.list().filter((id) => lib.runningPid(id));
    if (running.length) {
      const response = await ask({
        icon: "exit",
        buttons: ["Exit", "Cancel"],
        message: "Exit AppD-Manager?",
        detail: `This also closes the ${running.length === 1 ? "app that is" : `${running.length} apps that are`} running.`
      });
      if (response !== 0) return false;
    }
    if (!await mayLeave()) return false;
    for (const id of running) lib.close(id);
    leaving = true;
    setTimeout(() => app.quit(), 100);
    return true;
  },
  async showLog(id) {
    lib.checkId(id);
    const file = path.join(lib.appDir(id), "events.log");
    if (!fs.existsSync(file)) throw new Error("Nothing is logged yet: the log starts the next time the app does.");
    const error = await shell.openPath(file);
    if (error) throw new Error(error);
  },
  showConfig(id) {
    lib.checkId(id);
    if (!fs.existsSync(lib.configPath(id))) throw new Error(`${lib.configPath(id)} does not exist.`);
    shell.showItemInFolder(lib.configPath(id));
  },
  openAuthorLink() {
    const { url } = author();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  },
  checkUpdate: () => update.check(),
  async askUpdate(info) {
    const how = info.blocked || `You have ${info.current}. Updating takes a moment and restarts AppD-Manager; your apps are not touched.`;
    const buttons = info.blocked ? ["OK", "Open release page"] : ["Update now", "Later", "Open release page"];
    const response = await ask({
      icon: "update",
      buttons,
      cancel: info.blocked ? 0 : 1,
      message: `AppD-Manager ${info.latest} is available`,
      release: { name: info.name, tag: info.tag, latest: info.latest, notes: info.notes },
      detail: how
    });
    if (buttons[response] === "Open release page") handlers.openReleasePage(info.url);
    return !info.blocked && response === 0;
  },
  openReleasePage(url) {
    const page = String(url || "");
    shell.openExternal(page.startsWith(`https://github.com/${update.REPO}/`) ? page : update.releasesUrl);
  },
  async installUpdate() {
    const version = await update.install();
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1500);
    return version;
  }
};
for (const [name, fn] of Object.entries(handlers)) {
  ipcMain.handle(name, async (_event, ...args) => {
    try {
      return { value: await fn(...args) };
    } catch (e) {
      return { error: e.message };
    }
  });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 900,
    minWidth: 900,
    minHeight: 520,
    title: "AppD-Manager",
    webPreferences: {
      preload: path.join(__dirname, "manager", "preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.on("close", async (event) => {
    if (!unsaved || leaving) return;
    event.preventDefault();
    if (!await mayLeave()) return;
    leaving = true;
    win.close();
  });
  win.loadFile(path.join(__dirname, "manager", "index.html"), { query: { palette: lib.appearance().palette } });
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    const edit = editRequest(argv);
    if (edit) win.webContents.executeJavaScript(`window.editApp(${JSON.stringify(edit.id)}, ${JSON.stringify(edit.extension)})`).catch(() => {
    });
  });
  app.on("window-all-closed", () => app.quit());
  Menu.setApplicationMenu(null);
  app.whenReady().then(() => {
    try {
      lib.sync();
    } catch (e) {
      console.error(`appd: ${e.message}`);
    }
    createWindow();
  });
}

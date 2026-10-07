"use strict";
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, shell } = require("electron");
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
let win;
let pendingEdit = null;
function editRequest(argv) {
  const arg = argv.find((value) => value.startsWith("--appd-edit="));
  const [id, extension = ""] = arg ? arg.slice("--appd-edit=".length).split(":") : [];
  return /^[a-z0-9][a-z0-9_-]*$/.test(id || "") && /^[a-z]*$/.test(extension) ? { id, extension } : null;
}
pendingEdit = editRequest(process.argv);
let unsaved = false;
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
function iconPreview(file) {
  if (!file) return null;
  try {
    if (/\.svg$/i.test(file)) return `data:image/svg+xml;base64,${fs.readFileSync(file).toString("base64")}`;
    const image = nativeImage.createFromPath(file);
    return image.isEmpty() ? null : image.resize({ width: 96 }).toDataURL();
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
    defaults: lib.DEFAULTS,
    extensions: lib.EXTENSIONS,
    sponsorCategories: Object.fromEntries(Object.entries(lib.SPONSOR_CATEGORIES).map(([name, info]) => [name, { ...info, choices: lib.sponsorChoices(name) }])),
    appsDir: lib.appsDir(),
    appsDirFixed: Boolean(process.env.APPD_APPS_DIR),
    version: app.getVersion(),
    updateRepo: update.REPO,
    author: author(),
    edit: pendingEdit
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
const handlers = {
  state() {
    const value = state();
    pendingEdit = null;
    return value;
  },
  setUnsaved(value) {
    unsaved = Boolean(value);
  },
  save(id, input) {
    const cfg = { ...lib.DEFAULTS, ...id ? lib.load(id) : {} };
    for (const key of Object.keys(lib.DEFAULTS)) {
      if (key in input) cfg[key] = input[key];
    }
    if (!cfg.name) throw new Error("Give the app a name.");
    if (!cfg.url) throw new Error("Give the app a URL.");
    id ||= lib.newId(cfg.name);
    lib.save(id, cfg);
    lib.sync();
    return { id, state: state() };
  },
  async remove(id) {
    lib.checkId(id);
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Cancel", "Remove"],
      defaultId: 0,
      cancelId: 0,
      message: `Remove "${id}"?`,
      detail: `This deletes ${lib.appDir(id)}, including the app's logins and data, and takes it out of the menu.`
    });
    if (response !== 1) return { removed: false };
    if (lib.close(id)) {
      for (let tries = 0; tries < 30 && lib.runningPid(id); tries++) await new Promise((done) => setTimeout(done, 100));
    }
    lib.remove(id);
    lib.sync();
    return { removed: true, state: state() };
  },
  runningApps: () => lib.list().filter((id) => lib.runningPid(id)),
  close(id) {
    lib.checkId(id);
    lib.close(id);
  },
  launch(id) {
    lib.load(id);
    const env = { ...process.env };
    delete env.CHROME_DESKTOP;
    const [command, args] = lib.runCommand(id);
    const child = spawn(command, args, { detached: true, stdio: "ignore", env });
    child.on("error", () => {
    });
    child.unref();
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
  async pickExtension() {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: "Choose the folder of an unpacked extension (it holds manifest.json)",
      properties: ["openDirectory"]
    });
    return filePaths[0] ? { folder: filePaths[0], info: lib.describeExtension(filePaths[0]) } : null;
  },
  describeExtensions(folders) {
    return Object.fromEntries(folders.map((folder) => {
      try {
        return [folder, lib.describeExtension(String(folder))];
      } catch (e) {
        return [folder, { name: path.basename(String(folder)), about: e.message }];
      }
    }));
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
    const notes = String(info.notes || "");
    const about = [
      info.name && info.name !== info.tag && info.name !== info.latest ? info.name : "",
      notes.length > 1500 ? `${notes.slice(0, 1500).trimEnd()}…
(the rest is on the release page)` : notes
    ].filter(Boolean).join("\n\n");
    const how = info.blocked || `You have ${info.current}. Updating takes a moment and restarts AppD-Manager; your apps are not touched.`;
    const buttons = info.blocked ? ["OK", "Open release page"] : ["Update now", "Later", "Open release page"];
    const { response } = await dialog.showMessageBox(win, {
      type: info.blocked ? "info" : "question",
      buttons,
      defaultId: 0,
      cancelId: info.blocked ? 0 : 1,
      message: `AppD-Manager ${info.latest} is available`,
      detail: [about, how].filter(Boolean).join("\n\n")
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
    width: 980,
    height: 700,
    minWidth: 720,
    minHeight: 480,
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
  let closing = false;
  win.on("close", async (event) => {
    if (!unsaved || closing) return;
    event.preventDefault();
    const { response } = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Save", "Discard", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      message: "Save the changes?",
      detail: "The app you are editing has changes that are not saved."
    });
    if (response === 2) return;
    if (response === 0) {
      const saved = await win.webContents.executeJavaScript("saveBeforeClose()").catch(() => false);
      if (!saved) return;
    }
    closing = true;
    win.close();
  });
  win.loadFile(path.join(__dirname, "manager", "index.html"));
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

"use strict";
const { BrowserWindow, screen, session } = require("electron");
const storeExtension = require("./store-extension");
const { launch } = require("./links");
const { text, fill } = require("../shared/text");
const t = text.app.extensions;
module.exports = function createExtensions({ id, cfg, lib, note, icon }) {
  const loaded = [];
  async function load() {
    const loader = session.defaultSession.extensions || session.defaultSession;
    const failed = (one, e) => {
      note(`the extension "${one.name || one.storeId || one.folder}" could not be loaded: ${e.message}`);
      console.error(`appd: extension ${one.name || one.storeId || one.folder}: ${e.message}`);
    };
    const wanted = [
      ...Object.entries(lib.STORE_EXTENSIONS).filter(([name]) => cfg.extensions.includes(name)).map(([name, storeId]) => ({ storeId, name: lib.EXTENSIONS[name].name })),
      ...cfg.customExtensions.map((entry) => ({ storeId: lib.storeIdOf(entry), folder: lib.extensionFolder(entry) }))
    ];
    const ready = await Promise.all(wanted.map(async (one) => {
      if (!one.storeId) return one;
      try {
        storeExtension.adoptRefreshed(one.storeId, lib.root);
        return { ...one, folder: await storeExtension(one.storeId, lib.root, note) };
      } catch (e) {
        failed(one, e);
        return null;
      }
    }));
    for (const one of ready) {
      if (!one) continue;
      try {
        const info = lib.describeExtension(one.folder);
        const extension = await loader.loadExtension(one.folder, { allowFileAccess: false });
        loaded.push({ id: extension.id, name: one.name || info.name.replace(/ [\d.]+$/, ""), options: info.options, popup: info.popup });
      } catch (e) {
        failed(one, e);
      }
    }
  }
  function openInManager(extension) {
    const [command, args] = lib.managerCommand([`--appd-edit=${id}:${extension}`]);
    launch(command, args);
  }
  function openPage(extension, page, isMenu) {
    const options = { title: extension.name, icon: icon(), autoHideMenuBar: true };
    if (isMenu) {
      Object.assign(options, { width: 380, height: 520, useContentSize: true, minimizable: false, maximizable: false, alwaysOnTop: true, skipTaskbar: true });
      try {
        const point = screen.getCursorScreenPoint();
        const area = screen.getDisplayNearestPoint(point).workArea;
        options.x = Math.round(Math.max(area.x, Math.min(point.x - options.width / 2, area.x + area.width - options.width)));
        options.y = Math.round(Math.max(area.y, Math.min(point.y + 8, area.y + area.height - options.height)));
      } catch {
      }
    } else {
      Object.assign(options, { width: 900, height: 700 });
    }
    const window = new BrowserWindow(options);
    window.loadURL(`chrome-extension://${extension.id}/${page}`);
    if (!isMenu) return;
    window.webContents.once("did-finish-load", async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (window.isDestroyed()) return;
      const [wide, high] = await window.webContents.executeJavaScript("[document.documentElement.scrollWidth, document.documentElement.scrollHeight]").catch(() => [0, 0]);
      if (window.isDestroyed()) return;
      const fit = (value, low, most) => Math.max(low, Math.min(most, Math.round(value) || low));
      window.setContentSize(fit(wide, 260, 800), fit(high, 120, 640));
    });
    window.on("blur", () => window.isDestroyed() || window.webContents.isDevToolsOpened() || window.close());
  }
  function menu() {
    const sep = { type: "separator" };
    const builtIn = cfg.extensions.filter((name) => !lib.STORE_EXTENSIONS[name]).map((name) => ({ label: fill(t.builtInSettings, { name: lib.EXTENSIONS[name].name }), click: () => openInManager(name) }));
    const others = loaded.map((extension) => {
      const own = extension.popup && { label: t.menu, click: () => openPage(extension, extension.popup, true) };
      const settings = extension.options && extension.options !== extension.popup && { label: t.settings, click: () => openPage(extension, extension.options, false) };
      if (own && settings) return { label: extension.name, submenu: [own, settings] };
      const only = own || settings;
      return only ? { label: fill(t.one, { name: extension.name, what: only.label.toLowerCase() }), click: only.click } : { label: fill(t.nothing, { name: extension.name }), enabled: false };
    });
    return [sep, {
      label: t.title,
      submenu: [
        ...builtIn,
        ...builtIn.length && others.length ? [sep] : [],
        ...others,
        ...builtIn.length || others.length ? [sep] : [],
        { label: t.more, click: () => openInManager("store") }
      ]
    }];
  }
  const isOwnPage = (contents) => !contents.isDestroyed() && contents.getURL().startsWith("chrome-extension://");
  return { load, menu, isOwnPage };
};

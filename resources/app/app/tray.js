"use strict";
const { Menu, Tray, nativeImage } = require("electron");
module.exports = function keepInTray(window, { name, icon, isQuitting, quit, note, menu = () => [], show }) {
  let tray;
  try {
    let image = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty();
    if (image.isEmpty()) image = nativeImage.createFromBitmap(Buffer.alloc(22 * 22 * 4, 176), { width: 22, height: 22 });
    tray = new Tray(image.resize({ width: 22, height: 22 }));
  } catch (e) {
    note(`no tray icon (${e.message}): closing the window closes the app`);
    return null;
  }
  const bring = show || (() => {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  const toggle = (bounds) => {
    if (window.isDestroyed()) return;
    if (window.isVisible() && !window.isMinimized()) window.hide();
    else bring(bounds);
  };
  const refresh = () => {
    if (window.isDestroyed()) return;
    const seen = window.isVisible() && !window.isMinimized();
    const own = menu();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: seen ? `Hide ${name}` : `Show ${name}`, click: () => toggle() },
      ...own.length ? [{ type: "separator" }, ...own] : [],
      { type: "separator" },
      { label: "Quit", click: quit }
    ]));
  };
  tray.setToolTip(name);
  tray.on("click", (_event, bounds) => toggle(bounds));
  for (const change of ["show", "hide", "minimize", "restore", "enter-full-screen", "leave-full-screen"]) window.on(change, refresh);
  window.webContents.on("did-navigate", refresh);
  window.on("close", (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => tray.destroy());
  refresh();
  return { refresh };
};

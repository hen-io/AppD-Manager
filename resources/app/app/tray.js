"use strict";
const { Menu, Tray, nativeImage } = require("electron");
module.exports = function keepInTray(window, { name, icon, isQuitting, quit, note }) {
  let tray;
  try {
    let image = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty();
    if (image.isEmpty()) image = nativeImage.createFromBitmap(Buffer.alloc(22 * 22 * 4, 176), { width: 22, height: 22 });
    tray = new Tray(image.resize({ width: 22, height: 22 }));
  } catch (e) {
    note(`no tray icon (${e.message}): closing the window closes the app`);
    return false;
  }
  const show = () => {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
  tray.setToolTip(name);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Show ${name}`, click: show },
    { type: "separator" },
    { label: "Quit", click: quit }
  ]));
  tray.on("click", () => !window.isDestroyed() && window.isVisible() ? window.hide() : show());
  window.on("close", (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    window.hide();
  });
  return true;
};

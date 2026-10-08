"use strict";
const { roundOverlay, pageArea } = require("./frame");
module.exports = function coverWindow(window, view) {
  const fit = () => {
    if (window.isDestroyed()) return;
    const area = pageArea(window);
    const now = view.getBounds();
    if (now.x !== area.x || now.y !== area.y || now.width !== area.width || now.height !== area.height) view.setBounds(area);
  };
  const events = ["resize", "resized", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "restore", "show"];
  for (const name of events) window.on(name, fit);
  window.contentView.on("bounds-changed", fit);
  const watch = setInterval(fit, 250);
  fit();
  const stopRounding = roundOverlay(window, view);
  return () => {
    clearInterval(watch);
    stopRounding();
    if (window.isDestroyed()) return;
    for (const name of events) window.removeListener(name, fit);
    window.contentView.removeListener("bounds-changed", fit);
  };
};

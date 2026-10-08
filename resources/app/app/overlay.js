"use strict";
const { roundOverlay } = require("./frame");
module.exports = function coverWindow(window, view) {
  const fit = () => {
    if (window.isDestroyed()) return;
    let { width, height } = window.contentView.getBounds();
    if (!width || !height) [width, height] = window.getContentSize();
    const now = view.getBounds();
    if (now.x || now.y || now.width !== width || now.height !== height) view.setBounds({ x: 0, y: 0, width, height });
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

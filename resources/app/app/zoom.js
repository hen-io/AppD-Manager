"use strict";
const { BrowserWindow } = require("electron");
module.exports = function createZoom(cfg) {
  const normal = Math.min(5, Math.max(0.25, cfg.defaultZoom / 100));
  let byHand = null;
  const apply = (wc) => wc.setZoomFactor(byHand ?? normal);
  const everyPage = (run) => BrowserWindow.getAllWindows().forEach((window) => run(window.webContents));
  function zoomBy(wc, step) {
    if (!cfg.allowZoom) return;
    wc.setZoomLevel(Math.min(8, Math.max(-7, wc.getZoomLevel() + step * 0.5)));
    byHand = wc.getZoomFactor();
    everyPage(apply);
  }
  function reset(wc) {
    byHand = null;
    apply(wc);
    everyPage(apply);
  }
  function follow(wc) {
    let shown = "";
    wc.on("did-navigate", (_e, url) => {
      if (!/^(https?|file):/i.test(url)) return;
      if (url === shown) byHand = null;
      shown = url;
      apply(wc);
    });
    wc.on("zoom-changed", (_e, direction) => zoomBy(wc, direction === "in" ? 1 : -1));
  }
  return {
    zoomBy,
    reset,
    follow,
    normalPercent: Math.round(normal * 100),
    isChanged: () => byHand !== null && Math.abs(byHand - normal) > 1e-3
  };
};

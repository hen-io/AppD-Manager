"use strict";
const { BrowserWindow, screen } = require("electron");
const keepInTray = require("./tray");
const MARGIN = 8;
const BLUR_WAIT = 180;
const SAME_CLICK = 400;
const within = (value, low, high) => Math.max(low, Math.min(value, high));
const inside = (point, area) => point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height;
function iconSpot(iconBounds) {
  try {
    const point = iconBounds?.width > 0 ? { x: Math.round(iconBounds.x + iconBounds.width / 2), y: Math.round(iconBounds.y + iconBounds.height / 2) } : screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    return inside(point, display.bounds) && !inside(point, display.workArea) ? { display, point } : null;
  } catch {
    return null;
  }
}
function bounds(cfg, spot) {
  let area;
  try {
    area = (spot?.display ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea;
  } catch {
    area = screen.getPrimaryDisplay().workArea;
  }
  const width = Math.min(cfg.trayWidth, area.width - 2 * MARGIN);
  const height = Math.min(cfg.trayHeight, area.height - 2 * MARGIN);
  const left = area.x + MARGIN;
  const right = area.x + area.width - width - MARGIN;
  const top = area.y + MARGIN;
  const bottom = area.y + area.height - height - MARGIN;
  if (spot) {
    const { x, y } = spot.point;
    if (x < area.x) return { width, height, x: left, y: within(Math.round(y - height / 2), top, bottom) };
    if (x >= area.x + area.width) return { width, height, x: right, y: within(Math.round(y - height / 2), top, bottom) };
    return { width, height, x: within(Math.round(x - width / 2), left, right), y: y < area.y ? top : bottom };
  }
  const [vertical, horizontal] = cfg.trayPosition.split("-");
  return {
    width,
    height,
    x: horizontal === "left" ? left : horizontal === "center" ? Math.round(area.x + (area.width - width) / 2) : right,
    y: vertical === "top" ? top : bottom
  };
}
module.exports = function makeTrayApp(window, cfg, options) {
  let spot = null;
  let pinned = false;
  let hidItselfAt = 0;
  const show = () => {
    if (window.isDestroyed()) return;
    window.setBounds(bounds(cfg, spot));
    window.show();
    window.focus();
  };
  const fromIcon = (iconBounds) => {
    if (Date.now() - hidItselfAt < SAME_CLICK) return;
    if (cfg.trayAtIcon) spot = iconSpot(iconBounds) ?? spot;
    show();
  };
  const tray = keepInTray(window, { ...options, show: fromIcon });
  if (!tray) {
    show();
    return null;
  }
  window.on("blur", () => {
    if (!cfg.trayHideOnBlur || pinned) return;
    setTimeout(() => {
      if (window.isDestroyed() || !window.isVisible() || pinned) return;
      if (options.isBusy() || window.webContents.isDevToolsOpened() || BrowserWindow.getFocusedWindow()) return;
      hidItselfAt = Date.now();
      window.hide();
    }, BLUR_WAIT);
  });
  if (cfg.trayShowAtStart) show();
  return {
    show,
    refresh: tray.refresh,
    isPinned: () => pinned,
    pin: (on) => {
      pinned = on;
      tray.refresh();
    }
  };
};

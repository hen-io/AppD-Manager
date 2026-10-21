"use strict";
const { BrowserWindow, screen } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const keepInTray = require("./tray");
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
function clickSpot(iconBounds) {
  try {
    const point = iconBounds?.width > 0 ? { x: Math.round(iconBounds.x + iconBounds.width / 2), y: Math.round(iconBounds.y + iconBounds.height / 2) } : screen.getCursorScreenPoint();
    return { display: screen.getDisplayNearestPoint(point), point };
  } catch {
    return null;
  }
}
const PANEL = 48;
let panelThickness = 0;
function hiddenPanel() {
  if (panelThickness) return panelThickness;
  try {
    const config = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "plasmashellrc");
    const found = [...fs.readFileSync(config, "utf8").matchAll(/^thickness=(\d+)/gm)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 200);
    panelThickness = found.length ? Math.max(...found) : PANEL;
  } catch {
    panelThickness = PANEL;
  }
  return panelThickness;
}
function panelAt(display, point) {
  const { bounds: b, workArea: w } = display;
  const edges = [
    ["bottom", b.y + b.height - point.y, b.y + b.height - (w.y + w.height)],
    ["top", point.y - b.y, w.y - b.y],
    ["left", point.x - b.x, w.x - b.x],
    ["right", b.x + b.width - point.x, b.x + b.width - (w.x + w.width)]
  ];
  const [edge, , kept] = edges.sort((one, other) => one[1] - other[1])[0];
  return { edge, thickness: kept > 0 ? kept : hiddenPanel() };
}
function overTray(cfg, spot) {
  let display;
  try {
    display = spot?.display ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  } catch {
    display = screen.getPrimaryDisplay();
  }
  const b = display.bounds;
  const w = display.workArea;
  const point = spot?.point ?? (w.y > b.y ? { x: b.x + b.width - 1, y: b.y } : w.x > b.x ? { x: b.x, y: b.y + b.height - 1 } : { x: b.x + b.width - 1, y: b.y + b.height - 1 });
  const margin = cfg.trayMargin;
  const { edge, thickness } = panelAt(display, point);
  const width = Math.max(100, Math.min(cfg.trayWidth, b.width - 2 * margin - (["left", "right"].includes(edge) ? thickness : 0)));
  const height = Math.max(100, Math.min(cfg.trayHeight, b.height - 2 * margin - (["top", "bottom"].includes(edge) ? thickness : 0)));
  const across = within(Math.round(point.x - width / 2), b.x + margin, b.x + b.width - width - margin);
  const down = within(Math.round(point.y - height / 2), b.y + margin, b.y + b.height - height - margin);
  if (edge === "top") return { width, height, x: across, y: b.y + thickness + margin };
  if (edge === "left") return { width, height, x: b.x + thickness + margin, y: down };
  if (edge === "right") return { width, height, x: b.x + b.width - thickness - margin - width, y: down };
  return { width, height, x: across, y: b.y + b.height - thickness - margin - height };
}
const screens = () => screen.getAllDisplays().sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
function bounds(cfg, spot, outset = 0) {
  const page = pageBounds(cfg, spot);
  return { x: page.x - outset, y: page.y - outset, width: page.width + 2 * outset, height: page.height + 2 * outset };
}
function pageBounds(cfg, spot) {
  if (cfg.trayPosition === "tray") return overTray(cfg, spot);
  const MARGIN = cfg.trayMargin;
  let area;
  try {
    const all = cfg.trayScreen > 0 ? screens() : [];
    const named = all.length ? all[Math.min(cfg.trayScreen, all.length) - 1] : null;
    area = (named ?? spot?.display ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea;
  } catch {
    area = screen.getPrimaryDisplay().workArea;
  }
  const width = Math.max(100, Math.min(cfg.trayWidth, area.width - 2 * MARGIN));
  const height = Math.max(100, Math.min(cfg.trayHeight, area.height - 2 * MARGIN));
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
  if (cfg.trayPosition === "custom") {
    return { width, height, x: Math.round(left + (right - left) * cfg.trayX / 100), y: Math.round(top + (bottom - top) * cfg.trayY / 100) };
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
  let wake = () => false;
  const show = () => {
    if (window.isDestroyed()) return;
    window.setBounds(bounds(cfg, spot, options.outset));
    window.show();
    wake();
    window.focus();
    window.setSkipTaskbar(true);
  };
  const fromIcon = (iconBounds) => {
    if (Date.now() - hidItselfAt < SAME_CLICK) return;
    if (cfg.trayPosition === "tray") spot = clickSpot(iconBounds) ?? spot;
    else if (cfg.trayAtIcon && cfg.trayScreen === 0 && cfg.trayPosition !== "custom") spot = iconSpot(iconBounds) ?? spot;
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
  if (cfg.trayCloseAfterSeconds > 0) {
    const wc = window.webContents;
    let closed = "";
    let timer = null;
    const close = () => {
      if (window.isDestroyed() || window.isVisible() || closed) return;
      if (wc.isCurrentlyAudible() || wc.isLoadingMainFrame()) {
        timer = setTimeout(close, 3e4);
        return;
      }
      const url = wc.getURL();
      if (!/^https?:/i.test(url)) return;
      closed = url;
      options.note(`page closed: the window was not shown for ${cfg.trayCloseAfterSeconds} s (trayCloseAfterSeconds)`);
      options.resume?.();
      wc.loadURL("about:blank").catch(() => {
      });
    };
    const count = () => {
      clearTimeout(timer);
      timer = setTimeout(close, cfg.trayCloseAfterSeconds * 1e3);
    };
    wake = () => {
      clearTimeout(timer);
      if (!closed || window.isDestroyed()) return false;
      const url = cfg.trayOpenAt === "home" ? cfg.url : closed;
      closed = "";
      options.resume?.();
      options.because?.("the window is shown again after its page was closed");
      wc.once("did-finish-load", () => wc.navigationHistory.clear());
      wc.loadURL(url).catch(() => {
      });
      return true;
    };
    window.on("hide", count);
    window.on("show", wake);
    window.on("closed", () => clearTimeout(timer));
    if (!cfg.trayShowAtStart) count();
  }
  if (cfg.trayShowAtStart) show();
  const toggle = () => {
    if (window.isDestroyed()) return;
    if (window.isVisible()) window.hide();
    else show();
  };
  return {
    show,
    toggle,
    refresh: tray.refresh,
    isPinned: () => pinned,
    pin: (on) => {
      pinned = on;
      tray.refresh();
    }
  };
};
module.exports.bounds = bounds;
module.exports.clickSpot = clickSpot;

"use strict";
const { BrowserWindow, screen } = require("electron");
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
const screens = () => screen.getAllDisplays().sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
function bounds(cfg, spot, outset = 0) {
  const page = pageBounds(cfg, spot);
  return { x: page.x - outset, y: page.y - outset, width: page.width + 2 * outset, height: page.height + 2 * outset };
}
function pageBounds(cfg, spot) {
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
  const page = window.webContents;
  let leadsTo = "";
  let headingHome = Boolean(options.atHome);
  page.on("did-stop-loading", () => {
    if (!headingHome) return;
    headingHome = false;
    leadsTo = page.getURL();
  });
  const sameAddress = (a, b) => {
    try {
      return new URL(a).href === new URL(b).href;
    } catch {
      return a === b;
    }
  };
  const goHome = () => {
    if (cfg.trayOpenAt !== "home" || page.isLoadingMainFrame()) return;
    const now = page.getURL();
    if (!/^https?:/i.test(now) || sameAddress(now, cfg.url) || leadsTo && sameAddress(now, leadsTo)) return;
    options.resume?.();
    options.because?.("the window is opened again: back to the app's own page (trayOpenAt)");
    headingHome = true;
    page.loadURL(cfg.url).catch(() => {
    });
  };
  const show = () => {
    if (window.isDestroyed()) return;
    const opening = !window.isVisible();
    window.setBounds(bounds(cfg, spot, options.outset));
    window.show();
    if (!wake() && opening) goHome();
    window.focus();
    window.setSkipTaskbar(true);
  };
  const fromIcon = (iconBounds) => {
    if (Date.now() - hidItselfAt < SAME_CLICK) return;
    if (cfg.trayAtIcon && cfg.trayScreen === 0 && cfg.trayPosition !== "custom") spot = iconSpot(iconBounds) ?? spot;
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
      headingHome = url === cfg.url;
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

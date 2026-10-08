"use strict";
const { app } = require("electron");
const FALLBACK_COLOUR = "#7a7f87";
const STYLES = ["solid", "double", "dashed", "dotted", "groove", "ridge", "glow"];
const frames = /* @__PURE__ */ new WeakMap();
const isBare = (cfg) => cfg.trayApp || !cfg.windowDecorations;
const radiusOf = (cfg) => isBare(cfg) ? cfg.windowRadius : 0;
const widthOf = (cfg) => isBare(cfg) ? cfg.windowBorderWidth : 0;
const isColour = (value) => /^#[0-9a-f]{6}$/i.test(value);
const hasLook = (cfg) => radiusOf(cfg) > 0 || widthOf(cfg) > 0;
function frameOptions(cfg) {
  return radiusOf(cfg) > 0 ? { transparent: true, backgroundColor: "#00000000" } : {};
}
function takesShape() {
  if (process.platform === "win32") return true;
  if (process.platform !== "linux") return false;
  const platform = app.commandLine.getSwitchValue("ozone-platform");
  return platform === "x11" || !platform && !process.env.WAYLAND_DISPLAY;
}
function roundedRects(width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)));
  const rects = [];
  for (let row = 0; row < r; row++) {
    const up = r - row - 1;
    const inset = Math.max(0, Math.floor(r - Math.sqrt(r * r - up * up)));
    rects.push({ x: inset, y: row, width: width - 2 * inset, height: 1 }, { x: inset, y: height - 1 - row, width: width - 2 * inset, height: 1 });
  }
  if (height > 2 * r) rects.push({ x: 0, y: r, width, height: height - 2 * r });
  return rects;
}
function lineCss(cfg, colour, radius) {
  const width = widthOf(cfg);
  if (!(width > 0)) return "";
  const style = STYLES.includes(cfg.windowBorderStyle) ? cfg.windowBorderStyle : "solid";
  const strength = Math.max(0, Math.min(100, Number(cfg.windowBorderOpacity)));
  const paint = strength < 100 ? `color-mix(in srgb, ${colour} ${strength}%, transparent)` : colour;
  const line = style === "glow" ? `border: 1px solid ${paint} !important; box-shadow: inset 0 0 ${width * 4}px ${width}px ${paint} !important;` : `border: ${width}px ${style} ${paint} !important; box-shadow: none !important;`;
  return `html::after { content: "" !important; display: block !important; position: fixed !important;
    inset: 0 calc(100% - 100vw) calc(100% - 100vh) 0 !important;
    width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
    z-index: 2147483647 !important; ${line} border-radius: ${radius}px !important; background: none !important;
    opacity: 1 !important; transform: none !important; filter: none !important; pointer-events: none !important; }`;
}
function styleFrame(window, cfg, iconColour) {
  const fullRadius = radiusOf(cfg);
  const colour = [cfg.windowBorderColor, iconColour].find(isColour) ?? FALLBACK_COLOUR;
  const frame = { wanted: hasLook(cfg), overlays: /* @__PURE__ */ new Set(), radius: fullRadius, colour, css: () => lineCss(cfg, colour, frame.radius) };
  frames.set(window, frame);
  if (!frame.wanted) return frame;
  const shaped = fullRadius > 0 && takesShape();
  const wc = window.webContents;
  let sheets = [];
  const rules = () => [
    fullRadius > 0 ? "html { background-color: Canvas; }" : "",
    frame.css()
  ].join("\n").trim();
  const give = () => {
    const css = rules();
    if (css && !wc.isDestroyed()) wc.insertCSS(css, { cssOrigin: "user" }).then((key) => sheets.push(key)).catch(() => {
    });
  };
  const restyle = () => {
    for (const key of sheets) wc.removeInsertedCSS(key).catch(() => {
    });
    sheets = [];
    give();
  };
  let given = false;
  wc.on("did-navigate", () => {
    sheets = [];
    given = true;
    give();
  });
  wc.on("dom-ready", () => {
    if (!given) give();
    given = false;
  });
  const round = (view) => {
    try {
      view.setBorderRadius?.(frame.radius);
    } catch {
      frame.overlays.delete(view);
    }
  };
  frame.fit = () => {
    if (window.isDestroyed()) return;
    const radius = window.isMaximized() || window.isFullScreen() ? 0 : fullRadius;
    const changed = radius !== frame.radius;
    frame.radius = radius;
    if (fullRadius > 0) {
      round(window.contentView);
      for (const view of frame.overlays) round(view);
    }
    if (shaped) {
      const [width, height] = window.getSize();
      try {
        window.setShape(radius > 0 ? roundedRects(width, height, radius) : []);
      } catch {
      }
    }
    if (changed) restyle();
  };
  for (const change of ["resize", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "restore", "show"]) window.on(change, frame.fit);
  frame.fit();
  return frame;
}
function roundOverlay(window, view) {
  const frame = frames.get(window);
  if (!frame?.wanted) return () => {
  };
  frame.overlays.add(view);
  frame.fit();
  return () => frame.overlays.delete(view);
}
module.exports = { frameOptions, styleFrame, roundOverlay, isBare, hasLook, STYLES, FALLBACK_COLOUR };

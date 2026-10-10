"use strict";
const { app } = require("electron");
const FALLBACK_COLOUR = "#7a7f87";
const STYLES = ["solid", "double", "dashed", "dotted", "groove", "ridge"];
const frames = /* @__PURE__ */ new WeakMap();
const isBare = (cfg) => cfg.type === "tray" || !cfg.windowDecorations;
const radiusOf = (cfg) => isBare(cfg) ? cfg.windowRadius : 0;
const widthOf = (cfg) => isBare(cfg) ? cfg.windowBorderWidth : 0;
const isColour = (value) => /^#[0-9a-f]{6}$/i.test(value);
const glowOf = (cfg) => isBare(cfg) ? cfg.windowGlow : 0;
const innerGlow = (cfg) => cfg.windowGlowSide !== "outer" ? glowOf(cfg) : 0;
const outerGlow = (cfg) => cfg.windowGlowSide !== "inner" ? glowOf(cfg) : 0;
const spreadOf = (glow) => Math.round(glow / 4);
const outsetOf = (cfg) => outerGlow(cfg) > 0 ? outerGlow(cfg) + spreadOf(outerGlow(cfg)) + 2 : 0;
const hasLook = (cfg) => radiusOf(cfg) > 0 || widthOf(cfg) > 0 || glowOf(cfg) > 0;
const wantsIconColour = (cfg) => (widthOf(cfg) > 0 || glowOf(cfg) > 0) && !cfg.windowBorderColor;
const needsHost = (cfg) => radiusOf(cfg) > 0 || outsetOf(cfg) > 0;
function frameOptions(cfg) {
  return needsHost(cfg) ? { transparent: true, backgroundColor: "#00000000" } : {};
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
function paintOf(cfg, colour) {
  const strength = Math.max(0, Math.min(100, Number(cfg.windowBorderOpacity)));
  return strength < 100 ? `color-mix(in srgb, ${colour} ${strength}%, transparent)` : colour;
}
function lineCss(cfg, colour, radius) {
  const width = widthOf(cfg);
  const glow = innerGlow(cfg);
  if (!(width > 0) && !(glow > 0)) return "";
  const style = STYLES.includes(cfg.windowBorderStyle) ? cfg.windowBorderStyle : "solid";
  const paint = paintOf(cfg, colour);
  const line = width > 0 ? `border: ${width}px ${style} ${paint} !important;` : "border: 0 !important;";
  const shade = glow > 0 ? `box-shadow: inset 0 0 ${glow}px ${spreadOf(glow)}px ${paint} !important;` : "box-shadow: none !important;";
  return `html::after { content: "" !important; display: block !important; position: fixed !important;
    inset: 0 calc(100% - 100vw) calc(100% - 100vh) 0 !important;
    width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
    z-index: 2147483647 !important; ${line} ${shade} border-radius: ${radius}px !important; background: none !important;
    opacity: 1 !important; transform: none !important; filter: none !important; pointer-events: none !important; }`;
}
function hostPage(cfg, colour) {
  const glow = outerGlow(cfg);
  return `<!doctype html><meta charset="utf-8"><style>
    html, body { height: 100%; margin: 0; overflow: hidden; background: transparent; }
    #glow { position: fixed; inset: ${outsetOf(cfg)}px; border-radius: ${radiusOf(cfg)}px; box-shadow: 0 0 ${glow}px ${spreadOf(glow)}px ${paintOf(cfg, colour)}; }
    body.flat #glow { display: none; }
  </style><body><div id="glow"></div>`;
}
function styleFrame(window, cfg, iconColour, host = null) {
  const fullRadius = radiusOf(cfg);
  const fullOutset = host ? outsetOf(cfg) : 0;
  const colour = [cfg.windowBorderColor, iconColour].find(isColour) ?? FALLBACK_COLOUR;
  const frame = {
    wanted: hasLook(cfg),
    overlays: /* @__PURE__ */ new Set(),
    radius: fullRadius,
    outset: fullOutset,
    area: null,
    colour,
    css: () => lineCss(cfg, colour, frame.radius),
    fit: () => {
    }
  };
  frames.set(window, frame);
  if (!frame.wanted) return frame;
  const shaped = fullRadius > 0 && fullOutset === 0 && takesShape();
  const wc = window.webContents;
  let sheets = [];
  const rules = () => [
    host ? "html { background-color: Canvas; }" : "",
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
  if (host && fullOutset > 0) {
    host.contents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostPage(cfg, colour))}`).catch(() => {
    });
  }
  const round = (view) => {
    try {
      view.setBorderRadius(frame.radius);
    } catch {
      frame.overlays.delete(view);
    }
  };
  frame.fit = () => {
    if (window.isDestroyed()) return;
    const flat = window.isMaximized() || window.isFullScreen();
    const radius = flat ? 0 : fullRadius;
    const outset = flat ? 0 : fullOutset;
    const changed = radius !== frame.radius || outset !== frame.outset;
    frame.radius = radius;
    frame.outset = outset;
    if (host) {
      let { width, height } = window.contentView.getBounds();
      if (!width || !height) [width, height] = window.getContentSize();
      const area = { x: outset, y: outset, width: Math.max(1, width - 2 * outset), height: Math.max(1, height - 2 * outset) };
      const now = frame.area;
      if (!now || now.x !== area.x || now.y !== area.y || now.width !== area.width || now.height !== area.height) host.view.setBounds(area);
      frame.area = area;
      round(host.view);
      for (const view of frame.overlays) round(view);
    }
    if (shaped) {
      const [width, height] = window.getSize();
      try {
        window.setShape(radius > 0 ? roundedRects(width, height, radius) : []);
      } catch {
      }
    }
    if (changed) {
      restyle();
      if (host && fullOutset > 0) host.contents.executeJavaScript(`document.body.classList.toggle('flat', ${flat})`).catch(() => {
      });
    }
  };
  for (const change of ["resize", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "restore", "show"]) window.on(change, frame.fit);
  window.contentView.on("bounds-changed", frame.fit);
  frame.fit();
  return frame;
}
function pageArea(window) {
  const area = frames.get(window)?.area;
  if (area) return area;
  let { width, height } = window.contentView.getBounds();
  if (!width || !height) [width, height] = window.getContentSize();
  return { x: 0, y: 0, width, height };
}
function roundOverlay(window, view) {
  const frame = frames.get(window);
  if (!frame?.wanted) return () => {
  };
  frame.overlays.add(view);
  frame.fit();
  return () => frame.overlays.delete(view);
}
module.exports = { frameOptions, styleFrame, roundOverlay, pageArea, isBare, hasLook, needsHost, wantsIconColour, outsetOf, STYLES, FALLBACK_COLOUR };

"use strict";
function frameOptions(cfg) {
  return cfg.windowRadius > 0 ? { transparent: true, backgroundColor: "#00000000" } : {};
}
function styleFrame(window, cfg) {
  const radius = cfg.windowRadius;
  const colour = /^#[0-9a-f]{6}$/i.test(cfg.windowBorderColor) ? cfg.windowBorderColor : "#7a7f87";
  if (radius > 0) window.contentView.setBorderRadius?.(radius);
  const rules = [
    radius > 0 ? "html { background-color: Canvas; }" : "",
    cfg.windowBorderWidth > 0 ? `html::after { content: "" !important; position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
      border: ${cfg.windowBorderWidth}px solid ${colour} !important; border-radius: ${radius}px !important;
      background: none !important; pointer-events: none !important; }` : ""
  ].join("\n").trim();
  if (!rules) return;
  window.webContents.on("dom-ready", () => window.webContents.insertCSS(rules, { cssOrigin: "user" }).catch(() => {
  }));
}
module.exports = { frameOptions, styleFrame };

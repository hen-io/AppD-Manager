"use strict";
document.documentElement.dataset.palette = new URLSearchParams(location.search).get("palette") || "ocean";
const $ = (id) => document.getElementById(id);
const form = $("form");
const NEW = "";
const SETTINGS = "**";
let settingsTab = "general";
const GLOBAL = "*";
let state = { apps: [], defaults: {} };
let selected = null;
let update = null;
let hero = null;
let usage = {};
let running = /* @__PURE__ */ new Set();
let extensions = [];
let customExtensions = [];
let filter = "";
let loadedForm = "";
const SLOW = /* @__PURE__ */ new Set(["save", "saveExtensionDefaults", "fetchIcons", "checkUpdate", "installUpdate", "importApps", "exportApps", "importExtension", "duplicate", "clearData", "restart"]);
let working = 0;
async function call(method, ...args) {
  const slow = SLOW.has(method);
  const showing = slow && setTimeout(() => {
    $("busy").hidden = false;
  }, 250);
  if (slow) working++;
  try {
    const result = await window.appd[method](...args);
    if (result.error) throw new Error(result.error);
    return result.value;
  } finally {
    if (slow) {
      clearTimeout(showing);
      if (--working === 0) $("busy").hidden = true;
    }
  }
}
const UNDO_MS = 12e3;
let statusTimer = null;
let statusFill = null;
function setStatus(text, isError = false, action = null) {
  clearTimeout(statusTimer);
  clearTimeout(statusFill);
  const bar = $("status");
  bar.replaceChildren();
  bar.classList.toggle("error", isError);
  if (!text) return;
  statusFill = setTimeout(() => {
    const words = document.createElement("span");
    words.textContent = text;
    bar.append(words);
    if (!action) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      setStatus("");
      action.run();
    });
    bar.append(button);
  }, 30);
  statusTimer = setTimeout(() => bar.replaceChildren(), isError || action ? UNDO_MS : 6e3);
}
const iconLooks = /* @__PURE__ */ new Map();
const SIDE = 32;
const BINS = 24;
function hueOfName(name) {
  let sum = 0;
  for (const letter of String(name)) sum = (sum * 31 + letter.codePointAt(0)) % 360;
  return sum;
}
function themeHue(hsl) {
  const from = [0, 60, 120, 180, 240, 300, 360];
  const to = [29, 100, 142, 195, 264, 328, 389];
  const at = Math.min(5, Math.floor(hsl / 60));
  return (to[at] + (hsl - from[at]) / 60 * (to[at + 1] - to[at])) % 360;
}
function lookOfPicture(image) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, SIDE, SIDE);
  const { data } = context.getImageData(0, 0, SIDE, SIDE);
  const bins = Array.from({ length: BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  const grey = { weight: 0, r: 0, g: 0, b: 0 };
  const add = (to, weight, r, g, b) => {
    to.weight += weight;
    to.r += r * weight;
    to.g += g * weight;
    to.b += b * weight;
  };
  for (let i = 0; i < data.length; i += 4) {
    const solid = data[i + 3] / 255;
    if (solid < 0.4) continue;
    const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const spread = max - min;
    if (spread < 0.16 || max < 0.22 || spread / max < 0.2) {
      add(grey, solid, r, g, b);
      continue;
    }
    let hue = max === r ? (g - b) / spread % 6 : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4;
    hue = (hue * 60 + 360) % 360;
    add(bins[Math.floor(hue / (360 / BINS)) % BINS], solid, r, g, b);
  }
  const css = ({ weight, r, g, b }) => `rgb(${[r, g, b].map((part) => Math.round(part / weight * 255)).join(" ")})`;
  const total = bins.reduce((sum, bin) => sum + bin.weight, 0);
  if (total < SIDE * SIDE * 0.02) {
    return { hue: null, plain: true, colour: grey.weight ? css(grey) : null };
  }
  const beside = (at, step) => bins[(at + step + BINS) % BINS];
  let most = 0;
  let mostOf = -1;
  bins.forEach((bin, at) => {
    const amount = bin.weight + (beside(at, -1).weight + beside(at, 1).weight) / 2;
    if (amount > mostOf) [most, mostOf] = [at, amount];
  });
  const mixed = { weight: 0, r: 0, g: 0, b: 0 };
  let x = 0;
  let y = 0;
  for (const step of [-1, 0, 1]) {
    const bin = beside(most, step);
    for (const part of ["weight", "r", "g", "b"]) mixed[part] += bin[part];
    const angle = ((most + step + BINS) % BINS + 0.5) * 2 * Math.PI / BINS;
    x += Math.cos(angle) * bin.weight;
    y += Math.sin(angle) * bin.weight;
  }
  return { hue: themeHue((Math.atan2(y, x) * 180 / Math.PI + 360) % 360), plain: false, colour: css(mixed) };
}
function tint(el, iconUrl, name) {
  const apply = ({ hue, colour, plain }) => {
    el.classList.toggle("tinted", hue !== null);
    el.classList.toggle("plain", plain);
    el.classList.toggle("glow", Boolean(colour));
    if (hue !== null) el.style.setProperty("--app-hue", String(Math.round(hue)));
    if (colour) el.style.setProperty("--app-colour", colour);
  };
  if (!iconUrl) {
    const hue = hueOfName(name);
    return apply({ hue, plain: false, colour: `oklch(0.7 0.15 ${hue})` });
  }
  if (iconLooks.has(iconUrl)) return apply(iconLooks.get(iconUrl));
  const image = new Image();
  image.onload = () => {
    let look = { hue: null, plain: true, colour: null };
    try {
      look = lookOfPicture(image);
    } catch {
    }
    iconLooks.set(iconUrl, look);
    apply(look);
  };
  image.src = iconUrl;
  return void 0;
}
const lines = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean);
function iconElement(url, name) {
  const el = document.createElement(url ? "img" : "span");
  el.className = "icon";
  if (url) {
    el.src = url;
    el.alt = "";
  } else {
    el.textContent = (name || "?").trim().charAt(0) || "?";
  }
  return el;
}
function showIconPreview(url, name) {
  $("icon-preview").replaceChildren(iconElement(url, name));
}

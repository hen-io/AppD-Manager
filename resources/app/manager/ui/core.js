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
const hues = /* @__PURE__ */ new Map();
function hueOfName(name) {
  let sum = 0;
  for (const letter of String(name)) sum = (sum * 31 + letter.codePointAt(0)) % 360;
  return sum;
}
function hueOfPicture(image) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 24;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, 24, 24);
  const { data } = context.getImageData(0, 0, 24, 24);
  let x = 0;
  let y = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const strength = (max - min) * (data[i + 3] / 255);
    if (strength < 0.15) continue;
    let hue = max === r ? (g - b) / (max - min) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    hue *= Math.PI / 3;
    x += Math.cos(hue) * strength;
    y += Math.sin(hue) * strength;
    weight += strength;
  }
  if (weight < 12) return null;
  const hsl = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const from = [0, 60, 120, 180, 240, 300, 360];
  const to = [29, 100, 142, 195, 264, 328, 389];
  const at = Math.min(5, Math.floor(hsl / 60));
  return (to[at] + (hsl - from[at]) / 60 * (to[at + 1] - to[at])) % 360;
}
function tint(el, iconUrl, name) {
  const apply = (hue) => {
    el.classList.toggle("tinted", hue !== null);
    if (hue !== null) el.style.setProperty("--app-hue", String(Math.round(hue)));
  };
  if (!iconUrl) return apply(hueOfName(name));
  if (hues.has(iconUrl)) return apply(hues.get(iconUrl));
  const image = new Image();
  image.onload = () => {
    let hue = null;
    try {
      hue = hueOfPicture(image);
    } catch {
    }
    hues.set(iconUrl, hue);
    apply(hue);
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

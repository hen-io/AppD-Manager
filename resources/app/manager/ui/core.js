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
function hueOfName(name) {
  let sum = 0;
  for (const letter of String(name)) sum = (sum * 31 + letter.codePointAt(0)) % 360;
  return sum;
}
function lookOfPicture(image) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, SIDE, SIDE);
  return lookOfPixels(context.getImageData(0, 0, SIDE, SIDE).data);
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
    let look = { hue: null, plain: true, colour: null, hex: null };
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

"use strict";
document.documentElement.dataset.palette = new URLSearchParams(location.search).get("palette") || "ocean";
const $ = (id) => document.getElementById(id);
const form = $("form");
const NEW = "";
const ABOUT = "***";
const SETTINGS = "**";
const GLOBAL = "*";
let state = { apps: [], defaults: {} };
let selected = null;
let update = null;
let usage = {};
let running = /* @__PURE__ */ new Set();
let extensions = [];
let customExtensions = [];
let filter = "";
let loadedForm = "";
async function call(method, ...args) {
  const result = await window.appd[method](...args);
  if (result.error) throw new Error(result.error);
  return result.value;
}
let statusTimer = null;
function setStatus(text, isError = false) {
  clearTimeout(statusTimer);
  const bar = $("status");
  bar.textContent = "";
  bar.classList.toggle("error", isError);
  if (!text) return;
  setTimeout(() => {
    bar.textContent = text;
  }, 30);
  statusTimer = setTimeout(() => {
    bar.textContent = "";
  }, isError ? 12e3 : 6e3);
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

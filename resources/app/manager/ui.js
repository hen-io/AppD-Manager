"use strict";
const $ = (id) => document.getElementById(id);
const form = $("form");
const NEW = "";
let state = { apps: [], defaults: {} };
let selected = null;
let update = null;
async function call(method, ...args) {
  const result = await window.appd[method](...args);
  if (result.error) throw new Error(result.error);
  return result.value;
}
function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", isError);
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
function renderList() {
  const items = state.apps.map((app) => {
    const name = document.createElement("div");
    name.className = "app-name";
    name.textContent = app.cfg ? app.cfg.name : app.id;
    const url = document.createElement("div");
    url.className = app.cfg ? "app-url" : "app-url error";
    url.textContent = app.cfg ? app.cfg.url : "Broken config file";
    const text = document.createElement("div");
    text.className = "app-text";
    text.append(name, url);
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("selected", app.id === selected);
    button.append(iconElement(app.iconUrl, name.textContent), text);
    button.addEventListener("click", () => select(app.id));
    const item = document.createElement("li");
    item.append(button);
    return item;
  });
  $("apps").replaceChildren(...items);
  $("apps").hidden = !items.length;
  $("no-apps").hidden = Boolean(items.length);
}
function renderSidebar() {
  renderList();
  $("apps-dir").textContent = state.appsDir;
  $("change-dir").disabled = state.appsDirFixed;
  $("default-dir").disabled = state.appsDirFixed;
  $("version").textContent = `AppD-Manager ${state.version}`;
}
function fillForm(cfg) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const value = cfg[el.name];
    if (el.type === "checkbox") el.checked = value;
    else el.value = Array.isArray(value) ? value.join("\n") : value;
  }
}
function readForm() {
  const cfg = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    const fallback = state.defaults[el.name];
    if (el.type === "checkbox") cfg[el.name] = el.checked;
    else if (Array.isArray(fallback)) cfg[el.name] = lines(el.value);
    else if (typeof fallback === "number") cfg[el.name] = Number(el.value) || fallback;
    else cfg[el.name] = el.value.trim();
  }
  if (cfg.url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(cfg.url)) cfg.url = `https://${cfg.url}`;
  return cfg;
}
function select(id) {
  selected = id;
  const app = state.apps.find((a) => a.id === id);
  const isNew = id === NEW;
  const editable = isNew || Boolean(app?.cfg);
  $("welcome").hidden = id !== null;
  $("broken").hidden = !app || Boolean(app.cfg);
  form.hidden = !editable;
  setStatus("");
  if (editable) {
    const cfg = isNew ? state.defaults : app.cfg;
    $("form-title").textContent = isNew ? "New app" : cfg.name;
    fillForm(cfg);
    showIconPreview(isNew ? null : app.iconUrl, cfg.name);
    $("launch").hidden = isNew;
    $("remove").hidden = isNew;
    if (isNew) form.elements.name.focus();
  } else if (app) {
    $("broken-title").textContent = app.id;
    $("broken-error").textContent = app.error;
  }
  renderList();
}
async function save(event) {
  event.preventDefault();
  try {
    const result = await call("save", selected === NEW ? null : selected, readForm());
    state = result.state;
    renderSidebar();
    select(result.id);
    setStatus("Saved. The menu entry is up to date.");
  } catch (e) {
    setStatus(e.message, true);
  }
}
async function remove() {
  try {
    const result = await call("remove", selected);
    if (!result.removed) return;
    state = result.state;
    renderSidebar();
    select(null);
  } catch (e) {
    setStatus(e.message, true);
  }
}
async function pickIcon() {
  try {
    const picked = await call("pickIcon");
    if (!picked) return;
    form.elements.icon.value = picked.path;
    showIconPreview(picked.url, form.elements.name.value);
  } catch (e) {
    setStatus(e.message, true);
  }
}
async function folderAction(method) {
  try {
    const next = await call(method);
    if (!next) return;
    state = next;
    renderSidebar();
    select(null);
    $("update-status").textContent = "";
  } catch (e) {
    $("update-status").textContent = e.message;
  }
}
function showUpdate() {
  const note = $("update-status");
  const button = $("update");
  const canInstall = update.available && !update.blocked;
  button.textContent = canInstall ? `Update to ${update.latest}` : "Check for updates";
  if (!update.available) note.textContent = `Up to date (${state.updateRepo}).`;
  else note.textContent = update.blocked || `Version ${update.latest} is available.`;
}
async function checkUpdate(quiet) {
  try {
    update = await call("checkUpdate");
    if (!quiet || update.available) showUpdate();
  } catch (e) {
    if (!quiet) $("update-status").textContent = `Could not check for updates: ${e.message}`;
  }
}
async function updateClicked() {
  const button = $("update");
  button.disabled = true;
  try {
    if (update?.available && !update.blocked) {
      $("update-status").textContent = "Downloading…";
      const version = await call("installUpdate");
      $("update-status").textContent = `Updated to ${version}. Restarting…`;
      return;
    }
    $("update-status").textContent = "Checking…";
    await checkUpdate(false);
  } catch (e) {
    $("update-status").textContent = e.message;
  }
  button.disabled = false;
}
form.addEventListener("submit", save);
$("new").addEventListener("click", () => select(NEW));
$("launch").addEventListener("click", () => call("launch", selected).catch((e) => setStatus(e.message, true)));
$("remove").addEventListener("click", remove);
$("broken-remove").addEventListener("click", remove);
$("pick-icon").addEventListener("click", pickIcon);
$("open-dir").addEventListener("click", () => folderAction("openAppsDir"));
$("change-dir").addEventListener("click", () => folderAction("pickAppsDir"));
$("default-dir").addEventListener("click", () => folderAction("resetAppsDir"));
$("update").addEventListener("click", updateClicked);
(async () => {
  state = await call("state");
  renderSidebar();
  checkUpdate(true);
})();

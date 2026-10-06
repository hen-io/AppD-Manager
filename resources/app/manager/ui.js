"use strict";
const $ = (id) => document.getElementById(id);
const form = $("form");
const NEW = "";
let state = { apps: [], defaults: {} };
let selected = null;
let update = null;
let running = /* @__PURE__ */ new Set();
let extensions = [];
let loadedForm = "";
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
    button.classList.toggle("running", running.has(app.id));
    if (running.has(app.id)) button.title = "Running";
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
  $("version").textContent = `AppD-Manager ${state.version}`;
  $("author").hidden = !state.author.name;
  $("author").textContent = `by ${state.author.name}`;
  $("author-link").hidden = !state.author.url;
  $("author-link").textContent = state.author.linkText;
  $("author-link").title = state.author.url;
  $("installed-version").textContent = `Installed version: ${state.version}`;
  $("apps-dir").textContent = state.appsDir;
  $("change-dir").disabled = state.appsDirFixed;
  $("default-dir").disabled = state.appsDirFixed;
}
function tuneCpuStep(el) {
  let value = Number(el.value);
  if (Number(el.dataset.last) === 1 && value === 0.5) value = 0.9;
  if (value && value !== Number(el.value)) el.value = value;
  const fine = !value || value < 1;
  el.step = fine ? "0.1" : "0.5";
  el.min = fine ? "0.1" : "0.5";
  el.dataset.last = value;
}
function renderExtensions() {
  const rows = extensions.map((name) => {
    const info = state.extensions[name] || { name, about: "" };
    const title = document.createElement("strong");
    title.textContent = info.name;
    const about = document.createElement("span");
    about.className = "note";
    about.textContent = info.about;
    const text = document.createElement("div");
    text.append(title, about);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      extensions = extensions.filter((other) => other !== name);
      renderExtensions();
      updateSaveButton();
    });
    const row = document.createElement("li");
    row.append(text, removeButton);
    return row;
  });
  $("extension-list").replaceChildren(...rows);
  $("no-extensions").hidden = Boolean(rows.length);
  const choices = Object.entries(state.extensions || {}).filter(([name]) => !extensions.includes(name)).map(([name, info]) => new Option(info.name, name));
  $("extension-add").replaceChildren(new Option("Add an extension…", ""), ...choices);
  $("extension-add").hidden = !choices.length;
  $("dark-settings").hidden = !extensions.includes("darkreader");
}
function addExtension() {
  const name = $("extension-add").value;
  if (!name || extensions.includes(name)) return;
  extensions = [...extensions, name];
  renderExtensions();
  updateSaveButton();
}
function fillForm(cfg) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const value = cfg[el.name];
    if (el.type === "checkbox") el.checked = value;
    else el.value = Array.isArray(value) ? value.join("\n") : value;
  }
  for (const el of form.querySelectorAll(".cpu-limit")) tuneCpuStep(el);
  extensions = [...cfg.extensions];
  renderExtensions();
  const seconds = cfg.pauseAfterSeconds;
  const unit = seconds >= 60 && seconds % 60 === 0 ? 60 : 1;
  $("pause-unit").value = String(unit);
  $("pause-amount").value = seconds / unit;
}
function normalizeUrl(url) {
  url = url.trim();
  return url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `https://${url}` : url;
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
  cfg.url = normalizeUrl(cfg.url);
  cfg.extensions = [...extensions];
  cfg.pauseAfterSeconds = Math.max(1, Math.round(Number($("pause-amount").value) || 0)) * Number($("pause-unit").value);
  return cfg;
}
function showLaunchButton() {
  $("launch").textContent = running.has(selected) ? "Close app" : "Launch app";
}
async function refreshRunning() {
  let ids;
  try {
    ids = await call("runningApps");
  } catch {
    return;
  }
  const changed = ids.length !== running.size || ids.some((id) => !running.has(id));
  if (!changed) return;
  running = new Set(ids);
  renderList();
  showLaunchButton();
}
async function launchOrClose() {
  try {
    await call(running.has(selected) ? "close" : "launch", selected);
  } catch (e) {
    setStatus(e.message, true);
  }
  setTimeout(refreshRunning, 700);
  setTimeout(refreshRunning, 2500);
}
let unsaved = false;
function reportUnsaved(value) {
  if (value === unsaved) return;
  unsaved = value;
  call("setUnsaved", value).catch(() => {
  });
}
function updateSaveButton() {
  $("save").disabled = JSON.stringify(readForm()) === loadedForm;
  reportUnsaved(!$("save").disabled);
}
function select(id) {
  selected = id;
  const app = state.apps.find((a) => a.id === id);
  const isNew = id === NEW;
  const editable = isNew || Boolean(app?.cfg);
  $("welcome").hidden = id !== null;
  $("broken").hidden = !app || Boolean(app.cfg);
  form.hidden = !editable;
  if (!editable) reportUnsaved(false);
  $("icon-choices").hidden = true;
  setStatus("");
  if (editable) {
    const cfg = isNew ? state.defaults : app.cfg;
    $("form-title").textContent = isNew ? "New app" : cfg.name;
    fillForm(cfg);
    loadedForm = JSON.stringify(readForm());
    updateSaveButton();
    showIconPreview(isNew ? null : app.iconUrl, cfg.name);
    $("launch").hidden = isNew;
    showLaunchButton();
    $("remove").hidden = isNew;
    if (isNew) form.elements.name.focus();
  } else if (app) {
    $("broken-title").textContent = app.id;
    $("broken-error").textContent = app.error;
  }
  renderList();
}
async function saveForm() {
  try {
    const result = await call("save", selected === NEW ? null : selected, readForm());
    state = result.state;
    renderSidebar();
    select(result.id);
    setStatus("Saved. The menu entry is up to date.");
    return true;
  } catch (e) {
    setStatus(e.message, true);
    return false;
  }
}
function save(event) {
  event.preventDefault();
  saveForm();
}
window.saveBeforeClose = () => saveForm();
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
    updateSaveButton();
    showIconPreview(picked.url, form.elements.name.value);
    $("icon-choices").hidden = true;
  } catch (e) {
    setStatus(e.message, true);
  }
}
function useIcon(icon, button) {
  form.elements.icon.value = icon.path;
  updateSaveButton();
  showIconPreview(icon.url, form.elements.name.value);
  for (const other of $("icon-choices").children) other.classList.toggle("selected", other === button);
}
async function fetchIcons() {
  const button = $("fetch-icons");
  button.disabled = true;
  setStatus("Looking for the site's icons…");
  try {
    const icons = await call("fetchIcons", normalizeUrl(form.elements.url.value));
    const buttons = icons.map((icon) => {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.title = icon.label;
      const image = document.createElement("img");
      image.src = icon.url;
      image.alt = icon.label;
      choice.append(image);
      choice.addEventListener("click", () => useIcon(icon, choice));
      return choice;
    });
    $("icon-choices").replaceChildren(...buttons);
    $("icon-choices").hidden = !icons.length;
    if (icons.length) useIcon(icons[0], buttons[0]);
    setStatus(
      icons.length ? `Found ${icons.length === 1 ? "1 icon" : `${icons.length} icons`}. Save to keep the selected one.` : "That site offers no icon.",
      !icons.length
    );
  } catch (e) {
    setStatus(e.message, true);
  }
  button.disabled = false;
}
async function folderAction(method) {
  $("folder-status").textContent = "";
  try {
    const next = await call(method);
    if (!next) return;
    state = next;
    renderSidebar();
    select(null);
    $("folder-status").textContent = next.message || "";
    $("folder-status").classList.toggle("error", Boolean(next.problem));
  } catch (e) {
    $("folder-status").textContent = e.message;
    $("folder-status").classList.add("error");
  }
}
function showUpdate() {
  const canInstall = update.available && !update.blocked;
  $("install-update").hidden = !canInstall;
  $("install-update").textContent = `Install ${update.latest}`;
  if (!update.available) $("update-status").textContent = "You have the newest version.";
  else $("update-status").textContent = update.blocked || `Version ${update.latest} is available.`;
}
async function checkUpdate() {
  $("check-update").disabled = true;
  $("update-status").textContent = "Checking…";
  try {
    update = await call("checkUpdate");
    showUpdate();
  } catch (e) {
    update = null;
    $("install-update").hidden = true;
    $("update-status").textContent = `Could not check for updates: ${e.message}`;
  }
  $("check-update").disabled = false;
  return update;
}
async function installUpdate() {
  $("check-update").disabled = true;
  $("install-update").disabled = true;
  $("update-status").textContent = "Downloading…";
  try {
    const version = await call("installUpdate");
    $("update-status").textContent = `Updated to ${version}. Restarting…`;
  } catch (e) {
    $("update-status").textContent = e.message;
    $("check-update").disabled = false;
    $("install-update").disabled = false;
  }
}
async function checkUpdateOnStart() {
  const info = await checkUpdate();
  if (!info || !info.available) return;
  if (!await call("askUpdate", info)) return;
  $("settings").showModal();
  installUpdate();
}
function addFlagPreset() {
  const preset = $("flag-presets").value;
  $("flag-presets").value = "";
  if (!preset) return;
  const current = lines(form.elements.flags.value);
  if (!current.includes(preset)) form.elements.flags.value = [...current, preset].join("\n");
  updateSaveButton();
}
for (const el of form.querySelectorAll(".cpu-limit")) el.addEventListener("input", () => tuneCpuStep(el));
form.addEventListener("submit", save);
$("flag-presets").addEventListener("change", addFlagPreset);
$("extension-add").addEventListener("change", addExtension);
form.addEventListener("input", updateSaveButton);
form.addEventListener("change", updateSaveButton);
$("new").addEventListener("click", () => select(NEW));
$("launch").addEventListener("click", launchOrClose);
$("remove").addEventListener("click", remove);
$("broken-remove").addEventListener("click", remove);
$("pick-icon").addEventListener("click", pickIcon);
$("fetch-icons").addEventListener("click", fetchIcons);
$("open-dir").addEventListener("click", () => folderAction("openAppsDir"));
$("change-dir").addEventListener("click", () => folderAction("pickAppsDir"));
$("default-dir").addEventListener("click", () => folderAction("resetAppsDir"));
$("author-link").addEventListener("click", () => call("openAuthorLink"));
$("open-settings").addEventListener("click", () => $("settings").showModal());
$("close-settings").addEventListener("click", () => $("settings").close());
$("check-update").addEventListener("click", checkUpdate);
$("install-update").addEventListener("click", installUpdate);
(async () => {
  state = await call("state");
  renderSidebar();
  refreshRunning();
  setInterval(refreshRunning, 2e3);
  checkUpdateOnStart();
})();

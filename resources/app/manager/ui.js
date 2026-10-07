"use strict";
const $ = (id) => document.getElementById(id);
const form = $("form");
const NEW = "";
const SETTINGS = "**";
const GLOBAL = "*";
let state = { apps: [], defaults: {} };
let selected = null;
let update = null;
let running = /* @__PURE__ */ new Set();
let extensions = [];
let customExtensions = [];
let loadedForm = "";
const ICONS = {
  cog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  save: "M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z",
  launch: "M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M21.61 2.39C21.61 2.39 16.66 .269 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.79 17.45 10.61 17.63 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39M14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63S16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46M8.88 16.53L7.47 15.12L8.88 16.53M6.24 22L9.88 18.36C9.54 18.27 9.21 18.12 8.91 17.91L4.83 22H6.24M2 22H3.41L8.18 17.24L6.76 15.83L2 20.59V22M2 19.17L6.09 15.09C5.88 14.79 5.73 14.47 5.64 14.12L2 17.76V19.17Z",
  stop: "M18,18H6V6H18V18Z",
  delete: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  file: "M6 2C4.89 2 4 2.89 4 4V20A2 2 0 0 0 6 22H12.68A7 7 0 0 1 12 19A7 7 0 0 1 19 12A7 7 0 0 1 20 12.08V8L14 2H6M13 3.5L18.5 9H13V3.5M18 14C17.87 14 17.76 14.09 17.74 14.21L17.55 15.53C17.25 15.66 16.96 15.82 16.7 16L15.46 15.5C15.35 15.5 15.22 15.5 15.15 15.63L14.15 17.36C14.09 17.47 14.11 17.6 14.21 17.68L15.27 18.5C15.25 18.67 15.24 18.83 15.24 19C15.24 19.17 15.25 19.33 15.27 19.5L14.21 20.32C14.12 20.4 14.09 20.53 14.15 20.64L15.15 22.37C15.21 22.5 15.34 22.5 15.46 22.5L16.7 22C16.96 22.18 17.24 22.35 17.55 22.47L17.74 23.79C17.76 23.91 17.86 24 18 24H20C20.11 24 20.22 23.91 20.24 23.79L20.43 22.47C20.73 22.34 21 22.18 21.27 22L22.5 22.5C22.63 22.5 22.76 22.5 22.83 22.37L23.83 20.64C23.89 20.53 23.86 20.4 23.77 20.32L22.7 19.5C22.72 19.33 22.74 19.17 22.74 19C22.74 18.83 22.73 18.67 22.7 18.5L23.76 17.68C23.85 17.6 23.88 17.47 23.82 17.36L22.82 15.63C22.76 15.5 22.63 15.5 22.5 15.5L21.27 16C21 15.82 20.73 15.65 20.42 15.53L20.23 14.21C20.22 14.09 20.11 14 20 14H18M19 17.5C19.83 17.5 20.5 18.17 20.5 19C20.5 19.83 19.83 20.5 19 20.5C18.16 20.5 17.5 19.83 17.5 19C17.5 18.17 18.17 17.5 19 17.5Z",
  web: "M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  image: "M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z",
  "folder-open": "M19,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4H10L12,6H19A2,2 0 0,1 21,8H21L4,8V18L6.14,10H23.21L20.93,18.5C20.7,19.37 19.92,20 19,20Z",
  "folder-move": "M14,18V15H10V11H14V8L19,13M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  restart: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  restore: "M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z",
  update: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  "open-in-new": "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  puzzle: "M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z",
  "folder-plus": "M13 19C13 19.34 13.04 19.67 13.09 20H4C2.9 20 2 19.11 2 18V6C2 4.89 2.89 4 4 4H10L12 6H20C21.1 6 22 6.89 22 8V13.81C21.12 13.3 20.1 13 19 13C15.69 13 13 15.69 13 19M20 18V15H18V18H15V20H18V23H20V20H23V18H20Z",
  tune: "M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z"
};
function label(button, icon, text) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "mdi");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[icon]);
  svg.append(path);
  button.replaceChildren(svg, text);
}
let asking = null;
window.ask = ({ message, detail, buttons, icon, cancel, danger }) => new Promise((resolve) => {
  const box = $("ask");
  if (asking) asking();
  label($("ask-message"), icon, message);
  $("ask-detail").textContent = detail || "";
  const answer = (index) => {
    asking = null;
    box.close();
    resolve(index);
  };
  asking = () => answer(cancel);
  $("ask-buttons").replaceChildren(...buttons.map((text, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (index === 0) button.className = danger ? "danger" : "primary";
    button.addEventListener("click", () => answer(index));
    return button;
  }));
  box.oncancel = (event) => {
    event.preventDefault();
    answer(cancel);
  };
  box.showModal();
  $("ask-buttons").children[danger ? cancel : 0].focus();
});
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
    const action = (icon, title, method) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "app-action";
      el.title = title;
      el.setAttribute("aria-label", `${title}: ${name.textContent}`);
      label(el, icon, "");
      el.addEventListener("click", () => appAction(method, app.id));
      return el;
    };
    const item = document.createElement("li");
    item.classList.toggle("selected", app.id === selected);
    item.append(button);
    if (app.cfg && running.has(app.id)) item.append(action("restart", "Restart", "restart"), action("stop", "Close", "close"));
    else if (app.cfg) item.append(action("play", "Launch", "launch"));
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
  renderImported();
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
const EXTENSION_SETTINGS = { adblock: "adblock-settings", sponsorblock: "sponsor-settings", darkreader: "dark-settings" };
function fillKeys(keys, values) {
  for (const key of keys) {
    const el = form.elements[key];
    if (!el) continue;
    if (el.type === "checkbox") el.checked = values[key];
    else el.value = Array.isArray(values[key]) ? values[key].join("\n") : values[key];
  }
  if (keys.includes("sponsorBlockActions")) renderSponsorCategories(values.sponsorBlockActions, values.sponsorBlockColors);
}
function ownCount(name, cfg) {
  let count = 0;
  for (const key of state.extensionKeys[name]) {
    const [mine, shared] = [cfg[key], state.extensionDefaults[key]];
    if (mine && typeof mine === "object" && !Array.isArray(mine)) count += Object.keys(mine).filter((kind) => mine[kind] !== shared[kind]).length;
    else if (JSON.stringify(mine) !== JSON.stringify(shared)) count += 1;
  }
  return count;
}
function showOwnSettings() {
  const rows = [...form.querySelectorAll(".extension > .own")];
  if (!rows.length) return;
  const cfg = readForm();
  for (const row of rows) {
    const count = ownCount(row.parentElement.dataset.extension, cfg);
    row.querySelector(".note").textContent = count ? `${count} ${count === 1 ? "setting is" : "settings are"} this app's own; the rest follow the settings for all apps.` : "Follows the settings for all apps.";
    row.querySelector("button").hidden = !count;
  }
}
function extensionBox(title, about, settings, remove2) {
  const name = document.createElement("strong");
  name.textContent = title;
  const note = document.createElement("span");
  note.className = "note";
  note.textContent = about;
  const text = document.createElement("div");
  text.append(name, note);
  const head = document.createElement("header");
  head.append(text);
  if (remove2) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    label(removeButton, "delete", "Remove");
    removeButton.addEventListener("click", () => {
      remove2();
      renderExtensions();
      updateSaveButton();
    });
    head.append(removeButton);
  }
  const box = document.createElement("section");
  box.className = "extension";
  box.append(head);
  if (settings) box.append(settings);
  return box;
}
function ownSettingsRow(name) {
  const note = document.createElement("span");
  note.className = "note";
  const reset = document.createElement("button");
  reset.type = "button";
  label(reset, "restore", "Use the settings for all apps");
  reset.addEventListener("click", () => {
    fillKeys(state.extensionKeys[name], state.extensionDefaults);
    updateSaveButton();
  });
  const row = document.createElement("div");
  row.className = "own";
  row.append(note, reset);
  return row;
}
function renderExtensions() {
  for (const id of Object.values(EXTENSION_SETTINGS)) $("extension-store").append($(id));
  if (selected === GLOBAL) {
    const all = Object.keys(EXTENSION_SETTINGS).map((name) => {
      const box = extensionBox(state.extensions[name].name, state.extensions[name].about, $(EXTENSION_SETTINGS[name]), null);
      box.dataset.extension = name;
      return box;
    });
    $("extension-list").replaceChildren(...all);
    $("no-extensions").hidden = true;
    return;
  }
  const boxes = extensions.map((name) => {
    const info = state.extensions[name] || { name, about: "" };
    const settings = EXTENSION_SETTINGS[name] ? $(EXTENSION_SETTINGS[name]) : null;
    const box = extensionBox(info.name, info.about, null, () => {
      extensions = extensions.filter((other) => other !== name);
    });
    box.dataset.extension = name;
    if (settings) box.append(ownSettingsRow(name), settings);
    return box;
  });
  const imported = customExtensions.map((name) => {
    const info = state.imported[name] || { name, about: "Not in the library (Settings > Extensions): it does not run." };
    return extensionBox(info.name, info.about, null, () => {
      customExtensions = customExtensions.filter((other) => other !== name);
    });
  });
  $("extension-list").replaceChildren(...boxes, ...imported);
  $("no-extensions").hidden = Boolean(boxes.length + imported.length);
  const choices = [
    ...Object.entries(state.extensions || {}).filter(([name]) => !extensions.includes(name)).map(([name, info]) => new Option(info.name, name)),
    ...Object.entries(state.imported || {}).filter(([name]) => !customExtensions.includes(name)).map(([name, info]) => new Option(`${info.name} (imported)`, `imported:${name}`))
  ];
  $("extension-add").replaceChildren(new Option("Add an extension…", ""), ...choices);
  $("extension-add").disabled = !choices.length;
  showOwnSettings();
}
function renderImported() {
  const rows = Object.entries(state.imported || {}).map(([name, info]) => {
    const title = document.createElement("strong");
    title.textContent = info.name;
    const about = document.createElement("span");
    about.className = "note";
    about.textContent = info.about;
    const text = document.createElement("div");
    text.append(title, about);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    label(removeButton, "delete", "Remove");
    removeButton.addEventListener("click", () => changeLibrary("removeExtension", name));
    const row = document.createElement("li");
    row.append(text, removeButton);
    return row;
  });
  $("imported-list").replaceChildren(...rows);
  $("no-imported").hidden = Boolean(rows.length);
}
async function changeLibrary(method, ...args) {
  $("extension-status").textContent = "";
  try {
    const result = await call(method, ...args);
    if (!result) return;
    state = result.state;
    renderImported();
    customExtensions = customExtensions.filter((name) => name in state.imported || method !== "removeExtension");
    if (selected !== null && !form.hidden) renderExtensions();
  } catch (e) {
    $("extension-status").textContent = e.message;
  }
}
window.editApp = (id, extension) => {
  if (!state.apps.some((app) => app.id === id && app.cfg)) return;
  if (selected !== id) select(id);
  const settings = $(EXTENSION_SETTINGS[extension] || "");
  const box = form.querySelector(`.extension[data-extension="${extension}"]`);
  if (settings && box) settings.open = true;
  (box || $("extension-list")).scrollIntoView({ block: "start" });
};
const SPONSOR_ACTIONS = { off: "Off", show: "Show on the seek bar only", ask: "Ask before skipping", skip: "Skip automatically" };
const SPONSOR_ACTIONS_FOR = {
  poi_highlight: { ask: "Offer a jump to it", skip: "Jump to it at the start" },
  exclusive_access: { show: "Show a label" }
};
function renderSponsorCategories(actions, colors) {
  const rows = Object.entries(state.sponsorCategories || {}).map(([name, info]) => {
    const text = document.createElement("span");
    text.textContent = info.label;
    const action = document.createElement("select");
    action.dataset.category = name;
    action.setAttribute("aria-label", info.label);
    for (const choice of info.choices) action.add(new Option((SPONSOR_ACTIONS_FOR[name] || {})[choice] || SPONSOR_ACTIONS[choice], choice));
    action.value = actions[name] || "off";
    const color = document.createElement("input");
    color.type = "color";
    color.dataset.category = name;
    color.title = "Colour on the seek bar";
    color.value = colors[name] || info.color;
    const row = document.createElement("div");
    row.className = "sponsor-row";
    row.append(text, action, color);
    return row;
  });
  $("sponsor-categories").replaceChildren(...rows);
}
const sponsorChoices = (kind) => Object.fromEntries(
  [...$("sponsor-categories").querySelectorAll(kind)].map((el) => [el.dataset.category, el.value])
);
function addExtension() {
  const name = $("extension-add").value;
  if (name.startsWith("imported:")) {
    customExtensions = [...customExtensions, name.slice("imported:".length)];
    renderExtensions();
    updateSaveButton();
    return;
  }
  if (!name || extensions.includes(name)) return;
  extensions = [...extensions, name];
  renderExtensions();
  if (EXTENSION_SETTINGS[name]) $(EXTENSION_SETTINGS[name]).open = true;
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
  customExtensions = [...cfg.customExtensions];
  for (const part of form.querySelectorAll(".extension-settings")) part.open = false;
  renderExtensions();
  renderSponsorCategories(cfg.sponsorBlockActions, cfg.sponsorBlockColors);
  for (const [key, name] of [["pauseAfterSeconds", "pause"], ["slowAfterSeconds", "slow"]]) {
    const seconds = cfg[key];
    const unit = seconds >= 60 && seconds % 60 === 0 ? 60 : 1;
    $(`${name}-unit`).value = String(unit);
    $(`${name}-amount`).value = seconds / unit;
  }
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
  cfg.customExtensions = [...customExtensions];
  cfg.sponsorBlockActions = sponsorChoices("select");
  cfg.sponsorBlockColors = sponsorChoices("input");
  cfg.slowAfterSeconds = Math.max(1, Math.round(Number($("slow-amount").value) || 0)) * Number($("slow-unit").value);
  cfg.pauseAfterSeconds = Math.max(1, Math.round(Number($("pause-amount").value) || 0)) * Number($("pause-unit").value);
  return cfg;
}
function showLaunchButton() {
  if (running.has(selected)) label($("launch"), "stop", "Close app");
  else label($("launch"), "launch", "Launch app");
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
async function appAction(method, id) {
  try {
    await call(method, id);
  } catch (e) {
    setStatus(e.message, true);
  }
  setTimeout(refreshRunning, 700);
  setTimeout(refreshRunning, 2500);
}
const launchOrClose = () => appAction(running.has(selected) ? "close" : "launch", selected);
let unsaved = false;
function reportUnsaved(value) {
  if (value === unsaved) return;
  unsaved = value;
  call("setUnsaved", value).catch(() => {
  });
}
function showSlowDown() {
  const limit = form.elements.unfocusedCpuPercent;
  limit.disabled = !form.elements.backgroundThrottling.checked;
  limit.closest("label").classList.toggle("off", limit.disabled);
}
function updateSaveButton() {
  showSlowDown();
  $("save").disabled = JSON.stringify(readForm()) === loadedForm;
  showOwnSettings();
  reportUnsaved(!$("save").disabled);
}
function select(id) {
  selected = id;
  const app = state.apps.find((a) => a.id === id);
  const isGlobal = id === GLOBAL;
  const isNew = id === NEW || isGlobal;
  const editable = isNew || Boolean(app?.cfg);
  form.classList.toggle("global", isGlobal);
  $("settings-tabs").hidden = !isGlobal && id !== SETTINGS;
  $("settings").hidden = id !== SETTINGS;
  for (const tab of $("settings-tabs").querySelectorAll("[data-tab]")) tab.classList.toggle("active", tab.dataset.tab === "extensions" === isGlobal);
  $("global-note").hidden = !isGlobal;
  $("welcome").hidden = id !== null;
  $("broken").hidden = !app || Boolean(app.cfg) || id === SETTINGS;
  form.hidden = !editable;
  if (!editable) reportUnsaved(false);
  $("icon-choices").hidden = true;
  setStatus("");
  if (editable) {
    const cfg = isNew ? state.defaults : app.cfg;
    $("form-title").textContent = isGlobal ? "Extension settings for all apps" : isNew ? "New app" : cfg.name;
    fillForm(cfg);
    loadedForm = JSON.stringify(readForm());
    updateSaveButton();
    showIconPreview(isNew ? null : app.iconUrl, cfg.name);
    $("launch").hidden = isNew;
    showLaunchButton();
    $("remove").hidden = isNew;
    $("show-config").hidden = isNew;
    if (id === NEW) form.elements.name.focus();
  } else if (app) {
    $("broken-title").textContent = app.id;
    $("broken-error").textContent = app.error;
  }
  renderList();
}
async function saveForm() {
  if (selected === GLOBAL) {
    try {
      const result = await call("saveExtensionDefaults", readForm());
      state = result.state;
      select(GLOBAL);
      setStatus(`Saved. ${result.restart}`.trim());
      refreshRunning();
      return true;
    } catch (e) {
      setStatus(e.message, true);
      return false;
    }
  }
  try {
    const result = await call("save", selected === NEW ? null : selected, readForm());
    state = result.state;
    renderSidebar();
    select(result.id);
    setStatus(result.restart ? `Saved. ${result.restart}` : "Saved. The menu entry is up to date.");
    refreshRunning();
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
      image.alt = "";
      const size = document.createElement("span");
      size.textContent = icon.label;
      choice.append(image, size);
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
  label($("install-update"), "download", `Install ${update.latest}`);
  if (!update.available) $("update-status").textContent = "You have the newest version.";
  else $("update-status").textContent = `Version ${update.latest} is available. ${update.blocked}`.trim();
  const name = update.name && update.name !== update.tag && update.name !== update.latest ? update.name : "";
  const notes = update.available ? [name, update.notes].filter(Boolean).join("\n\n") : "";
  $("release-notes").textContent = notes;
  $("release-notes").hidden = !notes;
  $("release-page").hidden = !update.available;
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
    $("release-page").hidden = true;
    $("release-notes").hidden = true;
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
  select(SETTINGS);
  installUpdate();
}
function useAgentPreset() {
  const preset = $("agent-presets").value;
  $("agent-presets").value = "";
  if (!preset) return;
  const major = (/Chrome\/(\d+)/.exec(navigator.userAgent) || [])[1] || "140";
  form.elements.userAgent.value = preset === "-" ? "" : preset.replaceAll("{chrome}", `${major}.0.0.0`);
  updateSaveButton();
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
$("agent-presets").addEventListener("change", useAgentPreset);
$("extension-add").addEventListener("change", addExtension);
$("extension-import").addEventListener("click", () => changeLibrary("importExtension"));
form.addEventListener("input", updateSaveButton);
form.addEventListener("change", updateSaveButton);
$("new").addEventListener("click", () => select(NEW));
$("launch").addEventListener("click", launchOrClose);
$("remove").addEventListener("click", remove);
$("show-config").addEventListener("click", () => call("showConfig", selected).catch((e) => setStatus(e.message, true)));
$("broken-remove").addEventListener("click", remove);
$("pick-icon").addEventListener("click", pickIcon);
$("fetch-icons").addEventListener("click", fetchIcons);
$("open-dir").addEventListener("click", () => folderAction("openAppsDir"));
$("change-dir").addEventListener("click", () => folderAction("pickAppsDir"));
$("default-dir").addEventListener("click", () => folderAction("resetAppsDir"));
$("author-link").addEventListener("click", () => call("openAuthorLink"));
$("open-settings").addEventListener("click", () => select(SETTINGS));
for (const tab of $("settings-tabs").querySelectorAll("[data-tab]")) {
  tab.addEventListener("click", () => select(tab.dataset.tab === "extensions" ? GLOBAL : SETTINGS));
}
$("check-update").addEventListener("click", checkUpdate);
$("install-update").addEventListener("click", installUpdate);
$("release-page").addEventListener("click", () => update && call("openReleasePage", update.url));
for (const button of document.querySelectorAll("button[data-icon]")) label(button, button.dataset.icon, button.textContent);
(async () => {
  state = await call("state");
  renderSidebar();
  if (state.edit) window.editApp(state.edit.id, state.edit.extension);
  refreshRunning();
  setInterval(refreshRunning, 2e3);
  checkUpdateOnStart();
})();

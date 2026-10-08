"use strict";
function tuneCpuStep(el) {
  let value = Number(el.value);
  if (Number(el.dataset.last) === 1 && value === 0.5) value = 0.9;
  if (value && value !== Number(el.value)) el.value = value;
  const fine = !value || value < 1;
  el.step = fine ? "0.1" : "0.5";
  el.min = fine ? "0.1" : "0.5";
  el.dataset.last = value;
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
  const cfg = readForm();
  $("save").disabled = JSON.stringify(cfg) === loadedForm;
  showOwnSettings(cfg);
  reportUnsaved(!$("save").disabled);
}
async function go(id) {
  if (id === selected) return;
  if (!form.hidden && !$("save").disabled) {
    const answer = await call("askUnsaved").catch(() => "stay");
    if (answer === "stay" || answer === "save" && !await saveForm()) return;
  }
  select(id);
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
  $("home").hidden = id !== null;
  $("about").hidden = id !== ABOUT;
  $("broken").hidden = !app || Boolean(app.cfg);
  const view = id === null ? "home" : isGlobal || id === SETTINGS ? "settings" : id === ABOUT ? "about" : "";
  for (const button of $("views").querySelectorAll("[data-view]")) button.classList.toggle("active", button.dataset.view === view);
  document.querySelector("main").scrollTop = 0;
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
    $("form-sub").textContent = isNew ? "Give it a name and an address, then save." : cfg.url;
    showIconPreview(isNew ? null : app.iconUrl, cfg.name);
    $("template-row").hidden = id !== NEW;
    $("launch").hidden = isNew;
    showLaunchButton();
    $("remove").hidden = isNew;
    form.querySelector(".more").hidden = isNew;
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
function useTemplate() {
  const template = state.templates[Number($("template").value)];
  $("template").value = "";
  if (!template) return;
  const { about, ...settings } = template;
  const major = (/Chrome\/(\d+)/.exec(navigator.userAgent) || [])[1] || "140";
  if (settings.userAgent) settings.userAgent = settings.userAgent.replace(/Chrome\/[\d.]+/, `Chrome/${major}.0.0.0`);
  fillForm({ ...state.defaults, ...settings });
  $("form-title").textContent = template.name;
  updateSaveButton();
  setStatus(`"${template.name}" filled in. Change what you like, then save. "Get from site" fetches its icon.`);
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

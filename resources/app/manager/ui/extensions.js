"use strict";
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
function showOwnSettings(cfg = readForm()) {
  const rows = [...form.querySelectorAll(".extension > .own")];
  if (!rows.length) return;
  for (const row of rows) {
    const count = ownCount(row.parentElement.dataset.extension, cfg);
    row.querySelector(".note").textContent = count ? `${count} ${count === 1 ? "setting is" : "settings are"} this app's own; the rest follow the settings for all apps.` : "Follows the settings for all apps.";
    row.querySelector("button").hidden = !count;
  }
}
function extensionBox(title, about, settings, remove) {
  const name = document.createElement("strong");
  name.textContent = title;
  const note = document.createElement("span");
  note.className = "note";
  note.textContent = about;
  const text = document.createElement("div");
  text.append(name, note);
  const head = document.createElement("header");
  head.append(text);
  if (remove) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    label(removeButton, "delete", "Remove");
    removeButton.addEventListener("click", () => {
      remove();
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

"use strict";
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
function renderAppearance() {
  $("appearance-mode").replaceChildren(...Object.entries(state.modes).map(([mode, name]) => new Option(name, mode)));
  $("appearance-mode").value = state.appearance.mode;
  $("palettes").replaceChildren(...Object.entries(state.palettes).map(([palette, name]) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.palette = palette;
    button.classList.toggle("selected", palette === state.appearance.palette);
    button.setAttribute("aria-pressed", String(palette === state.appearance.palette));
    button.append(swatch, name);
    button.addEventListener("click", () => changeAppearance({ palette }));
    return button;
  }));
}
async function changeAppearance(next) {
  try {
    state.appearance = await call("setAppearance", next);
    document.documentElement.dataset.palette = state.appearance.palette;
    renderAppearance();
  } catch (e) {
    setStatus(e.message, true);
  }
}
async function backup(method) {
  $("backup-status").textContent = "";
  $("backup-status").classList.remove("error");
  try {
    const result = await call(method);
    if (!result) return;
    if (typeof result === "string") {
      $("backup-status").textContent = result;
      return;
    }
    state = result.state;
    renderSidebar();
    $("backup-status").textContent = result.message;
    $("backup-status").classList.toggle("error", Boolean(result.problem));
  } catch (e) {
    $("backup-status").textContent = e.message;
    $("backup-status").classList.add("error");
  }
}
function showUpdate() {
  const canInstall = update.available && !update.blocked;
  $("install-update").hidden = !canInstall;
  label($("install-update"), "download", `Install ${update.latest}`);
  if (!update.available) $("update-status").textContent = "You have the newest version.";
  else $("update-status").textContent = `Version ${update.latest} is available. ${update.blocked}`.trim();
  showRelease($("release"), update.available ? update : null);
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
    $("release").hidden = true;
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

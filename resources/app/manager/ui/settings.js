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
let versions = null;
async function showVersions() {
  if (versions) return;
  versions = [];
  const pick = $("release-pick");
  pick.replaceChildren(new Option("Looking up the versions…", ""));
  try {
    versions = await call("releases");
    pick.replaceChildren(new Option("Choose a version…", ""), ...versions.map((release) => {
      const option = new Option(`${release.version}${release.current ? " (installed)" : ""}`, release.tag);
      option.dataset.note = [release.date, release.name !== release.tag && release.name !== release.version ? release.name : ""].filter(Boolean).join(" · ");
      option.disabled = release.current;
      return option;
    }));
  } catch (e) {
    versions = null;
    pick.replaceChildren(new Option("The versions could not be looked up", ""));
    $("release-status").textContent = e.message;
  }
}
async function installVersion() {
  const tag = $("release-pick").value;
  const release = (versions || []).find((one) => one.tag === tag);
  if (!release) return;
  const answer = await window.ask({
    icon: "history",
    buttons: [`Install ${release.version}`, "Cancel"],
    cancel: 1,
    message: `Install version ${release.version}?`,
    detail: `You have ${state.version}. AppD-Manager restarts with version ${release.version}; your apps are not touched.${state.prefs.backupBeforeUpdate ? " A copy of what is there now is kept first." : ""}`
  });
  if (answer !== 0) return;
  $("install-release").disabled = true;
  $("release-status").classList.remove("error");
  $("release-status").textContent = "Downloading…";
  try {
    const version = await call("installUpdate", tag);
    $("release-status").textContent = `Version ${version} is installed. Restarting…`;
  } catch (e) {
    $("release-status").textContent = e.message;
    $("release-status").classList.add("error");
    $("install-release").disabled = false;
  }
}
function showSettingsTab(tab) {
  if (tab === "updates") showVersions();
  for (const button of $("settings-tabs").querySelectorAll("[data-tab]")) button.classList.toggle("active", button.dataset.tab === tab);
  for (const card of $("settings").querySelectorAll(".card[data-tab]")) card.hidden = card.dataset.tab !== tab;
}
function showPrefs() {
  for (const el of document.querySelectorAll("[data-pref]")) {
    if (el.type === "checkbox") el.checked = state.prefs[el.dataset.pref];
    else el.value = state.prefs[el.dataset.pref];
  }
  document.body.classList.toggle("still", !state.prefs.motion);
  if (!state.prefs.showUsage) {
    usage = {};
    showUsage();
  }
}
async function changePref(el) {
  try {
    state.prefs = await call("setPrefs", { [el.dataset.pref]: el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value });
  } catch (e) {
    setStatus(e.message, true);
  }
  showPrefs();
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
  settingsTab = "updates";
  select(SETTINGS);
  installUpdate();
}

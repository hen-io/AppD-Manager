"use strict";
for (const el of form.querySelectorAll(".cpu-limit")) el.addEventListener("input", () => tuneCpuStep(el));
form.addEventListener("submit", save);
$("flag-presets").addEventListener("change", addFlagPreset);
$("agent-presets").addEventListener("change", useAgentPreset);
$("template").addEventListener("change", useTemplate);
$("appearance-mode").addEventListener("change", () => changeAppearance({ mode: $("appearance-mode").value }));
for (const el of document.querySelectorAll("[data-pref]")) el.addEventListener("change", () => changePref(el));
$("export-apps").addEventListener("click", () => backup("exportApps"));
$("import-apps").addEventListener("click", () => backup("importApps"));
$("extension-add").addEventListener("change", addExtension);
$("extension-import").addEventListener("click", () => changeLibrary("importExtension"));
form.addEventListener("input", updateSaveButton);
form.addEventListener("change", updateSaveButton);
$("new").addEventListener("click", () => go(NEW));
$("home-new").addEventListener("click", () => go(NEW));
$("launch").addEventListener("click", launchOrClose);
$("restart").addEventListener("click", () => appAction("restart", selected));
$("place-open").addEventListener("click", placeTrayWindow);
$("remove").addEventListener("click", remove);
$("more-actions").addEventListener("change", async () => {
  const action = $("more-actions").value;
  $("more-actions").value = "";
  try {
    if (action === "showConfig") await call("showConfig", selected);
    if (action === "showLog") await call("showLog", selected);
    if (action === "clearData" && await call("clearData", selected)) {
      setStatus("The data of the app is deleted.");
      refreshRunning();
    }
    if (action === "duplicate") {
      const result = await call("duplicate", selected);
      state = result.state;
      renderSidebar();
      select(result.id);
      setStatus("This is the copy. Change what should differ, then save.");
    }
  } catch (e) {
    setStatus(e.message, true);
  }
});
$("filter").addEventListener("input", () => {
  filter = $("filter").value;
  renderList();
});
document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || event.altKey || $("ask").open) return;
  if (event.key.toLowerCase() === "s" && !form.hidden) {
    event.preventDefault();
    if (!$("save").disabled) saveForm();
  } else if (event.key.toLowerCase() === "f" && !$("filter").hidden) {
    event.preventDefault();
    $("filter").focus();
    $("filter").select();
  }
});
$("broken-remove").addEventListener("click", remove);
$("pick-icon").addEventListener("click", pickIcon);
$("fetch-icons").addEventListener("click", fetchIcons);
$("open-dir").addEventListener("click", () => folderAction("openAppsDir"));
$("change-dir").addEventListener("click", () => folderAction("pickAppsDir"));
$("default-dir").addEventListener("click", () => folderAction("resetAppsDir"));
$("author-link").addEventListener("click", () => call("openAuthorLink"));
for (const button of $("views").querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => go({ home: null, settings: SETTINGS }[button.dataset.view]));
}
$("project-page").addEventListener("click", () => call("openProjectPage"));
$("exit").addEventListener("click", () => call("exit").catch((e) => setStatus(e.message, true)));
function showSidebar(small) {
  document.body.classList.toggle("collapsed", small);
  const tip = small ? "Show the whole sidebar" : "Make the sidebar smaller";
  label($("collapse"), small ? "larger" : "smaller", "");
  $("collapse").title = tip;
  $("collapse").setAttribute("aria-label", tip);
  try {
    localStorage.setItem("sidebar", small ? "small" : "full");
  } catch {
  }
}
$("collapse").addEventListener("click", () => showSidebar(!document.body.classList.contains("collapsed")));
showSidebar((() => {
  try {
    return localStorage.getItem("sidebar") === "small";
  } catch {
    return false;
  }
})());
for (const tab of $("settings-tabs").querySelectorAll("[data-tab]")) {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab === "extensions") return go(GLOBAL);
    settingsTab = tab.dataset.tab;
    return selected === SETTINGS ? showSettingsTab(settingsTab) : go(SETTINGS);
  });
}
$("check-update").addEventListener("click", checkUpdate);
$("open-backups").addEventListener("click", () => call("openBackups").catch((e) => setStatus(e.message, true)));
$("release-pick").addEventListener("change", () => {
  $("install-release").disabled = !$("release-pick").value;
});
$("install-release").addEventListener("click", installVersion);
$("install-update").addEventListener("click", installUpdate);
$("release-page").addEventListener("click", () => update && call("openReleasePage", update.url));
const isAway = () => !document.hasFocus() || document.hidden;
const held = /* @__PURE__ */ new Set();
let watching = null;
function settle(animation) {
  try {
    if (animation.effect?.getComputedTiming().iterations === Infinity) {
      animation.pause();
      held.add(animation);
    } else {
      animation.finish();
    }
  } catch {
  }
}
function rest() {
  const away = isAway();
  document.body.classList.toggle("away", away);
  if (away) {
    clearInterval(watching);
    watching = null;
    document.getAnimations().forEach(settle);
    return;
  }
  for (const animation of held) {
    try {
      animation.play();
    } catch {
    }
  }
  held.clear();
  if (!watching) {
    refreshRunning();
    watching = setInterval(refreshRunning, 2e3);
  }
}
for (const start of ["animationstart", "transitionrun"]) {
  document.addEventListener(start, (event) => {
    if (isAway()) event.target.getAnimations?.({ subtree: true }).forEach(settle);
  }, true);
}
window.addEventListener("blur", rest);
window.addEventListener("focus", rest);
document.addEventListener("visibilitychange", rest);
for (const el of document.querySelectorAll("[data-icon]")) label(el, el.dataset.icon, el.textContent);
for (const summary of document.querySelectorAll("summary")) summary.append(iconSvg("chevron", "chevron"));
document.querySelectorAll("input[data-time]").forEach(addTimeField);
document.querySelectorAll("label:not(.check)").forEach(floatLabel);
document.querySelectorAll("select").forEach(enhance);
document.querySelectorAll("input[data-slider]").forEach(addSlider);
new MutationObserver((changes) => {
  for (const change of changes) {
    for (const node of change.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches("select")) enhance(node);
      else node.querySelectorAll("select").forEach(enhance);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
(async () => {
  state = await call("state");
  for (const [key, rule] of Object.entries(state.rules)) {
    const el = form.elements[key];
    if (el && "min" in rule && el.type === "number") Object.assign(el, { min: rule.min, max: rule.max });
  }
  form.elements.trayScreen.append(...state.displays.map((display, index) => {
    const option = new Option(`Screen ${index + 1}`, String(index + 1));
    option.dataset.note = `${display.bounds.width} × ${display.bounds.height}${display.primary ? ", the main screen" : ""}`;
    return option;
  }));
  $("template").append(...state.templates.map((template, index) => {
    const option = new Option(template.name, String(index));
    option.dataset.note = template.about;
    return option;
  }));
  renderAppearance();
  showPrefs();
  renderSidebar();
  select(null);
  if (state.edit) window.editApp(state.edit.id, state.edit.extension);
  await refreshRunning();
  rest();
  if (state.prefs.checkUpdates) checkUpdateOnStart();
})();

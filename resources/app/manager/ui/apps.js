"use strict";
function shownApps() {
  const wanted = filter.trim().toLowerCase();
  if (!wanted) return state.apps;
  return state.apps.filter((app) => `${app.cfg ? `${app.cfg.name} ${app.cfg.url}` : ""} ${app.id}`.toLowerCase().includes(wanted));
}
function renderList() {
  $("filter").hidden = state.apps.length < 6 && !filter;
  const items = shownApps().map((app) => {
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
    button.title = `${name.textContent}${running.has(app.id) ? " (running)" : ""}`;
    button.append(iconElement(app.iconUrl, name.textContent), text);
    button.addEventListener("click", () => go(app.id));
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
  const cards = shownApps().map((app) => {
    const title = app.cfg ? app.cfg.name : app.id;
    const name = document.createElement("div");
    name.className = "app-name";
    name.textContent = title;
    const url = document.createElement("div");
    url.className = app.cfg ? "app-url" : "app-url error";
    url.textContent = app.cfg ? app.cfg.url : "Broken config file";
    const text = document.createElement("div");
    text.className = "app-text";
    text.append(name, url);
    const card = document.createElement("div");
    card.className = "app-card";
    card.classList.toggle("running", running.has(app.id));
    card.append(iconElement(app.iconUrl, title), text);
    const action = (icon, tip, method) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "app-action";
      el.title = tip;
      el.setAttribute("aria-label", `${tip}: ${title}`);
      label(el, icon, "");
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        appAction(method, app.id);
      });
      return el;
    };
    if (app.cfg && running.has(app.id)) card.append(action("restart", "Restart", "restart"), action("stop", "Close", "close"));
    else if (app.cfg) card.append(action("play", "Launch", "launch"));
    card.addEventListener("click", () => go(app.id));
    return card;
  });
  $("home-apps").replaceChildren(...cards);
  $("home-empty").hidden = Boolean(cards.length);
  $("home-empty").textContent = state.apps.length ? "No app has that in its name or address." : 'No apps yet. "New app" on the left makes the first one.';
  $("apps").replaceChildren(...items);
  $("apps").hidden = !items.length;
  $("no-apps").hidden = Boolean(state.apps.length);
}
function renderSidebar() {
  renderList();
  $("side-version").textContent = `Version ${state.version}`;
  $("side-author").hidden = !state.author.name;
  $("side-author").textContent = `by ${state.author.name}`;
  $("version").textContent = `AppD-Manager ${state.version}`;
  $("runtime").textContent = `Runs on Electron ${state.runtime.electron} (Chromium ${state.runtime.chromium}).`;
  $("author").hidden = !state.author.name;
  $("author").textContent = `Made by ${state.author.name}`;
  $("author-link").hidden = !state.author.url;
  label($("author-link"), "open-in-new", state.author.linkText || state.author.url);
  $("author-link").title = state.author.url;
  $("project-page").title = state.projectUrl;
  $("installed-version").textContent = `Installed version: ${state.version}`;
  $("apps-dir").textContent = state.appsDir;
  renderImported();
  $("change-dir").disabled = state.appsDirFixed;
  $("default-dir").disabled = state.appsDirFixed;
}
function showLaunchButton() {
  $("running-badge").hidden = !running.has(selected);
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

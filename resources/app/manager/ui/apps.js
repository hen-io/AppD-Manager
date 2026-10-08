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
    const text = document.createElement("div");
    text.className = "app-text";
    text.append(name);
    if (!app.cfg) {
      const broken = document.createElement("div");
      broken.className = "app-url error";
      broken.textContent = "Broken config file";
      text.append(broken);
    } else if (running.has(app.id)) {
      const use = document.createElement("div");
      use.className = "app-usage";
      use.dataset.usage = app.id;
      use.textContent = usageText(app.id);
      text.append(use);
    }
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
  const cards = [];
  for (const app of shownApps()) cards.push(((app2) => {
    const title = app2.cfg ? app2.cfg.name : app2.id;
    const name = document.createElement("div");
    name.className = "app-name";
    name.textContent = title;
    const url = document.createElement("div");
    url.className = app2.cfg ? "app-url" : "app-url error";
    url.textContent = app2.cfg ? app2.cfg.url : "Broken config file";
    const text = document.createElement("div");
    text.className = "app-text";
    text.append(name, url);
    if (running.has(app2.id)) {
      const use = document.createElement("div");
      use.className = "app-usage";
      use.dataset.usage = app2.id;
      use.textContent = usageText(app2.id);
      text.append(use);
    }
    const card = document.createElement("div");
    card.className = "app-card";
    card.dataset.id = app2.id;
    card.style.setProperty("--i", String(cards.length));
    if (app2.id === hero) card.style.viewTransitionName = "hero";
    tint(card, app2.iconUrl, title);
    card.classList.toggle("running", running.has(app2.id));
    card.append(iconElement(app2.iconUrl, title), text);
    const action = (icon, tip, method) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "app-action";
      el.title = tip;
      el.setAttribute("aria-label", `${tip}: ${title}`);
      label(el, icon, "");
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        appAction(method, app2.id);
      });
      return el;
    };
    if (app2.cfg && running.has(app2.id)) card.append(action("restart", "Restart", "restart"), action("stop", "Close", "close"));
    else if (app2.cfg) card.append(action("play", "Launch", "launch"));
    card.addEventListener("click", () => go(app2.id));
    return card;
  })(app));
  $("home-apps").replaceChildren(...cards);
  $("home-empty").hidden = Boolean(cards.length);
  $("home-empty-title").textContent = state.apps.length ? "Nothing found" : "No apps yet";
  $("home-empty-text").textContent = state.apps.length ? "No app has that in its name or address." : "Any website can be an app of its own: in its own window, with its own icon and logins. Make the first one.";
  $("home-new").hidden = Boolean(state.apps.length);
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
  showUsage();
  if (running.has(selected)) label($("launch"), "stop", "Close app");
  else label($("launch"), "launch", "Launch app");
}
function usageText(id) {
  const use = usage[id];
  if (!use || !use.memory) return "";
  const mb = use.memory / 1048576;
  const memory = mb >= 1e3 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb / 10) * 10} MB`;
  return use.cpu === null ? memory : `${use.cpu < 10 ? use.cpu.toFixed(1) : Math.round(use.cpu)}% CPU · ${memory}`;
}
function showUsage() {
  for (const el of document.querySelectorAll("[data-usage]")) el.textContent = usageText(el.dataset.usage);
  $("running-badge").textContent = usageText(selected) ? `Running · ${usageText(selected)}` : "Running";
}
let looks = 0;
async function refreshRunning() {
  if (document.hidden) return;
  let ids;
  try {
    ids = await call("runningApps");
    if (ids.length && state.prefs.showUsage && looks++ % 2 === 0) usage = await call("usage");
    else if (!ids.length) usage = {};
  } catch {
    return;
  }
  const changed = ids.length !== running.size || ids.some((id) => !running.has(id));
  if (changed) {
    running = new Set(ids);
    renderList();
    showLaunchButton();
  }
  showUsage();
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

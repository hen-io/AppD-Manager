"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const home = os.homedir();
const root = path.join(home, ".AppD-manager");
const settingsPath = path.join(root, "settings.json");
const managerDataDir = path.join(root, "ManagerData");
const defaultAppsDir = path.join(root, "Applications");
const desktopDir = path.join(process.env.XDG_DATA_HOME || path.join(home, ".local/share"), "applications");
const WINDOWS = process.platform === "win32";
const launcher = process.env.APPD_BIN || (WINDOWS ? process.execPath : path.join(__dirname, "appd"));
function managerCommand(extra = []) {
  if (!WINDOWS) return [launcher, ["manager", ...extra]];
  return [launcher, [...runCommand("")[1].filter((arg) => !arg.startsWith("--appd-run=")), ...extra]];
}
function describeExtension(folder) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
  } catch {
    throw new Error(`${folder} is not an unpacked extension: it has no readable manifest.json.`);
  }
  const text = (value) => typeof value === "string" && !value.startsWith("__MSG_") ? value : "";
  return {
    name: [text(manifest.name) || path.basename(folder), text(manifest.version)].filter(Boolean).join(" "),
    about: text(manifest.description) || "Imported Chrome extension",
    options: text(manifest.options_ui?.page) || text(manifest.options_page)
  };
}
function runCommand(id, extra = []) {
  if (!WINDOWS) return [launcher, ["run", id, ...extra]];
  const built = path.join(path.dirname(launcher), "resources", "app") === __dirname;
  return [launcher, [...built ? [] : [__dirname], `--appd-run=${id}`, ...extra]];
}
const startMenuDir = path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "AppD-Manager");
const windowsAppId = (name) => `hen-io.AppD-Manager.${name}`;
const pidFile = (id) => path.join(appDir(id), "running.pid");
const MANAGER_DESKTOP_ID = "appdmanager";
const APP_ACTIONS = {
  "hard-reload": "Hard reload",
  "clear-cache": "Empty cache (and hard reload)"
};
const EXTENSIONS = {
  adblock: {
    name: "Ad blocker (web and YouTube)",
    about: "Blocks ads and trackers on websites, and the ads in YouTube videos. Uses the filter lists uBlock Origin uses, refreshed daily."
  },
  twitch: {
    name: "Twitch ad blocker",
    about: "Removes the ads in Twitch streams, which the general blocker cannot reach. Uses the TwitchAdSolutions script, fetched from its project on GitHub."
  },
  sponsorblock: {
    name: "SponsorBlock",
    about: "Offers to skip, or skips, sponsor messages, intros and other parts of YouTube videos that viewers have marked."
  },
  darkreader: {
    name: "Dark Reader",
    about: "Gives sites a dark look, also those without one of their own."
  }
};
const COLOR_SCHEMES = ["system", "light", "dark"];
const ACTION_BUTTON = ["off", "top-left", "top-right", "bottom-left", "bottom-right"];
const SPONSOR_CATEGORIES = {
  sponsor: { label: "Sponsor messages", color: "#00d400" },
  selfpromo: { label: "Unpaid or self-promotion", color: "#ffff00" },
  interaction: { label: "Reminders to like, subscribe or follow", color: "#cc00ff" },
  intro: { label: "Intros and title sequences", color: "#00ffff" },
  outro: { label: "Endcards and credits", color: "#0202ed" },
  preview: { label: "Recaps and previews", color: "#008fd6" },
  hook: { label: "Hooks and greetings", color: "#395699" },
  filler: { label: "Tangents and jokes", color: "#7300ff" },
  music_offtopic: { label: "Non-music parts of music videos", color: "#ff9900" },
  poi_highlight: { label: "Highlight (the point of the video)", color: "#ff1684" },
  exclusive_access: { label: "Exclusive access (whole video)", color: "#008a5c" }
};
const SPONSOR_ACTIONS = ["off", "show", "ask", "skip"];
const SPONSOR_CHOICES = { poi_highlight: ["off", "ask", "skip"], exclusive_access: ["off", "show"] };
const YOUTUBE_QUALITIES = {
  "4320p": "highres",
  "2160p": "hd2160",
  "1440p": "hd1440",
  "1080p": "hd1080",
  "720p": "hd720",
  "480p": "large",
  "360p": "medium",
  "240p": "small",
  "144p": "tiny"
};
const sponsorChoices = (category) => SPONSOR_CHOICES[category] || SPONSOR_ACTIONS;
const OPEN_LINKS = ["browser", "window", "same"];
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const DEFAULTS = {
  name: "",
  url: "",
  description: "AppD Manager application",
  icon: "applications-internet",
  width: 1280,
  height: 800,
  startMaximized: false,
  userAgent: "",
  openLinks: "browser",
  internalHosts: [],
  homeButton: true,
  extensions: [],
  customExtensions: [],
  adBlockHideLeftovers: true,
  adBlockInPageAds: true,
  adBlockExceptions: [],
  sponsorBlockActions: {
    sponsor: "ask",
    selfpromo: "ask",
    interaction: "ask",
    intro: "ask",
    outro: "ask",
    preview: "ask",
    hook: "off",
    filler: "off",
    music_offtopic: "off",
    poi_highlight: "ask",
    exclusive_access: "show"
  },
  sponsorBlockColors: Object.fromEntries(Object.entries(SPONSOR_CATEGORIES).map(([name, info]) => [name, info.color])),
  sponsorBlockMarkers: true,
  sponsorBlockNotes: true,
  sponsorBlockSummary: true,
  sponsorBlockUpcomingNotice: false,
  sponsorBlockNoticeSeconds: 4,
  sponsorBlockMinSeconds: 0,
  sponsorBlockMute: true,
  sponsorBlockFullVideo: true,
  sponsorBlockAskOnFullVideo: false,
  sponsorBlockSound: false,
  sponsorBlockShowDuration: true,
  sponsorBlockMusicAutoSkip: false,
  sponsorBlockMusicOnlyOnYoutubeMusic: false,
  sponsorBlockCountSkips: false,
  sponsorBlockSkipKey: "Enter",
  sponsorBlockHighlightKey: "Ctrl+Enter",
  sponsorBlockCloseKey: "Backspace",
  sponsorBlockChannels: [],
  sponsorBlockServer: "https://sponsor.ajay.app",
  youtubeQuality: "auto",
  darkBrightness: 100,
  darkContrast: 100,
  darkSepia: 0,
  colorScheme: "system",
  actionButton: "off",
  menuShortcut: "Ctrl+X",
  fixedTitle: false,
  hideScrollbars: false,
  loadingScreen: true,
  backgroundThrottling: true,
  pauseWhenUnfocused: false,
  pauseAfterSeconds: 30,
  cpuPercent: 100,
  unfocusedCpuPercent: 10,
  skipMissedUpdates: false,
  reloadAfterIdleMinutes: 0,
  hardwareAcceleration: true,
  jsHeapMb: 0,
  ignoreCertificateErrors: false,
  flags: [],
  configVersion: 3
};
const EXTENSION_KEYS = {
  adblock: Object.keys(DEFAULTS).filter((key) => key.startsWith("adBlock")),
  sponsorblock: Object.keys(DEFAULTS).filter((key) => key.startsWith("sponsorBlock") || key === "youtubeQuality"),
  darkreader: ["darkBrightness", "darkContrast", "darkSepia"]
};
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}
function appsDir() {
  const dir = process.env.APPD_APPS_DIR || readSettings().appsDir;
  if (typeof dir !== "string" || !dir) return defaultAppsDir;
  return path.resolve(dir.replace(/^~(?=\/|$)/, home));
}
async function moveApps(target) {
  const from = appsDir();
  const result = { moved: [], left: [] };
  if (path.resolve(target) === from) return result;
  fs.mkdirSync(target, { recursive: true });
  for (const id of list()) {
    const source = path.join(from, id);
    const dest = path.join(target, id);
    if (runningPid(id)) {
      result.left.push(`${id} (running)`);
    } else if (fs.existsSync(dest)) {
      result.left.push(`${id} (already exists there)`);
    } else {
      try {
        fs.renameSync(source, dest);
      } catch (e) {
        if (e.code !== "EXDEV") throw e;
        await fs.promises.cp(source, dest, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
        fs.rmSync(source, { recursive: true, force: true });
      }
      result.moved.push(id);
    }
  }
  return result;
}
function setAppsDir(dir) {
  const settings = readSettings();
  if (dir) settings.appsDir = dir;
  else delete settings.appsDir;
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
const appDir = (id) => path.join(appsDir(), id);
const configPath = (id) => path.join(appDir(id), "config.json");
const profileDir = (id) => path.join(appDir(id), "profile");
const desktopId = (id) => `appd-${id}`;
const desktopPath = (name) => path.join(desktopDir, `${name}.desktop`);
function checkId(id) {
  if (!ID_RE.test(id || "")) {
    throw new Error(`invalid app id "${id || ""}" (use a-z, 0-9, - and _)`);
  }
}
function newId(name) {
  const base = String(name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  let id = base;
  for (let n = 2; fs.existsSync(appDir(id)); n++) id = `${base}-${n}`;
  return id;
}
function validate(cfg) {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (typeof cfg[key] !== typeof def || Array.isArray(cfg[key]) !== Array.isArray(def)) {
      throw new Error(`"${key}" must be ${Array.isArray(def) ? "an array" : `a ${typeof def}`}`);
    }
  }
  if (!URL.canParse(cfg.url)) throw new Error(`invalid url "${cfg.url}"`);
  const unknown = cfg.extensions.find((name) => !(name in EXTENSIONS));
  if (unknown !== void 0) throw new Error(`unknown extension "${unknown}" (known: ${Object.keys(EXTENSIONS).join(", ")})`);
  for (const key of ["sponsorBlockActions", "sponsorBlockColors"]) {
    if (!cfg[key]) throw new Error(`"${key}" must be an object`);
    const odd = Object.keys(cfg[key]).find((name) => !(name in SPONSOR_CATEGORIES));
    if (odd !== void 0) throw new Error(`unknown SponsorBlock category "${odd}" in "${key}" (known: ${Object.keys(SPONSOR_CATEGORIES).join(", ")})`);
  }
  for (const [category, action] of Object.entries(cfg.sponsorBlockActions)) {
    if (!sponsorChoices(category).includes(action)) throw new Error(`"sponsorBlockActions.${category}" must be one of: ${sponsorChoices(category).join(", ")}`);
  }
  for (const [category, color] of Object.entries(cfg.sponsorBlockColors)) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`"sponsorBlockColors.${category}" must be a colour like #00d400`);
  }
  if (!/^https?:\/\/[^\s/]+/i.test(cfg.sponsorBlockServer)) throw new Error('"sponsorBlockServer" must be an address starting with https://');
  if (cfg.youtubeQuality !== "auto" && !(cfg.youtubeQuality in YOUTUBE_QUALITIES)) {
    throw new Error(`"youtubeQuality" must be one of: auto, ${Object.keys(YOUTUBE_QUALITIES).join(", ")}`);
  }
  if (!COLOR_SCHEMES.includes(cfg.colorScheme)) {
    throw new Error(`"colorScheme" must be one of: ${COLOR_SCHEMES.join(", ")}`);
  }
  if (!ACTION_BUTTON.includes(cfg.actionButton)) {
    throw new Error(`"actionButton" must be one of: ${ACTION_BUTTON.join(", ")}`);
  }
  if (!OPEN_LINKS.includes(cfg.openLinks)) {
    throw new Error(`"openLinks" must be one of: ${OPEN_LINKS.join(", ")}`);
  }
}
function extensionDefaults() {
  const stored = readSettings().extensionSettings || {};
  const values = {};
  for (const key of Object.values(EXTENSION_KEYS).flat()) {
    const def = DEFAULTS[key];
    const ok = typeof stored[key] === typeof def && Array.isArray(stored[key]) === Array.isArray(def) && stored[key] !== null;
    values[key] = !ok ? def : typeof def === "object" && !Array.isArray(def) ? { ...def, ...stored[key] } : stored[key];
  }
  return values;
}
function setExtensionDefaults(values) {
  const picked = extensionDefaults();
  for (const key of Object.keys(picked)) {
    if (key in values) picked[key] = values[key];
  }
  validate({ ...DEFAULTS, url: "https://example.com", ...picked });
  const settings = readSettings();
  settings.extensionSettings = picked;
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
const ALL_EXTENSION_KEYS = Object.values(EXTENSION_KEYS).flat();
const plainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function differing(values, base) {
  const result = {};
  for (const key of ALL_EXTENSION_KEYS) {
    if (!(key in values)) continue;
    if (plainObject(values[key]) && plainObject(base[key])) {
      const entries = Object.entries(values[key]).filter(([name, value]) => base[key][name] !== value);
      if (entries.length) result[key] = Object.fromEntries(entries);
    } else if (JSON.stringify(values[key]) !== JSON.stringify(base[key])) {
      result[key] = values[key];
    }
  }
  return result;
}
const fresh = () => ({ ...DEFAULTS, ...extensionDefaults() });
const extensionsDir = path.join(root, "Extensions");
const extensionFolder = (entry) => /[\\/]/.test(entry) ? entry : path.join(extensionsDir, entry);
function importedExtensions() {
  const found = {};
  if (!fs.existsSync(extensionsDir)) return found;
  for (const name of fs.readdirSync(extensionsDir).sort()) {
    try {
      found[name] = describeExtension(path.join(extensionsDir, name));
    } catch {
    }
  }
  return found;
}
function importExtension(folder) {
  const info = describeExtension(folder);
  const source = path.resolve(folder);
  if (source.startsWith(extensionsDir + path.sep)) throw new Error("That extension is in the library already.");
  const name = info.name.toLowerCase().replace(/ [\d.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "extension";
  const target = path.join(extensionsDir, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return name;
}
function removeImportedExtension(name) {
  if (!ID_RE.test(name)) throw new Error(`invalid extension name "${name}"`);
  fs.rmSync(path.join(extensionsDir, name), { recursive: true, force: true });
  for (const id of list()) {
    try {
      const stored = JSON.parse(fs.readFileSync(configPath(id), "utf8"));
      if (!Array.isArray(stored.customExtensions) || !stored.customExtensions.includes(name)) continue;
      stored.customExtensions = stored.customExtensions.filter((other) => other !== name);
      fs.writeFileSync(configPath(id), JSON.stringify(stored, null, 2) + "\n");
    } catch {
    }
  }
}
function withDefaults(file) {
  const stored = { ...file };
  const version = stored.configVersion >= 1 ? stored.configVersion : 1;
  if (version < 2) {
    if (Array.isArray(stored.ownExtensionSettings)) {
      for (const [name, keys] of Object.entries(EXTENSION_KEYS)) {
        if (!stored.ownExtensionSettings.includes(name)) keys.forEach((key) => delete stored[key]);
      }
    }
    delete stored.ownExtensionSettings;
    const changed = differing(stored, DEFAULTS);
    for (const key of ALL_EXTENSION_KEYS) delete stored[key];
    Object.assign(stored, changed);
  }
  if (version < 3) {
    const limit = stored.unfocusedCpuPercent > 0 && stored.unfocusedCpuPercent < 100 ? stored.unfocusedCpuPercent : 100;
    if (stored.backgroundThrottling === false && limit < 100) stored.backgroundThrottling = true;
    else if (stored.backgroundThrottling === false) stored.unfocusedCpuPercent = DEFAULTS.unfocusedCpuPercent;
    else stored.unfocusedCpuPercent = Math.min(limit, 10);
  }
  stored.configVersion = DEFAULTS.configVersion;
  const shared = extensionDefaults();
  const cfg = { ...DEFAULTS, ...shared, ...stored };
  for (const key of ["sponsorBlockActions", "sponsorBlockColors"]) {
    if (plainObject(stored[key])) cfg[key] = { ...shared[key], ...stored[key] };
  }
  if (Array.isArray(stored.sponsorBlockCategories)) {
    if (!stored.sponsorBlockActions) {
      for (const category of Object.keys(SPONSOR_CATEGORIES)) {
        if (sponsorChoices(category).includes("ask") && category !== "poi_highlight") {
          cfg.sponsorBlockActions[category] = stored.sponsorBlockCategories.includes(category) ? "ask" : "off";
        }
      }
    }
    delete cfg.sponsorBlockCategories;
  }
  return cfg;
}
function load(id) {
  checkId(id);
  let raw;
  try {
    raw = fs.readFileSync(configPath(id), "utf8");
  } catch {
    throw new Error(`no app "${id}" (expected ${configPath(id)})`);
  }
  let cfg;
  try {
    cfg = withDefaults(JSON.parse(raw));
    cfg.name ||= id;
    validate(cfg);
  } catch (e) {
    throw new Error(`${configPath(id)}: ${e.message}`);
  }
  return cfg;
}
function iconFile(id, cfg) {
  if (!cfg.icon) return null;
  const file = path.resolve(appDir(id), cfg.icon);
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}
function save(id, cfg) {
  checkId(id);
  validate(cfg);
  fs.mkdirSync(appDir(id), { recursive: true });
  const icon = iconFile(id, cfg);
  if (icon && path.dirname(icon) !== appDir(id)) {
    const name = `icon${path.extname(icon).toLowerCase()}`;
    fs.copyFileSync(icon, path.join(appDir(id), name));
    cfg = { ...cfg, icon: name };
  }
  const stored = { ...cfg };
  for (const key of ALL_EXTENSION_KEYS) delete stored[key];
  Object.assign(stored, differing(cfg, extensionDefaults()));
  fs.writeFileSync(configPath(id), JSON.stringify(stored, null, 2) + "\n");
}
function remove(id) {
  checkId(id);
  fs.rmSync(appDir(id), { recursive: true, force: true });
}
function runningPid(id) {
  try {
    if (WINDOWS) {
      const pid2 = Number(fs.readFileSync(pidFile(id), "utf8"));
      if (!Number.isInteger(pid2) || pid2 <= 0) return 0;
      process.kill(pid2, 0);
      return pid2;
    }
    const lock = fs.readlinkSync(path.join(profileDir(id), "SingletonLock"));
    const dash = lock.lastIndexOf("-");
    const pid = Number(lock.slice(dash + 1));
    if (!Number.isInteger(pid) || pid <= 0 || lock.slice(0, dash) !== os.hostname()) return 0;
    process.kill(pid, 0);
    return pid;
  } catch {
    return 0;
  }
}
function close(id) {
  const pid = runningPid(id);
  if (pid && WINDOWS) {
    const [command, args] = runCommand(id, ["--appd-action=quit"]);
    const env = { ...process.env };
    delete env.APPD_ID;
    delete env.ELECTRON_RUN_AS_NODE;
    spawn(command, args, { detached: true, stdio: "ignore", env }).on("error", () => {
    }).unref();
  } else if (pid) {
    process.kill(pid, "SIGTERM");
  }
  return Boolean(pid);
}
function list() {
  const dir = appsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((id) => ID_RE.test(id) && fs.existsSync(configPath(id))).sort();
}
const entryValue = (s) => String(s).replace(/\\/g, "\\\\").replace(/[\r\n]+/g, " ");
const execArg = (s) => entryValue(`"${s.replace(/(["`$\\])/g, "\\$1")}"`).replace(/%/g, "%%");
function writeEntry(name, lines, sections = []) {
  const content = ["[Desktop Entry]", "Type=Application", ...lines, "Terminal=false", "StartupNotify=true", "", ...sections].join("\n");
  const file = desktopPath(name);
  try {
    if (fs.readFileSync(file, "utf8") === content) return;
  } catch {
  }
  fs.mkdirSync(desktopDir, { recursive: true });
  fs.writeFileSync(file, content);
}
function electronShell() {
  if (!process.versions.electron || process.env.ELECTRON_RUN_AS_NODE) return null;
  return require("electron");
}
function windowsIcon(source, folder) {
  try {
    const image = electronShell().nativeImage.createFromPath(source);
    if (image.isEmpty()) return void 0;
    const png = image.resize({ width: 256, height: 256 }).toPNG();
    const head = Buffer.alloc(22);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(1, 4);
    head.writeUInt16LE(1, 10);
    head.writeUInt16LE(32, 12);
    head.writeUInt32LE(png.length, 14);
    head.writeUInt32LE(22, 18);
    const file = path.join(folder, "icon.ico");
    fs.writeFileSync(file, Buffer.concat([head, png]));
    return file;
  } catch {
    return void 0;
  }
}
const shortcutPath = (name) => path.join(startMenuDir, `${String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").trim() || "App"}.lnk`);
const shortcutArgs = (args) => args.map((arg) => /\s/.test(arg) ? `"${arg}"` : arg).join(" ");
function writeShortcut(file, options) {
  const electron = electronShell();
  if (!electron) return false;
  fs.mkdirSync(startMenuDir, { recursive: true });
  electron.shell.writeShortcutLink(file, fs.existsSync(file) ? "update" : "create", { cwd: path.dirname(launcher), ...options });
  return true;
}
function writeWindowsShortcut(id, cfg) {
  const [target, args] = runCommand(id);
  const source = iconFile(id, cfg);
  return writeShortcut(shortcutPath(cfg.name), {
    target,
    args: shortcutArgs(args),
    description: cfg.description || cfg.url,
    icon: source && windowsIcon(source, appDir(id)) || target,
    iconIndex: 0,
    appUserModelId: windowsAppId(id)
  });
}
function syncWindows(ids, problems) {
  const wanted = /* @__PURE__ */ new Set();
  let written = true;
  for (const id of ids) {
    try {
      const cfg = load(id);
      wanted.add(path.basename(shortcutPath(cfg.name)).toLowerCase());
      written = writeWindowsShortcut(id, cfg) && written;
    } catch (e) {
      problems.push(e.message);
    }
  }
  const manager = shortcutPath("AppD-Manager");
  wanted.add(path.basename(manager).toLowerCase());
  const [target, args] = runCommand("").slice(0, 2);
  written = writeShortcut(manager, {
    target,
    args: shortcutArgs(args.filter((arg) => !arg.startsWith("--appd-run="))),
    description: "Add, change and remove web apps",
    appUserModelId: windowsAppId("manager")
  }) && written;
  if (!written) {
    problems.push("The Start menu is brought up to date the next time AppD-Manager is opened.");
    return problems;
  }
  for (const file of fs.readdirSync(startMenuDir)) {
    if (/\.lnk$/i.test(file) && !wanted.has(file.toLowerCase())) fs.rmSync(path.join(startMenuDir, file), { force: true });
  }
  return problems;
}
function writeDesktop(id, cfg) {
  if (WINDOWS) return void writeWindowsShortcut(id, cfg);
  writeEntry(desktopId(id), [
    `Name=${entryValue(cfg.name)}`,
    `Comment=${entryValue(cfg.description || cfg.url)}`,
    `Exec=${execArg(launcher)} run ${id}`,
    `Icon=${entryValue(iconFile(id, cfg) || cfg.icon)}`,
    "Categories=Network;",
    `StartupWMClass=${desktopId(id)}`,
    `Actions=${Object.keys(APP_ACTIONS).join(";")};`
  ], Object.entries(APP_ACTIONS).flatMap(([action, label]) => [
    `[Desktop Action ${action}]`,
    `Name=${label}`,
    `Exec=${execArg(launcher)} run ${id} --appd-action=${action}`,
    ""
  ]));
}
function writeManagerDesktop() {
  writeEntry(MANAGER_DESKTOP_ID, [
    "Name=AppD-Manager",
    "Comment=Add, change and remove web apps",
    `Exec=${execArg(launcher)} manager`,
    `Icon=${entryValue(path.join(__dirname, "manager", "icon.svg"))}`,
    "Categories=Utility;",
    `StartupWMClass=${MANAGER_DESKTOP_ID}`
  ]);
}
function sync() {
  const ids = list();
  const problems = [];
  if (WINDOWS) return syncWindows(ids, problems);
  for (const id of ids) {
    try {
      writeDesktop(id, load(id));
    } catch (e) {
      problems.push(e.message);
    }
  }
  writeManagerDesktop();
  for (const file of fs.readdirSync(desktopDir)) {
    const m = /^appd-(.+)\.desktop$/.exec(file);
    if (m && !ids.includes(m[1])) fs.rmSync(path.join(desktopDir, file));
  }
  spawnSync("kbuildsycoca6", { stdio: "ignore", timeout: 1e4 });
  return problems;
}
module.exports = {
  DEFAULTS,
  APP_ACTIONS,
  EXTENSIONS,
  SPONSOR_CATEGORIES,
  sponsorChoices,
  YOUTUBE_QUALITIES,
  MANAGER_DESKTOP_ID,
  WINDOWS,
  windowsAppId,
  EXTENSION_KEYS,
  extensionDefaults,
  setExtensionDefaults,
  pidFile,
  runCommand,
  managerCommand,
  describeExtension,
  fresh,
  extensionsDir,
  extensionFolder,
  importedExtensions,
  importExtension,
  removeImportedExtension,
  root,
  launcher,
  managerDataDir,
  settingsPath,
  appsDir,
  defaultAppsDir,
  setAppsDir,
  moveApps,
  appDir,
  configPath,
  profileDir,
  desktopId,
  checkId,
  newId,
  load,
  save,
  remove,
  list,
  runningPid,
  close,
  iconFile,
  writeDesktop,
  sync
};

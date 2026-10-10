"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { text, fill } = require("./shared/text");
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
    throw new Error(fill(text.errors.notExtensionFolder, { folder }));
  }
  let texts = null;
  const said = (value) => {
    if (typeof value !== "string") return "";
    const key = /^__MSG_(.+)__$/.exec(value);
    if (!key) return value;
    try {
      texts ??= JSON.parse(fs.readFileSync(path.join(folder, "_locales", manifest.default_locale || "en", "messages.json"), "utf8"));
    } catch {
      texts = {};
    }
    const found = Object.keys(texts).find((name) => name.toLowerCase() === key[1].toLowerCase());
    return found && typeof texts[found].message === "string" ? texts[found].message : "";
  };
  const inFolder = (value) => typeof value === "string" ? value.replace(/^[./\\]+/, "") : "";
  const sizes = Object.keys(manifest.icons || {}).map(Number).filter((size2) => size2 > 0).sort((a, b) => a - b);
  const size = sizes.filter((one) => one <= 128).pop() ?? sizes[0];
  return {
    name: [said(manifest.name) || path.basename(folder), said(manifest.version)].filter(Boolean).join(" "),
    about: said(manifest.description) || text.library.chromeExtension,
    options: inFolder(manifest.options_ui?.page) || inFolder(manifest.options_page),
    popup: inFolder((manifest.action || manifest.browser_action || {}).default_popup),
    icon: size ? inFolder(manifest.icons[size]) : ""
  };
}
const startFlags = (cfg) => [
  ...isTray(cfg) && !WINDOWS ? ["--appd-x11"] : [],
  ...cfg.language && !WINDOWS ? [`--appd-lang=${cfg.language}`] : []
];
function runCommand(id, extra = []) {
  if (!WINDOWS) return [launcher, ["run", id, ...extra]];
  const built = path.join(path.dirname(launcher), "resources", "app") === __dirname;
  return [launcher, [...built ? [] : [__dirname], `--appd-run=${id}`, ...extra]];
}
const startMenuDir = path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "AppD-Manager");
const windowsAppId = (name) => `hen-io.AppD-Manager.${name}`;
const pidFile = (id) => path.join(appDir(id), "running.pid");
const MANAGER_DESKTOP_ID = "appdmanager";
const TRAY_ACTIONS = text.app.trayActions;
const HOTKEY = /^((Ctrl|Alt|Shift|Super)\+){1,4}([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Plus|numadd|numsub|`|-|=|\[|\]|;|'|,|\.|\/)$/;
const APP_ACTIONS = text.app.actions;
const APP_TYPES = {
  app: {
    ...text.appTypes.app,
    icon: "window",
    menu: true,
    tray: false,
    actions: {}
  },
  multitab: {
    ...text.appTypes.multitab,
    icon: "tabs",
    menu: true,
    tray: false,
    tabs: true,
    actions: {}
  },
  tray: {
    ...text.appTypes.tray,
    icon: "tray",
    menu: false,
    tray: true,
    actions: TRAY_ACTIONS
  }
};
const appType = (cfg) => APP_TYPES[cfg.type] || APP_TYPES.app;
const isTray = (cfg) => appType(cfg).tray;
const isMultiTab = (cfg) => Boolean(appType(cfg).tabs);
const TAB_INACTIVE = ["keep", "throttle", "pause", "unload"];
const TAB_BAR = ["top", "bottom", "left"];
const EXTENSION_CATEGORIES = text.extensionKinds;
const EXTENSIONS = {
  adblock: {
    category: "blocking",
    sites: [],
    icon: "shield"
  },
  twitch: {
    category: "blocking",
    sites: ["twitch.tv"],
    icon: "shield-play"
  },
  sponsorblock: {
    category: "video",
    sites: ["youtube.com"],
    icon: "skip"
  },
  darkreader: {
    category: "look",
    sites: [],
    icon: "moon"
  },
  ambientlight: {
    category: "video",
    sites: ["youtube.com"],
    store: "paponcgjfojgemddooebbgniglhkajkj",
    by: "Wessel Kroos"
  },
  returndislike: {
    category: "video",
    sites: ["youtube.com"],
    store: "gebbhagfogifgggkldgodflihgfeippi",
    by: "Dmitry Selivanov and community"
  },
  unhook: {
    category: "video",
    sites: ["youtube.com"],
    store: "khncfooichmfjbepaaaebmommgaepoid",
    by: "Unhook"
  },
  enhancer: {
    category: "video",
    sites: ["youtube.com"],
    store: "ponfpcnoihfmfllpaingbgckeeldkhle",
    by: "Maxime RF"
  },
  improveyoutube: {
    category: "video",
    sites: ["youtube.com"],
    store: "bnomihfieiccainjcjblhegjgglakjdd",
    by: "ImprovedTube"
  },
  videospeed: {
    category: "video",
    sites: [],
    store: "nffaoalbilbmmfgbnbgppjihopabppdk",
    by: "igrigorik"
  },
  betterttv: {
    category: "chat",
    sites: ["twitch.tv", "youtube.com"],
    store: "ajopnjidmegmdimjlfnijceegpefgped",
    by: "NightDev"
  },
  seventv: {
    category: "chat",
    sites: ["twitch.tv", "kick.com", "youtube.com"],
    store: "ammjkodgmmoknidbanneddgankgfejfh",
    by: "7TV"
  },
  frankerfacez: {
    category: "chat",
    sites: ["twitch.tv"],
    store: "fadndhdgpmmaapbmfcknlfgcflmmmieb",
    by: "Dan Salvato and SirStendec"
  }
};
for (const [name, info] of Object.entries(EXTENSIONS)) Object.assign(info, text.catalog[name]);
const STORE_EXTENSIONS = Object.fromEntries(Object.entries(EXTENSIONS).filter(([, info]) => info.store).map(([name, info]) => [name, info.store]));
const STORE_ID = /^[a-p]{32}$/;
const COLOR_SCHEMES = ["system", "light", "dark"];
const ACTION_BUTTON = ["off", "top-left", "top-right", "bottom-left", "bottom-right"];
const SPONSOR_CATEGORIES = {
  sponsor: { label: text.sponsorKinds.sponsor, color: "#00d400" },
  selfpromo: { label: text.sponsorKinds.selfpromo, color: "#ffff00" },
  interaction: { label: text.sponsorKinds.interaction, color: "#cc00ff" },
  intro: { label: text.sponsorKinds.intro, color: "#00ffff" },
  outro: { label: text.sponsorKinds.outro, color: "#0202ed" },
  preview: { label: text.sponsorKinds.preview, color: "#008fd6" },
  hook: { label: text.sponsorKinds.hook, color: "#395699" },
  filler: { label: text.sponsorKinds.filler, color: "#7300ff" },
  music_offtopic: { label: text.sponsorKinds.music_offtopic, color: "#ff9900" },
  poi_highlight: { label: text.sponsorKinds.poi_highlight, color: "#ff1684" },
  exclusive_access: { label: text.sponsorKinds.exclusive_access, color: "#008a5c" }
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
  description: text.library.defaultDescription,
  icon: "applications-internet",
  width: 1280,
  height: 800,
  autostart: false,
  type: "app",
  tabs: [],
  tabBarPosition: "top",
  tabInactive: "throttle",
  tabInactiveAfterSeconds: 60,
  tabLazyLoad: true,
  tabStart: "last",
  tabShowIcons: true,
  tabShowBadges: true,
  tabBarSize: 100,
  tabTheme: "manager",
  tabBarAutoHide: false,
  tabShowNames: true,
  tabCollapseUnloaded: true,
  trayWidth: 420,
  trayHeight: 640,
  trayAtIcon: true,
  trayPosition: "bottom-right",
  trayMargin: 8,
  trayScreen: 0,
  trayX: 100,
  trayY: 100,
  trayCloseAfterSeconds: 0,
  trayHotkey: "",
  trayOpenAt: "last",
  trayHideOnBlur: true,
  trayShowAtStart: false,
  windowRadius: 0,
  windowBorderWidth: 0,
  windowBorderColor: "",
  windowBorderOpacity: 100,
  windowBorderStyle: "solid",
  windowGlow: 0,
  windowGlowSide: "inner",
  alwaysOnTop: false,
  closeToTray: false,
  unreadBadge: true,
  startMaximized: false,
  startFullScreen: false,
  startHidden: false,
  keepAwake: "off",
  reloadEverySeconds: 0,
  startMuted: false,
  language: "",
  downloadFolder: "",
  userAgent: "",
  openLinks: "browser",
  linksToApps: true,
  internalHosts: [],
  homeButton: true,
  extensions: [],
  customExtensions: [],
  adBlockHideLeftovers: true,
  adBlockInPageAds: true,
  adBlockAnnoyances: false,
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
  confirmClose: false,
  windowDecorations: true,
  fixedTitle: false,
  defaultZoom: 100,
  allowZoom: true,
  hideScrollbars: false,
  loadingScreen: true,
  backgroundThrottling: false,
  pauseWhenUnfocused: false,
  pauseAfterSeconds: 30,
  cpuPercent: 100,
  slowAfterSeconds: 5,
  unfocusedCpuPercent: 10,
  skipMissedUpdates: false,
  reloadAfterIdleSeconds: 0,
  hardwareAcceleration: true,
  jsHeapMb: 0,
  permissions: "app",
  customCss: "",
  customJs: "",
  proxy: "",
  spellcheck: true,
  spellcheckLanguages: [],
  ignoreCertificateErrors: false,
  flags: [],
  configVersion: 5
};
const EXTENSION_KEYS = {
  adblock: Object.keys(DEFAULTS).filter((key) => key.startsWith("adBlock")),
  sponsorblock: Object.keys(DEFAULTS).filter((key) => key.startsWith("sponsorBlock") || key === "youtubeQuality"),
  darkreader: ["darkBrightness", "darkContrast", "darkSepia"]
};
const MODES = text.modes;
const DEFAULT_PALETTE = "ocean";
const PALETTES = text.palettes;
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}
const PREFS = {
  checkUpdates: true,
  confirmRemove: true,
  restartOnSave: "ask",
  backupBeforeUpdate: true,
  backupsKept: 5,
  showUsage: true,
  motion: true,
  updateChannel: "main",
  restartAppsOnUpdate: true
};
const RESTART_ON_SAVE = ["ask", "always", "never"];
const UPDATE_CHANNELS = ["main", "beta"];
function prefs() {
  const kept = readSettings().manager || {};
  const result = { ...PREFS };
  for (const key of Object.keys(PREFS)) {
    if (typeof kept[key] === typeof PREFS[key]) result[key] = kept[key];
  }
  if (!RESTART_ON_SAVE.includes(result.restartOnSave)) result.restartOnSave = PREFS.restartOnSave;
  if (!UPDATE_CHANNELS.includes(result.updateChannel)) result.updateChannel = PREFS.updateChannel;
  result.backupsKept = Math.min(50, Math.max(1, Math.round(result.backupsKept) || PREFS.backupsKept));
  return result;
}
function setPrefs(next) {
  const now = prefs();
  for (const key of Object.keys(PREFS)) {
    if (key in next && typeof next[key] === typeof PREFS[key]) now[key] = next[key];
  }
  now.backupsKept = Math.min(50, Math.max(1, Math.round(now.backupsKept) || PREFS.backupsKept));
  if (!RESTART_ON_SAVE.includes(now.restartOnSave)) throw new Error(fill(text.errors.oneOf, { key: "restartOnSave", values: RESTART_ON_SAVE.join(", ") }));
  if (!UPDATE_CHANNELS.includes(now.updateChannel)) throw new Error(fill(text.errors.oneOf, { key: "updateChannel", values: UPDATE_CHANNELS.join(", ") }));
  const settings = readSettings();
  settings.manager = now;
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return now;
}
const DEFAULT_CUSTOM = { primary: "#3b6cf0", accent: "#00a7c9", secondary: "#8a5cf0", surface: "#4a6fb5", vivid: 150 };
const COLOUR_HEX = /^#[0-9a-f]{6}$/i;
const customLooks = (value) => plainObject(value) && ["primary", "accent", "secondary", "surface"].every((key) => COLOUR_HEX.test(value[key])) && Number.isFinite(value.vivid) && value.vivid >= 50 && value.vivid <= 200;
function appearance() {
  const kept = readSettings().appearance || {};
  const custom = plainObject(kept.custom) ? kept.custom : {};
  return {
    mode: kept.mode in MODES ? kept.mode : "system",
    palette: kept.palette in PALETTES ? kept.palette : DEFAULT_PALETTE,
    custom: {
      primary: COLOUR_HEX.test(custom.primary) ? custom.primary.toLowerCase() : DEFAULT_CUSTOM.primary,
      accent: COLOUR_HEX.test(custom.accent) ? custom.accent.toLowerCase() : DEFAULT_CUSTOM.accent,
      secondary: COLOUR_HEX.test(custom.secondary) ? custom.secondary.toLowerCase() : COLOUR_HEX.test(custom.primary) ? custom.primary.toLowerCase() : DEFAULT_CUSTOM.secondary,
      surface: COLOUR_HEX.test(custom.surface) ? custom.surface.toLowerCase() : COLOUR_HEX.test(custom.primary) ? custom.primary.toLowerCase() : DEFAULT_CUSTOM.surface,
      vivid: Number.isFinite(custom.vivid) ? Math.min(200, Math.max(50, Math.round(custom.vivid))) : DEFAULT_CUSTOM.vivid
    }
  };
}
function setAppearance(next) {
  const settings = readSettings();
  const now = appearance();
  settings.appearance = { ...now, ...next, custom: { ...now.custom, ...next.custom } };
  if (!(settings.appearance.mode in MODES) || !(settings.appearance.palette in PALETTES) || !customLooks(settings.appearance.custom)) throw new Error(text.errors.unknownLook);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return appearance();
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
      result.left.push(fill(text.library.running, { id }));
    } else if (fs.existsSync(dest)) {
      result.left.push(fill(text.library.existsThere, { id }));
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
const usedMark = (id) => path.join(appDir(id), "last-used");
function markUsed(id) {
  const file = usedMark(id);
  const now = /* @__PURE__ */ new Date();
  fs.utimes(file, now, now, (missing) => {
    if (missing) fs.writeFile(file, "", () => {
    });
  });
}
function lastUsed(id) {
  for (const file of [usedMark(id), path.join(appDir(id), "events.log")]) {
    const at = fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs;
    if (at) return at;
  }
  return 0;
}
const configPath = (id) => path.join(appDir(id), "config.json");
const profileDir = (id) => path.join(appDir(id), "profile");
const desktopId = (id) => `appd-${id}`;
const desktopPath = (name) => path.join(desktopDir, `${name}.desktop`);
function checkId(id) {
  if (!ID_RE.test(id || "")) {
    throw new Error(fill(text.errors.badId, { id: id || "" }));
  }
}
function newId(name) {
  const base = String(name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  let id = base;
  for (let n = 2; fs.existsSync(appDir(id)); n++) id = `${base}-${n}`;
  return id;
}
const RULES = {
  width: { min: 200, max: 16e3 },
  height: { min: 150, max: 16e3 },
  defaultZoom: { min: 25, max: 500 },
  trayWidth: { min: 200, max: 2400 },
  trayHeight: { min: 150, max: 2e3 },
  trayPosition: { oneOf: ["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center", "custom"] },
  trayScreen: { min: 0, max: 16 },
  trayX: { min: 0, max: 100 },
  trayY: { min: 0, max: 100 },
  trayCloseAfterSeconds: { min: 0, max: 86400 },
  trayOpenAt: { oneOf: ["last", "home"] },
  windowRadius: { min: 0, max: 40 },
  windowBorderWidth: { min: 0, max: 12 },
  windowBorderOpacity: { min: 5, max: 100 },
  windowBorderStyle: { oneOf: ["solid", "double", "dashed", "dotted", "groove", "ridge"] },
  keepAwake: { oneOf: ["off", "display", "system"] },
  reloadEverySeconds: { min: 0, max: 86400 },
  windowGlow: { min: 0, max: 40 },
  windowGlowSide: { oneOf: ["inner", "outer", "both"] },
  trayMargin: { min: 0, max: 300 },
  type: { oneOf: Object.keys(APP_TYPES) },
  tabBarPosition: { oneOf: TAB_BAR },
  tabInactive: { oneOf: TAB_INACTIVE },
  tabInactiveAfterSeconds: { min: 1, max: 86400 },
  tabBarSize: { min: 70, max: 160 },
  tabTheme: { oneOf: ["manager", "system", "light", "dark"] },
  tabStart: { oneOf: ["last", "first", "none"] },
  openLinks: { oneOf: OPEN_LINKS },
  permissions: { oneOf: ["app", "all", "none"] },
  colorScheme: { oneOf: COLOR_SCHEMES },
  actionButton: { oneOf: ACTION_BUTTON },
  youtubeQuality: { oneOf: ["auto", ...Object.keys(YOUTUBE_QUALITIES)] },
  sponsorBlockNoticeSeconds: { min: 1, max: 60 },
  sponsorBlockMinSeconds: { min: 0, max: 3600 },
  darkBrightness: { min: 30, max: 150 },
  darkContrast: { min: 30, max: 150 },
  darkSepia: { min: 0, max: 100 },
  cpuPercent: { min: 0.1, max: 100 },
  unfocusedCpuPercent: { min: 0.1, max: 100 },
  slowAfterSeconds: { min: 1, max: 3600 },
  pauseAfterSeconds: { min: 1, max: 86400 },
  reloadAfterIdleSeconds: { min: 0, max: 3600 },
  jsHeapMb: { min: 0, max: 65536 }
};
function validate(cfg) {
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (typeof cfg[key] !== typeof def || Array.isArray(cfg[key]) !== Array.isArray(def)) {
      throw new Error(Array.isArray(def) ? fill(text.errors.mustBeArray, { key }) : fill(text.errors.mustBe, { key, type: typeof def }));
    }
    const rule = RULES[key];
    if (rule?.oneOf && !rule.oneOf.includes(cfg[key])) throw new Error(fill(text.errors.oneOf, { key, values: rule.oneOf.join(", ") }));
    if (rule && "min" in rule && !(cfg[key] >= rule.min && cfg[key] <= rule.max)) {
      throw new Error(fill(text.errors.range, { key, min: rule.min, max: rule.max }));
    }
  }
  if (!URL.canParse(cfg.url)) throw new Error(fill(text.errors.badUrl, { url: cfg.url }));
  if (isMultiTab(cfg)) {
    if (!cfg.tabs.length) throw new Error(text.errors.noTabs);
    cfg.tabs.forEach((tab, index) => {
      if (!plainObject(tab) || typeof tab.name !== "string" || typeof tab.url !== "string" || tab.keepAlive !== void 0 && typeof tab.keepAlive !== "boolean" || tab.icon !== void 0 && typeof tab.icon !== "string") {
        throw new Error(fill(text.errors.badTab, { number: index + 1 }));
      }
      if (!/^https?:\/\//i.test(tab.url) || !URL.canParse(tab.url)) throw new Error(fill(text.errors.badTabUrl, { number: index + 1, url: tab.url }));
    });
  }
  const unknown = cfg.extensions.find((name) => !(name in EXTENSIONS));
  if (unknown !== void 0) throw new Error(fill(text.errors.unknownExtension, { name: unknown, known: Object.keys(EXTENSIONS).join(", ") }));
  for (const key of ["sponsorBlockActions", "sponsorBlockColors"]) {
    if (!cfg[key]) throw new Error(fill(text.errors.mustBeObject, { key }));
    const odd = Object.keys(cfg[key]).find((name) => !(name in SPONSOR_CATEGORIES));
    if (odd !== void 0) throw new Error(fill(text.errors.unknownSponsorKind, { name: odd, key, known: Object.keys(SPONSOR_CATEGORIES).join(", ") }));
  }
  for (const [category, action] of Object.entries(cfg.sponsorBlockActions)) {
    if (!sponsorChoices(category).includes(action)) throw new Error(fill(text.errors.oneOf, { key: `sponsorBlockActions.${category}`, values: sponsorChoices(category).join(", ") }));
  }
  for (const [category, color] of Object.entries(cfg.sponsorBlockColors)) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(fill(text.errors.sponsorColour, { kind: category }));
  }
  if (cfg.trayHotkey && !HOTKEY.test(cfg.trayHotkey)) throw new Error(text.errors.hotkey);
  if (cfg.language && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(cfg.language)) throw new Error(text.errors.language);
  if (cfg.downloadFolder && !path.isAbsolute(cfg.downloadFolder)) throw new Error(text.errors.downloadFolder);
  const oddEntry = cfg.customExtensions.find((entry) => typeof entry !== "string" || !entry || entry.startsWith("store:") && !storeIdOf(entry));
  if (oddEntry !== void 0) throw new Error(fill(text.errors.customExtension, { entry: oddEntry }));
  if (cfg.proxy && !/^(https?|socks[45]?):\/\/[^\s/]+(:\d+)?\/?$/i.test(cfg.proxy)) throw new Error(text.errors.proxy);
  if (cfg.windowBorderColor && !/^#[0-9a-f]{6}$/i.test(cfg.windowBorderColor)) throw new Error(text.errors.borderColour);
  if (!/^https?:\/\/[^\s/]+/i.test(cfg.sponsorBlockServer)) throw new Error(text.errors.sponsorServer);
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
const storeDir = path.join(root, "StoreExtensions");
const storeIdOf = (entry) => typeof entry === "string" && entry.startsWith("store:") && STORE_ID.test(entry.slice(6)) ? entry.slice(6) : "";
const extensionFolder = (entry) => storeIdOf(entry) ? path.join(storeDir, storeIdOf(entry)) : /[\\/]/.test(entry) ? entry : path.join(extensionsDir, entry);
function storeLibrary() {
  const found = {};
  for (const id of Object.keys(readSettings().storeExtensions || {})) {
    if (!STORE_ID.test(id)) continue;
    try {
      found[id] = describeExtension(path.join(storeDir, id));
    } catch {
      found[id] = { name: id, about: text.library.notFetched, options: "", popup: "", icon: "" };
    }
  }
  return found;
}
function addStoreExtension(id) {
  if (!STORE_ID.test(id)) throw new Error(fill(text.errors.notExtensionId, { id }));
  const settings = readSettings();
  settings.storeExtensions = { ...settings.storeExtensions, [id]: { added: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) } };
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
function removeStoreExtension(id) {
  if (!STORE_ID.test(id)) throw new Error(fill(text.errors.notExtensionId, { id }));
  const settings = readSettings();
  if (settings.storeExtensions) delete settings.storeExtensions[id];
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  if (!Object.values(STORE_EXTENSIONS).includes(id)) fs.rmSync(path.join(storeDir, id), { recursive: true, force: true });
  dropFromApps(`store:${id}`);
}
function dropFromApps(entry) {
  for (const id of list()) {
    try {
      const stored = JSON.parse(fs.readFileSync(configPath(id), "utf8"));
      if (!Array.isArray(stored.customExtensions) || !stored.customExtensions.includes(entry)) continue;
      stored.customExtensions = stored.customExtensions.filter((other) => other !== entry);
      fs.writeFileSync(configPath(id), JSON.stringify(stored, null, 2) + "\n");
    } catch {
    }
  }
}
function extensionUse() {
  const use = {};
  for (const id of list()) {
    try {
      const cfg = load(id);
      for (const entry of [...cfg.extensions, ...cfg.customExtensions]) (use[entry] ||= []).push(id);
    } catch {
    }
  }
  return use;
}
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
  if (source.startsWith(extensionsDir + path.sep)) throw new Error(text.errors.extensionInLibrary);
  const name = info.name.toLowerCase().replace(/ [\d.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "extension";
  const target = path.join(extensionsDir, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return name;
}
function removeImportedExtension(name) {
  if (!ID_RE.test(name)) throw new Error(fill(text.errors.badExtensionName, { name }));
  fs.rmSync(path.join(extensionsDir, name), { recursive: true, force: true });
  dropFromApps(name);
}
function settleTabs(cfg) {
  if (!Array.isArray(cfg.tabs)) return cfg;
  cfg.tabs = cfg.tabs.map((tab) => {
    if (!plainObject(tab)) return tab;
    const url = typeof tab.url === "string" ? tab.url.trim() : tab.url;
    const name = typeof tab.name === "string" ? tab.name.trim() : tab.name;
    return { name: name || (typeof url === "string" && URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : ""), url, icon: typeof tab.icon === "string" ? tab.icon.trim() : "", keepAlive: tab.keepAlive === true };
  });
  if (isMultiTab(cfg) && typeof cfg.tabs[0]?.url === "string") cfg.url = cfg.tabs[0].url;
  return cfg;
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
  if (version < 4 && stored.windowBorderColor === "#7a7f87") stored.windowBorderColor = "";
  if (typeof stored.trayApp === "boolean" && stored.type === void 0) stored.type = stored.trayApp ? "tray" : "app";
  delete stored.trayApp;
  if (stored.type !== void 0 && !(stored.type in APP_TYPES)) stored.type = DEFAULTS.type;
  if (stored.windowBorderStyle === "glow") {
    stored.windowGlow = Math.min(40, (stored.windowBorderWidth || 2) * 3);
    stored.windowBorderStyle = "solid";
    stored.windowBorderWidth = 1;
  }
  if (typeof stored.reloadAfterIdleMinutes === "number" && stored.reloadAfterIdleSeconds === void 0) stored.reloadAfterIdleSeconds = stored.reloadAfterIdleMinutes * 60;
  delete stored.reloadAfterIdleMinutes;
  if (Array.isArray(stored.extensions)) stored.extensions = stored.extensions.filter((name) => name in EXTENSIONS);
  for (const key of ["cpuPercent", "unfocusedCpuPercent"]) {
    if (typeof stored[key] === "number" && stored[key] <= 0) stored[key] = 100;
  }
  stored.configVersion = DEFAULTS.configVersion;
  for (const [key, rule] of Object.entries(RULES)) {
    if ("min" in rule && typeof stored[key] === "number") stored[key] = Math.min(rule.max, Math.max(rule.min, stored[key]));
  }
  if (typeof stored.tabRememberLast === "boolean" && stored.tabStart === void 0) stored.tabStart = stored.tabRememberLast ? "last" : "none";
  delete stored.tabRememberLast;
  const shared = extensionDefaults();
  const cfg = { ...DEFAULTS, ...shared, ...stored };
  settleTabs(cfg);
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
    throw new Error(fill(text.errors.noApp, { id, file: configPath(id) }));
  }
  let cfg;
  try {
    cfg = withDefaults(JSON.parse(raw));
    cfg.name ||= id;
    validate(cfg);
    cfg.autostart = startsAtLogin(id);
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
  cfg = settleTabs({ ...cfg });
  validate(cfg);
  fs.mkdirSync(appDir(id), { recursive: true });
  const icon = iconFile(id, cfg);
  if (icon && path.dirname(icon) !== appDir(id)) {
    const name = `icon${path.extname(icon).toLowerCase()}`;
    fs.copyFileSync(icon, path.join(appDir(id), name));
    cfg = { ...cfg, icon: name };
  }
  if (cfg.tabs.some((tab) => path.isAbsolute(tab.icon || ""))) {
    cfg = {
      ...cfg,
      tabs: cfg.tabs.map((tab, index) => {
        if (!path.isAbsolute(tab.icon || "") || !fs.statSync(tab.icon, { throwIfNoEntry: false })?.isFile()) return tab;
        if (path.dirname(tab.icon) === appDir(id)) return { ...tab, icon: path.basename(tab.icon) };
        const name = `tab-icon-${index + 1}${path.extname(tab.icon).toLowerCase()}`;
        fs.copyFileSync(tab.icon, path.join(appDir(id), name));
        return { ...tab, icon: name };
      })
    };
  }
  const stored = { ...cfg };
  for (const key of ALL_EXTENSION_KEYS) delete stored[key];
  Object.assign(stored, differing(cfg, extensionDefaults()));
  fs.writeFileSync(configPath(id), JSON.stringify(stored, null, 2) + "\n");
  setAutostart(id, cfg);
}
const trashDir = path.join(root, "Trash");
function remove(id) {
  checkId(id);
  const kept = path.join(trashDir, id);
  fs.rmSync(kept, { recursive: true, force: true });
  try {
    fs.mkdirSync(trashDir, { recursive: true });
    fs.renameSync(appDir(id), kept);
    return true;
  } catch {
    fs.rmSync(appDir(id), { recursive: true, force: true });
    return false;
  }
}
function restore(id) {
  checkId(id);
  if (fs.existsSync(appDir(id))) throw new Error(fill(text.errors.appAgain, { id }));
  fs.mkdirSync(appsDir(), { recursive: true });
  fs.renameSync(path.join(trashDir, id), appDir(id));
}
function emptyTrash(id) {
  if (id) checkId(id);
  fs.rmSync(id ? path.join(trashDir, id) : trashDir, { recursive: true, force: true });
}
function clearData(id) {
  checkId(id);
  if (runningPid(id)) throw new Error(text.errors.closeFirst);
  fs.rmSync(profileDir(id), { recursive: true, force: true });
}
function duplicate(id) {
  const cfg = load(id);
  const name = fill(text.library.copyName, { name: cfg.name });
  const copy = newId(name);
  save(copy, { ...cfg, name, icon: iconFile(id, cfg) || cfg.icon, autostart: false });
  return copy;
}
function exportApps() {
  const apps = [];
  for (const id of list()) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath(id), "utf8"));
      const icon = iconFile(id, load(id));
      const own = icon && path.dirname(icon) === appDir(id);
      apps.push({ id, config, icon: own ? { name: path.basename(icon), data: fs.readFileSync(icon).toString("base64") } : null });
    } catch {
    }
  }
  return { what: "AppD-Manager apps", version: 1, extensionSettings: readSettings().extensionSettings || null, apps };
}
function importApps(data) {
  if (!data || data.what !== "AppD-Manager apps" || !Array.isArray(data.apps)) throw new Error(text.errors.notExport);
  const result = { added: [], skipped: [] };
  try {
    if (data.extensionSettings && !readSettings().extensionSettings) setExtensionDefaults(data.extensionSettings);
  } catch {
  }
  for (const entry of data.apps) {
    try {
      const cfg = withDefaults(entry.config || {});
      cfg.name ||= String(entry.id || "App");
      validate(cfg);
      const id = ID_RE.test(entry.id || "") && !fs.existsSync(appDir(entry.id)) ? entry.id : newId(cfg.name);
      fs.mkdirSync(appDir(id), { recursive: true });
      if (entry.icon && /^[\w.-]+$/.test(entry.icon.name || "")) {
        fs.writeFileSync(path.join(appDir(id), entry.icon.name), Buffer.from(String(entry.icon.data), "base64"));
        cfg.icon = entry.icon.name;
      }
      save(id, cfg);
      result.added.push(cfg.name);
    } catch (e) {
      result.skipped.push(`${entry && entry.id || "?"}: ${e.message}`);
    }
  }
  return result;
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
function resourceUse() {
  const use = {};
  if (WINDOWS) return use;
  const parent = {};
  const resident = {};
  const ticks = {};
  try {
    for (const name of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(name)) continue;
      try {
        const stat = fs.readFileSync(`/proc/${name}/stat`, "utf8");
        const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        parent[name] = rest[1];
        resident[name] = Number(rest[21]) * 4096;
        ticks[name] = Number(rest[11]) + Number(rest[12]);
      } catch {
      }
    }
  } catch {
    return use;
  }
  const children = {};
  for (const [pid, of] of Object.entries(parent)) (children[of] ||= []).push(pid);
  const total = (of, pid) => (of[pid] || 0) + (children[pid] || []).reduce((sum, child) => sum + total(of, child), 0);
  for (const id of list()) {
    const pid = runningPid(id);
    if (pid) use[id] = { memory: total(resident, String(pid)), cpuSeconds: total(ticks, String(pid)) / 100 };
  }
  return use;
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
    const pictures = [16, 24, 32, 48, 64].map((size) => {
      const data = image.resize({ width: size, height: size, quality: "best" }).toBitmap({ scaleFactor: 1 });
      const rgba = Buffer.alloc(size * size * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        const solid = data[i + 3];
        const full = solid ? 255 / solid : 0;
        rgba[i] = Math.min(255, Math.round(data[i + 2] * full));
        rgba[i + 1] = Math.min(255, Math.round(data[i + 1] * full));
        rgba[i + 2] = Math.min(255, Math.round(data[i] * full));
        rgba[i + 3] = solid;
      }
      return { size, rgba };
    });
    pictures.push({ size: 256, png: image.resize({ width: 256, height: 256, quality: "best" }).toPNG() });
    const file = path.join(folder, "icon.ico");
    fs.writeFileSync(file, require("./ico").icoFrom(pictures));
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
  const drawn = path.join(profileDir(id), "icon-256.png");
  const own = iconFile(id, cfg);
  const source = own && !/\.(png|jpe?g)$/i.test(own) && fs.existsSync(drawn) ? drawn : own;
  const startup = path.join(path.dirname(startMenuDir), "Startup", `AppD ${id}.lnk`);
  if (!cfg.autostart) fs.rmSync(startup, { force: true });
  else if (electronShell()) electronShell().shell.writeShortcutLink(startup, fs.existsSync(startup) ? "update" : "create", { target, args: shortcutArgs(args), cwd: path.dirname(launcher) });
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
    description: text.library.managerComment,
    icon: path.join(__dirname, "manager", "icon.ico"),
    iconIndex: 0,
    appUserModelId: windowsAppId("manager")
  }) && written;
  if (!written) {
    problems.push(text.library.startMenuLater);
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
    `Exec=${execArg(launcher)} run ${id}${startFlags(cfg).map((flag) => ` ${flag}`).join("")}`,
    `Icon=${entryValue(iconFile(id, cfg) || cfg.icon)}`,
    "Categories=Network;",
    `StartupWMClass=${desktopId(id)}`,
    ...appType(cfg).menu ? [] : ["NoDisplay=true"],
    `Actions=${Object.keys({ ...APP_ACTIONS, ...appType(cfg).actions }).join(";")};`
  ], Object.entries({ ...APP_ACTIONS, ...appType(cfg).actions }).flatMap(([action, label]) => [
    `[Desktop Action ${action}]`,
    `Name=${label}`,
    `Exec=${execArg(launcher)} run ${id}${startFlags(cfg).map((flag) => ` ${flag}`).join("")} --appd-action=${action}`,
    ""
  ]));
}
const autostartDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "autostart");
const autostartPath = (id) => path.join(autostartDir, `${desktopId(id)}.desktop`);
const OURS = "X-AppD-Manager=true";
function startsAtLogin(id) {
  if (WINDOWS) return fs.existsSync(path.join(path.dirname(startMenuDir), "Startup", `AppD ${id}.lnk`));
  return fs.existsSync(autostartPath(id));
}
function setAutostart(id, cfg) {
  if (WINDOWS) return;
  const file = autostartPath(id);
  if (!cfg.autostart) {
    fs.rmSync(file, { force: true });
    return;
  }
  let existing = null;
  try {
    existing = fs.readFileSync(file, "utf8");
  } catch {
  }
  if (existing !== null && !existing.includes(OURS)) return;
  const content = [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${entryValue(cfg.name)}`,
    `Exec=${execArg(launcher)} run ${id}${startFlags(cfg).map((flag) => ` ${flag}`).join("")}`,
    `Icon=${entryValue(iconFile(id, cfg) || cfg.icon)}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    OURS,
    ""
  ].join("\n");
  if (existing === content) return;
  fs.mkdirSync(autostartDir, { recursive: true });
  fs.writeFileSync(file, content);
}
function writeManagerDesktop() {
  writeEntry(MANAGER_DESKTOP_ID, [
    "Name=AppD-Manager",
    `Comment=${text.library.managerComment}`,
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
  for (const file of fs.existsSync(autostartDir) ? fs.readdirSync(autostartDir) : []) {
    const m = /^appd-(.+)\.desktop$/.exec(file);
    if (!m || ids.includes(m[1])) continue;
    try {
      if (fs.readFileSync(path.join(autostartDir, file), "utf8").includes(OURS)) fs.rmSync(path.join(autostartDir, file));
    } catch {
    }
  }
  spawn("kbuildsycoca6", { stdio: "ignore", detached: true }).on("error", () => {
  }).unref();
  return problems;
}
module.exports = {
  resourceUse,
  DEFAULT_PALETTE,
  prefs,
  setPrefs,
  restore,
  emptyTrash,
  startFlags,
  MODES,
  PALETTES,
  DEFAULT_CUSTOM,
  appearance,
  setAppearance,
  STORE_EXTENSIONS,
  RULES,
  clearData,
  duplicate,
  exportApps,
  importApps,
  DEFAULTS,
  APP_TYPES,
  appType,
  isTray,
  isMultiTab,
  TAB_INACTIVE,
  TAB_BAR,
  APP_ACTIONS,
  TRAY_ACTIONS,
  HOTKEY,
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
  EXTENSION_CATEGORIES,
  STORE_ID,
  storeDir,
  storeIdOf,
  storeLibrary,
  addStoreExtension,
  removeStoreExtension,
  extensionUse,
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
  markUsed,
  lastUsed,
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

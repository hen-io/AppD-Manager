"use strict";
const { app, net } = require("electron");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./lib");
const { text, fill } = require("./shared/text");
const t = text.updating;
const REPO = "hen-io/AppD-Manager";
const API = `https://api.github.com/repos/${REPO}`;
const rawUrl = (tag, file) => `https://raw.githubusercontent.com/${REPO}/${tag}/${file}`;
const tarballUrl = (tag) => `https://codeload.github.com/${REPO}/tar.gz/refs/tags/${tag}`;
const installDir = path.dirname(lib.launcher);
const isBuild = path.join(installDir, "resources", "app") === __dirname;
const releasesUrl = `https://github.com/${REPO}/releases`;
function writable() {
  try {
    fs.accessSync(installDir, fs.constants.W_OK);
    fs.accessSync(path.dirname(__dirname), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
function packaged() {
  if (lib.WINDOWS) return false;
  const home = os.homedir();
  return !installDir.startsWith(home + path.sep) || !writable();
}
function packageCommand() {
  const has = (name) => ["/usr/bin", "/bin", "/usr/sbin"].some((dir) => fs.existsSync(path.join(dir, name)));
  if (has("dnf")) return "sudo dnf upgrade --refresh appd-manager";
  if (has("pacman")) return "sudo pacman -Sy appd-manager";
  if (has("apt")) return "sudo apt update && sudo apt install --only-upgrade appd-manager";
  return t.packageManager;
}
async function download(url) {
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(fill(t.github, { status: res.status, url }));
  return res;
}
function halves(version) {
  const all = String(version).replace(/^v/, "").split(/[.-]/).filter(Boolean);
  const cut = all.findIndex((part) => !/^\d+$/.test(part));
  return { numbers: (cut < 0 ? all : all.slice(0, cut)).map(Number), ahead: cut < 0 ? [] : all.slice(cut) };
}
function isNewer(a, b) {
  const [x, y] = [halves(a), halves(b)];
  for (let i = 0; i < Math.max(x.numbers.length, y.numbers.length); i++) {
    if ((x.numbers[i] || 0) !== (y.numbers[i] || 0)) return (x.numbers[i] || 0) > (y.numbers[i] || 0);
  }
  if (!x.ahead.length || !y.ahead.length) return !x.ahead.length && y.ahead.length > 0;
  for (let i = 0; i < Math.max(x.ahead.length, y.ahead.length); i++) {
    const [p, q] = [x.ahead[i] ?? "0", y.ahead[i] ?? "0"];
    if (p === q) continue;
    if (/^\d+$/.test(p) && /^\d+$/.test(q)) return Number(p) > Number(q);
    return p.toLowerCase() > q.toLowerCase();
  }
  return false;
}
function described(release) {
  const url = String(release.html_url || "");
  return {
    tag: release.tag_name,
    name: String(release.name || "").trim(),
    notes: String(release.body || "").replace(/\r/g, "").trim(),
    url: url.startsWith(`https://github.com/${REPO}/`) ? url : releasesUrl,
    date: String(release.published_at || ""),
    beta: Boolean(release.prerelease)
  };
}
async function latestRelease(channel = "main") {
  if (channel === "beta") {
    const list = (await (await download(`${API}/releases?per_page=100`)).json()).filter((release) => !release.draft && release.published_at);
    const newest = list.reduce((best, release) => !best || Date.parse(release.published_at) > Date.parse(best.published_at) ? release : best, null);
    if (newest) return described(newest);
  }
  const res = await net.fetch(`${API}/releases/latest`, { cache: "no-store" });
  if (res.ok) return described(await res.json());
  if (res.status !== 404) throw new Error(fill(t.github, { status: res.status, url: `${API}/releases/latest` }));
  const tags = await (await download(`${API}/tags?per_page=100`)).json();
  const versions = tags.map((tag2) => tag2.name).filter((name) => /^v?\d+(\.\d+)*$/.test(name));
  const tag = versions.reduce((best, name) => best === null || isNewer(name, best) ? name : best, null);
  return tag ? { tag, name: "", notes: "", url: releasesUrl, date: "", beta: false } : null;
}
async function releaseOf(version) {
  try {
    for (const tag of [`v${version}`, version]) {
      const res = await net.fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { cache: "no-store" });
      if (res.ok) {
        const release = await res.json();
        return { date: String(release.published_at || ""), beta: Boolean(release.prerelease) };
      }
    }
  } catch {
  }
  return null;
}
async function isUpdate(release, current, channel) {
  if (!release || release.tag.replace(/^v/, "") === current) return false;
  const mine = await releaseOf(current);
  if (mine?.beta && channel === "main") return true;
  if (mine?.date && release.date) return Date.parse(release.date) > Date.parse(mine.date);
  return isNewer(release.tag, current);
}
async function check() {
  const current = app.getVersion();
  const channel = lib.prefs().updateChannel;
  const release = await latestRelease(channel);
  const { tag = null, name = "", notes = "", url = releasesUrl, beta = false } = release || {};
  const latest = tag ? tag.replace(/^v/, "") : current;
  const available = await isUpdate(release, current, channel);
  const blocked = available ? await whyNot(tag) : "";
  return { current, latest, tag, name, notes, url, available, blocked, channel, beta };
}
async function whyNot(tag) {
  if (!isBuild) return t.fromSource;
  if (lib.WINDOWS && !writable()) {
    return fill(t.notWritable, { folder: installDir });
  }
  if (packaged()) return fill(t.packaged, { command: packageCommand() });
  return "";
}
function runtimeOf(appFolder) {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(appFolder, "runtime.json"), "utf8")).electron || "");
  } catch {
    try {
      return fs.readFileSync(path.join(appFolder, "electron-version"), "utf8").trim().replace(/^v/, "");
    } catch {
      return "";
    }
  }
}
function runtimeBehind() {
  const wanted = runtimeOf(__dirname);
  if (!wanted || wanted === process.versions.electron || !isBuild || packaged() || !writable()) return "";
  return wanted;
}
const ARCH = { x64: "x64", arm64: "arm64", arm: "armv7l", ia32: "ia32" }[process.arch];
async function fetchRuntime(version, tmp) {
  const file = `electron-v${version}-${lib.WINDOWS ? "win32" : "linux"}-${ARCH}.zip`;
  const base = `https://github.com/electron/electron/releases/download/v${version}`;
  const sums = ARCH && /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) ? await (await download(`${base}/SHASUMS256.txt`)).text() : "";
  const wanted = sums.split("\n").map((line) => line.trim().split(/\s+/)).find(([, name]) => name?.replace(/^\*/, "") === file)?.[0];
  if (!wanted) throw new Error(fill(t.noRuntime, { version, file }));
  const data = Buffer.from(await (await download(`${base}/${file}`)).arrayBuffer());
  if (crypto.createHash("sha256").update(data).digest("hex") !== wanted) throw new Error(fill(t.runtimeChecksum, { version }));
  const zip = path.join(tmp, file);
  fs.writeFileSync(zip, data);
  return zip;
}
function unpackRuntime(zip, folder, version) {
  const tools = lib.WINDOWS ? [["tar", ["-xf", zip, "-C", folder]]] : [["unzip", ["-q", "-o", zip, "-d", folder]], ["bsdtar", ["-xf", zip, "-C", folder]]];
  for (const [command, args] of tools) {
    fs.rmSync(folder, { recursive: true, force: true });
    fs.mkdirSync(folder, { recursive: true });
    const done = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
    if (!done.error && done.status === 0) return;
  }
  try {
    fs.rmSync(folder, { recursive: true, force: true });
    fs.mkdirSync(folder, { recursive: true });
    require("./app/store-extension").unzip(fs.readFileSync(zip), folder);
    for (const name of ["electron", "chrome_crashpad_handler", "chrome-sandbox"]) {
      if (!lib.WINDOWS && fs.existsSync(path.join(folder, name))) fs.chmodSync(path.join(folder, name), 493);
    }
  } catch (e) {
    throw new Error(fill(t.notUnzipped, { version, why: e.message }));
  }
}
async function swapRuntime(version, { appFolder = __dirname, launcher = lib.launcher } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "appd-runtime-"));
  const staged = `${installDir}.runtime-new`;
  const asar = process.noAsar;
  process.noAsar = true;
  try {
    unpackRuntime(await fetchRuntime(version, tmp), staged, version);
    fs.rmSync(path.join(staged, "resources", "default_app.asar"), { force: true });
    fs.cpSync(appFolder, path.join(staged, "resources", "app"), { recursive: true });
    if (!lib.WINDOWS) {
      fs.copyFileSync(launcher, path.join(staged, path.basename(lib.launcher)));
      fs.chmodSync(path.join(staged, path.basename(lib.launcher)), 493);
    }
    for (const name of ["install.sh", "appd.cmd"]) {
      if (fs.existsSync(path.join(installDir, name))) fs.copyFileSync(path.join(installDir, name), path.join(staged, name));
    }
    if (lib.WINDOWS) {
      const exe = path.join(staged, path.basename(process.execPath));
      fs.renameSync(path.join(staged, "electron.exe"), exe);
      try {
        require("./ico").setExeIcon(exe, path.join(__dirname, "manager", "icon.ico"));
      } catch {
      }
      return { staged };
    }
    const old = `${installDir}.runtime-old`;
    fs.rmSync(old, { recursive: true, force: true });
    fs.renameSync(installDir, old);
    try {
      fs.renameSync(staged, installDir);
    } catch (e) {
      fs.renameSync(old, installDir);
      throw e;
    }
    return { now: true, runtime: version };
  } catch (e) {
    fs.rmSync(staged, { recursive: true, force: true });
    throw e;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    process.noAsar = asar;
  }
}
const updateRuntime = () => swapRuntime(runtimeBehind());
function finishRuntime(staged, ids = []) {
  const exe = path.basename(process.execPath);
  const script = path.join(os.tmpdir(), `appd-runtime-${Date.now()}.cmd`);
  fs.writeFileSync(script, [
    "@echo off",
    "chcp 65001 >nul",
    `set "DEST=${installDir}"`,
    `set "NEW=${staged}"`,
    "set /a TRIES=0",
    ":wait",
    `tasklist /FI "IMAGENAME eq ${exe}" /NH | find /I "${exe}" >nul`,
    "if errorlevel 1 goto swap",
    "set /a TRIES+=1",
    `if %TRIES% GEQ 120 taskkill /F /IM "${exe}" >nul 2>&1`,
    "timeout /t 1 /nobreak >nul",
    "goto wait",
    ":swap",
    'robocopy "%NEW%" "%DEST%" /E /MOVE /R:5 /W:1 >nul',
    'rmdir /S /Q "%NEW%" 2>nul',
    `start "" "%DEST%\\${exe}"`,
    ...ids.filter((id) => /^[a-z0-9][a-z0-9_-]*$/.test(id)).map((id) => `start "" "%DEST%\\${exe}" --appd-run=${id}`),
    '(goto) 2>nul & del "%~f0"',
    ""
  ].join("\r\n"));
  spawn("cmd.exe", ["/c", script], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}
function installedAt() {
  if (path.basename(path.dirname(__dirname)) !== "resources") return 0;
  return Math.max(...[path.join(__dirname, "package.json"), path.join(installDir, "version")].map((file) => fs.statSync(file, { throwIfNoEntry: false })?.ctimeMs || 0));
}
function tidy() {
  fs.rmSync(`${installDir}.runtime-old`, { recursive: true, force: true });
  if (!lib.WINDOWS) fs.rmSync(`${installDir}.runtime-new`, { recursive: true, force: true });
}
async function releases() {
  const wantBeta = lib.prefs().updateChannel === "beta";
  const list = await (await download(`${API}/releases?per_page=100`)).json();
  const current = app.getVersion();
  const newest = (x, y) => Date.parse(y.published_at || 0) - Date.parse(x.published_at || 0);
  return list.filter((release) => !release.draft && /^[\w.+-]+$/.test(release.tag_name || "") && Boolean(release.prerelease) === wantBeta).sort(newest).map((release) => ({
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/, ""),
    name: String(release.name || "").trim(),
    date: String(release.published_at || "").slice(0, 10),
    beta: Boolean(release.prerelease),
    current: release.tag_name.replace(/^v/, "") === current
  }));
}
const backupsDir = path.join(lib.root, "Backups");
function backup() {
  const now = /* @__PURE__ */ new Date();
  const stamp = `${now.toLocaleDateString("sv")}_${now.toLocaleTimeString("sv").replace(/:/g, "-")}`;
  const folder = path.join(backupsDir, `${stamp}_v${app.getVersion()}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.cpSync(__dirname, path.join(folder, "program", "resources", "app"), { recursive: true });
  if (!lib.WINDOWS) fs.copyFileSync(lib.launcher, path.join(folder, "program", path.basename(lib.launcher)));
  fs.writeFileSync(path.join(folder, "apps.json"), JSON.stringify(lib.exportApps()));
  if (fs.existsSync(lib.settingsPath)) fs.copyFileSync(lib.settingsPath, path.join(folder, "settings.json"));
  fs.writeFileSync(path.join(folder, "README.txt"), [
    `AppD-Manager ${app.getVersion()}, as it was on ${stamp.replace("_", " at ").replace(/-(\d\d)-(\d\d)$/, ":$1:$2")}.`,
    "",
    "apps.json      every app (settings and icon, not logins): Settings > General > Backup > Import apps",
    "settings.json  the manager's own settings: goes to ~/.AppD-manager/settings.json",
    `program/       the program itself: its contents go over ${installDir}`,
    ""
  ].join("\n"));
  purgeBackups();
  return folder;
}
function purgeBackups() {
  let names = [];
  try {
    names = fs.readdirSync(backupsDir).filter((name) => /^\d{4}-\d\d-\d\d_/.test(name)).sort();
  } catch {
    return 0;
  }
  const old = names.slice(0, Math.max(0, names.length - lib.prefs().backupsKept));
  for (const name of old) fs.rmSync(path.join(backupsDir, name), { recursive: true, force: true });
  return old.length;
}
async function install(tag) {
  const info = tag ? { tag: String(tag) } : await check();
  if (tag) {
    if (!/^[\w.+-]+$/.test(info.tag)) throw new Error(fill(t.notVersion, { tag: info.tag }));
    info.blocked = await whyNot(info.tag);
  } else if (!info.available) throw new Error(t.upToDate);
  if (info.blocked) throw new Error(info.blocked);
  if (lib.prefs().backupBeforeUpdate) backup();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "appd-update-"));
  const staged = `${__dirname}.new`;
  const previous = `${__dirname}.old`;
  const stagedLauncher = `${lib.launcher}.new`;
  try {
    const archive = path.join(tmp, "update.tar.gz");
    fs.writeFileSync(archive, Buffer.from(await (await download(tarballUrl(info.tag))).arrayBuffer()));
    const src = path.join(tmp, "src");
    fs.mkdirSync(src);
    const tar = spawnSync("tar", ["-xzf", archive, "-C", src, "--strip-components=1"], { encoding: "utf8" });
    if (tar.status !== 0) throw new Error(fill(t.notUnpacked, { why: tar.stderr || tar.error?.message }));
    const newApp = path.join(src, "resources", "app");
    if (!fs.existsSync(path.join(newApp, "main.js")) || !fs.existsSync(path.join(src, "appd"))) {
      throw new Error(t.notBuild);
    }
    const version = JSON.parse(fs.readFileSync(path.join(newApp, "package.json"), "utf8")).version;
    const runtime = runtimeOf(newApp);
    if (runtime && runtime !== process.versions.electron) {
      return { version, ...await swapRuntime(runtime, { appFolder: newApp, launcher: path.join(src, "appd") }) };
    }
    fs.rmSync(staged, { recursive: true, force: true });
    fs.rmSync(previous, { recursive: true, force: true });
    fs.cpSync(newApp, staged, { recursive: true });
    if (!lib.WINDOWS) {
      fs.copyFileSync(path.join(src, "appd"), stagedLauncher);
      fs.chmodSync(stagedLauncher, 493);
    }
    fs.renameSync(__dirname, previous);
    try {
      fs.renameSync(staged, __dirname);
    } catch (e) {
      fs.renameSync(previous, __dirname);
      throw e;
    }
    if (!lib.WINDOWS) fs.renameSync(stagedLauncher, lib.launcher);
    fs.rmSync(previous, { recursive: true, force: true });
    return { version, now: true };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(staged, { recursive: true, force: true });
    fs.rmSync(stagedLauncher, { force: true });
  }
}
module.exports = { REPO, releasesUrl, check, install, releases, backup, purgeBackups, backupsDir, isNewer, runtimeBehind, updateRuntime, finishRuntime, tidy, installedAt };

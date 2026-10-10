"use strict";
const { app, net } = require("electron");
const { spawnSync } = require("child_process");
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
const parts = (version) => String(version).replace(/^v/, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
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
    const list = (await (await download(`${API}/releases?per_page=30`)).json()).filter((release) => !release.draft && release.published_at);
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
async function publishedAt(version) {
  try {
    for (const tag of [`v${version}`, version]) {
      const res = await net.fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { cache: "no-store" });
      if (res.ok) return String((await res.json()).published_at || "");
    }
  } catch {
  }
  return "";
}
async function isUpdate(release, current) {
  if (!release || release.tag.replace(/^v/, "") === current) return false;
  const mine = release.date && await publishedAt(current);
  if (mine) return Date.parse(release.date) > Date.parse(mine);
  return isNewer(release.tag, current);
}
async function check() {
  const current = app.getVersion();
  const channel = lib.prefs().updateChannel;
  const release = await latestRelease(channel);
  const { tag = null, name = "", notes = "", url = releasesUrl, beta = false } = release || {};
  const latest = tag ? tag.replace(/^v/, "") : current;
  const available = await isUpdate(release, current);
  const blocked = available ? await whyNot(tag) : "";
  return { current, latest, tag, name, notes, url, available, blocked, channel, beta };
}
async function whyNot(tag) {
  if (!isBuild) return t.fromSource;
  if (lib.WINDOWS && !writable()) {
    return fill(t.notWritable, { folder: installDir });
  }
  if (packaged()) return fill(t.packaged, { command: packageCommand() });
  const runtime = await download(rawUrl(tag, "resources/app/electron-version")).then((r) => r.text(), () => "");
  if (runtime.trim() && parts(runtime)[0] !== parts(process.versions.electron)[0]) {
    return fill(t.otherRuntime, { version: tag.replace(/^v/, ""), needed: runtime.trim(), have: process.versions.electron });
  }
  return "";
}
async function releases() {
  const list = await (await download(`${API}/releases?per_page=30`)).json();
  const current = app.getVersion();
  return list.filter((release) => !release.draft && /^[\w.+-]+$/.test(release.tag_name || "")).map((release) => ({
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
    return version;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(staged, { recursive: true, force: true });
    fs.rmSync(stagedLauncher, { force: true });
  }
}
module.exports = { REPO, releasesUrl, check, install, releases, backup, purgeBackups, backupsDir, isNewer };

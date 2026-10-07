"use strict";
const { app, net } = require("electron");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./lib");
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
  return "your system's package manager";
}
async function download(url) {
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
  return res;
}
const parts = (version) => String(version).replace(/^v/, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
function isNewer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}
async function latestRelease() {
  const res = await net.fetch(`${API}/releases/latest`, { cache: "no-store" });
  if (res.ok) {
    const release = await res.json();
    const url = String(release.html_url || "");
    return {
      tag: release.tag_name,
      name: String(release.name || "").trim(),
      notes: String(release.body || "").replace(/\r/g, "").trim(),
      url: url.startsWith(`https://github.com/${REPO}/`) ? url : releasesUrl
    };
  }
  if (res.status !== 404) throw new Error(`GitHub answered ${res.status} for ${API}/releases/latest`);
  const tags = await (await download(`${API}/tags?per_page=100`)).json();
  const versions = tags.map((tag2) => tag2.name).filter((name) => /^v?\d+(\.\d+)*$/.test(name));
  const tag = versions.reduce((best, name) => best === null || isNewer(name, best) ? name : best, null);
  return tag ? { tag, name: "", notes: "", url: releasesUrl } : null;
}
async function check() {
  const current = app.getVersion();
  const release = await latestRelease();
  const { tag = null, name = "", notes = "", url = releasesUrl } = release || {};
  const latest = tag ? tag.replace(/^v/, "") : current;
  const available = isNewer(latest, current);
  let blocked = "";
  if (available && !isBuild) {
    blocked = "This copy runs from the source folder and cannot update itself.";
  } else if (available && lib.WINDOWS && !writable()) {
    blocked = `AppD-Manager cannot write to its own folder (${installDir}): move it to a folder of your own, or download the new version from the release page.`;
  } else if (available && packaged()) {
    blocked = `This copy was installed by the system's package manager, so it is updated there: ${packageCommand()}`;
  } else if (available) {
    const runtime = await download(rawUrl(tag, "resources/app/electron-version")).then((r) => r.text(), () => "");
    if (runtime.trim() && parts(runtime)[0] !== parts(process.versions.electron)[0]) {
      blocked = `Version ${latest} needs a newer runtime (Electron ${runtime.trim()}); run the install script again.`;
    }
  }
  return { current, latest, tag, name, notes, url, available, blocked };
}
async function install() {
  const info = await check();
  if (!info.available) throw new Error("AppD-Manager is already up to date.");
  if (info.blocked) throw new Error(info.blocked);
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
    if (tar.status !== 0) throw new Error(`Could not unpack the update: ${tar.stderr || tar.error?.message}`);
    const newApp = path.join(src, "resources", "app");
    if (!fs.existsSync(path.join(newApp, "main.js")) || !fs.existsSync(path.join(src, "appd"))) {
      throw new Error("The download is not an AppD-Manager build.");
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
module.exports = { REPO, releasesUrl, check, install };

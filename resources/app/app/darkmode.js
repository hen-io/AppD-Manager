"use strict";
const { nativeTheme } = require("electron");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const config = () => process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
const KDE_GLOBALS = () => path.join(config(), "kdeglobals");
const DCONF = () => path.join(config(), "dconf", "user");
const ASK_MS = 1500;
const run = (command, args) => {
  const done = spawnSync(command, args, { encoding: "utf8", timeout: ASK_MS });
  return done.status === 0 ? done.stdout : "";
};
function fromPortal() {
  const object = "/org/freedesktop/portal/desktop";
  const answer = run("gdbus", [
    "call",
    "--session",
    "--dest",
    "org.freedesktop.portal.Desktop",
    "--object-path",
    object,
    "--method",
    "org.freedesktop.portal.Settings.ReadOne",
    "org.freedesktop.appearance",
    "color-scheme"
  ]) || run("busctl", ["--user", "call", "org.freedesktop.portal.Desktop", object, "org.freedesktop.portal.Settings", "ReadOne", "ss", "org.freedesktop.appearance", "color-scheme"]);
  const value = Number((/(?:uint32|\bu)\s+(\d)/.exec(answer) || [])[1]);
  return value === 1 ? true : value === 2 ? false : null;
}
function fromKde() {
  try {
    let section = "";
    for (const line of fs.readFileSync(KDE_GLOBALS(), "utf8").split("\n")) {
      if (line.startsWith("[")) section = line.trim();
      const rgb = section === "[Colors:Window]" && /^BackgroundNormal=(\d+),(\d+),(\d+)/.exec(line);
      if (rgb) return 0.2126 * rgb[1] + 0.7152 * rgb[2] + 0.0722 * rgb[3] < 128;
    }
    return null;
  } catch {
    return null;
  }
}
function fromGnome() {
  const value = run("gsettings", ["get", "org.gnome.desktop.interface", "color-scheme"]).trim();
  if (/dark/.test(value)) return true;
  return /light/.test(value) ? false : null;
}
function desktopIsDark() {
  if (process.platform !== "linux") return null;
  for (const ask of [fromPortal, fromKde, fromGnome]) {
    const dark = ask();
    if (dark !== null) return dark;
  }
  return null;
}
function themeFor(scheme) {
  if (scheme !== "system") return scheme;
  const dark = desktopIsDark();
  return dark === null ? "system" : dark ? "dark" : "light";
}
function follow(scheme, onChange = () => {
}) {
  const apply = () => {
    const wanted = themeFor(scheme());
    if (nativeTheme.themeSource === wanted) return;
    nativeTheme.themeSource = wanted;
    onChange();
  };
  apply();
  if (process.platform !== "linux") return apply;
  for (const file of [KDE_GLOBALS(), DCONF()]) fs.watchFile(file, { interval: 3e3, persistent: false }, () => scheme() === "system" && apply());
  return apply;
}
module.exports = { desktopIsDark, themeFor, follow };

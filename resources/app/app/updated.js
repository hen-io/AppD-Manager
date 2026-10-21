"use strict";
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "package.json");
const RUNTIME = path.join(__dirname, "..", "..", "..", "version");
const LOOK_MS = 3e4;
const SETTLE_MS = 2e4;
module.exports = function watchForUpdate(onUpdate) {
  const root = path.dirname(path.dirname(FILE));
  if (path.basename(path.dirname(FILE)) !== "app" || path.basename(root) !== "resources") return;
  const running = require(FILE).version;
  let settle = null;
  const look = () => {
    let version = "";
    let runtime = "";
    try {
      version = JSON.parse(fs.readFileSync(FILE, "utf8")).version;
      runtime = fs.readFileSync(RUNTIME, "utf8").trim().replace(/^v/, "");
    } catch {
    }
    if (!version || !runtime || version === running && runtime === process.versions.electron) return;
    if (!fs.existsSync(path.join(__dirname, "..", "main.js"))) return;
    fs.unwatchFile(FILE, changed);
    fs.unwatchFile(RUNTIME, changed);
    onUpdate(version === running ? `${version} (Electron ${runtime})` : version);
  };
  function changed() {
    clearTimeout(settle);
    settle = setTimeout(look, SETTLE_MS);
    settle.unref?.();
  }
  fs.watchFile(FILE, { interval: LOOK_MS, persistent: false }, changed);
  fs.watchFile(RUNTIME, { interval: LOOK_MS, persistent: false }, changed);
};

"use strict";
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "package.json");
const LOOK_MS = 3e4;
const SETTLE_MS = 2e4;
module.exports = function watchForUpdate(onUpdate) {
  const running = require(FILE).version;
  let settle = null;
  const look = () => {
    fs.readFile(FILE, "utf8", (error, text) => {
      let version = "";
      try {
        version = error ? "" : JSON.parse(text).version;
      } catch {
      }
      if (!version || version === running) return;
      if (!fs.existsSync(path.join(__dirname, "..", "main.js"))) return;
      fs.unwatchFile(FILE, changed);
      onUpdate(version);
    });
  };
  function changed() {
    clearTimeout(settle);
    settle = setTimeout(look, SETTLE_MS);
    settle.unref?.();
  }
  fs.watchFile(FILE, { interval: LOOK_MS, persistent: false }, changed);
};

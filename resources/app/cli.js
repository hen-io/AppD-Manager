"use strict";
const fs = require("fs");
const { text, fill } = require("./shared/text");
const path = require("path");
const lib = require("./lib");
const USAGE = fill(text.cli.usage.join("\n"), { keys: Object.keys(lib.DEFAULTS).join(", "), folder: lib.appsDir(), settings: lib.settingsPath });
function applySettings(cfg, pairs) {
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    const key = pair.slice(0, eq);
    let value = pair.slice(eq + 1);
    if (eq < 1 || !(key in lib.DEFAULTS)) throw new Error(fill(text.cli.unknownSetting, { pair }));
    if (typeof lib.DEFAULTS[key] !== "string") {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(fill(text.cli.needsJson, { key, value }));
      }
    } else if (key === "icon" && fs.existsSync(value)) {
      value = path.resolve(value);
    }
    cfg[key] = value;
  }
  return cfg;
}
function sync() {
  for (const problem of lib.sync()) console.error(`appd: ${problem}`);
}
function main([command, id, ...rest]) {
  switch (command) {
    case "add": {
      const [url, ...pairs] = rest;
      lib.checkId(id);
      if (!url) throw new Error("missing url");
      if (fs.existsSync(lib.appDir(id))) throw new Error(`app "${id}" already exists`);
      lib.save(id, applySettings({ ...lib.fresh(), name: id, url }, pairs));
      sync();
      console.log(fill(text.cli.created, { file: lib.configPath(id) }));
      break;
    }
    case "set":
      if (!rest.length) throw new Error("nothing to set");
      lib.save(id, applySettings(lib.load(id), rest));
      sync();
      break;
    case "list":
      for (const appId of lib.list()) {
        try {
          const cfg = lib.load(appId);
          console.log(`${appId}	${cfg.name}	${cfg.url}`);
        } catch (e) {
          console.log(`${appId}	${fill(text.cli.broken, { why: e.message })}`);
        }
      }
      break;
    case "sync":
      sync();
      break;
    case "rm":
      lib.load(id);
      lib.remove(id);
      sync();
      break;
    case "version":
    case "--version":
      console.log(require("./package.json").version);
      break;
    default:
      console.log(USAGE);
      if (command && command !== "help" && command !== "--help") process.exitCode = 2;
  }
}
try {
  main(process.argv.slice(2));
} catch (e) {
  console.error(`appd: ${e.message}`);
  process.exitCode = 1;
}

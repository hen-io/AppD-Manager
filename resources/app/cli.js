"use strict";
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const USAGE = `Usage:
  appd [manager]                        open AppD-Manager (the GUI)
  appd add <id> <url> [key=value ...]   create an app (and its menu entry)
  appd set <id> key=value ...           change settings of an app
  appd list                             show all apps
  appd run <id>                         start an app
  appd sync                             rebuild menu entries after editing files by hand
  appd rm <id>                          remove an app, its folder and its data
  appd version                          show the AppD-Manager version

Keys: ${Object.keys(lib.DEFAULTS).join(", ")}
Apps folder: ${lib.appsDir()}   (one folder per app, settings in <id>/config.json)
Change it in the manager, or set "appsDir" in ${lib.settingsPath}

Example:
  appd add mail https://mail.proton.me name="Proton Mail" icon=~/icons/proton.png`;
function applySettings(cfg, pairs) {
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    const key = pair.slice(0, eq);
    let value = pair.slice(eq + 1);
    if (eq < 1 || !(key in lib.DEFAULTS)) throw new Error(`unknown setting "${pair}"`);
    if (typeof lib.DEFAULTS[key] !== "string") {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(`"${key}" needs a JSON value, got "${value}"`);
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
      console.log(`Created ${lib.configPath(id)}`);
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
          console.log(`${appId}	(broken: ${e.message})`);
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

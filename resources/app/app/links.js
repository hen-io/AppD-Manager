"use strict";
const { shell } = require("electron");
const { spawn } = require("child_process");
function launch(command, args, failed = () => {
}) {
  const env = { ...process.env };
  for (const name of ["APPD_ID", "CHROME_DESKTOP", "ELECTRON_RUN_AS_NODE"]) delete env[name];
  if ("APPD_SYSTEM_LANGUAGE" in env) {
    if (env.APPD_SYSTEM_LANGUAGE) env.LANGUAGE = env.APPD_SYSTEM_LANGUAGE;
    else delete env.LANGUAGE;
    delete env.APPD_SYSTEM_LANGUAGE;
  }
  spawn(command, args, { detached: true, stdio: "ignore", env }).on("error", failed).unref();
}
const bareHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
module.exports = function createLinks({ id, cfg, lib, note }) {
  function openExternal(url) {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
  }
  let others = { at: 0, list: [] };
  function appFor(url) {
    if (Date.now() - others.at > 6e4) {
      const list = [];
      for (const other of lib.list()) {
        if (other === id) continue;
        try {
          const settings = lib.load(other);
          list.push({ id: other, host: bareHost(settings.url), flags: lib.startFlags(settings) });
        } catch {
        }
      }
      others = { at: Date.now(), list };
    }
    const host = bareHost(url);
    return host ? others.list.find((other) => other.host === host) : void 0;
  }
  function openElsewhere(url) {
    const other = cfg.linksToApps && /^https?:/i.test(url) ? appFor(url) : void 0;
    if (!other) return openExternal(url);
    const [command, args] = lib.runCommand(other.id, [...other.flags, `--appd-url=${url}`]);
    launch(command, args, () => openExternal(url));
    note(`a link to ${bareHost(url)} went to the app "${other.id}"`);
    return void 0;
  }
  return { openExternal, openElsewhere };
};
module.exports.launch = launch;

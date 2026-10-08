"use strict";
const SENSITIVE = /* @__PURE__ */ new Set([
  "media",
  "display-capture",
  "geolocation",
  "notifications",
  "midi",
  "midiSysex",
  "clipboard-read",
  "hid",
  "serial",
  "usb",
  "idle-detection",
  "sensors",
  "speaker-selection",
  "window-management",
  "storage-access",
  "top-level-storage-access",
  "openExternal"
]);
module.exports = function setUpPermissions(ses, { mode, isInternal, note }) {
  const allowed = (permission, url) => !SENSITIVE.has(permission) || mode === "all" || mode === "app" && isInternal(url);
  const said = /* @__PURE__ */ new Set();
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url = details.requestingUrl || (wc && !wc.isDestroyed() ? wc.getURL() : "");
    const ok = allowed(permission, url);
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
    }
    if (!ok && !said.has(`${permission} ${host}`)) {
      said.add(`${permission} ${host}`);
      note(`refused "${permission}" to ${host || "a page"} (the app's permissions setting)`);
    }
    callback(ok);
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed(permission, origin));
};

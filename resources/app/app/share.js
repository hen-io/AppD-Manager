"use strict";
const { BrowserWindow, Menu, desktopCapturer } = require("electron");
module.exports = function shareScreens(ses, { allowed, note }) {
  ses.setDisplayMediaRequestHandler(async (request, answer) => {
    const refuse = () => {
      try {
        answer({});
      } catch {
        try {
          answer();
        } catch {
        }
      }
    };
    if (!allowed(request)) return refuse();
    let sources = [];
    try {
      sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 } });
    } catch (e) {
      note(`screen sharing: no screens or windows to offer (${e.message})`);
    }
    if (!sources.length) return refuse();
    if (sources.length === 1) return answer({ video: sources[0] });
    let picked = false;
    const pick = (source) => () => {
      picked = true;
      answer({ video: source });
    };
    const screens = sources.filter((source) => source.id.startsWith("screen:"));
    const windows = sources.filter((source) => !source.id.startsWith("screen:"));
    const short = (name) => name.length > 60 ? `${name.slice(0, 57)}…` : name;
    Menu.buildFromTemplate([
      { label: "Share with this page:", enabled: false },
      ...screens.map((source, index) => ({ label: screens.length > 1 ? `Screen ${index + 1}` : "The whole screen", click: pick(source) })),
      ...windows.length ? [{ type: "separator" }, ...windows.slice(0, 30).map((source) => ({ label: short(source.name) || "A window", click: pick(source) }))] : [],
      { type: "separator" },
      { label: "Nothing", click: () => {
      } }
    ]).popup({
      window: BrowserWindow.getFocusedWindow() ?? void 0,
      callback: () => picked || refuse()
    });
    return void 0;
  });
};

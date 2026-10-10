"use strict";
const { Notification, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { text } = require("../shared/text");
function freeName(folder, name) {
  const { name: stem, ext } = path.parse(name || "download");
  for (let count = 1; count < 1e3; count++) {
    const file = path.join(folder, count === 1 ? `${stem}${ext}` : `${stem} (${count})${ext}`);
    if (!fs.existsSync(file)) return file;
  }
  return path.join(folder, `${stem} ${Date.now()}${ext}`);
}
module.exports = function showDownloads(ses, window, { name, note, folder = "" }) {
  const running = /* @__PURE__ */ new Map();
  const showProgress = () => {
    if (window.isDestroyed()) return;
    if (!running.size) return window.setProgressBar(-1);
    const known = [...running.values()].filter((share) => share >= 0);
    window.setProgressBar(known.length ? known.reduce((sum, share) => sum + share, 0) / known.length : 2);
    return void 0;
  };
  ses.on("will-download", (_event, item) => {
    if (folder) {
      try {
        fs.mkdirSync(folder, { recursive: true });
        item.setSavePath(freeName(folder, path.basename(item.getFilename())));
      } catch (e) {
        note(`downloads: ${folder} cannot be used (${e.message}); asking where to save`);
      }
    }
    running.set(item, -1);
    item.on("updated", () => {
      const total = item.getTotalBytes();
      running.set(item, total > 0 ? item.getReceivedBytes() / total : -1);
      showProgress();
    });
    item.once("done", (_done, state) => {
      running.delete(item);
      showProgress();
      const file = item.getSavePath();
      if (state === "cancelled" || !file) return;
      const worked = state === "completed";
      note(`download ${worked ? "finished" : "failed"}: ${path.basename(file)}`);
      if (!Notification.isSupported()) return;
      const notice = new Notification({
        title: worked ? text.app.download.finished : text.app.download.failed,
        body: `${path.basename(file)}
${name}`,
        silent: true
      });
      if (worked) notice.on("click", () => shell.showItemInFolder(file));
      notice.show();
    });
  });
};

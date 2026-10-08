"use strict";
const { Notification, shell } = require("electron");
const path = require("path");
module.exports = function showDownloads(ses, window, { name, note }) {
  const running = /* @__PURE__ */ new Map();
  const showProgress = () => {
    if (window.isDestroyed()) return;
    if (!running.size) return window.setProgressBar(-1);
    const known = [...running.values()].filter((share) => share >= 0);
    window.setProgressBar(known.length ? known.reduce((sum, share) => sum + share, 0) / known.length : 2);
    return void 0;
  };
  ses.on("will-download", (_event, item) => {
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
        title: worked ? "Download finished" : "Download failed",
        body: `${path.basename(file)}
${name}`,
        silent: true
      });
      if (worked) notice.on("click", () => shell.showItemInFolder(file));
      notice.show();
    });
  });
};

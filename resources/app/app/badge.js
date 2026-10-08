"use strict";
module.exports = function showUnreadCount(window, app) {
  let shown = 0;
  window.on("page-title-updated", (_event, title) => {
    const found = /[([](\d{1,5})\+?[)\]]/.exec(title);
    const count = found ? Number(found[1]) : 0;
    if (count === shown) return;
    shown = count;
    try {
      app.setBadgeCount(count);
    } catch {
    }
  });
};

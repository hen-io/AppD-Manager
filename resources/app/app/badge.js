"use strict";
const UNREAD = /[([](\d{1,5})\+?[)\]]/;
const unreadIn = (title) => Number(UNREAD.exec(title)?.[1] || 0);
function showUnreadCount(window, app) {
  let shown = 0;
  window.on("page-title-updated", (_event, title) => {
    const count = unreadIn(title);
    if (count === shown) return;
    shown = count;
    try {
      app.setBadgeCount(count);
    } catch {
    }
  });
}
module.exports = { showUnreadCount, unreadIn };

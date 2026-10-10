"use strict";
const { text } = require("./shared/text");
const TV_AGENT = "Mozilla/5.0 (SMART-TV; Linux; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 TV Safari/537.36";
const TEMPLATES = [
  { name: "YouTube", url: "https://www.youtube.com", extensions: ["adblock", "sponsorblock"] },
  { name: "YouTube TV", url: "https://www.youtube.com/tv", extensions: ["adblock"], userAgent: TV_AGENT },
  { name: "YouTube Music", url: "https://music.youtube.com", extensions: ["adblock"] },
  { name: "Twitch", url: "https://www.twitch.tv", extensions: ["adblock", "twitch"] },
  { name: "Spotify", url: "https://open.spotify.com" },
  { name: "WhatsApp", url: "https://web.whatsapp.com", closeToTray: true },
  { name: "Telegram", url: "https://web.telegram.org", closeToTray: true },
  { name: "Discord", url: "https://discord.com/app", closeToTray: true },
  { name: "Google Translate", url: "https://translate.google.com", type: "tray", trayWidth: 460, trayHeight: 640, windowRadius: 12 },
  { name: "Google Keep", url: "https://keep.google.com", type: "tray", trayWidth: 420, trayHeight: 680, windowRadius: 12, internalHosts: ["accounts.google.com"] },
  { name: "Gmail", url: "https://mail.google.com", internalHosts: ["accounts.google.com"] },
  { name: "Google Calendar", url: "https://calendar.google.com", internalHosts: ["accounts.google.com"] },
  { name: "Outlook", url: "https://outlook.office.com", internalHosts: ["login.microsoftonline.com", "login.live.com"] },
  { name: "Proton Mail", url: "https://mail.proton.me", internalHosts: ["account.proton.me"] },
  { name: "Home Assistant", url: "http://homeassistant.local:8123", skipMissedUpdates: true },
  { name: "Home Assistant wall panel", url: "http://homeassistant.local:8123", startFullScreen: true, keepAwake: "display", skipMissedUpdates: true },
  { name: "GitHub", url: "https://github.com" }
];
module.exports = TEMPLATES.map(({ name, ...settings }) => ({ name, about: text.templates[name] || "", ...settings }));

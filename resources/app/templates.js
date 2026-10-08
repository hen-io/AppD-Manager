"use strict";
const TV_AGENT = "Mozilla/5.0 (SMART-TV; Linux; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 TV Safari/537.36";
module.exports = [
  { name: "YouTube", about: "With the ad blocker and SponsorBlock", url: "https://www.youtube.com", extensions: ["adblock", "sponsorblock"] },
  { name: "YouTube TV", about: "The interface for televisions: arrow keys and a controller work", url: "https://www.youtube.com/tv", extensions: ["adblock"], userAgent: TV_AGENT },
  { name: "YouTube Music", about: "With the ad blocker", url: "https://music.youtube.com", extensions: ["adblock"] },
  { name: "Twitch", about: "With both ad blockers", url: "https://www.twitch.tv", extensions: ["adblock", "twitch"] },
  { name: "Spotify", about: "The web player", url: "https://open.spotify.com" },
  { name: "WhatsApp", about: "Stays in the tray, with the unread count on its icon", url: "https://web.whatsapp.com", closeToTray: true },
  { name: "Telegram", about: "Stays in the tray", url: "https://web.telegram.org", closeToTray: true },
  { name: "Discord", about: "Stays in the tray", url: "https://discord.com/app", closeToTray: true },
  { name: "Gmail", about: "Google sign-in windows stay in the app", url: "https://mail.google.com", internalHosts: ["accounts.google.com"] },
  { name: "Google Calendar", about: "Google sign-in windows stay in the app", url: "https://calendar.google.com", internalHosts: ["accounts.google.com"] },
  { name: "Outlook", about: "Mail and calendar", url: "https://outlook.office.com", internalHosts: ["login.microsoftonline.com", "login.live.com"] },
  { name: "Proton Mail", about: "Mail", url: "https://mail.proton.me", internalHosts: ["account.proton.me"] },
  { name: "Home Assistant", about: "Put in the address of your own; shows the current state when you come back to it", url: "http://homeassistant.local:8123", skipMissedUpdates: true },
  { name: "GitHub", about: "Code and issues", url: "https://github.com" }
];

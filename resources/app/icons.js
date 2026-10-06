"use strict";
const { app, BrowserWindow, net } = require("electron");
const fs = require("fs");
const path = require("path");
const TIMEOUT_MS = 1e4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CANDIDATES = 8;
const MAX_PIXELS = 512;
const tempDirs = [];
app.on("will-quit", () => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});
async function get(url) {
  const res = await net.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}
function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
  }
  return out;
}
function declaredSize(sizes, fallback) {
  const all = [...String(sizes || "").matchAll(/(\d+)x\d+/gi)].map((m) => Number(m[1]));
  return all.length ? Math.max(...all) : fallback;
}
async function candidates(pageUrl) {
  const found = /* @__PURE__ */ new Map();
  const add = (href, base2, size) => {
    try {
      const url = new URL(href, base2);
      if (/^https?:$/.test(url.protocol)) found.set(url.href, Math.max(size, found.get(url.href) || 0));
    } catch {
    }
  };
  let base = pageUrl;
  try {
    const res = await get(pageUrl);
    base = res.url || pageUrl;
    const html = (await res.text()).slice(0, 2e6);
    let manifest = null;
    for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
      const attr = attributes(tag);
      const rel = (attr.rel || "").toLowerCase().split(/\s+/);
      if (!attr.href) continue;
      const apple = rel.some((token) => token.startsWith("apple-touch-icon"));
      if (rel.includes("manifest")) {
        manifest = attr.href;
      } else if (rel.includes("icon") || apple) {
        const svg = /svg/i.test(attr.type || "") || /\.svg([?#]|$)/i.test(attr.href);
        add(attr.href, base, svg ? 4096 : declaredSize(attr.sizes, apple ? 180 : 32));
      }
    }
    if (manifest) {
      const manifestUrl = new URL(manifest, base).href;
      const data = await (await get(manifestUrl)).json();
      for (const icon of Array.isArray(data.icons) ? data.icons : []) {
        if (icon && icon.src) add(icon.src, manifestUrl, declaredSize(icon.sizes, 64));
      }
    }
  } catch {
  }
  const origin = new URL(base).origin;
  add("/apple-touch-icon.png", origin, 120);
  add("/favicon.ico", origin, 16);
  return [...found].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES).map(([url]) => url);
}
async function download(url) {
  try {
    const res = await get(url);
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const data = Buffer.from(await res.arrayBuffer());
    if (!data.length || data.length > MAX_BYTES || type === "text/html") return null;
    return { type, data };
  } catch {
    return null;
  }
}
const decodeScript = (dataUrl) => `(async () => {
  const image = new Image();
  image.src = ${JSON.stringify(dataUrl)};
  await image.decode();
  const scale = Math.min(1, ${MAX_PIXELS} / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png') };
})()`;
async function fetchIcons(pageUrl) {
  if (!/^https?:\/\//i.test(pageUrl) || !URL.canParse(pageUrl)) throw new Error("Enter the URL of the app first.");
  const urls = await candidates(pageUrl);
  const files = await Promise.all(urls.map(download));
  const dir = fs.mkdtempSync(path.join(app.getPath("temp"), "appd-icons-"));
  tempDirs.push(dir);
  const decoder = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  const icons = [];
  const seen = /* @__PURE__ */ new Set();
  try {
    await decoder.loadURL("about:blank");
    for (const [index, file] of files.entries()) {
      if (!file) continue;
      const svg = file.type === "image/svg+xml" || /<svg\b/i.test(file.data.subarray(0, 2e3).toString("utf8"));
      const mime = svg ? "image/svg+xml" : file.type.startsWith("image/") ? file.type : "image/x-icon";
      const dataUrl = `data:${mime};base64,${file.data.toString("base64")}`;
      let icon;
      if (svg) {
        icon = { path: path.join(dir, `icon-${index}.svg`), url: dataUrl, label: "SVG", rank: 4096 };
        fs.writeFileSync(icon.path, file.data);
      } else {
        const result = await decoder.webContents.executeJavaScript(decodeScript(dataUrl)).catch(() => null);
        if (!result || result.width < 16) continue;
        icon = {
          path: path.join(dir, `icon-${index}.png`),
          url: result.png,
          label: `${result.width}×${result.height}`,
          rank: result.width
        };
        fs.writeFileSync(icon.path, Buffer.from(result.png.split(",")[1], "base64"));
      }
      if (seen.has(icon.url)) continue;
      seen.add(icon.url);
      icons.push(icon);
    }
  } finally {
    decoder.destroy();
  }
  return icons.sort((a, b) => b.rank - a.rank).map(({ path: file, url, label }) => ({ path: file, url, label }));
}
module.exports = { fetchIcons };

"use strict";
const { WebContentsView, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const TYPES = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".gif": "image/gif" };
async function drawIcon(file, size) {
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return null;
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    const url = `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
    await view.webContents.loadURL(`data:text/html,${encodeURIComponent(`<canvas id="canvas" width="${size}" height="${size}"></canvas>`)}`);
    const drawn = await Promise.race([
      view.webContents.executeJavaScript(`new Promise((done) => {
        const image = new Image();
        image.onload = () => {
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, ${size}, ${size});
          done({ rgba: Array.from(context.getImageData(0, 0, ${size}, ${size}).data), png: canvas.toDataURL('image/png') });
        };
        image.onerror = () => done(null);
        image.src = ${JSON.stringify(url)};
      })`),
      new Promise((resolve) => setTimeout(() => resolve(null), 3e3))
    ]);
    return drawn && { rgba: drawn.rgba, png: Buffer.from(drawn.png.split(",")[1], "base64") };
  } catch {
    return null;
  } finally {
    view.webContents.close();
  }
}
async function windowIcon(iconFile, folder) {
  if (!iconFile) return void 0;
  try {
    if (!nativeImage.createFromPath(iconFile).isEmpty()) return iconFile;
    const kept = path.join(folder, "icon-256.png");
    const source = fs.statSync(iconFile);
    const have = fs.statSync(kept, { throwIfNoEntry: false });
    if (have && have.mtimeMs >= source.mtimeMs) return kept;
    const drawn = await drawIcon(iconFile, 256);
    if (!drawn) return void 0;
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(kept, drawn.png);
    return kept;
  } catch {
    return void 0;
  }
}
module.exports = { drawIcon, windowIcon };

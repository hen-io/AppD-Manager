"use strict";
const { WebContentsView, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { lookOfPixels } = require("../manager/ui/colour");
const SIDE = 32;
const TYPES = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".gif": "image/gif" };
function pointsOfBitmap(file) {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return null;
  const small = image.resize({ width: SIDE, height: SIDE, quality: "good" });
  const data = small.toBitmap({ scaleFactor: 1 });
  const points = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const solid = data[i + 3];
    const full = solid ? 255 / solid : 0;
    points[i] = data[i + 2] * full;
    points[i + 1] = data[i + 1] * full;
    points[i + 2] = data[i] * full;
    points[i + 3] = solid;
  }
  return points;
}
async function pointsOfDrawing(file) {
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return null;
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    const url = `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
    await view.webContents.loadURL(`data:text/html,${encodeURIComponent(`<canvas id="canvas" width="${SIDE}" height="${SIDE}"></canvas>`)}`);
    const points = await Promise.race([
      view.webContents.executeJavaScript(`new Promise((done) => {
        const image = new Image();
        image.onload = () => {
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, ${SIDE}, ${SIDE});
          done(Array.from(context.getImageData(0, 0, ${SIDE}, ${SIDE}).data));
        };
        image.onerror = () => done(null);
        image.src = ${JSON.stringify(url)};
      })`),
      new Promise((resolve) => setTimeout(() => resolve(null), 3e3))
    ]);
    return points;
  } catch {
    return null;
  } finally {
    view.webContents.close();
  }
}
module.exports = async function iconColour(iconFile, keptIn) {
  if (!iconFile) return null;
  let stamp = "";
  try {
    const { mtimeMs, size } = fs.statSync(iconFile);
    stamp = `${path.basename(iconFile)}:${mtimeMs}:${size}`;
    const kept = JSON.parse(fs.readFileSync(keptIn, "utf8"));
    if (kept.stamp === stamp) return kept.colour;
  } catch {
  }
  if (!stamp) return null;
  let points = null;
  try {
    points = pointsOfBitmap(iconFile) ?? await pointsOfDrawing(iconFile);
  } catch {
  }
  const colour = points ? lookOfPixels(points).hex : null;
  try {
    fs.writeFileSync(keptIn, JSON.stringify({ stamp, colour }));
  } catch {
  }
  return colour;
};

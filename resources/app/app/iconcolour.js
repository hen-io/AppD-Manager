"use strict";
const { nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { lookOfPixels } = require("../manager/ui/colour");
const { drawIcon } = require("./icondraw");
const SIDE = 32;
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
    points = pointsOfBitmap(iconFile) ?? (await drawIcon(iconFile, SIDE))?.rgba ?? null;
  } catch {
  }
  const colour = points ? lookOfPixels(points).hex : null;
  try {
    fs.writeFileSync(keptIn, JSON.stringify({ stamp, colour }));
  } catch {
  }
  return colour;
};

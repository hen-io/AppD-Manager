"use strict";
const COLOUR_BINS = 24;
function themeHue(hsl) {
  const from = [0, 60, 120, 180, 240, 300, 360];
  const to = [29, 100, 142, 195, 264, 328, 389];
  const at = Math.min(5, Math.floor(hsl / 60));
  return (to[at] + (hsl - from[at]) / 60 * (to[at + 1] - to[at])) % 360;
}
function lookOfPixels(data) {
  const bins = Array.from({ length: COLOUR_BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  const grey = { weight: 0, r: 0, g: 0, b: 0 };
  const add = (to, weight, r, g, b) => {
    to.weight += weight;
    to.r += r * weight;
    to.g += g * weight;
    to.b += b * weight;
  };
  for (let i = 0; i < data.length; i += 4) {
    const solid = data[i + 3] / 255;
    if (solid < 0.4) continue;
    const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const spread = max - min;
    if (spread < 0.16 || max < 0.22 || spread / max < 0.2) {
      add(grey, solid, r, g, b);
      continue;
    }
    let hue = max === r ? (g - b) / spread % 6 : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4;
    hue = (hue * 60 + 360) % 360;
    add(bins[Math.floor(hue / (360 / COLOUR_BINS)) % COLOUR_BINS], solid, r, g, b);
  }
  const look = (of, hue, plain) => {
    const parts = [of.r, of.g, of.b].map((part) => Math.round(part / of.weight * 255));
    return { hue, plain, colour: `rgb(${parts.join(" ")})`, hex: `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}` };
  };
  const total = bins.reduce((sum, bin) => sum + bin.weight, 0);
  if (total < data.length / 4 * 0.02) {
    return grey.weight ? look(grey, null, true) : { hue: null, plain: true, colour: null, hex: null };
  }
  const beside = (at, step) => bins[(at + step + COLOUR_BINS) % COLOUR_BINS];
  let most = 0;
  let mostOf = -1;
  bins.forEach((bin, at) => {
    const amount = bin.weight + (beside(at, -1).weight + beside(at, 1).weight) / 2;
    if (amount > mostOf) [most, mostOf] = [at, amount];
  });
  const mixed = { weight: 0, r: 0, g: 0, b: 0 };
  let x = 0;
  let y = 0;
  for (const step of [-1, 0, 1]) {
    const bin = beside(most, step);
    for (const part of ["weight", "r", "g", "b"]) mixed[part] += bin[part];
    const angle = ((most + step + COLOUR_BINS) % COLOUR_BINS + 0.5) * 2 * Math.PI / COLOUR_BINS;
    x += Math.cos(angle) * bin.weight;
    y += Math.sin(angle) * bin.weight;
  }
  return look(mixed, themeHue((Math.atan2(y, x) * 180 / Math.PI + 360) % 360), false);
}
if (typeof module === "object") module.exports = { lookOfPixels };

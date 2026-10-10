"use strict";
const PALETTES = {
  ocean: { hue: 255, hue2: 300, hue3: 200, vivid: 1.6 },
  indigo: { hue: 262 },
  violet: { hue: 295 },
  teal: { hue: 195 },
  forest: { hue: 150 },
  amber: { hue: 75 },
  coral: { hue: 35 },
  rose: { hue: 355 },
  custom: { hue: 250, hue3: 200, vivid: 1.5 }
};
function hueOfColour(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const c = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.round((Math.atan2(c, a) * 180 / Math.PI + 360) % 360);
}
function paletteVars(name, custom) {
  const palette = name === "custom" && custom ? { hue: hueOfColour(custom.primary), hue3: hueOfColour(custom.accent), hue2: hueOfColour(custom.secondary || custom.primary), hueS: hueOfColour(custom.surface || custom.primary), vivid: custom.vivid / 100 } : PALETTES[name] || PALETTES.ocean;
  const { hue, hue3 = hue + 70, hue2 = hue, hueS = hue, vivid = 1 } = palette;
  return { "--hue": String(hue), "--hue-2": String(hue2), "--hue-3": String(hue3), "--hue-s": String(hueS), "--vivid": String(vivid) };
}
module.exports = { PALETTES, hueOfColour, paletteVars };

"use strict";
const fs = require("fs");
function bitmapOf(size, rgba) {
  const maskRow = Math.ceil(size / 32) * 4;
  const out = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  out.writeUInt32LE(40, 0);
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8);
  out.writeUInt16LE(1, 12);
  out.writeUInt16LE(32, 14);
  out.writeUInt32LE(size * size * 4, 20);
  for (let y = 0; y < size; y++) {
    const row = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = 40 + (row * size + x) * 4;
      out[to] = rgba[from + 2];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from];
      out[to + 3] = rgba[from + 3];
      if (rgba[from + 3] === 0) out[40 + size * size * 4 + row * maskRow + (x >> 3)] |= 128 >> (x & 7);
    }
  }
  return out;
}
function icoFrom(pictures) {
  const parts = pictures.map((picture) => ({ size: picture.size, data: picture.png ?? bitmapOf(picture.size, picture.rgba) }));
  const head = Buffer.alloc(6 + parts.length * 16);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(parts.length, 4);
  let at = head.length;
  parts.forEach((part, index) => {
    const entry = 6 + index * 16;
    head[entry] = part.size >= 256 ? 0 : part.size;
    head[entry + 1] = part.size >= 256 ? 0 : part.size;
    head.writeUInt16LE(1, entry + 4);
    head.writeUInt16LE(32, entry + 6);
    head.writeUInt32LE(part.data.length, entry + 8);
    head.writeUInt32LE(at, entry + 12);
    at += part.data.length;
  });
  return Buffer.concat([head, ...parts.map((part) => part.data)]);
}
function picturesOf(ico) {
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const length = ico.readUInt32LE(entry + 8);
    const at = ico.readUInt32LE(entry + 12);
    return { size: ico[entry] || 256, data: ico.subarray(at, at + length) };
  });
}
function setExeIcon(exeFile, icoFile) {
  const exe = fs.readFileSync(exeFile);
  const pictures = picturesOf(fs.readFileSync(icoFile));
  const pe = exe.readUInt32LE(60);
  if (exe.toString("latin1", pe, pe + 4) !== "PE\0\0") throw new Error("not a Windows program");
  const sections = exe.readUInt16LE(pe + 6);
  const optional = pe + 24;
  const tables = optional + (exe.readUInt16LE(optional) === 523 ? 112 : 96);
  const resources = exe.readUInt32LE(tables + 2 * 8);
  let delta = null;
  for (let index = 0; index < sections; index++) {
    const section = optional + exe.readUInt16LE(pe + 20) + index * 40;
    const address = exe.readUInt32LE(section + 12);
    if (resources >= address && resources < address + exe.readUInt32LE(section + 8)) delta = exe.readUInt32LE(section + 20) - address;
  }
  if (!resources || delta === null) throw new Error("the program has no resources");
  const base = resources + delta;
  const leaves = [];
  const walk = (at, path) => {
    const entries = exe.readUInt16LE(at + 12) + exe.readUInt16LE(at + 14);
    for (let index = 0; index < entries; index++) {
      const entry = at + 16 + index * 8;
      const to = exe.readUInt32LE(entry + 4);
      const here = [...path, exe.readUInt32LE(entry)];
      if (to & 2147483648) walk(base + (to & 2147483647), here);
      else leaves.push({ path: here, entry: base + to });
    }
  };
  walk(base, []);
  const ICON = 3;
  const GROUP = 14;
  const done = [];
  for (const group of leaves.filter((leaf) => leaf.path[0] === GROUP)) {
    const list = exe.readUInt32LE(group.entry) + delta;
    const count = exe.readUInt16LE(list + 4);
    for (let index = 0; index < count; index++) {
      const item = list + 6 + index * 14;
      const size = exe[item] || 256;
      const leaf = leaves.find((one) => one.path[0] === ICON && one.path[1] === exe.readUInt16LE(item + 12));
      const picture = pictures.find((one) => one.size === size);
      if (!leaf || !picture) {
        done.push(`${size}: kept`);
        continue;
      }
      const room = exe.readUInt32LE(leaf.entry + 4);
      if (picture.data.length > room) {
        done.push(`${size}: kept (${picture.data.length} bytes do not fit in ${room})`);
        continue;
      }
      const at = exe.readUInt32LE(leaf.entry) + delta;
      exe.fill(0, at, at + room);
      picture.data.copy(exe, at);
      exe.writeUInt32LE(picture.data.length, leaf.entry + 4);
      exe.writeUInt32LE(picture.data.length, item + 8);
      exe.writeUInt16LE(32, item + 6);
      done.push(`${size}: set`);
    }
  }
  if (!done.some((line) => line.endsWith("set"))) throw new Error(`no picture of the program's icon could be replaced (${done.join(", ") || "it has none"})`);
  fs.writeFileSync(exeFile, exe);
  return done.join(", ");
}
module.exports = { icoFrom, picturesOf, setExeIcon };

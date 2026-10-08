"use strict";
const { net } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1e3;
const storeUrl = (id) => `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${process.versions.chrome}&x=${encodeURIComponent(`id=${id}&uc`)}`;
function fields(message) {
  const found = [];
  let at = 0;
  const varint = () => {
    let value = 0;
    let shift = 0;
    for (; ; ) {
      const byte = message[at++];
      value += (byte & 127) * 2 ** shift;
      shift += 7;
      if (!(byte & 128)) return value;
      if (at >= message.length) throw new Error("cut off");
    }
  };
  while (at < message.length) {
    const tag = varint();
    const kind = tag & 7;
    if (kind === 0) found.push([Math.floor(tag / 8), varint()]);
    else if (kind === 2) {
      const length = varint();
      found.push([Math.floor(tag / 8), message.subarray(at, at + length)]);
      at += length;
    } else throw new Error("unexpected field");
  }
  return found;
}
const idOfKey = (key) => [...crypto.createHash("sha256").update(key).digest().subarray(0, 16)].map((byte) => String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15))).join("");
function archiveOf(crx, id) {
  if (crx.toString("latin1", 0, 4) !== "Cr24" || crx.readUInt32LE(4) !== 3) throw new Error("not a CRX3 file");
  const headerLength = crx.readUInt32LE(8);
  const header = crx.subarray(12, 12 + headerLength);
  const archive = crx.subarray(12 + headerLength);
  const parts = fields(header);
  const signed = (parts.find(([number]) => number === 1e4) || [])[1];
  if (!signed) throw new Error("no signed part");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(signed.length);
  for (const [number, proof] of parts) {
    if (number !== 2) continue;
    const proofFields = fields(proof);
    const key = (proofFields.find(([n]) => n === 1) || [])[1];
    const signature = (proofFields.find(([n]) => n === 2) || [])[1];
    if (!key || !signature || idOfKey(key) !== id) continue;
    const ok = crypto.createVerify("sha256").update("CRX3 SignedData\0").update(length).update(signed).update(archive).verify({ key, format: "der", type: "spki" }, signature);
    if (ok) return archive;
  }
  throw new Error(`it is not signed with the key of ${id}`);
}
function unzip(archive, folder) {
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== 101010256) end--;
  if (end < 0) throw new Error("not a zip");
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(at) !== 33639248) throw new Error("damaged zip");
    const method = archive.readUInt16LE(at + 10);
    const packed = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
    const target = path.join(folder, name);
    if (!target.startsWith(folder + path.sep)) throw new Error(`unsafe path in the zip: ${name}`);
    if (name.endsWith("/")) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + packed);
    if (method !== 0 && method !== 8) throw new Error(`unknown compression in the zip: ${name}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, method === 8 ? zlib.inflateRawSync(data) : data);
  }
}
async function fetchInto(id, folder) {
  const res = await net.fetch(storeUrl(id));
  if (!res.ok) throw new Error(`the Chrome Web Store answered ${res.status}`);
  const archive = archiveOf(Buffer.from(await res.arrayBuffer()), id);
  const fresh = `${folder}.new`;
  fs.rmSync(fresh, { recursive: true, force: true });
  fs.mkdirSync(fresh, { recursive: true });
  unzip(archive, fresh);
  if (!fs.existsSync(path.join(fresh, "manifest.json"))) throw new Error("no manifest.json in it");
  fs.rmSync(folder, { recursive: true, force: true });
  fs.renameSync(fresh, folder);
}
module.exports = async function storeExtension(id, root, note = () => {
}) {
  if (!/^[a-p]{32}$/.test(id)) throw new Error(`"${id}" is not an extension id`);
  const folder = path.join(root, "StoreExtensions", id);
  const manifest = path.join(folder, "manifest.json");
  let age = Infinity;
  try {
    age = Date.now() - fs.statSync(manifest).mtimeMs;
  } catch {
  }
  if (age === Infinity) await fetchInto(id, folder);
  else if (age >= REFRESH_AFTER_MS) {
    const later = `${folder}.next`;
    fetchInto(id, later).catch((e) => note(`could not refresh the extension ${id}: ${e.message}`));
  }
  return folder;
};
module.exports.adoptRefreshed = function adoptRefreshed(id, root) {
  const folder = path.join(root, "StoreExtensions", id);
  const later = `${folder}.next`;
  if (!fs.existsSync(path.join(later, "manifest.json"))) return;
  fs.rmSync(folder, { recursive: true, force: true });
  fs.renameSync(later, folder);
};
module.exports.archiveOf = archiveOf;

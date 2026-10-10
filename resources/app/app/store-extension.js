"use strict";
const { net } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { text, fill } = require("../shared/text");
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
      if (at >= message.length) throw new Error(text.errors.crxCutOff);
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
    } else throw new Error(text.errors.crxField);
  }
  return found;
}
const idOfKey = (key) => [...crypto.createHash("sha256").update(key).digest().subarray(0, 16)].map((byte) => String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15))).join("");
function opened(crx, id) {
  if (crx.toString("latin1", 0, 4) !== "Cr24" || crx.readUInt32LE(4) !== 3) throw new Error(text.errors.notCrx);
  const headerLength = crx.readUInt32LE(8);
  const header = crx.subarray(12, 12 + headerLength);
  const archive = crx.subarray(12 + headerLength);
  const parts = fields(header);
  const signed = (parts.find(([number]) => number === 1e4) || [])[1];
  if (!signed) throw new Error(text.errors.crxUnsigned);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(signed.length);
  for (const [number, proof] of parts) {
    if (number !== 2) continue;
    const proofFields = fields(proof);
    const key = (proofFields.find(([n]) => n === 1) || [])[1];
    const signature = (proofFields.find(([n]) => n === 2) || [])[1];
    if (!key || !signature || idOfKey(key) !== id) continue;
    const ok = crypto.createVerify("sha256").update("CRX3 SignedData\0").update(length).update(signed).update(archive).verify({ key, format: "der", type: "spki" }, signature);
    if (ok) return { archive, key };
  }
  throw new Error(fill(text.errors.crxWrongKey, { id }));
}
const archiveOf = (crx, id) => opened(crx, id).archive;
function unzip(archive, folder) {
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== 101010256) end--;
  if (end < 0) throw new Error(text.errors.notZip);
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(at) !== 33639248) throw new Error(text.errors.damagedZip);
    const method = archive.readUInt16LE(at + 10);
    const packed = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
    const target = path.join(folder, name);
    if (!target.startsWith(folder + path.sep)) throw new Error(fill(text.errors.zipPath, { name }));
    if (name.endsWith("/")) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    const data = archive.subarray(start, start + packed);
    if (method !== 0 && method !== 8) throw new Error(fill(text.errors.zipCompression, { name }));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, method === 8 ? zlib.inflateRawSync(data) : data);
  }
}
const COMPAT = "appd-compat.js";
const COMPAT_SCRIPT = `(() => {
  const storage = globalThis.chrome && globalThis.chrome.storage;
  if (!storage || !storage.local || storage.appdAtHome) return;
  const stand = (area) => {
    try {
      Object.defineProperty(storage, area, { value: storage.local, configurable: true, enumerable: true });
    } catch (e) {}
  };
  stand('sync');
  let session;
  try {
    session = storage.session;
  } catch (e) {}
  if (!session) stand('session');
  try {
    const listen = storage.onChanged.addListener.bind(storage.onChanged);
    storage.onChanged.addListener = (heard) => listen((changes, area) => {
      heard(changes, area);
      if (area === 'local') heard(changes, 'sync');
    });
    Object.defineProperty(storage, 'appdAtHome', { value: true });
  } catch (e) {}
})();
`;
const WORKER = "appd-worker.js";
function makeAtHome(folder, key = null) {
  const manifestFile = path.join(folder, "manifest.json");
  if (fs.existsSync(path.join(folder, COMPAT))) return;
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (key && !manifest.key) manifest.key = key.toString("base64");
  fs.writeFileSync(path.join(folder, COMPAT), COMPAT_SCRIPT);
  for (const entry of Array.isArray(manifest.content_scripts) ? manifest.content_scripts : []) {
    if (Array.isArray(entry.js) && entry.js.length && entry.world !== "MAIN") entry.js = [COMPAT, ...entry.js];
  }
  const background = manifest.background;
  if (background && typeof background.service_worker === "string") {
    const own = `./${background.service_worker.replace(/^[./]+/, "")}`;
    fs.writeFileSync(path.join(folder, WORKER), background.type === "module" ? `import './${COMPAT}';
import ${JSON.stringify(own)};
` : `importScripts(${JSON.stringify(COMPAT)}, ${JSON.stringify(own)});
`);
    background.service_worker = WORKER;
    delete background.scripts;
  } else if (background && Array.isArray(background.scripts)) {
    background.scripts = [COMPAT, ...background.scripts];
  }
  const pages = [];
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && depth < 4 && entry.name !== "_metadata") walk(path.join(dir, entry.name), depth + 1);
      else if (entry.isFile() && /\.html?$/i.test(entry.name) && pages.length < 60) pages.push(path.join(dir, entry.name));
    }
  };
  walk(folder, 0);
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    const tag = `<script src="/${COMPAT}"><\/script>`;
    const at = /<head[^>]*>/i.exec(html);
    fs.writeFileSync(page, at ? html.slice(0, at.index + at[0].length) + tag + html.slice(at.index + at[0].length) : tag + html);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}
async function fetchInto(id, folder, withKey) {
  let res;
  for (let tries = 1; ; tries++) {
    try {
      res = await net.fetch(storeUrl(id));
      break;
    } catch (e) {
      if (tries === 3) throw e;
      await new Promise((resolve) => setTimeout(resolve, 800 * tries));
    }
  }
  if (!res.ok) throw new Error(fill(text.errors.storeAnswered, { status: res.status }));
  const { archive, key } = opened(Buffer.from(await res.arrayBuffer()), id);
  const fresh = `${folder}.new`;
  fs.rmSync(fresh, { recursive: true, force: true });
  fs.mkdirSync(fresh, { recursive: true });
  unzip(archive, fresh);
  if (!fs.existsSync(path.join(fresh, "manifest.json"))) throw new Error(text.errors.noManifest);
  makeAtHome(fresh, withKey ? key : null);
  fs.rmSync(folder, { recursive: true, force: true });
  fs.renameSync(fresh, folder);
}
module.exports = async function storeExtension(id, root, note = () => {
}) {
  if (!/^[a-p]{32}$/.test(id)) throw new Error(fill(text.errors.notExtensionId, { id }));
  const folder = path.join(root, "StoreExtensions", id);
  const manifest = path.join(folder, "manifest.json");
  let age = Infinity;
  try {
    age = Date.now() - fs.statSync(manifest).mtimeMs;
  } catch {
  }
  if (age === Infinity) await fetchInto(id, folder, true);
  else makeAtHome(folder);
  if (age !== Infinity && age >= REFRESH_AFTER_MS) {
    let hasKey = false;
    try {
      hasKey = Boolean(JSON.parse(fs.readFileSync(manifest, "utf8")).key);
    } catch {
    }
    const later = `${folder}.next`;
    fetchInto(id, later, hasKey).catch((e) => note(`could not refresh the extension ${id}: ${e.message}`));
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

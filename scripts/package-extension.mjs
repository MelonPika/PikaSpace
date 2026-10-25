import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { validateExtension } from "./validate-extension.mjs";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const manifest = await validateExtension(dist);
const name = `PikaDesk-${manifest.version}`;
const release = path.join(root, "releases", name);
// Only this generated release directory can be replaced by recursive cleanup.
if (!release.startsWith(root + path.sep) || path.dirname(release) !== path.join(root, "releases")) {
  throw new Error("Release directory must stay inside this project.");
}
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(dist, path.join(release, "extension"), { recursive: true });
await cp(path.join(root, "docs", "INSTALL.md"), path.join(release, "INSTALL.md"));
await cp(path.join(root, "ATTRIBUTIONS.md"), path.join(release, "ATTRIBUTIONS.md"));
for (const filename of ["PRIVACY.md", "RELEASE-NOTES.md", "COMPANION.md"]) {
  await cp(path.join(root, "docs", filename), path.join(release, filename));
}

// A standard ZIP using Node's built-ins; recipients need no build tools.
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function entries(directory, prefix) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = path.join(directory, entry.name);
    const zipName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await entries(filename, zipName));
    else if (entry.isFile()) files.push({ name: zipName, data: await readFile(filename) });
    else throw new Error(`Unexpected link in release: ${filename}`);
  }
  return files;
}
async function createArchive(files, archive) {
const localParts = [];
const centralParts = [];
let offset = 0;
for (const file of files) {
  const filename = Buffer.from(file.name, "utf8");
  const compressed = deflateRawSync(file.data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(33, 12); // 1980-01-01, reproducible archive timestamps.
  local.writeUInt32LE(crc32(file.data), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(file.data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  local.copy(central, 6, 4, 30);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, filename);
  localParts.push(local, filename, compressed);
  offset += local.length + filename.length + compressed.length;
}
const central = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile(archive, Buffer.concat([...localParts, central, end]));
console.log(`Created ${archive}`);
}
await createArchive(await entries(release, name), path.join(root, "releases", `${name}.zip`));
// Chrome Web Store requires manifest.json at the ZIP root.
await createArchive(await entries(path.join(release, "extension"), ""), path.join(root, "releases", `${name}-chrome-web-store.zip`));
const archives = [`${name}.zip`, `${name}-chrome-web-store.zip`];
const checksums = await Promise.all(archives.map(async archive =>
  `${createHash("sha256").update(await readFile(path.join(root, "releases", archive))).digest("hex")}  ${archive}`));
await writeFile(path.join(root, "releases", `SHA256SUMS-${manifest.version}.txt`), checksums.join("\n") + "\n");
console.log(`Load unpacked folder: ${path.join(release, "extension")}`);

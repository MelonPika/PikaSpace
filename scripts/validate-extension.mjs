import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extensionIdFromKey } from "./extension-identity.mjs";

export async function validateExtension(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.match(extensionIdFromKey(manifest.key), /^[a-p]{32}$/);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, pkg.version, "Package and manifest versions must match");
  assert.equal(manifest.name, "PikaSpace");
  assert.equal(extensionIdFromKey(manifest.key), "abipfjhfejgjkhcpilkfdhbgaepljpki", "The portable release identity must remain stable");
  assert.ok(!manifest.oauth2, "Calendar OAuth must not ship in 1.0");
  assert.ok(!manifest.permissions.includes("identity"));
  assert.ok(!manifest.permissions.includes("tabs"), "Site grants already authorize media tab inspection");
  assert.ok(manifest.host_permissions.every((origin) => !/googleapis\.com|calendar/i.test(origin)));
  assert.equal(manifest.background.type, "module");
  assert.ok(manifest.permissions.includes("scripting"));
  for (const filename of [manifest.chrome_url_overrides.newtab, manifest.background.service_worker, "media.js"]) {
    assert.ok((await stat(path.join(directory, filename))).isFile(), `Missing ${filename}`);
  }
  for (const [size, filename] of Object.entries(manifest.icons)) {
    const bytes = await readFile(path.join(directory, filename));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${filename} must be PNG`);
    assert.equal(bytes.readUInt32BE(16), Number(size));
    assert.equal(bytes.readUInt32BE(20), Number(size));
  }
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  assert.ok(!/localhost|\/src\/|https?:\/\/[^"']+\.js/i.test(html), "Release must contain only bundled scripts");
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)) {
    assert.ok((await stat(path.join(directory, match[1]))).isFile(), `Missing ${match[1]}`);
  }
  const forbidden = /^(node_modules|native-host|\.env.*|.*\.(?:pdb|pem|key|map|exe))$/i;
  async function checkFiles(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      assert.ok(!forbidden.test(entry.name), `Unexpected release file ${entry.name}`);
      if (entry.isDirectory()) await checkFiles(path.join(folder, entry.name));
      else {
        assert.ok(entry.isFile(), `Unexpected link ${entry.name}`);
        if (/\.(js|css|html|json)$/.test(entry.name)) {
          const text = await readFile(path.join(folder, entry.name), "utf8");
          assert.ok(!/www\.googleapis\.com\/calendar|oauth2\.googleapis\.com|getAuthToken|pikanav:calendar-selection/.test(text), "Calendar runtime must not ship");
          assert.ok(!/[A-Z]:\\(?:Users|Projects)\\|localhost:\d+|127\.0\.0\.1:\d+/.test(text), "Machine-specific development path in release");
        }
      }
    }
  }
  await checkFiles(directory);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] || "dist");
  const manifest = await validateExtension(directory);
  console.log(`Validated ${manifest.name} ${manifest.version}: manifest, icons, assets, and release contents.`);
}

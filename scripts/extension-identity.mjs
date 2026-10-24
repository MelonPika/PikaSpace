import { createHash, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function extensionIdFromKey(key) {
  if (typeof key !== 'string' || !key) throw new Error('The release manifest needs a persistent public key');
  const bytes = Buffer.from(key, 'base64');
  createPublicKey({ key: bytes, format: 'der', type: 'spki' });
  return [...createHash('sha256').update(bytes).digest('hex').slice(0, 32)]
    .map(character => String.fromCharCode(97 + Number.parseInt(character, 16))).join('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  console.log(extensionIdFromKey(manifest.key));
}

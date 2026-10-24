import { readFile, writeFile } from 'node:fs/promises';
const notices = [];
for (const name of ['react', 'react-dom', 'scheduler', 'lucide-react', 'loose-envify', 'js-tokens']) {
  const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  notices.push(`${name} ${pkg.version}\n${'='.repeat(60)}\n${await readFile(`node_modules/${name}/LICENSE`, 'utf8')}`);
}
await writeFile('public/THIRD_PARTY_LICENSES.txt', notices.join('\n\n'));
console.log('Generated runtime dependency license notices.');

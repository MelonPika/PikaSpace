import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

let count = 0;
async function check(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const filename = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await check(filename);
    else if (/\.[cm]?js$/.test(filename)) {
      execFileSync(process.execPath, ['--check', filename], { stdio: 'pipe' });
      count++;
    } else if (/\.tsx?$/.test(filename)) {
      const source = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest, true);
      if (source.parseDiagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(source.parseDiagnostics, {
        getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n',
      }));
      count++;
    } else if (filename.endsWith('.json')) JSON.parse(await readFile(filename, 'utf8'));
  }
}
for (const folder of ['src', 'public', 'scripts', 'tests']) await check(folder);
const app = await readFile('src/app/App.tsx', 'utf8');
if (/console\.(log|debug|warn)|dangerouslySetInnerHTML|\beval\(/.test(app)) throw new Error('Unexpected production logging or executable HTML');
console.log(`Source lint: parsed ${count} JavaScript/TypeScript files and checked production hazards.`);

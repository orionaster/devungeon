// Optional fresh-dependency check without touching an active Agent's node_modules.
// An allowlisted public-source copy, not a new repository or Git worktree.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { hero: { type: 'string' } } });
if (!values.hero) throw Error('Select --hero C:/Devungeon/hero explicitly.');
const hero = resolve(values.hero), target = fileURLToPath(new URL('../output/fresh-hero/', import.meta.url));
await mkdir(target, { recursive: true });
const hashes = {};
const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'LICENSE', 'apps/web/index.html', 'apps/web/package.json', 'apps/web/vite.config.ts', 'packages/dungeon-engine/package.json'];
const trees = ['apps/web/src', 'apps/web/public', 'packages/dungeon-engine/src', 'packages/dungeon-engine/test', 'packages/workspace-ui/src/i18n'];
for (const tree of trees) {
  for (const item of await readdir(resolve(hero, tree), { recursive: true, withFileTypes: true })) {
    if (!item.isFile()) continue;
    const file = join(tree, item.parentPath.slice(resolve(hero, tree).length), item.name).replaceAll('\\', '/');
    if (file.split('/').some(part => part.startsWith('.') || ['node_modules', 'dist', 'output'].includes(part))) continue;
    if (!['.ts', '.tsx', '.css', '.html', '.json', '.md', '.txt'].includes(extname(file))) throw Error(`Review an unsupported source asset before copying: ${file}`);
    files.push(file);
  }
}
// Root test:i18n is an ordinary local unit suite; copy its source if present.
try { await readFile(resolve(hero, 'packages/workspace-ui/tests/i18n.test.ts')); files.push('packages/workspace-ui/tests/i18n.test.ts'); } catch {}
for (const file of files) {
  const from = resolve(hero, file), to = resolve(target, file);
  if (!to.startsWith(target)) throw Error('Snapshot target escaped its directory.');
  await mkdir(resolve(to, '..'), { recursive: true });
  const bytes = await readFile(from); await writeFile(to, bytes);
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(resolve(target, 'SOURCE_SNAPSHOT.json'), JSON.stringify({ scope: 'Allowlisted selected HERO source. No .git, credentials, private projects or installed dependencies copied.', hashes }, null, 2) + '\n');
console.log(target);

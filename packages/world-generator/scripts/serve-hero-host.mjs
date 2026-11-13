// Selected public HERO checkout is read-only. All build output stays here.
// Uses the existing exact Vite dependency and ONE copy of HERO's React/runtime.
import { createServer, build, preview } from 'vite';
import { createRequire } from 'node:module';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { hero: { type: 'string' }, port: { type: 'string', default: '4275' }, build: { type: 'boolean' }, preview: { type: 'boolean' } } });
if (!values.hero) throw Error('Select the HERO checkout explicitly: --hero C:/Devungeon/hero');
const hero = resolve(values.hero), requireHero = createRequire(resolve(hero, 'package.json'));
const entry = resolve(hero, 'apps/web/src/App.tsx'), i18n = resolve(hero, 'packages/workspace-ui/src/i18n/index.tsx');
await access(entry); await access(i18n);
const config = {
  configFile: false,
  root: fileURLToPath(new URL('../integration/hero-host/', import.meta.url)),
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'], alias: {
    '@hero/App': entry, '@hero/runtime': resolve(hero, 'apps/web/src/runtime.ts'),
    '@hero/engine': resolve(hero, 'packages/dungeon-engine/src/index.ts'),
    '@hero/style.css': resolve(hero, 'apps/web/src/style.css'), '@shared-i18n': i18n,
    react: dirname(requireHero.resolve('react/package.json')),
    'react-dom': dirname(requireHero.resolve('react-dom/package.json'))
  } },
  server: { host: '127.0.0.1', port: Number(values.port), strictPort: true, fs: { allow: [hero, fileURLToPath(new URL('../../../', import.meta.url))] } },
  preview: { host: '127.0.0.1', port: Number(values.port), strictPort: true },
  build: { outDir: fileURLToPath(new URL('../output/hero-host/', import.meta.url)), emptyOutDir: true }
};
if (values.build) {
  const files = ['apps/web/src/App.tsx', 'apps/web/src/Scene.tsx', 'apps/web/src/runtime.ts', 'apps/web/src/art.ts', 'apps/web/src/style.css', 'packages/dungeon-engine/src/types.ts', 'packages/dungeon-engine/src/scene.ts', 'packages/dungeon-engine/src/engine.ts', 'packages/workspace-ui/src/i18n/index.tsx', 'packages/workspace-ui/src/i18n/core.ts', 'packages/workspace-ui/src/i18n/catalogues.ts', 'packages/workspace-ui/src/i18n/game-catalogue.ts', 'package-lock.json'];
  const hashes = async () => Object.fromEntries(await Promise.all(files.map(async p => [p, createHash('sha256').update(await readFile(resolve(hero, p))).digest('hex')])));
  const before = await hashes(); await build(config); const after = await hashes();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('HERO source changed during build; rerun after the current edit.');
  const builderFiles = ['integration/hero-host/main.tsx', 'src/hero.ts', 'src/presentation.ts', 'src/index.ts'];
  const builder_sources = Object.fromEntries(await Promise.all(builderFiles.map(async p => [p, createHash('sha256').update(await readFile(new URL(`../${p}`, import.meta.url))).digest('hex')])));
  const assets = new URL('../output/hero-host/assets/', import.meta.url);
  const artifact_hashes = Object.fromEntries(await Promise.all((await readdir(assets)).map(async p => [p, createHash('sha256').update(await readFile(new URL(p, assets))).digest('hex')])));
  await writeFile(new URL('../output/hero-host/source-manifest.json', import.meta.url), JSON.stringify({ source: 'Selected actual HERO App, DungeonScene, engine and shared i18n; no copied implementation.', hero_sources: before, builder_sources, artifact_hashes }, null, 2) + '\n');
} else if (values.preview) { const server = await preview(config); server.printUrls(); }
else { const server = await createServer(config); await server.listen(); server.printUrls(); }

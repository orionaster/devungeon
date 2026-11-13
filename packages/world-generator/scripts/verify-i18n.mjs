// Verify the integration contract against the selected WIZARD implementation,
// not a second dictionary. Run with the host's existing tsx loader.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileWorld, toHeroScene, describeWorld, describeHeroRooms, renderWorldName, renderWorldMessage, WORLD_MESSAGE_KEYS } from '../dist/index.js';

const wizard = resolve(process.argv[2] ?? '../wizard');
const path = 'packages/workspace-ui/src/i18n/core.ts';
const { translate, validateCatalogues } = await import(pathToFileURL(resolve(wizard, path)).href);
const { zhCN, enUS } = await import(pathToFileURL(resolve(wizard, 'packages/workspace-ui/src/i18n/catalogues.ts')).href);
assert.deepEqual(validateCatalogues(), [], 'Shared catalogue parity failed');
for (const key of WORLD_MESSAGE_KEYS) assert(key in zhCN && key in enUS, `Missing world key: ${key}`);
const reports = [];
for (const name of ['tiny-landing-page', 'agent-workbench-synthetic']) {
  const snapshot = JSON.parse(await readFile(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
  const result = compileWorld(snapshot, { seed: 1337 }); assert(result.ok);
  const world = result.world, scene = toHeroScene(world), before = JSON.stringify({ snapshot, world, scene });
  const original_names = describeWorld(world).rooms.map(r => r.original_name);
  const display = [];
  for (const locale of ['zh-CN', 'en-US', 'zh-CN']) {
    const t = (key, params) => translate(locale, key, params);
    const rendered = describeHeroRooms(world, scene).map(r => ({ room_id: r.room_id, name: renderWorldName(r.name, t), status: renderWorldMessage(r.status, t), entry: renderWorldMessage(r.entry, t), reasons: r.reasons.map(ref => renderWorldMessage(ref, t)) }));
    assert(rendered.every(r => !r.reasons.some(s => /\{(?:status|ids)\}/.test(s))), 'Interpolation leaked');
    assert.equal(JSON.stringify({ snapshot, world, scene }), before, 'Locale changed source or geometry');
    assert.deepEqual(describeWorld(world).rooms.map(r => r.original_name), original_names);
    display.push({ locale, rendered });
  }
  assert.deepEqual(display[0].rendered, display[2].rendered, 'Returning to Chinese changed display');
  reports.push({ name, source_geometry_unchanged: true, display });
}
const hashes = {};
for (const file of ['core.ts', 'catalogues.ts']) hashes[file] = createHash('sha256').update(await readFile(resolve(wizard, 'packages/workspace-ui/src/i18n', file))).digest('hex');
await mkdir(new URL('../output/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/i18n-integration.json', import.meta.url), JSON.stringify({ shared_catalogue: 'WIZARD workspace-ui i18n', source_hashes: hashes, checked_world_keys: WORLD_MESSAGE_KEYS.length, parity: 'passed', reports }, null, 2) + '\n');
console.log(JSON.stringify({ checked_world_keys: WORLD_MESSAGE_KEYS.length, parity: 'passed', cases: reports.map(r => ({ name: r.name, source_geometry_unchanged: r.source_geometry_unchanged })) }, null, 2));

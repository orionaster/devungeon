import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileWorld } from '../dist/index.js';
const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const write = async (name, value) => writeFile(new URL(`../examples/${name}`, import.meta.url), JSON.stringify(value, null, 2) + '\n');
const report = [];
for (const name of ['tiny-landing-page', 'agent-workbench-synthetic']) {
  const input = await read(`../../../examples/${name}.json`);
  const start = performance.now();
  const result = compileWorld(input, { seed: 1337 });
  if (!result.ok) throw Error(JSON.stringify(result));
  const { world } = result;
  const elapsed = performance.now() - start;
  await write(`${name}.world.json`, world);
  // Directly usable by a renderer that only knows canonical schema v1.
  await write(`${name}.blueprint.json`, world.blueprint);
  const digest = createHash('sha256').update(JSON.stringify(world)).digest('hex');
  report.push({ name, seed: 1337, rooms: world.blueprint.rooms.length, zones: world.blueprint.zones.length, dependencies: world.blueprint.connections.length, tiles: world.scene.tiles.length, colliders: world.scene.colliders.length, walkable: world.scene.navigation.walkable.length, reachable: world.scene.navigation.reachable_room_ids, digest });
  console.log(`${name}: ${world.blueprint.rooms.length} rooms, ${world.blueprint.connections.length} dependencies, ${elapsed.toFixed(1)} ms, sha256 ${digest}`);
  if (name === 'tiny-landing-page') {
    input.revision = 'demo-2';
    input.zones.push({ id: 'analytics', name: 'Analytics', theme_hint: 'observatory' });
    input.rooms.push({ id: 'analytics', name: 'Traffic analytics', zone_id: 'analytics', status: 'planned', depends_on: ['hero'], acceptance_criteria: ['Visitor count can be reviewed'], evidence: [] });
    const increment = compileWorld(input, { seed: 1337, previous: world.layout });
    if (!increment.ok) throw Error(JSON.stringify(increment));
    await write('tiny-landing-page-expanded.snapshot.json', input);
    await write('tiny-landing-page-expanded.world.json', increment.world);
  }
}
await write('manifest.json', { generator_version: '0.1.0', source: 'Bundled synthetic fixtures only; no real project integration.', worlds: report });

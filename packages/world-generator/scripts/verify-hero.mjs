// Optional integration check against a selected local HERO checkout. No writes
// to that checkout. Run with its tsx loader (see README).
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileWorld, createNavigator, toHeroScene } from '../dist/index.js';
const hero = resolve(process.argv[2] ?? '../hero');
const { Dungeon, validateScene, geometry, isWalkable } = await import(pathToFileURL(resolve(hero, 'packages/dungeon-engine/src/index.ts')).href);
const reports = [];
const input = { moveX: 0, moveZ: 0, attack: false, dodge: false };
for (const name of ['tiny-landing-page', 'agent-workbench-synthetic']) {
  const snapshot = JSON.parse(await readFile(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
  const before = JSON.stringify(snapshot);
  const result = compileWorld(snapshot, { seed: 1337 }); assert(result.ok);
  const world = result.world, scene = toHeroScene(world), nav = createNavigator(world.scene);
  validateScene(scene);
  for (const p of world.scene.navigation.walkable) assert(isWalkable(scene, { x: p.x + .5, z: p.z + .5 }, .28), `HERO rejects walkable tile ${JSON.stringify(p)}`);
  for (const r of world.scene.rooms.filter(r => !r.lock.enterable)) assert(!isWalkable(scene, { x: r.x + .5, z: r.z + .5 }), 'Locked center became walkable');
  const expectedTiles = new Set([
    ...world.scene.navigation.walkable,
    ...world.scene.tiles.filter(t => t.kind === 'floor' && t.room_id !== undefined)
  ].map(p => `${p.x + .5},${p.z + .5}`));
  const actualTiles = new Set(geometry(scene).tiles.map(t => `${t.x},${t.z}`));
  assert.deepEqual(actualTiles, expectedTiles, 'HERO floor raster differs from the compiled floor');
  const floor = new Set(world.scene.navigation.walkable.map(p => `${p.x},${p.z}`));
  for (const p of world.scene.navigation.walkable) for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
    if (floor.has(`${p.x + d.x},${p.z + d.z}`)) assert(isWalkable(scene, { x: p.x + .5 + d.x / 2, z: p.z + .5 + d.z / 2 }, .28), 'HERO cannot cross a tile seam');
  }
  const dungeon = await Dungeon.create(scene); dungeon.start();
  let steps = 0;
  function go(target) {
    for (let i = 0; i < 360; i++) {
      const p = dungeon.snapshot().player, dx = target.x - p.x, dz = target.z - p.z;
      if (Math.hypot(dx, dz) < .12) return;
      dungeon.step({ ...input, moveX: dx, moveZ: dz }, 1 / 60); steps++;
    }
    throw Error(`HERO physics stuck approaching ${JSON.stringify(target)} at ${JSON.stringify(dungeon.snapshot().player)}`);
  }
  let current = world.scene.spawn;
  for (const id of world.scene.navigation.reachable_room_ids) {
    const room = world.scene.rooms.find(r => r.room_id === id);
    for (const p of nav.path(current, room)) go({ x: p.x + .5, z: p.z + .5 });
    current = room;
  }
  for (const d of world.scene.doors.filter(d => d.locked)) {
    for (const p of nav.path(current, d.outside)) go({ x: p.x + .5, z: p.z + .5 });
    for (let i = 0; i < 90; i++) dungeon.step({ ...input, moveZ: -1, dodge: i % 54 === 0 }, 1 / 60);
    const p = dungeon.snapshot().player;
    assert(p.z > d.position.z + .5 + .5, 'HERO crossed a locked door while dashing');
    current = { x: Math.round(p.x - .5), z: Math.round(p.z - .5) };
  }
  dungeon.dispose();
  // Exercise an actual HERO combat encounter on a generated accepted room.
  const encounter = toHeroScene(world, { includeEnemies: true });
  const enemy = encounter.enemies[0]; assert(enemy);
  encounter.enemies = [enemy]; encounter.spawn = { x: enemy.x - 1.3, z: enemy.z };
  const combat = await Dungeon.create(encounter); combat.start();
  for (let i = 0; i < 240 && combat.snapshot().phase === 'playing'; i++) combat.step({ ...input, attack: true }, 1 / 60);
  assert.equal(combat.snapshot().phase, 'won');
  assert.equal(JSON.stringify(snapshot), before, 'Combat mutated the source snapshot');
  const after = compileWorld(snapshot, { seed: 1337, previous: world.layout }); assert(after.ok);
  assert.deepEqual(after.world.graph, world.graph, 'Combat changed project truth');
  assert.deepEqual(after.world.scene.doors, world.scene.doors, 'Combat unlocked a real feature');
  const combatStats = combat.snapshot().stats; combat.dispose();
  reports.push({ name, scene_validated: true, exact_floor_raster: true, physics_steps: steps, visited_accepted_rooms: world.scene.navigation.reachable_room_ids, locked_doors_tested: world.scene.doors.filter(d => d.locked).map(d => d.room_id), combat_phase: 'won', combat_stats: combatStats, source_unchanged: true });
}
const stressSnapshot = { schema_version: '1.0', project: { id: 'long-test', name: 'Synthetic long corridors', source: { kind: 'synthetic', is_demo: true } }, revision: 'demo-1', observed_at: '2026-11-13T00:00:00Z', zones: [{ id: 'z', name: 'Zone' }], agents: [], rooms: Array.from({ length: 32 }, (_, i) => ({ id: `r${i}`, name: `Feature ${i}`, zone_id: 'z', status: 'accepted', depends_on: [], evidence: [{ type: 'test', ref: `synthetic:${i}`, verification: 'synthetic' }], acceptance_criteria: ['Synthetic criterion'] })) };
const stress = compileWorld(stressSnapshot, { seed: 1337 }); assert(stress.ok);
const stressScene = toHeroScene(stress.world), stressFloor = new Set(stress.world.scene.navigation.walkable.map(p => `${p.x},${p.z}`));
validateScene(stressScene);
for (const p of stress.world.scene.navigation.walkable) for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
  if (stressFloor.has(`${p.x + d.x},${p.z + d.z}`)) assert(isWalkable(stressScene, { x: p.x + .5 + d.x / 2, z: p.z + .5 + d.z / 2 }, .28), 'HERO long-run seam blocks traversal');
}
reports.push({ name: '32-root-long-run-regression', tile_seams_walkable: true });
const output = new URL('../output/hero-integration.json', import.meta.url); await mkdir(new URL('../output/', import.meta.url), { recursive: true });
const engine_sources = {};
for (const path of ['packages/dungeon-engine/src/types.ts', 'packages/dungeon-engine/src/scene.ts', 'packages/dungeon-engine/src/engine.ts']) engine_sources[path] = createHash('sha256').update(await readFile(resolve(hero, path))).digest('hex');
const runtime = JSON.parse(await readFile(resolve(hero, 'package.json'), 'utf8'));
await writeFile(output, JSON.stringify({ renderer: 'Headless actual HERO engine + Rapier, not a browser rendering test.', engine_sources, rapier_version: runtime.dependencies['@dimforge/rapier3d-compat'], reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));

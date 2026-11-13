import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compileWorld, createNavigator, toHeroScene, type CompiledWorld, type CompileOptions, type ProjectSnapshot } from '../src/index.js';
import { cells, inside, key, porch } from '../src/util.js';

const fixture = (name = 'tiny-landing-page'): ProjectSnapshot => JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
function compile(snapshot: unknown, options: Partial<CompileOptions> = {}): CompiledWorld {
  const result = compileWorld(snapshot, { seed: 1337, ...options });
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.world;
}
function failure(snapshot: unknown, code: string, options: Partial<CompileOptions> = {}) {
  const result = compileWorld(snapshot, { seed: 1337, ...options });
  expect(result.ok).toBe(false);
  if (result.ok) throw Error('Expected failure');
  expect(result.diagnostics.map(d => d.code)).toContain(code);
  return result;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); }
  return value;
}
function assertSpatialInvariants(world: CompiledWorld) {
  const { scene, layout, graph } = world;
  const floor = new Set(scene.navigation.walkable.map(key));
  const allRooms = [layout.foyer, ...layout.rooms];
  for (const [i, room] of allRooms.entries()) {
    for (const other of allRooms.slice(i + 1)) expect(cells(room).some(p => inside(p, other))).toBe(false);
  }
  for (const p of scene.corridors) for (const t of p.tiles) expect(allRooms.some(r => inside(t, r))).toBe(false);
  const nav = createNavigator(scene);
  expect(nav.canOccupy(scene.spawn)).toBe(true);
  for (const r of scene.rooms) {
    const path = nav.path(scene.spawn, r);
    expect(Boolean(path.length)).toBe(r.lock.enterable);
    expect(nav.canOccupy(r)).toBe(r.lock.enterable);
    expect(scene.doors.find(d => d.room_id === r.room_id)!.locked).toBe(!r.lock.enterable);
    if (r.lock.enterable) expect(scene.navigation.reachable_room_ids).toContain(r.room_id);
    else {
      for (const p of cells(r)) expect(floor.has(key(p))).toBe(false);
      expect(scene.colliders.some(c => c.room_id === r.room_id && c.kind === 'locked-room')).toBe(true);
    }
  }
  // Independent truth/lock oracle; no use of the compiler's lock implementation.
  const features = new Map(graph.features.map(r => [r.id, r]));
  const shouldEnter = (id: string): boolean => features.get(id)!.status === 'accepted' && features.get(id)!.depends_on.every(shouldEnter);
  expect(scene.navigation.reachable_room_ids).toEqual(graph.features.filter(r => shouldEnter(r.id)).map(r => r.id));
  for (const p of scene.navigation.walkable) expect(nav.path(scene.spawn, p).length).toBeGreaterThan(0);
}

describe('two canonical synthetic projects', () => {
  it('compiles different scale, graph topology and playable room geometry', () => {
    const tiny = compile(fixture()), complex = compile(fixture('agent-workbench-synthetic'));
    expect([tiny.blueprint.rooms.length, tiny.blueprint.zones.length, tiny.blueprint.connections.length]).toEqual([3, 1, 2]);
    expect([complex.blueprint.rooms.length, complex.blueprint.zones.length, complex.blueprint.connections.length]).toEqual([8, 3, 9]);
    expect(tiny.scene.navigation.reachable_room_ids).toEqual(['hero']);
    expect(complex.scene.navigation.reachable_room_ids).toEqual(['goals', 'registry']);
    expect(complex.scene.encounters.some(e => e.kind === 'boss')).toBe(true);
    assertSpatialInvariants(tiny); assertSpatialInvariants(complex);
  });
  it('reproduces byte-identical results and is independent of source array order', () => {
    const input = fixture('agent-workbench-synthetic');
    const first = compile(input);
    expect(JSON.stringify(compile(input))).toBe(JSON.stringify(first));
    input.rooms.reverse(); input.zones.reverse(); input.agents.reverse();
    for (const r of input.rooms) r.depends_on.reverse();
    expect(compile(input)).toEqual(first);
    expect(compile(input, { seed: 42 }).layout).not.toEqual(first.layout);
  });
  it('outputs match committed generated examples', () => {
    for (const name of ['tiny-landing-page', 'agent-workbench-synthetic']) {
      const saved = JSON.parse(readFileSync(new URL(`../examples/${name}.world.json`, import.meta.url), 'utf8'));
      expect(compile(fixture(name))).toEqual(saved);
    }
  });
});

describe('persistent incremental construction', () => {
  it('adds a lower-sorting ID/new zone without moving any footprint, port or path', () => {
    const s = fixture('agent-workbench-synthetic'), old = compile(s);
    s.revision = 'demo-2'; s.zones.push({ id: 'aaa-zone', name: 'New module' });
    s.rooms.push({ id: 'aaa-new', name: 'New feature', zone_id: 'aaa-zone', status: 'planned', depends_on: ['registry'], evidence: [], acceptance_criteria: ['Example criterion'] });
    const next = compile(s, { previous: deepFreeze(old.layout) });
    for (const r of old.layout.rooms) expect(next.layout.rooms.find(x => x.room_id === r.room_id)).toEqual(r);
    for (const p of old.layout.paths) expect(next.layout.paths.find(x => x.id === p.id)).toEqual(p);
    for (const d of old.scene.doors) expect(next.scene.doors.find(x => x.id === d.id)!.position).toEqual(d.position);
    expect(next.changes.added_room_ids).toEqual(['aaa-new']);
    assertSpatialInvariants(next);
  });
  it('renames/accepts/reverts features without changing geometry or source truth', () => {
    const s = fixture(), old = compile(s);
    s.revision = 'demo-2'; s.rooms[1]!.name = 'Contact form'; s.rooms[1]!.status = 'accepted';
    s.rooms[1]!.evidence = [{ type: 'manual_review', ref: 'synthetic:contact-review', verification: 'synthetic' }];
    const accepted = compile(s, { previous: old.layout });
    expect(accepted.layout).toEqual(old.layout);
    expect(accepted.scene.navigation.reachable_room_ids).toEqual(['contact', 'hero']);
    s.rooms[0]!.status = 'regressed';
    const regressed = compile(s, { previous: accepted.layout });
    expect(regressed.graph.features.find(r => r.id === 'contact')!.status).toBe('accepted');
    expect(regressed.scene.navigation.reachable_room_ids).toEqual([]);
    expect(regressed.diagnostics[0]!.code).toBe('ACCEPTED_WITH_UNMET_DEPENDENCIES');
    const nav = createNavigator(regressed.scene);
    expect(nav.safeSpawn(accepted.scene.rooms.find(r => r.room_id === 'contact')!)).toEqual(regressed.scene.spawn);
    expect(regressed.layout).toEqual(old.layout);
  });
  it('retains sealed tombstones, retired paths and restores the same stable ID', () => {
    const original = fixture(), old = compile(original), s = structuredClone(original);
    s.rooms = s.rooms.filter(r => r.id !== 'launch'); s.revision = 'demo-2';
    const removed = compile(s, { previous: old.layout });
    expect(removed.blueprint.rooms.map(r => r.room_id)).not.toContain('launch');
    expect(removed.scene.tombstones.map(r => r.room_id)).toEqual(['launch']);
    expect(removed.scene.corridors.some(p => p.to === 'launch' && p.retired)).toBe(true);
    const tombstone = removed.scene.tombstones[0]!;
    expect(createNavigator(removed.scene).canOccupy(tombstone)).toBe(false);
    const restored = compile(original, { previous: removed.layout });
    expect(restored.layout).toEqual(old.layout);
    expect(restored.changes.restored_room_ids).toEqual(['launch']);
  });
  it('updates dependencies without dropping old paths or moving rooms', () => {
    const s = fixture(), old = compile(s);
    s.rooms[2]!.depends_on = ['hero'];
    const next = compile(s, { previous: old.layout });
    expect(next.layout.rooms).toEqual(old.layout.rooms);
    for (const p of old.layout.paths) expect(next.layout.paths).toContainEqual(p);
    expect(next.scene.corridors.some(p => p.from === 'contact' && p.to === 'launch' && p.retired)).toBe(true);
    assertSpatialInvariants(next);
  });
});

describe('locks, physical navigation and isolated game outcomes', () => {
  it('sweeps walking/dashing into a locked room, corners, void and walls', () => {
    const world = compile(fixture()), nav = createNavigator(world.scene);
    const r = world.layout.rooms.find(r => r.room_id === 'contact')!;
    const p = porch(r);
    expect(nav.canOccupy(p)).toBe(true);
    const attemptedDash = nav.move(p, r);
    expect(nav.canOccupy(attemptedDash)).toBe(true);
    expect(attemptedDash.z).toBeGreaterThan(r.z + (r.depth - 1) / 2);
    expect(nav.safeSpawn(r)).toEqual(world.scene.spawn);
    expect(nav.safeSpawn({ x: 999, z: 999 })).toEqual(world.scene.spawn);
    for (const t of world.scene.tiles.filter(t => t.kind === 'wall')) expect(nav.canOccupy(t)).toBe(false);
    expect(nav.canOccupy({ x: r.x + 0.49, z: p.z - 0.49 })).toBe(false);
    expect(nav.canOccupy({ x: NaN, z: 0 })).toBe(false);
    expect(nav.canOccupy({ x: 1e100, z: 0 })).toBe(false);
    expect(nav.canOccupy(p, -1)).toBe(false);
    expect(nav.canOccupy(p, 1)).toBe(false);
    expect(nav.move(p, { x: 1000, z: 1000 })).toEqual(p);
    expect(() => nav.move(r, p)).toThrow('Reconcile player position');
  });
  it('requires AND/transitive prerequisites even for an accepted successor', () => {
    const s = fixture('agent-workbench-synthetic');
    s.rooms.find(r => r.id === 'executor')!.status = 'accepted';
    s.rooms.find(r => r.id === 'executor')!.evidence = [{ type: 'test', ref: 'synthetic:executor', verification: 'synthetic' }];
    const world = compile(s), room = world.scene.rooms.find(r => r.room_id === 'executor')!;
    expect(room.lock.enterable).toBe(false);
    expect(room.lock.unmet_dependencies).toEqual(['dispatch', 'planning']);
    expect(world.graph.features.find(r => r.id === 'executor')!.status).toBe('accepted');
  });
  it('keeps a safe game foyer when every feature is planned, and connects independent roots', () => {
    const s = fixture();
    for (const r of s.rooms) r.status = 'planned';
    const allLocked = compile(s);
    expect(allLocked.scene.navigation.reachable_room_ids).toEqual([]);
    expect(allLocked.blueprint.rooms.some(r => r.room_id === '__game_foyer__')).toBe(false);
    assertSpatialInvariants(allLocked);
    for (const r of s.rooms) { r.status = 'accepted'; r.depends_on = []; r.evidence = [{ type: 'test', ref: `synthetic:${r.id}`, verification: 'synthetic' }]; }
    const roots = compile(s);
    expect(roots.scene.navigation.reachable_room_ids).toHaveLength(3);
    expect(roots.scene.corridors.every(p => p.from === null)).toBe(true);
    assertSpatialInvariants(roots);
  });
  it('game victory and closed/merged references never promote project acceptance', () => {
    const s = fixture(), before = JSON.stringify(s);
    s.rooms[1]!.evidence = [{ type: 'issue', ref: 'synthetic:closed-issue', verification: 'verified' }, { type: 'pull_request', ref: 'synthetic:merged-pr', verification: 'verified' }];
    const frozen = deepFreeze(s), world = compile(frozen), state = { defeated: [] as string[], loot: 0 };
    for (const e of world.scene.encounters) { state.defeated.push(e.id); state.loot++; expect(e.completion_effect).toBe('game-state-only'); }
    expect(world.graph.features.find(r => r.id === 'contact')!.status).toBe('active');
    expect(compile(frozen, { previous: world.layout }).scene.doors.find(d => d.room_id === 'contact')!.locked).toBe(true);
    expect(frozen.rooms[1]!.status).toBe('active');
    expect(JSON.parse(before).rooms.map((r: { status: string }) => r.status)).toEqual(frozen.rooms.map(r => r.status));
    // The Snapshot boundary rejects attempts to smuggle a gameplay outcome in.
    failure({ ...s, game_victory: true }, 'INVALID_SNAPSHOT');
  });
});

describe('trust boundaries and explicit failure feedback', () => {
  it.each([
    ['missing room dependency', 'MISSING_DEPENDENCY', (s: ProjectSnapshot) => { s.rooms[1]!.depends_on = ['missing']; }],
    ['missing zone', 'MISSING_ZONE', (s: ProjectSnapshot) => { s.rooms[1]!.zone_id = 'missing'; }],
    ['missing agent room', 'MISSING_AGENT_ROOM', (s: ProjectSnapshot) => { s.agents[0]!.room_id = 'missing'; }],
    ['duplicate room', 'DUPLICATE_ID', (s: ProjectSnapshot) => { s.rooms.push(structuredClone(s.rooms[0]!)); }],
    ['duplicate zone', 'DUPLICATE_ID', (s: ProjectSnapshot) => { s.zones.push(structuredClone(s.zones[0]!)); }],
    ['duplicate agent', 'DUPLICATE_ID', (s: ProjectSnapshot) => { s.agents.push(structuredClone(s.agents[0]!)); }],
    ['self dependency', 'DEPENDENCY_CYCLE', (s: ProjectSnapshot) => { s.rooms[0]!.depends_on = ['hero']; }],
    ['three-node cycle', 'DEPENDENCY_CYCLE', (s: ProjectSnapshot) => { s.rooms[0]!.depends_on = ['launch']; }],
    ['synthetic without demo', 'DEMO_REQUIRED', (s: ProjectSnapshot) => { s.project.source.is_demo = false; }],
    ['unmarked demo agent', 'DEMO_REQUIRED', (s: ProjectSnapshot) => { delete s.agents[0]!.is_demo; }],
    ['unverified real acceptance', 'UNVERIFIED_ACCEPTANCE', (s: ProjectSnapshot) => { s.project.source = { kind: 'manual', is_demo: false }; }],
    ['accepted without evidence', 'INVALID_SNAPSHOT', (s: ProjectSnapshot) => { s.rooms[0]!.evidence = []; }],
    ['invalid date', 'INVALID_SNAPSHOT', (s: ProjectSnapshot) => { s.observed_at = 'yesterday'; }]
  ])('rejects %s', (_title, code, mutate) => {
    const s = fixture(); mutate(s); failure(s, code);
  });
  it('fails infeasible placement with the actual semantic graph as fallback', () => {
    const result = failure(fixture(), 'LAYOUT_UNSATISFIABLE', { bounds: { min_x: -24, max_x: -13, min_z: -6, max_z: 6 } });
    expect(result.fallback_graph!.features).toHaveLength(3);
    failure(fixture(), 'INVALID_BOUNDS', { bounds: { min_x: 0, max_x: 5000, min_z: 0, max_z: 5000 } });
    failure(fixture(), 'INVALID_BOUNDS', { bounds: { min_x: -128, max_x: 256, min_z: -128, max_z: 256, note: 'not a coordinate' } as CompileOptions['bounds'] });
    failure(fixture(), 'INVALID_SEED', { seed: NaN });
  });
  it.each(['status', 'evidence', 'depends_on', 'x', 'width', 'unknown_field'])('rejects designer attempts to write %s', field => {
    failure(fixture(), 'INVALID_DESIGNER', { designer: { schema_version: '1.0', rooms: [{ room_id: 'hero', [field]: 'invented' }] } });
  });
  it('accepts only existing-entity decoration and keeps all facts/geometry pinned', () => {
    const s = fixture(), old = compile(s);
    const designer = { schema_version: '1.0', zones: [{ zone_id: 'experience', theme: 'observatory', narrative: 'A fictional star vault' }], rooms: [{ room_id: 'hero', title: 'Star hall', prefab: 'archive' }] };
    const world = compile(s, { previous: old.layout, designer });
    expect(world.graph).toEqual(old.graph); expect(world.layout).toEqual(old.layout);
    expect(world.blueprint.zones[0]!.theme).toBe('observatory');
    expect(world.scene.rooms.find(r => r.room_id === 'hero')!.title).toBe('Star hall');
    failure(s, 'DESIGNER_UNKNOWN_ENTITY', { designer: { schema_version: '1.0', rooms: [{ room_id: 'fabricated' }] } });
    failure(s, 'DUPLICATE_ID', { designer: { schema_version: '1.0', rooms: [{ room_id: 'hero' }, { room_id: 'hero' }] } });
    failure(s, 'INVALID_DESIGNER', { designer: { schema_version: '1.0', rooms: [{ room_id: 'hero', prefab: 'untrusted-script' }] } });
  });
  it('validates hostile or incompatible saved worlds before trusting coordinates', () => {
    const old = compile(fixture());
    failure(fixture(), 'SEED_MISMATCH', { previous: old.layout, seed: 42 });
    failure(fixture(), 'PROJECT_MISMATCH', { previous: { ...old.layout, project_id: 'other' } });
    failure(fixture(), 'GENERATOR_VERSION_MISMATCH', { previous: { ...old.layout, generator_version: '0.0.0' } });
    failure(fixture(), 'INVALID_PREVIOUS_LAYOUT', { previous: { ...old.layout, rooms: [{ ...old.layout.rooms[0], width: -1 }] } });
    const overlapping = structuredClone(old.layout); overlapping.rooms[1]!.x = overlapping.rooms[0]!.x; overlapping.rooms[1]!.z = overlapping.rooms[0]!.z;
    failure(fixture(), 'INVALID_PREVIOUS_LAYOUT', { previous: overlapping });
    const teleport = structuredClone(old.layout); teleport.paths[0]!.tiles[1] = { x: 2000, z: 2000 };
    failure(fixture(), 'INVALID_PREVIOUS_LAYOUT', { previous: teleport });
    const wallCut = structuredClone(old.layout); wallCut.paths[0]!.tiles[1] = { x: wallCut.rooms[0]!.x, z: wallCut.rooms[0]!.z };
    failure(fixture(), 'INVALID_PREVIOUS_LAYOUT', { previous: wallCut });
    failure(fixture(), 'BOUNDS_MISMATCH', { previous: old.layout, bounds: { min_x: -127, max_x: 256, min_z: -128, max_z: 256 } });
    expect(compile(fixture(), { previous: old.layout, bounds: { max_z: 256, min_z: -128, max_x: 256, min_x: -128 } }).layout).toEqual(old.layout);
  });
  it.each(['room', 'foyer', 'path'])('rejects extreme %s coordinates before enumerating tiles', kind => {
    const previous = structuredClone(compile(fixture()).layout);
    if (kind === 'room') previous.rooms[0]!.x = 1e100;
    if (kind === 'foyer') previous.foyer.z = 1e100;
    if (kind === 'path') previous.paths[0]!.tiles[0]!.x = 1e100;
    failure(fixture(), 'INVALID_PREVIOUS_LAYOUT', { previous });
  });
});

describe('HERO scene conversion', () => {
  it('maps tile centers and inner floor sizes without changing persistent coordinates', () => {
    const world = deepFreeze(compile(fixture()));
    const scene = toHeroScene(world, { includeEnemies: true });
    expect(scene.spawn).toEqual({ x: world.scene.spawn.x + .5, z: world.scene.spawn.z + .5 });
    expect(scene.rooms[0]!.status).toBe('game-only');
    expect(scene.enemies).toHaveLength(1);
    expect(toHeroScene(world).enemies).toEqual([]);
    for (const r of world.blueprint.rooms) {
      const converted = scene.rooms.find(x => x.room_id === r.room_id)!;
      expect(converted.x).toBe(r.x + .5); expect(converted.z).toBe(r.z + .5);
      expect(converted.width).toBe(r.width - 2); expect(converted.depth).toBe(r.depth - 2);
    }
    expect(scene.rooms.find(r => r.room_id === 'contact')!.enterable).toBe(false);
  });
  it('does not collide a project entity ID with the separate game foyer', () => {
    const s = fixture();
    s.rooms[0]!.id = '__game_foyer__'; s.rooms[1]!.depends_on = ['__game_foyer__'];
    const scene = toHeroScene(compile(s));
    expect(new Set(scene.rooms.map(r => r.room_id)).size).toBe(scene.rooms.length);
  });
  it('overlaps long corridor segments enough for a HERO player to cross their seams', () => {
    const s = fixture(); s.project.id = 'long-test'; s.zones = [{ id: 'z', name: 'Zone' }]; s.agents = [];
    s.rooms = Array.from({ length: 32 }, (_, i) => ({ id: `r${i}`, zone_id: 'z', name: `Feature ${i}`, status: 'accepted', depends_on: [], evidence: [{ type: 'test', ref: `synthetic:${i}`, verification: 'synthetic' }], acceptance_criteria: ['Synthetic criterion'] }));
    const world = compile(s), hero = toHeroScene(world), floor = new Set(world.scene.navigation.walkable.map(key));
    expect(hero.corridors.some(r => r.width === 120 || r.depth === 120)).toBe(true);
    const canStand = (p: { x: number; z: number }) => [...hero.rooms.filter(r => r.enterable), ...hero.corridors].some(r => Math.abs(p.x - r.x) < r.width / 2 - .28 && Math.abs(p.z - r.z) < r.depth / 2 - .28);
    for (const p of world.scene.navigation.walkable) for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
      if (floor.has(key({ x: p.x + d.x, z: p.z + d.z }))) expect(canStand({ x: p.x + .5 + d.x / 2, z: p.z + .5 + d.z / 2 })).toBe(true);
    }
  });
});

describe('seeded property checks against an independent reachability oracle', () => {
  const dag = fc.array(fc.record({ links: fc.integer({ min: 0, max: 65535 }), accepted: fc.boolean(), zone: fc.integer({ min: 0, max: 2 }) }), { minLength: 1, maxLength: 14 });
  function snapshot(nodes: { links: number; accepted: boolean; zone: number }[]): ProjectSnapshot {
    return { schema_version: '1.0', project: { id: 'property-project', name: 'Synthetic generated DAG', source: { kind: 'synthetic', is_demo: true } }, revision: 'property-1', observed_at: '2026-11-13T00:00:00Z', zones: [0, 1, 2].map(i => ({ id: `z${i}`, name: `Zone ${i}` })), agents: [], rooms: nodes.map((n, i) => ({ id: `r${i}`, zone_id: `z${n.zone}`, name: `Feature ${i}`, status: n.accepted ? 'accepted' : 'planned', depends_on: nodes.slice(0, i).flatMap((_, j) => n.links & 1 << j ? [`r${j}`] : []), evidence: n.accepted ? [{ type: 'test', ref: `synthetic:${i}`, verification: 'synthetic' }] : [], acceptance_criteria: ['Synthetic criterion'] })) };
  }
  it('keeps rooms disjoint, all unlocked tiles reachable, all locked interiors inaccessible', () => {
    fc.assert(fc.property(dag, fc.integer(), (nodes, seed) => {
      const input = snapshot(nodes), world = compile(input, { seed });
      assertSpatialInvariants(world);
      input.rooms.reverse(); input.zones.reverse();
      expect(compile(input, { seed })).toEqual(world);
    }), { seed: 20261113, numRuns: 40 });
  }, 30000);
  it('pins arbitrary old layouts under additive module evolution', () => {
    fc.assert(fc.property(dag, fc.integer(), (nodes, seed) => {
      const input = snapshot(nodes), old = compile(input, { seed });
      input.revision = 'property-2'; input.zones.push({ id: 'new-zone', name: 'New module' });
      input.rooms.push({ id: 'a-added', zone_id: 'new-zone', name: 'Added', status: 'planned', depends_on: [nodes.length > 1 ? 'r1' : 'r0'], evidence: [], acceptance_criteria: ['Added criterion'] });
      const next = compile(input, { seed, previous: old.layout });
      for (const r of old.layout.rooms) expect(next.layout.rooms).toContainEqual(r);
      for (const p of old.layout.paths) expect(next.layout.paths).toContainEqual(p);
      assertSpatialInvariants(next);
    }), { seed: 1337, numRuns: 30 });
  }, 30000);
});

import type { CompiledWorld, Point, Source } from './types.js';
import { hash, inside, key, requireThat } from './util.js';

/** Structural match for HERO's initial SceneDefinition; no engine dependency. */
export interface HeroScene {
  worldId: string;
  project_context: { project_id: string; project_revision: string; observed_at: string; source: Source };
  doors: { room_id: string; x: number; z: number; axis: 'x' | 'z'; locked: boolean }[];
  agent_ids_without_room: string[];
  rooms: { room_id: string; x: number; z: number; width: number; depth: number; name: string; enterable: boolean; status: string; reason: string }[];
  corridors: { x: number; z: number; width: number; depth: number }[];
  spawn: Point;
  obstacles: { x: number; z: number; width: number; depth: number; kind: 'pillar' | 'crate' }[];
  enemies: (Point & { id: string; kind: 'slime' | 'sentinel' })[];
  agents: (Point & { agent_id: string; name: string; role: 'builder' | 'scout' | 'wizard'; room_id: string; visual_only: true; source_role: 'supervisor' | 'worker' | 'reviewer'; is_demo: boolean })[];
}

/** HERO S1 geometry uses half-integer tile centers. Shift the ENTIRE scene +0.5
 * on X/Z, then use inner floor extents, never the blueprint's outer wall size.
 * This conversion does not alter the persistent canonical world coordinates.
 */
export function toHeroScene(world: CompiledWorld, options: { includeEnemies?: boolean; includeAgents?: boolean } = {}): HeroScene {
  requireThat(world.layout.rooms.length < 128, 'HERO_SCENE_LIMIT', 'HERO S1 allows 128 rooms including the game-only foyer.');
  const shift = (p: Point): Point => ({ x: p.x + 0.5, z: p.z + 0.5 });
  let foyerId = '__game_foyer__';
  while (world.layout.rooms.some(r => r.room_id === foyerId)) foyerId += '_';
  const features = new Map(world.graph.features.map(r => [r.id, r]));
  const rooms: HeroScene['rooms'] = [
    { room_id: foyerId, ...shift(world.layout.foyer), width: 7, depth: 7, name: 'Game-only foyer', enterable: true, status: 'game-only', reason: 'Safe spawn; not a project capability.' },
    ...world.layout.rooms.map(p => {
      const r = world.scene.rooms.find(r => r.room_id === p.room_id);
      return { room_id: p.room_id, ...shift(p), width: p.width - 2, depth: p.depth - 2, name: features.get(p.room_id)?.name ?? 'Removed feature (historical)', enterable: r?.lock.enterable ?? false, status: r?.lock.status ?? 'removed', reason: r?.lock.reasons.join(' ') ?? 'Removed from the current snapshot.' };
    })
  ];
  // Both axes are needed: maximal overlapping runs allow HERO's inset footprint
  // checks across tile seams and turns without adding any extra walkable tiles.
  const corridors: HeroScene['corridors'] = [];
  const footprints = [world.layout.foyer, ...world.layout.rooms];
  const bridges = new Set([world.layout.foyer, ...world.scene.rooms.filter(r => r.lock.enterable)].map(r => key({ x: r.x, z: r.z + (r.depth - 1) / 2 - 1 })));
  // Rooms already cover their interior floors. Only exterior circulation, open
  // door tiles and one inner bridge tile need corridor rectangles.
  const corridorTiles = world.scene.navigation.walkable.filter(p => bridges.has(key(p)) || !footprints.some(r => inside(p, { ...r, width: r.width - 2, depth: r.depth - 2 })));
  const corridorSet = new Set(corridorTiles.map(key));
  for (const axis of ['x', 'z'] as const) {
    const rows = new Map<number, number[]>();
    for (const p of corridorTiles) {
      const line = axis === 'x' ? p.z : p.x, value = p[axis];
      const row = rows.get(line) ?? []; row.push(value); rows.set(line, row);
    }
    for (const [line, values] of [...rows].sort(([a], [b]) => a - b)) {
      values.sort((a, b) => a - b);
      for (let i = 0; i < values.length;) {
        const start = values[i]!; let end = start;
        while (i + 1 < values.length && values[i + 1] === end + 1 && end - start < 119) end = values[++i]!;
        const mid = (start + end) / 2 + 0.5, length = end - start + 1;
        const singletonOnOtherRun = length === 1 && (axis === 'x'
          ? corridorSet.has(key({ x: start, z: line - 1 })) || corridorSet.has(key({ x: start, z: line + 1 }))
          : corridorSet.has(key({ x: line - 1, z: start })) || corridorSet.has(key({ x: line + 1, z: start })));
        if (!singletonOnOtherRun) corridors.push(axis === 'x' ? { x: mid, z: line + .5, width: length, depth: 1 } : { x: line + .5, z: mid, width: 1, depth: length });
        // Overlap one tile when splitting a long run. HERO checks a player's
        // whole footprint inside one rectangle; a shared edge alone leaves a gap.
        if (!(i + 1 < values.length && values[i + 1] === end + 1)) i++;
      }
    }
  }
  requireThat([...rooms, ...corridors].every(r => Math.abs(r.x) <= 512 && Math.abs(r.z) <= 512), 'HERO_SCENE_LIMIT', 'HERO S1 scene coordinates must remain within +/-512.');
  const enemies: HeroScene['enemies'] = options.includeEnemies ? world.scene.encounters.filter(e => world.scene.rooms.find(r => r.room_id === e.room_id)!.lock.enterable).map(e => ({ ...shift(e.position), id: e.id, kind: e.kind === 'boss' ? 'sentinel' : 'slime' })) : [];
  const agent_ids_without_room = world.graph.agents.filter(a => a.room_id === undefined).map(a => a.id);
  const agents: HeroScene['agents'] = options.includeAgents ? world.graph.agents.filter(a => a.room_id !== undefined).map(a => {
    const room = rooms.find(r => r.room_id === a.room_id)!;
    const salt = hash(JSON.stringify(['agent-marker', world.graph.project.id, a.id]));
    return {
      agent_id: a.id, name: a.name, room_id: a.room_id!,
      x: room.x + (salt % 3 - 1) * 1.25, z: room.z + ((salt >>> 2) % 3 - 1) * 1.25,
      role: a.role === 'supervisor' ? 'wizard' : a.role === 'reviewer' ? 'scout' : 'builder',
      source_role: a.role, visual_only: true, is_demo: a.is_demo ?? world.is_demo
    };
  }) : [];
  requireThat(corridors.length <= 512 && enemies.length <= 64 && agents.length <= 64 && [...rooms, ...corridors].reduce((n, r) => n + r.width * r.depth, 0) <= 32768, 'HERO_SCENE_LIMIT', 'HERO S1 budgets are 512 corridor rectangles, 64 enemies/agents and 32768 summed floor tiles.');
  const doors: HeroScene['doors'] = world.scene.doors.map(d => ({ room_id: d.room_id, ...shift(d.position), axis: 'x', locked: d.locked }));
  requireThat([...doors, ...agents].every(p => Math.abs(p.x) <= 512 && Math.abs(p.z) <= 512), 'HERO_SCENE_LIMIT', 'HERO S1 door and actor coordinates must remain within +/-512.');
  return {
    worldId: JSON.stringify([world.blueprint.project_id, world.blueprint.project_revision]),
    project_context: { project_id: world.graph.project.id, project_revision: world.graph.revision, observed_at: world.graph.observed_at, source: structuredClone(world.graph.project.source) },
    doors,
    rooms, corridors, spawn: shift(world.scene.spawn), obstacles: [], enemies, agents, agent_ids_without_room
  };
}

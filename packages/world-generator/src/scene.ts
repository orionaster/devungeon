import type { Collider, DesignerProposal, Lock, Point, ProjectGraph, SavedLayout, SceneLayout, Tile } from './types.js';
import { cells, compare, door, edgeId, hash, key, porch, requireThat, samePoint } from './util.js';

export function projectLocks(graph: ProjectGraph): Map<string, Lock> {
  const features = new Map(graph.features.map(r => [r.id, r])); const locks = new Map<string, Lock>();
  for (const id of graph.topological_order) {
    const r = features.get(id)!;
    const unmet = [...new Set(r.depends_on.flatMap(dep => {
      const lock = locks.get(dep)!;
      return lock.enterable ? [] : [dep, ...lock.unmet_dependencies];
    }))].sort(compare);
    const reasons = r.status === 'accepted' ? [] : [`Project status is ${r.status}; player entry requires accepted.`];
    if (unmet.length) reasons.push(`Unmet dependencies: ${unmet.join(', ')}.`);
    locks.set(id, { room_id: id, enterable: r.status === 'accepted' && unmet.length === 0, status: r.status, reasons, unmet_dependencies: unmet });
  }
  return locks;
}

export function buildScene(graph: ProjectGraph, layout: SavedLayout, designer: DesignerProposal): SceneLayout {
  const locks = projectLocks(graph);
  const tiles = new Map<string, Tile>(); const colliders: Collider[] = [];
  const doors: SceneLayout['doors'] = [];
  const stamp = (p: Point, kind: Tile['kind'], room_id?: string) => tiles.set(key(p), { ...p, kind, ...(room_id === undefined ? {} : { room_id }), variant: hash(JSON.stringify([layout.seed, room_id, p.x, p.z])) % 4 });
  const placements = [layout.foyer, ...layout.rooms];
  for (const r of placements) {
    const isFoyer = r === layout.foyer;
    const d = door(r);
    const lock = isFoyer ? undefined : locks.get(r.room_id) ?? { room_id: r.room_id, enterable: false, status: 'removed', reasons: ['Feature removed from current snapshot; reserved historical geometry.'], unmet_dependencies: [] };
    for (const p of cells(r)) {
      const border = Math.abs(p.x - r.x) === (r.width - 1) / 2 || Math.abs(p.z - r.z) === (r.depth - 1) / 2;
      stamp(p, samePoint(p, d) ? 'door' : border ? 'wall' : 'floor', isFoyer ? undefined : r.room_id);
    }
    stamp(porch(r), 'floor');
    if (lock) {
      doors.push({ id: JSON.stringify(['door', r.room_id]), room_id: r.room_id, position: d, outside: porch(r), locked: !lock.enterable, reasons: lock.reasons });
      if (!lock.enterable) {
        colliders.push({ id: JSON.stringify(['deny', r.room_id]), kind: 'locked-room', room_id: r.room_id, center: { x: r.x, y: 1, z: r.z }, size: { x: r.width - 2, y: 2, z: r.depth - 2 } });
        colliders.push({ id: JSON.stringify(['door', r.room_id]), kind: 'locked-door', room_id: r.room_id, center: { ...d, y: 1 }, size: { x: 1, y: 2, z: 1 } });
      }
    }
  }
  for (const path of layout.paths) for (const p of path.tiles) {
    requireThat(!tiles.has(key(p)) || tiles.get(key(p))!.kind === 'floor' && tiles.get(key(p))!.room_id === undefined, 'CORRIDOR_COLLISION', 'A corridor crossed a reserved room footprint.');
    stamp(p, 'floor');
  }
  // Every exposed edge has a one-tile wall with actual depth. Intersections are
  // intentional exterior junctions; they never open a second doorway into a room.
  for (const t of [...tiles.values()]) if (t.kind !== 'wall') {
    for (const p of [{ x: t.x + 1, z: t.z }, { x: t.x - 1, z: t.z }, { x: t.x, z: t.z + 1 }, { x: t.x, z: t.z - 1 }]) {
      if (!tiles.has(key(p))) stamp(p, 'wall');
    }
  }
  const sortedTiles = [...tiles.values()].sort((a, b) => a.z - b.z || a.x - b.x);
  for (const t of sortedTiles) if (t.kind === 'wall') colliders.push({ id: `wall:${key(t)}`, kind: 'wall', ...(t.room_id === undefined ? {} : { room_id: t.room_id }), center: { x: t.x, y: 1, z: t.z }, size: { x: 1, y: 2, z: 1 } });
  const walkable = sortedTiles.filter(t => t.kind !== 'wall' && (t.room_id === undefined || locks.get(t.room_id)?.enterable)).map(({ x, z }) => ({ x, z }));
  const walkSet = new Set(walkable.map(key));
  const spawn = { x: layout.foyer.x, z: layout.foyer.z };
  const reachable = new Set<string>([key(spawn)]); const queue: Point[] = [spawn];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    for (const n of [{ x: p.x + 1, z: p.z }, { x: p.x - 1, z: p.z }, { x: p.x, z: p.z + 1 }, { x: p.x, z: p.z - 1 }]) if (walkSet.has(key(n)) && !reachable.has(key(n))) { reachable.add(key(n)); queue.push(n); }
  }
  const reachableRooms = graph.features.filter(r => {
    const p = layout.rooms.find(p => p.room_id === r.id)!;
    return reachable.has(key(p));
  }).map(r => r.id);
  for (const lock of locks.values()) requireThat(lock.enterable === reachableRooms.includes(lock.room_id), 'REACHABILITY_FAILED', `Player reachability disagrees with lock on ${lock.room_id}.`, [lock.room_id]);
  requireThat(walkable.every(p => reachable.has(key(p))), 'REACHABILITY_FAILED', 'A walkable tile is disconnected from the safe foyer.');
  const activePaths = new Set(graph.features.flatMap(r => r.depends_on.length ? r.depends_on.map(d => edgeId(d, r.id)) : [edgeId(null, r.id)]));
  return {
    format_version: '1.0', coordinates: { plane: 'xz', up: '+y', unit: 'tile', tile_size: 1, room_anchor: 'center', native_pixels_per_tile: 16, wall_height: 2, wall_depth: 1, camera_quarter_turns: [0, 90, 180, 270] },
    foyer: layout.foyer, spawn, bounds: layout.bounds, tiles: sortedTiles,
    colliders: colliders.sort((a, b) => compare(a.id, b.id)), doors,
    corridors: layout.paths.map(p => ({ ...p, retired: !activePaths.has(p.id) })),
    rooms: graph.features.map(feature => {
      const p = layout.rooms.find(r => r.room_id === feature.id)!;
      const proposal = designer.rooms?.find(r => r.room_id === feature.id);
      const theme = designer.zones?.find(z => z.zone_id === feature.zone_id)?.theme ?? graph.zones.find(z => z.id === feature.zone_id)!.theme_hint ?? 'original stone dungeon';
      return { room_id: p.room_id, x: p.x, z: p.z, width: p.width, depth: p.depth, prefab: p.prefab, pinned: true, zone_id: feature.zone_id, title: proposal?.title ?? feature.name, ...(proposal?.narrative ? { narrative: proposal.narrative } : {}), lock: locks.get(feature.id)!, motif: theme };
    }),
    tombstones: layout.rooms.filter(r => r.retired),
    encounters: graph.features.map(r => {
      const p = layout.rooms.find(p => p.room_id === r.id)!;
      return { id: JSON.stringify(['encounter', r.id]), room_id: r.id, kind: p.prefab === 'boss-arena' ? 'boss' : 'skirmish', domain: 'game-only', completion_effect: 'game-state-only', position: { x: p.x, z: p.z } };
    }),
    navigation: { walkable, reachable_room_ids: reachableRooms }
  };
}

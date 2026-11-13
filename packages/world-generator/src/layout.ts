import { Path } from 'rot-js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { Bounds, DesignerProposal, Placement, Point, ProjectGraph, RoomReservation, SavedLayout } from './types.js';
import { byId, cells, compare, DEFAULT_BOUNDS, edgeId, GENERATOR_VERSION, hash, inBounds, inside, key, MAX_PATH_TILES, MAX_ROOMS, porch, PREFABS, requireThat, samePoint } from './util.js';

const integer = { type: 'integer' };
const coordinate = { type: 'integer', minimum: -2048, maximum: 2048 };
const pointSchema = { type: 'object', additionalProperties: false, required: ['x', 'z'], properties: { x: coordinate, z: coordinate } };
const placementProperties = { room_id: { type: 'string', minLength: 1 }, x: coordinate, z: coordinate, width: { type: 'integer', minimum: 9, maximum: 11 }, depth: { type: 'integer', minimum: 9, maximum: 11 }, prefab: { enum: [...PREFABS, 'foyer'] }, pinned: { type: 'boolean' } };
const boundsSchema = { type: 'object', additionalProperties: false, required: ['min_x', 'max_x', 'min_z', 'max_z'], properties: { min_x: integer, max_x: integer, min_z: integer, max_z: integer } };
const validateLayout = new Ajv2020({ allErrors: true }).compile({
  type: 'object', additionalProperties: false,
  required: ['format_version', 'generator_version', 'project_id', 'seed', 'bounds', 'foyer', 'zone_order', 'rooms', 'paths'],
  properties: {
    format_version: { const: '1.0' }, generator_version: { type: 'string' }, project_id: { type: 'string' }, seed: integer, bounds: boundsSchema,
    foyer: { type: 'object', additionalProperties: false, required: ['room_id', 'x', 'z', 'width', 'depth'], properties: placementProperties },
    zone_order: { type: 'array', maxItems: MAX_ROOMS, uniqueItems: true, items: { type: 'string' } },
    rooms: { type: 'array', maxItems: MAX_ROOMS, items: { type: 'object', additionalProperties: false, required: ['room_id', 'x', 'z', 'width', 'depth', 'prefab', 'first_seen_revision', 'retired'], properties: { ...placementProperties, prefab: { enum: [...PREFABS] }, first_seen_revision: { type: 'string' }, retired: { type: 'boolean' } } } },
    paths: { type: 'array', maxItems: 2048, items: { type: 'object', additionalProperties: false, required: ['id', 'from', 'to', 'tiles'], properties: { id: { type: 'string' }, from: { type: ['string', 'null'] }, to: { type: 'string' }, tiles: { type: 'array', minItems: 1, maxItems: MAX_PATH_TILES, items: pointSchema } } } }
  }
});

export function validBounds(value: Bounds): Bounds {
  requireThat(value && [value.min_x, value.max_x, value.min_z, value.max_z].every(n => Number.isSafeInteger(n) && Math.abs(n) <= 2048), 'INVALID_BOUNDS', 'Bounds must be integer tile coordinates within +/-2048.');
  requireThat(Object.keys(value).length === 4 && Object.keys(value).every(k => ['min_x', 'max_x', 'min_z', 'max_z'].includes(k)), 'INVALID_BOUNDS', 'Bounds may contain only min_x, max_x, min_z and max_z.');
  const width = value.max_x - value.min_x + 1, depth = value.max_z - value.min_z + 1;
  requireThat(width >= 11 && depth >= 11 && width * depth <= 262_144, 'INVALID_BOUNDS', 'Bounds must be at least 11x11 and contain at most 262144 cells.');
  return { min_x: value.min_x, max_x: value.max_x, min_z: value.min_z, max_z: value.max_z };
}

function fits(r: Placement, bounds: Bounds): boolean {
  // Check extents before any cell enumeration, even on untrusted saved layouts.
  return inBounds({ x: r.x - (r.width - 1) / 2, z: r.z - (r.depth - 1) / 2 }, bounds)
    && inBounds({ x: r.x + (r.width - 1) / 2, z: r.z + (r.depth - 1) / 2 }, bounds) && inBounds(porch(r), bounds);
}
function overlap(a: Placement, b: Placement, gap = 1): boolean {
  return Math.abs(a.x - b.x) <= (a.width + b.width - 2) / 2 + gap && Math.abs(a.z - b.z) <= (a.depth + b.depth - 2) / 2 + gap;
}

function readPrevious(input: unknown, graph: ProjectGraph, seed: number): SavedLayout | undefined {
  if (input === undefined) return undefined;
  requireThat(validateLayout(input), 'INVALID_PREVIOUS_LAYOUT', `Saved layout fails validation: ${JSON.stringify(validateLayout.errors)}.`);
  const layout = structuredClone(input) as SavedLayout;
  requireThat(layout.generator_version === GENERATOR_VERSION, 'GENERATOR_VERSION_MISMATCH', 'Explicit migration required for a different generator version.');
  requireThat(layout.project_id === graph.project.id, 'PROJECT_MISMATCH', 'Saved layout belongs to another project.');
  requireThat(layout.seed === seed, 'SEED_MISMATCH', 'Changing a persistent world seed requires explicit regeneration.');
  validBounds(layout.bounds);
  requireThat(new Set(layout.rooms.map(r => r.room_id)).size === layout.rooms.length, 'INVALID_PREVIOUS_LAYOUT', 'Duplicate saved room IDs.');
  requireThat(new Set(layout.paths.map(p => p.id)).size === layout.paths.length, 'INVALID_PREVIOUS_LAYOUT', 'Duplicate saved path IDs.');
  requireThat(layout.foyer.room_id === '__game_foyer__' && layout.foyer.width === 9 && layout.foyer.depth === 9, 'INVALID_PREVIOUS_LAYOUT', 'Invalid game-only foyer.');
  const obstacles = [layout.foyer, ...layout.rooms];
  for (const [i, r] of obstacles.entries()) {
    requireThat(r.width % 2 === 1 && r.depth % 2 === 1 && fits(r, layout.bounds), 'INVALID_PREVIOUS_LAYOUT', 'Saved room must be odd-sized and inside bounds.', [r.room_id]);
    for (const other of obstacles.slice(i + 1)) requireThat(!overlap(r, other), 'INVALID_PREVIOUS_LAYOUT', 'Saved rooms overlap or leave no exterior clearance.', [r.room_id, other.room_id]);
  }
  const rooms = new Map(layout.rooms.map(r => [r.room_id, r]));
  const forbidden = new Set(obstacles.flatMap(cells).map(key));
  let total = 0;
  for (const path of layout.paths) {
    const from = path.from === null ? layout.foyer : rooms.get(path.from), to = rooms.get(path.to);
    requireThat(from && to && path.id === edgeId(path.from, path.to), 'INVALID_PREVIOUS_LAYOUT', 'Saved path references missing endpoints.');
    requireThat(samePoint(path.tiles[0]!, porch(from)) && samePoint(path.tiles.at(-1)!, porch(to)), 'INVALID_PREVIOUS_LAYOUT', 'Saved path does not join exterior porches.');
    for (const [i, p] of path.tiles.entries()) {
      requireThat(inBounds(p, layout.bounds) && !forbidden.has(key(p)), 'INVALID_PREVIOUS_LAYOUT', 'Saved path crosses a room or world boundary.');
      if (i > 0) requireThat(Math.abs(p.x - path.tiles[i - 1]!.x) + Math.abs(p.z - path.tiles[i - 1]!.z) === 1, 'INVALID_PREVIOUS_LAYOUT', 'Saved path is discontinuous.');
    }
    total += path.tiles.length;
  }
  requireThat(total <= MAX_PATH_TILES, 'INPUT_LIMIT', 'Saved paths exceed the tile budget.');
  return layout;
}

/** Four-neighbor paths, reusable in Node and HERO. Never returns diagonal wall cuts. */
export function findTilePath(from: Point, to: Point, passable: (p: Point) => boolean): Point[] {
  if (!passable(from) || !passable(to)) return [];
  const result: Point[] = [];
  new Path.AStar(to.x, to.z, (x, z) => passable({ x, z }), { topology: 4 }).compute(from.x, from.z, (x, z) => result.push({ x, z }));
  return result;
}

export function makeLayout(graph: ProjectGraph, seed: number, previous: unknown, designer: DesignerProposal, requestedBounds?: Bounds): SavedLayout {
  const old = readPrevious(previous, graph, seed);
  const bounds = validBounds(requestedBounds ?? old?.bounds ?? DEFAULT_BOUNDS);
  if (old) requireThat((Object.keys(bounds) as (keyof Bounds)[]).every(k => bounds[k] === old.bounds[k]), 'BOUNDS_MISMATCH', 'Use the saved bounds or explicitly migrate the world.');
  const foyer: Placement = old?.foyer ?? { room_id: '__game_foyer__', x: -18, z: 0, width: 9, depth: 9, prefab: 'foyer', pinned: true };
  requireThat(fits(foyer, bounds), 'LAYOUT_UNSATISFIABLE', 'Bounds cannot contain the safe game-only foyer.');
  const rooms = old?.rooms ?? [];
  const currentIds = new Set(graph.features.map(r => r.id));
  for (const r of rooms) r.retired = !currentIds.has(r.room_id);
  const zoneOrder = old?.zone_order ?? [];
  for (const zone of graph.zones) if (!zoneOrder.includes(zone.id)) zoneOrder.push(zone.id);
  requireThat(zoneOrder.length <= MAX_ROOMS, 'INPUT_LIMIT', 'Persistent zone history exceeds the supported limit.');
  const saved = new Map(rooms.map(r => [r.room_id, r]));
  const features = new Map(graph.features.map(r => [r.id, r]));
  const paths = old?.paths ?? [];
  const reservedPath = paths.flatMap(p => p.tiles);
  for (const id of graph.topological_order) {
    if (saved.has(id)) continue;
    requireThat(rooms.length < MAX_ROOMS, 'INPUT_LIMIT', `Persistent room reservations, including retired rooms, cannot exceed ${MAX_ROOMS}.`);
    const feature = features.get(id)!;
    const salt = hash(JSON.stringify([GENERATOR_VERSION, graph.project.id, seed, id]));
    const width = 9 + 2 * (salt % 2), depth = 9 + 2 * ((salt >>> 1) % 2);
    const dependencies = feature.depends_on.map(dep => saved.get(dep)!);
    const target = { x: dependencies.length ? Math.max(...dependencies.map(d => d.x)) + 18 : 0, z: zoneOrder.indexOf(feature.zone_id) * 18 };
    const candidates: Point[] = [];
    for (let z = Math.ceil(bounds.min_z / 18) * 18; z <= bounds.max_z; z += 18)
      for (let x = Math.ceil(bounds.min_x / 18) * 18; x <= bounds.max_x; x += 18) candidates.push({ x, z });
    const score = (p: Point) => Math.abs(p.x - target.x) * 3 + Math.abs(p.z - target.z) * 2 + dependencies.reduce((sum, dep) => sum + Math.abs(p.x - dep.x) + Math.abs(p.z - dep.z), 0);
    candidates.sort((a, b) => score(a) - score(b) || hash(`${salt}:${key(a)}`) - hash(`${salt}:${key(b)}`) || a.z - b.z || a.x - b.x);
    const position = candidates.find(p => {
      const r = { ...p, width, depth, room_id: id };
      return fits(r, bounds) && ![foyer, ...rooms].some(other => overlap(r, other, 2)) && !reservedPath.some(t => inside(t, { ...r, width: width + 2, depth: depth + 2 }));
    });
    requireThat(position, 'LAYOUT_UNSATISFIABLE', `No free persistent room slot within bounds for ${id}. Existing rooms were not moved.`, [id]);
    const proposal = designer.rooms?.find(r => r.room_id === id);
    const prefab = proposal?.prefab ?? (feature.depends_on.length >= 2 ? 'boss-arena' : PREFABS[salt % 3]!);
    const room: RoomReservation = { room_id: id, ...position, width, depth, prefab, pinned: true, first_seen_revision: graph.revision, retired: false };
    rooms.push(room); saved.set(id, room);
  }
  const forbidden = new Set([foyer, ...rooms].flatMap(cells).map(key));
  const existingPaths = new Set(paths.map(p => p.id));
  const links = graph.features.flatMap<{ from: string | null; to: string }>(r => r.depends_on.length ? r.depends_on.map(from => ({ from, to: r.id })) : [{ from: null, to: r.id }]);
  links.sort((a, b) => compare(edgeId(a.from, a.to), edgeId(b.from, b.to)));
  let total = paths.reduce((n, p) => n + p.tiles.length, 0);
  for (const link of links) {
    const id = edgeId(link.from, link.to);
    if (existingPaths.has(id)) continue;
    const from = link.from === null ? foyer : saved.get(link.from)!;
    const tiles = findTilePath(porch(from), porch(saved.get(link.to)!), p => inBounds(p, bounds) && !forbidden.has(key(p)));
    requireThat(tiles.length, 'LAYOUT_UNSATISFIABLE', `No exterior corridor route for ${id}.`, [link.to]);
    total += tiles.length;
    requireThat(total <= MAX_PATH_TILES && paths.length < 2048, 'LAYOUT_LIMIT', 'Corridor budget exceeded; split the project or use larger-grained features.');
    paths.push({ id, ...link, tiles });
  }
  return { format_version: '1.0', generator_version: GENERATOR_VERSION, project_id: graph.project.id, seed, bounds, foyer, zone_order: zoneOrder, rooms: rooms.sort((a, b) => compare(a.room_id, b.room_id)), paths: paths.sort(byId) };
}

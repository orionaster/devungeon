import { buildGraph, checkBlueprint, readDesigner, readSnapshot } from './graph.js';
import { makeLayout } from './layout.js';
import { buildScene } from './scene.js';
import type { CompileOptions, CompileResult, ProjectGraph, WorldBlueprint } from './types.js';
import { GENERATOR_VERSION, GenerationError, requireThat } from './util.js';
export type * from './types.js';
export { createNavigator } from './navigation.js';
export { toHeroScene, type HeroScene } from './hero.js';
export { GENERATOR_VERSION } from './util.js';

/** No I/O, clock, global RNG, game state or acceptance-write capability. */
export function compileWorld(input: unknown, options: CompileOptions): CompileResult {
  let graph: ProjectGraph | null = null;
  try {
    requireThat(options && Number.isSafeInteger(options.seed), 'INVALID_SEED', 'A safe integer seed is required.');
    const snapshot = readSnapshot(input);
    graph = buildGraph(snapshot);
    const designer = readDesigner(options.designer, graph);
    const layout = makeLayout(graph, options.seed, options.previous, designer, options.bounds);
    const scene = buildScene(graph, layout, designer);
    const blueprint: WorldBlueprint = {
      schema_version: '1.0', project_id: graph.project.id, project_revision: graph.revision, seed: layout.seed,
      zones: graph.zones.map(z => {
        const proposal = designer.zones?.find(d => d.zone_id === z.id);
        return { id: z.id, theme: proposal?.theme ?? z.theme_hint ?? 'original stone dungeon', ...(proposal?.narrative ? { narrative: proposal.narrative } : {}) };
      }),
      rooms: scene.rooms.map(r => ({ room_id: r.room_id, x: r.x, z: r.z, width: r.width, depth: r.depth, prefab: r.prefab, pinned: true })),
      connections: graph.dependencies.map(d => ({ from_room_id: d.prerequisite, to_room_id: d.dependent, kind: 'gate' }))
    };
    checkBlueprint(blueprint);
    const previousRooms = (options.previous as { rooms?: { room_id: string; retired: boolean }[] } | undefined)?.rooms ?? [];
    const diagnostics = graph.features.filter(r => r.status === 'accepted' && !scene.rooms.find(p => p.room_id === r.id)!.lock.enterable).map(r => ({ code: 'ACCEPTED_WITH_UNMET_DEPENDENCIES', severity: 'warning' as const, message: `Room ${r.id} remains accepted in project truth but is locked by dependencies.`, entity_ids: [r.id] }));
    return { ok: true, world: {
      format_version: '1.0', generator_version: GENERATOR_VERSION, is_demo: graph.project.source.is_demo,
      blueprint, graph, scene, layout,
      changes: {
        added_room_ids: graph.features.filter(r => !previousRooms.some(p => p.room_id === r.id)).map(r => r.id),
        retired_room_ids: layout.rooms.filter(r => r.retired && previousRooms.some(p => p.room_id === r.room_id && !p.retired)).map(r => r.room_id),
        restored_room_ids: graph.features.filter(r => previousRooms.some(p => p.room_id === r.id && p.retired)).map(r => r.id)
      }, diagnostics
    } };
  } catch (error) {
    if (error instanceof GenerationError) return { ok: false, diagnostics: [error.diagnostic()], fallback_graph: graph };
    throw error; // Programmer faults are never disguised as a successful/fallback world.
  }
}

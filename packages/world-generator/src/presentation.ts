import type { CompiledWorld, Diagnostic, Evidence, Lock, Source, Status } from './types.js';
import type { HeroScene } from './hero.js';
import { requireThat } from './util.js';

/** Vocabulary only. WIZARD owns zh-CN/en-US catalogues and the one locale state.
 * UI locale never enters compileWorld, the semantic graph or saved layout.
 */
export const WORLD_MESSAGE_KEYS = [
  'world.foyer.name', 'world.foyer.reason', 'world.removed.name', 'world.removed.reason',
  'world.entry.open', 'world.entry.locked',
  'world.status.planned', 'world.status.ready', 'world.status.active', 'world.status.blocked',
  'world.status.review', 'world.status.accepted', 'world.status.failed', 'world.status.regressed',
  'world.status.archived', 'world.status.removed', 'world.status.gameOnly',
  'world.lock.statusNotAccepted', 'world.lock.dependencies',
  'world.prefab.stoneChamber', 'world.prefab.workshop', 'world.prefab.archive', 'world.prefab.bossArena',
  'world.theme.default', 'world.source.original', 'world.unknown.tasks', 'world.unknown.verification',
  'world.error.input', 'world.error.dependencies', 'world.error.layout', 'world.error.persistence',
  'world.error.design', 'world.error.compatibility', 'world.error.generic'
] as const;
export type WorldMessageKey = typeof WORLD_MESSAGE_KEYS[number];
export type WorldTranslationParams = Record<string, string | number>;
export type WorldTranslator = (key: WorldMessageKey, params?: WorldTranslationParams) => string;
export interface WorldMessage { key: WorldMessageKey; params?: Record<string, string | number | WorldMessage> }
export interface OriginalText { kind: 'original'; text: string }
export interface DesignText { kind: 'design'; text: string }
export type WorldName = OriginalText | DesignText | WorldMessage;
export interface WorldRoomDisplay {
  room_id: string; zone_id?: string; original_name?: string; name: WorldName;
  status: WorldMessage; entry: WorldMessage; reasons: WorldMessage[];
  evidence: Evidence[];
}
export interface WorldDisplay {
  project_id: string; project_revision: string; observed_at: string; source: Source;
  original_project_name: string; original_label: WorldMessage;
  zones: { zone_id: string; name: OriginalText; theme: WorldName; original_theme_hint?: string }[];
  rooms: WorldRoomDisplay[]; foyer: { name: WorldMessage; reason: WorldMessage };
  unknowns: WorldMessage[];
}
const message = (key: WorldMessageKey, params?: WorldMessage['params']): WorldMessage => ({ key, ...(params ? { params } : {}) });
export function statusMessage(status: Status | 'removed' | 'game-only'): WorldMessage {
  return message(status === 'game-only' ? 'world.status.gameOnly' : `world.status.${status}`);
}
export function lockMessages(lock: Pick<Lock, 'status' | 'unmet_dependencies'>): WorldMessage[] {
  if (lock.status === 'removed') return [message('world.removed.reason')];
  const reasons: WorldMessage[] = [];
  if (lock.status !== 'accepted') reasons.push(message('world.lock.statusNotAccepted', { status: statusMessage(lock.status) }));
  if (lock.unmet_dependencies.length) reasons.push(message('world.lock.dependencies', { ids: lock.unmet_dependencies.join(', ') }));
  return reasons;
}
/** Resolve only at render time with the shared WIZARD t(). No translations/I/O. */
export function renderWorldMessage(ref: WorldMessage, t: WorldTranslator): string {
  const params: WorldTranslationParams = {};
  for (const [key, value] of Object.entries(ref.params ?? {})) params[key] = typeof value === 'object' ? renderWorldMessage(value, t) : value;
  return t(ref.key, params);
}
export function renderWorldName(name: WorldName, t: WorldTranslator): string {
  return 'kind' in name ? name.text : renderWorldMessage(name, t);
}
export function describeWorld(world: CompiledWorld): WorldDisplay {
  const graph = world.graph;
  return {
    project_id: graph.project.id, project_revision: graph.revision, observed_at: graph.observed_at,
    source: structuredClone(graph.project.source), original_project_name: graph.project.name,
    original_label: message('world.source.original'),
    zones: graph.zones.map(z => {
      const theme = world.blueprint.zones.find(b => b.id === z.id)!.theme;
      return {
        zone_id: z.id, name: { kind: 'original', text: z.name },
        ...(z.theme_hint === undefined ? {} : { original_theme_hint: z.theme_hint }),
        theme: theme === z.theme_hint ? { kind: 'original', text: theme }
          : z.theme_hint === undefined && theme === 'original stone dungeon' ? message('world.theme.default')
          : { kind: 'design', text: theme }
      };
    }),
    rooms: world.scene.rooms.map<WorldRoomDisplay>(r => {
      const feature = graph.features.find(f => f.id === r.room_id)!;
      return { room_id: r.room_id, zone_id: r.zone_id, original_name: feature.name, name: { kind: r.title === feature.name ? 'original' : 'design', text: r.title }, status: statusMessage(feature.status), entry: message(r.lock.enterable ? 'world.entry.open' : 'world.entry.locked'), reasons: lockMessages(r.lock), evidence: structuredClone(feature.evidence) };
    }).concat(world.scene.tombstones.map<WorldRoomDisplay>(r => ({ room_id: r.room_id, name: message('world.removed.name'), status: statusMessage('removed'), entry: message('world.entry.locked'), reasons: [message('world.removed.reason')], evidence: [] }))),
    foyer: { name: message('world.foyer.name'), reason: message('world.foyer.reason') },
    unknowns: [message('world.unknown.tasks'), message('world.unknown.verification')]
  };
}
/** Engine scene stays stable while DOM text is translated. Not a scene rebuild. */
export function describeHeroRooms(world: CompiledWorld, scene: HeroScene): WorldRoomDisplay[] {
  requireThat(scene.project_context.project_id === world.graph.project.id && scene.project_context.project_revision === world.graph.revision, 'HERO_SCENE_MISMATCH', 'Display projection must use the same project and revision as its scene.');
  const display = describeWorld(world);
  return scene.rooms.map(r => {
    if (r.status === 'game-only') return { room_id: r.room_id, name: display.foyer.name, status: statusMessage('game-only'), entry: message('world.entry.open'), reasons: [display.foyer.reason], evidence: [] };
    const room = display.rooms.find(d => d.room_id === r.room_id);
    requireThat(room, 'HERO_SCENE_MISMATCH', 'A scene room has no corresponding source or tombstone.', [r.room_id]);
    return room;
  });
}
export function describeDiagnostic(diagnostic: Diagnostic) {
  let key: WorldMessageKey = 'world.error.generic';
  if (['INVALID_SNAPSHOT', 'INPUT_LIMIT', 'DUPLICATE_ID', 'DEMO_REQUIRED', 'UNVERIFIED_ACCEPTANCE', 'INVALID_SEED'].includes(diagnostic.code)) key = 'world.error.input';
  else if (['MISSING_ZONE', 'MISSING_DEPENDENCY', 'MISSING_AGENT_ROOM', 'DEPENDENCY_CYCLE', 'ACCEPTED_WITH_UNMET_DEPENDENCIES'].includes(diagnostic.code)) key = 'world.error.dependencies';
  else if (['INVALID_BOUNDS', 'LAYOUT_UNSATISFIABLE', 'LAYOUT_LIMIT', 'CORRIDOR_COLLISION', 'REACHABILITY_FAILED', 'INVALID_GEOMETRY', 'BLUEPRINT_INVALID', 'INVALID_PLAYER_POSITION'].includes(diagnostic.code)) key = 'world.error.layout';
  else if (['INVALID_PREVIOUS_LAYOUT', 'GENERATOR_VERSION_MISMATCH', 'PROJECT_MISMATCH', 'SEED_MISMATCH', 'BOUNDS_MISMATCH'].includes(diagnostic.code)) key = 'world.error.persistence';
  else if (['INVALID_DESIGNER', 'DESIGNER_UNKNOWN_ENTITY'].includes(diagnostic.code)) key = 'world.error.design';
  else if (['HERO_SCENE_LIMIT', 'HERO_SCENE_MISMATCH'].includes(diagnostic.code)) key = 'world.error.compatibility';
  return { code: diagnostic.code, severity: diagnostic.severity, summary: message(key, { code: diagnostic.code }), original_message: diagnostic.message, entity_ids: [...diagnostic.entity_ids ?? []] };
}

/** Types mirror root schema v1. Runtime inputs are always validated as unknown. */
export type Status = 'planned' | 'ready' | 'active' | 'blocked' | 'review' | 'accepted' | 'failed' | 'regressed' | 'archived';
export interface Source { kind: 'synthetic' | 'manual' | 'local' | 'github' | 'agent'; is_demo: boolean; reference?: string }
export interface Evidence { type: 'commit' | 'pull_request' | 'issue' | 'test' | 'deployment' | 'manual_review' | 'other'; ref: string; verification: 'verified' | 'unverified' | 'synthetic'; description?: string }
export interface Feature { id: string; zone_id: string; name: string; summary?: string; status: Status; depends_on: string[]; acceptance_criteria: string[]; evidence: Evidence[] }
export interface Zone { id: string; name: string; theme_hint?: string }
export interface Agent { id: string; name: string; role: 'supervisor' | 'worker' | 'reviewer'; status: 'idle' | 'working' | 'blocked' | 'awaiting_approval' | 'offline' | 'unknown'; room_id?: string; last_seen_at?: string; is_demo?: boolean }
export interface ProjectSnapshot { schema_version: '1.0'; project: { id: string; name: string; description?: string; source: Source }; revision: string; observed_at: string; zones: Zone[]; rooms: Feature[]; agents: Agent[] }
export interface Placement { room_id: string; x: number; z: number; width: number; depth: number; prefab?: string; pinned?: boolean }
export interface WorldBlueprint { schema_version: '1.0'; project_id: string; project_revision: string; seed: number; zones: { id: string; theme: string; narrative?: string }[]; rooms: Placement[]; connections: { from_room_id: string; to_room_id: string; kind: 'corridor' | 'gate' | 'portal' | 'stairs' }[] }
export interface Point { x: number; z: number }
export interface Bounds { min_x: number; max_x: number; min_z: number; max_z: number }
export type Prefab = 'stone-chamber' | 'workshop' | 'archive' | 'boss-arena';
export interface DesignerProposal { schema_version: '1.0'; zones?: { zone_id: string; theme: string; narrative?: string }[]; rooms?: { room_id: string; title?: string; narrative?: string; prefab?: Prefab }[] }
export interface Diagnostic { code: string; message: string; entity_ids?: string[]; severity: 'error' | 'warning' }
export interface ProjectGraph {
  project: ProjectSnapshot['project']; revision: string; observed_at: string;
  zones: Zone[]; features: Feature[]; agents: Agent[];
  dependencies: { prerequisite: string; dependent: string }[];
  topological_order: string[]; stages: { level: number; room_ids: string[] }[];
  unknowns: string[];
}
export interface RoomReservation extends Placement { prefab: Prefab; first_seen_revision: string; retired: boolean }
export interface PathReservation { id: string; from: string | null; to: string; tiles: Point[] }
export interface SavedLayout {
  format_version: '1.0'; generator_version: string; project_id: string; seed: number;
  bounds: Bounds; foyer: Placement; zone_order: string[]; rooms: RoomReservation[]; paths: PathReservation[];
}
export interface Lock { room_id: string; enterable: boolean; status: Status | 'removed'; reasons: string[]; unmet_dependencies: string[] }
export interface Tile extends Point { kind: 'floor' | 'wall' | 'door'; room_id?: string; variant: number }
export interface Collider { id: string; kind: 'wall' | 'locked-room' | 'locked-door'; center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; room_id?: string }
export interface SceneLayout {
  format_version: '1.0'; coordinates: { plane: 'xz'; up: '+y'; unit: 'tile'; tile_size: 1; room_anchor: 'center'; native_pixels_per_tile: 16; wall_height: 2; wall_depth: 1; camera_quarter_turns: number[] };
  foyer: Placement; spawn: Point; bounds: Bounds;
  tiles: Tile[]; colliders: Collider[];
  doors: { id: string; room_id: string; position: Point; outside: Point; locked: boolean; reasons: string[] }[];
  corridors: (PathReservation & { retired: boolean })[];
  rooms: (Placement & { zone_id: string; title: string; narrative?: string; lock: Lock; motif: string })[];
  tombstones: RoomReservation[];
  encounters: { id: string; room_id: string; kind: 'boss' | 'skirmish'; domain: 'game-only'; completion_effect: 'game-state-only'; position: Point }[];
  navigation: { walkable: Point[]; reachable_room_ids: string[] };
}
export interface CompiledWorld {
  format_version: '1.0'; generator_version: string; is_demo: boolean;
  blueprint: WorldBlueprint; graph: ProjectGraph; scene: SceneLayout; layout: SavedLayout;
  changes: { added_room_ids: string[]; retired_room_ids: string[]; restored_room_ids: string[] };
  diagnostics: Diagnostic[];
}
export type CompileResult = { ok: true; world: CompiledWorld } | { ok: false; diagnostics: Diagnostic[]; fallback_graph: ProjectGraph | null };
export interface CompileOptions { seed: number; previous?: unknown; designer?: unknown; bounds?: Bounds }

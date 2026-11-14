/** Renderer-neutral view contract. Project facts are never owned by GameState. */
export interface Vec2 {
  x: number;
  z: number;
}
export interface Rect extends Vec2 {
  width: number;
  depth: number;
}
export interface Room extends Rect {
  room_id: string;
  name: string;
  enterable: boolean;
  status: string;
  reason: string;
}
/** Axis is the direction across the doorway; width defaults to one tile. */
export interface SceneDoor extends Vec2 {
  room_id: string;
  axis: "x" | "z";
  locked: boolean;
  width?: number;
}
export interface SceneAgent extends Vec2 {
  agent_id: string;
  name: string;
  role: "builder" | "scout" | "wizard";
  room_id: string;
  visual_only?: boolean;
  source_role?: "supervisor" | "worker" | "reviewer" | "unknown";
  is_demo?: boolean;
  /** Optional pack-specific personal space; legacy/generated partners retain 0.42. */
  clearanceRadius?: number;
}
/** Game-only furniture footprint. IDs link to inspectable world objects, never commands. */
export interface SceneProp extends Rect {
  id: string;
  kind?: string;
}
export interface SceneDefinition {
  worldId: string;
  rooms: readonly Room[];
  corridors: readonly Rect[];
  spawn: Vec2;
  reward?: Vec2;
  doors?: readonly SceneDoor[];
  project_context?: {
    project_id: string;
    project_revision: string;
    observed_at: string;
    source: {
      kind: "synthetic" | "manual" | "local" | "github" | "agent";
      is_demo: boolean;
      reference?: string;
    };
  };
  obstacles: readonly (Rect & { kind: "pillar" | "crate" })[];
  props?: readonly SceneProp[];
  enemies: readonly (Vec2 & {
    id: string;
    kind: "slime" | "sentinel";
    activationRadius?: number;
  })[];
  agents: readonly SceneAgent[];
}
export interface Input {
  moveX: number;
  moveZ: number;
  attack: boolean;
  dodge: boolean;
  aim?: Vec2;
}
export interface Actor extends Vec2 {
  hp: number;
  maxHp: number;
  facing: Vec2;
  moving: boolean;
  hurt: number;
}
export interface Enemy extends Actor {
  id: string;
  kind: "slime" | "sentinel";
  state: "idle" | "chase" | "windup" | "strike" | "recover" | "dead";
  timer: number;
  attackDirection: Vec2;
}
export interface Projectile extends Vec2 {
  id: number;
  vx: number;
  vz: number;
  life: number;
}
export interface Effect extends Vec2 {
  id: number;
  kind: "hit" | "kill" | "dash" | "hurt" | "heal";
  life: number;
  maxLife: number;
  value?: number;
}
export interface GameSnapshot {
  time: number;
  phase: "ready" | "playing" | "won" | "lost";
  player: Actor;
  enemies: Enemy[];
  projectiles: Projectile[];
  effects: Effect[];
  attackTime: number;
  attackDirection: Vec2;
  dodgeTime: number;
  dodgeCooldown: number;
  kills: number;
  total: number;
  rewardClaimed: boolean;
  stats: {
    attacks: number;
    dodges: number;
    hitsTaken: number;
    damageDealt: number;
    blockedMoves: number;
  };
}
export interface Wall extends Rect {}
export interface Tile extends Vec2 {
  room_id?: string;
  locked: boolean;
}
export type AgentEventType =
  | "started"
  | "progress"
  | "tool_call"
  | "tested"
  | "blocked"
  | "review_requested"
  | "completed"
  | "failed"
  | "disconnected"
  | "command_result";
export interface AgentEvent {
  schema_version: "1.0";
  event_id: string;
  project_id: string;
  agent_id: string;
  room_id?: string;
  event_type: AgentEventType;
  occurred_at: string;
  observed_at: string;
  source: string;
  source_ref?: string;
  is_demo: boolean;
  message?: string;
}

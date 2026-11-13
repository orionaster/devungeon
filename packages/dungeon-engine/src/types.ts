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
export interface SceneDefinition {
  worldId: string;
  rooms: readonly Room[];
  corridors: readonly Rect[];
  spawn: Vec2;
  reward?: Vec2;
  obstacles: readonly (Rect & { kind: "pillar" | "crate" })[];
  enemies: readonly (Vec2 & { id: string; kind: "slime" | "sentinel" })[];
  agents: readonly (Vec2 & {
    agent_id: string;
    name: string;
    role: "builder" | "scout" | "wizard";
    room_id: string;
  })[];
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

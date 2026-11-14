import {
  AgentProjection,
  DEMO_SCENE,
  Dungeon,
  scenePlacements,
  type GameSnapshot,
  type Input,
  type Vec2,
  type SceneDefinition,
} from "../../../packages/dungeon-engine/src";
export interface CameraControl {
  heading: number;
  zoom: number;
  mode: "follow" | "overview" | "preview" | "free";
  target: Vec2;
  previewRoomId?: string;
}
export const keys = new Set<string>();
export const pointer: { down: boolean; aim?: Vec2 } = { down: false };
export const actions = { attack: false, dodge: false };
export const cameraControl: CameraControl = {
  heading: 0,
  zoom: 44,
  mode: "overview",
  target: { x: 3, z: 0 },
};
export const projection = new AgentProjection(
  "demo:ember-archive",
  DEMO_SCENE.agents.map((a) => a.agent_id),
);
export const runtime: {
  game?: Dungeon;
  frame?: GameSnapshot;
  paused: boolean;
  reducedEffects: boolean;
  onFrame?: (s: GameSnapshot) => void;
  selectAgent?: (id: string) => void;
  selectRoom?: (id: string) => void;
  agentEvents?: AgentProjection;
  displayScene?: SceneDefinition;
  presentation?: {
    camera: [number, number, number];
    focus: [number, number, number];
    rotation: [number, number, number, number];
    player: [number, number, number];
    screenPlayer: [number, number, number];
    markers?: { id: string; point: [number, number, number] }[];
  };
  metrics: {
    fps: number;
    p95Ms: number;
    worstMs: number;
    frames: number;
    drawCalls: number;
    triangles: number;
    renderer: string;
  };
} = {
  paused: false,
  reducedEffects: matchMedia("(prefers-reduced-motion: reduce)").matches,
  metrics: {
    fps: 0,
    p95Ms: 0,
    worstMs: 0,
    frames: 0,
    drawCalls: 0,
    triangles: 0,
    renderer: "",
  },
};
export function readInput(): Input {
  const x =
    Number(keys.has("KeyD") || keys.has("ArrowRight")) -
    Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const z =
    Number(keys.has("KeyS") || keys.has("ArrowDown")) -
    Number(keys.has("KeyW") || keys.has("ArrowUp"));
  const a = (cameraControl.heading * Math.PI) / 2;
  const input = {
    moveX: x * Math.cos(a) + z * Math.sin(a),
    moveZ: -x * Math.sin(a) + z * Math.cos(a),
    attack: keys.has("KeyJ") || pointer.down || actions.attack,
    dodge: actions.dodge,
    aim: pointer.down ? pointer.aim : undefined,
  };
  actions.attack = actions.dodge = false;
  return input;
}
export function clearInput() {
  keys.clear();
  pointer.down = false;
  pointer.aim = undefined;
  actions.attack = actions.dodge = false;
}
let sequence = 0;
const script = [
  ["demo-builder", "started", "Cinder is shaping a new doorway."],
  ["demo-scout", "tool_call", "Moss scouts the archive for missing evidence."],
  ["demo-wizard", "tested", "Lumen casts a synthetic verification spell."],
  [
    "demo-builder",
    "completed",
    "Doorway animation complete. No project acceptance changed.",
  ],
  [
    "demo-wizard",
    "blocked",
    "The vault still awaits real acceptance evidence.",
  ],
  ["demo-scout", "progress", "Moss returns with a DEMO field note."],
] as const;
export function tickDemo() {
  const [agent_id, event_type, message] = script[sequence % script.length];
  const now = new Date().toISOString();
  projection.ingest({
    schema_version: "1.0",
    event_id: `s1-demo-${sequence++}`,
    project_id: "demo:ember-archive",
    agent_id,
    event_type,
    occurred_at: now,
    observed_at: now,
    source: "synthetic:s1-script",
    source_ref: "apps/web/src/runtime.ts",
    is_demo: true,
    message,
  });
}
declare global {
  interface Window {
    __DEVUNGEON__?: {
      snapshot: () => GameSnapshot | undefined;
      metrics: () => typeof runtime.metrics;
      access: () => readonly {
        id: string;
        enterable: boolean;
        status: string;
      }[];
      events: () => ReturnType<AgentProjection["snapshot"]>;
      camera: () => CameraControl;
      scene: () => SceneDefinition;
      presentation: () => typeof runtime.presentation;
      placements: () => ReturnType<typeof scenePlacements>;
    };
  }
}
// Read-only diagnostics for reviewer verification. No teleport, damage or acceptance setters.
window.__DEVUNGEON__ = {
  snapshot: () => runtime.game?.snapshot(),
  metrics: () => ({ ...runtime.metrics }),
  access: () =>
    (runtime.game?.scene ?? DEMO_SCENE).rooms.map((r) => ({
      id: r.room_id,
      enterable: r.enterable,
      status: r.status,
    })),
  events: () => (runtime.agentEvents ?? projection).snapshot(),
  camera: () => structuredClone(cameraControl),
  scene: () =>
    structuredClone(runtime.displayScene ?? runtime.game?.scene ?? DEMO_SCENE),
  presentation: () => structuredClone(runtime.presentation),
  placements: () =>
    structuredClone(
      scenePlacements(
        runtime.displayScene ?? runtime.game?.scene ?? DEMO_SCENE,
      ),
    ),
};

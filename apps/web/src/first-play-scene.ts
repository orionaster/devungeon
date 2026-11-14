import type { SceneDefinition } from "../../../packages/dungeon-engine/src";

/** Hand-authored game-pack sample. These room IDs never stand for accepted
 * software. Feature evidence lives in feature-sample, not in collision/access. */
export const FIRST_PLAY_SCENE: SceneDefinition = {
  worldId: "pixel-dungeon:first-play-observatory:v1",
  project_context: {
    project_id: "github:orionaster/devungeon",
    project_revision: "d945eacd8b81e745228296e6d8178c4014e79d5d",
    observed_at: "2026-11-14T08:00:00.000Z",
    source: {
      kind: "manual",
      is_demo: false,
      reference: "https://github.com/orionaster/devungeon/pull/15",
    },
  },
  rooms: [
    {
      room_id: "game-only:observatory",
      name: "Starlit Observatory",
      x: 0,
      z: 0,
      width: 14,
      depth: 12,
      enterable: true,
      status: "gameOnly",
      reason:
        "Playable art sample for public project observation. Feature acceptance remains unknown.",
    },
    {
      room_id: "game-only:future-alcove",
      name: "Uncharted annex",
      x: 10,
      z: 0,
      width: 4,
      depth: 6,
      enterable: false,
      status: "planned · DEMO",
      reason:
        "Game-only sealed annex. Combat cannot provide software acceptance or unlock project work.",
    },
  ],
  corridors: [{ x: 7.5, z: 0, width: 1, depth: 2 }],
  doors: [
    {
      room_id: "game-only:future-alcove",
      x: 8,
      z: 0,
      axis: "z",
      width: 2,
      locked: true,
    },
  ],
  spawn: { x: -1, z: 3.5 },
  reward: { x: -4, z: 2 },
  obstacles: [],
  props: [
    { id: "source-desk", kind: "desk", x: -3, z: -2, width: 2, depth: 1 },
    {
      id: "evidence-cabinet",
      kind: "cabinet",
      x: 3,
      z: -3,
      width: 1.5,
      depth: 1,
    },
    { id: "test-bench", kind: "bench", x: 3, z: 2, width: 2, depth: 1 },
  ],
  enemies: [
    {
      id: "game-only:training-a",
      kind: "slime",
      x: 4.7,
      z: 4,
      activationRadius: 3.2,
    },
    {
      id: "game-only:training-b",
      kind: "slime",
      x: 5,
      z: 0,
      activationRadius: 3.2,
    },
  ],
  agents: [
    {
      agent_id: "demo:sample-scout",
      name: "Moss",
      role: "scout",
      source_role: "worker",
      x: -1,
      z: -2,
      room_id: "game-only:observatory",
      is_demo: true,
      clearanceRadius: 0.9,
    },
  ],
};

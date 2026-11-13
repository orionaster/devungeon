import type { Rect, SceneDefinition, Tile, Vec2, Wall } from "./types";
export const inside = (p: Vec2, r: Rect, margin = 0) =>
  Math.abs(p.x - r.x) < r.width / 2 - margin &&
  Math.abs(p.z - r.z) < r.depth / 2 - margin;
export function validateScene(s: SceneDefinition) {
  if (!s.worldId || !s.rooms.length || s.rooms.length > 128)
    throw Error("Scene needs 1–128 rooms");
  if (
    s.corridors.length > 512 ||
    s.obstacles.length > 256 ||
    s.enemies.length > 64 ||
    s.agents.length > 64
  )
    throw Error("Scene exceeds S1 actor/geometry budget");
  const ids = new Set<string>();
  for (const r of s.rooms) {
    if (ids.has(r.room_id) || typeof r.room_id !== "string" || !r.room_id)
      throw Error("Room IDs must be unique");
    if (typeof r.enterable !== "boolean")
      throw Error("Room access must be an explicit boolean");
    ids.add(r.room_id);
  }
  for (const r of [...s.rooms, ...s.corridors, ...s.obstacles])
    if (
      ![r.x, r.z, r.width, r.depth].every(Number.isFinite) ||
      r.width <= 0 ||
      r.depth <= 0 ||
      r.width > 128 ||
      r.depth > 128 ||
      Math.abs(r.x) > 512 ||
      Math.abs(r.z) > 512
    )
      throw Error("Invalid scene rectangle");
  const floors = [...s.rooms, ...s.corridors];
  for (const r of floors)
    if (
      ![
        r.x - r.width / 2,
        r.x + r.width / 2,
        r.z - r.depth / 2,
        r.z + r.depth / 2,
      ].every(Number.isInteger)
    )
      throw Error("Floor rectangles must align with integer tile boundaries");
  if (floors.reduce((n, r) => n + r.width * r.depth, 0) > 32768)
    throw Error("Scene exceeds S1 tile budget");
  for (const entries of [
    s.enemies.map((e) => e.id),
    s.agents.map((a) => a.agent_id),
  ])
    if (new Set(entries).size !== entries.length || entries.some((id) => !id))
      throw Error("Actor IDs must be unique");
  if (
    s.reward &&
    (![s.reward.x, s.reward.z].every(Number.isFinite) ||
      !isWalkable(s, s.reward, 0.4))
  )
    throw Error("Reward outside walkable scene");
  if (
    ![s.spawn.x, s.spawn.z].every(Number.isFinite) ||
    !isWalkable(s, s.spawn, 0.4)
  )
    throw Error("Spawn must be in an enterable room");
  if (!s.rooms.some((r) => r.enterable && inside(s.spawn, r, 0.4)))
    throw Error("Spawn must be in an enterable room");
  for (const a of [...s.agents, ...s.enemies])
    if (![a.x, a.z].every(Number.isFinite) || !isWalkable(s, a, 0.35))
      throw Error("Actor outside walkable scene");
}
export function isWalkable(s: SceneDefinition, p: Vec2, margin = 0) {
  if (
    s.rooms.some(
      (r) =>
        !r.enterable &&
        inside(p, {
          ...r,
          width: r.width + margin * 2,
          depth: r.depth + margin * 2,
        }),
    )
  )
    return false;
  if (
    s.obstacles.some((r) =>
      inside(p, {
        ...r,
        width: r.width + margin * 2,
        depth: r.depth + margin * 2,
      }),
    )
  )
    return false;
  return [...s.rooms.filter((r) => r.enterable), ...s.corridors].some((r) =>
    inside(p, r, margin),
  );
}
/** Geometry is derived from the union of room/corridor tiles, never from combat. */
export function geometry(s: SceneDefinition): { tiles: Tile[]; walls: Wall[] } {
  const map = new Map<string, Tile>();
  for (const r of [...s.rooms, ...s.corridors])
    for (let x = Math.floor(r.x - r.width / 2); x < r.x + r.width / 2; x++)
      for (let z = Math.floor(r.z - r.depth / 2); z < r.z + r.depth / 2; z++) {
        if (!inside({ x: x + 0.5, z: z + 0.5 }, r)) continue;
        const room = s.rooms.find((a) => inside({ x: x + 0.5, z: z + 0.5 }, a));
        map.set(`${x},${z}`, {
          x: x + 0.5,
          z: z + 0.5,
          room_id: room?.room_id,
          locked: room ? !room.enterable : false,
        });
      }
  const walls: Wall[] = [];
  for (const t of map.values())
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!map.has(`${t.x - 0.5 + dx},${t.z - 0.5 + dz}`))
        walls.push({
          x: t.x + dx * 0.5,
          z: t.z + dz * 0.5,
          width: dx ? 0.22 : 1.22,
          depth: dz ? 0.22 : 1.22,
        });
    }
  return { tiles: [...map.values()], walls };
}
export interface Blueprint {
  schema_version: "1.0";
  project_id: string;
  project_revision: string;
  seed: number;
  rooms: readonly {
    room_id: string;
    x: number;
    z: number;
    width: number;
    depth: number;
  }[];
  connections: readonly {
    from_room_id: string;
    to_room_id: string;
    kind: string;
  }[];
}
/** Fail closed: missing access denies entry; caller supplies validated corridor geometry. */
export function sceneFromBlueprint(
  b: Blueprint,
  access: readonly {
    room_id: string;
    enterable: boolean;
    reason: string;
    status: string;
  }[],
  corridors: readonly Rect[],
  spawn: Vec2,
): SceneDefinition {
  if (b.schema_version !== "1.0") throw Error("Unsupported blueprint version");
  const scene: SceneDefinition = {
    worldId: `${b.project_id}:${b.project_revision}`,
    rooms: b.rooms.map((r) => ({
      ...r,
      name: r.room_id,
      ...(access.find((a) => a.room_id === r.room_id) ?? {
        enterable: false,
        reason: "Access evidence unavailable",
        status: "unknown",
      }),
    })),
    corridors,
    spawn,
    obstacles: [],
    enemies: [],
    agents: [],
  };
  validateScene(scene);
  return scene;
}

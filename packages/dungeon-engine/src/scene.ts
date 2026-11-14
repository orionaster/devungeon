import type {
  Rect,
  SceneDefinition,
  SceneDoor,
  Tile,
  Vec2,
  Wall,
  SceneAgent,
} from "./types";
export function doorRect(door: SceneDoor): Rect {
  return {
    x: door.x,
    z: door.z,
    width: door.axis === "x" ? (door.width ?? 1) : 0.22,
    depth: door.axis === "z" ? (door.width ?? 1) : 0.22,
  };
}
/** Explicit compiler placement wins; inference is retained only for legacy S1 scenes. */
export function visibleDoorSeals(s: SceneDefinition): readonly SceneDoor[] {
  if (s.doors !== undefined) return s.doors.filter((d) => d.locked);
  return s.rooms
    .filter((r) => !r.enterable)
    .map((room) => {
      const nearest = [...s.corridors].sort(
        (a, b) =>
          Math.hypot(a.x - room.x, a.z - room.z) -
          Math.hypot(b.x - room.x, b.z - room.z),
      )[0];
      const horizontal =
        !nearest ||
        Math.abs(nearest.x - room.x) >= Math.abs(nearest.z - room.z);
      return {
        room_id: room.room_id,
        x: horizontal
          ? room.x +
            (Math.sign((nearest?.x ?? room.x - 1) - room.x) * room.width) / 2
          : room.x,
        z: horizontal
          ? room.z
          : room.z + (Math.sign(nearest!.z - room.z) * room.depth) / 2,
        axis: horizontal ? "z" : "x",
        width: 4,
        locked: true,
      };
    });
}
export const inside = (p: Vec2, r: Rect, margin = 0) =>
  Math.abs(p.x - r.x) < r.width / 2 - margin &&
  Math.abs(p.z - r.z) < r.depth / 2 - margin;
export const agentClearanceRadius = (agent: SceneAgent) =>
  agent.clearanceRadius ?? 0.42;
export function validateScene(s: SceneDefinition) {
  if (!s.worldId || !s.rooms.length || s.rooms.length > 128)
    throw Error("Scene needs 1–128 rooms");
  if (
    s.corridors.length > 512 ||
    s.obstacles.length + (s.props?.length ?? 0) > 256 ||
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
  if (
    new Set(s.props?.map((p) => p.id)).size !== (s.props?.length ?? 0) ||
    s.props?.some((p) => typeof p.id !== "string" || !p.id)
  )
    throw Error("Prop IDs must be unique");
  for (const r of [
    ...s.rooms,
    ...s.corridors,
    ...s.obstacles,
    ...(s.props ?? []),
  ])
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
  if ((s.doors?.length ?? 0) > 512) throw Error("Scene exceeds S1 door budget");
  for (const d of s.doors ?? []) {
    if (
      !ids.has(d.room_id) ||
      ![d.x, d.z, d.width ?? 1].every(Number.isFinite) ||
      Math.abs(d.x) > 512 ||
      Math.abs(d.z) > 512 ||
      !["x", "z"].includes(d.axis) ||
      typeof d.locked !== "boolean" ||
      (d.width ?? 1) < 0.6 ||
      (d.width ?? 1) > 16
    )
      throw Error("Invalid scene door");
    if (!d.locked && !s.rooms.find((r) => r.room_id === d.room_id)!.enterable)
      throw Error("A closed room cannot advertise an unlocked door");
  }
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
  for (const a of s.enemies)
    if (
      ![a.x, a.z].every(Number.isFinite) ||
      !isWalkable(s, a, 0.35) ||
      (a.activationRadius !== undefined &&
        (!Number.isFinite(a.activationRadius) ||
          a.activationRadius < 0.5 ||
          a.activationRadius > 14))
    )
      throw Error("Actor outside walkable scene");
  for (const a of s.agents) {
    const room = s.rooms.find((r) => r.room_id === a.room_id);
    if (
      !room ||
      ![a.x, a.z].every(Number.isFinite) ||
      !["builder", "scout", "wizard"].includes(a.role) ||
      (a.visual_only !== undefined && typeof a.visual_only !== "boolean") ||
      (a.is_demo !== undefined && typeof a.is_demo !== "boolean") ||
      (a.clearanceRadius !== undefined &&
        (!Number.isFinite(a.clearanceRadius) ||
          a.clearanceRadius < 0.25 ||
          a.clearanceRadius > 1.5))
    )
      throw Error("Invalid scene agent");
    if (a.visual_only ? !inside(a, room, 0.15) : !isWalkable(s, a, 0.35))
      throw Error("Agent outside its permitted scene area");
  }
  if (s.project_context) {
    const p = s.project_context;
    if (
      typeof p.project_id !== "string" ||
      !p.project_id ||
      typeof p.project_revision !== "string" ||
      !p.project_revision ||
      typeof p.observed_at !== "string" ||
      !Number.isFinite(Date.parse(p.observed_at)) ||
      !p.source ||
      !["synthetic", "manual", "local", "github", "agent"].includes(
        p.source.kind,
      ) ||
      typeof p.source.is_demo !== "boolean"
    )
      throw Error("Invalid project context");
  }
}
export function isWalkable(s: SceneDefinition, p: Vec2, margin = 0) {
  if (
    (s.doors ?? []).some(
      (d) =>
        d.locked &&
        inside(p, {
          ...doorRect(d),
          width: doorRect(d).width + 2 * margin,
          depth: doorRect(d).depth + 2 * margin,
        }),
    )
  )
    return false;
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
    [...s.obstacles, ...(s.props ?? [])].some((r) =>
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
/** A shared deterministic ground plan keeps NPC feet and decorative rewards apart.
 * It only changes presentation/game occupancy; room IDs, access and evidence remain intact.
 */
export function scenePlacements(s: SceneDefinition): {
  agents: SceneAgent[];
  chests: (Vec2 & { room_id: string })[];
  torches: Vec2[];
} {
  const occupied: Rect[] = [
    ...s.obstacles,
    ...(s.props ?? []),
    { ...s.spawn, width: 1.2, depth: 1.2 },
    ...(s.reward ? [{ ...s.reward, width: 1.2, depth: 1.2 }] : []),
    ...s.enemies.map((e) => ({ ...e, width: 1, depth: 1 })),
  ];
  const free = (p: Vec2, radius: number) =>
    !occupied.some(
      (r) =>
        Math.abs(p.x - r.x) < r.width / 2 + radius &&
        Math.abs(p.z - r.z) < r.depth / 2 + radius,
    );
  const reserve = (p: Vec2, radius: number) =>
    occupied.push({
      ...p,
      width: radius * 2,
      depth: radius * 2,
    });
  const candidates = (room: Rect) => {
    const result: Vec2[] = [];
    for (
      let z = room.z - room.depth / 2 + 1;
      z <= room.z + room.depth / 2 - 1;
      z++
    )
      for (
        let x = room.x - room.width / 2 + 1;
        x <= room.x + room.width / 2 - 1;
        x++
      )
        result.push({ x, z });
    return result;
  };
  const placed = new Map<string, SceneAgent>();
  for (const a of [...s.agents].sort((a, b) =>
    a.agent_id.localeCompare(b.agent_id),
  )) {
    const room = s.rooms.find((r) => r.room_id === a.room_id);
    if (!room) continue; // validateScene remains the authority for invalid contracts.
    const radius = Math.max(0.6, agentClearanceRadius(a));
    const suitable = (p: Vec2) =>
      inside(p, room, Math.max(0.7, radius + 0.1)) &&
      free(p, radius) &&
      ![...s.obstacles, ...(s.props ?? [])].some((r) =>
        inside(p, {
          ...r,
          width: r.width + radius * 2,
          depth: r.depth + radius * 2,
        }),
      );
    const p = suitable(a)
      ? a
      : (candidates(room)
          .sort(
            (p, q) =>
              Math.hypot(p.x - a.x, p.z - a.z) -
              Math.hypot(q.x - a.x, q.z - a.z),
          )
          .find(suitable) ?? a);
    reserve(p, radius);
    placed.set(a.agent_id, { ...a, x: p.x, z: p.z });
  }
  const chests: (Vec2 & { room_id: string })[] = [];
  for (const room of s.rooms.filter((r) => !r.enterable)) {
    const p = candidates(room).find((p) => free(p, 0.7));
    if (p) {
      reserve(p, 0.7);
      chests.push({ ...p, room_id: room.room_id });
    }
  }
  const torches: Vec2[] = [];
  for (const room of s.rooms) {
    for (const p of [
      { x: room.x - room.width / 2 + 0.8, z: room.z - room.depth / 2 + 0.8 },
      { x: room.x + room.width / 2 - 0.8, z: room.z + room.depth / 2 - 0.8 },
    ]) {
      if (!free(p, 0.4)) continue;
      reserve(p, 0.4);
      torches.push(p);
    }
  }
  return {
    agents: s.agents.map((a) => placed.get(a.agent_id) ?? a),
    chests,
    torches,
  };
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

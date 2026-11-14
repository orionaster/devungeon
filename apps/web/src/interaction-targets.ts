import {
  scenePlacements,
  type SceneDefinition,
  type Vec2,
} from "../../../packages/dungeon-engine/src";

export interface InteractionTarget extends Vec2 {
  id: string;
  kind: "agent" | "object" | "room";
  cueHeight: number;
}

/** Presentation-only discoverability; no command, movement or source-write port. */
export function interactionTargets(
  scene: SceneDefinition,
): readonly InteractionTarget[] {
  return [
    ...scenePlacements(scene).agents.map((a) => ({
      id: a.agent_id,
      kind: "agent" as const,
      x: a.x,
      z: a.z,
      cueHeight: 2.2,
    })),
    ...(scene.props ?? []).map((p) => ({
      id: p.id,
      kind: "object" as const,
      x: p.x,
      z: p.z,
      cueHeight: p.kind === "desk" ? 1.15 : 1.85,
    })),
    ...scene.rooms
      .filter((r) => !r.enterable)
      .map((r) => {
        const door = scene.doors?.find((d) => d.room_id === r.room_id);
        return {
          id: r.room_id,
          kind: "room" as const,
          x: door?.x ?? r.x,
          z: door?.z ?? r.z,
          cueHeight: 2.1,
        };
      }),
  ];
}

/** Hysteresis keeps a nearby pair of objects from alternating the prompt while
 * the player stands on their distance boundary. Selection never moves actors. */
export function nearestInteraction(
  targets: readonly InteractionTarget[],
  player: Vec2,
  previousId?: string | null,
): InteractionTarget | undefined {
  const distance = (target: InteractionTarget) =>
    Math.hypot(target.x - player.x, target.z - player.z);
  const nearest = targets
    .filter((t) => distance(t) <= 2.25)
    .sort((a, b) => distance(a) - distance(b))[0];
  const previous = targets.find((t) => t.id === previousId);
  if (
    previous &&
    distance(previous) <= 2.6 &&
    (!nearest || distance(nearest) + 0.35 >= distance(previous))
  )
    return previous;
  return nearest;
}

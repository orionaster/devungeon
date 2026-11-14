import { describe, expect, test } from "vitest";
import { FIRST_PLAY_SCENE } from "../src/first-play-scene";
import {
  interactionTargets,
  nearestInteraction,
} from "../src/interaction-targets";

describe("calm interaction discovery", () => {
  test("all five targets retain identity; the sealed room is reachable from its door", () => {
    const targets = interactionTargets(FIRST_PLAY_SCENE);
    expect(new Set(targets.map((t) => t.id)).size).toBe(5);
    expect(nearestInteraction(targets, { x: 7.59, z: 0 })?.id).toBe(
      "game-only:future-alcove",
    );
    expect(
      FIRST_PLAY_SCENE.rooms.find(
        (r) => r.room_id === "game-only:future-alcove",
      )?.enterable,
    ).toBe(false);
  });
  test("a paired station keeps its prompt through small distance changes, then releases it", () => {
    const targets = [
      { id: "a", kind: "object" as const, x: -1, z: 0, cueHeight: 1 },
      { id: "b", kind: "object" as const, x: 1, z: 0, cueHeight: 1 },
    ];
    expect(nearestInteraction(targets, { x: 0.05, z: 0 }, "a")?.id).toBe("a");
    expect(nearestInteraction(targets, { x: 0.8, z: 0 }, "a")?.id).toBe("b");
    expect(nearestInteraction(targets, { x: 10, z: 10 }, "a")).toBeUndefined();
  });
});

import { describe, expect, test } from "vitest";
import {
  CharacterAnimator,
  cameraFacing,
  NATIVE_FACING_COLUMN,
  type CharacterAnimationSample,
} from "../src/character-animation";

function sample(
  time: number,
  x = 0,
  z = 0,
  changes: Partial<CharacterAnimationSample> = {},
): CharacterAnimationSample {
  return {
    time,
    actor: {
      x,
      z,
      hp: 100,
      maxHp: 100,
      moving: true,
      facing: { x: -1, z: 0 },
      hurt: 0,
    },
    attackTime: 0,
    dodgeTime: 0,
    attackDirection: { x: -1, z: 0 },
    ...changes,
  };
}

describe("native first-play character presentation", () => {
  test("directional columns match the inspected authored down/up/left/right sheets", () => {
    const world = [
      { x: 0, z: 1 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
      { x: 1, z: 0 },
    ];
    expect(
      world.map(
        (vector) => NATIVE_FACING_COLUMN[cameraFacing(vector, 0, "front")],
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  test("walk frames depend on travelled distance rather than the dungeon's starting clock", () => {
    const frames = [17.06, 811.31].map((start) => {
      const animator = new CharacterAnimator();
      animator.update(sample(start), 0);
      return [0.1, 0.2, 0.3, 0.4].map((distance, i) =>
        animator.update(sample(start + (i + 1) / 60, distance), 0),
      );
    });
    expect(frames[0]).toEqual(frames[1]);
  });

  test("normal and low frame budgets end on the same leg phase along the same path", () => {
    const run = (hz: number) => {
      const animator = new CharacterAnimator();
      animator.update(sample(0), 0);
      let result;
      for (let frame = 1; frame <= hz; frame++)
        result = animator.update(sample(frame / hz, (1.2 * frame) / hz), 0);
      return result;
    };
    expect(run(60)).toEqual(run(20));
  });

  test("walking follows actual travel, attacks follow aim, and recovery returns to travel", () => {
    const animator = new CharacterAnimator();
    animator.update(sample(0), 0);
    expect(animator.update(sample(0.02, 0.1), 0).facing).toBe("right");
    expect(
      animator.update(sample(0.04, 0.2, 0, { attackTime: 0.23 }), 0),
    ).toMatchObject({ pose: "attack", frame: 0, facing: "left" });
    expect(animator.update(sample(0.27, 0.3), 0)).toMatchObject({
      pose: "move",
      facing: "right",
    });
  });

  test("diagonal numerical noise cannot chatter directions; an opposite turn stays responsive", () => {
    let direction = cameraFacing({ x: 1, z: 0 }, 0, "front");
    for (const delta of [-0.00001, 0.00001, -0.00002, 0.00002])
      direction = cameraFacing({ x: 1, z: 1 + delta }, 0, direction);
    expect(direction).toBe("right");
    expect(cameraFacing({ x: -1, z: 0 }, 0, direction)).toBe("left");
    expect(cameraFacing({ x: 0, z: 1 }, Math.PI / 2, "front")).toBe("left");
  });

  test("a blocked actor settles, a paused actor freezes, and restart resets presentation", () => {
    const animator = new CharacterAnimator();
    animator.update(sample(0), 0);
    animator.update(sample(0.02, 0.1), 0);
    const settled = animator.update(sample(0.2, 0.1), 0);
    expect(settled.pose).toBe("idle");
    expect(animator.update(sample(0.2, 0.1), 0)).toEqual(settled);
    expect(animator.update(sample(0), 0)).toMatchObject({
      pose: "idle",
      frame: 0,
    });
  });

  test("dodge uses all three authored frames without a repeated out-of-range fourth pose", () => {
    const animator = new CharacterAnimator();
    animator.update(sample(0), 0);
    const frames = [0.2, 0.13, 0.06, 0.001].map(
      (remaining, i) =>
        animator.update(
          sample(0.02 + i * 0.06, 0.1 + i * 0.1, 0, { dodgeTime: remaining }),
          0,
        ).frame,
    );
    expect(frames).toEqual([0, 1, 2, 2]);
  });
});

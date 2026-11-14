import type { SpriteFacing } from "./art";
import type { Actor, Vec2 } from "../../../packages/dungeon-engine/src";

export type CharacterPose =
  | "idle"
  | "move"
  | "attack"
  | "dodge"
  | "hurt"
  | "dead";
export interface CharacterAnimationSample {
  time: number;
  actor: Actor;
  attackTime: number;
  dodgeTime: number;
  attackDirection: Vec2;
}
export interface CharacterAnimationFrame {
  pose: CharacterPose;
  frame: number;
  facing: SpriteFacing;
}

/** Native Ninja Adventure order: down, up, left, right. */
export const NATIVE_FACING_COLUMN: Record<SpriteFacing, number> = {
  front: 0,
  back: 1,
  left: 2,
  right: 3,
};

/** Four authored directions, with a small diagonal deadband. Rapid reversals
 * still turn immediately; floating-point diagonal noise cannot flip the atlas. */
export function cameraFacing(
  world: Vec2,
  yaw: number,
  previous: SpriteFacing,
): SpriteFacing {
  const x = world.x * Math.cos(yaw) - world.z * Math.sin(yaw);
  const z = world.x * Math.sin(yaw) + world.z * Math.cos(yaw);
  if (Math.hypot(x, z) < 0.00001) return previous;
  const horizontal = previous === "left" || previous === "right";
  if (
    horizontal
      ? Math.abs(z) <= Math.abs(x) * 1.18
      : Math.abs(x) > Math.abs(z) * 1.18
  )
    return x >= 0 ? "right" : "left";
  return z >= 0 ? "front" : "back";
}

/** Presentation only. World distance drives the walk phase; active-state time
 * drives rest/recovery, and authoritative ability timers drive action frames.
 * This class never changes movement, physics, aim, or game/work state. */
export class CharacterAnimator {
  private previous?: { time: number; x: number; z: number };
  private pose: CharacterPose = "idle";
  private poseStarted = 0;
  private lastMoved = -Infinity;
  private walkDistance = 0;
  private worldFacing: Vec2 = { x: 1, z: 0 };
  private dodgeFacing: Vec2 = { x: 1, z: 0 };
  private facing: SpriteFacing = "right";

  update(
    sample: CharacterAnimationSample,
    cameraYaw: number,
  ): CharacterAnimationFrame {
    const { actor, time } = sample;
    const reset = !this.previous || time < this.previous.time;
    if (reset) {
      this.previous = { time, x: actor.x, z: actor.z };
      this.poseStarted = time;
      this.lastMoved = -Infinity;
      this.walkDistance = 0;
      this.worldFacing = { ...actor.facing };
      this.pose = "idle";
    }
    const previous = this.previous!;
    const dx = actor.x - previous.x,
      dz = actor.z - previous.z;
    const distance = Math.hypot(dx, dz);
    const travelling = actor.moving && distance > 0.00001;
    const wasResting = time - this.lastMoved > 0.18;
    if (travelling) {
      // Lead with an actual step rather than sliding in a neutral pose. Brief
      // stops and directional changes retain the same leg phase.
      if (wasResting) this.walkDistance = 1.7 / 4;
      if (sample.dodgeTime <= 0) this.walkDistance += distance;
      this.lastMoved = time;
    }
    const walking =
      actor.moving && (travelling || time - this.lastMoved < 0.05);
    const next: CharacterPose =
      actor.hp <= 0
        ? "dead"
        : actor.hurt > 0
          ? "hurt"
          : sample.dodgeTime > 0
            ? "dodge"
            : sample.attackTime > 0
              ? "attack"
              : walking
                ? "move"
                : "idle";
    if (next !== this.pose) {
      this.poseStarted = time;
      if (next === "dodge")
        this.dodgeFacing = travelling
          ? { x: dx / distance, z: dz / distance }
          : { ...actor.facing };
      this.pose = next;
    }
    if (next === "attack") this.worldFacing = { ...sample.attackDirection };
    else if (next === "dodge") this.worldFacing = this.dodgeFacing;
    else if (next === "move" && travelling)
      this.worldFacing = { x: dx / distance, z: dz / distance };
    // An idle avatar keeps its last deliberate direction instead of swivelling
    // after combat auto-aim while the player is simply standing still.
    this.facing = cameraFacing(this.worldFacing, cameraYaw, this.facing);
    const age = Math.max(0, time - this.poseStarted);
    const frame =
      next === "move"
        ? Math.floor((this.walkDistance / 1.7) * 4) % 4
        : next === "attack"
          ? Math.min(
              3,
              Math.max(0, Math.floor((1 - sample.attackTime / 0.23) * 4)),
            )
          : next === "dodge"
            ? Math.min(
                2,
                Math.max(0, Math.floor((1 - sample.dodgeTime / 0.2) * 3)),
              )
            : next === "hurt" || next === "dead"
              ? Math.min(1, Math.floor(age * 12))
              : Math.floor(age * 4) % 4;
    this.previous = { time, x: actor.x, z: actor.z };
    return { pose: next, frame, facing: this.facing };
  }
}

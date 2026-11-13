import type RAPIER from "@dimforge/rapier3d-compat";
import { doorRect, geometry, inside, isWalkable, validateScene } from "./scene";
import type {
  Actor,
  GameSnapshot,
  Input,
  SceneDefinition,
  Vec2,
} from "./types";
let initialized: Promise<void> | undefined;
let rapier: typeof RAPIER;
const length = (v: Vec2) => Math.hypot(v.x, v.z);
const normalized = (v: Vec2): Vec2 => {
  const l = length(v) || 1;
  return { x: v.x / l, z: v.z / l };
};
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
function freezeTree<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
const actor = (p: Vec2, hp: number): Actor => ({
  ...p,
  hp,
  maxHp: hp,
  facing: { x: 1, z: 0 },
  moving: false,
  hurt: 0,
});
export class Dungeon {
  readonly scene: SceneDefinition;
  private world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private playerCollider: RAPIER.Collider;
  private enemyColliders = new Map<string, RAPIER.Collider>();
  private state!: GameSnapshot;
  private accumulator = 0;
  private attackCooldown = 0;
  private invincible = 0;
  private dashDirection: Vec2 = { x: 1, z: 0 };
  private id = 0;
  private attackQueued = false;
  private dodgeQueued = false;
  private constructor(scene: SceneDefinition) {
    validateScene(scene);
    this.scene = freezeTree(structuredClone(scene));
    this.world = new rapier.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = 1 / 60;
    for (const w of [
      ...geometry(scene).walls,
      ...scene.obstacles,
      ...scene.rooms.filter((r) => !r.enterable),
      ...(scene.doors ?? []).filter((d) => d.locked).map(doorRect),
    ])
      this.world.createCollider(
        rapier.ColliderDesc.cuboid(w.width / 2, 2, w.depth / 2).setTranslation(
          w.x,
          1,
          w.z,
        ),
      );
    this.controller = this.world.createCharacterController(0.015);
    this.controller.setSlideEnabled(true);
    this.playerCollider = this.world.createCollider(
      rapier.ColliderDesc.ball(0.28).setTranslation(
        scene.spawn.x,
        0.5,
        scene.spawn.z,
      ),
    );
    for (const e of scene.enemies)
      this.enemyColliders.set(
        e.id,
        this.world.createCollider(
          rapier.ColliderDesc.ball(
            e.kind === "sentinel" ? 0.35 : 0.29,
          ).setTranslation(e.x, 0.5, e.z),
        ),
      );
    this.restart();
  }
  static async create(scene: SceneDefinition) {
    await (initialized ??= import("@dimforge/rapier3d-compat").then(
      async (module) => {
        rapier = module.default;
        await rapier.init();
      },
    ));
    return new Dungeon(scene);
  }
  /** Defensive snapshot: inspector consumers cannot modify gameplay or source data. */
  snapshot(): GameSnapshot {
    return structuredClone(this.state);
  }
  start() {
    if (this.state.phase === "ready") this.state.phase = "playing";
  }
  restart() {
    this.state = {
      time: 0,
      phase: "ready",
      player: actor(this.scene.spawn, 100),
      enemies: this.scene.enemies.map((e) => ({
        ...actor(e, e.kind === "sentinel" ? 90 : 55),
        id: e.id,
        kind: e.kind,
        state: "idle",
        timer: 0,
        attackDirection: { x: 0, z: 0 },
      })),
      projectiles: [],
      effects: [],
      attackTime: 0,
      attackDirection: { x: 1, z: 0 },
      dodgeTime: 0,
      dodgeCooldown: 0,
      kills: 0,
      total: this.scene.enemies.length,
      rewardClaimed: false,
      stats: {
        attacks: 0,
        dodges: 0,
        hitsTaken: 0,
        damageDealt: 0,
        blockedMoves: 0,
      },
    };
    this.attackCooldown = this.invincible = this.accumulator = 0;
    this.attackQueued = this.dodgeQueued = false;
    this.playerCollider.setTranslation({
      x: this.state.player.x,
      y: 0.5,
      z: this.state.player.z,
    });
    for (const e of this.state.enemies)
      this.enemyColliders.get(e.id)!.setTranslation({ x: e.x, y: 0.5, z: e.z });
    this.world.step();
  }
  step(input: Input, dt: number) {
    if (this.state.phase !== "playing" && this.state.phase !== "won") return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(input.moveX) || !Number.isFinite(input.moveZ)) return;
    this.attackQueued ||= input.attack;
    this.dodgeQueued ||= input.dodge;
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.tick(input, 1 / 60);
      this.accumulator -= 1 / 60;
    }
  }
  private effect(
    kind: "hit" | "kill" | "dash" | "hurt" | "heal",
    p: Vec2,
    life: number,
    value?: number,
  ) {
    this.state.effects.push({
      x: p.x,
      z: p.z,
      id: ++this.id,
      kind,
      life,
      maxLife: life,
      value,
    });
    this.state.effects = this.state.effects.slice(-80);
  }
  private move(a: Actor, c: RAPIER.Collider, delta: Vec2) {
    // Every collider movement is swept, including a high-speed dodge. Dynamic actors don't snag each other.
    this.controller.computeColliderMovement(
      c,
      { x: delta.x, y: 0, z: delta.z },
      undefined,
      undefined,
      (other) =>
        other.handle !== this.playerCollider.handle &&
        ![...this.enemyColliders.values()].some(
          (ec) => ec.handle === other.handle,
        ),
    );
    const m = this.controller.computedMovement();
    const next = { x: a.x + m.x, z: a.z + m.z };
    // Independent semantic guard: camera/respawn/physics never grant room access.
    if (
      this.scene.rooms.some(
        (r) =>
          !r.enterable &&
          inside(next, { ...r, width: r.width + 0.55, depth: r.depth + 0.55 }),
      )
    )
      return;
    a.x = next.x;
    a.z = next.z;
    c.setTranslation({ x: a.x, y: 0.5, z: a.z });
    if (
      a === this.state.player &&
      Math.hypot(m.x - delta.x, m.z - delta.z) > 0.02
    )
      this.state.stats.blockedMoves++;
  }
  private tick(input: Input, dt: number) {
    const s = this.state,
      p = s.player;
    s.time += dt;
    this.world.step();
    s.attackTime = Math.max(0, s.attackTime - dt);
    s.dodgeTime = Math.max(0, s.dodgeTime - dt);
    s.dodgeCooldown = Math.max(0, s.dodgeCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    s.effects = s.effects.filter((e) => (e.life -= dt) > 0);
    const movement = normalized({ x: input.moveX, z: input.moveZ });
    p.moving = length(movement) > 0;
    const nearest = s.enemies
      .filter((e) => e.hp > 0 && distance(e, p) < 5)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    const aim =
      input.aim && Number.isFinite(input.aim.x) && Number.isFinite(input.aim.z)
        ? normalized({ x: input.aim.x - p.x, z: input.aim.z - p.z })
        : nearest
          ? normalized({ x: nearest.x - p.x, z: nearest.z - p.z })
          : p.moving
            ? movement
            : p.facing;
    if (length(aim) > 0) p.facing = aim;
    if (this.dodgeQueued && s.dodgeCooldown <= 0) {
      this.dodgeQueued = false;
      s.dodgeTime = 0.2;
      s.dodgeCooldown = 0.85;
      this.invincible = 0.25;
      this.dashDirection = p.moving ? movement : p.facing;
      s.stats.dodges++;
      this.effect("dash", p, 0.25);
    }
    this.dodgeQueued = false;
    this.move(p, this.playerCollider, {
      x: (s.dodgeTime > 0 ? this.dashDirection.x * 15 : movement.x * 4.3) * dt,
      z: (s.dodgeTime > 0 ? this.dashDirection.z * 15 : movement.z * 4.3) * dt,
    });
    if (
      (this.attackQueued || input.attack) &&
      this.attackCooldown <= 0 &&
      s.dodgeTime <= 0
    ) {
      this.attackCooldown = 0.32;
      s.attackTime = 0.23;
      s.attackDirection = { ...p.facing };
      s.stats.attacks++;
      for (const e of s.enemies) {
        const d = distance(e, p),
          dir = normalized({ x: e.x - p.x, z: e.z - p.z });
        if (
          e.hp > 0 &&
          d < 2.25 &&
          dir.x * p.facing.x + dir.z * p.facing.z > -0.1 &&
          this.lineOfSight(p, e)
        ) {
          const damage = Math.min(e.hp, 30);
          e.hp -= damage;
          e.hurt = 0.18;
          s.stats.damageDealt += damage;
          this.effect("hit", e, 0.45, damage);
          this.move(e, this.enemyColliders.get(e.id)!, {
            x: dir.x * 0.35,
            z: dir.z * 0.35,
          });
          if (e.hp <= 0) {
            e.state = "dead";
            s.kills++;
            this.effect("kill", e, 0.7);
            this.enemyColliders
              .get(e.id)!
              .setTranslation({ x: 1000, y: 0, z: 1000 });
          }
        }
      }
    }
    this.attackQueued = false;
    if (s.phase === "won") {
      if (
        !s.rewardClaimed &&
        distance(p, this.scene.reward ?? this.scene.spawn) < 1.4
      ) {
        s.rewardClaimed = true;
        p.hp = Math.min(100, p.hp + 30);
        this.effect("heal", p, 0.7, 30);
      }
      return;
    }
    for (const e of s.enemies) {
      e.hurt = Math.max(0, e.hurt - dt);
      e.timer -= dt;
      e.moving = false;
      if (e.hp <= 0) continue;
      const origin = this.scene.enemies.find((a) => a.id === e.id)!;
      const encounterRoom = this.scene.rooms.find(
        (r) => r.enterable && inside(origin, r),
      );
      const d = distance(e, p);
      if (!encounterRoom || !inside(p, encounterRoom) || d > 14) {
        e.state = "idle";
        continue;
      }
      const dir = normalized({ x: p.x - e.x, z: p.z - e.z });
      e.facing = dir;
      if (e.state === "idle") e.state = "chase";
      if (e.state === "chase") {
        if (d < (e.kind === "sentinel" ? 7 : 1.7) && this.lineOfSight(e, p)) {
          e.state = "windup";
          e.timer = e.kind === "sentinel" ? 0.8 : 0.55;
          e.attackDirection = dir;
        } else {
          e.moving = true;
          this.move(e, this.enemyColliders.get(e.id)!, {
            x: dir.x * 1.65 * dt,
            z: dir.z * 1.65 * dt,
          });
        }
      } else if (e.state === "windup" && e.timer <= 0) {
        e.state = "strike";
        e.timer = 0.23;
        if (e.kind === "sentinel")
          for (const angle of [-0.2, 0, 0.2]) {
            const a =
              Math.atan2(e.attackDirection.z, e.attackDirection.x) + angle;
            if (s.projectiles.length < 96)
              s.projectiles.push({
                id: ++this.id,
                x: e.x,
                z: e.z,
                vx: Math.cos(a) * 5,
                vz: Math.sin(a) * 5,
                life: 3,
              });
          }
      } else if (e.state === "strike") {
        if (e.kind === "slime") {
          this.move(e, this.enemyColliders.get(e.id)!, {
            x: e.attackDirection.x * 6.3 * dt,
            z: e.attackDirection.z * 6.3 * dt,
          });
          if (distance(e, p) < 0.85) this.hurt(16, e);
        }
        if (e.timer <= 0) {
          e.state = "recover";
          e.timer = 0.85;
        }
      } else if (e.state === "recover" && e.timer <= 0) e.state = "chase";
    }
    s.projectiles = s.projectiles.filter((b) => {
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.life <= 0 || !isWalkable(this.scene, b, 0.05)) return false;
      if (distance(b, p) < 0.5) {
        this.hurt(12, b);
        return false;
      }
      return true;
    });
    if (p.hp <= 0) {
      s.phase = "lost";
      s.projectiles = [];
    } else if (s.kills === s.total) {
      s.phase = "won";
      s.projectiles = [];
      this.effect("heal", this.scene.reward ?? this.scene.spawn, 1);
    }
  }
  private lineOfSight(a: Vec2, b: Vec2) {
    const steps = Math.ceil(distance(a, b) * 8);
    for (let i = 1; i < steps; i++)
      if (
        !isWalkable(this.scene, {
          x: a.x + ((b.x - a.x) * i) / steps,
          z: a.z + ((b.z - a.z) * i) / steps,
        })
      )
        return false;
    return true;
  }
  private hurt(amount: number, from: Vec2) {
    if (this.invincible > 0 || this.state.phase !== "playing") return;
    const p = this.state.player;
    p.hp = Math.max(0, p.hp - amount);
    p.hurt = 0.25;
    this.invincible = 0.75;
    this.state.stats.hitsTaken++;
    this.effect("hurt", p, 0.5, amount);
    const d = normalized({ x: p.x - from.x, z: p.z - from.z });
    this.move(p, this.playerCollider, { x: d.x * 0.3, z: d.z * 0.3 });
  }
  dispose() {
    this.world.free();
  }
}

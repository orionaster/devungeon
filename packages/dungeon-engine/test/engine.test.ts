import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Dungeon,
  DEMO_SCENE,
  AgentProjection,
  sceneFromBlueprint,
  visibleDoorSeals,
  type Input,
  type SceneDefinition,
} from "../src/index";
const input = (x = 0, z = 0, attack = false, dodge = false): Input => ({
  moveX: x,
  moveZ: z,
  attack,
  dodge,
});
const tick = (g: Dungeon, i: Input, n = 60) => {
  for (let k = 0; k < n; k++) g.step(i, 1 / 60);
};
const scene = (changes: Partial<SceneDefinition> = {}) => ({
  ...structuredClone(DEMO_SCENE),
  ...changes,
});
test("swept wall and locked-room collisions survive walking, repeated dodges, corners and restart", async () => {
  const g = await Dungeon.create(scene({ enemies: [], spawn: { x: 8, z: 0 } }));
  g.start();
  tick(g, input(1, 0, false, true), 1200);
  assert.ok(g.snapshot().player.x < 11.75, "seal cannot be crossed");
  for (let i = 0; i < 1200; i++)
    g.step(input(1, Math.sin(i * 0.17), false, i % 5 === 0), 1 / 60);
  const p = g.snapshot().player;
  assert.ok(p.x < 11.75);
  assert.ok(Math.abs(p.z) < 6.3);
  g.restart();
  assert.deepEqual(
    { x: g.snapshot().player.x, z: g.snapshot().player.z },
    { x: 8, z: 0 },
  );
  g.start();
  tick(g, input(-1, -1, false, true), 600);
  assert.ok(g.snapshot().player.z > -6);
  g.dispose();
});
test("attack hits, defeats encounter and returns only a game result; source facts survive win/restart", async () => {
  const s = scene({
    spawn: { x: 1, z: 0 },
    enemies: [{ id: "test", kind: "slime", x: 2, z: 0 }],
  });
  const original = JSON.stringify(s);
  const g = await Dungeon.create(s);
  g.start();
  tick(g, input(0, 0, true), 150);
  const result = g.snapshot();
  assert.equal(result.phase, "won");
  assert.equal(result.kills, 1);
  assert.ok(result.stats.damageDealt >= 55);
  assert.equal(JSON.stringify(s), original);
  assert.equal(s.rooms.find((r) => r.room_id === "vault")!.enterable, false);
  result.player.hp = 0;
  assert.notEqual(g.snapshot().player.hp, 0, "snapshots cannot mutate engine");
  g.restart();
  assert.equal(g.snapshot().phase, "ready");
  assert.equal(JSON.stringify(s), original);
  g.dispose();
});
test("enemy tells lead to damage, defeat and restart without source mutation", async () => {
  const s = scene({
    spawn: { x: 1, z: 0 },
    enemies: [{ id: "test", kind: "sentinel", x: 3, z: 0 }],
  });
  const original = JSON.stringify(s);
  const g = await Dungeon.create(s);
  g.start();
  tick(g, input(), 3600);
  assert.equal(g.snapshot().phase, "lost");
  assert.ok(g.snapshot().stats.hitsTaken > 0);
  assert.equal(JSON.stringify(s), original);
  g.restart();
  assert.equal(g.snapshot().player.hp, 100);
  g.dispose();
});
test("dodge grants brief protection and actual displacement without tunneling", async () => {
  const g = await Dungeon.create(scene({ spawn: { x: 3, z: 0 }, enemies: [] }));
  g.start();
  g.step(input(1, 0, false, true), 1 / 60);
  assert.equal(g.snapshot().stats.dodges, 1);
  assert.ok(g.snapshot().dodgeTime > 0);
  assert.ok(g.snapshot().player.x > 3.2);
  tick(g, input(1), 60);
  assert.equal(g.snapshot().dodgeTime, 0);
  g.dispose();
});
test("spawn and blueprint access fail closed, invalid rectangles are rejected", async () => {
  await assert.rejects(
    Dungeon.create(scene({ spawn: { x: 17, z: 0 } })),
    /Spawn/,
  );
  await assert.rejects(
    Dungeon.create(scene({ rooms: [{ ...DEMO_SCENE.rooms[0], width: NaN }] })),
    /rectangle/,
  );
  assert.throws(
    () =>
      sceneFromBlueprint(
        {
          schema_version: "1.0",
          project_id: "p",
          project_revision: "r",
          seed: 1,
          rooms: [{ room_id: "a", x: 0, z: 0, width: 8, depth: 8 }],
          connections: [],
        },
        [],
        [],
        { x: 0, z: 0 },
      ),
    /Spawn/,
  );
});
test("scene ownership and tile-grid validation prevent mutable respawn and missing walls", async () => {
  const source = scene();
  const g = await Dungeon.create(source);
  assert.throws(() => {
    g.scene.spawn.x = 17;
  }, TypeError);
  source.spawn.x = 17;
  g.restart();
  assert.equal(g.snapshot().player.x, -8);
  g.dispose();
  await assert.rejects(
    Dungeon.create(
      scene({
        rooms: [{ ...DEMO_SCENE.rooms[0], x: 0, z: 0, width: 0.9, depth: 0.9 }],
        spawn: { x: 0, z: 0 },
        enemies: [],
        agents: [],
      }),
    ),
    /tile boundaries/,
  );
});
test("event projection rejects malformed/cross-project/duplicate, keeps chronology and bounds history", () => {
  const p = new AgentProjection("p", ["a"]);
  const event = {
    schema_version: "1.0",
    event_id: "e",
    project_id: "p",
    agent_id: "a",
    event_type: "started",
    occurred_at: "2026-11-13T00:00:01Z",
    observed_at: "2026-11-13T00:00:01Z",
    source: "synthetic:test",
    is_demo: true,
    message: "Demo",
  };
  assert.equal(p.ingest({}), false);
  assert.equal(p.ingest({ ...event, source_ref: () => "bad" }), false);
  assert.equal(p.ingest({ ...event, observed_at: 1 }), false);
  assert.equal(p.ingest({ ...event, room_id: { id: "bad" } }), false);
  assert.equal(p.ingest({ ...event, project_id: "else" }), false);
  assert.equal(p.ingest(event), true);
  assert.equal(p.ingest(event), false);
  assert.equal(
    p.ingest({
      ...event,
      event_id: "older",
      occurred_at: "2026-11-13T00:00:00Z",
    }),
    true,
  );
  assert.equal(p.actor("a").event?.event_id, "e");
  assert.equal(p.actor("a", Date.parse("2026-11-13T01:00:00Z")).stale, true);
  for (let i = 0; i < 500; i++) p.ingest({ ...event, event_id: String(i) });
  assert.equal(p.snapshot().length, 100);
  const copy = p.snapshot();
  copy[0].is_demo = false;
  assert.equal(p.snapshot()[0].is_demo, true);
});
test("explicit compiler doors override guessed positions and independently block dashes", async () => {
  const definition = scene({
    enemies: [],
    spawn: { x: 1, z: 0 },
    reward: { x: 1, z: 0 },
    doors: [
      { room_id: "arena", x: 3, z: 0, axis: "z", width: 12, locked: true },
      { room_id: "vault", x: 17, z: 5, axis: "x", locked: true },
    ],
  });
  assert.deepEqual(visibleDoorSeals(definition), definition.doors);
  const g = await Dungeon.create(definition);
  g.start();
  tick(g, input(1, 0, false, true), 600);
  assert.ok(
    g.snapshot().player.x < 2.7,
    "door collider blocks even when destination room is enterable",
  );
  g.dispose();
  await assert.rejects(
    Dungeon.create(
      scene({
        doors: [{ room_id: "unknown", x: 0, z: 0, axis: "x", locked: true }],
      }),
    ),
    /scene door/,
  );
  await assert.rejects(
    Dungeon.create(
      scene({
        doors: [{ room_id: "vault", x: 12, z: 0, axis: "z", locked: false }],
      }),
    ),
    /advertise an unlocked door/,
  );
});
test("visual-only NPC in a known locked room grants no player access", async () => {
  const marker = {
    ...DEMO_SCENE.agents[0],
    room_id: "vault",
    x: 17,
    z: 0,
    visual_only: true,
    is_demo: true,
    source_role: "worker" as const,
  };
  const g = await Dungeon.create(
    scene({ spawn: { x: 8, z: 0 }, enemies: [], agents: [marker] }),
  );
  g.start();
  tick(g, input(1, 0, false, true), 300);
  assert.ok(g.snapshot().player.x < 11.75);
  g.dispose();
  await assert.rejects(
    Dungeon.create(scene({ agents: [{ ...marker, visual_only: false }] })),
    /Agent outside/,
  );
  await assert.rejects(
    Dungeon.create(scene({ agents: [{ ...marker, x: 3 }] })),
    /Agent outside/,
  );
});

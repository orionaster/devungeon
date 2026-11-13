import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createProjectWorldStore,
  DEMO_EXTENSION_ID,
  DEMO_PROJECTS,
  type ProjectWorld,
  type ProjectWorldResult,
} from "../src/project-worlds";

function successful(value: ProjectWorldResult): ProjectWorld {
  assert.equal(value.ok, true, JSON.stringify(value));
  if (!value.ok) throw new Error("Expected a compiled project world");
  return value;
}

test("canonical inputs retain distinct topology, source Agent identities and evidence", () => {
  const store = createProjectWorldStore();
  const tiny = successful(store.getBySelection("tiny"));
  const workbench = successful(store.getBySelection("workbench"));
  assert.deepEqual([tiny.world.graph.features.length, tiny.world.graph.dependencies.length], [3, 2]);
  assert.deepEqual([workbench.world.graph.features.length, workbench.world.graph.dependencies.length], [8, 9]);
  assert.notDeepEqual(tiny.world.layout, workbench.world.layout);
  for (const value of [tiny, workbench]) {
    assert.deepEqual(value.scene.agents.map((agent) => agent.agent_id).sort(), value.snapshot.agents.map((agent) => agent.id).sort());
    assert.ok(value.scene.agents.every((agent) => agent.is_demo && agent.visual_only));
    assert.ok(value.scene.enemies.length > 0);
    for (const feature of value.snapshot.rooms) {
      assert.deepEqual(value.roomDisplay.find((room) => room.room_id === feature.id)!.evidence, feature.evidence);
      assert.equal(value.scene.rooms.find((room) => room.room_id === feature.id)!.enterable, feature.status === "accepted");
    }
    assert.ok(Object.isFrozen(value.snapshot.rooms[0]!.evidence));
  }
});

test("unchanged revision/facts preserve scene identity despite polling clock and source order", () => {
  const store = createProjectWorldStore();
  const first = successful(store.getBySelection("workbench"));
  const observedAgain = structuredClone(first.snapshot);
  observedAgain.observed_at = "2026-11-14T01:02:03Z";
  observedAgain.rooms.reverse();
  observedAgain.agents.reverse();
  observedAgain.zones.reverse();
  for (const room of observedAgain.rooms) room.depends_on.reverse();
  assert.equal(store.compile(observedAgain), first);
  assert.equal(store.getBySelection("workbench"), first);
});

test("incremental DEMO update pins old rooms/corridors and never changes existing truth", () => {
  const store = createProjectWorldStore();
  const first = successful(store.getBySelection("tiny"));
  const next = successful(store.addDemoFeature(first.snapshot.project.id));
  assert.notEqual(next.scene, first.scene);
  assert.equal(next.snapshot.project.id, first.snapshot.project.id);
  assert.deepEqual(next.world.changes.added_room_ids, [DEMO_EXTENSION_ID]);
  for (const room of first.world.layout.rooms) assert.deepEqual(next.world.layout.rooms.find((candidate) => candidate.room_id === room.room_id), room);
  for (const path of first.world.layout.paths) assert.deepEqual(next.world.layout.paths.find((candidate) => candidate.id === path.id), path);
  assert.deepEqual(next.snapshot.rooms.filter((room) => room.id !== DEMO_EXTENSION_ID), first.snapshot.rooms);
  assert.equal(next.scene.rooms.find((room) => room.room_id === DEMO_EXTENSION_ID)!.enterable, false);
  assert.equal(next.scene.doors.find((door) => door.room_id === DEMO_EXTENSION_ID)!.locked, true);
  assert.equal(store.addDemoFeature(first.snapshot.project.id), next);
  successful(store.getBySelection("workbench"));
  assert.equal(store.getBySelection("tiny"), next);
  assert.equal(DEMO_PROJECTS[0].snapshot.rooms.length, 3);
});

test("real public input cannot use the DEMO mutation or inherit synthetic actors/acceptance", () => {
  const input = structuredClone(DEMO_PROJECTS[0].snapshot);
  input.project.id = "github:orionaster/devungeon";
  input.project.source = { kind: "github", is_demo: false, reference: "https://github.com/orionaster/devungeon" };
  input.agents = [];
  for (const room of input.rooms) { room.status = "planned"; room.evidence = []; }
  const store = createProjectWorldStore();
  const before = successful(store.compile(input));
  const rejected = store.addDemoFeature(input.project.id);
  assert.equal(rejected.ok, false);
  if (rejected.ok) throw new Error("Expected denial");
  assert.equal(rejected.diagnostics[0]!.code, "DEMO_PROJECT_REQUIRED");
  assert.equal(store.get(input.project.id), before);
  assert.equal(before.scene.agents.length, 0);
  assert.ok(before.scene.rooms.filter((room) => room.status !== "game-only").every((room) => !room.enterable));
  assert.deepEqual(input, before.snapshot);
});

test("malformed refresh yields factual failure without replacing last valid project", () => {
  const store = createProjectWorldStore();
  const before = successful(store.getBySelection("tiny"));
  const invalid = { ...structuredClone(before.snapshot), revision: "broken", rooms: [] };
  const result = store.compile(invalid);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected invalid input");
  assert.equal(result.fallback_graph, null);
  assert.equal(result.diagnostics[0]!.code, "INVALID_SNAPSHOT");
  assert.equal(store.get(before.snapshot.project.id), before);
});

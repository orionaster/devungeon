import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { DEMO_PROJECTS } from "../src/project-worlds";
import {
  FeatureSampleStore,
  OBSERVATORY_FEATURE,
  SAMPLE_AGENT_ID,
  SAMPLE_PROJECT_ID,
  SAMPLE_ROOM_ID,
  resolveSampleActivity,
  type SampleActivity,
} from "../src/feature-sample";

afterEach(() => {
  vi.useRealTimers();
});

function publicSnapshot() {
  const snapshot = structuredClone(DEMO_PROJECTS[0].snapshot);
  snapshot.project.id = SAMPLE_PROJECT_ID;
  snapshot.project.source = {
    kind: "github",
    is_demo: false,
    reference: "https://github.com/orionaster/devungeon",
  };
  snapshot.agents = [];
  for (const room of snapshot.rooms) {
    room.status = "ready";
    room.evidence = [
      {
        type: "issue",
        verification: "unverified",
        ref: "https://github.com/orionaster/devungeon/issues/17",
        description: "Original evidence, not acceptance.",
      },
    ];
  }
  return snapshot;
}
function response(snapshot: unknown = publicSnapshot(), mode = "LIVE") {
  return new Response(
    JSON.stringify({
      schema_version: "1.0",
      connection: {
        mode,
        reason: "ok",
        last_success_at: new Date().toISOString(),
        checked_at: new Date().toISOString(),
        retry_at: null,
      },
      snapshot,
    }),
    { status: 200 },
  );
}
function activity(patch: Partial<SampleActivity> = {}): SampleActivity {
  return {
    event_id: "demo:event:1",
    project_id: SAMPLE_PROJECT_ID,
    room_id: SAMPLE_ROOM_ID,
    agent_id: SAMPLE_AGENT_ID,
    actor_kind: "demo-agent",
    task_id: "demo:task:scan",
    station_id: "source-desk",
    kind: "scan",
    phase: "running",
    mode: "DEMO",
    is_demo: true,
    source_ref: "demo://devungeon/observatory/scan/1",
    started_at: "2026-11-14T01:00:00.000Z",
    observed_at: "2026-11-14T01:00:00.000Z",
    expires_at: "2026-11-14T01:00:06.500Z",
    confidence: "explicit",
    ...patch,
  };
}
const now = Date.parse("2026-11-14T01:00:01.000Z");

test("authored capability representation links actual implementation without granting product acceptance", () => {
  assert.equal(
    OBSERVATORY_FEATURE.feature_id,
    "devungeon.public-project-observation",
  );
  assert.equal(OBSERVATORY_FEATURE.project_id, SAMPLE_PROJECT_ID);
  assert.equal(OBSERVATORY_FEATURE.acceptance, "unknown");
  assert.equal(OBSERVATORY_FEATURE.access, "game-only");
  assert.deepEqual(
    OBSERVATORY_FEATURE.objects.map((object) => object.object_id),
    ["source-desk", "evidence-cabinet", "test-bench"],
  );
  assert.equal(
    new Set(OBSERVATORY_FEATURE.objects.map((object) => object.purpose)).size,
    3,
  );
});

test("task-specific projection requires explicit identity, station, lifecycle and fresh mode", () => {
  assert.equal(
    resolveSampleActivity(activity(), SAMPLE_AGENT_ID, now)?.kind,
    "scan",
  );
  assert.equal(
    resolveSampleActivity(activity(), "source-desk", now)?.agent_id,
    SAMPLE_AGENT_ID,
  );
  for (const patch of [
    { mode: "REPLAY" },
    { mode: "STALE" },
    { mode: "DISCONNECTED" },
    { mode: "LIVE" },
    { project_id: "foreign" },
    { room_id: "foreign" },
    { agent_id: "unknown-provider" },
    { task_id: "" },
    { station_id: "test-bench" },
    { kind: "unknown" },
    { is_demo: false },
    { started_at: "2026-11-14T01:00:02.000Z" },
    { observed_at: "2026-11-14T01:00:02.000Z" },
    { observed_at: "2026-11-14T00:59:59.000Z" },
    { expires_at: "2026-11-14T01:00:00.500Z" },
    { expires_at: "2026-11-14T01:01:00.000Z" },
    { phase: "completed" },
    { phase: "failed" },
    { ended_at: "2026-11-14T01:00:00.900Z" },
    { confidence: "guessed-from-message" },
    { actor_kind: "local-program" },
    { source_ref: "https://example.com/unattributable-event" },
  ])
    assert.equal(
      resolveSampleActivity({ ...activity(), ...patch }, SAMPLE_AGENT_ID, now),
      undefined,
      JSON.stringify(patch),
    );
  assert.equal(
    resolveSampleActivity(activity(), "unrelated-agent", now),
    undefined,
  );
  const read = activity({
    agent_id: "local-public-observer",
    actor_kind: "local-program",
    kind: "read",
    mode: "LIVE",
    is_demo: false,
    source_ref: "/scout-read/v1/snapshot",
  });
  assert.equal(resolveSampleActivity(read, "source-desk", now)?.kind, "read");
  assert.equal(resolveSampleActivity(read, SAMPLE_AGENT_ID, now), undefined);
});

test("one DEMO actor executes distinct bounded scan/test tasks, never a historical replay", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const store = new FeatureSampleStore();
  assert.equal(store.runDemo("scan"), true);
  assert.equal(store.activity(SAMPLE_AGENT_ID)?.station_id, "source-desk");
  assert.equal(store.runDemo("test"), false);
  assert.equal(store.runDemo("publish" as "test"), false);
  await vi.advanceTimersByTimeAsync(6000);
  assert.equal(store.activity(SAMPLE_AGENT_ID), undefined);
  assert.equal(store.getSnapshot().actions[0]!.phase, "completed");
  assert.equal(store.runDemo("test"), true);
  assert.equal(store.activity(SAMPLE_AGENT_ID)?.kind, "test");
  assert.equal(store.activity(SAMPLE_AGENT_ID)?.station_id, "test-bench");
  assert.equal(store.replayLastDemo(), false);
  await vi.advanceTimersByTimeAsync(6000);
  assert.equal(store.replayLastDemo(), true);
  assert.equal(store.getSnapshot().actions.at(-1)!.mode, "REPLAY");
  assert.equal(store.getSnapshot().actions.at(-1)!.is_demo, true);
  assert.equal(store.activity(SAMPLE_AGENT_ID), undefined);
  assert.equal(store.activity("test-bench"), undefined);
  store.dispose();
});

test("actual read uses a fixed credential-free GET and preserves original provenance without an AI actor", async () => {
  const original = publicSnapshot(),
    unchanged = structuredClone(original);
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn(
    (_url: string, _init: RequestInit) =>
      new Promise<Response>((ready) => {
        resolve = ready;
      }),
  );
  const store = new FeatureSampleStore(fetcher);
  const pending = store.observePublic();
  assert.equal(store.getSnapshot().reading, true);
  assert.equal(store.activity("source-desk")?.actor_kind, "local-program");
  assert.equal(store.activity(SAMPLE_AGENT_ID), undefined);
  assert.equal(await store.observePublic(), false);
  resolve(response(original));
  assert.equal(await pending, true);
  assert.equal(fetcher.mock.calls.length, 1);
  const [url, init] = fetcher.mock.calls[0]!;
  assert.equal(url, "/scout-read/v1/snapshot");
  assert.equal(init.method, "GET");
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");
  assert.equal(init.redirect, "error");
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(original, unchanged);
  assert.deepEqual(store.getSnapshot().receipt!.snapshot, unchanged);
  assert.ok(
    Object.isFrozen(store.getSnapshot().receipt!.snapshot.rooms[0]!.evidence),
  );
  assert.equal(store.getSnapshot().receipt!.revision, original.revision);
  assert.equal(
    store.getSnapshot().receipt!.source_ref,
    "https://github.com/orionaster/devungeon",
  );
  assert.equal(store.getSnapshot().receipt!.mode, "LIVE");
  assert.equal(store.activity("source-desk"), undefined);
  assert.equal(store.getSnapshot().actions[0]!.phase, "completed");
  assert.equal(OBSERVATORY_FEATURE.acceptance, "unknown");
  store.dispose();
});

test("invalid scope/synthetic data fail closed; a failed later read retains evidence and can recover", async () => {
  const other = publicSnapshot();
  other.project.id = "github:somewhere/else";
  const synthetic = publicSnapshot();
  synthetic.project.source.is_demo = true;
  for (const invalid of [
    response(other),
    response(synthetic),
    response(null),
    response(publicSnapshot(), "DEMO"),
  ]) {
    const store = new FeatureSampleStore(async () => invalid);
    assert.equal(await store.observePublic(), false);
    assert.equal(store.getSnapshot().error, "invalid_source");
    assert.equal(store.getSnapshot().receipt, null);
    assert.equal(store.getSnapshot().actions.at(-1)!.mode, "DISCONNECTED");
    assert.equal(store.activity("source-desk"), undefined);
    store.dispose();
  }
  let available = true;
  const store = new FeatureSampleStore(async () =>
    available ? response() : new Response("Unavailable", { status: 503 }),
  );
  assert.equal(await store.observePublic(), true);
  const prior = store.getSnapshot().receipt;
  available = false;
  assert.equal(await store.observePublic(), false);
  assert.equal(store.getSnapshot().error, "unavailable");
  assert.equal(store.getSnapshot().receipt, prior);
  assert.equal(store.getSnapshot().reading, false);
  available = true;
  assert.equal(await store.observePublic(), true);
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().actions.length, 3);
  store.dispose();
});

test("stale/disconnected cached snapshots remain labeled and never leave a local observer running", async () => {
  for (const mode of ["STALE", "DISCONNECTED"]) {
    const store = new FeatureSampleStore(async () =>
      response(publicSnapshot(), mode),
    );
    assert.equal(await store.observePublic(), true);
    assert.equal(store.getSnapshot().receipt!.mode, mode);
    assert.equal(store.getSnapshot().actions.at(-1)!.mode, mode);
    assert.equal(store.activity("source-desk"), undefined);
    store.dispose();
  }
});

test("the read operation aborts after its bounded timeout and stops active work", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const store = new FeatureSampleStore(
    async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const pending = store.observePublic();
  assert.equal(store.activity("source-desk")?.kind, "read");
  await vi.advanceTimersByTimeAsync(12000);
  assert.equal(await pending, false);
  assert.equal(store.activity("source-desk"), undefined);
  assert.equal(store.getSnapshot().error, "unavailable");
  assert.equal(store.getSnapshot().actions.at(-1)!.phase, "failed");
  store.dispose();
});

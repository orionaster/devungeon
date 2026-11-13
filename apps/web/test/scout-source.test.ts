import { afterEach, describe, expect, it, vi } from "vitest";
import tiny from "../../../examples/tiny-landing-page.json";
import { taskCopy } from "../../../packages/workspace-ui/src/demo-task-copy";
import { translate } from "../../../packages/workspace-ui/src/i18n/core";
import {
  SCOUT_PROJECT_ID,
  ScoutSourceStore,
  type ScoutRecord,
} from "../src/scout-source";

const now = Date.parse("2026-11-14T01:00:00Z");
const timestamp = new Date(now).toISOString();
const connection = {
  mode: "LIVE", reason: "ok", last_success_at: timestamp,
  checked_at: timestamp, retry_at: null,
};
const status = {
  schema_version: "1.0", project_id: SCOUT_PROJECT_ID, epoch: "first", cursor: 1,
  connections: { project: connection, agent: connection },
  capabilities: { project: ["read_project"], agent: ["observe_events"], commands: [] },
  warnings: ["Original public source warning"],
};
const publicSnapshot = {
  ...tiny,
  project: { id: SCOUT_PROJECT_ID, name: "Devungeon", source: {
    kind: "github", is_demo: false, reference: "https://github.com/orionaster/devungeon",
  } },
  rooms: tiny.rooms.map((room) => ({ ...room, status: "planned", evidence: [] })),
  agents: [],
};
const envelope = { schema_version: "1.0", connection, snapshot: publicSnapshot };
function record(overrides: Partial<ScoutRecord> = {}): ScoutRecord {
  return {
    schema_version: "1.0", cursor: 1, mode: "LIVE", event: {
      schema_version: "1.0", event_id: "actual-1", project_id: SCOUT_PROJECT_ID,
      agent_id: "scout-local:public", task_id: "github:issue:12", room_id: "contact",
      source_kind: "agent", idempotency_key: "actual-1", status: "working",
      event_type: "tool_call", occurred_at: timestamp, observed_at: timestamp,
      source: "scout-local", source_ref: "https://github.com/orionaster/devungeon/commit/example",
      is_demo: false, message: "Read-only Git HEAD observation",
    }, ...overrides,
  };
}
function apply(store: ScoutSourceStore, item: ScoutRecord) {
  store.adapter.ingestRecord(item);
  store.acceptRecord(item);
}
function connected() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => envelope })));
  const store = new ScoutSourceStore();
  store.adapter.ingestStatus(status);
  store.acceptStatus(status);
  return store;
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("primary host public SCOUT source", () => {
  it("preserves the exact public snapshot and refuses foreign/demo/unverified input", () => {
    const store = connected();
    store.acceptSnapshot(envelope);
    expect(store.getSnapshot().snapshot).toEqual(publicSnapshot);
    expect(store.getSnapshot().snapshot).not.toBe(publicSnapshot);
    for (const snapshot of [
      { ...publicSnapshot, project: { ...publicSnapshot.project, id: "foreign" } },
      { ...publicSnapshot, project: { ...publicSnapshot.project, source: { kind: "github", is_demo: true } } },
      { ...publicSnapshot, rooms: publicSnapshot.rooms.map((room) => ({ ...room, status: "accepted" })) },
    ]) expect(() => store.acceptSnapshot({ ...envelope, snapshot })).toThrow();
    expect(store.getSnapshot().snapshot).toEqual(publicSnapshot);
    store.dispose();
  });

  it("keeps project observations out of the Agent roster and renderer", () => {
    const store = connected();
    const project = record();
    project.event.source_kind = "project";
    project.event.agent_id = "source:github";
    apply(store, project);
    expect(store.getSnapshot().records).toHaveLength(1);
    expect(store.controller.getSnapshot().agents).toEqual([]);
    expect(store.projectionFor(["source:github"]).snapshot()).toEqual([]);
    store.dispose();
  });

  it("deduplicates reconnect delivery, retains history on disconnect and distinguishes replay", () => {
    const store = connected();
    store.acceptSnapshot(envelope);
    const item = record();
    apply(store, item);
    apply(store, item);
    expect(store.getSnapshot().records).toHaveLength(1);
    const projection = store.projectionFor([item.event.agent_id]);
    expect(projection.actor(item.event.agent_id, now).stale).toBe(false);
    apply(store, { ...item, mode: "REPLAY" });
    expect(store.controller.getSnapshot().agents[0].mode).toBe("replay");
    expect(store.controller.getSnapshot().event_modes[item.event.event_id]).toBe("replay");
    expect(store.controller.getSnapshot().events).toHaveLength(1);
    store.disconnect();
    expect(store.getSnapshot().transportConnected).toBe(false);
    expect(store.getSnapshot().records).toHaveLength(1);
    expect(store.getSnapshot().snapshot).toEqual(publicSnapshot);
    expect(store.controller.getSnapshot().events).toHaveLength(1);
    expect(projection.actor(item.event.agent_id, now).stale).toBe(true);
    const restarted = { ...status, epoch: "restarted" };
    store.adapter.ingestStatus(restarted);
    store.acceptStatus(restarted);
    expect(projection.actor(item.event.agent_id, now).stale).toBe(true);
    apply(store, { ...item, mode: "REPLAY" });
    expect(store.getSnapshot().records).toHaveLength(1);
    expect(store.getSnapshot().records[0].mode).toBe("REPLAY");
    apply(store, item);
    expect(store.getSnapshot().records[0].mode).toBe("REPLAY");
    expect(store.controller.getSnapshot().events).toHaveLength(1);
    expect(projection.actor(item.event.agent_id, now).stale).toBe(true);
    store.dispose();
  });

  it("expires LIVE animation per actor and honors source STALE independently of transport", () => {
    const store = connected();
    const item = record();
    apply(store, item);
    const projection = store.projectionFor([item.event.agent_id]);
    expect(projection.actor(item.event.agent_id, now + 2999).stale).toBe(false);
    expect(projection.actor(item.event.agent_id, now + 3000).stale).toBe(true);
    const stale = { ...status, connections: { ...status.connections, agent: { ...connection, mode: "STALE" } } };
    store.adapter.ingestStatus(stale);
    store.acceptStatus(stale);
    expect(store.getSnapshot().transportConnected).toBe(true);
    expect(store.getSnapshot().status?.connections.project.mode).toBe("LIVE");
    expect(store.getSnapshot().status?.connections.agent.mode).toBe("STALE");
    expect(projection.actor(item.event.agent_id, now).stale).toBe(true);
    store.dispose();
  });

  it("does not let delayed events rewind actors or grant commands", async () => {
    const store = connected();
    apply(store, record());
    const late = record({ cursor: 2 });
    late.event = { ...late.event, event_id: "late", idempotency_key: "late", status: "idle", occurred_at: "2020-01-01T00:00:00Z" };
    apply(store, late);
    const agent = store.controller.getSnapshot().agents[0];
    expect(agent.status).toBe("working");
    expect(agent.name).toBe(agent.id);
    expect(agent.capabilities).toEqual([]);
    expect(store.controller.getSnapshot().tasks[0].status).toBe("unknown");
    const originalWork = JSON.stringify(store.controller.getSnapshot());
    const task = store.controller.getSnapshot().tasks[0];
    const zh = taskCopy(task, false, (key) => translate("zh-CN", key));
    const en = taskCopy(task, false, (key) => translate("en-US", key));
    expect(zh.detail).toContain("完成度未知");
    expect(en.detail).toContain("completion is unknown");
    expect(zh.title).toBe(en.title);
    expect(JSON.stringify(store.controller.getSnapshot())).toBe(originalWork);
    await expect(store.controller.send(store.controller.createCommand(agent.id, "chat", "Hello"))).rejects.toThrow();
    const conflicting = record({ cursor: 3 });
    conflicting.event = { ...conflicting.event, event_id: "same-key-new-id" };
    expect(() => apply(store, conflicting)).toThrow(/幂等键/);
    expect(store.getSnapshot().records).toHaveLength(2);
    store.dispose();
  });

  it("receives one validated stream, refreshes snapshot notices and blocks malformed delivery", async () => {
    const store = connected();
    class FakeStream {
      static CLOSED = 2;
      static all: FakeStream[] = [];
      readyState = 1;
      onerror?: () => void;
      listeners = new Map<string, (event: MessageEvent) => void>();
      constructor(readonly url: string) { FakeStream.all.push(this); }
      addEventListener(type: string, fn: (event: MessageEvent) => void) { this.listeners.set(type, fn); }
      close() { this.readyState = 2; }
      emit(type: string, value: unknown) { this.listeners.get(type)?.({ data: JSON.stringify(value) } as MessageEvent); }
    }
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:5173/", origin: "http://127.0.0.1:5173" } });
    vi.stubGlobal("EventSource", FakeStream);
    const stop = store.connect();
    const stream = FakeStream.all[0];
    expect(stream.url).toBe("http://127.0.0.1:5173/scout-read/v1/stream");
    stream.emit("status", status);
    stream.emit("record", record());
    stream.emit("snapshot", { revision: "changed" });
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getSnapshot().snapshot).toEqual(publicSnapshot);
    expect(store.getSnapshot().status?.warnings).toEqual(status.warnings);
    expect(store.getSnapshot().work.agents).toHaveLength(1);
    stream.emit("record", { ...record(), event: { ...record().event, project_id: "foreign" } });
    expect(stream.readyState).toBe(2);
    expect(store.getSnapshot().transportConnected).toBe(false);
    expect(store.getSnapshot().records).toHaveLength(1);
    stop();
    store.dispose();
  });
});

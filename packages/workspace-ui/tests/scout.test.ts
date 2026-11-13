import { describe, expect, it, vi } from "vitest";
import {
  connectScoutStream,
  ScoutWorkspaceAdapter,
} from "../src/scout-adapter";
import { WorkspaceController } from "../src/controller";
import type { Command } from "../src/model";
import { agentConnectionLabel, connectionLabel } from "../src/model";

const projectId = "github:orionaster/devungeon";
const now = new Date().toISOString();
const connection = {
  mode: "LIVE",
  reason: "ok",
  last_success_at: now,
  checked_at: now,
  retry_at: null,
};
const status = {
  schema_version: "1.0",
  project_id: projectId,
  epoch: "epoch-1",
  cursor: 2,
  connections: { agent: connection, project: connection },
  capabilities: {
    agent: ["observe_events"],
    project: ["read_project"],
    commands: [],
  },
};
const record = {
  schema_version: "1.0",
  cursor: 1,
  mode: "LIVE",
  event: {
    schema_version: "1.0",
    event_id: "source-1",
    project_id: projectId,
    agent_id: "scout-local:public",
    task_id: "issue:3",
    source_kind: "agent",
    idempotency_key: "source-1",
    status: "working",
    event_type: "tool_call",
    occurred_at: now,
    observed_at: now,
    source: "scout-local",
    source_ref: "local:metadata:public",
    is_demo: false,
    message: "Observed read-only Git check.",
  },
};

describe("SCOUT read-only integration", () => {
  it("reconnects after malformed SSE with one delayed retry, retained history and no new capabilities", async () => {
    vi.useFakeTimers();
    class FakeStream {
      static CLOSED = 2;
      static instances: FakeStream[] = [];
      readyState = 1;
      onerror?: () => void;
      listeners = new Map<string, (message: MessageEvent) => void>();
      constructor(readonly url: string) { FakeStream.instances.push(this); }
      addEventListener(type: string, handler: (message: MessageEvent) => void) { this.listeners.set(type, handler); }
      close() { this.readyState = FakeStream.CLOSED; }
      emit(type: string, value: unknown) { this.raw(type, JSON.stringify(value)); }
      raw(type: string, data: string) { this.listeners.get(type)?.({ data } as MessageEvent); }
    }
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:4174/", origin: "http://127.0.0.1:4174" } });
    vi.stubGlobal("EventSource", FakeStream);
    let stop: (() => void) | undefined;
    try {
      const adapter = new ScoutWorkspaceAdapter(projectId);
      const observed: unknown[] = [];
      const error = vi.fn();
      stop = connectScoutStream(adapter, "/v1/stream", error, { onRecord: (value) => { observed.push(value); } });
      const first = FakeStream.instances[0];
      first.emit("status", status);
      first.emit("record", record);
      const originalEvents = adapter.getSnapshot().events;
      first.raw("record", "{malformed SSE JSON");
      expect(first.readyState).toBe(FakeStream.CLOSED);
      expect(adapter.getSnapshot().connected).toBe(false);
      expect(adapter.getSnapshot().events).toEqual(originalEvents);
      expect(error).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(1);
      // Already queued messages on the rejected transport must stay rejected.
      first.emit("record", { ...record, cursor: 2, event: { ...record.event, event_id: "queued-after-close", idempotency_key: "queued-after-close" } });
      expect(observed).toHaveLength(1);
      // A browser may report a terminal error as well; it must reuse the timer.
      first.onerror?.();
      first.onerror?.();
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect(FakeStream.instances).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeStream.instances).toHaveLength(2);
      const repaired = FakeStream.instances[1];
      repaired.emit("status", status);
      repaired.emit("record", { ...record, mode: "REPLAY" });
      expect(adapter.getSnapshot().connected).toBe(true);
      expect(adapter.getSnapshot().events).toEqual(originalEvents);
      expect(adapter.getSnapshot().agents[0].mode).toBe("replay");
      expect(adapter.getSnapshot().agents[0].capabilities).toEqual([]);
      // Repeated malformed input remains rate limited, and disposal cancels it.
      repaired.raw("record", "invalid JSON again");
      expect(vi.getTimerCount()).toBe(1);
      stop();
      await vi.advanceTimersByTimeAsync(5000);
      expect(FakeStream.instances).toHaveLength(2);
      expect(adapter.getSnapshot().connected).toBe(false);
      expect(adapter.getSnapshot().events).toEqual(originalEvents);
    } finally {
      stop?.();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  it("resets the transport cursor on epoch change and recovers terminal stream errors", async () => {
    vi.useFakeTimers();
    class FakeStream {
      static CLOSED = 2;
      static instances: FakeStream[] = [];
      readyState = 0;
      onerror?: () => void;
      listeners = new Map<string, (message: MessageEvent) => void>();
      constructor(readonly url: string) {
        FakeStream.instances.push(this);
      }
      addEventListener(type: string, handler: (message: MessageEvent) => void) {
        this.listeners.set(type, handler);
      }
      close() {
        this.readyState = FakeStream.CLOSED;
      }
      emit(type: string, value: unknown) {
        this.listeners.get(type)?.({
          data: JSON.stringify(value),
        } as MessageEvent);
      }
    }
    vi.stubGlobal("window", {
      location: {
        href: "http://127.0.0.1:4174/",
        origin: "http://127.0.0.1:4174",
      },
    });
    vi.stubGlobal("EventSource", FakeStream);
    try {
      const adapter = new ScoutWorkspaceAdapter(projectId);
      expect(() =>
        connectScoutStream(adapter, "https://example.invalid/v1/stream"),
      ).toThrow(/同源/);
      const stop = connectScoutStream(adapter);
      const first = FakeStream.instances[0];
      first.emit("status", status);
      first.emit("record", record);
      first.emit("status", { ...status, epoch: "epoch-2" });
      expect(first.readyState).toBe(FakeStream.CLOSED);
      expect(FakeStream.instances).toHaveLength(2);
      const second = FakeStream.instances[1];
      second.emit("status", { ...status, epoch: "epoch-2" });
      second.emit("record", record);
      expect(adapter.getSnapshot().events).toHaveLength(1);
      second.close();
      second.onerror?.();
      await vi.advanceTimersByTimeAsync(2001);
      expect(FakeStream.instances).toHaveLength(3);
      stop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(FakeStream.instances).toHaveLength(3);
      expect(adapter.getSnapshot().connected).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  it("respects authoritative STALE even when local age is below 60 seconds", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord(record);
    adapter.ingestStatus({
      ...status,
      connections: {
        ...status.connections,
        agent: { ...connection, mode: "STALE" },
      },
    });
    expect(connectionLabel(adapter.getSnapshot())).toContain("状态已过期");
  });
  it("preserves DEMO provenance through replay and mixed actor source modes", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord({
      ...record,
      mode: "REPLAY",
      event: { ...record.event, is_demo: true },
    });
    adapter.ingestRecord({
      ...record,
      cursor: 2,
      event: {
        ...record.event,
        event_id: "real-actor",
        idempotency_key: "real-actor",
        agent_id: "real-actor",
      },
    });
    const snapshot = adapter.getSnapshot();
    const demo = snapshot.agents.find(
      (agent) => agent.id === record.event.agent_id,
    )!;
    expect(agentConnectionLabel(snapshot, demo)).toContain("DEMO");
    expect(agentConnectionLabel(snapshot, demo)).toContain("REPLAY");
    expect(
      agentConnectionLabel(
        snapshot,
        snapshot.agents.find((agent) => agent.id === "real-actor")!,
      ),
    ).toContain("LIVE");
  });
  it("projects real-source events with time, provenance and zero command capability", async () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    const controller = new WorkspaceController(adapter, "viewer", projectId);
    adapter.ingestStatus(status);
    expect(adapter.ingestRecord(record)).toBe(true);
    expect(controller.getSnapshot().agents[0].role).toBe("unknown");
    expect(controller.getSnapshot().agents[0].capabilities).toEqual([]);
    expect(controller.getSnapshot().events[0].source_ref).toBe(
      "local:metadata:public",
    );
    expect(controller.getSnapshot().events[0].observed_at).toBe(now);
    expect(controller.getSnapshot().event_modes["source-1"]).toBe("live");
    expect(controller.getSnapshot().tasks[0].detail).toContain("完成度未知");
    await expect(adapter.send({} as Command)).rejects.toThrow(/不支持真实指令/);
    await expect(
      controller.send(
        controller.createCommand("scout-local:public", "chat", "hello"),
      ),
    ).rejects.toThrow(/不支持/);
  });
  it("deduplicates records, rejects conflicting IDs, older cursors and foreign projects", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord(record);
    const revision = adapter.getSnapshot().revision;
    expect(adapter.ingestRecord(record)).toBe(false);
    expect(adapter.getSnapshot().revision).toBe(revision);
    expect(() =>
      adapter.ingestRecord({
        ...record,
        event: { ...record.event, message: "changed" },
      }),
    ).toThrow(/冲突/);
    expect(() =>
      adapter.ingestRecord({
        ...record,
        event: { ...record.event, event_id: "another" },
      }),
    ).toThrow(/倒退/);
    expect(() =>
      adapter.ingestRecord({
        ...record,
        event: { ...record.event, project_id: "other" },
      }),
    ).toThrow(/跨项目/);
  });
  it("does not create Agents from GitHub project observations", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord({
      ...record,
      event: {
        ...record.event,
        source_kind: "project",
        agent_id: "source:github",
      },
    });
    expect(adapter.getSnapshot().agents).toEqual([]);
    expect(adapter.getSnapshot().events).toEqual([]);
  });
  it("preserves replay mode and source time; tool end never establishes task or product acceptance", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord({
      ...record,
      mode: "REPLAY",
      event: { ...record.event, status: "idle", event_type: "completed" },
    });
    expect(adapter.getSnapshot().mode).toBe("replay");
    expect(adapter.getSnapshot().agents[0].status).toBe("idle");
    expect(adapter.getSnapshot().tasks[0].status).toBe("unknown");
    expect(adapter.getSnapshot().events[0].occurred_at).toBe(now);
  });
  it("does not regress actor status on an older occurred_at even with a higher cursor", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord(record);
    adapter.ingestRecord({
      ...record,
      cursor: 2,
      event: {
        ...record.event,
        event_id: "late-history",
        idempotency_key: "late-history",
        status: "idle",
        occurred_at: "2020-01-01T00:00:00Z",
      },
    });
    expect(adapter.getSnapshot().agents[0].status).toBe("working");
  });
  it("clears projection on journal epoch changes and preserves history on disconnect", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    adapter.ingestStatus(status);
    adapter.ingestRecord(record);
    adapter.disconnect();
    expect(adapter.getSnapshot().connected).toBe(false);
    expect(adapter.getSnapshot().events).toHaveLength(1);
    adapter.ingestStatus({ ...status, epoch: "epoch-2" });
    expect(adapter.getSnapshot().events).toHaveLength(0);
    expect(adapter.ingestRecord(record)).toBe(true);
  });
  it("rejects live/demo provenance mismatches and required metadata omissions", () => {
    const adapter = new ScoutWorkspaceAdapter(projectId);
    expect(() => adapter.ingestRecord({ ...record, mode: "DEMO" })).toThrow(
      /冲突/,
    );
    expect(() =>
      adapter.ingestRecord({
        ...record,
        event: { ...record.event, source_ref: undefined },
      }),
    ).toThrow();
  });
});

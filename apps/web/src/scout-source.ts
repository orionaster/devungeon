import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { AgentProjection } from "../../../packages/dungeon-engine/src";
import {
  compileProjectGraph,
  type ProjectSnapshot,
} from "../../../packages/world-generator/src/index";
import {
  ScoutWorkspaceAdapter,
  connectScoutStream,
  scoutRecordSchema,
  scoutStatusSchema,
} from "../../../packages/workspace-ui/src/scout-adapter";
import { WorkspaceController } from "../../../packages/workspace-ui/src/controller";
import type { WorkspaceSnapshot } from "../../../packages/workspace-ui/src/model";

export const SCOUT_PROJECT_ID = "github:orionaster/devungeon";
export type ScoutRecord = z.infer<typeof scoutRecordSchema>;
export type ScoutStatus = z.infer<typeof scoutStatusSchema>;
export interface ScoutSourceSnapshot {
  snapshot: ProjectSnapshot | null;
  status: ScoutStatus | null;
  records: readonly ScoutRecord[];
  work: WorkspaceSnapshot;
  /** SSE transport and source connections are intentionally separate. */
  transportConnected: boolean;
  error: string;
  now: number;
}
const envelopeSchema = z.object({
  schema_version: z.literal("1.0"),
  connection: scoutStatusSchema.shape.connections.shape.project,
  snapshot: z.unknown(),
});

/** A cache is visual activity only. Recent replay receipts must never animate
 * real work, including replay delivered immediately after a bridge restart. */
export class ScoutAgentProjection extends AgentProjection {
  constructor(
    ids: readonly string[],
    private source: () => ScoutSourceSnapshot,
  ) {
    super(SCOUT_PROJECT_ID, ids);
  }
  override actor(id: string, now = Date.now()) {
    const actor = super.actor(id, now);
    const source = this.source();
    const record = source.records.find(
      (item) => item.event.event_id === actor.event?.event_id,
    );
    const mode = source.status?.connections.agent.mode;
    const age = actor.event
      ? now - Date.parse(actor.event.occurred_at)
      : Infinity;
    const active =
      source.transportConnected &&
      (mode === "LIVE" || mode === "DEMO") &&
      record &&
      ((record.mode === "LIVE" &&
        !record.event.is_demo &&
        age >= 0 &&
        age < 3000) ||
        (record.mode === "DEMO" &&
          record.event.is_demo &&
          age >= 0 &&
          age < 3000));
    return { ...actor, stale: !active || actor.stale };
  }
}

/** Read-only host store. No gameplay owner, locale, provider or mutation API. */
export class ScoutSourceStore {
  readonly adapter = new ScoutWorkspaceAdapter(SCOUT_PROJECT_ID);
  readonly controller = new WorkspaceController(
    this.adapter,
    "local-viewer",
    SCOUT_PROJECT_ID,
  );
  private listeners = new Set<() => void>();
  private value: ScoutSourceSnapshot = {
    snapshot: null,
    status: null,
    records: [],
    work: this.controller.getSnapshot(),
    transportConnected: false,
    error: "",
    now: Date.now(),
  };
  private projections = new Map<string, ScoutAgentProjection>();
  private abort?: AbortController;
  private generation = 0;
  private stopStream?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private unsubscribeWork = this.controller.subscribe(() => {
    this.update({ work: this.controller.getSnapshot() });
  });
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ScoutSourceSnapshot>) {
    this.value = { ...this.value, ...patch, now: Date.now() };
    this.listeners.forEach((listener) => listener());
  }
  acceptStatus = (raw: unknown) => {
    const status = scoutStatusSchema.parse(raw);
    if (status.project_id !== SCOUT_PROJECT_ID)
      throw new Error("SCOUT project scope mismatch");
    const changed = this.value.status?.epoch !== status.epoch;
    // A restarted stream first announces status, then sends its backlog. Stop
    // cached LIVE animation immediately, before replay frames arrive.
    const records =
      this.value.status && changed
        ? this.value.records.map(
            (record): ScoutRecord => ({ ...record, mode: "REPLAY" }),
          )
        : this.value.records;
    this.update({ status, records, transportConnected: true, error: "" });
    if (changed || !this.value.snapshot) void this.refresh();
  };
  acceptRecord = (raw: unknown) => {
    const record = scoutRecordSchema.parse(raw);
    if (record.event.project_id !== SCOUT_PROJECT_ID)
      throw new Error("SCOUT record scope mismatch");
    if (
      (record.mode === "LIVE" && record.event.is_demo) ||
      (record.mode === "DEMO" && !record.event.is_demo)
    )
      throw new Error("SCOUT delivery/source mode mismatch");
    const existing = this.value.records.find(
      (item) => item.event.event_id === record.event.event_id,
    );
    if (
      existing &&
      JSON.stringify(existing.event) !== JSON.stringify(record.event)
    )
      throw new Error("Conflicting SCOUT event ID");
    if (!existing && this.value.records.length >= 10000)
      throw new Error("SCOUT projection capacity exceeded");
    // Event identity survives restart. A replayed duplicate can never be
    // promoted into fresh work by a later repeated LIVE envelope.
    const delivery =
      existing?.mode === "REPLAY"
        ? { ...record, mode: "REPLAY" as const }
        : record;
    const records = existing
      ? this.value.records.map((item) => (item === existing ? delivery : item))
      : [...this.value.records, record];
    this.update({ records });
    if (record.event.source_kind === "agent") {
      for (const projection of this.projections.values())
        projection.ingest(record.event);
    }
  };
  acceptSnapshot(raw: unknown) {
    const envelope = envelopeSchema.parse(raw);
    if (!envelope.snapshot) {
      this.update({ error: "snapshot_unavailable" });
      return;
    }
    const checked = compileProjectGraph(envelope.snapshot);
    if (!checked.ok)
      throw new Error(
        `invalid_snapshot: ${checked.diagnostics.map((item) => item.code).join(", ")}`,
      );
    if (
      checked.graph.project.id !== SCOUT_PROJECT_ID ||
      checked.graph.project.source.kind !== "github" ||
      checked.graph.project.source.is_demo
    )
      throw new Error("SCOUT public project scope mismatch");
    const snapshot = structuredClone(envelope.snapshot) as ProjectSnapshot;
    // Keep the exact source values/order; generation owns its own validated copy.
    if (JSON.stringify(snapshot) !== JSON.stringify(this.value.snapshot))
      this.update({ snapshot, error: "" });
  }
  refresh = async () => {
    const generation = ++this.generation;
    this.abort?.abort();
    const abort = (this.abort = new AbortController());
    try {
      const response = await fetch("/scout-read/v1/snapshot", {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal: abort.signal,
      });
      if (!response.ok) throw new Error(`snapshot_http_${response.status}`);
      const raw: unknown = await response.json();
      if (generation === this.generation) this.acceptSnapshot(raw);
    } catch (error) {
      if (generation === this.generation && !abort.signal.aborted)
        this.update({
          error:
            error instanceof Error ? error.message : "snapshot_unavailable",
        });
    }
  };
  projectionFor = (ids: readonly string[]) => {
    const key = [...ids].sort().join("\n");
    let projection = this.projections.get(key);
    if (!projection) {
      projection = new ScoutAgentProjection(ids, this.getSnapshot);
      this.projections.set(key, projection);
      for (const record of this.value.records)
        if (record.event.source_kind === "agent")
          projection.ingest(record.event);
      // Keep only the active roster; old references remain safe read-only readers.
      if (this.projections.size > 4)
        this.projections.delete(this.projections.keys().next().value!);
    }
    return projection;
  };
  disconnect = (message = "transport_disconnected") => {
    this.adapter.disconnect();
    this.update({ transportConnected: false, error: message });
  };
  connect() {
    this.stop();
    this.stopStream = connectScoutStream(
      this.adapter,
      "/scout-read/v1/stream",
      this.disconnect,
      {
        onStatus: this.acceptStatus,
        onRecord: this.acceptRecord,
        onSnapshot: () => {
          void this.refresh();
        },
      },
    );
    void this.refresh();
    this.timer = setInterval(() => this.update({}), 1000);
    return () => this.stop();
  }
  stop() {
    this.generation++;
    this.abort?.abort();
    this.stopStream?.();
    this.stopStream = undefined;
    clearInterval(this.timer);
    this.timer = undefined;
    this.disconnect();
  }
  dispose() {
    this.stop();
    this.unsubscribeWork();
    this.controller.dispose();
    this.listeners.clear();
  }
}

export function useScoutSource(enabled: boolean) {
  const [store] = useState(() => new ScoutSourceStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => (enabled ? store.connect() : undefined), [store, enabled]);
  // Retain this work controller across project selection; it has no running
  // provider and no permission API. Network cleanup occurs on every deselection.
  return {
    ...state,
    store,
    controller: store.controller,
    adapter: store.adapter,
    refresh: store.refresh,
    projectionFor: store.projectionFor,
    activityEnabled:
      state.transportConnected &&
      (state.status?.connections.agent.mode === "LIVE" ||
        state.status?.connections.agent.mode === "DEMO"),
  };
}

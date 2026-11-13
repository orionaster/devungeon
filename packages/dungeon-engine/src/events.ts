import type { AgentEvent, AgentEventType } from "./types";
const types: AgentEventType[] = [
  "started",
  "progress",
  "tool_call",
  "tested",
  "blocked",
  "review_requested",
  "completed",
  "failed",
  "disconnected",
  "command_result",
];
/** Display-only event projection. No game state, commands or project acceptance API. */
export class AgentProjection {
  private events: AgentEvent[] = [];
  private ids = new Set<string>();
  private latest = new Map<string, AgentEvent>();
  constructor(
    readonly projectId: string,
    readonly agentIds: readonly string[],
  ) {}
  ingest(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const e = value as AgentEvent;
    if (
      e.schema_version !== "1.0" ||
      e.project_id !== this.projectId ||
      !this.agentIds.includes(e.agent_id) ||
      typeof e.event_id !== "string" ||
      !e.event_id ||
      this.ids.has(e.event_id) ||
      !types.includes(e.event_type) ||
      typeof e.source !== "string" ||
      !e.source ||
      typeof e.is_demo !== "boolean" ||
      typeof e.observed_at !== "string" ||
      typeof e.occurred_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(e.observed_at) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(e.occurred_at) ||
      !Number.isFinite(Date.parse(e.observed_at)) ||
      !Number.isFinite(Date.parse(e.occurred_at)) ||
      (e.message !== undefined && typeof e.message !== "string") ||
      (e.room_id !== undefined && typeof e.room_id !== "string") ||
      (e.source_ref !== undefined && typeof e.source_ref !== "string")
    )
      return false;
    if (
      e.event_id.length > 256 ||
      e.source.length > 256 ||
      (e.source_ref?.length ?? 0) > 2000 ||
      (e.room_id?.length ?? 0) > 256 ||
      (e.message?.length ?? 0) > 2000
    )
      return false;
    const clean: AgentEvent = {
      schema_version: "1.0",
      event_id: e.event_id,
      project_id: e.project_id,
      agent_id: e.agent_id,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      observed_at: e.observed_at,
      source: e.source,
      is_demo: e.is_demo,
      message: e.message,
      room_id: e.room_id,
      source_ref: e.source_ref,
    };
    this.ids.add(e.event_id);
    this.events.unshift(clean);
    // Bound projection memory; a durable adapter should perform persistent idempotency upstream.
    if (this.events.length > 100) {
      const old = this.events.pop()!;
      this.ids.delete(old.event_id);
    }
    if (
      !this.latest.has(e.agent_id) ||
      Date.parse(this.latest.get(e.agent_id)!.occurred_at) <=
        Date.parse(e.occurred_at)
    )
      this.latest.set(e.agent_id, clean);
    return true;
  }
  snapshot() {
    return structuredClone(this.events);
  }
  actor(id: string, now = Date.now()) {
    const e = this.latest.get(id);
    return {
      event: e ? structuredClone(e) : undefined,
      stale: !e || now - Date.parse(e.observed_at) > 15000,
    };
  }
}

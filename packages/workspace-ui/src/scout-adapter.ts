import { z } from "zod";
import { agentEventSchema, freezeSnapshot, snapshotSchema } from "./model";
import type {
  Agent,
  Command,
  ApprovalDecision,
  Receipt,
  WorkspaceAdapter,
  WorkspaceSnapshot,
} from "./model";

// SCOUT's additive v1 metadata lives at this boundary; canonical event payload is retained separately.
const scoutEventSchema = agentEventSchema.extend({
  idempotency_key: z.string().min(1),
  task_id: z.string().min(1),
  source_ref: z.string().min(1),
  status: z.enum([
    "working",
    "idle",
    "blocked",
    "awaiting_approval",
    "offline",
    "unknown",
    "review",
    "failed",
  ]),
  source_kind: z.enum(["project", "agent"]),
});
export const scoutRecordSchema = z.strictObject({
  schema_version: z.literal("1.0"),
  cursor: z.number().int().positive(),
  mode: z.enum(["DEMO", "LIVE", "REPLAY"]),
  event: scoutEventSchema,
});
const connectionSchema = z.object({
  mode: z.enum(["LIVE", "DEMO", "STALE", "DISCONNECTED"]),
  reason: z.string(),
  last_success_at: z.iso.datetime().nullable(),
  checked_at: z.iso.datetime(),
  retry_at: z.iso.datetime().nullable(),
});
export const scoutStatusSchema = z.object({
  schema_version: z.literal("1.0"),
  project_id: z.string().min(1),
  epoch: z.string().min(1),
  cursor: z.number().int().nonnegative(),
  connections: z.object({ project: connectionSchema, agent: connectionSchema }),
  capabilities: z.object({
    commands: z.array(z.string()),
    agent: z.array(z.string()),
    project: z.array(z.string()),
  }),
});
type RecordEnvelope = z.infer<typeof scoutRecordSchema>;

/** Observe-only SCOUT projection. Capability presence in an event never grants commands. */
export class ScoutWorkspaceAdapter implements WorkspaceAdapter {
  private state: WorkspaceSnapshot;
  private listeners = new Set<() => void>();
  private records = new Map<string, RecordEnvelope>();
  private latest = new Map<string, RecordEnvelope>();
  private epoch?: string;
  private cursor = 0;
  constructor(
    readonly projectId: string,
    private roster: Record<string, { name: string; role: Agent["role"] }> = {},
  ) {
    this.state = freezeSnapshot(
      snapshotSchema.parse({
        project_id: projectId,
        revision: 0,
        mode: "replay",
        connected: false,
        observed_at: new Date(0).toISOString(),
        source: "SCOUT · 只读事件观察 · 尚未连接",
        agents: [],
        tasks: [],
        events: [],
        receipts: [],
        approvals: [],
      }),
    );
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<WorkspaceSnapshot>) {
    this.state = freezeSnapshot(
      snapshotSchema.parse({
        ...this.state,
        ...patch,
        revision: this.state.revision + 1,
      }),
    );
    this.listeners.forEach((listener) => listener());
  }
  ingestStatus(raw: unknown) {
    const status = scoutStatusSchema.parse(raw);
    if (status.project_id !== this.projectId)
      throw new Error("SCOUT 项目范围不匹配。");
    const epochChanged = !!this.epoch && status.epoch !== this.epoch;
    if (epochChanged) {
      this.records.clear();
      this.latest.clear();
      this.cursor = 0;
      this.update({
        agents: [],
        tasks: [],
        events: [],
        event_modes: {},
        connected: false,
        mode: "replay",
      });
    }
    this.epoch = status.epoch;
    const agent = status.connections.agent;
    this.update({
      connected: agent.mode !== "DISCONNECTED",
      stale: agent.mode === "STALE",
      source: `SCOUT · 只读 Agent 事件 · ${agent.mode} · ${agent.reason}`,
      observed_at: agent.last_success_at ?? this.state.observed_at,
    });
    return epochChanged;
  }
  ingestRecord(raw: unknown): boolean {
    const record = scoutRecordSchema.parse(raw);
    const event = record.event;
    if (event.project_id !== this.projectId)
      throw new Error("SCOUT 事件跨项目。");
    if (
      (record.mode === "DEMO" && !event.is_demo) ||
      (record.mode === "LIVE" && event.is_demo)
    )
      throw new Error("SCOUT 事件模式与来源冲突。");
    const existing = this.records.get(event.event_id);
    if (existing) {
      if (JSON.stringify(existing.event) !== JSON.stringify(event))
        throw new Error("相同事件 ID 内容冲突。");
      return false;
    }
    if (record.cursor <= this.cursor)
      throw new Error("未知事件的游标发生倒退。请重新连接并回放。");
    if (this.records.size >= 10000)
      throw new Error("事件容量已满，请重新建立投影。");
    this.cursor = record.cursor;
    this.records.set(event.event_id, record);
    // GitHub issue/PR activity must not manufacture Agent characters.
    if (event.source_kind !== "agent") return false;
    const previous = this.latest.get(event.agent_id);
    if (
      !previous ||
      Date.parse(previous.event.occurred_at) <= Date.parse(event.occurred_at)
    )
      this.latest.set(event.agent_id, record);
    const visible = [...this.records.values()].filter(
      (item) => item.event.source_kind === "agent",
    );
    const agents: Agent[] = [...this.latest.values()].map((item) => ({
      id: item.event.agent_id,
      name: this.roster[item.event.agent_id]?.name ?? "观察到的 Agent",
      is_demo: item.event.is_demo,
      mode: item.mode.toLowerCase() as Agent["mode"],
      role: this.roster[item.event.agent_id]?.role ?? "unknown",
      room_id: item.event.room_id ?? "unmapped",
      task_id: item.event.task_id,
      status:
        item.event.status === "working"
          ? "working"
          : item.event.status === "idle"
            ? "idle"
            : item.event.status === "review"
              ? "review"
              : ["blocked", "awaiting_approval", "failed"].includes(
                    item.event.status,
                  )
                ? "blocked"
                : "unknown",
      source: item.event.source,
      source_ref: item.event.source_ref!,
      observed_at: item.event.observed_at,
      capabilities: [],
    }));
    const tasks = agents.map((agent) => {
      const latest = this.latest.get(agent.id)!.event;
      return {
        id: latest.task_id,
        agent_id: agent.id,
        title: latest.task_id,
        status: "unknown" as const,
        detail:
          "仅观察到此任务关联，任务完成度未知。工具结束不等于任务结束或项目验收。",
        evidence: [
          { label: "原始活动来源", ref: latest.source_ref!, verified: false },
        ],
      };
    });
    // Different agents may share a source task; projection IDs remain unique per agent.
    for (const agent of agents) {
      agent.task_id = `${agent.id}:${agent.task_id}`;
    }
    for (const task of tasks) {
      task.id = `${task.agent_id}:${task.id}`;
    }
    const mode = record.mode.toLowerCase() as WorkspaceSnapshot["mode"];
    const events = visible.map((item) => {
      const {
        idempotency_key: _key,
        task_id: _task,
        status: _status,
        source_kind: _kind,
        ...canonical
      } = item.event;
      return agentEventSchema.parse(canonical);
    });
    this.update({
      agents,
      tasks,
      events,
      mode,
      event_modes: Object.fromEntries(
        visible.map((item) => [
          item.event.event_id,
          item.mode.toLowerCase() as WorkspaceSnapshot["mode"],
        ]),
      ),
      observed_at:
        this.state.observed_at === new Date(0).toISOString()
          ? event.observed_at
          : this.state.observed_at,
    });
    return true;
  }
  disconnect() {
    this.update({
      connected: false,
      source: "SCOUT · 只读事件桥未连接；保留历史记录",
    });
  }
  send = async (_command: Command): Promise<Receipt> => {
    throw new Error(
      "SCOUT 当前仅支持 observe_events；不支持真实指令，未执行。",
    );
  };
  decide = async (_decision: ApprovalDecision): Promise<Receipt> => {
    throw new Error("只读 SCOUT 连接不支持审批，未执行。");
  };
}

/** Host must serve /v1 from its trusted same-origin bridge. No CORS bypass or tokens. */
export function connectScoutStream(
  adapter: ScoutWorkspaceAdapter,
  path = "/v1/stream",
  onError?: (message: string) => void,
): () => void {
  const url = new URL(path, window.location.href);
  if (url.origin !== window.location.origin)
    throw new Error("SCOUT 事件流必须由同源可信桥接提供。");
  let stream: EventSource;
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const open = (): EventSource => {
    const current = new EventSource(url.href);
    const apply =
      (handler: (value: unknown) => unknown) => (message: MessageEvent) => {
        if (disposed || current !== stream) return;
        try {
          handler(JSON.parse(message.data));
        } catch {
          adapter.disconnect();
          current.close();
          onError?.("SCOUT 数据校验失败，已关闭连接。");
        }
      };
    current.addEventListener(
      "status",
      apply((value) => {
        if (adapter.ingestStatus(value)) {
          // A new journal epoch requires replay from zero, not an old Last-Event-ID.
          clearTimeout(retry);
          retry = undefined;
          current.close();
          stream = open();
        }
      }),
    );
    current.addEventListener(
      "record",
      apply((value) => adapter.ingestRecord(value)),
    );
    current.onerror = () => {
      if (disposed || current !== stream) return;
      adapter.disconnect();
      onError?.("SCOUT 事件流断开；正在等待重连。");
      // Ordinary network drops retain native cursor resume. A terminal HTTP error
      // (e.g. cursor-ahead after a journal change) needs a fresh connection.
      if (current.readyState === EventSource.CLOSED && !retry)
        retry = setTimeout(() => {
          retry = undefined;
          if (!disposed) stream = open();
        }, 2000);
    };
    return current;
  };
  stream = open();
  return () => {
    disposed = true;
    clearTimeout(retry);
    stream.close();
    adapter.disconnect();
  };
}

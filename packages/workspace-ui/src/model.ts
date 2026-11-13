import { z } from "zod";
import { translate, type Locale } from "./i18n/core.ts";

const id = z.string().min(1).max(160);
const text = z.string().trim().min(1).max(4000);
const time = z.iso.datetime();
export const capabilitySchema = z.enum([
  "chat",
  "assign_task",
  "request_review",
  "cancel_task",
  "publish",
]);
export type Capability = z.infer<typeof capabilitySchema>;
export const modeSchema = z.enum(["demo", "live", "replay"]);

export const agentSchema = z.strictObject({
  id,
  name: text,
  role: z.enum(["supervisor", "worker", "reviewer", "unknown"]),
  status: z.enum(["idle", "working", "blocked", "review", "unknown"]),
  is_demo: z.boolean(),
  mode: modeSchema,
  room_id: id,
  task_id: id.optional(),
  source: text,
  source_ref: text,
  observed_at: time,
  capabilities: z.array(capabilitySchema),
});
export type Agent = z.infer<typeof agentSchema>;

export const taskSchema = z.strictObject({
  id,
  agent_id: id,
  title: text,
  status: z.enum([
    "planned",
    "active",
    "blocked",
    "review",
    "completed",
    "failed",
    "cancelled",
    "unknown",
  ]),
  detail: text,
  evidence: z.array(
    z.strictObject({ label: text, ref: text, verified: z.boolean() }),
  ),
});
export type Task = z.infer<typeof taskSchema>;

// Mirrors schema/agent-event.schema.json. Envelope metadata stays outside the event.
export const agentEventSchema = z.strictObject({
  schema_version: z.literal("1.0"),
  event_id: id,
  project_id: id,
  agent_id: id,
  room_id: id.optional(),
  event_type: z.enum([
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
  ]),
  occurred_at: time,
  observed_at: time,
  source: text,
  source_ref: text.optional(),
  is_demo: z.boolean(),
  message: text.optional(),
  command_id: id.optional(),
});
export type AgentEvent = z.infer<typeof agentEventSchema>;

export const commandSchema = z.strictObject({
  command_id: id,
  project_id: id,
  agent_id: id,
  requester_id: id,
  created_at: time,
  action: capabilitySchema,
  text,
  task_id: id.optional(),
});
export type Command = z.infer<typeof commandSchema>;
export const outcomeSchema = z.enum([
  "received",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "rejected",
  "cancelled",
]);
export const receiptSchema = z.strictObject({
  command: commandSchema,
  status: outcomeSchema,
  detail: text,
  observed_at: time,
  result: text.optional(),
  approval_id: id.optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;
export const approvalSchema = z.strictObject({
  id,
  command: commandSchema,
  reason: text,
  scope: z.string().min(1).max(6000),
  status: z.enum(["pending", "approved", "denied"]),
  expires_at: time,
});
export type Approval = z.infer<typeof approvalSchema>;
export const decisionSchema = z.strictObject({
  approval_id: id,
  command_id: id,
  requester_id: id,
  decision: z.enum(["approve", "deny"]),
});
export type ApprovalDecision = z.infer<typeof decisionSchema>;

export const snapshotSchema = z.strictObject({
  project_id: id,
  revision: z.number().int().nonnegative(),
  mode: modeSchema,
  connected: z.boolean(),
  stale: z.boolean().default(false),
  observed_at: time,
  source: text,
  agents: z.array(agentSchema),
  tasks: z.array(taskSchema),
  events: z.array(agentEventSchema),
  receipts: z.array(receiptSchema),
  approvals: z.array(approvalSchema),
  event_modes: z.record(z.string(), modeSchema).default({}),
});
export type WorkspaceSnapshot = z.infer<typeof snapshotSchema>;

export interface WorkspaceAdapter {
  /** Immutable cached snapshots; notify subscribers on replacement. Never expose credentials. */
  getSnapshot: () => WorkspaceSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** The trusted bridge MUST independently revalidate authority, scope and capabilities. */
  send: (command: Command) => Promise<Receipt>;
  decide: (decision: ApprovalDecision) => Promise<Receipt>;
}

export const STALE_AFTER_MS = 60_000;
export function connectionLabel(
  snapshot: WorkspaceSnapshot,
  now = Date.now(),
  locale: Locale = "zh-CN",
) {
  const mode = translate(locale, `common.mode.${snapshot.mode}`);
  if (!snapshot.connected)
    return `${mode} · ${translate(locale, "common.disconnected")}`;
  if (snapshot.stale || now - Date.parse(snapshot.observed_at) > STALE_AFTER_MS)
    return `${mode} · ${translate(locale, "common.stale")}`;
  return mode;
}
export function agentConnectionLabel(
  snapshot: WorkspaceSnapshot,
  agent: Agent,
  now = Date.now(),
  locale: Locale = "zh-CN",
) {
  const base = connectionLabel(
    { ...snapshot, mode: agent.mode, observed_at: agent.observed_at },
    now,
    locale,
  );
  return agent.is_demo && agent.mode !== "demo"
    ? `${translate(locale, "common.mode.demo")} · ${base}`
    : base;
}
export function safeEvidenceUrl(ref: string): string | undefined {
  try {
    const url = new URL(ref);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function freezeSnapshot(value: WorkspaceSnapshot): WorkspaceSnapshot {
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(value);
  return value;
}

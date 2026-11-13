import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_PROMPT, CODEX_AGENT, CODEX_PROJECT, CODEX_REQUESTER, CodexTextSession, TEXT_CONFIG,
  fileAudit, type Audit, type AuditEntry, type Rpc,
} from "../server/codex-session";
import type { Command } from "../src/model";
import { mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

class ProtocolFixture implements Rpc {
  calls: { method: string; params: any }[] = [];
  listeners = new Set<(value: any) => void>();
  config: any = structuredClone(TEXT_CONFIG);
  reply = "DEVUNGEON-CHECK-42";
  hold = false;
  turns = 0;
  closed = false;
  request = async (method: string, params: any) => {
    this.calls.push({ method, params });
    if (method === "permissionProfile/list") return { data: [{ id: ":read-only", allowed: true }] };
    if (method === "config/read") return { config: this.config };
    if (method === "thread/start") return { thread: { id: `thread-${this.turns + 1}` } };
    if (method === "turn/start") {
      this.turns++;
      if (!this.hold) queueMicrotask(() => this.finish());
      return { turn: { id: `turn-${this.turns}` } };
    }
    return {};
  };
  emit(method: string, params: unknown) { this.listeners.forEach((listener) => listener({ method, params })); }
  finish(threadId = `thread-${this.turns}`, turnId = `turn-${this.turns}`) {
    this.emit("turn/started", { threadId, turn: { id: turnId } });
    this.emit("item/completed", { threadId, turnId, item: { type: "agentMessage", phase: "final_answer", text: this.reply } });
    this.emit("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }
  subscribe(listener: (value: any) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close() { this.closed = true; this.emit("local/disconnected", {}); }
}
function command(patch: Partial<Command> = {}): Command {
  return { command_id: crypto.randomUUID(), project_id: CODEX_PROJECT, agent_id: CODEX_AGENT,
    requester_id: CODEX_REQUESTER, action: "chat", text: CHECK_PROMPT, created_at: new Date().toISOString(), ...patch };
}
const sessions: CodexTextSession[] = [];
function setup(options: { approved?: boolean; entries?: AuditEntry[]; append?: Audit["append"] } = {}) {
  const rpc = new ProtocolFixture();
  const entries = options.entries ?? [];
  const audit: Audit = { read: vi.fn(async () => entries), append: options.append ?? vi.fn(async (entry) => { entries.push(entry); }) };
  const createRpc = vi.fn(() => rpc);
  const session = new CodexTextSession({ approved: options.approved ?? true, cwd: "C:/synthetic-only",
    audit, createRpc, timeoutMs: 100 });
  sessions.push(session);
  return { session, rpc, audit, createRpc, entries };
}
async function receipt(session: CodexTextSession, id: string, status: string) {
  await vi.waitFor(async () => expect((await session.snapshot()).receipts.find((item) => item.command.command_id === id)?.status).toBe(status));
  return (await session.snapshot()).receipts.find((item) => item.command.command_id === id)!;
}
afterEach(() => { sessions.splice(0).forEach((session) => session.close()); vi.useRealTimers(); });

describe("experimental host-only Codex text authority (protocol fixtures, zero inference)", () => {
  it("default-off never creates a provider process or reads audit on GET or forged POST", async () => {
    const { session, createRpc, audit } = setup({ approved: false });
    expect((await session.snapshot()).connected).toBe(false);
    await expect(session.send(command())).rejects.toThrow("未获启用");
    expect(createRpc).not.toHaveBeenCalled();
    expect(audit.read).not.toHaveBeenCalled();
  });
  it("rejects cross-project, actor, requester, capabilities, stale input and payload widening before protocol access", async () => {
    const { session, createRpc } = setup();
    for (const patch of [ { project_id: "github:private" }, { agent_id: "another" }, { requester_id: "other" },
      { action: "publish" as const }, { action: "assign_task" as const }, { task_id: "task" },
      { text: "x".repeat(1001) }, { created_at: new Date(0).toISOString() } ])
      await expect(session.send(command(patch))).rejects.toThrow();
    await expect(session.send({ ...command(), cwd: "C:/private" })).rejects.toThrow();
    expect(createRpc).not.toHaveBeenCalled();
  });
  it("does not treat CLI initialization as a model turn and fails closed on ineffective tool overrides", async () => {
    const { session, rpc } = setup();
    rpc.config.mcp_servers = { privileged: { command: "anything" } };
    expect((await session.snapshot()).connected).toBe(false);
    await expect(session.send(command())).rejects.toThrow();
    expect(rpc.turns).toBe(0);
    expect(rpc.closed).toBe(true);
    expect(rpc.calls.map((call) => call.method)).not.toContain("thread/start");
  });
  it("acks once, accepts correlated final text only and independently checks the synthetic challenge", async () => {
    const { session, rpc, entries } = setup();
    const request = command();
    expect((await session.send(request)).status).toBe("received");
    const result = await receipt(session, request.command_id, "completed");
    expect(result.result).toBe("DEVUNGEON-CHECK-42");
    expect((await session.snapshot()).events.map((event) => event.event_type)).toEqual(["progress", "progress", "started", "command_result", "tested"]);
    const events = (await session.snapshot()).events;
    expect(events[0].source).toBe("devungeon-codex-text-bridge");
    expect(events[2].source).toBe("codex-app-server");
    expect(events.at(-1)?.source).toBe("devungeon-codex-text-bridge");
    expect((await session.snapshot()).events.every((event) => !event.is_demo && event.command_id === request.command_id)).toBe(true);
    expect(entries.at(-1)?.phase).toBe("completed");
    expect(JSON.stringify(entries)).not.toContain(request.text);
    const start = rpc.calls.find((call) => call.method === "thread/start")!.params;
    expect(start).toMatchObject({ ephemeral: true, permissions: ":read-only", approvalPolicy: "never", environments: [], runtimeWorkspaceRoots: [], selectedCapabilityRoots: [], dynamicTools: [] });
    expect(rpc.calls.some((call) => /resume|list_threads|account|login|approval/i.test(call.method))).toBe(false);
  });
  it("retains a negative independent check without claiming acceptance", async () => {
    const { session, rpc } = setup();
    rpc.reply = "I finished all project work";
    const request = command();
    await session.send(request);
    await receipt(session, request.command_id, "completed");
    const state = await session.snapshot();
    expect(state.events.at(-1)?.event_type).toBe("failed");
    expect(state.tasks).toEqual([]);
    expect(state.approvals).toEqual([]);
  });
  it("deduplicates same-ID retries but refuses changed content and a concurrent third-party request", async () => {
    const { session, rpc } = setup();
    rpc.hold = true;
    const request = command();
    await session.send(request);
    expect((await session.send(request)).status).toBe("received");
    await expect(session.send({ ...request, text: "different" })).rejects.toThrow("不可更改");
    await expect(session.send(command())).rejects.toThrow("正在处理");
    await vi.waitFor(() => expect(rpc.turns).toBe(1));
    rpc.finish();
    await receipt(session, request.command_id, "completed");
    expect((await session.send(request)).status).toBe("completed");
    expect(rpc.turns).toBe(1);
  });
  it("reserves the process-independent two-turn limit before any provider turn", async () => {
    const { session, rpc } = setup();
    const first = command();
    await session.send(first);
    await receipt(session, first.command_id, "completed");
    const second = command();
    await session.send(second);
    await receipt(session, second.command_id, "completed");
    await expect(session.send(command())).rejects.toThrow("额度已用尽");
    expect(rpc.turns).toBe(2);
    expect((await session.snapshot()).agents[0].capabilities).toEqual([]);
    const old = setup({ entries: [{ command_id: "old-1", fingerprint: "a".repeat(64), phase: "completed", at: new Date().toISOString() },
      { command_id: "old-2", fingerprint: "b".repeat(64), phase: "completed", at: new Date().toISOString() }] });
    await expect(old.session.send(command())).rejects.toThrow("额度已用尽");
    expect(old.rpc.turns).toBe(0);
    await expect(old.session.send(command({ command_id: "old-1" }))).rejects.toThrow("先前进程");
  });
  it("refuses provider execution when the durable reservation fails", async () => {
    const { session, rpc } = setup({ append: async () => { throw new Error("disk unavailable"); } });
    await expect(session.send(command())).rejects.toThrow("审计");
    expect((await session.snapshot()).connected).toBe(false);
    expect(rpc.calls.some((call) => call.method === "thread/start")).toBe(false);
  });
  it("a timeout becomes unknown, attempts interrupt, preserves dedupe and disables new execution", async () => {
    const { session, rpc } = setup();
    rpc.hold = true;
    const request = command();
    await session.send(request);
    await vi.waitFor(() => expect(rpc.turns).toBe(1));
    // Establish the provider turn id without a completion.
    rpc.emit("turn/started", { threadId: "thread-1", turn: { id: "turn-1" } });
    const result = await receipt(session, request.command_id, "failed");
    expect(result.detail).toContain("远端结果未知");
    expect((await session.snapshot()).connected).toBe(false);
    expect(rpc.calls.some((call) => call.method === "turn/interrupt")).toBe(true);
    expect((await session.send(request)).status).toBe("failed");
    await expect(session.send(command())).rejects.toThrow();
    expect(rpc.turns).toBe(1);
  });
  it("ignores an unrelated thread's completion and uses untrusted output as text only", async () => {
    const { session, rpc } = setup();
    rpc.hold = true;
    const request = command();
    await session.send(request);
    await vi.waitFor(() => expect(rpc.turns).toBe(1));
    rpc.reply = "<script>publish()</script>";
    rpc.finish("private-history", "foreign-turn");
    expect((await session.snapshot()).receipts[0].status).toBe("received");
    rpc.finish();
    expect((await receipt(session, request.command_id, "completed")).result).toBe(rpc.reply);
    expect((await session.snapshot()).tasks).toHaveLength(0);
    expect((await session.snapshot()).approvals).toHaveLength(0);
  });
  it("idle process disconnection immediately revokes chat and HTTP polling does not renew source evidence", async () => {
    const { session, rpc } = setup();
    const connected = await session.snapshot();
    expect(connected.connected).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    expect((await session.snapshot()).observed_at).toBe(connected.observed_at);
    rpc.close();
    const disconnected = await session.snapshot();
    expect(disconnected.connected).toBe(false);
    expect(disconnected.observed_at).toBe(connected.observed_at);
    expect(disconnected.agents[0].capabilities).toEqual([]);
    await expect(session.send(command())).rejects.toThrow();
    expect(rpc.calls.some((call) => call.method === "thread/start")).toBe(false);
  });
  it.each(["reserved", "unknown"] as const)("a prior %s command cannot be bypassed by restarting", async (phase) => {
    const { session, createRpc } = setup({ entries: [{ command_id: "unresolved-command", fingerprint: "a".repeat(64), phase, at: new Date().toISOString() }] });
    const state = await session.snapshot();
    expect(state.connected).toBe(false);
    expect(state.source).toContain("unresolved-command");
    await expect(session.send(command())).rejects.toThrow();
    expect(createRpc).not.toHaveBeenCalled();
  });
  it("takes a real exclusive filesystem lock; another host cannot read-and-reserve the same budget", async () => {
    const directory = await mkdtemp(join(tmpdir(), "devungeon-text-lock-"));
    const first = fileAudit(join(directory, "audit.jsonl"));
    const second = fileAudit(join(directory, "audit.jsonl"));
    try {
      await first.acquire!();
      await expect(second.acquire!()).rejects.toMatchObject({ code: "EEXIST" });
      await first.release!();
      await second.acquire!();
      await second.release!();
    } finally {
      await first.release!();
      await second.release!();
      await rmdir(directory); // own empty directory only; never recursive cleanup
    }
  });
  it("releases a lock that arrives after the host was closed during initialization", async () => {
    let finish = () => {};
    let owned = false;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const createRpc = vi.fn(() => new ProtocolFixture());
    const session = new CodexTextSession({ approved: true, cwd: "C:/synthetic-only", createRpc,
      audit: { acquire: async () => { await gate; owned = true; }, release: async () => { owned = false; },
        read: async () => [], append: async () => {} } });
    sessions.push(session);
    const pending = session.snapshot();
    session.close();
    finish();
    await pending;
    expect(owned).toBe(false);
    expect(createRpc).not.toHaveBeenCalled();
  });
});

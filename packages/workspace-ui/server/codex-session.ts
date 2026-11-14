import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, appendFile, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { commandSchema, freezeSnapshot, snapshotSchema } from "../src/model.ts";
import type { Command, Receipt, WorkspaceSnapshot } from "../src/model.ts";

export const CODEX_PROJECT = "local:codex-text-check";
export const CODEX_AGENT = "native-codex";
export const CODEX_REQUESTER = "local-owner";
export const CHECK_PROMPT = "仅回复 DEVUNGEON-CHECK-42，不要添加其他内容。";
export const TEXT_CONFIG = {
  mcp_servers: {},
  notify: [],
  web_search: "disabled",
  project_doc_max_bytes: 0,
  features: {
    respect_system_proxy: true,
    shell_tool: false,
    view_image: false,
    apps: false,
    hooks: false,
    remote_plugin: false,
    memories: false,
    multi_agent: false,
    skill_mcp_dependency_install: false,
    code_mode: { enabled: false },
  },
  memories: { use_memories: false, generate_memories: false },
};
export interface Rpc {
  request(method: string, params: unknown): Promise<any>;
  subscribe(listener: (message: any) => void): () => void;
  close(): void;
}
export interface AuditEntry {
  command_id: string;
  fingerprint: string;
  phase: "reserved" | "completed" | "failed" | "unknown";
  at: string;
  thread_id?: string;
  turn_id?: string;
}
export interface Audit {
  acquire?(): Promise<void>;
  release?(): Promise<void>;
  read(): Promise<AuditEntry[]>;
  append(entry: AuditEntry): Promise<void>;
}
/** Fixed host-owned path only. No prompts, replies, raw config or credentials. */
export function fileAudit(path: string): Audit {
  const lockPath = `${path}.lock`;
  const owner = JSON.stringify({ pid: process.pid, owner: randomUUID(), project_id: CODEX_PROJECT });
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  return {
    async acquire() {
      await mkdir(dirname(path), { recursive: true });
      // Exclusive creation is atomic across Node processes. A crash leaves the
      // lock in place and fails closed; elapsed time is never proof of release.
      lock = await open(lockPath, "wx", 0o600);
      await lock.writeFile(owner);
    },
    async release() {
      if (!lock) return;
      const owned = lock;
      lock = undefined;
      await owned.close();
      if (await readFile(lockPath, "utf8") === owner) await unlink(lockPath);
    },
    async read() {
      try {
        return (await readFile(path, "utf8"))
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const entry = JSON.parse(line);
            if (
              typeof entry.command_id !== "string" ||
              !/^[a-f0-9]{64}$/.test(entry.fingerprint) ||
              !["reserved", "completed", "failed", "unknown"].includes(entry.phase)
            ) throw new Error("Invalid local audit; execution is disabled");
            return entry as AuditEntry;
          });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
    async append(entry) {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, JSON.stringify(entry) + "\n", { mode: 0o600 });
    },
  };
}
const now = () => new Date().toISOString();
const fingerprint = (command: Command) =>
  createHash("sha256").update(JSON.stringify(command)).digest("hex");

/** Experimental text-only authority. No caller-supplied RPC, cwd, model, profile,
 * config, tool, thread or turn identifier can cross this boundary. Default OFF.
 * Each request owns a new ephemeral thread; nothing resumes account history.
 */
export class CodexTextSession {
  private state: WorkspaceSnapshot;
  private rpc?: Rpc;
  private boot?: Promise<void>;
  private receipts = new Map<string, { hash: string; receipt: Receipt }>();
  private reservations = new Map<string, string>();
  private busy = false;
  private uncertain = false;
  private closed = false;
  private stopConnection = () => {};
  private heartbeat?: Promise<void>;
  private active?: { thread: string; turn?: string };
  constructor(private options: {
    approved: boolean;
    cwd: string;
    audit: Audit;
    createRpc: () => Rpc;
    timeoutMs?: number;
  }) {
    this.state = snapshotSchema.parse({
      project_id: CODEX_PROJECT, revision: 0, mode: "live", connected: false,
      observed_at: new Date(0).toISOString(),
      source: "Codex 文本试验 · 未启用 · 不会发送模型请求",
      agents: [{ id: CODEX_AGENT, name: "Codex · 文本试验", role: "worker",
        status: "unknown", is_demo: false, mode: "live", room_id: "forge",
        source: "本地连接器声明的角色；尚无推理验证", source_ref: "local:codex-text-check",
        observed_at: new Date(0).toISOString(), capabilities: [] }],
      tasks: [], events: [], receipts: [], approvals: [], event_modes: {},
    });
  }
  private update(patch: Partial<WorkspaceSnapshot> = {}) {
    this.state = freezeSnapshot(snapshotSchema.parse({ ...this.state, ...patch,
      revision: this.state.revision + 1 }));
  }
  async snapshot(): Promise<WorkspaceSnapshot> {
    if (this.options.approved && !this.closed && !this.uncertain) {
      try { await this.initialize(); }
      catch { /* The sanitized unavailable state is already retained. */ }
    }
    // Browser polling is not source evidence. Refresh only on a real RPC reply.
    if (this.state.connected && Date.now() - Date.parse(this.state.observed_at) > 20_000) {
      this.heartbeat ??= this.probe().finally(() => { this.heartbeat = undefined; });
      await this.heartbeat;
    }
    return this.state;
  }
  private initialize() {
    if (!this.boot) this.boot = this.open().catch(async (error) => {
      this.rpc?.close();
      try { await this.options.audit.release?.(); } catch { /* preserve a failed-closed lock */ }
      this.update({ connected: false, source: "Codex 文本试验 · 预检失败；未发送模型请求" });
      throw error;
    });
    return this.boot;
  }
  private async open() {
    if (!this.options.approved || this.closed) throw new Error("模型调用未获启用");
    await this.options.audit.acquire?.();
    if (this.closed) throw new Error("Session was disposed");
    const entries = await this.options.audit.read();
    if (this.closed) throw new Error("Session was disposed");
    for (const entry of entries) this.reservations.set(entry.command_id, entry.fingerprint);
    const phases = new Map<string, AuditEntry>();
    for (const entry of entries) phases.set(entry.command_id, entry);
    const unresolved = [...phases.values()].filter((entry) => entry.phase === "reserved" || entry.phase === "unknown");
    if (unresolved.length) {
      this.uncertain = true;
      this.update({ source: `先前指令结果未核对：${unresolved.map((entry) => entry.command_id).join(", ").slice(0, 3000)}；禁止新 turn。` });
      return;
    }
    this.rpc = this.options.createRpc();
    this.stopConnection = this.rpc.subscribe((message) => {
      if (message.method !== "local/disconnected") return;
      this.uncertain = true;
      this.update({ connected: false, source: "Codex 本地协议已断开；没有自动重试或刷新来源时间",
        agents: this.state.agents.map((agent) => ({ ...agent, status: "unknown", capabilities: [] })) });
    });
    await this.rpc.request("initialize", {
      clientInfo: { name: "devungeon_text_trial", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    await this.rpc.request("initialized", {});
    const profiles = await this.rpc.request("permissionProfile/list", { cwd: this.options.cwd, limit: 50 });
    if (!profiles.data?.some((profile: any) => profile.id === ":read-only" && profile.allowed))
      throw new Error("Read-only permission profile is unavailable");
    // Fail closed if config layering changes or a future CLI drops an override.
    // Raw config never leaves this Node module or enters audit/browser responses.
    const { config } = await this.rpc.request("config/read", { includeLayers: false, cwd: this.options.cwd });
    if (
      !config || !config.mcp_servers || Object.keys(config.mcp_servers).length !== 0 ||
      config.web_search !== "disabled" ||
      !config.features || Object.entries(TEXT_CONFIG.features).some(([key, value]) =>
        JSON.stringify(config.features[key]) !== JSON.stringify(value)) ||
      !Array.isArray(config.notify) || config.notify.length !== 0 ||
      config.project_doc_max_bytes !== 0 ||
      config.memories?.use_memories !== false || config.memories?.generate_memories !== false
    ) throw new Error("Text-only configuration was not confirmed");
    const available = this.reservations.size < 2;
    this.update({ connected: true, observed_at: now(),
      source: `Codex 文本试验 · 本地协议已连接 · 最多 2 个 turn · 已保留 ${this.reservations.size}/2`,
      agents: this.state.agents.map((agent) => ({ ...agent, status: "idle", observed_at: now(),
        capabilities: available ? ["chat"] : [],
        source: "真实 Codex App Server；文本试验，不能读写工程或调用工具" })) });
  }
  private async probe() {
    try {
      await this.rpc!.request("permissionProfile/list", { cwd: this.options.cwd, limit: 1 });
      if (this.closed || this.uncertain || !this.state.connected) return;
      this.update({ observed_at: now(), agents: this.state.agents.map((agent) => ({ ...agent, observed_at: now() })) });
    } catch {
      this.rpc?.close();
    }
  }
  private emit(command: Command, type: "started" | "progress" | "command_result" | "failed" | "tested", message: string, ref?: string, provider = false) {
    const at = now();
    const event = { schema_version: "1.0" as const, event_id: randomUUID(),
      project_id: CODEX_PROJECT, agent_id: CODEX_AGENT, room_id: "forge",
      event_type: type, occurred_at: at, observed_at: at, source: provider ? "codex-app-server" : "devungeon-codex-text-bridge",
      is_demo: false, command_id: command.command_id, message,
      ...(ref ? { source_ref: ref } : {}) };
    this.update({ events: [...this.state.events, event].slice(-100) });
  }
  private receipt(command: Command, status: Receipt["status"], detail: string, result?: string) {
    const value: Receipt = { command, status, detail, observed_at: now(), ...(result ? { result } : {}) };
    this.receipts.set(command.command_id, { hash: fingerprint(command), receipt: value });
    this.update({ receipts: [...this.receipts.values()].map((item) => item.receipt) });
    return value;
  }
  /** Serializes authorization and reservation before releasing the HTTP receipt. */
  async send(raw: unknown): Promise<Receipt> {
    const command = commandSchema.parse(raw);
    if (!this.options.approved || this.closed) throw new Error("模型调用未获启用；没有发送");
    if (command.project_id !== CODEX_PROJECT || command.agent_id !== CODEX_AGENT ||
      command.requester_id !== CODEX_REQUESTER || command.action !== "chat" || command.task_id ||
      command.text.length > 1000 || Math.abs(Date.now() - Date.parse(command.created_at)) > 60_000)
      throw new Error("仅允许当前合成项目的 1000 字以内文本聊天；没有发送");
    await this.initialize();
    const hash = fingerprint(command);
    const previous = this.receipts.get(command.command_id);
    if (previous) {
      if (previous.hash !== hash) throw new Error("同一 command_id 的内容不可更改");
      return previous.receipt;
    }
    if (this.reservations.has(command.command_id))
      throw new Error("该指令来自先前进程；请人工核对原始记录，禁止自动重试");
    if (this.uncertain || !this.state.connected || this.busy || this.reservations.size >= 2)
      throw new Error("连接不可用、正在处理或两次 turn 额度已用尽；没有发送");
    this.busy = true; // set before await: concurrent requests cannot race the budget
    try {
      await this.options.audit.append({ command_id: command.command_id, fingerprint: hash, phase: "reserved", at: now() });
      this.reservations.set(command.command_id, hash);
    } catch {
      this.busy = false;
      this.uncertain = true;
      this.update({ connected: false, source: "本地审计不可用；未发送模型请求" });
      throw new Error("无法保留审计记录；没有发送");
    }
    const receipt = this.receipt(command, "received", "可信本地桥接已接收；等待 Codex，尚无执行结果。");
    this.emit(command, "progress", "本地已保留唯一指令与 turn 额度；尚未收到 Codex turn 确认。");
    void this.execute(command, hash);
    return receipt;
  }
  private async execute(command: Command, hash: string) {
    let stop = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let final = "";
    let confirmed = false;
    const working = (turnId: string) => {
      if (confirmed || !this.active || this.closed || this.uncertain) return;
      confirmed = true;
      this.active.turn = turnId;
      this.update({ observed_at: now(), agents: this.state.agents.map((agent) => ({ ...agent, status: "working", observed_at: now() })) });
      this.emit(command, "started", "Codex 已确认本次 turn。", `codex:thread:${this.active.thread}/turn:${turnId}`, true);
    };
    try {
      const rpc = this.rpc!;
      const { thread } = await rpc.request("thread/start", {
        cwd: this.options.cwd, permissions: ":read-only", approvalPolicy: "never",
        ephemeral: true, environments: [], runtimeWorkspaceRoots: [], selectedCapabilityRoots: [], dynamicTools: [],
        baseInstructions: "You are a text-only assistant in an isolated Devungeon connector test. Respond to the supplied text only. No tools, files, MCP, network actions, skills, account history or delegation are permitted. Do not claim to have performed project work. Keep the reply below 3000 characters.",
        developerInstructions: "A chat reply does not verify project completion or grant permission for any action.",
        config: TEXT_CONFIG,
      });
      if (!thread?.id || typeof thread.id !== "string") throw new Error("Thread acknowledgement missing");
      this.active = { thread: thread.id };
      await this.options.audit.append({ command_id: command.command_id, fingerprint: hash, phase: "reserved", at: now(), thread_id: thread.id });
      this.emit(command, "progress", "Codex 已创建独立临时会话，尚未确认 turn。", `codex:thread:${thread.id}`);
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("remote_unknown")), this.options.timeoutMs ?? 90_000);
        stop = rpc.subscribe((message) => {
          if (message.method === "local/disconnected") { reject(new Error("remote_unknown")); return; }
          const p = message.params;
          if (p?.threadId !== this.active?.thread) return;
          if (message.method === "turn/started" && typeof p.turn?.id === "string")
            working(p.turn.id);
          if (message.method === "item/completed" && p.turnId === this.active?.turn && p.item?.type === "agentMessage" &&
            (!p.item.phase || p.item.phase === "final_answer") && typeof p.item.text === "string") final = p.item.text;
          if (message.method === "turn/completed" && p.turn?.id === this.active?.turn) {
            if (p.turn.status === "completed" && final.trim()) resolve();
            else reject(new Error("remote_unknown"));
          }
        });
        void rpc.request("turn/start", {
          threadId: thread.id, permissions: ":read-only", approvalPolicy: "never", environments: [], runtimeWorkspaceRoots: [],
          input: [{ type: "text", text: command.text, text_elements: [] }],
          effort: "low", summary: "none", serviceTierForTurn: "default",
          clientUserMessageId: command.command_id,
        }).then(({ turn }) => {
          if (this.active && typeof turn?.id === "string") working(turn.id);
        }, reject);
      });
      if (this.closed) throw new Error("remote_unknown");
      // Provider output remains untrusted text; no HTML, action or acceptance is derived from it.
      const truncated = final.length > 3000;
      const result = final.slice(0, 3000) + (truncated ? "\n[回复已截短]" : "");
      await this.options.audit.append({ command_id: command.command_id, fingerprint: hash,
        phase: "completed", at: now(), thread_id: this.active?.thread, turn_id: this.active?.turn });
      this.receipt(command, "completed", "Codex turn 已结束；这里只确认文本回复，不代表项目工作通过验收。", result);
      this.emit(command, "command_result", "已收到 Codex 最终文本回复。", `codex:thread:${thread.id}/turn:${this.active?.turn}`, true);
      if (command.text === CHECK_PROMPT) {
        const passed = final.trim() === "DEVUNGEON-CHECK-42";
        this.emit(command, passed ? "tested" : "failed", passed
          ? "独立字符串校验通过；仅验证本次文本闭环。" : "独立字符串校验未通过；不标记验收。");
      }
    } catch {
      this.uncertain = true;
      if (this.active?.turn) void this.rpc?.request("turn/interrupt", {
        threadId: this.active.thread, turnId: this.active.turn,
      }).catch(() => {});
      try { await this.options.audit.append({ command_id: command.command_id, fingerprint: hash,
        phase: "unknown", at: now(), thread_id: this.active?.thread, turn_id: this.active?.turn }); } catch { /* fail closed */ }
      this.receipt(command, "failed", "本地观察未完成；远端结果未知。已停止新请求并尝试中断，不能据此宣称已取消。请核对审计 ID。");
      this.emit(command, "failed", "观察或审计失败；远端状态未知，禁止自动重试。");
      this.update({ connected: false, source: "Codex 文本试验 · 结果未知；需要人工核对" });
    } finally {
      stop();
      clearTimeout(timer);
      this.busy = false;
      this.active = undefined;
      this.update({ agents: this.state.agents.map((agent) => ({ ...agent,
        status: this.uncertain ? "unknown" : "idle",
        capabilities: !this.uncertain && this.reservations.size < 2 ? ["chat"] : [] })) });
    }
  }
  close() {
    this.closed = true;
    this.uncertain = true;
    this.stopConnection();
    this.rpc?.close();
    void this.options.audit.release?.().catch(() => {});
    this.update({ connected: false });
  }
}

import {
  commandSchema,
  decisionSchema,
  freezeSnapshot,
  receiptSchema,
  snapshotSchema,
  STALE_AFTER_MS,
} from "./model";
import type {
  ApprovalDecision,
  Capability,
  Command,
  Receipt,
  WorkspaceAdapter,
  WorkspaceSnapshot,
} from "./model";

/** Work-only state owner. No GameState, HP, inventory or acceptance mutation API. */
export class WorkspaceController implements WorkspaceAdapter {
  private state: WorkspaceSnapshot;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private pending = new Map<
    string,
    { fingerprint: string; promise: Promise<Receipt> }
  >();
  constructor(
    private adapter: WorkspaceAdapter,
    readonly requesterId: string,
    readonly projectId: string,
    private options: { observationTimeoutMs?: number } = {},
  ) {
    this.state = this.validate(adapter.getSnapshot());
    this.unsubscribe = adapter.subscribe(() => {
      try {
        const next = this.validate(adapter.getSnapshot());
        if (next.revision <= this.state.revision) return;
        this.state = next;
      } catch {
        this.state = freezeSnapshot({ ...this.state, connected: false });
      }
      this.listeners.forEach((listener) => listener());
    });
  }
  private validate(raw: unknown) {
    const next = snapshotSchema.parse(raw);
    if (next.project_id !== this.projectId)
      throw new Error("收到跨项目的工作台数据。");
    const ids = new Set<string>();
    for (const event of next.events) {
      const mode = next.event_modes[event.event_id] ?? next.mode;
      if (
        event.project_id !== next.project_id ||
        ids.has(event.event_id) ||
        (mode === "demo" && !event.is_demo) ||
        (mode === "live" && event.is_demo)
      )
        throw new Error("事件来源、项目或唯一性校验失败。");
      ids.add(event.event_id);
    }
    if (
      new Set(next.agents.map((a) => a.id)).size !== next.agents.length ||
      new Set(next.tasks.map((t) => t.id)).size !== next.tasks.length
    )
      throw new Error("实体 ID 重复。");
    for (const task of next.tasks)
      if (!next.agents.some((agent) => agent.id === task.agent_id))
        throw new Error("任务目标不存在。");
    for (const agent of next.agents) {
      if (
        (agent.mode === "demo" && !agent.is_demo) ||
        (agent.mode === "live" && agent.is_demo)
      )
        throw new Error("角色模式与来源冲突。");
      if (
        agent.task_id &&
        !next.tasks.some(
          (task) => task.id === agent.task_id && task.agent_id === agent.id,
        )
      )
        throw new Error("Agent 与当前任务不匹配。");
    }
    for (const item of [...next.receipts, ...next.approvals]) {
      if (
        item.command.project_id !== this.projectId ||
        !next.agents.some((agent) => agent.id === item.command.agent_id)
      )
        throw new Error("审批或回执超出项目范围。");
    }
    return freezeSnapshot(next);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  createCommand(
    agentId: string,
    action: Capability,
    text: string,
    taskId?: string,
  ): Command {
    return commandSchema.parse({
      command_id: crypto.randomUUID(),
      project_id: this.projectId,
      requester_id: this.requesterId,
      agent_id: agentId,
      action,
      text,
      created_at: new Date().toISOString(),
      ...(taskId ? { task_id: taskId } : {}),
    });
  }
  private guard(command: Command) {
    if (
      command.project_id !== this.projectId ||
      command.requester_id !== this.requesterId
    )
      throw new Error("项目或请求者不匹配。");
    if (!this.state.connected) throw new Error("未连接；没有发送。");
    if (this.state.mode === "replay")
      throw new Error("历史回放只读；没有发送。");
    if (
      this.state.stale ||
      Date.now() - Date.parse(this.state.observed_at) > STALE_AFTER_MS
    )
      throw new Error("状态已过期；请重新连接后核对。");
    const agent = this.state.agents.find(
      (agent) => agent.id === command.agent_id,
    );
    if (!agent?.capabilities.includes(command.action))
      throw new Error("该 Agent 不支持此操作。");
    if (
      agent.mode === "replay" ||
      Date.now() - Date.parse(agent.observed_at) > STALE_AFTER_MS
    )
      throw new Error("角色状态为回放或已过期；没有发送。");
  }
  /** Observation timeout never cancels the provider or releases its in-flight command ID. */
  private observe(promise: Promise<Receipt>): Promise<Receipt> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error("等待回执超时。远端状态未知；请凭原始指令 ID 核对。"),
          ),
        this.options.observationTimeoutMs ?? 10000,
      );
      promise.then(
        (receipt) => {
          clearTimeout(timeout);
          resolve(receipt);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }
  send = async (raw: Command): Promise<Receipt> => {
    const command = commandSchema.parse(raw);
    this.guard(command);
    const key = command.command_id;
    const fingerprint = JSON.stringify(command);
    const pending = this.pending.get(key);
    if (pending) {
      if (pending.fingerprint !== fingerprint)
        throw new Error("同一 command_id 不可用于不同内容。");
      return this.observe(pending.promise);
    }
    const promise = this.adapter.send(command).then((rawReceipt) => {
      const receipt = receiptSchema.parse(rawReceipt);
      if (JSON.stringify(receipt.command) !== JSON.stringify(command))
        throw new Error("桥接回执与原始指令不匹配。");
      return receipt;
    });
    this.pending.set(key, { fingerprint, promise });
    void promise.then(
      () => this.pending.delete(key),
      () => this.pending.delete(key),
    );
    return this.observe(promise);
  };
  decide = async (raw: ApprovalDecision): Promise<Receipt> => {
    const decision = decisionSchema.parse(raw);
    const approval = this.state.approvals.find(
      (item) =>
        item.id === decision.approval_id &&
        item.command.command_id === decision.command_id,
    );
    if (
      !approval ||
      decision.requester_id !== this.requesterId ||
      approval.status !== "pending"
    )
      throw new Error("审批范围不匹配或已经处理。");
    this.guard(approval.command);
    const receipt = receiptSchema.parse(
      await this.observe(this.adapter.decide(decision)),
    );
    if (JSON.stringify(receipt.command) !== JSON.stringify(approval.command))
      throw new Error("审批回执与原始指令不匹配。");
    return receipt;
  };
  dispose() {
    this.unsubscribe();
    this.listeners.clear();
  }
}

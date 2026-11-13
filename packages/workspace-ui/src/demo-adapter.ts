import {
  approvalSchema,
  commandSchema,
  decisionSchema,
  freezeSnapshot,
  snapshotSchema,
  STALE_AFTER_MS,
} from "./model";
import type {
  AgentEvent,
  ApprovalDecision,
  Command,
  Receipt,
  WorkspaceAdapter,
  WorkspaceSnapshot,
} from "./model";

export const DEMO_PROJECT = "synthetic-agents";
export const DEMO_OWNER = "demo-owner";
export const DEMO_IDS = ["agent-boss", "agent-build", "agent-review"] as const;
export interface DemoIdentityFixture {
  project_id: string;
  agents: Record<
    (typeof DEMO_IDS)[number],
    { id: string; name: string; room_id: string }
  >;
}

function initialSnapshot(now: string): WorkspaceSnapshot {
  return snapshotSchema.parse({
    project_id: DEMO_PROJECT,
    revision: 0,
    mode: "demo",
    connected: true,
    observed_at: now,
    source: "本地合成脚本 · 无模型、网络或仓库操作",
    agents: [
      {
        id: "agent-boss",
        name: "奥林",
        role: "supervisor",
        status: "working",
        is_demo: true,
        mode: "demo",
        room_id: "planning",
        task_id: "demo-plan",
        source: "DEMO supervisor",
        source_ref: "synthetic:supervisor",
        observed_at: now,
        capabilities: [
          "chat",
          "assign_task",
          "request_review",
          "cancel_task",
          "publish",
        ],
      },
      {
        id: "agent-build",
        name: "铆钉",
        role: "worker",
        status: "blocked",
        is_demo: true,
        mode: "demo",
        room_id: "executor",
        task_id: "demo-gate",
        source: "DEMO worker",
        source_ref: "synthetic:worker",
        observed_at: now,
        capabilities: ["chat", "assign_task", "cancel_task"],
      },
      {
        id: "agent-review",
        name: "微光",
        role: "reviewer",
        status: "review",
        is_demo: true,
        mode: "demo",
        room_id: "history",
        task_id: "demo-review",
        source: "DEMO reviewer",
        source_ref: "synthetic:reviewer",
        observed_at: now,
        capabilities: ["chat", "request_review"],
      },
    ],
    tasks: [
      {
        id: "demo-plan",
        agent_id: "agent-boss",
        title: "为下一段旅程拟定计划",
        status: "active",
        detail: "等待你的目标。主管可派遣合成任务，也可以说明目前的阻塞。",
        evidence: [],
      },
      {
        id: "demo-gate",
        agent_id: "agent-build",
        title: "修复北侧机关门",
        status: "blocked",
        detail: "缺少门锁规则的确认。此处是合成场景；没有改动真实代码。",
        evidence: [
          {
            label: "合成阻塞记录",
            ref: "synthetic:gate-check",
            verified: false,
          },
        ],
      },
      {
        id: "demo-review",
        agent_id: "agent-review",
        title: "核对指挥厅事件记录",
        status: "review",
        detail: "证据已备好，等待独立核对。审查结束不会自动验收项目。",
        evidence: [
          {
            label: "合成检查报告",
            ref: "synthetic:review-report",
            verified: false,
          },
        ],
      },
    ],
    events: [
      {
        schema_version: "1.0",
        event_id: "demo-arrival",
        project_id: DEMO_PROJECT,
        agent_id: "agent-boss",
        event_type: "progress",
        occurred_at: now,
        observed_at: now,
        source: "demo-adapter",
        source_ref: "synthetic:arrival",
        is_demo: true,
        message: "指挥厅已就绪。所有对话和执行反馈均为本地模拟。",
      },
    ],
    receipts: [],
    approvals: [],
  });
}

/** Local deterministic simulator. No external executor exists in this class. */
export class DemoWorkspaceAdapter implements WorkspaceAdapter {
  private state: WorkspaceSnapshot;
  private listeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private eventSequence = 0;
  private forcedStale = false;
  private heartbeat: ReturnType<typeof setInterval>;
  readonly executionCount = new Map<string, number>();
  constructor(
    private options: {
      delayMs?: number;
      now?: () => number;
      failNext?: boolean;
      fixture?: DemoIdentityFixture;
    } = {},
  ) {
    const initial = initialSnapshot(this.now());
    if (options.fixture) {
      const fixture = options.fixture;
      const identity = (originalId: string) =>
        fixture.agents[originalId as (typeof DEMO_IDS)[number]];
      initial.project_id = fixture.project_id;
      initial.agents = initial.agents.map((agent) => ({
        ...agent,
        ...identity(agent.id),
      }));
      initial.tasks = initial.tasks.map((task) => ({
        ...task,
        agent_id: identity(task.agent_id).id,
      }));
      initial.events = initial.events.map((event) => ({
        ...event,
        project_id: fixture.project_id,
        agent_id: identity(event.agent_id).id,
      }));
    }
    this.state = freezeSnapshot(snapshotSchema.parse(initial));
    this.heartbeat = setInterval(() => {
      if (
        this.state.connected &&
        !this.forcedStale &&
        this.state.mode === "demo"
      )
        this.update({
          observed_at: this.now(),
          agents: this.state.agents.map((agent) => ({
            ...agent,
            observed_at: this.now(),
          })),
        });
    }, 5000);
  }
  private now = () => new Date((this.options.now ?? Date.now)()).toISOString();
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
  private putReceipt(receipt: Receipt) {
    this.update({
      receipts: [
        ...this.state.receipts.filter(
          (item) => item.command.command_id !== receipt.command.command_id,
        ),
        receipt,
      ],
    });
    return receipt;
  }
  private event(
    command: Command,
    event_type: AgentEvent["event_type"],
    message: string,
  ) {
    const event: AgentEvent = {
      schema_version: "1.0",
      event_id: `demo-event-${++this.eventSequence}`,
      project_id: this.state.project_id,
      agent_id: command.agent_id,
      command_id: command.command_id,
      event_type,
      occurred_at: this.now(),
      observed_at: this.now(),
      source: "demo-adapter",
      source_ref: `synthetic:${command.command_id}`,
      is_demo: true,
      message,
    };
    this.update({
      events: [...this.state.events, event],
      observed_at: this.now(),
    });
  }
  private deniedReason(command: Command): string | undefined {
    if (this.state.mode !== "demo")
      return "回放与真实来源模式不能调用模拟执行器。";
    if (!this.state.connected) return "未连接：没有执行该指令。";
    if (
      this.state.stale ||
      this.forcedStale ||
      Date.parse(this.now()) - Date.parse(this.state.observed_at) >
        STALE_AFTER_MS
    )
      return "状态已过期，请重新连接后核对。";
    if (
      command.project_id !== this.state.project_id ||
      command.requester_id !== DEMO_OWNER
    )
      return "请求者或项目不在授权范围内。";
    const agent = this.state.agents.find(
      (item) => item.id === command.agent_id,
    );
    if (!agent || !agent.capabilities.includes(command.action))
      return "该 Agent 不支持此操作或能力已撤销。";
    if (
      command.task_id &&
      !this.state.tasks.some(
        (task) =>
          task.id === command.task_id && task.agent_id === command.agent_id,
      )
    )
      return "任务不属于目标 Agent。";
    if (
      command.action === "cancel_task" &&
      (!command.task_id ||
        !this.state.tasks.some(
          (task) =>
            task.id === command.task_id &&
            ["active", "planned", "blocked", "review"].includes(task.status),
        ))
    )
      return "没有可取消的目标任务。";
    return undefined;
  }
  send = async (raw: Command): Promise<Receipt> => {
    const command = commandSchema.parse(raw);
    const previous = this.state.receipts.find(
      (item) => item.command.command_id === command.command_id,
    );
    if (previous) {
      if (JSON.stringify(previous.command) !== JSON.stringify(command))
        throw new Error("同一 command_id 不可用于不同内容。");
      return previous;
    }
    const denied = this.deniedReason(command);
    if (denied)
      return this.putReceipt({
        command,
        status: "rejected",
        detail: denied,
        observed_at: this.now(),
      });
    if (command.action === "publish") {
      const approval = approvalSchema.parse({
        id: `approval:${command.command_id}`,
        command,
        reason: "发布属于敏感能力。本演练仅生成本地合成回执，不上传、不发布。",
        scope: `项目 ${command.project_id} / Agent ${command.agent_id} / 仅一次 publish / 内容：${command.text}`,
        status: "pending",
        expires_at: new Date(Date.parse(this.now()) + 300_000).toISOString(),
      });
      this.update({ approvals: [...this.state.approvals, approval] });
      this.event(command, "blocked", "等待明确批准；尚未执行发布演练。");
      return this.putReceipt({
        command,
        status: "awaiting_approval",
        detail: "审批待处理；尚未执行。",
        observed_at: this.now(),
        approval_id: approval.id,
      });
    }
    return this.execute(command);
  };
  decide = async (raw: ApprovalDecision): Promise<Receipt> => {
    const decision = decisionSchema.parse(raw);
    const approval = this.state.approvals.find(
      (item) => item.id === decision.approval_id,
    );
    if (
      !approval ||
      approval.command.command_id !== decision.command_id ||
      decision.requester_id !== DEMO_OWNER
    )
      throw new Error("审批与请求者、指令范围不匹配。");
    if (approval.status !== "pending")
      throw new Error("审批已处理，不能重复使用。");
    const command = approval.command;
    const denied = this.deniedReason(command);
    const expired = Date.parse(this.now()) > Date.parse(approval.expires_at);
    const approved = decision.decision === "approve" && !denied && !expired;
    this.update({
      approvals: this.state.approvals.map((item) =>
        item.id === approval.id
          ? { ...item, status: approved ? "approved" : "denied" }
          : item,
      ),
    });
    this.event(
      command,
      "command_result",
      approved ? "已明确批准此条模拟指令。" : "已拒绝审批；未执行。",
    );
    if (!approved)
      return this.putReceipt({
        command,
        status: "rejected",
        detail: denied ?? (expired ? "审批已过期。" : "用户已拒绝。"),
        observed_at: this.now(),
        approval_id: approval.id,
      });
    return this.execute(command);
  };
  private execute(command: Command): Receipt {
    this.executionCount.set(
      command.command_id,
      (this.executionCount.get(command.command_id) ?? 0) + 1,
    );
    const receipt = this.putReceipt({
      command,
      status: "received",
      detail: "本地模拟器已接收，等待执行反馈。",
      observed_at: this.now(),
    });
    this.event(command, "started", "模拟器已接收指令。");
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.deniedReason(command)) {
        this.putReceipt({
          command,
          status: "failed",
          detail: "连接或授权已变化，模拟执行已停止。",
          observed_at: this.now(),
        });
        this.event(command, "failed", "执行前检查未通过。");
        return;
      }
      this.putReceipt({
        command,
        status: "running",
        detail: "正在生成合成反馈。",
        observed_at: this.now(),
      });
      if (this.options.failNext) {
        this.options.failNext = false;
        this.putReceipt({
          command,
          status: "failed",
          detail: "模拟错误：检定失败，可修改内容后发起新请求。",
          observed_at: this.now(),
        });
        this.event(command, "failed", "模拟检定失败。");
        return;
      }
      let result = "DEMO：已生成本地发布演练回执。没有发生外部发布。";
      if (command.action === "chat")
        result = `DEMO 回复：收到「${command.text}」。目前机关门受阻，事件记录待核对。你可以派遣一个模拟任务，或离开继续探索。我是固定规则模拟器，没有调用真实 AI。`;
      if (command.action === "assign_task") {
        const task = {
          id: `task:${command.command_id}`,
          agent_id: command.agent_id,
          title: command.text,
          status: "review" as const,
          detail: "模拟执行完成，等待结果核对；不代表项目已验收。",
          evidence: [
            {
              label: "本次合成执行记录",
              ref: `synthetic:${command.command_id}`,
              verified: false,
            },
          ],
        };
        this.update({
          tasks: [...this.state.tasks, task],
          agents: this.state.agents.map((agent) =>
            agent.id === command.agent_id
              ? {
                  ...agent,
                  task_id: task.id,
                  status: "review",
                  observed_at: this.now(),
                }
              : agent,
          ),
        });
        result = "DEMO：任务已分派并生成模拟结果，状态为待核对。";
      }
      if (command.action === "request_review")
        result =
          "DEMO：复审请求已记录，合成证据仍未独立验证。项目验收状态没有改变。";
      if (command.action === "cancel_task") {
        this.update({
          tasks: this.state.tasks.map((task) =>
            task.id === command.task_id
              ? { ...task, status: "cancelled" }
              : task,
          ),
          agents: this.state.agents.map((agent) =>
            agent.task_id === command.task_id
              ? { ...agent, status: "idle", observed_at: this.now() }
              : agent,
          ),
        });
        result = "DEMO：指定合成任务已取消。";
      }
      this.putReceipt({
        command,
        status: "completed",
        detail: "模拟执行结束；不代表真实交付或验收。",
        result,
        observed_at: this.now(),
      });
      this.event(command, "command_result", result);
    }, this.options.delayMs ?? 650);
    this.timers.add(timer);
    return receipt;
  }
  /** Demo-only controls. Not part of the integration interface. */
  setConnection(connected: boolean) {
    this.forcedStale = false;
    this.update({
      connected,
      stale: false,
      ...(connected
        ? {
            observed_at: this.now(),
            agents: this.state.agents.map((agent) => ({
              ...agent,
              observed_at: this.now(),
            })),
          }
        : {}),
    });
  }
  setMode(mode: WorkspaceSnapshot["mode"]) {
    this.update({
      mode,
      agents: this.state.agents.map((agent) => ({ ...agent, mode })),
    });
  }
  makeStale() {
    this.forcedStale = true;
    this.update({
      stale: true,
      observed_at: new Date(
        Date.parse(this.now()) - STALE_AFTER_MS - 1000,
      ).toISOString(),
    });
  }
  failNext() {
    this.options.failNext = true;
  }
  revoke(agentId: string) {
    this.update({
      agents: this.state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, capabilities: [] } : agent,
      ),
    });
  }
  dispose() {
    clearInterval(this.heartbeat);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.listeners.clear();
  }
}

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  agentConnectionLabel,
  connectionLabel,
  safeEvidenceUrl,
  STALE_AFTER_MS,
} from "./model";
import type { Capability, Command, Receipt, WorkspaceAdapter } from "./model";
import { WorkspaceController } from "./controller";
import { PixelAgent } from "./PixelAgent";

const roleLabels = {
  supervisor: "主管 · 军师",
  worker: "执行 · 工匠",
  reviewer: "审查 · 鉴定师",
  unknown: "观察到的 Agent · 角色未声明",
};
const stateLabels = {
  idle: "待命",
  working: "工作中",
  blocked: "受阻",
  review: "待核对",
  unknown: "未知",
  planned: "计划中",
  active: "进行中",
  completed: "执行结束",
  failed: "失败",
  cancelled: "已取消",
};
const actionLabels: Record<Capability, string> = {
  chat: "对话",
  assign_task: "派遣任务",
  request_review: "请求复审",
  cancel_task: "取消任务",
  publish: "发布请求",
};
function actionName(action: Capability, isDemo: boolean) {
  return action === "publish" && isDemo ? "发布演练" : actionLabels[action];
}
const receiptLabels: Record<Receipt["status"], string> = {
  received: "已接收",
  running: "执行中",
  awaiting_approval: "等待审批",
  completed: "执行结束",
  failed: "执行失败",
  rejected: "已拒绝",
  cancelled: "已取消",
};
const tabs = [
  { id: "chat", label: "对话" },
  { id: "tasks", label: "任务" },
  { id: "events", label: "活动" },
  { id: "permissions", label: "权限" },
] as const;
type Tab = (typeof tabs)[number]["id"];
function clock(time: string) {
  return new Date(time).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function EvidenceRef({ value }: { value: string }) {
  const href = safeEvidenceUrl(value);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {value} ↗
    </a>
  ) : (
    <code>{value}</code>
  );
}

export interface AgentWorkspaceProps {
  adapter: WorkspaceAdapter;
  selectedAgentId: string | null;
  onClose: () => void;
}

/** Controlled selection only. Keep controller outside this component so work outlives the sheet. */
export function AgentWorkspace({
  adapter,
  selectedAgentId,
  onClose,
}: AgentWorkspaceProps) {
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const agent = snapshot.agents.find((item) => item.id === selectedAgentId);
  const isDemo = agent?.is_demo ?? false;
  const [tab, setTab] = useState<Tab>("chat");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Capability>("chat");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<Command | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const returnFocus = useRef<HTMLElement | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (selectedAgentId) {
      returnFocus.current = document.activeElement as HTMLElement;
      setTab("chat");
      setAction("chat");
      setError("");
      setRetry(null);
    }
  }, [selectedAgentId]);
  const receipts = snapshot.receipts.filter(
    (item) => item.command.agent_id === selectedAgentId,
  );
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [snapshot.revision, tab]);
  const pendingApprovals = snapshot.approvals.filter(
    (item) =>
      item.command.agent_id === selectedAgentId && item.status === "pending",
  );
  const agentTasks = snapshot.tasks.filter(
    (item) => item.agent_id === selectedAgentId,
  );
  const currentTask = agentTasks.find((item) => item.id === agent?.task_id);
  const readOnly =
    !snapshot.connected ||
    snapshot.stale ||
    snapshot.mode === "replay" ||
    agent?.mode === "replay" ||
    now - Date.parse(snapshot.observed_at) > STALE_AFTER_MS ||
    (agent && now - Date.parse(agent.observed_at) > STALE_AFTER_MS);
  const draft = drafts[selectedAgentId ?? ""] ?? "";
  const controller = adapter instanceof WorkspaceController ? adapter : null;
  const effectiveAction = agent?.capabilities.includes(action)
    ? action
    : "chat";
  const canSend =
    !readOnly && agent?.capabilities.includes(effectiveAction) && !!controller;
  async function submit(command?: Command) {
    if (!agent || !controller || sending) return;
    const targetId = agent.id;
    const request =
      command ??
      controller.createCommand(
        targetId,
        effectiveAction,
        draft,
        effectiveAction === "cancel_task" ? currentTask?.id : undefined,
      );
    setSending(true);
    setError("");
    setRetry(null);
    try {
      await controller.send(request);
      if (!command) setDrafts((previous) => ({ ...previous, [targetId]: "" }));
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : "发送失败。"} 回执未知时，请核对活动记录；重发将沿用原指令 ID，不代表远端已停止。`,
      );
      setRetry(request);
    } finally {
      setSending(false);
    }
  }
  async function decide(
    approvalId: string,
    commandId: string,
    decision: "approve" | "deny",
  ) {
    if (!controller || sending) return;
    setSending(true);
    setError("");
    try {
      await controller.decide({
        approval_id: approvalId,
        command_id: commandId,
        requester_id: controller.requesterId,
        decision,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "审批失败。");
    } finally {
      setSending(false);
    }
  }
  return (
    <Dialog.Root
      open={!!selectedAgentId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dw-overlay" />
        <Dialog.Content
          className="dw-sheet"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <div className="dw-sheet-top">
            <span>指挥厅 / 队友档案</span>
            <Dialog.Close
              className="dw-close"
              aria-label="关闭工作台，继续探索"
            >
              ✕ <kbd>Esc</kbd>
            </Dialog.Close>
          </div>
          <div className="dw-identity">
            <div className={`dw-portrait dw-${agent?.role ?? "supervisor"}`}>
              <PixelAgent role={agent?.role ?? "supervisor"} />
            </div>
            <div>
              <p className="dw-role">
                {agent ? roleLabels[agent.role] : "无法识别的角色"}
              </p>
              <Dialog.Title>{agent?.name ?? "Agent 不存在"}</Dialog.Title>
              <p className="dw-agent-id">{selectedAgentId}</p>
            </div>
            {agent && (
              <span className={`dw-state dw-state-${agent.status}`}>
                ◆ {stateLabels[agent.status]}
              </span>
            )}
          </div>
          <Dialog.Description className="dw-connection">
            <span className="dw-mode">
              {agent
                ? agentConnectionLabel(snapshot, agent, now)
                : connectionLabel(snapshot, now)}
            </span>
            <span>
              观测 {clock(agent?.observed_at ?? snapshot.observed_at)}
            </span>
          </Dialog.Description>
          <p className="dw-source">
            {isDemo
              ? "本地模拟 · 不连接真实 AI，不执行外部操作"
              : snapshot.source}
          </p>
          {agent && (
            <div className="dw-current">
              <span>当前任务</span>
              <strong>
                {currentTask?.title ?? "暂无任务 · 可以先询问状态"}
              </strong>
              {currentTask && <small>{stateLabels[currentTask.status]}</small>}
            </div>
          )}
          <div className="dw-tabs" aria-label="Agent 信息视图">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.id === "permissions" && pendingApprovals.length > 0 && (
                  <span className="dw-count">{pendingApprovals.length}</span>
                )}
              </button>
            ))}
          </div>
          <div
            className="dw-body"
            aria-label={`${tabs.find((item) => item.id === tab)?.label}内容`}
          >
            {!agent ? (
              <p>此 Agent 不在已连接项目中。请关闭面板重新选择。</p>
            ) : (
              <>
                {pendingApprovals.length > 0 && tab !== "permissions" && (
                  <button
                    className="dw-approval-notice"
                    onClick={() => setTab("permissions")}
                  >
                    ◇ {pendingApprovals.length} 项审批待处理{" "}
                    <span>查看范围 →</span>
                  </button>
                )}
                {tab === "chat" && (
                  <div
                    className="dw-conversation"
                    role="log"
                    aria-label="对话与指令回执"
                    aria-live="polite"
                  >
                    {isDemo ? (
                      <div className="dw-message dw-agent-message">
                        <span>{agent.name} · DEMO</span>
                        <p>
                          旅人，想先看看进展，还是交给我一项任务？你可以随时离开，模拟工作会继续。
                        </p>
                      </div>
                    ) : (
                      <p className="dw-help">
                        {agent.capabilities.includes("chat")
                          ? "此连接支持真实对话。发送前将由可信桥接层判断授权范围。"
                          : "这里只显示来源记录。此连接尚未提供真实对话能力；请在“活动”查看可追溯证据。"}
                      </p>
                    )}
                    {receipts.map((receipt) => (
                      <div
                        key={receipt.command.command_id}
                        className="dw-exchange"
                      >
                        <div className="dw-message dw-player-message">
                          <span>
                            你 · {actionName(receipt.command.action, isDemo)} ·{" "}
                            {clock(receipt.command.created_at)}
                          </span>
                          <p>{receipt.command.text}</p>
                        </div>
                        <div
                          className={`dw-message dw-agent-message dw-outcome-${receipt.status}`}
                        >
                          <span>
                            {receiptLabels[receipt.status]} ·{" "}
                            {agent.mode.toUpperCase()}
                          </span>
                          <p>{receipt.result ?? receipt.detail}</p>
                          <details>
                            <summary>指令记录</summary>
                            <code>{receipt.command.command_id}</code>
                            <p>
                              {receipt.command.project_id} /{" "}
                              {receipt.command.agent_id} /{" "}
                              {receipt.command.requester_id}
                            </p>
                            <p>{receipt.detail}</p>
                          </details>
                        </div>
                      </div>
                    ))}
                    {receipts.length === 0 && canSend && (
                      <div className="dw-suggestions">
                        <span>试着问问</span>
                        {["现在有什么阻塞？", "接下来该做什么？"].map(
                          (suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [agent.id]: suggestion,
                                }))
                              }
                            >
                              {suggestion} ↗
                            </button>
                          ),
                        )}
                      </div>
                    )}
                    <div ref={chatEnd} />
                  </div>
                )}
                {tab === "tasks" && (
                  <div className="dw-task-list">
                    <p className="dw-help">
                      执行结束与项目验收分别记录。这里没有修改验收状态的入口。
                    </p>
                    {agentTasks.length === 0 && (
                      <p>
                        尚无任务。发送一项支持的派遣请求后，结果将显示在这里。
                      </p>
                    )}
                    {agentTasks.map((task) => (
                      <article className="dw-task" key={task.id}>
                        <div>
                          <span className={`dw-state dw-state-${task.status}`}>
                            {stateLabels[task.status]}
                          </span>
                          <code>{task.id}</code>
                        </div>
                        <h3>{task.title}</h3>
                        <p>{task.detail}</p>
                        {task.evidence.length ? (
                          task.evidence.map((evidence) => (
                            <div className="dw-evidence" key={evidence.ref}>
                              <span>
                                ↳ {evidence.label} ·{" "}
                                {evidence.verified
                                  ? "来源标记为已验证"
                                  : "未独立验证"}
                              </span>
                              <EvidenceRef value={evidence.ref} />
                            </div>
                          ))
                        ) : (
                          <p className="dw-help">暂无结果证据。</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                {tab === "events" && (
                  <div className="dw-event-list">
                    <p className="dw-help">
                      事件按发生时间展示；来源时间保留，回放不会刷新为实时。
                    </p>
                    {[...snapshot.events]
                      .filter((event) => event.agent_id === agent.id)
                      .sort(
                        (a, b) =>
                          Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
                      )
                      .map((event) => (
                        <article className="dw-event" key={event.event_id}>
                          <div>
                            <time dateTime={event.occurred_at}>
                              {clock(event.occurred_at)}
                            </time>
                            <span>
                              {event.is_demo ? "DEMO · " : ""}
                              {(
                                snapshot.event_modes[event.event_id] ??
                                snapshot.mode
                              ).toUpperCase()}{" "}
                              · {event.event_type}
                            </span>
                          </div>
                          <p>{event.message ?? "来源未提供消息。"}</p>
                          <small>
                            观测 {clock(event.observed_at)} · {event.source}
                          </small>
                          {event.source_ref && (
                            <EvidenceRef value={event.source_ref} />
                          )}
                          {event.command_id && (
                            <code>指令 {event.command_id}</code>
                          )}
                        </article>
                      ))}
                  </div>
                )}
                {tab === "permissions" && (
                  <div className="dw-permissions">
                    <h3>此角色的能力</h3>
                    <p className="dw-help">
                      权限由可信桥接层重新判断。游戏行为不产生授权；普通聊天不会被解析为执行指令。
                    </p>
                    <div className="dw-capabilities">
                      {Object.keys(actionLabels).map((key) => (
                        <span key={key}>
                          {agent.capabilities.includes(key as Capability)
                            ? "✓"
                            : "—"}{" "}
                          {actionName(key as Capability, isDemo)}
                        </span>
                      ))}
                    </div>
                    <p className="dw-help">角色来源 · {agent.source}</p>
                    <EvidenceRef value={agent.source_ref} />
                    <p className="dw-help">
                      角色最近观测 {clock(agent.observed_at)}
                    </p>
                    <h3>审批请求</h3>
                    {snapshot.approvals.filter(
                      (item) => item.command.agent_id === agent.id,
                    ).length === 0 && (
                      <p>
                        {isDemo
                          ? "暂无审批。主管的“发布演练”可练习具体范围的一次授权。"
                          : "暂无审批；当前仅显示来源已声明的能力。"}
                      </p>
                    )}
                    {snapshot.approvals
                      .filter((item) => item.command.agent_id === agent.id)
                      .map((approval) => (
                        <article key={approval.id} className="dw-approval">
                          <strong>
                            {approval.status === "pending"
                              ? "等待审批"
                              : approval.status === "approved"
                                ? "已批准一次"
                                : "已拒绝"}{" "}
                            · {agent.mode.toUpperCase()}
                          </strong>
                          <p>{approval.reason}</p>
                          <p>{approval.scope}</p>
                          <code>{approval.command.command_id}</code>
                          <small>
                            申请人 {approval.command.requester_id} · 过期{" "}
                            {clock(approval.expires_at)}
                          </small>
                          {approval.status === "pending" && (
                            <div className="dw-approval-actions">
                              <button
                                disabled={readOnly || sending}
                                onClick={() =>
                                  void decide(
                                    approval.id,
                                    approval.command.command_id,
                                    "deny",
                                  )
                                }
                              >
                                拒绝
                              </button>
                              <button
                                className="dw-primary"
                                disabled={
                                  readOnly ||
                                  sending ||
                                  Date.parse(approval.expires_at) < now
                                }
                                onClick={() =>
                                  void decide(
                                    approval.id,
                                    approval.command.command_id,
                                    "approve",
                                  )
                                }
                              >
                                {isDemo ? "仅批准这次演练" : "批准此范围一次"}
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
          {error && (
            <div className="dw-error" role="alert">
              <p>{error}</p>
              {retry && (
                <button
                  disabled={sending || readOnly}
                  onClick={() => void submit(retry)}
                >
                  核对 / 重发原指令
                </button>
              )}
            </div>
          )}
          {agent && (
            <form
              className="dw-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="dw-composer-tools">
                <label>
                  操作{" "}
                  <select
                    aria-label="选择操作"
                    value={effectiveAction}
                    onChange={(event) =>
                      setAction(event.target.value as Capability)
                    }
                  >
                    {Object.keys(actionLabels).map((value) => (
                      <option
                        key={value}
                        value={value}
                        disabled={
                          !agent.capabilities.includes(value as Capability)
                        }
                      >
                        {actionName(value as Capability, isDemo)}
                        {!agent.capabilities.includes(value as Capability)
                          ? " · 不支持"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {isDemo ? "仅模拟执行" : readOnly ? "只读" : "由桥接层校验"}
                </span>
              </div>
              <label className="dw-sr-only" htmlFor="dw-message">
                消息或任务内容
              </label>
              <textarea
                id="dw-message"
                maxLength={4000}
                placeholder={
                  canSend
                    ? "写下你的目标，或问问当前进展…"
                    : "当前连接只读，无法发送指令"
                }
                value={draft}
                onChange={(event) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [agent.id]: event.target.value,
                  }))
                }
                disabled={!canSend}
                rows={2}
              />
              <div className="dw-composer-bottom">
                <span>
                  {readOnly
                    ? connectionLabel(snapshot, now)
                    : "Enter 换行 · 点击发送"}
                  {draft.length > 3500 ? ` · ${draft.length}/4000` : ""}
                </span>
                <button
                  className="dw-primary"
                  disabled={!canSend || sending || !draft.trim()}
                  type="submit"
                >
                  {sending
                    ? "等待回执…"
                    : isDemo
                      ? "发送 · DEMO ↗"
                      : "发送 ↗"}
                </button>
              </div>
            </form>
          )}
          <div className="dw-return">
            <span>工作与冒险各自继续</span>
            <Dialog.Close>返回地牢 →</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  agentConnectionLabel,
  connectionLabel,
  safeEvidenceUrl,
  STALE_AFTER_MS,
} from "./model";
import type { Capability, Command, WorkspaceAdapter } from "./model";
import { WorkspaceController } from "./controller";
import { PixelAgent } from "./PixelAgent";
import { useI18n, LocaleSwitcher } from "./i18n";
import { WorkspaceFault } from "./errors";
import { taskCopy } from "./demo-task-copy";
const actionLabels = {
  chat: "work.action.chat",
  assign_task: "work.action.assign_task",
  request_review: "work.action.request_review",
  cancel_task: "work.action.cancel_task",
  publish: "work.action.publish",
} as const;
const tabs = [
  { id: "chat", label: "workspace.tabs.chat" },
  { id: "tasks", label: "workspace.tabs.tasks" },
  { id: "events", label: "workspace.tabs.events" },
  { id: "permissions", label: "workspace.tabs.permissions" },
] as const;
type Tab = (typeof tabs)[number]["id"];
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
  const { locale, t, formatTime: clock } = useI18n();
  const actionName = (action: Capability, demo: boolean) =>
    t(
      action === "publish" && demo
        ? "work.action.publishDemo"
        : actionLabels[action],
    );
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
  const [error, setError] = useState<{
    cause: unknown;
    fallback: "errors.sendFailed" | "errors.approvalFailed";
  } | null>(null);
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
      setError(null);
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
    setError(null);
    setRetry(null);
    try {
      await controller.send(request);
      if (!command) setDrafts((previous) => ({ ...previous, [targetId]: "" }));
    } catch (cause) {
      setError({ cause, fallback: "errors.sendFailed" });
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
    setError(null);
    try {
      await controller.decide({
        approval_id: approvalId,
        command_id: commandId,
        requester_id: controller.requesterId,
        decision,
      });
    } catch (cause) {
      setError({ cause, fallback: "errors.approvalFailed" });
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
            <LocaleSwitcher />
            <span>{t("workspace.location")}</span>
            <Dialog.Close
              className="dw-close"
              aria-label={t("workspace.close")}
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
                {t(`agent.role.${agent?.role ?? "unknown"}`)}
              </p>
              <Dialog.Title>
                {agent?.name ?? t("workspace.missingAgent")}
              </Dialog.Title>
              <p className="dw-agent-id">{selectedAgentId}</p>
            </div>
            {agent && (
              <span className={`dw-state dw-state-${agent.status}`}>
                ◆ {t(`agent.status.${agent.status}`)}
              </span>
            )}
          </div>
          <Dialog.Description className="dw-connection">
            <span className="dw-mode">
              {agent
                ? agentConnectionLabel(snapshot, agent, now, locale)
                : connectionLabel(snapshot, now, locale)}
            </span>
            <span>
              {Date.parse(agent?.observed_at ?? snapshot.observed_at) > 0
                ? t("common.observedAt", {
                    time: clock(agent?.observed_at ?? snapshot.observed_at),
                  })
                : t("common.unknownTime")}
            </span>
          </Dialog.Description>
          <p className="dw-source">
            {isDemo ? (
              t("workspace.demoSource")
            ) : (
              <>
                <span>
                  {!snapshot.connected
                    ? t("errors.command.disconnected")
                    : t(
                        readOnly || !agent?.capabilities.includes("chat")
                          ? "workspace.sourceReadOnly"
                          : "workspace.sourceChat",
                      )}
                </span>
                <small className="dw-source-original">
                  {t("common.original")} · {snapshot.source}
                </small>
              </>
            )}
          </p>
          {agent && (
            <div className="dw-current">
              <span>{t("workspace.currentTask")}</span>
              <strong>
                {currentTask
                  ? taskCopy(currentTask, isDemo, t).title
                  : t("workspace.noTask")}
              </strong>
              {currentTask && !taskCopy(currentTask, isDemo, t).localized && (
                <small>{t("common.original")}</small>
              )}
              {currentTask && (
                <small>{t(`work.task.${currentTask.status}`)}</small>
              )}
            </div>
          )}
          <div className="dw-tabs" aria-label={t("workspace.views")}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {t(item.label)}
                {item.id === "permissions" && pendingApprovals.length > 0 && (
                  <span className="dw-count">{pendingApprovals.length}</span>
                )}
              </button>
            ))}
          </div>
          <div
            className="dw-body"
            aria-label={t("workspace.tabContent", {
              tab: t(tabs.find((item) => item.id === tab)!.label),
            })}
          >
            {!agent ? (
              <p>{t("workspace.notInProject")}</p>
            ) : (
              <>
                {pendingApprovals.length > 0 && tab !== "permissions" && (
                  <button
                    className="dw-approval-notice"
                    onClick={() => setTab("permissions")}
                  >
                    ◇{" "}
                    {t("work.approvalCount", {
                      count: pendingApprovals.length,
                    })}{" "}
                    <span>{t("workspace.viewScope")}</span>
                  </button>
                )}
                {tab === "chat" && (
                  <div
                    className="dw-conversation"
                    role="log"
                    aria-label={t("workspace.conversation")}
                    aria-live="polite"
                  >
                    {isDemo ? (
                      <div className="dw-message dw-agent-message">
                        <span>{agent.name} · DEMO</span>
                        <p>{t("workspace.demoGreeting")}</p>
                      </div>
                    ) : (
                      <p className="dw-help">
                        {agent.capabilities.includes("chat")
                          ? t("workspace.liveHelp")
                          : t("workspace.readOnlyHelp")}
                      </p>
                    )}
                    {receipts.map((receipt) => (
                      <div
                        key={receipt.command.command_id}
                        className="dw-exchange"
                      >
                        <div className="dw-message dw-player-message">
                          <span>
                            {t("workspace.you")} ·{" "}
                            {actionName(receipt.command.action, isDemo)} ·{" "}
                            {clock(receipt.command.created_at)}
                          </span>
                          <p>{receipt.command.text}</p>
                        </div>
                        <div
                          className={`dw-message dw-agent-message dw-outcome-${receipt.status}`}
                        >
                          <span>
                            {t(`work.receipt.${receipt.status}`)} ·{" "}
                            {agent.mode.toUpperCase()}
                          </span>
                          <small>
                            {t(
                              isDemo
                                ? "common.originalDemo"
                                : "common.original",
                            )}
                          </small>
                          <p>{receipt.result ?? receipt.detail}</p>
                          <details>
                            <summary>{t("workspace.commandRecord")}</summary>
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
                        <span>{t("workspace.tryAsking")}</span>
                        {[
                          t("workspace.suggestion.blockers"),
                          t("workspace.suggestion.next"),
                        ].map((suggestion) => (
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
                        ))}
                      </div>
                    )}
                    <div ref={chatEnd} />
                  </div>
                )}
                {tab === "tasks" && (
                  <div className="dw-task-list">
                    <p className="dw-help">{t("workspace.taskHelp")}</p>
                    {agentTasks.length === 0 && (
                      <p>{t("workspace.taskEmpty")}</p>
                    )}
                    {agentTasks.map((task) => (
                      <article className="dw-task" key={task.id}>
                        <div>
                          <span className={`dw-state dw-state-${task.status}`}>
                            {t(`work.task.${task.status}`)}
                          </span>
                          <code>{task.id}</code>
                        </div>
                        {!taskCopy(task, isDemo, t).localized && (
                          <small>{t("common.original")}</small>
                        )}
                        <h3>{taskCopy(task, isDemo, t).title}</h3>
                        <p>{taskCopy(task, isDemo, t).detail}</p>
                        {taskCopy(task, isDemo, t).localized &&
                          locale !== "zh-CN" && (
                            <details>
                              <summary>{t("common.originalDemo")}</summary>
                              <p>{task.title}</p>
                              <p>{task.detail}</p>
                            </details>
                          )}
                        {task.evidence.length ? (
                          task.evidence.map((evidence) => (
                            <div className="dw-evidence" key={evidence.ref}>
                              <small>{t("common.original")}</small>
                              <span>
                                ↳ {evidence.label} ·{" "}
                                {evidence.verified
                                  ? t("workspace.sourceVerified")
                                  : t("workspace.notVerified")}
                              </span>
                              <EvidenceRef value={evidence.ref} />
                            </div>
                          ))
                        ) : (
                          <p className="dw-help">{t("workspace.noEvidence")}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                {tab === "events" && (
                  <div className="dw-event-list">
                    <p className="dw-help">{t("workspace.eventHelp")}</p>
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
                              · {t(`work.event.${event.event_type}`)}{" "}
                              <code>{event.event_type}</code>
                            </span>
                          </div>
                          <small>
                            {t(
                              isDemo
                                ? "common.originalDemo"
                                : "common.original",
                            )}
                          </small>
                          <p>{event.message ?? t("workspace.noMessage")}</p>
                          <small>
                            {t("common.observedAt", {
                              time: clock(event.observed_at),
                            })}{" "}
                            · {event.source}
                          </small>
                          {event.source_ref && (
                            <EvidenceRef value={event.source_ref} />
                          )}
                          {event.command_id && (
                            <code>
                              {t("workspace.commandId", {
                                id: event.command_id,
                              })}
                            </code>
                          )}
                        </article>
                      ))}
                  </div>
                )}
                {tab === "permissions" && (
                  <div className="dw-permissions">
                    <h3>{t("workspace.capabilities")}</h3>
                    <p className="dw-help">{t("workspace.permissionHelp")}</p>
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
                    <p className="dw-help">
                      {t("workspace.agentSource")} · {agent.source}
                    </p>
                    <EvidenceRef value={agent.source_ref} />
                    <p className="dw-help">
                      {Date.parse(agent.observed_at) > 0
                        ? t("workspace.lastSeen", {
                            time: clock(agent.observed_at),
                          })
                        : t("workspace.noAgentObservation")}
                    </p>
                    <h3>{t("workspace.approvals")}</h3>
                    {snapshot.approvals.filter(
                      (item) => item.command.agent_id === agent.id,
                    ).length === 0 && (
                      <p>
                        {isDemo
                          ? t("workspace.approvalsEmptyDemo")
                          : t("workspace.approvalsEmpty")}
                      </p>
                    )}
                    {snapshot.approvals
                      .filter((item) => item.command.agent_id === agent.id)
                      .map((approval) => (
                        <article key={approval.id} className="dw-approval">
                          <strong>
                            {approval.status === "pending"
                              ? t("workspace.approval.pending")
                              : approval.status === "approved"
                                ? t("workspace.approval.approved")
                                : t("workspace.approval.denied")}{" "}
                            · {agent.mode.toUpperCase()}
                          </strong>
                          <p>{t("workspace.approvalDisplay")}</p>
                          <dl className="dw-approval-scope">
                            <dt>{t("workspace.project")}</dt>
                            <dd>
                              <code>{approval.command.project_id}</code>
                            </dd>
                            <dt>{t("workspace.targetAgent")}</dt>
                            <dd>
                              <code>{approval.command.agent_id}</code>
                            </dd>
                            <dt>{t("workspace.operation")}</dt>
                            <dd>
                              {actionName(approval.command.action, isDemo)}
                            </dd>
                            <dt>{t("workspace.requestText")}</dt>
                            <dd>{approval.command.text}</dd>
                          </dl>
                          <small>{t("common.original")}</small>
                          <p>{approval.reason}</p>
                          <p>{approval.scope}</p>
                          <code>{approval.command.command_id}</code>
                          <small>
                            {t("workspace.requesterExpires", {
                              requester: approval.command.requester_id,
                              time: clock(approval.expires_at),
                            })}
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
                                {t("workspace.deny")}
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
                                {isDemo
                                  ? t("workspace.approveDemo")
                                  : t("workspace.approve")}
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
              <p>
                {error.cause instanceof WorkspaceFault
                  ? t(error.cause.key, error.cause.params)
                  : t(error.fallback)}{" "}
                {t("errors.unknownReceipt")}
              </p>
              <details>
                <summary>{t("errors.raw")}</summary>
                <pre>
                  {error.cause instanceof Error
                    ? error.cause.message
                    : String(error.cause)}
                </pre>
              </details>
              {retry && (
                <button
                  disabled={sending || readOnly}
                  onClick={() => void submit(retry)}
                >
                  {t("workspace.retry")}
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
                  {t("workspace.operation")}{" "}
                  <select
                    aria-label={t("workspace.chooseAction")}
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
                          ? ` · ${t("workspace.unsupported")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {isDemo
                    ? t("workspace.simulatedOnly")
                    : readOnly
                      ? t("workspace.readOnly")
                      : t("workspace.bridgeChecks")}
                </span>
              </div>
              <label className="dw-sr-only" htmlFor="dw-message">
                {t("workspace.message")}
              </label>
              <textarea
                id="dw-message"
                maxLength={4000}
                placeholder={
                  canSend
                    ? t("workspace.placeholder")
                    : t("workspace.readOnlyPlaceholder")
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
                    ? connectionLabel(snapshot, now, locale)
                    : t("workspace.newline")}
                  {draft.length > 3500 ? ` · ${draft.length}/4000` : ""}
                </span>
                <button
                  className="dw-primary"
                  disabled={!canSend || sending || !draft.trim()}
                  type="submit"
                >
                  {sending
                    ? t("workspace.waiting")
                    : isDemo
                      ? t("workspace.sendDemo")
                      : t("workspace.send")}
                </button>
              </div>
            </form>
          )}
          <div className="dw-return">
            <span>{t("workspace.independence")}</span>
            <Dialog.Close>{t("workspace.return")}</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

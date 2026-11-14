import { useEffect, useRef } from "react";
import { EvidenceRef } from "../../../packages/workspace-ui/src";
import {
  LocaleSwitcher,
  useI18n,
} from "../../../packages/workspace-ui/src/i18n";
import {
  OBSERVATORY_FEATURE,
  SAMPLE_AGENT_ID,
  type FeatureSample,
  type SampleMode,
  type SampleObjectId,
} from "./feature-sample";
import "./feature-panel.css";

/** An inspector for world objects, not a command or acceptance surface. The
 * host owns game input focus; this panel never touches game/work controllers. */
export function FeaturePanel({
  objectId,
  sample,
  onClose,
  restoreFocus,
  asAgent = false,
}: {
  objectId: SampleObjectId;
  sample: FeatureSample;
  onClose(): void;
  restoreFocus?(): void;
  asAgent?: boolean;
}) {
  const { t, formatDateTime } = useI18n();
  const root = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
  }, [objectId]);
  const close = () => {
    onClose();
    restoreFocus?.();
  };
  const { source, state } = sample;
  const snapshot = source?.snapshot ?? state.receipt?.snapshot;
  const mode: SampleMode = source
    ? source.transportConnected
      ? (source.status?.connections.project.mode ?? "DISCONNECTED")
      : "DISCONNECTED"
    : state.receipt
      ? Date.now() - Date.parse(state.receipt.observed_at) > 360_000
        ? "STALE"
        : state.receipt.mode
      : "DISCONNECTED";
  const activeAgent = sample.activities.activity(SAMPLE_AGENT_ID, state.now);
  const busy = !!activeAgent;
  const agentAction =
    activeAgent ??
    [...state.actions]
      .reverse()
      .find((action) => action.agent_id === SAMPLE_AGENT_ID);
  const records = [...(source?.records ?? [])].reverse().slice(0, 5);
  const capability = (
    <>
      <p className="sample-acceptance">{t("sample.acceptance")}</p>
      <dl className="sample-capability">
        <div>
          <dt>{t("sample.implemented")}</dt>
          <dd>{t("sample.implemented.detail")}</dd>
        </div>
        <div>
          <dt>{t("sample.missing")}</dt>
          <dd>{t("sample.missing.detail")}</dd>
        </div>
      </dl>
    </>
  );
  return (
    <aside
      className="sample-panel"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-feature-title"
      data-testid="sample-feature-panel"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
          return;
        }
        if (event.key === "Tab") {
          const items = [
            ...(root.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),a[href],summary,[tabindex="0"]',
            ) ?? []),
          ].filter((item) => item.getClientRects().length);
          const first = items[0],
            last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        if (event.key !== "Tab") event.stopPropagation();
      }}
    >
      <header>
        <div>
          <small>
            DEVUNGEON · {t(asAgent ? "sample.demoTitle" : "sample.project")}
          </small>
          <h2 id="sample-feature-title">
            {asAgent ? t("sample.agentName") : t(`sample.object.${objectId}`)}
          </h2>
        </div>
        <button
          ref={closeButton}
          onClick={close}
          aria-label={t("sample.close")}
        >
          ×
        </button>
      </header>
      <div className="sample-panel-body">
        <LocaleSwitcher />
        <p className="sample-feature-name">{t("sample.title")}</p>
        <p>{t(`sample.object.${objectId}.purpose`)}</p>
        {asAgent && (
          <section
            aria-label={t("sample.agentTask")}
            data-testid="sample-agent-task"
          >
            <h3>{t("sample.agentTask")}</h3>
            <code>{SAMPLE_AGENT_ID}</code>
            <p>{t("sample.agentIdentity")}</p>
            {agentAction ? (
              <>
                <strong>{t(`sample.action.${agentAction.kind}`)}</strong>
                <p>
                  {t(`sample.mode.${agentAction.mode}`)} ·{" "}
                  {t(
                    `sample.phase.${agentAction.phase === "running" && !busy ? "expired" : agentAction.phase}`,
                  )}
                </p>
                <code>{agentAction.task_id}</code>
                <EvidenceRef value={agentAction.source_ref} />
                <small>{formatDateTime(agentAction.started_at)}</small>
              </>
            ) : (
              <p>{t("sample.noActivity")}</p>
            )}
          </section>
        )}
        {objectId !== "test-bench" && capability}
        {objectId !== "test-bench" && (
          <section aria-label={t("sample.sourceState")}>
            <div className="sample-source-heading">
              <h3>{t("sample.sourceState")}</h3>
              <span
                className={`sample-mode mode-${mode.toLowerCase()}`}
                data-testid="sample-source-mode"
              >
                {t(`sample.mode.${mode}`)}
              </span>
            </div>
            <p>
              <b>orionaster/devungeon</b>
            </p>
            {snapshot ? (
              <>
                <p>{t("sample.items", { count: snapshot.rooms.length })}</p>
                <small>
                  {t("sample.observed", {
                    time: formatDateTime(snapshot.observed_at),
                  })}
                </small>
              </>
            ) : (
              <p>{t("sample.noSource")}</p>
            )}
            {source?.error && (
              <p className="sample-warning" role="status">
                {t("sample.sourceError")}
              </p>
            )}
            <button
              className="primary sample-read"
              data-testid="sample-observe-public"
              disabled={state.reading}
              onClick={() => void sample.observePublic()}
            >
              {t(state.reading ? "sample.reading" : "sample.read")}
            </button>
            <small>{t("sample.readHelp")}</small>
            {state.error && (
              <p role="status" className="sample-warning">
                {t(
                  state.error === "invalid_source"
                    ? "sample.invalidSource"
                    : "sample.readFailure",
                )}
              </p>
            )}
            {state.receipt && (
              <details className="sample-receipt">
                <summary>
                  {t("sample.receipt")} · {state.receipt.mode}
                </summary>
                <p>
                  {t("sample.receiptTime", {
                    time: formatDateTime(state.receipt.received_at),
                  })}
                </p>
                <p>
                  {t("sample.observed", {
                    time: formatDateTime(state.receipt.observed_at),
                  })}
                </p>
                <code>{state.receipt.request_id}</code>
                <code>{state.receipt.revision}</code>
                <EvidenceRef value={state.receipt.source_ref} />
              </details>
            )}
          </section>
        )}
        {objectId === "test-bench" && (
          <section className="sample-demo" aria-label={t("sample.demoTitle")}>
            <h3>{t("sample.demoTitle")}</h3>
            <p>{t("sample.demoHelp")}</p>
            <div className="sample-actions">
              <button
                data-testid="sample-demo-scan"
                disabled={busy}
                onClick={() => sample.runDemo("scan")}
              >
                {t("sample.demoScan")}
              </button>
              <button
                data-testid="sample-demo-test"
                disabled={busy}
                onClick={() => sample.runDemo("test")}
              >
                {t("sample.demoTest")}
              </button>
            </div>
            {busy && <small role="status">{t("sample.demoRunning")}</small>}
            <details>
              <summary>{t("sample.replay")}</summary>
              <p>{t("sample.replayHelp")}</p>
              <button
                data-testid="sample-demo-replay"
                disabled={
                  busy ||
                  !state.actions.some(
                    (action) => action.is_demo && action.phase !== "running",
                  )
                }
                onClick={sample.replayLastDemo}
              >
                {t("sample.replay")}
              </button>
            </details>
          </section>
        )}
        {objectId === "test-bench" && (
          <details>
            <summary>{t("sample.feature")}</summary>
            {capability}
          </details>
        )}
        {state.actions.length > 0 && (
          <section
            aria-label={t("sample.metadata")}
            data-testid="sample-activity-log"
          >
            <h3>{t("sample.metadata")}</h3>
            <ol className="sample-activity-list">
              {[...state.actions]
                .reverse()
                .slice(0, 5)
                .map((action) => {
                  const expired =
                    action.phase === "running" &&
                    Date.parse(action.expires_at) <= state.now;
                  return (
                    <li key={action.event_id}>
                      <strong>{t(`sample.action.${action.kind}`)}</strong>
                      <span>
                        {t(`sample.mode.${expired ? "STALE" : action.mode}`)} ·{" "}
                        {t(
                          `sample.phase.${expired ? "expired" : action.phase}`,
                        )}
                      </span>
                      <small>{formatDateTime(action.started_at)}</small>
                      <details>
                        <summary>{action.event_id}</summary>
                        <EvidenceRef value={action.source_ref} />
                        <pre>{JSON.stringify(action, null, 2)}</pre>
                      </details>
                    </li>
                  );
                })}
            </ol>
          </section>
        )}
        {objectId === "evidence-cabinet" && (
          <>
            <section>
              <h3>{t("sample.original")}</h3>
              <p>{t("sample.originalHelp")}</p>
              {snapshot ? (
                <ol className="sample-source-list">
                  {snapshot.rooms.map((room) => (
                    <li key={room.id}>
                      <strong>{room.name}</strong>
                      <code>
                        {room.id} · {room.status}
                      </code>
                      {room.summary && <p>{room.summary}</p>}
                      {room.evidence.map((evidence, i) => (
                        <div key={`${evidence.ref}:${i}`}>
                          <EvidenceRef value={evidence.ref} />
                          <small>
                            {evidence.verification}
                            {evidence.description
                              ? ` · ${evidence.description}`
                              : ""}
                          </small>
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("sample.noSource")}</p>
              )}
            </section>
            <section>
              <h3>{t("sample.events")}</h3>
              <p>{t("sample.eventFallback")}</p>
              <ol className="sample-source-list">
                {records.map((record) => (
                  <li key={record.event.event_id}>
                    <strong>
                      {record.mode}
                      {record.event.is_demo ? " · DEMO" : ""} ·{" "}
                      {record.event.source_kind}
                    </strong>
                    <p>{record.event.message ?? record.event.event_type}</p>
                    <small>{formatDateTime(record.event.occurred_at)}</small>
                    <EvidenceRef value={record.event.source_ref} />
                    <code>{record.event.event_id}</code>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
        <details>
          <summary>{t("sample.codeEvidence")}</summary>
          {OBSERVATORY_FEATURE.reason_refs.map((ref) => (
            <p key={ref}>
              <EvidenceRef value={ref} />
            </p>
          ))}
          <pre>{JSON.stringify(OBSERVATORY_FEATURE, null, 2)}</pre>
        </details>
        <p className="sample-game-only">{t("sample.gameOnly")}</p>
      </div>
      <footer>
        <button onClick={close}>{t("sample.close")}</button>
      </footer>
    </aside>
  );
}

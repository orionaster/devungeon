import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AgentWorkspace,
  connectScoutStream,
  PixelAgent,
  ScoutWorkspaceAdapter,
  WorkspaceController,
  connectionLabel,
  agentConnectionLabel,
} from "../src";
import { LocaleSwitcher, useI18n } from "../src/i18n";

const scout = new ScoutWorkspaceAdapter("github:orionaster/devungeon");
const controller = new WorkspaceController(
  scout,
  "local-viewer",
  scout.projectId,
);

export function ScoutHall() {
  const { locale, t } = useI18n();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(
    () => connectScoutStream(scout, "/scout-read/v1/stream", setError),
    [],
  );
  return (
    <main className="hall">
      <header className="hall-header">
        <div className="hall-brand">
          <span className="hall-rune">◈</span>
          <strong>DEVUNGEON</strong>
          <span>{t("hall.scout.title")}</span>
        </div>
        <div className="hall-connection">
          <span>{connectionLabel(snapshot, Date.now(), locale)}</span>
          <LocaleSwitcher />
        </div>
      </header>
      <div className="scout-intro">
        <p>{t("hall.readOnlySource")}</p>
        <h1>{t("hall.scout.heading")}</h1>
        <p>{t("hall.scout.intro")}</p>
        <p>{t("hall.scout.readOnly")}</p>
        <p>{t("hall.scout.noAgentInference")}</p>
      </div>
      <section className="scout-room" aria-label={t("hall.scout.area")}>
        {snapshot.agents.length === 0 ? (
          <div>
            <p>{t(error ? "common.disconnected" : "hall.scout.empty")}</p>
            {error && (
              <details>
                <summary>
                  {t("errors.raw")} · {t("common.original")}
                </summary>
                <p>{error}</p>
              </details>
            )}
          </div>
        ) : (
          snapshot.agents.map((agent) => (
            <button
              key={agent.id}
              className="scout-agent"
              onClick={() => setSelected(agent.id)}
            >
              <span>
                {agentConnectionLabel(snapshot, agent, Date.now(), locale)}
              </span>
              <PixelAgent role={agent.role} />
              <strong>{agent.name}</strong>
              <small>{t("hall.scout.inspect")}</small>
            </button>
          ))
        )}
      </section>
      <footer className="hall-footer">
        <span>
          {t("common.original")} · {snapshot.source}
        </span>
        <p>{t("hall.scout.footer")}</p>
      </footer>
      <AgentWorkspace
        adapter={controller}
        selectedAgentId={selected}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}

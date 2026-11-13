import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AgentWorkspace,
  connectionLabel,
  DEMO_OWNER,
  DEMO_PROJECT,
  DemoWorkspaceAdapter,
  PixelAgent,
  WorkspaceController,
} from "../src";
import { LocaleSwitcher, useI18n } from "../src/i18n";
import "../src/workspace.css";
import "./scene.css";

const demo = new DemoWorkspaceAdapter();
const workspace = new WorkspaceController(demo, DEMO_OWNER, DEMO_PROJECT);
const positions = [
  { x: 48, y: 34 },
  { x: 23, y: 60 },
  { x: 72, y: 59 },
];
export function CommandHall() {
  const { locale, t } = useI18n();
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [player, setPlayer] = useState({ x: 47, y: 77 });
  const [settings, setSettings] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const game = useRef<HTMLDivElement>(null);
  const closestIndex = positions.findIndex(
    (point) => Math.hypot(point.x - player.x, point.y - player.y) < 14,
  );
  useEffect(() => {
    if (selected || settings) return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        /INPUT|TEXTAREA|SELECT|BUTTON/.test(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      const delta: Record<string, [number, number]> = {
        w: [0, -3],
        s: [0, 3],
        a: [-3, 0],
        d: [3, 0],
        ArrowUp: [0, -3],
        ArrowDown: [0, 3],
        ArrowLeft: [-3, 0],
        ArrowRight: [3, 0],
      };
      if (delta[event.key]) {
        event.preventDefault();
        const [x, y] = delta[event.key];
        setPlayer((point) => ({
          x: Math.max(10, Math.min(88, point.x + x)),
          y: Math.max(20, Math.min(84, point.y + y)),
        }));
      }
      if (event.key.toLowerCase() === "e" && closestIndex >= 0) {
        event.preventDefault();
        setSelected(snapshot.agents[closestIndex].id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, settings, closestIndex, snapshot.agents]);
  return (
    <main className={`hall ${selected ? "hall-inspecting" : ""}`}>
      <header className="hall-header">
        <div className="hall-brand">
          <span className="hall-rune">◈</span>
          <strong>DEVUNGEON</strong>
          <span className="hall-divider" />
          <span>{t("hall.title")}</span>
        </div>
        <div className="hall-connection">
          <span>{connectionLabel(snapshot, Date.now(), locale)}</span>
          <LocaleSwitcher />
          <button
            onClick={() => setSettings((value) => !value)}
            aria-expanded={settings}
          >
            {t("hall.settings")}
          </button>
        </div>
      </header>
      <section className="hall-title">
        <p>{t("hall.eyebrow")}</p>
        <h1>{t("hall.heading")}</h1>
        <p>{t("hall.intro")}</p>
      </section>
      <div
        className="hall-stage"
        ref={game}
        tabIndex={0}
        aria-label={t("hall.surface")}
      >
        <svg
          className="hall-room"
          viewBox="0 0 800 600"
          aria-hidden="true"
          shapeRendering="crispEdges"
        >
          <defs>
            <pattern
              id="stone"
              width="48"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <rect width="48" height="40" fill="#303e50" />
              <path
                d="M0 0H48V40H0Z"
                fill="none"
                stroke="#283544"
                strokeWidth="2"
              />
              <path d="M5 5H20M41 27V35" stroke="#3c4b5c" strokeWidth="2" />
            </pattern>
            <pattern
              id="wall"
              width="64"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <rect width="64" height="32" fill="#526373" />
              <path
                d="M0 0H64V32H0ZM32 0V16M0 16H64"
                fill="none"
                stroke="#344554"
                strokeWidth="3"
              />
            </pattern>
          </defs>
          <path d="M56 60H744V512H56Z" fill="#111c28" />
          <path d="M72 76H728V488H72Z" fill="url(#stone)" />
          <path
            d="M56 52H344V92H56ZM456 52H744V92H456ZM56 52V488H86V52ZM714 52V488H744V52Z"
            fill="url(#wall)"
          />
          <path d="M344 52H456V88H440V40H360V88H344Z" fill="#526b7a" />
          <rect x="364" y="44" width="72" height="38" fill="#111c28" />
          <path
            d="M56 488H344V516H56ZM456 488H744V516H456Z"
            fill="url(#wall)"
          />
          <path d="M330 112H470V268H330Z" fill="#24443f" />
          <path
            d="M336 118H464V262H336Z"
            fill="none"
            stroke="#45685d"
            strokeWidth="3"
          />
          <path
            d="M390 132H410V152H430V172H410V192H390V172H370V152H390Z"
            fill="#44695d"
          />
          <g fill="#1e2c39">
            <rect x="116" y="122" width="100" height="42" />
            <rect x="570" y="124" width="94" height="42" />
            <rect x="116" y="384" width="94" height="34" />
            <rect x="568" y="384" width="94" height="34" />
          </g>
          <g fill="#71838b">
            <rect x="120" y="114" width="92" height="32" />
            <rect x="574" y="116" width="86" height="32" />
          </g>
          <g fill="#a8b5a1">
            <rect x="130" y="118" width="22" height="12" />
            <rect x="162" y="124" width="36" height="12" />
            <rect x="586" y="122" width="18" height="16" />
            <rect x="614" y="120" width="36" height="10" />
          </g>
          <g fill="#715b47">
            <rect x="112" y="378" width="102" height="28" />
            <rect x="564" y="378" width="102" height="28" />
          </g>
          <g fill="#f4b45b">
            <rect x="98" y="92" width="8" height="12" />
            <rect x="694" y="92" width="8" height="12" />
          </g>
          <g fill="#a8b5a1">
            <rect x="120" y="380" width="26" height="14" />
            <rect x="576" y="380" width="26" height="14" />
          </g>
          <g fill="#71d2bc">
            <rect x="380" y="498" width="40" height="4" />
            <rect x="388" y="508" width="24" height="4" />
            <rect x="396" y="518" width="8" height="4" />
          </g>
        </svg>
        {snapshot.agents.map((agent, index) => (
          <button
            key={agent.id}
            className={`hall-npc hall-npc-${agent.role}`}
            style={{
              left: `${positions[index].x}%`,
              top: `${positions[index].y}%`,
            }}
            onClick={() => setSelected(agent.id)}
            aria-label={t("hall.talkTo", {
              name: agent.name,
              role: t(`agent.role.${agent.role}`),
            })}
          >
            <span className="hall-npc-state">
              {t(`agent.status.${agent.status}`)} · DEMO
            </span>
            <PixelAgent role={agent.role} />
            <span className="hall-npc-name">
              {agent.name}
              <small>{t(`agent.role.${agent.role}`)}</small>
            </span>
            {closestIndex === index && !selected && (
              <span className="hall-interact">{t("hall.interact")}</span>
            )}
          </button>
        ))}
        <div
          className="hall-player"
          style={{ left: `${player.x}%`, top: `${player.y}%` }}
        >
          <PixelAgent role="worker" />
          <span>{t("workspace.you")}</span>
        </div>
        <span className="hall-room-name">{t("hall.title")}</span>
      </div>
      <aside className="hall-party" aria-label={t("hall.quickSelect")}>
        <span>{t("hall.party", { count: snapshot.agents.length })}</span>
        {snapshot.agents.map((agent) => (
          <button key={agent.id} onClick={() => setSelected(agent.id)}>
            <PixelAgent role={agent.role} />
            <span>
              <strong>{agent.name}</strong>
              <small>
                {t(`agent.role.${agent.role}`)} ·{" "}
                {t(`agent.status.${agent.status}`)}
              </small>
            </span>
            <span className="hall-party-arrow">↗</span>
          </button>
        ))}
      </aside>
      <footer className="hall-footer">
        <div>
          <kbd>W A S D</kbd> {t("hall.move")} <kbd>E</kbd> {t("hall.approach")}{" "}
          <span>{t("hall.orClick")}</span>
        </div>
        <p>{t("hall.footer")}</p>
      </footer>
      <AgentWorkspace
        adapter={workspace}
        selectedAgentId={selected}
        onRestoreFocus={() => game.current?.focus()}
        onClose={() => {
          setSelected(null);
          requestAnimationFrame(() => game.current?.focus());
        }}
      />
      {settings && (
        <section
          className="hall-settings"
          aria-label={t("hall.connectionSettings")}
        >
          <h2>{t("hall.simulatedConnection")}</h2>
          <p>{t("hall.settingsHelp")}</p>
          <button onClick={() => demo.setConnection(!snapshot.connected)}>
            {t(snapshot.connected ? "hall.disconnect" : "hall.reconnect")}
          </button>
          <button onClick={() => demo.makeStale()}>{t("hall.stale")}</button>
          <button
            onClick={() => {
              demo.failNext();
              setFeedback(true);
            }}
          >
            {t("hall.failNext")}
          </button>
          <button
            onClick={() => {
              setSettings(false);
              setFeedback(false);
            }}
          >
            {t("hall.closeSettings")}
          </button>
          <p role="status">{feedback ? t("hall.failFeedback") : ""}</p>
        </section>
      )}
    </main>
  );
}

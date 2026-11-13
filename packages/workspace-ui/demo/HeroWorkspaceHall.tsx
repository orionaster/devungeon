import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DungeonScene } from "../../../apps/web/src/Scene";
import {
  actions,
  cameraControl,
  clearInput,
  keys,
  projection,
  runtime,
} from "../../../apps/web/src/runtime";
import {
  AgentProjection,
  DEMO_SCENE,
  Dungeon,
  type GameSnapshot,
  type SceneDefinition,
} from "../../dungeon-engine/src";
import {
  AgentWorkspace,
  agentConnectionLabel,
  connectScoutStream,
  createHeroDemoWorkspace,
  PixelAgent,
  ScoutWorkspaceAdapter,
  CodexTextAdapter,
  CODEX_TEXT_PROJECT,
  CODEX_TEXT_REQUESTER,
  WorkspaceController,
} from "../src";
import type { WorkspaceSnapshot } from "../src";
import { LocaleSwitcher, useI18n } from "../src/i18n";
import "../src/workspace.css";
import "./hero-hall.css";

type Work = { controller: WorkspaceController; dispose: () => void };
declare global {
  interface Window {
    /** Read-only reviewer diagnostics. No command, approval or gameplay setters. */
    __DEVUNGEON_WORKSPACE__?: {
      snapshot: () => WorkspaceSnapshot;
      selectedId: () => string | null;
    };
  }
}

export default function HeroWorkspaceHall({
  source = "demo",
}: {
  source?: "demo" | "scout" | "codex";
}) {
  const { t } = useI18n();
  const [work, setWork] = useState<Work>();
  const [game, setGame] = useState<GameSnapshot>();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [activityEnabled, setActivityEnabled] = useState(source === "demo");
  const surface = useRef<HTMLDivElement>(null);
  const initialScene: SceneDefinition =
    source !== "demo" ? { ...DEMO_SCENE, agents: [] } : DEMO_SCENE;
  const sceneRef = useRef(initialScene);
  const [visual, setVisual] = useState({ scene: initialScene, projection });
  const focus = () => surface.current?.focus({ preventScroll: true });
  const select = (id: string) => {
    clearInput();
    setSelected(id);
  };
  const close = () => {
    clearInput();
    setSelected(null);
    requestAnimationFrame(focus);
  };
  selectedRef.current = selected;

  useEffect(() => {
    let alive = true;
    let dungeon: Dungeon | undefined;
    const observer =
      source === "scout"
        ? new ScoutWorkspaceAdapter("github:orionaster/devungeon")
        : source === "codex"
          ? new CodexTextAdapter()
          : null;
    const workspace: Work = observer
      ? (() => {
          const controller = new WorkspaceController(
            observer,
            source === "codex" ? CODEX_TEXT_REQUESTER : "local-viewer",
            source === "codex"
              ? CODEX_TEXT_PROJECT
              : "github:orionaster/devungeon",
          );
          return {
            controller,
            dispose: () => {
              controller.dispose();
              if (observer instanceof CodexTextAdapter) observer.dispose();
            },
          };
        })()
      : createHeroDemoWorkspace();
    let stopStream = () => {};
    let painter = projection;
    let rosterKey = source !== "demo" ? "" : "demo";
    const projected = new Set<string>();
    const project = () => {
      const state = workspace.controller.getSnapshot();
      setActivityEnabled(state.connected && !state.stale);
      if (state.connected) setConnectionError("");
      if (observer) {
        const key = state.agents.map((agent) => agent.id).join("|");
        if (key !== rosterKey) {
          rosterKey = key;
          painter = new AgentProjection(
            state.project_id,
            state.agents.map((agent) => agent.id),
          );
          projected.clear();
          // This is display placement in an explicitly DEMO game room. A skin
          // and position never assert an undeclared real-world role or room.
          sceneRef.current = {
            ...DEMO_SCENE,
            agents: [...state.agents]
              .sort(
                (a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at),
              )
              .slice(0, 3)
              .map((agent, index) => ({
                agent_id: agent.id,
                name: agent.name,
                role: "scout" as const,
                room_id: "forge",
                x: -8 - index * 2,
                z: -3 + index * 2,
              })),
          };
          setVisual({ scene: sceneRef.current, projection: painter });
        }
      }
      for (const event of state.events) {
        if (projected.has(event.event_id)) continue;
        const mode = state.event_modes[event.event_id] ?? state.mode;
        const age = Date.now() - Date.parse(event.occurred_at);
        // Replay metadata may be observed now. Only fresh LIVE observations or
        // explicit DEMO events are allowed to trigger a working animation.
        if (
          (source !== "codex" || event.source === "codex-app-server") &&
          (!observer ||
            (state.connected &&
              !state.stale &&
              ((mode === "demo" && event.is_demo) ||
                (mode === "live" && !event.is_demo && age >= 0 && age < 3000))))
        )
          painter.ingest(event);
        projected.add(event.event_id);
      }
    };
    const unsubscribe = workspace.controller.subscribe(project);
    project();
    setWork(workspace);
    if (observer instanceof ScoutWorkspaceAdapter)
      stopStream = connectScoutStream(
        observer,
        "/scout-read/v1/stream",
        setConnectionError,
      );
    cameraControl.mode = "follow";
    cameraControl.heading = 0;
    cameraControl.zoom = 44;
    cameraControl.target = { ...DEMO_SCENE.spawn };
    runtime.selectAgent = select;
    runtime.onFrame = setGame;
    window.__DEVUNGEON_WORKSPACE__ = {
      snapshot: workspace.controller.getSnapshot,
      selectedId: () => selectedRef.current,
    };
    void Dungeon.create(initialScene)
      .then((created) => {
        if (!alive) {
          created.dispose();
          return;
        }
        dungeon = created;
        dungeon.start();
        runtime.game = dungeon;
        runtime.frame = dungeon.snapshot();
        setGame(runtime.frame);
        focus();
      })
      .catch((cause) => {
        if (alive) setError(String(cause));
      });
    // HERO's independent tickDemo is deliberately not started. These characters
    // animate only from this work controller's attributable DEMO events.
    return () => {
      alive = false;
      clearInput();
      stopStream();
      unsubscribe();
      workspace.dispose();
      dungeon?.dispose();
      runtime.game = undefined;
      runtime.frame = undefined;
      runtime.onFrame = undefined;
      runtime.selectAgent = undefined;
      delete window.__DEVUNGEON_WORKSPACE__;
    };
  }, [source]);

  useEffect(() => {
    runtime.paused = paused || selected !== null;
    clearInput();
  }, [paused, selected]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        selected ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,button"))
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.code,
        )
      )
        event.preventDefault();
      if (event.code === "Escape" || event.code === "KeyP") {
        setPaused((value) => !value);
        clearInput();
        return;
      }
      if (event.repeat) return;
      if (event.code === "KeyE") {
        const player = runtime.game?.snapshot().player;
        const nearest =
          player &&
          [...sceneRef.current.agents].sort(
            (a, b) =>
              Math.hypot(a.x - player.x, a.z - player.z) -
              Math.hypot(b.x - player.x, b.z - player.z),
          )[0];
        if (
          nearest &&
          player &&
          Math.hypot(nearest.x - player.x, nearest.z - player.z) < 3
        )
          select(nearest.agent_id);
        return;
      }
      if (event.code === "KeyQ" || event.code === "KeyR")
        cameraControl.heading =
          (cameraControl.heading + (event.code === "KeyQ" ? 3 : 1)) % 4;
      if (paused) return;
      keys.add(event.code);
      if (event.code === "KeyJ") actions.attack = true;
      if (event.code === "Space") actions.dodge = true;
    };
    const up = (event: KeyboardEvent) => keys.delete(event.code);
    const blur = () => {
      clearInput();
      setPaused(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [selected, paused]);

  const restart = () => {
    clearInput();
    runtime.game?.restart();
    runtime.game?.start();
    setGame(runtime.game?.snapshot());
    setPaused(false);
    focus();
  };
  return (
    <main className="hero-hall">
      <div
        ref={surface}
        className="hero-hall-canvas"
        tabIndex={0}
        aria-label={t("heroHall.surface")}
        onPointerDown={() => focus()}
        onWheel={(event) => {
          cameraControl.zoom = Math.max(
            20,
            Math.min(72, cameraControl.zoom - event.deltaY * 0.025),
          );
        }}
      >
        <DungeonScene
          scene={visual.scene}
          agentProjection={visual.projection}
          agentActivityEnabled={activityEnabled}
        />
      </div>
      <header className="hero-hall-header">
        <div>
          <strong>DEVUNGEON</strong>
          <span>{t("heroHall.subtitle")}</span>
        </div>
        <span className="hero-hall-demo">
          {t(
            source === "scout"
              ? "heroHall.scout"
              : source === "codex"
                ? "heroHall.codex"
                : "heroHall.demo",
          )}
        </span>
        <div style={{ pointerEvents: "auto" }}>
          <LocaleSwitcher />
        </div>
      </header>
      <section className="hero-hall-intro">
        <p>{t("heroHall.eyebrow")}</p>
        <h1>{t("heroHall.heading")}</h1>
        <p>
          {t(
            source === "codex"
              ? "heroHall.codexIntro"
              : source === "scout"
                ? "heroHall.scoutIntro"
                : "heroHall.intro",
          )}
        </p>
      </section>
      {work && <Party work={work} select={select} />}
      <aside className="hero-hall-game" aria-label={t("heroHall.gameState")}>
        <span>{t("heroHall.health", { hp: game?.player.hp ?? "—" })}</span>
        <span>
          {t("heroHall.kills", {
            kills: game?.kills ?? 0,
            total: game?.total ?? 4,
          })}
        </span>
        <span>
          {t(
            game?.phase === "lost"
              ? "heroHall.lost"
              : game?.phase === "won"
                ? "heroHall.won"
                : selected
                  ? "heroHall.inspecting"
                  : paused
                    ? "heroHall.paused"
                    : "heroHall.exploring",
          )}
        </span>
        <button
          onClick={() => {
            setPaused((value) => !value);
            clearInput();
            focus();
          }}
        >
          {t(paused ? "heroHall.resume" : "heroHall.pause")}
        </button>
        <button onClick={restart}>{t("heroHall.restart")}</button>
        <button
          onClick={() => {
            cameraControl.mode =
              cameraControl.mode === "overview" ? "follow" : "overview";
            focus();
          }}
        >
          {t("heroHall.camera")}
        </button>
      </aside>
      {error && (
        <p className="hero-hall-error" role="alert">
          {t("errors.raw")} · {t("common.original")}: {error}
        </p>
      )}
      {connectionError && (
        <div className="hero-hall-connection-error" role="status">
          {t("heroHall.connectionError", { error: t("common.disconnected") })}
          <details>
            <summary>
              {t("errors.raw")} · {t("common.original")}
            </summary>
            <span>{connectionError}</span>
          </details>
        </div>
      )}
      <footer className="hero-hall-footer">
        <span>{t("heroHall.controls")}</span>
        <span>{t("heroHall.isolation")}</span>
      </footer>
      {work && (
        <AgentWorkspace
          adapter={work.controller}
          selectedAgentId={selected}
          onClose={close}
        />
      )}
    </main>
  );
}

function Party({ work, select }: { work: Work; select: (id: string) => void }) {
  const { locale, t } = useI18n();
  const snapshot = useSyncExternalStore(
    work.controller.subscribe,
    work.controller.getSnapshot,
  );
  return (
    <aside className="hero-hall-party" aria-label={t("heroHall.party")}>
      <h2>
        {t("heroHall.party")}{" "}
        <span>
          {snapshot.project_id === DEMO_SCENE.worldId
            ? "DEMO"
            : t(
                snapshot.project_id === CODEX_TEXT_PROJECT
                  ? "heroHall.textTrial"
                  : "heroHall.readSource",
              )}
        </span>
      </h2>
      {snapshot.agents.length === 0 && <p>{t("heroHall.noActors")}</p>}
      {snapshot.agents.map((agent) => (
        <button key={agent.id} onClick={() => select(agent.id)}>
          <PixelAgent role={agent.role} />
          <span>
            <strong>{agent.name}</strong>
            <small>
              {t(`agent.role.${agent.role}`)} ·{" "}
              {agentConnectionLabel(snapshot, agent, Date.now(), locale)}
            </small>
          </span>
          <span>↗</span>
        </button>
      ))}
      <p>{t("heroHall.sharedIds")}</p>
    </aside>
  );
}

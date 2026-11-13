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
        : source === "codex" ? new CodexTextAdapter() : null;
    const workspace: Work = observer
      ? (() => {
          const controller = new WorkspaceController(
            observer,
            source === "codex" ? CODEX_TEXT_REQUESTER : "local-viewer",
            source === "codex" ? CODEX_TEXT_PROJECT : "github:orionaster/devungeon",
          );
          return { controller, dispose: () => {
            controller.dispose();
            if (observer instanceof CodexTextAdapter) observer.dispose();
          } };
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
          (source !== "codex" || event.source === "codex-app-server") && (!observer ||
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
        aria-label="3D 地牢，WASD 移动，J 攻击，空格闪避，靠近队友按 E 交谈"
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
          <span>余烬工坊 · 3D 工作台联调</span>
        </div>
        <span className="hero-hall-demo">
          {source === "scout"
            ? "DEMO 世界 / SCOUT 只读来源"
            : source === "codex" ? "DEMO 世界 / Codex 文本试验 · 默认关闭" : "DEMO 世界 / 模拟 Agent"}
        </span>
      </header>
      <section className="hero-hall-intro">
        <p>HERO 场景 × WIZARD 工作台</p>
        <h1>队友就在地牢里。</h1>
        <p>
          {source === "codex" ? (
            <>
              独立合成会话，每条最多 1000 字，至多两次回复。
              <br />
              需主管明确启用；不允许工具、工程文件或任务执行。
            </>
          ) : source === "scout" ? (
            <>
              走近观察角色，核对真实活动与证据。
              <br />
              此连接只读，游戏暂停不影响事件观察。
            </>
          ) : (
            <>
              走近交谈，交付目标，然后继续冒险。
              <br />
              面板打开时暂停本地战斗，后台工作继续。
            </>
          )}
        </p>
      </section>
      {work && <Party work={work} select={select} />}
      <aside className="hero-hall-game" aria-label="独立游戏状态">
        <span>游戏生命 {game?.player.hp ?? "—"} / 100</span>
        <span>
          击败 {game?.kills ?? 0} / {game?.total ?? 4}
        </span>
        <span>
          {game?.phase === "lost"
            ? "本次冒险失败"
            : game?.phase === "won"
              ? "战斗胜利 · 仅游戏结果"
              : selected
                ? "交谈中 · 战斗暂停"
                : paused
                  ? "战斗已暂停"
                  : "自由探索"}
        </span>
        <button
          onClick={() => {
            setPaused((value) => !value);
            clearInput();
            focus();
          }}
        >
          {paused ? "继续冒险" : "暂停战斗"}
        </button>
        <button onClick={restart}>重新开始冒险</button>
        <button
          onClick={() => {
            cameraControl.mode =
              cameraControl.mode === "overview" ? "follow" : "overview";
            focus();
          }}
        >
          跟随 / 全览
        </button>
      </aside>
      {error && (
        <p className="hero-hall-error" role="alert">
          {error}
        </p>
      )}
      {connectionError && (
        <p className="hero-hall-connection-error" role="status">
          {connectionError} 游戏可继续，来源记录保留。
        </p>
      )}
      <footer className="hero-hall-footer">
        <span>WASD 移动 · J 攻击 · Space 闪避 · Q/R 转向 · E 交谈</span>
        <span>游戏胜负不验收项目，也不批准或取消工作</span>
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
  const snapshot = useSyncExternalStore(
    work.controller.subscribe,
    work.controller.getSnapshot,
  );
  return (
    <aside className="hero-hall-party" aria-label="地牢队友">
      <h2>
        工坊里的队友{" "}
        <span>
          {snapshot.project_id === DEMO_SCENE.worldId ? "DEMO" : snapshot.project_id === CODEX_TEXT_PROJECT ? "文本试验" : "只读来源"}
        </span>
      </h2>
      {snapshot.agents.length === 0 && (
        <p>尚未收到 Agent 记录；项目工作项不会被绘成 Agent。</p>
      )}
      {snapshot.agents.map((agent) => (
        <button key={agent.id} onClick={() => select(agent.id)}>
          <PixelAgent role={agent.role} />
          <span>
            <strong>{agent.name}</strong>
            <small>
              {agent.role === "supervisor"
                ? "主管"
                : agent.role === "worker"
                  ? "执行"
                  : agent.role === "reviewer"
                    ? "审查"
                    : "角色未声明"}{" "}
              · {agentConnectionLabel(snapshot, agent)}
            </small>
          </span>
          <span>↗</span>
        </button>
      ))}
      <p>与地牢中的角色共享 ID、工作事件和面板。</p>
    </aside>
  );
}

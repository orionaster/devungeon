import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEMO_SCENE,
  Dungeon,
  AgentProjection,
  inside,
  type GameSnapshot,
  type SceneDefinition,
  type Room,
} from "../../../packages/dungeon-engine/src";
import { DungeonScene } from "./Scene";
import {
  LocaleSwitcher,
  useI18n,
} from "../../../packages/workspace-ui/src/i18n";
import {
  gameRoomNameKeys,
  gameAgentNameKeys,
  gameRoleKeys,
  gameAgentStatusKeys,
  gameProjectStatusKeys,
  gameDemoMessageKeys,
  type GameMessageKey,
} from "../../../packages/workspace-ui/src/i18n/game-catalogue";
import {
  actions,
  cameraControl,
  clearInput,
  keys,
  pointer,
  projection,
  runtime,
  tickDemo,
} from "./runtime";
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="glyph" aria-hidden="true">
      {children}
    </span>
  );
}
export interface GameHostProps {
  scene?: SceneDefinition;
  agentEvents?: AgentProjection;
  demoEvents?: boolean;
  /** Workspace/controller owns authorization; the host only exposes selection/focus. */
  renderAgentInspector?: (context: {
    agentId: string;
    onClose: () => void;
  }) => ReactNode;
  roomDisplay?: (room: Room) => {
    name: string;
    reason: string;
    status: string;
  };
  sourcePanel?: ReactNode;
}
export default function App({
  scene = DEMO_SCENE,
  agentEvents: incomingEvents,
  demoEvents = true,
  renderAgentInspector,
  roomDisplay,
  sourcePanel,
}: GameHostProps) {
  const { t, locale, formatDateTime } = useI18n();
  const builtin = scene.worldId === DEMO_SCENE.worldId;
  const demoWorld =
    !scene.project_context || scene.project_context.source.is_demo;
  const roomName = (room: Room) =>
    roomDisplay?.(room).name ??
    (builtin && room.room_id in gameRoomNameKeys
      ? t(gameRoomNameKeys[room.room_id as keyof typeof gameRoomNameKeys])
      : room.name);
  const roomReason = (room: Room) =>
    roomDisplay?.(room).reason ??
    (builtin && ["forge", "arena", "vault"].includes(room.room_id)
      ? t(`game.room.${room.room_id}.reason` as GameMessageKey)
      : room.reason);
  const roomStatus = (room: Room) =>
    roomDisplay?.(room).status ??
    (room.status.includes("DEMO")
      ? t(
          room.enterable
            ? "game.label.demoGameSpace"
            : "game.label.plannedDemo",
        )
      : room.status in gameProjectStatusKeys
        ? t(
            gameProjectStatusKeys[
              room.status as keyof typeof gameProjectStatusKeys
            ],
          )
        : room.status);
  const agentName = (id: string, name: string) =>
    builtin && id in gameAgentNameKeys
      ? t(gameAgentNameKeys[id as keyof typeof gameAgentNameKeys])
      : name;
  const roleName = (role: string) =>
    t(gameRoleKeys[role as keyof typeof gameRoleKeys] ?? "game.role.unknown");
  const eventStatus = (status: string) =>
    t(
      gameAgentStatusKeys[status as keyof typeof gameAgentStatusKeys] ??
        "game.agentStatus.unknown",
    );
  const eventMessage = (e: {
    source: string;
    is_demo: boolean;
    message?: string;
  }) =>
    e.source === "synthetic:s1-script" &&
    e.is_demo &&
    e.message &&
    e.message in gameDemoMessageKeys
      ? t(gameDemoMessageKeys[e.message as keyof typeof gameDemoMessageKeys])
      : e.message;
  useEffect(() => {
    document.title = t("game.document.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("game.document.description"));
  }, [t]);
  const projectId =
    scene.project_context?.project_id ??
    (builtin
      ? DEMO_SCENE.worldId
      : (incomingEvents?.projectId ?? scene.worldId));
  const eventScopeMismatch =
    !!incomingEvents && incomingEvents.projectId !== projectId;
  const eventProjection = useMemo(
    () =>
      (!eventScopeMismatch ? incomingEvents : undefined) ??
      (scene === DEMO_SCENE
        ? projection
        : new AgentProjection(
            projectId,
            scene.agents.map((a) => a.agent_id),
          )),
    [scene, incomingEvents, projectId, eventScopeMismatch],
  );
  const agentNames = Object.fromEntries(
    scene.agents.map((a) => [a.agent_id, a.name]),
  );
  const [game, setGame] = useState<GameSnapshot>(),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [started, setStarted] = useState(false),
    [help, setHelp] = useState(false),
    [journal, setJournal] = useState(true),
    [selected, setSelected] = useState<string | null>(null),
    [atlas, setAtlas] = useState(false),
    [cameraMode, setCameraMode] = useState("overview"),
    [effects, setEffects] = useState(!runtime.reducedEffects),
    [resultDismissed, setResultDismissed] = useState(false);
  const surface = useRef<HTMLDivElement>(null!);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const focus = () => surface.current?.focus({ preventScroll: true });
  const pause = (value: boolean) => {
    runtime.paused = value;
    setPaused(value);
    clearInput();
  };
  const setMode = (mode: "overview" | "follow" | "preview" | "free") => {
    cameraControl.mode = mode;
    setCameraMode(mode);
    focus();
  };
  const rotate = (d: number) => {
    cameraControl.heading = (((cameraControl.heading + d) % 4) + 4) % 4;
    focus();
  };
  const start = () => {
    runtime.game?.start();
    setStarted(true);
    setResultDismissed(false);
    pause(false);
    setMode("follow");
    focus();
  };
  const restart = () => {
    runtime.game?.restart();
    start();
    setSelected(null);
  };
  useEffect(() => {
    let alive = true;
    let created: Dungeon | undefined;
    setError("");
    runtime.frame = undefined;
    clearInput();
    runtime.paused = false;
    setPaused(false);
    setStarted(false);
    setGame(undefined);
    setSelected(null);
    setResultDismissed(false);
    cameraControl.mode = "overview";
    cameraControl.previewRoomId = undefined;
    setCameraMode("overview");
    Dungeon.create(scene)
      .then((g) => {
        created = g;
        if (!alive) {
          g.dispose();
          return;
        }
        runtime.game = g;
        runtime.frame = g.snapshot();
        setGame(g.snapshot());
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    runtime.onFrame = setGame;
    runtime.selectAgent = (id) => {
      setSelected(id);
      clearInput();
    };
    runtime.selectRoom = (id) => setSelected(id);
    return () => {
      alive = false;
      created?.dispose();
      runtime.game = undefined;
      runtime.frame = undefined;
      runtime.onFrame = undefined;
    };
  }, [scene]);
  useEffect(() => {
    runtime.agentEvents = eventProjection;
    const scripted =
      demoEvents && scene === DEMO_SCENE && eventProjection === projection;
    if (scripted) tickDemo();
    const timer = scripted ? setInterval(tickDemo, 2800) : undefined;
    return () => {
      clearInterval(timer);
      if (runtime.agentEvents === eventProjection)
        runtime.agentEvents = undefined;
    };
  }, [scene, eventProjection, demoEvents]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea,select")
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Escape") {
        if (selected) {
          setSelected(null);
          focus();
        } else if (help) setHelp(false);
        else if (atlas) setAtlas(false);
        else if (started) pause(!runtime.paused);
        return;
      }
      if (help || selected || atlas) return;
      if (
        e.code === "Enter" &&
        game &&
        (game.phase === "lost" || game.phase === "won")
      ) {
        restart();
        return;
      }
      if (!e.repeat) {
        if (e.code === "KeyQ") rotate(-1);
        if (e.code === "KeyR") rotate(1);
        if (e.code === "KeyF") setMode("overview");
        if (e.code === "KeyC") setMode("follow");
        if (e.code === "KeyP" && started) pause(!runtime.paused);
        if (e.code === "KeyE") {
          const p = runtime.game?.snapshot().player;
          if (p) {
            const near = scene.agents.find(
              (a) => Math.hypot(p.x - a.x, p.z - a.z) < 3,
            );
            if (near) {
              setSelected(near.agent_id);
              clearInput();
            }
          }
        }
      }
      if (!runtime.paused && started && !e.repeat) {
        if (e.code === "Space") actions.dodge = true;
        if (e.code === "KeyJ") actions.attack = true;
      }
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => {
      clearInput();
      if (started && runtime.game?.snapshot().phase === "playing") pause(true);
    };
    const release = () => {
      pointer.down = false;
      drag.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [started, selected, help, atlas, game?.phase, scene]);
  useEffect(() => {
    if (selected || help || atlas) clearInput();
  }, [selected, help, atlas]);
  const events = eventProjection.snapshot();
  const chosenAgent = scene.agents.find((a) => a.agent_id === selected);
  const chosenRoom = scene.rooms.find((r) => r.room_id === selected);
  const remaining = game ? game.total - game.kills : scene.enemies.length;
  const phase = game?.phase;
  const results =
    started && !resultDismissed && (phase === "won" || phase === "lost");
  const lockedRoom = scene.rooms.find((r) => !r.enterable);
  const currentRoom = game
    ? scene.rooms.find((r) => r.enterable && inside(game.player, r))
    : undefined;
  const chosenEvent = chosenAgent
    ? eventProjection.actor(chosenAgent.agent_id).event
    : undefined;
  return (
    <main className="app">
      <div
        ref={surface}
        className="game-surface"
        tabIndex={0}
        aria-label={t("game.aria.surface")}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          focus();
          if (e.button === 2) {
            drag.current = { x: e.clientX, y: e.clientY };
            return;
          }
          if (e.button === 0 && started && !help && !selected && !atlas) {
            pointer.down = true;
            actions.attack = true;
          }
        }}
        onPointerUp={() => {
          pointer.down = false;
          drag.current = null;
        }}
        onPointerLeave={() => {
          pointer.down = false;
          drag.current = null;
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            cameraControl.mode = "free";
            setCameraMode("free");
            const dx = (e.clientX - drag.current.x) / cameraControl.zoom,
              dz = (e.clientY - drag.current.y) / cameraControl.zoom;
            const a = (cameraControl.heading * Math.PI) / 2;
            cameraControl.target.x -= dx * Math.cos(a) + dz * Math.sin(a);
            cameraControl.target.z -= dz * Math.cos(a) - dx * Math.sin(a);
            drag.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onWheel={(e) => {
          cameraControl.zoom = Math.max(
            20,
            Math.min(72, cameraControl.zoom - e.deltaY * 0.025),
          );
        }}
      >
        <DungeonScene
          scene={scene}
          agentEvents={eventProjection}
          fallback={
            <div className="webgl-fallback">{t("game.fallback.webgl")}</div>
          }
        />
      </div>
      <div className="vignette" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <div>
            <b>DEVUNGEON</b>
            <small>{t("game.brand.tagline")}</small>
          </div>
        </div>
        <div className="chapter">
          <span>{t("game.location.archive")}</span>
          <small>{t("game.chapter.description")}</small>
        </div>
        <div className="top-actions">
          <LocaleSwitcher
            onPointerLocaleChange={() => {
              if (started && !selected && !help && !atlas && !results) focus();
            }}
          />
          <span className="demo-badge">
            {!scene.project_context || scene.project_context.source.is_demo
              ? t("game.label.demoWorld")
              : t("game.label.readOnly")}
          </span>
          <button
            onClick={() => {
              setAtlas(!atlas);
              clearInput();
            }}
            aria-label={t("game.aria.openAtlas")}
          >
            <Glyph>▧</Glyph>
            <span>{t("game.atlas.open")}</span>
          </button>
          <button
            onClick={() => {
              setHelp(!help);
              clearInput();
            }}
            aria-label={t("game.aria.controlsSettings")}
          >
            ?
          </button>
          {started && (
            <button
              onClick={() => pause(!paused)}
              aria-label={paused ? t("game.aria.resume") : t("game.aria.pause")}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          )}
        </div>
      </header>
      {started && game && (
        <section className="health-hud" aria-label={t("game.aria.health")}>
          <div className="avatar">✦</div>
          <div>
            <div className="health-label">
              <b>{t("game.hud.playerName")}</b>
              <span>{game.player.hp} / 100</span>
            </div>
            <div className="health-track">
              <i style={{ width: `${game.player.hp}%` }} />
            </div>
            <small>
              {t("game.hud.weapon")}
              <span>·</span>{" "}
              {game.rewardClaimed
                ? t("game.hud.sigilAcquired")
                : t("game.hud.courage")}
            </small>
          </div>
        </section>
      )}
      {started && (
        <section className="encounter-hud" aria-live="polite">
          <span className={remaining === 0 ? "complete" : "pulsar"} />
          <div>
            <b>
              {remaining === 0
                ? t("game.encounter.quiet")
                : t("game.encounter.remaining", { count: remaining })}
            </b>
            <small>
              {phase === "lost"
                ? t("game.encounter.defeatHint")
                : remaining === 0
                  ? t("game.encounter.victoryHint")
                  : t("game.encounter.instructions")}
            </small>
          </div>
        </section>
      )}
      {!started && (
        <section className="entry-panel">
          <div className="entry-kicker">{t("game.entry.kicker")}</div>
          <h1>
            {t("game.entry.titleLead")}
            <br />
            <em>{t("game.entry.titleEmphasis")}</em>
            {locale === "en-US" ? " " : ""}
            {t("game.entry.titleEnd")}
          </h1>
          <p>
            {t("game.entry.descriptionLead")}
            <br />
            {t("game.entry.descriptionAction")}
            <br />
            {t("game.entry.descriptionCompanions")}
          </p>
          <button className="primary start" disabled={!game} onClick={start}>
            {error
              ? t("game.entry.unavailable")
              : game
                ? t("game.entry.start")
                : t("game.entry.loading")}
            <span>→</span>
          </button>
          <div className="entry-controls">
            <kbd>W A S D</kbd>
            {t("game.entry.wander")}
            <kbd>J</kbd>
            {t("game.entry.strike")}
            <kbd>{t("game.hud.spaceKey")}</kbd>
            {t("game.entry.dodge")}
          </div>
          <small className="entry-note">
            {t("game.entry.encounterNote")}
            <br />
            {t("game.entry.simulationNote")}
          </small>
          {error && (
            <div role="alert">
              <p>{t("game.error.load")}</p>
              <details>
                <summary>{t("game.error.details")}</summary>
                <code>{error}</code>
              </details>
            </div>
          )}
        </section>
      )}
      {started && (
        <>
          <button
            className="journal-toggle"
            onClick={() => setJournal(!journal)}
            aria-expanded={journal}
          >
            <Glyph>≡</Glyph>
            {journal ? t("game.journal.close") : t("game.journal.open")}
          </button>
          {journal && (
            <aside className="journal">
              <div className="section-label">
                <span>{t("game.journal.companions")}</span>
                <span className="tiny-badge">
                  {t(demoWorld ? "game.label.demo" : "game.label.readOnly")}
                </span>
              </div>
              <h2>{t("game.journal.title")}</h2>
              <p className="muted">
                {builtin
                  ? t("game.journal.description")
                  : t("game.label.sourceEvidence")}
              </p>
              <div className="agent-list">
                {eventScopeMismatch && (
                  <p role="status">{t("game.host.eventScopeMismatch")}</p>
                )}
                {!scene.agents.length && (
                  <p className="muted">{t("game.host.noActors")}</p>
                )}
                {scene.agents.map((a) => {
                  const e = eventProjection.actor(a.agent_id);
                  return (
                    <button
                      key={a.agent_id}
                      onClick={() => {
                        setSelected(a.agent_id);
                        clearInput();
                      }}
                      className="agent-row"
                    >
                      <span className={`agent-icon ${a.role}`}>
                        {a.role === "builder"
                          ? "⚒"
                          : a.role === "scout"
                            ? "⌁"
                            : "✧"}
                      </span>
                      <span>
                        <b>{agentName(a.agent_id, a.name)}</b>
                        {(a.is_demo ?? demoWorld) && !builtin && (
                          <small>{t("game.label.demo")}</small>
                        )}
                        {a.visual_only && (
                          <small>{t("game.host.visualOnly")}</small>
                        )}
                        <small>
                          {roleName(a.source_role ?? a.role)} ·{" "}
                          {e.stale
                            ? t("game.agentStatus.stale")
                            : eventStatus(e.event?.event_type ?? "idle")}
                        </small>
                      </span>
                      <span className="row-arrow">↗</span>
                    </button>
                  );
                })}
              </div>
              <div className="journal-feed">
                <div className="section-label">
                  {t("game.journal.feed")}
                  <span className="tiny-badge">
                    {t(
                      events.every((e) => e.is_demo)
                        ? "game.label.scripted"
                        : "game.label.originalText",
                    )}
                  </span>
                </div>
                {events.slice(0, 2).map((e) => (
                  <div key={e.event_id} className="feed-event">
                    <span className="event-dot" />
                    <div>
                      <b>
                        {agentName(
                          e.agent_id,
                          agentNames[e.agent_id] ?? e.agent_id,
                        )}
                      </b>
                      <p>{eventMessage(e)}</p>
                      {!builtin && (
                        <small>
                          {t(
                            e.is_demo
                              ? "common.mode.demo"
                              : "game.host.observations",
                          )}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {lockedRoom && (
                <button
                  className="vault-link"
                  onClick={() => {
                    setSelected(lockedRoom.room_id);
                    cameraControl.previewRoomId = lockedRoom.room_id;
                    setMode("preview");
                  }}
                >
                  <span>♜</span>
                  <div>
                    <b>{roomName(lockedRoom)}</b>
                    <small>{t("game.journal.previewLocked")}</small>
                  </div>
                  <span>→</span>
                </button>
              )}
              {sourcePanel}
              <p className="truth-note">
                {t(
                  demoWorld
                    ? "game.journal.demoNotice"
                    : "game.inspector.displayOnly",
                )}
                <br />
                {t("game.journal.acceptanceNotice")}
              </p>
            </aside>
          )}
          <div className="location">
            <span>✦</span>
            <div>
              <small>
                {currentRoom
                  ? roomName(currentRoom)
                  : t("game.location.passage")}
              </small>
              <p>
                {paused
                  ? t("game.location.paused")
                  : t("game.location.explore")}
              </p>
            </div>
          </div>
          <nav className="quickbar" aria-label={t("game.aria.gameControls")}>
            <div>
              <kbd>WASD</kbd>
              <span>{t("game.hud.move")}</span>
            </div>
            <div>
              <kbd>{t("game.hud.attackKey")}</kbd>
              <span>{t("game.hud.strike")}</span>
            </div>
            <div className={game && game.dodgeCooldown > 0 ? "cooling" : ""}>
              <kbd>{t("game.hud.spaceKey")}</kbd>
              <span>
                {game && game.dodgeCooldown > 0
                  ? t("game.hud.cooldown", {
                      time: game.dodgeCooldown.toFixed(1),
                    })
                  : t("game.hud.dodge")}
              </span>
            </div>
            <div>
              <kbd>E</kbd>
              <span>{t("game.hud.inspect")}</span>
            </div>
          </nav>
        </>
      )}
      <nav className="camera-tools" aria-label={t("game.aria.cameraControls")}>
        <button onClick={() => rotate(-1)} title={t("game.camera.rotateLeft")}>
          ↶
        </button>
        <button
          onClick={() => {
            cameraControl.zoom = Math.max(20, cameraControl.zoom - 6);
            focus();
          }}
          aria-label={t("game.camera.zoomOut")}
        >
          −
        </button>
        <button
          onClick={() =>
            setMode(cameraMode === "overview" ? "follow" : "overview")
          }
          className={cameraMode === "overview" ? "active" : ""}
        >
          {cameraMode === "overview"
            ? t("game.camera.follow")
            : t("game.camera.overview")}
        </button>
        <button
          onClick={() => {
            cameraControl.zoom = Math.min(72, cameraControl.zoom + 6);
            focus();
          }}
          aria-label={t("game.camera.zoomIn")}
        >
          +
        </button>
        <button onClick={() => rotate(1)} title={t("game.camera.rotateRight")}>
          ↷
        </button>
        <span>{cameraControl.heading * 90}°</span>
      </nav>
      <div className="performance" title={runtime.metrics.renderer}>
        {Math.round(runtime.metrics.fps)} FPS <span>·</span>
        {t("game.hud.localAdventure")}
      </div>
      {paused && started && !results && (
        <div className="pause-banner">
          <b>{t("game.pause.title")}</b>
          <span>
            {t(builtin ? "game.pause.description" : "game.host.pause")}
          </span>
          <button
            onClick={() => {
              pause(false);
              focus();
            }}
          >
            {t("game.pause.resume")}
            <kbd>P</kbd>
          </button>
        </div>
      )}
      {results && (
        <div className="result-wrap">
          <section
            className="result-panel"
            aria-live="polite"
            role="dialog"
            aria-modal="true"
            aria-label={t(
              phase === "won"
                ? "game.result.victoryLabel"
                : "game.result.defeatLabel",
            )}
          >
            <LocaleSwitcher />
            <span className="result-sigil">{phase === "won" ? "✦" : "◇"}</span>
            <div className="section-label">
              {phase === "won"
                ? t("game.result.victoryLabel")
                : t("game.result.defeatLabel")}
            </div>
            <h2>
              {phase === "won"
                ? t("game.result.victoryTitle")
                : t("game.result.defeatTitle")}
            </h2>
            <p>
              {phase === "won"
                ? t("game.result.victoryDescription")
                : t("game.result.defeatDescription")}
            </p>
            <div className="run-stats">
              <span>
                <b>
                  {game?.kills}/{game?.total}
                </b>
                {t("game.result.killsLabel")}
              </span>
              <span>
                <b>{game?.stats.dodges}</b>
                {t("game.result.dodgesLabel")}
              </span>
              <span>
                <b>{Math.floor(game?.time ?? 0)}s</b>
                {t("game.result.timeLabel")}
              </span>
            </div>
            <p className="result-truth">
              {t("game.result.acceptanceNotice")}
              <br />
              {t(builtin ? "game.result.vaultNotice" : "game.host.result")}
            </p>
            <div className="result-actions">
              <button className="primary" onClick={restart}>
                {t("game.result.restart")}
                <span>↻</span>
              </button>
              {phase === "won" && (
                <button
                  onClick={() => {
                    setResultDismissed(true);
                    focus();
                  }}
                >
                  {t("game.result.keepExploring")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {selected &&
        (chosenAgent && renderAgentInspector ? (
          renderAgentInspector({
            agentId: chosenAgent.agent_id,
            onClose: () => {
              setSelected(null);
              focus();
            },
          })
        ) : (
          <div className="inspect-wrap">
            <section
              className="inspector"
              role="dialog"
              aria-modal="false"
              aria-label={
                chosenAgent
                  ? t(
                      chosenAgent.is_demo === false
                        ? "game.host.sourceAgentInspector"
                        : "game.aria.agentInspector",
                      {
                        agent: agentName(
                          chosenAgent.agent_id,
                          chosenAgent.name,
                        ),
                      },
                    )
                  : t("game.aria.roomInspector")
              }
            >
              <button
                className="close"
                onClick={() => {
                  setSelected(null);
                  focus();
                }}
                aria-label={t("game.aria.closeInspector")}
              >
                ×
              </button>
              <LocaleSwitcher />
              <span className="tiny-badge">
                {t(
                  (chosenAgent?.is_demo ?? demoWorld)
                    ? "game.label.demoReadOnly"
                    : "game.label.readOnly",
                )}
              </span>
              <h2>
                {chosenAgent
                  ? agentName(chosenAgent.agent_id, chosenAgent.name)
                  : chosenRoom
                    ? roomName(chosenRoom)
                    : ""}
              </h2>
              {chosenAgent ? (
                <>
                  <p>
                    {t("game.inspector.roleRoom", {
                      role: roleName(
                        chosenAgent.source_role ?? chosenAgent.role,
                      ),
                      room: scene.rooms.find(
                        (r) => r.room_id === chosenAgent.room_id,
                      )
                        ? roomName(
                            scene.rooms.find(
                              (r) => r.room_id === chosenAgent.room_id,
                            )!,
                          )
                        : chosenAgent.room_id,
                    })}
                  </p>
                  <div className="inspect-state">
                    {eventStatus(chosenEvent?.event_type ?? "idle")}
                  </div>
                  {chosenAgent.visual_only && (
                    <p>{t("game.host.visualOnly")}</p>
                  )}
                  {chosenEvent && (
                    <span className="tiny-badge">
                      {t(
                        chosenEvent.is_demo
                          ? "common.mode.demo"
                          : "game.host.observations",
                      )}
                    </span>
                  )}
                  <p>
                    {chosenEvent
                      ? eventMessage(chosenEvent)
                      : t("game.inspector.noEvent")}
                  </p>
                  <dl>
                    <dt>{t("game.inspector.source")}</dt>
                    <dd>{chosenEvent?.source ?? t("common.disconnected")}</dd>
                    <dt>{t("game.inspector.observed")}</dt>
                    <dd>
                      <time title={chosenEvent?.observed_at}>
                        {chosenEvent
                          ? formatDateTime(chosenEvent.observed_at)
                          : t("game.inspector.noEvent")}
                      </time>
                    </dd>
                    <dt>{t("game.inspector.evidence")}</dt>
                    <dd>
                      {chosenEvent?.source_ref ?? t("game.inspector.noEvent")}
                    </dd>
                    <dt>{t("game.label.originalText")}</dt>
                    <dd>
                      {chosenEvent?.message ?? t("game.inspector.noEvent")}
                    </dd>
                    <dt>{t("game.inspector.capabilities")}</dt>
                    <dd>{t("game.inspector.displayOnly")}</dd>
                  </dl>
                  <p className="truth-note">
                    {demoWorld
                      ? t("game.inspector.simulationNotice")
                      : t("game.host.observations")}{" "}
                    {t("game.inspector.workbenchNotice")}
                  </p>
                </>
              ) : (
                <>
                  <p className="inspect-state">
                    {chosenRoom ? roomStatus(chosenRoom) : ""}
                  </p>
                  <p>{chosenRoom ? roomReason(chosenRoom) : ""}</p>
                  <button
                    onClick={() => {
                      if (chosenRoom?.enterable) {
                        cameraControl.target = {
                          x: chosenRoom.x,
                          z: chosenRoom.z,
                        };
                        setMode("free");
                      } else {
                        cameraControl.previewRoomId = chosenRoom?.room_id;
                        setMode("preview");
                      }
                    }}
                  >
                    {chosenRoom?.enterable
                      ? t("game.inspector.focusRoom")
                      : t("game.inspector.previewSeal")}
                  </button>
                  <p className="truth-note">
                    {chosenRoom?.enterable
                      ? t("game.inspector.gameSpaceNotice")
                      : t("game.inspector.previewNotice")}
                    <br />
                    {t("game.inspector.rewardNotice")}
                  </p>
                </>
              )}
            </section>
          </div>
        ))}
      {atlas && (
        <div className="modal-backdrop">
          <section
            className="modal atlas"
            role="dialog"
            aria-modal="true"
            aria-label={t("game.aria.atlas")}
          >
            <button
              className="close"
              onClick={() => {
                setAtlas(false);
                focus();
              }}
              aria-label={t("game.aria.closeAtlas")}
            >
              ×
            </button>
            <LocaleSwitcher />
            <div className="section-label">
              {builtin ? t("game.atlas.label") : t("game.host.observations")}
            </div>
            <h2>
              {builtin
                ? t("game.atlas.title")
                : t("game.host.rooms", { count: scene.rooms.length })}
            </h2>
            <div className="atlas-map">
              {scene.rooms.map((r, i) => (
                <button
                  key={r.room_id}
                  className={r.enterable ? "" : "locked"}
                  onClick={() => {
                    setSelected(r.room_id);
                    setAtlas(false);
                    if (!r.enterable) {
                      cameraControl.previewRoomId = r.room_id;
                      setMode("preview");
                    } else {
                      cameraControl.target = { x: r.x, z: r.z };
                      setMode("free");
                    }
                  }}
                >
                  <span>{i === 0 ? "⚒" : i === 1 ? "✦" : "♜"}</span>
                  <b>{roomName(r)}</b>
                  <small>
                    {builtin
                      ? r.enterable
                        ? t("game.label.gameSpaceDemo")
                        : t("game.label.plannedLocked")
                      : roomStatus(r)}
                  </small>
                </button>
              ))}
            </div>
            <p>{t("game.atlas.description")}</p>
            <p className="truth-note">
              {builtin
                ? t("game.atlas.sourceNotice")
                : t("game.label.sourceEvidence")}
            </p>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("game.aria.controlsSettings")}
          >
            <button
              className="close"
              onClick={() => {
                setHelp(false);
                focus();
              }}
              aria-label={t("game.aria.closeControls")}
            >
              ×
            </button>
            <LocaleSwitcher />
            <div className="section-label">{t("game.help.label")}</div>
            <h2>{t("game.help.title")}</h2>
            <dl className="controls-list">
              <dt>{t("game.help.moveKeys")}</dt>
              <dd>{t("game.help.move")}</dd>
              <dt>{t("game.help.attackKeys")}</dt>
              <dd>{t("game.help.attack")}</dd>
              <dt>{t("game.help.dodgeKey")}</dt>
              <dd>{t("game.help.dodge")}</dd>
              <dt>{t("game.help.rotateKeys")}</dt>
              <dd>{t("game.help.rotate")}</dd>
              <dt>{t("game.help.zoomKeys")}</dt>
              <dd>{t("game.help.zoom")}</dd>
              <dt>{t("game.help.panKeys")}</dt>
              <dd>{t("game.help.pan")}</dd>
              <dt>{t("game.help.cameraKeys")}</dt>
              <dd>{t("game.help.camera")}</dd>
              <dt>{t("game.help.inspectKeys")}</dt>
              <dd>{t("game.help.inspect")}</dd>
              <dt>{t("game.help.pauseKeys")}</dt>
              <dd>{t("game.help.pause")}</dd>
            </dl>
            <label className="setting">
              <input
                type="checkbox"
                checked={effects}
                onChange={(e) => {
                  setEffects(e.target.checked);
                  runtime.reducedEffects = !e.target.checked;
                }}
              />
              {t("game.help.fullEffects")}
            </label>
            <p className="truth-note">
              {t("game.help.soundNotice")}
              <br />
              {t("game.help.desktopNotice")}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

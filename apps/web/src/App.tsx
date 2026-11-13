import { useEffect, useRef, useState } from "react";
import {
  DEMO_SCENE,
  Dungeon,
  type GameSnapshot,
} from "../../../packages/dungeon-engine/src";
import { DungeonScene } from "./Scene";
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
const agentNames = Object.fromEntries(
  DEMO_SCENE.agents.map((a) => [a.agent_id, a.name]),
);
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="glyph" aria-hidden="true">
      {children}
    </span>
  );
}
export default function App() {
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
    Dungeon.create(DEMO_SCENE)
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
      .catch((e) => setError(String(e)));
    runtime.onFrame = setGame;
    runtime.selectAgent = (id) => {
      setSelected(id);
      clearInput();
    };
    runtime.selectRoom = (id) => setSelected(id);
    tickDemo();
    const timer = setInterval(tickDemo, 2800);
    return () => {
      alive = false;
      clearInterval(timer);
      created?.dispose();
      runtime.game = undefined;
      runtime.onFrame = undefined;
    };
  }, []);
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
            const near = DEMO_SCENE.agents.find(
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
  }, [started, selected, help, atlas, game?.phase]);
  useEffect(() => {
    if (selected || help || atlas) clearInput();
  }, [selected, help, atlas]);
  const events = projection.snapshot();
  const chosenAgent = DEMO_SCENE.agents.find((a) => a.agent_id === selected);
  const chosenRoom = DEMO_SCENE.rooms.find((r) => r.room_id === selected);
  const remaining = game ? game.total - game.kills : 4;
  const phase = game?.phase;
  const results =
    started && !resultDismissed && (phase === "won" || phase === "lost");
  return (
    <main className="app">
      <div
        ref={surface}
        className="game-surface"
        tabIndex={0}
        aria-label="Dungeon. WASD move, J attack, Space dodge. Q and R rotate camera."
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
        <DungeonScene />
      </div>
      <div className="vignette" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <div>
            <b>DEVUNGEON</b>
            <small>A world in the making</small>
          </div>
        </div>
        <div className="chapter">
          <span>THE EMBER ARCHIVE</span>
          <small>Chapter I · Original pixel dungeon</small>
        </div>
        <div className="top-actions">
          <span className="demo-badge">DEMO WORLD</span>
          <button
            onClick={() => {
              setAtlas(!atlas);
              clearInput();
            }}
            aria-label="Open room atlas"
          >
            <Glyph>▧</Glyph>
            <span>Atlas</span>
          </button>
          <button
            onClick={() => {
              setHelp(!help);
              clearInput();
            }}
            aria-label="Controls and settings"
          >
            ?
          </button>
          {started && (
            <button
              onClick={() => pause(!paused)}
              aria-label={paused ? "Resume game" : "Pause game"}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          )}
        </div>
      </header>
      {started && game && (
        <section className="health-hud" aria-label="Player health">
          <div className="avatar">✦</div>
          <div>
            <div className="health-label">
              <b>THE WAYFARER</b>
              <span>{game.player.hp} / 100</span>
            </div>
            <div className="health-track">
              <i style={{ width: `${game.player.hp}%` }} />
            </div>
            <small>
              Emberblade <span>·</span>{" "}
              {game.rewardClaimed
                ? "Archive sigil acquired"
                : "A little courage goes a long way"}
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
                ? "THE ARCHIVE IS QUIET"
                : `${remaining} EMBERS REMAIN`}
            </b>
            <small>
              {phase === "lost"
                ? "The fire took this run. Try again."
                : remaining === 0
                  ? "Your victory belongs to this adventure."
                  : "Enter the archive. Read the tells. Strike back."}
            </small>
          </div>
        </section>
      )}
      {!started && (
        <section className="entry-panel">
          <div className="entry-kicker">A SMALL DUNGEON. A LIVING WORLD.</div>
          <h1>
            Keep the
            <br />
            <em>embers</em> alive.
          </h1>
          <p>
            Beyond the forge, restless things stir.
            <br />
            Take your blade into the archive while
            <br />
            your companions shape what comes next.
          </p>
          <button className="primary start" disabled={!game} onClick={start}>
            {error
              ? "Engine unavailable"
              : game
                ? "Enter the dungeon"
                : "Lighting the forge…"}
            <span>→</span>
          </button>
          <div className="entry-controls">
            <kbd>W A S D</kbd> wander <kbd>J</kbd> strike <kbd>SPACE</kbd> dodge
          </div>
          <small className="entry-note">
            One handcrafted encounter · No account needed
            <br />
            Agent activity is a labeled simulation.
          </small>
          {error && <p role="alert">{error}</p>}
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
            {journal ? "Close field notes" : "Field notes"}
          </button>
          {journal && (
            <aside className="journal">
              <div className="section-label">
                <span>YOUR COMPANIONS</span>
                <span className="tiny-badge">DEMO</span>
              </div>
              <h2>The forge stays busy.</h2>
              <p className="muted">A simulated crew works while you play.</p>
              <div className="agent-list">
                {DEMO_SCENE.agents.map((a) => {
                  const e = projection.actor(a.agent_id);
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
                        <b>{a.name}</b>
                        <small>
                          {a.role} ·{" "}
                          {e.stale
                            ? "idle / stale"
                            : (e.event?.event_type.replace("_", " ") ?? "idle")}
                        </small>
                      </span>
                      <span className="row-arrow">↗</span>
                    </button>
                  );
                })}
              </div>
              <div className="journal-feed">
                <div className="section-label">
                  FROM THE FORGE <span className="tiny-badge">SCRIPTED</span>
                </div>
                {events.slice(0, 2).map((e) => (
                  <div key={e.event_id} className="feed-event">
                    <span className="event-dot" />
                    <div>
                      <b>{agentNames[e.agent_id]}</b>
                      <p>{e.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="vault-link"
                onClick={() => {
                  setSelected("vault");
                  setMode("preview");
                }}
              >
                <span>♜</span>
                <div>
                  <b>The Unwritten Vault</b>
                  <small>Locked · Preview the room</small>
                </div>
                <span>→</span>
              </button>
              <p className="truth-note">
                DEMO events only. No real Agent is connected.
                <br />
                Combat never changes project acceptance.
              </p>
            </aside>
          )}
          <div className="location">
            <span>✦</span>
            <div>
              <small>
                {game && game.player.x < -4
                  ? "THE QUIET FORGE"
                  : game && game.player.x > 9
                    ? "THE SEALED PASSAGE"
                    : "THE EMBER ARCHIVE"}
              </small>
              <p>
                {paused
                  ? "The adventure rests. The forge carries on."
                  : "Explore. Observe. Leave a little light behind."}
              </p>
            </div>
          </div>
          <nav className="quickbar" aria-label="Game controls">
            <div>
              <kbd>WASD</kbd>
              <span>Move</span>
            </div>
            <div>
              <kbd>J / CLICK</kbd>
              <span>Strike</span>
            </div>
            <div className={game && game.dodgeCooldown > 0 ? "cooling" : ""}>
              <kbd>SPACE</kbd>
              <span>
                {game && game.dodgeCooldown > 0
                  ? `${game.dodgeCooldown.toFixed(1)}s`
                  : "Dodge"}
              </span>
            </div>
            <div>
              <kbd>E</kbd>
              <span>Inspect</span>
            </div>
          </nav>
        </>
      )}
      <nav className="camera-tools" aria-label="Camera controls">
        <button onClick={() => rotate(-1)} title="Q · quarter turn left">
          ↶
        </button>
        <button
          onClick={() => {
            cameraControl.zoom = Math.max(20, cameraControl.zoom - 6);
            focus();
          }}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() =>
            setMode(cameraMode === "overview" ? "follow" : "overview")
          }
          className={cameraMode === "overview" ? "active" : ""}
        >
          {cameraMode === "overview" ? "Follow hero" : "World view"}
        </button>
        <button
          onClick={() => {
            cameraControl.zoom = Math.min(72, cameraControl.zoom + 6);
            focus();
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button onClick={() => rotate(1)} title="R · quarter turn right">
          ↷
        </button>
        <span>{cameraControl.heading * 90}°</span>
      </nav>
      <div className="performance" title={runtime.metrics.renderer}>
        {Math.round(runtime.metrics.fps)} FPS <span>·</span> LOCAL ADVENTURE
      </div>
      {paused && started && !results && (
        <div className="pause-banner">
          <b>Adventure paused</b>
          <span>DEMO companions continue independently.</span>
          <button
            onClick={() => {
              pause(false);
              focus();
            }}
          >
            Resume <kbd>P</kbd>
          </button>
        </div>
      )}
      {results && (
        <div className="result-wrap">
          <section className="result-panel" aria-live="polite">
            <span className="result-sigil">{phase === "won" ? "✦" : "◇"}</span>
            <div className="section-label">
              {phase === "won" ? "ENCOUNTER COMPLETE" : "THE EMBERS PREVAIL"}
            </div>
            <h2>
              {phase === "won"
                ? "A little light restored."
                : "Every hero stumbles."}
            </h2>
            <p>
              {phase === "won"
                ? "The archive falls quiet. Claim the sigil at its center, or wander back to your companions."
                : "The forge is still warm. Take a breath, watch the warning rings, and try another run."}
            </p>
            <div className="run-stats">
              <span>
                <b>
                  {game?.kills}/{game?.total}
                </b>
                embers silenced
              </span>
              <span>
                <b>{game?.stats.dodges}</b>dodges
              </span>
              <span>
                <b>{Math.floor(game?.time ?? 0)}s</b>in the archive
              </span>
            </div>
            <p className="result-truth">
              GAME RESULT ONLY · Project acceptance is unchanged.
              <br />
              The vault remains sealed. DEMO Agents keep working.
            </p>
            <div className="result-actions">
              <button className="primary" onClick={restart}>
                Another adventure <span>↻</span>
              </button>
              {phase === "won" && (
                <button
                  onClick={() => {
                    setResultDismissed(true);
                    focus();
                  }}
                >
                  Keep exploring →
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {selected && (
        <div className="inspect-wrap">
          <section
            className="inspector"
            role="dialog"
            aria-modal="false"
            aria-label={
              chosenAgent
                ? `${chosenAgent.name} DEMO inspector`
                : "Room inspector"
            }
          >
            <button
              className="close"
              onClick={() => {
                setSelected(null);
                focus();
              }}
              aria-label="Close inspector"
            >
              ×
            </button>
            <span className="tiny-badge">DEMO · READ ONLY</span>
            <h2>{chosenAgent?.name ?? chosenRoom?.name}</h2>
            {chosenAgent ? (
              <>
                <p>{chosenAgent.role} · The Quiet Forge</p>
                <div className="inspect-state">
                  {projection
                    .actor(chosenAgent.agent_id)
                    .event?.event_type.replace("_", " ") ?? "idle"}
                </div>
                <p>{projection.actor(chosenAgent.agent_id).event?.message}</p>
                <dl>
                  <dt>Source</dt>
                  <dd>synthetic:s1-script</dd>
                  <dt>Observed</dt>
                  <dd>
                    {projection.actor(chosenAgent.agent_id).event
                      ?.observed_at ?? "No event yet"}
                  </dd>
                  <dt>Evidence</dt>
                  <dd>apps/web/src/runtime.ts</dd>
                  <dt>Capabilities</dt>
                  <dd>Display-only. No external commands.</dd>
                </dl>
                <p className="truth-note">
                  This is a scripted animation, not a real Agent session.
                  Workbench integration is a separate module.
                </p>
              </>
            ) : (
              <>
                <p className="inspect-state">{chosenRoom?.status}</p>
                <p>{chosenRoom?.reason}</p>
                <button
                  onClick={() => {
                    if (chosenRoom?.enterable) {
                      cameraControl.target = {
                        x: chosenRoom.x,
                        z: chosenRoom.z,
                      };
                      setMode("free");
                    } else setMode("preview");
                  }}
                >
                  {chosenRoom?.enterable
                    ? "Focus this room →"
                    : "Look beyond the seal →"}
                </button>
                <p className="truth-note">
                  {chosenRoom?.enterable
                    ? "Independent game space in a synthetic world."
                    : "Camera preview grants no player access."}
                  <br />
                  No game reward can unlock project acceptance.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {atlas && (
        <div className="modal-backdrop">
          <section
            className="modal atlas"
            role="dialog"
            aria-modal="true"
            aria-label="Room atlas"
          >
            <button
              className="close"
              onClick={() => {
                setAtlas(false);
                focus();
              }}
              aria-label="Close atlas"
            >
              ×
            </button>
            <div className="section-label">FIELD ATLAS · DEMO WORLD</div>
            <h2>Three rooms. One unfolding story.</h2>
            <div className="atlas-map">
              {DEMO_SCENE.rooms.map((r, i) => (
                <button
                  key={r.room_id}
                  className={r.enterable ? "" : "locked"}
                  onClick={() => {
                    setSelected(r.room_id);
                    setAtlas(false);
                    if (!r.enterable) setMode("preview");
                    else {
                      cameraControl.target = { x: r.x, z: r.z };
                      setMode("free");
                    }
                  }}
                >
                  <span>{i === 0 ? "⚒" : i === 1 ? "✦" : "♜"}</span>
                  <b>{r.name}</b>
                  <small>
                    {r.enterable ? "Game space · DEMO" : "Planned · LOCKED"}
                  </small>
                </button>
              ))}
            </div>
            <p>
              Rooms use real 3D space. The violet seal blocks walking and
              dodging. Only the camera may cross.
            </p>
            <p className="truth-note">
              All room facts in this slice are synthetic fixtures. Real project
              import is not connected.
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
            aria-label="Controls and settings"
          >
            <button
              className="close"
              onClick={() => {
                setHelp(false);
                focus();
              }}
              aria-label="Close controls"
            >
              ×
            </button>
            <div className="section-label">A WAYFARER'S GUIDE</div>
            <h2>Stay light on your feet.</h2>
            <dl className="controls-list">
              <dt>WASD / arrows</dt>
              <dd>Move relative to the camera</dd>
              <dt>J / hold left click</dt>
              <dd>Sweep the blade. J aims at the nearest enemy.</dd>
              <dt>Space</dt>
              <dd>Dodge with brief invulnerability</dd>
              <dt>Q / R</dt>
              <dd>Rotate camera 90° left / right</dd>
              <dt>Wheel / + −</dt>
              <dd>Zoom the camera</dd>
              <dt>Right drag</dt>
              <dd>Pan freely; C returns to the hero</dd>
              <dt>F / C</dt>
              <dd>World view / follow the hero</dd>
              <dt>E / click companion</dt>
              <dd>Inspect nearby DEMO companion</dd>
              <dt>P / Escape</dt>
              <dd>Pause local combat; DEMO events continue</dd>
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
              Full particles & ambient motion
            </label>
            <p className="truth-note">
              No sound is bundled. Reduced motion follows your system
              preference.
              <br />
              Desktop keyboard & mouse combat. Touch combat is not yet
              supported.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

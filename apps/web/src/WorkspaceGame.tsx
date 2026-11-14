import { useEffect, useMemo, useState } from "react";
import App from "./App";
import {
  AgentProjection,
  type Room,
  type SceneDefinition,
} from "../../../packages/dungeon-engine/src";
import {
  AgentWorkspace,
  DemoWorkspaceAdapter,
  DEMO_OWNER,
  WorkspaceController,
  EvidenceRef,
  type WorkspaceSnapshot,
} from "../../../packages/workspace-ui/src";
import type { DemoIdentityFixture } from "../../../packages/workspace-ui/src/demo-adapter";
import {
  useI18n,
  LocaleSwitcher,
} from "../../../packages/workspace-ui/src/i18n";
import {
  renderWorldName,
  renderWorldMessage,
  type ProjectSnapshot,
} from "../../../packages/world-generator/src/index";
import {
  createProjectWorldStore,
  type DemoProjectSelection,
  type ProjectWorld,
  type ProjectWorldResult,
} from "./project-worlds";
import { useScoutSource } from "./scout-source";
import { FIRST_PLAY_SCENE } from "./first-play-scene";
import { useFeatureSample, SAMPLE_OBJECT_IDS } from "./feature-sample";
import { FeaturePanel } from "./FeaturePanel";
import { firstPlayVisuals, loadFirstPlayArt } from "./first-play-art";
import { FirstPlayEnvironment } from "./FirstPlayEnvironment";
import "../../../packages/workspace-ui/src/workspace.css";
import "./style.css";
import "./forge.css";
import "./first-play.css";

type Selection = DemoProjectSelection | "public" | "sample";
function demoBinding(project: ProjectWorld) {
  const fixture: DemoIdentityFixture = {
    project_id: project.snapshot.project.id,
    agents: {},
  };
  for (const agent of project.snapshot.agents) {
    const slot =
      agent.role === "supervisor"
        ? "agent-boss"
        : agent.role === "reviewer"
          ? "agent-review"
          : "agent-build";
    fixture.agents[slot] = {
      id: agent.id,
      name: agent.name,
      room_id: agent.room_id ?? project.scene.rooms[0]!.room_id,
    };
  }
  const adapter = new DemoWorkspaceAdapter({ fixture });
  const controller = new WorkspaceController(
    adapter,
    DEMO_OWNER,
    project.snapshot.project.id,
  );
  const projection = new AgentProjection(
    project.snapshot.project.id,
    project.scene.agents.map((agent) => agent.agent_id),
  );
  const update = () => {
    for (const event of controller.getSnapshot().events)
      projection.ingest(event);
  };
  update();
  const stop = controller.subscribe(update);
  return {
    controller,
    projection,
    dispose() {
      stop();
      controller.dispose();
      adapter.dispose();
    },
  };
}
declare global {
  interface Window {
    __DEVUNGEON_WORKSPACE__?: {
      snapshot: () => WorkspaceSnapshot;
      selectedId: () => string | null;
    };
    __DEVUNGEON_FORGE__?: { snapshot: () => unknown };
  }
}

/** One host / one locale. Facts, compiler, observer and commands have independent
 * lifetimes. Game actions have no source-write or authorization port. */
export default function WorkspaceGame() {
  const { t, formatDateTime } = useI18n();
  const [worlds] = useState(() => createProjectWorldStore());
  const [selected, setSelected] = useState<Selection>("sample");
  const [demoWorld, setDemoWorld] = useState<ProjectWorldResult>(() =>
    worlds.getBySelection("tiny"),
  );
  const [bindings] = useState(
    () =>
      new Map<DemoProjectSelection, ReturnType<typeof demoBinding>>(
        (["tiny", "workbench"] as const).flatMap((id) => {
          const result = worlds.getBySelection(id);
          return result.ok ? [[id, demoBinding(result)] as const] : [];
        }),
      ),
  );
  const [sampleProjection] = useState(
    () =>
      new AgentProjection("github:orionaster/devungeon", ["demo:sample-scout"]),
  );
  const source = useScoutSource(selected === "public" || selected === "sample");
  const sample = useFeatureSample(source);
  const [artReady, setArtReady] = useState(false);
  const [artError, setArtError] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadFirstPlayArt()
      .then(() => {
        if (alive) setArtReady(true);
      })
      .catch(() => {
        if (alive) setArtError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const sampleVisuals = useMemo(
    () => ({
      ...firstPlayVisuals,
      environment: (
        <FirstPlayEnvironment
          scene={FIRST_PLAY_SCENE}
          activities={sample.activities}
        />
      ),
    }),
    [sample.activities],
  );
  const publicWorld = useMemo(
    () => (source.snapshot ? worlds.compile(source.snapshot) : null),
    [worlds, source.snapshot],
  );
  const [publicSceneWorld, setPublicSceneWorld] = useState<ProjectWorld | null>(
    null,
  );
  useEffect(() => {
    if (!publicSceneWorld && publicWorld?.ok) setPublicSceneWorld(publicWorld);
  }, [publicSceneWorld, publicWorld]);
  const result = selected === "public" ? publicWorld : demoWorld;
  const world = result?.ok ? result : null;
  const sceneWorld = selected === "public" ? publicSceneWorld : world;
  const pendingMap =
    selected === "public" &&
    !!world &&
    !!publicSceneWorld &&
    world !== publicSceneWorld;
  const controller =
    selected === "sample" || selected === "public"
      ? source.controller
      : bindings.get(selected)!.controller;
  // Independent entertainment occupies only BUILDER's safe game-only foyer,
  // even when no public work item has real acceptance evidence.
  const gameScene = useMemo<SceneDefinition | undefined>(() => {
    if (selected === "sample") return FIRST_PLAY_SCENE;
    if (!sceneWorld) return;
    if (sceneWorld.scene.enemies.length) return sceneWorld.scene;
    return {
      ...sceneWorld.scene,
      enemies: [
        {
          id: "game-only:foyer-slime-a",
          kind: "slime",
          x: sceneWorld.scene.spawn.x - 2,
          z: sceneWorld.scene.spawn.z,
        },
        {
          id: "game-only:foyer-slime-b",
          kind: "slime",
          x: sceneWorld.scene.spawn.x + 2,
          z: sceneWorld.scene.spawn.z,
        },
      ],
    };
  }, [sceneWorld, selected]);
  const rosterKey = JSON.stringify(
    source.work.agents.map((a) => [a.id, a.name, a.room_id, a.role, a.is_demo]),
  );
  const roster = useMemo<SceneDefinition["agents"] | undefined>(() => {
    if (selected !== "public" || !gameScene) return;
    return source.work.agents.flatMap((agent, i) => {
      const room = gameScene.rooms.find((r) => r.room_id === agent.room_id);
      if (!room) return []; // Never invent a room/task assignment.
      return [
        {
          agent_id: agent.id,
          name: agent.name,
          room_id: room.room_id,
          x: room.x + ((i % 3) - 1) * 0.8,
          z: room.z,
          role:
            agent.role === "supervisor"
              ? ("wizard" as const)
              : agent.role === "reviewer"
                ? ("scout" as const)
                : ("builder" as const),
          source_role: agent.role,
          visual_only: true,
          is_demo: agent.is_demo,
        },
      ];
    });
  }, [selected, gameScene, rosterKey]);
  const events =
    selected === "sample"
      ? sampleProjection
      : selected === "public"
        ? source.projectionFor((roster ?? []).map((a) => a.agent_id))
        : bindings.get(selected)!.projection;
  useEffect(
    () => () => {
      for (const binding of bindings.values()) binding.dispose();
    },
    [bindings],
  );
  useEffect(() => {
    window.__DEVUNGEON_WORKSPACE__ = {
      snapshot: controller.getSnapshot,
      selectedId: () =>
        document.querySelector(".dw-agent-id")?.textContent ?? null,
    };
    window.__DEVUNGEON_FORGE__ = {
      snapshot: () =>
        structuredClone({
          selected,
          project:
            selected === "sample"
              ? source.snapshot
              : (world?.snapshot ?? source.snapshot),
          world: selected === "sample" ? null : (world?.world ?? null),
          renderedRevision: sceneWorld?.snapshot.revision,
          pendingMap,
          diagnostics: result && !result.ok ? result.diagnostics : [],
          source: {
            status: source.status,
            records: source.records,
            transportConnected: source.transportConnected,
            error: source.error,
          },
          workspace: controller.getSnapshot(),
        }),
    };
    return () => {
      delete window.__DEVUNGEON_WORKSPACE__;
      delete window.__DEVUNGEON_FORGE__;
    };
  }, [
    selected,
    world,
    sceneWorld,
    pendingMap,
    source.status,
    source.records,
    source.transportConnected,
    source.error,
    result,
    controller,
  ]);
  const choose = (value: Selection) => {
    setSelected(value);
    if (value !== "public" && value !== "sample")
      setDemoWorld(worlds.getBySelection(value));
  };
  const roomDisplay = (room: Room) => {
    const display = sceneWorld?.roomDisplay.find(
      (item) => item.room_id === room.room_id,
    );
    return display
      ? {
          name: renderWorldName(display.name, t),
          reason: display.reasons
            .map((ref) => renderWorldMessage(ref, t))
            .join(" "),
          status: renderWorldMessage(display.status, t),
        }
      : { name: room.name, reason: room.reason, status: room.status };
  };
  const modeLabel = (mode: string) =>
    t(
      mode === "LIVE"
        ? "forge.live"
        : mode === "STALE"
          ? "forge.stale"
          : mode === "DEMO"
            ? "forge.demoMode"
            : mode === "REPLAY"
              ? "forge.replay"
              : "forge.disconnected",
    );
  const connection = (kind: "project" | "agent") =>
    modeLabel(
      source.transportConnected
        ? (source.status?.connections[kind].mode ?? "DISCONNECTED")
        : "DISCONNECTED",
    );
  const facts = (snapshot: ProjectSnapshot) => (
    <details className="forge-facts">
      <summary>{t("forge.facts")}</summary>
      <p>{t("forge.original")}</p>
      {snapshot.rooms.map((room) => (
        <article key={room.id} data-room-id={room.id}>
          <b>{room.name}</b>
          <code>{room.id}</code>
          <p>
            {t(`world.status.${room.status}`)} ·{" "}
            {room.depends_on.length ? room.depends_on.join(", ") : "∅"}
          </p>
          {room.summary && <p>{room.summary}</p>}
          {room.evidence.length ? (
            room.evidence.map((evidence, i) => (
              <EvidenceRef key={i} value={evidence.ref} />
            ))
          ) : (
            <small>{t("forge.noEvidence")}</small>
          )}
        </article>
      ))}
    </details>
  );
  const panel = (
    <section
      className="forge-source"
      data-testid="forge-source-panel"
      aria-label={t("forge.source")}
    >
      <h3>{t("forge.source")}</h3>
      <p>
        {t(
          selected === "public" || selected === "sample"
            ? "forge.publicNotice"
            : "forge.demo",
        )}
      </p>
      {world && selected !== "sample" && (
        <>
          <b>{world.snapshot.project.name}</b>
          <small>{t("forge.original")}</small>
          <p>
            {t("forge.features", {
              count: world.snapshot.rooms.length,
              dependencies: world.world.graph.dependencies.length,
            })}
          </p>
          <code>
            {t("forge.revision")}: {world.snapshot.revision}
          </code>
        </>
      )}
      {(selected === "public" || selected === "sample") && (
        <>
          <p>
            {t("forge.transport")}:{" "}
            {t(
              source.transportConnected
                ? "forge.connected"
                : "forge.disconnected",
            )}
          </p>
          <p data-testid="forge-project-mode">
            {t("forge.projectConnection")}: {connection("project")}
          </p>
          <p data-testid="forge-agent-mode">
            {t("forge.agentConnection")}: {connection("agent")}
          </p>
          {pendingMap && (
            <p role="status">
              {t("forge.pendingMap")}{" "}
              <button
                data-testid="forge-apply-map"
                onClick={() => setPublicSceneWorld(world)}
              >
                {t("forge.applyMap")}
              </button>
            </p>
          )}
          {source.error && <p role="status">{t("forge.error")}</p>}
          {source.status && (
            <details>
              <summary>{t("forge.original")}</summary>
              <pre>
                {JSON.stringify(
                  {
                    connections: source.status.connections,
                    warnings: source.status.warnings,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
          <p>
            {t(
              source.work.agents.length
                ? "forge.agentReadonly"
                : "forge.noAgent",
            )}
          </p>
          {source.work.agents
            .filter(
              (agent) =>
                !roster?.some((marker) => marker.agent_id === agent.id),
            )
            .map((agent) => (
              <details key={agent.id}>
                <summary>
                  {agent.name} · {t("forge.agentReadonly")}
                </summary>
                <code>{agent.id}</code>
                <p>{t("forge.unknown")}</p>
                <EvidenceRef value={agent.source_ref} />
              </details>
            ))}
          <h4>{t("forge.events", { count: source.records.length })}</h4>
          <ol className="forge-events">
            {[...source.records]
              .reverse()
              .slice(0, 30)
              .map((record) => (
                <li key={record.event.event_id}>
                  <b>
                    {modeLabel(record.mode)}
                    {record.event.is_demo && record.mode !== "DEMO"
                      ? " · DEMO"
                      : ""}
                  </b>
                  <small>
                    {t(
                      record.event.source_kind === "agent"
                        ? "forge.agentEvent"
                        : "forge.projectEvent",
                    )}{" "}
                    · {formatDateTime(record.event.occurred_at)}
                  </small>
                  <span>{record.event.message ?? record.event.event_type}</span>
                  <code>{record.event.agent_id}</code>
                  <EvidenceRef value={record.event.source_ref} />
                </li>
              ))}
          </ol>
          <p>{t("forge.gameOnly")}</p>
        </>
      )}
      <p>{t("forge.acceptance")}</p>
      {world && selected !== "sample"
        ? facts(world.snapshot)
        : source.snapshot && facts(source.snapshot)}
    </section>
  );
  return (
    <>
      {gameScene && world ? (
        <App
          scene={gameScene}
          firstPlay={selected === "sample"}
          assetsReady={selected !== "sample" || artReady}
          assetsError={selected === "sample" && artError}
          objective={{
            text: t(
              sample.state.receipt
                ? "play.objective.evidence"
                : "play.objective",
            ),
            objectId: sample.state.receipt ? "evidence-cabinet" : "source-desk",
          }}
          projectName={
            selected === "sample" ? "Devungeon" : world.snapshot.project.name
          }
          sceneVisuals={selected === "sample" ? sampleVisuals : undefined}
          sampleActivities={
            selected === "sample" ? sample.activities : undefined
          }
          projectTools={
            <details className="forge-toolbar">
              <summary>{t("play.worlds")}</summary>
              <div className="forge-project-options">
                <label>
                  {t("forge.project")}
                  <select
                    data-testid="forge-project-select"
                    value={selected}
                    onChange={(e) => choose(e.target.value as Selection)}
                  >
                    <option value="sample">{t("play.sample")}</option>
                    <option value="tiny">{t("forge.tiny")}</option>
                    <option value="workbench">{t("forge.workbench")}</option>
                    <option value="public">{t("forge.public")}</option>
                  </select>
                </label>
                {selected === "public" || selected === "sample" ? (
                  <button onClick={() => void source.refresh()}>
                    {t("forge.refresh")}
                  </button>
                ) : (
                  <button
                    data-testid="forge-add-feature"
                    onClick={() =>
                      world &&
                      setDemoWorld(
                        worlds.addDemoFeature(world.snapshot.project.id),
                      )
                    }
                  >
                    {t("forge.add")}
                  </button>
                )}
                <p>{t("play.sampleNotice")}</p>
              </div>
            </details>
          }
          agentRoster={roster}
          agentEvents={events}
          demoEvents={false}
          agentActivityEnabled={selected !== "public" || source.activityEnabled}
          roomDisplay={
            selected === "sample"
              ? (room) => ({
                  name: t(room.enterable ? "play.entry.title" : "play.annex"),
                  reason: t(
                    room.enterable
                      ? "play.entry.description"
                      : "play.annexReason",
                  ),
                  status: t(
                    room.enterable
                      ? "world.status.gameOnly"
                      : "world.status.planned",
                  ),
                })
              : roomDisplay
          }
          sourcePanel={panel}
          renderObjectInspector={
            selected === "sample"
              ? ({ objectId, onClose, restoreFocus }) => {
                  const id = SAMPLE_OBJECT_IDS.find((id) => id === objectId);
                  return id ? (
                    <FeaturePanel
                      objectId={id}
                      sample={sample}
                      onClose={onClose}
                      restoreFocus={restoreFocus}
                    />
                  ) : null;
                }
              : undefined
          }
          renderAgentInspector={({ agentId, onClose, restoreFocus }) =>
            selected === "sample" ? (
              <FeaturePanel
                objectId="test-bench"
                asAgent
                sample={sample}
                onClose={onClose}
                restoreFocus={restoreFocus}
              />
            ) : (
              <AgentWorkspace
                adapter={controller}
                selectedAgentId={agentId}
                onClose={onClose}
                onRestoreFocus={restoreFocus}
              />
            )
          }
        />
      ) : (
        <main className="forge-fallback">
          <LocaleSwitcher />
          <h1>DEVUNGEON</h1>
          <p role="status">
            {t(result && !result.ok ? "forge.invalid" : "forge.loading")}
          </p>
          {result && !result.ok && (
            <pre>{JSON.stringify(result.diagnostics, null, 2)}</pre>
          )}
          {panel}
        </main>
      )}
    </>
  );
}

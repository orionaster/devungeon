/** Synthetic contract test, not a real public-source connection or the integrated product. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App";
import "../src/style.css";
import { I18nProvider } from "../../../packages/workspace-ui/src/i18n";
import {
  AgentProjection,
  DEMO_SCENE,
  type SceneDefinition,
} from "../../../packages/dungeon-engine/src";
const scene: SceneDefinition = {
  ...structuredClone(DEMO_SCENE),
  worldId: "synthetic:host-contract",
  project_context: {
    project_id: "host-contract",
    project_revision: "test-1",
    observed_at: "2026-11-14T00:00:00Z",
    source: {
      kind: "manual",
      is_demo: false,
      reference: "synthetic fault-injection flags; not a real source",
    },
  },
  agents: [
    {
      agent_id: "synthetic-marker",
      name: "Contract actor",
      role: "builder",
      room_id: "vault",
      x: 17,
      z: 0,
      visual_only: true,
      is_demo: true,
      source_role: "worker",
    },
  ],
};
const invalid = { ...scene, spawn: { x: 17, z: 0 } };
let count = 0;
function port(projectId = "host-contract") {
  const p = new AgentProjection(projectId, ["synthetic-marker"]);
  const now = new Date().toISOString();
  p.ingest({
    schema_version: "1.0",
    project_id: projectId,
    agent_id: "synthetic-marker",
    event_id: `test-${count++}`,
    event_type: "progress",
    occurred_at: now,
    observed_at: now,
    source: "synthetic:host-contract",
    is_demo: true,
    message: "Synthetic event text is preserved.",
  });
  return p;
}
function HostContract() {
  const [events, setEvents] = useState(() => port()),
    [bad, setBad] = useState(false),
    [script, setScript] = useState(false);
  return (
    <>
      <App
        scene={bad ? invalid : scene}
        agentEvents={events}
        demoEvents={script}
        sourcePanel={
          <p className="truth-note">
            SYNTHETIC CONTRACT FIXTURE · No real source/Agent is connected.
          </p>
        }
      />
      <nav
        aria-label="Synthetic contract controls"
        style={{
          position: "fixed",
          left: 12,
          bottom: 80,
          zIndex: 8,
          padding: 8,
          background: "#203440",
          maxWidth: 550,
          fontSize: 12,
        }}
      >
        <b>TEST ONLY · simulated source flags</b>{" "}
        <button onClick={() => setEvents(port())}>Replace event port</button>
        <button onClick={() => setScript(!script)}>Toggle event script</button>
        <button onClick={() => setBad(true)}>Invalid spawn</button>
        <button onClick={() => setBad(false)}>Restore scene</button>
        <button onClick={() => setEvents(port("other-project"))}>
          Other-project events
        </button>
      </nav>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <HostContract />
  </I18nProvider>,
);

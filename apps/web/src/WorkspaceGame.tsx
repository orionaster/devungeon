import { useEffect, useState } from "react";
import App from "./App";
import {
  AgentProjection,
  DEMO_SCENE,
} from "../../../packages/dungeon-engine/src";
import {
  AgentWorkspace,
  createHeroDemoWorkspace,
  type WorkspaceSnapshot,
} from "../../../packages/workspace-ui/src";
import { useI18n } from "../../../packages/workspace-ui/src/i18n";
import "../../../packages/workspace-ui/src/workspace.css";

declare global {
  interface Window {
    __DEVUNGEON_WORKSPACE__?: {
      snapshot: () => WorkspaceSnapshot;
      selectedId: () => string | null;
    };
  }
}

/** Default first-pack composition. The reusable HERO host owns game state;
 * the separately owned workspace controls work and authority. No provider call.
 */
export default function WorkspaceGame() {
  const { t } = useI18n();
  const [work, setWork] =
    useState<ReturnType<typeof createHeroDemoWorkspace>>();
  const [events] = useState(
    () =>
      new AgentProjection(
        DEMO_SCENE.worldId,
        DEMO_SCENE.agents.map((agent) => agent.agent_id),
      ),
  );
  useEffect(() => {
    const binding = createHeroDemoWorkspace();
    const projected = new Set<string>();
    const update = () => {
      for (const event of binding.controller.getSnapshot().events) {
        if (!projected.has(event.event_id)) {
          events.ingest(event);
          projected.add(event.event_id);
        }
      }
    };
    update();
    const stop = binding.controller.subscribe(update);
    setWork(binding);
    window.__DEVUNGEON_WORKSPACE__ = {
      snapshot: binding.controller.getSnapshot,
      selectedId: () =>
        document.querySelector(".dw-agent-id")?.textContent ?? null,
    };
    return () => {
      stop();
      binding.dispose();
      delete window.__DEVUNGEON_WORKSPACE__;
    };
  }, [events]);
  return (
    <App
      agentEvents={events}
      demoEvents={false}
      renderAgentInspector={({ agentId, onClose, restoreFocus }) =>
        work ? (
          <AgentWorkspace
            adapter={work.controller}
            selectedAgentId={agentId}
            onClose={onClose}
            onRestoreFocus={restoreFocus}
          />
        ) : (
          <p role="status">{t("loading.world")}</p>
        )
      }
    />
  );
}

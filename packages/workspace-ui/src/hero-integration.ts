import { DemoWorkspaceAdapter, DEMO_OWNER } from "./demo-adapter";
import { WorkspaceController } from "./controller";

/** Explicit fixture roles, not an inference about real HERO or provider agents. */
export function createHeroDemoWorkspace() {
  const projectId = "demo:ember-archive";
  const adapter = new DemoWorkspaceAdapter({
    fixture: {
      project_id: projectId,
      agents: {
        "agent-boss": { id: "demo-wizard", name: "Lumen", room_id: "forge" },
        "agent-build": { id: "demo-builder", name: "Cinder", room_id: "forge" },
        "agent-review": { id: "demo-scout", name: "Moss", room_id: "forge" },
      },
    },
  });
  const controller = new WorkspaceController(adapter, DEMO_OWNER, projectId);
  return {
    adapter,
    controller,
    dispose: () => {
      controller.dispose();
      adapter.dispose();
    },
  };
}

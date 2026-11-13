export { AgentWorkspace, EvidenceRef } from "./AgentWorkspace";
export type { AgentWorkspaceProps } from "./AgentWorkspace";
export { PixelAgent } from "./PixelAgent";
export { WorkspaceController } from "./controller";
export {
  ScoutWorkspaceAdapter,
  connectScoutStream,
  scoutRecordSchema,
  scoutStatusSchema,
} from "./scout-adapter";
export { createHeroDemoWorkspace } from "./hero-integration";
export {
  DemoWorkspaceAdapter,
  DEMO_IDS,
  DEMO_OWNER,
  DEMO_PROJECT,
} from "./demo-adapter";
export * from "./model";

# In-world Agent workspace · S4 first slice

Select a teammate, inspect work, send a scoped request and return to exploring. The standalone command hall is an explicitly **DEMO 2D interaction host**, not the HERO 3D game. All chat/execution in this host is a fixed-rule local simulator, with no model calls, repository changes, external publication or credentials.

Also implemented: a **real-source, read-only SCOUT event projection**. This observes events; it cannot send real Agent instructions. The full real instruction → Agent acknowledgement → execution → feedback → independent result verification acceptance item in Issue #4 remains open.

## Run independently (Windows PowerShell)

```powershell
cd C:\Devungeon\wizard\packages\workspace-ui
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:4174 . Click a teammate, or focus the room, move with WASD/arrows and press E nearby. Escape / “返回地牢” closes inspection. The adapter and controller remain alive, so closing a panel does not cancel work. A reload resets this deliberately nonpersistent demo.

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
# An installed Chrome can be used instead of downloading Chromium:
$env:PW_CHANNEL='chrome'
npm run test:browser
```

Use Node 22.12+ / 24+ matching the package engine; validated on Node 24.13.1, npm 11.8.0 and Windows. Browser screenshots are in [output/playwright](output/playwright). Results and limitations: [VALIDATION.md](VALIDATION.md). Dependencies: [DEPENDENCIES.md](DEPENDENCIES.md).

## UI and work-state boundary

```tsx
import {
  AgentWorkspace,
  DemoWorkspaceAdapter,
  WorkspaceController,
  DEMO_OWNER,
  DEMO_PROJECT,
} from "@devungeon/workspace-ui";
import "@devungeon/workspace-ui/styles.css";

// Own these at host/session lifetime, outside the conditional inspector.
const adapter = new DemoWorkspaceAdapter();
const work = new WorkspaceController(adapter, DEMO_OWNER, DEMO_PROJECT);

// NPC click or proximity+E changes selection ONLY.
<AgentWorkspace
  adapter={work}
  selectedAgentId={selectedAgentId}
  onClose={() => {
    setSelectedAgentId(null);
    clearInput();
    focusCanvas();
  }}
/>;
// On project/session teardown: work.dispose(); adapter.dispose();
```

`WorkspaceAdapter` supplies an immutable cached snapshot, subscribe/unsubscribe, `send(Command)` and `decide(ApprovalDecision)`. Wrap it in `WorkspaceController` for validation and scoped command creation. The controller rejects invalid/cross-project projections, stale/replay/disconnected targets, unsupported capabilities and mismatched receipts. Work state has **no GameState or project-acceptance mutation API**. Selection, player position, HP and combat belong to the host.

The controller is a client validation layer. A future trusted command bridge must independently authenticate the requester; authorize project, Agent and task; validate the payload; enforce the capability, expiry and exact approval scope; and atomically deduplicate `command_id`. A browser-supplied `requester_id` is an audit claim, not authentication. The demo's fixed `demo-owner` is not a production identity or reusable production permission.

Commands have explicit actions. Chat text is never interpreted as an execution command. A transport error means the remote outcome is **unknown**; the UI retains the original command ID for reconciliation/retry and does not claim cancellation. Duplicate same-ID/same-content requests execute once in the simulator; changed content is rejected. Sensitive `publish` requests first create an immutable one-time approval; deny, expiry, disconnect, replay or capability revocation prevent execution. “Publish” here only generates a local synthetic receipt.

Tasks can be unknown/planned/active/blocked/review/completed/failed/cancelled. There is intentionally no `accepted` status in this UI model. Task evidence has an independent verification flag. Normalized `AgentEvent` payloads follow the existing canonical fields; mode, authoritative stale status and per-event replay metadata live in the workspace envelope. DEMO provenance is retained even during REPLAY. Evidence refs remain text unless they are credential-free HTTP(S) links.

## HERO integration

HERO owns `apps/web`, the root npm workspace and root lockfile. This branch does not edit them. During supervised integration add this package to root workspaces, reconcile its dependencies with the root lockfile, and import its source/CSS. The local lockfile supports independent installation before that integration.

```tsx
import {
  AgentWorkspace,
  createHeroDemoWorkspace,
} from "@devungeon/workspace-ui";
import "@devungeon/workspace-ui/styles.css";
const work = createHeroDemoWorkspace();
// Keep the existing room inspector; replace only the Agent inspector.
<AgentWorkspace
  adapter={work.controller}
  selectedAgentId={chosenAgent ? selected : null}
  onClose={() => {
    setSelected(null);
    clearInput();
    focus();
  }}
/>;
```

The helper explicitly maps `demo-wizard`/Lumen to the **simulated supervisor**, `demo-builder`/Cinder to the **simulated worker**, and `demo-scout`/Moss to the **simulated reviewer** in `demo:ember-archive`, room `forge`. These are UI fixture duties, not claims about real agent roles. IDs match HERO's scene; they are not inferred from display names.

While inspection is open, clear pressed keys and gate keyboard/pointer attacks in the host. Escape should close only the inspector, then restore canvas focus; it must not also pause/restart/approve. Work events continue independently of local combat pause, player death, wins and losses. Do not pass the game state into this package. A real observed Agent with an undeclared role is shown as unknown, never assigned a guessed role.

**Integration status:** stable IDs and selection/close/input contracts coordinated with HERO; helper tested. Actual merged HERO game integration is not claimed by this branch. No duplicate game engine or game main UI is introduced.

## SCOUT integration and real-source inspection

SCOUT provides read-only `/v1/status` and `/v1/stream` with named `status` and `record` SSE events. `ScoutWorkspaceAdapter` validates those envelopes, ignores project-only records for Agent characters, handles deduplication/cursor conflicts/epoch changes, preserves source timestamps and per-record modes, and projects unknown task completion. Completed tools do not establish task completion or product acceptance. The declared commands remain empty and both direct `send` and `decide` reject.

In the final combined host, serve the workbench and SCOUT routes through the same trusted origin:

```ts
const adapter = new ScoutWorkspaceAdapter(
  "github:orionaster/devungeon",
  optionalKnownRoster,
);
const work = new WorkspaceController(
  adapter,
  "local-viewer",
  adapter.projectId,
);
const stop = connectScoutStream(adapter); // /v1/stream, same origin only
// Host teardown: stop(); work.dispose();
```

For independent local verification, the optional Vite development host has a narrow loopback proxy. This is explicitly enabled, accepts only same-origin local GET requests for status/stream, and forwards no credentials. It does not alter SCOUT's Host/Origin checks or enable a command endpoint. It is **development-only**, not included in the static build.

1. Start the SCOUT bridge from its own checkout with an explicitly chosen public project and metadata source; see SCOUT's instructions. It was verified at `127.0.0.1:4313`.
2. Stop this package's dev server, then start it with:

```powershell
$env:SCOUT_BRIDGE_PORT='4313'
npm run dev
```

3. Open http://127.0.0.1:4174/?source=scout . Select the observed character and inspect Activity. If no Agent metadata is available, the view stays empty; GitHub events are not substituted.
4. To run the optional real bridge check against that running service:

```powershell
$env:PW_CHANNEL='chrome'
$env:RUN_SCOUT_INTEGRATION='1'
npm run test:browser
```

The bridge check is skipped by default, rather than silently substituting a mock service. The independent demo requires neither SCOUT nor HERO. Provider command control, durable work history, real AI chat, real approval authorization, game-scene acceptance and physical-device acceptance remain future work; see the validation report.

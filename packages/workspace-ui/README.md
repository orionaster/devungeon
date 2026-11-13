# In-world Agent workspace · S4

Select a teammate in the **actual HERO 3D game**, inspect work, send a scoped DEMO request and return to the same adventure. The primary `apps/web/src/App.tsx` is integrated. An independent workbench host also supplies a 2D test room, a 3D integration room, and real-source read-only SCOUT inspection. The primary game/default workbench chat is a fixed-rule local simulator. A separate **default-off, experimental Codex text connector** is prepared for review, with no real inference validation yet. There are no repository writes, external publication or provider credentials in the browser.

Also implemented: a **real-source, read-only SCOUT event projection**. This observes events; it cannot send real Agent instructions. The full real instruction → Agent acknowledgement → execution → feedback → independent result verification acceptance item in Issue #4 remains open.

## Run (Windows PowerShell)

```powershell
cd C:\Devungeon\wizard
npm ci --ignore-scripts
# Actual product game, including the workspace (port 5173):
npm run dev
# Or the independent workspace host (port 4174):
npm run dev --workspace @devungeon/workspace-ui
```

Primary game: http://127.0.0.1:5173 . Independent entries: http://127.0.0.1:4174 (2D DEMO), http://127.0.0.1:4174/?source=hero (HERO 3D integration room), and http://127.0.0.1:4174/?source=game (the same product App used by the primary entry). Click a teammate, or focus the game, move with WASD/arrows and press E nearby. Escape / “返回地牢” closes inspection. The adapter and controller remain alive, so closing a panel does not cancel work. A reload resets this deliberately nonpersistent demo.

```powershell
npm test # Existing game-engine checks
npm test --workspace @devungeon/workspace-ui
npm run build # Primary game
npm run build --workspace @devungeon/workspace-ui
npx playwright install chromium
npm run test:browser --workspace @devungeon/workspace-ui
# An installed Chrome can be used instead of downloading Chromium:
$env:PW_CHANNEL='chrome'
npm run test:browser --workspace @devungeon/workspace-ui
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

The committed HERO branch (`4510207`, PR #9) is a dependency of this feature branch; no worktree or replacement engine was created. The root npm workspace/lockfile now includes this package and React is deduplicated. The original package-local lockfile was removed. The only primary App changes are workspace lifetime, Agent inspection, work-event projection and input/pause boundaries. HERO's game/room/camera UI is retained. The feature PR is stacked on HERO for supervisor review; main is not merged.

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

**Integration status:** actual primary-App proximity/E → workspace → chat/dispatch → close → continue the same run is browser-tested. The separate 3D host also proves rendered-sprite click, local pause, player death and restart isolation. Work events drive the same character projection; the old independent S1 animation script is not started by the integrated App. Scene/runtime/physics are reused, not copied. No main-branch merge, public deployment or human acceptance is claimed.

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
npm run dev --workspace @devungeon/workspace-ui
```

3. Open http://127.0.0.1:4174/?source=hero&connection=scout for **real SCOUT characters in the 3D DEMO forge**, or http://127.0.0.1:4174/?source=scout for the lightweight observation view. Select a character or approach and press E, then inspect Activity. If no Agent metadata is available, the view stays empty; GitHub events are not substituted. Positions/skins are explicit display placement in the DEMO room, not source project facts. Unknown Agent roles remain unknown. REPLAY is never animated as live work; disconnect/stale disables activity immediately. All command capabilities remain empty.
4. To run the optional real bridge check against that running service:

```powershell
$env:PW_CHANNEL='chrome'
$env:RUN_SCOUT_INTEGRATION='1'
npm run test:browser --workspace @devungeon/workspace-ui
# Additionally enable the actual reviewed read-only Git instrument → 3D check:
$env:SCOUT_CHECKOUT='C:\Devungeon\scout'
$env:SCOUT_METADATA_FILE='C:\Devungeon\wizard\packages\workspace-ui\output\local-scout-metadata.jsonl'
npm run test:browser --workspace @devungeon/workspace-ui
```

The bridge checks are skipped by default, rather than silently substituting a mock service. The 2D DEMO and primary game require no running SCOUT service or account. The optional Git instrument test executes only the reviewed `observe-git.ts` against this public Devungeon checkout, using the explicit metadata file that the running SCOUT bridge must already observe.

## Native connector: readiness and default-off text experiment

`npm run preflight:codex --workspace @devungeon/workspace-ui` performs only local App Server initialization and permission-profile discovery. On the tested CLI it confirmed the allowed `:read-only` profile and sent **zero inference requests**. It starts no thread/turn, prints no account details or credentials, and gives the browser no Codex control. This is readiness evidence, not a real chat connection.

The separate entry http://127.0.0.1:4174/?source=hero&connection=codex uses `CodexTextAdapter` and the development-only `server/codex-session.ts` / `demo/codex-dev.ts` boundary. Without operator enablement it creates no Codex process and rejects POSTs; the UI is disconnected, with no capabilities. It is not included as a command server in static production builds, and it does not change the primary game's DEMO connection or SCOUT's observe-only contract.

**Pending owner approval:** the implementation is prepared, but its configured handshake and model turns have not been run against an account. After explicit approval for this exact trial, a local operator may restart the independent host with `DEVUNGEON_CODEX_TEXT_TRIAL=approved-two-turns`. This authorizes at most **two provider turns** across restarts, not a hard currency/token spend limit. Use only synthetic text, starting with `仅回复 DEVUNGEON-CHECK-42，不要添加其他内容。`. The bridge independently compares the literal reply; it does not accept provider claims of project completion. Existing account/default model are used at low effort/default speed; no new service is purchased. Actual credentials stay inside the installed CLI.

Constraints enforced by the host: fixed synthetic project/actor/requester, at most 1,000 characters, one active request, immutable command ID/content, no caller-supplied RPC/model/cwd/profile/tool, a new ephemeral thread per request, read-only profile, **empty environments and capability roots**, no shell/apps/MCP/hooks/plugins/memories/web search, and rejection of all server-initiated permission/tool requests. Effective startup overrides must be confirmed by `config/read` before any thread/turn; if the installed CLI does not return the expected constraints, it fails closed. This configuration path still needs actual CLI validation; do not weaken constraints to obtain a green result.

Only actual provider acknowledgements mark an actor as working. Local reservations/checks are attributed to the Devungeon bridge. Browser polling cannot renew source evidence; liveness refresh requires an actual local RPC response. An idle process exit revokes chat immediately. Closing the sheet/game does not own or cancel a turn. A timeout/disconnect means the outcome is **unknown**; new execution stops, retries retain the original ID, and the bridge never claims successful cancellation from a local timeout.

The host-owned `output/codex-text/` directory is ignored. It stores an empty synthetic cwd plus an append-only audit of IDs, SHA-256 command fingerprints, source thread/turn IDs and phases, **not** prompt/reply text, credentials or raw configuration. An exclusive filesystem lock prevents two host processes from sharing a turn budget. A crash leaves the lock intact; no age-based cleanup is attempted. Prior `reserved`/`unknown` commands block new requests across restarts. A supervisor must reconcile unresolved IDs and verify the owning process has stopped before any manual lock recovery. Do not erase the audit to reset the approved budget. This is a narrow local acceptance experiment, not production authentication, durable chat history, general task execution or a production approval handler.

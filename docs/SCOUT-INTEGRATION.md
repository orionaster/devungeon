# S3: read-only adapter contract for HERO, BUILDER and WIZARD

Run on Node >=24.13, without GitHub credentials:

```powershell
cd C:\Devungeon\scout\apps\bridge
npm ci --ignore-scripts
npm start
```

Default address: `http://127.0.0.1:4313` (literal IPv4, not localhost).
Only public `orionaster/devungeon` is selected by default. `--repo owner/name`
selects another public source explicitly. No provider credentials are read.

| GET endpoint | Response / consumer rule |
|---|---|
| `/v1/status` | `{schema_version, project_id, epoch, cursor, connections:{project,agent}, capabilities, warnings}` |
| `/v1/snapshot` | `{schema_version, connection, snapshot}`; 503 if absent; retained snapshot may accompany DISCONNECTED |
| `/v1/stream?after=0` | SSE named `record`, `status`, `snapshot`; EventSource `Last-Event-ID` resumes missed history |
| `/v1/events?after=0&limit=100` | `{schema_version,mode:"REPLAY",records,next_cursor,has_more}`; limit 1–1000 |

`record.data` is `{schema_version:"1.0",cursor:number,mode,event:AgentEvent}`.
SSE `id` equals cursor. `status.data` is the same as `/v1/status`.
`snapshot.data` is `{revision}`: refetch `/v1/snapshot`, reconcile by stable IDs.
Snapshot itself exactly follows root `schema/project-snapshot.schema.json`.
Its revision is a deterministic digest of observed facts, **not a Git commit**.
Issue/PR nodes are observed work items, not AI-inferred product capabilities.
CI, task dependencies and actual product acceptance remain unknown.

Project interface: `packages/project-adapters/types.ts` (`ProjectAdapter.read`).
Agent interface: `packages/agent-adapters/types.ts` (`AgentEventAdapter.read`).
Normalized events add `task_id`, `status`, `source_kind`, `idempotency_key` to
legacy v1. Root AgentEvent schema allows these additive optional fields;
SCOUT validates all four as mandatory on its output. Legacy synthetic examples
still validate. ProjectSnapshot and world/game schemas are unchanged.

Transport rules:

- Native EventSource reconnect is supported. Backlog is always REPLAY, including
  a first connection. An old newly discovered observation also arrives REPLAY.
- LIVE means a fresh observed event, not continuous work. Source connections and
  transport are independent: a working bridge can report a disconnected Agent.
- DEMO is separate from LIVE. Original `event.is_demo` survives replay; show both
  REPLAY and DEMO when applicable. STALE is source silence/expired freshness.
- Deduplicate by `event.event_id` / `idempotency_key`. Agent projection orders by
  occurred_at then cursor. Never let delayed events rewind current activity.
- Only fresh `source_kind:"agent"`, non-demo LIVE actions may animate live work.
  Expire activity promptly (reference consumer uses 3 seconds), and stop on
  disconnect. `source_kind:"project"` / `agent_id:"source:github"` is an import
  observer, **not a real Agent actor**. `completed` is not feature acceptance.
- Cursor is durable per data directory, project-scoped; `epoch` changes per
  process. Cursor ahead returns 409; invalid cursor returns 400. Reset consumer
  cursor explicitly when switching to a different journal; do not silently skip.
- The bundled `public/projection.js` is a build-free example reducer, independent
  of gameplay and acceptance. Import/copy it with its Apache-2.0 repository notice
  or implement these rules in the host's own store.

## Same-origin integration (Issue #12, wave 2)

The bridge deliberately exposes no CORS allowance and denies foreign Origin,
Host and cross-site browser requests. Do not bypass this with browser flags.
The included inspector is same-origin. The primary host can reuse the explicit
zero-dependency Node middleware in `apps/bridge/src/same-origin.ts`:

```ts
import {createScoutMiddleware} from '../bridge/src/same-origin.ts';
// In apps/web/vite.config.ts; enable only with an explicitly selected bridge.
const scoutRead = {
  name: 'devungeon-scout-readonly',
  configureServer(server) {
    server.middlewares.use(createScoutMiddleware({
      hostOrigin: 'http://127.0.0.1:5173', bridgePort: 4313,
    }));
  },
};
```

Mount the middleware directly (not under another Connect mount). Host consumers
fetch `/scout-read/v1/snapshot`, `/scout-read/v1/status`, `/scout-read/v1/events`
and `/scout-read/v1/stream`. WIZARD's existing `connectScoutStream` accepts the
last path. BUILDER receives `snapshot` from the snapshot response, not its wrapper.
The port is explicit; no upstream URL, repository parameter, token or arbitrary
path comes from the browser. An unselected host should not mount this middleware.

It verifies the exact UI Host/Origin and loopback peer before rewriting a fresh
upstream request. Only the four GET routes, validated after/limit values and
Last-Event-ID are forwarded. Cookie/Authorization/Origin are discarded. Foreign
origins stay denied on the direct bridge. Unavailable bridge returns 502 with a
stable error code; history remains a host projection concern. SSE client close
releases its upstream request. No public deployment is authorized. Another
option is host injection of already approved record/status values.

Published TS types: `BridgeStatus` / `SnapshotEnvelope` in project-adapters/types
and `EventEnvelope` in agent-adapters/types. No React or Vite runtime dependency
is introduced by the middleware; there is no root package/lockfile change.

## Shared locale / world boundary (Issues #10 and #14)

SCOUT has no UI-locale store, language selector, world selector or gameplay API.
Use WIZARD's **one shared locale provider/catalogue** in the primary host.
Translate display labels from the stable mode, reason, source_kind, event_type
and status values. Format displayed dates using that locale; keep UTC source
strings intact. Show original Issue/PR titles, original messages, IDs and evidence
separately. Do not translate their values inside ProjectSnapshot/AgentEvent or
send them to a translation service. Source warnings/messages remain original
diagnostic strings; the host may add its own locally translated explanation.

No locale query is accepted by the proxy. Switching UI language or world pack
must never reconnect/change source selection, rewrite timestamps, mutate events,
reset the journal cursor or grant a command. The API is the same for the first
pixel dungeon and future packs. No second game mode is implemented here.

All mutation routes return 405; commands/approvals/chat capabilities are empty.
S4 must add its own real authorization and audit design before enabling actions.
Source observation cannot authorize commands.

## Explicit local Agent metadata observer

```powershell
# Start with a selected metadata file; never scans home/Claude/Codex directories.
npm start -- --agent-file .devungeon-scout/scout-metadata.jsonl
# In a second terminal (same apps/bridge working directory):
# Select the Issue #3 room ID returned by /v1/snapshot (example from public import):
node scripts/observe-git.ts C:\Devungeon\scout .devungeon-scout/scout-metadata.jsonl github:issue:6367957313
```

`observe-git.ts` is an actual bounded read-only action invoked by the current
SCOUT Agent: verifies the selected public remote then observes `git rev-parse
--verify HEAD`, recording start/exit and a public commit link. It cannot accept
arbitrary commands. This proves local metadata → adapter → bridge → browser;
it **does not prove a Claude hook, Codex App Server or Crew subscription**.
Pass the selected snapshot room ID explicitly. A task ID equal to a known room
is also emitted as `room_id` when the snapshot is available; otherwise hosts can
join by `task_id` after loading the snapshot. No acceptance relationship is
inferred. Provider capture likewise accepts an explicit task scope.

`scripts/capture-provider.ts` is an optional stdin filter for actual selected
Claude hook payloads or Codex notifications. It hashes provider/session/item IDs,
discards prompts, paths, messages, tool arguments/output, and never opens a
provider transport or installs settings. Pass provider, output file, project ID,
task ID and **DEMO or LIVE** explicitly. Hand-written payloads must use DEMO.
Provider clocks are absent: these mappers use receipt time, not provider time.
Claude tool IDs support source-level dedup; lifecycle receipts have local UUIDs
because repeated Stop/resume has no stable occurrence ID. Retransmitted
lifecycle receipts cannot be reliably deduplicated upstream; journal/transport
retries of the same normalized record are deduplicated.
Use separate observer files for DEMO and real events: mixed files fail closed.

No private Agent account, transcript, Crew source, provider command channel or
global hook is connected. Real provider sessions require separate scoped
authorization and provider-version validation. `crew` is only a declared
metadata producer extension point, not a working private Crew integration.

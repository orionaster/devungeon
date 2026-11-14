# First Play: public project observatory

Implementation scope: one authored vertical sample for [Issue #17](https://github.com/orionaster/devungeon/issues/17), alongside the playable art sample for #16. This is not a generic feature inference engine and does not complete all of Issue #17's multi-room experiments.

## What the place represents

The real capability is **public project observation with traceable evidence**, already implemented by `GithubProjectAdapter`, the SCOUT bridge/journal and the unified host. An explicit optional `OBSERVATORY_FEATURE` sidecar maps this capability to three inspectable objects; it does not alter canonical ProjectSnapshot or WorldBlueprint v1.

| Object | Meaning and interaction | Evidence |
|---|---|---|
| Project map desk (`source-desk`) | Reads the latest public-project observation saved by the local bridge. Shows source state, original observed time, local request receipt and revision. | `packages/project-adapters/github.ts`, `apps/bridge/src/bridge.ts`, exact `/scout-read/v1/snapshot` response |
| Source archive (`evidence-cabinet`) | Preserves original Issue/PR titles, IDs, summaries and source links; shows recent original events with their delivery modes. | Validated source snapshot and SCOUT record envelopes |
| Agent test bench (`test-bench`) | Compares two explicitly scripted actions by Moss: map scanning and bench inspection. The typed task, station, source, phase and timestamps are inspectable. | Local DEMO activity receipts, never real model work |

These objects were authored from the product capability and implementation evidence. They are not inferred from file counts or GitHub issue titles. Their IDs remain independent of live source revisions and locale. The `game-only:observatory` room is entertainment space, not an accepted software feature. `devungeon.public-project-observation` acceptance remains **unknown / awaiting product review**.

## Real read and DEMO work are distinct

- `FeatureSampleStore.observePublic()` has exactly one network capability: a fixed same-origin GET to `/scout-read/v1/snapshot`, with omitted credentials, no redirects, no cache and a 12-second timeout. The existing bridge performs public GitHub polling independently; clicking this desk does **not** force another external GitHub poll.
- The response is validated by the canonical project compiler and scoped to non-synthetic `github:orionaster/devungeon`. Foreign projects, synthetic sources, malformed envelopes and a DEMO public-source connection are rejected. Source text, evidence and revision are retained without rewriting statuses or acceptance.
- This bounded action is attributed to `local-public-observer`, a **local program at the desk**, never a real AI Agent sprite. A successful receipt proves that the saved observation was read. It does not prove product acceptance or a model operation.
- The source panel uses the independently connected source's current LIVE / STALE / DISCONNECTED state. A successful read can legitimately return a stale or disconnected cached observation; its receipt keeps that mode and the original timestamp.
- Moss's exact ID is `demo:sample-scout`. Its scan and test tasks are local six-second scripts with explicit `kind`, station, project, room, source, timestamps and DEMO identity. No provider credentials, model calls or external commands exist in this store. A real GitHub observation does not promote Moss into a real Agent.
- Each action has a session-unique event/task/request ID. The in-memory history retains at most 50 records. This ephemeral sample ledger is separate from SCOUT's persisted journal.
- Typed action projection rejects unknown types, wrong project/room/actor, mismatched stations, missing task IDs, future/contradictory timestamps, unbounded durations, completed/failed actions and REPLAY / STALE / DISCONNECTED modes. It never guesses behavior from prose. Generic provider events without this contract stay evidence-only.
- "View last demo record" adds a clearly REPLAY, still DEMO historical receipt. It does not restart an animation as current work. Both tasks finish independently of pause, death or restarting the game; gameplay has no store mutation port.

## Reproduction

1. Start the unified root application with its local bridge. Open the First Play sample.
2. Click the map desk (or its accessible project-object entry). Read the capability's implemented and missing behavior. Select **Read public project**; expand **Last real read** and check request ID, source timestamp, revision and public source link.
3. Open the source archive. Compare original Issue/PR titles and links with GitHub. Closed items remain unverified observations; no room or feature is automatically accepted.
4. Open Moss or the test bench. Select **Demo map scan**; close the panel and observe scanning. Reopen after six seconds and choose **Demo bench inspection**; inspect its different kind/station and visual action. Both remain DEMO.
5. Open the completed task's source/metadata, then view its historical demo receipt. The REPLAY receipt does not resume work. Existing bridge backlog events similarly remain history with their own original evidence.
6. Switch Chinese / English during these steps. Source IDs, original text, task state, read receipt and world geometry must remain unchanged. Try the same while paused and after restarting combat; the sample store outlives the game session.

## Actual source-level checks

2026-11-14, Windows, Node 24.13.1, Vitest 5.1.0: `npx vitest run apps/web/test/feature-sample.test.ts` passed **7 / 7** tests. They exercise explicit metadata and rejection boundaries, distinct bounded DEMO tasks, no active replay, actual fixed-request construction, scope/provenance preservation, failure/retry/cached mode behavior and timeout abort. These tests use injected HTTP responses and do **not** count as a live source/browser result. The full delivery's browser report records the live public-data chain, interactions, visuals and remaining owner acceptance separately.

## Actual browser and public source checks

2026-11-14 08:54–08:58 UTC: independent Chrome 157 on Windows, 1440×960 viewport, production preview `http://127.0.0.1:5194` (08:51 UTC build, no HMR). **19 / 19 browser assertions passed**:

- A real desk read returned LIVE, 17 public Devungeon work items and revision `5521d2eb4d2a78c4f6c8e0ae6f79a415946c623e46f90339d209bbb6248e8b7e`. A separate credential-free GitHub REST read independently matched Issue #17's exact original title to the bridge snapshot.
- Chinese / English switching preserved receipt IDs, task records and original project facts. One Esc closed the inspector, restored the game surface's focus and permitted 1.577 units of keyboard movement without another Esc. Actual attack and dodge inputs incremented their gameplay counters while the DEMO task continued.
- Explicit scan and test actions had distinct task IDs/kinds/stations. Both ended after six seconds. The test task completed while gameplay time stayed fixed at `7.0833333333333135`; pausing gameplay did not pause the task. A completed historical task remained REPLAY and DEMO, never active work.
- Clicking the in-world archive exposed the original public Issue #17 source link. Gameplay and demo/replay left all real item statuses/evidence unchanged with zero accepted features. The 17 original project-only history records remained REPLAY, and the diagnostic API exposed only a copying snapshot reader.
- A deliberate browser offline fault during a user-driven source reconnect produced DISCONNECTED, retained cached evidence, failed the fixed GET without erasing the last receipt, recovered to LIVE on reconnection and did not duplicate the 17 source records or fabricate Agent activity.

The browser driver used only real clicks/keyboard inputs and read-only diagnostic snapshots. It did not teleport the player, set HP, inject project acceptance or fabricate HTTP source responses. The source fault was explicitly induced with the browser's offline network emulation; no unrelated bridge process was stopped.

Evidence generated under `output/playwright/featuremapping/`: `browser-qa-production.json`, `browser-offline-qa.json`, `live-read.json`, original driver snippets/logs, Chinese/English source panels, scan/test world captures, historical task panel, original evidence and disconnected-state screenshots, plus `task-interactions-production.webm`. These are integration evidence for the intermediate build, not the final art approval images. The final PR's consolidated evidence directory selects and links the final-build captures.

Two harness corrections are retained in the logs: an initial archive query wrongly expected only one Issue #17 link across both original-item and event contexts; scoping to the original-item list fixed it. Chromium's offline setting did not close the existing loopback SSE within ten seconds; explicitly reconnecting via the real project selector exercised the actual failure/recovery path. Neither initial attempt is counted as a passed check.

Independent visual inspection of the 08:51 production build also found large flat floor patches and the need to improve the relationship between Moss's stationary pose and the remote test bench. Those findings were sent to the art/render owners; these functional checks **do not grant visual acceptance**. Final art/render captures and the owner's playtest remain separate gates.

## Remaining scope

- One authored capability with three meaningful objects is implemented. Three distinct feature rooms across two unrelated project graphs are still outside this user-requested first vertical sample.
- Real Claude/Codex model tasks, edit/test/deploy execution, task semantics for arbitrary providers and AI-assisted scene generation are not connected here.
- Moss demonstrates two task-specific animation contracts; it is not evidence of real autonomous coding or testing. An actual read-only local source operation and untyped SCOUT events have their own honest program/evidence-only presentations.
- New-user comprehension, visual quality and product acceptance require the owner's playtest. Automated checks cannot grant them.

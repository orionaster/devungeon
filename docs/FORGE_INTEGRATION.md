# FORGE · Wave 2 integration and verification

Date: 2026-11-14 (Asia/Shanghai). Refs #12 and #10; future distinct gameplay remains #14.

This branch assembles the four open contributions without rewriting their histories or changing main. Merge ancestry: HERO `990e06a`, then WIZARD `817735f` (already contains that HERO), BUILDER `e8060f0`, SCOUT `48b44f6`, all above main `9e1ab2a`. Four normal merge commits retain the original implementations. The only source-branch merge conflict was `.gitignore`; both local-output and journal rules survive. Root integration then connects their ports and fixes actual cross-module failures.

## Implemented behavior

- One root React/Vite application and shared Chinese-first locale provider. HERO's original 2.5D sprites, 3D Rapier geometry, combat, dodge, collision, camera and room inspector are reused.
- Project selector uses canonical tiny (3 features / 2 dependencies) and modular workbench (8 / 9) snapshots through BUILDER. Stable source IDs, source evidence, deterministic layouts and pinned incremental paths survive. DEMO extension adds one planned, sealed feature; it cannot mutate public data. Original external names are labeled untranslated source text.
- Public Devungeon is imported anonymously by SCOUT, validated before compilation, and shown in the primary game, with original issue/PR titles, stable IDs, event modes, times and evidence. It observes work items; acceptance, CI and feature dependencies remain unknown. Closed Issues are not accepted. A game-only foyer encounter keeps entertainment independent when no real feature is enterable.
- Actual Agent observations create scoped visual markers, preserving unknown source role and identity. GitHub project observations create no Agent. Roster changes, source reconnect and language switches do not rebuild combat. Assigned actors in sealed rooms can be selected via the party row or sprite; no access is granted. Unmapped actors retain a factual source entry without invented placement.
- WIZARD's controller persists independently per project. Its DEMO adapter reuses source actor IDs (including tiny's single worker). Chat, task and approval exercises are explicitly simulated; the public adapter grants no commands. Replay never animates live work; fresh activity expires after three seconds and stops immediately when disconnected/stale. Duplicate deliveries retain one event; replay delivery conservatively relabels history.
- Same-origin middleware permits only four fixed GET endpoints, exact loopback Host/Origin, safe cursors and credential stripping. It does not provide an open proxy or browser source selection. No model/provider process, global hook, login, private source, external write, paid service or deployment is enabled.

## Start and reproduce

```powershell
git clone https://github.com/orionaster/devungeon.git
cd devungeon
git switch integration/wave2
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`. WASD / J / Space move, attack and dodge; Q/R rotate, wheel zooms, E inspects, P pauses. Select a project in the project toolbar. Room atlas and party rows remain factual DOM inspection routes. Language controls are in entry/HUD/workspace. Gameplay pause/defeat/restart has no Agent-command side effect. Public facts update immediately; a changed map revision is staged until the player explicitly applies it. Project switches and explicitly applied map revisions restart the local encounter with a visible explanation; work controllers survive.

`npm run preview` serves the production build with the same bridge. Both hosts bind only `127.0.0.1`. Set `DEVUNGEON_PORT`, `DEVUNGEON_SCOUT_PORT` and optionally `DEVUNGEON_DATA_DIR` for isolated instances. An occupied port or locked journal fails visibly; the launcher never kills another process or deletes a journal lock. An interrupted/forced OS termination may still require deliberate journal recovery per SCOUT docs.

For repeatable browser tests against an isolated bridge:

```powershell
# Terminal 1: the same primary app, test owns the separate bridge lifecycle
$env:DEVUNGEON_PORT='5183'
$env:DEVUNGEON_SCOUT_PORT='4318'
npm run dev -- --external-bridge
# Terminal 2, same checkout
$env:FORGE_URL='http://127.0.0.1:5183'
$env:FORGE_SUITE='all'
$env:FORGE_MANAGE_BRIDGE='1'
npm run test:browser
```

The browser runner launches installed Chrome/Edge on Windows, otherwise Playwright Chromium. For CI run `npx playwright install --with-deps chromium`. `FORGE_OUTPUT` selects a new evidence directory; each public run creates a new test-owned journal. `FORGE_HEADED=1` shows the automated browser. Debug hooks are read-only: they expose snapshots and metrics, never teleport/damage/project setters. Gameplay tests use actual keyboard/sprite/UI input and actual Rapier collision.

The public test invokes the bounded `observe-git.ts` instrument on this public checkout, with explicit task ID and metadata file, producing attributable start/exit records. It performs only remote verification and `git rev-parse --verify HEAD`; **this is actual local metadata observation, not a Claude/Codex subscription or model request**. Default startup has no Agent metadata source; GitHub observations alone correctly show zero Agents. To select your own non-sensitive observation file, run the bridge explicitly with `--repo orionaster/devungeon --agent-file <selected-file>` and run the host with `--external-bridge`, as documented in [SCOUT contract](SCOUT-INTEGRATION.md).

## Verification evidence

Windows 11 Home 10.0.26200, Intel Core Ultra 7 255H / Intel Arc 140T, Node 24.13.1, npm 11.8.0, installed Chrome 157.0.8103.78. Real WebGL through ANGLE / D3D11, viewport 1440×960 / DPR 1 (game canvas uses its intentionally lower pixel scale). No private provider or model was started.

Fresh **independent local Git clone**, no existing node_modules or borrowed native dependencies: `C:\Devungeon\forge\output\clean-checkout\forge`, application commit `c6a922a11f518a3d1e4cf594efbe1dc89f8e249e`. Its origin was set to the real public repository for the bounded observer's remote allowlist. This is a full checkout with its own Git database, not a source archive. Final documentation/evidence commits do not change this application code.

| Actual execution | Result / evidence boundary |
| --- | --- |
| Fresh `npm ci --ignore-scripts` | PASS; 124 packages installed / 130 audited, no install-time hooks. [Full clean log](evidence/forge/clean-validation.txt). |
| Root check and all automated tests | PASS: 9 engine + 11 host integration + 55 generator + 77 workspace (includes 19 i18n) + 14 bridge = **166**, no double counting. |
| Root production build, generator build, workspace build | PASS. Existing large-chunk and Radix `use client` bundle warnings remain. |
| Fresh Windows root lifecycle test | PASS, four behavior checks in one actual-process test: two normal SSE-connected stop/restarts; exact origin denial; forced-death no-orphan/fail-closed behavior; external bridge remains caller-owned. [Report](evidence/forge/host-lifecycle.json). Forced OS termination can retain a lock; it is deliberately not deleted automatically. |
| Dependency audit and React tree | Zero known advisories at execution; React / React DOM 19.3.1 deduplicated. [Audit](evidence/forge/clean-audit.json), [tree](evidence/forge/clean-react.json). |
| Python protocol/Skill validators | PASS: 7 JSON fixtures, optional experience invariants, cross references and 8 local Skill metadata checks. |
| Primary production browser | PASS: [83 assertions](evidence/forge/all-results.json), both full generated encounters, attack/hit/dodge/death/restart, all four camera-heading lock dashes, locked preview, actual sprite selection, DEMO chat/task/approval denial, paused whole-game locale invariance, project switching, stable incremental maps, concurrent real event/gameplay and public-source fault recovery. |
| Fresh-clone production repeat | PASS: [87 assertions](evidence/forge/clean-browser-results.json), same complete primary app from the independent clone at c6a922a, including the four rendered UI-mode checks. `FORGE_SUITE=all FORGE_MANAGE_BRIDGE=1 npm run test:browser:ci` owns its production host and real bridge; both stopped cleanly afterward. This repeats/extends the 83 assertions rather than representing 87 unrelated additional cases. |
| Browser-driver stress regression | PASS: [61 actual browser assertions under 6× CPU throttling](evidence/forge/cpu6-browser-results.json), 33 real keyboard navigation targets, unchanged 0.16-unit arrival tolerance and lock checks. This measures the automated driver under slowdown, not low-end human usability. |
| Final software-renderer workbench regression | PASS: [39 targeted workbench assertions](evidence/forge/software-workbench-results.json), actual ANGLE / Google Vulkan SwiftShader Device (Subzero), including real loss/restart and work isolation. [DOM/action trace](evidence/forge/software-workbench-trace.zip) is 916,978 bytes; actual checkpoint PNGs remain in the local run. This is a targeted workbench repeat, not another full two-project/public-source acceptance count. |
| Final public-source presentation / actual rate limit | PASS: [8 cached-source/UI checks](evidence/forge/cached-public-labels.json) at 137cb44, 15 retained public work items, no acceptance/Agent invention, real attack/dodge, Chinese/English labels and paused-state invariance. **Fresh import is false**: anonymous GitHub quota was exhausted during the repeated tests. [One additional fresh-source rerun](evidence/forge/public-rate-limited.json) correctly failed with rate_limited / snapshot 503 and is not counted as a successful fresh LIVE import. Earlier successful full public proofs above remain the LIVE/replay lifecycle evidence. |
| Public UI-mode repeat | PASS: [26 assertions](evidence/forge/public-results.json), overlapping the primary public cases and adding four actual rendered LIVE/STALE/DISCONNECTED/REPLAY label checks. These are **not** 26 additional independent cases to add to 83. |
| WIZARD regression host | PASS: 17 browser tests, 2 explicit opt-in SCOUT cases skipped. Those are separate from the primary production public-source tests above. Both updated primary tests passed; original four-PR evidence remains separately scoped. |
| Headed production recording | [42.72-second actual Chrome video](evidence/forge/headed-showcase.webm), 1440×960 / VP9 / 25fps. Chrome native playback reached 20s with readyState 4 and no media error: [media check](evidence/forge/showcase-media.json), [recording result](evidence/forge/showcase-results.json). Automated headed interaction and AI visual review do not establish independent human acceptance. |

Measured primary run, on this machine only:

| Selected project | Average sampled FPS | p95 frame ms | Worst observed frame ms | Draw calls / triangles at capture |
| --- | ---: | ---: | ---: | ---: |
| Tiny | 59.34 | 16.9 | 167.7 | 55 / 9,238 |
| Workbench | 58.89 | 16.9 | 201.5 | 110 / 23,112 |
| Public Devungeon | 57.20 | 17.4 | 345.0 | 56 / 29,678 |

Cold hitches are visible and not claimed to meet a low-end device target. Headed recording averaged 59.08 FPS with p95 17.2ms / worst 291.9ms. Production initial JS is approximately 1.62MB (456KB gzip), with a separate 4.33MB Rapier chunk (1.67MB gzip). No unhandled browser exception was observed; deliberately stopped bridge probes produce expected HTTP 502/503 console entries. Three.Clock deprecation is inherited and still logged.

Representative actual captures: [combat](evidence/forge/tiny-combat.png), [incremental complex map](evidence/forge/workbench-incremental.png), [Chinese approval](evidence/forge/workbench-approval-zh.png), [English approval](evidence/forge/workbench-approval-en.png), [public LIVE](evidence/forge/public-live-agent.png), [read-only observed Agent](evidence/forge/public-readonly-workspace.png), [STALE](evidence/forge/public-stale.png), [DISCONNECTED](evidence/forge/public-disconnected.png), [REPLAY](evidence/forge/public-replay.png). Raw traces are retained locally under ignored `output/playwright/forge*` (large, roughly 67–223MB per project) and uploaded by CI on its own runs; they are not committed with the application.

### Failures found, corrected or retained

- Initial shared package build failed on two previously unused generator type imports exposed by WIZARD's stricter compiler. Removed only those unused types; both independent package builds now pass.
- First integration toolbar overlapped HP; a bottom placement then overlapped keyboard hints. The reviewed final top-center placement keeps both clear. The source journal now scrolls within the viewport.
- Adding a real observed actor originally changed scene identity and would rebuild physics. Dynamic actor roster/display and immutable game scene now have separate ports; the real-event browser scenario starts combat before the first actor arrives and proves no reset.
- Initial launcher killed the Windows bridge without journal cleanup. Normal shutdown now uses private lifecycle IPC and bounded owned-process cleanup. Aggressive OS force-kill probes disproved the stronger claim that all locks can always be removed; final behavior preserves the stale lock, leaves no process, and rejects restart rather than silently clearing it.
- A malformed SSE frame initially closed permanently. A bounded reconnect and retained-history regression now pass; actual malformed selected metadata/repair was separately tested end to end. Duplicate replay delivery can never promote back to LIVE activity.
- An intermediate public browser rerun was interrupted by development HMR and reset to the initial project. That run was rejected as evidence; the final acceptance uses a fixed production build, followed by a fresh-clone production repeat.
- Recording initially lacked Playwright's pinned ffmpeg test binary. It was installed only into an ignored local test cache; native playback of the completed recording passes. No binary/cache/runtime dependency was added to the repository.
- The first remote workspace workflow ran `npm test` before any check/build, exposing missing generated schema copies. The integration test command now synchronizes the canonical root schemas itself; it no longer relies on a previous command. This changes test preparation only, not application behavior. The clean-checkout test-before-check regression and remote rerun are recorded with the final CI result.
- Linux software-rendered CI exposed keyboard-driver overshoot: waiting for keydown's round trip extended the actual held interval. The browser driver now queues a bounded release independently, reads back a neutral simulation frame and adapts shorter pulses near the target. Route, arrival tolerance, physical collision and lock assertions remain unchanged. The same route was exercised successfully under an actual 6× CPU-throttled Chrome regression; that stress setup is not claimed to reproduce every property of the CI software renderer. Final remote status is linked in the PR.
- Public-source empty-history presentation now uses the factual observation heading and original-text label. An empty Agent event list no longer vacuously qualifies as an all-DEMO script.
- The next Linux driver run reached the first encounter but took seven actual hits while trying to stand at the exact center before attacking. The driver now attacks with real held J after its first observed hit during winning encounter navigation, and releases it before workspace/death tests. A subsequent doorway-only loss setup let knockback move the player outside the encounter before death. The final deliberate-loss case walks toward the already-verified room center without attacking and accepts actual death along that route as its intended result. Only this loss setup allows a frozen lost snapshot to end its movement wait; every winning room-center route and collision assertion stays strict. Game HP, enemy state, physics and death/isolation assertions are never set by the driver.
- Software-rendered validation exposed a focus-check race: dialog disappearance precedes the host's scheduled focus restoration. The test now awaits the actual game surface focus with a bounded timeout, matching WIZARD's existing regression pattern. CI disables only the trace screenshot filmstrip; DOM/action traces, actual checkpoint images, failure PNGs and every assertion remain. Reports upload on all CI outcomes; larger traces upload only on failure, reducing recording overhead and artifact storage.
- The new combined workflow runs on PR changes, cancels superseded runs and has a 15-minute job bound; it avoids duplicate push/PR runs of the same integrated browser scenario. Existing first-wave workflows are retained.

Engineering assessment: the requested first-pack integration behaviors have working implementations and actual desktop-browser evidence. This is suitable for supervisor review of #12. Human acceptance remains open; real provider commands, a second gameplay type and the broader full-V1 checklist are not claimed complete.

## Dependencies and licenses

Root npm workspaces now include the existing bridge and generator, sharing the root lockfile. React/React DOM remain 19.3.1, R3F 9.8.2, Three 0.187.0 and Rapier 0.21.0. Reused generator packages are AJV 8.20.0, ajv-formats 3.0.1 and rot-js 2.2.1. Existing tool versions are retained; Node minimum is 24.13 to support the bridge's native TypeScript. No new runtime library or remote service was introduced for orchestration, state or i18n.

`scripts/dependency-licenses.mjs` generates [exact installed manifests](DEPENDENCY_LICENSES.json) and distributable `apps/web/public/THIRD_PARTY_NOTICES.txt`. Windows reviewed 119 installed manifests; absent platform-optional binaries remain pinned in the lockfile. Licenses are recorded per package, including rot-js BSD-3-Clause and the existing MPL-2.0 transitive package. No project license changes. All art remains HERO's original code-authored assets under repository Apache-2.0, with no imported music/fonts/third-party images. Existing package-specific license records remain historical evidence.

## Scope and remaining acceptance

This is engineering integration evidence for #12, not full PRD acceptance. Independent human playtesting, three-new-user comprehension, physical mobile/Safari, low-end hardware, real provider chat/commands/approvals, arbitrary private/local project imports, persistent game saves, AI semantic product inference and a second distinct world type are not established. Public GitHub status can be rate-limited or unavailable; the app retains the last validated facts/history and labels disconnection. Initial download has large game/physics chunks and measured cold hitches. Local journals are bounded single-writer storage, not production durability.

Review order remains HERO #9 → WIZARD #7 after retargeting → BUILDER #8 / SCOUT #6 as compatible → this integration branch. Alternatively review this PR as the combined ancestry, retaining all original contributions. Do not squash/cherry-pick overlapping WIZARD/HERO histories blindly. No source PR or main has been merged by FORGE. Recheck moving heads before final merge; use normal merges and rerun combined checks if any upstream code changes.

# First Play Upgrade · FORGE delivery

2026-11-14 · Refs #16, #17 · base `integration/wave2` / PR #15, `d945eacd8b81e745228296e6d8178c4014e79d5d`.

## Result and review boundary

The default application now opens one playable **Starlit Observatory** art sample. It hosts Devungeon's real public-project observation capability, three purposeful objects and one explicitly DEMO guide. Generated tiny/workbench/public project maps remain available under **Projects & maps**; their existing art has not been replaced. This is a review candidate, not product-owner visual approval or completion of the entire V1 / Issue #17.

| Requirement | Implemented | Actual verification | Still required |
| --- | --- | --- | --- |
| Comfortable camera | One shared smoothed focus/position anchor, fixed-step actor interpolation, no walking bob | Rendered-camera measurements during real movement/attack/dodge; four headings | Owner comfort playtest |
| Collision and occlusion | Shared prop/Agent footprints and deterministic reserved chest positions; sample guide clearance | Walking/dodging into walls, sealed door, desk and guide; real screenshots | Owner visual judgment at contact |
| Input recovery | One Escape closes the active overlay; explicit pause stays visible; focus restores; held input clears on blur/hidden | Help, map, feature panel, DEMO panel, explicit pause and resume | Native focus-loss transition was not emitted by this automated Windows session; automatic blur/hidden pause is not claimed tested |
| First visit | Chinese-first entry, one Start, current project/objective; details/camera controls collapsed | Production browser entry, movement and one-click feature inspection | Independent new-user comprehension |
| Art | One coherent CC0 pack, directional animated hero, guide, slimes, furniture, lamps, distinct study/practice surfaces, sealed annex | Actual runtime four-heading PNGs and gameplay video, independent FORGE/art review | Product-owner visual approval before rollout |
| Real project mapping | Desk reads the public snapshot, archive exposes original evidence, bench/guide demonstrates distinct typed tasks | Actual public source read, original Issue/PR evidence, zero fabricated acceptance | Generalized semantics for arbitrary projects and three different feature rooms |
| Isolation | Source facts, authored representation, DEMO task ledger, commands and game have separate lifetimes | Combat/restart/paused locale invariance; legacy workspace approvals; public lifecycle | Real model execution remains unconnected |

## Start and reproduce

Use Node >=24.13 (tested 24.13.1), npm 11.8.0:

```powershell
git switch feat/first-play-upgrade
npm ci --ignore-scripts
npm run dev
```

Open the loopback URL printed by the host (default `http://127.0.0.1:5173`). For an isolated second instance:

```powershell
$env:DEVUNGEON_PORT='5194'
$env:DEVUNGEON_SCOUT_PORT='4324'
$env:DEVUNGEON_DATA_DIR='C:\Devungeon\first-play\.devungeon-scout\review-new'
npm run build
npm run preview
```

Do not reuse another running bridge's data directory. No account, model key, hooks, paid service or deployment is needed. Public GitHub polling may be rate limited; cached data retains STALE / DISCONNECTED labels.

1. Select **Start exploring**. WASD moves, J/left click attacks, Space dodges. Q/R rotates; E inspects nearby objects. P/Escape pauses. Approach the right practice area to engage slimes; the study area does not immediately attack a new player.
2. Click **Explore this feature**, the desk or its world label. Read what exists, what is missing and why acceptance stays unknown. Select **Read public project** and expand the real receipt. This is a fixed, credential-free local GET of the bridge's latest public observation, not a model call or forced GitHub poll.
3. Click the archive to inspect original Issue/PR titles, IDs, timestamps and evidence links. Closed issues, tool success and game victory never grant acceptance.
4. Click **Moss · DEMO** or the bench. Start the six-second scan, close the panel, then inspect the different bench task. Task type/station/source/times are explicit metadata; historical, expired, unknown or disconnected observations are not promoted into live work. Moss stays at its reserved desk position; bench action is a remote scripted demonstration, not pathfinding or real coding.
5. Switch 中文 / English in the live panel; close once with Escape and continue moving. Pause, win and restart; source evidence and task records persist. Existing DEMO chat/assignment/approval tools remain on the workbench project map.
6. Inspect the sealed annex at every camera heading. The camera may preview it; walking/dodging cannot enter it or unlock software work.

## Engineering and source decisions

- Independent worktree `C:\Devungeon\first-play`, branch `feat/first-play-upgrade`; no edits to the other five Agent worktrees, no main changes, force push, merge or deployment. PR targets `integration/wave2` while #16/#17 await product review. PR #15's head was rechecked unchanged before delivery.
- Camera position and focus use the same exponentially smoothed anchor. Presentation interpolation never changes the authoritative Rapier/game snapshot. Prop footprints and Agent placement are shared by physics and rendering. The sample's larger guide contact clearance does not rebalance legacy maps.
- One shared locale provider; new `play.*` / `sample.*` keys join the existing typed catalogues. Locale does not rebuild the world, authorize commands or reset tasks.
- A renderer-neutral feature sidecar describes **why** the three objects represent this capability. It cannot mutate canonical project status. Actual local reading is attributed to a program at the desk, with no invented real AI sprite. DEMO tasks are a separate bounded script ledger; typed kind is never inferred from free text.
- Scene and skin are opt-in to this one pixel world sample. Project facts and future world-pack selection stay independent. No second genre or AI world-generation executor was added.

Art selection, three actual-source reference sheets and rejected alternatives: [FIRST_PLAY_ART_DIRECTION.md](FIRST_PLAY_ART_DIRECTION.md), [comparison board](evidence/first-play/art-directions.png). Selected **Ninja Adventure**, Pixel-Boy + AAA, archive dated 2026-03-29, CC0-1.0. Twenty selected unmodified PNGs total 65,690 bytes; crops/frame choices/assembly are in inspectable source. The archive and each selected file have hashes in [manifest](../apps/web/public/assets/first-play/manifest.json). See [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) and the packaged notices. No npm dependency/lockfile or project license change; no fonts/audio/Soul Knight assets imported.

## Actual validation

Windows 11 Home Chinese 10.0.26200 x64, Intel Core Ultra 7 255H, Arc 140T/D3D11, Chrome 157.0.8103.78; viewport 1440×960, DPR 1. Results are specific to this machine. Automated browser input is not independent human playtesting.

- Fresh isolated worktree dependency install: `npm ci --ignore-scripts`, 124 installed packages / 130 audited, zero known audit findings. TypeScript, production build and root host lifecycle checks passed. No existing Agent node_modules was touched.
- **178 automatic tests**: engine 14, integration 18 (including seven new sample contracts), world generator 55, workspace/i18n 77, bridge 14. The separate real-process host lifecycle test also passed. Repeated suites/subsets are not added as extra tests.
- **61 legacy production browser assertions**: two distinct project graphs, full combat and damage, four-heading locks, actual NPC click, DEMO chat/tasks/permission denial/pending approvals, actual death/restart, bilingual invariance, incremental room/corridor stability and source isolation.
- **26 real public-source browser assertions**: anonymous public project to scene/UI; actual bounded Git observation arriving while attacking/dodging; LIVE/STALE/DISCONNECTED/REPLAY UI, duplicate input, reconnect, corrupt metadata fail-closed/recovery, unsupported writes denied.
- **22 final sample product assertions**: simple entry, real movement/attack/dodge, single-Escape recovery, visible pause semantics, actual public read and unknown acceptance, Chinese/English invariance, two distinct six-second DEMO tasks, completion while paused, historical replay, actual two-slime victory and restart without evidence/task changes.
- **15 final render/input assertions**: four-heading wall/door collisions, actual corridor fight, desk/guide contact and camera measurements. Numeric camera invariance proves removal of unwanted pitch/yaw changes during translation; comfort remains an owner judgment.

Intermediate feature-only and render-only checks are documented in [feature record](FIRST_PLAY_FEATURE_SAMPLE.md) and [render record](FIRST_PLAY_RENDER_VALIDATION.md). They overlap these final suites; they are not extra accepted features. Evidence and final metrics are indexed in [validation-summary.json](evidence/first-play/validation-summary.json).

Reproduce on a running production host:

```powershell
$env:FIRST_PLAY_URL='http://127.0.0.1:5194'
node scripts/first-play-browser.mjs
node scripts/first-play-render.mjs
$env:FORGE_URL='http://127.0.0.1:5194'
node scripts/forge-browser.mjs
```

The public lifecycle suite needs its own external bridge port and selected metadata directory; it starts/stops only its own bridge. Follow the existing [FORGE instructions](FORGE_INTEGRATION.md). The CI host runner now executes both legacy gameplay and the sample render suite; public network proof remains a separately recorded opt-in run.

## Failures, limits and review state

Failed attempts are retained in [failed-attempts.json](evidence/first-play/failed-attempts.json). Early HMR changed the app while intermediate agents tested it; final evidence uses a stable production bundle. Earlier art had incorrect flat annex flooring and weak station hierarchy; it was replaced before final capture. The legacy driver was updated to open newly collapsed menus and avoid solid NPC footprints. One driver pressed attack/dodge in the same simulation step (dodge legitimately won priority); another assumed a timed dodge ended on the corridor centerline. The corrected drivers separate inputs and navigate from observed coordinates, without game setters, teleports, HP changes or fake source responses. A word-based panel assertion was corrected to the actual implemented/missing sections. These failures are not counted as passes.

The Windows browser control API did not produce a real blur/hidden event when changing targets or requesting minimization in this session. Input cleanup/visible resume code handles those browser events, but that native focus-loss path remains **not verified**; no synthetic DOM event was used to claim it passed. Explicit pause, panel exits and immediate movement after one Escape were actually tested.

The guide remains stationary for these two scripted tasks; generalized task travel, real model execution, arbitrary provider task semantics, three rich feature rooms, all-map art replacement, independent new-user tests, owner art/comfort approval, physical mobile/Safari and low-end-device performance remain open. The gate is physically side-on at heading 0; a **Sealed** label identifies it and quarter turns expose the grate. Large JS/WASM chunks and existing Three.Clock/Radix build warnings remain.

**Engineering candidate is reviewable; owner product/visual acceptance is open.** Review this room first. If approved, apply the same art/occupancy rules to one generated room, test seams/locks/actor density, then propose wider rollout. Do not merge to main or mass-replace assets before that review. This PR does not close #12/#16/#17 or grant software acceptance.

## Evidence

- [Actual sample entry](evidence/first-play/entry-zh.png), [playable room](evidence/first-play/room-zh.png)
- [Real public source, Chinese](evidence/first-play/feature-live-zh.png), [English](evidence/first-play/feature-live-en.png)
- [Final isolated run with disconnected public cache, Chinese](evidence/first-play/feature-cached-zh.png), [English](evidence/first-play/feature-cached-en.png). The earlier online captures above remain separate source evidence.
- [Four-heading/contact evidence](evidence/first-play/render), [sample gameplay video](evidence/first-play/first-play.webm), [render/contact video](evidence/first-play/render-input.webm)
- Baseline before this upgrade: [PR #15 gameplay record](evidence/forge/headed-showcase.webm). It remains baseline evidence, not this round's visual approval.

## Final isolated execution and remote checks

The actual application commit is **`7a67f1ade68f323cea1ebd2834e820c880051abc`**. An independent local Git clone at `output/clean-checkout/first-play-20261114-1730` installed dependencies from scratch at `1928f65`, with zero audit findings. It passed both TypeScript checks, all 178 automatic tests, production build and the real-process lifecycle test. The clone then fast-forwarded to `7a67f1a`, whose only application change moves the existing CSS imports into the shared host; package/lock files are unchanged. TypeScript/build and the complete 22-product / 15-render browser suites were repeated on that exact final application commit. [Install/build/test log](evidence/first-play/clean-validation.txt).

The fresh anonymous GitHub import hit an actual rate limit (`retry_at` 2026-11-14T09:42:08Z), leaving its empty source honestly DISCONNECTED. This failed attempt is retained in [cold-source-rate-limit.json](evidence/first-play/cold-source-rate-limit.json). The final isolated frontend then used the already running, previously imported **real public** bridge cache. Its 17 items retain their original observation time (2026-11-14T09:09:11.021Z) and **DISCONNECTED** mode. Reading that cache is an actual successful local GET, not new live GitHub access. The earlier 26-case public-source run and online screenshots independently establish the online chain; no account, alternate credential or fake LIVE label was used to evade the limit.

Final local sample performance: roughly 59–60 FPS, product p95 17.1ms, worst frame 143.4ms including startup; 207 draws / about 2,400 triangles. The final camera test sampled actual animation frames during movement/attack/dodge and measured zero orientation/anchor offset change. Those figures do not grant human comfort or low-end performance acceptance.

Native Chrome decoded the committed 1440×960 videos without media errors: product 24.44 seconds, render/contact 41.44 seconds. [Playback result](evidence/first-play/media-playback.json). Four additional actual-input contact captures verify the larger guide clearance and the label's avoidance of the player at 0/90/180/270 degrees: [contact review](evidence/first-play/contact-review.json) and [images](evidence/first-play/render).

The first WIZARD CI run failed two existing primary-entry tests: they selected a now-collapsed control. Updating the driver then exposed a real alternate-host CSS ownership bug (the Canvas intercepted the unstyled menu). Styles now belong to the shared host in every entry; no assertions were removed. The two local tests passed in 6.9 seconds, and the final remote workspace suite passed **17**, with **two pre-existing opt-in source cases explicitly skipped**. [Initial failure](evidence/first-play/wizard-ci-failure.txt), [local recovery](evidence/first-play/wizard-local-recovery.txt).

On application commit `7a67f1a`, [FORGE Windows/Linux CI](https://github.com/orionaster/devungeon/actions/runs/43581007228) passed fresh installs, checks, 178 tests, build, lifecycle and Linux's legacy/sample browser runs; [WIZARD CI](https://github.com/orionaster/devungeon/actions/runs/43581007227) passed. [Recorded job results](evidence/first-play/application-ci.json). Subsequent evidence/documentation commits preserve this application code; the current PR checks are the final remote status authority.

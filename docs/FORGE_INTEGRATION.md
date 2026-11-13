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

Exact environment, commands, final counts, measured performance and final clean-checkout revision are recorded below after execution. Prior first-wave evidence is retained with its original scope; only FORGE evidence validates this combined entry.

## Dependencies and licenses

Root npm workspaces now include the existing bridge and generator, sharing the root lockfile. React/React DOM remain 19.3.1, R3F 9.8.2, Three 0.187.0 and Rapier 0.21.0. Reused generator packages are AJV 8.20.0, ajv-formats 3.0.1 and rot-js 2.2.1. Existing tool versions are retained; Node minimum is 24.13 to support the bridge's native TypeScript. No new runtime library or remote service was introduced for orchestration, state or i18n.

`scripts/dependency-licenses.mjs` generates [exact installed manifests](DEPENDENCY_LICENSES.json) and distributable `apps/web/public/THIRD_PARTY_NOTICES.txt`. Windows reviewed 119 installed manifests; absent platform-optional binaries remain pinned in the lockfile. Licenses are recorded per package, including rot-js BSD-3-Clause and the existing MPL-2.0 transitive package. No project license changes. All art remains HERO's original code-authored assets under repository Apache-2.0, with no imported music/fonts/third-party images. Existing package-specific license records remain historical evidence.

## Scope and remaining acceptance

This is engineering integration evidence for #12, not full PRD acceptance. Independent human playtesting, three-new-user comprehension, physical mobile/Safari, low-end hardware, real provider chat/commands/approvals, arbitrary private/local project imports, persistent game saves, AI semantic product inference and a second distinct world type are not established. Public GitHub status can be rate-limited or unavailable; the app retains the last validated facts/history and labels disconnection. Initial download has large game/physics chunks and measured cold hitches. Local journals are bounded single-writer storage, not production durability.

Review order remains HERO #9 → WIZARD #7 after retargeting → BUILDER #8 / SCOUT #6 as compatible → this integration branch. Alternatively review this PR as the combined ancestry, retaining all original contributions. Do not squash/cherry-pick overlapping WIZARD/HERO histories blindly. No source PR or main has been merged by FORGE. Recheck moving heads before final merge; use normal merges and rerun combined checks if any upstream code changes.

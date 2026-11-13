# HERO · Integration wave 2 · 2026-11-14

Scope: HERO's prerequisite PR #9 and host/renderer/i18n contracts for [Issue #12](https://github.com/orionaster/devungeon/issues/12). **This is not a claim that the complete four-module product or Issue #12 has been accepted.**

## Source and decisions

- Ordinary merge `a81a72e` reconciles main `9e1ab2a` with the existing HERO feature branch. README was the only conflict; both the running first pixel pack and main's project-adaptive product description were preserved. ADR-0002, PRD v1.3, I18N, protocols and updated Skills remain intact. No history rewriting or PR merge.
- WIZARD's isolated shared locale core was cherry-picked from `4e8fb12` as `dd73fc1`; no whole S4 branch, command adapter or provider credential path was imported. HERO source `4d45bd4ad92488d991665beb083fbd1847fffe6f` adds the root host integration and game catalogue.
- Pixel dungeon remains the first implemented pack. Locale changes presentation only. No second genre, world selector, save-migration promise or arbitrary plugin execution was added.

## Implemented

The entry, HUD, controls/help, results, atlas, room/Agent inspection, statuses, errors, accessibility labels, document metadata and DOM fallback support Chinese/English. Fresh sessions default to zh-CN, selection is local, and one WIZARD I18nProvider owns persistence/interpolation/fallback/date formatting. HERO contributes typed `game.*` resources through the agreed extension; parity covers both languages. Source IDs, raw source messages/references, enums and geometry are never translated. Six explicitly known first-party synthetic messages have translated display text with the original still available in inspection.

The real root `App` now accepts:

```tsx
<App
  scene={stableCompiledScene}
  agentEvents={projectScopedProjection}
  demoEvents={false}
  roomDisplay={(room) => ({ name, reason, status })}
  renderAgentInspector={({ agentId, onClose }) => (
    <AgentWorkspace
      adapter={workController}
      selectedAgentId={agentId}
      onClose={onClose}
    />
  )}
  sourcePanel={readOnlyProvenancePanel}
/>
```

These ports do not accept Agent commands or authorize work. The existing standalone S1 host retains a read-only inspector; actual workspace and SCOUT integrations are supplied by their reviewed modules. `DungeonScene` separately accepts `scene`, read-only `agentEvents.actor`, `onSelectAgent` and localized `fallback` content. Diagnostics report the actual scene/access/event port. Replacing a scene intentionally starts a new local run; changing the event port, event script or UI locale does not recreate the Dungeon. Scene errors clear on valid replacement and obsolete async failures cannot overwrite the replacement.

BUILDER integration fixes:

- Optional explicit `doors: {room_id,x,z,axis,locked,width?}[]` wins over the old nearest-corridor guess. Axis is the direction across the opening; width defaults to one tile. Locked doors have matching swept colliders. Legacy inference applies only when no door array is supplied. `cameraControl.previewRoomId` targets a specific locked room.
- Optional source `project_context` preserves original project ID/revision/time/source reference. Optional `visual_only` NPCs may stand strictly inside their known assigned locked room, as visible read-only markers. They never gain navigation, physics authority or player access. Source role/is_demo remain separate from sprite class. Mixed simulated actors/events show their own DEMO labels, and cross-project event ports are not displayed.
- Root scene lifecycle is separate from event lifecycle; held-key release crosses locale controls, pointer-based HUD locale changes return focus to the game, and keyboard locale changes retain normal button focus. No new authorization state exists.

## Reproduce and evidence

From the existing HERO checkout, Node 22.12+ (tested Node 24.13.1/npm 11.8.0):

```powershell
npm ci
npm test
npm run build
npm run preview -- --port 5174
# separate terminal
npx --no-install playwright-cli -s=hero-wave2-proof open http://127.0.0.1:5174 --headed
npx --no-install playwright-cli -s=hero-wave2-proof run-code --filename apps/web/scripts/browser-acceptance.js
npx --no-install playwright-cli -s=hero-wave2-proof run-code --filename apps/web/scripts/browser-i18n.js
```

The regression runner explicitly chooses English; the separate language runner clears only its isolated browser's locale preference and checks Chinese-first behavior. Their actual inputs, screenshots and read-only diagnostics are preserved under `output/playwright/wave2`. Browser scripts now use named function declarations so formatter-added expression semicolons cannot break CLI execution.

For reconnect/mixed-source/error fault checks: run `npm run dev`, open `/tests/host-contract.html` and execute `apps/web/scripts/browser-host-contract.js`. This harness embeds the **same full App**, with clearly labeled synthetic flags and ordinary prop-change controls. It is not a real public source or the finished unified product. It verifies event-port/script replacement without losing the paused game, per-entity DEMO/read-only markers, cross-project rejection and invalid-spawn → valid-scene recovery.

Evidence recorded in this wave:

- 9 engine tests: prior combat/locks/state-isolation cases plus explicit door placement/collision and locked-room visual-only NPCs.
- 19 WIZARD locale tests: typed key/parity/placeholder/fallback/privacy/formatting/SSR/provider boundaries. Vitest 5.1.0 is exact-pinned, MIT, compatible with Vite 8 and Node 24; no translation service or runtime dependency was added. The installed dependency notice inventory is regenerated (72 Windows manifests); npm audit reports zero known advisories.
- 22 production-browser checks: movement, damage, dodge, real combat language switching without resetting progression, victory/reward, four headings, locked walk/dodge/corner, preview, independent events/pause, inspection, death and restart.
- 12 bilingual browser checks: default Chinese, persistent English, live held-key release, unchanged paused full game/scene/access/Agent history, source traceability, no reload, narrow Chinese layout and no page errors. Entry/HUD/help/locked room/Agent inspection captured in both languages.
- 6 full-App fault checks described above. The deliberately mixed provenance is synthetic test input, not proof of a live GitHub/Agent integration.
- Main's seven JSON fixtures, cross-reference/experience-proposal checks and eight Skill metadata checks pass. Schema checks do not establish a second playable world.

Windows clean-source reproduction uses `git archive` of `4d45bd4` into ignored `output/clean-checkout/hero-4d45bd4` (no `.git`, no pre-existing node_modules), then `npm ci`, `npm test`, `npm run build`. It creates no new Git worktree/branch and avoids locking dependencies in active peer worktrees. The exact command output and React dependency tree are in `clean-install.txt` / `clean-react-tree.json`; the archive's built app is separately exercised at localhost:5176. No global dependencies or persistent account permissions are installed.

The clean archive's production browser also passes the22 gameplay and12 locale checks. Its raw six-second post-run sample is144.2FPS, P957.2ms, worst7.4ms; rolling session worst62.8ms. This is a post-run/overview sample, not a new combat-performance benchmark. The first-wave production combat measurement remains separately labeled. A subsequent integration fix lets Tab/Escape reach dialog focus handling; a root Vitest include/exclude boundary prevents source archives inside output/ from being accidentally discovered as duplicate tests.

## Limits and supervisor gate

HERO has no remaining known technical blocker for review. **Unified #12 acceptance still requires** supervisor review/merge of #9, WIZARD's stacked #7 adopting the shared catalogue/host seam and retargeting after #9, BUILDER's two actual project imports and SCOUT's public read-only bridge/source panel in one user-facing host. The real public source event → final main UI path, chat/DEMO requests/approvals, combined fresh setup, and human acceptance are not established by these HERO-only tests. Do not infer those from peer reports or this synthetic harness. No private Crew or actual Agent inference/command was invoked.

One-machine performance is not low-end/mobile acceptance. The raw regression sample and worst hitches are recorded in JSON; startup/cold network and all-browser acceptance remain open. The upstream Three.Clock deprecation and large lazy Rapier/WASM chunk remain. No arbitrary-angle camera, touch combat, persistence, audio or second pack was added.

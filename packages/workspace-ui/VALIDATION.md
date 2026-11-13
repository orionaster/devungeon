# S4 workspace evidence · 2026-11-13

The workspace is integrated into the **actual product App** and a separate 3D SCOUT observation entry. The real AI command execution acceptance item in Issue #4 is still open.

## Executed locally

- Windows / Node 24.13.1 / npm 11.8.0; React 19.3.1 and Vite 8.3.8. The package uses TypeScript 5.9.3; the inherited HERO root uses TypeScript 7.0.2. Root npm workspace/lockfile is canonical and React/React DOM are deduplicated.
- `npm test --workspace @devungeon/workspace-ui`: **38 tests passed**. Scope/authority/capability denials, immutable one-time approval, expiry/revocation/disconnect/replay, concurrent ID conflicts, bounded observation with unknown remote outcomes, controller lifetime without a panel, safe evidence links, malformed/older projections, SCOUT cursor/epoch/provenance, authoritative STALE, mixed actor provenance and 4,000-character input/approval scope.
- Root `npm test`: **7 inherited engine tests passed**, including swept collision, locked-room access, victory/defeat/restart source isolation and event projection. This is not a claim that the original S1 browser report was rerun unchanged against the new App.
- Root `npm run build` and package `npm run build --workspace @devungeon/workspace-ui`: strict type checks and real production builds passed. The package loads game code lazily: base entry about **395 kB JS / 122 kB gzip**, shared 3D scene about **952 kB / 253 kB gzip**, Rapier about **4,333 kB / 1,669 kB gzip**. Primary App about **1,350 kB / 376 kB gzip**, plus the same Rapier chunk. The physics/runtime chunk-size warning remains visible. These are complete entry bundles, not the component's marginal size.
- Actual Chrome at 1440×960, DPR 1, plus emulated 390×844: the original 2D interactions, rendered **3D sprite click**, actual movement/proximity/E, conversation, dispatch continuing after close, Escape restoring focus/movement, modal keyboard isolation, local combat pause while work executes, **player death and restart leaving approval pending**, and the actual primary App entry.
- **13 browser scenarios passed** with the real SCOUT checks explicitly enabled. Default runs skip the two checks requiring that actual service. Source tests use the reviewed public-Devungeon `observe-git.ts` instrument: bounded real `git rev-parse HEAD` metadata → SCOUT adapter/journal → SSE → actual 3D source character → workspace original time/commit evidence. They do not run a provider model. Sending remains disabled for SCOUT.
- First integrated Linux CI completed the 3D host checks but the full primary-App flow hit Playwright's default 30-second test deadline at its final task-tab click. The primary case now uses the same 65-second window as the other complete 3D flows, preserving every assertion. CI uploads failure screenshots/context/trace for diagnosis. A Windows pass alone is not cross-platform proof.
- The 3D SCOUT character uses the actual source `agent_id`. Its skin/position are explicit placement in a **DEMO forge**, with undeclared roles/task completion shown as unknown. Project-only GitHub records do not manufacture Agents. REPLAY never enters work-animation projection; disconnect and authoritative STALE immediately disable scene activity. Game controls and work state remain separate.
- `npm run preflight:codex --workspace @devungeon/workspace-ui`: local CLI **0.167.0-alpha.4.1** accepted initialization and `permissionProfile/list`; `:read-only` is allowed. The allowlisted probe sent **zero inference requests**, no thread/start and no turn/start. It prints profile IDs/allowed flags only, not account details or credentials. This is readiness, not real chat execution.
- Independent static AI review found no remaining critical authorization, source-truth or game/work isolation issue in this integration. This is not human acceptance.
- `npm audit --json`: **0 reported advisories**. `node scripts/dependency-licenses.mjs` reviewed **105 installed manifests** against the license allowlist and regenerated the exact manifest report/third-party notices. Runtime/build licenses and source pointers are in `docs/HERO_LICENSES.json`; the local builds include `THIRD_PARTY_NOTICES.txt`. No third-party art/font/audio was imported by S4.
- Core color-token contrast calculations: body 13.63:1, muted text 6.59:1, primary button 7.92:1, approval text 7.72:1. These token checks and keyboard tests do not constitute a complete accessibility certification.

## Browser artifacts

| Artifact                                                                       | Observed result                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [primary-game-workspace.png](output/playwright/primary-game-workspace.png)     | Actual `apps/web/src/App.tsx` NPC → conversation → same game run                                 |
| [hero-workspace-chat.png](output/playwright/hero-workspace-chat.png)           | 3D approach/E, gated game input, explicit DEMO chat                                              |
| [hero-workspace-npc.png](output/playwright/hero-workspace-npc.png)             | Actual rendered sprite click opens matching Agent inspector                                      |
| [hero-workspace-death.png](output/playwright/hero-workspace-death.png)         | Real game death while pending work approval remains unresolved                                   |
| [hero-workspace-approval.png](output/playwright/hero-workspace-approval.png)   | Approval still pending after death/restart; only explicit decision can resolve it                |
| [hero-scout-real-readonly.png](output/playwright/hero-scout-real-readonly.png) | Fresh real tool metadata in the 3D observation room, original commit evidence, commands disabled |
| [command-hall.png](output/playwright/command-hall.png)                         | Lightweight independent 2D DEMO host                                                             |
| [workspace-events.png](output/playwright/workspace-events.png)                 | Original event times/source refs and dispatch result                                             |
| [workspace-mobile.png](output/playwright/workspace-mobile.png)                 | 390×844 responsive sheet with reduced motion                                                     |
| [workspace-approval.png](output/playwright/workspace-approval.png)             | Exact command/project/Agent/content and one-time DEMO approval                                   |
| [scout-real-readonly.png](output/playwright/scout-real-readonly.png)           | Lightweight real-source historical inspection                                                    |

Screens contain synthetic data or public Devungeon metadata only. Original code-native 2D glyphs are in `src/PixelAgent.tsx` / `demo/CommandHall.tsx`; 3D art/renderer/physics are reused from committed HERO `4510207`, with its recorded Apache-2.0 artwork provenance. No copied game assets/UI/music. Screenshots were visually opened and inspected. All gameplay and UI automation was agent-driven; no human playtest or user research is claimed.

## Open acceptance items

- SCOUT is **observe-only**. Real instruction → Agent acknowledgement → execution → events → independent result verification is **not implemented**. A permitted profile is not an authenticated, functioning provider control channel. No production approval/authentication handler is claimed, and no real provider quota was consumed by the preflight.
- A provider choice and explicitly scoped account usage are needed before real chat/command validation. Existing Codex/Claude installations were detected without reading or publishing credentials. Browser code never receives provider keys.
- Demo history is memory-only and resets on reload. No durable command outbox, provider reconciliation or persistent approval audit is shipped.
- Main has not been merged and no public deployment has been performed. This feature is stacked on HERO PR #9 for supervisor review; completion of code or CI does not approve the product or close Issue #4.
- Physical mobile/Safari acceptance, human gameplay, broad accessibility certification and performance on this combined build remain unverified. The inherited HERO FPS report refers to its own S1 revision, not this integration.

Reproduce through README. Optional real-source tests require the explicit running SCOUT service and metadata file; no mock is silently substituted. Other tests and the primary game run without a provider account or SCOUT service.

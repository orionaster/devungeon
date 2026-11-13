# S4 workspace evidence · 2026-11-13

This is the first independently usable workspace slice for Issue #4, not complete real Agent command acceptance.

## Executed locally

- Windows / Node 24.13.1 / npm 11.8.0; React 19.3.1, Vite 8.3.8, TypeScript 5.9.3.
- `npm test`: **37 tests passed**. Covers runtime input validation, project/requester/Agent/task scopes, denied execution, immutable one-time approvals, expiry/revocation/disconnect/replay, duplicate IDs and mutated concurrent retries, bounded observation with unknown remote outcomes, work lifetime without panel subscribers, safe links, invalid/older projections, SCOUT provenance/cursors/epoch changes, authoritative STALE and mixed DEMO/replay/live actors.
- `npm run build`: strict type check + real Vite production build passed. Measured standalone demo bundle: about **391 kB JS / 120 kB gzip**, **13.3 kB CSS / 3.6 kB gzip**. This includes React, Radix, Zod, the demo and observer; not a measurement of the export-only component or the full game.
- Actual Chrome browser at 1440×960, DPR 1, and emulated 390×844 viewport: select roles, chat, background dispatch while inspector is closed, task/evidence inspection, approval denial and approval, unsupported operations, disconnected/stale UI, keyboard approach+E, Escape/focus, separate role drafts, reduced motion and narrow-sheet bounds.
- **8 browser scenarios passed** in the explicitly enabled SCOUT run; the default final independent run passed 7 and skipped the optional SCOUT check. The real bridge's public Git/metadata events arrived via SSE and appeared with original source/time and a GitHub commit link. Historical records were labeled REPLAY/STALE. Sending was disabled. No real model request, external command, production mutation or account authorization was exercised. Later bridge shutdown visibly became “未连接” while history remained available.
- Manual headed Playwright CLI interaction separately selected the supervisor, sent a message, inspected the receipt and observed SCOUT's disconnected history. Screenshots were visually opened and reviewed. This was agent-driven interaction, not a human playtest.
- `npm audit --json`: **0 reported advisories** at the recorded check. This is package advisory coverage, not a full security audit.
- Lockfile license inventory (including root and optional platform packages): MIT 84; Apache-2.0 7; MPL-2.0 12; BSD-3-Clause 1; ISC 1; 0BSD 1. MPL entries are unmodified Lightning CSS build tooling/platform binaries; they are not bundled into the browser runtime. Installed upstream license files remain intact. No third-party art/font/audio was imported.

## Screenshots

| Artifact                                                             | Observed result                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [command-hall.png](output/playwright/command-hall.png)               | Independent 2D DEMO interaction host, three selectable roles      |
| [workspace-chat.png](output/playwright/workspace-chat.png)           | Same world remains visible, explicit simulated response           |
| [workspace-events.png](output/playwright/workspace-events.png)       | Dispatch receipt, source refs, original event times               |
| [workspace-approval.png](output/playwright/workspace-approval.png)   | Specific project/Agent/action/content, one-time approval          |
| [workspace-mobile.png](output/playwright/workspace-mobile.png)       | 390×844 responsive inspection, reduced motion                     |
| [scout-real-readonly.png](output/playwright/scout-real-readonly.png) | Real-source historical metadata/commit evidence, sending disabled |

Screens contain synthetic data or public Devungeon metadata only. Pixel glyphs and room drawing are original code-native integer rect grids under the repository Apache-2.0 license; source: `src/PixelAgent.tsx` and `demo/CommandHall.tsx`. No imported asset archive or copied game sprite/UI/music. Screenshots are UI artifacts, not evidence of a playable 3D game.

## Open acceptance items

- HERO's real 3D scene must be integrated and independently retested through NPC click/proximity, focus/input gating, leaving/returning, combat pause/win/death isolation. The matching-ID helper and snippet are supplied; this branch does not edit HERO's app.
- SCOUT is observe-only. **Real instruction → acknowledgement → execution → events → independent result verification is not implemented.** No production approval handler is claimed. Issue #4 remains open.
- Demo history is memory-only and resets on reload. No durable command outbox, provider timeout/reconciliation protocol or persistent approval audit is shipped.
- Browser inspection on this Windows machine and simulated viewport sizes are not physical mobile/Safari acceptance. Keyboard manual checks and automation are not user research or a human game playtest.
- No 3D rendering, combat, camera/FPS/device performance claim is made for this UI-only package. The HERO game owns those checks.
- Future live command adapters must authenticate and recheck the complete policy server-side; this package's controller cannot protect an executor that trusts browser claims.

Reproduce with the commands in README. The optional SCOUT integration check requires its actual running bridge and is skipped by default; all other checks run independently.

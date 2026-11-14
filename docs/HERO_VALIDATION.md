# HERO S1 validation · 2026-11-13

## Reproduce

From `C:\Devungeon\hero` on `feat/s1-hero-game` (Node22.12+; measured with24.13.1/npm11.8.0):

```powershell
npm ci
npm run dev
# http://127.0.0.1:5173
```

WASD/arrows move relative to camera; J auto-aims at a nearby enemy; hold left-click to aim/strike; Space dodges with brief invulnerability; Q/R quarter-turn; wheel or +/− zoom; right-drag pans; F overview; C follow; E inspects nearby companions; P pauses combat; Escape closes panels/pauses. The full controls/settings panel is available in the header. The game is silent; no audio resources are bundled.

```powershell
npm test
npm run build
npm run preview -- --port 5174
# In a second terminal, real headed Chromium browser:
npx --no-install playwright-cli -s=hero-proof open http://127.0.0.1:5174 --headed
npx --no-install playwright-cli -s=hero-proof run-code --filename apps/web/scripts/browser-acceptance.js
npx --no-install playwright-cli -s=hero-proof run-code --filename apps/web/scripts/browser-performance.js
npx --no-install playwright-cli -s=hero-proof run-code --filename apps/web/scripts/browser-inputs.js
```

If the local Chromium runtime is absent, use the pinned CLI's `install-browser chromium`. No account is needed. Use a fresh dedicated session when measuring performance; a session left after a failed video-capture setup yielded a throttled/incomplete sample and was discarded. No performance conclusion uses that sample. PNG evidence is the deliverable; video capture could not be completed with the available FFmpeg runtime.

## What actually ran

- Seven Node/tsx tests exercise swept locks after1,200 repeated moves and1,200 corner/dash attempts, safe restart, actual attack/kill and enemy defeat, game/source separation, invalid spawn/blueprint rejection, immutable scene ownership, sub-tile geometry rejection, event validation/de-duplication/order/staleness/memory bounds. All passed.
- `npm run build` passes TypeScript and Vite production build. `npm audit` reports zero known vulnerabilities for this lockfile at the recorded time; this is not an exhaustive security audit.
- A clean `npm ci` completed after stopping the local Vite processes (Windows locks the native Rolldown module while a server is running). The documented install → test → production build path passed. Stop local servers before reinstalling on Windows.
- Python's five bundled JSON examples, cross-reference checks and seven Skill metadata checks pass. These still prove schemas only.
- The browser acceptance script performs21 actual-input checks: enter, move through doorway, take damage, short-tap dodge, fight all four enemies and win, claim game reward, four camera-relative headings, walk/dodge/corner against the seal, preview without teleport, pause game while DEMO events continue, suppress attack during inspection, die, preserve source access on win/lose, restart at safe spawn, narrow UI without horizontal overflow. Detailed output is `output/playwright/acceptance.json`.
- A focused production input check also passed: a quick mouse click produces exactly one attack; nearby E opens Moss's inspector; Escape restores canvas focus; zoom/right-drag/follow controls work. A deliberate 600ms main-thread stall was recorded as602.4ms by the visible-frame counter. This synthetic counter test is separate from normal performance evidence; see `output/playwright/input-checks.json`.
- Initial play found missed quick Space taps and tile-raster door clipping; both were fixed. Independent review found a missing cold-start default, mutable-scene respawn bypass, unsupported sub-tile geometry and omitted ≥500ms hitches. These were fixed; immutable/grid/event checks added. Physics is now lazy-loaded and a2.5s deliberately delayed physics-chunk browser test passes with no page errors. This delay is fault injection, not a measured network startup claim.

## Environment and measured limits

Windows11 Home10.0.26200; Intel Core Ultra7 255H (16 logical processors); approximately32GB RAM; integrated Intel Arc140T, driver32.0.101.8132. Headed Chromium157.0.8103.78, viewport1440×960, physical DPR approximately1, WebGL ANGLE/D3D11; renderer DPR0.75. This is one real desktop with an integrated GPU, not proof of low-end/mobile performance.

The production6s sample includes walking into the encounter,13 attacks,165 damage dealt,3 kills,2 received hits and hostile projectiles. Raw rAF average141.3FPS, P957.1ms, worst83.3ms,51 draw calls and approximately6,620 triangles. Rolling session worst87.4ms. An earlier idle/overview sample averaged144.2FPS; it is separately labeled in the raw acceptance output. High average FPS does not mean no hitches. Measurements are refresh-rate limited and not a cross-device benchmark.

The renderer now records every positive visible-page frame interval, including ≥500ms. Hidden-page intervals are excluded; gameplay frame catch-up is capped separately. A production bundle warning remains: main JS approximately1.19MB raw/328KB gzip and the lazy Rapier compatibility/WASM chunk approximately4.33MB raw/1.67MB gzip. Network-throttled loading has not been accepted. One upstream `THREE.Clock` deprecation warning occurs with R3F9.8.2/Three0.187.0; no runtime page errors were observed in the passing browser tests.

## Visual evidence / remaining scope

PNG captures under `output/playwright/` are actual browser output, not mockups: entry, combat, victory, four headings, sealed-vault preview, Agent inspector, defeat and narrow layout. Nearest16px source textures and consistent actor scale were visually inspected; lower outer walls intentionally preserve readability at each heading while their physical blockers remain tall. All source sprites/tiles are original Apache2 contributions, not copied game media. System fonts only.

This delivers one handcrafted playable desktop encounter and synthetic Agent playback. It does not establish human fun/usability acceptance, real Agent operations, real project import, persistent saves, mobile/touch combat, Safari/Firefox compatibility, arbitrary camera rotation, audio, production hosting or V1 completion. No real project acceptance state exists in this demo to alter. The separate imported-scene adapter and workbench contracts are documented, but peer branches are not merged here. Supervisor review/merge is still required.

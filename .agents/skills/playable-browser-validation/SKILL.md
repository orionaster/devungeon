---
name: playable-browser-validation
description: Use when implementing or verifying Devungeon player controls, combat, collisions, camera, HUD or demos. Requires real browser gameplay evidence, not only unit tests or a promotional video.
---
# Playable Browser Validation

Read docs/ACCEPTANCE.md, docs/VISUAL_DIRECTION.md and the current gameplay Issue.

## Execute and verify
- Start from a clean checkout with documented commands. If there is no runnable app, report NOT IMPLEMENTED, never fake browser evidence.
- In a real browser play: spawn, move, rotate camera, attack, dodge, take damage, defeat an enemy, finish/restart an encounter; note actual controls.
- Attempt to enter a locked or unaccepted room using walking, dodging, camera tricks, respawn, collision corners and known teleport paths. Camera preview is allowed; player entry is not.
- While playing, feed a **clearly DEMO-labeled** synthetic Agent event and confirm it animates independently of game HP or quest victory. Verify win/lose has no project acceptance mutation.
- Capture screenshots/trace and the device, browser, viewport, DPR, average FPS, worst hitch and observed limitations. Use Playwright for repeatable actions; supplement with an actual hands-on game session.
- Prefer Vitest for logic, fast-check for invariants, Playwright traces/screenshots for regression. Compare pixel-art snapshots in a fixed environment.

## Done is
A human can truly play, combat works, locks hold, agent events animate truthfully, and a reviewer can reproduce the evidence. "CI green" alone is not done.

Reference: https://playwright.dev/docs/trace-viewer

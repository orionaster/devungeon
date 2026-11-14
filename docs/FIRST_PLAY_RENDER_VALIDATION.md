# First Play rendering and physical interaction evidence

Executed 2026-11-14 on Windows, Node 24.13.1, headed Chrome 157.0.8103.78,
1440×960 viewport, DPR 1, Intel Arc 140T through ANGLE/D3D11. This is trusted
automated browser input and Agent visual inspection, not product-owner approval.

## Changes verified

- A single damped camera anchor supplies both camera position and focus. Walking
  cannot change pitch/yaw. Heading changes use the shortest quarter-turn arc;
  camera damping is bounded after a long browser frame.
- Renderer-only interpolation removes the 60 Hz actor-position staircase while
  exact game snapshots, access, source facts and command state remain separate.
- Sprites keep a stable ground pivot; walking does not translate the entire
  sprite vertically. Alpha-tested pixels write depth for coherent occlusion.
- NPC and decorative chest placement share deterministic occupied ground slots.
  NPCs and authored station props have matching solid game footprints.
- Optional sample artwork/animation ports leave generated maps on their existing
  art. Typed sample tasks orient the DEMO guide toward the relevant station;
  scanning and testing have different bounded effects. Local public reads do not
  animate an NPC as though it were a real AI task.
- Practice enemies can use an explicit activation radius (sample 3.2 units,
  existing default 14), keeping the first project-reading area calm.

## Executed results

`npm run test:engine`: **13/13 passed**, including wall/locked-room sweeps,
combat, death/restart and four new regression cases for furniture/NPC collision,
deterministic placement, interpolation and practice activation. Root integration
suite: **18/18 passed** at the intermediate shared worktree state. TypeScript and
formatting passed after marker projection was added.

`scripts/first-play-render.mjs`: **15/15 actual browser checks passed** against a
separate production snapshot served on loopback port 5197, avoiding development
reloads during play. Evidence is in
`output/playwright/first-play-render-stable/`:

| Interaction | Actual observation |
| --- | --- |
| Start | Visible Start button enters follow camera |
| Movement + attack + dodge | 241 rendered-frame measurements; maximum camera quaternion change **0**, maximum camera-to-focus offset change **0** |
| West wall, four headings | Walking/dodging stops at x≈**−6.5949**, captured at 0/90/180/270° |
| Real corridor traversal + combat | One slime defeated, **55 damage**, player **100 HP**, sealed corridor reached |
| Sealed corridor, four headings | Repeated walking/dodging stops at x≈**7.5949**; annex remains inaccessible |
| Source desk | Walking/dodging stops at z≈**−1.2049** |
| Partner | Walking/dodging stops at z≈**−1.2849**, separate physical ground positions |

The folder contains spawn, wall, corridor and contact PNGs, `report.json`, a
17.25 MB WebM recording and a 139 KB trace. The report retains raw rendered
camera/focus/player/screen-coordinate samples. The final NPC-contact segment
measured **59.15 FPS**, **17.7 ms p95**, **55.7 ms worst frame**, 137 sampled
frames, 176 draw calls and 2244 triangles. Metrics reset with page reload; these
are segment measurements, not a whole-session average or low-end hardware claim.

An earlier development run passed 8/8 camera/wall checks: 275 rendered samples,
zero quaternion/offset change, 140.87 FPS mean, 8.9 ms p95 and 324.2 ms worst
frame including startup/hitches. Its evidence is in
`output/playwright/first-play-render/`; it is superseded by the broader run.

## Reproduction and limitations

Start the normal local application, then in PowerShell:

```powershell
$env:FIRST_PLAY_URL = 'http://127.0.0.1:5193'
$env:FIRST_PLAY_RENDER_OUTPUT = 'output/playwright/first-play-render-final'
node scripts/first-play-render.mjs
```

Use a production preview while other agents edit the development app. The script
uses WASD, J, Space and R through actual browser keyboard input. All diagnostic
ports are read-only; no teleports, health setters or access overrides are used.
Video capture initially failed because Playwright's FFmpeg helper was absent;
`npx playwright install ffmpeg` downloaded its 1.6 MiB local cache helper, after
which both real runs completed. No dependency manifest changed for that helper.

Two additional CLI play attempts during concurrent edits were interrupted by
development reloads and returned to the ready screen; they are not combat proof.
The separate production run above supplied the successful combat/corridor proof.

The production snapshot predates the final floor/gate/label art review. Its
physical and camera results are valid for the implemented engine changes, but
**final artwork needs a fresh capture after that review**. Public-source
connectivity, permissions, locale invariance, complete encounter victory/death,
all generated-map routes, physical mobile, other browsers and independent human
playtesting are outside this focused rendering run. Other integration checks
must cover them. Natural sprite occlusion when standing in front of a partner is
visible in `footprint-agent.png`; occupied ground positions do not overlap.

The renderer exposes read-only projected marker positions for accessible labels;
that last marker-only change passed TypeScript/formatting and is not present in
the earlier production video. No global art rollout, provider/model execution,
private data, deployment or source acceptance change occurred.

## Follow-up: sample partner contact clearance

Independent visual review found that the physically valid 0.715-unit contact
distance still hid too much of Moss's body. A subsequent sample-only change adds
`SceneAgent.clearanceRadius`, validated from 0.25 to 1.5 units. Moss explicitly
uses **0.9**; all existing/generated NPCs retain the original **0.42** default.
The same declared radius drives deterministic occupancy and physics. The full
browser harness now derives its expected contact position from that declaration.

Engine regressions are now **14/14 passed**, and TypeScript passed. Fresh headed
Chrome input (walk north, then dodge north) stopped the player at
`(-1, -0.8049001290)` beside Moss at `(-1, -2)`, giving **1.195099871 units** of
center separation, including the player's 0.28 radius and controller skin. HP
remained 100. New 1440×960/DPR≈1 captures are
`output/playwright/sample-contact-clearance-1440-{0,90,180,270}.png`, with a short
`sample-contact-clearance-1440.webm` recording. Moss's body is visible above the
player at front contact; normal front/back occlusion and the floating HTML label
remain subject to the root Agent's independent visual review. No global NPC
route, sprite scale or UI change was made for this follow-up.

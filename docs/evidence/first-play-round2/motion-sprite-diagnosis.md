# Narrow animation / Moss diagnosis — second playtest

All source atlases remain byte-for-byte unchanged; no packages, model calls, speed/acceleration/collision/camera lifetime, NPC position or level composition changed.

## Confirmed causes and correction

- **Wrong native directional indexing.** The unchanged NinjaGreen/Inspector PNGs use down/up/left/right columns. Existing first-play code mapped front/left/back/right, interchanging north and west. The sample skin now indexes the actual sheet; legacy map rendering remains unchanged.
- **Unstable motion phase / direction.** Previous walk frames used the global dungeon clock, and sprite facing used combat auto-aim even during locomotion. Walk phase now follows actual travelled distance, retains leg phase through brief stops/turns, settles when blocked, uses actual travel for locomotion and authoritative aim/timers for attacks and rolls. Rest/recovery time begins with its state. Diagonal deadband prevents frame-to-frame directional chatter; presentation follows actual smoothed camera direction. None of these calculations mutate simulation or work state.
- **Hero action pixels were clipped.** Old32×24 runtime crop omitted68 nontransparent pixels across native attack frames and41 across death frames. Full32×32 source frames now preserve these pixels, with original pixel scale and native row24 foot baseline via sprite anchor. The existing three-row roll is played once without wrapping into a spurious fourth phase. Sample dodge no longer adds an extra vertical jump above the authored roll.
- **First-use blank frames.** Newly selected crop CanvasTextures previously awaited a resolved Promise callback even after PNG preload; current R3F rendering could upload blank canvas for one frame. A loaded-image cache now draws synchronously before render, retaining the same safe asynchronous loading/error fallback for assets not yet loaded.
- **Moss half-body symptom is DOM occlusion.** Native Inspector idle/attack are64×16 and walk64×64, every complete16×16 cell includes bottom-row body/feet. Before screenshots at270 show floating labels hiding the body; a separately labelled diagnostic screenshot with ONLY label visibility hidden reveals the complete unchanged sprite. Root removes that DOM layer permanently. Moss retains native16×16 crop, scale1.1, foot anchor0, original position and depth testing. No forced-front rendering, fake overdraw, or layout workaround.

## Evidence already executed

-7 meaningful pure presentation tests PASS; TypeScript project+bridge checks PASS.
- Source dimensions, frame alpha bounds, SHA256 and former24px omitted-pixel counts: atlas-coverage.json (read-only inspection).
- Real headed Chrome,1440×960 DPR1 before matrix: moss-before/{idle,scan,test}-{0,90,180,270}.png + native video/observations.
- Diagnostic ONLY (not after acceptance): moss-before/diagnostic-270-labels.png / diagnostic-270-labels-hidden.png.

## Pending runtime verification at writing

Final production movement and low-budget recordings are owned by parent. Final real4heading×3state Moss overview/front/behind contact matrix will follow once parent finishes to avoid competing foreground browser/GPU activity. Automated frame-phase checks and before screenshots do not establish final subjective fluidity or independent product-owner approval.

## Final Moss runtime result

2026-11-14, real Windows headed Google Chrome 157.0.8103.78, Node v24.13.1, 1440×960, DPR1, local production5194. Native video and read-only receipts retained.

- Valid after coverage: 12 overview +12 front contact images in moss-after, plus12 corrected rear contact images in moss-after-behind-corrected. Every group covers idle / active DEMO scan / active DEMO test at0/90/180/270. Active tasks and DEMO mode are verified for each screenshot; no floating DOM labels, no uncaught browser errors.
- Rear-corrected run:51 assertions passed. All12 rear screenshots stayed at distance1.195101 from Moss, same actual stationary rear-edge position. Subsequent20-sample keyboard dodge sweep stayed outside1.195 and recorded blocked movement. No runtime setters or injected styles.
- Visual review: all36 valid crops were viewed in three labelled contact sheets, supplemented by full screenshots. Moss has full native hat, torso and feet in every heading/state. At close contact, edges meet and the foreground sprite can naturally cover the background player's feet; no Moss half-body cropping/covering was seen. No force-front rendering was introduced.
- Verification mistake corrected: initial rear dodge legitimately slid around the circular footprint, so its subsequent12 screenshots were away from contact. Those files/video remain preserved and are explicitly marked insufficient in moss-after/observations.json verification_correction. The rear view was recaptured from stationary contact with a per-screenshot distance check; dodge occurs after this matrix. The old113 historical passes must not be described as full rear-contact acceptance.
- Reproducible script: scripts/first-play-moss.mjs. FIRST_PLAY_URL and FIRST_PLAY_OUTPUT select local server/evidence output; FIRST_PLAY_MOSS_VANTAGE=behind-contact runs the independently executed corrected rear coverage. The default combined script includes the corrected per-image checks but has not been rerun as a single combined invocation after this validation correction.

Subjective movement/art approval remains the product owner's decision after actual final normal/low-budget videos. Browser/test evidence establishes the described interactions and visual checks, not owner acceptance.

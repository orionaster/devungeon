# Devungeon — acceptance checklist (not yet executed)

## A. Game is truly playable

- [ ] The user can start a run, move their character, dodge, attack, hit and be hit, finish a dungeon encounter and see a result.
- [ ] The player can rotate/zoom camera and inspect locked rooms but cannot enter them through game controls or collision exploits.
- [ ] A low-end mode or fallback view preserves essential task evidence.
- [ ] Background Agent status continues to update while the player fights (or clearly says disconnected).

## B. Project representations are accurate

- [ ] Two structurally different projects create different rooms / zone dependency graphs.
- [ ] Identical input and layout seed reproduce the same world shape within one generator version.
- [ ] Adding one project feature changes only affected rooms and connections; others keep stable IDs and locations.
- [ ] An Issue close / PR merge / green CI alone cannot override separately required acceptance checks.
- [ ] Review, accepted, blocked and regressed states are visually distinct and evidence-linked.
- [ ] Unknown facts are shown as unknown, not invented.

## C. Agent controls work end to end

- [ ] At least one real supervisor/worker Agent connector emits observable, attributable events.
- [ ] Clicking an Agent shows task, status, last seen time and source evidence.
- [ ] User can send a real supported instruction and see acknowledged result, errors and eventual completion.
- [ ] Capability-denied, unconnected, malformed and risky operations do not silently execute.
- [ ] The frontend never receives secrets; per-project scopes and user approvals are enforced.

## D. Real work and game stay isolated

- [ ] Winning a battle never changes the accepted status of any real feature.
- [ ] User-game failures never cancel or roll back real tasks.
- [ ] Synthetic events are clearly labeled `DEMO` throughout scenes, panels and screenshots.
- [ ] Replay is clearly separate from live, even if the event stream looks identical.

## E. Open source and public release

- [ ] Launch steps are reproducible from a fresh checkout.
- [ ] Security/privacy checklist passes; no user private content or credentials in examples or screenshots.
- [ ] Code/art/sound licenses are documented and compatible.
- [ ] At least three new users can open and understand the game without author guidance.
- [ ] Capture a 30–60 second demo that honestly distinguishes actual integrations from sample data.

## F. First-world-pack original pixel-dungeon visual acceptance (2026-11-13)

- [ ] Real browser build has a coherent **original 2.5D pixel dungeon** look: crisp non-blurred sprites/tiles, responsive action, and no copied Soul Knight sprites/UI/audio/levels.
- [ ] True 3D room geometry and collisions exist despite the pixel-art appearance; camera quarter-turns preserve sprite facing, movement and wall occlusion.
- [ ] Camera can inspect a locked room without the player crossing its door; DEMO/REPLAY/LIVE labels remain readable even with pixel rendering.
- [ ] Tested frame captures at a fixed viewport/DPR and real device performance logs are attached. Bright particles do not hide gameplay or task labels.
- [ ] Imported sprites, fonts, music and FX have verified license provenance and legal redistribution rights, recorded in docs/ASSET_PROVENANCE.md.

**Current state:** None of the runtime acceptance items are claimed to have passed. This repository starter includes design/schema, a reviewed tool shortlist and Agent Skills only.


## G. Bilingual Chinese-first product UX (2026-11-13)

- [ ] Fresh browser startup defaults to readable Simplified Chinese; 中文 / English switch exists before and during gameplay.
- [ ] All first-party game, world and Agent workspace UI covers both zh-CN and en-US with translation-key parity tests and clear fallback behavior.
- [ ] Toggle live during player movement/combat and Agent interactions without reload, lost state or unauthorized task/approval action.
- [ ] Room/Agent/project original IDs, geometry seeds, status and source evidence are unchanged by locale selection.
- [ ] Raw external code, logs, issues and Agent messages preserve provenance; any Chinese explanation cannot invent acceptance.
- [ ] Full real-browser captures of entry, combat, locked-room, Agent chat and approval/error states in both languages; Chinese font/line-wrap/keyboard accessibility checked.
- [ ] No third-party translation upload, new paid translation dependencies or private data flow without specific authorization.

Trace: docs/I18N.md and Issue #10. Registration of this requirement is not implementation.


## H. Project-adaptive worlds and distinct game modes (ADR-0002)

- [ ] Given project purpose, style and structure signals, Designer provides explained, evidence-aware recommendations and marks unsupported packs honestly.
- [ ] User can preview and explicitly override suggested world. zh-CN/en-US switching, program language or a single repository keyword alone never changes world type.
- [ ] Same ProjectSnapshot can be explored in the first original pixel dungeon **and one genuinely different, implemented world mode** (e.g. build/explore city rather than a different dungeon skin).
- [ ] Switching modes preserves source IDs, evidence, accepted/blocked state, original Agent events, approvals and permissions; game-only saves are separate with explicit compatibility warning.
- [ ] Both modes display missing/unaccepted functionality correctly and enable live/stale/replay/demo Agent presentations with truthful provenance.
- [ ] Unavailable or invalid pack falls back to factual graph/text view rather than rendering pretend gameplay.
- [ ] Actual browser captures, controls and separate game-loop tests demonstrate the second mode; synthetic JSON fixtures alone are not proof.
- [ ] Third-party assets/plugins have verified license, origin and permissions; no untrusted AI-generated code is auto-executed.

Trace docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md and schema/world-experience.schema.json. This is a future acceptance target, not a claim of implementation.

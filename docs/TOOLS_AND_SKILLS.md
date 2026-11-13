# Devungeon — Tools & Skills Due Diligence

**Research baseline:** 2026-11-13. **Status:** evaluated and selected candidates, **not installed runtime dependencies**. This is a decision record, not a claim that the game or any agent connection is implemented.

## Scope, decision rule and stop condition

Goal: build a **project-adaptive world engine**, starting with a fun, playable, original 2.5D pixel-art dungeon pack, while preserving real project truth and truthful Agent operations. ADR-0002 introduces different world forms and gameplay over time; the game stack below is the **first pack's evaluated tooling**, not an enforced universal engine. Choose maintained, well-documented, reasonably lightweight open-source components with compatible licenses. Prefer existing components over custom rendering, physics, asset editors, or observability plumbing, but do **not** depend on a full generic agent framework just to visualize its events.

Before adding package versions to an app: inspect current release, transitive licenses, security advisories, browser/Windows compatibility, maintenance, bundle size, APIs and actual performance. Pin a lockfile with the first executable vertical slice. Research stops once a workable vertical slice has verified dependencies; do not prolong the search indefinitely.

## 1. Web game and 3D rendering

| Candidate | Role / license | Verdict | Trade-off / evidence |
|---|---|---|---|
| [Three.js](https://threejs.org/) | Web 3D / MIT | **SELECT** | Own camera/geometry/texture control; excellent for real 3D room depth with pixel sprites. More game mechanics to build ourselves. |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | React Three renderer / MIT | **SELECT** | Integrates game scene with web workbench and React UI. Use R3F v9 with React 19 when choosing compatible versions. |
| [Drei](https://github.com/pmndrs/drei) | R3F helpers / MIT | **SELECT selectively** | Camera/asset/helpers accelerate implementation; avoid heavy unneeded effects. |
| [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) | Rapier physics integration / MIT | **SELECT** | Reliable player/enemy and locked-door collision. v2 matches R3F v9/React 19 per maintainer docs; physics not required for static decorative tiles. |
| [Phaser](https://phaser.io/) | 2D game engine / MIT | **ALTERNATIVE** | Attractive for strictly top-down 2D pixel combat, but first version requires actual 3D camera / spatial exploration. Revisit if 3D harms gameplay. |
| [PixiJS](https://pixijs.com/) | Fast 2D renderer / MIT | **ALTERNATIVE** | Strong 2D sprites; extra rendering stack would complicate the current R3F workbench. |
| [Godot](https://godotengine.org/) | Full game engine / MIT | **ALTERNATIVE** | Powerful pixel-action tooling; browser export uses WebGL2 Compatibility and has runtime/hosting constraints. Revisit after browser vertical-slice evidence. |

**Compatibility note:** R3F/Rapier peer-version pairs must be verified together. Do not independently install incompatible "latest" versions. No packages have been added to package.json yet because there is no runnable web app to lock and test.

## 2. Pixel-art production and dungeon generation

| Candidate | Role / license | Verdict | Caution |
|---|---|---|---|
| [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) | 16×16 dungeon sprites / CC0 | **PRIMARY STARTER ASSETS** | Genuine primary-source CC0; art provenance entry needed before committing the bytes. Coherent art beats mixing random packs. |
| [Kenney 1-Bit Pack](https://kenney-assets.itch.io/1-bit-pack) | Roguelike sprites / CC0 | **BACKUP / MONO THEME** | Do not mix indiscriminately with full-color 16×16 pack. |
| [OpenGameArt 16×16 Dungeon Tiles](https://opengameart.org/content/16x16-dungeon-tiles) | Extra dungeon sprites / CC0 on listing | **OPTIONAL** | Inspect each individual asset and attribution/rights; don't assume all of OpenGameArt is CC0. |
| [Pixelorama](https://github.com/Orama-Interactive/Pixelorama) | Sprite editor / MIT | **RECOMMENDED AUTHORING TOOL** | Installed separately by artists/agents, not bundled as a runtime dependency. |
| [Piskel](https://github.com/piskelapp/piskel) | Browser sprite editor / Apache-2.0 | **FALLBACK** | Smaller tool and documented limited acceptance of large UX PRs; excellent for quick prototypes. |
| [LDtk](https://ldtk.io/) | Level editor / MIT | **OPTIONAL** | Efficient to hand-author example rooms / export JSON; not a substitute for project-driven world generation. Its official website explicitly excludes isometric 3D authoring. |
| [rot.js](https://github.com/ondras/rot.js) | Roguelike maps, pathfinding, FoV / BSD-3-Clause | **TRIAL FOR TOPOLOGY**, not canonical engine | Mature reusable 2D generators, but randomly regenerating maps conflicts with pinned persistent room positions; evaluate upkeep and consistency via prototype. |
| [Aseprite](https://www.aseprite.org/faq/) | Pixel editor / own EULA | **NOT BUNDLED** | Source visibility does not mean redistributable open source: binaries are restricted; users can separately buy/use it. |
| [itch.io packs marked "free use, no redistribution"](https://reodesuxz.itch.io/free-pixel-dungeon-top-down-tileset-16x16) | Pixel asset packs / custom terms | **DO NOT VENDOR** | May be suitable for an individual's game, but not for redistributing raw assets in an Apache-2.0 open-source repository without explicit permission. |

**Practical workflow:** prototype dungeon topology from a semantic project dependency graph → constrain/validate physical room placement → generate floors/walls/doors from approved prefab/tile definitions → skin with a coherent sprite sheet → use nearest-neighbor texture filtering and controlled camera angles. Only have the AI World Designer propose names, motifs, and placement preferences, never acceptance facts.

## 3. Runtime state and testing

| Candidate | Verdict | Why |
|---|---|---|
| [TypeScript + Vite](https://vite.dev/) + React | **SELECT** | Browser-native iteration, quick feedback, workbench UI. |
| [Zod](https://zod.dev/) | **SELECT** | Validate untrusted project/event/blueprint inputs at boundaries. Keep canonical JSON schema and exported TS types synchronized. |
| [Zustand](https://github.com/pmndrs/zustand) | **SELECT if required** | Small client-side store; keep gameplay and project-truth domains in different stores/actions. |
| Server-Sent Events (SSE) | **SELECT FIRST** | Unidirectional live observation; simple for read-only Agent/project event projection. Use WebSocket only if streaming requirements demand it. |
| [Vitest](https://vitest.dev/) | **SELECT** | Fast unit/schema/game-logic tests; deterministic seeded generator tests. |
| [fast-check](https://fast-check.dev/) | **SELECT FOR GENERATOR TESTS** | Property tests for reachability, non-overlap, stable IDs and seed invariants. |
| [Playwright](https://playwright.dev/) | **SELECT** | Real browser input, screenshots/traces, end-to-end game interactions; **cannot replace actual manual gameplay checks**. |
| SQLite | **DEFER** | Use only after event persistence/replay complexity justifies adding a local database. |
| Cloud telemetry / SaaS | **NOT SELECTED** | Local-first and privacy; no default telemetry, paid service or external upload. |

Pixel rendering must be visually tested at fixed viewport/DPR. Frame rates, startup time, memory and bundle size must be **measured** on the actual build, not assumed from library marketing.

## 4. Agent integrations and existing solutions

| Candidate | Verdict | Scope and boundary |
|---|---|---|
| [GitHub REST/webhooks](https://docs.github.com/en/webhooks/webhook-events-and-payloads) | **SELECT as first real project source** | Repo/Issue/PR/CI facts with IDs and provenance; close/merge/green CI does **not** automatically mean feature accepted. |
| [Claude Code hooks](https://code.claude.com/docs/en/hooks) | **TRIAL opt-in read-only event observer** | Observe permitted local tool/session events, allowlist metadata, redact sensitive content. Do not inject global hooks automatically. |
| [Codex app-server](https://learn.chatgpt.com/docs/app-server) | **FUTURE CONTROL ADAPTER, EXPERIMENTAL** | Rich thread/turn/item events and commands, but transport/control/version behavior needs isolated tests and permission boundaries. |
| [OpenTelemetry GenAI agent conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) | **REFERENCE / OPTIONAL MAPPING** | Standardize trace terms where stable; don't require OTLP collector or cloud tracing for V1. |
| [Agenttrail](https://github.com/sodiumsun/agenttrail) | **REFERENCE / EVALUATE REUSE** (MIT) | Proven local observability ideas; no authorization/command capabilities, acceptance truth or project-to-dungeon compiler. Its Kitchen 3D preview status has changed across versions; verify current upstream before adoption. Do not fork it blindly. |
| [Anthropic community Skills examples](https://github.com/anthropics/skills) | **REFERENCE ONLY** | Examples include scripts and external instructions. Review each file/license; never install an arbitrary skill or MCP that can execute shell/network commands without permission. |

**Start with one read-only source**, normalize IDs, observed timestamps, source refs, demo/live/replay flags and unknown fields. Only then implement explicit command capabilities, scope, audit, human approvals and denial tests. A game attack can never approve a command. Never put provider tokens in the browser or screenshots. Private Crew integration requires separate scoped authorization.

## 5. Skills strategy — version controlled, project-specific

The [Agent Skills specification](https://agentskills.io/specification) uses directories containing SKILL.md with metadata. Codex discovers repository-local skills at .agents/skills; Claude Code discovers .claude/skills. We provide a canonical set of original, instructions-only skills under .agents/skills, plus a Claude Code routing skill that points at those canonical files to **avoid duplicating substantive instructions**.

Canonical skills:
- **pixel-dungeon-visuals** — pixel art, 2.5D rendering and art provenance.
- **playable-browser-validation** — prove a real playable browser slice instead of a static mock.
- **project-world-compiler** — stable project graph, deterministic dungeons and incremental migrations.
- **agent-event-adapters** — truthful event capture, freshness, permissioned controls and safety.
- **dependency-due-diligence** — compare, license-audit and pin tested dependencies.
- **in-world-agent-workspace** — safe status, chat, command, audit and approvals.

These are **newly authored repo skills**, not copies of third-party scripts. No MCP servers, hooks, shell scripts, npm packages or paid SaaS have been installed as part of this decision record.

## 6. Decision matrix and risks

| Requirement | Selected route | Confidence / next proof |
|---|---|---|
| Soul Knight-like **feel** with independently created sprites | R3F 3D geometry + pixel sprites/nearest sampling + Kenney CC0 | **Medium:** actual game screenshot, rotated camera and hit feedback needed |
| Real accessible 3D spatial exploration | Three.js + Rapier | **High fit**, but controls/collisions must be playtested |
| Project-driven map differentiation | semantic dependency graph + custom stable layout; optional rot.js topology | **Medium:** two project fixtures + pinned room invariant |
| Agent work visualization | local bridge + GitHub/Claude observer + typed event protocol | **Medium:** real safe source-to-scene test |
| Real Agent commands | scoped local connector; Codex/Claude implementation as supported | **Unknown until tested**; do not imply available now |
| Community remix/competition | Apache-2.0 code + CC0/approved art + recording-friendly browser | **Good fit**, verify all third-party notices |

### Explicit non-selections

- No 100%-LLM-generated code-per-room geometry.
- No copied Soul Knight assets or exact art.
- No third-party Skill/MCP with shell or account privileges added by default.
- No private Crew files or credentials in this public repo.
- No dependency/version lock or "installed" claim before a running game exercises the selected packages.
- No assumption that observation proves feature acceptance.

## Implementer checklist

1. Read docs/VISUAL_DIRECTION.md and docs/ASSET_PROVENANCE.md.
2. Implement S1 with compatible pinned versions and a lockfile; document exact versions and license notices in the resulting PR.
3. Test pixel-art coherence, collisions, attack/dodge loop, and locked-room camera behavior in a real browser.
4. Demonstrate DEMO event playback in parallel with player movement; label every mock actor/action.
5. In S2 validate distinct levels, seed determinism and non-shuffling incremental update.
6. In S3 build read-only real adapter evidence before any command adapter; no hidden provider login.
7. In S4 test allowed and denied commands, approvals and disconnect behavior with a real authorized source.

**Review cadence:** revisit chosen package versions, licenses and official API semantics at implementation time or on a relevant major release. Record changed decisions; don't continually chase every trending library.


## Project-adaptive experience architecture decision (ADR-0002)

The earlier shortlist remains valid for the **first pixel-dungeon pack** and its current open PRs. Do not automatically install the entire shortlist for every genre. Future world experiences should compare the smallest mature implementation for their actual mechanics (e.g., a city-building renderer, pathfinding/road layout, or a station-navigation package) only when a **concrete second-mode playable slice** is scheduled. Reuse ProjectSnapshot, project ID, Agent event provenance, permissions and localized work panels. Choose independent, versioned and allowlisted world-pack adapters; AI proposals cannot install new code or assets. Cite docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md.

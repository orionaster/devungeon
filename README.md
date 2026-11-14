# Devungeon 🗝️

**Your agents are working. You're playing. Your world is growing.**

Devungeon is an **open-source, project-adaptive playable game world + AI-agent workspace**. The engine aims to interpret a software product's structure and design language, suggest different world forms and game mechanics, and let the creator choose. **Our first working reference is an original 2.5D top-down pixel dungeon**, but other projects need not become dungeons.

> **FORGE integration, awaiting review:** one app combines HERO combat, BUILDER's two project maps, SCOUT's public Devungeon observations and WIZARD's bilingual in-world workspace. Real model chat/commands remain unavailable; synthetic interactions are labeled DEMO. This is the first pixel-dungeon pack, not the complete multi-world V1. See [integration and actual verification](docs/FORGE_INTEGRATION.md).

> **First Play upgrade, awaiting visual review:** this branch starts in the Starlit Observatory, one playable CC0 art sample with stable camera, simpler controls and a traceable public-project feature. The desk reads real public observations; Moss's two task behaviors are DEMO. Wider art rollout awaits owner approval. See [implementation, screenshots/video and actual tests](docs/FIRST_PLAY_UPGRADE.md).

## Play locally

Use Node 24.13+ and npm on Windows, Linux or macOS:

```powershell
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:5173. The same command starts a loopback-only read-only bridge for the explicitly selected public `orionaster/devungeon` repository. No account, paid service, API keys or provider process is used. First startup is Chinese; switch to English in the header without reloading.

Start exploring the Observatory, or open **Projects & maps** to choose Tiny landing page (3 features / 2 dependencies), Agent workbench (8 / 9), or public Devungeon. The first two are synthetic DEMO fixtures; **Extend map · DEMO** appends a sealed feature while retaining old room/corridor positions. Switching project or applying a new map restarts only the local encounter. Public facts update immediately; changed maps are staged until explicitly applied. Public Issues/PRs are observed work items, not inferred accepted capabilities. All unaccepted project rooms remain locked; separate game-only spaces remain playable.

WASD moves, J attacks, Space dodges, Q/R rotate 90°, wheel zooms, E inspects a nearby companion/object, P pauses local combat. Escape closes the active panel and returns focus to the game; an explicit pause has a visible Resume button. In generated maps, click a visible Agent or its row under **Project & Agents** to open the workspace, including visual-only markers in locked rooms. DEMO supports local simulated chat/tasks/approval exercises. The sample's Moss panel instead exposes two explicitly scripted task behaviors and their evidence. Public observers support inspection only; no live model command channel is enabled. Death, restart and pause never cancel Agent work, approve actions or change project acceptance.

`npm run check`, `npm test` and `npm run build` check the complete integration. `npm run preview` serves the production app with the same local bridge. Set `DEVUNGEON_PORT` / `DEVUNGEON_SCOUT_PORT` to avoid occupied ports. Ctrl+C stops the owned processes; local public journals live in ignored `.devungeon-scout/forge`. Browser reproduction, source observer opt-in, evidence and remaining limits are in [FORGE_INTEGRATION.md](docs/FORGE_INTEGRATION.md). The canonical install is the root `package-lock.json`; React and React DOM are deduplicated. The old per-package records document first-wave standalone contributions.

## The idea

- **Explore your project**: an AI World Designer suggests a suitable game world based on product/design signals and real project structures; you can override it. Available world packs compile that truth into an explorable world.
- **Watch agents work**: Supervisors and workers appear as dungeon characters; observed tool calls, development tasks and validation events become in-world actions.
- **Play while they build**: Move, dodge, fight monsters and explore. Game victory is separate from real project acceptance.
- **Manage work inside the game**: Select or approach an Agent, chat, inspect status and evidence, and request operations permitted by the underlying real Agent system.
- **Watch the world evolve**: Accepted features unlock rooms and passages. Locked zones can be inspected with the camera but not entered, and existing rooms keep stable positions as the project expands.

Our goal is **fun, creative exploration, open-source collaboration, and a compelling game to share**, not monetization.

## Documents

- [Full Chinese PRD v1.3](docs/PRD.md) — complete product vision, Chinese-first UX and project-adaptive world types.
- [ADR-0002: Project-adaptive worlds](docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md) — multi-world decision, genuine gameplay differences and first-wave compatibility.
- [Architecture](docs/ARCHITECTURE.md) — boundaries and candidate technical stack.
- [Acceptance](docs/ACCEPTANCE.md) — reproducible end-to-end cases, security and honesty checks.
- [Roadmap](docs/ROADMAP.md) — incremental execution toward the complete V1 vision.
- [Pixel Dungeon Art Direction](docs/VISUAL_DIRECTION.md) — original first world pack, NOT a mandatory look for all future projects.
- [Tool & Skill Due Diligence](docs/TOOLS_AND_SKILLS.md) — original candidate evaluation; installed choices are pinned in the root lockfile and feature dependency records.
- [Asset Provenance Ledger](docs/ASSET_PROVENANCE.md) — verified CC0 candidates, import rules, redistribution and notices.
- [Contribution guide](CONTRIBUTING.md), [Agent rules](AGENTS.md).
- [Project Snapshot schema](schema/project-snapshot.schema.json) and two **synthetic** examples under `examples/`.

## Validate the documented protocol

```bash
python -m pip install -r requirements-dev.txt
python scripts/validate_examples.py
```

These tests validate schemas and synthetic fixtures only; **they do not establish a working game or live Agent connection**.

## First build target

Build a **real playable desktop-browser vertical slice** with an isometric/oblique 3D dungeon, room locks, independent combat, visible Agent actor with clearly marked synthetic events, and a functional room/Agent inspection panel. Then connect a real Agent event stream and one real project source; keep provenance and approval boundaries intact.

Suggested stack (subject to slice tests): TypeScript + React + Vite + Three.js + React Three Fiber + Rapier, with an opt-in local bridge for trusted file/Agent access.

## Work / game separation

| Real work                                                | Game                                                |
| -------------------------------------------------------- | --------------------------------------------------- |
| Review and acceptance evidence determines feature status | Winning a fight determines game victory only        |
| Agent events and permissions have audit records          | Visual effects, damage and items are gameplay state |
| Real operations require capability checks and approval   | An in-game sword never grants GitHub access         |

## Examples

The files `examples/tiny-landing-page.json` and `examples/agent-workbench-synthetic.json` are invented test projects for schema/visualization development; they **are not snapshots of any private repository**.

## License and assets

Source code and documentation: [Apache License 2.0](LICENSE). Creative/game assets must have independently verified compatible rights; don't clone copyrighted game art, sound or levels.

## Community

Issues and PRs are welcome once the repository is live. Especially useful: original dungeon art, readable animations, browser performance tuning, project/Agent adapters, procedural layouts and accessible gameplay.

## Agent development Skills

The repository includes **seven project-specific, instructions-only Agent Skills** under [`.agents/skills/`](.agents/skills/) for pixel visuals, browser gameplay validation, project-world compilation, truthful Agent event adapters, safe dependency reuse and in-world workbench commands.

- Codex discovers repository-local Skills from `.agents/skills/`.
- Claude Code uses [`.claude/skills/devungeon-workflow/SKILL.md`](.claude/skills/devungeon-workflow/SKILL.md), which routes to those canonical workflows; [`CLAUDE.md`](CLAUDE.md) gives project-wide guidance.
- `python scripts/validate_skills.py` validates local Skill metadata without running/installing any Skill.
- Game/workspace runtime packages are installed through the tested root lockfile. No third-party Skill, global MCP server, persistent hook or external art download was added. Dependency notices ship with the local builds.

## Visual references and copyright

The original 2.5D art direction borrows **genre qualities** from lively top-down pixel dungeon games (including *Soul Knight*), not their copyrighted sprites, music, branding, exact rooms or UI. Prefer a consistent CC0 starter pack such as [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) and record any actual imported files in the asset provenance ledger.


## Experience selection (planned; not yet a running game switch)

World packs may implement different **spatial metaphors and game loops**, not only alternative colors: pixel dungeon (combat), city (build/explore), space station (repair/explore), museum (collect/explore). Their shared foundation is real project IDs, dependencies, evidence, Agent observation and safe Agent commands; the user can choose a different world than the AI proposes. UI Chinese/English selection does **not** select a world.

The versioned **optional** draft manifest and its two *synthetic* proposal fixtures live in [schema/world-experience.schema.json](schema/world-experience.schema.json), [pixel dungeon](examples/world-experience-pixel-dungeon.json), and [city proposal](examples/world-experience-city-proposal.json). City is **proposal-only**. A second world is not complete until a separate playable interaction loop passes real browser tests. See ADR-0002.

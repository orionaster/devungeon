# Devungeon 🗝️

**Your agents are working. You're playing. Your world is growing.**

Devungeon is a planned **open-source, explorable 2.5D pixel-art dungeon game + AI-agent workspace** that turns real software projects into living game worlds. Its rooms have genuine 3D space and collision, while the signature look is an **original top-down pixel dungeon** with crisp sprites, fast combat and expressive Agent characters.

> **This branch: S1 playable browser slice, awaiting supervisor review.** Explore three original pixel rooms, fight an independent encounter, preview the sealed vault and observe clearly labeled DEMO companions. Real project import and real Agent/workbench integrations are separate work and are **not connected in this slice**. This is not the complete V1.

## Play locally

Node22.12+ and npm are required. On the HERO branch:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173. WASD moves, J attacks, Space dodges, Q/R rotate90°, wheel zooms, E inspects nearby companions, P pauses local combat. Use the header's guide for all controls. No account, paid service or API keys required.

`npm test` runs engine checks; `npm run build` creates the production app, and `npm run preview -- --port 5174` serves it locally. See [actual validation and limitations](docs/HERO_VALIDATION.md), [scene/workbench contract](docs/HERO_INTEGRATION.md), and [locked dependency/license review](docs/HERO_DEPENDENCIES.md). Browser screenshots and measured results are in [output/playwright](output/playwright/). Gameplay victory never changes project acceptance.

## The idea

- **Explore your project**: An AI World Designer interprets real modules, features, dependencies and verification evidence and creates a project-specific dungeon.
- **Watch agents work**: Supervisors and workers appear as dungeon characters; observed tool calls, development tasks and validation events become in-world actions.
- **Play while they build**: Move, dodge, fight monsters and explore. Game victory is separate from real project acceptance.
- **Manage work inside the game**: Select or approach an Agent, chat, inspect status and evidence, and request operations permitted by the underlying real Agent system.
- **Watch the world evolve**: Accepted features unlock rooms and passages. Locked zones can be inspected with the camera but not entered, and existing rooms keep stable positions as the project expands.

Our goal is **fun, creative exploration, open-source collaboration, and a compelling game to share**, not monetization.

## Documents

- [Full Chinese PRD v1.0](docs/PRD.md) — complete agreed product vision and V1 acceptance goals.
- [Architecture](docs/ARCHITECTURE.md) — boundaries and candidate technical stack.
- [Acceptance](docs/ACCEPTANCE.md) — reproducible end-to-end cases, security and honesty checks.
- [Roadmap](docs/ROADMAP.md) — incremental execution toward the complete V1 vision.
- [Pixel Dungeon Art Direction](docs/VISUAL_DIRECTION.md) — mandatory original 2.5D pixel art, camera and gameplay readability.
- [Tool & Skill Due Diligence](docs/TOOLS_AND_SKILLS.md) — broad engine, map, artwork, observability and testing evaluation; **candidate packages are not installed yet**.
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

| Real work | Game |
|---|---|
| Review and acceptance evidence determines feature status | Winning a fight determines game victory only |
| Agent events and permissions have audit records | Visual effects, damage and items are gameplay state |
| Real operations require capability checks and approval | An in-game sword never grants GitHub access |

## Examples

The files `examples/tiny-landing-page.json` and `examples/agent-workbench-synthetic.json` are invented test projects for schema/visualization development; they **are not snapshots of any private repository**.

## License and assets

Source code and documentation: [Apache License 2.0](LICENSE). Creative/game assets must have independently verified compatible rights; don't clone copyrighted game art, sound or levels.

## Community

Issues and PRs are welcome once the repository is live. Especially useful: original dungeon art, readable animations, browser performance tuning, project/Agent adapters, procedural layouts and accessible gameplay.

## Agent development Skills

The repository includes **six project-specific, instructions-only Agent Skills** under [`.agents/skills/`](.agents/skills/) for pixel visuals, browser gameplay validation, project-world compilation, truthful Agent event adapters, safe dependency reuse and in-world workbench commands.

- Codex discovers repository-local Skills from `.agents/skills/`.
- Claude Code uses [`.claude/skills/devungeon-workflow/SKILL.md`](.claude/skills/devungeon-workflow/SKILL.md), which routes to those canonical workflows; [`CLAUDE.md`](CLAUDE.md) gives project-wide guidance.
- `python scripts/validate_skills.py` validates local Skill metadata without running/installing any Skill.
- The repository **has not installed game runtime libraries, third-party Skills, MCP servers, hooks or art downloads** yet. These are implementation choices for S1–S4, and every chosen package needs a tested lockfile and appropriate license review.

## Visual references and copyright

The original 2.5D art direction borrows **genre qualities** from lively top-down pixel dungeon games (including *Soul Knight*), not their copyrighted sprites, music, branding, exact rooms or UI. Prefer a consistent CC0 starter pack such as [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) and record any actual imported files in the asset provenance ledger.

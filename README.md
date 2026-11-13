# Devungeon 🗝️

**Your agents are working. You're playing. Your world is growing.**

Devungeon is a planned **open-source, explorable 3D dungeon game + AI-agent workspace** that turns real software projects into living game worlds.

> **Current status: design / repository bootstrap only.** This repo starter contains the product requirements, architecture proposal, validation contract and synthetic examples. **The playable app and live Agent integrations have NOT been implemented.**

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

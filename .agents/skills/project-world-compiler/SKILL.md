---
name: project-world-compiler
description: Use when mapping software capabilities and dependencies into persistent dungeon rooms, zones, doors, layouts, world blueprints, or incremental world migrations.
---
# Project → World Compiler

Read schema/project-snapshot.schema.json, docs/ARCHITECTURE.md and docs/ACCEPTANCE.md.

## Implement
1. Load a valid ProjectSnapshot with stable IDs, provenance, unknown markers and accepted state from trusted evidence only.
2. Build a semantic project graph; do not equate files or folders 1:1 with product features.
3. Treat AI World Designer output as an *untrusted proposal* of motifs/room placement. It cannot invent actual tasks, acceptance or evidence.
4. Use deterministic seeded topology/layout, perhaps rot.js for candidate 2D room maps; always apply dependency-aware door placement, collision, reachability and fixed room IDs.
5. Pin accepted existing room locations. Additive changes extend affected rooms/corridors only; preserve prior world and explain changes.
6. Validate generated geometry and show a factual graph fallback if no valid playable layout exists.

## Prove on both included fixtures
- examples/tiny-landing-page.json and examples/agent-workbench-synthetic.json generate distinct coherent worlds.
- Same seed, input, and compiler version reproduce placement; changed input changes only affected geometry.
- Every accepted traversable room remains reachable; locked unaccepted rooms can be viewed but not entered.
- Bad/cyclic references and unsatisfiable constraints yield explicit errors, not fabricated rooms.
- Battle victory, closed Issue and merged PR must not set accepted without separate evidence.

Reference: https://github.com/ondras/rot.js

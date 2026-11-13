# ADR-0002 — Project-adaptive game worlds, not one mandatory dungeon

**Date:** 2026-11-13  
**Status:** Accepted product/architecture direction; implementation pending  
**Decision owner:** Project founder  
**Supersedes:** The same-day statement that pixel dungeon is the universal project-level art direction. It does **not** cancel existing HERO #9, BUILDER #8, SCOUT #6 or WIZARD #7 work.

## Decision

**Devungeon turns a real software project into its own explorable, playable and workable game world. The world form, art style and possible gameplay are informed by that project's design language, purpose, users, structure and the creator's wishes.** Not every product becomes a pixel dungeon.

“Project/product language” means **brand identity, visual design language, product concept and interaction vocabulary**. It does not mean the code's programming language or the user's natural language. The separate Chinese/English UI requirement remains in I18N.md.

| Example product signals | Possible world | Possible real gameplay |
|---|---|---|
| Multi-Agent modular coordination | Original top-down pixel dungeon | Combat, quest exploration, locked-room preview |
| Operational SaaS / business modules | Stylized city | Building/upgrade and district exploration |
| Aerospace or modular infrastructure | Space station | Module connections, repairs and exploration |
| Creative/education/media collections | Museum | Exhibition exploration and collection |

These examples are **choices, not fixed industry classifications**. The same AI product might be a city; a SaaS might be a dungeon. Neither Chinese nor English UI, source code language, one keyword or GitHub repository name may independently determine a world type.

## Shared truth vs customizable experience

### Shared, invariant
- ProjectSnapshot and semantic ProjectGraph: real feature IDs, dependencies, statuses, acceptance evidence, unknowns.
- Agent events, real permissions, activity provenance, original external text and audit trail.
- Functional inspector, source-linked room/feature explanations, approval and permission boundaries.
- Work/game separation: player wins, loot, city upgrades or repairs cannot mark real tasks accepted.
- Stable project IDs, revision history, evidence links and human approvals.
- Safe preview of uncompleted capabilities without portraying them as usable.

### Experience-specific
- Map grammar and spatial topology: rooms/corridors, building/roads, station modules, museum galleries.
- Rendering style, textures, characters, camera, music and animation (licensed independently).
- **Actual game mechanics**: fighting, construction, repairs, collection, etc. This is not merely swapping a sprite sheet.
- Visualization of actual Agent actions: battles, builders, repair teams, curators; only for events with appropriate provenance.
- Pack-specific independent GameState, save version and play loop.

## User experience: propose → preview → choose → evolve

1. User selects an approved project; read permitted product requirements, brand references/screens, goals, feature graph, and user preferences. Missing design clues stay unknown; never silently upload private assets.
2. AI World Designer may suggest 1–3 ranked experiences with reasons, source signals, uncertainty and a fallback. AI suggestions are structured untrusted **proposals**, not executable code or verified content.
3. Show which packs are **installed and working**, vs concept-only. User can select/override a suggestion; explicit selection takes precedence and is saved locally.
4. Shared graph is compiled through a **specific installed world-pack adapter** into scene layout and game mechanics. Validate topology, collision, lock/access and missing capabilities.
5. Subsequent project changes update only affected world entities; preserve project IDs/evidence and stable layout within the selected experience.
6. User may preview another world and confirm switching. Real work/Agent state always survives. Incompatible player inventory or game-only progress stays separately namespaced by pack with a clear warning; do not promise automatic save migration.

**Fallback:** if the suggested pack is unavailable, offer an installed alternative or factual graph/text view. Never pretend a non-existent city simulation is already playable.

## Data and plugin boundary

Keep the existing ProjectSnapshot, WorldBlueprint v1 and AgentEvent contracts unchanged for the current four PRs. A **new optional sidecar experience manifest** records:
- project_id, project_revision, experience_id and schema version;
- world_type, renderer_plugin and gameplay_plugin identifiers;
- design metadata, recommendation source signals and human override;
- truthful runtime_status: proposal-only, experimental or verified-playable.

Draft schema and **synthetic proposals**:
- ../schema/world-experience.schema.json
- ../examples/world-experience-pixel-dungeon.json
- ../examples/world-experience-city-proposal.json

A pack may later expose typed ports such as mapEntities, buildScene, updateScene, projectAgentEvent, previewUnavailable, saveGameState, render. Plugins are versioned/allowlisted; do not execute arbitrary AI-generated scripts, auto-install new runtimes or grant provider permissions. Different genres might use distinct renderers or game runtimes behind the same facts/Agent protocol. Do not build an oversized universal game engine prematurely.

Data flow: source project → validated facts / optional approved design signals → AI recommendations + human choice → experience manifest → semantic graph → pack-specific layout/renderer/gameplay → interactive Agent workbench. Work commands always go through a separately authorized bridge.

## Impact on the current development

**Preserve all first-wave work.**
- HERO #9: valid first **pixel-dungeon world pack** and real playable reference; not a universal compulsory renderer.
- BUILDER #8: valid dungeon-oriented generator; expose semantic project graph and a pack-adapter seam incrementally. No rewrite before the existing slice integrates.
- SCOUT #6: world-type-neutral read-only fact/event connector; do not infer world type as a GitHub fact.
- WIZARD #7: shared Agent workbench across any future experience; do not tie source permissions or Chinese/English locale to dungeon mechanics.
- Issue #10: Chinese-first interface / English switch, separate from design-language-driven world generation.
- Integration Issue #12: continue unifying the pixel-dungeon working experience first; don't block it waiting for hypothetical new genres.

**Next real milestone after first-wave integration:** one identical approved ProjectSnapshot → two verified, genuinely different playable world forms; creator overrides recommendation; source project facts/Agent events/permissions remain invariant. A small city-build/explore slice is a candidate, not an already-selected engine.

## Acceptance tests for multi-world claim

1. Two distinct projects receive explainable, different proposals; user override works.
2. The **same** source snapshot can run in dungeon mode and a meaningful second mode with a different interaction loop, not just different colors.
3. Both modes show real Agent provenance, locked/unavailable state and project feature explanations.
4. Scene switch does not edit accepted/blocked statuses, original evidence, approval or Agent tasks; game-only saves remain isolated.
5. Missing pack, invalid manifest, disconnected Agent and unknown product style have honest fallbacks.
6. Full browser captures and real interactions demonstrate the second mode; JSON-only validation is explicitly insufficient.

## Safety and limits

Do not copy Soul Knight characters, sprites, UI, levels, music or source assets. Review every pack's license and capability surface. No private Crew data or credentials in this public repo; any real Crew connection requires separately authorized scope. A text prompt alone does not manufacture a working game mode.

**This ADR is a product design decision and compatibility contract, not a shipped multi-world implementation.**

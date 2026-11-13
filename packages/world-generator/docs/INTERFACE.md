# BUILDER ↔ HERO / SCOUT interface

Implemented by BUILDER on 2026-11-13, additive wave-2 contract on 2026-11-14.
Root public schemas stay v1.0; this package's envelope is experimental. Consumer
integration must be verified by HERO; a generated JSON file alone is not a
verified 2.5D game. This is the first dungeon pack, not a mandatory universal
world grammar. Future adapters can consume `compileProjectGraph` without
importing dungeon geometry or choosing a world based on UI locale.

```ts
import { compileWorld, createNavigator } from '@devungeon/world-generator';
const result = compileWorld(snapshot, { seed: 1337, previous: savedLayout });
if (!result.ok) showDiagnostics(result.diagnostics, result.fallback_graph);
else {
  render(result.world.blueprint, result.world.scene);
  persist(result.world.layout); // supply this exact layout on subsequent revisions
  const nav = createNavigator(result.world.scene);
  player.position = nav.safeSpawn(player.position); // handles newly relocked rooms
  player.position = nav.move(player.position, requestedPosition); // sweeps walls/gates
}
```

`snapshot` is the canonical **ProjectSnapshot schema_version="1.0"**. It is cloned
and never written. SCOUT owns facts, provenance and evidence; this compiler cannot
verify a test URL or promote a closed Issue/merged PR. Real accepted features need
at least one supplied `verified` evidence item; demo features can use synthetic
evidence only with honest source and agent flags. Missing task entities and
per-feature timestamps remain explicitly unknown in the semantic graph.

`blueprint` validates against the unchanged root WorldBlueprint schema v1. It has
only room positions/prefabs, zone themes and dependency gates, with room IDs from
the source. A renderer supporting only this schema can show a preview; it MUST
consume `scene` or derive equivalent collision/lock data before allowing play.

`scene` is a theme-neutral **SceneLayout format_version="1.0"**:

- Ground is **x/z**, up is **+y**. One unit is one tile. Integers are tile centers.
  Room x/z is its **center**; odd width/depth is the full outer footprint including
  one-tile walls. Floors extend to tile center +/-0.5. Wall size is 1×2×1; its center
  is y=1, floor top y=0. Use 16 native pixels/tile, nearest sampling, original art.
- `tiles` includes floor, wall and door cells. `variant` 0–3 is an immutable seeded
  pattern selector, not an atlas index. `motif` is thematic metadata, never status.
  Room prefab selects approved decoration/combat staging inside the footprint;
  it must not override the colliders or carve extra doorways.
- Every room has **one south door** and an exterior porch. `corridors[].tiles`
  connects exterior porches, permitting intentional exterior junctions without
  routing through another room. Connections carry all actual dependency edges;
  room entry always checks all direct/transitive dependencies, in either direction.
- `colliders` are axis-aligned 3D boxes for walls, sealed room interiors and sealed
  doorways. Retain the full lock volume even if doors appear decorative. Floor
  tiles/navigation define the walkable ground; void is not walkable. Map these
  boxes to Rapier/static collision and enforce the navigator on dash/teleport too.
- `doors[].locked`, `rooms[].lock.reasons` and `navigation.walkable` agree. Entry
  requires own status `accepted` and every transitive predecessor enterable.
  `review`, `active`, `regressed`, `archived` etc. are viewable but sealed. A
  successor can remain factually accepted while a regressed prerequisite locks it.
- `spawn` is always inside a **game-only foyer**. The foyer is not a project room,
  has no acceptance status and is absent from the canonical blueprint. SafeSpawn
  rejects void/locked rooms. Reconcile player position whenever a new scene arrives.
- `encounters` are explicitly **game-only**. A boss/skirmish descriptor is a game
  staging suggestion, not an inferred real task or milestone. Combat modifies a
  separate GameState; this package exposes no status-write API.
- Camera inspection/quarter-turns (0/90/180/270) never change world coordinates or
  navigation. HERO owns direction sprites, wall occlusion, rendering and combat;
  these require actual consumer browser checks.

`layout` is the save format. Pass the full layout, not just blueprint coordinates.
All old room footprints, doorway positions, prefabs, floor variants, foyer and
existing corridor paths stay pinned. A new room avoids those reservations. Removed
features become sealed `tombstones`; old paths remain visible historical routes
(`retired:true`). Restoring an ID restores its position. Layout/zone history counts
toward the documented capacity, and needs an explicit migration to compact it.
Different seeds, generator versions, projects or bounds are rejected when loading
an existing layout. No automatic destructive re-layout is attempted.

## Actual HERO S1 adapter

`toHeroScene(world, {includeEnemies?: boolean})` structurally matches HERO's
SceneDefinition without depending on its package. HERO S1 rasterizes tiles at
half-integer centers; this adapter shifts the **entire** scene +0.5 in X/Z and
converts outer footprints to inner floor dimensions (width/depth minus two).
Persistent Blueprint/Layout coordinates stay unchanged. The adapter adds a
uniquely named game-only foyer, seals removed rooms, and emits overlapping axial
corridor runs. Long runs share one tile at each split to preserve a player's
footprint across seams. Redundant interior runs are omitted to fit S1 budgets.
Do not pass unconverted Blueprint dimensions as playable floor dimensions.

Default actor arrays are empty; `includeEnemies:true` stages only entertainment
encounters in enterable rooms. Source Agent markers follow the explicit
`includeAgents` visual-only contract below. HERO's current limits are checked explicitly:
128 total rooms including the foyer, 512 corridor rectangles, 64 enemies, <=32768
summed floor tiles, rectangle sizes <=128 and positions within +/-512. Unsupported
large scenes throw `HERO_SCENE_LIMIT`; the canonical compiler remains renderer
neutral and can still return its own valid scene.

`scripts/verify-hero.mjs` verified exact floor raster, movement through accepted
rooms, adjacent-tile seams, all fixture locks under dash attempts, and real HERO
combat victory without truth mutation. It also checks a 32-root long-corridor
regression. See VALIDATION.md for the exact evidence boundary.

## Wave 2 additive contract (Issue #12 / #10)

The canonical Snapshot/Blueprint, generator version, seed algorithm and saved
layout are unchanged. `HeroScene` additionally provides:

- `doors[]`: exact `room_id,x,z,axis,locked` from the compiler, shifted +0.5.
  Axis describes the direction across a door (`x` for the first pack's south
  doorway). HERO must prefer these positions over guessing from corridor centers;
  guessing was visibly wrong for planning/history/executor in the complex fixture.
- `project_context`: original `project_id,project_revision,observed_at,source`.
  Use the true project ID and source Agent IDs to initialize event projections;
  `worldId` is a scene identity, not an event project ID.
- `includeAgents:true`: source-assigned Agents become **visual-only** markers in
  their original assigned rooms, including sealed rooms. The player still cannot
  enter. `agent_id,room_id,source_role,is_demo` are preserved; `role` selects only
  the cosmetic builder/scout/wizard sprite. Source Agent activity requires actual
  attributed events; a marker alone must not imply live work. An unassigned Agent
  gets no invented location; its ID is reported in `agent_ids_without_room`.
  Snapshot Agent entries are not synthesized from GitHub project-source events.

`compileProjectGraph(unknown)` validates facts and returns graph/diagnostics
without requiring any pack, layout seed, locale or provider. This is a practical
semantic seam for ADR-0002, not a second-mode implementation or recommendation API.

Presentation is an optional separate projection:

```ts
const roomRefs = describeHeroRooms(world, scene); // same project + revision
// Inside the one shared WIZARD I18nProvider:
const { t } = useI18n();
const label = renderWorldName(roomRefs[0].name, t);
const reasons = roomRefs[0].reasons.map(ref => renderWorldMessage(ref, t));
```

All 34 `WORLD_MESSAGE_KEYS` are owned by WIZARD's complete zh-CN/en-US catalogues.
Nested refs translate status labels before inserting them into lock explanations;
dependency IDs remain original. Original project/zone/feature names and evidence
are retained, with `kind:'original'`; optional Designer titles/themes carry
`kind:'design'` and keep `original_name`/`original_theme_hint` alongside them.
If a host enables Designer text, show its design attribution and original feature
name together. Do not silently present a decorative title as source evidence.

Raw diagnostic messages remain available as original technical details;
`describeDiagnostic` supplies a localized category and code. Missing task lists
and per-feature verification time/confidence remain explicit data gaps, not claims
that supplied verified evidence is absent. No local translation cloud is called.

Keep the scene bundle/Dungeon instance stable when locale changes; translate at
the DOM boundary. In the consumer entry only a source selection/revision creates
a new scene. Root workspace integration must build this package before importing
its `dist` export (`npm run build --workspace @devungeon/world-generator` after
adding the package to root workspaces); the library has no React dependency.

AI proposals accept only versioned zone theme/narrative and existing-room title,
narrative and a prefab enum. Arbitrary geometry, status, evidence, dependencies,
new entity IDs and unknown keys fail. Initial prefab selection is pinned by the
layout; subsequent proposals can change theme/title/narrative but not the saved
prefab. Proposal text must be rendered as text, not trusted HTML.

Capacity: 128 persistent room and zone reservations, 512 agents, 1024 dependencies,
2048 historical paths, 100000 path tiles; default bounds [-128,256] on each axis.
Custom integer bounds stay within +/-2048 and <=262144 cells. At capacity or on
unroutable geometry the result is `ok:false` with diagnostics and the valid graph
fallback when available. No half-valid scene is returned.

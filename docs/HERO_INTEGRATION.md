# HERO scene / workbench contract

S1 code lives on `feat/s1-hero-game`. It owns `apps/web`, `packages/dungeon-engine`, the initial root npm workspace and lockfile. Do not overwrite parallel BUILDER/SCOUT/WIZARD packages. This branch does not import or claim their live capabilities. Coordination is recorded on [Issue #1](https://github.com/orionaster/devungeon/issues/1).

## Engine

```ts
import { Dungeon, type SceneDefinition } from "@devungeon/dungeon-engine";

const dungeon = await Dungeon.create(scene); // validates, clones, deep-freezes definition
dungeon.start();
dungeon.step({ moveX: 1, moveZ: 0, attack: false, dodge: false }, 1 / 60);
const game = dungeon.snapshot(); // defensive copy; no project acceptance fields
dungeon.restart(); // returns to validated safe spawn, phase ready
dungeon.dispose(); // free WASM world once, on replacement/unmount
```

`SceneDefinition` is the source of renderer/physics geometry, not of project truth. It contains `worldId`, `rooms`, `corridors`, `spawn`, optional `reward`, `obstacles`, `enemies`, and `agents`. See the exact types in `packages/dungeon-engine/src/types.ts`.

- Ground is X/Z, +Y up, one world unit per 16 source pixels. Rectangles use center `x,z` and full `width,depth` of **walkable floor**. All four floor edges must be integers; tile centers are `n + 0.5`. Obstacles may have arbitrary finite dimensions.
- Canonical WorldBlueprint v1 stays unchanged. `sceneFromBlueprint(blueprint, access, corridors, spawn)` provides a thin adapter. The caller validates canonical JSON and computes authoritative access separately. Missing access denies entry. An explicit `enterable` boolean is required. Only accepted rooms with satisfied prerequisites should receive true; the S1 demo's forge/arena are explicitly independent game spaces.
- BUILDER's external footprint includes 1-tile walls. Its adapter must subtract 2 from room width/depth, shift centers as needed to align floor edges, and extend corridors through the door to the inner floor. Do not pass full outer footprints directly. A union of corridor rectangles can represent turns/junctions. Engine derives walls along the floor union, so internal overlapping edges do not become walls.
- Locked room floors are visible, but a full-room Rapier collider and an independent semantic guard deny player entry. All movement, including dodge, uses Rapier's swept character controller. Camera preview changes only the camera. No public teleport API exists. Replacing the world requires a new validated engine; do not mutate the frozen scene.
- Current budgets: 128 rooms, 512 corridor rectangles, 256 obstacles, 64 enemies, 64 agents, 32,768 summed floor tiles, ±512 coordinate range, 128 maximum rectangle dimension. Geometry must be within these bounds; larger worlds need streamed partitions. Projectile pool is capped at 96, effect history at 80.
- An enemy engages the player only in the room containing that enemy's initial spawn. The game reward defaults to spawn unless specified. No enemies means an immediate game win, not project acceptance. Enemies are optional for imported project worlds.

## Renderer / host

`apps/web/src/Scene.tsx` exports `<DungeonScene scene={scene}/>`; it builds floors, walls, obstacles, locked-room seals, actors and particles from the same definition. Its decorative forge table is specific to the built-in fixture. The current host supports **one canvas/game at a time**, through `apps/web/src/runtime.ts`:

```tsx
runtime.game = await Dungeon.create(scene);
runtime.frame = runtime.game.snapshot();
runtime.onFrame = setGameSnapshot;
runtime.selectAgent = setSelectedAgentId;
runtime.selectRoom = setSelectedRoomId;
// Render <DungeonScene scene={scene}/>; dispose/reset runtime when changing revisions.
```

The renderer advances a fixed-60Hz simulation, with frame catch-up capped at100ms to avoid giant jumps after stalls. Excess wall time is intentionally dropped; background play is not a real-time Agent clock. Agent animation uses attributed wall-clock events independently. Gameplay snapshots sent to React are sampled at10Hz. Nearest-filtered source art, no texture mipmaps/MSAA, internal render DPR0.75; normal DOM labels stay full resolution.

`cameraControl` supports `heading: 0|1|2|3` (quarter turns), zoom20–72, `follow`, `overview`, `preview`, `free`. Overview fits the scene; preview targets the first locked room. Arbitrary-angle rotation is intentionally unsupported. Multiple locked-room selection targets can extend the camera contract later.

## Agent event / workbench boundary

`AgentProjection(projectId, knownAgentIds).ingest(unknown)` validates display events, rejects wrong project/agent IDs and malformed optional fields, deduplicates the most recent100 events, and keeps each Agent's newest occurred-at event. `actor(id)` marks silence beyond15 seconds stale. This is an in-memory display projection, not a durable event log or command adapter. An event named completed never marks a room accepted.

The built-in script emits only `is_demo:true`, source `synthetic:s1-script`, evidence reference `apps/web/src/runtime.ts`. Scripted work continues when local combat pauses or ends. The HUD, actor inspector and world badge all say DEMO. No raw keys, external commands, project writes, acceptance setters or provider login exist in S1.

Stable IDs are `demo-builder` (Cinder), `demo-scout` (Moss), `demo-wizard` (Lumen), project `demo:ember-archive`. Click a sprite/companion row or approach within3 units and press E to select. WIZARD's independent component can replace only the Agent inspector:

```tsx
<AgentWorkspace
  adapter={work.controller}
  selectedAgentId={chosenAgent ? selected : null}
  onClose={() => {
    setSelected(null);
    focus();
  }}
/>
```

Use an explicit ID mapping/helper; do not guess by display name. On panel open call `clearInput()`, suppress keyboard/attack input, and restore canvas focus on close. Leave the room inspector independent. Never pass GameState into the workbench controller. Root `workspaces` currently lists two packages explicitly; add new workspace packages and reconcile the lockfile at supervisor integration time. The WIZARD helper and BUILDER adapter reported by peers are not merged or browser-integrated into this branch.

## Diagnostics

`window.__DEVUNGEON__` exposes defensive `snapshot()`, `events()`, `access()`, `camera()`, `metrics()` only. Browser acceptance drives actual keyboard/mouse inputs and reads those results. There are no cheat, HP, teleport or work-state mutation hooks. FPS is rolling visible-frame timing; it includes long visible hitches. Raw production sampling and environment are in `output/playwright/production-performance.json`.

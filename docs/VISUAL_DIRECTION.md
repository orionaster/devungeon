# Devungeon — Pixel Dungeon Visual Direction (v1)

Status: **approved direction / specification; not yet implemented**  
Date: 2026-11-13

## Creative target

**Pixel-art dungeon action game first; software-project visualization second.** The emotional reference is the readable, lively, top-down pixel dungeon combat of *Soul Knight (元气骑士)*. This is a reference to general visual characteristics and play rhythm, **not** permission to copy its assets, exact characters, UI, rooms, soundtrack, effects, or branding.

The player should feel they are exploring and fighting in a lively pixel dungeon while Agent teammates are working nearby. The scene should also support inspection, dialogue, supervision, and project states without losing game feel.

### The 2.5D resolution of the "3D vs pixel" tension

- **True spatial world:** rooms, walls, height, doorways, collision, line of sight, and a camera in 3D.
- **Pixel-art rendering:** hand-authored/safely licensed sprite sheets and low-resolution tile textures, preferably on a coherent **16×16 base art grid**. Render texture magnification with nearest-neighbor sampling; use consistent pixels-per-world-unit.
- **Characters:** 2D directional sprites in the 3D environment (camera-facing billboards or explicitly oriented planes); don't use smooth 3D action figures masquerading as pixel art.
- **Camera:** slightly elevated top-down / orthographic-oblique by default. Offer discrete 90-degree rotation with correct sprite/occlusion behavior first. More arbitrary free camera rotation remains an experiment: test that it doesn't break readability or pixel grid coherence before promising it.
- **Environment:** tile-based floors and wall silhouettes with limited actual depth, occlusion and shadows. A 3D model may use pixel textures; don't equate blocky voxel art with traditional pixel drawing.
- **Pixel treatment:** pixel-perfect UI where useful, crisp textures, intentional limited palette, no accidental bilinear blur, no excessive anti-aliasing or image upscaling artifacts.
- **Readable product semantics:** project states must have labels/icons in addition to colors. Never change real work state because of a game animation.

## Art bible / initial reference, not copied assets

- **Proportions:** dungeon tiles 16×16 native source pixels; characters typically ~16–32 source pixels tall, with animation grid consistency within each set. The generator works in game-world units independently of art resolution.
- **Composition:** compact connected rooms, legible corridors and tile motifs, plenty of breakable-looking *game-only* props, clearly signaled locked doors.
- **Color:** restrained dark-stone floors and medium-contrast walls; vivid action colors for hit, projectile and ability feedback. Example **original working palette**: #1B2230 / #303E50 / #526B7A / #71D2BC / #F4B45B / #E56E77. This is an internal proposal, not sampled from another game.
- **Motion:** short, expressive 4–8-frame cycles for player and Agent avatars; idle, traverse, attack, dodge, interact, inspect, blocked and celebration. Actual Agent activity may trigger animation; fake idle combat must never imply work happened.
- **World labels:** work HUD remains a clean, accessible overlay. Do not paint chat text into low-res textures. Keyboard-focusable agent/room inspector must remain readable at normal desktop sizes.
- **Status clarity:** locked rooms allow camera preview but deny movement/collision entry; reviewed is not accepted; stale/demo/live/replay each have explicit text markings.

## Recommended assets and tool workflow

1. **Kenney Tiny Dungeon** (CC0, 16×16): coherent starter tiles, items and characters; source https://kenney.nl/assets/tiny-dungeon . Good for the first playable slice. Download from the primary source only when S1 needs the actual sprites; record their revision and license in the asset ledger.
2. **Kenney 1-Bit Pack** (CC0): fallback rapid prototypes with a *different* monochrome visual identity; don't casually mix it with full-color tiles in one room. https://kenney-assets.itch.io/1-bit-pack
3. **Pixelorama** (MIT, editor; artwork's rights remain separate): https://github.com/Orama-Interactive/Pixelorama for original sprite, enemy, tile and VFX edits.
4. **LDtk** (MIT, optional authoring/reference): https://ldtk.io/ to design hand-authored example rooms; do not make LDtk's 2D exported map the canonical project truth or the only procedural generator.
5. Use licensed sound separately; **no copied Soul Knight music, sprite sheets or fonts**.

**No third-party asset files are bundled by this document.** Bringing bytes into the public repo requires primary-source license review and a source/revision record in docs/ASSET_PROVENANCE.md.

## First visual/playable acceptance

1. Launch real browser: pixel dungeon reads as a *game* with player, enemies, attack, dodge, hit feedback and exit.
2. Walk into walls and a planned room; collision blocks entry. Rotate camera to preview the room without walking inside.
3. Change from 0° to 90° to 180° to 270° and verify directional sprites, opaque wall occlusion, UI labels and input controls remain coherent.
4. Agents visibly act on **attributable DEMO events** during S1; gameplay combat works independently of their event status.
5. Compare screenshot captures at a fixed viewport and DPR; check pixels are crisp rather than fuzzy. Separate accessibility text overlays from pixelated world rendering.
6. Run an actual modest-hardware browser session; record FPS/device/scene complexity rather than assert a target without measurement.
7. Confirm the art license/provenance manifest before publishing screens, gameplay clips or repository asset bytes.

## Performance and fallback rules

- Prefer atlased sprites, shared geometry/materials, instancing for repeated tiles, capped particles and event sampling.
- Avoid physics for purely decorative tiles. Use Rapier bodies only for collidable or dynamic entities.
- Dynamic rendering quality may degrade gracefully; product facts and agent dialogue remain accessible as regular UI.
- A 2D/game-state-free facts panel remains available when WebGL fails or the player wants a traditional view.

## Related source material

- Soul Knight gameplay visual reference (not licensed source art): https://www.nintendo.com/es-es/Juegos/Programas-descargables-Nintendo-Switch/Soul-Knight-1652172.html
- Three.js nearest texture sampling: https://threejs.org/manual/#en/textures
- Kenney Tiny Dungeon CC0: https://kenney.nl/assets/tiny-dungeon
- Pixelorama MIT: https://github.com/Orama-Interactive/Pixelorama
- LDtk editor: https://github.com/deepnight/ldtk

## Decision

Pixel-art top-down dungeon is **the project-level art direction**, not an optional afterthought or interchangeable 3D cartoon sample. A user may add future themes but the built-in signature theme is this **original 2.5D pixel dungeon**.

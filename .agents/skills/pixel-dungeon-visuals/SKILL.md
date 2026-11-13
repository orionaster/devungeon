---
name: pixel-dungeon-visuals
description: Use when creating or reviewing the first Devungeon pixel-dungeon world pack's sprites, 2.5D dungeon scenes, camera, animations, visual fidelity and assets. Not a universal art rule for every project.
---
# Pixel Dungeon Visuals

Read docs/VISUAL_DIRECTION.md, docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md, docs/ASSET_PROVENANCE.md, and docs/PRD.md before editing this pack's visual code or asset bytes.

## Design intent
- For **this first pack only**, aim for an **original top-down pixel-art dungeon action game** with expressive enemies and teammates. Soul Knight is an emotional gameplay/genre reference; do not copy protected characters, sprites, exact tilemaps, music, HUD, logos or fonts.
- True 3D spatial geometry and collision, but pixel art sprites and tile textures. Start with an elevated top-down camera and 90-degree camera steps; test each orientation.
- Use a single source grid for each coherent asset pack, preferably 16×16 native tile art, consistent world-unit scale, crisp nearest filtering and intentional palette.
- Never mix editor license with sprite license. Refer to the upstream CC0 declaration and record provenance before vendoring bytes. Kenney Tiny Dungeon is the primary candidate; Pixelorama is the recommended editor.
- Clear status labels: planned/locked, active, review, accepted, blocked, stale, DEMO and replay.

## Required output
1. In your PR, list exact imported assets, author, source URL, license, revisions, attribution and modifications.
2. Provide actual browser captures of movement, attack/hit feedback, agent animation and the locked-room camera preview.
3. Test at 0/90/180/270 camera headings, with directional sprites and wall occlusion; record any supported angle limitation honestly.
4. Measure pixel sharpness, color contrast, play readability and actual FPS on the tested device. Do not call a mock screenshot a working game.
5. Preserve game/work state separation: agent animation cannot invent acceptance or actual work.

Reference: https://threejs.org/manual/#en/textures

## Multi-world scope boundary
Pixel-specific artwork, camera, sprites and combat validation apply when the **pixel-dungeon experience pack** is active. Do not use this Skill to force future city/space/museum packs into pixel-art combat. Shared work/provenance rules must remain invariant.

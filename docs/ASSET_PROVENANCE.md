# Devungeon — Open-Source Art / Audio Provenance Ledger

Status: **no third-party binary art/audio asset is vendored yet**. This is the required review process before packaging or publishing public demo footage.

## S1 original assets · HERO branch · 2026-11-13

`apps/web/src/art.ts` contains original code-authored16×24 character frames and16×16 stone/rune tile textures. Eight sprite kinds, four frames, directional hero/Agent variants; limited project palette, nearest filtering, no mipmaps. Authored in the HERO task (pixel_art subagent), reviewed in real Chromium screenshots at0/90/180/270; source and permission grant follow this repository's Apache2 license. Native Canvas drawing code is the source artifact; there is no downloaded source archive or vendored image/audio/font pack. SHA256 of formatted source: `05B06D97D669C4D06BE39DD5BD699DCEF342B7D412F5D654FA6C35803FBE9C85`. The matching Git commit and PR preserve its author/change history. See `apps/web/src/ART_LICENSE.md`.

S1 also contains original simple geometry/VFX and an inline original favicon in `apps/web/index.html`; same source license. Only local system fonts are requested. No third-party visual/audio bytes were imported, no Kenney art was downloaded, and no protected Soul Knight assets/UI/music/rooms were used. Kenney remains a candidate for later work, not a current runtime dependency.

## Approved *candidate sources*, not yet imported

| Source | Art | License at primary source | Preferred use | Notes |
|---|---|---|---|---|
| [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) | 16×16 dungeon tiles, creatures, props | CC0 1.0 | **Primary consistent prototype look** | Primary source says CC0, tiles 16×16; fetch official release and capture date/revision |
| [Kenney 1-Bit Pack](https://kenney-assets.itch.io/1-bit-pack) | Monochrome sprites | CC0 1.0 | Alternative single-color theme | Do not casually combine with primary style |
| [OpenGameArt 16×16 Dungeon Tiles](https://opengameart.org/content/16x16-dungeon-tiles) | Dungeon tile pack | CC0 as marked on **this pack** | Optional compatible extras | Recheck author, file-level terms and visual consistency |
| Original Devungeon art | Original project contributions | Must have an explicit contributor-granted compatible license | Replacement or extension sprites | Keep authors/commits and license evidence |

**Explicit exclusions:** *Soul Knight* sprites, fonts, screenshots pasted into a runtime atlas, sound effects and soundtrack; unverified external images; assets whose terms forbid redistribution; assets inferred from a broad marketplace label.

## Required entry per imported pack/file

When introducing an actual asset (PNG, sprite sheet, audio, font, 3D mesh):
- Asset path(s), SHA-256 of the source archive/file, source page and author.
- Source release/version or download date, actual asset license, cached license/notice text or immutable link.
- Allowed reuse/redistribution/modification/attribution obligations, and evidence of permission where necessary.
- Changes made (crop/recolor/merge/derivative), authored-by and corresponding PR.
- Explicit notice of any bundled third-party fonts or sounds.
- Human/Agent verification of the source page before public redistribution.

**Never infer that an editor's MIT/GPL license applies to exported artwork.** Asset rights and editor-code rights are distinct.

## Pixel-style technical constraints

- Consistent original palette and native tile grid; use nearest-neighbor sampling in scene rendering.
- Don't mix unaligned pixel densities, arbitrary rotation/resampling or noisy mixed packs.
- No hotlinking assets as a production dependency; once verified and permitted, commit locally with provenance or use approved self-hosted assets.
- Keep gameplay sprite state and Agent work status independent.

## Asset import gate

Before merging an asset PR, the reviewer verifies the exact bytes/rights and opens the game locally. A successful text-only CI check does not certify visual consistency or copyright status.

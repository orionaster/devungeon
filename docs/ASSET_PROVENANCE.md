# Devungeon — Open-Source Art / Audio Provenance Ledger

Status: **one sample room vendors selected CC0 Ninja Adventure artwork**. Legacy generated maps retain S1 original artwork. No external audio or fonts are bundled. See the First Play entry below for exact bytes and rights.

## First Play sample · FORGE · 2026-11-14

- Authors: **Pixel-Boy and AAA**. Primary source: [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack). The author's page and archive README explicitly identify the assets as CC0; the archive includes the full CC0 1.0 text. Attribution is appreciated rather than required; Devungeon retains it.
- Official free archive: `Ninja Adventure - Asset Pack.zip`, itch upload `16981275`, dated **2026-03-29**, retrieved 2026-11-14. SHA-256: `95a06f4fdcfd1882f061a45ff313b7c905dbe2de1e8512b281d7937df62a7b15`. No account, paid purchase, model provider or third-party installer was used.
- Vendored subset: **20 unmodified PNG files, 65,690 bytes**, in `apps/web/public/assets/first-play/`. [Machine-readable manifest](../apps/web/public/assets/first-play/manifest.json) records every local/upstream filename, exact size and SHA-256. The original [README](../apps/web/public/assets/first-play/UPSTREAM-README.md) and [CC0 license text](../apps/web/public/assets/first-play/LICENSE-CC0.txt) are retained.
- Included: NinjaGreen directional idle/walk/attack/roll/hit/death sheets, Inspector guide idle/walk/attack-pose sheets, two slime sheets, indoor floor/wall/furniture/dungeon atlases, chest/book/scroll/gem/fire PNGs. The native dungeon atlas also supplies amber orb lamps and sealed-door grating; it is not a second pack. Excluded: all fonts, sound, music, editor projects and other candidate packs from runtime.
- Modifications by FORGE: filenames simplified; runtime native-pixel crops select animation frames and compose the authored sample. The second playtest correction retains full 32×32 hero frames with a row-24 foot anchor, rather than clipping action pixels below row 24; native atlas direction order is down/up/left/right. Moss still uses complete native 16×16 Inspector frames at its original scale. Source PNG pixels are unchanged. `first-play-art.ts` contains crop/animation recipes; `FirstPlayEnvironment.tsx` contains room composition. Nearest filtering, no mipmaps; source art is loaded locally and never hotlinked.
- Scope: `pixel-dungeon:first-play-observatory:v1` only. Art skin cannot change source IDs, project acceptance, permission state or Agent truth. Original generated maps retain their renderer until product-owner visual approval of the sample and a separate rollout review.
- Verification: downloaded primary author pages and inspected actual PNG sheets before selection; TypeScript passed. Runtime screenshots/video and independent visual findings are recorded in the First Play integration evidence. These checks do not substitute for product-owner visual acceptance.

### Candidate comparison artwork (documentation only)

[Reference board](evidence/first-play/art-directions.png) assembles actual licensed tiles/frames from three independently downloaded CC0 packs. It is **an asset comparison, not a game screenshot**. [Provenance](evidence/first-play/art-directions-provenance.json) records authors, primary pages, archive hashes and composition changes.

- **0x72 Dungeon Tileset II v1.7**, Robert / 0x72: https://0x72.itch.io/dungeontileset-ii . Archive SHA-256 `a5b23341ebc831d7798bfb9666d864a08c079bb7aed18e3cf023a27d517c1512`. Only reference crops, no runtime files.
- **Ninja Adventure**, Pixel-Boy / AAA: same reviewed archive above.
- **Kenney Tiny Dungeon 1.0**, Kenney: https://kenney.nl/assets/tiny-dungeon and official creator mirror https://kenney-assets.itch.io/tiny-dungeon . Free archive `kenney_tinyDungeon.zip`, SHA-256 `c109438ab06f65fd80f9b2686a4cf9c7c11dc64444b47333ec71d602f8bb5fc7`. The canonical direct ZIP returned HTTP 403; the verified author's public itch mirror supplied the same titled pack and included CC0 notice. Only reference crops, no runtime files.

Board modifications: selected tiles/frames composited into labeled vignettes with integer nearest-neighbor enlargement, no recoloring. Source artists retain the voluntary credit. CC0 permits reuse, modification and redistribution, including this documentation artifact. A full CC0 text is stored beside the board. See [direction comparison and selection rationale](FIRST_PLAY_ART_DIRECTION.md).

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

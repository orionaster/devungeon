# Original HERO S1 artwork

`art.ts` contains original Devungeon pixel drawings authored by the HERO pixel-art Agent on 2026-11-13. They are expressed as integer canvas drawing operations, not imported image files or modifications of third-party artwork.

Copyright 2026 Devungeon contributors. Licensed under the repository's [Apache License 2.0](../../../LICENSE). The same license applies to the drawings and their rendered texture output. SPDX identifier: `Apache-2.0`.

No third-party sprites, fonts, sound, image bytes, copied game characters or reference screenshots are bundled. Kenney assets were considered in the project guidance but are not used in this implementation. The palette extends the original working palette in `docs/VISUAL_DIRECTION.md`.

The native grid is 16×16 pixels for floor, wall, trim and locked tiles, and 16×24 pixels for all transparent character/prop frames. Render sprites at 1×1.5 world units to preserve 16 source pixels per world unit. Characters expose four integer-pixel frames and front/back/left/right variants. `spriteTexture` and `tileTexture` cache their textures, set nearest sampling, disable mipmaps and use sRGB color. Tile textures can repeat; sprite textures keep transparent margins.

Artwork is a visual contribution, not evidence of gameplay validation or live Agent integration. Browser gameplay/camera captures and performance are validated separately by the HERO implementation task.

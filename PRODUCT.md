# Product

## Register

product

## Users

Creative coders, project owners and Agent teams who want to explore a project world, play, and briefly inspect or direct an Agent without leaving that world. Source: docs/PRD.md §§1, 6, 8.

## Product Purpose

A project-adaptive game-world platform with a useful shared Agent workspace. The first playable world is an original pixel dungeon; other world packs are future work, not a reason to replace this slice. A player selects a teammate, inspects attributable work, sends a supported scoped request, and returns to exploring. DEMO is always visible until a real connector proves the full execution loop. Gameplay cannot grant permissions or establish project acceptance. Source: ADR-0002 and PRD v1.3.

## Brand Personality

Playful, legible, candid. The approved reference is the top-down pixel-action genre feel described in docs/VISUAL_DIRECTION.md; its assets and exact UI must not be copied.

## Anti-references

A conventional full-screen project dashboard, copied game artwork, decorative fake work, game rewards presented as project acceptance, or simulated chat presented as a real Agent connection.

## Design Principles

- Keep the current game world present while inspecting work.
- Keep UI locale independent of world selection, project facts and Agent state.
- Use stable character identities and traceable sources.
- Offer only capabilities the adapter actually supports.
- Make leaving a conversation easy without stopping background work.
- Preserve the four isolated domains in docs/ARCHITECTURE.md.

## Accessibility & Inclusion

Readable semantic HTML overlays; normal-resolution text; keyboard selection and dismissal; explicit state text in addition to color; reduced motion. Desktop keyboard and pointer are the first target, with a responsive inspection view on narrow screens. Source: docs/PRD.md §8 and docs/VISUAL_DIRECTION.md.

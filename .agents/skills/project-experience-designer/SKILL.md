---
name: project-experience-designer
description: Use when suggesting, selecting, previewing or validating different world forms and gameplay modes for Devungeon projects, beyond the first pixel-dungeon pack.
---
# Project-adaptive Experience Designer

Read docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md, docs/PRD.md, docs/I18N.md, schema/world-experience.schema.json and docs/ACCEPTANCE.md before changes.

## Inputs and decision
1. Receive an explicitly selected project and permitted purpose, UI/brand/design signals, audience, feature/dependency graph and creator preferences. Record source/provenance and separate declared, observed, synthetic and inferred signals; do not infer hidden product facts.
2. Suggest 1–3 fitting **world forms**, each with a short grounded reason and the specific **gameplay interaction** it would provide if implemented. A city is not a dungeon reskinned.
3. Make an explicit distinction between **available installed pack**, **experimental prototype** and **proposal only**. Never claim a city/space/museum game works from a JSON fixture.
4. Let user inspect/override the suggestion. No forced mapping from industry label, project name, Chinese/English locale, programming language or country to one world form.
5. Emit only a schema-valid optional WorldExperience proposal, not arbitrary executable code. AI cannot install a plugin, fetch unapproved private sources, grant Agent privileges or mark real features accepted.

## Compatibility and game state
- Existing ProjectSnapshot, WorldBlueprint v1 and AgentEvents are stable while S1–S4 integration proceeds.
- Preserve original source IDs, dependencies, evidence, approvals, task states and Agent connections across visual changes.
- Maintain separate game-only save namespaces per pack; warn on mode switch and confirm incompatible game progress loss/restore.
- Different packs may have different cameras, graphics and gameplay loops while preserving shared work inspector and trust boundaries.
- Missing/invalid/uninstalled pack yields factual graph/text fallback, never pretend playable geometry.

## Evidence and handoff
- Update both synthetic proposal fixtures and validate against the sidecar schema.
- Add tests for source linkage, language/selection independence, manual override, invalid/unsupported packs, truth invariance.
- A real second world requires actual browser proof of different mechanic, not screenshots, a list of theme names, or a mock.
- Do not rewrite the existing pixel dungeon to anticipate every hypothetical game genre.

Skills: the pixel-dungeon-visuals Skill is only for the **first pixel pack**, not a universal requirement.

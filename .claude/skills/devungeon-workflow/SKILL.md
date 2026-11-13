---
name: devungeon-workflow
description: Use on any Devungeon implementation or PR review involving pixel-art gameplay, project-to-world mapping, Agent integration, browser validation, or third-party dependencies. Routes to the canonical project task skills.
---
# Devungeon Workflows (Claude Code entrypoint)

This Skill is intentionally a **dispatcher**, not a duplicate skill manual.

1. Read root AGENTS.md and docs/PRD.md, docs/VISUAL_DIRECTION.md, docs/ARCHITECTURE.md, docs/ACCEPTANCE.md.
2. Select and read the most relevant canonical Skill(s) from:
   - .agents/skills/pixel-dungeon-visuals/SKILL.md
   - .agents/skills/playable-browser-validation/SKILL.md
   - .agents/skills/project-world-compiler/SKILL.md
   - .agents/skills/agent-event-adapters/SKILL.md
   - .agents/skills/dependency-due-diligence/SKILL.md
   - .agents/skills/in-world-agent-workspace/SKILL.md
3. Follow the selected skill before implementing, testing and documenting. Do not re-interpret these instructions as permission to run new Skills, download assets, connect accounts or modify private Crew.
4. Keep changes scoped to your assigned Issue and branch. Report actual validation, unverified areas and reviewable evidence.

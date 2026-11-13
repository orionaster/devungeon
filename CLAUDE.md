# Devungeon instructions for Claude Code

Start with AGENTS.md and docs/PRD.md. The approved product direction is **project-adaptive, selectable game worlds**, specified in docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md. The **first shipped pack** remains an original 2.5D top-down pixel dungeon (docs/VISUAL_DIRECTION.md), not a universal style for every product. Never copy Soul Knight assets or misrepresent unimplemented alternative packs as playable.

Read docs/TOOLS_AND_SKILLS.md before selecting packages/tools or installing third-party Agent Skills. Read docs/ASSET_PROVENANCE.md before importing artwork/audio.

Repo-specific canonical Skills are in .agents/skills/**/SKILL.md. Claude Code's local discovery entrypoint is .claude/skills/devungeon-workflow/SKILL.md; use it to select the appropriate canonical workflow, not to skip its checks.

Independent project from private Crew: no private code, issue bodies, credentials or logs. Do not auto-install hooks, MCPs, paid services or global tools. All external Agent commands and production actions require correct permissions and separate approval.

Follow GitHub Issues; use distinct branches/PRs for concurrent tasks. Integration requires real browser, playable combat, true project evidence, and no confusion between in-game victory and software acceptance.

Use the project-experience-designer Skill for world recommendations, pack selection and cross-mode invariants. UI language selection (docs/I18N.md) is separate from world-type choice. Do not rewrite first-wave HERO/BUILDER code solely to introduce imagined modes.

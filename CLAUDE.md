# Devungeon instructions for Claude Code

Start with AGENTS.md and docs/PRD.md. The approved signature visual direction is **original 2.5D top-down pixel-art dungeon**, specified in docs/VISUAL_DIRECTION.md. Do not ship generic smooth 3D cartoon assets as the default theme or copy *Soul Knight* game assets.

Read docs/TOOLS_AND_SKILLS.md before selecting packages/tools or installing third-party Agent Skills. Read docs/ASSET_PROVENANCE.md before importing artwork/audio.

Repo-specific canonical Skills are in .agents/skills/**/SKILL.md. Claude Code's local discovery entrypoint is .claude/skills/devungeon-workflow/SKILL.md; use it to select the appropriate canonical workflow, not to skip its checks.

Independent project from private Crew: no private code, issue bodies, credentials or logs. Do not auto-install hooks, MCPs, paid services or global tools. All external Agent commands and production actions require correct permissions and separate approval.

Follow GitHub Issues; use distinct branches/PRs for concurrent tasks. Integration requires real browser, playable combat, true project evidence, and no confusion between in-game victory and software acceptance.

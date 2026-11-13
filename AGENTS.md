# Instructions for coding agents

1. Start with `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/ACCEPTANCE.md`.
2. This repository is **independent of Crew**. Do not copy private Crew code, secrets, issues, logs, prompt histories or internal business data into public commits. Use synthetic examples only.
3. Keep the **project truth**, **world representation**, **Agent commands**, and **game state** isolated. In-game victory must never write project acceptance status.
4. Prefer mature, maintained, appropriately licensed packages and asset packs. Record dependency/license decisions before reuse.
5. Build vertical working functionality and validate with real browser/gameplay interaction; don't call mock data a real integration.
6. Use schema validation, stable IDs, deterministic world generation, incremental updates and source provenance.
7. Never give client JS raw API keys. External writes, credential access, destructive actions, production changes and publication require explicit approval and auditable scope.
8. Every feature PR should state: user-facing behavior, affected rules, actual tests and outcomes, limitations, risks and screenshots/video when relevant.
9. Keep public docs honest about which features are demo, experimental, or verified end-to-end.
10. Don't add paid services, upload repository data, open public deployments or change licenses without owner approval.

11. The approved **visual direction is original top-down 2.5D pixel-art dungeon**, with genuine 3D room space. Read docs/VISUAL_DIRECTION.md before scene, camera, sprite or combat work. Refer to *Soul Knight* only for genre feel; never copy its assets/UI/music/rooms.
12. Read docs/TOOLS_AND_SKILLS.md and docs/ASSET_PROVENANCE.md before adding dependencies or art. Prefer verified source licenses and stable compatible versions; do not install third-party Skills, MCP servers or hooks by default.
13. Repository task Skills live in .agents/skills/*/SKILL.md; Claude Code has a router in .claude/skills/devungeon-workflow/SKILL.md and CLAUDE.md. Choose the relevant Skill and follow its real-browser proof requirements.

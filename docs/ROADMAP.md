# Devungeon — execution roadmap

The PRD v1.3 + ADR-0002 are the **complete current agreed vision**. These are implementation checkpoints, not scope cuts.

| Stage | Deliverable | Done means |
|---|---|---|
| S0 Design & foundations | PRD, schemas, synthetic examples, decision log, repo | All documents present; examples validate; no fake runnable claim |
| S1 Playable world | Original 2.5D **pixel-art dungeon**, true 3D room layout, moving player, camera, real collisions, locked room, independent combat, Agent actor & inspection UI | A person can play an entire pixel-dungeon encounter in a browser, not just watch a video; camera/sprite/asset rights checked |
| S2 Project compiler | Generic semantic graph + first dungeon-specific deterministic generator, persistence, incremental updates | Different projects build consistent playable dungeon maps now; preserve an explicit future world-pack boundary |
| S3 Live observability | Real project source + real Agent activity, event provenance, pause/reconnect/replay | Evidence-linked events cause actual screen changes; simulated data marked |
| S4 Workspace loop | Supervisor/worker status, two-way Agent chat, bounded commands, approval, audit | User sends a real supported instruction; execution result and source evidence appear in world |
| S5 V1 release | Polished game + full current feature scope, real source integration, one second verified experience mode, CI/security and honest demo | PRD acceptance items incl. genuine world choice and two distinct playable mechanics met |

## Suggested first three GitHub issues

1. **World truth and schema tests** — package versioned `ProjectSnapshot` / event contracts; validate two very different example projects.
2. **Playable 3D vertical slice** — start screen → move → fight → inspect Agent → view locked area but cannot enter, with clear `DEMO` state.
3. **Real adapter integration spike** — evaluate first real Agent event stream and one read-only real project connector with provenance and security.

No promises of completion dates. Prefer vertical product experiments over creating many untested packages at once.

## Reuse and agent roles (2026-11-13)

Use docs/TOOLS_AND_SKILLS.md for evaluated libraries and the expected first-slice technology. Skills are stored in .agents/skills/, with Claude Code routing under .claude/skills/. S1/S2/S3 can proceed independently after agreeing on the existing schema; S4 may work on interface/mock interactions in parallel, but genuine commands depend on an audited S3 connector. Review and merge changes by isolated PR, with actual browser evidence before claiming a gameplay milestone complete.


## Project-adaptive experience plan (ADR-0002)

- **Do not interrupt first-wave branches #6–#9.** Integrate the existing playable pixel dungeon + generator + live observation + workbench first (Issue #12).
- Define an optional experience manifest and creator-override UI; no breaking changes to existing ProjectSnapshot, AgentEvent or WorldBlueprint v1 before integration.
- Turn HERO into the initial world pack; preserve pixel controls and collision. BUILDER maintains an explicit boundary between the semantic graph and dungeon-layout adapter.
- Then validate a **second genuinely different world** (candidate: simple city-build/explore). Compare identical source graph, project facts, Agent event display and authority across both modes.
- Treat not-yet-built worlds as selectable *ideas only*, never as a fake installed/working game. See docs/ADR-0002-PROJECT-ADAPTIVE-WORLDS.md.

UI zh-CN/en-US locale (Issue #10) is a separate concern from product design language and chosen world type.

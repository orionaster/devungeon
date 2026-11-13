# Devungeon — execution roadmap

The PRD v1.0 is the **complete current agreed vision**. These are implementation checkpoints, not scope cuts.

| Stage | Deliverable | Done means |
|---|---|---|
| S0 Design & foundations | PRD, schemas, synthetic examples, decision log, repo | All documents present; examples validate; no fake runnable claim |
| S1 Playable world | Original 2.5D **pixel-art dungeon**, true 3D room layout, moving player, camera, real collisions, locked room, independent combat, Agent actor & inspection UI | A person can play an entire pixel-dungeon encounter in a browser, not just watch a video; camera/sprite/asset rights checked |
| S2 Project compiler | Graph import, AI world design proposal, deterministic procedural generation, persistence, incremental updates | Two different project structures build distinct, consistent dungeons with stable room identities |
| S3 Live observability | Real project source + real Agent activity, event provenance, pause/reconnect/replay | Evidence-linked events cause actual screen changes; simulated data marked |
| S4 Workspace loop | Supervisor/worker status, two-way Agent chat, bounded commands, approval, audit | User sends a real supported instruction; execution result and source evidence appear in world |
| S5 V1 release | Polished game + full current feature scope, CI and security hardening, open-source release & honest demo | PRD acceptance items met; verified compatibility, reproducible setup, accessible gameplay |

## Suggested first three GitHub issues

1. **World truth and schema tests** — package versioned `ProjectSnapshot` / event contracts; validate two very different example projects.
2. **Playable 3D vertical slice** — start screen → move → fight → inspect Agent → view locked area but cannot enter, with clear `DEMO` state.
3. **Real adapter integration spike** — evaluate first real Agent event stream and one read-only real project connector with provenance and security.

No promises of completion dates. Prefer vertical product experiments over creating many untested packages at once.

## Reuse and agent roles (2026-11-13)

Use docs/TOOLS_AND_SKILLS.md for evaluated libraries and the expected first-slice technology. Skills are stored in .agents/skills/, with Claude Code routing under .claude/skills/. S1/S2/S3 can proceed independently after agreeing on the existing schema; S4 may work on interface/mock interactions in parallel, but genuine commands depend on an audited S3 connector. Review and merge changes by isolated PR, with actual browser evidence before claiming a gameplay milestone complete.

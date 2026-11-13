---
name: in-world-agent-workspace
description: Use when implementing in-world supervisor and worker Agent status panels, conversation, task commands, approvals, audit logs and authorization boundaries.
---
# In-World Agent Workspace

Read docs/PRD.md, docs/ARCHITECTURE.md, docs/ACCEPTANCE.md and current S4 GitHub Issue.

## UX contract
- A user may approach or click a sprite/NPC, see stable identity, real role, current task, last-seen freshness, provider source and evidence.
- Chat or commands must be **disabled or clearly DEMO** until a live adapter supports the capability.
- The browser submits an explicit scoped request to the trusted bridge; the bridge checks project, target Agent, capability, requester authority, idempotency and approval requirements.
- Destructive, externally published, paid, secret/credential or production actions need specific user approval; game attack, moving near the Agent or defeating a monster must not authorize anything.
- Provide commands only if the actual Agent integration supports them; don't simulate execution as a real successful operation.
- Separate gameplay UI state from project truth, approvals and agent operation state. A player death cannot cancel a real task.

## Acceptance
1. At least one authorized connector can acknowledge a request, perform its bounded action and show actual source evidence in the panel.
2. Forbidden/unsupported/unconnected calls must not execute and must show an honest error.
3. Audit includes request ID, requester, scope, outcome, source and approval status, without raw tokens.
4. DEMO, replay, disconnected, stale and live states are visually distinct in world and panel.

## Multi-world rule (ADR-0002)
The Agent workbench must remain independent of dungeon combat and rendering metaphors. A city builder, space station or museum may host the same Agent IDs, status, safe commands and provenance; a world-type or UI-locale switch cannot revoke approvals, issue commands or fabricate task changes.

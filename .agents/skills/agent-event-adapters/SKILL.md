---
name: agent-event-adapters
description: Use when integrating GitHub facts, Claude Code or Codex activity, local agent logs, replay, event provenance, bridge services, or event-to-character animations.
---
# Truthful Agent Event Adapters

Read docs/ARCHITECTURE.md, docs/PRD.md, docs/ACCEPTANCE.md and docs/TOOLS_AND_SKILLS.md.

## Scope and trust
- Start with one explicitly selected **read-only** project source, then one opt-in local Agent event observer; never silently install global hooks or upload traces.
- Distinguish source observations, inferred display projections, unknowns and DEMO scripts. Every event should have source, observed time, project/agent/task stable IDs, idempotency key and replay/live status.
- Redact API keys, file contents, chat transcripts, PII and command arguments not necessary for the approved visualization. Keep tokens server-side/local bridge only.
- Prefer stable official APIs and available event formats; Claude hooks are optional, Codex app-server command transport is an experimental future adapter. Evaluate Agenttrail as reusable prior art but do not blindly copy.
- Handle dropped/out-of-order/duplicate events, stale data, reconnect and unknown provider state. A silent stream must not imply ongoing work.
- No approval, source write or execution from a display-only adapter.

## Evidence
- Reproduce real non-sensitive event → bridge → valid semantic event → actual in-browser Agent action and evidence link.
- Demonstrate blocked/unavailable and DEMO states clearly. A task "done" event is NOT product acceptance.
- Test attempts to exfiltrate credentials and unsupported commands: deny and do not execute.
- Obtain explicit scoped owner authorization before touching private Crew, live production environments or accounts.

References:
- https://docs.github.com/en/webhooks/webhook-events-and-payloads
- https://code.claude.com/docs/en/hooks
- https://learn.chatgpt.com/docs/app-server

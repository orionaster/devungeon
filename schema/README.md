# Protocol draft v1

`project-snapshot.schema.json`: normalized project capabilities and verifiable statuses.  
`world-blueprint.schema.json`: generated spatial layout and theme.  
`agent-event.schema.json`: live/recorded Agent actions with timestamps and synthetic flag.  
`game-state.schema.json`: player-only game progression, deliberately disallowing task acceptance and authorization.

These are **draft schemas** to guide first implementation, not a claim of a finished integration or stable public API. Cross-entity referential integrity, event deduplication, state transitions, authority and source reconciliation require application-level validation.

SCOUT's read-only v1 output additionally requires `task_id`, `status`,
`source_kind`, `idempotency_key` and `source_ref`. The AgentEvent schema accepts
the four new fields additively so legacy synthetic v1 fixtures still validate.
Transport mode/cursor are outside the event in the SSE/history envelope; replay
never changes original `is_demo`. See [consumer contract](../docs/SCOUT-INTEGRATION.md).

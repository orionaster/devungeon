# Protocol draft v1

`project-snapshot.schema.json`: normalized project capabilities and verifiable statuses.  
`world-blueprint.schema.json`: generated spatial layout and theme.  
`agent-event.schema.json`: live/recorded Agent actions with timestamps and synthetic flag.  
`game-state.schema.json`: player-only game progression, deliberately disallowing task acceptance and authorization.

These are **draft schemas** to guide first implementation, not a claim of a finished integration or stable public API. Cross-entity referential integrity, event deduplication, state transitions, authority and source reconciliation require application-level validation.

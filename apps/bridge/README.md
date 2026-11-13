# SCOUT read-only local bridge

Node >=24.13. `npm ci --ignore-scripts`, then `npm start` and open
<http://127.0.0.1:4313>. No account, provider API key or GitHub token is required.

- [Consumer contracts and opt-in metadata capture](../../docs/SCOUT-INTEGRATION.md)
- [Reproducible verification and limitations](../../docs/SCOUT-VALIDATION.md)
- [Connector research](../../docs/SCOUT-RESEARCH.md)
- [Pinned dependency/license decision](../../docs/SCOUT-DEPENDENCIES.md)
- [Wave 2 host integration, evidence and remaining gates](../../docs/SCOUT-WAVE2.md)

Offline: `npm run check` and `npm test`. Explicit public network probe:
`npm run verify:live` (GitHub anonymous limits apply).
Running selected same-origin host: `npm run verify:host -- http://127.0.0.1:4178 http://127.0.0.1:4318`.

This is an event inspector and adapter service, not the playable dungeon. No
Claude/Codex/Crew account is connected; commands and approvals are unavailable.

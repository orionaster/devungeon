# Documentation/protocol validation — 2026-11-13

Command executed in this working container:

```bash
python scripts/validate_examples.py
```

Result: **PASS**, with the locally installed `jsonschema` package, for:

- two synthetic ProjectSnapshot fixtures (a tiny landing page and a distinct multi-zone Agent project),
- one WorldBlueprint fixture,
- one AgentEvent fixture,
- one GameState fixture,
- cross-reference and basic DAG/integrity checks for these examples.

**Not tested / not implemented**: React/Three 3D runtime, character controls or combat, procedural layout algorithm, true GitHub ingestion, real Agent events or commands, approvals, live chat, replay UI, desktop FPS, browser compatibility. No runtime work should be claimed on the strength of schema validation.

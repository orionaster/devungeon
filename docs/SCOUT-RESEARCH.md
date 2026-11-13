# S3 connector research and decisions

Reviewed 2026-11-13. Primary-source research, not proof of connected providers.

| Candidate | Reuse decision | Permissions, reliability and license |
|---|---|---|
| GitHub REST / webhooks | Anonymous public REST first; use native fetch. Webhooks deferred because they need repository configuration and reachable delivery. | Public GET needs no login. Anonymous quota is 60 requests/hour/IP; default 180-second polling uses ~40/hour for a one-page repository. ETag reduces bandwidth, but anonymous 304 is not assumed quota-free. Follow numbered pages on the fixed API host, bound pages, retain last good snapshot on error, honor limit reset/Retry-After. No API implementation is vendored. |
| Claude Code hooks | Pure metadata mapper + optional stdin filter, no installation. | Official lifecycle/tool events are useful but stdin includes sensitive paths/tool input. Keep hashed identity, event kind and receipt time only. Never open transcript_path. SessionStart is idle, Stop/tool completion never accepted. Per-project or single-invocation settings must be explicitly selected; no global hooks. Proprietary CLI is neither installed nor redistributed by this PR. |
| Codex App Server | Pure allowlisted notification mapper; defer process/transport/account connection. | Official thread/turn/item protocol is rich enough for future observation/control separation. Stdout carries more than safe metadata; discard command/output/message content and do not reply to approval requests. Provider integration/version and authorization need separate validation. Open-source Codex is Apache-2.0; no code is vendored here. |
| Agenttrail | Prior art only; do not install or fork the daemon. | Upstream manifest 0.4.1, MIT, Node >=20. README describes automatic Claude/Codex local log observation, optional hooks/autostart, Windows untested and retired Kitchen. Default private log discovery exceeds this task's authorization. Reuse the local-first and correlation ideas rather than importing its access surface. |
| OpenTelemetry GenAI | Vocabulary reference and future mapping, no collector/SDK dependency. | Current GenAI conventions live in a separate Apache-2.0 repository and remain Development. Agent identity, operation and trace correlation are useful; message/tool payload capture is unnecessary and potentially sensitive. No OTLP export or telemetry. |

Primary sources:

- [GitHub Issues list (includes PRs)](https://docs.github.com/en/rest/issues/issues#list-repository-issues),
  [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
  [best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api),
  [pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api).
- [Claude hooks](https://code.claude.com/docs/en/hooks),
  [CLI flags](https://code.claude.com/docs/en/cli-reference). `--init-only` offers
  a future session-lifecycle probe without starting conversation; account-free
  operation on this installed CLI has **not** been tested. It does not prove tool
  execution. A hand-written hook payload is synthetic, even if the mapper works.
- [Codex App Server protocol](https://learn.chatgpt.com/docs/app-server),
  [Codex source/license](https://github.com/openai/codex).
- [Agenttrail README](https://github.com/sodiumsun/agenttrail/blob/main/README.md),
  [manifest](https://github.com/sodiumsun/agenttrail/blob/main/package.json),
  [MIT license](https://github.com/sodiumsun/agenttrail/blob/main/LICENSE),
  [ingest protocol](https://github.com/sodiumsun/agenttrail/blob/main/docs/INGEST.md).
- [GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/README.md),
  [Agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md).

Selected actual chain: public GitHub → normalized project facts/events → local
journal/SSE → browser inspector; explicitly instrumented SCOUT read-only Git
action → selected metadata file → Agent adapter → same browser. This is the
research stop condition. No claim of a provider subscription or game integration.

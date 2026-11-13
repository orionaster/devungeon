# S3 dependency decision — 2026-11-13

Scope: read-only public GitHub import, explicitly selected local metadata log,
loopback SSE, schema validation. No cloud telemetry, account integration, global
hooks or MCP installation. Research stops at the verified vertical slice.

- Node 24 built-in HTTP/fetch/crypto/fs/test/TypeScript stripping: reuse the
  installed runtime; no HTTP framework, database, SSE library or executable plugin.
- Ajv 8.20.0 + ajv-formats 3.0.1 (MIT): validate existing Draft 2020-12 JSON
  schemas directly instead of maintaining a separate Zod schema. Official sources:
  <https://ajv.js.org/json-schema.html>, <https://github.com/ajv-validator/ajv>,
  <https://github.com/ajv-validator/ajv-formats>. Runtime transitive manifests and
  npm audit are checked after lockfile installation; retain package notices.
- TypeScript 5.9.3 (Apache-2.0), @types/node 24.13.2 (MIT): development-only
  type checking, pinned known TS 5.9 instead of adopting a major toolchain upgrade.
- Rejected for this slice: Octokit (two fixed public REST endpoints do not need
  authenticated SDK machinery), Express (only fixed GET routes), SQLite (bounded
  append-only local journal suffices), Agenttrail installation (would expand
  private log access), OTLP collector/SaaS (unnecessary external data movement).

All additions are local to apps/bridge with an exact package-lock.json, avoiding
unrelated frontend/workspace tooling. Rollback: stop the bridge, remove its
ignored .devungeon-scout directory and opt-in metadata file, revert this PR.
Nothing is installed globally. No art is imported.

Installed lockfile review on Windows / Node 24.13.1 / npm 11.8.0:

| Package | Resolved version | License |
|---|---|---|
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| json-schema-traverse | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |
| typescript (dev) | 5.9.3 | Apache-2.0 |
| @types/node (dev) | 24.13.2 | MIT |
| undici-types (dev) | 7.18.2 | MIT |

`npm install --ignore-scripts` audited 10 packages with 0 reported vulnerabilities.
Package-installed LICENSE/notice files remain in node_modules; no dependency
source is vendored. The runtime is not bundled into a public binary. Browser QA
used the official Apache-2.0 `@playwright/cli@0.1.24` through npx, no global install
or permanent project dependency. Type checking and offline tests passed on the
installed runtime; Linux/Windows CI is configured separately, not assumed passed.

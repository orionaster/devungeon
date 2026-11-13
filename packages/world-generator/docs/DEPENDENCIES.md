# Dependency decision — 2026-11-13

Scope: the S2 compiler; no paid services, third-party art, hooks or MCP installed.
Research stops at a working generator and measured fixture/property checks.

| Choice | Exact version / license | Fit and limitation |
| --- | --- | --- |
| [rot.js](https://github.com/ondras/rot.js) | 2.2.1 / BSD-3-Clause | Mature, dependency-free roguelike library; reuse four-neighbor A* for actual tile corridors/navigation. npm's last modification is 2024-11-13: stable but not evidence of recent maintenance. Digger/Uniform full-map regeneration cannot promise pinned feature rooms, so do not use them for placement. |
| [Ajv](https://ajv.js.org/json-schema.html) + ajv-formats | 8.20.0 + 3.0.1 / MIT | Validate the canonical Draft 2020-12 schemas using Ajv2020 and date-time formats. Avoid duplicating the schemas in Zod. |
| [Dagre](https://github.com/dagrejs/dagre) | not installed / MIT | Useful graph drawings; global rank/layout changes do not preserve saved room geometry and do not provide tile collisions. |
| [LDtk](https://ldtk.io/) | not installed / MIT editor | Valuable authored maps; not needed to compile arbitrary project graphs or maintain pinned runtime layouts. |
| TypeScript / Vite / Vitest / fast-check | 7.0.2 Apache-2.0 / 8.3.8 MIT / 5.1.0 MIT / 4.10.2 MIT | Node 24-compatible build, local browser navigation harness, deterministic/property checks. No extra test framework for the renderer. |

Package-local lockfile isolates HERO/SCOUT toolchains. Install uses `--ignore-scripts`;
the code needs no install hooks. Audit exact transitive licenses with `npm run licenses`
and advisories with `npm audit`. Redistribution retains upstream package LICENSE files;
rot.js's full BSD notice is reproduced in THIRD_PARTY_NOTICES.md. No artwork is imported.

The inspected Windows tree has 48 packages under MIT, BSD-3-Clause, ISC,
Apache-2.0 and **MPL-2.0**. MPL applies to unmodified `lightningcss` and its native
binding, pulled in by the Vite **development/build toolchain**. They are not
vendored or shipped in the browser runtime bundle. Their source/license remains
available at [parcel-bundler/lightningcss](https://github.com/parcel-bundler/lightningcss).
No package license was changed. Rolldown's platform binary omits a duplicate
license file; the script records the installed same-version parent MIT notice
and its bundled THIRD-PARTY-LICENSE rather than claiming a nonexistent file.

Rollback: remove this isolated package/workflow; no root protocol migrations, external
accounts or persisted permissions were introduced. Upgrading the placement algorithm
requires an explicit generator-version migration; silently re-laying an old world fails.

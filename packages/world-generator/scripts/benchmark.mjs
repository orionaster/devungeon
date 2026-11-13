import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { compileWorld } from '../dist/index.js';
const cases = [];
for (const name of ['tiny-landing-page', 'agent-workbench-synthetic']) {
  const snapshot = JSON.parse(await readFile(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
  const times = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now(), result = compileWorld(snapshot, { seed: 1337 });
    if (!result.ok) throw Error(JSON.stringify(result));
    if (i >= 5) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  cases.push({ name, measured_runs: times.length, median_ms: times[12], p95_ms: times[23], max_ms: times.at(-1) });
}
await mkdir(new URL('../output/', import.meta.url), { recursive: true });
const report = { node: process.version, platform: process.platform, arch: process.arch, methodology: 'In-process compileWorld only; module import/Ajv schema initialization excluded. Five warm-up runs, then 25 measurements. No disk/network/rendering included.', cases };
await writeFile(new URL('../output/benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

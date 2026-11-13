import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { compileWorld } from './index.js';
import type { Bounds } from './types.js';

async function readJson(path: string): Promise<unknown> {
  if ((await stat(path)).size > 10_000_000) throw Error(`Input exceeds 10 MB: ${path}`);
  return JSON.parse(await readFile(path, 'utf8'));
}
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    seed: { type: 'string' }, previous: { type: 'string' }, designer: { type: 'string' }, bounds: { type: 'string' }, out: { type: 'string' }, 'save-layout': { type: 'string' }, help: { type: 'boolean' }
  } });
  if (values.help) {
    console.log('node dist/cli.js SNAPSHOT.json --seed INTEGER [--previous LAYOUT.json] [--designer PROPOSAL.json] [--bounds BOUNDS.json] [--out WORLD.json] [--save-layout LAYOUT.json]');
  } else {
    if (positionals.length !== 1 || !values.seed || !/^-?\d+$/.test(values.seed)) throw Error('Supply one snapshot JSON and --seed INTEGER. Use --help for syntax.');
    const result = compileWorld(await readJson(positionals[0]!), {
      seed: Number(values.seed),
      ...(values.previous ? { previous: await readJson(values.previous) } : {}),
      ...(values.designer ? { designer: await readJson(values.designer) } : {}),
      ...(values.bounds ? { bounds: await readJson(values.bounds) as Bounds } : {})
    });
    if (!result.ok) { console.error(JSON.stringify(result, null, 2)); process.exitCode = 1; }
    else {
      const serialized = JSON.stringify(result.world, null, 2) + '\n';
      if (values.out) await writeFile(values.out, serialized); else process.stdout.write(serialized);
      if (values['save-layout']) await writeFile(values['save-layout'], JSON.stringify(result.world.layout, null, 2) + '\n');
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2;
}

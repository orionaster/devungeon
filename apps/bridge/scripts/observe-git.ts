/** Actual bounded SCOUT work instrument; not a Claude/Codex provider connection. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Metadata } from '../../../packages/agent-adapters/metadata.ts';
const exec = promisify(execFile);
const [repository, output, task_id] = process.argv.slice(2);
if (!repository || !output || !/^github:issue:\d+$/.test(task_id ?? '') || process.argv.length !== 5) throw new Error('Usage: node scripts/observe-git.ts <public-devungeon-checkout> <metadata-file> <snapshot-room-id>');
const cwd = resolve(repository);
const remote = (await exec('git', ['remote', 'get-url', 'origin'], {cwd, timeout: 5000})).stdout.trim();
if (remote !== 'https://github.com/orionaster/devungeon.git') throw new Error('This proof instrument permits only the selected public Devungeon repository');
const session = randomUUID(), action = randomUUID();
const emit = async (kind: Metadata['kind'], evidence_ref?: string) => {
  const event: Metadata = {id: action, session, actor: 'scout', project_id: 'github:orionaster/devungeon', task_id, kind, occurred_at: new Date().toISOString(), producer: 'scout-local', is_demo: false, ...(evidence_ref ? {evidence_ref} : {})};
  await appendFile(resolve(output), `${JSON.stringify(event)}\n`, {mode: 0o600});
};
await emit('tool_start');
try {
  const head = (await exec('git', ['rev-parse', '--verify', 'HEAD'], {cwd, timeout: 5000})).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('Invalid HEAD');
  await emit('tool_end', `https://github.com/orionaster/devungeon/commit/${head}`);
  console.log(`Observed real read-only Git action; source commit ${head}. No product acceptance asserted.`);
} catch { await emit('failed'); process.exitCode = 1; }

/** Optional stdin metadata filter. Never installs hooks or opens provider transports. */
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { claudeHookMetadata, codexNotificationMetadata } from '../../../packages/agent-adapters/providers.ts';
import { normalizeMetadata } from '../../../packages/agent-adapters/metadata.ts';
const [provider, file, project_id, task_id, label] = process.argv.slice(2);
if (!['claude-hooks', 'codex-app-server'].includes(provider) || !file || !project_id || !task_id || !['DEMO', 'LIVE'].includes(label) || process.argv.length !== 7) throw new Error('Usage: node scripts/capture-provider.ts claude-hooks|codex-app-server <metadata-file> <project-id> <task-id> DEMO|LIVE');
let body = '';
for await (const chunk of process.stdin) {
  body += chunk.toString('utf8'); if (Buffer.byteLength(body) > 64000) throw new Error('Input too large');
}
const scope = {project_id, task_id, is_demo: label === 'DEMO'};
const metadata = (provider === 'claude-hooks' ? claudeHookMetadata : codexNotificationMetadata)(JSON.parse(body), scope);
if (metadata) { normalizeMetadata(metadata, project_id); await appendFile(resolve(file), `${JSON.stringify(metadata)}\n`, {mode: 0o600}); }

import { resolve, join } from 'node:path';
import { GithubProjectAdapter } from '../../../packages/project-adapters/github.ts';
import { MetadataAgentAdapter } from '../../../packages/agent-adapters/metadata.ts';
import { Bridge } from './bridge.ts';
import { createBridgeServer } from './server.ts';

const args = process.argv.slice(2);
const options = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  if (!['--repo', '--data', '--agent-file', '--port'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw new Error('Usage: npm start -- [--repo owner/name] [--data directory] [--agent-file metadata.jsonl] [--port 4313]');
  options.set(args[i], args[i + 1]);
}
const project = new GithubProjectAdapter(options.get('--repo'));
const data = resolve(options.get('--data') ?? join('.devungeon-scout', project.repository.replace('/', '_')));
const file = options.get('--agent-file');
const bridge = new Bridge(project, data, file ? new MetadataAgentAdapter(project.projectId, resolve(file)) : undefined);
const port = Number(options.get('--port') ?? 4313);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
await bridge.init();
const server = createBridgeServer(bridge);
server.on('error', async () => { await bridge.close(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => { console.log(`SCOUT read-only bridge: http://127.0.0.1:${port} (${project.projectId})`); bridge.start(); });
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
  if (stopping) return; stopping = true;
  server.close(); await bridge.close();
});

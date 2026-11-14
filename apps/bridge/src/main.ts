import { resolve, join } from 'node:path';
import { GithubProjectAdapter } from '../../../packages/project-adapters/github.ts';
import { MetadataAgentAdapter } from '../../../packages/agent-adapters/metadata.ts';
import { Bridge } from './bridge.ts';
import { createBridgeServer } from './server.ts';

const args = process.argv.slice(2);
// Remember supervision before any await: Node may remove process.send when
// the parent disconnects while the journal is still opening.
const supervised = typeof process.send === 'function';
let shutdownRequested = false;
let requestShutdown = () => { shutdownRequested = true; };
// Register before journal initialization. Parent shutdown/death during an fs
// await must be remembered, rather than losing the only lifecycle message.
process.on('message', message => { if (message === 'devungeon:shutdown') requestShutdown(); });
process.on('disconnect', () => requestShutdown());
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
let closing: Promise<void> | undefined;
function close(code = 0) {
  process.exitCode = Math.max(Number(process.exitCode ?? 0), code);
  if (closing) return closing;
  closing = (async () => {
    console.log('SCOUT stopping: closing local connections');
    // createBridgeServer closes its own SSE clients before the HTTP listener.
    await new Promise<void>(done => server.close(() => done()));
    console.log('SCOUT stopping: releasing journal');
    await bridge.close();
    console.log('SCOUT stopped: journal released');
    if (process.connected) process.disconnect();
    process.exit(process.exitCode ?? 0);
  })().catch(error => { console.error(error.message); process.exit(1); });
  return closing;
}
server.on('error', () => { void close(1); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void close(); });
// Private parent lifecycle channel; never a browser/Agent command endpoint.
requestShutdown = () => { shutdownRequested = true; void close(); };
if (shutdownRequested || supervised && !process.connected) await close();
else server.listen(port, '127.0.0.1', () => {
  console.log(`SCOUT read-only bridge: http://127.0.0.1:${port} (${project.projectId})`);
  bridge.start();
});

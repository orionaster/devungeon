import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer, preview as createPreview } from 'vite';

// Fixed public source. No credential discovery, provider process or command channel.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--preview', '--external-bridge'].includes(arg))) throw new Error('Usage: npm run dev -- [--external-bridge] or npm run preview');
const preview = args.includes('--preview');
const external = args.includes('--external-bridge');
const port = Number(process.env.DEVUNGEON_PORT ?? 5173);
const bridgePort = Number(process.env.DEVUNGEON_SCOUT_PORT ?? 4313);
for (const value of [port, bridgePort]) if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error('Invalid loopback port');
if (!external && port === bridgePort) throw new Error('UI and bridge require distinct loopback ports');
// An explicit directory selects a separate local journal; never remove stale
// locks or change another instance's directory to make startup succeed.
const data = resolve(root, process.env.DEVUNGEON_DATA_DIR ?? '.devungeon-scout/forge');
if (!external) await mkdir(data, { recursive: true });
let bridgeChild;
let host;
let stopping = false;
let stopPromise;
const exited = child => child.exitCode !== null || child.signalCode !== null;
const waitExit = child => exited(child) ? Promise.resolve() : new Promise(done => child.once('exit', done));
function bounded(promise, ms) {
  let timer;
  return Promise.race([
    promise.then(() => true),
    new Promise(done => { timer = setTimeout(() => done(false), ms); }),
  ]).finally(() => clearTimeout(timer));
}
async function stopBridge() {
  const child = bridgeChild;
  if (!child || exited(child)) return;
  // Windows child.kill() terminates the process without its signal handlers.
  // A private parent/child IPC request lets SCOUT finish writes and unlink its
  // own writer.lock. No unrelated process lookup or termination occurs.
  if (child.connected) {
    try { child.send('devungeon:shutdown', () => {}); } catch {}
  } else child.kill();
  if (!await bounded(waitExit(child), 20000)) {
    console.error('SCOUT graceful shutdown timed out; terminating only the owned child. Preserve its journal and any stale writer.lock for inspection.');
    process.exitCode = 1;
    child.kill('SIGKILL');
    if (!await bounded(waitExit(child), 2000)) throw new Error('Owned SCOUT child did not terminate');
  }
}
function stop(code = 0) {
  process.exitCode = Math.max(Number(process.exitCode ?? 0), code);
  if (stopPromise) return stopPromise;
  stopping = true;
  stopPromise = (async () => {
    const closing = (host?.close() ?? Promise.resolve()).catch(error => {
      console.error(error.message); process.exitCode = 1;
    });
    await stopBridge();
    if (!await bounded(closing, 5000)) {
      host?.httpServer?.closeAllConnections();
      if (!await bounded(closing, 1000)) throw new Error('Local Vite host did not close');
    }
    if (process.connected) process.disconnect();
  })().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
    if (bridgeChild && !exited(bridgeChild)) bridgeChild.kill('SIGKILL');
    process.exit(1);
  });
  return stopPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop(); });
// IPC is a process lifecycle channel, never a browser/Agent command endpoint.
process.on('message', message => { if (message === 'devungeon:shutdown') void stop(); });
process.on('disconnect', () => { void stop(); });
try {
  if (!external) {
    bridgeChild = spawn(process.execPath, ['apps/bridge/src/main.ts', '--repo', 'orionaster/devungeon', '--data', data, '--port', String(bridgePort)], {
      cwd: root, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true,
    });
    bridgeChild.on('error', error => { console.error(error.message); void stop(1); });
    bridgeChild.on('exit', code => { if (!stopping) void stop(code ?? 1); });
  }
  const options = { configFile: resolve(root, 'apps/web/vite.config.ts') };
  host = preview ? await createPreview(options) : await createServer(options);
  if (!stopping && !preview) await host.listen();
  if (stopping) await host.close();
  else {
    host.printUrls();
    process.send?.({ type: 'devungeon:host-ready', port, bridgePort, bridgePid: bridgeChild?.pid ?? null });
  }
} catch (error) {
  console.error(error.message);
  await stop(1);
}

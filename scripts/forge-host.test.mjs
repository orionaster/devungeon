import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Real local app/bridge lifecycle; each run owns its ports, PIDs and journal.
// No mock source server, stale-lock deletion or other worktree is involved.
const root = resolve(import.meta.dirname, '..');
const evidenceRoot = join(root, 'output/playwright/forge-host-lifecycle');
await mkdir(evidenceRoot, { recursive: true });
const directory = await mkdtemp(join(evidenceRoot, 'run-'));
const report = { platform: process.platform, node: process.version, started_at: new Date().toISOString(), checks: [] };
const delay = ms => new Promise(done => setTimeout(done, ms));
const exists = path => access(path).then(() => true, () => false);
async function waitFor(read, accept, timeout = 25000) {
  const until = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (accept(value)) return value;
    await delay(80);
  } while (Date.now() < until);
  throw new Error(`Lifecycle observation timed out: ${JSON.stringify(value)}`);
}
async function ports() {
  const first = createServer(), second = createServer();
  await new Promise(done => first.listen(0, '127.0.0.1', done));
  await new Promise(done => second.listen(0, '127.0.0.1', done));
  const result = [first.address().port, second.address().port];
  await Promise.all([new Promise(done => first.close(done)), new Promise(done => second.close(done))]);
  return result;
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const responds = port => fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) }).then(() => true, () => false);
async function launch(data, selectedPorts, args = []) {
  const [port, bridgePort] = selectedPorts;
  const child = fork(join(root, 'scripts/forge-host.mjs'), args, {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DEVUNGEON_PORT: String(port), DEVUNGEON_SCOUT_PORT: String(bridgePort), DEVUNGEON_DATA_DIR: data },
  });
  let logs = '';
  child.stdout.on('data', bytes => { logs += String(bytes); });
  child.stderr.on('data', bytes => { logs += String(bytes); });
  const exit = new Promise(done => child.once('exit', (code, signal) => done({ code, signal })));
  let ready;
  child.on('message', message => { if (message?.type === 'devungeon:host-ready') ready = message; });
  try {
    await waitFor(async () => ready ?? (child.exitCode === null ? null : { failed: true }), value => !!value);
    assert(!ready?.failed && ready, logs);
  } catch (error) {
    if (child.connected) child.send('devungeon:shutdown');
    throw error;
  }
  await waitFor(() => responds(port), Boolean);
  return { child, exit, ready, logs: () => logs, port, bridgePort, data };
}
async function heldStream(run) {
  let ended = false;
  const req = request(`http://127.0.0.1:${run.port}/scout-read/v1/stream`);
  const first = new Promise((done, reject) => {
    req.on('error', reject);
    req.on('response', response => {
      assert.equal(response.statusCode, 200);
      response.once('data', done);
      response.on('data', () => {});
      response.on('end', () => { ended = true; });
      response.on('close', () => { ended = true; });
    });
  });
  req.end();
  await first;
  return { ended: () => ended, close: () => req.destroy() };
}
async function assertReleased(run) {
  await waitFor(() => exists(join(run.data, 'writer.lock')), value => !value);
  await waitFor(() => responds(run.port), value => !value);
  if (run.ready.bridgePid) {
    await waitFor(() => responds(run.bridgePort), value => !value);
    await waitFor(() => Promise.resolve(alive(run.ready.bridgePid)), value => !value);
  }
}
test('normal app stop/restart releases locks; forced death leaves no orphan and fails closed', { timeout: 90000 }, async () => {
  const data = join(directory, 'journal');
  const selectedPorts = await ports();
  const children = [];
  try {
    for (let index = 0; index < 2; index++) {
      const run = await launch(data, selectedPorts);
      children.push(run);
      await waitFor(() => exists(join(data, 'writer.lock')), Boolean);
      const status = await waitFor(async () => {
        try { return await fetch(`http://127.0.0.1:${run.port}/scout-read/v1/status`).then(response => response.json()); }
        catch { return null; }
      }, value => value?.project_id === 'github:orionaster/devungeon');
      assert.equal(status.project_id, 'github:orionaster/devungeon');
      const foreign = await fetch(`http://127.0.0.1:${run.port}/scout-read/v1/status`, { headers: { Origin: 'https://example.invalid' } });
      assert.equal(foreign.status, 403);
      const stream = await heldStream(run);
      const started = Date.now();
      run.child.send('devungeon:shutdown');
      const outcome = await run.exit;
      assert.equal(outcome.code, 0, run.logs());
      await assertReleased(run);
      await waitFor(() => Promise.resolve(stream.ended()), Boolean);
      stream.close();
      report.checks.push({ name: `graceful-stop-and-restart-${index + 1}`, passed: true, duration_ms: Date.now() - started, ...run.ready });
      await writeFile(join(directory, `graceful-${index}.txt`), run.logs());
    }
    // A hard kill is not graceful shutdown. On this Windows host the child can
    // be terminated with its parent before IPC cleanup; the safe outcome is no
    // orphan plus a preserved stale lock, never silently deleting that lock.
    const abandoned = await launch(data, selectedPorts);
    children.push(abandoned);
    await waitFor(() => exists(join(data, 'writer.lock')), Boolean);
    report.checks.push({ name: 'parent-death-started', ...abandoned.ready });
    await waitFor(async () => {
      try { return await fetch(`http://127.0.0.1:${abandoned.bridgePort}/v1/status`).then(response => response.ok); }
      catch { return false; }
    }, Boolean);
    abandoned.child.kill('SIGKILL');
    await abandoned.exit;
    await waitFor(() => responds(abandoned.port), value => !value);
    await waitFor(() => responds(abandoned.bridgePort), value => !value);
    await waitFor(() => Promise.resolve(alive(abandoned.ready.bridgePid)), value => !value);
    const retainedLock = await exists(join(data, 'writer.lock'));
    if (retainedLock) {
      const probe = fork(join(root, 'apps/bridge/src/main.ts'), ['--repo', 'orionaster/devungeon', '--data', data, '--port', String(abandoned.bridgePort)], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      let diagnostic = '';
      probe.stderr.on('data', bytes => { diagnostic += String(bytes); });
      const code = await new Promise(done => probe.once('exit', done));
      assert.equal(code, 1);
      assert.match(diagnostic, /EEXIST|writer.lock/);
      assert.equal(await exists(join(data, 'writer.lock')), true);
    }
    report.checks.push({ name: 'hard-parent-death-no-orphan-preserves-stale-lock-fail-closed', passed: true,
      retained_stale_lock: retainedLock, graceful_cleanup_claimed: !retainedLock, ...abandoned.ready });
    await writeFile(join(directory, 'parent-death.txt'), abandoned.logs());

    // An external bridge remains caller-owned; no journal or child is created.
    const externalData = join(directory, 'external-must-not-create');
    const external = await launch(externalData, await ports(), ['--external-bridge']);
    children.push(external);
    assert.equal(external.ready.bridgePid, null);
    assert.equal(await exists(externalData), false);
    external.child.send('devungeon:shutdown');
    assert.equal((await external.exit).code, 0, external.logs());
    await assertReleased(external);
    report.checks.push({ name: 'external-bridge-no-process-or-journal-ownership', passed: true, ...external.ready });
  } catch (error) {
    report.error = error.message;
    report.remainingOwnedPids = children.filter(run => run.ready.bridgePid && alive(run.ready.bridgePid)).map(run => run.ready.bridgePid);
    throw error;
  } finally {
    // Cleanup is restricted to exact process handles this test created.
    for (const run of children) {
      await writeFile(join(directory, `host-${run.child.pid}.txt`), run.logs());
      if (run.child.exitCode === null && run.child.signalCode === null && run.child.connected) {
        run.child.send('devungeon:shutdown');
        const until = Date.now() + 25000;
        while (run.child.exitCode === null && run.child.signalCode === null && Date.now() < until) await delay(80);
        if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill('SIGKILL');
      }
      // A failed parent-death assertion may leave its exact child PID. Preserve
      // the journal/lock, terminate only the PID recorded by our own runner.
      else if (run.ready.bridgePid && alive(run.ready.bridgePid)) process.kill(run.ready.bridgePid, 'SIGKILL');
    }
    report.finished_at = new Date().toISOString();
    await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Lifecycle evidence: ${directory}`);
  }
});

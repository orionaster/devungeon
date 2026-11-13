import { fork } from 'node:child_process';
import { resolve } from 'node:path';

// A production primary host owned only by this test invocation. CI does not
// require public network or provider accounts; public suite remains opt-in.
const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.DEVUNGEON_PORT ?? 5198);
const bridgePort = process.env.FORGE_SCOUT_PORT ?? '4318';
const host = fork(resolve(root, 'scripts/forge-host.mjs'), ['--preview', '--external-bridge'], {
  cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
  env: {...process.env, DEVUNGEON_PORT: String(port), DEVUNGEON_SCOUT_PORT: bridgePort},
});
let browser;
try {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Production host startup timed out')), 25000);
    const fail = code => { clearTimeout(timer); reject(new Error(`Production host exited: ${code}`)); };
    host.once('exit', fail);
    host.on('message', message => {
      if (message?.type === 'devungeon:host-ready') {
        clearTimeout(timer); host.off('exit', fail); done();
      }
    });
    host.once('error', error => { clearTimeout(timer); reject(error); });
  });
  browser = fork(resolve(root, 'scripts/forge-browser.mjs'), [], {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
    env: {...process.env, FORGE_URL: `http://127.0.0.1:${port}`, FORGE_SUITE: process.env.FORGE_SUITE ?? 'games'},
  });
  process.exitCode = await new Promise((done, reject) => { browser.once('exit', code => done(code ?? 1)); browser.once('error', reject); });
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  if (browser && browser.exitCode === null && browser.signalCode === null) browser.kill();
  if (host.exitCode === null && host.signalCode === null) {
    const exited = new Promise(done => host.once('exit', done));
    host.send('devungeon:shutdown');
    const timer = setTimeout(() => host.kill(), 26000);
    await exited; clearTimeout(timer);
  }
}

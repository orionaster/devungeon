/** Opt-in network verification; anonymous public data only. Not part of offline CI. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { GithubProjectAdapter } from '../../../packages/project-adapters/github.ts';
import { Bridge } from '../src/bridge.ts';
import { createBridgeServer } from '../src/server.ts';
const directory = await mkdtemp(join(tmpdir(), 'scout-public-proof-'));
const bridge = new Bridge(new GithubProjectAdapter(), directory);
await bridge.init(); const server = createBridgeServer(bridge);
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  await bridge.pollProject();
  const snapshot = await (await fetch(`${base}/v1/snapshot`)).json();
  assert.equal(snapshot.connection.mode, 'LIVE', `Public source unavailable: ${snapshot.connection.reason}`);
  assert(snapshot.snapshot.rooms.length > 0); assert.equal(snapshot.snapshot.project.source.is_demo, false);
  assert(snapshot.snapshot.rooms.every((r: {status: string}) => r.status !== 'accepted'));
  const history = await (await fetch(`${base}/v1/events?limit=1000`)).json();
  assert(history.records.length > 0); assert(history.records.every((r: {mode: string}) => r.mode === 'REPLAY'));
  const abort = new AbortController();
  try {
    const stream = await fetch(`${base}/v1/stream?after=0`, {signal: abort.signal});
    const chunk = new TextDecoder().decode((await stream.body!.getReader().read()).value);
    assert(chunk.includes('event: record')); assert(chunk.includes('"source_kind":"project"'));
  } finally { abort.abort(); }
  console.log(JSON.stringify({verified_at: new Date().toISOString(), source: snapshot.snapshot.project.source.reference, revision: snapshot.snapshot.revision, rooms: snapshot.snapshot.rooms.length, events: history.records.length, checks: ['anonymous public REST → schema-valid snapshot/events → HTTP consumer → SSE history', 'no accepted rooms', 'explicit REPLAY history'], evidence: history.records.slice(0, 3).map((r: {event: {source_ref: string; occurred_at: string; observed_at: string}}) => r.event)}, null, 2));
} finally { server.close(); server.closeAllConnections(); await bridge.close(); await rm(directory, {recursive: true}); }

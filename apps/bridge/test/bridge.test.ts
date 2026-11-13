import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { get } from 'node:http';
import { Bridge } from '../src/bridge.ts';
import { createBridgeServer } from '../src/server.ts';
import { GithubProjectAdapter } from '../../../packages/project-adapters/github.ts';
import { AdapterError } from '../../../packages/project-adapters/types.ts';
import { normalizeMetadata } from '../../../packages/agent-adapters/metadata.ts';
import type { AgentEventAdapter } from '../../../packages/agent-adapters/types.ts';
// @ts-expect-error Browser-native JS intentionally has no build dependency.
import { createProjection } from '../public/projection.js';
const projectId = 'github:orionaster/devungeon';
const rawStatus = (url: string, headers: Record<string, string>) => new Promise<number | undefined>((resolve, reject) => {
  get(url, {headers}, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
});
function event(id: string, kind = 'tool_start', occurred_at = new Date().toISOString(), demo = false) {
  return normalizeMetadata({id, kind, occurred_at, session: 'session', actor: 'scout', project_id: projectId, task_id: 'issue:3', producer: 'scout-local', is_demo: demo}, projectId);
}
async function setup() {
  let fail = false; let agentFail = false; const events: ReturnType<typeof event>[] = [];
  const project = new GithubProjectAdapter(undefined, async u => {
    if (fail) throw new AdapterError('unavailable');
    return Response.json(String(u).includes('?') ? [] : {id: 1, full_name: 'orionaster/devungeon', private: false, name: 'devungeon', updated_at: '2026-11-13T00:00:00Z'});
  });
  const agent: AgentEventAdapter = {id: 'test-only-demo-harness', projectId, capabilities: ['observe_events'], read: async () => { if (agentFail) throw new AdapterError('unauthorized'); return events; }};
  const dir = await mkdtemp(join(tmpdir(), 'scout-bridge-')); const bridge = new Bridge(project, dir, agent); await bridge.init();
  const server = createBridgeServer(bridge); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  return {bridge, url, events, fail: () => { fail = true; }, agentFail: () => { agentFail = true; }, close: async () => { server.close(); server.closeAllConnections(); await bridge.close(); await rm(dir, {recursive: true}); }};
}
test('HTTP snapshot, live SSE, resume replay and consumer all use actual normalized records', async () => {
  const s = await setup(); const abort = new AbortController();
  try {
    await s.bridge.pollProject();
    const response = await fetch(`${s.url}/v1/snapshot`); assert.equal(response.status, 200);
    assert.equal((await response.json()).snapshot.rooms[0].status, 'planned');
    const stream = await fetch(`${s.url}/v1/stream`, {signal: abort.signal}); const reader = stream.body!.getReader();
    await reader.read(); // initial status/backlog
    s.events.push(event('real-protocol-test', 'tool_start', new Date().toISOString(), true));
    await s.bridge.pollAgent();
    const liveText = new TextDecoder().decode((await reader.read()).value);
    assert(liveText.includes('event: record')); assert(liveText.includes('"mode":"DEMO"'));
    const history = await (await fetch(`${s.url}/v1/events?after=0`)).json();
    assert.equal(history.records.length, 1); assert.equal(history.records[0].mode, 'REPLAY');
    await s.bridge.pollAgent(); assert.equal(s.bridge.journal.entries.length, 1);
    const resumed = await fetch(`${s.url}/v1/stream`, {headers: {'Last-Event-ID': '0'}, signal: abort.signal});
    assert(new TextDecoder().decode((await resumed.body!.getReader().read()).value).includes('"mode":"REPLAY"'));
    assert.equal((await fetch(`${s.url}/v1/events?after=999`)).status, 409);
    assert.equal((await fetch(`${s.url}/v1/events?after=-1`)).status, 400);
    assert.equal((await fetch(`${s.url}/v1/events?limit=1001`)).status, 400);
  } finally { abort.abort(); await s.close(); }
});
test('source failure retains honest cached snapshot, missing permission is visible; no command routes', async () => {
  const s = await setup();
  try {
    await s.bridge.pollProject(); const revision = s.bridge.snapshot!.revision;
    s.fail(); await s.bridge.pollProject();
    assert.equal(s.bridge.status().connections.project.mode, 'DISCONNECTED'); assert.equal(s.bridge.snapshot!.revision, revision);
    s.agentFail(); await s.bridge.pollAgent(); assert.equal(s.bridge.status().connections.agent.reason, 'unauthorized');
    assert.equal((await fetch(`${s.url}/v1/commands`, {method: 'POST', body: '{"command":"delete"}'})).status, 405);
    assert.equal((await fetch(`${s.url}/v1/status`, {headers: {Origin: 'https://evil.invalid'}})).status, 403);
    assert.equal(await rawStatus(`${s.url}/v1/status`, {Host: 'evil.invalid'}), 403);
    assert.equal(await rawStatus(`${s.url}/v1/status`, {'Sec-Fetch-Site': 'cross-site'}), 403);
    assert.equal((await fetch(`${s.url}/v1/status`)).headers.get('access-control-allow-origin'), null);
    const target = new URL(s.url);
    const bad = await new Promise<number | undefined>((resolve, reject) => {
      get({host: target.hostname, port: target.port, path: 'http://[', headers: {Host: target.host}}, res => {res.resume(); resolve(res.statusCode);}).on('error', reject);
    });
    assert.equal(bad, 400); assert.equal((await fetch(`${s.url}/v1/status`)).status, 200);
  } finally { await s.close(); }
});
test('mixed real/demo observer fails closed and old real observations cannot label demo as LIVE', async () => {
  const s = await setup();
  try {
    s.events.push(event('old-real', 'tool_start', '2026-01-01T00:00:00Z'), event('new-demo', 'tool_start', new Date().toISOString(), true));
    await s.bridge.pollAgent();
    assert.equal(s.bridge.status().connections.agent.mode, 'DISCONNECTED');
    assert.equal(s.bridge.status().connections.agent.reason, 'invalid_data');
    assert.equal(s.bridge.journal.entries.length, 0);
  } finally { await s.close(); }
});
test('freshness expires work, replay/demo/project events never start live Agent animation, late events cannot rewind', () => {
  const now = Date.now(); const p = createProjection();
  const started = {cursor: 1, mode: 'LIVE', event: event('a', 'tool_start', new Date(now - 1000).toISOString())};
  assert(p.apply(started)); assert(!p.apply(started)); assert.equal(p.active(now, true).length, 1);
  assert.equal(p.active(now + 4000, true).length, 0); assert.equal(p.active(now, false).length, 0);
  const completed = {cursor: 2, mode: 'LIVE', event: event('a', 'tool_end', new Date(now).toISOString())};
  p.apply(completed); p.apply({cursor: 3, mode: 'LIVE', event: event('late', 'tool_start', new Date(now - 500).toISOString())});
  assert.equal(p.active(now, true).length, 0); assert.equal(p.agents.values().next().value.event.event_type, 'completed');
  for (const mode of ['REPLAY', 'DEMO']) { const q = createProjection(); q.apply({...started, mode}); assert.equal(q.active(now, true).length, 0); }
  const q = createProjection(); q.apply({...started, event: {...started.event, source_kind: 'project'}}); assert.equal(q.agents.size, 0);
});

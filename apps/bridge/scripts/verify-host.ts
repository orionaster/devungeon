/** Explicit running-host probe. Public facts + selected local metadata, never provider access. */
import assert from 'node:assert/strict';
import type { EventEnvelope } from '../../../packages/agent-adapters/types.ts';
import type { BridgeStatus, SnapshotEnvelope } from '../../../packages/project-adapters/types.ts';
const [host = 'http://127.0.0.1:4178', bridge = 'http://127.0.0.1:4318'] = process.argv.slice(2);
for (const address of [host, bridge]) {
  const u = new URL(address);
  if (u.origin !== address || u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port) throw new Error('Select explicit literal-loopback origins');
}
async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, {signal: AbortSignal.timeout(10000)});
  assert.equal(response.status, 200, `Read failed: ${url}`); return response.json();
}
const [snapshot, direct, status, history] = await Promise.all([
  get<SnapshotEnvelope>(`${host}/scout-read/v1/snapshot`), get<SnapshotEnvelope>(`${bridge}/v1/snapshot`),
  get<BridgeStatus>(`${host}/scout-read/v1/status`),
  get<{records: EventEnvelope[]; mode: string}>(`${host}/scout-read/v1/events?after=0&limit=1000`),
]);
assert(snapshot.snapshot); assert.deepEqual(snapshot.snapshot, direct.snapshot, 'host must preserve exact original source fields');
assert.equal(snapshot.snapshot.project.id, 'github:orionaster/devungeon');
assert.equal(snapshot.snapshot.project.source.is_demo, false);
assert(snapshot.snapshot.rooms.every(r => r.status !== 'accepted'));
assert.deepEqual(status.capabilities.commands, []);
assert.equal(history.mode, 'REPLAY'); assert(history.records.every(r => r.mode === 'REPLAY'));
assert.equal(new Set(history.records.map(r => r.event.event_id)).size, history.records.length);
assert(history.records.some(r => r.event.source_kind === 'project'));
const observations = history.records.filter(r => r.event.source_kind === 'agent');
assert(observations.some(r => r.event.source === 'scout-local' && !r.event.is_demo && r.event.event_type === 'completed'));
assert.equal((await fetch(`${host}/scout-read/v1/status`, {method: 'POST'})).status, 405);
assert.equal((await fetch(`${host}/scout-read/v1/commands`)).status, 404);
assert.equal((await fetch(`${host}/scout-read/v1/snapshot?repo=private`)).status, 400);
assert.equal((await fetch(`${bridge}/v1/status`, {headers: {Origin: host}})).status, 403, 'host middleware must not weaken the direct bridge origin boundary');
const last = history.records.at(-1)!;
const abort = new AbortController();
try {
  const response = await fetch(`${host}/scout-read/v1/stream`, {headers: {'Last-Event-ID': String(last.cursor - 1)}, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)])});
  assert.equal(response.status, 200);
  const reader = response.body!.getReader(); let text = '';
  while (!text.includes('event: record') && text.length < 1_000_000) {
    const chunk = await reader.read(); if (chunk.done) break; text += new TextDecoder().decode(chunk.value);
  }
  const block = text.split('\n\n').find(b => b.includes('event: record'))!;
  const record = JSON.parse(block.split('\n').find(l => l.startsWith('data: '))!.slice(6));
  assert.equal(record.cursor, last.cursor); assert.equal(record.mode, 'REPLAY'); assert.deepEqual(record.event, last.event);
} finally {abort.abort();}
console.log(JSON.stringify({verified_at: new Date().toISOString(), host, bridge, project_id: status.project_id,
  source: snapshot.snapshot.project.source, source_revision: snapshot.snapshot.revision, source_observed_at: snapshot.snapshot.observed_at,
  rooms: snapshot.snapshot.rooms.length, records: history.records.length, agent_records: observations.length,
  original_title: snapshot.snapshot.rooms.find(r => r.evidence.some(e => e.ref.endsWith('/issues/12')))?.name,
  checks: ['exact snapshot preserved through same-origin host', 'read-only command and source-selection denials', 'direct bridge foreign Origin still denied', 'resume through host preserves cursor, REPLAY and exact event', 'project facts are separate from Agent observations', 'no accepted inferred'],
  evidence: observations.map(r => r.event)}, null, 2));

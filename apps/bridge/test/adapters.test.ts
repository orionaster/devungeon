import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GithubProjectAdapter } from '../../../packages/project-adapters/github.ts';
import { MetadataAgentAdapter, normalizeMetadata } from '../../../packages/agent-adapters/metadata.ts';
import { claudeHookMetadata, codexNotificationMetadata } from '../../../packages/agent-adapters/providers.ts';
import { validateEvent, validateSnapshot } from '../src/validation.ts';
import { Journal } from '../src/journal.ts';
const project = 'github:orionaster/devungeon';
const at = '2026-11-13T00:00:00Z';
const repo = {id: 1, name: 'devungeon', full_name: 'orionaster/devungeon', private: false, html_url: 'https://github.com/orionaster/devungeon', updated_at: at};
const issue = (n: number, state = 'open') => ({id: n + 100, number: n, title: `Public task ${n}`, state, updated_at: at});
export const metadata = (extra = {}) => ({id: 'action-1', session: 'session-1', actor: 'scout', project_id: project, task_id: 'issue:3', kind: 'tool_start', occurred_at: at, producer: 'scout-local', is_demo: false, ...extra});
test('public GitHub pagination, ETag and repeat import have stable IDs; closed stays review', async () => {
  let cached = false; const calls: {url: string; options: RequestInit | undefined}[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    calls.push({url: String(url), options});
    if (cached) { assert.equal((options?.headers as Record<string, string>)['If-None-Match'], 'v1'); return new Response(null, {status: 304}); }
    if (!String(url).includes('?')) return Response.json(repo, {headers: {etag: 'v1'}});
    return Response.json(String(url).includes('page=2') ? [issue(2, 'closed')] : [issue(1)], {headers: {etag: 'v1', ...(String(url).includes('page=2') ? {} : {link: '<https://untrusted.invalid/>; rel="next"'})}});
  };
  const adapter = new GithubProjectAdapter(undefined, fetcher);
  const first = await adapter.read(); cached = true; const next = await adapter.read();
  assert.equal(first.snapshot.revision, next.snapshot.revision);
  assert.deepEqual(first.events.map(e => e.event_id), next.events.map(e => e.event_id));
  assert.equal(first.snapshot.rooms[1].status, 'review'); assert.equal(first.snapshot.agents.length, 0);
  assert(calls.every(c => c.url.startsWith('https://api.github.com/repos/orionaster/devungeon')));
  assert(calls.every(c => !JSON.stringify(c.options).includes('Authorization')));
  validateSnapshot(first.snapshot, project); first.events.forEach(e => validateEvent(e, project));
});
test('GitHub denies unauthorized, unavailable, rate limited and private responses without leaking bodies', async () => {
  for (const [status, reason, headers] of [[401, 'unauthorized', {}], [404, 'unauthorized', {}], [403, 'rate_limited', {'x-ratelimit-remaining': '0'}], [429, 'rate_limited', {'retry-after': '120'}], [500, 'unavailable', {}]] as const) {
    const adapter = new GithubProjectAdapter(undefined, async () => new Response('secret-provider-body', {status, headers: headers as HeadersInit}));
    await assert.rejects(adapter.read(), (e: Error) => e.message === reason && !e.message.includes('secret'));
  }
  await assert.rejects(new GithubProjectAdapter(undefined, async () => Response.json({...repo, private: true})).read(), /invalid_data/);
  await assert.rejects(new GithubProjectAdapter(undefined, async () => { throw new Error('network secret'); }).read(), /unavailable/);
  assert.throws(() => new GithubProjectAdapter('../../private'), /Invalid repository/);
});
test('malformed pages cannot publish a partial snapshot; empty repo has honest overview', async () => {
  const empty = await new GithubProjectAdapter(undefined, async u => Response.json(String(u).includes('?') ? [] : repo)).read();
  assert.equal(empty.snapshot.rooms[0].status, 'planned'); validateSnapshot(empty.snapshot, project);
  await assert.rejects(new GithubProjectAdapter(undefined, async u => Response.json(String(u).includes('?') ? [issue(1), issue(1)] : repo)).read(), /invalid_data/);
});
test('metadata enforces scope, rejects sensitive extra fields and future times', () => {
  const event = normalizeMetadata(metadata(), project); validateEvent(event, project);
  assert.equal(event.source_kind, 'agent'); assert.equal(event.status, 'working');
  for (const change of [{project_id: 'private'}, {tool_input: 'secret'}, {transcript_path: 'C:/private'}, {occurred_at: '2999-01-01T00:00:00Z'}, {evidence_ref: 'https://evil.invalid/key'}, {kind: 'accepted'}]) assert.throws(() => normalizeMetadata(metadata(change), project), /invalid_data/);
  assert.equal(normalizeMetadata(metadata({kind: 'tool_end'}), project).status, 'idle');
  assert.equal(normalizeMetadata(metadata({session: 'different'}), project).agent_id, event.agent_id);
});
test('provider mappers discard transcripts, commands, messages and paths; lifecycle is idle', () => {
  const scope = {project_id: project, task_id: 'issue:3', is_demo: true};
  const claude = claudeHookMetadata({hook_event_name: 'SessionStart', session_id: 'private-session', transcript_path: 'secret', tool_input: 'secret'}, scope, at)!;
  assert.equal(normalizeMetadata(claude, project).status, 'idle');
  const stop = {hook_event_name: 'Stop', session_id: 'same-session'};
  assert.notEqual(claudeHookMetadata(stop, scope)!.id, claudeHookMetadata(stop, scope)!.id);
  assert(!JSON.stringify(claude).includes('secret')); assert(!JSON.stringify(claude).includes('private-session'));
  assert.equal(claudeHookMetadata({hook_event_name: 'PreToolUse', session_id: 's'}, scope), null);
  const codex = codexNotificationMetadata({method: 'item/completed', params: {threadId: 's', item: {id: 'a', type: 'commandExecution', status: 'completed', command: 'secret', aggregatedOutput: 'secret'}}}, scope, at)!;
  assert.equal(normalizeMetadata(codex, project).event_type, 'completed'); assert(!JSON.stringify(codex).includes('secret'));
  assert.equal(codexNotificationMetadata({method: 'item/agentMessage/delta', params: {threadId: 's', delta: 'secret'}}, scope), null);
  assert.equal(codexNotificationMetadata({method: 'item/completed', params: {threadId: 's', item: {id: 'a', type: 'commandExecution', status: 'unknown'}}}, scope), null);
});
test('selected file handles partial writes, duplicate metadata, denied/missing files and rejects unsafe payload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scout-adapter-'));
  try {
    const file = join(dir, 'metadata.jsonl'); const adapter = new MetadataAgentAdapter(project, file);
    await assert.rejects(adapter.read(), /unavailable/);
    await writeFile(file, `${JSON.stringify(metadata())}\n{"partial":`);
    assert.equal((await adapter.read()).length, 1);
    await writeFile(file, `${JSON.stringify(metadata({prompt: 'secret'}))}\n`);
    await assert.rejects(adapter.read(), /invalid_data/);
  } finally { await rm(dir, {recursive: true}); }
});
test('durable journal serializes concurrent writes, deduplicates across restart and rejects corruption', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scout-journal-'));
  let journal = new Journal(dir, project);
  try {
    await journal.init(); const event = normalizeMetadata(metadata(), project);
    const writes = await Promise.all([journal.append(event), journal.append(event)]);
    assert.equal(writes.filter(Boolean).length, 1);
    const second = new Journal(dir, project); await assert.rejects(second.init(), /EEXIST/);
    await journal.close(); journal = new Journal(dir, project); await journal.init();
    assert.equal(journal.entries.length, 1); assert.equal(await journal.append(event), null);
    await journal.close(); await appendFile(join(dir, 'events.jsonl'), '{partial');
    await assert.rejects(new Journal(dir, project).init(), /Incomplete journal/);
  } finally { await journal.close(); await rm(dir, {recursive: true}); }
});

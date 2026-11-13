import { open } from 'node:fs/promises';
import { digest } from '../project-adapters/github.ts';
import { AdapterError } from '../project-adapters/types.ts';
import type { AgentEvent, AgentEventAdapter, EventType } from './types.ts';

export interface Metadata {
  id: string; session: string; actor: string; project_id: string; task_id: string;
  kind: 'session_start' | 'tool_start' | 'tool_end' | 'failed' | 'blocked' | 'session_end';
  occurred_at: string; producer: 'scout-local' | 'claude-hooks' | 'codex-app-server' | 'crew';
  is_demo: boolean; evidence_ref?: string;
}
const keys = new Set(['id', 'session', 'actor', 'project_id', 'task_id', 'kind', 'occurred_at', 'producer', 'is_demo', 'evidence_ref']);
export function normalizeMetadata(input: unknown, projectId: string, observed = new Date().toISOString()): AgentEvent {
  const v = input as Metadata;
  if (!v || typeof v !== 'object' || Object.keys(v).some(k => !keys.has(k)) ||
    !['id', 'session', 'actor', 'task_id'].every(k => typeof v[k as keyof Metadata] === 'string' && /^[a-zA-Z0-9:_.-]{1,160}$/.test(v[k as keyof Metadata] as string)) ||
    v.project_id !== projectId || !['scout-local', 'claude-hooks', 'codex-app-server', 'crew'].includes(v.producer) ||
    !['session_start', 'tool_start', 'tool_end', 'failed', 'blocked', 'session_end'].includes(v.kind) ||
    typeof v.is_demo !== 'boolean' || typeof v.occurred_at !== 'string' || !Number.isFinite(Date.parse(v.occurred_at)) || Date.parse(v.occurred_at) > Date.parse(observed) + 5000 ||
    (v.evidence_ref !== undefined && (typeof v.evidence_ref !== 'string' || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[0-9a-f]{40}$/.test(v.evidence_ref)))) throw new AdapterError('invalid_data');
  const key = `${v.producer}:${digest([projectId, v.session, v.id, v.kind])}`;
  const types: Record<Metadata['kind'], EventType> = {session_start: 'progress', tool_start: 'tool_call', tool_end: 'completed', failed: 'failed', blocked: 'blocked', session_end: 'progress'};
  return {schema_version: '1.0', event_id: key, idempotency_key: key, project_id: projectId, task_id: v.task_id,
    agent_id: `${v.producer}:${digest([projectId, v.actor]).slice(0, 24)}`, event_type: types[v.kind],
    status: v.kind === 'tool_start' ? 'working' : v.kind === 'failed' ? 'failed' : v.kind === 'blocked' ? 'blocked' : 'idle',
    occurred_at: v.occurred_at, observed_at: observed, source: v.producer, source_kind: 'agent',
    source_ref: v.evidence_ref ?? `local:metadata:${key}`, is_demo: v.is_demo,
    message: `${v.producer} observed ${v.kind}. This is activity evidence, not product acceptance.`};
}

/** Only the explicitly selected metadata file, never searches home/session/transcript paths. */
export class MetadataAgentAdapter implements AgentEventAdapter {
  readonly id = 'local-metadata-v1'; readonly capabilities = ['observe_events'] as const;
  readonly projectId: string; readonly file: string;
  constructor(projectId: string, file: string) { this.projectId = projectId; this.file = file; }
  async read(): Promise<AgentEvent[]> {
    let handle;
    try {
      handle = await open(this.file, 'r');
      if ((await handle.stat()).size > 2_000_000) throw new AdapterError('invalid_data');
      const buffer = Buffer.alloc(2_000_001);
      const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 2_000_000) throw new AdapterError('invalid_data');
      const text = buffer.subarray(0, bytesRead).toString('utf8');
      // Partial final writes are retried next poll, never parsed as complete events.
      const complete = text.slice(0, text.lastIndexOf('\n') + 1);
      return complete.split('\n').filter(Boolean).map(line => normalizeMetadata(JSON.parse(line), this.projectId));
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      throw new AdapterError(code === 'EACCES' || code === 'EPERM' ? 'unauthorized' : code === 'ENOENT' ? 'unavailable' : 'invalid_data');
    } finally { await handle?.close(); }
  }
}

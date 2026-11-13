/** Pure opt-in mappers. They never connect to a provider or follow supplied paths. */
import { digest } from '../project-adapters/github.ts';
import { randomUUID } from 'node:crypto';
import type { Metadata } from './metadata.ts';

export interface Scope {project_id: string; task_id: string; is_demo: boolean}
type RecordValue = Record<string, unknown>;
const object = (v: unknown): RecordValue => v && typeof v === 'object' ? v as RecordValue : {};
const id = (v: unknown): string => typeof v === 'string' && v.length > 0 && v.length < 500 ? digest(v) : '';

export function claudeHookMetadata(raw: unknown, scope: Scope, receivedAt = new Date().toISOString()): Metadata | null {
  const v = object(raw); const session = id(v.session_id);
  const kinds: Record<string, Metadata['kind']> = {SessionStart: 'session_start', PreToolUse: 'tool_start', PostToolUse: 'tool_end', PostToolUseFailure: 'failed', Stop: 'session_end'};
  const event = typeof v.hook_event_name === 'string' ? v.hook_event_name : '';
  const kind = kinds[event];
  if (!session || !kind) return null;
  // Hooks expose stable tool IDs, but no occurrence ID for repeated Stop/resume.
  // Give lifecycle receipts local IDs; never collapse distinct turns in one session.
  const action = event.includes('ToolUse') ? id(v.tool_use_id) : randomUUID();
  if (!action) return null;
  return {...scope, id: `${event}:${action}`, session, actor: 'claude', kind, producer: 'claude-hooks', occurred_at: receivedAt};
}

export function codexNotificationMetadata(raw: unknown, scope: Scope, receivedAt = new Date().toISOString()): Metadata | null {
  const v = object(raw); const p = object(v.params); const item = object(p.item); const turn = object(p.turn);
  const session = id(p.threadId); const method = v.method;
  if (!session || typeof method !== 'string') return null;
  let kind: Metadata['kind']; let action = '';
  if (method === 'turn/started') { kind = 'session_start'; action = id(turn.id); }
  else if (method === 'turn/completed' && ['completed', 'failed', 'interrupted'].includes(String(turn.status))) { kind = turn.status === 'failed' ? 'failed' : turn.status === 'interrupted' ? 'blocked' : 'session_end'; action = id(turn.id); }
  else if (['item/started', 'item/completed'].includes(method) && ['commandExecution', 'mcpToolCall', 'fileChange'].includes(String(item.type))) {
    if (method === 'item/completed' && !['completed', 'failed', 'declined'].includes(String(item.status))) return null;
    action = id(item.id); kind = method === 'item/started' ? 'tool_start' : item.status === 'failed' ? 'failed' : item.status === 'declined' ? 'blocked' : 'tool_end';
  } else return null;
  if (!action) return null;
  return {...scope, id: `${method.replaceAll('/', '.')}:${action}`, session, actor: 'codex', kind, producer: 'codex-app-server', occurred_at: receivedAt};
}

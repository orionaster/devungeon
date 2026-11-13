import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';
import type { AgentEvent } from '../../../packages/agent-adapters/types.ts';
import type { ProjectSnapshot } from '../../../packages/project-adapters/types.ts';
// Canonical v1 uses conditional minItems without repeating its parent array type.
const ajv = new Ajv2020({strict: true, strictTypes: false, allErrors: true});
const addFormats = createRequire(import.meta.url)('ajv-formats') as (instance: Ajv2020) => void;
addFormats(ajv);
const schema = (file: string) => JSON.parse(readFileSync(new URL(`../../../schema/${file}`, import.meta.url), 'utf8'));
const event = ajv.compile(schema('agent-event.schema.json'));
const snapshot = ajv.compile(schema('project-snapshot.schema.json'));
export function validateEvent(v: unknown, projectId: string): asserts v is AgentEvent {
  if (!event(v)) throw new Error('Invalid event schema');
  const e = v as AgentEvent;
  if (e.project_id !== projectId || !e.task_id || !e.status || !e.source_kind || !e.source_ref || !e.idempotency_key || e.idempotency_key !== e.event_id) throw new Error('Invalid event scope or normalized fields');
}
export function validateSnapshot(v: unknown, projectId: string): asserts v is ProjectSnapshot {
  if (!snapshot(v)) throw new Error('Invalid snapshot schema');
  const s = v as ProjectSnapshot; const rooms = new Set(s.rooms.map(r => r.id)); const zones = new Set(s.zones.map(z => z.id));
  if (s.project.id !== projectId || rooms.size !== s.rooms.length || zones.size !== s.zones.length || s.rooms.some(r => !zones.has(r.zone_id) || r.depends_on.some(d => !rooms.has(d) || d === r.id) || r.status === 'accepted') || s.agents.some(a => a.room_id && !rooms.has(a.room_id))) throw new Error('Invalid snapshot scope/references or unsupported acceptance');
}

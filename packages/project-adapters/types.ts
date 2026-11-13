/** Renderer-neutral v1 contracts. JSON Schema remains the runtime authority. */
import type { AgentEvent } from '../agent-adapters/types.ts';

export type RoomStatus = 'planned' | 'ready' | 'active' | 'blocked' | 'review' | 'accepted' | 'failed' | 'regressed' | 'archived';
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'awaiting_approval' | 'offline' | 'unknown';
export interface ProjectSnapshot {
  schema_version: '1.0';
  project: {id: string; name: string; description?: string; source: {kind: 'github' | 'local' | 'manual' | 'synthetic' | 'agent'; is_demo: boolean; reference?: string}};
  revision: string; observed_at: string;
  zones: {id: string; name: string; theme_hint?: string}[];
  rooms: {id: string; zone_id: string; name: string; summary?: string; status: RoomStatus; depends_on: string[]; acceptance_criteria: string[]; evidence: {type: 'issue' | 'pull_request' | 'commit' | 'other'; ref: string; verification: 'verified' | 'unverified' | 'synthetic'; description?: string}[]}[];
  agents: {id: string; name: string; role: 'worker' | 'supervisor' | 'reviewer'; status: AgentStatus; room_id?: string; last_seen_at?: string; is_demo?: boolean}[];
}
export interface ProjectRead {snapshot: ProjectSnapshot; events: AgentEvent[]; warnings: string[]}
export interface ProjectAdapter {
  readonly id: string;
  readonly projectId: string;
  readonly capabilities: readonly ['read_project'];
  read(): Promise<ProjectRead>;
}
export type ConnectionMode = 'LIVE' | 'DEMO' | 'REPLAY' | 'STALE' | 'DISCONNECTED';
export type ConnectionReason = 'ok' | 'not_connected' | 'unauthorized' | 'rate_limited' | 'unavailable' | 'invalid_data' | 'stale';
export interface ConnectionState {
  mode: ConnectionMode; reason: ConnectionReason; last_success_at: string | null;
  checked_at: string; retry_at: string | null;
}
export class AdapterError extends Error {
  readonly reason: ConnectionReason;
  readonly retryMs: number;
  constructor(reason: ConnectionReason, retryMs = 0) {
    super(reason); this.reason = reason; this.retryMs = retryMs;
  }
}

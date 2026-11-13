export type EventType = 'started' | 'progress' | 'tool_call' | 'tested' | 'blocked' | 'review_requested' | 'completed' | 'failed' | 'disconnected' | 'command_result';
export type EventStatus = 'working' | 'idle' | 'blocked' | 'awaiting_approval' | 'offline' | 'unknown' | 'review' | 'failed';
/** Additive v1 fields are mandatory on normalized SCOUT output, optional in legacy schema. */
export interface AgentEvent {
  schema_version: '1.0'; event_id: string; idempotency_key: string;
  project_id: string; task_id: string; agent_id: string; room_id?: string;
  event_type: EventType; status: EventStatus;
  occurred_at: string; observed_at: string;
  source: string; source_kind: 'project' | 'agent'; source_ref: string;
  is_demo: boolean; message: string;
}
export interface AgentEventAdapter {
  readonly id: string;
  readonly projectId: string;
  readonly capabilities: readonly ['observe_events'];
  read(): Promise<AgentEvent[]>;
}

/** Delivery context is not source truth. Backlog never becomes LIVE. */
export interface EventEnvelope {
  schema_version: '1.0'; cursor: number; mode: 'LIVE' | 'DEMO' | 'REPLAY'; event: AgentEvent;
}

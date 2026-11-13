import { EventEmitter } from 'node:events';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { Journal } from './journal.ts';
import { validateSnapshot } from './validation.ts';
import { AdapterError } from '../../../packages/project-adapters/types.ts';
import type { ConnectionState, ProjectAdapter, ProjectSnapshot } from '../../../packages/project-adapters/types.ts';
import type { AgentEventAdapter, AgentEvent } from '../../../packages/agent-adapters/types.ts';
import type { Entry } from './journal.ts';

export class Bridge extends EventEmitter {
  readonly project: ProjectAdapter; readonly agent?: AgentEventAdapter; readonly journal: Journal;
  snapshot: ProjectSnapshot | null = null; warnings: string[] = [];
  states: {project: ConnectionState; agent: ConnectionState};
  private projectBusy = false; private agentBusy = false; private timers: NodeJS.Timeout[] = [];
  private pending = new Set<Promise<unknown>>(); private retryCount = 0;
  constructor(project: ProjectAdapter, directory: string, agent?: AgentEventAdapter) {
    super(); this.project = project; this.agent = agent; this.journal = new Journal(directory, project.projectId);
    if (agent && agent.projectId !== project.projectId) throw new Error('Cross-project adapter denied');
    const empty: ConnectionState = {mode: 'DISCONNECTED', reason: 'not_connected', last_success_at: null, checked_at: new Date().toISOString(), retry_at: null};
    this.states = {project: {...empty}, agent: {...empty}};
  }
  async init() {
    await this.journal.init();
    try {
      const saved = JSON.parse(await readFile(join(this.journal.directory, 'snapshot.json'), 'utf8'));
      validateSnapshot(saved, this.project.projectId); this.snapshot = saved;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') { await this.journal.close(); throw new Error('Invalid saved snapshot; preserve and repair'); }
    }
  }
  private async publish(events: AgentEvent[]) {
    for (const event of events) {
      if (event.source_kind === 'agent' && this.snapshot?.rooms.some(r => r.id === event.task_id)) event.room_id = event.task_id;
      const entry = await this.journal.append(event);
      if (entry) this.emit('record', this.envelope(entry, false));
    }
  }
  envelope(entry: Entry, replay: boolean) {
    const fresh = Date.now() - Date.parse(entry.event.occurred_at) <= 30000;
    return {schema_version: '1.0', cursor: entry.cursor, mode: replay || !fresh ? 'REPLAY' : entry.event.is_demo ? 'DEMO' : 'LIVE', event: entry.event};
  }
  status() {
    const now = Date.now();
    for (const [channel, staleMs] of [['project', 360000], ['agent', 30000]] as const) {
      const state = this.states[channel];
      if (state.mode === 'LIVE' && state.last_success_at && now - Date.parse(state.last_success_at) > staleMs) {
        state.mode = 'STALE'; state.reason = 'stale';
      }
    }
    return {schema_version: '1.0', project_id: this.project.projectId, epoch: this.journal.epoch,
      cursor: this.journal.entries.length, connections: this.states,
      capabilities: {project: [...this.project.capabilities], agent: this.agent ? [...this.agent.capabilities] : [], commands: []}, warnings: this.warnings};
  }
  async pollProject() {
    if (this.projectBusy || (this.states.project.retry_at && Date.now() < Date.parse(this.states.project.retry_at))) return;
    this.projectBusy = true;
    try {
      const {snapshot, events, warnings} = await this.project.read();
      validateSnapshot(snapshot, this.project.projectId);
      // All events validate before any member of a batch is committed.
      const {validateEvent} = await import('./validation.ts');
      events.forEach(e => validateEvent(e, this.project.projectId));
      const temporary = join(this.journal.directory, 'snapshot.tmp');
      await writeFile(temporary, JSON.stringify(snapshot), {mode: 0o600});
      await rename(temporary, join(this.journal.directory, 'snapshot.json'));
      this.snapshot = snapshot; this.warnings = warnings;
      await this.publish(events); this.retryCount = 0;
      this.states.project = {mode: snapshot.project.source.is_demo ? 'DEMO' : 'LIVE', reason: 'ok', last_success_at: new Date().toISOString(), checked_at: new Date().toISOString(), retry_at: null};
      this.emit('snapshot', {revision: snapshot.revision});
    } catch (error) {
      const e = error instanceof AdapterError ? error : new AdapterError('invalid_data');
      this.retryCount++;
      const wait = Math.max(e.retryMs, Math.min(3600000, 180000 * 2 ** Math.min(this.retryCount - 1, 5)));
      this.states.project = {...this.states.project, mode: 'DISCONNECTED', reason: e.reason, checked_at: new Date().toISOString(), retry_at: new Date(Date.now() + wait).toISOString()};
    } finally { this.projectBusy = false; this.emit('status', this.status()); }
  }
  async pollAgent() {
    if (!this.agent || this.agentBusy) return;
    this.agentBusy = true;
    try {
      const events = await this.agent.read();
      // A selected observer file is either real or synthetic, never a blended source.
      if (new Set(events.map(e => e.is_demo)).size > 1) throw new AdapterError('invalid_data');
      const {validateEvent} = await import('./validation.ts');
      events.forEach(e => validateEvent(e, this.project.projectId));
      await this.publish(events);
      const last = events.reduce<string | null>((latest, e) => !latest || Date.parse(e.occurred_at) > Date.parse(latest) ? e.occurred_at : latest, null);
      const recent = last && Date.now() - Date.parse(last) <= 30000;
      this.states.agent = {mode: recent ? events.every(e => e.is_demo) ? 'DEMO' : 'LIVE' : 'STALE', reason: recent ? 'ok' : 'stale', last_success_at: last, checked_at: new Date().toISOString(), retry_at: null};
    } catch (error) {
      const e = error instanceof AdapterError ? error : new AdapterError('invalid_data');
      this.states.agent = {...this.states.agent, mode: 'DISCONNECTED', reason: e.reason, checked_at: new Date().toISOString(), retry_at: null};
    } finally { this.agentBusy = false; this.emit('status', this.status()); }
  }
  start(projectMs = 180000, agentMs = 1000) {
    const run = (fn: () => Promise<void>) => { const p = fn(); this.pending.add(p); void p.finally(() => this.pending.delete(p)); };
    run(() => this.pollProject()); run(() => this.pollAgent());
    this.timers.push(setInterval(() => run(() => this.pollProject()), Math.max(180000, projectMs)), setInterval(() => run(() => this.pollAgent()), Math.max(250, agentMs)));
  }
  async close() { this.timers.forEach(clearInterval); await Promise.allSettled(this.pending); await this.journal.close(); }
}

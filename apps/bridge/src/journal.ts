import { appendFile, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateEvent } from './validation.ts';
import type { AgentEvent } from '../../../packages/agent-adapters/types.ts';
export interface Entry {cursor: number; event: AgentEvent}

/** Single process, bounded append-only journal. Corruption fails closed; never resets history. */
export class Journal {
  readonly projectId: string; readonly directory: string;
  readonly epoch = randomUUID();
  entries: Entry[] = []; private ids = new Set<string>(); private file = ''; private lock: Awaited<ReturnType<typeof open>> | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(directory: string, projectId: string) { this.directory = directory; this.projectId = projectId; }
  async init() {
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    this.file = join(this.directory, 'events.jsonl');
    this.lock = await open(join(this.directory, 'writer.lock'), 'wx', 0o600);
    try {
      const handle = await open(this.file, 'a+', 0o600);
      try {
        if ((await handle.stat()).size > 20_000_000) throw new Error('Journal capacity reached');
        const data = await handle.readFile('utf8');
        if (data && !data.endsWith('\n')) throw new Error('Incomplete journal: preserve and repair before restart');
        for (const line of data.split('\n').filter(Boolean)) {
          const entry = JSON.parse(line) as Entry; validateEvent(entry.event, this.projectId);
          if (entry.cursor !== this.entries.length + 1 || this.ids.has(entry.event.event_id)) throw new Error('Invalid journal sequence');
          this.entries.push(entry); this.ids.add(entry.event.event_id);
        }
        if (this.entries.length > 10000) throw new Error('Journal capacity reached');
      } finally { await handle.close(); }
    } catch (e) { await this.close(); throw e; }
  }
  append(event: AgentEvent): Promise<Entry | null> {
    const pending = this.tail.then(() => this.write(event));
    this.tail = pending.catch(() => {}); return pending;
  }
  private async write(event: AgentEvent): Promise<Entry | null> {
    validateEvent(event, this.projectId);
    if (this.ids.has(event.event_id)) return null;
    if (this.entries.length >= 10000) throw new Error('Journal capacity reached');
    const entry = {cursor: this.entries.length + 1, event};
    await appendFile(this.file, `${JSON.stringify(entry)}\n`, {mode: 0o600});
    this.entries.push(entry); this.ids.add(event.event_id); return entry;
  }
  async close() {
    await this.tail;
    if (this.lock) {
      await this.lock.close(); this.lock = null;
      const {unlink} = await import('node:fs/promises'); await unlink(join(this.directory, 'writer.lock'));
    }
  }
}

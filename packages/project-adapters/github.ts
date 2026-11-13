import { createHash } from 'node:crypto';
import { AdapterError } from './types.ts';
import type { ProjectAdapter, ProjectRead, ProjectSnapshot } from './types.ts';
import type { AgentEvent } from '../agent-adapters/types.ts';

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type GithubRepo = {id: number; full_name: string; name: string; private: boolean; html_url: string; updated_at: string};
type GithubIssue = {id: number; number: number; title: string; html_url: string; state: 'open' | 'closed'; updated_at: string; pull_request?: unknown};
type Cache = {etag: string | null; data: unknown; next: boolean};
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Public-only, unauthenticated and fixed-host. Never reads environment credentials. */
export class GithubProjectAdapter implements ProjectAdapter {
  readonly id = 'github-public-rest-v1';
  readonly capabilities = ['read_project'] as const;
  readonly projectId: string;
  readonly repository: string;
  private cache = new Map<string, Cache>();
  private fetcher: typeof fetch;
  constructor(repository = 'orionaster/devungeon', fetcher: typeof fetch = fetch) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository slug');
    this.repository = repository.toLowerCase();
    this.projectId = `github:${this.repository}`;
    this.fetcher = fetcher;
  }
  private async get(path: string): Promise<Cache> {
    const previous = this.cache.get(path);
    const headers: Record<string, string> = {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Devungeon-Scout/0.1'};
    if (previous?.etag) headers['If-None-Match'] = previous.etag;
    let response: Response;
    try { response = await this.fetcher(`https://api.github.com/repos/${this.repository}${path}`, {headers, signal: AbortSignal.timeout(10000), redirect: 'error'}); }
    catch { throw new AdapterError('unavailable'); }
    if (response.status === 304 && previous) return previous;
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000 - Date.now();
      const retry = Number(response.headers.get('retry-after')) * 1000;
      throw new AdapterError('rate_limited', Math.max(60000, Number.isFinite(reset) ? reset : 0, Number.isFinite(retry) ? retry : 0));
    }
    if ([401, 403, 404].includes(response.status)) throw new AdapterError('unauthorized');
    if (!response.ok) throw new AdapterError('unavailable');
    // Bounded streaming read: even a missing/lying Content-Length cannot exhaust memory.
    const reader = response.body?.getReader();
    if (!reader) throw new AdapterError('invalid_data');
    const parts: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 4_000_000) { await reader.cancel(); throw new AdapterError('invalid_data'); }
        parts.push(value);
      }
      const data: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
      const result = {data, etag: response.headers.get('etag'), next: /rel="next"/.test(response.headers.get('link') ?? '')};
      this.cache.set(path, result); return result;
    } catch (error) { if (error instanceof AdapterError) throw error; throw new AdapterError('invalid_data'); }
  }
  async read(): Promise<ProjectRead> {
    const {data} = await this.get('');
    const repo = data as GithubRepo;
    if (!repo || !Number.isSafeInteger(repo.id) || repo.private !== false || repo.full_name?.toLowerCase() !== this.repository || !date(repo.updated_at)) throw new AdapterError('invalid_data');
    const issues: GithubIssue[] = [];
    for (let page = 1; ; page++) {
      if (page > 10) throw new AdapterError('invalid_data'); // never publish a silently truncated snapshot
      const response = await this.get(`/issues?state=all&per_page=100&page=${page}`);
      if (!Array.isArray(response.data)) throw new AdapterError('invalid_data');
      for (const issue of response.data as GithubIssue[]) {
        if (!issue || !Number.isSafeInteger(issue.id) || !Number.isSafeInteger(issue.number) || typeof issue.title !== 'string' || !['open', 'closed'].includes(issue.state) || !date(issue.updated_at)) throw new AdapterError('invalid_data');
        // Never trust provider-supplied URLs, bodies, labels, authors or timestamps as acceptance.
        issues.push(issue);
      }
      if (!response.next) break;
    }
    issues.sort((a, b) => a.id - b.id);
    if (new Set(issues.map(i => i.id)).size !== issues.length) throw new AdapterError('invalid_data');
    const now = new Date().toISOString();
    const ref = `https://github.com/${this.repository}`;
    const zone = `github:${repo.id}:work`;
    const rooms: ProjectSnapshot['rooms'] = issues.map(i => ({
      id: `github:issue:${i.id}`, zone_id: zone, name: i.title.slice(0, 300),
      status: i.state === 'closed' ? 'review' : 'ready', depends_on: [],
      summary: `${i.pull_request ? 'Pull request' : 'Issue'} #${i.number}: ${i.state}. Product acceptance unknown.`,
      acceptance_criteria: [], evidence: [{type: i.pull_request ? 'pull_request' : 'issue', ref: `${ref}/${i.pull_request ? 'pull' : 'issues'}/${i.number}`, verification: 'unverified', description: 'Source existence/state observed; product acceptance is not verified.'}]
    }));
    if (!rooms.length) rooms.push({id: `github:${repo.id}:overview`, zone_id: zone, name: repo.name || this.repository, status: 'planned', depends_on: [], acceptance_criteria: [], evidence: [{type: 'other', ref, verification: 'unverified', description: 'Repository metadata only; no product acceptance evidence.'}]});
    const revision = digest([repo.id, repo.updated_at, rooms]);
    const snapshot: ProjectSnapshot = {schema_version: '1.0', project: {id: this.projectId, name: this.repository, source: {kind: 'github', is_demo: false, reference: ref}}, revision, observed_at: now, zones: [{id: zone, name: 'Observed repository work items'}], rooms, agents: []};
    const events: AgentEvent[] = issues.map((i, n) => {
      const key = `github:${i.id}:${digest([i.updated_at, rooms[n]])}`;
      return {schema_version: '1.0', event_id: key, idempotency_key: key, project_id: this.projectId, task_id: rooms[n].id, room_id: rooms[n].id,
        agent_id: 'source:github', source_kind: 'project', event_type: 'progress', status: i.state === 'closed' ? 'review' : 'unknown',
        occurred_at: i.updated_at, observed_at: now, source: this.id, source_ref: rooms[n].evidence[0].ref, is_demo: false,
        message: `${i.pull_request ? 'Pull request' : 'Issue'} #${i.number} observed ${i.state}; acceptance unknown.`};
    });
    return {snapshot, events, warnings: ['Issue/PR projection only; capabilities, dependencies, CI and acceptance are unknown. REST pagination is not an atomic repository revision. GitHub observations never imply an Agent is working.']};
  }
}

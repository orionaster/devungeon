import {createProjection} from './projection.js';
const byId = id => document.getElementById(id);
let projection = createProjection(), stream = null, connected = false, replaying = false, agentLive = false, total = 0;
const text = (id, value) => { byId(id).textContent = value; };
function link(ref) {
  if (!/^https:\/\/github\.com\/[a-zA-Z0-9_.\/-]+$/.test(ref)) return document.createTextNode(ref);
  const a = document.createElement('a'); a.href = ref; a.textContent = ref; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
async function snapshot() {
  try {
    const response = await fetch('/v1/snapshot'); const data = await response.json(); const s = data.snapshot;
    if (!s) { text('project', 'Project unavailable; no snapshot received.'); return; }
    text('project', s.project.name); text('revision', `Observed ${s.observed_at} · revision ${s.revision}`);
    byId('rooms').replaceChildren(...s.rooms.map(r => {
      const li = document.createElement('li'); li.append(`${r.name} — ${r.status} · `, link(r.evidence[0]?.ref ?? 'Evidence unavailable')); return li;
    }));
  } catch { text('warnings', 'DISCONNECTED · retained snapshot may be old.'); }
}
function status(s) {
  agentLive = s.connections.agent.mode === 'LIVE';
  text('connections', Object.entries(s.connections).map(([name, c]) => `${name.toUpperCase()}: ${c.mode} (${c.reason}) · last observation ${c.last_success_at ?? 'never'}${c.retry_at ? ` · retry after ${c.retry_at}` : ''}`).join('\n'));
  text('warnings', s.warnings.join(' '));
  text('capabilities', `Project: ${s.capabilities.project.join(', ')} · Agent: ${s.capabilities.agent.join(', ') || 'not connected'} · commands: unavailable`);
}
function record(r) {
  if (!projection.apply(r)) return;
  const e = r.event; total++; text('count', `${total} unique events in this view`);
  const li = document.createElement('li');
  li.dataset.mode = r.mode; li.dataset.kind = e.source_kind;
  li.append(`[${r.mode}${e.is_demo ? ' / DEMO' : ''}] ${e.source_kind} · ${e.event_type} · ${e.status} · ${e.message} `);
  const detail = document.createElement('small');
  detail.textContent = `\nAgent ${e.agent_id} · task ${e.task_id} · occurred ${e.occurred_at} · observed ${e.observed_at} · event ${e.event_id} · `;
  li.append(detail, link(e.source_ref)); byId('events').prepend(li);
  while (byId('events').children.length > 100) byId('events').lastChild.remove();
}
function reset() { projection = createProjection(); total = 0; byId('events').replaceChildren(); text('count', '0 events'); }
function disconnectedSources() { text('connections', 'DISCONNECTED · source statuses cannot be refreshed; retained observations are historical.'); }
function disconnect() { stream?.close(); stream = null; connected = false; agentLive = false; disconnectedSources(); text('transport', 'DISCONNECTED · viewer stopped; displayed observations are historical.'); }
function live() {
  disconnect(); reset(); replaying = false; text('transport', 'DISCONNECTED · connecting…');
  stream = new EventSource('/v1/stream');
  stream.onopen = () => { connected = true; text('transport', 'LIVE TRANSPORT · each source and event has its own freshness label.'); void snapshot(); };
  stream.onerror = () => { connected = false; agentLive = false; disconnectedSources(); text('transport', 'DISCONNECTED · reconnecting; missed records return as REPLAY.'); };
  stream.addEventListener('status', e => status(JSON.parse(e.data)));
  stream.addEventListener('snapshot', () => { void snapshot(); });
  stream.addEventListener('record', e => record(JSON.parse(e.data)));
}
byId('live').onclick = live; byId('disconnect').onclick = disconnect;
byId('replay').onclick = async () => {
  disconnect(); reset(); replaying = true; text('transport', 'REPLAY · recorded history; no current work implied.');
  try {
    let cursor = 0, more = true;
    while (more && replaying) {
      const response = await fetch(`/v1/events?after=${cursor}&limit=1000`); if (!response.ok) throw new Error();
      const data = await response.json(); data.records.forEach(record); cursor = data.next_cursor; more = data.has_more;
    }
  } catch { text('transport', 'DISCONNECTED · history unavailable.'); }
};
setInterval(() => {
  const active = projection.active(Date.now(), connected && agentLive && !replaying);
  const latest = [...projection.agents.values()].at(-1);
  byId('activity').classList.toggle('working', active.length > 0);
  text('activity', active.length ? `LIVE · observed tool action: ${active[0].event.agent_id}` : latest ? `${replaying ? 'REPLAY' : connected && agentLive ? latest.mode : connected ? 'STALE' : 'DISCONNECTED'} · latest Agent observation: ${latest.event.event_type} (${latest.event.status}) · no live work animation.` : 'No live Agent action observed.');
}, 100);
live();

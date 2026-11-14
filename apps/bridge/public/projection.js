/** Renderer-neutral consumer. No project acceptance or gameplay mutation exists here. */
export function createProjection() {
  const seen = new Set(); const agents = new Map();
  return {
    agents,
    apply(record) {
      const e = record.event;
      if (seen.has(e.event_id)) return false;
      seen.add(e.event_id);
      if (e.source_kind === 'agent') {
        const previous = agents.get(e.agent_id);
        if (!previous || Date.parse(e.occurred_at) > Date.parse(previous.event.occurred_at) ||
          (e.occurred_at === previous.event.occurred_at && record.cursor > previous.cursor)) agents.set(e.agent_id, record);
      }
      return true;
    },
    active(now, connected) {
      if (!connected) return [];
      return [...agents.values()].filter(r => r.mode === 'LIVE' && !r.event.is_demo &&
        r.event.status === 'working' && now >= Date.parse(r.event.occurred_at) && now - Date.parse(r.event.occurred_at) < 3000);
    }
  };
}

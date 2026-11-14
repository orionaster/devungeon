import { Ajv2020 } from 'ajv/dist/2020.js';
import { default as formats } from 'ajv-formats';
import snapshotSchema from './schema/project-snapshot.json' with { type: 'json' };
import blueprintSchema from './schema/world-blueprint.json' with { type: 'json' };
import type { DesignerProposal, ProjectGraph, ProjectSnapshot, WorldBlueprint } from './types.js';
import { byId, compare, MAX_ROOMS, PREFABS, requireThat } from './util.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
// NodeNext's CJS default interop and browser bundlers both expose this callable.
const addFormats = formats as unknown as (instance: Ajv2020) => void;
addFormats(ajv);
const validateSnapshot = ajv.compile<ProjectSnapshot>(snapshotSchema);
const validateBlueprint = ajv.compile(blueprintSchema);
const validateDesigner = ajv.compile<DesignerProposal>({
  type: 'object', additionalProperties: false, required: ['schema_version'],
  properties: {
    schema_version: { const: '1.0' },
    zones: { type: 'array', maxItems: MAX_ROOMS, items: { type: 'object', additionalProperties: false, required: ['zone_id', 'theme'], properties: { zone_id: { type: 'string' }, theme: { type: 'string', minLength: 1, maxLength: 200 }, narrative: { type: 'string', maxLength: 2000 } } } },
    rooms: { type: 'array', maxItems: MAX_ROOMS, items: { type: 'object', additionalProperties: false, required: ['room_id'], properties: { room_id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 }, narrative: { type: 'string', maxLength: 2000 }, prefab: { enum: [...PREFABS] } } } }
  }
});

function unique(ids: string[], label: string) {
  requireThat(new Set(ids).size === ids.length, 'DUPLICATE_ID', `Duplicate ${label} ID.`, ids);
}
export function readSnapshot(input: unknown): ProjectSnapshot {
  requireThat(validateSnapshot(input), 'INVALID_SNAPSHOT', ajv.errorsText(validateSnapshot.errors, { separator: '; ' }));
  const s = structuredClone(input) as ProjectSnapshot;
  requireThat(s.rooms.length <= MAX_ROOMS && s.zones.length <= MAX_ROOMS && s.agents.length <= 512, 'INPUT_LIMIT', `At most ${MAX_ROOMS} rooms/zones and 512 agents are supported.`);
  requireThat(s.rooms.reduce((n, r) => n + r.depends_on.length, 0) <= 1024, 'INPUT_LIMIT', 'At most 1024 dependency edges are supported.');
  unique(s.zones.map(x => x.id), 'zone'); unique(s.rooms.map(x => x.id), 'room'); unique(s.agents.map(x => x.id), 'agent');
  const zones = new Set(s.zones.map(z => z.id)); const rooms = new Set(s.rooms.map(r => r.id));
  requireThat(s.project.source.kind !== 'synthetic' || s.project.source.is_demo, 'DEMO_REQUIRED', 'A synthetic project must be marked is_demo=true.');
  for (const r of s.rooms) {
    requireThat(zones.has(r.zone_id), 'MISSING_ZONE', `Room ${r.id} references unknown zone ${r.zone_id}.`, [r.id, r.zone_id]);
    for (const dep of r.depends_on) requireThat(rooms.has(dep), 'MISSING_DEPENDENCY', `Room ${r.id} depends on missing room ${dep}.`, [r.id, dep]);
    requireThat(!r.depends_on.includes(r.id), 'DEPENDENCY_CYCLE', `Room ${r.id} depends on itself.`, [r.id]);
    requireThat(r.status !== 'accepted' || s.project.source.is_demo || r.evidence.some(e => e.verification === 'verified'), 'UNVERIFIED_ACCEPTANCE', `Real accepted room ${r.id} needs verified evidence.`, [r.id]);
    r.depends_on.sort(compare);
    r.evidence.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
  }
  for (const a of s.agents) {
    requireThat(a.room_id === undefined || rooms.has(a.room_id), 'MISSING_AGENT_ROOM', `Agent ${a.id} references missing room ${a.room_id}.`, [a.id]);
    requireThat(!s.project.source.is_demo || a.is_demo === true, 'DEMO_REQUIRED', `Agent ${a.id} in a demo snapshot must be marked is_demo=true.`, [a.id]);
  }
  s.rooms.sort(byId); s.zones.sort(byId); s.agents.sort(byId);
  return s;
}

export function buildGraph(s: ProjectSnapshot): ProjectGraph {
  const rooms = new Map(s.rooms.map(r => [r.id, r]));
  const order: string[] = []; const pending: string[] = []; const done = new Set<string>();
  function visit(id: string) {
    requireThat(!pending.includes(id), 'DEPENDENCY_CYCLE', `Dependency cycle: ${[...pending, id].join(' -> ')}.`, [...pending.slice(pending.indexOf(id)), id]);
    if (done.has(id)) return;
    pending.push(id);
    for (const dep of rooms.get(id)!.depends_on) visit(dep);
    pending.pop(); done.add(id); order.push(id);
  }
  for (const room of s.rooms) visit(room.id);
  const levels = new Map<string, number>();
  for (const id of order) levels.set(id, Math.max(-1, ...rooms.get(id)!.depends_on.map(d => levels.get(d)!)) + 1);
  return {
    project: s.project, revision: s.revision, observed_at: s.observed_at,
    zones: s.zones, features: s.rooms, agents: s.agents,
    dependencies: s.rooms.flatMap(r => r.depends_on.map(prerequisite => ({ prerequisite, dependent: r.id }))),
    topological_order: order,
    stages: [...new Set(levels.values())].sort((a, b) => a - b).map(level => ({ level, room_ids: order.filter(id => levels.get(id) === level).sort(compare) })),
    unknowns: ['Snapshot v1 does not provide separate task entities or task progress.', 'Snapshot v1 has no per-feature verified_at or confidence field; evidence verification is preserved as supplied.']
  };
}

export function readDesigner(input: unknown, graph: ProjectGraph): DesignerProposal {
  if (input === undefined) return { schema_version: '1.0' };
  requireThat(validateDesigner(input), 'INVALID_DESIGNER', ajv.errorsText(validateDesigner.errors, { separator: '; ' }));
  const d = structuredClone(input) as DesignerProposal;
  unique((d.zones ?? []).map(z => z.zone_id), 'designer zone'); unique((d.rooms ?? []).map(r => r.room_id), 'designer room');
  for (const z of d.zones ?? []) requireThat(graph.zones.some(x => x.id === z.zone_id), 'DESIGNER_UNKNOWN_ENTITY', `Designer references unknown zone ${z.zone_id}.`, [z.zone_id]);
  for (const r of d.rooms ?? []) requireThat(graph.features.some(x => x.id === r.room_id), 'DESIGNER_UNKNOWN_ENTITY', `Designer references unknown room ${r.room_id}.`, [r.room_id]);
  return d;
}

export function checkBlueprint(blueprint: WorldBlueprint) {
  requireThat(validateBlueprint(blueprint), 'BLUEPRINT_INVALID', ajv.errorsText(validateBlueprint.errors));
}

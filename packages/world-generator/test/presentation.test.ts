import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileProjectGraph, compileWorld, describeDiagnostic, describeHeroRooms, describeWorld, renderWorldMessage, renderWorldName, toHeroScene, WORLD_MESSAGE_KEYS, type CompiledWorld, type ProjectSnapshot, type WorldTranslator } from '../src/index.js';

const fixture = (name = 'tiny-landing-page'): ProjectSnapshot => JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
function world(input = fixture()): CompiledWorld {
  const result = compileWorld(input, { seed: 1337 });
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.world;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
const translator = (locale: string): WorldTranslator => (key, params) => `${locale}:${key}${JSON.stringify(params ?? {})}`;

describe('source facts / pack adapter boundary', () => {
  it('exports validated semantic facts without a seed, layout, genre or locale', () => {
    const snapshot = freeze(fixture('agent-workbench-synthetic'));
    const result = compileProjectGraph(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph).toEqual(world(snapshot).graph);
    expect(result.graph).not.toHaveProperty('layout');
    expect(result.graph).not.toHaveProperty('locale');
    expect(result.graph.features.map(f => f.id)).toEqual(['dispatch', 'executor', 'goals', 'history', 'milestone', 'planning', 'registry', 'retrieval']);
  });
  it('keeps schema and graph failures explicit before any rendering', () => {
    const input = fixture(); input.rooms[0]!.depends_on = ['launch'];
    const result = compileProjectGraph(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]!.code).toBe('DEPENDENCY_CYCLE');
  });
});

describe('shared-i18n presentation sidecar', () => {
  it('resolves the same message refs with the host translator while world data stays identical', () => {
    const compiled = freeze(world()), scene = freeze(toHeroScene(compiled)), before = JSON.stringify({ compiled, scene });
    const display = describeWorld(compiled);
    for (const locale of ['zh-CN', 'en-US', 'zh-CN']) {
      const labels = describeHeroRooms(compiled, scene);
      expect(renderWorldName(labels[0]!.name, translator(locale))).toContain(`${locale}:world.foyer.name`);
      const contact = labels.find(r => r.room_id === 'contact')!;
      const status = renderWorldMessage(contact.reasons[0]!, translator(locale));
      expect(status).toContain('world.lock.statusNotAccepted');
      expect(status).toContain(`${locale}:world.status.active`);
      expect(renderWorldName(contact.name, translator(locale))).toBe('Contact CTA');
      expect(display.rooms.find(r => r.room_id === 'contact')!.original_name).toBe('Contact CTA');
      expect(JSON.stringify({ compiled, scene })).toBe(before);
    }
  });
  it('preserves original project names, IDs, evidence and provenance including non-English source', () => {
    const input = fixture(); input.project.name = '原始项目 / original'; input.rooms[0]!.name = 'Original accepted title';
    input.project.source.reference = 'https://github.com/orionaster/devungeon';
    const compiled = world(input), display = describeWorld(compiled), room = display.rooms.find(r => r.room_id === 'hero')!;
    expect(display.original_project_name).toBe(input.project.name);
    expect(display.project_id).toBe(input.project.id);
    expect(display.project_revision).toBe(input.revision);
    expect(display.observed_at).toBe(input.observed_at);
    expect(display.source).toEqual(input.project.source);
    expect(room.evidence).toEqual(input.rooms[0]!.evidence);
    room.evidence[0]!.ref = 'mutated display copy';
    expect(compiled.graph.features.find(f => f.id === 'hero')!.evidence[0]!.ref).toBe(input.rooms[0]!.evidence[0]!.ref);
  });
  it('distinguishes Designer text from original source facts', () => {
    const result = compileWorld(fixture(), { seed: 1337, designer: { schema_version: '1.0', rooms: [{ room_id: 'hero', title: 'Decorative vault' }], zones: [{ zone_id: 'experience', theme: 'Decorative observatory' }] } });
    if (!result.ok) throw Error(JSON.stringify(result));
    const room = describeWorld(result.world).rooms.find(r => r.room_id === 'hero')!;
    expect(room.name).toEqual({ kind: 'design', text: 'Decorative vault' });
    expect(room.original_name).toBe('Hero section');
    expect(describeWorld(result.world).zones[0]!.theme).toEqual({ kind: 'design', text: 'Decorative observatory' });
    expect(describeWorld(result.world).zones[0]!.original_theme_hint).toBe('cozy starter dungeon');
  });
  it('rejects a mismatched scene/display pairing instead of showing another project as fact', () => {
    const compiled = world(), scene = toHeroScene(compiled);
    scene.project_context.project_id = 'another-project';
    expect(() => describeHeroRooms(compiled, scene)).toThrow('same project');
  });
  it('describes dependency locks structurally without parsing English reasons', () => {
    const compiled = world(fixture('agent-workbench-synthetic'));
    const feature = compiled.scene.rooms.find(r => r.room_id === 'executor')!;
    feature.lock.reasons = ['This arbitrary legacy English message must never be parsed.'];
    const room = describeWorld(compiled).rooms.find(r => r.room_id === 'executor')!;
    expect(room.reasons[0]!.key).toBe('world.lock.statusNotAccepted');
    expect(room.reasons[1]).toEqual({ key: 'world.lock.dependencies', params: { ids: 'dispatch, planning' } });
  });
  it('marks removed rooms as historical without inventing their old project state', () => {
    const input = fixture(), old = world(input); input.rooms.pop();
    const result = compileWorld(input, { seed: 1337, previous: old.layout });
    if (!result.ok) throw Error(JSON.stringify(result));
    const removed = describeHeroRooms(result.world, toHeroScene(result.world)).find(r => r.room_id === 'launch')!;
    expect(removed.name).toEqual({ key: 'world.removed.name' });
    expect(removed.status).toEqual({ key: 'world.status.removed' });
    expect(removed.evidence).toEqual([]);
  });
  it('uses a unique, explicit translation vocabulary and preserves raw error details', () => {
    expect(new Set(WORLD_MESSAGE_KEYS).size).toBe(WORLD_MESSAGE_KEYS.length);
    for (const code of ['INVALID_SNAPSHOT', 'DEPENDENCY_CYCLE', 'LAYOUT_UNSATISFIABLE', 'INVALID_PREVIOUS_LAYOUT', 'INVALID_DESIGNER', 'HERO_SCENE_LIMIT', 'FUTURE_ERROR']) {
      const diagnostic = describeDiagnostic({ code, severity: 'error', message: `Original ${code}`, entity_ids: ['原始-id'] });
      expect(WORLD_MESSAGE_KEYS).toContain(diagnostic.summary.key);
      expect(diagnostic.original_message).toBe(`Original ${code}`);
      expect(diagnostic.entity_ids).toEqual(['原始-id']);
      expect(diagnostic.summary.params).toEqual({ code });
    }
  });
});

describe('explicit HERO door/source contract', () => {
  it.each(['tiny-landing-page', 'agent-workbench-synthetic'])('%s retains source identities and exact south-door geometry', name => {
    const compiled = freeze(world(fixture(name))), scene = toHeroScene(compiled);
    expect(scene.project_context).toEqual({ project_id: compiled.graph.project.id, project_revision: compiled.graph.revision, observed_at: compiled.graph.observed_at, source: compiled.graph.project.source });
    for (const d of compiled.scene.doors) expect(scene.doors.find(r => r.room_id === d.room_id)).toEqual({ room_id: d.room_id, x: d.position.x + .5, z: d.position.z + .5, axis: 'x', locked: d.locked });
    expect(scene.doors).toHaveLength(compiled.layout.rooms.length);
    expect(scene.doors.find(d => d.room_id === 'planning')?.x).not.toBe(23);
    expect(scene.agents).toEqual([]); // no source observer or unapproved Agent actor fabricated
  });
  it('stages assigned source Agents as visual-only without changing access, role or IDs', () => {
    const input = fixture('agent-workbench-synthetic'), compiled = freeze(world(input));
    const plain = toHeroScene(compiled), staged = toHeroScene(compiled, { includeAgents: true });
    expect(staged.rooms).toEqual(plain.rooms); expect(staged.corridors).toEqual(plain.corridors); expect(staged.doors).toEqual(plain.doors);
    for (const a of staged.agents) {
      const original = input.agents.find(s => s.id === a.agent_id)!;
      expect(a.room_id).toBe(original.room_id); expect(a.source_role).toBe(original.role);
      expect(a.is_demo).toBe(original.is_demo); expect(a.visual_only).toBe(true);
      const room = staged.rooms.find(r => r.room_id === a.room_id)!;
      expect(Math.abs(a.x - room.x)).toBeLessThan(room.width / 2);
      expect(Math.abs(a.z - room.z)).toBeLessThan(room.depth / 2);
      expect(room.enterable).toBe(false);
    }
    expect(staged.agents.map(a => a.agent_id)).toEqual(['agent-boss', 'agent-build', 'agent-review']);
  });
  it('does not invent a source-room assignment when an Agent has none', () => {
    const input = fixture(); delete input.agents[0]!.room_id;
    const scene = toHeroScene(world(input), { includeAgents: true });
    expect(scene.agents).toEqual([]); expect(scene.agent_ids_without_room).toEqual(['agent-site']);
  });
  it('checks explicit door coordinates against the renderer budget', () => {
    const compiled = world(); compiled.scene.doors[0]!.position.x = 1000;
    expect(() => toHeroScene(compiled)).toThrow('door and actor coordinates');
  });
});

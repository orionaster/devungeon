import { describe, expect, it } from 'vitest';
import { featureWorldSpecSchema, workActivitySchema, type FeatureWorldSpec } from '../../../packages/living-world/src/contracts';

export const CONTRACT_EXAMPLE: FeatureWorldSpec = {
  schema_version: '1.0', project_id: 'synthetic-contract', project_revision: 'demo-1', source_mode: 'DEMO',
  generator: { kind: 'deterministic', version: '1.0', reason_refs: [] },
  features: [{ feature_id: 'navigation', room_id: 'navigation', title: { 'zh-CN': '导航', 'en-US': 'Navigation' }, status: 'accepted', acceptance: 'source-declared',
    source_summary: 'Synthetic navigation example', depends_on: [], intent: { 'zh-CN': '查看路径', 'en-US': 'Trace routes' }, exists: [], missing: [], unknowns: [],
    evidence: [{ type: 'test', ref: 'synthetic:navigation', verification: 'synthetic' }],
    objects: [{ object_id: 'navigation:map', kind: 'map-table', label: { 'zh-CN': '地图桌', 'en-US': 'Map table' }, interaction: 'trace-dependencies', operations: ['scan','test'], evidence_refs: ['synthetic:navigation'], reason: { 'zh-CN': '演示导航', 'en-US': 'Navigation demonstration' } }],
  }],
};
describe('Living-world v1 sidecar boundary', () => {
  it('roundtrips a versioned feature/object/interaction contract', () => expect(featureWorldSpecSchema.parse(CONTRACT_EXAMPLE)).toEqual(CONTRACT_EXAMPLE));
  it('rejects invented evidence and duplicate object identity', () => {
    const value = structuredClone(CONTRACT_EXAMPLE);
    value.features[0].objects[0].evidence_refs = ['https://invented.invalid'];
    expect(featureWorldSpecSchema.safeParse(value).success).toBe(false);
    value.features[0].objects[0].evidence_refs = [];
    value.features[0].objects.push(value.features[0].objects[0]);
    expect(featureWorldSpecSchema.safeParse(value).success).toBe(false);
  });
  it('rejects arbitrary executable or command fields', () => {
    expect(featureWorldSpecSchema.safeParse({ ...CONTRACT_EXAMPLE, execute: 'shell' }).success).toBe(false);
    expect(workActivitySchema.safeParse({ schema_version: '9.0', command: 'deploy' }).success).toBe(false);
  });
});

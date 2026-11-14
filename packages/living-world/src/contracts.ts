import { z } from 'zod';
import type { SceneDefinition } from '../../dungeon-engine/src/types';

/** Optional v1 sidecars. None of these values grants project acceptance or commands. */
export const WORLD_SPEC_VERSION = '1.0' as const;
export const localizedTextSchema = z.strictObject({ 'zh-CN': z.string().min(1).max(1000), 'en-US': z.string().min(1).max(1000) });
const id = z.string().min(1).max(300);
const refs = z.array(z.string().min(1).max(2000)).max(30);
export const objectKindSchema = z.enum(['map-table', 'access-gate', 'relay-board', 'archive', 'test-bench', 'unknown-plinth']);
export const interactionKindSchema = z.enum(['trace-dependencies', 'preview-access', 'route-signal', 'compare-evidence', 'inspect']);
export const operationSchema = z.enum(['scan', 'build', 'test', 'review', 'read']);
export const featureObjectSchema = z.strictObject({
  object_id: id, kind: objectKindSchema, label: localizedTextSchema,
  interaction: interactionKindSchema, operations: z.array(operationSchema).max(5),
  evidence_refs: refs, reason: localizedTextSchema,
});
export const featureRepresentationSchema = z.strictObject({
  feature_id: id, room_id: id, title: localizedTextSchema,
  status: z.enum(['planned','ready','active','blocked','review','accepted','failed','regressed','archived']),
  acceptance: z.enum(['source-declared', 'unknown']),
  source_summary: z.string().max(4000), depends_on: z.array(id).max(128),
  intent: localizedTextSchema, exists: z.array(z.string().max(2000)).max(30),
  missing: z.array(z.string().max(2000)).max(30), unknowns: z.array(z.string().max(2000)).max(30),
  evidence: z.array(z.strictObject({
    type: z.enum(['commit','pull_request','issue','test','deployment','manual_review','other']),
    ref: z.string().min(1).max(2000), verification: z.enum(['verified','unverified','synthetic']), description: z.string().max(4000).optional(),
  })).max(100),
  objects: z.array(featureObjectSchema).min(1).max(4),
});
export const featureWorldSpecSchema = z.strictObject({
  schema_version: z.literal(WORLD_SPEC_VERSION), project_id: id, project_revision: id,
  source_mode: z.enum(['DEMO','SOURCE']),
  generator: z.strictObject({ kind: z.enum(['deterministic','validated-proposal','owner-override']), version: id, reason_refs: refs }),
  features: z.array(featureRepresentationSchema).max(128),
}).superRefine((spec, ctx) => {
  const ids = new Set<string>(), objects = new Set<string>();
  for (const feature of spec.features) {
    if (ids.has(feature.feature_id) || feature.room_id !== feature.feature_id) ctx.addIssue({ code: 'custom', message: 'Feature/room identity must be unique and source-aligned' });
    ids.add(feature.feature_id);
    for (const object of feature.objects) {
      if (objects.has(object.object_id)) ctx.addIssue({ code: 'custom', message: 'Duplicate object identity' });
      objects.add(object.object_id);
      if (object.evidence_refs.some(ref => !feature.evidence.some(e => e.ref === ref))) ctx.addIssue({ code: 'custom', message: 'Object evidence must reference this feature source' });
    }
  }
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type FeatureObject = z.infer<typeof featureObjectSchema>;
export type FeatureRepresentation = z.infer<typeof featureRepresentationSchema>;
export type FeatureWorldSpec = z.infer<typeof featureWorldSpecSchema>;
export type WorkOperation = z.infer<typeof operationSchema>;

/** SCENE owns geometry and checks prop/actor/door clearance against the base map. */
export interface PlacedFeatureObject extends FeatureObject {
  feature_id: string; room_id: string; x: number; z: number; width: number; depth: number;
  access: 'enterable' | 'locked-preview';
}
export interface FeatureSceneBinding {
  scene: SceneDefinition;
  objects: readonly PlacedFeatureObject[];
  diagnostics: readonly string[];
}

export const workActivitySchema = z.strictObject({
  schema_version: z.literal('1.0'), event_id: id, project_id: id, project_revision: id,
  agent_id: id, actor_kind: z.enum(['agent','demo-agent','local-program']),
  task_id: id, feature_id: id, room_id: id, object_id: id,
  operation: operationSchema, phase: z.enum(['running','completed','failed','blocked']),
  mode: z.enum(['LIVE','DEMO','REPLAY','STALE','DISCONNECTED']), is_demo: z.boolean(),
  source_kind: z.enum(['agent','project','local-program']), source: id, source_ref: z.string().min(1).max(2000),
  started_at: z.iso.datetime(), observed_at: z.iso.datetime(), expires_at: z.iso.datetime(), ended_at: z.iso.datetime().optional(),
  confidence: z.literal('explicit'),
});
export type WorkActivity = z.infer<typeof workActivitySchema>;
/** Only justified running work is returned. Historical/raw receipts remain inspectable separately. */
export interface WorldActivityReader { activity(id: string, now?: number): WorkActivity | undefined }
export interface WorldActivityContext {
  spec: FeatureWorldSpec; objects: readonly PlacedFeatureObject[];
  agents: SceneDefinition['agents']; connected: boolean;
}

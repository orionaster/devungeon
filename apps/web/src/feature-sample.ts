import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  compileProjectGraph,
  type ProjectSnapshot,
} from "../../../packages/world-generator/src/index";
import { scoutStatusSchema } from "../../../packages/workspace-ui/src/scout-adapter";
import type { ScoutSourceSnapshot } from "./scout-source";

export const SAMPLE_PROJECT_ID = "github:orionaster/devungeon";
export const SAMPLE_ROOM_ID = "game-only:observatory";
export const SAMPLE_AGENT_ID = "demo:sample-scout";
export const SAMPLE_FEATURE_ID = "devungeon.public-project-observation";
export const SAMPLE_OBJECT_IDS = [
  "source-desk",
  "evidence-cabinet",
  "test-bench",
] as const;
export type SampleObjectId = (typeof SAMPLE_OBJECT_IDS)[number];
export type SampleMode = "LIVE" | "DEMO" | "REPLAY" | "STALE" | "DISCONNECTED";

/** Optional world-neutral sidecar. It describes an authored representation of a
 * real capability; it cannot add acceptance to ProjectSnapshot or unlock rooms. */
export const OBSERVATORY_FEATURE = Object.freeze({
  version: "1.0",
  feature_id: SAMPLE_FEATURE_ID,
  project_id: SAMPLE_PROJECT_ID,
  acceptance: "unknown",
  room_id: SAMPLE_ROOM_ID,
  access: "game-only",
  metaphor: "public-project-observatory",
  objects: [
    {
      object_id: "source-desk",
      purpose: "read-public-project",
      evidence: "packages/project-adapters/github.ts",
    },
    {
      object_id: "evidence-cabinet",
      purpose: "inspect-original-provenance",
      evidence: "apps/bridge/src/journal.ts",
    },
    {
      object_id: "test-bench",
      purpose: "compare-scripted-task-actions",
      evidence: "apps/web/src/feature-sample.ts",
    },
  ],
  reason_refs: [
    "https://github.com/orionaster/devungeon/issues/17",
    "https://github.com/orionaster/devungeon/blob/d945eacd8b81e745228296e6d8178c4014e79d5d/packages/project-adapters/github.ts",
    "https://github.com/orionaster/devungeon/blob/d945eacd8b81e745228296e6d8178c4014e79d5d/apps/bridge/src/bridge.ts",
  ],
} as const);

export const sampleActivitySchema = z.strictObject({
  event_id: z.string().min(1),
  project_id: z.literal(SAMPLE_PROJECT_ID),
  room_id: z.literal(SAMPLE_ROOM_ID),
  agent_id: z.enum([SAMPLE_AGENT_ID, "local-public-observer"]),
  actor_kind: z.enum(["demo-agent", "local-program"]),
  task_id: z.string().min(1),
  station_id: z.enum(SAMPLE_OBJECT_IDS),
  kind: z.enum(["scan", "test", "read"]),
  phase: z.enum(["running", "completed", "failed"]),
  mode: z.enum(["LIVE", "DEMO", "REPLAY", "STALE", "DISCONNECTED"]),
  is_demo: z.boolean(),
  source_ref: z.string().min(1),
  started_at: z.iso.datetime(),
  observed_at: z.iso.datetime(),
  ended_at: z.iso.datetime().optional(),
  expires_at: z.iso.datetime(),
  confidence: z.literal("explicit"),
});
export type SampleActivity = z.infer<typeof sampleActivitySchema>;
export interface SampleActivityReader {
  activity(id: string, now?: number): SampleActivity | undefined;
}

/** Fail closed for foreign, historical, contradictory or expired metadata.
 * Activity type comes from the bounded operation, never a provider's prose. */
export function resolveSampleActivity(
  raw: unknown,
  id: string,
  now = Date.now(),
): SampleActivity | undefined {
  const checked = sampleActivitySchema.safeParse(raw);
  if (!checked.success) return;
  const action = checked.data;
  const start = Date.parse(action.started_at),
    observed = Date.parse(action.observed_at),
    expiry = Date.parse(action.expires_at);
  if (action.agent_id !== id && action.station_id !== id) return;
  if (
    action.phase !== "running" ||
    action.ended_at ||
    start > now ||
    observed > now ||
    observed < start ||
    expiry <= now ||
    expiry <= start ||
    expiry - start > 15_000
  )
    return;
  if (action.actor_kind === "demo-agent") {
    if (
      action.agent_id !== SAMPLE_AGENT_ID ||
      !action.is_demo ||
      action.mode !== "DEMO" ||
      !["scan", "test"].includes(action.kind)
    )
      return;
    if (
      action.station_id !==
      (action.kind === "scan" ? "source-desk" : "test-bench")
    )
      return;
    if (
      !new RegExp(`^demo://devungeon/observatory/${action.kind}/[0-9]+$`).test(
        action.source_ref,
      )
    )
      return;
  } else if (
    action.agent_id !== "local-public-observer" ||
    action.is_demo ||
    action.mode !== "LIVE" ||
    action.kind !== "read" ||
    action.station_id !== "source-desk" ||
    action.source_ref !== "/scout-read/v1/snapshot"
  )
    return;
  return action;
}

const envelopeSchema = z.object({
  schema_version: z.literal("1.0"),
  connection: scoutStatusSchema.shape.connections.shape.project,
  snapshot: z.unknown(),
});
export interface PublicReadReceipt {
  request_id: string;
  received_at: string;
  endpoint: "/scout-read/v1/snapshot";
  mode: SampleMode;
  revision: string;
  observed_at: string;
  item_count: number;
  source_ref: string;
  /** Original validated source, retained without translation or acceptance edits. */
  snapshot: ProjectSnapshot;
}
export interface FeatureSampleState {
  actions: readonly SampleActivity[];
  receipt: PublicReadReceipt | null;
  error: "unavailable" | "invalid_source" | null;
  reading: boolean;
  now: number;
}
declare global {
  interface Window {
    __DEVUNGEON_FEATURE__?: { snapshot(): FeatureSampleState };
  }
}
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
type SampleSource = Pick<
  ScoutSourceSnapshot,
  "snapshot" | "status" | "records" | "transportConnected" | "error"
>;

/** Independent of game phase, UI locale, commands and approval controllers. It
 * has one fixed credential-free GET capability and clearly scripted DEMO work. */
export class FeatureSampleStore implements SampleActivityReader {
  private listeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private sequence = 0;
  private readonly instance = globalThis.crypto.randomUUID();
  private abort?: AbortController;
  private value: FeatureSampleState = {
    actions: [],
    receipt: null,
    error: null,
    reading: false,
    now: Date.now(),
  };
  constructor(
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.value;
  private update(patch: Partial<FeatureSampleState>) {
    this.value = Object.freeze({ ...this.value, ...patch, now: Date.now() });
    this.listeners.forEach((listener) => listener());
  }
  tick = () => this.update({});
  activity = (id: string, now = Date.now()) => {
    for (const raw of [...this.value.actions].reverse()) {
      const action = resolveSampleActivity(raw, id, now);
      if (action) return action;
    }
    return undefined;
  };
  private append(action: SampleActivity) {
    const valid = Object.freeze(sampleActivitySchema.parse(action));
    this.update({
      actions: Object.freeze([...this.value.actions.slice(-49), valid]),
    });
    return valid;
  }
  private finish(id: string, phase: "completed" | "failed", mode?: SampleMode) {
    this.update({
      actions: Object.freeze(
        this.value.actions.map((action) =>
          action.event_id === id
            ? Object.freeze({
                ...action,
                phase,
                ended_at: new Date().toISOString(),
                ...(mode ? { mode } : {}),
              })
            : action,
        ),
      ),
    });
  }
  runDemo = (kind: "scan" | "test") => {
    // Runtime caller input cannot smuggle an unlisted command/operation.
    if (kind !== "scan" && kind !== "test") return false;
    if (this.activity(SAMPLE_AGENT_ID)) return false;
    const now = Date.now(),
      id = `demo:observatory:${this.instance}:${++this.sequence}`;
    const action = this.append({
      event_id: id,
      project_id: SAMPLE_PROJECT_ID,
      room_id: SAMPLE_ROOM_ID,
      agent_id: SAMPLE_AGENT_ID,
      actor_kind: "demo-agent",
      task_id: `${id}:${kind}`,
      station_id: kind === "scan" ? "source-desk" : "test-bench",
      kind,
      phase: "running",
      mode: "DEMO",
      is_demo: true,
      source_ref: `demo://devungeon/observatory/${kind}/${this.sequence}`,
      started_at: new Date(now).toISOString(),
      observed_at: new Date(now).toISOString(),
      expires_at: new Date(now + 6500).toISOString(),
      confidence: "explicit",
    });
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.finish(action.event_id, "completed");
    }, 6000);
    this.timers.add(timer);
    return true;
  };
  replayLastDemo = () => {
    if (this.activity(SAMPLE_AGENT_ID)) return false;
    const previous = [...this.value.actions]
      .reverse()
      .find(
        (action) =>
          action.actor_kind === "demo-agent" && action.phase !== "running",
      );
    if (!previous) return false;
    // A replay receipt is inspectable but never returned as active work.
    this.append({
      ...previous,
      event_id: `replay:observatory:${this.instance}:${++this.sequence}`,
      mode: "REPLAY",
      observed_at: new Date().toISOString(),
    });
    return true;
  };
  observePublic = async () => {
    if (this.value.reading) return false;
    const now = Date.now(),
      id = `local:public-read:${this.instance}:${++this.sequence}`;
    const action = this.append({
      event_id: id,
      project_id: SAMPLE_PROJECT_ID,
      room_id: SAMPLE_ROOM_ID,
      agent_id: "local-public-observer",
      actor_kind: "local-program",
      task_id: id,
      station_id: "source-desk",
      kind: "read",
      phase: "running",
      mode: "LIVE",
      is_demo: false,
      source_ref: "/scout-read/v1/snapshot",
      started_at: new Date(now).toISOString(),
      observed_at: new Date(now).toISOString(),
      expires_at: new Date(now + 12_000).toISOString(),
      confidence: "explicit",
    });
    this.update({ reading: true, error: null });
    const abort = (this.abort = new AbortController());
    const timeout = setTimeout(() => abort.abort(), 12_000);
    try {
      const response = await this.fetcher("/scout-read/v1/snapshot", {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("unavailable");
      const envelope = envelopeSchema.parse(await response.json());
      const checked = compileProjectGraph(envelope.snapshot);
      if (
        !checked.ok ||
        checked.graph.project.id !== SAMPLE_PROJECT_ID ||
        checked.graph.project.source.kind !== "github" ||
        checked.graph.project.source.is_demo
      )
        throw new Error("invalid_source");
      // A DEMO transport cannot launder public GitHub data into a live receipt.
      if (envelope.connection.mode === "DEMO")
        throw new Error("invalid_source");
      const snapshot = freezeSource(
        structuredClone(envelope.snapshot) as ProjectSnapshot,
      );
      const receipt = Object.freeze({
        request_id: id,
        endpoint: "/scout-read/v1/snapshot" as const,
        received_at: new Date().toISOString(),
        mode: envelope.connection.mode,
        revision: snapshot.revision,
        observed_at: snapshot.observed_at,
        item_count: snapshot.rooms.length,
        source_ref:
          snapshot.project.source.reference ??
          "https://github.com/orionaster/devungeon",
        snapshot,
      });
      this.finish(action.event_id, "completed", receipt.mode);
      this.update({ receipt, reading: false });
      return true;
    } catch (error) {
      const invalid =
        error instanceof z.ZodError ||
        (error instanceof Error && error.message === "invalid_source");
      this.finish(action.event_id, "failed", "DISCONNECTED");
      this.update({
        reading: false,
        error: invalid ? "invalid_source" : "unavailable",
      });
      return false;
    } finally {
      clearTimeout(timeout);
      if (this.abort === abort) this.abort = undefined;
    }
  };
  dispose() {
    this.abort?.abort();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.listeners.clear();
  }
}

export function useFeatureSample(source?: SampleSource) {
  const [store] = useState(() => new FeatureSampleStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    const timer = setInterval(store.tick, 500);
    return () => clearInterval(timer);
  }, [store]);
  useEffect(() => () => store.dispose(), [store]);
  useEffect(() => {
    const diagnostics = Object.freeze({
      snapshot: () => structuredClone(store.getSnapshot()),
    });
    window.__DEVUNGEON_FEATURE__ = diagnostics;
    return () => {
      if (window.__DEVUNGEON_FEATURE__ === diagnostics)
        delete window.__DEVUNGEON_FEATURE__;
    };
  }, [store]);
  return {
    state,
    source,
    activities: store as SampleActivityReader,
    observePublic: store.observePublic,
    runDemo: store.runDemo,
    replayLastDemo: store.replayLastDemo,
  };
}
export type FeatureSample = ReturnType<typeof useFeatureSample>;

function freezeSource<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeSource);
    Object.freeze(value);
  }
  return value;
}

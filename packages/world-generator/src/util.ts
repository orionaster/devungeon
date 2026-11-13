import type { Bounds, Diagnostic, Placement, Point } from './types.js';

export const GENERATOR_VERSION = '0.1.0';
export const PREFABS = ['stone-chamber', 'workshop', 'archive', 'boss-arena'] as const;
export const DEFAULT_BOUNDS: Bounds = { min_x: -128, max_x: 256, min_z: -128, max_z: 256 };
export const MAX_ROOMS = 128;
export const MAX_PATH_TILES = 100_000;
export const byId = <T extends { id: string }>(a: T, b: T) => compare(a.id, b.id);
// Locale-independent ordering is required for seed reproducibility across machines.
export const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const key = (p: Point) => `${p.x},${p.z}`;
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.z === b.z;
export const edgeId = (from: string | null, to: string) => JSON.stringify([from, to]);
export function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => compare(a, b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const inside = (p: Point, r: Placement) => Math.abs(p.x - r.x) <= (r.width - 1) / 2 && Math.abs(p.z - r.z) <= (r.depth - 1) / 2;
export const inBounds = (p: Point, b: Bounds) => p.x >= b.min_x && p.x <= b.max_x && p.z >= b.min_z && p.z <= b.max_z;
export const door = (r: Placement): Point => ({ x: r.x, z: r.z + (r.depth - 1) / 2 });
export const porch = (r: Placement): Point => ({ x: r.x, z: r.z + (r.depth - 1) / 2 + 1 });
export function cells(r: Placement): Point[] {
  requireThat([r.x, r.z, r.width, r.depth].every(Number.isSafeInteger) && Math.abs(r.x) <= 2048 && Math.abs(r.z) <= 2048 && r.width > 0 && r.depth > 0 && r.width * r.depth <= 262_144, 'INVALID_GEOMETRY', 'Tile enumeration requires bounded integer geometry.');
  const points: Point[] = [];
  for (let iz = 0; iz < r.depth; iz++)
    for (let ix = 0; ix < r.width; ix++) points.push({ x: r.x - (r.width - 1) / 2 + ix, z: r.z - (r.depth - 1) / 2 + iz });
  return points;
}
export class GenerationError extends Error {
  constructor(public code: string, message: string, public ids?: string[]) { super(message); }
  diagnostic(): Diagnostic { return { code: this.code, message: this.message, severity: 'error', ...(this.ids ? { entity_ids: this.ids } : {}) }; }
}
export function requireThat(condition: unknown, code: string, message: string, ids?: string[]): asserts condition {
  if (!condition) throw new GenerationError(code, message, ids);
}

import type { Point, SceneLayout } from './types.js';
import { findTilePath } from './layout.js';
import { key, requireThat } from './util.js';

/** Runtime guard for walking, dodging, respawn and requested teleports.
 * HERO may use Rapier too; its authoritative state must still obey these tiles.
 * The player footprint is conservatively square, maximum half-width 0.4 tiles.
 */
export function createNavigator(scene: SceneLayout) {
  const floor = new Set(scene.navigation.walkable.map(key));
  function canOccupy(p: Point, radius = 0.22): boolean {
    if (![p.x, p.z, radius].every(Number.isFinite) || Math.abs(p.x) > 2049 || Math.abs(p.z) > 2049 || radius < 0 || radius > 0.4) return false;
    for (let z = Math.floor(p.z - radius + 0.5 + 1e-8); z <= Math.floor(p.z + radius + 0.5 - 1e-8); z++)
      for (let x = Math.floor(p.x - radius + 0.5 + 1e-8); x <= Math.floor(p.x + radius + 0.5 - 1e-8); x++) if (!floor.has(key({ x, z }))) return false;
    // radius=0 still checks exactly one tile, including half-integer boundaries.
    return floor.has(key({ x: Math.floor(p.x + 0.5), z: Math.floor(p.z + 0.5) }));
  }
  function move(from: Point, to: Point, radius = 0.22): Point {
    requireThat(canOccupy(from, radius), 'INVALID_PLAYER_POSITION', 'Reconcile player position with safeSpawn after a world update.');
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    if (!Number.isFinite(distance) || distance > 64) return { ...from };
    const steps = Math.max(1, Math.ceil(distance / 0.1));
    let last = { ...from };
    for (let i = 1; i <= steps; i++) {
      const p = { x: from.x + (to.x - from.x) * i / steps, z: from.z + (to.z - from.z) * i / steps };
      if (!canOccupy(p, radius)) break;
      last = p;
    }
    return last;
  }
  function path(from: Point, to: Point): Point[] {
    return findTilePath({ x: Math.round(from.x), z: Math.round(from.z) }, { x: Math.round(to.x), z: Math.round(to.z) }, p => floor.has(key(p)));
  }
  return {
    canOccupy, move, path,
    safeSpawn: (requested: Point = scene.spawn): Point => canOccupy(requested) ? { ...requested } : { ...scene.spawn }
  };
}

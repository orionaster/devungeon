import { compileWorld, createNavigator, type CompiledWorld, type Point, type ProjectSnapshot } from '../src/index.js';
import tinySource from '../../../examples/tiny-landing-page.json';
import complexSource from '../../../examples/agent-workbench-synthetic.json';

const el = (id: string) => document.getElementById(id)!;
const canvas = el('map') as HTMLCanvasElement, context = canvas.getContext('2d')!;
let source = structuredClone(tinySource) as ProjectSnapshot;
let world: CompiledWorld, nav: ReturnType<typeof createNavigator>, player: Point;
let rotation = 0, blockedSteps = 0, compileMs = 0, frames = 0, totalMs = 0, worstMs = 0;
let scale = 8, center: Point = { x: 0, z: 0 }, lastTimestamp = performance.now(), lastDisplay = 0;
const keys = new Set<string>();
function build(previous?: CompiledWorld['layout']) {
  const started = performance.now();
  const result = compileWorld(source, { seed: 1337, previous });
  compileMs = performance.now() - started;
  if (!result.ok) { el('error').textContent = JSON.stringify(result.diagnostics, null, 2); return; }
  el('error').textContent = '';
  world = result.world; nav = createNavigator(world.scene); player = nav.safeSpawn(player);
  el('summary').textContent = `${source.project.name} · ${world.blueprint.rooms.length} rooms / ${world.blueprint.connections.length} dependencies. Seed 1337. ${world.scene.navigation.reachable_room_ids.length} enterable.`;
  el('rooms').replaceChildren(...world.scene.rooms.map(r => {
    const b = document.createElement('button'); b.textContent = `${r.room_id} — ${r.lock.status} · ${r.lock.enterable ? 'OPEN' : 'LOCKED'}`;
    b.onclick = () => inspect(r.room_id); return b;
  }));
  (el('extend') as HTMLButtonElement).disabled = source.rooms.some(r => r.id === 'analytics');
  draw();
}
function inspect(id: string) {
  const room = world.scene.rooms.find(r => r.room_id === id), fact = source.rooms.find(r => r.id === id);
  if (!room || !fact) return;
  el('inspect').textContent = `${room.title}\nID: ${id}\nProject status: ${fact.status}\nEntry: ${room.lock.enterable ? 'open' : 'locked'}\n${room.lock.reasons.join('\n')}\nDependencies: ${fact.depends_on.join(', ') || 'none'}\nCriteria: ${fact.acceptance_criteria.join('; ')}\nEvidence: ${fact.evidence.map(e => `${e.ref} (${e.verification})`).join('; ') || 'none supplied'}\nPosition: ${room.x}, ${room.z}\nDEMO source: ${source.project.source.kind}`;
}
function load(input: unknown) {
  source = structuredClone(input) as ProjectSnapshot; player = undefined as unknown as Point;
  rotation = 0; blockedSteps = 0; build(); el('inspect').textContent = 'Choose a room. Locked rooms remain visible.';
}
function rotate(delta: number) { rotation = (rotation + delta + 4) % 4; draw(); }
el('tiny').onclick = () => load(tinySource); el('complex').onclick = () => load(complexSource);
el('left').onclick = () => rotate(-1); el('right').onclick = () => rotate(1);
el('reset').onclick = () => { player = nav.safeSpawn(); draw(); };
el('extend').onclick = () => {
  source.revision = 'demo-2'; source.zones.push({ id: 'analytics-zone', name: 'Analytics', theme_hint: 'observatory' });
  source.rooms.push({ id: 'analytics', zone_id: 'analytics-zone', name: 'Traffic analytics', status: 'planned', depends_on: [source.rooms[0]!.id], acceptance_criteria: ['Visitor count is reviewable'], evidence: [] });
  build(world.layout);
};
el('regress').onclick = () => { source.revision += '-regressed'; source.rooms[0]!.status = 'regressed'; build(world.layout); inspect(source.rooms[0]!.id); };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'w', 'a', 's', 'd', 'q', 'e', 'r'].includes(k)) e.preventDefault();
  keys.add(k);
  if (!e.repeat && k === 'q') rotate(-1);
  if (!e.repeat && k === 'e') rotate(1);
  if (k === 'r') player = nav.safeSpawn();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.onclick = e => {
  const rect = canvas.getBoundingClientRect(), sx = (e.clientX - rect.left) * canvas.width / rect.width - canvas.width / 2, sy = (e.clientY - rect.top) * canvas.height / rect.height - canvas.height / 2;
  const a = -rotation * Math.PI / 2;
  const p = { x: (sx * Math.cos(a) - sy * Math.sin(a)) / scale + center.x, z: (sx * Math.sin(a) + sy * Math.cos(a)) / scale + center.z };
  const r = world.scene.rooms.find(r => Math.abs(r.x - p.x) < r.width / 2 && Math.abs(r.z - p.z) < r.depth / 2);
  if (r) inspect(r.room_id);
  canvas.focus();
};
function draw() {
  if (!world) return;
  const { tiles } = world.scene;
  const xs = tiles.map(t => t.x), zs = tiles.map(t => t.z);
  const minx = Math.min(...xs), maxx = Math.max(...xs), minz = Math.min(...zs), maxz = Math.max(...zs);
  center = { x: (minx + maxx) / 2, z: (minz + maxz) / 2 };
  const w = maxx - minx + 6, h = maxz - minz + 6;
  scale = Math.min(15, Math.floor(Math.min(canvas.width / (rotation % 2 ? h : w), canvas.height / (rotation % 2 ? w : h))));
  context.clearRect(0, 0, canvas.width, canvas.height); context.save();
  context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 2); context.scale(scale, scale); context.translate(-center.x, -center.z);
  for (const t of tiles) {
    const lock = t.room_id ? world.scene.rooms.find(r => r.room_id === t.room_id)?.lock : undefined;
    context.fillStyle = t.kind === 'wall' ? ['#303e50', '#354458', '#3a4a5c', '#354659'][t.variant]! : t.kind === 'door' ? lock && !lock.enterable ? '#e56e77' : '#71d2bc' : lock && !lock.enterable ? '#3d2634' : t.variant % 2 ? '#1f3940' : '#233d43';
    context.fillRect(t.x - .5, t.z - .5, 1, 1);
    if (t.kind === 'wall') { context.fillStyle = '#526b7a'; context.fillRect(t.x - .5, t.z - .5, 1, .12); }
  }
  context.fillStyle = '#f4b45b'; context.fillRect(player.x - .22, player.z - .22, .44, .44);
  context.fillStyle = '#fff2d0'; context.fillRect(player.x - .1, player.z - .18, .12, .12);
  context.restore();
  context.font = '13px system-ui'; context.fillStyle = '#bac9da'; context.fillText(`Camera ${rotation * 90}° · world X/Z · 1 tile = 1 unit`, 14, 24);
  el('status').textContent = `Player ${player.x.toFixed(2)}, ${player.z.toFixed(2)} · blocked movement samples ${blockedSteps} · project acceptance remains read-only`;
}
function frame(timestamp: number) {
  const elapsed = timestamp - lastTimestamp; lastTimestamp = timestamp;
  frames++; totalMs += elapsed; worstMs = Math.max(worstMs, elapsed);
  const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const dz = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx || dz) {
    const a = -rotation * Math.PI / 2, speed = (keys.has('shift') ? 18 : 5) * Math.min(elapsed / 1000, .05) / Math.hypot(dx, dz);
    const target = { x: player.x + (dx * Math.cos(a) - dz * Math.sin(a)) * speed, z: player.z + (dx * Math.sin(a) + dz * Math.cos(a)) * speed };
    const next = nav.move(player, target);
    if (Math.hypot(next.x - target.x, next.z - target.z) > 0.001) blockedSteps++;
    player = next;
  }
  draw();
  if (timestamp - lastDisplay > 250) {
    el('metrics').textContent = `${world.scene.tiles.length} tiles · ${world.scene.colliders.length} colliders · compile ${compileMs.toFixed(1)} ms · harness mean ${(1000 * frames / totalMs).toFixed(1)} FPS / worst frame ${worstMs.toFixed(1)} ms (this browser only)`;
    lastDisplay = timestamp;
  }
  requestAnimationFrame(frame);
}
// Read-only observability for reproducible browser QA, no bypass movement API.
Object.defineProperty(window, '__compilerDemo', { value: { navigation: () => structuredClone(world.scene.navigation.walkable), snapshot: () => structuredClone({ player, rotation, blockedSteps, room_positions: world.blueprint.rooms, doors: world.scene.doors, statuses: source.rooms.map(r => ({ id: r.id, status: r.status })), metrics: { frames, totalMs, worstMs, compileMs } }) } });
build(); requestAnimationFrame(frame);

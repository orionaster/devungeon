/**
 * Actual unified-product browser verification. All gameplay/commands use UI or
 * keyboard input; debug ports are read-only. No teleports, HP setters or fake SSE.
 *
 * Start the local host, then:
 *   node scripts/forge-browser.mjs
 *   $env:FORGE_SUITE='public'; $env:FORGE_MANAGE_BRIDGE='1'; node scripts/forge-browser.mjs
 *   $env:FORGE_SUITE='showcase'; node scripts/forge-browser.mjs
 *
 * Public lifecycle uses its own port/data/metadata under the output directory.
 * Start the host with DEVUNGEON_SCOUT_PORT=4318 for that optional suite.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, appendFile, access, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fork, execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const url = process.env.FORGE_URL ?? "http://127.0.0.1:5183";
const suite = process.env.FORGE_SUITE ?? "games";
const output = resolve(process.env.FORGE_OUTPUT ?? join(root, "output/playwright/forge"));
const bridgePort = Number(process.env.FORGE_SCOUT_PORT ?? 4318);
const cpuThrottle = Number(process.env.FORGE_CPU_THROTTLE ?? 1);
const softwareGL = process.env.FORGE_SOFTWARE_GL === "1";
const traceScreenshots = process.env.FORGE_TRACE_SCREENSHOTS === "1" ||
  (process.env.FORGE_TRACE_SCREENSHOTS !== "0" && !process.env.CI);
if (!Number.isFinite(cpuThrottle) || cpuThrottle < 1 || cpuThrottle > 20)
  throw new Error("FORGE_CPU_THROTTLE must be between 1 and 20 (test-only slowdown)");
await mkdir(output, { recursive: true });
const report = {
  started_at: new Date().toISOString(),
  suite, url, platform: process.platform, node: process.version,
  viewport: { width: 1440, height: 960 }, dpr: 1,
  limitations: [`Automated browser input on ${process.platform} is not independent human playtesting, physical mobile, Safari or low-end hardware acceptance.`,
    ...(cpuThrottle > 1 ? [`CPU slowdown ${cpuThrottle}x is a harness stress check, not device performance acceptance.`] : [])],
  cpu_throttle: cpuThrottle,
  software_gl: softwareGL,
  trace_screenshots: traceScreenshots,
  checks: [], cases: [], console: [], navigation: [],
};
function check(name, pass, detail) {
  report.checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  if (!pass) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  console.log(`PASS ${name}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const game = (page) => page.evaluate(() => window.__DEVUNGEON__?.snapshot());
const forge = (page) => page.evaluate(() => window.__DEVUNGEON_FORGE__?.snapshot());
const work = (page) => page.evaluate(() => window.__DEVUNGEON_WORKSPACE__?.snapshot());
const scene = (page) => page.evaluate(() => window.__DEVUNGEON__?.scene());
const camera = (page) => page.evaluate(() => window.__DEVUNGEON__?.camera());
const stableWork = (value) => {
  if (!value) return value;
  const { revision, observed_at, agents, ...data } = value;
  return { ...data, agents: agents.map(({ observed_at, ...agent }) => agent) };
};
async function poll(read, accept, timeout = 15000, interval = 120) {
  const until = Date.now() + timeout;
  let result;
  do {
    result = await read();
    if (accept(result)) return result;
    await new Promise((done) => setTimeout(done, interval));
  } while (Date.now() < until);
  const preview = result?.world ? { selected: result.selected, projectId: result.project?.project?.id, source: result.source && { status: result.source.status, transportConnected: result.source.transportConnected, records: result.source.records?.length, error: result.source.error } }
    : result?.player ? { phase: result.phase, player: result.player, stats: result.stats } : result;
  throw new Error(`Timed out waiting for observation: ${JSON.stringify(preview).slice(0, 2500)}`);
}
async function screenshot(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
}
async function hold(page, key, ms) {
  await page.keyboard.down(key);
  try { await page.waitForTimeout(ms); }
  finally { await page.keyboard.up(key); }
}
async function movementPulse(page, key, ms, previousTime, allowDeath = false) {
  // Queue release by a Node timer, independently of keydown's browser round
  // trip. Waiting for its acknowledgement before starting the timer holds the
  // key too long on software-rendered CI and repeatedly overshoots the target.
  const down = page.keyboard.down(key);
  try { await new Promise((done) => setTimeout(done, ms)); }
  finally { await Promise.all([down, page.keyboard.up(key)]); }
  // Observe an actual neutral simulation frame after keyup. We neither mutate
  // GameState nor infer the position from a wall-clock delay or input duration.
  await page.waitForFunction(({ time, allowDeath }) => {
    const state = window.__DEVUNGEON__?.snapshot();
    return state && ((allowDeath && state.phase === "lost") ||
      (state.time > time && !state.player.moving && state.dodgeTime <= 0));
  }, { time: previousTime, allowDeath }, { timeout: 10000, polling: "raf" });
  return game(page);
}
async function focusGame(page) { await page.locator(".game-surface").focus(); }
async function restoredGameFocus(page) {
  // Dialog disappearance and Radix/host focus restoration occur in distinct
  // lifecycle frames. Observe the real destination instead of racing a Boolean.
  await page.waitForFunction(() => document.activeElement === document.querySelector(".game-surface"), undefined,
    { timeout: 10000, polling: "raf" });
}
async function selectProject(page, selected) {
  await page.getByTestId("forge-project-select").selectOption(selected);
  const chosen = await poll(() => forge(page), (s) => s?.selected === selected && !!s.world);
  await poll(() => scene(page), (s) => s?.project_context?.project_id === chosen.project.project.id);
  await poll(() => game(page), (s) => !!s);
}
async function enter(page) {
  const start = page.getByRole("button", { name: /进入地牢|Enter the dungeon/ });
  if (await start.count()) await start.click();
  await poll(() => game(page), (s) => s?.phase === "playing");
  await focusGame(page);
}
function mapRoute(world, from, to) {
  const floors = new Set(world.scene.navigation.walkable.map((p) => `${p.x},${p.z}`));
  const start = { x: Math.round(from.x - .5), z: Math.round(from.z - .5) };
  const goal = { x: Math.round(to.x), z: Math.round(to.z) };
  const queue = [start], previous = new Map([[`${start.x},${start.z}`, null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.x === goal.x && p.z === goal.z) {
      const result = []; let k = `${p.x},${p.z}`;
      while (k !== null) {
        const [x, z] = k.split(",").map(Number);
        result.unshift({ x: x + .5, z: z + .5 }); k = previous.get(k);
      }
      return result.filter((p, j) => j === 0 || j === result.length - 1 ||
        result[j + 1].x - p.x !== p.x - result[j - 1].x || result[j + 1].z - p.z !== p.z - result[j - 1].z);
    }
    for (const n of [{ x: p.x + 1, z: p.z }, { x: p.x - 1, z: p.z }, { x: p.x, z: p.z + 1 }, { x: p.x, z: p.z - 1 }]) {
      const key = `${n.x},${n.z}`;
      if (floors.has(key) && !previous.has(key)) { previous.set(key, `${p.x},${p.z}`); queue.push(n); }
    }
  }
  throw new Error(`No walkable keyboard route from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
}
async function walkTo(page, target, { tolerance = .16, onObservation, allowDeath = false } = {}) {
  const diagnostic = { target, allow_death: allowDeath, started_at: new Date().toISOString(), pulses: [] };
  report.navigation.push(diagnostic);
  let gain = .7;
  for (let i = 0; i < 170; i++) {
    const state = await game(page);
    if (allowDeath && state.phase === "lost") {
      diagnostic.outcome = "actual-death-before-target";
      return false;
    }
    assert.notEqual(state.phase, "lost", "Player died during route");
    await onObservation?.(state);
    const dx = target.x - state.player.x, dz = target.z - state.player.z;
    if (Math.hypot(dx, dz) < tolerance) { diagnostic.outcome = "arrived"; return true; }
    const heading = (await camera(page)).heading * Math.PI / 2;
    const sx = dx * Math.cos(heading) - dz * Math.sin(heading);
    const sz = dx * Math.sin(heading) + dz * Math.cos(heading);
    const horizontal = Math.abs(sx) >= Math.abs(sz), amount = horizontal ? sx : sz;
    const key = horizontal ? amount > 0 ? "KeyD" : "KeyA" : amount > 0 ? "KeyS" : "KeyW";
    const duration = Math.min(160, Math.max(4, Math.abs(amount) * 1000 / 4.3 * gain));
    const next = await movementPulse(page, key, duration, state.time, allowDeath);
    const moved = Math.hypot(next.player.x - state.player.x, next.player.z - state.player.z);
    const beforeDistance = Math.hypot(dx, dz), afterDistance = Math.hypot(target.x - next.player.x, target.z - next.player.z);
    diagnostic.pulses.push({ key, duration_ms: duration, from: { x: state.player.x, z: state.player.z }, to: { x: next.player.x, z: next.player.z }, beforeDistance, afterDistance, simulation_ms: (next.time - state.time) * 1000 });
    // Reduce the next pulse after an observed overshoot; increase it only if
    // a short press fell entirely between simulation frames. Arrival tolerance,
    // keyboard routing and all swept-collision assertions are unchanged.
    if (afterDistance > beforeDistance + .03 || moved > Math.abs(amount) * 1.4) gain = Math.max(.04, gain * .55);
    else if (moved < .02) gain = Math.min(1, gain * 1.35);
    else if (afterDistance < beforeDistance) gain = Math.min(.85, gain * 1.08);
  }
  throw new Error(`Keyboard route stuck at ${JSON.stringify((await game(page)).player)} approaching ${JSON.stringify(target)}`);
}
async function follow(page, world, to, { fightAfterHit = false, allowDeath = false } = {}) {
  await focusGame(page);
  await page.waitForFunction(() => {
    const state = window.__DEVUNGEON__?.snapshot();
    return state && state.dodgeTime <= 0 && !state.player.moving;
  }, undefined, { timeout: 10000, polling: "raf" });
  let attacking = false;
  try {
    for (const point of mapRoute(world, (await game(page)).player, to)) {
      const arrived = await walkTo(page, point, { allowDeath, onObservation: async (state) => {
        if (fightAfterHit && state.stats.hitsTaken > 0 && !attacking) {
          // The real player may fight while navigating. Waiting for exact
          // center arrival before attacking lets enemy knockback defeat an
          // otherwise stationary test bot on a slow software renderer.
          await page.keyboard.down("KeyJ");
          attacking = true;
        }
      } });
      if (!arrived) break; // Only the explicitly intentional loss setup allows this.
    }
  } finally {
    if (attacking) await page.keyboard.up("KeyJ");
  }
}
async function language(page, name, panel) {
  const groups = (panel ?? page).getByRole("group", { name: "界面语言 / Interface language" });
  await groups.first().getByRole("button", { name, exact: true }).click();
  await page.waitForFunction((locale) => document.documentElement.lang === locale, name === "English" ? "en-US" : "zh-CN");
}
async function openAgent(page, agent) {
  const rows = page.locator(".agent-row").filter({ hasText: agent.name });
  await rows.first().click();
  await page.getByRole("dialog").waitFor();
}
async function clickRenderedAgent(page, agentId) {
  const currentScene = await scene(page), actor = currentScene.agents.find((a) => a.agent_id === agentId);
  assert.ok(actor, "Agent must have an actual world marker");
  const journal = page.locator(".journal-toggle");
  if (await journal.getAttribute("aria-expanded") === "true") await journal.click();
  await focusGame(page);
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(500);
  const control = await camera(page), bounds = await page.locator("canvas").boundingBox();
  const minX = Math.min(...currentScene.rooms.map((r) => r.x - r.width / 2));
  const maxX = Math.max(...currentScene.rooms.map((r) => r.x + r.width / 2));
  const minZ = Math.min(...currentScene.rooms.map((r) => r.z - r.depth / 2));
  const maxZ = Math.max(...currentScene.rooms.map((r) => r.z + r.depth / 2));
  const width = maxX - minX, depth = maxZ - minZ;
  const camera3d = new OrthographicCamera(-bounds.width / 2, bounds.width / 2, bounds.height / 2, -bounds.height / 2, .1, 150);
  const angle = control.heading * Math.PI / 2;
  camera3d.position.set(control.target.x + Math.sin(angle) * 21, 26, control.target.z + Math.cos(angle) * 21);
  camera3d.lookAt(control.target.x, 0, control.target.z);
  camera3d.zoom = Math.min(control.zoom, bounds.width / ((control.heading % 2 ? depth : width) + 12), bounds.height / ((control.heading % 2 ? width : depth) + 10));
  camera3d.updateProjectionMatrix(); camera3d.updateMatrixWorld();
  const point = new Vector3(actor.x, .85, actor.z).project(camera3d);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
  await page.getByRole("dialog").waitFor();
  check("workbench: clicking actual rendered NPC opens scoped workspace", await page.locator(".dw-agent-id").textContent() === agentId);
}
async function send(page, text) {
  await page.getByRole("textbox", { name: /消息或任务内容|Message or task content/ }).fill(text);
  await page.getByRole("button", { name: /发送 · DEMO|Send · DEMO/ }).click();
}
async function workspaceChecks(page, label) {
  const initial = await work(page);
  const supervisor = initial?.agents.find((a) => a.role === "supervisor");
  check(`${label}: mapped DEMO supervisor exists`, !!supervisor, initial?.agents);
  await clickRenderedAgent(page, supervisor.id);
  const panel = page.getByRole("dialog");
  check(`${label}: explicit DEMO workspace label`, (await panel.innerText()).includes("DEMO"));
  const paused = await game(page), truth = (await forge(page)).project;
  await send(page, "FORGE 浏览器对话 · original DEMO message");
  await poll(() => work(page), (s) => s.receipts.some((r) => r.command.text.includes("FORGE 浏览器对话") && r.status === "completed"));
  check(`${label}: chat completed only in DEMO`, (await work(page)).events.every((e) => e.is_demo));
  const action = panel.getByRole("combobox", { name: /选择操作|Choose action/ });
  await action.selectOption("assign_task");
  await send(page, "FORGE 合成任务 continues while playing");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await restoredGameFocus(page);
  if (await page.locator(".journal-toggle").getAttribute("aria-expanded") === "false") await page.locator(".journal-toggle").click();
  await poll(() => work(page), (s) => s.receipts.some((r) => r.command.text.includes("FORGE 合成任务") && r.status === "completed"));
  check(`${label}: task survives closing workspace`, (await work(page)).tasks.some((t) => t.title.includes("FORGE 合成任务") && t.status === "review"));
  await openAgent(page, supervisor);
  await action.selectOption("publish");
  await send(page, "FORGE exact scoped DEMO approval 中文原文");
  await poll(() => work(page), (s) => s.approvals.some((a) => a.status === "pending"));
  const beforeWork = stableWork(await work(page)), beforeGame = await game(page);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await language(page, "English", panel);
  check(`${label}: locale does not alter paused game`, same(await game(page), beforeGame));
  check(`${label}: locale preserves commands, source and pending approvals`, same(stableWork(await work(page)), beforeWork));
  check(`${label}: locale uses no reload`, await page.evaluate((old) => performance.timeOrigin === old, timeOrigin));
  await screenshot(page, `${label}-workspace-en`);
  await panel.getByRole("button", { name: /^Permissions/ }).click();
  await screenshot(page, `${label}-approval-en`);
  await language(page, "中文", panel);
  check(`${label}: Chinese roundtrip preserves complete paused game`, same(await game(page), beforeGame));
  await screenshot(page, `${label}-approval-zh`);
  await panel.getByRole("button", { name: "拒绝", exact: true }).click();
  await poll(() => work(page), (s) => s.approvals[0]?.status === "denied");
  check(`${label}: explicit approval denial rejected operation`, (await work(page)).receipts.find((r) => r.command.text.includes("FORGE exact scoped"))?.status === "rejected");
  await panel.getByRole("button", { name: "对话", exact: true }).click();
  await action.selectOption("publish");
  await send(page, "FORGE pending approval must survive death and restart");
  await poll(() => work(page), (s) => s.approvals.some((a) => a.status === "pending"));
  await screenshot(page, `${label}-workspace-zh`);
  check(`${label}: workspace did not change project truth`, same((await forge(page)).project, truth));
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await restoredGameFocus(page);
  check(`${label}: workspace releases focus to game`, await page.locator(".game-surface").evaluate((el) => document.activeElement === el));
  return { supervisor, pendingId: (await work(page)).approvals.find((a) => a.status === "pending").id };
}
async function verifyProject(page, selected) {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__DEVUNGEON_FORGE__ && !!window.__DEVUNGEON__?.snapshot());
  check(`${selected}: Chinese first visit`, await page.locator("html").getAttribute("lang") === "zh-CN");
  await selectProject(page, selected);
  const initial = await forge(page), initialScene = await scene(page);
  check(`${selected}: BUILDER world uses selected source IDs`, initialScene.project_context?.project_id === initial.project.project.id);
  check(`${selected}: synthetic project explicitly DEMO`, initial.project.project.source.is_demo && (await page.locator("body").innerText()).includes("DEMO"));
  await screenshot(page, `${selected}-entry-zh`);
  await language(page, "English");
  await screenshot(page, `${selected}-entry-en`);
  await enter(page);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(120);
  const pausedGame = await game(page), pausedForge = await forge(page);
  await language(page, "中文");
  check(`${selected}: language preserves full paused game`, same(await game(page), pausedGame));
  check(`${selected}: language preserves truth and layout`, same((await forge(page)).project, pausedForge.project) && same((await forge(page)).world.layout, pausedForge.world.layout));
  await screenshot(page, `${selected}-paused-zh`);
  await page.getByRole("button", { name: /继续游戏|Resume game/ }).click();
  await focusGame(page);
  const beforeMove = await game(page);
  await hold(page, "KeyD", 180);
  check(`${selected}: actual keyboard movement`, (await game(page)).player.x > beforeMove.player.x + .3);
  await page.keyboard.press("Space");
  await poll(() => game(page), (s) => s.stats.dodges > 0);
  check(`${selected}: actual dodge executed`, (await game(page)).stats.dodges > 0);
  const world = initial.world;
  const visited = [];
  for (const roomId of world.scene.navigation.reachable_room_ids) {
    const room = world.scene.rooms.find((r) => r.room_id === roomId);
    await follow(page, world, room, { fightAfterHit: true }); visited.push(roomId);
    if (visited.length === 1) {
      await poll(() => game(page), (s) => s.stats.hitsTaken > 0, 15000);
      await screenshot(page, `${selected}-combat`);
    }
    const enemy = initialScene.enemies.find((e) => e.x === room.x + .5 && e.z === room.z + .5);
    await page.keyboard.down("KeyJ");
    try {
      await poll(() => game(page), (s) => !enemy || s.enemies.find((e) => e.id === enemy.id)?.hp <= 0, 16000);
    } finally { await page.keyboard.up("KeyJ"); }
  }
  const won = await game(page);
  check(`${selected}: full generated encounter won`, won.phase === "won", won.stats);
  check(`${selected}: actual attacks and damage loop`, won.stats.attacks > 0 && won.stats.damageDealt > 0 && won.stats.hitsTaken > 0, won.stats);
  check(`${selected}: combat does not change project truth`, same((await forge(page)).project, initial.project));
  await screenshot(page, `${selected}-victory`);
  await page.getByRole("button", { name: /继续探索|Keep exploring/ }).click();
  await focusGame(page);
  const blocked = world.scene.doors.find((d) => d.locked);
  check(`${selected}: at least one unaccepted area remains locked`, !!blocked);
  await follow(page, world, blocked.outside);
  const dashChecks = [];
  for (let turn = 0; turn < 4; turn++) {
    await poll(() => game(page), (s) => s.dodgeCooldown <= 0);
    const h = (await camera(page)).heading * Math.PI / 2;
    const wx = blocked.position.x - blocked.outside.x, wz = blocked.position.z - blocked.outside.z;
    const sx = wx * Math.cos(h) - wz * Math.sin(h), sz = wx * Math.sin(h) + wz * Math.cos(h);
    const k = Math.abs(sx) > Math.abs(sz) ? sx > 0 ? "KeyD" : "KeyA" : sz > 0 ? "KeyS" : "KeyW";
    const previous = await game(page);
    await page.keyboard.down(k);
    try { await page.keyboard.press("Space"); await page.waitForTimeout(550); }
    finally { await page.keyboard.up(k); }
    const after = await game(page), currentScene = await scene(page);
    const entered = currentScene.rooms.filter((r) => !r.enterable).some((r) => Math.abs(after.player.x - r.x) < r.width / 2 && Math.abs(after.player.z - r.z) < r.depth / 2);
    check(`${selected}: heading ${turn * 90} dash blocked`, !entered && after.stats.dodges === previous.stats.dodges + 1 && after.stats.blockedMoves > previous.stats.blockedMoves, { player: after.player, stats: after.stats });
    dashChecks.push({ heading: (await camera(page)).heading, player: after.player, stats: after.stats });
    await screenshot(page, `${selected}-lock-${turn * 90}`);
    await page.keyboard.press("KeyR");
  }
  await page.locator(".vault-link").click();
  const roomPanel = page.getByRole("dialog"), roomPaused = await game(page);
  check(`${selected}: locked room camera preview grants no entry`, (await camera(page)).mode === "preview" && same((await forge(page)).project, initial.project));
  await screenshot(page, `${selected}-locked-room-zh`);
  await language(page, "English", roomPanel);
  check(`${selected}: locked room English preserves access and paused state`, same(await game(page), roomPaused) && same((await forge(page)).world.layout, initial.world.layout));
  await screenshot(page, `${selected}-locked-room-en`);
  await language(page, "中文", roomPanel);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  let workspace;
  if (selected === "workbench") workspace = await workspaceChecks(page, selected);
  // Real UI restart, wait for a genuine loss, verify work survives both.
  if (workspace) {
    await focusGame(page);
    await page.keyboard.press("Enter");
    await poll(() => game(page), (s) => s.phase === "playing" && s.kills === 0);
    const first = world.scene.rooms.find((r) => r.room_id === world.scene.navigation.reachable_room_ids[0]);
    // This setup wants a genuine loss, so it must stop if the enemy kills the
    // player before center arrival. Winning navigation above still requires
    // every accepted center at .16 tolerance and never allows player death.
    await page.keyboard.up("KeyJ");
    await follow(page, world, first, { allowDeath: true });
    const losing = await poll(() => game(page), (s) => s.phase === "lost", 45000);
    check(`${selected}: actual enemy damage causes player death`, losing.player.hp === 0 && losing.stats.hitsTaken > 0);
    check(`${selected}: death never approves/cancels pending work`, (await work(page)).approvals.find((a) => a.id === workspace.pendingId)?.status === "pending");
    await screenshot(page, `${selected}-defeat`);
    await page.getByRole("button", { name: /再来一场冒险|Another adventure/ }).click();
    await poll(() => game(page), (s) => s.phase === "playing" && s.player.hp === 100);
    check(`${selected}: restart retains task and pending approval`, (await work(page)).approvals.find((a) => a.id === workspace.pendingId)?.status === "pending" && (await work(page)).tasks.some((t) => t.title.includes("FORGE 合成任务")));
    check(`${selected}: restart does not change truth`, same((await forge(page)).project, initial.project));
    await page.keyboard.press("KeyP");
  }
  const beforeUpdate = await forge(page);
  await page.getByTestId("forge-add-feature").click();
  const updated = await poll(() => forge(page), (s) => s.world?.layout.rooms.length > beforeUpdate.world.layout.rooms.length);
  await poll(() => scene(page), (s) => s.project_context?.project_revision === updated.project.revision);
  const oldRooms = beforeUpdate.world.layout.rooms;
  check(`${selected}: incremental update pins all old room geometry`, oldRooms.every((r) => same(updated.world.layout.rooms.find((n) => n.room_id === r.room_id), r)));
  check(`${selected}: incremental update pins existing corridor paths`, beforeUpdate.world.layout.paths.every((p) => same(updated.world.layout.paths.find((n) => n.id === p.id), p)));
  const added = updated.project.rooms.filter((r) => !initial.project.rooms.some((p) => p.id === r.id));
  check(`${selected}: new synthetic feature is sealed`, added.length > 0 && added.every((a) => a.status !== "accepted") && updated.world.scene.rooms.filter((r) => added.some((a) => a.id === r.room_id)).every((r) => !r.lock.enterable));
  await screenshot(page, `${selected}-incremental`);
  if (workspace) {
    await selectProject(page, "tiny");
    check("project switch: second project has its own distinct map", (await forge(page)).project.project.id !== updated.project.project.id && (await forge(page)).project.rooms.length === 3);
    await selectProject(page, "workbench");
    check("project switch: incremental layout and pending work survive return", same((await forge(page)).world.layout, updated.world.layout) && (await work(page)).approvals.find((a) => a.id === workspace.pendingId)?.status === "pending");
  }
  const metrics = await page.evaluate(() => window.__DEVUNGEON__.metrics());
  return { selected, rooms: initial.project.rooms.length, dependencies: initial.world.graph.dependencies.length, visited, won, dashChecks, metrics, incremental: { added: added.map((a) => a.id), oldRoomCount: oldRooms.length }, workspace: workspace && { pendingId: workspace.pendingId } };
}

let bridgeChild;
const metadata = join(output, "scout-state", "metadata.jsonl");
const data = join(output, "scout-state", "journal");
async function startBridge() {
  await mkdir(resolve(metadata, ".."), { recursive: true });
  try { await access(metadata); } catch { await writeFile(metadata, ""); }
  bridgeChild = fork(join(root, "scripts/forge-proof-bridge.mjs"), [data, metadata, String(bridgePort)], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  bridgeChild.stdout.on("data", (bytes) => console.log(String(bytes).trim()));
  bridgeChild.stderr.on("data", (bytes) => console.error(String(bytes).trim()));
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Managed SCOUT startup timed out")), 20000);
    bridgeChild.once("message", () => { clearTimeout(timeout); done(); });
    bridgeChild.once("exit", (code) => { clearTimeout(timeout); reject(Error(`Managed SCOUT exited ${code}`)); });
  });
}
async function stopBridge() {
  if (!bridgeChild || bridgeChild.exitCode !== null) return;
  const child = bridgeChild;
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Managed SCOUT graceful shutdown timed out")), 15000);
    child.once("exit", () => { clearTimeout(timeout); done(); });
    child.send("close");
  });
  bridgeChild = undefined;
}
async function publicChecks(page) {
  const managed = process.env.FORGE_MANAGE_BRIDGE === "1";
  if (managed) await startBridge();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__DEVUNGEON_FORGE__);
  await selectProject(page, "public");
  const imported = await poll(() => forge(page), (s) => s.project?.project?.id === "github:orionaster/devungeon", 30000);
  check("public: real selected GitHub project imported", !imported.project.project.source.is_demo && imported.project.rooms.length > 0);
  check("public: source observations do not grant feature acceptance", imported.project.rooms.every((r) => r.status !== "accepted"));
  check("public: original issue/PR titles and source evidence retained", imported.project.rooms.every((r) => r.evidence.some((e) => /^https:\/\/github.com\/orionaster\/devungeon\/(issues|pull)\//.test(e.ref))));
  const deniedWrite = await fetch(new URL("/scout-read/v1/commands", url), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("public: actual command HTTP route denied", deniedWrite.status === 405, { status: deniedWrite.status, body: await deniedWrite.json() });
  const deniedSelection = await fetch(new URL("/scout-read/v1/snapshot?source=unselected", url));
  check("public: browser cannot select another upstream source", deniedSelection.status === 400);
  const deniedOrigin = await fetch(`http://127.0.0.1:${bridgePort}/v1/status`, { headers: { Origin: "https://example.invalid" } });
  check("public: direct bridge retains foreign-origin denial", deniedOrigin.status === 403);
  await screenshot(page, "public-project-zh");
  await enter(page);
  const projectEvents = await poll(() => forge(page), (s) => s.source.records.length > 0);
  check("public: project events never create Agent actors", !(await scene(page)).agents.some((a) => a.agent_id === "source:github"));
  if (!managed) return { managed: false, imported: imported.project, source: projectEvents.source, limitation: "Lifecycle not exercised; external bridge owned by caller." };
  const task = imported.project.rooms.find((r) => /^github:issue:\d+$/.test(r.id));
  check("public: bounded source instrument has explicit task scope", !!task);
  const beforeLive = await game(page);
  await focusGame(page);
  await hold(page, "KeyD", 140);
  await page.keyboard.press("Space");
  await page.keyboard.down("KeyJ");
  let live;
  try {
    await exec(process.execPath, [join(root, "apps/bridge/scripts/observe-git.ts"), root, metadata, task.id], { cwd: root, timeout: 10000, windowsHide: true });
    live = await poll(() => forge(page), (s) => s.source.records.some((r) => r.mode === "LIVE" && r.event.source_kind === "agent"), 15000);
    await poll(() => game(page), (s) => s.stats.attacks > beforeLive.stats.attacks);
  } finally { await page.keyboard.up("KeyJ"); }
  const afterLive = await game(page);
  check("public: real event arrives while player attacks and dodges", afterLive.time > beforeLive.time && afterLive.stats.attacks > beforeLive.stats.attacks && afterLive.stats.dodges > beforeLive.stats.dodges && afterLive.phase !== "ready", { before: beforeLive.stats, after: afterLive.stats });
  const agentRecord = live.source.records.find((r) => r.mode === "LIVE" && r.event.source_kind === "agent");
  check("public: actual local Git observation reached game LIVE", agentRecord.event.source === "scout-local" && !agentRecord.event.is_demo);
  await poll(() => scene(page), (s) => s.agents.some((a) => a.agent_id === agentRecord.event.agent_id));
  check("public: LIVE source mode is rendered in actual UI", (await page.getByTestId("forge-agent-mode").textContent()).includes("LIVE"));
  await page.getByTestId("forge-agent-mode").scrollIntoViewIfNeeded();
  await screenshot(page, "public-live-agent");
  if ((await game(page)).phase === "won") await page.getByRole("button", { name: /继续探索|Keep exploring/ }).click();
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(120);
  const beforeLocale = await forge(page), beforeGame = await game(page);
  await language(page, "English");
  check("public: locale preserves original facts/events and paused game", same((await forge(page)).project, beforeLocale.project) && same((await forge(page)).source.records, beforeLocale.source.records) && same(await game(page), beforeGame));
  await screenshot(page, "public-project-en");
  const observed = (await work(page)).agents.find((a) => a.id === agentRecord.event.agent_id);
  await openAgent(page, observed);
  const panel = page.getByRole("dialog");
  check("public: read-only source cannot chat or publish", await panel.getByRole("textbox", { name: "Message or task content" }).isDisabled() && (await work(page)).agents.every((a) => a.capabilities.length === 0));
  await panel.getByRole("button", { name: "Activity", exact: true }).click();
  check("public: original non-sensitive commit evidence visible", (await panel.innerText()).includes("https://github.com/orionaster/devungeon/commit/"));
  await screenshot(page, "public-readonly-workspace");
  await page.keyboard.press("Escape");
  const recordsBeforeDuplicate = (await forge(page)).source.records.map((r) => r.event.event_id);
  const raw = await readFile(metadata, "utf8");
  await appendFile(metadata, raw);
  await page.waitForTimeout(2200);
  check("public: duplicate input does not duplicate event history", same((await forge(page)).source.records.map((r) => r.event.event_id), recordsBeforeDuplicate));
  const stale = await poll(() => forge(page), (s) => s.source.status?.connections.agent.mode === "STALE", 38000, 500);
  check("public: silent real observer becomes STALE", stale.source.status.connections.agent.mode === "STALE");
  check("public: STALE source mode is rendered in actual UI", (await page.getByTestId("forge-agent-mode").textContent()).includes("STALE"));
  await page.getByTestId("forge-agent-mode").scrollIntoViewIfNeeded();
  await screenshot(page, "public-stale");
  const beforeDisconnect = await game(page), originalIds = (await forge(page)).source.records.map((r) => r.event.event_id);
  await stopBridge();
  const disconnected = await poll(() => forge(page), (s) => s.source.transportConnected === false, 10000);
  check("public: disconnect preserves history and project truth", same(disconnected.source.records.map((r) => r.event.event_id), originalIds) && same(disconnected.project, imported.project));
  check("public: disconnect preserves paused gameplay", same(await game(page), beforeDisconnect));
  check("public: DISCONNECTED mode is rendered in actual UI", (await page.getByTestId("forge-agent-mode").textContent()).includes("DISCONNECTED"));
  await screenshot(page, "public-disconnected");
  await startBridge();
  const replay = await poll(() => forge(page), (s) => s.source.records.some((r) => r.event.source_kind === "agent" && r.mode === "REPLAY") && s.source.transportConnected, 20000);
  check("public: reconnect recovers same event IDs as REPLAY", same(replay.source.records.map((r) => r.event.event_id), originalIds));
  check("public: reconnect leaves gameplay and source facts unchanged", same(await game(page), beforeDisconnect) && same(replay.project, imported.project));
  check("public: REPLAY history is rendered in actual UI", (await page.locator(".forge-events").innerText()).includes("REPLAY"));
  await page.locator(".forge-events").scrollIntoViewIfNeeded();
  await screenshot(page, "public-replay");
  // A malformed appended source record must fail closed, then recover on repair.
  const validMetadata = await readFile(metadata, "utf8");
  await appendFile(metadata, '{"unexpected":"FORGE fault probe"}\n');
  await poll(() => forge(page), (s) => s.source.status?.connections.agent.reason === "invalid_data", 10000);
  check("public: malformed metadata fails closed without history loss", same((await forge(page)).source.records.map((r) => r.event.event_id), originalIds));
  await writeFile(metadata, validMetadata);
  await poll(() => forge(page), (s) => s.source.status?.connections.agent.reason !== "invalid_data", 10000);
  check("public: explicit source repair recovers", (await forge(page)).source.status.connections.agent.reason !== "invalid_data");
  await stopBridge();
  return { managed: true, project: imported.project, originalIds, live: agentRecord, stale: stale.source.status, final: replay.source,
    concurrentGameplay: { before: beforeLive, after: afterLive }, metrics: await page.evaluate(() => window.__DEVUNGEON__.metrics()) };
}

/** Short headed screen recording for a reviewer. Real input, original sprites,
 * DEMO workspace clearly labeled, then the selected public read-only source. */
async function showcaseChecks(page) {
  const began = Date.now();
  await startBridge();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__DEVUNGEON_FORGE__ && !!window.__DEVUNGEON__?.snapshot());
  await screenshot(page, "headed-entry-zh");
  await enter(page);
  const tiny = await forge(page);
  const room = tiny.world.scene.rooms.find((r) => r.room_id === tiny.world.scene.navigation.reachable_room_ids[0]);
  await follow(page, tiny.world, room);
  await page.keyboard.press("Space");
  await page.keyboard.down("KeyJ");
  try { await poll(() => game(page), (s) => s.phase === "won", 15000); }
  finally { await page.keyboard.up("KeyJ"); }
  await screenshot(page, "headed-victory-zh");
  await page.getByRole("button", { name: /继续探索|Keep exploring/ }).click();
  await focusGame(page); await page.keyboard.press("KeyF");
  for (let turn = 0; turn < 4; turn++) { await page.keyboard.press("KeyR"); await page.waitForTimeout(250); }
  await selectProject(page, "workbench"); await enter(page);
  const supervisor = (await work(page)).agents.find((a) => a.role === "supervisor");
  await openAgent(page, supervisor);
  await send(page, "FORGE 可审查演练 · DEMO only");
  await poll(() => work(page), (s) => s.receipts.some((r) => r.command.text.includes("FORGE 可审查演练") && r.status === "completed"));
  await screenshot(page, "headed-workspace-zh");
  await language(page, "English", page.getByRole("dialog"));
  await screenshot(page, "headed-workspace-en");
  await page.keyboard.press("Escape");
  await selectProject(page, "public"); await enter(page);
  const imported = await forge(page), task = imported.project.rooms.find((r) => /^github:issue:\d+$/.test(r.id));
  await exec(process.execPath, [join(root, "apps/bridge/scripts/observe-git.ts"), root, metadata, task.id], { cwd: root, timeout: 10000, windowsHide: true });
  await poll(() => forge(page), (s) => s.source.records.some((r) => r.mode === "LIVE" && r.event.source_kind === "agent"));
  await focusGame(page); await page.keyboard.press("KeyP");
  await screenshot(page, "headed-public-live-en");
  await language(page, "中文");
  const remaining = 36000 - (Date.now() - began);
  if (remaining > 0) await page.waitForTimeout(Math.min(remaining, 36000));
  const result = { duration_ms: Date.now() - began, metrics: await page.evaluate(() => window.__DEVUNGEON__.metrics()), source: (await forge(page)).source };
  check("headed: playable game, bilingual workspace and actual public live observation recorded", result.source.records.some((r) => r.mode === "LIVE" && r.event.source_kind === "agent"));
  await stopBridge();
  return result;
}

let browser;
try {
  const candidates = [process.env.FORGE_CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) { try { await access(candidate); executablePath = candidate; break; } catch {} }
  browser = await chromium.launch({ headless: suite !== "showcase" && process.env.FORGE_HEADED !== "1", ...(executablePath ? { executablePath } : {}), args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    ...(softwareGL ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])] });
  report.browser = browser.version(); report.executable = executablePath ?? "Playwright-managed Chromium";
  const selections = suite === "showcase" ? ["showcase"] : suite === "public" ? ["public"] : suite === "tiny" ? ["tiny"] : suite === "workbench" ? ["workbench"] : suite === "all" ? ["tiny", "workbench", "public"] : ["tiny", "workbench"];
  for (const selection of selections) {
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, reducedMotion: "reduce", ...(suite === "showcase" ? { recordVideo: { dir: output, size: report.viewport } } : {}) });
    // Continuous filmstrip capture competes with software WebGL on CI. Keep
    // DOM/action/source traces and all explicit PNG checkpoints; local captures
    // retain the filmstrip by default and may opt out for harness stress runs.
    await context.tracing.start({ screenshots: traceScreenshots, snapshots: true, sources: true });
    const page = await context.newPage();
    if (cpuThrottle > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
    }
    page.setDefaultTimeout(20000);
    const errors = [];
    let caseFailure;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) report.console.push({ selection, type: message.type(), text: message.text() });
    });
    try {
      const result = selection === "showcase" ? await showcaseChecks(page) : selection === "public" ? await publicChecks(page) : await verifyProject(page, selection);
      check(`${selection}: no uncaught browser error`, errors.length === 0, errors);
      report.cases.push({ selection, result });
    } catch (error) {
      caseFailure = error;
      report.cases.push({ selection, failed: true, error: error.stack, game: await game(page).catch(() => undefined), forge: await forge(page).catch(() => undefined) });
      await screenshot(page, `${selection}-failure`).catch(() => {});
      throw error;
    } finally {
      try {
        await context.tracing.stop({ path: join(output, `${selection}-trace.zip`) });
      } catch (error) {
        (report.trace_errors ??= []).push({ selection, error: error.message });
        if (!caseFailure) throw error; // Preserve an original gameplay failure.
      } finally { await context.close(); }
      if (suite === "showcase") {
        const recorded = await page.video().path();
        await rename(recorded, join(output, "headed-showcase.webm"));
        report.video = join(output, "headed-showcase.webm");
      }
    }
  }
  const tiny = report.cases.find((c) => c.selection === "tiny")?.result;
  const complex = report.cases.find((c) => c.selection === "workbench")?.result;
  if (tiny && complex) check("two projects generate distinct functional graphs", tiny.rooms !== complex.rooms && tiny.dependencies !== complex.dependencies, { tiny: { rooms: tiny.rooms, dependencies: tiny.dependencies }, workbench: { rooms: complex.rooms, dependencies: complex.dependencies } });
  report.pass = true;
} catch (error) {
  report.pass = false; report.failure = error.stack; console.error(error.stack); process.exitCode = 1;
} finally {
  await stopBridge().catch((error) => { report.shutdownError = error.message; });
  await browser?.close();
  report.finished_at = new Date().toISOString();
  await writeFile(join(output, `${suite}-results.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(`Results: ${join(output, `${suite}-results.json`)}`);
}

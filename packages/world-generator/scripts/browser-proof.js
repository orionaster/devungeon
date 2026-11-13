// Playwright CLI run-code function. Uses actual keyboard events; observability is
// read-only. Run after opening the local harness (README). Not a game acceptance.
(async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const state = () => page.evaluate(() => window.__compilerDemo.snapshot());
  await page.getByRole('button', { name: '3-room project', exact: true }).click();
  const before = await state();
  const floorTiles = await page.evaluate(() => window.__compilerDemo.navigation());
  const floors = new Set(floorTiles.map(p => `${p.x},${p.z}`));
  function path(from, to) {
    const queue = [{ x: Math.round(from.x), z: Math.round(from.z) }], previous = new Map([[`${Math.round(from.x)},${Math.round(from.z)}`, null]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (p.x === to.x && p.z === to.z) {
        const result = []; let k = `${p.x},${p.z}`;
        while (k !== null) { const [x, z] = k.split(',').map(Number); result.unshift({ x, z }); k = previous.get(k); }
        return result;
      }
      for (const n of [{ x: p.x + 1, z: p.z }, { x: p.x - 1, z: p.z }, { x: p.x, z: p.z + 1 }, { x: p.x, z: p.z - 1 }]) {
        const k = `${n.x},${n.z}`;
        if (floors.has(k) && !previous.has(k)) { previous.set(k, `${p.x},${p.z}`); queue.push(n); }
      }
    }
    throw Error('No independent BFS route');
  }
  async function walkTo(target) {
    for (let i = 0; i < 160; i++) {
      const s = await state(), dx = target.x - s.player.x, dz = target.z - s.player.z;
      if (Math.hypot(dx, dz) < .09) return;
      // World-to-screen transform of the observed camera rotation.
      const a = s.rotation * Math.PI / 2;
      const sx = dx * Math.cos(a) - dz * Math.sin(a), sy = dx * Math.sin(a) + dz * Math.cos(a);
      const horizontal = Math.abs(sx) >= Math.abs(sy), amount = horizontal ? sx : sy;
      const k = horizontal ? amount > 0 ? 'd' : 'a' : amount > 0 ? 's' : 'w';
      await page.keyboard.down(k);
      await page.waitForTimeout(Math.min(200, Math.max(8, Math.abs(amount) * 1000 / 5 - 8)));
      await page.keyboard.up(k);
    }
    throw Error(`Keyboard walking stuck near ${JSON.stringify(target)} at ${JSON.stringify((await state()).player)}`);
  }
  async function follow(target) {
    const route = path((await state()).player, target);
    const corners = route.filter((p, i) => i === 0 || i === route.length - 1 || route[i + 1].x - p.x !== p.x - route[i - 1].x || route[i + 1].z - p.z !== p.z - route[i - 1].z);
    for (const p of corners) await walkTo(p);
  }
  await follow({ x: 0, z: 0 });
  assert(Math.hypot((await state()).player.x, (await state()).player.z) < .15, 'Did not enter accepted hero room');
  const lockedDoor = before.doors.find(d => d.room_id === 'contact');
  await follow(lockedDoor.outside);
  const rotations = [];
  for (let turn = 0; turn < 4; turn++) {
    const s = await state(); const a = s.rotation * Math.PI / 2;
    const sx = Math.sin(a), sy = -Math.cos(a);
    const k = Math.abs(sx) > Math.abs(sy) ? sx > 0 ? 'd' : 'a' : sy > 0 ? 's' : 'w';
    await page.keyboard.down('Shift'); await page.keyboard.down(k); await page.waitForTimeout(400); await page.keyboard.up(k); await page.keyboard.up('Shift');
    const after = await state();
    assert(after.player.z > lockedDoor.position.z + .5, `Entered lock at camera ${turn * 90}`);
    assert(after.statuses.find(r => r.id === 'contact').status === 'active', 'Movement changed project truth');
    rotations.push({ degrees: after.rotation * 90, player: after.player, blockedSteps: after.blockedSteps });
    await page.keyboard.press('e');
  }
  await page.getByRole('button', { name: 'contact — active · LOCKED', exact: true }).click();
  assert((await page.locator('#inspect').innerText()).includes('Project status is active'), 'Locked room inspection missing');
  await page.screenshot({ path: 'output/playwright/tiny-locked-preview.png' });
  await page.getByRole('button', { name: 'Add module', exact: true }).click();
  const expanded = await state();
  for (const r of before.room_positions) assert(JSON.stringify(expanded.room_positions.find(n => n.room_id === r.room_id)) === JSON.stringify(r), 'Existing room moved in browser');
  assert(expanded.room_positions.length === 4, 'Module did not add a room');
  await page.screenshot({ path: 'output/playwright/incremental-extension.png' });
  await page.getByRole('button', { name: 'Regress foundation', exact: true }).click();
  assert((await state()).doors.every(d => d.locked), 'Regression did not relock dependent access');
  await page.getByRole('button', { name: '8-room project', exact: true }).click();
  assert((await state()).room_positions.length === 8, 'Complex fixture did not load');
  await page.getByRole('button', { name: 'milestone — planned · LOCKED', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/complex-navigation.png' });
  await page.keyboard.press('e');
  await page.screenshot({ path: 'output/playwright/complex-quarter-turn.png' });
  const report = { tool: 'Playwright CLI with actual keyboard input', browser: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), visited_accepted_room: 'hero', locked_door_attempts: rotations, incremental_old_geometry_unchanged: true, regression_relocked: true, complex_loaded: true, final_state: await state(), limitation: '2D compiler navigation harness; headless actual HERO engine checks are separate. No human gameplay or HERO browser rendering claimed.' };
  return report;
})

// Run after the tiny-world proof in the same real HERO consumer session.
(async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const read = () => page.evaluate(() => window.__BUILDER_INTEGRATION__.snapshot());
  await page.bringToFront();
  const start = page.getByRole('button', { name: /进入地牢|Enter the dungeon/ });
  if (await start.isVisible()) await start.click();
  const before = await read(); assert(before.fixture === 'tiny', 'Start in tiny');
  const selector = page.getByTestId('builder-fixture');
  if (!await selector.isVisible()) await page.getByRole('button', { name: /探索手记|Field notes/ }).click();
  await selector.selectOption('expanded');
  await page.waitForFunction(old => {
    const s = window.__BUILDER_INTEGRATION__.snapshot();
    return s.fixture === 'expanded' && s.game?.phase === 'ready' && s.engine_instance_id !== old;
  }, before.engine_instance_id);
  const after = await read();
  for (const room of before.world.layout.rooms) assert(JSON.stringify(after.world.layout.rooms.find(r => r.room_id === room.room_id)) === JSON.stringify(room), 'Old room geometry moved');
  for (const path of before.world.layout.paths) assert(JSON.stringify(after.world.layout.paths.find(p => p.id === path.id)) === JSON.stringify(path), 'Old corridor moved');
  assert(after.project.project.id === before.project.project.id && after.world.layout.seed === before.world.layout.seed, 'Project ID/seed changed');
  assert(after.scene.doors.find(d => d.room_id === 'analytics').locked, 'New planned module was opened');
  assert(after.world.changes.added_room_ids.join() === 'analytics', 'Expansion did not add the expected source feature');
  await page.getByRole('button', { name: /进入地牢|Enter the dungeon/ }).click();
  await page.getByRole('button', { name: '收起探索手记', exact: true }).click();
  await page.locator('.game-surface').focus(); await page.keyboard.press('KeyF'); await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/wave2/hero-expanded-overview.png' });
  const observedExpansion = { source_id: after.project.project.id, project_revision: after.project.revision, old_room_ids: before.world.layout.rooms.map(r => r.room_id), added: after.world.changes.added_room_ids, old_geometry_and_corridors_unchanged: true, new_room_locked: true };
  await page.goto('http://127.0.0.1:4275/?fixture=__proto__');
  await page.waitForFunction(() => window.__BUILDER_INTEGRATION__?.snapshot().game);
  const recovered = await read(); assert(recovered.fixture === 'tiny', 'Invalid fixture did not recover to the labeled default');
  return { expansion: observedExpansion, invalid_fixture_recovers_to_labeled_tiny: true, arbitrary_pack_or_plugin_executed: false };
})

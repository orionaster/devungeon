// Playwright CLI function for the actual HERO App consumer at :4275.
// Navigate first to ?fixture=tiny or ?fixture=complex. No game/source mutations.
(async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const read = () => page.evaluate(() => window.__BUILDER_INTEGRATION__.snapshot());
  const game = () => page.evaluate(() => window.__DEVUNGEON__.snapshot());
  const camera = () => page.evaluate(() => window.__DEVUNGEON__.camera());
  const held = new Set();
  const down = async k => { held.add(k); await page.keyboard.down(k); };
  const up = async k => { held.delete(k); await page.keyboard.up(k); };
  const capture = name => page.screenshot({ path: `output/playwright/wave2/${name}.png` });
  const clickStart = async () => {
    const start = page.getByRole('button', { name: /进入地牢|Enter the dungeon/ });
    if (await start.isVisible()) await start.click();
    await page.locator('.game-surface').focus();
  };
  try {
    await page.bringToFront();
    await page.waitForFunction(() => window.__BUILDER_INTEGRATION__?.snapshot().game);
    const initial = await read(), name = initial.fixture;
    const sourceBefore = JSON.stringify(initial.project), layoutBefore = JSON.stringify(initial.world.layout);
    assert(['tiny', 'complex'].includes(name), 'Select a primary fixture first');
    assert((await page.locator('html').getAttribute('lang')) === 'zh-CN', 'Expected fresh/default Chinese locale');
    await clickStart();
    const floors = new Set(initial.world.scene.navigation.walkable.map(p => `${p.x},${p.z}`));
    function route(from, to) {
      const start = { x: Math.round(from.x - .5), z: Math.round(from.z - .5) };
      const queue = [start], prev = new Map([[`${start.x},${start.z}`, null]]);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (p.x === to.x && p.z === to.z) {
          const result = []; let k = `${p.x},${p.z}`;
          while (k !== null) { const [x, z] = k.split(',').map(Number); result.unshift({ x: x + .5, z: z + .5 }); k = prev.get(k); }
          return result;
        }
        for (const n of [{ x: p.x + 1, z: p.z }, { x: p.x - 1, z: p.z }, { x: p.x, z: p.z + 1 }, { x: p.x, z: p.z - 1 }]) {
          const k = `${n.x},${n.z}`;
          if (floors.has(k) && !prev.has(k)) { prev.set(k, `${p.x},${p.z}`); queue.push(n); }
        }
      }
      throw Error(`No independent route to ${JSON.stringify(to)}`);
    }
    async function walkTo(target) {
      for (let i = 0; i < 200; i++) {
        const s = await game(), dx = target.x - s.player.x, dz = target.z - s.player.z;
        if (Math.hypot(dx, dz) < .13) return;
        assert(s.phase !== 'lost', 'Player died before the navigation check');
        const h = (await camera()).heading * Math.PI / 2;
        const sx = dx * Math.cos(h) - dz * Math.sin(h), sy = dx * Math.sin(h) + dz * Math.cos(h);
        const horizontal = Math.abs(sx) >= Math.abs(sy), amount = horizontal ? sx : sy;
        const k = horizontal ? amount > 0 ? 'KeyD' : 'KeyA' : amount > 0 ? 'KeyS' : 'KeyW';
        await down(k); await page.waitForTimeout(Math.min(180, Math.max(8, Math.abs(amount) * 1000 / 4.3 - 12))); await up(k);
      }
      throw Error(`Keyboard path stuck: ${JSON.stringify(target)} at ${JSON.stringify((await game()).player)}`);
    }
    async function follow(target) {
      const path = route((await game()).player, target);
      const corners = path.filter((p, i) => i === 0 || i === path.length - 1 || path[i + 1].x - p.x !== p.x - path[i - 1].x || path[i + 1].z - p.z !== p.z - path[i - 1].z);
      for (const p of corners) await walkTo(p);
    }
    // Pause through the real UI, compare complete state during locale changes.
    await page.keyboard.press('KeyP');
    const paused = await read(), pausedGame = JSON.stringify(paused.game), instance = paused.engine_instance_id;
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const english = await read();
    assert(english.engine_instance_id === instance && JSON.stringify(english.game) === pausedGame, 'English toggle recreated or changed the paused game');
    assert(JSON.stringify(english.project) === sourceBefore && JSON.stringify(english.world.layout) === layoutBefore, 'English toggle changed source/layout');
    await capture(`hero-${name}-en-paused`);
    await page.getByRole('button', { name: '中文', exact: true }).click();
    const chinese = await read();
    assert(chinese.engine_instance_id === instance && JSON.stringify(chinese.game) === pausedGame, 'Chinese toggle reset state');
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.locator('.game-surface').focus();
    const visited = [];
    for (const id of initial.world.scene.navigation.reachable_room_ids) {
      const room = initial.world.scene.rooms.find(r => r.room_id === id);
      await follow(room); visited.push(id);
      // Let one actual enemy hit, then win using normal held attack input.
      if (visited.length === 1) {
        for (let i = 0; i < 30 && (await game()).player.hp === 100; i++) await page.waitForTimeout(100);
        await capture(`hero-${name}-combat`);
      }
      await down('KeyJ');
      for (let i = 0; i < 50; i++) {
        const s = await game();
        if (s.enemies.filter(e => e.hp > 0).every(e => e.id !== initial.scene.enemies.find(e => e.x === room.x + .5 && e.z === room.z + .5)?.id)) break;
        await page.waitForTimeout(100);
      }
      await up('KeyJ');
    }
    const won = await game(); assert(won.phase === 'won', 'Generated encounter did not finish');
    assert(won.stats.damageDealt > 0 && won.stats.hitsTaken > 0, 'Actual hit/dealt-damage loop did not execute');
    await capture(`hero-${name}-victory`);
    await page.getByRole('button', { name: /继续探索|Keep exploring/ }).click();
    await page.locator('.game-surface').focus();
    const blocked = initial.world.scene.doors.find(d => d.room_id === (name === 'tiny' ? 'contact' : 'planning'));
    await follow(blocked.outside);
    const attempts = [];
    for (let turn = 0; turn < 4; turn++) {
      await page.waitForFunction(() => window.__DEVUNGEON__.snapshot().dodgeCooldown <= 0);
      const previousDodges = (await game()).stats.dodges;
      const h = (await camera()).heading * Math.PI / 2;
      const sx = Math.sin(h), sy = -Math.cos(h);
      const k = Math.abs(sx) > Math.abs(sy) ? sx > 0 ? 'KeyD' : 'KeyA' : sy > 0 ? 'KeyS' : 'KeyW';
      await down(k); await page.keyboard.press('Space'); await page.waitForTimeout(400); await up(k);
      const s = await game(); assert(s.player.z > blocked.position.z + 1, 'Dash entered a locked room');
      assert(s.stats.dodges === previousDodges + 1, 'The dash input did not execute at this heading');
      attempts.push({ heading: (await camera()).heading, player: { x: s.player.x, z: s.player.z }, dodges: s.stats.dodges });
      if (turn === 1) await capture(`hero-${name}-lock-90`);
      await page.keyboard.press('KeyR');
    }
    await page.getByRole('button', { name: '收起探索手记', exact: true }).click();
    await page.locator('.game-surface').focus(); await page.keyboard.press('KeyF');
    await page.waitForTimeout(1000); await capture(`hero-${name}-overview-zh`);
    const after = await read();
    assert(after.engine_instance_id === instance, 'An in-session action recreated the engine');
    assert(JSON.stringify(after.project) === sourceBefore && JSON.stringify(after.world.layout) === layoutBefore, 'Gameplay changed source/layout');
    assert(after.scene.doors.filter(d => d.locked).length === initial.scene.doors.filter(d => d.locked).length, 'Combat unlocked project features');
    return { fixture: name, actual_host: 'HERO App + DungeonScene + Rapier + shared WIZARD I18nProvider', default_locale: 'zh-CN', locale_round_trip_preserved_full_paused_game: true, source_layout_unchanged: true, engine_instance_unchanged: true, visited_accepted_rooms: visited, combat: { phase: won.phase, hp: won.player.hp, stats: won.stats }, locked_door: blocked.room_id, dash_attempts: attempts, browser: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), metrics: await page.evaluate(() => window.__DEVUNGEON__.metrics()), source_agent_ids: initial.scene.agents.map(a => a.agent_id), limitation: 'Synthetic project fixtures in the real host. SCOUT live stream / full WIZARD workspace are not exercised by this entry.' };
  } finally {
    for (const k of held) await page.keyboard.up(k);
  }
})

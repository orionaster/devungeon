// Run with the pinned playwright-cli run-code --filename; real input only, diagnostics are read-only.
async (page) => {
  const report = {
    started: new Date().toISOString(),
    checks: [],
    samples: [],
    browser: await page.context().browser().version(),
  };
  const read = () => page.evaluate(() => window.__DEVUNGEON__.snapshot());
  const check = (name, pass, details) => {
    report.checks.push({ name, pass, details });
    if (!pass) throw Error(name + ": " + JSON.stringify(details));
  };
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    try {
      await page.waitForTimeout(ms);
    } finally {
      await page.keyboard.up(key);
    }
  };
  const move = async (x, z, tolerance = 0.45) => {
    const deadline = Date.now() + 16000;
    while (Date.now() < deadline) {
      const s = await read();
      if (s.phase === "lost") throw Error("Died while moving");
      const dx = x - s.player.x,
        dz = z - s.player.z;
      if (Math.hypot(dx, dz) < tolerance) return;
      const key =
        Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "d" : "a") : dz > 0 ? "s" : "w";
      await hold(
        key,
        Math.min(350, Math.max(60, Math.max(Math.abs(dx), Math.abs(dz)) * 140)),
      );
    }
    throw Error(
      "Could not reach " +
        x +
        "," +
        z +
        " from " +
        JSON.stringify((await read()).player),
    );
  };
  await page.goto(new URL("/", page.url()).href);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "Enter the dungeon →" }).waitFor();
  await page.screenshot({ path: "output/playwright/01-entry.png" });
  const accessBefore = await page.evaluate(() => window.__DEVUNGEON__.access());
  await page.getByRole("button", { name: "Enter the dungeon →" }).click();
  const eventBefore = await page.evaluate(
    () => window.__DEVUNGEON__.events()[0].event_id,
  );
  await move(-1, 0);
  check(
    "Movement crosses doorway",
    (await read()).player.x > -3,
    (await read()).player,
  );
  await page.waitForFunction(
    () => window.__DEVUNGEON__.snapshot().player.hp < 100,
    {},
    { timeout: 12000 },
  );
  check(
    "Enemy causes actual damage",
    (await read()).stats.hitsTaken > 0,
    (await read()).player.hp,
  );
  await page.keyboard.down("a");
  await page.keyboard.press("Space");
  await page.waitForTimeout(240);
  await page.keyboard.up("a");
  check(
    "Short tap dodge is buffered",
    (await read()).stats.dodges > 0,
    (await read()).stats,
  );
  await page.keyboard.down("j");
  try {
    const deadline = Date.now() + 22000;
    while (Date.now() < deadline) {
      const s = await read();
      if (s.phase === "won") break;
      if (s.phase === "lost") throw Error("Combat run lost");
      const target = s.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.player.x, a.z - s.player.z) -
            Math.hypot(b.x - s.player.x, b.z - s.player.z),
        )[0];
      if (Math.hypot(target.x - s.player.x, target.z - s.player.z) > 1.6) {
        const dx = target.x - s.player.x,
          dz = target.z - s.player.z;
        await hold(
          Math.abs(dx) > Math.abs(dz)
            ? dx > 0
              ? "d"
              : "a"
            : dz > 0
              ? "s"
              : "w",
          200,
        );
      } else await page.waitForTimeout(250);
      if ((await read()).stats.attacks > 0)
        await page.screenshot({ path: "output/playwright/02-combat.png" });
    }
  } finally {
    await page.keyboard.up("j");
  }
  const won = await read();
  check("Full encounter won", won.phase === "won", won);
  check(
    "Agent events continue during play",
    (await page.evaluate(() => window.__DEVUNGEON__.events()[0].event_id)) !==
      eventBefore,
  );
  check(
    "Win does not mutate room acceptance",
    JSON.stringify(accessBefore) ===
      JSON.stringify(await page.evaluate(() => window.__DEVUNGEON__.access())),
  );
  report.win = won;
  await page.screenshot({ path: "output/playwright/03-victory.png" });
  await page.getByRole("button", { name: "Keep exploring →" }).click();
  await move(3, 0);
  check("Game reward can be claimed", (await read()).rewardClaimed);
  for (let heading = 0; heading < 4; heading++) {
    if (heading) await page.keyboard.press("r");
    await page.waitForTimeout(550);
    const before = (await read()).player;
    await hold("d", 170);
    const after = (await read()).player;
    const a = (heading * Math.PI) / 2;
    check(
      "Camera relative controls " + heading * 90,
      (after.x - before.x) * Math.cos(a) - (after.z - before.z) * Math.sin(a) >
        0.1,
      { before, after },
    );
    await page.screenshot({
      path: `output/playwright/heading-${heading * 90}.png`,
    });
  }
  await page.keyboard.press("r");
  await move(7, 0);
  await move(11.45, 0);
  await hold("d", 1300);
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(800);
  await page.keyboard.up("d");
  check(
    "Walking and dodge cannot enter seal",
    (await read()).player.x < 11.75,
    (await read()).player,
  );
  await page.keyboard.down("d");
  await page.keyboard.down("w");
  await page.keyboard.press("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  check(
    "Locked collision corner holds",
    (await read()).player.x < 11.75,
    (await read()).player,
  );
  const lockedPosition = (await read()).player;
  await page
    .getByRole("button", {
      name: "♜ The Unwritten Vault Locked · Preview the room →",
    })
    .click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "output/playwright/04-locked-preview.png" });
  check(
    "Camera preview does not teleport player",
    Math.hypot(
      (await read()).player.x - lockedPosition.x,
      (await read()).player.z - lockedPosition.z,
    ) < 0.05,
  );
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.keyboard.press("c");
  await page.keyboard.press("p");
  const frozen = (await read()).time;
  const e0 = await page.evaluate(
    () => window.__DEVUNGEON__.events()[0].event_id,
  );
  await page.waitForTimeout(3400);
  check(
    "Pause freezes game only",
    Math.abs((await read()).time - frozen) < 0.05,
  );
  check(
    "DEMO continues while paused",
    e0 !==
      (await page.evaluate(() => window.__DEVUNGEON__.events()[0].event_id)),
  );
  await page.keyboard.press("p");
  await page.getByRole("button", { name: /Cinder builder/ }).click();
  const attacks = (await read()).stats.attacks;
  await hold("j", 300);
  await hold("d", 300);
  check(
    "Inspector suppresses game attack",
    (await read()).stats.attacks === attacks,
  );
  await page.screenshot({ path: "output/playwright/05-agent-inspector.png" });
  await page.getByRole("button", { name: "Close inspector" }).click();
  // Fresh run, actual defeat, and actual restart. No state setters are exposed.
  await page.reload();
  await page.getByRole("button", { name: "Enter the dungeon →" }).click();
  await move(3, 0);
  await page.waitForFunction(
    () => window.__DEVUNGEON__.snapshot().phase === "lost",
    {},
    { timeout: 45000 },
  );
  report.loss = await read();
  check("Actual defeat", report.loss.player.hp === 0);
  check(
    "Loss preserves project access",
    JSON.stringify(accessBefore) ===
      JSON.stringify(await page.evaluate(() => window.__DEVUNGEON__.access())),
  );
  await page.screenshot({ path: "output/playwright/06-defeat.png" });
  await page.getByRole("button", { name: "Another adventure ↻" }).click();
  check(
    "Restart returns safe spawn",
    (await read()).player.x === -8 && (await read()).player.hp === 100,
  );
  await page.keyboard.press("f");
  await page.waitForTimeout(1000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  check(
    "Narrow UI has no horizontal overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "output/playwright/07-narrow.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  // Raw rAF timing after warm-up, independent of the in-app rolling display.
  report.performance = await page.evaluate(async () => {
    const timings = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const until = last + 6000;
      function f(now) {
        timings.push(now - last);
        last = now;
        if (now < until) requestAnimationFrame(f);
        else resolve();
      }
      requestAnimationFrame(f);
    });
    const sorted = [...timings].sort((a, b) => a - b);
    return {
      frames: timings.length,
      averageFps: 1000 / (timings.reduce((a, b) => a + b, 0) / timings.length),
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      worstMs: sorted.at(-1),
      rolling: window.__DEVUNGEON__.metrics(),
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      userAgent: navigator.userAgent,
    };
  });
  report.ended = new Date().toISOString();
  return report;
};

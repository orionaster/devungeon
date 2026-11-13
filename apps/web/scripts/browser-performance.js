async (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Fault injection proves the renderer can run while the async physics chunk is late.
  await page.route("**/rapier-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto("http://127.0.0.1:5174");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "Enter the dungeon →" }).waitFor();
  await page.unroute("**/rapier-*.js");
  await page.getByRole("button", { name: "Enter the dungeon →" }).click();
  const measurement = page.evaluate(async () => {
    const start = window.__DEVUNGEON__.snapshot(),
      timings = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const until = last + 6000;
      function frame(now) {
        timings.push(now - last);
        last = now;
        if (now < until) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    const sorted = [...timings].sort((a, b) => a - b);
    return {
      start,
      end: window.__DEVUNGEON__.snapshot(),
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
  await page.keyboard.down("d");
  await page.waitForTimeout(1800);
  await page.keyboard.up("d");
  await page.keyboard.down("j");
  const report = await measurement;
  await page.keyboard.up("j");
  await page.keyboard.press("p");
  await page.screenshot({ path: "output/playwright/08-production-combat.png" });
  if (errors.length) throw Error(errors.join("\n"));
  if (
    report.end.stats.attacks < 1 ||
    report.end.stats.damageDealt < 1 ||
    report.end.stats.hitsTaken < 1
  )
    throw Error(
      "Measured scene did not exercise real combat: " + JSON.stringify(report),
    );
  return {
    production: true,
    delayedPhysicsStartupPassed: true,
    pageErrors: errors,
    report,
  };
};

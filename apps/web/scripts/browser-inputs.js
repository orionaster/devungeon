async function browserInputs(page) {
  await page.goto(new URL("/", page.url()).href);
  await page
    .getByRole("group", { name: "界面语言 / Interface language" })
    .first()
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter the dungeon →" }).click();
  const initial = await page.evaluate(
    () => window.__DEVUNGEON__.snapshot().stats.attacks,
  );
  await page.mouse.move(700, 600);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  if (
    (await page.evaluate(
      () => window.__DEVUNGEON__.snapshot().stats.attacks,
    )) !==
    initial + 1
  )
    throw Error("Quick click attack lost");
  await page.keyboard.down("a");
  await page.waitForTimeout(450);
  await page.keyboard.up("a");
  await page.keyboard.press("e");
  await page.getByRole("dialog", { name: "Moss DEMO inspector" }).waitFor();
  await page.keyboard.press("Escape");
  if (
    !(await page.evaluate(() =>
      document.activeElement?.classList.contains("game-surface"),
    ))
  )
    throw Error("Inspector did not restore focus");
  const zoom0 = await page.evaluate(() => window.__DEVUNGEON__.camera().zoom);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  if ((await page.evaluate(() => window.__DEVUNGEON__.camera().zoom)) <= zoom0)
    throw Error("Zoom failed");
  await page.mouse.move(700, 600);
  await page.mouse.wheel(0, -120);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(780, 640, { steps: 10 });
  await page.mouse.up({ button: "right" });
  if (
    (await page.evaluate(() => window.__DEVUNGEON__.camera().mode)) !== "free"
  )
    throw Error("Right drag did not pan");
  await page.keyboard.press("c");
  if (
    (await page.evaluate(() => window.__DEVUNGEON__.camera().mode)) !== "follow"
  )
    throw Error("Follow restore failed");
  await page.keyboard.press("p");
  // Synthetic visible main-thread stall validates the counter, not normal performance.
  await page.evaluate(() => {
    const until = performance.now() + 600;
    while (performance.now() < until) {
      /* deliberate test stall */
    }
  });
  await page.waitForTimeout(100);
  const worst = await page.evaluate(
    () => window.__DEVUNGEON__.metrics().worstMs,
  );
  if (worst < 550) throw Error("Visible long hitch omitted");
  return {
    quickMouseAttack: true,
    nearbyKeyboardInspect: true,
    focusRestored: true,
    zoomAndPan: true,
    followRestored: true,
    synthetic600msHitchRecorded: worst,
  };
}

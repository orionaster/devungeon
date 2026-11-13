async function browserI18n(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const checks = [];
  function check(name, pass, details) {
    checks.push({ name, pass, details });
    if (!pass) throw Error(name + ": " + JSON.stringify(details));
  }
  const locale = async (name) => {
    await page
      .getByRole("group", { name: "界面语言 / Interface language" })
      .last()
      .getByRole("button", { name, exact: true })
      .click();
    await page.waitForTimeout(100);
  };
  const read = () => page.evaluate(() => window.__DEVUNGEON__.snapshot());
  await page.goto(new URL("/", page.url()).href);
  await page.evaluate(() => localStorage.removeItem("devungeon.locale.v1"));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "进入地牢 →" }).waitFor();
  check(
    "Fresh visitor defaults to Chinese",
    await page.evaluate(() => document.documentElement.lang === "zh-CN"),
  );
  await page.screenshot({ path: "output/playwright/wave2/zh-entry.png" });
  await locale("English");
  await page.screenshot({ path: "output/playwright/wave2/en-entry.png" });
  await page.reload();
  await page.getByRole("button", { name: "Enter the dungeon →" }).waitFor();
  check(
    "Explicit locale persists locally",
    await page.evaluate(() => document.documentElement.lang === "en-US"),
  );
  await locale("中文");
  await page.getByRole("button", { name: "进入地牢 →" }).click();
  const origin = await page.evaluate(() => performance.timeOrigin),
    source = await page.evaluate(() =>
      JSON.stringify(window.__DEVUNGEON__.scene()),
    );
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await locale("English");
  await page.keyboard.up("w");
  await page.waitForTimeout(150);
  const stopped = (await read()).player;
  await page.waitForTimeout(250);
  const later = (await read()).player;
  check(
    "Held movement releases across language control",
    Math.hypot(stopped.x - later.x, stopped.z - later.z) < 0.02,
    { stopped, later },
  );
  await page.locator('.game-surface').focus();
  await page.keyboard.press("p");
  const frozen = await read(),
    events = await page.evaluate(() =>
      window.__DEVUNGEON__.events().map((e) => e.event_id),
    );
  await locale("中文");
  await page.waitForTimeout(120);
  check(
    "Chinese switch preserves full paused game state",
    JSON.stringify(await read()) === JSON.stringify(frozen),
  );
  check(
    "Source IDs, geometry and access unchanged",
    await page.evaluate(
      (s) => JSON.stringify(window.__DEVUNGEON__.scene()) === s,
      source,
    ),
  );
  check(
    "Agent history is not reset",
    await page.evaluate(
      (ids) =>
        ids.every((id) =>
          window.__DEVUNGEON__.events().some((e) => e.event_id === id),
        ),
      events,
    ),
  );
  await page.screenshot({ path: "output/playwright/wave2/zh-hud.png" });
  await locale("English");
  check(
    "English switch preserves full game state",
    JSON.stringify(await read()) === JSON.stringify(frozen),
  );
  await page.screenshot({ path: "output/playwright/wave2/en-hud.png" });
  await page.getByRole("button", { name: "Controls and settings" }).click();
  await locale("中文");
  await page.getByRole("heading", { name: "脚步轻一点，机会多一点。" }).count();
  await page.screenshot({ path: "output/playwright/wave2/zh-help.png" });
  await locale("English");
  await page.screenshot({ path: "output/playwright/wave2/en-help.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /The Unwritten Vault Locked/ })
    .click();
  await locale("中文");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "output/playwright/wave2/zh-locked-room.png" });
  await locale("English");
  await page.screenshot({ path: "output/playwright/wave2/en-locked-room.png" });
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: /Cinder builder/ }).click();
  const original = await page.getByRole("dialog").innerText();
  await locale("中文");
  await page.screenshot({ path: "output/playwright/wave2/zh-agent.png" });
  check(
    "Source message remains traceable in Chinese",
    (await page
      .getByRole("dialog")
      .getByText("synthetic:s1-script", { exact: true })
      .count()) === 1,
  );
  await locale("English");
  await page.screenshot({ path: "output/playwright/wave2/en-agent.png" });
  check(
    "Inspecting does not alter paused game state",
    JSON.stringify(await read()) === JSON.stringify(frozen),
  );
  await page.keyboard.press("Escape");
  check(
    "Locale switches do not reload",
    await page.evaluate((o) => performance.timeOrigin === o, origin),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await locale("中文");
  await page.screenshot({ path: "output/playwright/wave2/zh-narrow.png" });
  check(
    "Narrow Chinese has no horizontal overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  check("No browser page errors", errors.length === 0, errors);
  return {
    checks,
    sourcePreserved: true,
    originalInspectorText: original,
    ended: new Date().toISOString(),
  };
}

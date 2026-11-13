async function browserHostContract(page) {
  await page.goto("http://127.0.0.1:5173/tests/host-contract.html");
  await page
    .getByRole("group", { name: "界面语言 / Interface language" })
    .first()
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter the dungeon →" }).click();
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  await page.keyboard.press("p");
  const frozen = await page.evaluate(() => window.__DEVUNGEON__.snapshot());
  const checks = [];
  function check(name, pass) {
    checks.push({ name, pass });
    if (!pass) throw Error(name);
  }
  for (const action of ["Replace event port", "Toggle event script"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.waitForTimeout(160);
    check(
      action + " preserves the full paused game",
      JSON.stringify(
        await page.evaluate(() => window.__DEVUNGEON__.snapshot()),
      ) === JSON.stringify(frozen),
    );
  }
  check(
    "Synthetic actor is labeled inside non-demo scene",
    (await page
      .getByRole("button", { name: /Contract actor/ })
      .getByText("DEMO", { exact: true })
      .count()) > 0,
  );
  check(
    "Visual marker is explicitly display only",
    (await page
      .getByRole("button", { name: /Contract actor/ })
      .getByText("Display-only location · player access unchanged", {
        exact: true,
      })
      .count()) === 1,
  );
  await page.screenshot({
    path: "output/playwright/wave2/mixed-provenance.png",
  });
  await page
    .getByRole("button", { name: "Other-project events", exact: true })
    .click();
  check(
    "Other project events are not projected",
    (await page.evaluate(() => window.__DEVUNGEON__.events())).length === 0,
  );
  await page
    .getByText(
      "The event source belongs to another project and is not displayed.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Invalid spawn", exact: true })
    .click();
  await page.getByRole("button", { name: "Engine unavailable →" }).waitFor();
  await page
    .getByRole("button", { name: "Restore scene", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter the dungeon →" }).waitFor();
  check(
    "Valid scene recovers without stale startup error",
    await page.getByRole("button", { name: "Enter the dungeon →" }).isEnabled(),
  );
  return {
    checks,
    fixture:
      "synthetic contract flags only, no public source or real Agent connection",
    ended: new Date().toISOString(),
  };
}

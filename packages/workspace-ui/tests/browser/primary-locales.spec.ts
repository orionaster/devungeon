import { expect, test } from "@playwright/test";

test.setTimeout(65000);
test("primary entry shares Chinese/English menus, HUD, room and workspace without resetting game/work", async ({
  page,
}) => {
  await page.goto(process.env.PRIMARY_APP_URL ?? "/?source=game");
  const entry = page
    .getByRole("group", { name: "界面语言 / Interface language" })
    .first();
  await expect(page.getByRole("button", { name: "进入地牢" })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/primary-entry-zh.png",
    fullPage: true,
  });
  await entry.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter the dungeon" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/primary-entry-en.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enter the dungeon" }).click();
  await page.waitForFunction(
    () => window.__DEVUNGEON__?.snapshot()?.phase === "playing",
  );
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__!.snapshot()?.player.z ?? 1) < -0.2,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.stats.attacks),
    )
    .toBeGreaterThan(0);
  await entry.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.screenshot({
    path: "output/playwright/primary-hud-zh.png",
    fullPage: true,
  });
  const before = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  await entry.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  const after = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  expect(after.phase).toBe("playing");
  expect(after.stats.attacks).toBe(before.stats.attacks);
  expect(after.time).toBeGreaterThanOrEqual(before.time);
  expect(Math.abs(after.player.z - before.player.z)).toBeLessThan(0.05);
  await page.screenshot({
    path: "output/playwright/primary-hud-en.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Lumen/ }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Lumen", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("combobox", { name: "Choose action" })
    .selectOption("publish");
  await panel
    .getByRole("textbox", { name: "Message or task content" })
    .fill("Primary host scoped DEMO approval — 原文保留");
  await panel.getByRole("button", { name: "Send · DEMO" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__DEVUNGEON_WORKSPACE__!.snapshot().approvals.length,
      ),
    )
    .toBe(1);
  await panel.getByRole("button", { name: /^Permissions/ }).click();
  await page.screenshot({
    path: "output/playwright/primary-approval-en.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "Chat", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/primary-workspace-en.png",
    fullPage: true,
  });
  const work = await page.evaluate(() => {
    const { agents, observed_at, revision, ...data } =
      window.__DEVUNGEON_WORKSPACE__!.snapshot();
    return {
      ...data,
      agents: agents.map(({ observed_at, ...agent }) => agent),
    };
  });
  const paused = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  await panel
    .getByRole("group", { name: "界面语言 / Interface language" })
    .getByRole("button", { name: "中文", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!)).toEqual(
    paused,
  );
  expect(
    await page.evaluate(() => {
      const { agents, observed_at, revision, ...data } =
        window.__DEVUNGEON_WORKSPACE__!.snapshot();
      return {
        ...data,
        agents: agents.map(({ observed_at, ...agent }) => agent),
      };
    }),
  ).toEqual(work);
  await page.screenshot({
    path: "output/playwright/primary-workspace-zh.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: /^权限/ }).click();
  await page.screenshot({
    path: "output/playwright/primary-approval-zh.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "返回游戏世界" }).focus();
  await page.keyboard.press("Space");
  await expect(panel).toHaveCount(0);
  await expect(page.getByLabel(/^地牢。WASD/)).toBeFocused();
  expect(
    await page.evaluate(
      () => window.__DEVUNGEON_WORKSPACE__!.snapshot().approvals[0].status,
    ),
  ).toBe("pending");
  const x = await page.evaluate(
    () => window.__DEVUNGEON__!.snapshot()!.player.x,
  );
  await page.keyboard.down("KeyD");
  await expect
    .poll(() => page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player.x))
    .toBeGreaterThan(x + 0.25);
  await page.keyboard.up("KeyD");
  await page.getByRole("button", { name: /未竟秘库/ }).click();
  const room = page.getByRole("dialog");
  await expect(room).toContainText("等待项目验收证据");
  await page.screenshot({
    path: "output/playwright/primary-locked-room-zh.png",
    fullPage: true,
  });
  const access = await page.evaluate(() => window.__DEVUNGEON__!.access());
  const roomPaused = await page.evaluate(
    () => window.__DEVUNGEON__!.snapshot()!,
  );
  await room
    .getByRole("group", { name: "界面语言 / Interface language" })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await expect(room).toContainText("The Unwritten Vault");
  await expect(room).toContainText("Camera preview grants no player access.");
  expect(await page.evaluate(() => window.__DEVUNGEON__!.access())).toEqual(
    access,
  );
  expect(await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!)).toEqual(
    roomPaused,
  );
  await page.screenshot({
    path: "output/playwright/primary-locked-room-en.png",
    fullPage: true,
  });
});

import { expect, test } from "@playwright/test";

test.setTimeout(65000);
test("primary entry shares Chinese/English menus, HUD, room and workspace without resetting game/work", async ({
  page,
}) => {
  await page.goto(process.env.PRIMARY_APP_URL ?? "/?source=game");
  await page.locator(".forge-toolbar > summary").click();
  await page.getByTestId("forge-project-select").selectOption("workbench");
  await page.locator(".forge-toolbar > summary").click();
  await page.waitForFunction(() => {
    const scene = window.__DEVUNGEON__?.scene();
    const work = window.__DEVUNGEON_WORKSPACE__?.snapshot();
    return !!work?.agents.some((agent) => agent.role === "supervisor") &&
      scene?.project_context?.project_id === work.project_id &&
      window.__DEVUNGEON__?.snapshot()?.phase === "ready";
  });
  const supervisor = await page.evaluate(() =>
    window.__DEVUNGEON_WORKSPACE__!.snapshot().agents.find((agent) => agent.role === "supervisor")!,
  );
  const lockedRoom = await page.evaluate(() => window.__DEVUNGEON__!.scene().rooms.find((room) => !room.enterable)!);
  const entry = page
    .getByRole("group", { name: "界面语言 / Interface language" })
    .first();
  await expect(page.getByRole("button", { name: "进入地牢" })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/forge-primary-entry-zh.png",
    fullPage: true,
  });
  await entry.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter the dungeon" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/forge-primary-entry-en.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enter the dungeon" }).click();
  await page.waitForFunction(
    () => window.__DEVUNGEON__?.snapshot()?.phase === "playing",
  );
  await page.locator(".game-surface").focus();
  const initialZ = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player.z);
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(
      (z) => window.__DEVUNGEON__!.snapshot()!.player.z < z - 0.25,
      initialZ,
    );
  } finally { await page.keyboard.up("KeyW"); }
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.stats.attacks),
    )
    .toBeGreaterThan(0);
  await entry.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.screenshot({
    path: "output/playwright/forge-primary-hud-zh.png",
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
    path: "output/playwright/forge-primary-hud-en.png",
    fullPage: true,
  });
  if (await page.locator(".journal-toggle").getAttribute("aria-expanded") === "false")
    await page.locator(".journal-toggle").click();
  await page.locator(".agent-row").filter({ hasText: supervisor.name }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: supervisor.name, exact: true }),
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
    path: "output/playwright/forge-primary-approval-en.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "Chat", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/forge-primary-workspace-en.png",
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
    path: "output/playwright/forge-primary-workspace-zh.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: /^权限/ }).click();
  await page.screenshot({
    path: "output/playwright/forge-primary-approval-zh.png",
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
  if (await page.locator(".journal-toggle").getAttribute("aria-expanded") === "false")
    await page.locator(".journal-toggle").click();
  await page.locator(".vault-link").click();
  const room = page.getByRole("dialog");
  await expect(room.getByRole("heading", { name: lockedRoom.name, exact: true })).toBeVisible();
  await expect(room).toContainText("镜头预览不会授予玩家进入权限。");
  await page.screenshot({
    path: "output/playwright/forge-primary-locked-room-zh.png",
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
  // Canonical feature names remain original source text in either UI locale.
  await expect(room.getByRole("heading", { name: lockedRoom.name, exact: true })).toBeVisible();
  await expect(room).toContainText("Camera preview grants no player access.");
  expect(await page.evaluate(() => window.__DEVUNGEON__!.access())).toEqual(
    access,
  );
  expect(await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!)).toEqual(
    roomPaused,
  );
  await page.screenshot({
    path: "output/playwright/forge-primary-locked-room-en.png",
    fullPage: true,
  });
});

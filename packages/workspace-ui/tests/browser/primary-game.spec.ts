import { expect, test } from "@playwright/test";

test("the actual product App connects its NPC to the workbench and resumes the same run", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?source=game");
  await page.getByRole("button", { name: "Enter the dungeon" }).click();
  await page.waitForFunction(
    () => window.__DEVUNGEON__?.snapshot()?.phase === "playing",
  );
  const surface = page.getByLabel(/^Dungeon\. WASD/);
  await surface.focus();
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__!.snapshot()?.player.z ?? 1) < -0.65,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyE");
  await expect(
    page.getByRole("heading", { name: "Lumen", exact: true }),
  ).toBeVisible();
  const gameBefore = await page.evaluate(
    () => window.__DEVUNGEON__!.snapshot()!,
  );
  await page
    .getByRole("textbox", { name: "消息或任务内容" })
    .fill("汇报工坊里的工作");
  await page.getByRole("button", { name: "发送 · DEMO" }).click();
  await expect(page.getByRole("log")).toContainText("固定规则模拟器");
  expect(
    await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player),
  ).toEqual(gameBefore.player);
  await page.screenshot({
    path: "output/playwright/primary-game-workspace.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("assign_task");
  await page
    .getByRole("textbox", { name: "消息或任务内容" })
    .fill("主游戏中的工作台任务");
  await page.getByRole("button", { name: "发送 · DEMO" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(surface).toBeFocused();
  const beforeMove = await page.evaluate(
    () => window.__DEVUNGEON__!.snapshot()!.player.x,
  );
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () =>
      page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player.x),
    )
    .toBeGreaterThan(beforeMove + 0.3);
  await page.keyboard.up("KeyD");
  await page.getByRole("button", { name: /Lumen wizard/ }).click();
  await expect(page.getByRole("log")).toContainText("任务已分派并生成模拟结果");
  await page.getByRole("button", { name: "任务", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "主游戏中的工作台任务" }),
  ).toBeVisible();
  const events = await page.evaluate(() => window.__DEVUNGEON__!.events());
  expect(
    events.some(
      (event) =>
        event.source === "demo-adapter" &&
        event.event_type === "command_result",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

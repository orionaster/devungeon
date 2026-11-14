import { expect, test } from "@playwright/test";

// This drives a full WebGL/WASM entry and an entire return-to-game flow.
// Match the other 3D cases; CI's cold WebGL/WASM entry exceeds the 30s default.
test.setTimeout(65000);

test("the actual product App connects its NPC to the workbench and resumes the same run", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  await page.getByRole("button", { name: "进入地牢" }).click();
  await page.waitForFunction(
    () => window.__DEVUNGEON__?.snapshot()?.phase === "playing",
  );
  const surface = page.getByLabel(/^地牢。WASD/);
  await surface.focus();
  const initialZ = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player.z);
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(
      (z) => window.__DEVUNGEON__!.snapshot()!.player.z < z - 0.35,
      initialZ,
    );
  } finally { await page.keyboard.up("KeyW"); }
  // Compiled source Agents may occupy a sealed work room; party inspection is
  // the supported UI path and never teleports the player through that seal.
  if (await page.locator(".journal-toggle").getAttribute("aria-expanded") === "false")
    await page.locator(".journal-toggle").click();
  await page.locator(".agent-row").filter({ hasText: supervisor.name }).click();
  await expect(
    page.getByRole("heading", { name: supervisor.name, exact: true }),
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
    path: "output/playwright/forge-primary-game-workspace.png",
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
  if (await page.locator(".journal-toggle").getAttribute("aria-expanded") === "false")
    await page.locator(".journal-toggle").click();
  await page.locator(".agent-row").filter({ hasText: supervisor.name }).click();
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

import { expect, test, type Page } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

test.describe.configure({ mode: "serial" });
test.setTimeout(65000);

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    game: window.__DEVUNGEON__!.snapshot()!,
    work: window.__DEVUNGEON_WORKSPACE__!.snapshot(),
    selected: window.__DEVUNGEON_WORKSPACE__!.selectedId(),
    camera: window.__DEVUNGEON__!.camera(),
  }));
}
async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "消息或任务内容" }).fill(text);
  await page.getByRole("button", { name: "发送 · DEMO" }).click();
}
async function ready(page: Page) {
  await page.goto("/?source=hero");
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON__?.snapshot()?.phase === "playing" &&
      !!window.__DEVUNGEON_WORKSPACE__,
  );
  await page.getByLabel(/^3D 地牢/).focus();
}

test("actual 3D proximity → E → chat/dispatch → close → movement, with input and work isolation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__?.snapshot()?.player.z ?? 1) < -0.65,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyE");
  await expect(
    page.getByRole("heading", { name: "Lumen", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).selected).toBe("demo-wizard");
  const inspecting = await snapshot(page);
  await page.getByRole("textbox", { name: "消息或任务内容" }).focus();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(160);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("KeyJ");
  const typed = await snapshot(page);
  expect(typed.game.player).toEqual(inspecting.game.player);
  expect(typed.game.stats).toEqual(inspecting.game.stats);
  await send(page, "检查地牢里的工作进展");
  await expect(page.getByRole("log")).toContainText("固定规则模拟器");
  await page.screenshot({
    path: "output/playwright/hero-workspace-chat.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("assign_task");
  await send(page, "核对工坊门锁规则");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel(/^3D 地牢/)).toBeFocused();
  await expect
    .poll(async () => (await snapshot(page)).work.receipts.at(-1)?.status)
    .toBe("completed");
  const beforeMove = (await snapshot(page)).game.player.x;
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () => (await snapshot(page)).game.player.x)
    .toBeGreaterThan(beforeMove + 0.3);
  await page.keyboard.up("KeyD");
  const after = await snapshot(page);
  const task = after.work.tasks.find(
    (item) => item.title === "核对工坊门锁规则",
  )!;
  expect(task.status).toBe("review");
  const worldEvents = await page.evaluate(() => window.__DEVUNGEON__!.events());
  expect(
    worldEvents.some(
      (event) =>
        event.source === "demo-adapter" &&
        event.event_type === "command_result",
    ),
  ).toBe(true);
  expect(worldEvents.every((event) => event.is_demo)).toBe(true);
  expect(JSON.stringify(after.work)).not.toContain('"accepted"');
  expect(errors).toEqual([]);
});

test("clicking the rendered 3D NPC opens the same scoped inspector", async ({
  page,
}) => {
  await ready(page);
  await page.waitForTimeout(1200);
  const { game, camera: control } = await snapshot(page);
  const bounds = await page.locator("canvas").boundingBox();
  expect(bounds).toBeTruthy();
  const camera = new OrthographicCamera(
    -bounds!.width / 2,
    bounds!.width / 2,
    bounds!.height / 2,
    -bounds!.height / 2,
    0.1,
    150,
  );
  const angle = (control.heading * Math.PI) / 2;
  camera.position.set(
    game.player.x + Math.sin(angle) * 21,
    26,
    game.player.z + Math.cos(angle) * 21,
  );
  camera.lookAt(game.player.x, 0, game.player.z);
  camera.zoom = control.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const point = new Vector3(-8, 0.95, -3).project(camera); // Lumen's real scene coordinates.
  await page.mouse.click(
    bounds!.x + ((point.x + 1) * bounds!.width) / 2,
    bounds!.y + ((1 - point.y) * bounds!.height) / 2,
  );
  await expect(
    page.getByRole("heading", { name: "Lumen", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).selected).toBe("demo-wizard");
  await page.getByRole("button", { name: "权限", exact: true }).click();
  await expect(page.getByLabel("权限内容")).toContainText(
    "synthetic:supervisor",
  );
  await page.screenshot({
    path: "output/playwright/hero-workspace-npc.png",
    fullPage: true,
  });
});

test("manual combat pause preserves work execution; game death/restart never resolves an approval", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "暂停战斗", exact: true }).click();
  await page.getByRole("button", { name: /Lumen 主管/ }).click();
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("assign_task");
  await send(page, "暂停冒险时继续核对记录");
  await page.keyboard.press("Escape");
  const pausedTime = (await snapshot(page)).game.time;
  await expect
    .poll(async () => (await snapshot(page)).work.receipts.at(-1)?.status)
    .toBe("completed");
  expect((await snapshot(page)).game.time).toBe(pausedTime);
  await page.getByRole("button", { name: /Lumen 主管/ }).click();
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("publish");
  await send(page, "只允许人工审批的合成发布");
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).work.approvals[0].status).toBe("pending");
  await page.getByRole("button", { name: "继续冒险", exact: true }).click();
  await page.keyboard.down("KeyD");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__?.snapshot()?.player.x ?? -8) > 2,
  );
  await page.keyboard.up("KeyD");
  await expect
    .poll(async () => (await snapshot(page)).game.phase, { timeout: 40000 })
    .toBe("lost");
  expect((await snapshot(page)).work.approvals[0].status).toBe("pending");
  await page.screenshot({
    path: "output/playwright/hero-workspace-death.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "重新开始冒险" }).click();
  const restarted = await snapshot(page);
  expect(restarted.game.player.hp).toBe(100);
  expect(restarted.work.approvals[0].status).toBe("pending");
  expect(
    restarted.work.receipts.find((item) => item.command.action === "publish")
      ?.status,
  ).toBe("awaiting_approval");
  expect(
    restarted.work.tasks.some(
      (item) => item.title === "暂停冒险时继续核对记录",
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Lumen 主管/ }).click();
  await page.getByRole("button", { name: /权限/ }).click();
  await page
    .getByRole("button", { name: "仅批准这次演练" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "output/playwright/hero-workspace-approval.png",
    fullPage: true,
  });
});

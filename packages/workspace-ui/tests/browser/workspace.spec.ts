import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
const openBoss = async (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "与奥林交谈，主管" }).click();
const message = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "消息或任务内容" });
const send = async (page: import("@playwright/test").Page, text: string) => {
  await message(page).fill(text);
  await page.getByRole("button", { name: "发送 · DEMO" }).click();
};

test("select, chat, leave and return with background task evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openBoss(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("本地模拟 · 不连接真实 AI，不执行外部操作"),
  ).toBeVisible();
  await send(page, "现在有什么阻塞？");
  await expect(page.getByRole("log")).toContainText("固定规则模拟器");
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("assign_task");
  await send(page, "整理北侧机关门规则");
  await page.getByRole("button", { name: "返回游戏世界" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("w");
  await openBoss(page);
  await expect(page.getByRole("log")).toContainText("任务已分派并生成模拟结果");
  await page.getByRole("button", { name: "任务", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "整理北侧机关门规则" }),
  ).toBeVisible();
  await expect(page.getByText("本次合成执行记录 · 未独立验证")).toBeVisible();
  await page.getByRole("button", { name: "活动", exact: true }).click();
  await expect(page.getByLabel("活动内容")).toContainText("command_result");
  await expect(page.getByLabel("活动内容")).toContainText("synthetic:");
  await page.screenshot({
    path: "output/playwright/workspace-events.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("explicit approval shows exact scope, denial and one-time simulated execution", async ({
  page,
}) => {
  await openBoss(page);
  await page
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("publish");
  await send(page, "仅演练发布合成报告 v1");
  await page.getByRole("button", { name: /审批待处理/ }).click();
  await expect(page.getByLabel("权限内容")).toContainText(
    "synthetic-agents / Agent agent-boss / 仅一次 publish",
  );
  await expect(page.getByLabel("权限内容")).toContainText("不上传、不发布");
  await page
    .getByRole("button", { name: "仅批准这次演练" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "output/playwright/workspace-approval.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "拒绝", exact: true }).click();
  await expect(page.getByText("已拒绝 · DEMO", { exact: true })).toBeVisible();
  await send(page, "仅演练发布合成报告 v2");
  await page.getByRole("button", { name: "仅批准这次演练" }).click();
  await expect(
    page.getByRole("button", { name: "仅批准这次演练" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "对话", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("没有发生外部发布");
});

test("disconnected and stale states disable sending; reconnect restores access", async ({
  page,
}) => {
  await page.getByRole("button", { name: "演示设置" }).click();
  await page.getByRole("button", { name: "模拟断线" }).click();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await openBoss(page);
  await expect(message(page)).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("未连接");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "演示设置" }).click();
  await page.getByRole("button", { name: "重新连接" }).click();
  await page.getByRole("button", { name: "模拟状态过期" }).click();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await openBoss(page);
  await expect(message(page)).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("状态已过期");
});

test("all roles have isolated conversations and unsupported capabilities", async ({
  page,
}) => {
  await openBoss(page);
  await message(page).fill("保留主管草稿");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "与微光交谈，审查" }).click();
  await expect(message(page)).toHaveValue("");
  await expect(
    page.getByRole("option", { name: "派遣任务 · 不支持" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("option", { name: "发布演练 · 不支持" }),
  ).toBeDisabled();
  await send(page, "核对记录");
  await expect(page.getByRole("log")).toContainText("固定规则模拟器");
  await page.keyboard.press("Escape");
  await openBoss(page);
  await expect(message(page)).toHaveValue("保留主管草稿");
  await expect(page.getByRole("log")).not.toContainText("核对记录");
});

test("approach with keyboard, E to interact, Escape to resume without losing focus", async ({
  page,
}) => {
  const stage = page.getByLabel(/指挥厅交互试验场/);
  await stage.focus();
  for (let index = 0; index < 11; index++) await page.keyboard.press("w");
  await expect(page.getByText("E 交谈", { exact: true })).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "奥林", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stage).toBeFocused();
});

test("mobile sheet fits viewport, readable content and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBoss(page);
  await expect(message(page)).toBeVisible();
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "output/playwright/workspace-mobile.png",
    fullPage: true,
  });
});

test("captures desktop entry and conversation in an actual browser", async ({
  page,
}) => {
  await page.screenshot({
    path: "output/playwright/command-hall.png",
    fullPage: true,
  });
  await openBoss(page);
  await send(page, "下一段旅程从哪里开始？");
  await expect(page.getByRole("log")).toContainText("固定规则模拟器");
  await page.screenshot({
    path: "output/playwright/workspace-chat.png",
    fullPage: true,
  });
});

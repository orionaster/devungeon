import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "en-US" }); // Browser language must not change the Chinese-first default.
test.setTimeout(65000);
const groupName = "界面语言 / Interface language";
async function ready(page: Page) {
  await page.goto("/?source=hero");
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON__?.snapshot()?.phase === "playing" &&
      !!window.__DEVUNGEON_WORKSPACE__,
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
}
async function stableWork(page: Page) {
  return page.evaluate(() => {
    const state = window.__DEVUNGEON_WORKSPACE__!.snapshot();
    return {
      project: state.project_id,
      agents: state.agents.map(
        ({ id, task_id, capabilities, room_id, is_demo }) => ({
          id,
          task_id,
          capabilities,
          room_id,
          is_demo,
        }),
      ),
      tasks: state.tasks,
      events: state.events,
      receipts: state.receipts,
      approvals: state.approvals,
      selected: window.__DEVUNGEON_WORKSPACE__!.selectedId(),
    };
  });
}

test("Chinese-first 3D workspace switches both ways without changing draft, approval, source events or player", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("[i18n]")) warnings.push(message.text());
  });
  await ready(page);
  await page.getByRole("button", { name: /Lumen/ }).click();
  const panel = page.getByRole("dialog");
  await panel
    .getByRole("textbox", { name: "消息或任务内容" })
    .fill("原始文本 <scope> & {id}");
  await panel.getByRole("button", { name: "发送 · DEMO" }).click();
  await expect(panel.getByRole("log")).toContainText("固定规则模拟器");
  await panel
    .getByRole("combobox", { name: "选择操作" })
    .selectOption("publish");
  await panel
    .getByRole("textbox", { name: "消息或任务内容" })
    .fill("Scoped rehearsal only — 原始授权内容");
  await panel.getByRole("button", { name: "发送 · DEMO" }).click();
  await expect
    .poll(async () => (await stableWork(page)).approvals.length)
    .toBe(1);
  const draft = "草稿不能因语言变化重写 — literal $& {scope}";
  await panel.getByRole("textbox", { name: "消息或任务内容" }).fill(draft);
  const before = await stableWork(page);
  const player = await page.evaluate(
    () => window.__DEVUNGEON__!.snapshot()!.player,
  );
  await page.screenshot({
    path: "output/playwright/i18n-workspace-zh.png",
    fullPage: true,
  });
  await panel
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    panel.getByRole("textbox", { name: "Message or task content" }),
  ).toHaveValue(draft);
  await expect(panel.getByRole("log")).toContainText(
    "Original DEMO Agent text",
  );
  await expect(panel.getByRole("log")).toContainText("原始文本 <scope> & {id}");
  expect(await stableWork(page)).toEqual(before);
  expect(
    await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!.player),
  ).toEqual(player);
  await page.screenshot({
    path: "output/playwright/i18n-workspace-en.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: /^Permissions/ }).click();
  await expect(
    panel.getByRole("button", { name: "Approve this rehearsal only" }),
  ).toBeVisible();
  await expect(
    panel
      .getByText("Scoped rehearsal only — 原始授权内容", { exact: true })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/i18n-approval-en.png",
    fullPage: true,
  });
  await panel
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "中文", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "仅批准这次演练" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("textbox", { name: "消息或任务内容" }),
  ).toHaveValue(draft);
  expect(await stableWork(page)).toEqual(before);
  expect((await stableWork(page)).approvals[0].status).toBe("pending");
  await page.screenshot({
    path: "output/playwright/i18n-approval-zh.png",
    fullPage: true,
  });
  expect(warnings).toEqual([]);
});

test("locale buttons preserve held-key release and keyboard Space never dodges or attacks", async ({
  page,
}) => {
  await ready(page);
  const surface = page.getByLabel(/^3D 地牢/);
  await surface.focus();
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__!.snapshot()?.player.z ?? 1) < -0.2,
  );
  await page
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.keyboard.up("KeyW"); // Must reach the game's key cleanup even though a UI control now has focus.
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  expect(Math.abs(after.player.z - before.player.z)).toBeLessThan(0.05);
  await page.getByRole("button", { name: "中文", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  const final = await page.evaluate(() => window.__DEVUNGEON__!.snapshot()!);
  expect(final.stats.attacks).toBe(before.stats.attacks);
  expect(final.stats.dodges).toBe(before.stats.dodges);
  expect((await stableWork(page)).receipts).toEqual([]);
});

test("local locale preference persists across explicit refresh without translating source text", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "冒险间隙，和队友聊聊。" }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Between adventures, talk to your teammates.",
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("devungeon.locale.v1")),
    )
    .toBe("en-US");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page.getByRole("heading", {
      name: "Between adventures, talk to your teammates.",
    }),
  ).toBeVisible();
});

test("narrow English workspace keeps locale control readable and unconnected native execution disabled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?source=hero&connection=codex");
  const entryEnglish = page
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "English", exact: true });
  await expect(entryEnglish).toBeVisible();
  const entryBounds = await entryEnglish.boundingBox();
  expect(entryBounds!.x + entryBounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Codex/ }).click();
  const panel = page.getByRole("dialog");
  await panel
    .getByRole("group", { name: groupName })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await expect(
    panel.getByRole("textbox", { name: "Message or task content" }),
  ).toBeDisabled();
  await expect(
    panel
      .getByText("LIVE · Real source · Disconnected", { exact: true })
      .first(),
  ).toBeVisible();
  const size = await panel.boundingBox();
  expect(size!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "output/playwright/i18n-native-off-en-mobile.png",
    fullPage: true,
  });
});

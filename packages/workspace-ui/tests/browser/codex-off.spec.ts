import { expect, test } from "@playwright/test";

test("native text trial stays disconnected and rejects forged/cross-origin commands by default", async ({ page, request }) => {
  test.setTimeout(65000);
  const snapshot = await request.get("/codex-text/snapshot");
  expect(snapshot.ok()).toBe(true);
  const state = await snapshot.json();
  expect(state.connected).toBe(false);
  expect(state.agents[0].capabilities).toEqual([]);
  expect(state.receipts).toEqual([]);
  expect((await request.get("/codex-text/snapshot", { headers: { Origin: "https://example.invalid" } })).status()).toBe(403);
  expect((await request.post("/codex-text/commands", { data: {} })).status()).toBe(403);
  expect((await request.post("/codex-text/commands", {
    headers: { Origin: "http://127.0.0.1:4174", "X-Devungeon-Intent": "codex-text" }, data: {},
  })).status()).toBe(409);
  await page.goto("/?source=hero&connection=codex");
  await page.getByRole("button", { name: /Codex · 文本试验/ }).click();
  await expect(page.getByRole("heading", { name: "Codex · 文本试验" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "消息或任务内容" })).toBeDisabled();
  await expect(page.getByRole("dialog").getByText("LIVE · 真实来源 · 未连接", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "output/playwright/codex-text-disabled.png", fullPage: true });
});

import { expect, test } from "@playwright/test";

test("SCOUT running bridge → SSE → readonly character → original evidence", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.RUN_SCOUT_INTEGRATION !== "1",
    "Requires SCOUT read-only bridge at explicitly configured SCOUT_BRIDGE_PORT.",
  );
  const response = await request.get("/scout-read/v1/status");
  expect(response.ok()).toBe(true);
  const status = await response.json();
  expect(status.project_id).toBe("github:orionaster/devungeon");
  expect(status.capabilities.commands).toEqual([]);
  expect(
    (
      await request.get("/scout-read/v1/status", {
        headers: { Origin: "https://example.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post("/scout-read/v1/status")).status()).toBe(403);
  expect((await request.get("/scout-read/v1/commands")).status()).toBe(404);
  await page.goto("/?source=scout");
  const observedActor = page
    .getByRole("button", { name: /点击核对来源与证据/ })
    .first();
  await expect(observedActor).toBeVisible();
  await observedActor.click();
  await expect(
    page.getByRole("textbox", { name: "消息或任务内容" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "活动", exact: true }).click();
  await expect(page.getByLabel("活动内容")).toContainText("scout-local");
  await expect(page.getByLabel("活动内容")).toContainText("REPLAY");
  await expect(
    page.getByLabel("活动内容").getByRole("link").first(),
  ).toHaveAttribute(
    "href",
    /https:\/\/github.com\/orionaster\/devungeon\/commit\//,
  );
  await page.screenshot({
    path: "output/playwright/scout-real-readonly.png",
    fullPage: true,
  });
});

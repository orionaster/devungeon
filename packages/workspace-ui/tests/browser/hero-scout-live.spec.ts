import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

test("real bounded Git observation → SCOUT SSE → 3D character → readonly workspace", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_SCOUT_INTEGRATION !== "1" ||
      !process.env.SCOUT_CHECKOUT ||
      !process.env.SCOUT_METADATA_FILE,
    "Requires an explicitly selected SCOUT bridge/metadata instrument, not a mock server.",
  );
  await page.goto("/?source=hero&connection=scout");
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON__?.snapshot()?.phase === "playing" &&
      window.__DEVUNGEON_WORKSPACE__?.snapshot().connected,
  );
  const before = await page.evaluate(() =>
    window
      .__DEVUNGEON_WORKSPACE__!.snapshot()
      .events.map((event) => event.event_id),
  );
  // Exactly the reviewed public-Devungeon read-only instrument. No shell string,
  // model call, arbitrary command or private source is accepted by this test.
  await promisify(execFile)(
    process.execPath,
    [
      resolve(
        process.env.SCOUT_CHECKOUT!,
        "apps/bridge/scripts/observe-git.ts",
      ),
      resolve("../.."),
      process.env.SCOUT_METADATA_FILE!,
      "github:issue:6367957869",
    ],
    { timeout: 10000 },
  );
  await expect
    .poll(async () =>
      page.evaluate(
        (previous) =>
          window
            .__DEVUNGEON_WORKSPACE__!.snapshot()
            .events.some(
              (event) =>
                !previous.includes(event.event_id) &&
                event.event_type === "completed" &&
                !event.is_demo,
            ),
        before,
      ),
    )
    .toBe(true);
  const actor = await page.evaluate((previous) => {
    const state = window.__DEVUNGEON_WORKSPACE__!.snapshot();
    const event = [...state.events].reverse().find(
      (event) =>
        !previous.includes(event.event_id) && event.event_type === "completed",
    )!;
    return { id: event.agent_id, mode: state.event_modes[event.event_id] };
  }, before);
  expect(actor.mode).toBe("live");
  // The most recently observed source actor occupies the first display slot in
  // the DEMO forge. This position and skin assert no real source room or role.
  await page.getByLabel(/^3D 地牢/).focus();
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window.__DEVUNGEON__!.snapshot()?.player.z ?? 1) < -0.65,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyE");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => window.__DEVUNGEON_WORKSPACE__!.selectedId()),
  ).toBe(actor.id);
  await expect(
    page.getByRole("textbox", { name: "消息或任务内容" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "活动", exact: true }).click();
  await expect(page.getByLabel("活动内容")).toContainText("scout-local");
  await expect(
    page.getByLabel("活动内容").getByRole("link").first(),
  ).toHaveAttribute("href", /github.com\/orionaster\/devungeon\/commit\//);
  await page.screenshot({
    path: "output/playwright/hero-scout-real-readonly.png",
    fullPage: true,
  });
});

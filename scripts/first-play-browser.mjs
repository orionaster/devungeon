/** Real input against a running production app. No state setters, HTTP mocks or
 * model calls. Art approval remains a separate product-owner playtest. */
import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";

const url = process.env.FIRST_PLAY_URL ?? "http://127.0.0.1:5194";
const output = resolve(
  process.env.FIRST_PLAY_OUTPUT ?? "output/playwright/firstplay-product",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.HEADLESS === "1",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 1440, height: 960 } },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const report = {
  started_at: new Date().toISOString(),
  url,
  node: process.version,
  platform: process.platform,
  browser: browser.version(),
  viewport: { width: 1440, height: 960 },
  dpr: 1,
  checks: [],
  errors: [],
  limits: [
    "Trusted automated browser inputs, not independent owner approval or physical mobile/Safari testing.",
  ],
};
page.on("pageerror", (error) => report.errors.push(error.message));
const check = (name, pass, detail) => {
  report.checks.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  assert.ok(pass, name);
  console.log(`PASS ${name}`);
};
const read = () =>
  page.evaluate(() => ({
    game: window.__DEVUNGEON__?.snapshot(),
    scene: window.__DEVUNGEON__?.scene(),
    feature: window.__DEVUNGEON_FEATURE__?.snapshot(),
    forge: window.__DEVUNGEON_FORGE__?.snapshot(),
    metrics: window.__DEVUNGEON__?.metrics(),
  }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function hold(key, ms) {
  await page.keyboard.down(key);
  try {
    await page.waitForTimeout(ms);
  } finally {
    await page.keyboard.up(key);
  }
}
async function walkTo(target) {
  for (let attempt = 0; attempt < 55; attempt++) {
    const game = (await read()).game;
    if (game.phase === "won") return;
    assert.equal(game.phase, "playing", "Practice route remains alive");
    const dx = target.x - game.player.x,
      dz = target.z - game.player.z;
    if (Math.hypot(dx, dz) < 0.3) return;
    const horizontal = Math.abs(dx) > Math.abs(dz),
      delta = horizontal ? dx : dz;
    await hold(
      horizontal ? (delta > 0 ? "KeyD" : "KeyA") : delta > 0 ? "KeyS" : "KeyW",
      Math.max(35, Math.min(350, (Math.abs(delta) / 4.3) * 900)),
    );
  }
  throw new Error(`Practice route did not reach ${JSON.stringify(target)}`);
}
async function shot(name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
}
async function close() {
  await page.keyboard.press("Escape");
  await page.getByTestId("sample-feature-panel").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".game-surface"),
  );
}
const panel = () => page.getByTestId("sample-feature-panel");
async function locale(name) {
  await panel()
    .getByRole("group", { name: "界面语言 / Interface language" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function openAgent() {
  await page
    .locator(".world-labels")
    .getByRole("button", { name: "Moss · DEMO", exact: true })
    .click();
}
try {
  await page.goto(url);
  await page.waitForFunction(
    () => !!window.__DEVUNGEON__?.snapshot() && !!window.__DEVUNGEON_FEATURE__,
  );
  check(
    "fresh visit defaults to Chinese and the art sample",
    (await page.locator("html").getAttribute("lang")) === "zh-CN" &&
      (await read()).forge.selected === "sample",
  );
  check(
    "one clear entry and no expanded work dashboard",
    (await page.locator(".start").count()) === 1 &&
      (await page.locator(".journal").count()) === 0 &&
      (await page.locator(".forge-toolbar[open]").count()) === 0,
  );
  check(
    "sample title fits a readable product scale",
    (await page
      .locator("h1")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) <= 36,
  );
  await shot("entry-zh");
  await page.locator(".start").click();
  await page.waitForTimeout(1200);
  const initial = await read();
  check(
    "one click starts actual gameplay",
    initial.game.phase === "playing" &&
      initial.scene.worldId.includes("first-play"),
  );
  check(
    "three named objects and explicit DEMO guide remain in the world",
    (await page.locator(".world-labels button").count()) === 5 &&
      (await page
        .locator(".world-labels")
        .innerText()
        .then((text) => text.includes("DEMO"))),
  );
  await hold("a", 260);
  await hold("j", 220);
  await page.keyboard.press("Space");
  await page.waitForTimeout(320);
  check(
    "real movement, attack and dodge inputs change the game",
    (await read()).game.stats.attacks > 0 &&
      (await read()).game.stats.dodges > 0 &&
      (await read()).game.player.x < initial.game.player.x - 0.3,
    (await read()).game,
  );
  await page
    .getByRole("button", { name: "操作指南与设置", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".game-surface"),
  );
  const beforeResume = (await read()).game;
  await hold("d", 220);
  check(
    "one Escape closes help and immediately restores movement",
    (await read()).game.player.x > beforeResume.player.x + 0.3 &&
      (await page.locator(".pause-banner").count()) === 0,
  );
  await page.getByRole("button", { name: "打开房间地图", exact: true }).click();
  await page.keyboard.press("Escape");
  check(
    "one Escape closes the map without leaving a hidden pause",
    (await page.locator(".modal-backdrop").count()) === 0 &&
      (await page.locator(".pause-banner").count()) === 0,
  );
  await page.keyboard.press("Escape");
  await page.locator(".pause-banner").waitFor();
  await page
    .getByRole("button", { name: "操作指南与设置", exact: true })
    .click();
  await page.keyboard.press("Escape");
  check(
    "closing settings preserves an explicit visible pause",
    (await page.locator(".pause-banner").count()) === 1,
  );
  await page.locator(".pause-banner button").click();
  await page.locator(".feature-objective button").click();
  check(
    "feature purpose, implemented and missing work are one click away",
    (await panel().innerText()).includes("公开项目观测") &&
      (await panel().innerText()).includes("已实现") &&
      (await panel().innerText()).includes("尚缺什么"),
  );
  const paused = (await read()).game;
  await page.getByTestId("sample-observe-public").click();
  await page.waitForFunction(
    () => !!window.__DEVUNGEON_FEATURE__?.snapshot().receipt,
  );
  const observed = await read();
  check(
    "real public bridge observation reaches the feature desk",
    observed.feature.receipt.snapshot.project.id ===
      "github:orionaster/devungeon" &&
      !observed.feature.receipt.snapshot.project.source.is_demo &&
      observed.feature.receipt.item_count > 0,
    {
      mode: observed.feature.receipt.mode,
      revision: observed.feature.receipt.revision,
      items: observed.feature.receipt.item_count,
    },
  );
  check(
    "closed issues and local reads never grant project acceptance",
    observed.feature.receipt.snapshot.rooms.every(
      (room) => room.status !== "accepted",
    ) && observed.scene.rooms.filter((room) => !room.enterable).length === 1,
  );
  await page.locator(".sample-receipt summary").click();
  await shot("feature-live-zh");
  await locale("English");
  check(
    "locale preserves the paused game and original observation",
    same((await read()).game, paused) &&
      same((await read()).feature.receipt, observed.feature.receipt),
  );
  await shot("feature-live-en");
  await locale("中文");
  await close();
  check(
    "one Escape leaves the feature panel and restores focus",
    (await page.locator(".pause-banner").count()) === 0,
  );
  await openAgent();
  await page.getByTestId("sample-demo-scan").click();
  const scan = (await read()).feature.actions.at(-1);
  check(
    "guide scan is an explicit bounded DEMO task",
    scan.kind === "scan" &&
      scan.actor_kind === "demo-agent" &&
      scan.is_demo &&
      scan.station_id === "source-desk" &&
      scan.phase === "running",
  );
  await close();
  await hold("a", 160);
  await shot("demo-scan");
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON_FEATURE__?.snapshot().actions.at(-1)?.phase ===
      "completed",
  );
  await openAgent();
  await page.getByTestId("sample-demo-test").click();
  const test = (await read()).feature.actions.at(-1);
  check(
    "bench work has a different typed task and station",
    test.kind === "test" &&
      test.station_id === "test-bench" &&
      test.task_id !== scan.task_id &&
      test.mode === "DEMO",
  );
  await close();
  await shot("demo-test");
  await page.keyboard.press("p");
  const pausedDuringTask = (await read()).game;
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON_FEATURE__?.snapshot().actions.at(-1)?.phase ===
      "completed",
  );
  check(
    "task finishes while the game remains paused",
    same((await read()).game, pausedDuringTask),
  );
  await page.locator(".pause-banner button").click();
  await openAgent();
  await panel().getByText("查看上次演示记录", { exact: true }).first().click();
  await page.getByTestId("sample-demo-replay").click();
  check(
    "replay stays historical and never becomes running work",
    (await read()).feature.actions.at(-1).mode === "REPLAY" &&
      (await read()).feature.actions.at(-1).phase === "completed",
  );
  await close();
  const focusBefore = await page.evaluate(() => ({
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }));
  // Minimize the actual Chrome window through its window API. Merely selecting
  // another CDP target can leave both pages visible on this Windows setup.
  const windowSession = await context.newCDPSession(page);
  const { windowId } = await windowSession.send("Browser.getWindowForTarget");
  await windowSession.send("Browser.setWindowBounds", {
    windowId,
    bounds: { windowState: "minimized" },
  });
  await page.waitForTimeout(250);
  const focusAway = await page.evaluate(() => ({
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }));
  await windowSession.send("Browser.setWindowBounds", {
    windowId,
    bounds: { windowState: "normal" },
  });
  await page.bringToFront();
  report.tabFocus = { before: focusBefore, away: focusAway };
  if (
    focusAway.visibility === "hidden" ||
    (focusBefore.focused && !focusAway.focused)
  ) {
    await page.locator(".pause-banner").waitFor();
    check(
      "minimizing the actual browser produces an explicit resumable pause",
      (await page.locator(".pause-banner").count()) === 1,
    );
    await page.locator(".pause-banner button").click();
  } else
    report.limits.push(
      "Browser target activation did not emit a real blur/hidden transition; automatic tab-loss pause was not exercised. No synthetic visibility event was injected.",
    );
  await page.locator(".game-surface").focus();
  // Opt into the practice corner through actual keyboard movement and combat.
  await page.keyboard.down("j");
  try {
    await walkTo({ x: 5, z: 3.8 });
    await walkTo({ x: 5, z: 0 });
    await page.waitForFunction(
      () => window.__DEVUNGEON__?.snapshot()?.phase === "won",
      undefined,
      { timeout: 20000 },
    );
  } finally {
    await page.keyboard.up("j");
  }
  check(
    "sample combat defeats real enemies",
    (await read()).game.kills === 2 &&
      (await read()).game.stats.damageDealt > 0,
  );
  await shot("combat-victory");
  const receipt = (await read()).feature.receipt,
    ledger = (await read()).feature.actions;
  await page
    .getByRole("button", { name: /再来一场冒险|Another adventure/ })
    .click();
  await page.waitForFunction(
    () =>
      window.__DEVUNGEON__?.snapshot()?.phase === "playing" &&
      window.__DEVUNGEON__?.snapshot()?.kills === 0,
  );
  check(
    "restarting combat preserves feature evidence and Agent history",
    same((await read()).feature.receipt, receipt) &&
      same((await read()).feature.actions, ledger),
  );
  await shot("room-zh");
  const denied = await page.request.post(
    new URL("/scout-read/v1/commands", url).href,
    { data: {} },
  );
  check(
    "sample has no external command or permission bypass",
    denied.status() === 405,
  );
  check(
    "no uncaught browser errors",
    report.errors.length === 0,
    report.errors,
  );
  report.metrics = (await read()).metrics;
  report.final = await read();
  report.pass = true;
} catch (error) {
  report.observationAtFailure = await read().catch(() => null);
  report.pass = false;
  report.failure = error.stack;
  process.exitCode = 1;
  await shot("failure").catch(() => {});
  console.error(error.stack);
} finally {
  await context.tracing.stop({ path: join(output, "trace.zip") });
  const video = page.video();
  await context.close();
  if (video) {
    await rename(await video.path(), join(output, "first-play.webm"));
    report.video = "first-play.webm";
  }
  report.finished_at = new Date().toISOString();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}

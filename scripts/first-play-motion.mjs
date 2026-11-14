/** Same real-input route before/after; no simulation, source or camera setters. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
const output = resolve(
  process.env.ROUND2_OUTPUT ?? "output/playwright/firstplay-round2/motion",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.HEADLESS === "1",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  recordVideo: { dir: output, size: { width: 1440, height: 960 } },
});
const page = await context.newPage();
const report = {
  started_at: new Date().toISOString(),
  url: process.env.ROUND2_URL ?? "http://127.0.0.1:5194",
  browser: browser.version(),
  platform: process.platform,
  viewport: { width: 1440, height: 960 },
  duration_target_ms: Number(process.env.ROUND2_DURATION ?? 120000),
  cpu_throttle: Number(process.env.ROUND2_CPU ?? 1),
  phases: [],
  errors: [],
  frames: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
const read = () =>
  page.evaluate(() => ({
    game: window.__DEVUNGEON__.snapshot(),
    camera: window.__DEVUNGEON__.camera(),
    metrics: window.__DEVUNGEON__.metrics(),
    presentation: window.__DEVUNGEON__.presentation(),
  }));
async function hold(codes, ms) {
  for (const code of codes) await page.keyboard.down(code);
  try {
    await page.waitForTimeout(ms);
  } finally {
    for (const code of codes) await page.keyboard.up(code);
  }
}
async function move(target, diagonal = false) {
  for (let n = 0; n < 55; n++) {
    const { game, camera } = await read();
    if (game.phase !== "playing")
      throw Error(`Motion area lost its safe state: ${game.phase}`);
    const wx = target.x - game.player.x,
      wz = target.z - game.player.z;
    if (Math.hypot(wx, wz) < 0.25) return;
    const a = (camera.heading * Math.PI) / 2,
      x = wx * Math.cos(a) - wz * Math.sin(a),
      z = wx * Math.sin(a) + wz * Math.cos(a);
    const codes =
      diagonal && Math.abs(x) > 0.25 && Math.abs(z) > 0.25
        ? [x > 0 ? "KeyD" : "KeyA", z > 0 ? "KeyS" : "KeyW"]
        : [
            Math.abs(x) > Math.abs(z)
              ? x > 0
                ? "KeyD"
                : "KeyA"
              : z > 0
                ? "KeyS"
                : "KeyW",
          ];
    await hold(
      codes,
      Math.max(
        35,
        Math.min(250, (Math.max(Math.abs(x), Math.abs(z)) / 4.3) * 800),
      ),
    );
  }
  throw Error(`Route stuck ${JSON.stringify(target)}`);
}
try {
  await page.goto(report.url);
  await page.locator(".start").click();
  await page.locator(".game-surface").focus();
  await page.waitForTimeout(800);
  const cdp = await context.newCDPSession(page);
  if (report.cpu_throttle > 1)
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: report.cpu_throttle,
    });
  await page.screenshot({ path: join(output, "start.png") });
  const start = Date.now();
  let cycle = 0;
  while (Date.now() - start < report.duration_target_ms) {
    await move({ x: -5, z: 3 });
    await page.waitForTimeout(180);
    await move({ x: -5, z: 0 });
    await move({ x: -2, z: 3 }, true);
    await hold(["KeyA"], 220);
    await hold(["KeyD"], 220);
    await hold(["KeyW"], 220);
    await hold(["KeyS"], 220);
    await hold(["KeyJ"], 240);
    await page.waitForTimeout(120);
    await hold(["KeyA"], 100);
    await page.keyboard.down("KeyA");
    await page.keyboard.press("Space");
    await page.waitForTimeout(230);
    await page.keyboard.up("KeyA");
    await move({ x: -4, z: 2 });
    await page.keyboard.press("KeyR");
    await page.waitForTimeout(500);
    report.phases.push({
      cycle,
      elapsed_ms: Date.now() - start,
      ...(await read()),
    });
    if (cycle % 2 === 0)
      await page.screenshot({ path: join(output, `turn-${cycle}.png`) });
    console.log(
      `Motion ${++cycle}: ${Math.round((Date.now() - start) / 1000)}s`,
    );
  }
  report.elapsed_ms = Date.now() - start;
  report.final = await read();
  assert.ok(
    report.elapsed_ms >= report.duration_target_ms,
    "complete continuous duration",
  );
  assert.ok(
    report.final.game.stats.attacks > 0 && report.final.game.stats.dodges > 0,
    "actual attack and dodge inputs registered",
  );
  assert.equal(
    new Set(report.phases.map((p) => p.camera.heading)).size,
    4,
    "all four camera headings",
  );
  assert.equal(report.errors.length, 0, "no uncaught browser errors");
  report.pass = true;
  await page.screenshot({ path: join(output, "end.png") });
} catch (error) {
  report.pass = false;
  report.failure = error.stack;
  process.exitCode = 1;
  await page.screenshot({ path: join(output, "failure.png") }).catch(() => {});
} finally {
  const video = page.video();
  await context.close();
  await rename(await video.path(), join(output, "motion.webm"));
  report.finished_at = new Date().toISOString();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}

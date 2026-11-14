/** Real headed Chromium input and read-only camera measurements. No game setters. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";

const output = resolve(
  process.env.FIRST_PLAY_RENDER_OUTPUT ?? "output/playwright/first-play-render",
);
const url = process.env.FIRST_PLAY_URL ?? "http://127.0.0.1:5193";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
  headless: process.env.HEADLESS === "1",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 1440, height: 960 } },
});
await context.tracing.start({ screenshots: false, snapshots: true });
const page = await context.newPage();
const report = {
  observed_at: new Date().toISOString(),
  url,
  platform: process.platform,
  node: process.version,
  browser: browser.version(),
  viewport: { width: 1440, height: 960 },
  dpr: 1,
  checks: [],
  headings: [],
  limits: [
    "Trusted automated input on Windows Chromium; independent human visual approval remains required.",
    "Camera orientation is measured from the actual rendered camera; pixel polish is reviewed from screenshots/video.",
  ],
};
const read = () =>
  page.evaluate(() => ({
    game: window.__DEVUNGEON__?.snapshot(),
    control: window.__DEVUNGEON__?.camera(),
    presentation: window.__DEVUNGEON__?.presentation(),
    metrics: window.__DEVUNGEON__?.metrics(),
  }));
const check = (name, ok, detail) => {
  report.checks.push({ name, pass: !!ok, detail });
  assert.ok(ok, name);
};
async function hold(key, ms) {
  await page.keyboard.down(key);
  try {
    await page.waitForTimeout(ms);
  } finally {
    await page.keyboard.up(key);
  }
}
try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__DEVUNGEON__?.snapshot());
  await page.locator(".start").click();
  await page.waitForFunction(
    () => window.__DEVUNGEON__?.snapshot()?.phase === "playing",
  );
  await page.locator(".game-surface").focus();
  await page.waitForTimeout(1400);
  const initial = await read();
  check(
    "sample enters follow camera through visible Start",
    initial.control.mode === "follow",
    initial.control,
  );
  await page.screenshot({ path: join(output, "spawn.png") });
  // Collect every animation frame while real movement, attack and dodge are pressed.
  const collect = page.evaluate(
    () =>
      new Promise((done) => {
        const result = [],
          until = performance.now() + 2400;
        const tick = () => {
          const p = window.__DEVUNGEON__?.presentation();
          if (p) result.push({ at: performance.now(), ...p });
          if (performance.now() >= until) done(result);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.down("j");
  await hold("a", 550);
  await hold("w", 300);
  await page.keyboard.press("Space");
  await hold("s", 400);
  await hold("a", 450);
  await page.keyboard.up("j");
  const samples = await collect;
  const baseline = samples[0].rotation;
  const maxQuaternionChange = Math.max(
    ...samples.map((p) =>
      Math.hypot(...p.rotation.map((v, i) => v - baseline[i])),
    ),
  );
  const offsets = samples.map((p) => p.camera.map((v, i) => v - p.focus[i]));
  const maxOffsetChange = Math.max(
    ...offsets.map((p) => Math.hypot(...p.map((v, i) => v - offsets[0][i]))),
  );
  check(
    "moving/attacking/dodging never tilts follow camera",
    maxQuaternionChange < 1e-10,
    { samples: samples.length, maxQuaternionChange },
  );
  check(
    "camera and focus use exactly the same translating anchor",
    maxOffsetChange < 1e-10,
    { maxOffsetChange },
  );
  const action = await read();
  check(
    "input exercised actual attacks and dodge",
    action.game.stats.attacks > 0 && action.game.stats.dodges > 0,
    action.game.stats,
  );
  // Main sample west boundary has no doorway; walk/dodge into it at every heading.
  const westKey = ["a", "w", "d", "s"];
  for (let i = 0; i < 4; i++) {
    const before = await read();
    if (before.control.heading !== i) {
      while ((await read()).control.heading !== i)
        await page.keyboard.press("r");
    }
    await page.waitForTimeout(1400);
    await hold(westKey[i], 1700);
    await page.keyboard.down(westKey[i]);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.up(westKey[i]);
    await page.waitForTimeout(180);
    const state = await read();
    check(
      `west wall blocks walking and dodge at ${i * 90} degrees`,
      state.game.player.x > -6.75 && state.game.player.x < -6.3,
      {
        heading: state.control.heading,
        player: state.game.player,
        blockedMoves: state.game.stats.blockedMoves,
      },
    );
    report.headings.push({ degrees: i * 90, state });
    await page.screenshot({ path: join(output, `west-wall-${i * 90}.png`) });
  }
  while ((await read()).control.heading !== 0) await page.keyboard.press("r");
  await page.waitForTimeout(1400);
  await page.keyboard.down("j");
  // A dodge queued just before reversing direction can legitimately end at
  // either side of the sample. Navigate to the corridor's actual z coordinate;
  // do not assume a wall-clock input sequence ended on its centerline.
  for (let i = 0; i < 35; i++) {
    const z = (await read()).game.player.z;
    if (Math.abs(z) < 0.2) break;
    await hold(
      z > 0 ? "w" : "s",
      Math.max(30, Math.min(350, (Math.abs(z) / 4.3) * 900)),
    );
  }
  await hold("d", 3900);
  await page.waitForTimeout(1000);
  await page.keyboard.up("j");
  const combat = await read();
  check(
    "real corridor traversal and combat reach the sealed annex",
    combat.game.player.x > 7.3 &&
      combat.game.player.x < 7.75 &&
      combat.game.kills >= 1 &&
      combat.game.stats.damageDealt >= 55,
    {
      player: combat.game.player,
      kills: combat.game.kills,
      stats: combat.game.stats,
    },
  );
  const eastKey = ["d", "s", "a", "w"];
  for (let i = 0; i < 4; i++) {
    while ((await read()).control.heading !== i) await page.keyboard.press("r");
    await page.waitForTimeout(1400);
    await page.keyboard.down(eastKey[i]);
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up(eastKey[i]);
    const atGate = await read();
    check(
      `sealed corridor blocks dodge at ${i * 90} degrees`,
      atGate.game.player.x < 7.75 && atGate.game.player.x > 7.3,
      {
        player: atGate.game.player,
        access: await page.evaluate(() => window.__DEVUNGEON__?.access()),
      },
    );
    await page.screenshot({
      path: join(output, `corridor-gate-${i * 90}.png`),
    });
  }
  // Fresh sessions use the visible entry; no teleport or gameplay setter.
  for (const object of ["desk", "agent"]) {
    await page.reload();
    await page.waitForFunction(() => !!window.__DEVUNGEON__?.snapshot());
    await page.locator(".start").click();
    await page.locator(".game-surface").focus();
    if (object === "desk") await hold("a", 465);
    await hold("w", 1700);
    await page.keyboard.down("w");
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.up("w");
    const blocked = await read();
    const scene = await page.evaluate(() => window.__DEVUNGEON__?.scene());
    const guide = scene.agents.find((a) => a.agent_id === "demo:sample-scout");
    const radius = guide?.clearanceRadius ?? 0.42;
    const expected =
      object === "desk" ? -1.205 : guide.z + radius + 0.28 + 0.015;
    const separation =
      object === "agent"
        ? Math.hypot(
            blocked.game.player.x - guide.x,
            blocked.game.player.z - guide.z,
          )
        : undefined;
    check(
      `sample ${object} footprint blocks walking and dodge`,
      Math.abs(blocked.game.player.z - expected) < 0.08 &&
        (separation === undefined || separation >= radius + 0.28),
      {
        player: blocked.game.player,
        stats: blocked.game.stats,
        expectedZ: expected,
        clearanceRadius: radius,
        centerSeparation: separation,
      },
    );
    await page.screenshot({ path: join(output, `footprint-${object}.png`) });
  }
  report.metrics = (await read()).metrics;
  report.camera_samples = samples;
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await page.screenshot({ path: join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(output, "trace.zip") });
  const video = page.video();
  await context.close();
  if (video) report.video = await video.path();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(
  `PASS ${report.checks.length} actual render/input checks; evidence ${output}`,
);

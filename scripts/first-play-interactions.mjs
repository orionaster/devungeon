/** Actual pointer/keyboard inputs. Camera/simulation ports are read-only. */
import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

const output = resolve(
  process.env.FIRST_PLAY_OUTPUT ?? "output/playwright/firstplay-interactions",
);
const url = process.env.FIRST_PLAY_URL ?? "http://127.0.0.1:5194";
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
const page = await context.newPage();
const report = {
  started_at: new Date().toISOString(),
  browser: browser.version(),
  platform: process.platform,
  url,
  checks: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
function check(name, ok, detail) {
  report.checks.push({ name, pass: !!ok, detail });
  assert.ok(ok, name);
  console.log(`PASS ${name}`);
}
const read = () =>
  page.evaluate(() => ({
    game: window.__DEVUNGEON__.snapshot(),
    camera: window.__DEVUNGEON__.camera(),
    presentation: window.__DEVUNGEON__.presentation(),
    feature: window.__DEVUNGEON_FEATURE__.snapshot(),
  }));
const targets = [
  { id: "source-desk", x: -3, z: -2, y: 1.15, approach: { x: -3, z: -0.8 } },
  {
    id: "demo:sample-scout",
    x: -1,
    z: -2,
    y: 2.2,
    approach: { x: -1, z: -0.9 },
  },
  { id: "test-bench", x: 3, z: 2, y: 1.85, approach: { x: 3, z: 3.2 } },
  { id: "evidence-cabinet", x: 3, z: -3, y: 1.85, approach: { x: 3, z: -1.8 } },
  {
    id: "game-only:future-alcove",
    x: 8,
    z: 0,
    y: 2.1,
    approach: { x: 7.4, z: 0 },
  },
];
async function hold(key, ms) {
  await page.keyboard.down(key);
  try {
    await page.waitForTimeout(ms);
  } finally {
    await page.keyboard.up(key);
  }
}
async function walk(target) {
  for (let n = 0; n < 70; n++) {
    const { game, camera } = await read();
    const dx = target.x - game.player.x,
      dz = target.z - game.player.z;
    if (Math.hypot(dx, dz) < 0.24) return;
    const a = (camera.heading * Math.PI) / 2,
      x = dx * Math.cos(a) - dz * Math.sin(a),
      z = dx * Math.sin(a) + dz * Math.cos(a);
    await hold(
      Math.abs(x) > Math.abs(z)
        ? x > 0
          ? "KeyD"
          : "KeyA"
        : z > 0
          ? "KeyS"
          : "KeyW",
      Math.max(
        35,
        Math.min(220, (Math.max(Math.abs(x), Math.abs(z)) / 4.3) * 800),
      ),
    );
  }
  throw Error(`Route blocked ${JSON.stringify(target)}`);
}
async function close() {
  await page.keyboard.press("Escape");
  await page
    .locator(".inspector, [data-testid='sample-feature-panel']")
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".game-surface"),
  );
  assert.equal(await page.locator(".pause-banner").count(), 0);
}
async function selected(id) {
  if (id === "game-only:future-alcove")
    await page.locator(".inspector").waitFor();
  else {
    await page.getByTestId("sample-feature-panel").waitFor();
    assert.ok(
      (await page.getByTestId("sample-feature-panel").innerText()).length > 100,
    );
    const names = {
      "source-desk": /项目地图桌|Project map desk/,
      "demo:sample-scout": /Moss/,
      "test-bench": /Agent 检验台|Agent test bench/,
      "evidence-cabinet": /来源档案柜|Source archive/,
    };
    assert.match(
      await page.locator("#sample-feature-title").innerText(),
      names[id],
    );
  }
}
try {
  await page.goto(url);
  await page.locator(".start").click();
  await page.waitForTimeout(1200);
  check(
    "no floating HTML text layer remains",
    (await page.locator(".world-labels").count()) === 0,
  );
  // Fixed-screen prompt must remain still while the scene/camera actually move.
  await walk({ x: -3, z: -0.8 });
  const prompt = page.getByTestId("interaction-prompt"),
    boxes = [];
  for (const key of ["KeyA", "KeyD", "KeyS", "KeyW"]) {
    boxes.push(await prompt.boundingBox());
    await hold(key, 130);
  }
  check(
    "nearby interaction prompt stays at a fixed screen position",
    boxes.every(
      (b) =>
        b &&
        Math.abs(b.x - boxes[0].x) < 0.1 &&
        Math.abs(b.y - boxes[0].y) < 0.1,
    ),
    boxes,
  );
  await prompt.click();
  await selected("source-desk");
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const panelBefore = await read();
  await page
    .getByTestId("sample-feature-panel")
    .getByRole("button", { name: "English", exact: true })
    .click();
  const panelAfter = await read();
  report.locale = { before: panelBefore, after: panelAfter };
  // The independent work clock ticks even while gameplay is paused. Compare
  // every fact/action/receipt, excluding only its expected clock heartbeat.
  const featureFacts = ({ now, ...facts }) => facts;
  check(
    "locale switch preserves paused gameplay and source/Agent state",
    JSON.stringify(panelBefore.game) === JSON.stringify(panelAfter.game) &&
      JSON.stringify(featureFacts(panelBefore.feature)) ===
        JSON.stringify(featureFacts(panelAfter.feature)),
  );
  check(
    "details remain in a fixed readable English panel",
    (await page.locator("html").getAttribute("lang")) === "en-US" &&
      (await page.getByTestId("sample-feature-panel").innerText()).includes(
        "Implemented",
      ),
  );
  await page.waitForTimeout(1100);
  const ticked = await read();
  report.workHeartbeat = ticked;
  check(
    "independent work clock advances without changing project facts or paused gameplay",
    ticked.feature.now > panelAfter.feature.now &&
      JSON.stringify(featureFacts(ticked.feature)) ===
        JSON.stringify(featureFacts(panelAfter.feature)) &&
      JSON.stringify(ticked.game) === JSON.stringify(panelAfter.game),
  );
  await page.screenshot({ path: join(output, "fixed-panel-en.png") });
  await close();
  // Native 3D symbol picking, using the observed rendered camera only.
  for (const target of targets) {
    const { presentation, camera } = await read(),
      bounds = await page.locator("canvas").boundingBox();
    const cam = new OrthographicCamera(
      -bounds.width / 2,
      bounds.width / 2,
      bounds.height / 2,
      -bounds.height / 2,
      0.1,
      150,
    );
    cam.position.fromArray(presentation.camera);
    cam.quaternion.fromArray(presentation.rotation);
    cam.zoom = camera.zoom;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const p = new Vector3(target.x, target.y, target.z).project(cam);
    await page.mouse.click(
      bounds.x + ((p.x + 1) * bounds.width) / 2,
      bounds.y + ((1 - p.y) * bounds.height) / 2,
    );
    await selected(target.id);
    check(`pointer opens ${target.id}`, true);
    await close();
    // Return from sealed-room preview to follow through the existing camera control.
  }
  // The same five targets are named in both languages and reachable by Tab/Enter.
  for (const language of ["English", "中文"]) {
    await page
      .locator(".topbar")
      .getByRole("button", { name: language, exact: true })
      .click();
    for (const target of targets) {
      await page
        .getByRole("button", { name: /打开房间地图|Open room atlas/ })
        .click();
      const button = page.getByTestId(`interaction-target-${target.id}`);
      check(
        `named fixed map target ${language} ${target.id}`,
        (await button.innerText()).trim().length > 0,
      );
      for (let i = 0; i < 35; i++) {
        if (await button.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      assert.ok(
        await button.evaluate((el) => el === document.activeElement),
        "target reachable by Tab",
      );
      await page.keyboard.press("Enter");
      await selected(target.id);
      await close();
    }
  }
  await page.keyboard.press("KeyC");
  const approaches = [
    { id: "source-desk", x: -3, z: -0.8 },
    { id: "demo:sample-scout", x: -1, z: -0.6 },
    { id: "test-bench", x: 1.2, z: 2 },
    { id: "evidence-cabinet", x: 1.65, z: -3 },
    { id: "game-only:future-alcove", x: 6.4, z: -0.3 },
  ];
  for (const target of approaches) {
    if (target.id.includes("future")) {
      await walk({ x: 1.2, z: -4 });
      await walk({ x: 6, z: -4 });
    }
    await walk(target);
    (report.eApproaches ??= []).push({ target, observed: await read() });
    await page.keyboard.press("KeyE");
    await selected(target.id);
    check(`nearby E opens ${target.id}`, true);
    await close();
  }
  check(
    "sealed annex interaction grants no player access",
    (await read()).game.player.x < 7.6,
  );
  check(
    "one Escape leaves no hidden pause after every interaction",
    (await page.locator(".pause-banner").count()) === 0,
  );
  await page.screenshot({ path: join(output, "quiet-room-zh.png") });
  check("no uncaught browser error", report.errors.length === 0, report.errors);
  report.pass = true;
} catch (e) {
  report.observationAtFailure = await read().catch(() => null);
  report.pass = false;
  report.failure = e.stack;
  process.exitCode = 1;
  await page.screenshot({ path: join(output, "failure.png") }).catch(() => {});
  console.error(e.stack);
} finally {
  const video = page.video();
  await context.close();
  await rename(await video.path(), join(output, "interactions.webm"));
  report.finished_at = new Date().toISOString();
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}

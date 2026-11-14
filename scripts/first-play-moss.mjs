/** Real headed-browser Moss regression. Set FIRST_PLAY_URL / FIRST_PLAY_OUTPUT
 * for another local production server or evidence directory; HEADLESS=1 is
 * optional but owner review used default headed Chrome. Keyboard/click input,
 * read-only diagnostic snapshots, unmodified game/work state and native video. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve(
  process.env.FIRST_PLAY_OUTPUT ??
    "output/playwright/firstplay-round2/moss-after",
);
const url = process.env.FIRST_PLAY_URL ?? "http://127.0.0.1:5194";
const behindOnly = process.env.FIRST_PLAY_MOSS_VANTAGE === "behind-contact";
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
const report = {
  started_at: new Date().toISOString(),
  browser: browser.version(),
  platform: process.platform,
  node: process.version,
  url,
  viewport: { width: 1440, height: 960 },
  dpr: 1,
  evidence: [],
  checks: [],
  errors: [],
  limits: [
    "Actual headed Chromium keyboard/click interaction. Read-only diagnostics; no game/work setters or injected CSS. Independent owner acceptance remains pending.",
  ],
};
page.on("pageerror", (e) => report.errors.push(e.message));
const read = () =>
  page.evaluate(() => ({
    game: window.__DEVUNGEON__.snapshot(),
    camera: window.__DEVUNGEON__.camera(),
    presentation: window.__DEVUNGEON__.presentation(),
    feature: window.__DEVUNGEON_FEATURE__.snapshot(),
  }));
const check = (name, pass, detail) => {
  report.checks.push({ name, pass, ...(detail ? { detail } : {}) });
  assert.ok(pass, name);
  console.log("PASS " + name);
};
async function hold(key, ms) {
  await page.keyboard.down(key);
  try {
    await page.waitForTimeout(ms);
  } finally {
    await page.keyboard.up(key);
  }
}
async function headingZero() {
  for (let i = 0; i < 4 && (await read()).camera.heading !== 0; i++)
    await page.keyboard.press("KeyR");
  await page.waitForTimeout(550);
  assert.equal((await read()).camera.heading, 0);
}
async function idle() {
  await page.waitForFunction(
    () =>
      !window.__DEVUNGEON_FEATURE__
        .snapshot()
        .actions.some(
          (a) => a.actor_kind === "demo-agent" && a.phase === "running",
        ),
  );
}
async function task(kind) {
  await idle();
  if (kind === "idle") return;
  await page.locator(".journal-toggle").click();
  await page.locator(".agent-row").filter({ hasText: "Moss" }).click();
  await page.getByTestId(`sample-demo-${kind}`).click();
  await page.keyboard.press("Escape");
  if (
    (await page.locator(".journal-toggle").getAttribute("aria-expanded")) ===
    "true"
  )
    await page.locator(".journal-toggle").click();
}
async function matrix(vantage) {
  for (const state of ["idle", "scan", "test"]) {
    await headingZero();
    await task(state);
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(500);
      const observed = await read();
      const action = observed.feature.actions.at(-1);
      if (vantage !== "overview") {
        const player = observed.game.player;
        const distance = Math.hypot(player.x + 1, player.z + 2);
        check(
          `${vantage} ${state} ${i * 90} stays at actual contact distance`,
          distance >= 1.18 &&
            distance < 1.35 &&
            (vantage === "front-contact" ? player.z > -2 : player.z < -2),
          { distance, player },
        );
      }
      check(
        `${vantage} ${state} actual camera heading ${i * 90}`,
        observed.camera.heading === i,
        { camera: observed.camera },
      );
      check(
        `${vantage} ${state} heading ${i * 90} pose remains truthful`,
        state === "idle"
          ? !observed.feature.actions.some(
              (a) => a.phase === "running" && a.actor_kind === "demo-agent",
            )
          : action?.kind === state &&
              action?.phase === "running" &&
              action?.mode === "DEMO",
      );
      check(
        `${vantage} ${state} heading ${i * 90} no floating DOM labels`,
        (await page.locator(".world-labels").count()) === 0,
      );
      const filename = `${vantage}-${state}-${i * 90}.png`;
      await page.screenshot({ path: `${output}/${filename}` });
      report.evidence.push({
        vantage,
        state,
        heading: i * 90,
        file: filename,
        ...observed,
      });
      await page.keyboard.press("KeyR");
    }
  }
  await idle();
  await headingZero();
}
async function walkTo(target) {
  for (let n = 0; n < 70; n++) {
    const { game } = await read();
    assert.equal(game.phase, "playing");
    const dx = target.x - game.player.x,
      dz = target.z - game.player.z;
    if (Math.hypot(dx, dz) < 0.18) return;
    const horizontal = Math.abs(dx) > Math.abs(dz);
    const delta = horizontal ? dx : dz;
    await hold(
      horizontal ? (delta > 0 ? "KeyD" : "KeyA") : delta > 0 ? "KeyS" : "KeyW",
      Math.max(30, Math.min(260, (Math.abs(delta) / 4.3) * 900)),
    );
    await page.waitForTimeout(45);
  }
  throw new Error("Unreached route point " + JSON.stringify(target));
}
try {
  await page.goto(report.url);
  await page.locator(".start").click();
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(1000);
  if (!behindOnly) {
    await matrix("overview");
    await hold("KeyW", 1700);
    let observed = await read();
    let distance = Math.hypot(
      observed.game.player.x + 1,
      observed.game.player.z + 2,
    );
    check(
      "front approach stops outside reserved NPC footprint",
      distance >= 1.18 && distance < 1.35,
      { distance, player: observed.game.player },
    );
    const baseline = observed.game.stats.blockedMoves;
    await page.keyboard.down("KeyW");
    await page.keyboard.press("Space");
    await page.waitForTimeout(650);
    await page.keyboard.up("KeyW");
    observed = await read();
    distance = Math.hypot(
      observed.game.player.x + 1,
      observed.game.player.z + 2,
    );
    check(
      "front dodge and walking keep NPC clearance",
      distance >= 1.18 && observed.game.stats.blockedMoves > baseline,
      { distance, blockedMoves: observed.game.stats.blockedMoves },
    );
    await matrix("front-contact");
    await walkTo({ x: 1, z: -0.8 });
  } else {
    await walkTo({ x: 1, z: 3.5 });
  }
  await walkTo({ x: 1, z: -4 });
  await walkTo({ x: -1, z: -4 });
  // Stop as soon as contact is reached. Holding into a circular collider can
  // legitimately slide around its edge; that is not a stationary rear view.
  for (let i = 0; i < 25; i++) {
    const current = (await read()).game.player;
    if (Math.hypot(current.x + 1, current.z + 2) < 1.23) break;
    await hold("KeyS", 30);
    await page.waitForTimeout(35);
  }
  let observed = await read();
  let distance = Math.hypot(
    observed.game.player.x + 1,
    observed.game.player.z + 2,
  );
  check(
    "behind approach stops outside reserved NPC footprint",
    distance >= 1.18 && distance < 1.35,
    { distance, player: observed.game.player },
  );
  await matrix("behind-contact");
  const secondBaseline = (await read()).game.stats.blockedMoves;
  await page.keyboard.down("KeyS");
  await page.keyboard.press("Space");
  const sweep = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(30);
    const player = (await read()).game.player;
    sweep.push({ distance: Math.hypot(player.x + 1, player.z + 2), player });
  }
  await page.keyboard.up("KeyS");
  observed = await read();
  distance = Math.hypot(observed.game.player.x + 1, observed.game.player.z + 2);
  check(
    "behind dodge and walking keep NPC clearance",
    sweep.every((sample) => sample.distance >= 1.18) &&
      observed.game.stats.blockedMoves > secondBaseline,
    { distance, blockedMoves: observed.game.stats.blockedMoves, sweep },
  );
  check(
    "no uncaught browser errors",
    report.errors.length === 0,
    report.errors,
  );
} catch (error) {
  report.failure = String(error);
  await page.screenshot({ path: `${output}/failure.png` });
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  await writeFile(
    `${output}/observations.json`,
    JSON.stringify(report, null, 2),
  );
  await context.tracing.stop({ path: `${output}/trace.zip` });
  const video = page.video();
  await context.close();
  const path = await video.path();
  await rename(path, `${output}/moss-4heading-actions-contact.webm`);
  await browser.close();
  console.log(output);
}

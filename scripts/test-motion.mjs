import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const out = "output/motion";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = () =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
const state = async () => {
  await settle();
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
};
const finish = async () => {
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => a.finish()),
  );
  await settle();
};
const shot = async (name) =>
  page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
async function pausedMove(label, expectedGhosts, name) {
  // Execute within the page so the browser test runner does not wait for animation completion.
  await page.evaluate(
    (label) => document.querySelector(`[aria-label="${label}"]`).click(),
    label,
  );
  await settle();
  assert.equal(
    await page.locator(".tile-motion-ghost").count(),
    expectedGhosts,
  );
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = 210;
    }),
  );
  await settle();
  await shot(name);
  const ghosts = await page.locator(".tile-motion-ghost").evaluateAll((els) =>
    els.map((e) => ({
      inert: e.inert,
      hidden: e.getAttribute("aria-hidden"),
      ids: e.querySelectorAll("[data-tile-id],[data-select-id]").length,
      transform: getComputedStyle(e).transform,
    })),
  );
  assert.ok(
    ghosts.every(
      (g) =>
        g.inert && g.hidden === "true" && g.ids === 0 && g.transform !== "none",
    ),
  );
  await finish();
  assert.equal(await page.locator(".tile-motion-ghost").count(), 0);
}
try {
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  await page.evaluate(() => window.advanceTime(0));
  await pausedMove("Split 想", 2, "board-to-tray");
  let s = await state();
  assert.equal(s.tray.length, 10);
  await pausedMove("Split 相", 2, "tray-unfold");
  s = await state();
  assert.deepEqual(
    s.tray.slice(-3).map((t) => t.char),
    ["木", "目", "心"],
  );
  assert.equal(s.tray.length, 11);
  await page.getByRole("button", { name: "↶ Undo", exact: true }).click();
  await finish();
  s = await state();
  for (const t of s.tray.slice(-2))
    await page.locator(`[data-select-id="${t.id}"]`).click();
  assert.equal((await state()).tray.length, 10); // Selecting 相 keeps it intact.
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent.trim().startsWith("Combine"))
      .click(),
  );
  await settle();
  assert.equal(await page.locator(".tile-motion-ghost").count(), 2);
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = 210;
    }),
  );
  await shot("tray-to-board");
  await finish();
  assert.equal((await state()).board.at(-1).char, "想");
  await page.getByLabel("Add a character", { exact: true }).fill("森");
  await page
    .getByRole("button", { name: "Add character", exact: true })
    .click();
  await finish();
  await pausedMove("Split 森", 3, "three-piece-unfold");
  s = await state();
  const three = s.tray.slice(-3);
  assert.deepEqual(
    three.map((t) => t.char),
    ["木", "木", "木"],
  );
  for (const t of three)
    await page.locator(`[data-select-id="${t.id}"]`).click();
  assert.equal((await state()).selected.length, 3);
  await shot("three-selected");
  await page.getByRole("button", { name: /^Combine/ }).click();
  await finish();
  s = await state();
  assert.equal(s.board.at(-1).char, "森");
  assert.equal(s.tray.length, 8);
  // Cancel a flight with scrolling, then with reset. Real tiles must remain visible and unique.
  await page.evaluate(() =>
    document.querySelector('[aria-label="Split 森"]').click(),
  );
  await settle();
  assert.equal(await page.locator(".tile-motion-ghost").count(), 3);
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  assert.equal(await page.locator(".tile-motion-ghost").count(), 0);
  await page.evaluate(() =>
    document.querySelector('[aria-label="Split 想"]').click(),
  );
  await settle();
  await page
    .getByRole("button", { name: "↻ Reset table", exact: true })
    .click();
  assert.equal(await page.locator(".tile-motion-ghost").count(), 0);
  assert.equal((await state()).tray.length, 8);
  assert.ok(
    await page
      .locator("[data-tile-id]")
      .evaluateAll((els) =>
        els.every((e) => getComputedStyle(e).opacity === "1"),
      ),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Split 想", exact: true }).click();
  await settle();
  assert.equal(await page.locator(".tile-motion-ghost").count(), 0);
  assert.equal((await state()).tray.length, 10);
  await page.getByRole("button", { name: "Split 相", exact: true }).click();
  assert.equal((await state()).tray.length, 11);
  await page.getByLabel("Tile set", { exact: true }).selectOption("3");
  assert.deepEqual(
    (await state()).board.map((t) => t.char),
    ["森", "品", "晶"],
  );
  await shot("three-of-a-kind");
  // The lab exposes both directions of the reviewed recipe.
  await page.goto(`${base}/inspector`);
  await page.getByLabel("Character", { exact: true }).fill("森");
  assert.equal(
    await page.locator(".lab-card").first().locator(".lab-tile").count(),
    3,
  );
  await page.getByLabel("Component A", { exact: true }).fill("木");
  await page.getByLabel("Component B", { exact: true }).fill("木");
  await page.getByLabel("Component C (optional)", { exact: true }).fill("木");
  assert.match(await page.locator(".lab-card").nth(1).innerText(), /森/);
  await shot("three-piece-lab");
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.goto(base);
  await touch.getByRole("button", { name: "Split 想", exact: true }).tap();
  await touch.getByRole("button", { name: "Select 相", exact: true }).tap();
  assert.equal(await touch.locator('[data-char="相"]').count(), 1);
  await touch.getByRole("button", { name: "Split 相", exact: true }).tap();
  await touch.getByRole("button", { name: "↶ Undo", exact: true }).waitFor();
  await touch.screenshot({
    path: `${out}/tray-unfold-mobile.png`,
    fullPage: true,
  });
  assert.ok(
    await touch.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(
    "Motion and extension browser checks passed: trajectories, inert copies, cleanup, reset, reduced motion, repeated tray unfolding, intact selection, three-piece round trips, inspector, and touch.",
  );
} finally {
  await browser.close();
}

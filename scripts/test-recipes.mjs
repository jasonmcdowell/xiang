import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const recipes = JSON.parse(
  readFileSync("data/decomposition_extensions.json", "utf8"),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1200 },
  reducedMotion: "reduce",
});
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
mkdirSync("output/recipes", { recursive: true });
try {
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  for (const char of Array.from("亲具婴拖沿谷贵轻")) {
    await page
      .getByRole("button", { name: "↻ Reset table", exact: true })
      .click();
    await page.getByLabel("Add a character", { exact: true }).fill(char);
    await page
      .getByRole("button", { name: "Add character", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Split ${char}`, exact: true })
      .click();
    const split = await state();
    const children = split.tray.slice(-3);
    assert.deepEqual(
      children.map((t) => t.char),
      recipes[char].children,
    );
    assert.equal(new Set(children.map((t) => t.id)).size, 3);
    // Reversed physical input order includes mixed triples and duplicated 贝.
    for (const t of [...children].reverse())
      await page.locator(`[data-select-id="${t.id}"]`).click();
    await page.getByRole("button", { name: /^Combine/ }).click();
    const pending = await state();
    if (pending.candidates.length) {
      assert.ok(pending.candidates.includes(char));
      await page
        .locator("dialog[open] .candidate-grid button")
        .filter({ has: page.locator(".hanzi", { hasText: char }) })
        .click();
    }
    const result = await state();
    assert.equal(result.board.at(-1).char, char);
    assert.equal(result.tray.length, 8);
    await page.getByRole("button", { name: "↶ Undo", exact: true }).click();
    assert.deepEqual((await state()).tray.slice(-3), children);
  }
  await page
    .getByLabel("Tile set", { exact: true })
    .selectOption({ label: "Everyday pieces" });
  assert.deepEqual(
    (await state()).board.map((t) => t.char),
    ["亲", "贵", "谷"],
  );
  assert.match((await state()).message, /亲/);
  await page.screenshot({
    path: "output/recipes/everyday-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Split 贵", exact: true }).click();
  assert.deepEqual(
    (await state()).tray.slice(-3).map((t) => t.char),
    ["中", "一", "贝"],
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "output/recipes/everyday-mobile.png",
    fullPage: true,
  });
  await page.goto(`${base}/inspector`);
  await page.getByLabel("Character", { exact: true }).fill("拖");
  assert.equal(
    await page.locator(".lab-card").first().locator(".lab-tile").count(),
    3,
  );
  await page.getByLabel("Component A", { exact: true }).fill("也");
  await page.getByLabel("Component B", { exact: true }).fill("扌");
  await page.getByLabel("Component C (optional)", { exact: true }).fill("亻");
  assert.match(await page.locator(".lab-card").nth(1).innerText(), /拖/);
  assert.deepEqual(errors, []);
  console.log(
    "Eight mixed recipes pass unfold/recombine/undo, duplicate-tile and input-order checks; Everyday pieces, mobile and inspector verified.",
  );
} finally {
  await browser.close();
}

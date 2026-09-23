import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const state = async () => {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
};
const reset = () =>
  page.getByRole("button", { name: "↻ Reset table", exact: true }).click();
const tile = (id) => page.locator(`[data-drag-id="${id}"]`);
async function point(id, grip = false) {
  const box = await (
    grip ? tile(id).locator(".drag-grip") : tile(id)
  ).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function drag(a, b, finish = true) {
  const from = await point(a),
    to = await point(b);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (finish) await page.mouse.up();
}
async function addSplit(char) {
  await page.getByLabel("Add a character", { exact: true }).fill(char);
  await page
    .getByRole("button", { name: "Add character", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Split ${char}`, exact: true })
    .last()
    .click();
  return state();
}
mkdirSync("output/drag", { recursive: true });
try {
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  let s = await state();
  let a = s.tray.find((t) => t.char === "女"),
    b = s.tray.find((t) => t.char === "子");
  await drag(a.id, b.id, false);
  assert.equal(await page.locator(".drop-valid").count(), 1);
  await page.screenshot({ path: "output/drag/mouse.png" });
  await page.mouse.up();
  s = await state();
  assert.ok(s.board.some((t) => t.char === "好"));
  assert.equal(s.tray.length, 6);
  await reset();
  s = await state();
  a = s.tray.find((t) => t.char === "女");
  b = s.tray.find((t) => t.char === "心");
  const before = s.tray;
  await drag(a.id, b.id);
  assert.deepEqual((await state()).tray, before);
  await drag(a.id, b.id, false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual((await state()).tray, before);
  await drag(a.id, b.id, false);
  await page.mouse.move(10, 10);
  await page.mouse.up();
  assert.deepEqual((await state()).tray, before);
  assert.equal(
    await page
      .locator(".drag-ghost,.drag-source,.drop-valid,.drop-invalid")
      .count(),
    0,
  );
  await reset();
  s = await addSplit("森");
  const woods = s.tray.slice(-3);
  for (const t of woods.slice(0, 2))
    await page.locator(`[data-select-id="${t.id}"]`).click();
  await drag(woods[0].id, woods[2].id);
  s = await state();
  if (s.candidates.length)
    await page.getByRole("button", { name: /森/ }).last().click();
  assert.ok((await state()).board.some((t) => t.char === "森"));
  await reset();
  await page.getByRole("button", { name: "Split 想", exact: true }).click();
  s = await state();
  await drag(
    s.tray.find((t) => t.char === "相").id,
    s.tray.find((t) => t.char === "心").id,
  );
  assert.ok((await state()).board.some((t) => t.char === "想"));
  // Native touch sequence exercises the grip's touch-action and pointer capture.
  await page.setViewportSize({ width: 390, height: 844 });
  await reset();
  s = await state();
  a = s.tray.find((t) => t.char === "女");
  b = s.tray.find((t) => t.char === "子");
  await tile(a.id).scrollIntoViewIfNeeded();
  const from = await point(a.id, true),
    to = await point(b.id);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  for (let i = 1; i <= 12; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / 12,
          y: from.y + ((to.y - from.y) * i) / 12,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await state()).board.some((t) => t.char === "好"));
  assert.equal(await page.locator(".drag-ghost").count(), 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "output/drag/touch.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Drag: mouse, touch, selected triple, invalid/outside drop, Escape, click suppression and layout pass.",
  );
} finally {
  await browser.close();
}

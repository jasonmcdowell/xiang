import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const output = "output/browser";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.emulateMedia({ reducedMotion: "reduce" });
const composeIndex = JSON.parse(
  fs.readFileSync("public/data/compose_pairs.json", "utf8"),
);
const decompIndex = JSON.parse(
  fs.readFileSync("public/data/decomp.json", "utf8"),
);
const tripleIndex = new Set(
  Object.values(decompIndex)
    .filter((children) => children.length === 3)
    .map((children) => [...children].sort().join("|")),
);
const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (r.url().includes("/data/")) requests.push(r.url());
});
const settle = async () =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
const state = async () => {
  await settle();
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
};
const click = async (name) => {
  await page.getByRole("button", { name, exact: true }).click();
  await settle();
};
const advance = async (ms) => {
  await page.evaluate((ms) => window.advanceTime(ms), ms);
  await settle();
};
const shot = async (name) => {
  await page.mouse.move(0, 0);
  await settle();
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
};
async function chooseIfNeeded() {
  if ((await state()).candidates.length)
    await page.locator("dialog[open] .candidate-grid button").first().click();
  await settle();
}
function combinableTileIds(tray) {
  const ids = new Set();
  for (let i = 0; i < tray.length; i++) {
    for (let j = i + 1; j < tray.length; j++) {
      if (composeIndex[`${tray[i].char}|${tray[j].char}`]?.length) {
        ids.add(tray[i].id);
        ids.add(tray[j].id);
      }
      for (let k = j + 1; k < tray.length; k++) {
        if (
          tripleIndex.has(
            [tray[i].char, tray[j].char, tray[k].char].sort().join("|"),
          )
        ) {
          ids.add(tray[i].id);
          ids.add(tray[j].id);
          ids.add(tray[k].id);
        }
      }
    }
  }
  return [...ids];
}
function findCombination(tray) {
  for (let i = 0; i < tray.length; i++)
    for (let j = i + 1; j < tray.length; j++)
      if (composeIndex[`${tray[i].char}|${tray[j].char}`]?.length)
        return [tray[i].id, tray[j].id];
  for (let i = 0; i < tray.length; i++)
    for (let j = i + 1; j < tray.length; j++)
      for (let k = j + 1; k < tray.length; k++)
        if (
          tripleIndex.has(
            [tray[i].char, tray[j].char, tray[k].char].sort().join("|"),
          )
        )
          return [tray[i].id, tray[j].id, tray[k].id];
  return [];
}
async function combineHint() {
  await click("✧ Hint");
  const game = await state();
  const expected = combinableTileIds(game.tray).sort((a, b) => a - b);
  assert.deepEqual([...game.hinted].sort((a, b) => a - b), expected);
  assert.deepEqual(game.selected, []);
  assert.equal(await page.locator(".tile.hinted").count(), expected.length);
  const selection = findCombination(game.tray);
  assert.ok(selection.length === 2 || selection.length === 3);
  for (const id of selection)
    await page.locator(`[data-select-id="${id}"]`).click();
  await page.getByRole("button", { name: /^Combine/ }).click();
  await chooseIfNeeded();
  assert.deepEqual((await state()).hinted, []);
}
try {
  await page.goto(base);
  await page.waitForFunction(
    () => typeof window.render_game_to_text === "function",
  );
  await advance(0);
  await shot("explore-desktop");
  let s = await state();
  await click("✧ Hint");
  s = await state();
  const expectedHints = combinableTileIds(s.tray).sort((a, b) => a - b);
  assert.deepEqual([...s.hinted].sort((a, b) => a - b), expectedHints);
  assert.deepEqual(s.selected, [], "hinting does not select a matching pair");
  assert.equal(await page.locator(".tile.hinted").count(), expectedHints.length);
  assert.equal(
    await page.getByRole("button", { name: "✧ Hint", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await shot("hint-highlights");
  await click("✧ Hint");
  assert.deepEqual((await state()).hinted, [], "the hint button clears highlights");
  await click("Split 想");
  s = await state();
  assert.deepEqual(
    s.tray.slice(-2).map((t) => t.char),
    ["相", "心"],
  );
  await page.locator(`[data-select-id="${s.tray.at(-2).id}"]`).click();
  await page.locator(`[data-select-id="${s.tray.at(-1).id}"]`).click();
  await page.getByRole("button", { name: /^Combine/ }).click();
  s = await state();
  assert.equal(s.board.at(-1).char, "想");
  assert.equal(s.tray.length, 8);
  assert.equal(s.discovered.length, 1);
  await shot("first-discovery");
  await click("↶ Undo");
  assert.equal((await state()).tray.length, 10);
  await click("↻ Reset table");
  await click("Select 女");
  await click("Select 心");
  await page.getByRole("button", { name: /^Combine/ }).click();
  s = await state();
  assert.equal(s.tray.length, 8);
  assert.match(s.message, /No match/);
  await page.keyboard.press("Escape");
  assert.equal((await state()).selected.length, 0);
  await page.getByRole("checkbox", { name: "Pinyin" }).uncheck();
  assert.equal(
    await page.locator(".tile-pinyin:not(.hidden-pinyin)").count(),
    0,
  );
  await page.getByRole("checkbox", { name: "Pinyin" }).check();
  await page.getByLabel("Add a character", { exact: true }).fill("杏");
  await click("Add character");
  await click("Split 杏");
  await page.getByLabel("Add a character", { exact: true }).fill("呆");
  await click("Add character");
  await click("Split 呆");
  s = await state();
  const pair = s.tray.slice(-2);
  for (const t of pair)
    await page.locator(`[data-select-id="${t.id}"]`).click();
  await page.getByRole("button", { name: /^Combine/ }).click();
  s = await state();
  assert.ok(s.candidates.length > 1);
  await shot("ambiguity");
  const before = s.tray;
  await page.keyboard.press("Escape");
  assert.deepEqual((await state()).tray, before);
  for (const t of pair)
    await page.locator(`[data-select-id="${t.id}"]`).click();
  await page.getByRole("button", { name: /^Combine/ }).click();
  await chooseIfNeeded();
  assert.equal((await state()).tray.length, before.length - 2);
  await page.getByLabel("Tile set", { exact: true }).selectOption("1");
  assert.equal((await state()).board[0].char, "林");
  await page.getByLabel("Tile set", { exact: true }).selectOption("0");
  // Native keyboard interaction, including tile selection and composition.
  await page.getByRole("button", { name: "Select 女", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Select 子", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal((await state()).selected.length, 2);
  await page.getByRole("button", { name: /^Combine/ }).focus();
  await page.keyboard.press("Enter");
  await chooseIfNeeded();
  assert.ok((await state()).board.some((t) => t.char === "好"));
  await page.getByRole("button", { name: /Timed challenge/ }).click();
  assert.equal((await state()).phase, "ready");
  await shot("challenge-ready");
  await click("Start challenge →");
  await advance(6000);
  s = await state();
  assert.equal(s.remaining, 54000);
  assert.equal(s.tray.length, 9);
  await combineHint();
  s = await state();
  assert.equal(s.score, 2);
  assert.equal(s.remaining, 57000);
  assert.equal(s.tray.length, 7);
  await shot("challenge-playing");
  await click("Pause");
  s = await state();
  await advance(20000);
  assert.equal((await state()).remaining, s.remaining);
  await click("Resume");
  await page.getByRole("button", { name: /How to play/ }).click();
  assert.equal((await state()).phase, "paused");
  await click("Let’s explore →");
  await click("Resume");
  await advance(36000);
  s = await state();
  assert.equal(s.phase, "over");
  assert.equal(s.reason, "overflow");
  assert.equal(s.tray.length, 13);
  await shot("overflow");
  await click("New run →");
  assert.equal((await state()).score, 0);
  await click("Start challenge →");
  // Make space as the tray fills; helpful drips ensure a pair is available.
  for (let i = 0; i < 30 && (await state()).phase === "playing"; i++) {
    s = await state();
    if (s.remaining <= s.dripIn) {
      await advance(s.remaining);
      break;
    }
    if (s.tray.length >= 11) await combineHint();
    await advance(6000);
  }
  s = await state();
  assert.equal(s.reason, "time");
  assert.equal(s.remaining, 0);
  await shot("timeout");
  // All moves use the four already-loaded files; no per-move data requests.
  assert.equal(requests.length, 4);
  await page.reload();
  await page.waitForFunction(() => window.render_game_to_text);
  await page.getByRole("button", { name: /Timed challenge/ }).click();
  assert.equal(
    await page.locator(".challenge-strip strong").nth(2).innerText(),
    "00",
    "the session best resets after reloading without browser storage",
  );
  await page.goto(`${base}/inspector`);
  await page.getByLabel("Character", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".lab-card").first().locator(".lab-tile").count(),
    2,
  );
  await page.getByLabel("Component A", { exact: true }).fill("忄");
  await page.getByLabel("Component B", { exact: true }).fill("相");
  assert.match(await page.locator(".lab-card").nth(1).innerText(), /想/);
  await shot("inspector");
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("explore-mobile");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await click("Split 想");
  await combineHint();
  await shot("mobile-discovery");
  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  // A separate session tests a recoverable data-fetch failure.
  const offline = await browser.newPage();
  let fail = true;
  await offline.route("**/data/decomp.json", (r) =>
    fail ? r.fulfill({ status: 503, body: "Unavailable" }) : r.continue(),
  );
  await offline.goto(base);
  await offline.getByRole("button", { name: "Try again" }).waitFor();
  fail = false;
  await offline.getByRole("button", { name: "Try again" }).click();
  await offline.getByRole("button", { name: "Split 想" }).waitFor();
  await offline.close();
  // Real touch input, live elapsed-time clock, and automatic pause without storage.
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await touch.emulateMedia({ reducedMotion: "reduce" });
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.goto(base);
  await touch.getByRole("button", { name: "Select 女", exact: true }).tap();
  await touch.getByRole("button", { name: "Select 子", exact: true }).tap();
  await touch.getByRole("button", { name: /^Combine/ }).tap();
  await touch.getByRole("button", { name: "Split 好", exact: true }).waitFor();
  await touch.getByRole("button", { name: /Timed challenge/ }).tap();
  await touch
    .getByRole("button", { name: "Start challenge →", exact: true })
    .tap();
  await touch.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).remaining < 59600,
  );
  await touch.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await touch.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).phase === "paused",
  );
  const pausedTime = await touch.evaluate(
    () => JSON.parse(window.render_game_to_text()).remaining,
  );
  await touch.waitForTimeout(300);
  assert.equal(
    await touch.evaluate(
      () => JSON.parse(window.render_game_to_text()).remaining,
    ),
    pausedTime,
  );
  await touch.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  await touch.getByRole("button", { name: "Resume", exact: true }).tap();
  await touch.getByRole("button", { name: "✧ Hint", exact: true }).tap();
  await touch
    .getByRole("button", { name: /^Combine/ })
    .scrollIntoViewIfNeeded();
  assert.ok(
    await touch
      .locator(".challenge-strip")
      .evaluate((e) => e.getBoundingClientRect().top >= 0),
  );
  await touch.screenshot({
    path: `${output}/challenge-mobile.png`,
    fullPage: true,
  });
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: split/recombine, undo, invalid pairs, duplicate identities, chooser cancel/choice, keyboard, pinyin, sets, timed scoring, pause, overflow, timeout, reset, session-only best, inspector, mobile layout, loading recovery, and no per-move requests.",
  );
} finally {
  await browser.close();
}

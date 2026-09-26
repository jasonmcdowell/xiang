import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (milliseconds) =>
  page.evaluate((value) => window.advanceTime(value), milliseconds);

try {
  await page.goto(`${base}/playground`);
  await page.waitForFunction(
    () =>
      window.render_game_to_text &&
      JSON.parse(window.render_game_to_text()).ready,
  );
  await page.getByRole("tab", { name: "Discovery Run" }).click();
  await page.locator("#discovery-capacity").selectOption("9");

  const boardSize = await page.locator("canvas").boundingBox();
  assert.ok(boardSize);
  const startButton = page.getByRole("button", {
    name: "Start Discovery Run",
  });
  await startButton.waitFor();
  // Fix the initial shuffle to 相 so this browser check exercises a known
  // recipe whose 木 and 目 children are both outside the draw collection.
  await page.evaluate(() => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0;
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === "Start Discovery Run",
      );
      button?.click();
    } finally {
      Math.random = originalRandom;
    }
  });
  await page.waitForFunction(() => {
    const run = JSON.parse(window.render_game_to_text()).discoveryRun;
    return run?.phase === "running" && run.delivered === 1;
  });

  let game = await state();
  assert.equal(game.boardPreset, "cells");
  assert.equal(game.discoveryRun.capacity, 9);
  assert.equal(game.discoveryScore, 1);
  assert.equal(game.characters.length, 1);
  const first = game.characters[0];
  const square = Math.min(boardSize.width, boardSize.height);
  const expectedCenter = {
    x: (boardSize.width - square) / 2 + square * 0.06 + square * 0.88 / 6,
    y: (boardSize.height - square) / 2 + square * 0.06 + square * 0.88 / 6,
  };
  assert.ok(
    Math.hypot(
      first.tile.center.x - expectedCenter.x,
      first.tile.center.y - expectedCenter.y,
    ) < 0.01,
    "the first tile is centered in the top-left grid cell",
  );
  await advance(0); // Freeze the live RAF clock for deterministic input checks.

  // Unfolding a draw character records its off-collection children.
  assert.equal(first.char, "相");
  assert.equal(first.decomposable, true, "starter characters have recipes");
  await page.mouse.click(
    boardSize.x + first.tile.center.x,
    boardSize.y + first.tile.center.y,
    { clickCount: 2, delay: 10 },
  );
  await page.waitForFunction(() => {
    const game = JSON.parse(window.render_game_to_text());
    return game.discoveryRun?.discoveries.length >= 2;
  });
  game = await state();
  assert.equal(game.characters.length, 2);
  assert.equal(game.discoveryScore, 3);

  // The run clock pauses on Playground and resumes when the game tab returns.
  const elapsedBeforePause = game.discoveryRun.elapsedMs;
  await page.getByRole("tab", { name: "Playground" }).click();
  await page.getByRole("checkbox", { name: "Reduce motion" }).check();
  await advance(10_000);
  game = await state();
  assert.equal(game.discoveryRun.delivered, 1);
  assert.equal(game.discoveryRun.elapsedMs, elapsedBeforePause);

  await page.getByRole("tab", { name: "Discovery Run" }).click();
  assert.equal((await state()).reducedMotion, true);
  await advance(10_000);
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).discoveryRun?.delivered === 2,
  );

  for (let attempt = 0; attempt < 8; attempt++) {
    game = await state();
    if (game.discoveryRun.phase === "over") break;
    await advance(10_000);
    await page.waitForFunction(() => {
      const run = JSON.parse(window.render_game_to_text()).discoveryRun;
      return run?.phase === "over" || run?.delivered > 2;
    });
  }
  game = await state();
  assert.equal(game.discoveryRun.phase, "over");
  assert.equal(game.characters.length, 9);
  assert.equal(game.discoveryRun.delivered, 8);
  assert.equal(game.discoveryRun.discoveries.length, 2);
  assert.ok(game.discoveryScore >= 10);
  await page.getByRole("status").filter({ hasText: "The board is full." }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Discovery Run passed: cell-centered tile sizing, unique discovery scoring, pause/resume, timed arrivals, and capacity game-over.",
  );
} finally {
  await browser.close();
}

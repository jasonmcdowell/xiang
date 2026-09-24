import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const base = process.env.XIANG_TEST_URL || "http://127.0.0.1:3000";
const output = "output/language";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.goto(base);
  await page.waitForFunction(
    () => typeof window.render_game_to_text === "function",
  );
  const language = page.locator(".language-picker select").first();
  assert.equal(await language.inputValue(), "en");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");

  await language.selectOption("zh-Hant");
  await page.getByRole("heading", { name: "你的漢字區" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hant");
  await page.screenshot({
    path: `${output}/traditional-game.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "拆解 想" }).click();
  await page
    .getByText("想 → 相 + 心。部件已放入字盤。", { exact: true })
    .waitFor();

  await language.selectOption("zh-Hans");
  await page.getByRole("heading", { name: "你的汉字区" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hans");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("xiang-language")),
    "zh-Hans",
  );
  await page.screenshot({
    path: `${output}/simplified-game.png`,
    fullPage: true,
  });

  await page.reload();
  await page.waitForFunction(
    () => typeof window.render_game_to_text === "function",
  );
  assert.equal(
    await page.locator(".language-picker select").first().inputValue(),
    "zh-Hans",
  );
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hans");

  await page.goto(`${base.replace(/\/$/, "")}/playground`);
  await page.waitForFunction(
    () =>
      window.render_game_to_text &&
      JSON.parse(window.render_game_to_text()).ready,
  );
  await page.getByRole("heading", { name: "拉开、摆放、重新组合" }).waitFor();
  await page.getByRole("button", { name: "HSK 1 汉字表" }).waitFor();
  await page.screenshot({
    path: `${output}/simplified-playground.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    await page.evaluate(() => window.innerWidth),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/simplified-playground-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    await page.evaluate(() => window.innerWidth),
  );

  await page.goto(`${base.replace(/\/$/, "")}/inspector`);
  await page.getByRole("heading", { name: "字典实验室。" }).waitFor();
  await page.screenshot({
    path: `${output}/simplified-inspector.png`,
    fullPage: true,
  });

  await page.goto(`${base.replace(/\/$/, "")}/privacy`);
  await page.getByRole("heading", { name: "隐私" }).waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /选择的语言会保存在浏览器本地/,
  );
  assert.deepEqual(errors, []);
  console.log("Language browser checks passed.");
} finally {
  await browser.close();
}

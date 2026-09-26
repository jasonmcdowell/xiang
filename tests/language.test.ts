import test from "node:test";
import assert from "node:assert/strict";
import { translate, translateRuntimeText } from "../src/lib/language";

test("language catalogs keep English as fallback and distinguish both scripts", () => {
  assert.equal(translate("en", "Your character board"), "Your character board");
  assert.equal(translate("zh-Hant", "Your character board"), "你的漢字區");
  assert.equal(translate("zh-Hans", "Your character board"), "你的汉字区");
  assert.equal(translate("zh-Hant", "Blast!"), "炸散字牌！");
  assert.equal(translate("zh-Hans", "Shuffle"), "洗牌");
  assert.equal(translate("zh-Hant", "Keep arranged"), "保持排列");
  assert.equal(translate("zh-Hant", "Traditional tiles"), "繁體字牌");
  assert.equal(translate("zh-Hans", "Simplified tiles"), "简体字牌");
  assert.equal(translate("zh-Hant", "Uncatalogued copy"), "Uncatalogued copy");
});

test("localized strings interpolate counts and characters", () => {
  assert.equal(
    translate("zh-Hans", "{count} characters", { count: 5 }),
    "5 个汉字",
  );
  assert.equal(
    translateRuntimeText(
      "zh-Hant",
      "想 → 相 + 心. The pieces are in your tray.",
    ),
    "想 → 相 + 心。部件已放入字盤。",
  );
  assert.equal(
    translateRuntimeText(
      "zh-Hans",
      "No match for 女 + 心 in this dictionary. Try another pair.",
    ),
    "字典中找不到 女 + 心 的组合。请试试其他部件。",
  );
});

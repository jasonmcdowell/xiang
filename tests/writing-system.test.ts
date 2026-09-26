import test from "node:test";
import assert from "node:assert/strict";
import {
  createWritingSystemIndices,
  type IndicesData,
} from "../src/lib/indicesClient";
import { convertGameStateCharacters, createGame } from "../src/lib/game";

const source: IndicesData = {
  decomp: {
    学: ["子", "冖"],
    學: ["子", "冖"],
    好: ["女", "子"],
  },
  compose: {},
  freq: {},
  meta: {
    学: { pinyin: ["xué"], definition: "to study" },
    學: { pinyin: ["xué"], definition: "to study" },
    好: { pinyin: ["hǎo"], definition: "good" },
    子: { pinyin: ["zǐ"], definition: "child" },
    冖: { pinyin: ["mì"], definition: "cover" },
    女: { pinyin: ["nǚ"], definition: "woman" },
  },
};

test("character script rebuilds one coherent reverse composition index", () => {
  const traditional = createWritingSystemIndices(
    source,
    { 学: "學", 學: "學" },
    ["好"],
  );
  assert.deepEqual(traditional.decomp.學, ["子", "冖"]);
  assert.deepEqual(traditional.compose["冖|子"], ["學"]);
  assert.deepEqual(traditional.compose["子|冖"], ["學"]);
  assert.equal(traditional.meta.學?.definition, "to study");
  assert.deepEqual(traditional.recipePool, ["好"]);
});

test("a one-character conversion cannot make a character decompose into itself", () => {
  const data = createWritingSystemIndices(
    {
      decomp: { 親: ["亲", "見"] },
      compose: {},
      freq: {},
      meta: {},
    },
    { 亲: "親" },
    [],
  );
  assert.deepEqual(data.decomp.親, ["亲", "見"]);
});

test("script conversion preserves tile identity, selection, score, and undo history", () => {
  const simplified = createWritingSystemIndices(source, {}, ["好"]);
  const traditional = createWritingSystemIndices(
    source,
    { 学: "學", 學: "學" },
    ["好"],
  );
  const game = createGame("explore", simplified);
  const previous = { ...game, board: [{ id: 90, char: "学" }] };
  const state = {
    ...game,
    board: [{ id: 91, char: "学" }],
    tray: [{ id: 92, char: "学" }],
    selected: [92],
    candidates: ["学"],
    discovered: ["学"],
    focused: "学",
    score: 7,
    message: "Added 学.",
    previous,
  };
  const converted = convertGameStateCharacters(
    state,
    traditional.characterMap ?? {},
  );
  assert.deepEqual(converted.board, [{ id: 91, char: "學" }]);
  assert.deepEqual(converted.tray, [{ id: 92, char: "學" }]);
  assert.deepEqual(converted.selected, [92]);
  assert.deepEqual(converted.candidates, ["學"]);
  assert.deepEqual(converted.discovered, ["學"]);
  assert.equal(converted.focused, "學");
  assert.equal(converted.score, 7);
  assert.equal(converted.message, "Added 學.");
  assert.equal(converted.previous?.board[0].char, "學");
});

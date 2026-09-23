import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGame,
  gameReducer,
  findPair,
  compose,
  composeTiles,
  findCombination,
  type GameState,
  type Action,
} from "../src/lib/game";
import type { IndicesData } from "../src/lib/indicesClient";
const json = (f: string) =>
  JSON.parse(readFileSync(`public/data/${f}.json`, "utf8"));
const data: IndicesData = {
  decomp: json("decomp"),
  compose: json("compose_pairs"),
  freq: json("component_freq"),
  meta: json("meta"),
};
const act = (s: GameState, a: Action) => gameReducer(s, a, data);
function combine(s: GameState): GameState {
  const pair = findPair(s, data)!;
  assert.ok(pair);
  s = act(s, { type: "select", id: pair[0].id });
  s = act(s, { type: "select", id: pair[1].id });
  s = act(s, { type: "compose" });
  return s.candidates.length
    ? act(s, { type: "choose", char: s.candidates[0] })
    : s;
}
test("one-level split, recomposition, distinct tile identities and undo", () => {
  let s = createGame("explore", data);
  const original = s;
  s = act(s, { type: "split", id: s.board[0].id });
  assert.deepEqual(
    s.tray.slice(-2).map((t) => t.char),
    ["相", "心"],
  );
  assert.equal(s.tray.length, 10);
  assert.equal(s.board.length, 2);
  for (const t of s.tray.slice(-2)) s = act(s, { type: "select", id: t.id });
  s = act(s, { type: "compose" });
  assert.equal(s.board.at(-1)?.char, "想");
  assert.equal(s.tray.length, 8);
  s = act(s, { type: "undo" });
  assert.equal(s.tray.length, 10);
  assert.equal(original.tray.length, 8);
  assert.equal(original.board.length, 3);
  assert.equal(new Set(s.tray.map((t) => t.id)).size, s.tray.length);
});
test("invalid pairs and cancelled or stale choices preserve tiles", () => {
  let s = createGame("explore", data);
  const a = s.tray.find((t) => t.char === "女")!,
    b = s.tray.find((t) => t.char === "心")!;
  assert.deepEqual(compose(data, a.char, b.char), []);
  s = act(act(s, { type: "select", id: a.id }), { type: "select", id: b.id });
  const before = s.tray;
  s = act(s, { type: "compose" });
  assert.deepEqual(s.tray, before);
  s = act(s, { type: "cancel" });
  assert.deepEqual(s.tray, before);
  assert.equal(s.selected.length, 0);
  s = act(s, { type: "choose", char: "想" });
  assert.deepEqual(s.tray, before);
});
test("ambiguous pairs consume only after a valid choice; repeated components require two tiles", () => {
  let s = createGame("explore", data);
  const [key, candidates] = Object.entries(data.compose).find(
    ([, v]) => v.length > 1,
  )!;
  s = {
    ...s,
    tray: key.split("|").map((char, i) => ({ id: 100 + i, char })),
    selected: [100, 101],
  };
  const pending = act(s, { type: "compose" });
  assert.deepEqual(pending.tray, s.tray);
  assert.deepEqual(pending.candidates, candidates);
  assert.deepEqual(act(pending, { type: "choose", char: "INVALID" }), pending);
  const result = act(pending, { type: "choose", char: candidates[0] });
  assert.equal(result.tray.length, 0);
  assert.equal(
    act({ ...s, selected: [100, 100] }, { type: "compose" }).tray.length,
    2,
  );
});
test("100 seeded starts have eight tiles and at least four recipes worth of material", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = createGame("challenge", data, seed);
    assert.equal(s.tray.length, 8);
    assert.ok(findPair(s, data));
    assert.deepEqual(s, createGame("challenge", data, seed));
  }
});
test("challenge start, drip, pause, scoring, unique bonus and reset", () => {
  let s = createGame("challenge", data, 8);
  assert.equal(act(s, { type: "advance", ms: 6000 }).remaining, 60000);
  s = act(s, { type: "start" });
  s = act(s, { type: "advance", ms: 6000 });
  assert.equal(s.tray.length, 9);
  assert.equal(s.remaining, 54000);
  s = act(s, { type: "pause" });
  assert.deepEqual(act(s, { type: "advance", ms: 20000 }), s);
  s = act(s, { type: "resume" });
  s = combine(s);
  assert.equal(s.tray.length, 7);
  assert.equal(s.score, 2);
  assert.equal(s.remaining, 57000);
  const parent = s.board.at(-1)!;
  s = act(s, { type: "split", id: parent.id });
  for (const t of s.tray.slice(-2)) s = act(s, { type: "select", id: t.id });
  s = act(s, { type: "compose" });
  if (s.candidates.length) s = act(s, { type: "choose", char: parent.char });
  assert.equal(s.score, 3);
  assert.equal(s.remaining, 60000);
  assert.equal(s.discovered.length, 1);
  s = createGame("challenge", data, 8);
  assert.equal(s.score, 0);
  assert.equal(s.phase, "ready");
});
test("overflow on thirteenth tile, splitting overflow, timeout and delayed ticks are exact", () => {
  const start = act(createGame("challenge", data), { type: "start" });
  const full = act(start, { type: "advance", ms: 24000 });
  assert.equal(full.tray.length, 12);
  assert.equal(full.phase, "playing");
  const over = act(full, { type: "advance", ms: 6000 });
  assert.equal(over.tray.length, 13);
  assert.equal(over.reason, "overflow");
  assert.equal(over.remaining, 30000);
  const time = act(
    { ...start, remaining: 6000, dripIn: 6000 },
    { type: "advance", ms: 100000 },
  );
  assert.equal(time.reason, "time");
  assert.equal(time.tray.length, 8);
  const split = act(
    { ...full, board: [{ id: 900, char: "想" }] },
    { type: "split", id: 900 },
  );
  assert.equal(split.reason, "overflow");
  let incremental = start;
  for (let i = 0; i < 300; i++)
    incremental = act(incremental, { type: "advance", ms: 100 });
  assert.deepEqual(incremental, act(start, { type: "advance", ms: 30000 }));
  assert.deepEqual(act(over, { type: "compose" }), over);
});

test("tray unfolding preserves order, net capacity, and undo", () => {
  let s = createGame("explore", data);
  s = act(s, { type: "split", id: s.board[0].id });
  const parent = s.tray.find((t) => t.char === "相")!;
  const before = s;
  s = act(s, { type: "split", id: parent.id });
  assert.deepEqual(
    s.tray.slice(-3).map((t) => t.char),
    ["木", "目", "心"],
  );
  assert.equal(s.tray.length, 11);
  assert.deepEqual(act(s, { type: "undo" }).tray, before.tray);
  const full = {
    ...s,
    mode: "challenge" as const,
    tray: [
      { id: 800, char: "相" },
      ...Array.from({ length: 10 }, (_, i) => ({ id: 900 + i, char: "心" })),
    ],
  };
  const twelve = act(full, { type: "split", id: 800 });
  assert.equal(twelve.tray.length, 12);
  assert.equal(twelve.phase, "playing");
  const overflow = act(
    { ...full, tray: [...full.tray, { id: 950, char: "木" }] },
    { type: "split", id: 800 },
  );
  assert.equal(overflow.reason, "overflow");
});

test("all three-child recipes round-trip with exact multiplicity; selection is capped safely", () => {
  for (const [char, children] of Object.entries(data.decomp))
    if (children.length === 3) {
      assert.ok(composeTiles(data, [...children].reverse()).includes(char));
    }
  assert.deepEqual(data.decomp["森"], ["木", "木", "木"]);
  let s = createGame("explore", data);
  s = act(s, { type: "add", char: "森" });
  s = act(s, { type: "split", id: s.board.at(-1)!.id });
  const inputs = s.tray.slice(-3);
  for (const t of inputs) s = act(s, { type: "select", id: t.id });
  const selected = s.selected;
  s = act(s, { type: "select", id: s.tray[0].id });
  assert.deepEqual(s.selected, selected);
  s = act(s, { type: "compose" });
  if (s.candidates.length) s = act(s, { type: "choose", char: "森" });
  assert.equal(s.board.at(-1)!.char, "森");
  assert.equal(s.tray.length, 8);
  const repeated = {
    ...s,
    tray: inputs,
    selected: [inputs[0].id, inputs[0].id, inputs[2].id],
  };
  assert.equal(act(repeated, { type: "compose" }).tray.length, 3);
  // Three 日 have no usable pair, so the fallback hint must discover 晶.
  const triple = {
    ...s,
    tray: [
      { id: 600, char: "日" },
      { id: 601, char: "日" },
      { id: 602, char: "日" },
    ],
  };
  assert.equal(findCombination(triple, data)?.length, 3);
  assert.equal(act(triple, { type: "hint" }).selected.length, 3);
});

test("mixed triples accept all input orders and reject the wrong multiplicity", () => {
  const inputs = ["中", "一", "贝"];
  for (const [a, b, c] of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    assert.ok(
      composeTiles(data, [inputs[a], inputs[b], inputs[c]]).includes("贵"),
    );
  }
  assert.ok(!composeTiles(data, ["中", "中", "贝"]).includes("贵"));
  assert.ok(composeTiles(data, ["也", "扌", "亻"]).includes("拖"));
  let s = createGame("explore", data);
  s = act(s, { type: "add", char: "婴" });
  const before = s;
  s = act(s, { type: "split", id: s.board.at(-1)!.id });
  const tiles = s.tray.slice(-3);
  assert.deepEqual(
    tiles.map((t) => t.char),
    ["贝", "贝", "女"],
  );
  for (const t of [...tiles].reverse())
    s = act(s, { type: "select", id: t.id });
  s = act(s, { type: "compose" });
  if (s.candidates.length) s = act(s, { type: "choose", char: "婴" });
  assert.equal(s.board.at(-1)!.char, "婴");
  assert.deepEqual(s.tray, before.tray);
  s = act(s, { type: "undo" });
  assert.deepEqual(s.tray.slice(-3), tiles);
});

test("drop combines atomically, carries selection, and rejects stale or self targets", () => {
  const initial = createGame("explore", data);
  const pair = {
    ...initial,
    tray: [
      { id: 900, char: "女" },
      { id: 901, char: "子" },
    ],
    selected: [],
  };
  let s = act(pair, { type: "drop", sourceId: 900, targetId: 901 });
  if (s.candidates.length) s = act(s, { type: "choose", char: "好" });
  assert.equal(s.board.at(-1)!.char, "好");
  assert.equal(s.tray.length, 0);
  assert.deepEqual(act(s, { type: "undo" }).tray, pair.tray);
  assert.equal(act(pair, { type: "drop", sourceId: 900, targetId: 900 }), pair);
  assert.equal(act(pair, { type: "drop", sourceId: 999, targetId: 901 }), pair);
  const triple = {
    ...initial,
    tray: [900, 901, 902].map((id) => ({ id, char: "木" })),
    selected: [900, 901],
  };
  s = act(triple, { type: "drop", sourceId: 900, targetId: 902 });
  if (s.candidates.length) s = act(s, { type: "choose", char: "森" });
  assert.equal(s.board.at(-1)!.char, "森");
  assert.equal(s.tray.length, 0);
  const invalid = {
    ...pair,
    tray: [
      { id: 900, char: "女" },
      { id: 901, char: "心" },
    ],
  };
  assert.deepEqual(
    act(invalid, { type: "drop", sourceId: 900, targetId: 901 }).tray,
    invalid.tray,
  );
});

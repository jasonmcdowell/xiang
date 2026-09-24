import { normalizeChar, type IndicesData } from "./indicesClient";

export type Tile = { id: number; char: string };
export type Mode = "explore" | "challenge";
export type GameState = {
  mode: Mode;
  phase: "ready" | "playing" | "paused" | "over";
  board: Tile[];
  tray: Tile[];
  selected: number[];
  hinted: number[];
  candidates: string[];
  score: number;
  discovered: string[];
  remaining: number;
  dripIn: number;
  nextId: number;
  seed: number;
  message: string;
  focused: string;
  reason: "time" | "overflow" | null;
  previous: GameState | null;
};
export type Action =
  | { type: "select"; id: number }
  | { type: "drop"; sourceId: number; targetId: number }
  | { type: "split"; id: number }
  | { type: "compose" }
  | { type: "choose"; char: string }
  | { type: "add"; char: string }
  | { type: "advance"; ms: number }
  | { type: "start" | "pause" | "resume" | "cancel" | "hint" | "undo" };
export const CAPACITY = 12;
const EXPLORE_TRAY_LIMIT = 48;
export const RECIPES = Array.from(
  "明休好林信朋问听男秋炎呆尖从体泪如和叶早时江河汗打",
);
export const SAMPLE_SETS = [
  {
    name: "First discoveries",
    board: ["想", "明", "休"],
    tray: ["女", "子", "木", "木", "日", "月", "人", "心"],
  },
  {
    name: "Nature & light",
    board: ["林", "秋", "泪"],
    tray: ["火", "火", "日", "月", "水", "木", "禾", "口"],
  },
  {
    name: "People & words",
    board: ["好", "信", "问"],
    tray: ["人", "木", "女", "子", "口", "斤", "人", "言"],
  },
  {
    name: "Three of a kind",
    board: ["森", "品", "晶"],
    tray: ["木", "木", "木", "口", "口", "口", "日", "日"],
  },
  {
    name: "Everyday pieces",
    board: ["亲", "贵", "谷"],
    tray: ["立", "一", "小", "中", "一", "贝", "八", "人"],
  },
];
export function decompose(data: IndicesData, char: string): string[] | null {
  return data.decomp[normalizeChar(char)] ?? null;
}
export function compose(data: IndicesData, a: string, b: string): string[] {
  return data.compose[`${normalizeChar(a)}|${normalizeChar(b)}`] ?? [];
}
// Three-child recipes use the same authoritative decompositions as unfolding.
const tripleIndices = new WeakMap<IndicesData, Record<string, string[]>>();
export function composeTiles(data: IndicesData, chars: string[]): string[] {
  if (chars.length === 2) return compose(data, chars[0], chars[1]);
  if (chars.length !== 3) return [];
  let index = tripleIndices.get(data);
  if (!index) {
    index = {};
    for (const parent of Object.keys(data.decomp).sort()) {
      const children = data.decomp[parent];
      if (children.length === 3) {
        const key = [...children].sort().join("|");
        (index[key] ??= []).push(parent);
      }
    }
    tripleIndices.set(data, index);
  }
  return index[chars.map(normalizeChar).sort().join("|")] ?? [];
}
export function findCombinableTileIds(
  state: GameState,
  data: IndicesData,
): number[] {
  const combinable = new Set<number>();
  const { tray } = state;
  for (let i = 0; i < tray.length; i++) {
    for (let j = i + 1; j < tray.length; j++) {
      if (compose(data, tray[i].char, tray[j].char).length) {
        combinable.add(tray[i].id);
        combinable.add(tray[j].id);
      }
      for (let k = j + 1; k < tray.length; k++) {
        if (
          composeTiles(data, [tray[i].char, tray[j].char, tray[k].char])
            .length
        ) {
          combinable.add(tray[i].id);
          combinable.add(tray[j].id);
          combinable.add(tray[k].id);
        }
      }
    }
  }
  return [...combinable].sort((a, b) => a - b);
}
function random(state: GameState): number {
  let x = state.seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.seed = x >>> 0;
  return state.seed / 4294967296;
}
function tile(state: GameState, char: string): Tile {
  return { id: state.nextId++, char };
}
function recipes(data: IndicesData): string[][] {
  return RECIPES.map((c) => data.decomp[c]).filter((c) => c?.length === 2);
}
export function createGame(
  mode: Mode,
  data: IndicesData,
  seed = 42,
  set = 0,
): GameState {
  const s: GameState = {
    mode,
    phase: mode === "explore" ? "playing" : "ready",
    board: [],
    tray: [],
    selected: [],
    hinted: [],
    candidates: [],
    score: 0,
    discovered: [],
    remaining: 60000,
    dripIn: 6000,
    nextId: 1,
    seed,
    message:
      mode === "explore"
        ? "Start with 想. Click it to discover what’s inside."
        : "Build characters. Make room. Keep the clock alive.",
    focused: "想",
    reason: null,
    previous: null,
  };
  if (mode === "explore") {
    const sample = SAMPLE_SETS[set % SAMPLE_SETS.length];
    s.focused = sample.board[0];
    s.message = `Start with ${s.focused}. Click it to discover what’s inside.`;
    s.board = sample.board.map((c) => tile(s, c));
    s.tray = sample.tray.map((c) => tile(s, c));
  } else {
    const pool = recipes(data);
    if (!pool.length) throw new Error("No playable recipes in character data.");
    for (let i = 0; i < 4; i++)
      s.tray.push(
        ...pool[Math.floor(random(s) * pool.length)].map((c) => tile(s, c)),
      );
    for (let i = s.tray.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [s.tray[i], s.tray[j]] = [s.tray[j], s.tray[i]];
    }
    s.focused = s.tray[0].char;
  }
  return s;
}
export function findPair(
  state: GameState,
  data: IndicesData,
): [Tile, Tile] | null {
  for (let i = 0; i < state.tray.length; i++) {
    for (let j = i + 1; j < state.tray.length; j++) {
      if (compose(data, state.tray[i].char, state.tray[j].char).length)
        return [state.tray[i], state.tray[j]];
    }
  }
  return null;
}
function remember(s: GameState, before: GameState) {
  if (s.mode === "explore")
    s.previous = { ...before, selected: [], candidates: [], previous: null };
}
function finish(s: GameState, reason: "time" | "overflow") {
  s.phase = "over";
  s.reason = reason;
  s.selected = [];
  s.hinted = [];
  s.candidates = [];
  s.message =
    reason === "time"
      ? "Time’s up. Every discovery counts."
      : "The tray filled up. Give it another try.";
}
function drip(s: GameState, data: IndicesData) {
  const pool = [...new Set(recipes(data).flat())];
  const helpful = pool.filter((c) =>
    s.tray.some((t) => compose(data, c, t.char).length),
  );
  const choices = helpful.length ? helpful : pool;
  const weights = choices.map((c) => Math.sqrt(data.freq[c] || 1));
  let pick = random(s) * weights.reduce((a, b) => a + b, 0);
  let char = choices[choices.length - 1];
  for (let i = 0; i < choices.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      char = choices[i];
      break;
    }
  }
  s.tray = [...s.tray, tile(s, char)];
  s.hinted = [];
  if (s.tray.length > CAPACITY) finish(s, "overflow");
}
export function gameReducer(
  state: GameState,
  action: Action,
  data: IndicesData,
): GameState {
  const s = { ...state };
  if (action.type === "start" && s.phase === "ready")
    return {
      ...s,
      phase: "playing",
      message: "Select two components, then combine them.",
    };
  if (
    action.type === "pause" &&
    s.phase === "playing" &&
    s.mode === "challenge"
  )
    return { ...s, phase: "paused", candidates: [] };
  if (action.type === "resume" && s.phase === "paused")
    return { ...s, phase: "playing" };
  if (action.type === "cancel") return { ...s, selected: [], candidates: [] };
  if (s.phase !== "playing") return state;
  if (action.type === "advance") {
    if (s.mode !== "challenge" || !Number.isFinite(action.ms) || action.ms <= 0)
      return state;
    let elapsed = action.ms;
    while (elapsed > 0 && s.phase === "playing") {
      const step = Math.min(elapsed, s.remaining, s.dripIn);
      s.remaining -= step;
      s.dripIn -= step;
      elapsed -= step;
      if (s.remaining <= 0) finish(s, "time");
      else if (s.dripIn <= 0) {
        s.dripIn = 6000;
        drip(s, data);
      }
    }
    return s;
  }
  if (action.type === "drop") {
    if (
      action.sourceId === action.targetId ||
      !s.tray.some((t) => t.id === action.sourceId) ||
      !s.tray.some((t) => t.id === action.targetId)
    )
      return state;
    const ids = [
      ...new Set([
        ...(s.selected.includes(action.sourceId)
          ? s.selected
          : [action.sourceId]),
        action.targetId,
      ]),
    ];
    if (ids.length > 3)
      return {
        ...s,
        message: "Combine up to three tiles. Deselect a tile first.",
      };
    return gameReducer(
      { ...s, selected: ids, candidates: [] },
      { type: "compose" },
      data,
    );
  }
  if (action.type === "undo")
    return s.mode === "explore" && s.previous
      ? { ...s.previous, message: "Last move undone.", previous: null }
      : state;
  if (action.type === "hint") {
    if (s.hinted.length)
      return { ...s, hinted: [], message: "Combination hints hidden." };
    const hinted = findCombinableTileIds(s, data);
    return {
      ...s,
      hinted,
      candidates: [],
      message: hinted.length
        ? `${hinted.length} tiles have at least one valid combination. Hints don’t show which pieces match.`
        : "No combination yet. Unfold a tile or wait for a new component.",
    };
  }
  if (action.type === "select") {
    const chosen = s.tray.find((t) => t.id === action.id);
    if (!chosen) return state;
    s.focused = chosen.char;
    s.candidates = [];
    if (!s.selected.includes(action.id) && s.selected.length === 3)
      return {
        ...s,
        message:
          "Select up to three tiles. Deselect one to change the combination.",
      };
    s.selected = s.selected.includes(action.id)
      ? s.selected.filter((id) => id !== action.id)
      : [...s.selected, action.id];
    s.message =
      s.selected.length >= 2
        ? "Your pieces, a new possibility. Try Combine."
        : "Choose one more component from the tray.";
    return s;
  }
  if (action.type === "split") {
    const trayIndex = s.tray.findIndex((t) => t.id === action.id);
    const parent = s.board.find((t) => t.id === action.id) ?? s.tray[trayIndex];
    if (!parent) return state;
    const children = decompose(data, parent.char);
    s.focused = parent.char;
    if (!children)
      return {
        ...s,
        message: `${parent.char} has no usable one-level split in this dictionary.`,
      };
    if (
      s.mode === "explore" &&
      s.tray.length + children.length - (trayIndex >= 0 ? 1 : 0) >
        EXPLORE_TRAY_LIMIT
    )
      return {
        ...s,
        message: "Combine some tray tiles first (48-tile limit).",
      };
    remember(s, state);
    s.board = s.board.filter((t) => t.id !== parent.id);
    const childTiles = children.map((c) => tile(s, c));
    s.tray =
      trayIndex < 0
        ? [...s.tray, ...childTiles]
        : [
            ...s.tray.slice(0, trayIndex),
            ...childTiles,
            ...s.tray.slice(trayIndex + 1),
          ];
    s.hinted = [];
    s.selected = [];
    s.candidates = [];
    s.message = `${parent.char} → ${children.join(" + ")}. The pieces are in your tray.`;
    if (s.mode === "challenge" && s.tray.length > CAPACITY)
      finish(s, "overflow");
    return s;
  }
  if (action.type === "add") {
    if (s.mode !== "explore") return state;
    const char = normalizeChar(action.char.trim());
    if (!/^\p{Unified_Ideograph}$/u.test(char) || !data.meta[char])
      return {
        ...s,
        message: "Enter one Chinese character from the dictionary.",
      };
    if (s.board.length >= 24)
      return {
        ...s,
        message: "Split a board character first (24-character limit).",
      };
    remember(s, state);
    s.board = [...s.board, tile(s, char)];
    s.focused = char;
    s.message = `Added ${char}. ${decompose(data, char) ? "Click it to explore its components." : "This character has no usable one-level split."}`;
    return s;
  }
  if (action.type === "compose" || action.type === "choose") {
    const pair = s.selected.map((id) => s.tray.find((t) => t.id === id));
    if (
      pair.length < 2 ||
      pair.length > 3 ||
      pair.some((t) => !t) ||
      new Set(s.selected).size !== pair.length
    )
      return state;
    const choices = composeTiles(
      data,
      pair.map((t) => t!.char),
    );
    if (!choices.length)
      return {
        ...s,
        message: `No match for ${pair.map((t) => t!.char).join(" + ")} in this dictionary. Try another pair.`,
        candidates: [],
      };
    if (action.type === "compose" && choices.length > 1)
      return { ...s, candidates: choices };
    const char = action.type === "choose" ? action.char : choices[0];
    if (
      !choices.includes(char) ||
      (action.type === "choose" && !s.candidates.includes(char))
    )
      return state;
    if (s.mode === "explore" && s.board.length >= 24)
      return {
        ...s,
        candidates: [],
        message: "Split a board character first (24-character limit).",
      };
    remember(s, state);
    const fresh = !s.discovered.includes(char);
    s.tray = s.tray.filter((t) => !s.selected.includes(t.id));
    s.hinted = [];
    s.board = [...s.board, tile(s, char)];
    s.selected = [];
    s.candidates = [];
    s.focused = char;
    if (fresh) s.discovered = [...s.discovered, char];
    if (s.mode === "challenge") {
      s.score += fresh ? 2 : 1;
      s.remaining += 3000;
    }
    s.message = `${pair.map((t) => t!.char).join(" + ")} → ${char}${fresh ? " · New discovery!" : " · Nicely done."}${s.mode === "challenge" ? ` +${fresh ? 2 : 1} points · +3 seconds` : ""}`;
    return s;
  }
  return state;
}

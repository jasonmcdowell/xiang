# PRD — Xiang (想): Chinese Character Component Game

> **Purpose of this document**
>
> This PRD is the single source of truth for what we are building and why. It is written to be used by an automated coding agent (OpenAI Codex CLI) and by a human developer. It emphasizes **testable incremental milestones** and makes critical rules explicit so implementation does not rely on guesswork.

---

## 1) Product intent (why this exists)

Xiang (想) is meant to make Chinese characters feel **tangible**: a playful toy where a player can pick up a character, click to break it into meaningful parts, and recombine parts into other real characters. The system should feel like a sandbox + referee:

- **Toy-like manipulation** (decompose/recompose)
- **Instant feedback** (valid/invalid)
- **Exploration-friendly** (characters persist, can be decomposed again)
- **Fast iteration** (static GitHub Pages project site, no backend for MVP)

This is both a learning tool and a puzzle game, inspired by Scrabble/Rummikub “tile trays” but with Chinese character structure.

---

## 2) Scope overview

### MVP (Phase 1)
- Web app (Next.js + TypeScript) statically exported to **GitHub Pages**
- Uses **Make Me a Hanzi `dictionary.txt`** as build-time source
- Build-time preprocessing generates **static indices** served from `public/data/**`
- Gameplay supports:
  - Click-to-decompose (one level deep)
  - Compose from two tiles (operator-free for MVP)
  - Mode A: timed challenge with component drip + overflow + time bonus on success
- **Tiles are rendered using fonts** (stroke rendering is Phase 2)

### Phase 2+
- Use **hanzi-writer-data** CDN to lazily load stroke data for better visuals/animations/highlighting
- Add operator-aware composition (⿰, ⿱, etc.) and/or drag semantics
- Hidden Message mode (puzzle generator)
- Tile/Board mode (adjacency + morphing rules)

### First physical experiment (2026-09-22)
- Separate `/playground` page showing one untiled 想 using its stroke outlines.
- Grab and drag the ink; deformation and inertia remain visible when the pointer stops, then settle on release.
- Mouse/touch support, a softness control, reset/nudge controls, keyboard support, and reduced motion.
- The initial character-only demo used one untiled 想 to validate elastic dragging. The current component-tearing experiment is described below.

### Playground extensions (2026-09-22)
- The playground now supports a small reviewed set of component tears and relative-layout magnetic assembly. These remain an isolated experiment, separate from the primary game's rules.
- A Flat/Raised/Draped surface-style selector compares plain ink, raised strokes on a shallow character tile, and strokes that flow over the tile edge toward tabletop height.
- Raised and Draped characters use equal 184 × 184 CSS-pixel tile faces. Ink pulls leave the face anchored; only a bare-face drag targets the tile, with whole-character movement available in Weighted mode.
- After release, ink drifts back to its own tile's center and orientation unless a compatible pair is being magnetically aligned; this return never moves the tile or automatically recombines characters.
- In Raised and Draped styles, a component becomes a new tile only after the seam is stretched and its planned 184 × 184 face clears its sibling and all existing faces by at least 12 CSS pixels; compatible pieces remain catchable by the gentle magnetic field after separation.
- The phone-sized playground board stays tall enough to pull two tiles apart vertically without clipping either new face.
- Keep this visual experiment 2D and client-side. It should not delay or change the core Explore and Timed Challenge experience.

---

## 3) Naming & brand

- Working name: **Xiang (想)**
- Icon concept: a tree whose fruit are hearts and eyes

---

## 4) Users

- Second-language learners (HSK ~1–6) who want playful reinforcement
- Chinese-literate puzzle fans
- Educators/parents wanting short, structured sessions

---

## 5) Data strategy (critical engineering plan)

### Intent
Gameplay must feel instant. We should not call an API on each move. Make Me a Hanzi data is large; serverless bundle limits and latency make per-move APIs undesirable.

### Decision (MVP)
- Preprocess Make Me a Hanzi `dictionary.txt` into compact indices at build/dev time.
- Serve indices as **static files** via Next.js `public/data/**`.
- Keep all decompose/compose validation **client-side** using those indices.

### Phase 2 (visuals)
- Use **hanzi-writer-data CDN** to fetch per-character stroke JSON lazily when needed.
- MVP does not depend on strokes.

---

## 6) Game rules appendix (MVP rules are explicit)

### 6.1 Tile validity and normalization
- All tiles shown to players are **valid standard Unicode characters** (Hanzi).
- Component variants are normalized to canonical character tiles:
  - Example: 忄 is displayed/treated as 心
  - Example: 扌 -> 手, 氵 -> 水, 亻 -> 人, 訁 -> 言, 礻 -> 示, etc.
- MVP uses a small curated `variantMap`. Phase 2 may display component forms visually while keeping canonical identity for rules.

### 6.2 Decompose operation (MVP)
- Action: player **clicks** a character tile on the board.
- If the character has a usable one-level decomposition into **2+ valid child characters**:
  - Remove the parent from the board and add all immediate children to the component tray
- Each click applies one supported recipe. Tiles in the component tray can also unfold in place. We do **not** automatically recurse into newly created children.
- Reviewed nested recipes (registry: `data/decomposition_extensions.json`) initially add 森, 品, 晶, 众, 焱, 磊, 淼, 鑫 as three identical character tiles. A second checked batch adds 亲, 具, 婴, 拖, 沿, 谷, 贵, 轻 with mixed three-piece recipes. Unreviewed nested structures remain excluded.
- If decomposition is invalid/unknown/unusable (starts with `？` or yields unusable children), decompose does nothing (optional: show “can’t decompose”).

**Example:** 想 -> 相 + 心

### 6.3 Compose operation (operator-free)
The dataset is decomposition-first. For MVP composition we use reverse lookup:

- Player selects **two or three component tiles** in the tray and activates Combine. Native buttons support mouse, touch, and keyboard.
- The system finds all characters whose one-level decomposition has exactly two or three children that match the selected tiles (after normalization).
- Outcomes:
  - 0 results: invalid (reject/bounce)
  - 1 result: compose succeeds, creating that character tile on the board
  - >1 results: show a small chooser UI; player selects which character to create

**Consumption rule (MVP):**
- Input component tiles are **consumed** when composing.
- Resulting character tile appears on the **board** and stays until decomposed.

### 6.4 Ambiguity policy (MVP)
- If multiple result characters are possible, show all candidates in a scrollable chooser, with pinyin and definitions, in deterministic code-point order.
- Cancel preserves both inputs. The challenge clock keeps running while choosing.

---

## 7) Modes

### 7.1 Mode A (MVP): Timed Challenge
Goal: build characters quickly without letting the tray overflow.

**Rules**
- Start timer: 60 seconds
- Start tray: N=8 random component tiles from a curated pool
- Tray capacity: C=12
- Every 6 seconds: add 1 random component tile to tray
- Compose success:
  - consumes 2 input tiles
  - creates 1 board character tile
  - adds +3 seconds to timer
  - adds +points (scoring below)
- End condition:
  - timer reaches 0 OR tray exceeds capacity (overflow)

**Scoring**
- +1 per successful composition
- +1 bonus for creating a character not yet created this run
- Phase 2+: use stroke count, frequency/rarity, streaks, etc.

**Component pool selection**
- Precompute component frequency from one-level decompositions (normalized children)
- Challenge starts with the shuffled children of four curated, valid two-child recipes to guarantee initial moves. Incoming components are weighted by square-root frequency within this curated pool, preferring characters that pair with the current tray.
- Explicit pause and hiding the tab freeze both clocks. At simultaneous timeout and arrival, timeout wins. Splitting can cause overflow.
- Every successful recomposition earns the base reward; the discovery bonus is awarded only once per character per run.

### 7.2 Explore (MVP) and Hidden Message (deferred)
- Explore provides an untimed board and tray, five curated sample sets, single-character lookup/addition, one-move undo, hints, and a discovery collection.
- The default set demonstrates 想 → 相 + 心, followed by a later one-level split of 相 → 木 + 目.
- The earlier ChID scramble workspace is superseded. Its experimental data/scripts remain for future Hidden Message work, which is not part of this MVP.

### 7.3 Mode C (Phase 3): Tile/Board mode
- Board adjacency + morphing rules using shared components.
- Not required for MVP.

---

## 8) Functional requirements (MVP)

### 8.1 Preprocessing tool (must-have)
Input: Make Me a Hanzi `dictionary.txt` (JSONL)

Output to `public/data/`:
1) `decomp.json`
- `char -> [child1, child2, ...]` (one-level, normalized)
2) `compose_pairs.json`
- key `"A|B" -> [parentChars...]` (A,B normalized; include both orders for MVP)
3) `component_freq.json`
- `componentChar -> count` based on normalized one-level children

Constraints:
- Stream JSONL in two passes (catalog supported characters, then generate indices).
- Reject unknown, unsupported, or non-Han children. Nested structures require a reviewed extension validated against the exact IDS and all leaves. Never silently drop a child.

Acceptance checks:
- Print counts: total processed, decomposable count, compose index size
- Verify sample:
  - 想 decomposes to 相 + 心
  - compose lookup for 相|心 includes 想
- Print top 20 components by frequency

### 8.2 Client rules engine (must-have)
Expose functions:
- `decompose(char) -> string[] | null`
- `compose(a, b) -> string[]` (returns candidate parents, possibly empty)
- `normalize(char) -> char`

### 8.3 UI (MVP)
Layout:
- Explore / Timed challenge mode switch and pinyin toggle.
- Character board (click to split), component tray (select two to combine), and ambiguity chooser.
- Field guide with pronunciation, meaning, and one-level decomposition.
- Discovery collection; Explore set/reset/undo/add controls; challenge start/pause/resume/new-run controls and time/score/best/arrival indicators.
- Loading state, recoverable fetch failure, invalid-move feedback, and responsive mobile layout.
- A site-wide language selector for English, Traditional Chinese, and Simplified Chinese; retain the interface preference across routes and reloads.

Interactions:
- Click a decomposable tile face → its children move to the tray or replace it in place within the tray. A separate + control on decomposable tray tiles selects them intact.
- Animate transformations and surviving-tile layout shifts with inert visual copies; support interruption and reduced-motion preferences.
- Select two or three tray tiles → Combine → choose a result when needed → consumed inputs become one board tile.
- Hints highlight every tray tile that participates in a valid pair or supported triple without revealing which tiles match each other. No per-move network requests.
- Challenge pauses on a hidden tab. New run or switching modes resets the table. Best challenge score is kept only for the current page visit.

---

## 9) Non-functional requirements

- Instant feedback on compose/decompose (no per-move API calls)
- Stable, deterministic behavior (same inputs -> same candidates)
- No tile loss: invalid move returns tiles safely

---

## 10) GitHub Pages deployment requirements (MVP)

- Next.js app statically exported to a GitHub Pages project site at `/xiang/`; no backend is required for gameplay.
- Build with `output: "export"`, `basePath: "/xiang"`, and trailing slashes so direct route visits work on static hosting.
- All public asset URLs include the configured base path. The GitHub Actions workflow uploads only `out/`.
- Indices remain committed static assets under `public/data/**`; the local raw dictionary and graphics files are never published.
- The public repository uses a clean release history so removed raw data is not exposed through old commits.

---

## 11) Milestones (step-by-step, each testable)

### Milestone 0 — Repo + Next.js skeleton
- Create Next.js + TS app
- Render empty Board and Tray components
- Prepare a GitHub Pages-compatible static export; publish after the public release is reviewed.

**Test:** loads locally; public GitHub Pages deployment is a separate release step.

### Milestone 1 — Preprocessing script outputs indices
- Add `scripts/build_indices.(ts|py)`
- Generate `public/data/decomp.json`, `compose_pairs.json`, `component_freq.json`

**Test:** run script; verify sample and print top components.

### Milestone 2 — Data inspector page
- Add a debug page:
  - input: character -> show decomposition children
  - input: A,B -> show compose candidates

**Test:** 想 -> 相+心; 相+心 -> 想.

### Milestone 3 — Click-to-decompose on the board
- Populate board with a few known decomposable characters
- Click -> remove parent, add children to tray

**Test:** click 想 creates 相 and 心 in tray.

### Milestone 4 — Compose from tray (operator-free)
- Select two tray tiles, then Combine
- Use compose index to generate candidates
- If multiple: chooser UI; else auto
- Consume inputs; place result on board

**Test:** combine 相 + 心 -> choose 想 (if multiple, pick it) -> board shows 想.

### Milestone 5 — Mode A loop (timer + drip + overflow)
- Implement timer, periodic tile addition, overflow end condition
- Score and +time on successful compose
- Reset/new run

**Test:** playable loop, visible progress, consistent end conditions.

### Milestone 6 — MVP polish + deploy
- Clear on-screen instructions
- Loading/error states for indices
- GitHub Pages deployment works with the static indices at `/xiang/`

---

## 12) Open questions (explicitly postponed)
- Operator-aware composition UI (⿰ vs ⿱ selection)
- Four-or-more-tile composition, alternate recipes, and general nested IDS resolution
- Full component variant normalization coverage
- Puzzle generation algorithms for Hidden Message mode
- Stroke rendering / animations (hanzi-writer-data integration)

---

## 13) Definition of Done (MVP implementation)
- Indices generated from Make Me a Hanzi dictionary data
- Production app loads committed static indices; GitHub Pages deployment is verified separately
- Click-to-decompose works for a meaningful set of characters
- Two- and three-tile compose works with candidate chooser
- Mode A timed challenge playable with scoring, timer, drip, overflow
- Reset/new run works; instructions visible

---

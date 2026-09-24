# Xiang 想

A Chinese character tile game: take a character apart, combine its pieces, and discover another real character. Built with Next.js App Router, TypeScript, and React; all game rules run in the browser against static dictionary indices.

## Run locally

Node.js 22 LTS is recommended.

```bash
npm ci
npm run dev
```

- Game: http://localhost:3000
- Dictionary inspector: http://localhost:3000/inspector

Generated assets are committed. **You do not need the raw dictionary to run or build the game.** No API keys, accounts, database, or remote font service are required.

## Play

**Explore** opens with 想, 明, and 休 on the character board. Click 想 to move 相 and 心 into the tray. Select those two tray tiles and click **Combine** to make 想 again. Click 相 directly in the tray to get 木 and 目. Each click unfolds only the selected tile.

- Click any decomposable tile face to unfold it, whether on the board or in the tray. Tray tiles with an **Unfold** label also have a separate **+** selection button: use it to combine a character intact. Atomic tile faces select directly. Native buttons work with mouse, touch, Tab, Enter, and Space.
- Select two or three distinct tiles, including two copies of the same character when available. Pair order does not matter.
- If a pair makes several characters, a chooser shows every candidate, pronunciation, and definition. Escape or **Keep my tiles** cancels. Invalid pairs never consume tiles.
- **Hint** selects a valid pair. **Undo** restores one Explore move, including the discovery collection.
- Try five sample sets (including **Three of a kind** for 森, 品, and 晶) or add a single dictionary character. Explore limits the tray to 48 tiles and the board to 24 characters, with feedback when full.
- Hover/focus a tile to inspect its meaning. The field guide also supports exploring immediate children. Pinyin can be hidden on tiles.

**Timed challenge** starts with 8 components from four curated recipes, shuffled. Press **Start challenge** for 60 seconds of play. A tile arrives every 6 seconds. Combining consumes two or three tray tiles and puts one character on the board, adding 3 seconds and 1 point, plus 1 point for a character first created that run. Recomposition receives the base reward again. The 13th tray tile ends the run; splitting a board character can also cause overflow. Time reaching zero ends the run.

Pause freezes both clocks; hiding the tab pauses automatically. A composition chooser leaves the clock running. Best score is kept only for the current page visit; reloading resets it. Xiang does not use cookies, browser storage, analytics, or advertising scripts. See the [privacy page](https://jasonmcdowell.github.io/xiang/privacy/) for the hosting notice.

These are structural dictionary relationships, not necessarily etymological explanations. Unreviewed nested expressions are excluded rather than guessed. No per-move network requests occur after the four indices load.

## Verify

```bash
npm test                # Data invariants, generator fixtures, game rules and clocks
npm run lint
npm run build
python3 -m http.server 8000 --directory out  # Serve a static export at http://localhost:8000
```

Browser verification (keep a development or production server running in another terminal):

```bash
npx playwright install chromium
npm run test:browser
npm run test:motion     # Flight paths, cancellation, reduced motion, tray unfolding and triples
npm run test:recipes    # Mixed three-piece recipes, all eight round trips, mobile and inspector
npm run test:playground # Tear, nested tear, magnetic alignment, two physics modes and multitouch
```

To test another origin:

```bash
XIANG_TEST_URL=http://127.0.0.1:3001 npm run test:browser
npm run test:motion     # Flight paths, cancellation, reduced motion, tray unfolding and triples
npm run test:recipes    # Mixed three-piece recipes, all eight round trips, mobile and inspector
npm run test:playground # Tear, nested tear, magnetic alignment, two physics modes and multitouch
```

Browser checks cover splitting/recomposition, invalid pairs, duplicate tile IDs, chooser/cancel, keyboard controls, undo, sample sets, pinyin, hints, timed rewards, pause, timeout, overflow, restart, session best score, inspector, mobile overflow, loading failure/retry, and the absence of per-move data requests. Screenshots go to `output/browser/` (gitignored).

`window.render_game_to_text()` exposes the visible game state for automation. `window.advanceTime(ms)` switches the current mounted game to a manually stepped clock for deterministic tests; reload to restore real time. It has no scoring or state-injection shortcut.

## Data pipeline

Input, local only and gitignored:

```text
data/makemeahanzi/dictionary.txt
```

Obtain `dictionary.txt` from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi). Then:

```bash
npm run build:data
# Or custom paths:
node scripts/build_indices.js --input path/to/dictionary.txt --outdir public/data
```

The generator uses two streamed passes: first to catalog supported dictionary characters, then to parse complete one-level IDS structures. It rejects the whole recipe if a child is unknown, not a unified Han character after normalization, or absent from the dictionary. Nested expressions require an explicit reviewed extension; other nested recipes remain rejected. It maps 忄→心, 扌→手, 氵→水, 亻→人, 訁→言, 礻→示 and sorts deterministically by code point.

Outputs under `public/data/`:

| File | Contents |
| --- | --- |
| `decomp.json` | Character → immediate normalized children |
| `compose_pairs.json` | `A\|B` → candidate parents; both input orders |
| `component_freq.json` | Component → occurrence count, including repeated children |
| `meta.json` | Character → pinyin and definition |

The current build contains 8,294 decompositions and 16,092 ordered pair keys. The command reports counts, top components, and checks 想 ↔ 相 + 心. `npm test` checks the complete generated dataset, not just the example. The main game keeps these compact indices locally available for immediate lookups. The physics playground has a separate 192 KB catalog of physically complete component pairs; it fetches per-character stroke outlines and stroke-to-component mappings only when needed.

Dictionary source and license notices are served at `public/data/NOTICE.txt` and `public/data/licenses/`. Raw dictionary, graphics, and tarballs must remain untracked.

## Project structure

- `src/lib/game.ts` — pure rules/state transitions, cached three-child reverse index, seeded component selection, clocks.
- `src/hooks/useTileMotion.ts` — decorative tile flights and layout motion; respects reduced-motion settings.
- `src/lib/indicesClient.ts` — normalized identities and cached static data loading.
- `src/app/page.tsx` — game and accessible controls.
- `src/app/inspector/page.tsx` — dictionary lab.
- `src/app/playground/` and `src/lib/playgroundWorld.ts` — the separate physical character lab.
- `src/app/globals.css` — responsive tabletop styling and reduced-motion support.
- `tests/` and `scripts/test-browser.mjs` — automated verification.
- `PRD.md`, `DECISIONS.md`, and `TASKS.md` — product, rationale, and acceptance status.

## Deployment

Xiang is live as a static GitHub Pages project site at <https://jasonmcdowell.github.io/xiang/>. The Actions build sets `NEXT_PUBLIC_BASE_PATH=/xiang`, exports the routes with trailing slashes, and uploads only `out/`. Local development keeps the base path empty. The project source is public at <https://github.com/jasonmcdowell/xiang>; the personal showcase at <https://jasonmcdowell.github.io/> links to this project site while its other project pages remain in place.

For a local Pages-shaped production build (the symlink lets Python serve the `/xiang/` prefix):

```bash
NEXT_PUBLIC_BASE_PATH=/xiang npm run build
mkdir -p /tmp/xiang-pages-preview/xiang
cp -R out/. /tmp/xiang-pages-preview/xiang/
python3 -m http.server 8000 --directory /tmp/xiang-pages-preview
```

Open `http://localhost:8000/xiang/`. The site has no server routes or private runtime keys. All files under `public/` are downloadable, so only public, properly attributed assets belong there.

## Deferred experiments

The previous ChID idiom workspace has been replaced. Its generator and assets remain for future puzzle research but are not fetched by the game. The optional commands `build:charlists`, `build:pools`, `build:chid-scrambles`, `build:chid-scrambles:deep`, and `build:game-data` remain available and require their corresponding local source datasets. Regenerate these experimental assets if using them with a changed decomposition index.

Next steps: playtest challenge pacing and component curation, expand normalization with language review, and design solvable hidden-message puzzles. Reordering, operator-aware composition, and stroke animations are outside this MVP.

## Adding decomposition recipes incrementally

`data/decomposition_extensions.json` contains 16 checked nested recipes. The first batch is 森, 品, 晶, 众, 焱, 磊, 淼, 鑫. The second batch adds mixed pieces: 亲 → 立 + 一 + 小; 具 → 目 + 一 + 八; 婴 → 贝 + 贝 + 女; 拖 → 手 + 人 + 也; 沿 → 水 + 几 + 口; 谷 → 八 + 人 + 口; 贵 → 中 + 一 + 贝; 轻 → 车 + 又 + 工. Try the **Everyday pieces** set for the latter group. For example, the source stores 森 as `⿱木⿰木木`; its reviewed recipe is `["木", "木", "木"]`. This is not a blanket rule that flattens every character to its smallest pieces.

1. Inspect the exact source IDS and identify a complete, useful set of canonical character tiles.
2. Add the exact `ids`, three `children`, and a `reason` to the registry. Keep duplicates: three 木 require three separate tiles.
3. Run `npm run build:data`. The generator checks the source IDS, complete leaf sequence, and validity of every child; a stale or incomplete entry fails generation.
4. Check both directions in `/inspector` (use optional Component C), then run `npm test`, `npm run test:browser`, and `npm run test:motion`.

The two-piece index remains unchanged. Three-piece composition is derived once from loaded decompositions and cached in the browser, so this adds no data requests. Hints prefer pairs, then try triples. Beyond these examples, add small reviewed batches; future work can resolve nested groups to known characters (e.g. 木 + 林) and offer alternate recipes without automatically over-fragmenting characters. Four-or-more-tile and alternate-recipe support needs an explicit rules/UI extension.

Visual copies travel between the source and destination of a transformation over roughly half a second. Real state changes immediately; animation never delays the clock or changes tile counts. Subsequent transformations, scrolling, resizing, reset, and reduced-motion preference changes cancel outstanding motion safely.

## Drag to combine

Drag a tray tile onto another tile to combine them. On touch screens, start from the dotted grip; the rest of the tile still supports tapping and scrolling. Select two tiles using their selection controls, then drag either onto a third for a three-piece recipe. Ambiguous results open the existing chooser. Invalid drops preserve all tiles; dropping outside or pressing Escape cancels. Keyboard selection and Combine remain available. Run `npm run test:drag` for mouse, touch, cancellation, and triple-combination checks.

## Physical playground

The collapsible HSK 1 character picker uses the project's existing Simplified and Traditional HSK 2.0 lists. Clicking a drawable entry adds it to the current board. Its small catalog is fetched only when the picker opens and is generated alongside the other playground assets by npm run build:playground. The lists come from drkameleon/complete-hsk-vocabulary (MIT; see public/data/licenses/HSK-MIT.txt); characters without local stroke outlines are excluded and counted.

Open `/playground` or use **Playground** in the game header. The board starts with five decomposable characters: 想, 相, 明, 休, 好. Choose **Five starters** to reset to that board, use the quick picks, or enter any character with a local Make Me a Hanzi outline. **Explore** puts the character on a one-tile board; **Add** places it in the nearest open, non-overlapping spot while keeping the current board. Reset restores a custom board to the characters and positions it had when its first character was added. The catalog contains 9,565 drawable characters and 8,182 complete pairwise physical recipes from the current source data. A character with an outline but no complete supported mapping can still be explored and moved, but cannot be torn apart. Unreviewed three-or-more-child structures are not flattened into physical recipes. 林 and 森 remain quick picks; 森 unfolds into 木 + 林, and 林 unfolds into 木 + 木, so three 木 pieces can be recombined as 木 + 木 → 林, then 林 + 木 → 森. The physics controls and instructions sit beside the expanded gameboard on desktop and below it on phones. Drag a mapped child away from the character; it stretches first, then tears free only when both same-size tile faces fit on the board and have at least 10 pixels of clearance from each other and every existing tile. The new tile follows its held strokes as you continue the drag; once all active ink contacts release, the tile stays put and the strokes settle back onto it. You can keep decomposing a free child, such as 想 → 相 + 心 → 木 + 目 + 心, while the other pieces stay in the scene. Separated pieces do not attract from a distance. To recombine them, either drag a blank tile face until compatible faces overlap, or hold one piece's ink over the other compatible tile until the strokes reach their relative layout. The tug grows with contact and strengthens as the strokes approach their target; merely touching tile edges does not engage it, and reversed layouts do not attract. The taller board gives separated tiles room to stay visible during a pull.

Use **Surface style** to compare Flat, Raised, and Draped rendering. Raised and Draped place the character ink on a softly beveled, mahjong-inspired tile. Every tile face has the same 156 × 156 CSS-pixel size, including detached and recomposed characters. Raised ink lifts and casts a soft shadow as it is pulled. Draped ink leans toward tabletop height as it is pulled and bends over the tile boundary, with a ground shadow; the same projection is used for hit-testing so the visible strokes remain draggable. During a component pull, the source tile stays in place even in Weighted mode. If the component tears free, its new tile follows the held drag at the position where it separated until release. Once released, unheld ink gently settles toward its own tile's center and orientation unless it is being magnetically aligned for a valid composition; it does not recombine by itself. Start on an unprinted area of the face to grip the whole tile: Weighted moves the tile and ink together with resistance, while Fixed preserves the tile's anchor. This is a fixed-camera 2.5D drawing experiment on the existing 2D physics, not a 3D simulation.

**Fixed** pins the tile's centroid while the ink flexes and mapped pieces can still be pulled off. **Weighted** lets the whole tile shift with resistance and inertia when its bare face is gripped; detached pieces remain easier to move. Ink pulls target components and do not drag the tile along. Mouse, pen, and touch share Pointer Events input, with each contact tracked independently and no app-level finger-count cap. Adjust Softness, nudge, or reset from the controls. Focus the canvas for arrow-key nudges, R to reset, F for fullscreen, and Escape to release grabs. Reduced motion starts from the system preference and keeps the ink rigid while preserving direct manipulation.

The canvas skins sampled stroke outlines to a 49-node lattice with fixed 120 Hz steps, elastic distance constraints, shape restoration, damping, and independent attachments at each active pointer. Complete stroke groups come from Make Me a Hanzi matches. Child anchors are derived from those outlines so the magnet honors the recipe's relative layout, while every standalone tile uses the same normalized glyph scale. Physics runs outside React. `src/lib/wobble.ts` contains the lattice; `src/lib/wobbleComponents.ts` handles compliant tear links and child placement; `src/lib/playgroundWorld.ts` manages tears, multiple free pieces, and magnetic assembly; `src/lib/wobbleDrawing.ts` draws the tile materials, projects the ink, and hit-tests the visible strokes.

The side panel keeps the focused character's pinyin and English definition visible; clicking a tile or ink changes focus, and a successful tear follows the freed component. A successful tear also plays a short synthesized pop. Double-tap or double-click a tile face or one of its strokes to unfold exactly one supported decomposition step. **Tile repulsion** is on by default and can be turned off to compare the subtle short-range nudge between movable tiles.

`public/data/playground/scene.json` is a compact, paths-free catalog and compatible-pair index. The browser requests codepoint-keyed files from `public/data/playground/glyphs/` for visible characters, and `recipes/` for their complete stroke mappings. For each board character, it also prepares that character's direct decomposition pieces, including their eligible next-step recipes and outlines. This lookahead stops there; deeper descendants and unrelated dictionary entries remain lazy. As soon as two free tiles form a valid indexed pair, possible parent recipes and outlines are prefetched while the pieces are still apart. Requests are cached for the page session. The small pronunciation/definition index in `public/data/meta.json` is fetched once for the focus card; it contains no stroke paths. Recreate the catalog and 17,747 per-character files with `npm run build:playground`, using the gitignored `data/makemeahanzi/graphics.txt` and `dictionary.txt`. The builder verifies every included recipe assigns every parent stroke exactly once and emits counts for incomplete mappings. The main game's `decomp.json` and `compose_pairs.json` remain separate eager-loaded indices; the playground does not need to request a decomposition file for each piece. Graphics attribution and the Arphic license are included in the catalog, page, and `public/data/licenses/ARPHICPL.TXT`.

Run `npm test` for simulation/rules checks and `XIANG_TEST_URL=http://127.0.0.1:3001 npm run test:playground` against a running server for bounded preloading, focused dictionary details, double-tap unfolding, tile repulsion, normalized ink scale, surface-style rendering and hit-testing, fixed/weighted response, ink return to the tile, early-release recovery, nested decomposition, four simultaneous touch points, tile- and ink-initiated magnetic pull and snap, reversed-layout rejection, reduced motion, responsive layout, and loading recovery. The canvas exposes `window.render_game_to_text()` and `window.advanceTime(ms)` for repeatable inspection; the latter switches that page instance to manual stepping until reload.

# AGENTS.md — Xiang (想)

## Project intent
Build an educational Chinese character component game web app (CSR-first) where players decompose characters into valid child characters and compose characters from available tiles. The MVP prioritizes a working, testable rules/data pipeline and simple interactions over fancy visuals.

## Source of truth (priority order)
1. `PRD.md` — product goals, scope, success criteria
2. `DECISIONS.md` — design/engineering decisions and rationale
3. `TASKS.md` — execution plan + acceptance tests

If you need to make a new assumption, add it to `DECISIONS.md` before implementing.

## Key constraints & guardrails
- **CSR MVP:** The gameplay UI should be client-rendered and responsive. Avoid per-move server calls.
- **Tiles are valid standard characters:** UI tiles must always display valid Unicode characters (not raw component glyph variants).
- **Controlled unfolding:** Each click applies one supported recipe on either board or tray. Immediate-child recipes are the default; explicitly reviewed nested recipes live in `data/decomposition_extensions.json`. Do not recursively expand every resulting child or accept unreviewed nested structures.
- **Raw dataset is local-only:** Do **not** commit `dictionary.txt`, `graphics.txt`, or tarballs. Use `.gitignore`.
- Keep changes small, reviewable, and runnable.

## Data strategy (Make Me a Hanzi)
We use `Make Me a Hanzi` `dictionary.txt` (JSONL) as the source for decomposition, and derive composition by reverse-indexing decompositions.

### Local input (gitignored)
- `data/makemeahanzi/dictionary.txt`

### Generated outputs (served as static assets)
Generate these into `public/data/`:
- `decomp.json` — `char -> [children...]` (normalized, one-level, valid children only)
- `compose_pairs.json` — `"A|B" -> [parentChars...]` (normalized; include both `A|B` and `B|A` so MVP is order-insensitive)
- `component_freq.json` — `componentChar -> count` (from normalized one-level children)

### Normalization (MVP minimal)
Apply a minimal variant map so component-forms become canonical tile characters:
- 忄→心, 扌→手, 氵→水, 亻→人, 訁→言, 礻→示
(Expand later if needed; record changes in `DECISIONS.md`.)

### Filtering rules (MVP)
- Skip decompositions that start with `？`
- Skip decompositions whose immediate children include `？`
- Only include children that are valid Unicode characters (and after normalization, still single-character)

## Development workflow (make progress visible)
- Work in milestones from `TASKS.md`, keeping each step runnable.
- Prefer a “debug/inspector-first” approach: validate indices in the browser before building game interactions.
- After completing each milestone/subtask:
  - run the relevant command(s)
  - confirm the acceptance checks
  - commit with a short, imperative message

## Commands
- `npm run dev` — start local dev server
- `npm run lint` — lint
- `npm run build` / `npm run start` — production build + run
- Add (or use) `npm run build:data` — generate `public/data/*.json` from `data/makemeahanzi/dictionary.txt`

## MVP implementation priorities
1. **Preprocessing script** (stream JSONL, generate indices, print acceptance checks)
2. **/inspector page** (query decomposition and composition in-browser)
3. Click-to-decompose (board → tray)
4. Compose two tray tiles → board (+ ambiguity chooser)
5. Mode A loop (timer/drip/overflow/time bonus)

## Code style
- TypeScript + Next.js App Router.
- Keep UI simple and readable; Tailwind utilities are fine.
- Avoid premature optimization. Optimize only when a clear bottleneck appears.

## Documentation expectations
- Keep `README.md` updated with exact commands and file locations.
- Update `DECISIONS.md` when making new choices that affect behavior, data formats, or scope.
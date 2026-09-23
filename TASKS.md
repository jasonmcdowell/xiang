# TASKS — Xiang 想

The September 2026 rebuild supersedes the experimental drag/reorder idiom workspace. See `DECISIONS.md` D-014–D-017 for scope and behavior.

## Milestone 1 — Trustworthy data

- [x] Stream Make Me a Hanzi dictionary input; raw files remain gitignored.
- [x] Reject complete recipes with any unsupported child; never truncate nested expressions.
- [x] Normalize the six documented forms and require supported Han character children.
- [x] Generate committed decomp, ordered-pair compose, frequency, and metadata assets.
- [x] Verify 想 ↔ 相 + 心, all reverse-index entries, repeated-child frequencies, and deterministic sorting.
- [x] Fixture-test unknown, nested, absent, malformed, and non-Han children.
- [x] Include upstream attribution and license notices.

Acceptance: `npm run build:data` and data tests pass (8,278 decompositions; 16,092 ordered pair keys).

## Milestone 2 — Inspect the rules

- [x] Cache static data loads and expose shared normalize/decompose/compose functions.
- [x] Dictionary lab at `/inspector`, with labeled inputs and meaningful defaults.
- [x] Pinyin, definitions, normalized inputs, frequencies, and linked candidate inspection.
- [x] Browser verifies 想 → 相 + 心 and normalized 忄 + 相 → 想.

## Milestone 3 — Playable exploration

- [x] Separate board and component tray, with native accessible buttons.
- [x] Board click splits one immediate level into tray tiles.
- [x] Select two distinct tile IDs and combine into a persistent board character.
- [x] Invalid combinations and cancelled/stale choices preserve tiles.
- [x] Scrollable ambiguity chooser, with all candidates and meanings.
- [x] Three sample sets, reset, character addition, one-move undo, hints.
- [x] Field guide, tile pinyin toggle, and discovery collection.
- [x] Keyboard and touch interactions; phone layouts without horizontal overflow.

Acceptance: engine tests and real-browser split/recombine, duplicate, invalid, chooser, undo, and keyboard scenarios pass.

## Milestone 4 — Timed challenge

- [x] 60 seconds, eight initial tiles from four curated recipes, shuffled.
- [x] Six-second arrivals, frequency-weighted within the curated pool and helpful to the tray when possible.
- [x] 12-tile capacity; 13th tile ends the run, including after splitting.
- [x] +3 seconds and +1 point per composition; +1 per first discovery that run.
- [x] Pause/resume, hidden-tab pause, and chronological delayed-tick handling.
- [x] Timeout wins when simultaneous with arrival; no gameplay changes after game over.
- [x] Fresh run and session-only best score; no browser storage required.
- [x] Sticky clock while scrolling, bounded character-board height.

Acceptance: tests cover 100 seeded starts, timer rewards, repeated discovery, pause, overflow, timeout, reset, and delayed-tick equivalence. Browser plays through both end conditions.

## Milestone 5 — Verification and release preparation

- [x] Loading/error/retry UI; browser test simulates failed data fetch and successful retry.
- [x] Browser confirms four initial index requests and zero per-move requests.
- [x] Updated metadata, responsive styling, reduced-motion support, instructions, and README.
- [x] Refresh dependencies within existing major versions; npm audit reports zero vulnerabilities.
- [x] Production build compiles and statically prerenders game and inspector.
- [x] Final browser verification against the refreshed production server, including real touch input, the live clock, hidden-tab pause, and session-only scoring.
- [x] GitHub Pages static export with project-site base path and direct-route output.
- [x] GitHub Actions workflow builds, checks, and deploys only the static `out/` artifact.
- [x] Remove app-controlled persistent browser storage and add a privacy notice.
- [x] Verify public Git history is a clean snapshot with no raw Make Me a Hanzi blobs or personal author email.
- [x] Change `jasonmcdowell/xiang` to public, enable Pages Actions publishing, and verify live routes/assets.
- [x] Publish the Xiang project card from the personal showcase source to `jasonmcdowell.github.io`.

## Deferred

- [ ] Human playtesting and tuning of challenge pacing/curation.
- [ ] More canonical component mappings, reviewed for linguistic accuracy.
- [ ] Solvable Hidden Message puzzles; existing ChID scripts/assets retained as experiments.
- [ ] Operator-aware/multi-tile composition and drag interactions.
- [ ] Stroke animations and richer character formation explanations.

## Follow-up — Animated unfolding and expanded recipes

- [x] Animate board/tray transformations and surviving tiles; keep copies inert and state immediate.
- [x] Cancel motion safely on interruption, scrolling, resizing, reset, and reduced-motion preferences.
- [x] Click composite tray faces to unfold in place; separate + control selects them intact.
- [x] Preserve multiplicity, undo, selection safety, and net tray-capacity checks.
- [x] Add a validated registry of eight nested three-piece recipes and a Three of a kind sample set.
- [x] Support three-tile composition and hint fallback; optional third inspector input.
- [x] Eleven data/engine tests and both browser suites pass on development server.
- [x] Verify final production build and both browser suites; refresh local preview on port 3001.

## Follow-up — Mixed three-piece recipes

- [x] Validate eight additional complete nested structures: 亲, 具, 婴, 拖, 沿, 谷, 贵, 轻.
- [x] Add Everyday pieces sample set without changing the normalization map.
- [x] Verify all input permutations, duplicate components, unfold/recombine/undo, mobile layout, and normalized inspector inputs.
- [x] Build and refresh production preview.

## Follow-up — Drag to combine
- [x] Add mouse/pen dragging and a touch grip, valid/invalid target feedback, and selected-pair dragging for triples.
- [x] Reuse composition, chooser, animation, undo, and challenge rules.
- [x] Verify cancellation, click suppression, native touch gestures, desktop/mobile visuals, and existing browser behavior.

## Follow-up — Single-character physical playground
- [x] Extract one attributed stroke asset without committing raw graphics.
- [x] Render untiled 想 with elastic deformation, grabbing-point attachment, inertia, damping, and bounds.
- [x] Add mouse/touch input, softness, reset/nudge, keyboard/fullscreen, reduced motion, and safe cancellation.
- [x] Verify deformation and settling with simulation and browser tests; inspect desktop/mobile screenshots and run the skill browser client.
- [x] Add a route and game navigation link; validate the existing game and production build.

## Follow-up — Multitouch component pulling
- [x] Derive the complete 相 + 心 stroke groups for 想 from Make Me a Hanzi matches.
- [x] Hold the two ink layers together with compliant seam links; let a sustained pull release one component.
- [x] Track each Pointer Events ID independently with no hard-coded finger limit; contacts on one component share its body.
- [x] Cancel/reset captures safely, apply softness and reduced-motion preferences to every body, and expose component state for inspection.
- [x] Verify four simultaneous touch contacts, per-pointer release, tethering, tearing, settling, and resize recovery in browser automation.
- [ ] Physical Safari testing on the user's iPhone/iPad to measure how many contacts that device reports and tune the pull feel.

## Follow-up — Physical tearing and magnetic assembly
- [x] Derive five complete playground recipes from Make Me a Hanzi: 想, 相, 明, 休, 好.
- [x] Pull a mapped child free with one contact, retain its sibling, and allow a detached composite to be torn again.
- [x] Add fixed-centroid and weighted-parent modes; detached children remain easier to move.
- [x] Attract compatible free components inside a short range, deform held pieces subtly, and snap only in the recipe's correct relative layout.
- [x] Keep unrelated pieces in the scene through nested tears and compositions; preserve horizontal/vertical placement and nested parent scale.
- [x] Verify early-release rollback, nested 想 → 相 + 心 → 木 + 目 + 心, left/right and top/bottom reassembly, wrong-side rejection, four simultaneous touch contacts, resize/retry, and reduced motion.
- [x] Refresh README, metadata, generated scene asset, and browser instructions.
- [ ] Physical Safari testing of tearing and magnetic feel on the user's iPhone/iPad.

## Follow-up — 2.5D tile and stroke materials
- [x] Compare Flat, Raised, and Draped rendering on the playground's reviewed characters.
- [x] Verify visible ink hit-testing while raised and while draped over the tile edge.
- [x] Make bare tile face a whole-character grip in tile styles; preserve Fixed anchoring and weighted movement.
- [ ] Tune bevel depth, stroke relief, and ground shadow from desktop and phone playtests before considering actual 3D rendering.

## Follow-up — Smaller tiles and independent ink pulls
- [x] Give all playground characters equal 184 × 184 CSS-pixel tile faces so more pieces fit on the board.
- [x] Keep the rigid tile surface stationary during ink pulls and ink inertia; move it only from a bare-face grip.
- [x] In Weighted mode, translate the ink with a dragged tile while preserving its shape; Fixed mode keeps its anchor.
- [x] Verify equal dimensions after tears, stationary faces in both physics modes, and whole-tile movement from the face.

## Follow-up — Released ink returns to its tile
- [x] Add a damped center-and-angle spring from released ink to its own tile transform.
- [x] Pause the return while a character is held or a compatible pair is inside the magnetic field; keep Fixed and reduced-motion behavior stable.
- [x] Verify that non-combining ink returns without moving its tile, and that magnetic reassembly still works.

## Follow-up — Tile clearance and reliable reassembly
- [x] Keep the character in a tear preview until new tile faces have visible clearance from each other and every existing tile.
- [x] Keep separated 相 + 心 within a gentle capture range and verify they can snap into 想 from a direct tile drag.
- [x] Verify no-overlap tear geometry for nested and direct tears in browser tests.

## Follow-up — Dynamic physical character data
- [x] Generate a paths-free catalog and one codepoint-keyed outline and recipe asset per eligible character.
- [x] Fetch only visible glyphs, their immediate tear mappings, and compatible parent assets when pieces reach contact.
- [x] Keep the main game's compact decomposition/composition indices eagerly loaded; do not fetch them per move.
- [x] Let players select any drawable dictionary character and clearly leave unsupported physical mappings untorn.
- [x] Verify lazy requests, an arbitrary dictionary-character tear, dynamic composition, production export, and the full playground browser suite against dev and the `/xiang` static export.
- [x] Commit and push the generated assets and UI changes; verify the GitHub Pages deployment.

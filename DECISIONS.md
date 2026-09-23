# DECISIONS — Xiang (想)

This file records key product/engineering decisions and the intent behind them. The goal is to prevent “drift” and help automated agents implement consistently.

---

## D-001 — Vercel + static-data-first architecture (MVP)
**Decision:** Deploy the web app on Vercel and serve gameplay indices as static assets from `public/data/**` (CDN cached). Avoid per-move API calls.

**Why:** Gameplay must feel instant. Serverless round-trips add latency and complexity. Make Me a Hanzi datasets are large, so we preprocess once and ship compact indices.

**Consequences:**
- Requires a preprocessing script
- Client-side rules engine uses indices for validation
- Optional backend only for future puzzle generation/analytics

---

## D-002 — MVP visuals use font rendering (not strokes)
**Decision:** Render tiles using fonts for MVP. Stroke rendering/animation is Phase 2.

**Why:** It reduces scope and lets us ship a playable toy quickly while we validate the game loop.

**Consequences:**
- No stroke-order animations in MVP
- UI remains simple and fast
- We still design the architecture to add stroke data later

---

## D-003 — Phase 2 stroke data via hanzi-writer-data CDN
**Decision:** When we add stroke visuals, fetch per-character stroke JSON lazily from the hanzi-writer-data CDN.

**Why:** Avoid shipping a large monolithic `graphics.txt` or embedding huge stroke assets in serverless bundles; CDN per-character fetch scales naturally with what’s on screen.

**Consequences:**
- Requires a loader with caching
- Needs attribution/licensing review when enabling this feature

---

## D-004 — One-level decomposition only (MVP)
**Decision:** Clicking a board character decomposes it one level deep into its immediate child characters if they are valid.

**Why:** This matches the “toy” feel and avoids over-fragmentation into tiny components. It also aligns with solvable gameplay and reduces complexity.

**Consequences:**
- We skip recursive decomposition for MVP
- Some characters will not decompose if they include unknown components (`？`)

---

## D-005 — Tiles must always be valid standard characters
**Decision:** All tiles shown to players are standard Unicode characters; we do not show raw component glyph forms as standalone tiles in MVP.

**Why:** Keeps the interface legible, searchable, and consistent with learner expectations.

**Consequences:**
- We normalize component variants (e.g., 忄 displays as 心)
- Phase 2 may visually show component forms while keeping canonical identity

---

## D-006 — Variant normalization (MVP minimal list)
**Decision:** Apply a small curated normalization map to convert common component forms to canonical characters for tile identity and indexing (e.g., 忄->心, 扌->手, 氵->水, 亻->人, 訁->言, 礻->示).

**Why:** Prevents confusing tiles that are not standalone characters and supports the rule that tiles must be valid characters.

**Consequences:**
- We will maintain `variantMap` and can expand later
- Some subtle cases are postponed (full coverage is Phase 2+)

---

## D-007 — Composition derived from reverse lookup of decomposition (MVP operator-free)
**Decision:** Implement composition by inverting one-level decompositions:
- For 2-child decompositions, create a reverse map `(A,B) -> [parents...]`.
- MVP ignores operators (⿰/⿱) and treats `(A,B)` as order-insensitive.

**Why:** Make Me a Hanzi is decomposition-first. Reverse lookup yields a reliable, fast way to determine valid compositions without needing layout UI in MVP.

**Consequences:**
- Some inputs can yield multiple parent characters; we show a chooser
- Operator-aware composition can be added later without breaking the data approach

---

## D-008 — Ambiguity shown visually (chooser UI)
**Decision:** If composing A+B yields multiple valid characters, show the candidate results and let the player choose.

**Why:** This is more educational and avoids arbitrary tie-breaks. It also makes the rules transparent.

**Consequences:**
- Need a small popover/modal UI
- Candidate list may be capped and sorted deterministically

---

## D-009 — Mode A core loop: drip + overflow + time bonus
**Decision:** Mode A is a timed challenge:
- Start with a tray of components
- Add a new component periodically
- Tray overflow ends the game
- Successful composition grants extra time

**Why:** Creates pressure and “flow” with minimal complexity, and encourages continuous building.

**Consequences:**
- Must track tray capacity, timers, and run state
- Component pool curation becomes important for fun/solvability

---

## D-010 — Component pool selection uses frequency statistics (MVP)
**Decision:** Compute component frequency from normalized one-level decompositions and use top-K as the initial random pool (with manual curation).

**Why:** Common components are more likely to compose into something useful; frequency provides a simple, data-driven starting point.

**Consequences:**
- Add `component_freq.json`
- Expect iterative tuning (whitelist/blacklist)

---

## D-011 — Start with a “Data Inspector” page before full UI
**Decision:** Build a debug page to query decomposition and composition in the browser before implementing full game interactions.

**Why:** Makes progress visible and reduces debugging time by validating data/indices early.

**Consequences:**
- Adds a simple route (`/inspector`)
- Prevents UI work from hiding data issues

---

## D-012 — Puzzle workspace uses ChID scramble data
**Decision:** Use ChID scramble outputs (`public/data/puzzles/chid_scrambles_v1.json`) to seed the current workspace UI with a 4-character target and a scrambled phrase.

**Why:** It provides a concrete, testable gameplay loop while Mode A is still pending.

**Consequences:**
- Requires `scripts/build_chid_scrambles.js` and `build:chid-scrambles` scripts
- Adds `loadPuzzles()` client fetch and puzzle controls (New/Reset/Reveal)

---

## D-013 — Pinyin + definitions via meta.json
**Decision:** Load pinyin/definitions from `public/data/meta.json` and expose them in the status panel with a Pinyin display toggle.

**Why:** This enriches exploration without changing core rules.

**Consequences:**
- `meta.json` is generated by `scripts/build_indices.js`
- UI exposes an Inspector/Everywhere/Off toggle

---

## D-014 — Refocus the MVP on Explore and Timed Challenge (2026-09-04)
**Decision:** Replace the experimental idiom workspace with a free Explore mode and the PRD's Mode A. Keep prior puzzle generation scripts/assets for later work; idiom puzzles are not part of the new playable MVP. Use separate character board and component tray, resolving the PRD's conflicting workspace and Mode A descriptions in favor of the explicit Mode A loop.

**Behavior:** Click a board character to split one level into tray tiles. Select two tray tiles and compose; multiple parents open a chooser with meanings. This is the primary mouse, touch, and keyboard interaction; dragging is unnecessary for MVP accessibility. Explore starts with 想, 明, 休 and eight useful components, offers sample sets, one-move undo, and character lookup/addition. Challenge starts with 8 tiles, capacity 12, 60 seconds, a tile every 6 seconds, +3 seconds and +1 point per composition, plus +1 for a first discovery in that run. Every valid composition rewards the specified amount, including recomposition; discovery bonus is once per run.

**Why:** Make the core manipulation enjoyable and understandable before advanced puzzles or positional rules. DOM buttons preserve native keyboard and screen-reader support.

## D-015 — Reject incomplete decompositions and raw component forms
**Decision:** Reject an entire decomposition if any immediate child is a nested IDS expression, unknown, or not a unified Han ideograph after the existing six variant mappings. Never silently drop a child. Require children to have entries in the source dictionary, using a second streamed pass; this prevents unsupported component-form tiles. Do not infer a character for nested expressions or expand normalization without evidence. Stable code-point sorting makes generation platform-independent.

**Why:** A reverse index built from truncated children teaches incorrect structures. Being conservative is better than inventing a relation.

## D-016 — Solvable starts, helpful drip, and elapsed-time clock
**Decision:** Select challenge starting tiles from four known two-child recipes, shuffled. Curate familiar parent characters against the generated indices; use frequency to weight components, and prefer drip tiles that pair with the tray. This guarantees starting moves without promising all later boards are solvable. Hints select a real pair without consuming tiles. A monotonic elapsed-time update processes each deadline in chronological order, including delayed/background ticks. Pause freezes both clocks, and hidden tabs automatically pause. A chooser does not pause time. Overflow is checked after additions and splits; the 13th tile ends the run. At simultaneous timeout/drip, timeout wins. Explore has a 48-tile safety limit and 24-character board limit with explicit feedback; challenge board has no artificial cap.

**Persistence:** Save only best challenge score locally, tolerating unavailable storage. No accounts or network calls per move. No automatic public deployment; verify a local production build and leave Vercel-ready code unless deployment is explicitly requested.

## D-017 — Runtime and verification refresh
**Decision:** Keep Next.js App Router and React, update Next.js within major version 16 to the patched 16.3.4 release, and refresh compatible dependency patches. Use system fonts so builds and play do not require Google Fonts. Explicitly set the Turbopack root to this repository to avoid accidentally treating the user's home folder as the project. Use tsx/node:test for rules/data tests and Playwright for real DOM interaction and screenshots.

## D-018 — Incremental nested recipes and three-tile composition
**Decision (user-requested extension):** Keep ordinary immediate recipes conservative. Add a reviewed `data/decomposition_extensions.json` registry for complete nested recipes, starting with 森, 品, 晶, 众, 焱, 磊, 淼, 鑫 (three identical pieces). Each entry records the exact source IDS, children, and rationale. Generation validates the source IDS and all flattened leaves against the proposed children, rejecting mismatches. Unreviewed nested expressions remain excluded. This supersedes D-004/D-015 only for reviewed entries; each click still unfolds one selected recipe rather than recursively expanding every resulting character.

**Composition:** Support two or three distinct tray tile IDs, including repeated characters. Keep `compose_pairs.json` compatible; derive and cache a three-child reverse index from the loaded `decomp.json`, requiring no additional fetch. Hints prefer pairs, then triples. The existing challenge reward is per successful composition regardless of arity.

## D-019 — Unfold tray tiles and animate transformations
**Decision:** A decomposable tile face unfolds on click on either board or tray. Tray tiles have a separate select control so a character such as 相, 日, or 月 can still be combined intact; atomic tile faces also select. Tray unfolding replaces the parent in place. Capacity checks use net tile growth, preserve all pieces, and retain existing challenge overflow behavior. Explore undo restores the full move.

**Motion:** Animate visual copies from source bounds to destination bounds for unfold/combine, and animate surviving tiles into their new positions. Commit rules immediately; decorative copies are inert and never become game tiles. Cancel outstanding motion on new moves, scrolling, resizing, reset or unmount. Respect reduced-motion preferences and restore real tiles when cancelled. Keep the timer running during motion.

## D-020 — Second checked batch: useful mixed three-piece recipes
**Decision (continuation of the decomposition expansion):** Add 亲, 具, 婴, 拖, 沿, 谷, 贵, and 轻 to the explicit extension registry. Each has a complete three-leaf source IDS whose normalized leaves are familiar standard characters, rather than new raw glyph variants. Keep the existing normalization map and generator checks. Add an Everyday pieces exploration set with 亲, 贵, 谷 to make mixed recipes discoverable. Validate all input permutations and exact multiplicity, then exercise the eight new round trips in the browser. These are structural recipes; do not present them as etymologies.

## D-021 — Drag tray tiles to combine
**Decision:** Mouse/pen users can drag a tray tile face onto another tray tile. A dedicated drag grip supports touch dragging while the rest of the tile preserves page scrolling and tap-to-unfold. A movement threshold distinguishes clicks from drags and suppresses the click after a drag. Dropping a selected tile carries its current selected group; dropping a selected pair onto a third tile attempts a three-piece combination. Never consume more than three tiles. Existing chooser, scoring, undo, phase checks and lossless invalid moves apply through one atomic reducer action. Outside/self drops and cancelled gestures leave the game unchanged. Cancel gestures on Escape, pointer cancellation, hidden tab, resize, reset, or phase changes. Selection/Combine remains the keyboard alternative.

## D-022 — Single-character physical demo
**Decision (2026-09-22):** Add a separate `/playground` experiment containing one untiled 想 character. Users can grab different points, drag, stop, and release to feel elastic deformation and inertia. This first demo has no decomposition or composition. Use a compact derived stroke asset from the local Make Me a Hanzi graphics, with its graphics license and attribution; never commit the raw dataset. Draw the outlines on one responsive canvas and deform them with a small simulated lattice. Keep the simulation outside React state and use fixed time steps. Provide mouse/touch input, reset, a keyboard nudge, reduced motion, safe cancellation, and browser-test state/time hooks. The ordinary tile game remains the main route. This deliberately uses one local stroke asset instead of the general CDN strategy in D-003, keeping the demo self-contained and reproducible.

## D-023 — Multitouch component pulling
**Decision (2026-09-22):** Upgrade the physical playground to a supported top-level component experiment for 想 → 相 + 心. A single touch keeps whole-character manipulation. Concurrent touches on different mapped components switch to two coupled ink layers: each contact owns an independent attachment, compliant tethers transfer some force across the component boundary, and sustained separation releases those tethers. A released component and its parent remain independently grabbable. No hard-coded finger count; use Pointer Events IDs for any contacts the device reports. Contacts on the same component deform one shared body. Support pointer-specific release, cancellation of all active attachments on page interruption, and a reduced-motion mode without oscillation. Restrict component membership to complete direct-child stroke matches from local Make Me a Hanzi data. User requested more than two fingers; test up to four concurrent contacts in the browser simulator and on available iOS hardware when possible.

## D-024 — Playground as a decomposition and magnetic-assembly lab
**Decision (2026-09-22):** Keep `/playground` separate from the main game and extend it with a small reviewed set of complete two-child recipes: 想 → 相 + 心, 相 → 木 + 目, 明 → 日 + 月, 休 → 人 + 木, and 好 → 女 + 子. A pointer on a mapped child begins a soft tear preview; crossing the seam threshold turns both children into independent character bodies, and releasing early restores one joined character. This lets the fixed mode demonstrate elastic deformation without translating the character.

**Composition:** Only pairs in the loaded reviewed playground set can attract and snap together. Derive each child's visual scale and anchor from its exact matched stroke outlines inside the parent glyph. Magnet force acts within a short capture field; the held piece deforms subtly while the hand keeps it in place. Snap only when the two component anchors approach the parent's expected relative layout, then replace them with the complete parent at the mathematically aligned center. When both pieces retain a shared nested scale, carry that scale into the reconstructed parent. Preserve IDS order and spatial side (left/right or top/bottom); proximity alone must not compose a reversed arrangement.

**Physics modes:** Default to Fixed. A fixed character keeps its centroid at its spawn point while its ink can stretch; detach-capable components respond more strongly than the remaining character. Weighted releases the centroid, adds inertia, and makes the intact parent resist the pointer more than an extracted component. Free components stay movable in both modes. Keep all simulation client-side and deterministic under the existing fixed-step hook. Do not change game rules or add non-reviewable Make Me a Hanzi structures.

## D-025 — 2.5D tile material experiments
**Decision (2026-09-22):** Add a playground-only visual style selector with Flat, Raised, and Draped modes. Raised and Draped draw a shallow, beveled character tile beneath the ink. Raised strokes gain visible relief and a lift-responsive shadow. Draped strokes follow a simple screen-space surface profile as they are pulled from the tile face and as they cross its edge, settling toward tabletop height; hit-testing uses the same mapping as rendering. In tile styles, a drag on bare tile face grabs the whole character; Fixed preserves its pin, while Weighted lets it move with resistance. Ink stays the target for component pulls. The tile is drawn as a rigid slab while the existing ink lattice remains deformable. Keep the camera fixed and the simulation 2D; do not add a 3D engine or change decomposition, tearing, or magnetic rules in this experiment.

**Why:** Compare the material feel of loose ink on a solid character tile without taking the interaction prototype into full 3D. A separate style control makes the visual trade-off easy to assess in the browser.

**Consequences:** The edge-drape effect is an intentional 2.5D approximation, not a general cloth or 3D collision simulation. All styles share the same stroke hit geometry after projection, so the visible ink remains grabbable.

## D-026 — Uniform tiles with independent ink motion
**Decision (2026-09-22):** In Raised and Draped styles, every character uses the same 184 × 184 CSS-pixel tile face. Keep the rigid tile surface on its own physics body, separate from the deformable stroke lattice. Pulling or releasing ink may deform and move the strokes, but does not carry the tile; only a drag that starts on the bare tile face is a whole-tile grip. Weighted face drags translate the ink and tile together, while Fixed continues to pin the tile at its centroid. Newly detached and recomposed characters keep the same tile size. Keep the magnetic tug gentle at this smaller scale so the player guides the final alignment.

**Why:** Smaller uniform faces make room for more components, and the distinct hit targets make it clear whether the player is moving ink or the character tile.

**Consequences:** Ink can slide or deform relative to its stationary face during a stroke pull, including in Weighted mode. This is intentional physical feedback; a bare-face drag provides rigid whole-character movement.

## D-027 — Released ink settles back onto its tile
**Decision (2026-09-22):** In Raised and Draped styles, when a pointer releases ink and the object is not in an active compatible magnetic interaction, use a damped spring to return the stroke body toward its own tile's current center and orientation. Apply this to intact and detached character objects; each child settles onto its own tile without automatically recombining. Skip the return force while any pointer holds that object, and while a compatible pair is in the magnetic field. The tile itself remains the target and never follows an ink-only pull.

**Why:** The tile and ink are separate physical objects, but an unheld character should naturally settle back onto its face. This makes a pull feel temporary unless the player deliberately tears and recombines pieces.

**Consequences:** A detached piece may slide or rotate relative to its tile during a drag, then settles back if left alone. Magnetic positioning takes priority near a valid composition; Flat style keeps its untiled behavior.

## D-028 — Wait for tile clearance before tearing
**Decision (2026-09-22):** Keep the source character's tile and both ink groups in a tear preview until the seam has stretched and the planned child tile faces have at least 12 CSS pixels of clearance from each other and every existing tile, along either axis. Create the two child characters only after that test passes; while the seam is stretched but the faces would still overlap, keep the strokes attached to the active drag and tell the player to pull farther. Continue to roll back an incomplete tear if all contacts are released first. Set the magnetic capture radius to 220 CSS pixels so a newly separated pair can enter the compatible layout's gentle capture field even when the pull direction differs from its composition layout. Give the mobile playground enough vertical board space for a separated tile pair to remain visible during a pull.

**Why:** Children occupy fixed 184 × 184 faces, so a seam-only threshold can create visibly stacked tiles and can place a newly separated pair outside the existing magnetic range.

**Consequences:** The component stays part of its original ink layer during the extra pull needed to make room; once detached, pieces may begin outside the capture range if pulled farther, and the player can guide them back toward the correct layout.

## D-029 — GitHub Pages project site for the public hobby MVP
**Decision (user-requested):** Publish Xiang as a static GitHub Pages project site at `https://jasonmcdowell.github.io/xiang/`, using the free GitHub plan and a GitHub Actions workflow that builds and deploys only Next.js's `out/` directory. Enable Next.js static export and use `/xiang` as the production `basePath`; leave local development at the domain root. Keep the personal showcase site at `https://jasonmcdowell.github.io/` as a separate Pages site in its existing repository, with a project card linking to `/xiang/`.

**Release history:** The reachable repository history includes old commits containing the local-only Make Me a Hanzi dictionary and graphics. Do not publish that history. Preserve it only in a local private backup and replace the public `main` history with a clean snapshot containing the reviewed current source and generated public assets. Exclude untracked inspiration and Word documents from the public snapshot.

**Why:** Xiang has no server-side features and is a fit for static hosting. GitHub Pages project sites can coexist with the existing account site on separate URL paths, so this does not take over the personal showcase root.

**Consequences:** The public app has no server-side API or private runtime secrets. Public files under `public/` are downloadable. The repository must be public on GitHub Free, and Actions needs only the permissions required to build and publish Pages. Root-absolute public asset URLs must include the configured base path. Pages response headers cannot be customized as on a server-based host.

## D-030 — No non-essential browser storage or analytics in the hobby release
**Decision (release preparation):** Do not save the best challenge score or other game state in browser storage for this release. Keep game state in memory for the current page load. The Xiang app will not set/read cookies, use local/session storage, load analytics or advertising scripts, create accounts, or submit player input to a server. Publish a short privacy page that describes this behavior and explains that GitHub Pages processes visitor IP addresses for hosting security under GitHub's privacy practices.

**Why:** This keeps the toy self-contained and avoids app-controlled non-essential device storage and tracking. GitHub documents IP logging for Pages visits, so the privacy page should make that hosting boundary clear.

**Consequences:** A browser reload resets the best score. If future releases add analytics, ads, cross-visit preferences, accounts, or other browser storage, review the applicable consent and privacy requirements before enabling them; add a consent flow only if the feature set requires it.

## D-031 — Tile overlap gates magnetic pull in the playground
**Decision (2026-09-22):** Compatible loose components exert no magnetic force while their tile faces are separate. Begin pulling their strokes only after the tile-face rectangles overlap by positive area; edge contact alone does not count. Ramp the tug with the smaller overlap depth and increase it as the anchors approach the recipe's correct relative layout. Do not cap the pull by anchor distance once faces overlap, but continue rejecting clearly reversed component order and snap only near the exact layout. This supersedes D-028's long-range capture field.

**Why:** Component pull should be grounded in a visible physical contact between the tiles. Players must move the tiles into contact before the strokes respond.

**Consequences:** Newly separated pieces no longer attract automatically. Players first drag a blank tile face until compatible faces overlap; the strokes then bend or drift together, with more force as the faces overlap further and the strokes approach their target.

## D-032 — Dragged ink can make direct contact with a compatible tile
**Decision (2026-09-23):** Preserve D-031's tile-overlap gate for free, unattended pieces. Also allow an actively held ink stroke to engage a compatible free piece when the pointer enters that piece's tile face. The held ink's penetration into the target face controls the initial tug; stroke alignment still determines the composition layout and snap. The source tile remains anchored during ink drags. Dragging the blank face continues to move the whole tile and uses tile-face overlap as before.

**Why:** With the source tile anchored, a one-finger ink drag cannot move that tile into overlap. Requiring tile overlap alone made stroke-led recombination impossible unless a second contact moved the source tile.

**Consequences:** Players can recombine with one hand by dragging the component's ink onto its compatible tile and guiding the strokes into alignment. A merely nearby drag or a separated, unattended pair still exerts no magnetic pull.

## D-033 — Five-tile playground starter board and expanded lab layout

**Decision (2026-09-23):** Start the physics playground with five separate reviewed characters (想, 相, 明, 休, 好). Keep single-character presets available and add a Five starters reset. Reduce every tile face from 184 × 184 to 156 × 156 CSS pixels, scale the default ink with it, and preserve uniform tile sizing for detached and recomposed pieces. Move setup controls and interaction instructions into a side panel beside the desktop board; stack the panel below the taller board on narrow screens. Remove the “A LITTLE EXPERIMENT IN FEELING” eyebrow.

**Why:** The canvas needs more of the viewport and enough compact, consistent tiles for the intended multi-character exploration loop. Placing lab controls beside the canvas gives the board more height without hiding the controls.

**Consequences:** Initial board tiles are spaced in a responsive two- or three-column layout, and the Five starters preset can be restored after exploring or tearing pieces. A tear commits only when both new faces fit within the board and clear one another and every existing tile. The side panel moves below the board on phones; the board remains tall enough to rearrange several pieces.

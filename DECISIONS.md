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

**Decision:** Select challenge starting tiles from four known two-child recipes, shuffled. Curate familiar parent characters against the generated indices; use frequency to weight components, and prefer drip tiles that pair with the tray. This guarantees starting moves without promising all later boards are solvable. Hints highlight every tile that participates in a valid combination without consuming tiles or identifying a specific group (see D-049). A monotonic elapsed-time update processes each deadline in chronological order, including delayed/background ticks. Pause freezes both clocks, and hidden tabs automatically pause. A chooser does not pause time. Overflow is checked after additions and splits; the 13th tile ends the run. At simultaneous timeout/drip, timeout wins. Explore has a 48-tile safety limit and 24-character board limit with explicit feedback; challenge board has no artificial cap.

**Persistence:** Save only best challenge score locally, tolerating unavailable storage. No accounts or network calls per move. No automatic public deployment; verify a local production build and leave Vercel-ready code unless deployment is explicitly requested.

## D-017 — Runtime and verification refresh

**Decision:** Keep Next.js App Router and React, update Next.js within major version 16 to the patched 16.3.4 release, and refresh compatible dependency patches. Use system fonts so builds and play do not require Google Fonts. Explicitly set the Turbopack root to this repository to avoid accidentally treating the user's home folder as the project. Use tsx/node:test for rules/data tests and Playwright for real DOM interaction and screenshots.

## D-018 — Incremental nested recipes and three-tile composition

**Decision (user-requested extension):** Keep ordinary immediate recipes conservative. Add a reviewed `data/decomposition_extensions.json` registry for complete nested recipes, starting with 森, 品, 晶, 众, 焱, 磊, 淼, 鑫 (three identical pieces). Each entry records the exact source IDS, children, and rationale. Generation validates the source IDS and all flattened leaves against the proposed children, rejecting mismatches. Unreviewed nested expressions remain excluded. This supersedes D-004/D-015 only for reviewed entries; each click still unfolds one selected recipe rather than recursively expanding every resulting character.

**Composition:** Support two or three distinct tray tile IDs, including repeated characters. Keep `compose_pairs.json` compatible; derive and cache a three-child reverse index from the loaded `decomp.json`, requiring no additional fetch. Hints include every tile that participates in any valid pair or triple (see D-049). The existing challenge reward is per successful composition regardless of arity.

## D-049 — Highlight every tile with a composition partner

**Decision (2026-09-24):** The Hint control toggles highlights on every tray tile that participates in at least one currently valid pair or supported triple. It does not choose a pair or reveal which highlighted tiles belong together. Highlights persist while the tray contents are unchanged and clear after a split, composition, challenge arrival, reset, or when the control is toggled off.

**Why:** Players should see where useful material is without losing the discovery of which pieces fit together.

**Consequences:** Derive the eligible tile IDs from the existing pair index and supported three-child decompositions in memory. Do not add network requests. This supersedes the pair-picking hint behavior in D-016 and the pair-first hint policy in D-018.

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

**Physics modes:** Default to Weighted so intact characters can be moved by dragging their blank tile face, with resistance and inertia; extracted components remain easier to move. Keep Fixed available for experiments where a character's centroid stays at its spawn point while its ink stretches. Free components stay movable in both modes. Keep all simulation client-side and deterministic under the existing fixed-step hook. Do not change game rules or add non-reviewable Make Me a Hanzi structures.

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

## D-034 — A newly torn tile follows its held ink until release

**Decision (2026-09-23):** When a tear creates a new character under an active ink drag, its tile follows the average position of that character's active ink pointers while preserving the tile's offset from the pointer at tear time. On the final release, the tile stops at its current position and the ink restores toward that tile.

**Why:** Keeping a tile at the tear point while its character is still being dragged separates the strokes from the object too early and makes the newly created tile feel detached from the gesture.

**Consequences:** A player can continue the same pull after the tear to place the tile without body wobble moving it while the pointer is still. With multitouch, the tile follows the mean pointer position until the last ink pointer on that new character is released; later ink drags keep the tile anchored as before.

## D-035 — A held tear does not receive a launch impulse

**Decision (2026-09-23):** When a tear commits under an active ink contact, initialize that held child's velocity at zero and do not apply the separation impulse to it. The other, unheld child can keep the existing release impulse. Pointer movement supplies the held child's motion; free-body launch energy must not fight the active hand attachment.

**Why:** The old handoff copied the separating body's velocity and added another outward impulse while the pointer was already attached to it. The pinned stroke kept moving through the remaining lattice, and the tile followed that shifting centroid around the board until release.

**Consequences:** A newly created tile follows the held pointer position at the offset where it was torn and stays calm during a stationary hold. When the last pointer releases, it keeps its position and the ink settles toward it.

## D-036 — Pairwise Forest assembly in the physical playground

**Decision (2026-09-23):** Keep the five-character starter board. Add 林 and 森 as selectable single-character experiments. In the physics recipe, group 森's lower nested 木 + 木 strokes as 林, so its reviewed pairwise path is 森 → 木 + 林, 林 → 木 + 木, then 木 + 木 → 林 and 林 + 木 → 森. A composed intermediate remains free while other free pieces remain, so it can take part in another valid composition. Keep the full normalized dictionary indices available to the main game; add a character to the playground only when its outline and complete component-stroke mapping have been reviewed.

**Why:** The physics scene needs exact stroke paths and a clear two-object composition layout. Grouping the existing three-tree decomposition into two valid pair steps makes 林 and 森 explorable without pretending every dictionary entry is already physics-ready or expanding the five-tile starting board.

**Consequences:** `data/decomposition_extensions.json` records the reviewed nested grouping used by the scene generator. The generated playground asset includes 林 and 森 outlines; starter count and layout remain unchanged. An intermediate 林 tile stays interactable while the third 木 waits to form 森.

## D-037 — Keep sibling board characters visible during a tear preview

**Decision (2026-09-23):** While ink is stretching into a tear preview, replace only the selected character's rendered ink with its two deforming child groups. Keep every other board character in the render layers and preserve the board's existing draw order.

**Why:** A tear preview is a temporary view of one character splitting; it should not hide unrelated objects in the playground.

**Consequences:** The existing characters remain visible throughout a drag, while the two child groups continue sharing the source tile face until the tear commits. The browser test checks the rendered-layer character list during a five-tile tear.

## D-038 — Normalize composed characters to the smaller compatible scale (superseded by D-043)

**Decision (2026-09-23):** The initial implementation inferred a composed character's scale from both components' size relative to their embedded layout and used the smaller parent scale.

**Why:** This was intended to prevent strokes from spilling outside a tile when combining pieces of different displayed sizes.

**Consequences:** Testing showed that a component which becomes its own tile should normalize to the same size as every other character. D-043 replaces this inference with one standard scale for starters, detached pieces, and compositions.

## D-039 — Lazy-load physical character data by glyph

**Decision (2026-09-23, updated 2026-09-24):** Generate a compact playground manifest, one outline file per Make Me a Hanzi glyph, and one complete physical recipe file per eligible character. The manifest contains the character catalog and reverse index for eligible component pairs, but no stroke paths. Fetch an outline and recipe when a character enters the board, then prefetch its children’s recipes and the outlines of those recipes' children. Do not recurse through every descendant. When two free pieces on the board form an eligible pair, fetch their possible parent recipe and outline before they touch. A character with an outline but without a complete supported recipe can be explored and moved, but cannot be torn apart. Include every source character with graphics, and every complete two-child mapping supported by the current rules plus reviewed extensions; keep unreviewed three-or-more-child structures out of the physics rules.

**Why:** The local source provides outlines for the dictionary corpus, but the SVG paths account for tens of megabytes. A handful of board pieces should not make the browser download and parse the full corpus. The existing decomposition and composition indices are much smaller and already serve as local lookup tables for the main game, so keep those eagerly available rather than adding a request per move or character.

**Consequences:** `public/data/playground/scene.json` becomes a paths-free catalog and eligible-pair index. Outlines and precise stroke membership are served from codepoint-keyed files under `glyphs/` and `recipes/`. Browser requests are cached for the page session; missing outlines fail with an actionable playground message. The board's immediate decomposition recipes and board-reachable compositions are prefetched; deeper descendants remain lazy. The raw Make Me a Hanzi source remains gitignored.

## D-040 — Add arbitrary characters to the active playground board

**Decision (2026-09-23):** Keep the existing **Explore** action for replacing the board with one character, and add a separate **Add to board** action that appends any drawable dictionary character without clearing the current scene. Place the new fixed tile in the nearest available non-overlapping space; report when a drag is active or no tile-sized space remains. On narrow two-column starter layouts, align the single tile in the last row to one side so another tile can be added in the open slot. Load its outline and any supported stroke recipe on demand. A custom board's Reset returns to the character set and tile positions that existed when the first character was added.

**Why:** Players need to test recombination with their own character choices while preserving the five starters and pieces they've already arranged. Distinct, resettable custom boards make those experiments predictable.

## D-041 — Add HSK 1 as a playground character collection

**Decision (2026-09-23):** Expose the project's existing HSK 1 Simplified and Traditional character lists in a collapsible playground picker. Use the current HSK 2.0 lists from complete-hsk-vocabulary; generate a small static collection index and include only characters with a Make Me a Hanzi outline. Clicking an entry adds it to the active board, preserving the current scene. Show how many source-list characters lack outlines rather than offering unusable entries.

**Why:** A curated curriculum set makes arbitrary character exploration approachable while reusing the existing board-add and lazy glyph-loading paths. The generated availability filter keeps the picker honest about which Unicode characters the physical playground can currently render.

**Consequences:** The default playground board stays five characters. The HSK list is fetched only when opened; Simplified and Traditional remain separate because the lists include different standard characters and variants. Characters with outlines but no reviewed physical recipe can be added and moved, but cannot be torn apart.

## D-042 — Preload one interaction step ahead in the physical playground

**Decision (2026-09-24):** Keep stroke and recipe assets split by character and cached for the page session. For each board character, load its immediate recipe, child outlines, and eligible child recipes plus those recipes' child outlines. Stop after that one lookahead step. Once multiple free tiles can legally compose, load every compatible parent recipe and outline from the pair index even while the tiles are apart. Do not recursively expand all descendants or preload compositions involving anchored tiles that the current physics rules cannot consume.

**Why:** This preserves the lazy-data design while removing pauses from likely next actions: the immediate child can be torn again without waiting for its recipe, and compatible compositions are ready before their tiles touch.

**Consequences:** Data stays local and glyph downloads remain tied to the board's one-step decomposition neighborhood or immediately composable characters. Preloading does not broaden which pairs can compose or which recipes are physically supported.

## D-043 — Give every standalone and recomposed character a standard ink scale

**Decision (2026-09-24):** Use the same default 0.36 glyph scale for starter, detached, added, and recomposed characters. Use embedded stroke geometry only to identify groups and preserve their relative placement during a tear or composition. Keep tile faces a constant 156 × 156 CSS pixels.

**Why:** Preserving the component's fractional size inside its former parent leaves a small glyph on a full-size tile. Scale inference during composition can carry that inconsistency into later cycles.

**Consequences:** A component normalizes to the standard glyph size when it becomes its own tile, and a composition always returns to the standard size. The tear preview still shows the original character's physical stroke layout before separation.

## D-044 — Keep a focused dictionary entry visible during physical interactions

**Decision (2026-09-24):** Add a persistent playground focus card showing the selected character, its pinyin, and its Make Me a Hanzi English definition. Focus follows the tile or ink first contacted; a successful tear focuses the detached character, and composition focuses the result. Reuse the existing compact `meta.json` dictionary index, which contains no stroke paths. Play a short synthesized pop only when a drag successfully commits a tear, after unlocking audio from the user's pointer gesture.

**Why:** Players should be able to connect physical decomposition with pronunciation and meaning, and the newly freed character is the result of the tear gesture. A brief pop gives that state change clear tactile feedback without adding an external audio asset.

**Consequences:** Focus remains visible until another character interaction changes it. The metadata index is fetched once per page, while the much larger stroke corpus remains lazy. A rolled-back pull stays silent.

## D-045 — Add adjustable short-range tile repulsion

**Decision (2026-09-24):** Enable a subtle tile-repulsion option by default. It applies a smooth, short-range force to movable tiles as their faces approach, including loose tiles in Fixed mode and all movable tiles in Weighted mode. A tile under direct pointer control is exempt; anchored Fixed-mode tiles remain anchored.

**Why:** A narrow force field makes nearby pieces feel like physical objects while preserving player control and the Fixed mode's stationary anchors.

**Consequences:** Players can turn repulsion off for a comparison. Compatible stroke magnets retain priority and can still guide pieces into composition.

## D-046 — Support one-step double-tap unfolding on a tile

**Decision (2026-09-24):** A stationary double-click or double-tap on the same character within 500 ms unfolds exactly its next supported two-part recipe. The newly created pieces use the standard scale and must fit without overlapping existing tiles; when there is no room or no reviewed recipe, keep the character intact and explain why.

**Why:** A quick direct action provides an alternative to pulling a component while preserving the rule that each action advances only one reviewed decomposition step.

**Consequences:** This does not recursively expand nested children. The focused entry changes to the first resulting component, which the player can immediately inspect or double-tap again.

## D-047 — Make non-decomposable character ink a whole-tile grip

**Decision (2026-09-24):** In raised and draped styles, dragging ink on a standalone character without a reviewed physical decomposition moves the whole tile. Ink on a loose piece produced by a tear or unfold remains an ink grip so it can be dragged into a composition. For characters with a reviewed recipe, dragging ink continues to pull its mapped component; dragging the blank face moves the tile.

**Why:** A base character such as 女 has no detachable component, so interpreting an ink drag as a deformation leaves the player with no reliable way to move it when the strokes cover most of the tile face.

**Consequences:** Base characters remain draggable from their visible strokes while preserving component tearing for decomposable characters and ink-led recombination for loose components. Flat ink-only mode keeps its existing stroke-drag behavior because it has no visible tile surface.

## D-048 — Allow one-step unfolding from a stroke double-tap

**Decision (2026-09-24):** A stationary double-click or double-tap on a character's strokes unfolds the same single reviewed recipe as a double-tap on its tile face. The gesture targets the character as a whole and does not choose an individual component recipe.

**Why:** Dense glyphs can cover most of a small tile face, so requiring a blank-face double-tap makes the shortcut difficult or impossible to use.

**Consequences:** Stroke pulls still tear on movement; only two quick stationary taps unfold. A browser regression taps an actual mapped stroke to verify the same one-step, non-overlapping result.

## D-050 — Add a persistent three-language site interface

**Decision (2026-09-24):** Offer English, Traditional Chinese, and Simplified Chinese across the game, playground, dictionary lab, and privacy page. English is the first-visit default. Save only the selected interface language in `localStorage` under `xiang-language`; update the document language and tab title when it changes. Keep Make Me a Hanzi pronunciation and definition records in their source form (English definitions), and keep all game rules and character data local.

**Why:** The character game should be usable by English and Chinese readers, and the choice should remain in effect across routes and visits without a language-selection server request.

**Consequences:** The app now uses browser storage for this preference, while game state remains memory-only and no gameplay activity is persisted or sent. The privacy page states this distinction. The static Pages build needs no route or API changes; the language browser check covers both scripts, messages, route changes, and reload persistence.

## D-051 — Offer selectable physical board materials in the Playground

**Decision (2026-09-24):** Add a board-material selector directly below the Playground canvas, independent of the existing Flat/Raised/Draped character surface selector. Offer a bamboo table, one rough-edged slate slab, a traditional 19 × 19 Go board, a compact 9 × 9 Go board, and a rice-paper scroll surface with subtle fiber texture as the additional concept. Draw materials beneath the physics scene so board choice never changes tile placement, hit testing, or character physics. Start on Bamboo table.

**Why:** Distinct table treatments let players compare the same physical character scene against different visual contexts. SVG backgrounds keep the slate silhouette and Go grids crisp at responsive sizes and remain a separate static layer beneath the existing physics canvas.

**Consequences:** Board appearance is a local UI preference for the current Playground visit and is not coupled to game state or character tile material. The selector and its choices follow the site's English, Traditional Chinese, and Simplified Chinese interface setting.

## D-052 — Add a silk-drape pseudo-3D Playground style

**Decision (2026-09-24):** Add a fourth **Silk** surface style alongside Flat, Raised, and Draped. Keep the same square tile-face footprint and existing 2D scene physics, but draw a deeper mahjong-like sidewall. Project ink toward tabletop height when it stretches beyond a supporting tile face, then let it rise back onto the top of any other tile it crosses. Add a soft ground shadow under dropped ink and slightly favor floppy lattice response in this mode. Use the same projection for drawing and stroke hit-testing; keep the effect deterministic, client-side, and independent of decomposition and composition rules.

**Why:** The existing Draped mode bends strokes over their own tile edge, but does not convey a taller tile, a component trailing on the tabletop, or ink climbing onto another tile. A height-based screen-space projection can test that tactile concept without introducing a 3D renderer or changing board geometry.

**Consequences:** Silk is an explicit visual and softness experiment. Tile collision and placement continue to use their existing face footprints; the visible sidewall is a 2.5D extrusion and the ground shadow is an approximation rather than 3D lighting or cloth simulation.

## D-053 — Snapshot Silk support geometry once per frame

**Decision (2026-09-26):** Build the supporting tile poses, rotations, and face bounds once before rendering a Silk frame, then reuse those immutable snapshots for every projected ink point and for stroke hit-testing.

**Why:** The first Silk projection called `WobbleBody.pose()` for every support tile at every sampled ink vertex. `pose()` analyzes the complete deformable lattice, so the work grew with (ink samples × board tiles × lattice nodes) even though each tile's pose stays constant during one draw. A phone-sized, 3× browser profile showed Silk at about 42 fps while Flat, Raised, and Draped held about 60 fps.

**Consequences:** Projection still follows the same tile geometry for drawing and hit-testing, but the per-frame transform cost is linear in tile count rather than repeated for every ink sample. Keep output deterministic and do not cache snapshots across frames, since tiles can move or deform.

## D-054 — Drag unsupported characters as one tile-and-ink object

**Decision (2026-09-26):** If a board character has no supported physical tear recipe, touching any of its ink starts a whole-tile drag in every visual style. The tile and its ink move together, including for detached component pieces; valid decomposable strokes keep their component-tear gesture.

**Why:** Unsupported or terminal characters should not peel away from an empty tile face. Requiring the pointer to also overlap the tile surface makes this fallback unreliable for strokes near an edge or draped below the face. Detached status only means a piece can recombine; it does not create a further decomposition.

**Consequences:** In Flat style the tile itself stays invisible, but its surface body still carries the glyph so the character moves as one object. Players can reposition terminal pieces by their strokes and by their tile face, and can still compose them by moving compatible tiles together.

## D-055 — Split components at source clearance, without tethering the remainder

**Decision (2026-09-26):** During a tear, keep the source tile and the unpulled strokes anchored. Create the two child tiles as soon as their planned faces clear one another and fit on the board; do not wait for unrelated tiles to move or for an empty placement elsewhere. Keep the newly detached tile attached to the held ink until the first release.

**Why:** Tearing should feel like pulling one independent piece away from a fixed character. Making the remaining ink follow the pull suggests it is being dragged too, and requiring a vacant region elsewhere forces an unrelated extra movement before the component can separate.

**Consequences:** A newly created tile may temporarily overlap an unrelated tile. That overlap is allowed during direct manipulation; composition still requires compatible tile overlap and a valid relative layout. The stationary remainder becomes a separate, normally movable tile at commit.

## D-056 — Add animated tile layout, optional grid snapping, and focused hints

**Decision (2026-09-26):** The Playground gets an Arrange tiles action with three modes: preserve scene order and move tiles one at a time, preserve order and move all tiles together, or greedily order tiles by shared immediate recipe components and animate that order into the same row-major grid. The grid fills from its top-left with enough separation to avoid the short-range tile-repulsion field. An optional Snap to grid setting sends a released whole-tile drag or newly detached tile to the nearest unoccupied grid cell; do not snap away a pair that is already eligible for magnetic composition. A focused free tile can show every other loose tile with which a supported composition exists, without selecting a specific pair.

**Why:** The board should remain easy to read as the number of tiles grows. Layout actions make it easier to reset the scene, compare related components, and avoid hand-aligning pieces. A selectable snap keeps casual tile movement tidy without taking away manual placement by default, while hints expose the supported recipe data without solving the pairing for the player.

**Consequences:** Arrangement and snap animations are deterministic client-side motion, pause game-world interactions while active, and finish immediately under reduced motion. Component grouping uses only the already-loaded immediate recipes; it does not imply shared historical etymology. Hints require loose/free pieces and clear when focus changes.

## D-057 — Make tear pop sound optional

**Decision (2026-09-26):** Keep the synthesized pop on successful component tears, but add a Playground checkbox to enable or mute it. Start enabled to preserve the existing sound behavior; rolled-back pulls remain silent.

**Why:** The pop makes a successful physical separation clear, while players should be able to choose a quieter experience.

**Consequences:** The checkbox controls only tear feedback for the current Playground visit and does not affect pointer handling or other interface sounds.

## D-058 — Add Discovery Run as a separate Playground game

**Decision (2026-09-26):** Add a second Playground tab named **Discovery Run**. It starts with one random drawable character from a selected collection (Playground starters, HSK 1 Simplified, or HSK 1 Traditional), then adds another collection character every 10 seconds. The player chooses a 3×3, 4×4, 5×5, or 6×6 cell board, which sets both capacity and tile size. Tiles occupy cell centers on a square Go-inspired board and snap to those cells. Reaching capacity ends the run. Track arrivals and distinct characters outside the selected draw collection that appear on the board; discoveries remain counted after later recombination. Score is arrivals plus unique discoveries. The timer advances only while this tab is active. Keep the existing free-form Playground as its own persistent tab and scene.

**Why:** This adds an endurance game loop that rewards continued decomposition and recombination while preserving the physics lab's open-ended use. Counting discovered characters historically makes exploration valuable even if a player later recombines those pieces.

**Consequences:** Discovery Run state is session-only. Its board layout, draw collection, and score are independent of the Playground controls and board material. The draw collection determines whether a character is a discovery; all character rules and physical assets remain dynamically loaded from the existing local static data. If no valid character fits a required asset load, the arrival is retried without counting a tile.

## D-059 — Add playful board actions and persistent arrangement to Playground games

**Decision (2026-09-26):** Both Playground tabs expose **Blast!**, **Shuffle**, Arrange mode, and **Keep arranged**. Blast sends each tile to an independently randomized in-board position. Shuffle animates tiles along short lifted arcs into shuffled board slots and plays a short sequence of synthesized wooden click-clacks. Keep arranged reapplies the selected arrangement whenever a tear, unfold, composition, manual addition, or timed arrival changes the tile set; if a tile is still held, wait until release. Bring a whole tile to the front of the draw and hit-test order as soon as it is grabbed, and leave it in front after release. Replace the descending tear tone with a sharp attack and a short rising bubble chirp.

**Why:** These actions help players explore tile combinations in both the free-form lab and the survival game, keep an expanding board legible, and make moving or separating tiles feel responsive. A clear topmost dragged tile prevents overlapping faces from hiding the user's active target.

**Consequences:** Blast may create temporary or final overlaps; players can use Arrange to restore regular spacing. Shuffle uses distinct grid positions so tiles do not overlap at rest. Tile animations pause physics and direct interaction until complete, and reduced motion applies them immediately. New sounds are synthesized with Web Audio and require the usual user gesture to unlock playback.

## D-060 — Switch tile writing system independently of interface language

**Decision (2026-09-26):** Add a Simplified/Traditional tile-writing selector to the main Explore and Timed Challenge games and to both Playground tabs. It is independent of the existing English/Traditional Chinese/Simplified Chinese interface-language selector. Changing the selector preserves the current board, tile identities, positions, score, and undo history while converting visible character forms and rebuilding decomposition/composition indices for the selected script. Generate one-character mappings at build time from OpenCC; Playground mappings additionally require a local outline for the destination character. If a converted Playground tile would lose an existing supported physical recipe, keep that tile in its original form rather than silently removing its interaction. Store the mapping as a static asset and cache it in the browser; do not load OpenCC at runtime.

**Why:** Players should be able to explore the same game in either writing system without treating a language setting as a character-data setting or resetting a live board.

**Consequences:** Character-by-character conversion is necessarily context-free, so some characters with multiple lexical or regional forms may remain unchanged or use OpenCC's default mapping. The mapping files and their MIT and Apache 2.0 notices are generated alongside Playground assets. New character assets remain lazily fetched as the board needs them.

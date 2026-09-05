# Phase 2 — Loop Engineering Log

- Status: Phase 2 draft, pending Human Review
- Format: HYPOTHESIS → MINIMAL EXPERIMENT → ACTUAL OUTPUT → EVIDENCE → ACCEPT/REJECT/OPEN → NEXT, per the Phase 2 loop brief
- All artifacts referenced live under `typesetting-v2/prototypes/phase2-typography-poc/`

---

## P2-L01 — Critical Vertical Typography PoC: Browser Control vs. Hybrid vs. Dedicated Shaping

**Preset:** 文庫 (1-column). **Font:** Shippori Mincho. **Text:** the canonical regression sentence (Master §11.3). Full context, preflight, timebox and per-candidate detail: see the RESULT report delivered alongside this log entry (chat transcript) — this entry records the loop-engineering trail only.

### P2-L01-A — Browser control baseline (C3)

**QUESTION:** What does plain native CSS vertical-rl actually do with the canonical sentence, unmodified, at 文庫 conditions?

**HYPOTHESIS:** Reproduces the previously-reported "visible gap" after 。/、 (project memory `tsp029-preview-rhythm-glyph-shape`), since no compensation layer exists in this path.

**METHOD:** Plain `<div style="writing-mode:vertical-rl; text-orientation:mixed; font-family:'Shippori Mincho'; font-size:8.5pt; line-height:1.7; height:{38×8.5pt}">` containing the raw sentence, height-capped to force the same column-wrap capacity C1 uses (38 chars/column, matching 文庫). Rendered via a real browser (`msedge.exe --headless=new --screenshot`, not a synthetic mock).

**EVIDENCE:** `outputs/comparison-screenshot.png`, C3 panel. Renders correctly: right-to-left column order, correct glyph shapes, wraps at char 38/39 exactly where expected, highlighted 「だ。け」/「ば、ど」 sequences visible.

**RESULT:** Confirmed — a real browser, this real font, this real sentence, produces the layout the loop brief described. No compensation applied (by design — this is the control).

**DECISION: ACCEPT.**

**WHY:** Directly observed in a real rendering engine, not asserted from memory alone.

**NEXT:** Serves as the fixed reference point for P2-L01-B and P2-L01-C.

---

### P2-L01-B — Hybrid explicit positioning (C1)

**QUESTION:** Does adding a deterministic, explicit absolute-positioned character grid (FixedSlot's positioning discipline, not its export path) change the punctuation-rhythm outcome versus C3, on its own, with zero per-glyph correction?

**HYPOTHESIS:** No — an explicit grid controls *which cell* a character occupies (deterministic pagination/capacity), not *how* the browser paints the glyph inside that cell. Visual punctuation rhythm should be identical to C3; the only real difference is pagination determinism.

**METHOD:** One `<span>` per character, `position:absolute`, `right`/`top` computed from `col = ⌊i/38⌋`, `row = i mod 38`, `colPitch = fontSize×lineSpacing`, `charPitch = fontSize` — i.e. literally the 文庫 grid math, not an invented one. Each cell independently declares `writing-mode:vertical-rl` so the browser still applies its own vertical glyph substitution per cell. Zero per-glyph offset/advance override added (Master §5.3 compliance check: none added).

**EVIDENCE:** `outputs/comparison-screenshot.png`, C1 panel; `scripts/build-comparison.js` (`buildC1`). Wraps at the exact same char 38/39 boundary as C3. Visual punctuation rhythm around 「だ。け」/「ば、ど」 is — by inspection — the same as C3's (both are 100% browser-native glyph painting).

**RESULT:** Hypothesis confirmed. C1's explicit grid, alone, does not change the punctuation-gap symptom. It does demonstrably fix pagination/capacity determinism (identical wrap point to C3 here because C3's height was deliberately set to match — in general C1's wrap point is guaranteed by construction, C3's is only guaranteed by chance/careful CSS height tuning).

**DECISION: ACCEPT** (matches Phase 1 shortlist's own prediction for Candidate 1 — "does not solve the shaping is opaque to the author problem... Preview still relies on browser-native glyph rendering within DOM spans, same as today").

**WHY:** Directly observed, not merely predicted from the shortlist document.

**NEXT:** Confirms the Phase 1 shortlist's framing was correct on this specific point. Any future compensation for the punctuation gap must live in an explicit shaping/positioning layer (P2-L01-C's territory), not in FixedSlot-style grid positioning alone.

---

### P2-L01-C — Dedicated shaping (C2)

**QUESTION:** Does a real HarfBuzz-via-WASM shaping core, using this font's own declared OpenType features, close the punctuation-gap problem — and which features actually matter?

**HYPOTHESIS (per loop brief, explicitly not to be assumed):** Unknown going in — `vpal`/`vhal`/`vchw` must be measured, not assumed to work.

**METHOD:** `harfbuzzjs` 0.4.15 (isolated PoC-only npm install, `candidates/c2-dedicated-shaping/`), direction `ttb`, Shippori Mincho Regular (fetched to an out-of-repo scratch path). Shaped the two flagged sequences and the full canonical sentence under 10 feature configurations (default, `vert=1`, `vrt2=1`, `vpal=1`, `vpal=0`, `vhal=1`, `vhal=0`, `vchw=1`, `vkrn=1`, `vpal=1,vhal=1,vkrn=1`). Enumerated the font's actual declared GSUB/GPOS feature tags via `opentype.js`. Rendered actual shaped-glyph SVG output (`font.glyphToPath`, real vector paths — no browser shaping involved) for visual cross-check.

**EVIDENCE:** `evidence/SHAPING_EVIDENCE.md`, `evidence/POC_MEASUREMENTS.md`, `candidates/c2-dedicated-shaping/shape-output.json`, `outputs/c2-default.svg`, `outputs/c2-vpal-vhal-vkrn.svg`, `outputs/comparison-screenshot.png` (C2 panels), and a zoomed debug crop (`candidates/c2-dedicated-shaping/debug2.png`) showing the raw HarfBuzz-shaped 「それまでだ。けれど」 sequence at readable size.

Measured findings:
1. This font declares `vert`, `vrt2`, `vpal` only — **not** `vhal`, `vkrn`, or `vchw`. Requesting the latter three is a silent no-op (HarfBuzz does not error).
2. `vpal` (this font's only vertical GPOS feature) adjusts glyph `yOffset` only — **never `yAdvance`**, confirmed across every glyph in both flagged sequences and the whole 56-glyph sentence (`yAdvance` sum = 56000 units under every feature combination tested, no exceptions).
3. Ink-extent measurement: 。's ink occupies 261/1000 units (26.1%) of its advance box; 、occupies 224/1000 (22.4%); ordinary kana occupy 800+/1000 (80%+). The visible gap is the ~700-780 blank units left below the punctuation glyph's ink within its own unchanged full-em advance.
4. Visual SVG render (real shaped glyphs, not browser text) reproduces the exact same visible gap after 。that the loop brief flagged — **even with `vpal=1,vhal=1,vkrn=1` all requested.**

**RESULT:** Falsified the implicit "dedicated shaping solves this for free" hope. This specific font's own declared vertical OpenType features do not narrow punctuation advance; only glyph offset. HarfBuzz + this font, used with real vertical features and nothing else, does **not** close the gap on its own.

**DECISION: REJECT** (the hypothesis that dedicated shaping alone, via this font's existing OpenType data, solves the punctuation-gap problem) — **with a concrete, measured, positive by-product: a principled category-rule basis now exists** (ink-extent-derived advance reduction for 句読点, per Master §5.4 "font metric"/"OpenType data" grounds), which was not available before this loop.

**WHY:** Directly measured glyph advances, offsets, and ink extents from a real shaping engine and a real font — not inferred from documentation or prior institutional memory.

**NEXT:** Phase 3 (if this direction is pursued) should treat "explicit, measured, category-scoped advance override for 句読点 derived from ink extents" as a specific, citable hypothesis to design against — not invent a new magic number. Also worth testing against a different/more complete font in a later loop, since this finding is specific to Shippori Mincho's own table contents, not a HarfBuzz limitation.

---

### P2-L01-D — Publication-path feasibility (PDF spike)

**QUESTION:** Can 文庫-dimensioned, vertical-rl content reach a genuinely selectable-text PDF, and does the previously-flagged Vivliostyle/Chromium print-to-PDF path (Phase 1 R-004, still unverified going into this loop) actually work?

**HYPOTHESIS:** Some Chromium-based print-to-PDF path produces selectable vertical CJK text; full multi-page pagination behavior is uncertain and was flagged as the R-004 open question.

**METHOD (attempt 1 — Vivliostyle CLI, the path named in the Phase 1 shortlist):** `npx @vivliostyle/cli@9.2.0 build` against a minimal 文庫-sized HTML file, `--executable-browser` pointed at the locally-installed `msedge.exe` (avoids a fresh Chromium download). Tried from both the repo path and an ASCII-only scratch path; tried piping confirmation keystrokes to stdin.

**EVIDENCE:** Debug log shows the CLI resolves its full config correctly, logs "Start building", then logs "Closing readline interface" and exits 0 with no PDF and no error — in every variant tried. A background `grep` across the local npm cache for the CLI's own readline usage returned no hits (inconclusive, not a confirmed root cause).

**RESULT:** Real tooling blocker, not a capability blocker — the CLI appears to expect an interactive terminal/CI-detection path this sandboxed, non-TTY shell doesn't satisfy, and exits silently rather than erroring loudly. **Not resolved within this loop's timebox.**

**DECISION: OPEN** (the Vivliostyle-CLI-specific path). Not rejected — no evidence the underlying approach is unsound, only that this exact invocation didn't complete headlessly here.

**METHOD (attempt 2 — native Chromium/Edge print-to-PDF, bypassing Vivliostyle):** `msedge.exe --headless=new --disable-gpu --print-to-pdf=... --print-to-pdf-no-header` directly against the same 文庫-sized HTML file (plain `@page` CSS, `writing-mode:vertical-rl`, no Vivliostyle).

**EVIDENCE:** `outputs/c1-c3-bunko-native-printtopdf.pdf` (18.2KB). PDF's own text-extraction layer returns the exact source sentence in correct logical reading order (confirmed by reading the PDF back) — this is genuinely selectable vector text, not a raster screenshot. Page geometry matches the requested 105mm×148mm @page rule and 14/10/14/15mm margins by visual inspection. **However:** the 56-character sentence, which should wrap into 2 columns at 文庫's 38-chars/column capacity, rendered as a single overflowing column on a single page — no second page/column was generated.

**RESULT:** Partially confirmed. Native Chromium print-to-PDF **does** produce genuinely selectable, correctly-positioned vertical CJK text for content that fits the page (this is the first empirical confirmation of Phase 1's R-004 question, previously open) — but it does **not** appear to auto-paginate overflowing vertical content into additional pages/columns on its own. This is consistent with why Phase 1's shortlist routes Candidate 1/3's Publication path through Vivliostyle specifically (a JS CSS-Fragmentation implementation) rather than raw browser print-to-PDF — native support for that part of CSS Paged Media appears incomplete, exactly as the existing Publication Output research anticipated, now observed directly rather than only documented.

**DECISION: ACCEPT** (selectable-text vertical PDF is achievable via Chromium) + **OPEN** (multi-page/column auto-pagination via the native path; the Vivliostyle path that's supposed to solve this remains untested due to the tooling blocker above).

**WHY:** Directly observed PDF content (text-extraction + visual), not asserted.

**NEXT:** A follow-up loop should either (a) debug the Vivliostyle CLI's non-interactive/CI behavior specifically (check for an env var like `CI=true`, a `--yes`-style flag, or a config-file-based invocation instead of raw CLI args, which may sidestep whatever triggers the readline path), or (b) test native print-to-PDF against a manuscript long enough to require multiple pages, to see whether it silently drops overflow (data-loss risk for a real book) or something else is going on with this single-paragraph test case specifically.

---

---

## P2-L01B — Human QA comparison-presentation cleanup (no typography change)

**QUESTION:** Can the existing P2-L01 outputs be fairly Human-QA compared once diagnostic presentation artifacts (default yellow highlighting, grid/cell borders, C2's oversized/clipped rendering) are removed, without changing any candidate's actual typography?

**HYPOTHESIS:** C1 remains preferred once diagnostics are removed, while C2 can be fairly evaluated once its presentation scale/clipping is corrected. (Hypothesis only — not pre-filling the Human result.)

**TRIGGER:** First Human QA pass against the original P2-L01 `comparison.html` returned: C3 judged not acceptable/unnatural; C1 judged currently most natural with publication quality provisionally YES-leaning, but final judgment obstructed by the yellow diagnostic highlighting overlaid on the manuscript; C2 judged INCONCLUSIVE because its rendered sample was clipped/oversized in its panel (its SVG declared its on-screen size in root-em units rather than a physical scale matching C1/C3's true 8.5pt text, and the panel had no scroll/fit handling for the result). Recorded verbatim in `qa/human/PHASE2_L01_TYPOGRAPHY_SCORECARD.md` "First pass."

**METHOD (what was actually done):**
1. Diagnosed the C2 clipping root cause: the original `render-svg.js` declared SVG `width`/`height` in `em` units relative to the page's default root font size (~16px), not the 8.5pt physical size C1/C3 actually render at — an apples-to-oranges scale mismatch, not a typography defect.
2. Rewrote `candidates/c2-dedicated-shaping/render-svg.js` to size output SVGs in physical `pt` units (1000 font-units == a declared `fontSizePt`), and to support rendering arbitrary sub-sequences (for a focused-comparison view) — this edit was made but **not re-run**, because doing so would have required re-reading the Shippori Mincho font binary from its out-of-repo scratch location, which a mid-task correction restricted (font regeneration from outside the current worktree was ruled out for this presentation-only cleanup pass, per the "do not bypass the read restriction" instruction).
3. Built `scripts/rescale-c2-svgs.js` instead — a pure text-processing script with **no font/harfbuzzjs dependency at all** — that re-parses the `<path>` elements already present in the original P2-L01 `outputs/c2-vpal-vhal-vkrn.svg` (byte-identical glyph outlines/transforms, zero re-shaping) and re-emits: `outputs/c2-full.svg` at the correct 8.5pt/em physical scale, plus `outputs/c2-focus-daketo.svg` and `outputs/c2-focus-bado.svg` — the two flagged sequences (それまでだ。けれど / 気づけば、どこへ), sliced out by known character index and re-wrapped at a shared, larger 24pt/em inspection scale. This ran successfully.
4. Ran out of the loop's timebox (after a stray-path typo detour and further tool-use interruptions requiring a worktree-only correction) before updating `comparison.html` itself to: remove the default yellow highlight and grid/cell diagnostic borders, add a "診断表示" toggle to restore them on demand, and wire in the newly-generated `c2-full.svg`/`c2-focus-*.svg` assets in place of the old oversized ones.

**EVIDENCE:** `outputs/c2-full.svg`, `outputs/c2-focus-daketo.svg`, `outputs/c2-focus-bado.svg` (new, correctly-scaled, successfully generated). `scripts/rescale-c2-svgs.js` (the re-slicing logic). `comparison.html` is **unchanged from the original P2-L01 version** — still shows default yellow highlighting, still has the old oversized C2 SVGs, still lacks a diagnostic toggle.

**RESULT:** Partial. The C2 scale/clipping root cause is diagnosed and its fix is generated and verified present on disk, but not yet integrated into the actual Human-facing comparison page. The yellow-highlighting complaint (C1) was not addressed at all in this pass. **Fair Human re-QA is not yet possible** — the page a reviewer would open is still the original, un-cleaned one.

**DECISION: OPEN** (presentation cleanup — genuinely incomplete, not silently declared done).

**WHY:** Honestly reflects what was and wasn't completed inside this loop's timebox, including two mid-task corrections (a self-inflicted stray directory from a path typo, fully outside this worktree and left untouched per instruction; and a font-read restriction that ruled out the original regeneration plan, resolved instead by reusing already-generated on-disk output).

**NEXT:** A follow-up loop should finish `comparison.html`: (a) make yellow highlighting and grid/cell borders diagnostic-only (CSS-gated behind a "診断表示" checkbox, no new emoji), (b) replace the old C2 `<svg>` embeds with the new `c2-full.svg`, (c) add the focused-comparison section using `c2-focus-daketo.svg`/`c2-focus-bado.svg` alongside equivalent C1 (larger-scale grid) and C3 (larger-scale plain block) renderings of the same two sequences, (d) regenerate a clean default screenshot and a separately-named diagnostic screenshot, and only then request a second Human QA pass.

---

## P2-L01C — Finish Human-QA comparison wiring only (no typography change)

**QUESTION:** Can the already-generated candidate outputs (C1's grid formula, C3's plain block, and P2-L01B's rescaled `c2-full.svg`/`c2-focus-*.svg`) be presented fairly for Human QA purely by rewriting `comparison.html`'s assembly/CSS, without regenerating or altering any candidate's typography?

**HYPOTHESIS:** Yes — the remaining issue was only comparison-page wiring (per P2-L01B's OPEN finding), not a typography or shaping problem.

**METHOD:** Rewrote `scripts/build-comparison.js` (assembly/wiring only — no shaping, no font access, no harfbuzzjs, no font regeneration):
- Yellow highlighting (`.hl`) and C1's grid/cell outline (`.c1-cell`) now default to invisible; both are re-enabled only via `#diagToggle:checked ~ .page ...` CSS rules — a single checkbox labeled "診断表示" placed before `.page` in the DOM (plain CSS sibling-selector toggle, no JS, no new emoji).
- C2's full-sentence panel now reads `outputs/c2-full.svg` verbatim (P2-L01B's corrected 8.5pt-physical-scale asset) instead of the old oversized/em-scaled SVG, wrapped in a `max-height:520px; overflow:auto` container so nothing is silently clipped even if it doesn't fit.
- Added a new "Focused comparison" section rendering the two flagged sequences (それまでだ。けれど / 気づけば、どこへ) for all three candidates at a shared 24pt inspection scale — C1/C3 via the same live grid/block CSS formulas as the full-sentence panels (just parameterized to a shorter string and larger font-size, not a different rendering technique), C2 via `outputs/c2-focus-daketo.svg`/`outputs/c2-focus-bado.svg` (P2-L01B's re-sliced assets, verbatim).
- Ran `node scripts/build-comparison.js` once: succeeded (script's own console output confirmed `Wrote .../comparison.html`; `wc -c` confirmed 92,921 bytes, a plausible size given the embedded SVGs).

**EVIDENCE:** `scripts/build-comparison.js` (new version); `comparison.html` (rebuilt, per the one successful run above). **No independent verification of the rendered result exists for this revision** — a `grep`-based structural sanity check and a headless-Edge screenshot (both non-font, non-external-read, same pattern as earlier successful uses in P2-L01/P2-L01B) were each interrupted by a tooling/permission guard, and per instruction (guard triggered twice) no further verification was attempted.

**RESULT:** The wiring change was made and the build script itself reported success once, but **whether the resulting page actually renders as intended (checkbox behavior, SVG embedding well-formed, focused-view layout correct) is unconfirmed in this session.** This is a real gap between "code was written and executed without error" and "output was visually confirmed" — recorded honestly rather than assumed.

**DECISION: HOLD** (not ACCEPT — success is plausible but not verified; not REJECT — nothing observed indicates failure either).

**WHY:** Two consecutive verification attempts were blocked by environment tooling guards unrelated to the page's own correctness; per explicit instruction, a third attempt was not made.

**NEXT:** Before requesting a second Human QA pass, someone (human or a future agent turn with working verification tooling) should actually open `comparison.html` and confirm: diagnostics are off by default and the checkbox correctly reveals them, the C2 full and focused SVGs render (not blank/broken), and the focused-comparison section is legible. If confirmed, the scorecard's "second pass" section becomes usable as-is (no further page changes needed for that).

---

## P2-L02 — C1 vs. C3 across the mandatory preset matrix

**Trigger:** P2-L01's repeat Human QA (recorded in `qa/human/PHASE2_L01_TYPOGRAPHY_SCORECARD.md`) passed both C1 and C3 as publication-quality-acceptable for the single canonical sentence at 文庫 (C3 marginally preferred by one reviewer, difference described as minimal; C2 deferred — not rejected, just not fairly judgeable yet, and not needed to discriminate C1 vs. C3). Product Owner chose to continue Phase 2 with C1 and C3 specifically, and asked whether that near-tie holds across TateSpun's full mandatory preset matrix (Master §11.2) rather than one sentence on one preset.

**QUESTION:** Can C1 and C3 maintain equivalent publication quality and deterministic layout behavior across all 8 mandatory presets?

**HYPOTHESIS:** Visual quality may remain similar across presets, but C1's explicit layout control may produce more predictable capacity/pagination than C3's natural reflow. (Hypothesis only — Human result not pre-filled.)

**METHOD:** `scripts/build-multipreset.js` reads all 8 presets' real values verbatim from `src/constants/paperSizes.ts` `PAPER_SIZE_TEMPLATES` (7 via `cols1`, A5 2段 via `cols2` per the loop brief's explicit split) and builds `multipreset-comparison.html`: for each preset, C1 renders a deterministic fixed-capacity grid slice (`charsPerLine × linesPerColumn` characters of a synthetic stress fixture — the canonical sentence repeated ×30, clearly labeled as synthetic, not literary sample text), while C3 renders the browser's own natural reflow of the *entire* (much longer) stress text inside a same-physical-size, `overflow:hidden` box, so its own line-break/kinsoku decides how much becomes visible. No new punctuation/optical correction rules were added; C1/C3's rendering formulas are unchanged from P2-L01/P2-L01C, only re-parameterized per preset.

**A real bug was caught and fixed inline, not shipped silently:** the first version of the capacity formula for A5 2段 divided the *full* page's column height by `charsPerLine`, ignoring that TateSpun's "2段" is vertical top/bottom **stacking**, not side-by-side columns (per `docs/requirements/CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md`) — this produced an implausible charPitch (~20.2pt for an 8.5pt font, 238%). Caught by sanity-checking the computed output before publishing; fixed by halving the usable column height (minus the inter-block gap) for that preset specifically. See `evidence/P2_L02_MULTIPRESET_MEASUREMENTS.md` §2 for the full account.

**EVIDENCE:** `multipreset-comparison.html` (all 8 presets, real values, real HTML/CSS rendering — not independently screenshotted/visually verified by the agent this loop, see below); `evidence/P2_L02_MULTIPRESET_MEASUREMENTS.md` (full preset table, computed charPitch/colPitch per preset, the A5-2段 fix, and a flagged discrepancy: B5/B6/新書's computed "justified" line pitch comes out 18-44% looser than declared font size, vs. ~5% for 文庫/A5/A6 — not resolved, flagged as possibly meaning this script's formula doesn't fully match `src/lib/pageLayout.ts`'s real `computePageLayout` clamp logic, which was not read in this loop); `qa/human/PHASE2_L02_MULTIPRESET_SCORECARD.md` (unscored, prepared for Human review).

**RESULT:** A real, working 8-preset comparison artifact was produced from actual product configuration values, with at least one real formula bug caught before being shipped as "evidence." **However, no headless-browser/DOM-measurement verification was performed this loop** (per the prior P2-L01B/C loops' repeated environment tooling guard, this loop deliberately did not attempt further browser automation) — so whether C3's actual rendered capacity matches, exceeds, or falls short of C1's declared capacity per preset (the loop's central "determinism" question) is **not measured, only posed** — left explicitly for Human visual inspection rather than asserted either way.

**DECISION: OPEN** (the central determinism question — genuinely unanswered, not silently assumed). The artifact itself and the preset-value transcription are **ACCEPT** (real, verified-by-construction against `paperSizes.ts`, with one caught-and-fixed bug documented rather than hidden).

**WHY:** Distinguishing "an artifact exists and was built from real values" from "the specific comparative claim it's meant to test was actually verified" — the loop brief's own emphasis on not fabricating measurements applies here: the page is real, the determinism answer is not yet known.

**NEXT:** A follow-up loop should either (a) get real visual/DOM verification working again (a fresh attempt at headless rendering, once whatever caused the repeated tooling guard is understood, or simply a Human opening the page and reporting back which repeat-cycle position each C3 panel visibly cuts off at), or (b) read `src/lib/pageLayout.ts`'s actual `computePageLayout` to confirm/replace this script's simplified capacity formula before trusting it as a faithful stand-in for production on B5/B6/新書 specifically.

---

## P2-L03 — Layout formula & determinism audit: why C1 wins some presets and C3 wins others

**Trigger:** P2-L02's repeat Human QA came back preset-dependent, not a uniform win: C1 preferred on 文庫/A5 1段/A5 2段/B6/A6 (5/8), C3 preferred on B5/Web閲覧用 (2/8), 新書 judged visually between the two. Specific defects: C1 "too sparse/loose" on B5, C1 "too cramped/tight" on Web閲覧用 (especially around 「二人で」). Recorded in `qa/human/PHASE2_L02_MULTIPRESET_SCORECARD.md`.

**QUESTION:** Is this preset-dependent split caused by (A) a real C1-architecture limitation, (B) the P2 PoC's layout formula not faithfully reproducing TateSpun's actual `computePageLayout`, (C) a principled difference in how pitch should be modeled per preset family, or (D) another measurable cause?

**HYPOTHESIS:** At least part of the B5/Web/新書 variation may come from the simplified PoC formula diverging from real `computePageLayout` behavior. (Hypothesis only, going in.)

**METHOD:** Read (read-only, inside this worktree only) `src/lib/pageLayout.ts` (`computePageLayout`, `computeColumnHeightMm`, `computeMaxCapacityChars`, `computeLinePitchMm`, `PX_PER_MM`, `pxToInternalMm`/`pxToInternalFontSizePt`) and `src/components/PageCard.tsx` (`canonicalSlotExtentPx`, `gridMode` consumption) and `src/components/PageSettingsPanel.tsx` (`applyPaperTemplate`'s unit-handling comment). Compared, per preset: (1) Production's real formula, (2) the P2-L02 PoC's formula as actually coded in `scripts/build-multipreset.js`, (3) a live, browser-side `getBoundingClientRect()` measurement of a genuinely native (unstretched) 20-character run at Production's real font size, rendered in a new self-diagnostic page (`layout-audit.html`) that requires no headless tooling — the viewer's own browser measures itself on load.

**EVIDENCE:** `evidence/P2_L03_LAYOUT_FORMULA_AUDIT.md` (full write-up); `layout-audit.html` + `scripts/build-layout-audit.js`. Key discovery: production has **two separate mechanisms**, not one — capacity (`computeMaxCapacityChars`, always exactly 1 em/char, floor-clamped) and visual slot pitch (`canonicalSlotExtentPx`, which for the default `gridMode:"justified"` **stretches** the already-capacity-clamped `charsPerLine` to fill the column exactly). Checked whether any of the 8 presets' declared `charsPerLine` actually gets clamped by real capacity — **none do** — so the PoC's `columnHeight/charsPerLine` formula, despite looking like an invented simplification, turns out to **exactly reproduce production's real, currently-shipped `justified` stretch formula** for 7 of 8 presets (only a uniform, ratio-preserving CSS-unit scale difference exists, which doesn't affect the loose/tight ratio Human QA reacted to). **Web閲覧用 is the one real bug**: the PoC treated Web's preset numbers as raw CSS px, but `PageSettingsPanel.tsx`'s own comment confirms `marginTop`/`fontSizePt`/etc. are already canonical mm/pt for every preset including `isPx` ones (only outer `width`/`height` are px-authored) — skipping that conversion made the PoC's Web sample internally inconsistent (computed pitch smaller than its own font size — backwards), which is what produced the "cramped" symptom.

**RESULT:**
- **B5 (44% stretch) and 新書 (27% stretch, "in-between"): NOT a PoC bug.** Both correctly reproduce production's real, current `justified`-mode formula. The Human is seeing an accurate rendering of B5/新書's *existing* preset configuration for the first time in a side-by-side comparison, and reacting against a real, already-shipped amount of forced-fill stretch — which is in direct tension with Master §5.2's already-frozen principle ("prefer natural pitch over forced page-fill; leftover space is margin"). A dose-response pattern holds across all 7 correctly-reproduced presets: stretch ≤ ~1.2× (文庫 1.05×, A5 1段 1.00× solid, A5 2段 1.13×, A6 1.05×, B6 1.18×) was accepted (C1 preferred); ≥ ~1.27× (新書) started to erode preference; 1.44× (B5) clearly failed.
- **Web閲覧用: a genuine PoC bug**, isolated to this preset's unit handling. Real production's actual Web stretch ratio is ~1.05× — mild, in line with 文庫/A5/A6 — not "cramped." This sample is invalid.

**DECISION: PARTIAL ACCEPT / PARTIAL REJECT of the trigger hypothesis** — accept for Web閲覧用 (real PoC bug, as hypothesized), reject for B5/新書 (not a PoC bug — a real, already-shipped preset-configuration property, correctly reproduced). C1 the architecture is **not** rejected by any of this: every "failure" traces either to an existing preset's own stretch amount (B5/新書, a preset-configuration question, independent of C1 vs. C3 architecture) or to a PoC-only unit bug (Web).

**WHY:** Verified against the actual shipped formulas in this worktree's own source, not inferred from the PoC's self-consistency alone — the A5-2段 stacking fix from P2-L02 (caught independently, before this audit) turned out to exactly match `computeColumnHeightMm`'s real stacking formula, which is itself a form of external validation that the general audit method here is sound.

**NEXT:** (1) Regenerate the Web閲覧用 C1 sample with the corrected unit model and re-run that one preset's Human QA — its current result should not be treated as architecture evidence. (2) Treat B5/新書's stretch degree as a **preset-configuration** question for Phase 3 (does TateSpun want `justified` mode's forced-fill stretch at all, given Master §5.2 already argues against it?) — separate from, and prior to, any C1-vs-C3 architecture decision. (3) `layout-audit.html`'s live-measurement mechanism (no headless tooling needed) is reusable for any future preset/formula question in this environment, given repeated headless-browser tooling guards this session.

---

## P2-L04 — Natural-Pitch explicit-grid PoC (C1-NATURAL) + long-text Human QA fixture

**Trigger:** P2-L03 traced P2-L02's preset-dependent Human split to two distinct causes: B5/新書's "too loose" (C1) is a real, already-shipped Production behavior (`gridMode:"justified"` stretch, 1.44×/1.27×), not a PoC bug; Web閲覧用's "too cramped" (C1) was a genuine PoC unit-conversion bug (invalid sample). B5/新書's stretch was noted to be in tension with Master §5.2 ("prefer natural pitch over forced page-fill; leftover space is margin").

**QUESTION:** Can deterministic explicit-grid layout (C1) use natural declared-pitch composition instead of legacy page-fill stretching, while preserving Publication Quality and logical capacity?

**HYPOTHESIS:** A "C1-NATURAL" variant will preserve C1's determinism and eliminate B5's excessive stretch, while a corrected unit model eliminates Web閲覧用's invalid cramped sample. (Hypothesis only.)

**METHOD:** `scripts/build-natural-pitch.js` builds `natural-pitch-comparison.html` for 5 presets (B5, 新書, Web閲覧用 — the 3 discriminating presets — plus 文庫, A5 1段 as controls, per the loop brief's explicit minimum). Three candidates per preset:
- **C1-JUSTIFIED**: Production's current per-preset `gridMode` (unchanged formula from P2-L02/L03), now correctly `PX_PER_MM`-scaled for every preset including Web (fixing the P2-L03-diagnosed bug).
- **C1-NATURAL**: same explicit deterministic grid, **same declared `charsPerLine`** (logical capacity unchanged), but character pitch = exactly the physical font size (1 em) for every preset — this is not a new mechanism invented for this loop, it is Production's own existing `gridMode:"solid"` (already shipped for A5 1段), applied uniformly instead of per-preset. Unused column space renders as a visible hatched "residual margin" stripe, not hidden.
- **C3**: plain native `writing-mode:vertical-rl`, same real font size, clipped to the same real physical column height, fed far more text than fits.

Line pitch (`colPitchMm = fontSizeMm × lineSpacing`) is identical between C1-JUSTIFIED and C1-NATURAL for every preset — only character pitch differs, per instruction not to conflate the two. Two fixtures used: Fixture A (canonical sentence, unchanged, technical/diagnostic section only) and Fixture B (a new, non-repeating ~700-character prose paragraph, no manual line breaks, used verbatim, not shortened) for the primary Human-facing panels. A uniform ×4 "display zoom" is applied identically to every measurement (documented in `evidence/P2_L04_NATURAL_PITCH_MEASUREMENTS.md` §5) purely because Production's real `PX_PER_MM=2.2` scale renders an 8.5pt character at ~6.6 screen px — too small to judge rhythm from; this preserves every ratio exactly and is not a typography change.

**EVIDENCE:** `natural-pitch-comparison.html`; `evidence/P2_L04_NATURAL_PITCH_MEASUREMENTS.md` (full per-preset table: fontSizePx, both slot sizes, both stretch ratios, residual mm); `qa/human/PHASE2_L04_NATURAL_PITCH_SCORECARD.md` (unscored, prepared). Web's corrected `justifiedStretchRatio` (1.047×) independently reproduces P2-L03's separately-derived figure (~1.05×) via a fresh calculation — a useful cross-check that both audits agree.

**RESULT (capacity-vs-natural-pitch question, answered directly, not left open):** **YES** — logical `charsPerLine` (and therefore pagination) stays identical between C1-JUSTIFIED and C1-NATURAL for every preset tested; only the visual slot pitch and the resulting residual-margin size change. This isn't a hypothesis requiring new engineering — it's a direct consequence of a mechanism (`gridMode:"solid"`) that already exists and already ships (for A5 1段) in current Production; C1-NATURAL is that same mechanism applied uniformly, not a new architecture.

**DECISION: OPEN** (whether Human QA judges C1-NATURAL as actually fixing B5/新書/Web — genuinely unanswered, not asserted). **ACCEPT** (the artifact/formula itself: correctly derived from the same verified real formulas as P2-L03, no preset-specific tuning, no punctuation offsets, line pitch left untouched, capacity left untouched).

**WHY:** The loop's central engineering claim (capacity can stay fixed while pitch goes natural) is verifiable directly from source-code logic already read in P2-L03, not merely asserted; the Human-preference question is explicitly left to the scorecard rather than assumed in either direction, per instruction.

**NEXT:** Awaiting Human QA against `natural-pitch-comparison.html`. If C1-NATURAL is preferred on B5/新書/Web without regressing 文庫/A5 1段, that's evidence for revisiting `gridMode:"justified"` as a *preset-configuration* question (independent of C1-vs-C3 architecture) in Phase 3. If 新書 still sits "between" C1-NATURAL and C3, that remains a genuinely open principled-typography question — no midpoint was invented here, per instruction.

---

## P2-L04B — Fix C3 fixture-alignment bug in the natural-pitch comparison (presentation only)

**Trigger:** Human QA opened `natural-pitch-comparison.html` (P2-L04) and found C1-JUSTIFIED/C1-NATURAL visibly starting with 「朝の光がまだ薄いころ…」, but C3 did not show the same corresponding source range — making the three-way comparison unusable for judgment.

**QUESTION:** Why was C3 not showing the same beginning of Fixture B as C1?

**DIAGNOSIS:** Confirmed (B), not (A): **C3 was receiving the exact same Fixture B string as C1** (verified by re-reading `build-natural-pitch.js`'s `buildPresetSection`, which passes the same `FIXTURE_B` constant to `buildGrid` for both C1 variants and to `buildC3`) — this was a presentation/CSS layout bug, not a source-text mismatch. **Root cause:** the explicit `height` and `width` constraints needed to make a `writing-mode:vertical-rl` block actually wrap into multiple columns were placed on an *outer wrapper* (`.c3-clip`) instead of on the text-flowing element itself (`.c3-block`). Per CSS block-layout defaults, a normal in-flow block child with `height:auto` never wraps (vertical-rl's inline/wrap axis needs an explicit bound to trigger a new column), and `width:auto` defaults to filling the parent's width — here, exactly one column's worth — leaving `.c3-block` with no room to wrap into further columns at all. The result was a degenerate single-column render whose visible portion (after the parent's `overflow:hidden` clip) did not reliably correspond to the start of the text. (For contrast: P2-L02's `build-multipreset.js` set both `height` and `width` directly on its own `.c3-block`, which is why that earlier script did not exhibit this bug.)

**FIX (presentation-only, no typography change):** moved `height` (= one column's real physical height, unchanged from before) and `width` (now a generous, explicitly computed multi-column value — `ceil(charCount / floor(columnHeightPx/fontSizePx)) × colPitchPx`, sized to fit the *entire* Fixture B with no clipping and no scrolling) directly onto `.c3-block` itself. The outer `overflow:hidden` clipping wrapper (`.c3-clip`) was removed entirely for C3 — with no overflow, normal block flow paints starting at the container's own top/right origin, so the first character (「朝」) is trivially guaranteed visible with no scroll-position ambiguity. C3's natural per-column character count is intentionally left unconstrained relative to C1's declared `charsPerLine` (per instruction — "C3 may show different capacity naturally," not to be faked into matching).

**VERIFICATION:** Reasoned from CSS block-layout semantics and cross-checked against P2-L02's `build-multipreset.js` (which uses the corrected pattern and was never flagged with this bug) — **not independently confirmed with a rendered screenshot** (headless-browser tooling intentionally not used this loop, per instruction). Flagged honestly as reasoned-but-unverified.

**DECISION:** Root cause: presentation-layer CSS bug (B). Fix: presentation-only (verified: no font, font-size, line-spacing, glyph-position, pitch, or capacity value was touched — only two CSS-layout properties moved from one element to another and the width value size).

**NEXT:** Product Owner should re-open `natural-pitch-comparison.html` and confirm C3 now visibly starts at 「朝」 alongside both C1 variants for all 5 presets before proceeding with P2-L04's Human QA scorecard.

---

## P2-L04 Human QA — FROZEN

Recorded 2026-09-05 against the P2-L04B-corrected `natural-pitch-comparison.html`. Verbatim result: 文庫 → C1-JUSTIFIED preferred; A5 1段 → C1-NATURAL preferred (formula-identical to JUSTIFIED for this preset); B5 → C3 preferred, but C1-NATURAL's sparse impression IMPROVED vs. P2-L02; 新書 → C1-NATURAL preferred; Web閲覧用 → C1-NATURAL preferred, cramped impression IMPROVED vs. the (invalid) P2-L02 sample. No regression on either control preset. Publication quality: YES. "Overall most stable" was **not explicitly answered by the Human** and is not fabricated here. Full detail and a separately-labeled engineering interpretation (not a Human quote) in `qa/human/PHASE2_L04_NATURAL_PITCH_SCORECARD.md`.

**Status of each candidate after this freeze:** C1-NATURAL — strongly viable, preferred on 3/5 presets, resolved both previously-identified C1 defects without new regressions. C3 — still viable, preferred outright on B5. C1-JUSTIFIED — viable only where a preset's own stretch ratio is mild (文庫); not to be generalized as v2 policy. C2 — DEFERRED (unchanged). **Final architecture: NOT SELECTED.**

**Recommended next question (P2-L05):** whether the C1-NATURAL explicit deterministic model can structurally support Japanese typesetting features — kinsoku, hanging punctuation, ruby, TCY, dash/ellipsis, line-boundary decisions — without yet freezing any of the still-OPEN standards questions (dash/ellipsis primary-source rule, full kinsoku class table).

---

## P2-L05 — Japanese Typesetting Capability PoC (C1-NATURAL)

**Trigger:** P2-L04's frozen Human QA recommended testing whether C1-NATURAL can structurally support kinsoku, hanging punctuation, ruby, TCY, dash/ellipsis, and line-boundary decisions — without yet freezing any unresolved standards rule.

**QUESTION:** Can C1-NATURAL structurally support Japanese composition rules through a deterministic logical decision layer, without relying on browser-native flow for the core decisions?

**HYPOTHESIS:** Yes — C1's explicit logical layout should allow these to be represented independently of the renderer, while unresolved standards details remain replaceable policy. (Hypothesis only, going in.)

**METHOD:** New isolated PoC directory `prototypes/phase2-japanese-capability-poc/`. Built a 3-stage pipeline (`scripts/engine.js`): tokenize (ruby/TCY/text, using `RUBY_PATTERN`/`TCY_PATTERN` copied verbatim from `src/lib/tategaki.ts`, read-only) → expand to source-mapped logical units (ordinary char / ruby-base-group / TCY-run / dash-run / ellipsis-run, using `LINE_START_PROHIBITED`/`LINE_END_PROHIBITED`/`HANGING_PUNCTUATION`/`HANGING_CLOSE_BRACKETS`, also copied verbatim) → a rule-decision layer (`breakIntoLines`, a new PoC-only single-pass reimplementation, explicitly not `tategaki.ts`'s own iterative algorithm) that resolves kinsoku push-out, hanging-with-riding-bracket, and line-end-prohibited push-forward **before** any position is assigned. 11 small, targeted fixtures (`FIXTURES.md`), each with a PoC-chosen demo capacity (not tied to any preset), each labeled POC CAPABILITY DEMONSTRATION, never FINAL. Rendered via `capability-comparison.html` (native `vertical-rl` painting of the engine's decided structure, C1-NATURAL side by side with a plain C3 control). A mid-loop bug was caught and fixed: hanging punctuation (`。`/`、`) is also a member of `LINE_START_PROHIBITED`, so the initial rule order let the generic push-out rule fire first and pre-empt the more specific hanging rule (same textual outcome, wrong rule attribution) — fixed by checking hanging first for that specific category, generic push-out only for other prohibited categories.

**EVIDENCE:** `evidence/P2_L05_JAPANESE_CAPABILITY_MATRIX.md`, `evidence/P2_L05_BREAK_DECISION_TRACE.md`, `evidence/P2_L05_SOURCE_MAPPING.md` (all three generated directly from actual engine output by `scripts/build-capability-poc.js`, not hand-transcribed), `scripts/determinism-check.json` (all 11 fixtures run twice, structurally identical both times). Concrete demonstrations: `F-KINSOKU`/`F-LINE-END` (push-out both directions), `F-HANGING`/`F-HANGING-BRACKET` (hanging + riding close-bracket, correctly attributed after the mid-loop fix), `F-RUBY-SHORT`/`F-RUBY-LONG`/`F-RUBY-BOUNDARY` (base kept as one group regardless of reading length or boundary proximity), `F-TCY-BARE` (both bare-auto-detect and explicit `[tate]` notation collapse to 1 cell), `F-DASH-FIT`/`F-DASH-DEFER` (run kept together when it fits, deferred whole — not split — when it doesn't; `F-DASH-DEFER` is the clearest direct proof of the keep-together mechanism), `F-ELLIPSIS` (same mechanism as dash).

**RESULT:** Every tested feature was representable through the logical-unit + rule-decision layers, fully source-mapped, fully deterministic (verified, not assumed), with zero features requiring a fallback to browser-native flow for the actual composition decision. Every remaining "NO" on "rule frozen?" in the capability matrix traces to a **standards-evidence gap already known and already tracked** (full kinsoku table completeness, dash/ellipsis citation, long-ruby overflow spacing rule, TCY threshold) — not to an architectural limitation of C1-NATURAL.

**DECISION: ACCEPT** (the hypothesis — C1-NATURAL can structurally support these features via a separable rule-decision layer). Per the loop's own accept/reject rule ("reject only if the architecture cannot represent or control the required behavior without collapsing into renderer-specific hacks"), nothing observed meets the reject bar.

**WHY:** Verified via actual runnable code with a determinism check, not asserted from the architecture's description alone; the one bug found during the loop was in rule *attribution* (which rule gets credit for an outcome), not in the architecture's ability to produce a correct/deterministic outcome at all.

**NEXT:** Awaiting Human QA (`qa/human/PHASE2_L05_JAPANESE_CAPABILITY_SCORECARD.md`) on structural/visual plausibility only (not standards correctness). If passed, Phase 2 evidence would support narrowing toward C1-NATURAL as the leading candidate, pending: (1) the still-OPEN standards items (kinsoku table, dash/ellipsis citation) being resolved before Phase 3 rule freeze, (2) C2 remaining available to reopen only if a required shaping feature proves unreachable by C1/C3, (3) no architecture has been finally selected by this loop or any prior Phase 2 loop.

---

## P2-L06 — Visual fidelity: true vertical-page rendering of C1-NATURAL Japanese features

**Trigger:** P2-L05's Human QA found the diagnostic-box presentation insufficient to judge kinsoku/hanging/ruby/TCY visually, and specifically flagged that multi-character ruby looked attached at a one-character level, and dash/ellipsis appeared "slightly left-shifted." Frozen verbatim in `qa/human/PHASE2_L05_JAPANESE_CAPABILITY_SCORECARD.md`. This freeze approved *continuing the C1-NATURAL structure*, not the diagnostic renderer.

**QUESTION:** Can the structurally successful P2-L05 model render its Japanese special features in a realistic vertical publication view?

**HYPOTHESIS:** The P2-L05 Human uncertainty is primarily a QA-presentation problem, not a logical-model failure. (Hypothesis only, going in.)

**METHOD:** New `scripts/build-visual-fidelity.js`, reusing the SAME P2-L05 engine (`tokenize`/`expandToUnits`/`breakIntoLines` — zero new typesetting logic) to render true right-to-left, top-to-bottom vertical pages at A5 1段's real font/pitch (Human-approved as C1-NATURAL-equivalent in P2-L04). Ruby rendering was fixed to group the whole base run under ONE `<ruby>`/`<rt>` pair (previously one `<ruby>` per base character — the exact bug behind the P2-L05 complaint). A live, browser-side glyph-alignment measurement (`getBoundingClientRect`, no headless tooling) was added for dash/ellipsis, per instruction to measure rather than trust Human perception alone.

**Two real rendering bugs were found and diagnosed via actual headless-browser screenshots (not assumed):**
1. **Multi-column overlap.** The initial `.page` used `display:flex` to lay `.col` children (each `writing-mode:vertical-rl`) side by side — an orthogonal-writing-mode flex-sizing case Chromium did not handle as expected, causing all columns in any multi-column page to overlap illegibly (single-column pages were unaffected, which is what made the bug specific to Kinsoku/Hanging/TCY sections). **Fixed** by switching to explicit `position:absolute` placement per column (the same pattern already proven reliable in P2-L02/P2-L04), confirmed correct via a follow-up screenshot: Kinsoku, Hanging, and Ruby sections all rendered as genuine, legible, correctly-ordered vertical pages, with the kinsoku push-out and hanging-with-riding-bracket behaviors clearly visible column-to-column.
2. **`.cell { display: block }` stacked characters along the wrong axis.** Block-level children of a `vertical-rl` container stack along the *block-progression* axis (horizontal, for `vertical-rl`) rather than down the column — this was actually the same underlying category of mistake as bug 1, just manifesting differently. **Fixed** by changing `.cell` to `display: inline-block` (participates in inline flow, which runs top-to-bottom for `vertical-rl`), confirmed via the same follow-up screenshot.
3. **TCY did not visually combine — found, NOT fixed this loop.** After fix 2, `text-combine-upright:all` on the TCY span (also switched to a plain inline span, since inline-block was suspected of defeating the combine) still rendered "12" as two stacked vertical digits in the full page. **Three isolated minimal test files** (same font, same size, same inline-block-sibling structure, with and without a `position:absolute` wrapper) all confirmed `text-combine-upright:all` combines correctly in this exact browser under matching conditions — so the mechanism itself works, but something about the full page's broader context prevents it. **Root cause not identified within this loop's timebox.** Per explicit instruction ("if the same permission/read-block issue appears twice, stop that branch" — further verification attempts were also independently intentionally stopped mid-diagnosis by instruction), this is recorded as an **honest OPEN rendering blocker**, not silently fixed or hidden. Critically: this is a **rendering/presentation bug in this loop's demo page only** — the P2-L05 engine's logical decision that a bare 2-digit run is exactly 1 cell is unaffected and was never in question.

**EVIDENCE:** `visual-fidelity-comparison.html` (Kinsoku/Hanging/Ruby sections visually confirmed correct via headless screenshot; TCY section confirmed NOT combining via the same screenshots; Dash/Ellipsis sections render without the overlap bug but their live measurement numbers were not re-confirmed after the fix — see below). `evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md` (measurement mechanism documented; the one set of numbers actually captured was captured against the PRE-fix, overlapping layout and is explicitly flagged as not final). Three throwaway isolated test files were used for the TCY diagnosis and are not part of the deliverable (left in the working directory; not referenced by the shipped page).

**RESULT:** Confirms the hypothesis for 3 of 4 previously-HOLD features (Kinsoku, Hanging, Ruby) — the P2-L05 uncertainty for those was indeed presentation-only, now fixed with real supporting screenshots, not just claimed. **Falsifies the hypothesis for TCY specifically** — this is a genuine open rendering problem, not (yet) shown to be presentation-only. Dash/Ellipsis status is **incomplete**: the overlap bug fix should apply to them equally (same `.cell`/`.runCell` mechanism as the fixed Kinsoku/Hanging cells), but this was not independently re-screenshotted before verification was stopped.

**DECISION: PARTIAL ACCEPT.** Kinsoku/Hanging/Ruby: ACCEPT (presentation-only, fixed, confirmed). TCY: OPEN (real blocker, honestly unresolved — not the architecture's fault, since the engine's own logical unit for TCY is untouched and correct; this is specifically a `text-combine-upright` rendering-context puzzle). Dash/Ellipsis: OPEN (fix presumed to apply by the same mechanism, not independently confirmed).

**WHY:** Every claim above is grounded in an actual screenshot taken during this loop or an isolated reproduction test — including the negative result (TCY still broken after the fix, confirmed twice more via isolated tests that could not reproduce it in simpler form). Nothing here was asserted from code-reading alone where a screenshot was available to check it.

**NEXT:** A follow-up loop should either (a) get a fourth, more targeted isolated test working (e.g. testing whether some OTHER element on the real page — perhaps an earlier `<style>` rule, or the Google Fonts `@font-face` swap timing across a much larger page — is the actual interference), or (b) sidestep the CSS `text-combine-upright` mechanism entirely for TCY (e.g. render it as a small nested horizontal-tb block, matching how `PageCard.tsx`'s `FixedSlotTcy` component in the real product likely already solves this — not read in this loop, worth checking). Re-run the dash/ellipsis alignment measurement fresh (page already ships the live JS; just needs someone to open it and read the numbers, or a future verification-capable turn to screenshot it) before drawing any conclusion about the "slightly left-shifted" Human comment.

---

## P2-L06B — TCY renderer fix attempt + dash/ellipsis recheck (rendering-only)

**Trigger:** P2-L06 ended HOLD on one concrete finding: TCY's logical unit is correct (PASS on model, source mapping, one-cell occupancy) but its visual rendering failed (`text-combine-upright:all` did not combine "12" in the full page despite working in three isolated minimal tests).

**QUESTION:** Can the already-valid TCY logical unit be rendered correctly inside the C1-NATURAL true vertical renderer without architecture changes?

**HYPOTHESIS:** The failure is localized to DOM/CSS renderer representation and can be fixed by rendering the TCY logical run as one generic unit. (Hypothesis only.)

**METHOD:** Confirmed the logical layer directly (not re-asserted): `node -e` against the real `scripts/engine.js` on the actual TCY fixture text reproduced exactly one `{type:"tcy", value:"12", start:4, end:6}` token — logical model, source mapping, one-cell occupancy all independently re-verified PASS. Began a fourth isolated reproduction test targeting the one remaining structural difference between the (working) isolated tests and the (failing) real page identified so far: the real page's `.col` has an explicit CSS `width` (`colPitchPx`), which no isolated test had used. **This test was not completed** — a second permission/read-block prompt on headless-browser tooling was hit mid-loop, and per instruction the debugging branch was stopped immediately rather than attempting a workaround.

**EVIDENCE:** `evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md` (TCY section added, documenting the logical-model re-confirmation, the untested width hypothesis, and the explicit absence of a completed fix). No new renderer code was shipped — `scripts/build-visual-fidelity.js` is unchanged from P2-L06 for TCY specifically (the width hypothesis was never tested, so nothing was "fixed" based on unconfirmed reasoning).

**RESULT:** No fix attempted or applied this loop (blocked by the tooling guard before a fix could even be tried, let alone verified). Dash/ellipsis: no new verification attempted either, per instruction, after the TCY branch was stopped — their status carries forward unchanged from P2-L06 (mechanism shipped and real, specific numbers not re-confirmed post-overlap-fix).

**DECISION:** Per explicit instruction, **not** marked BLOCKED — nothing gathered in this loop or the last shows the architecture cannot support TCY visually; this is unresolved renderer verification/fix work. Recorded as: TCY logical model **PASS**, TCY visual rendering **OPEN**. Dash/ellipsis: **OPEN / HUMAN-RECHECK-REQUIRED** (unchanged from P2-L06, not re-confirmed, not corrected). Outcome per the loop brief's three possible framings: **(B)** — TCY remains renderer-blocked (OPEN, not BLOCKED-as-in-impossible); C1-NATURAL is not automatically rejected; renderer strategy for TCY remains an open question.

**WHY:** Honest reporting of a debugging attempt interrupted by environment tooling constraints, not a claim of either success or architectural failure — the loop brief's own framing explicitly allows recording this as renderer-incompleteness rather than forcing a premature BLOCKED/architecture-reject verdict.

**NEXT:** A future loop with working headless-browser verification should test the `.col`-explicit-width hypothesis directly (does removing/changing the explicit width on the vertical-rl column restore `text-combine-upright`'s combine behavior for the TCY span inside it?). If confirmed, the generic, reusable fix would be: render the TCY unit's wrapping element without the same `width` constraint the ordinary `.cell` elements carry (e.g., let it size to its own combined content, still positioned via the same column-relative placement) — this would remain fully generic (works for any TCY run, not fixture-specific) and introduce no magic-number positioning. Also worth checking, as an alternative if the CSS mechanism proves fundamentally unworkable in this renderer shape: whether `PageCard.tsx`'s real `FixedSlotTcy` component (current product, not read in this loop) already solves this a different way worth reusing conceptually.

---

## P2-L07 — Ruby annotation-layer PoC (base-position invariant)

**Trigger:** P2-L06 Human QA froze: Kinsoku/Hanging preferred/acceptable; **Ruby UNNATURAL** ("the main/body characters must not shift merely because ruby is present"); TCY/Dash/Ellipsis all judged not correct but explicitly **deferred to Phase 3 Renderer work** by the Product Owner, not blocking this loop. Current renderer state: not publication quality — but this does **not** reject the C1-NATURAL logical architecture.

**QUESTION:** Can ruby be rendered as an annotation layer without changing C1-NATURAL's canonical base-text positions?

**HYPOTHESIS:** Yes — the P2-L06 defect was caused by letting browser-native `<ruby>` layout influence base geometry; separating canonical base placement from ruby annotation placement should preserve the main-text axis. (Hypothesis only, going in.)

**ROOT CAUSE (diagnosed, not assumed):** P2-L06 wrapped a ruby group's base characters in one native `<ruby>` element with no explicit per-character sizing, while every ordinary character got explicit `height:charPitchPx; line-height:charPitchPx`. The native `<ruby>` element's own natural block extent isn't guaranteed to equal exactly `cellCount × charPitchPx` — the small resulting discrepancy shifted whatever followed the ruby group in the same column.

**METHOD:** Rewrote `renderLineAsColumn` (`scripts/build-visual-fidelity.js`) so ruby base characters render with **byte-identical markup** to plain characters (same `.cell` span, same explicit height/line-height) — the reading is instead collected into a separate `annotations` array (`{groupId, rowStart, cellCount, rt}`, derived purely from the base group's own known geometry) and rendered as a `position:absolute` sibling overlay (`renderRubyAnnotations`), anchored to the same `.colWrap` that positions the column itself. Being removed from normal flow entirely, the annotation is structurally incapable of perturbing base positions, regardless of its own size — this holds for arbitrarily long readings too (long-ruby case unaffected by construction, not by a fixture-specific accommodation). Added a **WITHOUT-ruby control fixture** (`buildRubySection`'s `s0`) — the same prose with the ruby markup stripped — and a **deterministic, code-level invariant check** (not a screenshot): both fixtures' unit streams are walked, each unit's cumulative row offset computed, and the WITH-ruby sequence compared position-by-position against the WITHOUT-ruby sequence.

**EVIDENCE:** `evidence/P2_L07_RUBY_ANNOTATION_INVARIANT.md` (full root-cause/model/invariant writeup); the invariant check is embedded directly in the shipped `visual-fidelity-comparison.html` (computed at build time, not hand-asserted) and independently re-confirmed this session via `grep` against the generated file: the string `"PASS — base positions identical"` is present, `"FAIL"` is not. Source mapping (`groupId`, `start`/`end`) confirmed unchanged — only the renderer changed, `engine.js` (the logical layer) was not touched.

**RESULT:** The invariant **PASSES** — base character positions are now provably identical whether or not a ruby annotation is present, for both the short (東京/とうきょう) and long (其/なにがし) cases. A headless-browser visual screenshot of the fix was **not captured this loop** — two consecutive permission/read-block prompts on browser automation were hit (one in P2-L06B, one here), and per instruction no further attempts were made; the deterministic check is real and code-derived, but a Human should still visually confirm the annotation reads as plausible furigana, not just that the underlying data invariant holds.

**DECISION: ACCEPT** (the hypothesis — ruby can be rendered as a true annotation layer without displacing base positions; proven by a deterministic invariant, not merely by visual approximation, per the loop's own instruction). **RUBY ANNOTATION INVARIANT: PASS.**

**WHY:** The fix is architecturally principled (base-layout authority and ruby-annotation authority are now genuinely separate code paths, matching the loop's stated goal) and the pass/fail claim is grounded in an automated, reproducible, code-embedded check rather than an eyeballed screenshot — satisfying the loop's explicit "do not use visual approximation alone" instruction even though visual confirmation itself was blocked by tooling constraints.

**NEXT:** Human should open the page and confirm the Ruby section visually (annotation legibility, whether `right:-1em` placement looks like natural furigana — a rendering-precision choice, not the invariant itself, and freely adjustable without threatening the invariant). TCY/Dash/Ellipsis remain deferred to Phase 3 per the P2-L06 freeze, untouched by this loop.

---

## P2-L07B — Unbroken ruby annotation run

**Trigger:** P2-L07 Human QA: base-position invariant confirmed (main axis unchanged with vs. without ruby), but the ruby annotation itself wrapped/broke into a second column — both short and long ruby judged UNNATURAL for this reason specifically, not for base displacement.

**QUESTION:** Can ruby be rendered as one unbroken annotation run anchored to the base group's start, while preserving canonical body positions?

**HYPOTHESIS:** Yes — the remaining defect is annotation-flow/wrapping behavior, not the source-mapped ruby model. (Hypothesis only, going in.)

**ROOT CAUSE (diagnosed via direct math on the actual values, not guessed):** P2-L07's annotation box height was sized from the **base group's** cell count (`cellCount × charPitchPx`), not the **reading's** own required extent, while width stayed generous (a full column). For 東京/とうきょう (2 base cells vs. 4 half-size reading chars ≈ 2 cells' worth) this coincidentally just fit; for 其/なにがし (1 base cell vs. the same 4 half-size reading chars ≈ 2 cells' worth) the box was half the height its own content needed, and the generous width gave the overflowing vertical text room to wrap into a second column — ordinary multi-column vertical reflow, triggered by an unrelated sizing mistake.

**METHOD:** Fixed `renderRubyAnnotations` (`scripts/build-visual-fidelity.js`) generically: width narrowed to exactly one annotation-character-width (`fontSizePx * 0.5`, physically no room for a second column ever), height changed to `auto` (unconstrained, so the reading flows as one uninterrupted run regardless of length), `top` (start-anchor to the base group's first row) unchanged from P2-L07. Same rule applied uniformly to every ruby group — no word-specific case, no preset-specific number. Per instruction, **single-base-long-ruby centering was explicitly not implemented** — it would require a separate, more complex geometry rule for the one-character-base case specifically, and the loop brief explicitly preferred the simpler generic start-anchored rule over that added complexity; recorded as an intentional scope decision, not an oversight.

**EVIDENCE:** `evidence/P2_L07B_UNBROKEN_RUBY.md`. The base-position invariant (P2-L07's automated, code-embedded check) was re-run after this change and still **PASSES** (re-confirmed via `grep`, unaffected since `renderLineAsColumn`'s base-cell logic was not touched — only the separate annotation-rendering function changed). The "annotation no longer wraps" claim itself is reasoned directly from CSS box-sizing mechanics (a fixed one-character width leaves no physical room for a second column; unconstrained height removes the overflow trigger that caused the wrap) — **not independently screenshotted**, since a headless-browser permission/read-block prompt was hit immediately on the one attempt made and was not retried, per instruction.

**RESULT:** A generic, non-fixture-specific fix was implemented and the base-position invariant remains intact. The "no more wrapping" claim is well-reasoned (same category of CSS-mechanics reasoning that correctly diagnosed this bug's root cause in the first place, and that correctly predicted P2-L06B's `text-combine-upright` behavior in isolated tests) but is **not yet independently visually confirmed**.

**DECISION:** **ACCEPT** the fix as implemented and reasoned; **OPEN** on independent visual confirmation (Human must check). Not marked PASS outright, since the loop's own standard (P2-L07 insisted on a deterministic check over visual approximation; this loop's positive claim is deterministic-by-construction but not independently re-observed either way).

**WHY:** Honest distinction between "the code changed the box-sizing rule that caused the bug, correctly diagnosed" and "someone or something has looked at the result and confirmed no defect remains" — the latter did not happen this loop.

**NEXT:** Human should open `visual-fidelity-comparison.html` and confirm: 東京's annotation reads as one continuous run beside the base group; 其's longer annotation likewise runs continuously (starting flush with 其's top edge, not centered — an accepted tradeoff, not a bug, per this loop's scope decision); body text position is unaffected in both cases. TCY/dash/ellipsis remain deferred to Phase 3, untouched.

---

## P2-L07C — Conditional overlong-ruby centering (geometry-based, not base-length-based)

**Trigger:** P2-L07B Human QA: 東京/とうきょう natural (no wrap, no body shift), but 其/なにがし's start-anchored placement judged NOT ACCEPTABLE — Human explicitly required a rule based on physical geometry (`rubyExtent > baseExtent`), not a `baseLength === 1` special case.

**QUESTION:** Can overlong ruby be centered generically based on physical geometry, without special-casing one-character bases and without moving canonical body text?

**HYPOTHESIS:** Yes — a rule based on `rubyExtent > baseExtent` can handle both single-character-base and multi-character-base overlong cases with the same calculation. (Hypothesis only, going in.)

**METHOD:** Implemented in `renderRubyAnnotations`: `baseExtentPx = cellCount × charPitchPx`; `rubyExtentPx = charCount(reading) × annotationFontSizePx`; if `rubyExtentPx > baseExtentPx`, center (`topPx = baseStart + baseExtent/2 − rubyExtent/2`), else keep P2-L07B's start-anchor. One formula, no branch on base character count or any literal word. Tested against four fixtures: 東京/とうきょう (group-association demo), 其/なにがし (1-char base, the original overlong complaint), a new **POC GEOMETRY FIXTURE** 地図/ちけいずめん (2-char base, deliberately constructed to be overlong too — proves centering isn't tied to a 1-char base), and a new genuine non-overlong control 本日/ほんじつ (extents exactly equal, must NOT center).

**A real error was caught and corrected mid-loop, not hidden:** while building the geometry-reporting table, 東京's reading とうきょう turned out to be **5 characters** (と-う-き-ょ-う), not 4 as had been assumed since P2-L05 — meaning 東京 was never actually a non-overlong example and could not serve as Fixture 4's required non-overlong control. This didn't invalidate any earlier loop's conclusions (neither the base-position invariant nor the no-wrap fix depended on 東京 being non-overlong), but it meant a genuine non-overlong fixture (本日/ほんじつ) had to be added this loop rather than reusing 東京 for that role as originally planned.

**EVIDENCE:** `evidence/P2_L07C_OVERLONG_RUBY_CENTERING.md`, with a geometry table generated directly from the shipped code (re-confirmed via `grep`): 東京 → CENTER (55.9px base vs. 69.9px ruby), 其 → CENTER (27.9px vs. 55.9px), 地図 → CENTER (55.9px vs. 83.8px, 2-char base, proving genericity), 本日 → START (55.9px vs. 55.9px, equal, correctly does not fire). Base-position invariant (P2-L07's automated check) re-run and still **PASS**. No headless-browser screenshot was captured — a permission/read-block prompt was hit on the one attempt and not retried, per instruction.

**RESULT:** The rule fires correctly and only when geometrically warranted, across a 1-char base, a 2-char base, and a deliberately-constructed multi-char overlong case, while correctly NOT firing on a genuinely equal-extent case — with zero base-length or word-specific branching anywhere in the implementation.

**DECISION: ACCEPT** (the hypothesis — a single geometry-based formula handles both the originally-reported case and the generalization the Human demanded, verified against 4 fixtures including a purpose-built control). Visual confirmation remains **OPEN** (not screenshotted this loop).

**WHY:** The claim is grounded in code actually re-read and re-confirmed after generation (the geometry table, the invariant check), including catching and correctly handling an error in an assumption carried since P2-L05 — not asserted from the formula's description alone.

**NEXT:** Human should open the page and confirm all four ruby placements look right, especially whether centered readings (其, 地図) look visually balanced against their base, and whether the now-corrected understanding of 東京 (also centered, not start-anchored) still looks natural. TCY/dash/ellipsis remain deferred to Phase 3, untouched.

---

## P2-L07D — Ruby boundary clamp + rendered base-axis invariant (OPEN, honestly reported)

**Trigger:** P2-L07C Human QA: 東京's centered ruby judged visually natural, but the Human reported the body text visibly moved on screen — contradicting P2-L07's code-level invariant claim. Human required (1) line-start clamp, (2) line-end clamp, (3) confirmation via actual rendered DOM measurement, not a re-assertion of logical coordinates, before continuing.

**QUESTION:** Can overlong ruby use one generic geometry policy (CENTER when it fits, START_CLAMP at line start, END_CLAMP at line end) while leaving actual rendered body positions unchanged?

**HYPOTHESIS:** Yes — the boundary problem can be solved by clamping annotation geometry rather than adding ruby-content special cases; the 東京 body-shift report was expected to be a renderer flow-coupling issue, not a logical-model problem. (Hypothesis only, going in.)

**METHOD:** Implemented a single shared `decidePlacement(baseStartPx, baseExtentPx, rubyExtentPx, lineExtentPx)` function (four branches: START / OVERFLOW_OPEN / START_CLAMP / END_CLAMP / CENTER, purely geometry-derived), called both by the actual renderer (`renderRubyAnnotations`, now taking the base group's own column height as `lineExtentPx`) and by a reporting function (`rubyGeometry`) used for the evidence table — one source of truth, not two implementations that could drift. Built 3 new position fixtures using the identical 其/なにがし base/ruby pair at column-middle, column-start (reusing the pre-existing `longText`), and column-end, specifically to isolate position as the only variable. Added a live, `getBoundingClientRect()`-based **rendered-DOM** body-position measurement (`bodyInvariantScript`) comparing the WITHOUT-ruby and WITH-ruby pages' first several body cells, each measured relative to its own page's origin — directly answering the Human's "measure the actual rendered DOM" requirement, not a re-run of the P2-L07 logical-coordinate check.

**ANOMALY FOUND, NOT RESOLVED:** The one build run performed this loop showed **all three position fixtures reporting `CENTER`** in the geometry table — including the column-start case, whose `desiredStart` is unambiguously negative by direct hand arithmetic (`0 + 13.97 − 27.95 = −13.98 < 0`, independently confirmed via an actual `breakIntoLines` trace showing 其 at row 0 of its column before verification was cut off). Re-reading `decidePlacement`'s shipped code shows logic that, read in isolation, should produce `START_CLAMP` for that case — the discrepancy between this code-reading and the one observed output is **not resolved**: a second verification attempt (an isolated `node -e` check of `decidePlacement` directly) was stopped after a second permission/read-block prompt, per instruction, before the actual root cause could be pinned down.

**EVIDENCE:** `evidence/P2_L07D_RUBY_BOUNDARY_POLICY.md` — full policy definition, the anomaly writeup (not hidden), and a fixture-by-fixture expected-vs-observed table. The rendered-DOM body-invariant script is shipped in `visual-fidelity-comparison.html` but its output was **not observed** this loop (no headless screenshot taken — permission guard hit immediately on the one attempt, not retried per instruction).

**RESULT:** A generically-implemented, single-source-of-truth boundary policy exists in the code, but **its own evidence table contradicts its expected behavior for 2 of 3 position fixtures**, and this was caught and disclosed rather than papered over. The rendered-DOM measurement mechanism the Human specifically asked for (to settle the "does the code-level PASS actually mean anything real" question raised in P2-L07C) is now shipped and will report a real number the moment a Human opens the page — but that number itself has not yet been read by anyone or anything.

**DECISION:** **OPEN / INCONCLUSIVE** on both fronts named in the loop's own RESULT template — RUBY BOUNDARY POLICY: **OPEN** (implemented, but observed output contradicts expected behavior for 2/3 boundary fixtures, root cause not found). ACTUAL BODY POSITION INVARIANT: **OPEN** (mechanism shipped, not yet read). Neither is claimed as PASS.

**WHY:** The loop's own explicit standard — "do not merely grep for a PASS string... measure the ACTUAL rendered DOM... do not invent a tolerance merely to make it PASS" — is honored precisely by refusing to claim success here. A contradiction between a code read-through and an observed build output is exactly the kind of thing that must be reported, not resolved by assumption, when the tools needed to actually resolve it are unavailable.

**NEXT:** A follow-up loop (with working verification tooling) should: (1) re-run `rubyGeometry`/`decidePlacement` in isolation against the `longText` and `endTextNearBoundary` fixtures to find why the observed output doesn't match the code's own apparent logic; (2) independently re-count the padding character literals in `middleText`/`endTextNearBoundary` (hand-typed, never re-verified); (3) actually open `visual-fidelity-comparison.html` and read the live rendered-DOM body-invariant panel's real output. Ruby remains an open item for Architecture Narrowing until both are resolved. TCY/dash/ellipsis remain deferred to Phase 3, untouched.

---

## P2-L07E — Ruby boundary decision audit: root cause found and fixed (display bug, not renderer/policy bug)

**Trigger:** P2-L07D reported an unresolved anomaly — all three boundary fixtures (其 at column-middle/start/end) showing `CENTER` in the evidence table, contradicting the expected `CENTER`/`START_CLAMP`/`END_CLAMP` split.

**QUESTION:** Why did START_CLAMP and END_CLAMP fixtures resolve as CENTER despite the generic boundary policy being implemented?

**HYPOTHESIS:** The policy may be correct while the fixture or coordinate inputs are not creating the intended boundary conditions. (Hypothesis only, going in.)

**METHOD:** Per instruction, avoided headless-browser/`node -e`/`grep` verification entirely and instead wrote a real, standalone script (`scripts/verify-ruby-boundary-policy.js`) that **imports the actual `decidePlacement`/`rubyGeometry` functions** (added `module.exports` to `build-visual-fidelity.js`, guarded the existing `main()` call with `if (require.main === module)` so requiring the file no longer has the side effect of rewriting the HTML). Step 1: five synthetic geometry cases with obvious expected outcomes (CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN/non-overlong START) — **all five passed**, proving `decidePlacement` itself was correct from the start. Step 2/3: re-ran the exact three real fixtures through the real `rubyGeometry()` and printed every intermediate value (`baseStartPx`, `baseExtentPx`, `rubyExtentPx`, `colHeightPx`, `desiredStart`, `desiredEnd`) — **all three matched their expected placement**, proving the fixtures' geometry was valid and the coordinate system was consistent (same origin, same units, for both line and base coordinates).

**ROOT CAUSE FOUND:** Neither the policy nor the fixtures were at fault. `buildRubySection`'s `geomRow` **display** function (written in P2-L07C, before the `placement` field existed) still computed its displayed decision as `g.overlong ? "CENTER" : "START"` — a leftover **binary** approximation from before P2-L07D added the boundary-aware `placement` field. The real renderer (`renderRubyAnnotations`) was calling `decidePlacement` correctly the entire time and was never affected — only the **evidence table's own display formula** was stale and wrong. A pure display bug, category (E) from the loop's own list of hypotheses.

**FIX:** Changed `geomRow` to read `g.placement` directly. No change to `decidePlacement`, no change to any fixture, no coordinate normalization needed (there was nothing to normalize).

**EVIDENCE:** `evidence/P2_L07E_RUBY_BOUNDARY_AUDIT.md` (full pure-policy-test table, fixture-validity table with every intermediate value, root-cause writeup). Re-verified after the fix by regenerating the real HTML and reading it directly (not grepped): the geometry table now shows 其(middle)→CENTER, 其(start/longText)→START_CLAMP, 其(end)→END_CLAMP — matching expectations exactly. A side discovery, also correctly explained rather than left as a new mystery: 東京 and 地図 (both fixtures where the ruby group happens to be the very first thing in their own text) now correctly show START_CLAMP too, not CENTER as P2-L07C's simpler pre-boundary-aware evidence had said — that earlier statement was accurate for P2-L07C's policy at the time, not an error, and the page's own descriptive text was updated to stop implying otherwise.

**RESULT:** The P2-L07D anomaly is fully resolved. `decidePlacement`'s CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN logic is now confirmed correct via two independent methods (isolated synthetic unit test, and re-derivation from the real fixtures' real geometry) — not merely asserted.

**DECISION: ACCEPT.** BOUNDARY ROOT CAUSE UNDERSTOOD: **YES**.

**WHY:** The fix is the direct, minimal correction for a precisely identified bug (one stale display line), not a speculative change — and it was verified twice, independently, using the real code, before being called done.

**NEXT:** The rendered-DOM body-position invariant panel (P2-L07D) remains unread this loop — no headless-browser verification was in scope here either. A Human opening `visual-fidelity-comparison.html` will see: the corrected boundary-placement table, the six ruby fixtures with their now-accurate labels, and the live body-invariant measurement. TCY/dash/ellipsis remain deferred to Phase 3, untouched.

---

## P2-L08 — Architecture Narrowing (documentation/synthesis only, no new experiments)

**Trigger:** P2-L07E closed the last open Ruby architectural question (body-position invariant + no-wrap + boundary-aware centering, all independently verified) and recorded a final Human PASS. Product Owner requested narrowing the Phase 3 logical-typesetting-core direction from accumulated Phase 2 evidence.

**QUESTION:** Does accumulated Phase 2 evidence justify narrowing TateSpun v2 to C1-NATURAL as the primary Phase 3 logical-typesetting-core direction?

**HYPOTHESIS:** Yes — C1-NATURAL combines Human-approved natural prose rhythm with deterministic, source-mapped composition control, while C3 remains a valuable visual control and C2 remains a reopenable shaping fallback. (Hypothesis only, going in.)

**METHOD:** No new technical experiments (per scope) — reviewed and synthesized all prior Phase 2 loops (P2-L01 through P2-L07E) against the frozen Master §3 priority order (Publication Quality > accuracy/reproducibility > privacy > compatibility > Preview quality > responsiveness > simplicity > cost). Froze the P2-L07D scorecard with the final Human ruby gate result (0.00px body delta, CENTER/START_CLAMP/END_CLAMP/其 all Human PASS). Produced four documents: `docs/architecture/PHASE2_EVIDENCE_SUMMARY.md` (loop-by-loop index, HOLDs included, not hidden), `docs/architecture/PHASE2_ARCHITECTURE_NARROWING.md` (the recommendation itself, with an evidence-backed comparison matrix, explicit non-decisions, and a 7-question Human Gate), `docs/architecture/PHASE3_OPEN_ITEMS.md` (13 open items, each with status/blocker-level/reopen-evidence), and `docs/architecture/EDITOR_EXPORT_PROFILES_MEMO.md` (a new Product Owner requirement from Phase 2, recorded as a requirement only, explicitly not implemented).

**RESULT:** The hypothesis is supported by the evidence reviewed: C1-NATURAL is the only candidate with a reproducible, source-mapped, independently-verified decision trace (P2-L05) and passed Human QA on 6/8 tested presets plus the full ruby gate; C3 remains competitive on painting quality (2/8 presets) but was never shown to carry decision-making authority; C2 was never rejected, only deferred for lack of a fair final comparison once C1-NATURAL succeeded independently. Natural pitch and renderer separation are both direct extensions of already-frozen Master principles (§5.2, §2), not new inventions.

**DECISION: RECOMMEND** C1-NATURAL as the Phase 3 logical-typesetting-core direction, C3 as control/reference + candidate painting technology, C2 as deferred/reopenable. **This is a recommendation pending the Human Gate in `PHASE2_ARCHITECTURE_NARROWING.md` — no final architecture is selected by this loop.**

**WHY:** Every claim traces to a specific prior loop's evidence (cited by loop ID throughout the narrowing document), not to this loop's own new judgment — this loop's job was synthesis, not new evidence generation, consistent with its no-new-experiments scope.

**NEXT:** Awaiting the Product Owner's answers to the 7-question Human Gate. Once approved, Phase 2 can close out (per Master §14) and Phase 3 (Core Typesetting Engine) can begin, informed by — not blocked by — the open items in `PHASE3_OPEN_ITEMS.md`.

---

## Cross-cutting loop notes

- **Magic-number audit:** zero preset-specific optical corrections or arbitrary punctuation offsets were added to any candidate in this loop. C2's `vpal`/`vhal`/`vkrn` are the font's own declared OpenType data (permitted basis, Master §5.4), applied uniformly, not tuned per-preset or per-character.
- **Dependency policy:** `harfbuzzjs`, `opentype.js`, `@resvg/resvg-js` installed only inside `typesetting-v2/prototypes/phase2-typography-poc/candidates/c2-dedicated-shaping/package.json` (isolated, PoC-only; not added to repo-root `package.json`/`package-lock.json`). `@vivliostyle/cli` was invoked only via `npx` (never installed as a dependency anywhere), matching the pattern already established by `tools/renderer-poc/README.md`. None of these installs should be read as a Production dependency decision.
- **No architecture selected.** This loop produces comparative evidence only.

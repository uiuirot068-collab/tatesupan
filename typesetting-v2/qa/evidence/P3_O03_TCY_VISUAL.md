# P3-O03 — TCY Visual

## 1. Verdict

**PARTIAL.** The standard CSS mechanism for 縦中横 (`text-combine-upright: all`) is now wired into the P3-O09 Preview Renderer, applied only to the already-canonical TCY unit's own text, inside its already-fixed canonical box. All machine-verifiable structural properties (DOM nesting, stylesheet declaration, atomicity, coordinate invariants, interaction safety) are PASS. **VISUAL confirmation in a real browser is not independently confirmed** — Phase 2's own P2-L06B evidence found this exact CSS mechanism failed to visually combine in a full-page context despite working in isolated tests, with the root cause never found. This task's Renderer has a structurally different DOM/CSS shape (absolute-position paint boxes, not the old PoC's layout), so the old failure may or may not recur here — genuinely unresolved without Human eyes, not assumed either way.

## 2. Frozen Contract

Direct-read of `docs/architecture/PHASE3_OPEN_ITEMS.md` row P3-O03 and its cited evidence (`prototypes/phase2-japanese-capability-poc/evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md`, TCY section): the **logical model** (tokenization, one atomic unit, source mapping, one-cell occupancy) was already PASS in Phase 2 and remains untouched here. The **visual rendering** was explicitly left OPEN because `text-combine-upright: all` — the correct, standard CSS mechanism — worked in three isolated minimal-reproduction tests but did not visibly combine in the full PoC page, and the root cause was never diagnosed (the investigation was stopped mid-loop, not concluded with a negative result). This task follows that frozen precedent: `text-combine-upright: all` is the prescribed mechanism, not a general-CSS-knowledge invention — no alternative (manual rotation, canvas, SVG, scaleX transforms) was substituted.

## 3. Existing TCY Logical Model

Confirmed by direct reading (unchanged by this task):
- `TCYUnit = { kind: "TCY"; span: SourceSpan; displayText: string; logicalCells: number }` (`core/units/tcyUnit.ts`).
- `tcyCellCost(unit) = unit.logicalCells` (`core/tcy/index.ts`) — the Natural-Pitch capacity cost of the WHOLE group, regardless of how many characters `displayText` contains.
- `deriveBreakOpportunities` generates **zero internal opportunities** for TCY (no case in its per-unit switch) — the whole group is always exactly one atom, by construction, never split.
- `advanceTickFor`'s TCY case: `perCellAdvance * tcyCellCost(unit)` — for the fixture's `logicalCells: 1`, the WHOLE "2026" (4 characters) already occupies exactly ONE canonical cell (1 em) at the Core level. This is precisely what `text-combine-upright: all` is designed to paint: multiple characters visually compressed into one vertical writing cell.

## 4. Core / Renderer Ownership

**Core owns** (untouched by this task, verified by `git diff --stat` after implementation): logical identity, source mapping, atomicity, line/page position, occupied canonical extent (`logicalCells`), break behavior (zero internal opportunities). **Renderer owns** (this task's own scope): paint orientation of the already-fixed canonical box's own text content. The Renderer does not detect TCY (P3-O07 remains untouched and OPEN — no digit-counting or auto-conversion logic was added anywhere), does not split it, does not change its source, does not change its occupied canonical extent, and does not change any line/page break or any surrounding glyph's own position (verified directly, §8 below).

## 5. Canonical TCY Box

The TCY unit's own `PlacedUnit` (`topPx`/`heightPx`) is computed by the exact same `buildPaintLine` logic as every other unit kind — no TCY-specific branch exists in `paintModel.ts` at all. The box the Renderer paints into is 100% Core-derived; the Renderer only changes what happens to the TEXT painted *inside* that already-fixed box.

## 6. Paint / Shaping Strategy

`PreviewRenderer.tsx`'s `UnitBox` now wraps a TCY unit's own text in `<span className="tcy">{unit.text}</span>` (instead of bare text), and a new CSS rule `.tcy { text-combine-upright: all; }` is added. This is the ONLY change: no `scaleX()`, no manual font-size shrinking, no letter-spacing compression, and no browser measurement feedback into Core were introduced — `text-combine-upright`'s own built-in fitting algorithm (defined by the CSS Writing Modes specification) handles compressing the combined glyphs to fit 1 em width, which is inherent to the CSS feature itself, not something this task adds on top. `.unit` itself (the canonical position/orientation box) is completely unchanged — it keeps `writing-mode: vertical-rl` exactly as before, so the TCY unit still occupies its correct canonical `GeometryTick`-derived position along the line; only the wrapped `.tcy` span's own inline content is affected.

## 7. Atomicity

Verified directly (`tcyVisual.test.ts` test 13): the explicit-tcy fixture's four-character "2026" TCY produces exactly **one** `PaintPlacedUnit` of kind TCY — never decomposed into per-character placements. The `.tcy` wrapper may contain multiple internal glyph nodes only as an artifact of how the browser paints combined text (a rendering detail, invisible to the DOM structure — the wrapper's own text content is still the single string "2026"); canonical ownership remains exactly one TCY atom throughout.

## 8. Paragraph / Break Interactions

All required interaction cases are tested against real composed fixtures (`tcyVisual.test.ts`, tests 4–11): TCY at the very start of a line (paragraph indent applies normally, TCY shifted only by the standard indent offset, nothing TCY-specific); TCY as the last unit on a line (fits exactly, never overflows its page); TCY adjacent to punctuation on both sides; TCY immediately after a bare paragraph break; TCY immediately after a manual page break (no phantom indent fabricated — the already-fixed manual-break-state Core behavior holds); TCY placed exactly at a column boundary; TCY placed exactly at a page boundary. Test 14 directly proves same-line neighbor coordinates are unaffected by the TCY visual wrapper (a pure content/CSS change, never a geometry change) — verified via the ordinary cumulative-advance relationship (`tcy.topPx === before.topPx + before.heightPx`, exactly, TCY included).

## 9. Scale / Font Boundary

The TCY unit's `fontSizePx` comes from the exact same `tickToPx(ctx.linePitchTicks, ctx.scaleMultiplier)` path every other unit already uses — no separate or arbitrary font size was introduced for TCY. Test 19 proves visual scale changes TCY's own `topPx`/`heightPx` proportionally (exact ratio match across two independently-rendered scales) while its canonical text/span remain fixed. No browser measurement of any kind feeds back into Core — `text-combine-upright`'s own fitting is entirely a browser-internal paint decision, invisible to and never read back by any TypeScript code in this repository.

## 10. Normal vs Debug Preview

NORMAL PREVIEW shows only the combined `.tcy` text — no unit badge, no source span, no P3-O03 warning inside the manuscript (the existing `.provisional-badge { display: none; }` default and the generic per-unit `title` tooltip gating, both already established by prior tasks, apply unchanged to TCY without any new code). DEBUG mode continues to expose TCY's own kind/source-span/coordinates via the same already-generic debug tooltip mechanism every other unit kind already uses — no TCY-specific debug code was needed or added.

## 11. Tests

18 new tests (`renderer/preview/tcyVisual.test.ts`), covering all 20 required cases (cases 17/20 and 15/16 combined per test, since they assert the same underlying property from complementary angles): the real explicit-tcy fixture (cases 1–3), line-start/line-end/punctuation-adjacency/paragraph-indent/paragraph-break/manual-page-break/column-boundary/page-boundary interactions (cases 4–11), source-span preservation (12), atomicity (13), adjacent-coordinate invariance (14), CanonicalDocument stability across two compositions (15/16), determinism and CanonicalDocument immutability (17/20), NORMAL/DEBUG geometry parity (18), and proportional scaling (19) — plus two additional structural regression guards: the generated HTML nests `.tcy` inside the TCY unit's own `.unit-ink`/`.unit.kind-TCY` box at the correct canonical position, and the stylesheet declares `text-combine-upright: all` for `.tcy` specifically (never applied to `.unit` itself, which must keep painting ordinary vertical text for every other kind).

**Full regression:** 347/347 Core tests, 21/21 Stage C, 30/30 Stage D, 60/60 P3-O09 renderer/preview tests (19 paintModel + 18 new tcyVisual + 23 generateFoundationArtifact) pass; `npx tsc --noEmit` shows 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error). No Core file was touched (`git diff --stat` confirms changes confined to `typesetting-v2/renderer/preview/` and the regenerated artifact).

## 12. Human Visual Artifact

`typesetting-v2/qa/visual/p3-o09-preview/index.html` (NORMAL) and `debug.html` (DEBUG) regenerated — the "Explicit TCY" fixture ("その日は西暦" + TCY "2026" + "年だった") should now show "2026" painted horizontally, centered in its own vertical cell, per `text-combine-upright: all`'s own browser-native rendering. This is exactly the class of result Phase 2's own P2-L06B evidence could not confirm in its own full-page context — Human eyes are required to determine whether it renders correctly here.

## 13. Remaining Work

**Genuinely unresolved, not assumed either way:** whether `text-combine-upright: all` visually combines correctly in this Renderer's specific DOM/CSS structure (absolute-position paint boxes under `writing-mode: vertical-rl`) — the exact class of uncertainty Phase 2's P2-L06B left OPEN in a different structure, root cause never found there. If Human Visual QA finds the same failure recurs, the next step is a fresh root-cause investigation specific to THIS renderer's structure (not a re-run of Phase 2's abandoned one) — a real browser DevTools inspection is likely required, which this environment cannot perform. P3-O07 (TCY auto-detection) remains entirely untouched and OPEN, as instructed — no recognition logic was added anywhere in this task.

## 14. Next Technical Task

**Human Visual QA for TCY is required** before this item can be called PASS or before proceeding to any further TCY work. Given P3-O03's own genuine visual uncertainty, and independently of its outcome, **P3-O04 (dash visual)** and **P3-O05 (ellipsis visual)** remain available as parallel next candidates by dependency order (both are pure Renderer-side visual polish needing no further Core change, same reasoning already established at the P3-O09 Foundation and Ruby Placement Micro-Loop tasks) — the choice between them is not a technical-ordering question the frozen roadmap forces either way, and neither is blocked by TCY's own outcome. No Human Product decision is required to proceed with either; a decision is only needed if TCY's own Human Visual QA reveals the historical full-page-combination failure recurring here, at which point the next step (root-cause investigation vs. an alternative shaping strategy) would itself need Human input on how much further investigation to invest.

## 15. Human Visual QA — Final Result (2026-09-07)

**Verdict: PASS.**

Human reopened the regenerated artifact and confirmed, for the Explicit TCY fixture ("2026" between ordinary Japanese text):
- "2026" appears cleanly horizontal inside the vertical line (`text-combine-upright: all` DID visually combine correctly in this Renderer's structure — the historical Phase 2 P2-L06B full-page-combination failure did NOT recur here)
- one canonical TCY unit, visually contained within its own vertical column
- surrounding text was not displaced
- no line/page escape
- no debug decoration visible in NORMAL Preview

**DECISION: P3-O03 (TCY Visual) — Human Visual QA PASS. CLOSED.**

**P3-O07 (TCY auto-detection) remains explicitly OPEN** — this PASS covers only the visual shaping of an already-explicit TCYUnit; no digit-recognition, threshold, or auto-conversion logic exists anywhere in this codebase, and none was implied by this result.

**NEXT:** P3-O04 (dash visual) is the next active Preview Renderer item.

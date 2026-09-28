# TateSpun Core Long-Paragraph Performance

Measured 2026-09-28 on branch `tsp-post-beta-typography-phase1`. The baseline is `d485cc6`
(検索・置換 Undo repair). This is a **performance-only** change: every layout product was
proven identical to the baseline (§5). Environment and methodology follow
`TATESPUN_LONG_MANUSCRIPT_PERFORMANCE.md` §1: same machine (i5-9400, Windows 11, Node v24,
headless Chrome, 1280×900), before and after measured in the same session.

## 1. Problem and reproduction

Phase 9 found that the Preview layout for long manuscripts was super-linear in paragraph length.
A 20,000-character manuscript took 15.9 s when it was one paragraph, and 117 ms when split
into paragraphs. The suspect was the per-line `sliceUnitsFrom` in `core/compose/column.ts`.

Reproduction (Node, the real `composeV2Layout` with the Shippori Mincho provider, default 文庫):

```
TATESPUN_PERF_LONG_PARAGRAPH=1 [TATESPUN_PERF_LP_PROFILE=1] [TATESPUN_PERF_LP_SIZES=5000,10000,20000,50000] \
  npx vitest run --config scripts/perf/vitest.config.ts longParagraph
```

- Source: `scripts/perf/longParagraph.bench.ts`.
- Fixtures:
  - `single-N`: one paragraph of N characters.
  - `split-N`: the same characters in paragraphs of about 150 characters.
  - `300k-normal`: about 300k characters in ordinary paragraphs.
  - `300k-with-20k-paragraph`: the same volume with one 20k paragraph in the middle.
- Measurements per case:
  - wall time;
  - pages and lines;
  - LogicalUnits;
  - an operation count: how many times a string was expanded to a code-point array
    (`Array.from(string)`), and how many code points that produced in total;
  - optionally, an inspector CPU profile (top self-time functions).

## 2. Root cause (profiled, not assumed)

A whole paragraph is a single `TEXT` LogicalUnit, and three places expanded **the entire unit
text** to a code-point array for **every boundary, atom or line** of it:

| Where | What it did | Cost for one n-char paragraph |
|---|---|---|
| `core/breaks/opportunity.ts` `deriveTextUnitInternalOpportunities` | `codePointSlice(unit.text, …)` twice per grapheme boundary; each call is `Array.from(wholeText).slice(…)` | 2·n² code points |
| `core/compose/line.ts` `computeAtoms` pair-advance pass (`literalTextForAtom`) | `Array.from(owner.text).slice(…)` twice per atom | 2·n² code points |
| `core/compose/column.ts` `sliceUnitsFrom` (per line) | `Array.from(text).length` + `codePointSlice` on the remainder; also scans/copies every remaining unit of the document per line | ≈ 2·n²/37 code points; O(lines × units) in long multi-paragraph documents |

Baseline measurements:

- **Profile, 10k single paragraph (3.3 s):**
  - `deriveTextUnitInternalOpportunities`: 46.6 % self time;
  - `prepareLineComposition`: 45.2 % (`literalTextForAtom`, inlined);
  - `sliceUnitsFrom`: 0.3 %.
- **Profile, 5k:** `literalTextForAtom`, `toCodePointArray` and `codePointSlice` take 83 % together.
- **Operation count:** code points materialized rise exactly 4× per doubling:
  100.7 M (5k), 402.8 M (10k), 1,611 M (20k), 10,068 M (50k). That is quadratic, and matches
  4·n² from the two whole-text slicers above.
- **Column share:** for the 20k paragraph, `column.ts` accounts for only about 1 % of the
  materialized code points. The Phase 9 hypothesis was therefore a minor contributor, not the
  cause.
- **300k-normal (3.2 s):** here `sliceUnitsFrom` was the largest Core item (15.8 %) because it
  walked and re-pushed every remaining unit on every line (about 4,000 units × 10,000 lines).

## 3. Algorithm change (same algorithm, same data; no approximation)

Line breaking, break legality, atom boundaries, advances, pair-advance ratios, indent, ruby
placement and pagination rules are untouched. Only redundant string expansion and copying were
removed:

1. **`opportunity.ts`.** `Array.from(unit.text)` is computed **once per unit**. Each grapheme atom
   is sliced from that array, with the same half-open code-point ranges as before.
2. **`line.ts` `computeAtoms`.**
   - Each owner's code-point array is memoized for one pass (a `Map<LogicalUnit, string[]>`).
   - Every atom stores `literalText`, which is exactly `literalTextForAtom(owner, span)`.
   - The pair-advance pass and the ruby overhang lookup (`adjacentOverhangAllowance`) both read
     that stored value instead of re-expanding the owner.
3. **`line.ts` `firstVisibleCharFor`.** The first code point of a unit is taken from the string
   iterator. `Array.from(text)[0]` produced the same value, but expanded the whole remainder of
   the paragraph on every line.
4. **`graphemeSafety.ts` `codePointSuffix(text, start)`.** It returns
   `codePointSlice(text, start, codePointLength(text))`: it walks `start` code points (same
   stepping as the string iterator, including lone surrogates) and then takes a native `slice`.
   `column.ts` uses it for the remainder of a partially consumed `TEXT` unit.
5. **`column.ts` `sliceUnitsFrom`, fast path with an exact precondition.**
   - Precondition: span.start never decreases along the unit array, and every span is
     well-formed. It is checked once per column and carried inductively from line to line.
   - Under it, every unit that starts after the cut offset is provably kept unchanged by the
     original rules:
     - its end is past the offset;
     - it cannot be the separator newline at the offset;
     - no MANUAL_BREAK starting at the offset can lie beyond it.
   - So only the short front is examined, and the tail is copied as-is.
   - Without the precondition (for example, overlapping out-of-order units), the original
     full scan runs unchanged.
6. **`indexBoundaryLegalities`.** Same first-wins / higher-priority-wins rule, built directly
   instead of through an entry-object map plus a second `Map` copy.
7. **`graphemeBoundaryOffsets`.**
   - The default `Intl.Segmenter` instance is reused, because it holds no per-call state.
     Test seams via `__setGraphemeSegmenterFactoryForTesting` still call their own factory.
   - A 1-UTF-16-unit segment counts as one code point without `Array.from`.

After the change, the materialized code points are exactly **8 per character** at every
paragraph length (5k: 40,004 · 20k: 160,004 · 50k: 400,004). That is linear.

## 4. Before / after (Node, `composeV2Layout`, default 文庫)

| case | before | after | improvement |
|---|---:|---:|---:|
| 5k single paragraph | 781 ms | 16 ms | 49× |
| 10k single paragraph | 3,019 ms | 21 ms | 145× |
| 20k single paragraph | 16,802 ms | 68 ms | 248× |
| 50k single paragraph | 109,796 ms | 124 ms | 885× |
| 5k split (control) | 44 ms | 14 ms | 3.2× |
| 20k split (control) | 163 ms | 44 ms | 3.7× |
| 50k split (control) | 401 ms | 103 ms | 3.9× |
| 300k representative (ordinary paragraphs) | 3,171 ms | 884 ms | 3.6× |
| 300k with one 20k paragraph | 24,232 ms | 974 ms | 24.9× |

- Pages and lines are identical in every row.
- Raw data:
  - `scripts/perf/results/core-lp-baseline-d485cc6-long-paragraph.json`
  - `scripts/perf/results/core-lp-optimized-long-paragraph.json`
- The equivalence snapshot (§5) timed the same compose for 108 fixture × settings cases:
  - 20k single paragraph: 17.6–21.8 s → 41–124 ms, depending on paper;
  - A5 2段: 21.8 s → 96 ms.

## 5. Output equivalence (machine-checked)

`scripts/perf/layoutEquivalence.bench.ts`:

```
TATESPUN_EQ_OUT=<file.json> npx vitest run --config scripts/perf/vitest.config.ts layoutEquivalence
node scripts/perf/compareLayoutEquivalence.mjs <baseline.json> <candidate.json>
```

For each fixture × settings case, it composes through the real Editor bridge
(`composeV2Document` with an image resolver). It then records a SHA-256 of a key-sorted
canonical serialization of 12 products:

1. canonical document pages: every column, line and placed unit, with its source span, x/y
   ticks, indent, ruby policy/offset/extent and decoration;
2. the Decision Trace;
3. colophon;
4. pageSequence, version, warnings, errors and hold;
5. LogicalUnits (ruby, 傍点, TCY, semantic runs, images);
6. source and source map;
7. the Publication model;
8. the fast PaintPlan;
9. the font-aware PDF/JPG PaintPlan, built page by page with the export worker's own
   `createPublicationPaintPlanBuilder` and the real font;
10. the Preview PaintDocument;
11. the live Preview document (worker protocol);
12. the Preview page model.

Nothing is excluded, because the pipeline has no timestamps or random values.

- **Fixtures:**
  - ordinary prose;
  - a 20k single paragraph;
  - 300k, and 300k with a 20k paragraph;
  - punctuation/brackets/kinsoku-heavy text;
  - ruby (group, mono and long base);
  - 傍点, including ruby inside 傍点;
  - 縦中横 (explicit and automatic);
  - Latin text and digits;
  - 改ページ, including consecutive breaks;
  - images (center/top/bottom/FULL);
  - a colophon-only short text;
  - paragraph lengths sweeping line/page capacity ±2;
  - a 20k continuous mixed-feature paragraph, alone and inside a document;
  - a kinsoku run that must HOLD;
  - surrogate pairs, ZWJ emoji, flags, combining marks and variation selectors;
  - ――/……;
  - 5k and 50k single paragraphs;
  - a 20k split paragraph;
  - empty and one-character manuscripts;
  - CRLF and blank lines.
- **Settings:**
  - default 文庫, 文庫, A5 1段, A5 2段, 新書, B6 and A6;
  - A5 2段 + 奥付 and 文庫 + 奥付;
  - ノンブル hidden;
  - 柱 odd/even with per-page overrides (hideNombre/hideHashira/hashiraOverride) and
    hideNombreOnFirstPage.

**Result:** 108 cases × 12 products = **1,296 hashes, 0 differences**, baseline `d485cc6`
(pristine detached worktree) vs optimized. 92 distinct page layouts are covered. The only
refused export plan is the intentional kinsoku-HOLD fixture, and it is refused identically in
both.

Snapshots:
- `scripts/perf/results/core-lp-equivalence-baseline-d485cc6.json`
- `scripts/perf/results/core-lp-equivalence-optimized.json`

Their `composeMs` fields were timed while other jobs were running; the timings in §4 are the
authoritative ones.

The differential unit test `typesetting-v2/core/compose/longParagraphComplexity.test.ts` also
compares the new column/page driver with a verbatim copy of the pre-optimization driver on:

- line and page boundary sweeps;
- manual breaks followed by separator newlines;
- blank lines;
- a not-start-ordered unit array (the full-scan path).

It also checks `codePointSuffix` against `codePointSlice` for every start offset, including
surrogate pairs, lone surrogates, ZWJ sequences and flags.

## 6. Preview latency (browser, input → V2 layout reply → next painted frame)

`tests/e2e/coreLongParagraphPreview.e2e.mjs` (baseline and optimized static builds, FULL and
WINDOWED):

- Actions use real CDP input: `Input.insertText`, an Enter key event and Ctrl+Z.
- The saved manuscript is asserted after every run. Timings are never asserted.
- Fixtures:
  - `longtail`: about 300k characters whose last paragraph is 20k characters;
  - `normal`: about 300k characters in ordinary paragraphs.

Input → Preview painted (ms):

| fixture / action | FULL before | FULL after | WINDOWED before | WINDOWED after |
|---|---:|---:|---:|---:|
| longtail: end insert | 16,180 | 1,855 | 16,133 | 2,380 |
| longtail: insert inside the 20k paragraph | 16,095 | 2,113 | 16,062 | 2,379 |
| longtail: Enter inside the 20k paragraph | 10,454 | 2,006 | 16,213 | 1,973 |
| longtail: undo (Ctrl+Z) | 15,816 | 2,302 | 16,118 | 2,002 |
| normal: end insert | 3,376 | 1,883 | 3,687 | 2,050 |
| normal: insert in the last paragraph | 3,306 | 1,739 | 3,736 | 2,183 |
| normal: Enter | 3,572 | 1,558 | 3,786 | 1,687 |
| normal: undo | 3,317 | 1,805 | 3,331 | 1,855 |

- Opening the longtail document took 17.7 s before the first V2 layout in FULL; it now takes
  1.7 s.
- Final Preview page counts are identical: 618 (longtail) and 625 (normal).
- The after numbers split into two parts:
  - about 0.4–0.9 s of main-thread work between the input and the compose request, identical
    in both builds (not Core);
  - about 1.1–1.4 s in the worker (Core compose, Preview document and delta).
- Raw data: `scripts/perf/results/browser-core-lp-*.json`.

## 7. Regression results

**Unit suites.** Every scoped vitest config (19 configs) was run on the baseline worktree and on
the optimized tree, and the failing-test sets are identical.

- Core: 389/389 on baseline; 408/408 on optimized (+19 new tests).
- renderer/preview: 114/114.
- v2Bridge: 333/334 (1 skipped).
- windowedEditor, editorPagination, hooks, utils, constants, bookshelf, tools/* and
  tests/performance: all pass.
- Pre-existing failures, identical on both trees:
  - renderer/publication: 9 (InDesign reference SHA lock);
  - src/lib: 25;
  - src/components: 3;
  - preIntegrationUx: 19;
  - editorSessionActivity: 2;
  - writingCheckEngine: 1.

  The `outputIsolation` failure has the same name except for the tree path. It passes one more
  test on optimized because it now also scans the new Core test file.
- The publication suite regenerates 54 tracked QA artefacts (PDF, JPG, ZIP and HTML). Regenerated
  on both trees and compared: 10 are byte-identical, 44 are identical after PDF
  CreationDate/ModDate/ID and ZIP timestamp normalization, and 0 differ. The artefacts were then
  restored with `git restore`.

**Browser E2E.** These were run against static builds of baseline and optimized, FULL and
WINDOWED (4 builds). All passed on all 4:

- `searchReplaceNavigation`: 次へ/前へ, 選択箇所を置換, すべて置換, and their Ctrl+Z/Ctrl+Y undo/redo.
- `windowedLongDocument`: document switch, large paste + undo, 全文を選択 copy (WINDOWED),
  search 次へ.
- `phase9HumanQaRepair`: search in the Preview pane, A5 2段 top/bottom stack and 奥付, 300k typing,
  Enter, paste and undo.
- `previewPageModel`: FULL-page image flow in Preview and exported JPG.
- `imageWarningLifecycle`.
- `autosaveFlush`.
- `mobileSharedExport`.
- `exportWorkerPerf`: 40-page PDF and JPG ZIP through the real UI.
- `coreLongParagraphPreview`: long paragraph input, Enter, undo, Ctrl+A (FULL: whole manuscript;
  WINDOWED: the mounted 編集ページ, per PagedEditor's contract) and the saved manuscript.

**Browser export equivalence.** The exported PDF (normalized SHA `d3604e0a92c69e72`, 42 pages)
and every JPG in the ZIP (entries SHA `39b9266f3c1914c5`, 42 JPGs) are identical across all four
builds.

**Build.** `npx tsc --noEmit`, `npx next build` (FULL) and
`NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED npx next build` all pass. `npm run build` was not
used: its prebuild Supabase guard needs `.env.local`, which this worktree does not have and which
was not copied (environment, not code).

## 8. Remaining limits

- **The Preview still recomposes the whole manuscript per edit.** The 300k Core compose is now
  linear, at about 0.9 s in Node and 1.1–1.4 s in the browser worker. The remaining cost is
  per-character work:
  - atom, opportunity and Decision Trace objects;
  - grapheme segmentation;
  - GC, which accounts for about 24 % of the profile.

  Going further needs incremental or partial re-layout. That is a design change with its own
  equivalence risk, and it is out of scope here.
- **About 0.4–0.9 s of main-thread time sits between the input and the compose request** on
  300k manuscripts, identical before and after. It is not in Core; the next profiling target is
  the Preview input path (`PreviewPane`/`TategakiEditor`).
- **The fast path covers start-ordered unit arrays only.** That is what the Editor adapter
  produces. Other arrays keep the original per-line full scan (correct, just not faster).
- **Real-OS Japanese IME input was not exercised.** Headless Chrome has no IME, so IME
  composition is UNKNOWN (Human QA).

## 9. Human QA required

- 30万字級 with a very long single paragraph, on real hardware:
  - typing, IME conversion, Enter and undo inside the long paragraph;
  - confirm the Preview catches up in about 2 s rather than about 16 s.
- Visual spot check of Preview, PDF and JPG on a real long-paragraph manuscript:
  - A5 2段, 奥付, ノンブル, ruby, 傍点, 縦中横, images.

  They are proven hash-identical to `d485cc6`, so this is a confidence check, not a spec
  check.
- Both surfaces (FULL and the opt-in WINDOWED).

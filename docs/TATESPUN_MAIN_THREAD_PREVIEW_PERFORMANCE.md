# TateSpun Main-Thread Preview Request Performance

Measured 2026-09-28 on branch `tsp-post-beta-typography-phase1`. The baseline is `9b2ac15` (Core
long-paragraph composition). The subject is the main-thread segment **from an editor input to the
V2 `compose` postMessage**. Core composition was not changed; only its timing was observed.

This is a **performance-only** change. Every layout, Preview, PDF and JPG product was proven identical
to the baseline (§6–§7). The two designed debounces were kept unchanged:

- `PREVIEW_PROP_DEBOUNCE_MS` = 180 ms;
- `V2_COMPOSITION_DEBOUNCE_MS` = 180 ms.

Environment: the same machine and method as `TATESPUN_CORE_LONG_PARAGRAPH_PERFORMANCE.md`:

- i5-9400, Windows 11, Node v24;
- headless Chrome at 1280×900;
- static production builds (`next build`, `output: "export"`);
- FULL and WINDOWED surfaces;
- baseline and after measured in the same session.

## 1. What the segment contains

There are two designed debounces, so **~360 ms of the segment is intentional waiting**, not work:

1. `setPreviewContent` in `TategakiEditor` (180 ms after the edit commit);
2. the V2 composition timer in `useV2PreviewAdapter` (180 ms after PreviewPane's commit).

The part that can be optimised is the main-thread work that runs *during* those timers. It delays
them, because a timer callback cannot run until the task or frame in front of it finishes.

## 2. Measurement

- **`tests/e2e/mainThreadPreviewRequest.e2e.mjs`**: real CDP input on a seeded 300k-character manuscript.
  - Fixtures: `normal` (300k in 150-character paragraphs), and `longtail` (the same volume, ending in
    one 20,000-character paragraph).
  - Actions: insert, Backspace, undo, redo, Enter, far-end insert/Backspace, and insert/Backspace inside
    the long paragraph.
  - Timed from the input to three points: the `compose` postMessage (**input→request**), the worker
    reply, and the next painted frame.
  - It also records the Long Tasks API total inside [input, request]. It asserts data safety: the saved
    manuscript contains only the probe's own characters, and all other text is intact and in order.
  - Diagnostic options:
    - `TATESPUN_MT_TRACE=1` gives a Chrome trace reduced to main-thread self time per event, plus every
      full compositor update (`Layerize`) with its offset and triggering task.
    - `TATESPUN_MT_PROFILE_DIR` gives CPU profiles.
    - `TATESPUN_MT_MUTATIONS=1` gives a timestamped DOM mutation log.
    - `TATESPUN_MT_INJECT_CSS` runs CSS A/B experiments.
- **`scripts/perf/keystrokePath.bench.ts`** (Node): every whole-manuscript helper on the keystroke path,
  on the same fixtures.
- **`scripts/perf/compareMainThreadResults.mjs baseline after`**: the before/after tables below.

## 3. Profiler findings (baseline)

### 3.1 The main thread is mostly native rendering, not JS

A CPU profile of the window is mostly `(program)`, i.e. Blink work: 190–520 ms per edit. JS is only
~40–120 ms. The trace breaks the window down as follows (FULL, 300k, mean of 9 actions):

| trace event (self time in [input, request]) | baseline |
|---|---|
| `Layerize` (full compositor update) | **226 ms** |
| JS (`FunctionCall`) | 58 ms |
| cc `Commit` | 20–55 ms |
| Layout + style + paint | ~20–30 ms |
| total busy | 380 ms |

### 3.2 Why Layerize is expensive

The mounted Preview is 9 PageCards (virtualized, 3 visible). Every glyph is a `.unit-ink` span with
`overflow: hidden`: **4,404 clip nodes / paint chunks** on a 300k manuscript.

Every frame that changes paint *structure* re-layerizes the whole paint artifact, at ~100 ms each
(~165 ms on long-paragraph pages, which carry more glyphs). Pure text repaints take Blink's fast path
and do not re-layerize: the character-count update never did.

Tagging each `Layerize` with a DOM-mutation log gave **three full passes per keystroke**:

| t after input | trigger | necessary? |
|---|---|---|
| ~20 ms | the textarea echo of the edit | yes |
| ~140–190 ms | save status → 「保存中」 (the dot starts `animate-pulse`, a composited animation) | yes (visible UX) |
| ~350–420 ms | the writing-check overlay wrapper `invisible` → `visible` once the 300 ms re-check lands | **no, when there are no issues** |

The third pass (plus the re-check itself, below) sits directly in front of the V2 debounce timer and
pushes the request back by ~100 ms. On WINDOWED, `PagedEditor` *unmounts and remounts* the overlay on
every edit, which is the same cost.

### 3.3 Whole-manuscript JS on the path

Measured in Node; the source was mapped with a temporary source-mapped build:

| helper (300k) | baseline | where |
|---|---|---|
| writing check (all default rules) | 30.1 ms, of which `R1-bracket` is **26.9 ms** | 300 ms after each edit |
| `resolveTextareaDeletion` (Backspace at end) | **42.1 ms** | inside the keystroke handler |
| `resolveTextareaDeletion` (Delete in the middle) | 21.2 ms | inside the keystroke handler |
| `countVisualLength` | 2.1 ms | 180 ms debounce (left as is) |
| `referencedImageSignature` / `imageMarkerIds` / `referencedImages` | ≤0.06 ms | every edit / payload (left as is) |
| `applyTextInputChange` with `beforeinput` (typing, Enter, Backspace, IME commit) | 0.00 ms | keystroke (left as is) |

Causes:

- **`checkBrackets`** did an object lookup on `text[i]` for every code unit. For non-Latin-1 text, V8
  allocates a one-character string for each one.
- **`graphemeRangeAt`** ran `Intl.Segmenter` over the **whole manuscript** up to the caret, on every
  Backspace/Delete.

### 3.4 Not the cause (checked)

- React StrictMode double effects are development-only. All numbers here are production builds.
- No `JSON.stringify` or `structuredClone` of the document runs on the path.
- The worker payload filter (`referencedImages`) costs ≤0.06 ms.
- The page list is not rebuilt per edit: it only changes with the V2 reply.
- The Preview document is applied as a one-page delta (Phase 9).
- `applyTextInputChange`'s whole-text code-point diff (8–21 ms) runs only when no `beforeinput` was
  captured. The browser actions above never take that path, and it never appeared in a profile.

## 4. Changes

Three changes, each pixel- and behaviour-identical by construction and verified.

1. **Writing-check overlay: toggle only when there is something to hide.**
   - FULL, `EditorPane.tsx`: the wrapper is `invisible` only while the stale analysis has issues
     (`!analysisCurrent && writingIssuesForAnalysis.length > 0`).
   - WINDOWED, `PagedEditor.tsx`: the overlay stays mounted while the check is enabled. A stale
     analysis already produces `pageLocalIssues = []`.
   - With no issues, `WritingCheckOverlay` renders an empty mirror, so both states paint nothing.
   - With issues, the stale underlines are hidden exactly as before (verified in §8).
2. **`checkBrackets`: reject non-bracket code units by number first.** A `charCodeAt` switch over
   exactly the ten bracket code units, then the original logic, unchanged. 26.9 → 1.9 ms; the whole
   check 30.1 → 4.3 ms.
3. **`graphemeRangeAt`: segment only the line holding the caret.** UAX #29 always breaks after LF
   (GB4), and before LF unless it follows CR (GB3/GB5). So the window from just after the previous LF
   to just after the next LF has real boundaries at both ends, and every cluster in it matches a
   whole-text segmentation. `resolveTextareaDeletion`, Backspace at the end of 300k: 42.1 → 0.09 ms.

### Rejected (measured, output not identical or no gain)

| experiment | effect on the window | why rejected |
|---|---|---|
| `.unit-ink { overflow: visible }` (TEXT units only, or all) | Layerize 226 → ~5 ms; input→request ≈ debounce floor | **Preview pixels change** on every glyph (36/36 screenshots differ, max Δ 218). The per-unit scroll-container clip pixel-snaps glyph ink, so removing it shifts antialiasing. |
| `.unit-ink { overflow: clip }` | — | same pixel change (24/24 card images differ) |
| `content-visibility: auto` on page cards | none (Layerize unchanged) | off-screen mounted cards stay within the auto margin |
| smaller virtualization overscan | not tried | would bring back blank pages while scrolling (a UX change) |
| shorter debounces | not tried | forbidden: it only hides the cost |

## 5. Before / after

### 5.1 Main-thread mechanism (trace, FULL 300k, one run per action)

| action | busy in window | Layerize | full passes | JS |
|---|---|---|---|---|
| insert (middle) | 271 → 272 | 102 → 106 | 3 → 3 | 63 → 38 |
| Backspace (middle) | 464 → 327 | 304 → 215 | 3 → 2 | 64 → 21 |
| insert again | 431 → 318 | 294 → 203 | 3 → 2 | 45 → 27 |
| undo | 301 → 197 | 192 → 104 | 2 → 1 | 41 → 25 |
| redo | 305 → 182 | 193 → 102 | 2 → 1 | 41 → 19 |
| Enter | 437 → 306 | 292 → 202 | 3 → 2 | 58 → 19 |
| undo Enter | 306 → 211 | 194 → 103 | 2 → 1 | 43 → 31 |
| insert (end) | 574 → 482 | 319 → 253 | 3 → 3 | 55 → 30 |
| Backspace (end) | 331 → 167 | 144 → 96 | 3 → 2 | 117 → 19 |
| **mean** | **380 → 274 (−28 %)** | **226 → 154** | | **~58 → ~25 (−57 %)** |

Where a third pass remains (the two inserts), it is the Preview's caret-follow scroll
(`scroll`/`scrollend`), a separate and legitimate trigger.

### 5.2 Input → request (browser, medians of 3 runs per action; ms)

| case | before | after | Δ |
|---|---|---|---|
| FULL 300k input (middle) | 512 | 482 | −30 |
| FULL 300k Enter | 475 | 477 | +2 (noise) |
| FULL 300k undo | 491 | 392 | −99 |
| FULL 300k redo | 462 | 382 | −80 |
| FULL 300k Backspace (middle) | 504 | 465 | −39 |
| FULL far-end insert | 468 | 461 | −7 |
| FULL far-end Backspace | 444 | 391 | −53 |
| FULL long paragraph input | 729 | 724 | −5 |
| FULL long paragraph Backspace | 854 | 671 | −183 |
| WINDOWED 300k input (middle) | 639 | 470 | −169 |
| WINDOWED 300k undo | 542 | 468 | −74 |
| WINDOWED far-end insert | 445 | 374 | −71 |
| WINDOWED far-end Backspace | 428 | 375 | −53 |
| WINDOWED long paragraph input | 777 | 585 | −192 |
| WINDOWED long paragraph Backspace | 797 | 598 | −199 |

| group (all actions) | median of all runs | mean of per-action Δ | actions improved | long tasks in window (median) |
|---|---|---|---|---|
| FULL normal | 482 → 455 | −47 | 8/9 | 214 → 194 |
| FULL longtail | 492 → 477 | −58 | 10/11 | 232 → 233 |
| WINDOWED normal | 479 → 445 | −61 | 8/9 | 157 → **63** |
| WINDOWED longtail | 526 → 467 | −75 | 9/11 | 163 → **0** |

Per-run data: `scripts/perf/results/browser-main-thread-{baseline,after}-{full,windowed}-{normal,longtail}.json`.

### 5.3 Total Preview latency (input → Preview painted; median of all runs, ms)

| case | before | after |
|---|---|---|
| FULL 300k normal | 1827 | 1845 |
| FULL 300k + 20k paragraph | 1944 | 2030 |
| WINDOWED 300k normal | 1858 | 1849 |
| WINDOWED 300k + 20k paragraph | 2004 | 1844 |

These totals are **unchanged within noise**. The worker's request→reply (Core compose plus reply,
1.2–1.5 s) dominates them and varies by ±150 ms from run to run. The 1.2–1.7 s total target is
not reached by main-thread work: Core is the remaining cost.

## 6. Output equivalence

- **Layout products** (`scripts/perf/layoutEquivalence.bench.ts` on both trees, then
  `compareLayoutEquivalence.mjs`): **108 cases, 1,296 product hashes, 0 differ**. The hashes cover
  the canonical document, Preview document, page model, Publication, PaintPlan, and the font-aware
  PDF/JPG plans.
- **Browser export** (`exportWorkerPerf`, 40 pages, through the real UI): identical on all four
  builds (baseline/after × FULL/WINDOWED):
  - PDF: normalized SHA `d3604e0a92c69e72`, 42 pages;
  - JPG ZIP: entries SHA `39b9266f3c1914c5`, 42 JPGs.
- **Regenerated publication QA artefacts** (PDF/JPG/ZIP from the suites, both trees): 54 compared,
  10 byte-identical and 44 identical after timestamp normalization; 0 differ.

## 7. Visual QA (pixel diff)

`tests/e2e/previewVisualParity.e2e.mjs` captures a fixed scenario set at devicePixelRatio 3, with the
caret hidden and animations off. `scripts/perf/comparePreviewScreenshots.mjs` pixel-diffs two runs.
Each run produces 36 images: every visible Preview card and the full viewport. The scenarios are:

- a character-class sheet: kana/kanji, all bracket kinds, punctuation, small kana, full/half-width
  Latin and digits, surrogate pairs and IVS, symbols, ruby, 傍点, 縦中横, dash and ellipsis runs;
- that sheet in 文庫 with each of the 5 fonts;
- A5 1段 and A5 2段;
- 奥付 plus ノンブル;
- image pages (center and full);
- 300k;
- a 20k paragraph;
- mobile at 390×844.

Results:

- Baseline vs baseline: 36/36 identical, so the capture is deterministic.
- **FULL baseline vs after: 36/36 identical.**
- **WINDOWED baseline vs after: 36/36 identical.**

The same harness rejected the `overflow` experiments in §4 (their diff images are kept in the
evidence folder).

## 8. Regression

**Vitest.** All 19 scoped configs ran on both trees, and the fail sets are **identical**:

- Core: 408/408 on both, including `longParagraphComplexity`.
- New tests pass:
  - `editorInputIntegrityGraphemeWindow.test.ts`: 9,000+ caret/direction cases against whole-text
    segmentation, covering CR LF, ZWJ, RI, combining marks and IVS. It also caught and fixed the
    probe-0 edge (`lastIndexOf` clamps a negative index).
  - `bracketsFastPath.test.ts`: the original implementation on generated text, all 65,536 code units,
    and a 300k manuscript.
- Pre-existing failures, identical on the untouched baseline:
  - components 3;
  - editorSessionActivity 2;
  - preIntegrationUx 19;
  - `src/lib` 25;
  - writingCheckEngine 1 (`outputIsolation` flags a Review Hub test file);
  - publication 9 (InDesign reference lock).

**Browser E2E** on the after FULL and after WINDOWED static builds:

| test | FULL | WINDOWED |
|---|---|---|
| `writingCheckOverlayStale` (new): an issue's underline is hidden 8–19 ms after an edit and back at ~320 ms on the same text; a clean manuscript shows no overlay toggle or remount | PASS | PASS |
| `searchReplaceNavigation`: 選択箇所を置換 / すべて置換 with undo/redo, 0 件, phone modal | PASS | PASS |
| `windowedLongDocument`: document switch, large paste + undo, 全文を選択 copy, search 次へ across 編集ページ | PASS (全文を選択 N/A on FULL) | PASS |
| `phase9HumanQaRepair`: search in the Preview + Preview follow, phone search, A5/2段 + colophon | PASS | PASS |
| `previewPageModel`: image flow in Preview and exported JPG | PASS | PASS |
| `imageWarningLifecycle`: image ownership and warnings | PASS | PASS |
| `autosaveFlush`: leave, and reload inside the debounce, both restored | PASS | PASS |
| `mobileSharedExport`: 6 viewports, 9 downloads | PASS | PASS |
| `coreLongParagraphPreview`: 300k + 20k, end/interior insert, Enter, undo, Ctrl+A, exact saved text | PASS | PASS |
| `mainThreadPreviewRequest` (§5): FULL/WINDOWED × normal/longtail with data-safety asserts | PASS | PASS |
| `exportWorkerPerf`: PDF + JPG ZIP (§6) | PASS | PASS |
| `reviewLayout` | FAIL | FAIL |

The `reviewLayout` failure is pre-existing and **identical on the baseline builds**: "770x900
integrated-frame: PreviewPane has no duplicate shadow". None of these changes touches its CSS.

The long-paragraph `mainThreadPreviewRequest` cases are the "20k single paragraph" check.
`editorInputIntegrity`, `editorSessionActivity` and similar E2Es start their own Turbopack dev server,
so they cannot run from this worktree. Their unit contracts are in the Vitest results above.

**Build.**

- `npx tsc --noEmit`: PASS.
- ESLint on the changed files: 0 errors. There are 3 warnings, on pre-existing `PagedEditor` lines.
- `npx next build` (FULL): PASS.
- `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED npx next build`: PASS.
- `npm run build` was not used. Its prebuild Supabase guard needs `.env.local`, which this worktree
  does not have (an environment issue; no secrets were copied).

## 9. Limitations

- **The ~360 ms floor is by design.** Input→request cannot reach the 100–250 ms target while both
  180 ms debounces stay unchanged. After this change the segment is ~380–480 ms in most cases, so
  the non-debounce part fell by roughly half.
- **The remaining main-thread cost is Blink `Layerize` over the Preview's per-glyph clip nodes.** It is
  ~100 ms for each necessary structural frame: the edit echo and the save-status pulse.
  - Removing it needs a Preview paint-structure change: the per-unit `overflow: hidden` clip, or
    fewer mounted cards.
  - Both change Preview pixels or scrolling UX. That needs a product decision and Human visual
    approval, so it is not part of this change.
  - This is also the ~100 ms keystroke floor Phase 9 identified.
- With writing-check issues present, the overlay still hides stale underlines and re-shows them after
  each edit, which is the contract. So those manuscripts keep that one extra structural frame.
- Total input→Preview latency is dominated by Core in the worker (1.2–1.5 s at 300k) and did not
  change measurably.
- `applyTextInputChange`'s fallback (no `beforeinput`) is still a whole-text diff. No measured browser
  action reaches it.

## 10. Human QA

1. With a real OS Japanese IME, type and convert quickly near the end of a long (~300k) manuscript.
   Check that typing and the writing-check underlines feel smooth, on both FULL and WINDOWED.

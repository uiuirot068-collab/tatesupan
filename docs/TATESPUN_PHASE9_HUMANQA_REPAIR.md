# TateSpun Phase 9 — Human QA Repair

- Baseline HEAD: `04cfda09e29ea0656a632973abdf7f3ce4babe83` (`04cfda0`), branch `tsp-post-beta-typography-phase1`
- Date: 2026-09-28 (local only — no push / merge / deploy; production unchanged)
- Editor surface default: **FULL** (unchanged). WINDOWED is still opt-in at build time
  (`NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED`, `src/lib/editorSurfaceRollout.ts`). LEGACY renderer / emergency recovery untouched.

## Human QA findings → status

| # | Human QA report | Result |
|---|---|---|
| 1 | 約30万字の冒頭で Enter / paste → Preview 反映 3〜5 秒 | Reproduced (≈3 s per edit at 704 pages; 20k-char paste ≈16 s). Root cause measured: V2 Core layout in the worker (not React, not Preview apply). **Not fixed in this repair** — see "Known remaining issues". |
| 2 | 525P 付近でエディター入力反映 10 秒超 | **Not reproduced** in headless Chrome on either surface (far-end echo: FULL 255–287 ms, WINDOWED 56–120 ms). The Human QA was most likely on FULL. Needs a Human re-test on real hardware / real IME. |
| 3 | 検索・置換 前へ / 次へ が実用にならない | Fixed: desktop panel inside the Preview pane (editor stays usable), exact match selection, `k / N 件目`, context snippet, Preview follows. Phone keeps the screen modal. |
| 4 | 「全文を選択」ボタンが見えない | Expected on FULL (native Ctrl+A covers the whole manuscript; the button is WINDOWED-only). WINDOWED button verified by E2E. FULL not changed. |
| 5 | 設定 → A5 / 2段 で Preview が崩れる | Fixed (two root causes, below). |
| 6 | 奥付に 2段が漏れてはいけない | Verified: colophon keeps its horizontal geometry (Publication unit tests; Preview uses the unchanged LEGACY `ColophonPageCard`). |

## Root causes

### A5 / 2段 (two independent causes)

1. **V2 paint placed the two 段 side by side.** Core composes 2段 as two sequential `CanonicalColumn`s; both
   the Preview and Publication paint models offset column *i* by `i × columnExtent` horizontally. TateSpun's
   2段 (legacy `computePageLayout` / `PageCard`) is 上段 → 下段, stacked vertically on the same lines.
   Fix: shared paint-only helper `typesetting-v2/renderer/columnStack.ts`, used by both paint models, so
   Preview and PDF/JPG cannot drift. The 下段 starts at the legacy 段 frame
   (`computePageLayout().columnHeightMm`, i.e. `(版面高 − 段間) / 2`) + 段間 — exactly where legacy PageCard
   starts it — and never inside a longer line (`max(lineExtent, frame)`). Opt-in only from the Editor bridge
   (`columnCount === 2`); Core fixtures and the colophon keep the historical horizontal placement.
2. **The settings layer produced a full-page-height line for 2段.** `deriveMaxCapacityFromMargins`
   (TSP-LOOP-031B, used after every paper / 段数 preset in the default 余白 mode) capped `charsPerLine`
   by the full 版面高, ignoring 段数. Real path 設定 → A5 → 2段 committed `charsPerLine = 51`
   (≈171 mm) for an 83 mm 段, so even correctly stacked 段 ran off the page (350 mm on a 210 mm sheet).
   The A5 `cols2` template itself intends 25 字/段. Fix: that function now uses the per-段 height
   (`computeColumnHeightMm`) → 24 字 for A5 2段. For 1段 the value is byte-identical (段 height = 版面高).

### Search / replace
The dialog was a screen-covering modal over the editor, so the selected match was hidden behind it and
nothing followed in Preview. Now (desktop ≥ md) it renders inside the Preview pane (`placement="preview"`,
non-blocking), the editor receives focus + the exact selection, and the existing caret → Preview follow
moves the Preview to the match's page. Phone keeps `placement="screen"`.

### Long-manuscript Preview latency (measured, not fixed)
Per-edit Preview latency split (FULL, 704 pages): debounce→request 0.4–0.9 s, **worker layout 2.3–3.0 s**,
apply→paint ≤ 90 ms. A 20k-character paste without line breaks: worker layout 14.9–15.2 s.
Isolated Core check (`composeV2Layout`, Shippori metrics): one paragraph of 5k / 10k / 20k characters =
0.73 s / 2.9 s / 15.9 s, the same characters split into 100-character paragraphs = 38 / 65 / 117 ms.
Core layout is superlinear in *paragraph length*. Likely hotspot (not yet profiled):
`core/compose/column.ts` re-slices the remaining units after every line (`sliceUnitsFrom`), and for a single
huge TEXT unit that rebuilds the text each time (`Array.from(owner.text)` in `line.ts`). This is protected
Core composition and needs its own parity-guarded task.

## Files changed

Modified
- `src/components/SearchReplaceModal.tsx` — `placement` prop (screen / preview), `data-search-match-context` snippet.
- `src/components/TategakiEditor.tsx` — desktop panel inside the Preview pane (`hidden md:block`), phone modal (`md:hidden`).
- `src/lib/pageLayout.ts` — `deriveMaxCapacityFromMargins` uses the per-段 height (2段 only; 1段 unchanged).
- `src/lib/v2Bridge/composeV2Document.ts` — `editorColumnStack()` (direction, 段間, 段 frame) into the Publication context and the bridge result.
- `src/lib/v2Bridge/buildV2PreviewDocument.ts` — the same three values into the Preview context.
- `typesetting-v2/renderer/preview/paintModel.ts`, `typesetting-v2/renderer/publication/paintModel.ts` — use the shared helper; colophon forced to horizontal.

New
- `typesetting-v2/renderer/columnStack.ts` — shared column placement / body extent.
- `typesetting-v2/renderer/publication/columnStack.test.ts` (moved from `renderer/`, which no vitest config includes).
- `src/lib/v2Bridge/twoColumnStackParity.test.ts` — real A5 → 2段 UI path, Preview = Publication, PaintPlan bands, colophon, 1段 unchanged, ruby / 傍点 / TCY, ノンブル, every paper preset.
- `src/components/phase9HumanQaRepairContract.test.ts` — wiring contract.
- `tests/e2e/phase9HumanQaRepair.e2e.mjs` — explicit-run browser QA + long-manuscript latency (either surface).

Not changed: ノンブル / 柱 painting (font, 本文からの距離, placement freedom), images (page-relative), LEGACY renderer, WINDOWED default, Core.

## Tests

| Suite (config) | Result | Baseline `04cfda0` |
|---|---|---|
| `src/lib/v2Bridge` | 333 passed, 1 skipped | — (new tests +15) |
| `typesetting-v2/renderer/preview` | 114 passed | 114 passed |
| `typesetting-v2/renderer/publication` | 625 passed, **9 failed** | 621 passed, **9 failed** (same) |
| `src/components` | 292 passed, **3 failed** | 289 passed, **3 failed** (same) |
| `src/lib` | 720 passed, **25 failed** | 720 passed, **25 failed** (same) |
| windowedEditor / editorPagination / hooks / utils | 45 / 75 / 22 / 11 passed | — |
| `npx tsc --noEmit` | PASS | |
| `next build` (FULL and WINDOWED) | PASS | |

Pre-existing failures (identical on a clean detached worktree at `04cfda0`, `D:\tsp-phase9-baseline`):
publication = the InDesign reference SHA lock (`qa/reference/indesign/molsui-indesign-reference.pdf` is
49,414 bytes in git, the lock expects 49,522); components = DesktopReviewBar / ReadAloud dock card;
lib = Home / HOW TO / RC polish / update-history / export-cancellation source contracts.
`npm run build` stops in `prebuild` (canonical-Supabase guard) because this worktree has no `.env.local`;
`next build` itself was run directly. The publication suite rewrites ~52 tracked QA PDF/JPG files — they were
restored with `git restore` after every run.

## Browser QA (production static export, headless Chrome, 1280×900 unless noted)

Command: `TATESPUN_E2E_BASE_URL=<loopback> node tests/e2e/phase9HumanQaRepair.e2e.mjs`
Evidence (outside the repo): `D:\tsp-phase9-qa-evidence\` (`b1-search-panel-*.png`, `b2-a5-2col-*.png`,
`b2-colophon-*.png`, `run-*.log`, `perf-*.log`, `phase9-results-*.json`).

| Check | FULL | WINDOWED |
|---|---|---|
| B1 panel inside Preview, editor not covered / hit-testable | PASS | PASS |
| B1 前へ/次へ selects the exact match (incl. wrap 1 → 5), `k / 5 件目`, snippet | PASS | PASS |
| B1 Preview follows to the match page | PASS (0.4–0.9 s) | PASS (0.3–0.8 s) |
| B1 phone 390×844: screen modal only | PASS | PASS |
| B2 設定 UI → A5 → 2段: 上段 above 下段, same right edge, gap 14 px, 0/800 glyphs outside sheet | PASS | PASS |
| B2 colophon renders horizontally inside its sheet | PASS | PASS |
| `windowedLongDocument.e2e.mjs` (switch, 70k paste + undo, 全文を選択, cross-page 次へ) | PASS (全文を選択 N/A) | PASS |

PDF/JPG for 2段 were verified at the PaintPlan level (the plan both executors consume), not by opening an
exported file in the browser.

## FULL vs WINDOWED — long manuscript

Fixture: 300,026 characters, 704 Preview pages (default 文庫 settings), production static export, headless
Chrome on this PC. "echo" = input sent → first frame whose editor value changed; "Preview" = input sent →
frame after the first Preview layout reply. Three typing samples each; single samples otherwise.

| | FULL start | FULL end (~p.704) | WINDOWED start | WINDOWED end |
|---|---|---|---|---|
| type echo (ms) | 66 / 57 / 58 | 263 / 287 / 268 | 59 / 49 / 55 | 104 / 69 / 56 |
| type Preview (ms) | 3016 / 2703 / 2970 | 3108 / 3178 / 3029 | 2967 / 2784 / 2960 | 3268 / 2790 / 2737 |
| Enter echo / Preview | 108 / 2932 | 132 / 2713 | 89 / 2868 | 104 / 2839 |
| 20k insert echo / Preview | 65 / 15982 | 274 / 15804 | 94 / 16019 | 74 / 15413 |
| undo (Ctrl+Z) echo / Preview | 164 / 3663 | 92 / 3051 | 208 / 3654 | 232 / 3637 |

| | FULL | WINDOWED |
|---|---|---|
| open (to first layout) | 3.2–5.5 s | 3.2–5.2 s |
| search jump to the far-end match: editor / Preview | 13–18 ms / 403 ms | 163–172 ms / 336–369 ms |
| document switch long → short: editor / Preview | 56–150 ms / 1.3–1.4 s | 127 ms / 1.3 s |
| document switch short → long: editor / Preview | 419–424 ms / 4.1–4.2 s | 30–43 ms / 4.0–4.1 s |

Notes
- The 20k "paste" is `Input.insertText` (the native IME-commit path): this headless Chrome has no working
  clipboard, so native Ctrl+V could not be measured (probe detects this and labels it). A real paste of the
  same text is expected to cost the same layout, but that is **UNKNOWN** until measured.
- FULL far-end typing echo (~270 ms) is the native textarea cost of a 300k-character controlled textarea
  (Phase 8). WINDOWED stays ≤ 120 ms at both ends.
- Preview latency is the same on both surfaces: it is Core layout, independent of the editor surface.
- Japanese IME: **NOT verified at OS level** (no real IME composition in headless). No IME PASS is claimed.

## Human QA still required

1. Re-test the "10 s editor echo at ~525P" on the tester's real machine, on FULL **and** on a WINDOWED
   build, with real Japanese IME input (not reproduced here).
2. A5 / 2段: visual check of Preview, exported PDF and JPG (上段 → 下段, 段間, ノンブル position) and of the
   colophon in PDF/JPG.
3. Existing 2段 documents saved before this fix keep their stored `charsPerLine` (e.g. 51). They are fixed
   when 用紙 / 段数 is re-selected (or 余白 edited) in 設定; confirm this is acceptable.
4. Desktop search panel UX (position over the Preview top, focus moving to the editor on 前へ/次へ).
5. Real clipboard paste timing on a long manuscript.

## Known remaining issues

- **Preview latency on long manuscripts** (~3 s per edit at 704 pages; superlinear in paragraph length —
  ~16 s after a 20k-character single-paragraph paste). Core layout, both surfaces.
- **文字数・行数 (capacity) mode + 2段** is still inconsistent at the settings layer: `deriveFrameMargins`
  sizes the 版面 as one 段 (`charsPerLine × 字送り`), and `computePageLayout` still clamps `charsPerLine` by the
  full 版面高. Not reported by Human QA; changing it alters the TSP-031 frame math and needs a product decision.
- Stored 2段 documents with an over-long `charsPerLine` are not migrated automatically (see Human QA 3).
- Pre-existing test failures listed above (InDesign reference SHA lock, source-string contracts).

## Next safe step

1. Human QA of items 1–4 above on this local build (FULL default; optionally a WINDOWED build).
2. Separate, parity-guarded Core task: profile `composePages` on a single 20k-character paragraph, remove
   the per-line re-slicing, and lock byte-identical canonical output (Core fixtures + Publication PaintPlan).
3. Product decision on capacity-mode 2段 frame math and on migrating stored 2段 `charsPerLine`.
4. Keep WINDOWED opt-in until it has FULL-equivalent features **and** Human QA; this repair does not change
   that.

---

## 検索・置換 Human-QA repair (2026-09-28)

Follow-up on Human QA item 4. WINDOWED long-manuscript input, 全文を選択, A5/2段, JPG and PDF were PASS on
the tester's machine; **検索・置換 was UX FAIL**.

### What failed

- The feature was labelled only 「置換」, so it did not read as a search tool.
- 「次へ」 advanced the counter (`3 / 2646件目`) and the snippet, but the editor did not visibly move to the
  match, so it was unclear where the match was.
- The only practical replace action was 「すべて置換」; there was no way to replace just the current match.

### Root cause

- **FULL:** `navigateToGlobalOffset` calls `el.focus()` **before** `el.setSelectionRange()`. A real mouse
  click on 次へ blurs the textarea. `focus()` then scrolls to the OLD caret, and Chrome does not scroll for
  the programmatic selection that follows.
  - Reproduced headless with real mouse events at HEAD 95d37d3: the selected text was correct (`瑠璃色壱`),
    but `scrollTop` stayed at 58724 while the match line was at 11885.
  - The Phase 9 E2E missed this because it pressed the button with a synthetic `element.click()`, which
    never blurs the editor.
- **WINDOWED** already scrolled correctly through `PagedEditor.moveSelectionToGlobal` (`scrollHint: "upper"`).
  It had one edge case: a non-empty range ending exactly at an 編集ページ boundary mounted the NEXT page
  (forward affinity on `end`), so the selection clamped to offset 0 there.
- The dialog had no single-match replace, and no labels saying that search alone is allowed.

### UX changes

- Toolbar button and dialog title: 「置換」 → **「検索・置換」**. The guide-book sample text is updated to match.
- Fields:
  - 「検索する文字列」
  - 「置換後の文字列（検索だけなら空欄のまま）」. An empty replacement never blocks 前へ / 次へ.
- 前へ / 次へ (and Enter / Shift+Enter in the search field) select the match in the editor **and** scroll
  it into the upper part of the textarea, with the editor focused:
  - FULL: `EditorPane.revealSearchMatch` runs focus without scrolling, then select, then
    `scrollCaretNearUpperView`. This is the helper PagedEditor already used, now exported.
  - WINDOWED: switches 編集ページ, then scrolls and selects. A non-empty range now maps to the page of its
    last character, and a jump ends an explicit 全文を選択.
- The count (`n / N 件目`), the snippet and Preview follow are unchanged. The panel stays inside the Preview
  pane on desktop; phones keep the screen modal.
- New **「選択箇所を置換」**:
  - Replaces only the active match as one edit. WINDOWED uses `replaceRangeGlobal`, so it is undoable.
    FULL follows the page-break insertion path and is not counted as written text.
  - The dialog then activates the next match once the new manuscript has committed. It never lands on text
    it just inserted (e.g. 山 → 山田), and it wraps.
  - Disabled until a match is active.
- **「すべて置換」**: unchanged behaviour (whole manuscript, closes the panel), except the replacement is
  now literal. `$&` / `$1` in the replacement string were previously interpreted by `String.replace`.
- **0 件**: status shows 「0 件」; 前へ / 次へ / 選択箇所を置換 / すべて置換 are disabled and no snippet is shown.
- A search-text change resets the active match to none, so a stale range cannot be replaced; the next 次へ
  goes to match 1. Nothing jumps while typing, which would steal focus from the field.
- 「キャンセル」 → 「閉じる」, since the panel is also used for search only. Escape also closes it.
- One search implementation: `src/lib/searchReplaceNavigation.ts` (pure, UTF-16 canonical offsets).
  FULL and WINDOWED only differ in how `EditorPaneHandle.revealSearchMatch` and `replaceSearchMatch`
  apply a range. IME: FULL ignores a reveal mid-composition; WINDOWED defers it to `compositionend`, as before.

### Files

- `src/lib/searchReplaceNavigation.ts` (new): find, step, reducer, view, single-replace plan, literal replace-all.
- `src/components/SearchReplaceModal.tsx`: UI, 選択箇所を置換, post-replace reveal.
- `src/components/EditorPane.tsx`: `revealSearchMatch` / `replaceSearchMatch` handle methods and the toolbar label.
- `src/components/PagedEditor.tsx`: `scrollCaretNearUpperView` exported; range affinity; 全文を選択 reset
  on a jump.
- `src/components/TategakiEditor.tsx`: wiring for both placements.
- `src/constants/sampleData.ts`: guide-book label ［検索・置換］.
- Tests:
  - New: `src/lib/searchReplaceNavigation.test.ts`, `src/components/searchReplaceUx.test.tsx`,
    `tests/e2e/searchReplaceNavigation.e2e.mjs`.
  - Updated: `src/lib/friendQaGuide.test.ts` and `src/components/reviewHub.test.tsx` (label),
    `src/lib/pagedEditorBoundaryAndPreviewLanding.test.ts` (affinity), `tests/e2e/phase9HumanQaRepair.e2e.mjs`
    (閉じる).

### Tests

- `src/lib/searchReplaceNavigation.test.ts` (17): count, 次へ index, last→first wrap, 前へ reverse wrap,
  search-only with an empty replacement, 0 件 disabled state, query change resets the index, stale index
  after an edit, 選択箇所を置換 (only the active match changes; the next match is consistent; wrap and finish;
  no self-loop with 山→山田; stale range refused; astral characters and line breaks), すべて置換 (whole
  manuscript; literal `$&`), and WINDOWED page mapping (a match on another 編集ページ; a boundary-ending
  range stays on its own page).
- `src/components/searchReplaceUx.test.tsx` (8):
  - Naming and disabled buttons, via static render.
  - Desktop pane vs phone modal placement (mobile regression).
  - Wiring contract: no surface-specific search in the dialog; FULL does select → scroll; WINDOWED goes
    through `moveSelectionToGlobal` with backward affinity and IME deferral; 選択箇所を置換 is an undoable
    WINDOWED edit.
- Scoped suites:
  - components: 300 pass / 3 fail. The failures are in `desktopReviewBar` and `readAloudDockCard` and are
    the same 3 at baseline 04cfda0.
  - src/lib: the failing set is identical to baseline (25 pre-existing).
  - editorPagination 75, windowedEditor 45, hooks 22, constants 7: all pass.
- `npx tsc --noEmit`: clean.

### Browser QA (static export, headless Chrome, 1280×900, real mouse events)

`tests/e2e/searchReplaceNavigation.e2e.mjs` uses a 120k-character manuscript with 5 matches (WINDOWED: 3
編集ページ). **PASS on both FULL and WINDOWED builds.**

| check | FULL | WINDOWED |
|---|---|---|
| 検索・置換 opens in the Preview pane, editor uncovered | PASS | PASS |
| `5 件見つかりました` with an empty replacement | PASS | PASS |
| 次へ ×3, 前へ ×3 (wraps to 5), 次へ (wraps to 1): match selected, **inside the visible textarea area**, editor focused, snippet updated | PASS | PASS |
| other 編集ページ reached (1/3 → 2/3 → 3/3) | n/a | PASS |
| Enter = 次へ | PASS | PASS |
| 選択箇所を置換: only 弐 changed (saved manuscript: 4 × 瑠璃色, length −1); next match 参 selected and visible; a 2nd press moves on to 肆 | PASS | PASS |
| undo of 選択箇所を置換 | (FULL: not undoable, same as 改ページ挿入 / すべて置換) | PASS |
| 0 件: all four action buttons disabled, no snippet; query change resets to `N 件見つかりました` | PASS | PASS |
| すべて置換: saved manuscript has 0 × 瑠璃色, 5 × 群青; reopening and searching finds 5 | PASS | PASS |
| 閉じる → click the editor → typing works | PASS | PASS |
| phone 390×844: screen modal only, title 検索・置換, 次へ works | PASS | PASS |

The toolbar row was measured at 320–1280 px. The button is 42 → 78 px wide, with no row overflow, one line,
and no horizontal page scroll at any width (same as base).

Regression E2E on the same builds:

- `phase9HumanQaRepair.e2e.mjs`: PASS on FULL and WINDOWED. Covers search Preview follow, phone modal,
  A5/2段 Preview, colophon, and the 300k-character manuscript. The search jump to the far end takes 441 ms
  on FULL and 170 ms on WINDOWED.
- `windowedLongDocument.e2e.mjs`: PASS on FULL and WINDOWED. Covers the document switch, 70k insertion +
  undo, 全文を選択 copy, and cross-page find.
- `editorInputIntegrity.e2e.mjs`: PASS. Covers the input/undo matrix.
- `headerTabletDensity.e2e.mjs`: FAIL at 906×720 on **both** base and new builds. This is the known
  pre-existing assertion.
- PDF / JPG / ノンブル / 奥付 code paths are untouched by this change.

### Build

- `npm run build` stops at the prebuild canonical-Supabase guard, because this worktree has no `.env.local`
  (checks 1 and 3). This is an environment guard, not a code failure.
- `npx next build` passes for FULL and for `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED`.

### Human QA still required

1. On the tester's machine, real Chrome with the 30万字 manuscript: 次へ / 前へ visibly land on the match in
   FULL and WINDOWED, including a jump to another 編集ページ. Check that the selection highlight is
   noticeable enough.
2. 選択箇所を置換 feel: moving on to the next match automatically, and the focus moving to the editor
   (typing right after a jump overwrites the selected match, as in any editor).
3. FULL: 選択箇所を置換 / すべて置換 are not undoable with 元に戻す, which is pre-existing for すべて置換.
   Decide whether that is acceptable. WINDOWED 選択箇所を置換 is undoable.
4. Phone: the screen modal covers the editor, so the jump is only visible after 閉じる (unchanged design).
5. Guide page `/guide` still titles the card 「置換機能」 (marketing copy; not changed here).

---

## 検索・置換 undo repair (2026-09-28, follow-up)

Human QA on 53fb4f3: jump PASS, 選択箇所を置換 PASS, **FULL undo FAIL**. After 選択箇所を置換, Ctrl+Z left the body
replaced and instead undid the text typed into the panel's input fields.

### Root cause

FULL undo is the textarea's **native** history (Ctrl/Cmd+Z, and 元に戻す / やり直す via `execCommand("undo"/"redo")`).
Both replacement paths committed the new manuscript as a new controlled `value`:

- 選択箇所を置換 used `onContentChange`.
- すべて置換 used `TategakiEditor` `setContent`.

That leaves nothing the native history can revert (verified: after a programmatic value change, native undo is a
no-op). WINDOWED 選択箇所を置換 was already undoable (`replaceRangeGlobal`), but WINDOWED すべて置換 also went
through `setContent` and reset PagedEditor's undo history.

### Fix

- **選択箇所を置換, FULL:**
  - Selects the match and runs the native `insertText`, or `delete` for an empty replacement.
  - The edit is one step on the same native history as typing, so Ctrl+Z / Ctrl+Y / 元に戻す / やり直す revert and
    re-apply it, interleaved correctly with typing.
  - It is not counted as written text: `searchEditInFlightRef` syncs the activity state instead.
  - Cost is 4–10 ms in a 302k-character textarea (measured).
- **すべて置換, FULL:** a native command is not viable. Chrome's `insertText` cost grows with the edited span AND
  the document; for a 302k-character manuscript, measured in isolation:
  - one command over the whole span: 29–51 s
  - chunked at the caret (merges into one undo step, but no faster): 42–46 s
  - even a 1,000-character span: 220 ms

  So it is committed as a controlled value and recorded as a **checkpoint** `{before, after}` (last 20):
  - Ctrl/Cmd+Z, Ctrl+Y, Ctrl/Cmd+Shift+Z and 元に戻す / やり直す consult the checkpoint **before** native history,
    and only while the textarea holds exactly the checkpoint text.
  - Typing after a すべて置換 is therefore undone first (native), then the next Ctrl+Z reverts the whole すべて置換
    in one step.
  - A new non-history edit clears checkpoint redo.
  - 302k characters: すべて置換 0.7 s (was 51 s with the native attempt), undo 0.6 s.
- **すべて置換, WINDOWED:** now one atomic `replaceRangeGlobal` over the first..last changed character
  (`minimalReplacementRange`, never splitting a surrogate pair). It is undoable in one step, keeps manual
  編集ページ boundaries outside that span, and takes 0.23 s at 302k.
- Focus is in the editor after both operations, so the next Ctrl+Z lands on the body. The panel inputs keep their
  own ordinary input undo while focused.
- Unchanged: jump, scroll, selection, auto-advance to the next match, snippet, `n / N 件目`, Preview follow,
  mobile modal, and すべて置換 closing the panel.
- `/guide` card 「置換機能」 → 「検索・置換」, with a body that says search alone works. Its linked Help section
  (`public/docs/help.md#replace`) now uses the current UI labels, explains search-only use and 選択箇所を置換, and
  says that すべて置換 is undone in one step. It no longer claims one-at-a-time replacement is unavailable.

### Known limits

- FULL: native undo steps recorded **before** a すべて置換 can no longer be reached after it (the programmatic
  value change ends them). This is the same pre-existing behavior as 改ページ挿入 on FULL.
- FULL: after the checkpoint redo of a すべて置換, a native redo of a later 選択箇所を置換 is a no-op.

### Tests

- `src/lib/searchReplaceNavigation.test.ts`: +3 for `minimalReplacementRange`:
  - reproduces the replace-all result exactly, spanning only first..last change
  - single replacement, deletion, and no change
  - surrogate pairs at both edges
- `src/components/searchReplaceUx.test.tsx`: the wiring contract now covers:
  - FULL uses native `insertText` / `delete` and is not counted as writing
  - WINDOWED uses `replaceRangeGlobal`
  - the FULL すべて置換 checkpoint is value-guarded and consulted before native history by the keys and by
    元に戻す / やり直す
  - `TategakiEditor` no longer uses `setContent` for すべて置換
  - the /guide and Help labels
- `tests/e2e/searchReplaceNavigation.e2e.mjs`, run with real mouse and real keyboard (Ctrl+Z / Ctrl+Y with the
  bound editing command):
  - the replacement is typed into the panel for real
  - 選択箇所を置換, then Ctrl+Z: the saved manuscript equals the original, and the panel input is untouched
  - Ctrl+Y re-applies it
  - 元に戻す reverts a 2nd 選択箇所を置換
  - すべて置換, then one Ctrl+Z: exact pre-replace manuscript; Ctrl+Y re-applies it
  - the /guide label
  - Against the 53fb4f3 FULL build it FAILS at "Ctrl+Z restores the manuscript before 選択箇所を置換",
    reproducing the Human QA report. With the fix it PASSES on FULL and WINDOWED.
- 302k-character probe (FULL and WINDOWED), all PASS:
  - empty-replacement 選択箇所を置換, then Ctrl+Z
  - すべて置換 → type → Ctrl+Z (typing) → Ctrl+Z (whole すべて置換)
  - Ctrl+Y, 元に戻す, やり直す

### Regression and build

- `searchReplaceNavigation`, `windowedLongDocument` and `phase9HumanQaRepair` (A5/2段, colophon, 300k manuscript,
  search Preview follow, phone modal): PASS on FULL and WINDOWED static builds.
- `editorInputIntegrity` (starts its own WINDOWED dev server): PASS.
- Vitest:
  - components: 301 pass / 3 fail. The 3 failures are pre-existing (desktopReviewBar, readAloudDockCard), same as
    baseline.
  - src/lib: the failing set is identical to baseline.
  - editorSessionActivity: 2 pre-existing isolation-contract failures, same at baseline 04cfda0.
  - editorPagination, windowedEditor, hooks, constants: all pass.
- `npx tsc --noEmit`: clean.
- `npx next build`: PASS for FULL and WINDOWED.
- `npm run build`: stops at the canonical-Supabase guard, because this worktree has no `.env.local`.

### Human QA still required

1. FULL on the real machine, with real IME and a 30万字 manuscript:
   - 選択箇所を置換, then Ctrl+Z and Ctrl+Y (and 元に戻す / やり直す)
   - すべて置換, then one Ctrl+Z
   - typing between operations
2. Confirm that the FULL limit above (history from before a すべて置換 is not reachable after it) is acceptable.
3. macOS Cmd+Z / Cmd+Shift+Z (headless QA ran on Windows key bindings only).

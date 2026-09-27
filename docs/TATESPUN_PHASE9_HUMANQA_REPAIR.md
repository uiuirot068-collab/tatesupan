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

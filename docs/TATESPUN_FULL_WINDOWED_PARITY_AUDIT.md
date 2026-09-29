# TateSpun FULL / WINDOWED Editor Parity Audit

Audited 2026-09-29 on branch `tsp-post-beta-typography-phase1`. The baseline is `2827968`.

FULL (the single full-manuscript `<textarea>`) is the reference implementation. WINDOWED
(`PagedEditor`: one ~50k-character 編集ページ mounted at a time) is audited against it.
**WINDOWED was not made the default.** This document is the input to that decision; it does not make it.

## 1. Where the surfaces actually diverge (source)

`NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED` is read in one place, `editorSurfaceRollout.ts`, and
used in one component, `EditorPane.tsx`. There, `isWindowed` swaps exactly one subtree: the inline
`<textarea>` (FULL) or `<PagedEditor>` (WINDOWED).

Everything else is **the same code on both surfaces**, reading and writing the canonical `content`
string:

- `TategakiEditor`: document load, autosave and DocumentEpoch, cloud save, images, TXT/DOCX, and the
  `Ctrl+S` shortcut.
- `PreviewPane`: the Preview, page list, settings, colophon, image ownership and warnings, the
  PDF/JPG/ZIP export, and the zoom shortcuts.
- `SearchReplaceModal`, the Review Hub, 文章チェック, 音読, 描写チェック, Help, and the demo tour.

No code outside the two surfaces touches the textarea directly (checked with grep).

The surface-specific behaviours are all in `EditorPane`, and each routes both ways:

| entry point | FULL | WINDOWED |
|---|---|---|
| undo/redo | native history, plus the すべて置換 checkpoint stack | `undoModel.ts` (application history) |
| 改ページ挿入 | controlled value | `replaceRangeGlobal` (atomic) |
| search reveal / replace | native `insertText` | `replaceRangeGlobal` |
| Preview/Writing-Check jump | `setSelectionRange` | `moveSelectionToGlobal` (switches 編集ページ) |
| read-aloud selection, description marks, ghost ranges | textarea selection | `getSelectionGlobal`, page-local overlays |

## 2. Method

Every conclusion below comes from the source reading in §1 plus measurements on production static
builds (baseline and after, FULL and WINDOWED; 4 builds):

- **`tests/e2e/editorSurfaceParity.e2e.mjs`** (new) runs 31 scripted scenarios on either surface.
  For each it records:
  - the canonical text after every step;
  - how many Ctrl+Z / Ctrl+Y presses each operation takes;
  - the caret after edits and undo;
  - saved and restored state.

  `scripts/perf/compareSurfaceParity.mjs` diffs the FULL and WINDOWED results. They are in
  `scripts/perf/results/surface-parity-{baseline,after}-{full,windowed}.json`.
- **`tests/e2e/editorSurfaceScreens.e2e.mjs`** (new) takes UI-state screenshots and makes structural
  assertions (no horizontal overflow, a usable editor height, and every editor action visible and
  not covered). It covers desktop and mobile (390×844, 320×568, 768×1024).
- **`tests/e2e/editorEchoLatency.e2e.mjs`** (new) measures input → next painted frame on a 300k
  manuscript.
- **`tests/e2e/previewVisualParity.e2e.mjs`** pixel-diffs the Preview cards across surfaces.
- The full existing E2E battery, run on both surfaces.

Status values: PASS · MISSING · PARTIAL · DIFFERENT · FULL-ONLY-BY-DESIGN · WINDOWED-ONLY-BY-DESIGN ·
UNKNOWN. Severity: P0 (data loss / wrong saved text / undo cannot restore) · P1 (a major FULL
editing capability is missing) · P2 (behaviour/UX/keyboard/focus/mobile difference) · P3 (visual,
label, Help).

## 3. Gaps found

| ID | category | feature | FULL | WINDOWED (baseline) | behaviour same? | data semantics same? | undo same? | mobile same? | export impact? | severity | action | verification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G-01 | A editing | 全文選択 + **Enter** | manuscript → `"\n"` | manuscript → `""` (`beforeinput.data` is null for a line break) | no | **no** | 1 step both | same | the saved text differs | **P0** | **FIXED** | parity `wholeSelectionEnter`, `longWholeSelectionEnter`: now identical |
| G-02 | A editing / IME | IME conversion over 全文選択 (multi-page) | the whole manuscript → the composed text | only the **mounted 編集ページ** was replaced (123,088 of 173,092 chars survived); 1 undo did not restore | no | **no** | **no** | same | the saved text differs | **P0** | **FIXED** | parity `longWholeSelectionIme`: identical, and 1 undo restores |
| G-03 | A editing | **Ctrl+A** (then type / copy / cut) | the whole manuscript | the mounted 編集ページ only; the whole manuscript needs 「全文を選択」 | no | **no** (Ctrl+A + type on 173k: FULL keeps 1 char, WINDOWED keeps 123k) | 1 step both | same | via the saved text | **P1** | **NOT FIXED: product decision.** Ctrl+A = page-only was a Human-QA decision (TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §C/§D) | parity `longCtrlASemantics` |
| G-04 | B document | a selection **across** an 編集ページ boundary (drag / Shift+arrows) | any range | impossible (one page is mounted). Workarounds: 前のページとつなぐ (≤55k), 全文を選択 | no | n/a | n/a | same | none | **P1** | **NOT FIXED: needs a cross-page selection model (large rewrite)** | source (`PagedEditor` mounts one page); Phase 8 readiness doc |
| G-05 | A/B editing | the caret after 改ページ挿入, undo, redo, 検索 replace, and cross-boundary Backspace/Delete | where the edit happened | **the end of the 編集ページ** (the selection was set before React committed the new text, then reset by the value assignment) | no | yes | yes | same | none | P2 | **FIXED** | parity `pageBreakButton` caret 13 = 13, `enter` caretAfterUndo 6 = 6 |
| G-06 | F restore | opening a multi-page manuscript | the view at the start (caret at the end, not focused) | opened on **編集ページ 2 / 4**, caret 0, and **focused** the editor (it read the post-commit caret) | no | yes | n/a | same | none | P2 | **FIXED**: opens on 編集ページ 1 at the start without taking focus; a document switch still re-anchors at the last caret | parity `longReopenPosition`; reopen trace |
| G-07 | A undo | undo granularity of a typing burst / repeated Backspace / Delete | 1 step per keystroke (Chrome native; real key events: 3 keys = 3 steps) | 1 step per burst (`undoModel` batches ≤800 ms, ≤200 chars) | no | yes | **no** (coarser) | same | none | P2 | **KEPT (by design)**: the documented undo model (51 unit tests), the usual editor convention | parity `typingBurst`, `typingRealKeys`, `backspace3`, `delete2` |
| G-08 | I/B UI | browser Ctrl+F, spellcheck, screen reader | the whole manuscript | the mounted 編集ページ | no | n/a | n/a | same | none | P2 | **KEPT (by design)**: the app's 検索・置換 searches the whole manuscript and switches 編集ページ | `searchReplaceNavigation`, `windowedLongDocument` FLOW 4 |
| G-09 | I mobile | editor height at 320×568 | 248 px | 181 px (the 編集ページ navigator takes 2 rows) | layout only | yes | n/a | **no** | none | P2 | **NOT FIXED: UX/product decision** (e.g. collapsing the navigator on phones) | `editorSurfaceScreens` (all structural checks PASS) |
| G-10 | A accounting | work-session character count for an input with **no** `beforeinput` | a whole-text diff | page text compared against the whole manuscript (would over-count) | no | yes (count only; the manuscript is never affected) | n/a | same | none | P3 | **NOT FIXED**: no measured input reaches it (typing, Enter, Backspace, Delete, paste, cut, drop and IME all fire `beforeinput`) | source (`EditorPane` `onNativeChangeCommitted`) |
| G-11 | I visual | placeholder colour of an empty manuscript | `placeholder:text-ink/40` | full-strength ink | no | yes | n/a | same | none | P3 | **FIXED** | `pagedEditorParityFixes.test.ts` |
| G-12 | A clipboard | line endings of a whole-manuscript copy | CRLF (OS clipboard, Windows) | exact LF | cosmetic | equivalent (a paste normalizes back to LF) | n/a | same | none | P3 | none needed. The WINDOWED paste path now also normalizes CRLF → LF like a native paste | parity `wholeSelectionCopy` |
| G-13 | J help | /howto and the demo tour describe 編集ページ, 全文を選択 and ここで区切る | shown on FULL builds too, where these do not exist | matches | — | — | — | — | — | P3 (FULL-side) | none: deliberately surface-independent (`demoData.ts` §G) | source |

Observed on the **FULL** reference (for the record; not WINDOWED gaps and not changed):

- **F-01**: 改ページ挿入 on FULL is **not undoable** (neither Ctrl+Z nor 元に戻す; the controlled value
  write clears native history). On WINDOWED it is one undo step. Parity `pageBreakButton`.
- **F-02**: a reload **inside** the 1.5 s autosave debounce loses that edit on **both** surfaces in
  headless Chrome (the pagehide flush is best-effort, as known from Phase 6.1). A reload after the
  autosave restores it on both. Parity `reloadInsideDebounce`, `reloadAfterAutosave`, `autosaveFlush`.

## 4. Parity matrix (everything checked)

| category | feature | FULL | WINDOWED (after) | status | evidence |
|---|---|---|---|---|---|
| A | typing, IME commit, Enter, Backspace, Delete, selection replace | ✓ | ✓ same text and caret | PASS (undo steps G-07) | parity (7 scenarios) |
| A | real deletion integrity (10-case matrix) | ✓ | ✓ | PASS | `editorInputIntegrity` on 4 builds |
| A | copy / cut within a page | ✓ | ✓ | PASS | parity `copyCutWithinPage` |
| A | paste at the caret | ✓ | ✓ | PASS | parity `pasteAtCaret` |
| A | Ctrl+A | whole | page | DIFFERENT (G-03) | parity |
| A | 全文を選択 + type / Enter / Backspace / paste / IME / cut / copy (1 page and 4 pages) | Ctrl+A equivalent | ✓ | **PASS after fix** (G-01, G-02) | parity (12 scenarios) |
| A | undo / redo (keys and toolbar), cross-編集ページ undo | ✓ | ✓ | PASS (granularity G-07) | parity `toolbarUndoRedo`, `longEndEditAndCrossPageUndo` |
| B | 改ページ挿入 | not undoable (F-01) | ✓ undoable, caret fixed | PASS (better than FULL) | parity `pageBreakButton` |
| B | Backspace at an 編集ページ start | n/a | removes exactly 1 char | WINDOWED-ONLY-BY-DESIGN | parity `longPageBoundaryBackspace` |
| B | 編集ページ navigation, ここで区切る, 前のページとつなぐ | n/a | ✓ | WINDOWED-ONLY-BY-DESIGN | `windowedLongDocument`, unit tests |
| B | 検索, 前へ/次へ (whole manuscript), 選択箇所を置換, すべて置換, and their undo/redo | ✓ | ✓ | PASS | `searchReplaceNavigation` on both |
| B | selection across 編集ページ | ✓ | — | MISSING (G-04) | source |
| C | paper, 段組, margins, lines/chars, font, size, spacing, ノンブル, 柱, 奥付 | shared | shared | PASS | Preview cards pixel-identical across surfaces (below); `phase9HumanQaRepair` (A5 2段 + colophon) on both |
| D | ruby, 傍点, 縦中横, dash, ellipsis, decorations | shared | shared | PASS | Preview pixel parity (character sheet × 5 fonts) |
| E | image insert, flow, ownership, warnings, recovery | shared | shared | PASS | `previewPageModel`, `imageWarningLifecycle` on both; `imageInsertionPlacement` fails identically on all 4 builds (pre-existing geometry assertion) |
| F | autosave, reload restore, leave/reopen, document switch, DocumentEpoch | shared | shared | PASS (open position fixed, G-06) | `autosaveFlush`, `workSessionIsolation`, `windowedLongDocument` FLOW 1, parity reload scenarios |
| G | Preview follow, search → Preview, colophon, 2段, stale-layout guard | shared | shared | PASS | `phase9HumanQaRepair`, `coreLongParagraphPreview`, `writingCheckOverlayStale` on both |
| H | PDF, JPG, ZIP, page selection, mobile export | shared | shared | PASS | PDF `d3604e0a92c69e72` and ZIP `39b9266f3c1914c5` are identical on all 4 builds; `mobileSharedExport` (6 viewports, 9 downloads) on both |
| I | toolbar, secondary row, modals, export menu, mobile/tablet/desktop layouts | ✓ | ✓ | PASS (mobile height G-09) | `editorSurfaceScreens` structural checks on both |
| I | Review Hub, 文章チェック (jump/fix/まとめて直す), 音読, 描写チェック | ✓ | ✓ | PASS | `reviewHub`, `readAloud`, `descriptionCheck` on both; parity `writingCheckFix` |
| J | Help / guide / demo | ✓ | ✓ | PASS (G-13 is FULL-side) | source |

## 5. Fixes (all in `src/components/PagedEditor.tsx`)

1. **G-01, 全文選択 replacements.** `insertedTextOf()` inserts `"\n"` for
   `insertLineBreak`/`insertParagraph`. It reads paste/drop text from `dataTransfer` when `data`
   is null, and normalizes CRLF → LF like a native textarea paste.
2. **G-02, an IME composition over 全文選択.**
   - `compositionstart` records the manuscript being replaced.
   - While composing, the canonical text is exactly the textarea's text, as in a full-document
     textarea. This means the mounted page is never re-sliced under the IME.
   - `compositionend` commits one atomic undo step back to the original manuscript and stores the
     page actually shown.
3. **G-05, the caret after same-page edits.** `switchToPageForOffset(..., { nextContent })` defers
   the selection to the layout effect while the DOM still holds the pre-edit page text. This applies
   to page break, undo, redo, range replace, the cross-boundary deletes, whole replace, split and
   join.
4. **G-06, re-anchoring.** It uses the last *reported* global caret (`globalCaretRangeRef`), not the
   textarea's post-commit selection. It no longer focuses an editor that did not have focus.
5. **G-11:** the placeholder colour now matches FULL.

These fixes do not touch Core, the Preview, export, the saved schema or migration. `content` is
still the only data the rest of the app reads.

## 6. Verification

**Parity diff** (FULL vs WINDOWED, 30 scenarios in the main run): **17 identical at baseline →
20 identical after**. Every remaining difference is listed in §3 as by design, a product decision,
or FULL-side. All new scenarios ran on both surfaces.

**Preview visual parity** (FULL vs WINDOWED after builds, devicePixelRatio 3): **24/24 Preview card
images are pixel-identical**. They cover 5 fonts, A5 1段/2段, 文庫, 奥付+ノンブル, images, 300k, a
20k paragraph, and mobile. Viewport differences are confined to the editor pane.

**UI screens** (`editorSurfaceScreens`, both surfaces): PASS. The states covered are:

- short / ルビ・圏点・縦中横;
- A5 2段, 奥付, 画像;
- 300k, 編集ページ navigation, 全文選択;
- 検索・置換, the export menu;
- mobile 390, 320 and 768, and the mobile Preview.

Screenshots are in the evidence folder.

**E2E battery** on after FULL and after WINDOWED:

- These pass on both: `writingCheckOverlayStale`, `searchReplaceNavigation`, `windowedLongDocument`,
  `phase9HumanQaRepair`, `previewPageModel`, `imageWarningLifecycle`, `autosaveFlush`,
  `mobileSharedExport`, `coreLongParagraphPreview`, `readAloud`, `reviewHub`, `exportWorkerPerf`,
  `editorInputIntegrity` and `workSessionIsolation`.
- **Pre-existing failures, identical on the baseline builds:**
  - `reviewLayout` ("PreviewPane has no duplicate shadow");
  - `imageInsertionPlacement` (the image bottom-gap assertion; all 4 builds);
  - `editorSessionActivity` (all 4 builds).
- `descriptionCheck` has a **flaky relative typing threshold on both surfaces**: ON ≤ max(120,
  OFF×4+60). In 3 runs each, the baseline passed 2/3 and the after build 1/3. ON medians were
  230–264 ms (baseline) and 253–273 ms (after), while the OFF median swung 34–121 ms, which is what
  flips the verdict.
- `editorInputIntegrity` and `imageInsertionPlacement` gained an optional `TATESPUN_E2E_BASE_URL`,
  the same pattern `editorSessionActivity` already has. With it they run against a built app instead
  of starting their own `next dev`; that mode was needed because a `next dev` was already running in
  this worktree. Their default behaviour is unchanged.

**WINDOWED input performance** (300k, input → next painted frame, median of 5; `editorEchoLatency`):

| operation | WINDOWED before | WINDOWED after | FULL (reference) |
|---|---|---|---|
| insert, beginning | 70 ms | 73 ms | 75 ms |
| insert, middle | 174 ms | 153 ms | 256 ms |
| Enter, middle | 189 ms | 177 ms | 220 ms |
| Backspace, middle | 194 ms | 175 ms | 214 ms |
| undo | 267 ms | 233 ms | 198 ms |
| redo | 250 ms | 235 ms | 186 ms |
| insert, end | 78 ms | 81 ms | **429 ms** |
| search 次へ | 61 ms | 66 ms | 66 ms |

There is no regression; WINDOWED is unchanged or faster. FULL's end-of-manuscript insert is 5× slower.

**Vitest:** 19 configs; the fail sets are **identical to baseline** (Core 408/408). The new
`pagedEditorParityFixes.test.ts` (11 tests) passes. Four existing source-contract tests
(`pagedEditorBoundaryAndPreviewLanding`, `pagedEditorManualMerge` ×2, `pagedEditorWaitingUxHotfix`)
were updated to the new call strings. Each keeps the same checked arguments plus `nextContent`.

**QA artefacts:** 54 regenerated PDF/JPG/ZIP files are identical to the baseline (10 byte-identical,
44 after timestamp normalization).

**Build:**

- `npx tsc --noEmit`: PASS.
- ESLint on the changed files: 0 errors (3 pre-existing `PagedEditor` hook-dependency warnings).
- `npx next build` for FULL and for WINDOWED: PASS.
- `npm run build` was not used: its Supabase guard needs `.env.local`, which is an environment issue.

## 7. Remaining decisions (not implementable safely without them)

1. **Ctrl+A semantics on WINDOWED (G-03, P1).** Should Ctrl+A enter the whole-manuscript mode
   (FULL semantics), or stay page-only (the TSP-010 Human-QA decision)? It is a small code change
   once decided.
2. **A selection across 編集ページ (G-04, P1).** Accept the workarounds (全文を選択,
   前のページとつなぐ), or fund a cross-page selection model (a large change).
3. **The phone navigator height (G-09, P2).** Is 181 px of editing height at 320×568 acceptable, or
   should the navigator collapse?
4. **Undo granularity (G-07, P2).** Keep burst grouping (current) or match per-keystroke steps.
5. **FULL-side F-01** (改ページ挿入 cannot be undone on FULL). This matters only if FULL remains the
   default.

## 8. Update 2026-09-29: decisions applied

The open decisions in §7 were made. Details and verification are in
`TATESPUN_WINDOWED_DEFAULT_READINESS.md`.

| ID | decision | result |
|---|---|---|
| G-03 Ctrl+A | whole manuscript (FULL semantics), through the existing 「全文を選択」 action; inputs keep their own select-all | **CLOSED.** Parity `longCtrlASemantics`: Ctrl+A then type keeps 1 char on both surfaces. |
| G-04 cross-page selection | not provided. Specified way: 全文を選択 / Ctrl+A, or 前のページとつなぐ. Wording added to /howto. | **SPECIFIED (by design)** |
| G-07 undo granularity | WINDOWED batching is the specification | **SPECIFIED (by design)** |
| G-09 phone height | the navigator collapses on phones (starts collapsed): 320×568 goes from 181 to 211 px | **CLOSED** |
| exit rule | Ctrl+A's own keyup cleared 全文選択 through the old one-shot guard, so the rule became "全文選択 lasts while the mounted page stays fully selected". A click inside the selection collapses it only through a late `selectionchange` that React's `onSelect` misses, so a native listener ends it (verified: a click after Ctrl+A, after the button and after a double Ctrl+A all end it) | **IMPLEMENTED** |

## 9. Readiness (as of 6200dc2; superseded by the readiness doc)

**WINDOWED DEFAULT READY: CONDITIONAL.** After these fixes there is no known P0. Save, restore,
export, the Preview and search/replace are identical on both surfaces. The two P1 differences
(Ctrl+A scope, and selection across 編集ページ) remain as product decisions with workarounds. Real OS
IME and touch behaviour on WINDOWED still need Human QA. WINDOWED was not made the default.

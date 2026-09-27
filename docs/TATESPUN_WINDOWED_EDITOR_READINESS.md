# TateSpun Windowed (Paged) Editor Readiness (Phase 8, updated in Phase 9)

Measured 2026-09-27 on branch `tsp-post-beta-typography-phase1`. Performance numbers and method
are in `TATESPUN_LONG_MANUSCRIPT_PERFORMANCE.md` §9. **Verdict: not ready to be the default.** It
stays behind `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED` (`src/lib/editorSurfaceRollout.ts`,
default `FULL`). Phase 8 changed no editor code.

## What it is

`src/components/PagedEditor.tsx` mounts one ~50,000-code-unit 編集ページ of the canonical
manuscript in the native textarea (`src/lib/editorPagination/paginationModel.ts`).
- Boundaries prefer paragraph breaks within 45k–55k characters, extended to ±15k.
- Pages are never persisted. `content` is still the one canonical string for autosave, Preview,
  export and writing check.
- Undo/redo is application-level (`src/lib/windowedEditor/undoModel.ts`).

## Performance (Phase 8 build, same session as FULL)

| | 50p | 100p | 300p | 500p |
|---|---|---|---|---|
| 編集ページ count (≈50k chars each) | 1 | 1 | 3 | 5 |
| keystroke → next frame, FULL | 93 ms | 123 ms | 279 ms | 418 ms |
| keystroke → next frame, WINDOWED | 109 ms | 119 ms | **112 ms** | **103 ms** |
| 8-key burst: layout requests / new workers, FULL | 1 / 0 | 3 / 1 | 8 / 7 | 8 / 7 |
| 8-key burst: layout requests / new workers, WINDOWED | 1 / 0 | 1 / 0 | **1 / 0** | **1 / 0** |
| burst main-thread long tasks, FULL | 74 ms | 676 ms | 1,796 ms | 4,991 ms |
| burst main-thread long tasks, WINDOWED | 194 ms | 621 ms | 798 ms | **1,271 ms** |
| caret jump start / end, FULL | 2 / 17 ms | 2 / 3 ms | 3 / 2 ms | 4 / 6 ms |
| caret jump start / end, WINDOWED | 4 / 5 ms | 3 / 9 ms | 5 / 2 ms | 4 / 3 ms |
| 5,000-char insertion → next frame, FULL / WINDOWED | 114 / 155 ms | 58 / 101 ms | 101 / 118 ms | 132 / 117 ms |
| open → first layout, FULL / WINDOWED | 1.9 / 1.9 s | 2.0 / 2.3 s | 2.8 / 3.2 s | 4.4 / 4.4 s |
| JS heap after edits, FULL / WINDOWED | 46 / 41 MB | 61 / 57 MB | 114 / 112 MB | 167 / 168 MB |

- Up to one 編集ページ (≈100 pages of 文庫 text), both surfaces mount the same text and behave the same.
- From 300 pages, WINDOWED keeps the keystroke frame flat at about 100 ms. That is below the
  180 ms debounce, so a burst coalesces into one layout. FULL grows linearly and every keystroke
  becomes a layout request.
- A ~100 ms floor remains on both surfaces. It does not depend on manuscript size, so it is not
  textarea layout; see the performance doc §9.
- Caret jumps are cheap on both surfaces. Jumping to another 編集ページ remounts the textarea;
  that was not measured separately.
- Memory is dominated by Preview, not by the editor surface.

## Parity / readiness matrix

Status: **OK** = verified in this phase or by an existing automated test; **PARTIAL** = works with
a behavioural difference; **GAP** = missing or not verified.

| area | status | evidence / difference |
|---|---|---|
| exact source preservation | OK | Perf probe (300p, 500p): the saved IndexedDB manuscript equals original + every keystroke, and + exactly the 5,000-char insertion. Boundary check: typing at the end of a non-last 編集ページ, with value-setter input and with CDP `Input.insertText`, saved exactly +3 characters. `editorInputIntegrity.e2e` 10-case deletion matrix. |
| typing at a page boundary | PARTIAL | Text at the end of page K belongs to page K+1's start. After one keystroke there, the editor remounts page K+1 with the caret after the new character. The text is correct, but the view jumps. |
| IME / composition | OK (automated) / human QA needed | `editorInputIntegrity.e2e` cases 6–7 (synthetic composition). IME commit that crosses the page target is reconciled in `handleCompositionEnd`. Real Japanese IME candidate windows were not tested on this surface in Phase 8. |
| selection | PARTIAL | Ctrl/Cmd+A selects the mounted page only. Whole-manuscript selection needs the explicit 「全文を選択」 action. A drag selection cannot cross 編集ページ. |
| clipboard | PARTIAL → **OK (app-level)** | Phase 9, `windowedLongDocument.e2e`: after 「全文を選択」 the copy event carries the whole canonical manuscript (130,080 characters while 30,075 were mounted). Ctrl+A → copy still copies the mounted page only (by design, see the module doc). |
| undo / redo | PARTIAL | Application-level history (`undoModel.ts`, 51 unit tests; E2E case 9), not the browser's native stack. It works across 編集ページ, but granularity differs from FULL. Phase 9: one Ctrl+Z removes a whole 70,000-character insertion (E2E). |
| caret / source offsets | OK | `offsetModel` (20) and `paginationModel` (66) unit tests; `moveSelectionToGlobal` for Preview/Writing Check jumps. |
| ruby / 傍点 notation | OK (data) / PARTIAL (view) | Canonical text is never split. A boundary is only a hard cut inside a paragraph longer than ~15k characters, and then a 《》 span can show across two 編集ページ. |
| page jump (Preview click, Writing Check) | OK | `pagedEditorBoundaryAndPreviewLanding` (14 tests); `descriptionCheck.e2e` lands on candidates in WINDOWED. |
| mobile | GAP | `descriptionCheck.e2e` covers 390/770 px layouts. Soft keyboard, touch selection handles and the page navigator on phones were not verified. |
| accessibility | PARTIAL | The textarea's label names the page (「編集ページ n / N」), the indicator is `aria-live`, and the navigator buttons are labelled. Screen readers and browser find (Ctrl+F) only reach the mounted page. |
| browser find / spellcheck | PARTIAL (Phase 9) | Browser find (Ctrl+F) and spellcheck still reach the mounted page only. **App-level equivalent:** the 置換 dialog has 前へ / 次へ, which searches the whole canonical manuscript and selects the match on any 編集ページ (`SearchReplaceModal` `onFind` → `navigateToGlobalOffset`; the same on FULL). E2E: a word that exists only on the last 編集ページ is found from 編集ページ 2 / 3 and selected. |
| large paste | **OK (Phase 9)** | `windowedLongDocument.e2e`: 70,000 characters (more than the 55k hard page maximum) inserted mid-page. Saved = before + exactly the insertion; 編集ページ 3 → 4 (boundaries recomputed); one Ctrl+Z removes it. Headless Chrome has no clipboard, so the text went through `Input.insertText` (the IME-commit editing path), not a real paste event. |
| document switch | **OK (Phase 9)** | `windowedLongDocument.e2e`: A → B → A through the route (`history.pushState ?id=`, the same `useSearchParams` change as `router.push`; the editor and Preview stay mounted), inside the 1.5 s autosave debounce. Each document's typing reaches only its own record, and the Preview shows the new document's page count. The first layout after a switch is a full Preview snapshot (never a delta against the other document). Behaviour: the paged editor re-anchors at the previous caret offset clamped to the new document, so B opened on its last 編集ページ; FULL likewise leaves the caret at the end of the new value. Passes on FULL too. |
| autosave / Preview / export | OK | They read the canonical `content`, the same as FULL. ZIP export JPGs are byte-identical between FULL and WINDOWED builds (100p, 120 JPGs). |

## Phase 9 update

Verified in Phase 9 (performance doc §10). No editor surface change beyond the 置換 dialog's
前へ / 次へ.
- Document switch, large paste with undo, 「全文を選択」 copy, and cross-page find all have E2E
  coverage: `tests/e2e/windowedLongDocument.e2e.mjs`, run on WINDOWED and FULL builds.
- `editorInputIntegrity.e2e` passes on WINDOWED and FULL.
- The ~100 ms keystroke floor on both surfaces is Blink `Layerize` of the mounted Preview, not
  editor code (performance doc §10.8). So WINDOWED cannot go below it either.

**Readiness classification: B — NEEDS HUMAN QA ONLY**, for an **optional, manual opt-in beta
toggle**. What remains open is human verification, not a functional gap:

1. A real Japanese IME on desktop and on a phone, including composition across the page target
   and the page-end jump.
2. Phone soft keyboard, touch selection handles and the page navigator.
3. Whether users accept the page-scoped Ctrl+A, drag selection and browser find, with
   「全文を選択」 and 置換 前へ / 次へ as the explicit whole-manuscript equivalents. This is UX
   copy, not code.

Recommended rollout: a user-visible opt-in (e.g. 「長編モード（β）」 in settings, default off),
suggested but not forced for manuscripts of more than one 編集ページ (≈100 文庫 pages). Do not
switch users automatically by size yet. Revisit automatic gating after the Human QA above.

## Recommendation (Phase 8)

Do not make WINDOWED the default in Phase 8. The measurements support it as the surface for long
manuscripts: it is the only change that fixes the keystroke frame and burst coalescing at 300+
pages. Before any default flip:

1. Human QA with a real Japanese IME on desktop and on a phone. Include composition across the
   page target, and the page-end jump described above.
2. Decide the selection/clipboard/find model: either whole-document find and selection across
   編集ページ, or explicit UX copy that explains the page scope.
3. Add a WINDOWED document-switch E2E and a large-paste (>1 page) E2E.
4. Consider gating by size: FULL below one 編集ページ, where the surfaces are identical and FULL
   has native selection and find; WINDOWED above it.

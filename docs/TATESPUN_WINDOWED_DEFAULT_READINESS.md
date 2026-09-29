# TateSpun WINDOWED Editor: Default Readiness

Decided and verified 2026-09-29 on branch `tsp-post-beta-typography-phase1`. The baseline is
`6200dc2`. This follows `TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md`: the product decisions that audit
left open are now made and implemented.

**WINDOWED is still not the default.** This document judges readiness only. Switching is a
separate step: set `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED` at build time.

## 1. Product decisions (applied)

| # | decision | status |
|---|---|---|
| D1 | **Ctrl/Cmd+A in the editor selects the whole manuscript**, as in FULL. It is the same state as 「全文を選択」. | implemented |
| D2 | An **ordinary selection stays within one 編集ページ.** A cross-page drag selection is not provided. To operate on the whole text use 「全文を選択」 / Ctrl+A, or join pages with 「前のページとつなぐ」. | specified (no new selection model) |
| D3 | **On phones (< 768 px) the 編集ページ navigator is collapsible** and starts collapsed. | implemented |
| D4 | **WINDOWED undo grouping is the specification.** Typing, Backspace and Delete bursts are one step each (≤800 ms apart, ≤200 characters). FULL's one keystroke = one step is not copied. | kept, no change |
| D5 | WINDOWED is **not** made the default in this step. | respected |

## 2. Ctrl/Cmd+A (D1)

Implementation, all in `PagedEditor.tsx`:

- The editor textarea's own `keydown` calls the **existing** `selectEntireManuscript()` (also the
  「全文を選択」 action). There is no second whole-selection implementation. The button label
  switches to 「全文選択中　解除」 (`aria-pressed`) exactly as for the button.
- Because only that textarea's `keydown` is handled, **Ctrl+A in any other field keeps the browser's
  own field select-all**: search, replace, title, memo and settings inputs. Nothing global binds
  Ctrl+A (`useShortcuts` has only S, +, - and 0).
- The exit rule: **全文選択 lasts while the mounted page stays fully selected.** A click, an arrow
  key, a drag or Esc ends it. Since the real-OS IME fix (§8a) a selection move that no pointer or
  navigation key made (an IME/TSF's own, or a phone's selection-handle drag) ends it only if no IME
  key or composition follows within 300 ms.
  - This replaces a one-shot "ignore the next select event" guard. That guard failed for Ctrl+A,
    because the shortcut's own `keyup` reached the selection handler after the `select` event.
  - Under that rule, a click **inside** the selection collapses it only through a late native
    `selectionchange`, which React's `onSelect` does not report. A native `selectionchange`
    listener ends 全文選択 there too. Without it, the next keystroke after such a click would have
    replaced the whole manuscript. This was caught by the E2E during this change; the baseline's
    guard cleared on any click.

Verified in a real browser (`tests/e2e/windowedFinalParity.e2e.mjs`, 300k manuscript, 6 編集ページ):

| after Ctrl+A | whole manuscript → | 1 undo restores | redo re-applies | state shown |
|---|---|---|---|---|
| type 「X」 | "X" | ✓ | ✓ | 全文選択中　解除 |
| Enter | "\n" | ✓ | ✓ | ✓ |
| Backspace / Delete / cut | "" | ✓ | ✓ | ✓ |
| paste | pasted text | ✓ | ✓ | ✓ |
| IME-style commit | composed text | ✓ | ✓ | ✓ |

Further checks:

- Esc leaves 全文選択.
- Ctrl+A twice keeps it.
- A click after Ctrl+A, after the button, or after a double Ctrl+A leaves it; the next keystroke
  inserts exactly one character.
- FULL passes the same Ctrl+A matrix.
- Ctrl+A in the title, search, replace, memo and settings inputs selects only that field and never
  engages 全文選択 or changes the manuscript, on **both** surfaces.
- In the parity probe, "Ctrl+A then type" on a 173k manuscript now keeps 1 character on both
  surfaces (it kept 123k on WINDOWED before). Only the *visible* highlight differs: WINDOWED can
  highlight just the mounted page.

## 3. Cross-page selection policy (D2)

The current way of working, stated neutrally in the /howto 編集ページ explanation (and pinned by
`howtoContent.test.ts`):

> 編集ページをまたいで原稿全体を操作するときは、「全文を選択」または Ctrl+A を使います。

The 「全文を選択」 button's tooltip names the shortcut too. The demo-tour card and the 使い方ガイド
sample manuscript were not lengthened: the card has placement tests sized to its text, and the
sample is a paginated document whose page layout other tests depend on.

## 4. Phone navigator (D3)

Below the app's existing phone breakpoint (`md`, 768 px) the navigator is one row:
**← 編集ページ X / Y → 全文を選択 操作▾**.

- 「操作▾」 (`aria-expanded`, `aria-controls`, a descriptive `aria-label`) expands the less
  frequent tools: ここで区切る, 前のページとつなぐ, and the progress / 区切り待ち line.
- While collapsed, an amber ● on the toggle signals 区切り待ち.
- The state is session-only React state; nothing is persisted and there is no schema change.
- Tablet and desktop render no toggle and every tool as before. This is CSS-gated (`max-md:`), so
  desktop pixels are unchanged.

| viewport | FULL editor height | WINDOWED before | WINDOWED after (collapsed) | expanded |
|---|---|---|---|---|
| 320×568 | 248 px | 181 px | **211 px** | 181 px |
| 360×640 | 320 px | 253 px | **283 px** | 253 px |
| 390×844 | 524 px | 457 px | **487 px** | 457 px |
| 768×1024 (tablet) | 676 px | 593 px | 593 px (unchanged) | — |

The collapsed navigator is 37 px, one row.

At every phone width, the browser E2E checks:

- it starts collapsed;
- ←, X / Y, → and 全文を選択 stay visible, with touch targets ≥ 26 px;
- → and ← navigate while collapsed (編集ページ 1 → 2 → 1);
- expand by tap and collapse by keyboard (Enter on the toggle);
- 全文を選択 engages while collapsed;
- the search panel and export menu open;
- no horizontal overflow anywhere.

While 全文選択 is active at 320 px, the longer 「全文選択中　解除」 label wraps the toggle onto a
second row (P3; transient, nothing is hidden or overflows).

## 5. Undo policy (D4)

This is unchanged. `windowedEditor/undoModel.ts` stays the specification:

- a typing burst, a Backspace burst and a Delete burst are one step each (≤800 ms apart, ≤200
  characters);
- paste, IME commit, a selection replace, 改ページ挿入, 全文選択 replacements and search
  replacements are atomic, one step each;
- history works across 編集ページ.

## 6. Parity status

| severity | open items |
|---|---|
| P0 | **0** |
| P1 | **0 open.** Ctrl+A is implemented (D1). Cross-page drag selection is specified as not provided, with 全文を選択 / Ctrl+A / 前のページとつなぐ as the way to do it (D2). |
| P2 | Undo granularity is by specification (D4). Browser Ctrl+F, spellcheck and screen readers reach only the mounted page; the app's 検索・置換 covers the whole manuscript. |
| P3 | The 320 px wrap while 全文選択 is active. Whole-manuscript copy uses LF (FULL gets CRLF from the Windows clipboard; equivalent). |

The parity probe (`editorSurfaceParity`, FULL vs WINDOWED after builds) finds 20 of 31 scenarios
identical. Every remaining difference is one of: the undo batching (D4), copy line endings, FULL's
non-undoable 改ページ挿入, 編集ページ-only behaviour, the visible-highlight length after Ctrl+A,
and the open position (FULL: caret at the end, view at the top; WINDOWED: page 1, caret at the top).

## 7. Performance (WINDOWED, 300k, input → next painted frame, median)

| case | before (`6200dc2`) | after, run 1 | after, run 2 (7 samples) | before, run 2 (7 samples) |
|---|---|---|---|---|
| insert, beginning | 72 | 75 | 71 | 65 |
| insert, middle | 160 | 153 | 155 | 162 |
| Enter | 161 | 162 | 166 | 166 |
| Backspace | 163 | 182 | 172 | 164 |
| undo | 240 | 234 | 241 | 238 |
| redo | 241 | 227 | 238 | 244 |
| insert, end | 72 | 70 | 69 | 71 |
| search 次へ | 65 | 91 | 71 | 60 |

There is no regression beyond run-to-run noise. The largest gaps (Backspace +8 ms, search 次へ
+11 ms in run 2) sit inside overlapping sample ranges (search: 58–131 ms on both builds). For
reference, FULL's end-of-manuscript insert was 429 ms in the parity audit.

## 8. Regression and quality gates

All checks used production static builds, run in the same session.

- **This change, in a browser:** `windowedFinalParity` passes on WINDOWED and on FULL. It covers
  §2 (Ctrl+A matrix, Esc, click exits, input exceptions) and §4 (phone navigator at 320, 360, 390
  and 768).
- **Parity probe:** 20/31 scenarios identical. The remaining differences are exactly the specified
  ones listed in §6.
- **E2E battery, both surfaces.** All of these pass:
  - `editorInputIntegrity` (10-case deletion matrix);
  - `workSessionIsolation`, `writingCheckOverlayStale`;
  - `searchReplaceNavigation` (選択箇所を置換 / すべて置換 with undo/redo);
  - `windowedLongDocument` (document switch, large paste + undo, 全文を選択 copy, search across
    編集ページ);
  - `phase9HumanQaRepair` (A5 2段 + colophon, search → Preview follow);
  - `previewPageModel` (image flow, JPG), `imageWarningLifecycle`;
  - `autosaveFlush` (leave / reload restore), `mobileSharedExport`;
  - `coreLongParagraphPreview` (300k + 20k, undo, Ctrl+A, exact saved text);
  - `readAloud`, `descriptionCheck`, `reviewHub`, `exportWorkerPerf`.

  `reviewLayout` fails exactly as on every baseline build since before this work ("PreviewPane has
  no duplicate shadow"): pre-existing and unrelated.
- **Export:** PDF `d3604e0a92c69e72` (42 pages) and JPG ZIP `39b9266f3c1914c5` (42 JPGs) are
  identical on both surfaces and unchanged since the earlier phases.
- **Screens:** `editorSurfaceScreens` passes on baseline and after WINDOWED and on after FULL.
  Desktop states are pixel-identical before and after, 8/9. The 9th differs only in the save-status
  dot's pulse animation phase (21 px in the header).
- **Vitest:** 19 configs, fail sets identical to `6200dc2` (Core 408/408). There are 12 new passing
  tests:
  - `pagedEditorWindowedFinal.test.ts` (Ctrl+A contract, exit rule, navigator);
  - a /howto wording test.

  `pagedEditorQaFixes.test.ts` was updated from "Ctrl+A is not intercepted" to the new decision.
  The 54 regenerated PDF/JPG/ZIP QA artefacts are identical to the baseline.
- **Build:**
  - `npx tsc --noEmit`: PASS.
  - ESLint on the changed files: 0 errors (3 pre-existing hook-dependency warnings in
    `PagedEditor`).
  - `npx next build`, FULL and WINDOWED: PASS.
  - `npm run build` was not used: its Supabase guard needs `.env.local` (an environment issue).
- **Unchanged:** no schema, migration, Core, Preview, PDF/JPG, colophon, ノンブル or image-lifecycle
  change; FULL behaviour unchanged.

## 8a. Real-OS IME transaction model (after Human QA on `f937777`)

Windows real-OS Human QA on `f937777` FAILED two items, although every headless E2E passed:

1. 全文選択 (300k) + IME commit: sometimes "ページが応答しません"; otherwise about one 編集ページ of
   old text stayed next to the committed text. One undo restored and redo re-applied.
2. A ~30k selection from the start of 編集ページ 8/8 + IME: the replacement was right, but the page
   count dropped (8 → 7) and the caret / view did not follow to the committed text.

Headless models of real-OS orderings (`windowedWholeReplace` `model-*`, `seq-*`,
`range-last-merge`) reproduced both on `f937777`:

- a selection move before the IME key's keydown ended 全文選択, leaving 291k old characters;
- an IME deletion of the selection before compositionstart was committed on its own: two undo steps,
  or a deleted page (a partial commit) when uncancelable and the composition was canceled;
- after a page-count-changing replacement, the caret stayed at the OS's old page-local offset.

The model now, in `PagedEditor.tsx`:

- **An IME key (keyCode 229 / Process) over 全文選択 opens the whole transaction** (pre-phase),
  before any IME effect. Membership never depends on the native selection or value.
- **Only the user's own selection gesture ends 全文選択 at once** (pointer down on the textarea, a
  navigation key). Any other selection move ends it only if no IME transaction starts within 300 ms.
- **An IME deletion before compositionstart is absorbed** (prevented, or mirrored when uncancelable),
  never committed alone. The composition that follows commits once. A canceled composition leaves
  the manuscript unchanged. With no composition at all (a soft-keyboard Backspace), it deletes the
  whole manuscript once.
- **The whole replacement text is the IME's committed string only** (compositionend data, else its
  last update). The textarea's value is never read for it. After the commit, the textarea is checked
  against the manuscript's page again once the IME has finished.
- **No page-local commit from a diverged textarea:** an edit whose textarea did not hold the
  manuscript's page when it began is refused and the page is restored.
- **Page follow:** the caret is placed right after the committed text, computed from the edit, on the
  page that now holds it. This holds even when the replacement changes the page's start, end or the
  page count. The caret is scrolled into view and re-applied after the IME has finished, unless the
  user acted meanwhile.
- **One pagination per transaction:** the render reuses the pagination the commit computed.

**Real-OS trace (Windows, a pre-`cede6e4` build), 2026-09-29:** 全文選択 over a 50,003-character
編集ページ. After the first IME key the page textarea held 39,036 characters with the caret at 1. The
transaction was finished by **blur**; no compositionend arrived. The EditorPane
`native:compositionend` mark is emitted by the finish itself. The committed payload was the IME's
own **compositionupdate data: 39,036 characters**. The IME had composed over the page's native
selection, **old text included**, so no event carried the user's string. The page DOM was never the
source. This also explains the "ページが応答しません": the IME was converting a ~39k-character
composition.

**全文選択 no longer uses the page's native selection.** Ctrl+A and 全文を選択 (one code path) set
the canonical 全文選択 state, show the page with the held-selection highlight, and move focus to an
**empty IME receptacle**. The receptacle is a separate, labelled textarea at the top of the editor,
with 16 px text so iOS does not zoom on focus, and it never holds manuscript text.

- Typing, Enter, paste, Backspace / Delete, cut and copy act on the whole manuscript from there.
  Copy and cut stay enabled on the empty field through beforecopy / beforecut.
- An IME composes over nothing. The whole replacement is its committed string only:
  compositionend data, or the last compositionupdate data on a recovery.
- That string is checked exactly against the receptacle, not against a size limit. The receptacle
  started empty and received only this composition, so it must hold exactly that string.
- Unknown, canceled or mismatching input changes nothing, and 全文選択 stays.
- The trace records `payloadSource` (compositionend / compositionupdate / beforeinput / none) and
  every length.
- Focusing the page (a click or tap), Esc or a navigation key returns to ordinary editing.
- FULL is unchanged.

Headless profile (300k, 全文選択 + IME conversion + commit): 1 commit, 1 pagination, 0 long tasks,
about 30–70 ms from commit to the next frame. The real-OS freeze did not reproduce headless, so its
cause is not proven. Capture a real-OS trace with `?perfDebug=1`: run
`__tspPerfDebug.getReport({})` in the console. It records every keydown / keyup / beforeinput / input
/ composition / selectionchange with lengths and state flags only, never text.

## 9. Human QA still required

1. **Real OS Japanese IME on WINDOWED** (re-run, it failed on `f937777`): conversion while 全文選択
   is active (300k), a ~30k selection replaced from the start of the last 編集ページ (the page count
   drops), ordinary text, and conversion near an 編集ページ boundary. On any failure, attach the
   `?perfDebug=1` trace.
2. **A real phone** (touch and soft keyboard): the collapsed navigator (toggle, ←/→), touch text
   selection (including dragging the selection handles after 全文を選択), Backspace over 全文選択,
   and typing with the keyboard open.

## 10. Readiness

**WINDOWED DEFAULT READY: NO until the real-OS IME Human QA (§9.1) passes on the §8a fix.** The
automated gates pass (§8, §8a).

Against the criteria:

- **P0 = 0.**
- **P1 = 0 open.** Ctrl+A is implemented; cross-page drag selection is explicitly specified, with a
  documented way to do it.
- **Save / restore:** PASS.
- **Export:** PASS, with identical hashes.
- **Search / replace:** PASS.
- **Undo:** PASS; the grouping is the specification.
- **Mobile:** usable. The collapsed navigator gives back 30 px at 320 px, and every function is
  reachable.
- **Long-document performance:** PASS, with no regression. FULL's 300k end-of-manuscript freeze
  does not occur on WINDOWED.
- **AI QA:** PASS.

The residue is real-device IME and touch behaviour, which a headless browser cannot judge. The
real-OS IME check found two failures on `f937777` (§8a), and they must pass again on the fix. The
default was **not** switched in this step.

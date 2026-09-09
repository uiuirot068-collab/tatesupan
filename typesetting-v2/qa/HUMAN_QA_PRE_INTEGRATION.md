# TateSpun v2 consolidated Human QA — pre-integration

Prepared: 2026-09-09

This is the single Human QA packet for development-only v2 work. It does not authorize Production `src/` integration, push, or deploy.

## Start the development Editor

From the repository root:

```powershell
npm.cmd exec -- vite --config typesetting-v2/tools/human-e2e-editor/vite.config.ts
```

Open `http://127.0.0.1:5173/`.

## 1. 11-B session editing activity counter

This check uses the existing real Editor implementation. It is not duplicated in the isolated v2 development Editor and does not require Production deployment or integration.

From the repository root, run:

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:3000/editor?demo=1`. In the left manuscript Editor pane, look at the bottom footer. The `このセッションの編集量 0文字` badge is immediately before the current-manuscript character count. Select the badge to see inserted/deleted detail and the result-share action.

Steps:

1. Open the Editor in one tab and note `このセッションの編集量`.
2. Type Japanese via IME, paste over a selection, delete text, undo, and redo.
3. Reload and switch documents in the same tab.
4. Open the Editor in a new tab/session.

PASS: final IME commits count once; inserted/deleted totals reflect real mutations; reload/document switch retains the tab total; a new tab session starts at zero; current manuscript length remains visibly distinct.

Known limitation: this packet records the pending Human UI check only. The frozen 27-test semantics are already complete.

## 2. 完成前マイチェックリスト

Location: development Editor toolbar → `完成前チェック`.

Steps:

1. Open each of the three presets and confirm the items are useful and editable.
2. Edit an item, check several items, close/reopen the drawer, then reload the page.
3. Select `リセット`; confirm a preset restores its original items and clears checks.
4. Create a personal list, rename it, add/edit/delete items, reload, then delete the personal list. Cancel the first deletion warning and confirm the second.
5. Confirm the Editor and Preview do not change when checklist state changes.

PASS: state persists locally across reload; presets and personal lists remain reusable; cancelling the one-time personal-list deletion warning leaves the list untouched and confirming it deletes normally; completion count is correct; no checklist text enters manuscript, Preview, PDF, or JPG.

Known limitation: cloud/work-specific checklist semantics are deliberately not implemented. Production Editor placement is an integration gate.

## 3. UI-C + Memo + Editor actions

Location: development Editor toolbar.

Steps:

1. Put the caret in the manuscript and scroll to a recognizable position.
2. Open `⚙️ 設定`; change body size/line spacing/characters/lines; close with ×, backdrop, and Escape in separate passes.
3. Confirm the manuscript remains visible and its text/scroll context is preserved.
4. Open `メモ` directly from the toolbar, edit it, close/reopen, then reload.
5. Type text, use `↶ 元に戻す` and `↷ やり直す`, then insert `⏎ 改ページ` at the caret.
6. Repeat at a narrow/mobile browser width.

PASS: right drawer overlays the still-mounted Editor; Memo needs no Settings detour and persists locally; default input stays horizontal; actions work; PC/mobile layouts remain usable; no rejected prototype emoji appear.

Known limitation: image insertion is visibly disabled because real Production image-state wiring is an integration gate. Optional vertical Editor remains out of current scope.

## 4. Canonical Preview and PDF development gate

Location: below the manuscript → `Preview更新` and `PDF`.

Steps:

1. Enter Japanese containing punctuation, ruby notation, dash, ellipsis, and a manual page break.
2. Change settings and choose `Preview更新`.
3. Choose `PDF`, open the downloaded file, and compare page count/content/geometry with Preview.

PASS: Preview updates from current manuscript/settings; PDF is readable and follows the same canonical composition without page-fill stretch or typography regression.

Known limitation: PDF currently uses the local development Vite API. Browser-native/Production PDF is a Human architecture and Production integration gate because the renderer contains Node `Buffer` dependencies.

## 5. JPG final development wiring

Location: below the manuscript → `Web JPG・1ページ`, `Web JPG・全ページZIP`, `印刷JPG・全ページZIP`.

Steps:

1. Use a manuscript long enough for at least two pages and update Preview.
2. Download Web first-page JPG; confirm the title-derived `_001.jpg` filename and readable content.
3. Download Web all-page ZIP; confirm one sequentially numbered JPG per canonical page.
4. Download print all-page ZIP; confirm the same logical pages/geometry and 1600px long side.
5. Compare punctuation, ruby, dash, ellipsis, folio/header (where enabled), and last-page content with Preview/PDF.

PASS: no missing/extra/reordered pages; filenames are correct; Web and print transforms do not reflow text; typography matches the already-passed canonical output quality.

Known limitation: v2 currently has no separate bleed geometry, so print crop is a disclosed no-op before the 1600px resize. Production Editor buttons are not wired.

## 6. Writing Check visual polish — after Production integration permission

Location: real Editor → Writing Check results.

The requested source changes are not part of this development-only checkpoint because they live under Production `src/components/`.

PASS after implementation: NG word has a purple wavy underline and textual NG identity; internal RED/YELLOW severity remains unchanged; amber underline is lighter; diagnostic body/snippet is approximately Editor-body readable size; detection/fix semantics and Preview/PDF/JPG isolation are unchanged.

## 7. Help top TOC — after Production integration permission

Location: real Editor → Help.

PASS after implementation: compact TOC appears at the top; mouse and keyboard activation scroll to the matching existing section; Help content/section order is preserved.

## 8. TOC creation dialog polish — after Production integration permission

Location: real Editor → 奥付・目次 → 目次作成.

PASS after implementation: `再検出` starts on a new left-aligned line; empty/result explanatory gray text is left-aligned; TOC detection and insertion results are unchanged.

## Report

Record PASS/FAIL plus browser, viewport, and the first failing item. Keep failures separate by numbered section so an isolated fix can be made without reopening already-passed typography.

## Human QA Round 2 — targeted recheck only

1. Personal checklist delete warning: cancel leaves the personal list untouched; confirm deletes it normally.
2. Preset/edit/check state survives browser reload.
3. Manual page break creates exactly the expected next page in Preview.
4. Manual page break creates exactly the expected next page in PDF.
5. Manual page break creates exactly the expected next page in Web JPG.
6. Manual page break creates exactly the expected next page in print JPG.
7. U+30FC `ー` is vertical in Web JPG.
8. U+30FC `ー` is vertical in print JPG.
9. Odd-page JPG running head is fully visible at the left outer edge.
10. Even-page JPG running head is fully visible at the right outer edge.
11. 11-B: run `npm.cmd run dev`, open `http://127.0.0.1:3000/editor?demo=1`, and find `このセッションの編集量 0文字` in the bottom footer of the left manuscript Editor pane, immediately before the current-manuscript character count. Production integration is not required.

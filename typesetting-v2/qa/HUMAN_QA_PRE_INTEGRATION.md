# TateSpun v2 consolidated Human QA — pre-integration

Prepared: 2026-09-09

This is the single Human QA packet for development-only v2 work. It does not authorize Production `src/` integration, push, or deploy.

## Start the development Editor

From the repository root:

```powershell
npm.cmd exec -- vite --config typesetting-v2/tools/human-e2e-editor/vite.config.ts
```

Open `http://127.0.0.1:5173/`.

## 1. 11-B work-session written-character tracker

This check uses the existing real Editor implementation. It is not duplicated in the isolated v2 development Editor and does not require Production deployment or integration.

From the repository root, run:

```powershell
npm.cmd run dev
```

Use the exact port printed by Next (it may not be 3000), then open `http://127.0.0.1:<port>/editor?demo=1`. 11-B work-session behavior and final written-character semantics are **FUNCTIONAL HUMAN PASS**. The only remaining check is the two-item visual confirmation below.

Round 2 found that this documented `127.0.0.1` route received only the server-rendered shell because Next 16 blocked its client assets; that hydration issue was fixed. Subsequent Human QA then established that the automatic browser-session concept itself was the wrong product definition. That earlier definition is superseded—not treated as a mutation-accounting bug—and the focused Human QA for the corrected product is listed below.

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

1. **PASS — Human Round 2.** Personal checklist delete warning: cancel leaves the personal list untouched; confirm deletes it normally.
2. **PASS — Human Round 2.** Preset/edit/check state survives browser reload.
3. **PASS — Human Round 2.** Manual page break creates exactly the expected next page in Preview.
4. **PASS — Human Round 2.** Manual page break creates exactly the expected next page in PDF.
5. **PASS — Human Round 2.** Manual page break creates exactly the expected next page in Web JPG.
6. **PASS — Human Round 2.** Manual page break creates exactly the expected next page in print JPG; PDF/JPG page-boundary parity is confirmed.
7. **PASS — Human Round 2.** U+30FC `ー` is vertical in Web JPG.
8. **PASS — Human Round 2.** U+30FC `ー` is vertical in print JPG.
9. **PASS — Human Round 2.** Odd-page JPG running head is fully visible at the left outer edge.
10. **PASS — Human Round 2.** Even-page JPG running head is fully visible at the right outer edge.
11. **FUNCTIONAL HUMAN PASS.** After the route hydration fix and two Human-directed product-semantics corrections, Start/End, written-only counting, timer, reload, result/share/history, and next-session reset pass. Only final UI discoverability confirmation remains below.

## Final Human confirmation — UI polish only (2 items)

Open the actual Editor: run `npm.cmd run dev`, use Next's printed port, and open `http://127.0.0.1:<port>/editor?demo=1`. Ruby is **CLOSED / HUMAN PASS**. Previously passed 11-B behavior, counting semantics, Typography, JPG, Preview, Publication, and Ruby QA are not reopened.

1. Footer help/work-session separation visually PASS: the Ruby/TCY/page-break explanatory row is readable, while work-session controls and `現在の原稿文字数` remain readable and wrap sensibly.
2. Visible Undo/Redo PASS: `↶ 元に戻す` and `↷ やり直す` are discoverable and perform the same manuscript history operations as the existing keyboard shortcuts.

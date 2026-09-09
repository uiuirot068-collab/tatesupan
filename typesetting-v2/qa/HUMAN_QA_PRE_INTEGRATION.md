# TateSpun v2 consolidated Human QA — pre-integration

Prepared: 2026-09-09

This is the single Human QA packet for development-only v2 work. It does not authorize Production `src/` integration, push, or deploy.

## Start the development Editor

From the repository root:

```powershell
npm.cmd exec -- vite --config typesetting-v2/tools/human-e2e-editor/vite.config.ts
```

Open `http://127.0.0.1:5173/`.

## 1. 11-B work-session activity tracker

This check uses the existing real Editor implementation. It is not duplicated in the isolated v2 development Editor and does not require Production deployment or integration.

From the repository root, run:

```powershell
npm.cmd run dev
```

Use the exact port printed by Next (it may not be 3000), then open `http://127.0.0.1:<port>/editor?demo=1`. In the left manuscript Editor footer, `作業スタート` and `作業記録` appear immediately before the separate current-manuscript character count.

Steps:

1. Type while idle and confirm that no work-session activity is created.
2. Select `作業スタート`; confirm `作業中`, `今回の編集量 0文字`, elapsed time, and `作業終了`.
3. Type Japanese via IME, paste over a selection, delete text, undo, and redo.
4. Reload during the active session, then select `作業終了`.
5. Check result, exact X/copy text, `作業記録`, and a later new session.

PASS: idle edits add zero; each Start begins at zero; final IME commits and actual mutations count only while active; reload restores the active aggregate and timer origin; End freezes a metadata-only result; history persists; exact share text contains no manuscript; current manuscript length remains visibly distinct.

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
11. **SUPERSEDED after Human QA.** The route hydration failure was fixed and its browser E2E passed, after which Human QA corrected 11-B from an automatic browser-session counter to an explicit work-session tracker. The mutation accounting remains reused; only the corrected product needs the focused recheck below.

## Final Human recheck — corrected 11-B only (12 items)

Open the actual Editor: run `npm.cmd run dev`, use Next's printed port, and open `http://127.0.0.1:<port>/editor?demo=1`. Previously passed Typography, JPG, Preview, Publication, and Ruby QA are not reopened.

1. While idle, type in the manuscript. PASS if no work-session activity is accumulated and `作業スタート` remains available.
2. Select `作業スタート`. PASS if `作業中` appears and `今回の編集量` begins at `0文字`.
3. Type, delete, and replace manuscript text. PASS if activity increases by inserted + deleted code points while active.
4. Wait briefly. PASS if `経過時間` runs without any extra configuration.
5. Reload while active. PASS if the same start time, accumulated activity, active status, and continuing elapsed time return.
6. Select `作業終了`, then edit again while idle. PASS if the completed activity freezes immediately and does not change.
7. PASS if the result displays `今回の編集量`, `作業時間`, `開始時刻`, and `終了時刻`.
8. Select `Xでシェア`. PASS if the normal X intent opens with exactly `今日は{表示された編集量}文字がんばりました！`, `#TateSpun`, and `https://spuntales.net/tatespun/`, with no manuscript text.
9. Select `テキストをコピー`. PASS if the copied text is exactly the same three-line share text and contains no manuscript text.
10. Open `作業記録`, then reload and open it again. PASS if the completed metadata record remains and can be shared to X.
11. Select `作業スタート` again. PASS if the new session begins at `0文字` while the prior record remains in history.
12. PASS if the footer's `現在の原稿文字数` remains separately visible and is understandable as different from `今回の編集量`.

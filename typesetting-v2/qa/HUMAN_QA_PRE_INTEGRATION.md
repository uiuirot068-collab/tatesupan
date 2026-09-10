# TateSpun β RC — consolidated branch Human QA

Status: **BRANCH-INTEGRATED / HUMAN QA PENDING / NOT RELEASED**
Date: 2026-09-10
Branch: `design/tatespun-typesetting-v2`

This packet covers only newly integrated behavior. Do not repeat the closed Typography/Ruby/TCY/punctuation/dash/ellipsis/small-kana/folio/header/colophon/11-B semantic passes.

## Start the internal v2 candidate

In PowerShell, from the repository root:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='https://vjgxrqgnbgnewfvissgd.supabase.co'
$env:NEXT_PUBLIC_TATESPUN_RENDERER='V2_BETA'
npm.cmd run dev
```

The rollout value is build/start-time internal configuration. It is not stored in a manuscript and no engine selector is shown to ordinary users.

## New checks

### 1. Top/Hero and journey

- URL: `http://localhost:3000/`
- Action: open at desktop, then 768 px and 390 px widths; inspect the first viewport.
- Expected PASS: `どこで綴っても、ひとつの本になる。` and the frozen subcopy are legible; the manuscript → book preview → PDF/JPG → preflight journey is clear; create/demo actions are reachable; TXT/local-processing/privacy copy is factual and does not dominate.

### 2. Real Editor UI-C integration

- URL: `http://localhost:3000/` then select `新しい作品を作成する`.
- Action: use `設定`, `メモ`, `完成前チェック`, visible Undo/Redo, `改ページ挿入`, Ruby/TCY help, and the existing work-session controls. Resize to tablet/mobile.
- Expected PASS: settings opens as a right drawer on desktop; Memo is directly reachable and persists with the document; checklist state persists locally; no control hides or changes the manuscript; horizontal Editor input remains the default. Existing 11-B result/history behavior is unchanged.

### 3. TXT export/import

- URL: the real Editor created in check 2.
- Action: enter text containing `【改ページ】`, `｜親文字《よみ》`, `[tate]25[/tate]`, and an image token if available. Select `TXTを書き出す`; inspect bytes/newlines. Then select `TXTを読み込む` with UTF-8 BOM/CRLF and confirm replacement.
- Expected PASS: export filename derives from the title, encoding is UTF-8 without BOM and LF; notation is byte-preserved except approved newline normalization. Import asks before replacing non-empty content. An imported image token produces a clear reattachment/HOLD warning; no image binary is claimed to be restored.

### 4. Canonical Preview and real images

- URL: the same Editor with internal v2 candidate active.
- Action: enter a multi-page Japanese manuscript with Ruby, TCY, U+30FC, dash, ellipsis, manual break, running head/folio, colophon, and add a PNG/JPEG.
- Expected PASS: the visible book Preview updates from Canonical geometry without DOM reflow decisions; manual break/order/headers/folio match; the real image appears. Removing/unresolving image data creates an explicit `HOLD` and disables successful export instead of silently omitting it.

### 5. Browser-local PDF

- URL: the same Editor.
- Action: select `PDF`; while Network tools are open, wait for completion and inspect every page.
- Expected PASS: the UI remains responsive because PDF paint runs in a Worker; progress advances per canonical page; the downloaded file is complete and uses the passed v2 typography/image path; manuscript/image payloads are not uploaded. Output is trim-size only.

### 6. v2 JPG/ZIP

- URL: the same Editor.
- Action: run `Web JPG 1ページ`, `Web JPG ZIP`, and `印刷用JPG ZIP`; inspect filenames, ordering, first/last pages, vertical U+30FC, heads/folio, manual break, Ruby/dash/ellipsis, and image.
- Expected PASS: first-page Web exports one file; both ZIP actions contain one title-derived file per canonical page in order; print JPG long side is 1600 px; output is trim-only and never claims bleed support.

### 7. Export pause/cancel

- URL: the same Editor with a long (preferably 100+ page) manuscript.
- Action: start each PDF/JPG/ZIP path and press Escape; once choose `書き出しを続ける`, once press Escape again while the warning is open, and once choose `中断する`.
- Expected PASS: the warning opens and no new cooperative page unit starts while open; Continue or the second Escape resumes; confirmed cancellation stops remaining units, delivers no incomplete file as success, and restores normal UI. Already-running atomic Canvas/ZIP work may finish before the next boundary.

### 8. Mobile Demo viewport fit

- URL: `http://localhost:3000/editor?demo=1`
- Action: use a common 390 px mobile viewport and advance through the guided tour.
- Expected PASS: the Demo uses available dynamic viewport height; its card stays visible; internal surfaces scroll; `次へ` / `デモを終了` remain reachable; each target scrolls into view. The primary tour remains concise.

### 9. Rollback rehearsal

- URL: record the real Editor URL/id from check 2, stop dev, unset the v2 value (`Remove-Item Env:NEXT_PUBLIC_TATESPUN_RENDERER -ErrorAction SilentlyContinue`), restart, then reopen the exact URL.
- Action: inspect the same manuscript and settings in LEGACY; optionally set `V2_BETA` and restart once more.
- Expected PASS: the same document remains accessible with no migration or fork; ordinary users see no engine selector; unset/`LEGACY`/unknown values restore legacy immediately, and `V2_BETA` restores the candidate.

## Human result

Record one outcome: `PASS`, or `HOLD` with the exact check number, URL, viewport/browser, action, and observed result. A PASS makes the branch RC eligible for a separate explicit release-diff approval; it does not authorize merge, push, deploy, or Production release.

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

## Human PASS already recorded — do not repeat

- Canonical Preview normal editing and multi-page behavior; normal image Preview.
- Normal PDF, long PDF, and PDF with image/header/folio/colophon; PDF completion returns to a usable Editor.
- Export Escape confirmation, pause, Continue, second-Escape resume, and Cancel.
- Manuscript, confirmed Memo, checklist, and work-session persistence.
- Writing Check, 完成前チェック, 11-B (including delete/Undo/Redo counting), and Help TOC.
- Returning-user Home bookshelf-first architecture.

## Automated RC evidence

- **UNRESOLVED IMAGE HOLD: AUTOMATED PASS.** A composed manuscript fixture contains valid text before/after a required image token whose resolver returns `MISSING`. The model reports the unresolved source, browser Preview derives an explicit HOLD from that model, PDF/JPG controls are disabled, and the shared Publication preflight refuses export. Other manuscript content remains in the composed source/document. Human data corruption is not required.
- Conditional Home structure, the single-column Settings contract, mobile `100dvh` shell/internal-scroll contract, Editor IA, and TXT A/B are covered by focused source/behavior tests. Real viewport appearance remains in the Human checks below.
- Round 3 deterministic coverage includes running-head all/selected parity scopes, replacement/outside-scope safety, JPG empty-selection/all and selected canonical order, publication `max(4, body - 3)` furniture, Web-only `30 / 15 / 20`, work-scoped Memo draft persistence/protection, visible Demo header wiring, and the branding asset's intrinsic `384:341` ratio.

## Remaining Human checks only

### 1. Running-head apply

- In a multi-page work, set different odd/even values. With no page selection press `柱を反映`; then select a mixed set such as 2, 3, 4, 7, change both values, and apply again.
- Expected PASS: all-page mode updates old assignments everywhere; selected mode splits by actual parity, replaces only selected assignments, leaves pages outside the selection and all folio settings untouched, and reports only parity groups actually present.

### 2. Responsive Editor and Demo

- Check a real Editor and `http://localhost:3000/editor?demo=1` at small, normal, and large phone heights, orientation change where practical, then tablet/desktop.
- Expected PASS: global header, Editor navigation/toolbars, Writing Check/work-session/bottom controls, and Demo actions remain reachable. Only the center manuscript/Preview area flexes and scrolls internally; Settings, Options, and the Demo guide use their own scrolling; the normal Editor has no body-level scroll or horizontal overflow. `次へ` and `デモを終了` remain reachable.

### 3. Zero-work Home only

- With zero real works, compare only the upper Hero + CTA + Bookshelf region against `typesetting-v2/qa/reference/ui/home-empty-state-target.png` at mobile/tablet/desktop.
- Expected PASS: open Hero, character, primary CTA, bordered Demo CTA, and empty bookshelf/rack follow the reference's hierarchy without a large bordered empty-shelf card. The work popup is visually above the shelf and no separator crosses it. Do not review or redesign lower Home sections; returning-user Home is already PASS.

### 4. Settings order and inline Memo

- Expected Settings order: paper; font/font size/line-height; columns/gap; mode buttons; chars-per-line/lines-per-column; then existing margin/text-frame controls nearby. All remain in one scrolling drawer.
- Open only `▶メモ`, edit without confirming, collapse/reload/navigate away and back, then confirm. Expected PASS: it is inline, the draft returns in each case, and a blank draft cannot overwrite a non-empty confirmed Memo. There is no one-tap delete.

### 5. JPG scope and Web branding

- With no selected pages run Web and print ZIP/all-page JPG; repeat with pages selected out of order.
- Expected PASS: no selection exports every canonical page; selection exports only those pages in book order. In Web JPG the TateSpun cat/logo keeps its source `384:341` aspect ratio. Web output uses body/folio/header `30 / 15 / 20`; print/PDF use `max(4, body - 3)` for folio/header and do not inherit Web values.

### 6. Rollout B rollback — exact PowerShell procedure

Use the same browser profile and do not clear site data/local storage. From the repository root:

1. Start v2:

   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_URL='https://vjgxrqgnbgnewfvissgd.supabase.co'
   $env:NEXT_PUBLIC_TATESPUN_RENDERER='V2_BETA'
   npm.cmd run dev
   ```

2. Open a known saved manuscript. Record its exact Editor URL, title, and a short text sample.
3. Stop the server with `Ctrl+C` in that PowerShell window.
4. Start legacy in the same window:

   ```powershell
   $env:NEXT_PUBLIC_TATESPUN_RENDERER='LEGACY'
   npm.cmd run dev
   ```

5. Open the exact saved Editor URL in the same browser profile and confirm the recorded title/text remain.
6. Stop the server with `Ctrl+C`.
7. Switch back to v2:

   ```powershell
   $env:NEXT_PUBLIC_TATESPUN_RENDERER='V2_BETA'
   npm.cmd run dev
   ```

8. Open the exact saved Editor URL again and confirm the manuscript remains. Stop with `Ctrl+C` when finished.

Expected PASS: renderer mode changes only after restart; manuscript identity/data survive both switches; no ordinary-user renderer selector appears.

## Human result

Record `PASS`, or `HOLD` with the exact remaining check number, URL, viewport/browser, action, and observation. A PASS makes the branch RC eligible for separate release-diff approval; it does not authorize merge, push, deploy, or Production release.

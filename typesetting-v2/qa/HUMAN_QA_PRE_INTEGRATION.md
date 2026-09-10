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
- Running-head apply for all pages and selected odd/even scopes, including outside-scope protection.
- Web `30 / 15 / 20` typography and print/PDF separation.
- Memo edit/confirm, draft recovery after reload/navigation/collapse, and confirmed-value protection.
- Mobile Editor header/bottom-control visibility, manuscript/Preview internal scrolling, viewport containment, and small-height structure.

## Automated RC evidence

- **UNRESOLVED IMAGE HOLD: AUTOMATED PASS.** A composed manuscript fixture contains valid text before/after a required image token whose resolver returns `MISSING`. The model reports the unresolved source, browser Preview derives an explicit HOLD from that model, PDF/JPG controls are disabled, and the shared Publication preflight refuses export. Other manuscript content remains in the composed source/document. Human data corruption is not required.
- Conditional Home structure, the single-column Settings contract, mobile `100dvh` shell/internal-scroll contract, Editor IA, and TXT A/B are covered by focused source/behavior tests. Real viewport appearance remains in the Human checks below.
- Round 3 deterministic coverage includes running-head all/selected parity scopes, replacement/outside-scope safety, JPG empty-selection/all and selected canonical order, publication `max(4, body - 3)` furniture, Web-only `30 / 15 / 20`, work-scoped Memo draft persistence/protection, visible Demo header wiring, and the branding asset's intrinsic `384:341` ratio.
- Round 4 deterministic coverage includes explicit Settings rows, margin-mode defaults without overwriting stored modes, manual folio/header values below 4pt through persistence and the real PaintPlan, Memo placement inside the left Editor pane, mobile Focus visibility, state-based mobile writing action visibility, zero-work Home structure, and Demo transitions with no real UI open-state side effects.

## Remaining Human checks only

### 1. Settings rows and manual furniture size

- Confirm the visible rows are: paper; font/font size/line-height; columns/gap; mode; then capacity, with margin/text-frame controls kept beside their mode. Create a new work and confirm `余白から設定する`; reopen an existing work saved in the other mode and confirm it remains unchanged.
- Enter folio/header values below 4pt (for example 2.5/2), reload, and change an unrelated setting. Expected PASS: the manual values remain and reach Preview/PDF/print JPG. Web remains fixed at `30 / 15 / 20`; do not repeat the already-passed Web/print separation review.

### 2. Memo location only

- Open `▶メモ`. Expected PASS: it expands directly below the four secondary Editor entries, inside the left Editor pane, and shrinks/pushes the manuscript surface. It is not a global-header sibling, modal, drawer, or full-page surface.
- Memo persistence and protection are already Human PASS; repeat only if moving the surface visibly regressed them.

### 3. Zero-work Home and separator

- With zero real works, compare only the upper Hero + CTA + Bookshelf region against `typesetting-v2/qa/reference/ui/home-empty-state-target.png` at mobile/tablet/desktop.
- Expected PASS: open two-column Hero, large character, primary CTA, bordered Demo CTA, then the reference-like wide empty shelf with guide book. The prior intermediate `ここから、最初の一冊を。` block is absent. In a returning-user shelf, the title/delete popup has a clean background with no unrelated horizontal rule crossing it. Do not review or redesign lower Home sections; returning-user architecture is already PASS.

### 4. Mobile Focus and writing action

- Enter mobile Focus mode. Expected PASS: the Writing Check controls, Ruby/TCY syntax/status helper, and work-session/count strip disappear; exiting Focus restores them with state intact.
- Before activating the manuscript, `本文を書く` may be shown. Tap it. Expected PASS: it focuses the manuscript and the prompt consumes no further layout space.

### 5. Demo guide side effects

- On mobile and desktop, advance through Settings/Options/editor/Preview-related steps and manually open/close a real control once.
- Expected PASS: step changes only highlight/scroll to targets; they do not open Settings, Options, Memo, or Help, alter manuscript/settings, or leave a drawer locked open. `次へ` and `デモを終了` remain usable.

### 6. JPG scope and Web branding

- With no selected pages run Web and print ZIP/all-page JPG; repeat with pages selected out of order.
- Expected PASS: no selection exports every canonical page; selection exports only those pages in book order. In Web JPG the TateSpun cat/logo keeps its source `384:341` aspect ratio. Typography separation is already Human PASS.

### 7. Rollout B rollback — exact PowerShell procedure

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

# TateSpun β RC — consolidated branch Human QA

Status: **BRANCH-INTEGRATED / HUMAN QA PENDING / NOT RELEASED**
Date: 2026-09-11
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
- Settings row structure, new-work margin mode, saved-mode preservation, folio/running-head preset, below-4pt override, and manual-value persistence.
- Zero-work Home reference layout, removal of the intermediate block, and unchanged lower Home; returning-user layout remains PASS.
- Mobile Focus hides Writing Check, Ruby/TCY, and work-session/status surfaces and restores them on exit; `本文を書く` disappears without leaving space.
- Demo Options/Memo/Help no-auto-open behavior, target highlighting, closable manually-opened drawers, and reachable mobile controls.
- JPG empty selection exports all pages; explicit selection exports selected pages in canonical order.
- Memo opens and closes from the same entry without losing draft/confirmed values.
- Returning Home has no unwanted full-width shelf separator; title/delete popup remains readable.
- Mobile primary/secondary controls stay on one row; Focus preserves core editing actions.
- Demo Options/Focus content and target-only behavior; no Settings/Options/Memo/Help side effects.
- Web JPG footer branding is sharp, single-painted, and keeps the source ratio.
- Rollback `V2_BETA → LEGACY → V2_BETA` preserves the same work/title/text.

## Automated RC evidence

- **UNRESOLVED IMAGE HOLD: AUTOMATED PASS.** A composed manuscript fixture contains valid text before/after a required image token whose resolver returns `MISSING`. The model reports the unresolved source, browser Preview derives an explicit HOLD from that model, PDF/JPG controls are disabled, and the shared Publication preflight refuses export. Other manuscript content remains in the composed source/document. Human data corruption is not required.
- Conditional Home structure, the single-column Settings contract, mobile `100dvh` shell/internal-scroll contract, Editor IA, and TXT A/B are covered by focused source/behavior tests. Real viewport appearance remains in the Human checks below.
- Round 3 deterministic coverage includes running-head all/selected parity scopes, replacement/outside-scope safety, JPG empty-selection/all and selected canonical order, publication `max(4, body - 3)` furniture, Web-only `30 / 15 / 20`, work-scoped Memo draft persistence/protection, visible Demo header wiring, and the branding asset's intrinsic `384:341` ratio.
- Round 4 deterministic coverage includes explicit Settings rows, margin-mode defaults without overwriting stored modes, manual folio/header values below 4pt through persistence and the real PaintPlan, Memo placement inside the left Editor pane, mobile Focus visibility, state-based mobile writing action visibility, zero-work Home structure, and Demo transitions with no real UI open-state side effects.
- Round 5 deterministic coverage includes Memo open/close from the same entry, removal of the actual shelf-front overlay line, one-row mobile action and secondary-navigation contracts at 320/375/390/430px, Focus preservation of core edit actions, target-preserving Demo placement, Options/Focus guide steps with array-derived totals, and one-paint Web JPG branding geometry from the original 384×341 source. The focused artifact is `typesetting-v2/qa/visual/rc-polish-round5/web-jpg-branding-single-paint.png`.
- Round 6 deterministic coverage adds per-book shelf foreground layering, popup precedence, a shared spine/badge motion wrapper, the 36px mobile primary-action row with content-width tracks at 320/375/390/430px, and lower-safe target-preserving placement for Demo Step 9. Export remains guide-only.

## Remaining Human checks only

### 1. Bookshelf physical layering and badge motion

- On returning Home, hover a book carrying the beginner/cloud marks, then open its title/delete popup. Expected PASS: the local shelf front edge overlaps only the foot of that book; the book remains in front of the shelf background; both marks rise with the book; the popup remains above every shelf/book layer; no full-width separator appears.

### 2. Mobile primary toolbar height

- At 320/375/390/430px confirm `↶ | ↷ | 改ページ挿入 | 置換` is visibly shorter, remains on one line without horizontal overflow, and has comfortable 44px-wide arrow targets. Page Break uses only its readable content width.

### 3. Demo Step 9 placement

- On mobile and desktop, reach Step 9 with Preview visible. Expected PASS: the Export target and guide are both readable, the guide prefers the safe lower area, `次へ` and `デモを終了` remain reachable, and Export does not open automatically.

## Human result

Record `PASS`, or `HOLD` with the exact remaining check number, URL, viewport/browser, action, and observation. A PASS makes the branch RC eligible for separate release-diff approval; it does not authorize merge, push, deploy, or Production release.

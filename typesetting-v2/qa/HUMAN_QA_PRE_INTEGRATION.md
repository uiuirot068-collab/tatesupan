# TateSpun final pre-integration content + UX — targeted Human QA

Prepared: 2026-09-10

This packet contains **only the new remaining checks** from the final content/UX polish run. It does not authorize broad Production integration, push, or deploy.

## Do not repeat closed QA

Typography, Ruby, TCY, 11-B counting/lifecycle/history/share, result/history modal usability, Undo/Redo, checklist functionality, and Demo responsive placement are already Human PASS. A failure in one of the new checks should be reported against that check only; it does not reopen those closed areas.

## Start the real Editor

From the repository root:

```powershell
npm.cmd run dev
```

Use the exact port printed by Next, then open `http://127.0.0.1:<port>/editor?demo=1`.

For export pause checks, use a manuscript and export selection long enough to contain multiple pages.

## Remaining checks

1. Primary Demo includes a concise `作業タイム` step that points out `作業スタート` and `作業記録`.
2. Demo `もっと詳しく` includes 完成前マイチェックリスト and explains reusable presets, a personal list, browser-local persistence, and prevention of submission mistakes.
3. Demo cards still avoid covering mobile bottom targets; `次へ` and `デモを終了` remain reachable.
4. Help has a compact table of contents near the top.
5. Help TOC click/tap moves to the matching existing section.
6. Help TOC remains readable and usable at narrow/mobile width; keyboard Enter/Space activation moves focus to the section.
7. 奥付・目次 → 目次作成 shows `再検出` on its own left-aligned line.
8. The TOC dialog's explanatory gray text, including the empty-result message, is left-aligned.
9. During an active export, Escape opens `書き出しを中断しますか？` without immediately cancelling.
10. While the confirmation remains open, the currently running page/chunk may finish, but progress does not begin an additional page/safe work unit.
11. `書き出しを続ける` closes the confirmation and resumes from the next safe step.
12. Escape while the confirmation is open closes only that warning and resumes; it does not close an underlying dialog or silently cancel.
13. `中断する` stops remaining work, does not report incomplete output as success, and restores the normal non-busy UI.

## Cooperative boundary disclosure

An already-running synchronous canvas encode/grayscale conversion, browser capture call, or JSZip generation chunk cannot be interrupted inside that operation. Confirmation pauses at the earliest cooperative boundary. A browser download already handed off cannot be recalled.

## Report

Record PASS/FAIL, browser, viewport, export type, approximate page count, and the first failing numbered item. Do not rerun passed Typography/Ruby/11-B suites as Human QA.

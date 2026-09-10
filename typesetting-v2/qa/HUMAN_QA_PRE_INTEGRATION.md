# TateSpun mobile Demo viewport-fit — targeted Human QA

Prepared: 2026-09-10

The previous 13-item content/UX packet is **HUMAN PASS**. This packet contains only the newly implemented narrow Demo viewport-fit check. It does not authorize broad Production integration, push, deploy, or a release.

## Do not repeat closed QA

Typography, Ruby, TCY, 11-B, Ruby/TCY compact help, Undo/Redo, work-session result/history modals, Demo work-session/checklist content and target placement, Help TOC/navigation/narrow behavior, TOC-dialog alignment, and export Esc pause/resume/cancel behavior are closed/Human PASS.

## Start the real Editor

From the repository root:

```powershell
npm.cmd run dev
```

Use the exact port printed by Next, then open `http://127.0.0.1:<port>/editor?demo=1` in a narrow mobile viewport. Also open the same route once at desktop width for the regression check.

## Remaining checks

1. At narrow width, the guided Demo feels intentionally contained within the current visible browser viewport; the whole document does not need to be scrolled to understand the step.
2. Mobile browser toolbar expansion/collapse does not leave obvious clipping; the shell tracks the dynamic viewport height.
3. The duplicate full Header is absent at narrow Demo width, while the compact mobile navigation remains usable.
4. Manuscript, Preview, and Settings can scroll internally when their contents exceed the remaining space.
5. Changing steps safely brings the highlighted target into view where practical.
6. The instruction card stays inside the viewport; its text may scroll internally, while `次へ` / `戻る` and `デモを終了` remain reachable.
7. The passed above/below/floating target-card placement still avoids covering targets where space permits.
8. Leaving Demo or opening a normal non-Demo Editor restores the ordinary mobile document-scroll behavior.
9. Desktop Demo layout and navigation do not visibly regress.

## Report

Record PASS/FAIL, browser/device or emulated viewport, orientation, and the first failing numbered item. Do not rerun the closed Typography/Ruby/11-B/content/export suites as Human QA.

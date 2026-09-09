# TateSpun v2 Human E2E Editor (development only)

From the repository root, run:

`npm.cmd exec -- vite --config typesetting-v2/tools/human-e2e-editor/vite.config.ts`

Open `http://127.0.0.1:5173/`. This route is isolated from Production `src/` UI integration and provides:

- horizontal manuscript editing with undo, redo, and manual page-break insertion;
- the Human-selected UI-C settings drawer while the Editor remains visible;
- direct Editor access to a browser-local Memo;
- a browser-local, editable, reusable **完成前マイチェックリスト** with three presets;
- real v2 Canonical Preview and vector Publication PDF through the development API;
- browser-native Web/print JPG downloads from the current manuscript's canonical PaintPlan, including all-page ZIP.

After manuscript or setting changes, select **Preview更新**. PDF currently uses the development-only local Vite API because the Publication PDF renderer still contains Node `Buffer` dependencies. Browser JPG is client-side and sends no manuscript externally.

Focused tests:

`npm.cmd exec -- vitest run --config typesetting-v2/tools/human-e2e-editor/vitest.config.ts`

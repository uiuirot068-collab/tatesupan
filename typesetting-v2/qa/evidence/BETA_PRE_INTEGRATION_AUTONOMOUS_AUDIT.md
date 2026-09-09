# Beta pre-integration autonomous audit

Date: 2026-09-09

Scope: Human-decision-free work allowed entirely inside `typesetting-v2/`. Production `src/`, push, deploy, and live routing were excluded by the run contract.

## Implemented

### 完成前マイチェックリスト

- Pure, versioned state model with defensive localStorage parsing.
- Three starter presets including the frozen examples (奥付の日付, 用紙サイズ, 誤字・置換漏れ).
- Editable names/items/check state; add/remove items; create/delete personal reusable sets; reset preset or personal checks.
- Local browser persistence only. No cloud client, database, external API, or manuscript dependency.
- Direct Editor toolbar access in the development UI-C drawer.

### UI-C development integration

- Horizontal Editor remains mounted and visible beneath a right-side drawer.
- Settings, Memo, and checklist share the drawer pattern.
- Memo and checklist are directly reachable without entering Settings.
- Undo, redo, and manual page-break actions work against the development manuscript history.
- Only the Human-approved ↶, ↷, ⏎, and ⚙️ symbols are used for their approved actions. Rejected prototype emoji are not used.
- Existing v2 bridge, Preview, and Publication state sources are reused; no second typesetting/layout implementation was added.

### JPG final development wiring

- Current development Editor title/content/settings feed `composeV2Document`.
- `bridge.plan` is passed directly to `exportPaintPlanToBrowserJpgPages`.
- Available actions: Web first page, Web all-page ZIP, print all-page ZIP.
- Shared `buildPageJpgFileName` / `buildZipFileName` rules are used.
- Native browser Canvas performs rasterization; no manuscript upload and no re-layout occurs.

## Audited gates

- Browser PDF: current Publication PDF code uses Node `Buffer` for font metrics/outlines and image bytes. The standalone development Editor therefore retains its local Vite API. Browser conversion is an architecture task, not a safe cosmetic wiring change.
- Writing Check visual polish: Production `src/components/WritingCheckOverlay.tsx` / `WritingCheckBar.tsx`.
- Help top TOC: Production `src/components/HelpModal.tsx` plus `public/docs/help.md`.
- TOC-dialog polish: Production Editor component ownership.
- Production UI-C/checklist/JPG adoption: Production Editor wiring.

All five are intentionally left unchanged under the absolute no-Production-`src/` rule.

## Automated verification

- `npm.cmd exec -- vitest run --config typesetting-v2/tools/human-e2e-editor/vitest.config.ts`: 10/10 PASS.
- `npm.cmd exec -- tsc --noEmit`: PASS.
- `npm.cmd exec -- vite build --config typesetting-v2/tools/human-e2e-editor/vite.config.ts`: PASS.
- Core: 367/367 PASS.
- Stage C comparison: 21/21 PASS.
- Stage D development adapter: 30/30 PASS.
- Preview renderer: 114/114 PASS.
- v2Bridge: 27/27 PASS.
- Writing Check engine: 331/331 PASS.
- 11-B session activity: 27/27 PASS.
- localStorage hook regression: 11/11 PASS.
- JPG focused regression: 26/26 PASS.
- Publication: 578/579 PASS; the only failure is a repeatable Dropbox `EBUSY` while overwriting the pre-existing `typography-parity-yakumono-missing-cases-diagnostic.pdf` QA artifact. The same test's other 8 assertions pass; after two identical attempts this artifact-writing branch is HOLD.
- `npm.cmd exec -- next build`: PASS on Next.js 16.3.0 after reading the repository-shipped CLI guide. `npm.cmd run build` cannot run its project-specific prebuild without a configured `NEXT_PUBLIC_SUPABASE_URL`; the direct optimized Next build itself passes.
- `scripts/verify-writing-check.mjs`: tooling invocation fails under Node 24 on a pre-existing unsupported ESM directory import; the newer dedicated Writing Check Vitest suite passes 331/331 and is the recorded regression result.

## Checkpoint limitation

`git add` could not create the worktree metadata `index.lock` because the actual Git worktree directory is outside the writable workspace and read-only to this sandbox. The run contract explicitly prohibited permission escalation. No alternate index, external write, commit, push, or deploy was attempted. Task-owned source/docs remain an isolated unstaged diff; all pre-existing QA noise was left un-staged.

Human visual/interaction QA remains required; see `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`.

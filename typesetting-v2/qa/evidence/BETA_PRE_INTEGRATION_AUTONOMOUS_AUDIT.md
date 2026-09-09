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
- Historical 11-B automatic session-counter semantics: 27/27 PASS at that checkpoint; this product definition was later superseded after Human QA.
- localStorage hook regression: 11/11 PASS.
- JPG focused regression: 26/26 PASS.
- Publication: 578/579 PASS; the only failure is a repeatable Dropbox `EBUSY` while overwriting the pre-existing `typography-parity-yakumono-missing-cases-diagnostic.pdf` QA artifact. The same test's other 8 assertions pass; after two identical attempts this artifact-writing branch is HOLD.
- `npm.cmd exec -- next build`: PASS on Next.js 16.3.0 after reading the repository-shipped CLI guide. `npm.cmd run build` cannot run its project-specific prebuild without a configured `NEXT_PUBLIC_SUPABASE_URL`; the direct optimized Next build itself passes.
- `scripts/verify-writing-check.mjs`: tooling invocation fails under Node 24 on a pre-existing unsupported ESM directory import; the newer dedicated Writing Check Vitest suite passes 331/331 and is the recorded regression result.

## Earlier checkpoint limitation — resolved

During the original MASTER RUN, `git add` could not create the linked-worktree `index.lock` and the contract prohibited escalation. The post-Round 1 recovery resumed with explicit Human authorization for local staging and checkpoint commits. The task-owned changes are now checkpointed through exact-path staging; unrelated QA noise remains unstaged. No alternate index, push, or deploy was used.

Human visual/interaction QA remains required; see `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`.

## Post-pre-integration Human QA Round 1 fix loop

Date: 2026-09-09

The four scoped Round 1 findings were addressed without changing Production `src/` or reopening passed Typography:

- Browser/JPG PaintPlan fallback rotates only U+30FC `ー` around its already-composed cell center. U+2015 `―`, character advance, and Canonical geometry are unchanged.
- Odd/even running heads now use edge-safe left/right paint anchors and matching text alignment. Body Canonical geometry and manuscript flow are unchanged.
- A manual break wins when its boundary shares an offset with a paragraph break, and only the marker's immediately-following separator newline is consumed. Preview, PDF, Web JPG, and print JPG receive the same two-page Canonical result; ordinary newline behavior is unchanged.
- Personal checklist deletion asks for one clear confirmation. Cancel preserves the personal list; confirm uses the existing deletion path. Presets cannot enter the confirmation/deletion path.

Updated verification:

- Core: 368/368 PASS.
- Preview: 114/114 PASS.
- v2Bridge including the frozen Typography Human recheck: 27/27 PASS.
- Development Editor/checklist/manual-break integration: 13/13 PASS.
- Focused JPG regression: 31/31 PASS; U+30FC browser Canvas plus Web/print raster orientation and odd/even Web/print edge strips are covered.
- Publication: 583/584 PASS. The sole failure is the same Dropbox `EBUSY` while overwriting `typography-parity-yakumono-missing-cases-diagnostic.pdf`; all deterministic code assertions and the focused Typography/JPG cases pass.
- Historical 11-B automatic session-counter semantics: 27/27 PASS at that checkpoint; see the corrected work-session evidence below.
- TypeScript, standalone development Editor Vite build, and optimized Next.js 16.3.0 build: PASS.

Non-blocking narrow-width note: the development Editor currently recomposes `composeV2Document` synchronously whenever manuscript content changes so JPG actions always have a current PaintPlan. That MASTER RUN wiring is an obvious source of edit-time work on narrow devices. It remains documented backlog; this scoped fix loop does not introduce a debounce, worker, or broader rendering rewrite.

The Round 2 Human packet is intentionally limited to the 11 targeted items in `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`; previously passed QA is not reopened.

## Final pre-integration 11-B wiring fix and Ruby regression audit

Date: 2026-09-09

### 11-B real Editor root cause and fix

The Human-observed failure was reproduced in a real headless Chromium session on the documented `http://127.0.0.1:<port>/editor?demo=1` route. Native `beforeinput` and `input` events fired and changed the textarea DOM, but neither the current manuscript count nor 11-B changed. Next.js 16's dev log showed the cause: `next dev` advertised `localhost` and rejected every client/HMR asset requested from the additional `127.0.0.1` origin. The page was an unhydrated SSR shell, so no React Editor mutation handler or 11-B accounting code could run.

At that now-superseded automatic-counter checkpoint, `next.config.ts` added development-only `allowedDevOrigins: ["127.0.0.1"]`; no then-current 11-B semantics changed. Its dependency-free CDP regression proved real Editor hydration and input wiring. The final written-character E2E evidence is recorded below.

### Ruby audit — no regression found

- Previous Human-passed reference found: **YES**. Preview body-run anchor closure is commit `788fc31`; the later formal Typography closeout is `70287aa`.
- Ruby geometry changed since PASS: **NO**. `core/compose/rubyPlacement.ts`, Preview's canonical-to-paint Ruby mapping, and Publication's canonical-to-paint Ruby mapping are byte-identical between `70287aa` and the pre-fix HEAD. The only later `pdfGenerator.ts` changes are the isolated U+30FC fallback and running-head anchors; the Ruby annotation x/offset/extent formula remains attributed to the frozen Publication Ruby fixes.
- PDF/JPG Canonical parity: **PASS**. Publication builds Ruby commands from `rubyAnnotation.offsetMm`/`extentMm`, and both Web/print JPG rasterize the same PaintPlan rather than recomposing Ruby.
- Code change required: **NO**. The perceived distance matches the already Human-passed output; no new aesthetic value was invented and Ruby remains CLOSED.
- Human Ruby recheck required: **NO**.

Focused verification at that checkpoint: historical 11-B semantics 27/27 PASS; real Editor browser hydration E2E PASS on `127.0.0.1`; Core Ruby 17/17 PASS; Preview Ruby 42/42 PASS; Publication Typography + JPG 72/72 PASS; ESLint, TypeScript, and optimized Next.js 16.3.0 build PASS.

## 11-B product-spec correction — explicit work-session tracker

Date: 2026-09-09

Human QA established a product-spec mismatch: automatically counting the lifetime of a browser tab was not the intended product. The prior accounting implementation was correct against its old specification; it is not recorded as an accounting bug. The browser-session definition is now superseded by explicit `作業スタート` / `作業終了` work sessions.

Implementation evidence:

- Existing Unicode code-point mutation policy is reused for typing, delete, replacement, IME final commit once, Undo/Redo, Writing Check fixes, and other already-frozen inclusions/exclusions.
- The store ignores mutations while idle, starts every new work session at 0, freezes immediately on End, and preserves an active session across reload using timestamps plus aggregate activity only.
- `localStorage` contains only session metadata. Completed history is bounded to the latest 100 entries and removes the oldest first. No manuscript text, per-keystroke event log, cloud synchronization, analytics, or database was added.
- At this intermediate, later-superseded checkpoint, result/history sharing used the same canonical three-line template with the then-current aggregate field.
- The current manuscript character count remains separately visible.
- Deterministic 11-B suite: **33/33 PASS**, covering all 18 requested lifecycle, mutation, persistence, cap/eviction, exact-share, manuscript-isolation, and current-count cases.
- Real Editor browser E2E on `/editor?demo=1`: **PASS** for idle → Start at 0 → type → visible increase → End → result → reload → history retained.
- TypeScript: **PASS**. Optimized Next.js 16.3.0 build: **PASS**.

Ruby remains CLOSED / Human PASS. This correction changes only Editor/work-session state and does not reopen or modify Ruby, Canonical geometry, Preview, Publication PDF, JPG geometry, TCY, Typography, or Writing Check semantics.

## 11-B final counting-semantics correction — newly written text only

Date: 2026-09-09

Focused Human QA passed the work-session lifecycle, timer, reload recovery, End/result, sharing, history, and next-session reset, but established that inserted+deleted mutation activity was not the intended count. That semantics is now **SUPERSEDED**. The final product count is Unicode code points of newly written/inserted user text during the active work session.

- Typing and paste add their inserted side. Replacement and paste-over-selection ignore the removed side.
- Backspace, Delete, selection deletion, Cut, Undo, and Redo add zero and never decrement the accumulated count.
- Writing Check fixes, search/replace, generated book parts, structural operations, and other programmatic mutations add zero.
- UI terminology is `今回書いた文字数`, separately from `現在の原稿文字数`.
- Persisted aggregate metadata is now `writtenCharacterCount`. The reader defensively accepts prior `editingActivity` state/history so existing local records are not unexpectedly lost; all subsequent writes use the final field name.
- Deterministic 11-B suite: **41/41 PASS** across all 20 required cases.
- Real Editor browser E2E: **PASS** for Start 0 → type +1 → Backspace +0 → replace two selected characters with four +4 → End 5 → reload/history 5.
- TypeScript and optimized Next.js 16.3.0 build: **PASS**.

Start/End, elapsed time, reload persistence, bounded history, X/copy architecture, checklist, Ruby, Typography, Preview, PDF, JPG, and Production integration were not reopened.

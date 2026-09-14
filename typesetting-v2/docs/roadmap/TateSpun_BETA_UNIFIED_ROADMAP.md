# TateSpun β Unified Roadmap

- Updated: 2026-09-11
- Decision-prep baseline HEAD: `12d8c312727c2b414f811ccb40398b274fe39454`
- Status: **AUTHORITATIVE BETA RELEASE ROADMAP / RC POLISH ROUND 7 IMPLEMENTED / REDUCED HUMAN QA PENDING**
- Production integration: **BRANCH-INTEGRATED; RELEASE ACTION NOT AUTHORIZED**

## 1. Authority and status model

This file is the single canonical β roadmap. Earlier roadmap snapshots and research files remain historical evidence, but their stale `OPEN`, `HOLD`, `HUMAN_GATE`, and `NOT_STARTED` labels do not override this rebase.

Every genuine remaining item has exactly one primary disposition:

- **A — BETA RELEASE BLOCKER**
- **B — BETA REQUIRED**
- **C — BETA OPTIONAL IF TIME**
- **D — POST-BETA**
- **E — REJECTED / NO LONGER NEEDED**
- **F — NEEDS HUMAN PRODUCT DECISION** (none currently open for the four β architecture choices)

An F item may be release-blocking. That dependency is stated explicitly; it does not give the item a second primary disposition.

## 2. Product positioning — frozen for β planning

TateSpun is not an all-in-one drafting/project-management suite. It does not require a writer to draft inside TateSpun or lock the manuscript into TateSpun. A manuscript may originate in any writing environment; TateSpun turns it into book-ready Japanese vertical composition, lets the user inspect it before submission, and returns user-owned files.

No manuscript is silently sent to AI or another external service. Local/browser processing and the boundary of any optional cloud action must be explained plainly. Competitor names must not appear in product UI.

### Frozen top-page copy

Hero:

> どこで綴っても、ひとつの本になる。

Subcopy:

> 小説同人誌のための縦組み・入稿準備Webエディタ

The first viewport must make this journey immediately legible:

> 原稿を持ち込む → 本の形で確認する → PDF / JPGで持ち帰る → 入稿前に確認する

Top-page implementation is **BRANCH-INTEGRATED / HUMAN QA PENDING**. Zero-work Home is an open onboarding layout; returning Home is bookshelf-first with Create/Demo/Anthology together and the informational brand panel below bookshelf utilities.

### β demo requirement

The existing real-Editor demo history is retained, but its β purpose is now explicit: provide a sample manuscript, expose Preview early, show that settings affect the book, introduce explicit work-session tracking, make PDF/JPG export and preflight checking discoverable, and state that the sample/local flow does not silently upload the manuscript. Target-aware responsive card placement, the concise work-session step, work-history discoverability, and 完成前マイチェックリスト guidance are **HUMAN PASS**. Round 3 keeps the global Header in both normal and Demo mobile compositions and assigns dynamic height only to the center manuscript/Preview surface; implementation is **AUTOMATED PASS / HUMAN QA PENDING**. Returning-user Home is **HUMAN PASS**; only the zero-work cropped-reference region remains **HUMAN QA PENDING**.

### RC polish Round 3 status

- Running-head apply (all pages or selected pages split by physical parity, replacing in-scope overrides only): **AUTOMATED PASS / HUMAN QA PENDING**.
- Main Settings visual order and single continuous drawer: **AUTOMATED PASS / HUMAN QA PENDING**.
- Publication folio/running-head `max(4, body - 3)` and Web-only body/folio/header `30 / 15 / 20`: **AUTOMATED PASS / HUMAN QA PENDING**.
- Inline work-scoped Memo draft autosave/restore and confirmed-value protection: **AUTOMATED PASS / HUMAN QA PENDING**.
- JPG no-selection/all, selected canonical order, and Web branding aspect-fit: **AUTOMATED PASS / HUMAN QA PENDING**.
- Rollout B exact PowerShell rollback procedure is recorded in the consolidated QA packet: **DOCUMENTED / HUMAN REHEARSAL PENDING**.

## 3. Closed state — do not reopen

The following state is closed or Human-passed and must be preserved through integration:

- Typography parity, including ordinary glyphs, yakumono, Preview, Publication, and the InDesign-level quality gate: **CLOSED / FORMAL HUMAN E2E PASS**.
- Ruby: **CLOSED / HUMAN PASS**. Numeric-overhang, jukugo segmentation, and group-ruby research are not prerequisites for the already-passed β behavior.
- TCY: **CLOSED where Human-passed**. The historical 2-digit-vs-4-digit auto-detect gate does not reopen the passed explicit/current β behavior.
- Dash, ellipsis, small kana, folio/header, and structural colophon: **CLOSED / HUMAN PASS** where recorded.
- Real PNG, transparent PNG, and JPEG embedding: **COMPLETE**.
- Canonical Preview, Publication-quality vector PDF in the local development executor, and the JPG engine/browser executor: **PASS in development**.
- 完成前マイチェックリスト: **IMPLEMENTED / HUMAN PASS in the development Editor**.
- UI-C drawer integration, Memo, Editor actions, and narrow-width behavior: **HUMAN PASS in the development Editor**.
- Manual page break across Preview/PDF/Web JPG/print JPG: **HUMAN PASS**.
- Writing Check 11-A functional scope: **COMPLETE / HUMAN PASS**.
- 11-B work-session tracker core: **CLOSED / FORMAL HUMAN PASS**. Existing counting, Start/End, persistence, share/history data, result/history presentation, narrow-width usability, X/copy share, and Undo/Redo remain frozen. Pause/Resume: **BETA RC LIMITED EXTENSION — IMPLEMENTED / HUMAN QA PENDING**. Ruby and TCY remain **CLOSED / HUMAN PASS**.
- Canonical Preview edit/multi-page behavior, valid-image Preview, normal PDF download, export Escape pause/resume/cancel, manuscript/Memo/checklist/work-session persistence, and Help TOC: **HUMAN PASS**.
- Missing required-image binary: **AUTOMATED PASS**. Preview shows model-derived HOLD, PDF/JPG controls disable, and shared Publication preflight refuses incomplete export without discarding surrounding manuscript content.

Passed typesetting quality is a regression guard for integration, not a new design loop.

## 4. BETA RELEASE BLOCKERS

Primary disposition A:

| Item | Current state | Exit condition |
| --- | --- | --- |
| Production integration | BRANCH-INTEGRATED | Human branch QA confirms the consolidated packet without reopening passed typesetting. |
| Browser/Production PDF execution | BRANCH-INTEGRATED | Worker output, real-font browser-safe bytes, privacy, pause/cancel, and representative files pass Human branch QA. |
| Real-manuscript Production E2E | AUTOMATED BRANCH PASS / HUMAN QA PENDING | A Human-authored manuscript passes the flow in §12, including reload, images, PDF/JPG, TXT, and preflight. |
| Release Candidate gate | AUTOMATED RC AUDIT PASS / HUMAN QA PENDING | Consolidated branch QA passes; no unresolved A/F blocker remains. |
| Production authorization and smoke | NOT AUTHORIZED | Human explicitly approves the integrated release diff before push/deploy; production smoke passes after deploy. |

The previous final content/UX recheck and the explicit Human passes in §3 remain closed. The four former F decisions are approved and recorded in §8. Remaining Human branch QA is limited to conditional Home, responsive Editor/single-column Settings, real-file TXT A/B, multi-page/full PDF, JPG/ZIP, mobile Demo viewport fit, and rollout/rollback; it does not reopen content or typography gates.

## 5. BETA REQUIRED

Primary disposition B:

### Product and onboarding

- Apply the frozen Hero, subcopy, manuscript-to-book journey, and privacy/ownership message to the Production top page.
- Rebase the existing demo onto the β purpose in §2: sample available, Preview early, settings visibly affect the book, export/preflight discoverable, local/privacy boundary clear.
- Keep mobile/responsive usability for existing Production workflows; this is regression preservation, not a new vertical-Editor project.

### Production feature integration

- Integrate UI-C, Memo, visible Undo/Redo, manual page break, checklist, 11-B, Canonical Preview, Publication PDF route, JPG, and real images in the exact dependency order in §11.
- Preserve local save and existing-project compatibility. Optional cloud behavior must not become a prerequisite for the manuscript-to-book flow.
- Preserve selected/single/all-page export behavior that the current Production UX exposes where the corresponding v2 output supports it; do not silently narrow existing export scope.

### TXT export

- Export UTF-8 text using a title-derived safe filename.
- Export is local/download-only: no upload, external AI, or silent external transmission.
- Preserve the user's portable manuscript source. The exact manual-page-break/TateSpun-notation contract must be frozen by the F decision in §8 before implementation.

### TXT import

- **BETA REQUIRED**, promoted from the old undifferentiated TXT Human Gate.
- Reason: the product promise explicitly supports manuscripts created elsewhere. Export-only portability would not fulfill the primary “原稿を持ち込む” journey.
- Accept UTF-8 input safely, never upload it implicitly, surface malformed/unsupported input clearly, and preserve source rather than silently rewriting it.
- BOM, line-ending normalization, and structural marker handling follow the frozen TXT decision in §8.

### Best-effort export cancellation

- **BETA REQUIRED**, recovered from the historical export-UX line.
- Escape must request cancellation during Production PDF, Web JPG, print JPG, and all-page ZIP work.
- Cancellation is cooperative/best-effort: stop future page work at safe boundaries, do not announce incomplete output as success, restore normal UI state, and leave manuscript/settings/images unmodified and uncorrupted.
- If a browser download has already been irreversibly handed off, do not claim it was recalled; report the last reliable application state.
- The current Editor implementation shares one `AbortSignal` and one cooperative pause gate across PDF, Web/print JPG, and ZIP paths. Opening the Esc confirmation pauses scheduling at the next safe boundary; Continue or Escape resumes, while confirmed cancellation suppresses remaining work and incomplete success. Status: **HUMAN PASS on the current branch paths**. This does **not** remove cancellation from the β critical path: the final v2 paths still require wiring and Production-flow verification.

### Preflight and help polish

- Writing Check: NG word gets a purple wavy underline plus textual NG identity; internal RED/YELLOW semantics stay unchanged; amber becomes lighter; result body/snippet is readable at approximately Editor-body size.
- Help: compact top TOC with mouse/keyboard-usable anchors to existing sections; content and order are preserved. **HUMAN PASS**.
- TOC creation dialog: `再検出` begins on its own left-aligned line; explanatory gray empty/result text is left-aligned; detection/insertion behavior is unchanged. **HUMAN PASS**.

### Release validation

- Run a real-manuscript Production E2E, the mandatory acceptance matrix, privacy/output-isolation checks, build, responsive/accessibility sanity checks, and rollback rehearsal.
- Treat narrow-width edit-time composition cost as a measured E2E risk. Optimize only if the Production flow demonstrates a release-impacting problem.

## 6. BETA OPTIONAL IF TIME

Primary disposition C:

- Small non-essential copy/layout refinements found after the required top-page/demo journey is clear.
- Additional non-blocking browser/viewport coverage beyond the mandatory Production matrix.
- Extra sample manuscripts that add coverage without changing the demo architecture.

No C item may delay the Release Candidate or enter the fix-only window unless Human promotes it.

## 7. POST-BETA

Primary disposition D:

- Full vertical Editor mode (P3-O10). Horizontal input remains the β default.
- Cloud/work-specific checklist synchronization and long-term work-session history, analytics, or cross-device history. β keeps the already-approved bounded local metadata model.
- Editor export transformation profiles (P3-O11): markup-preserving/plain/platform-specific transformations, heading/image/colophon transformation policy, and platform presets. Baseline TXT import/export remains β-required; these transformations do not.
- Advanced ruby work: exact class-aware overhang budgets, automatic jukugo-ruby segmentation, and distinct group-ruby distribution. Current Human-passed Ruby remains closed.
- Dedicated HarfBuzz/WASM shaping unless a future required behavior proves unreachable through the selected β architecture.
- Advanced publication features beyond the frozen β policy, including color/publication profiles and any new imposition workflow.
- Expressive dakuten attachment and 3+-dash Writing Check suggestions.
- “Excessive indentation” and ASCII-punctuation auto-conversion rules until false-positive contracts are product-approved.
- Support/affiliate footer and richer monetization/recommendation surfaces. They are not required to validate the manuscript-to-book β promise.
- **V2 Renderer Migration — PLANNED.** β ships with LEGACY as the Preview/Publication default; LEGACY Preview is now virtualized (TSP-LEGACY-PREVIEW-VIRTUALIZATION-001) purely as a β safety/performance measure. The long-term plan remains migrating TateSpun's standard renderer to V2. LEGACY virtualization completing does **not** close this item — V2 default rollout stays HOLD until every item in the V2 default release gate passes (per-page `hideNombre`, TOC/pagination parity, full typography/page-feature parity, and an explicit, separately-approved raster→vector Publication sign-off). See `../implementation/V2_RENDERER_MIGRATION_SPEC.md` for the full specification, blockers, phased plan, and release gate checklist.

## 8. APPROVED BETA DECISIONS — CLOSED

Primary disposition F:

| Decision | Approved choice | Branch status |
| --- | --- | --- |
| Browser/Production PDF execution architecture | **PDF A:** browser-local Worker, `Uint8Array`/`DataView`-based font boundary; manuscript/images never uploaded for PDF. | BRANCH-INTEGRATED / HUMAN QA PENDING |
| Bleed/trim β policy | **Bleed A:** v2 β is trim-only; concise UI disclosure; legacy bleed remains intact for rollback. | BRANCH-INTEGRATED / HUMAN QA PENDING |
| TXT serialization contract | **TXT A:** UTF-8 no BOM + LF export; BOM/no-BOM and CRLF/LF import; source notation preserved; image binary excluded/disclosed. | BRANCH-INTEGRATED / HUMAN QA PENDING |
| Production export rollout | **Rollout B:** internal `NEXT_PUBLIC_TATESPUN_RENDERER` build flag, no ordinary-user engine choice, fail-closed LEGACY fallback. | BRANCH-INTEGRATED / ROLLBACK REHEARSED |

The option/tradeoff evidence remains in `typesetting-v2/qa/evidence/BETA_DECISION_PREP_AUDIT.md`; the implementation evidence is in `BETA_RC_BRANCH_AUDIT.md`. No Human decision remains for the old TCY threshold or old Ruby-contract gates for β.

## 9. RECOVERED OLD ITEMS AND DISPOSITION AUDIT

| Recovered item | Previous state | New disposition | Reason |
| --- | --- | --- | --- |
| Top-page positioning/Hero | Generic “final site copy” / not frozen | **B — BETA REQUIRED** | The product promise and first-viewport journey now have exact approved copy. |
| Existing interactive demo | Content and target placement HUMAN PASS; narrow one-viewport fit implemented, Human QA pending | **B — BETA REQUIRED** | It is the shortest proof of manuscript → book → work session → export/preflight and already has a real-Editor foundation. |
| TXT export | BRANCH-INTEGRATED | **B — BETA REQUIRED** | Approved UTF-8/no-BOM/LF local download is wired with safe title-derived naming. |
| TXT import | BRANCH-INTEGRATED | **B — BETA REQUIRED** | BOM/no-BOM CRLF/LF input is wired with replacement confirmation and image reattachment disclosure. |
| Esc/best-effort export cancel | Current branch paths HUMAN PASS; final v2 path wiring pending | **B — BETA REQUIRED** | Multi-page PDF/JPG/ZIP can be long-running; safe cooperative pause/cancellation is required β export UX. |
| Browser/Production PDF | BRANCH-INTEGRATED / HUMAN QA PENDING | **A — BETA RELEASE BLOCKER** | Browser-local Worker consumes the canonical PaintPlan; global Node Buffer is absent from the browser boundary. |
| Bleed/trim | APPROVED / BRANCH-INTEGRATED | **B — BETA REQUIRED** | v2 β is honestly trim-only; legacy bleed is preserved. |
| Export rollout strategy | APPROVED / BRANCH-INTEGRATED | **B — BETA REQUIRED** | One internal build flag selects v2; unset/invalid restores legacy without manuscript migration. |
| Writing Check visual polish | Branch-integrated; preserve/verify in Production E2E | **B — BETA REQUIRED** | Required clarity/accessibility polish; detection semantics remain closed. |
| Help top TOC | Human PASS | **B — BETA REQUIRED** | Required discoverability for the β feature set. |
| TOC-dialog alignment | Human PASS | **B — BETA REQUIRED** | Small, bounded usability correction already specified by Human QA. |
| UI-C/checklist/Memo/actions | Development-only, formerly Human QA pending | **B — BETA REQUIRED** | Development Human PASS is preserved; only Production integration remains. |
| TCY 2-vs-4-digit auto-detect gate | HUMAN_GATE | **E — NO LONGER A BETA GATE** | Explicit/current TCY behavior passed Human QA; do not reopen it for an unneeded auto-detect expansion. |
| Ruby numeric/jukugo/group contracts | Partially open HUMAN_GATE | **D — POST-BETA** | Current Ruby passed Human QA. Advanced semantics are separable and must not reopen passed β output. |
| Optional colophon fixture/follow-up | Historical optional follow-up | **E — NO LONGER NEEDED FOR BETA** | Structural colophon has Human PASS and full Publication evidence. |
| P3-O11 export transformations/profiles | HUMAN_GATE | **D — POST-BETA** | Baseline portable TXT is required; lossy/platform transformations need a separate product contract. |
| Full vertical Editor | Future/open | **D — POST-BETA** | High IME/caret complexity; horizontal Editor is the frozen β default. |
| Cloud checklist/session history | Deliberately absent / future | **D — POST-BETA** | Not needed for a local-first manuscript-to-book β; avoid new backend scope. |
| Mobile UI | Existing supported flow / integration risk | **B — BETA REQUIRED** | Preserve responsive usability and test it; do not create a new mobile product architecture. |
| Dedicated shaping/advanced publication | Deferred/reopenable | **D — POST-BETA** | No current β acceptance failure requires it. |
| Dropbox artifact `EBUSY` | QA HOLD/noise | **E — REJECTED AS BETA BLOCKER** | Deterministic assertions pass; preserve the artifact noise and rerun release evidence in a non-conflicting output location if needed. |
| Support/affiliate footer | Previously listed as a new β-site requirement | **D — POST-BETA** | It does not validate the core product promise and adds policy/review risk. |

Historical audit/HOLD text remains evidence. This table, the closed-state list, and the primary dispositions above are authoritative for β planning.

## 10. Production integration status

The Production Integration MASTER is **BRANCH-INTEGRATED / HUMAN QA PENDING**. Its entry conditions were satisfied:

1. PDF A, Bleed A, TXT A, and Rollout B are recorded;
2. branch-side Production integration was explicitly authorized;
3. unrelated QA noise was inventoried and left untouched;
4. activation, rollback, tests, and Human QA are recorded.

No merge, push, deploy, or Production release is authorized by this status.

## 11. PRODUCTION INTEGRATION ORDER

Use the following dependency-safe order; verify each slice before continuing. The exact status map is in `BETA_DECISION_PREP_AUDIT.md`.

1. Record the four Human decisions and add the approved internal rollout flag; preserve legacy.
2. Integrate the development UI-C drawer, direct Memo access, and checklist. Reuse/preserve the already-integrated Undo/Redo, manual break, 11-B, Writing Check, Help TOC, TOC dialog, export cancellation, and Demo.
3. Wire Canonical Preview from real Production state behind the rollout control.
4. Wire real Production image resolution and unresolved-image HOLD into the shared v2 PaintPlan.
5. Implement the approved browser PDF binary/font executor and bleed/trim output policy; measure a realistic 100+ page file.
6. Wire v2 Web/print JPG/ZIP to the same PaintPlan and approved geometry policy.
7. Connect the existing cooperative cancellation/progress contract to every final v2 export boundary.
8. Wire local TXT export/import UI using the approved profile and image/settings disclosure; reuse the prepared typed utility boundary.
9. Implement the frozen Top/Hero/subcopy/journey/privacy copy without redesign.
10. Run real-manuscript E2E, responsive/accessibility/privacy/output-isolation checks, rollback rehearsal, and the explicit RC Human gate.

Do not batch all slices into one opaque migration. Do not retire the legacy path before the approved rollout/rollback gate says it is safe.

## 12. CRITICAL PATH AND RC GATE

Critical path:

> approved architecture decisions → branch-integrated browser PDF/JPG/TXT/cancellation + Top/Hero → consolidated Human branch QA → explicit Human approval of the release diff → merge/push/deploy → Production smoke → β release

### Real-manuscript Production E2E

Use a realistic Human-authored manuscript, not only fixtures:

> external TXT import → Editor/save/reload → settings → Writing Check → checklist/11-B → manual break → images → Canonical Preview → PDF → Web/print JPG/ZIP → TXT export/re-import → folio/header/colophon → cancellation/failure recovery

Pass requires source integrity, no silent transmission, consistent page order/geometry, correct filenames, usable responsive UI, and no regression of the closed Typography/Ruby/TCY state.

### Release Candidate gate

RC requires:

- every A blocker closed and every release-blocking F decision resolved;
- required unit/integration/browser suites and optimized Production build PASS;
- real-manuscript E2E and mandatory preset/output matrix PASS;
- accessibility/responsive/privacy/output-isolation checks PASS;
- rollback path proven;
- only release-blocking fixes allowed after RC creation.

Push and deploy remain a separate explicit Human gate after RC/fix-only review. Neither is authorized by this roadmap.

## 13. DELIVERY VIEW

- **CURRENT TARGET — Beta RC Human QA**, with implementation and automated branch audit complete; release action remains separately gated.
- **5-DAY SAFE TARGET — Beta release**, allowing integration-regression and Production-smoke buffer.

These are targets, not promises.

Primary schedule risks:

- Browser PDF binary-reader/font conversion, Worker memory/performance, and 100+ page measurement after the architecture decision.
- Production `src/` integration conflicts or legacy-export rollback complexity.
- Real-manuscript E2E uncovering source/geometry/persistence differences missed by fixtures.
- Recovered β requirements still needing final integration: TXT UI, final v2 cancellation wiring, and Top/Hero. Demo viewport fit needs one targeted Human check; Help/content/export-Esc semantics are Human PASS.
- Dropbox synchronization locks (`EBUSY`) on generated QA artifacts; they are operational noise unless a deterministic assertion fails.

## 14. Evidence and prompt ownership

Current evidence remains in:

- `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`
- `typesetting-v2/qa/evidence/BETA_PRE_INTEGRATION_AUTONOMOUS_AUDIT.md`
- `typesetting-v2/qa/evidence/BETA_DECISION_PREP_AUDIT.md`
- `typesetting-v2/qa/evidence/TYPOGRAPHY_PARITY_FINAL_HUMAN_E2E_CLOSEOUT.md`
- `typesetting-v2/docs/specs/TateSpun_11A_11B_SPEC.md`
- `typesetting-v2/docs/roadmap/archive/` for historical roadmap snapshots

Implementation prompts are authored/reviewed by ChatGPT. No agent may treat this roadmap as authorization to push, deploy, or start Production integration.

## 15. HOW TO onboarding page — TSP-HOWTO-BETA-016

- **Status: IMPLEMENTED / AUTOMATED PASS / HUMAN QA PENDING** (B — BETA REQUIRED). First-time-user end-to-end guide (原稿を持ち込む → 編集する → 本の形を確認する → 必要な設定をする → 入稿前チェック → PDF/JPGを書き出す), distinct from `HelpModal`'s detailed feature reference.
- Route: `/howto` (`src/app/howto/page.tsx`). Builds to `out/tatespun/howto.html` under `build:basepath`, matching the existing `/guide` route's static-export/basePath pattern exactly — same trailing-slash/refresh behavior, no new build-config change. Verified locally against a production-parity `build:basepath` output: `/tatespun/howto/`, `/tatespun/howto` (no slash), and a repeat request (refresh) all resolve; no `/tatespun/tatespun/` doubling anywhere in the emitted HTML.
- Content is adapted from the approved `docs/howto` (Draft v3.4) mockup found as untracked WIP in the pre-checkpoint development worktree (`docs/howto/README.md`, `IMAGE_FILE_MAP.md`, `TEXT_MAP.md`, `public/howto/index.html`); copy and visual language preserved (own scoped stylesheet, `src/app/howto/howto.css`, no global CSS/Tailwind changes). Two explanations the draft had not yet covered were added: Editor Pages split/join (「ここで区切る」／「前のページとつなぐ」, no internal implementation terminology) inside the manuscript-bring-in chapter, and the shipped PDF safe-filename field（「保存ファイル名」、半角英数字、`.pdf` 自動付与）inside the export chapter.
- Images: all 17 prepared screenshots wired to real `<img>` tags (the v3.4 draft had left `IMAGE FILE` text placeholders). Filenames with an accidental duplicated `.png.png` extension were normalized to `.png` on copy-in; the one true duplicate (`guide-cat.png.png`) was dropped in favor of the already-referenced `guide-cat.png`.
- Help/Feedback: reuses the app's existing `HelpModal` and `BetaFeedbackModal` components directly, same pattern as `/guide` — no forked logic. `BetaFeedbackModal` stays behind the existing `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED` flag.
- Discoverability: a small HOW TO link was added to the empty-bookshelf onboarding panel (first-time users) and to the persistent footer nav (returning users) on `/` (`src/app/page.tsx`). Header and Editor were not touched.
- Automated status: `npx vitest run --config src/lib/vitest.config.ts` (new `src/lib/howtoContent.test.ts`, 65 assertions covering image existence, forbidden-term leakage, Editor Page/PDF-filename copy, routing safety, Help/Feedback wiring, and a11y basics) — PASS. ESLint on all new/changed files — PASS (0 errors). `next build`'s internal TypeScript check — PASS. `npm run build:basepath` with `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED` / `NEXT_PUBLIC_TATESPUN_RENDERER=LEGACY` — PASS.
- **Human QA still pending**: visual/mobile check across the required breakpoints, image/text correspondence, and overall look-and-feel have not been confirmed by a human. Do not mark HOW TO Human PASS until that happens.

### TSP-HOWTO-BETA-016A — first Human QA correction round

First Human QA pass on `/howto` found four issues, all fixed and committed (`f121668 fix(howto): connect home navigation and correct guide assets`):

- **Scroll lock**: `/howto` inherited the app-shell's global `body { overflow: hidden }` (meant for the Editor route) and could not scroll past the first viewport. Fixed the same way `/` (`[data-bookshelf-page]`) and `/guide` (`[data-guide-page]`) already opt out — added `[data-howto-page]` to the existing `:has()` selector list in `globals.css`, and the attribute to the page's root element. Editor's scroll behavior is untouched.
- **Home discoverability**: the existing `使い方を見る` quick-action card opened `HelpModal`, not `/howto`, and the only HOW TO links (onboarding panel, footer) were easy to miss. Added a distinct, prominent `HOW TO` card to Home's always-rendered "本棚からできること" quick-actions grid (covers zero-work and returning-user Home in one place) and relabelled the existing card `ヘルプ` to disambiguate it from HOW TO.
- **Hero vs. menu-icon asset mix-up**: the Hero was already correct (`hero-guide-illust.png`, the cat+PC+「？」illustration matching the Human reference), but the small sticky-nav icon wrongly reused that same file — the original source assets had `hero-guide-illust.png` and `guide-cat.png` as byte-identical files. The distinct cropped cat-face icon (previously discarded during the first pass as an "obsolete" duplicate, filename `guide-cat.png.png`) is now used for the nav icon, copied in as `guide-cat-icon.png`.
- **Dead-end nav brand + buried Help**: clicking「HOW TO TateSpun」in the sticky nav did nothing; fixed by adding a `#howto-top` anchor on the Hero and linking the brand to it. Help previously required scrolling to the very bottom of the page to find; added a clearly labelled (non-icon) `ヘルプを見る` / `ヘルプ` trigger to both the first-viewport hero nav and the persistent sticky nav, reusing the same `HelpModal`.
- Automated status: `src/lib/howtoContent.test.ts` grew to 74 assertions (regression guards for all four issues above) — PASS. ESLint, TypeScript, and `npm run build:basepath` — PASS, re-verified after the fix.
- **Human QA still pending** — this was a correction round, not a full visual pass. The original visual/mobile check remains outstanding.

### TSP-HOWTO-BETA-016B — final Home/support navigation polish

**Status: IMPLEMENTED / FINAL HUMAN QA PENDING.** Human QA confirmed round 016A's fixes and asked for three remaining product refinements to Home discoverability and HOW TO's support actions. All three implemented; everything else (Hero, scrolling, 17 content images, menu icon, top-anchor, Editor Page/PDF copy, Help behavior, renderer/Editor/PDF/Preview) was left untouched per the correction's explicit non-goals.

- **HOW TO Report action**: `困ったとき` now shows `[ヘルプを見る] [報告]` — the Report button reuses the exact same `BetaFeedbackModal` component, `onClose`-only prop shape, and `BETA_FEEDBACK_ENABLED` gate as the Editor's own `報告` button (`src/components/TategakiEditor.tsx` → `EditorPane.tsx`'s `onOpenBetaFeedback`). No second feedback implementation; label changed from `報告する` to `報告` to match the Editor's exact wording.
- **Zero-work Home**: replaced the small underlined HOW TO text link with a bounded `TateSpunの使い方を見る` block in the same visual family as the existing `3分でわかる TateSpun おためしデモ` card (same border/padding/CTA-pill styling), placed directly beside the Demo card inside the onboarding actions area — not a 4th quick-action card. A brand-new user now sees two equally obvious paths (Demo, HOW TO) without leaving the Hero area.
- **Returning-user (non-empty) Home**: added a compact `TateSpun How to →` link beside `総集編を編成する` in the top action row (`data-home-returning-actions`).
- **`本棚からできること` restored to its original 3 cards**: `新しい本を書く` / `本をまとめる` / `使い方を見る` (the `使い方を見る` card's label/subtitle, which round 016A had temporarily changed to `ヘルプ` to disambiguate from the since-removed 4th HOW TO card, is restored verbatim). The 4th `HOW TO` card added in round 016A was removed — HOW TO discoverability on non-empty Home is now handled entirely by the compact top-action link above, not a bookshelf card.
- Automated status: `src/lib/howtoContent.test.ts` grew to 80 assertions (new coverage: Report button parity with the Editor's flag/component, zero-work block placement relative to the Demo card, top-action placement relative to `総集編を編成する`, and the restored 3-card grid content) — PASS. ESLint, TypeScript, and `npm run build:basepath` — PASS, re-verified after the fix. The zero-work/returning-user bookshelf area is client-rendered only (waits on IndexedDB via `useLiveQuery`, same as the pre-existing Demo card), so it does not appear in the static-exported HTML — verified at the source/JSX level via the tests above instead of a raw HTML fetch.
- **Human QA still pending** — this was navigation/support polish, not a full visual pass. The original visual/mobile check (and this round's own visual confirmation) remain outstanding before HOW TO can be marked Human PASS.

Preserved, unmodified by this change:

- β renderer = **LEGACY**; Editor surface = **WINDOWED**.
- V2 Renderer Migration = **POST-BETA / HOLD** (§7).
- Preview continuous-dash fidelity = **POST-BETA polish**.
- PDF filename field / export global modal = **CLOSED** — this page only documents the already-shipped behavior; no export logic was touched.
- Production checkpoint deploy `6a849fa` = **CLOSED** — this work was built on a clean worktree/branch (`feature/tatespun-howto-beta`) off `origin/master` at that checkpoint and does not modify it.

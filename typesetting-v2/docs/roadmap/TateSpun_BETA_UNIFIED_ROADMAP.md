# TateSpun β Unified Roadmap

- Updated: 2026-09-10
- Decision-prep baseline HEAD: `12d8c312727c2b414f811ccb40398b274fe39454`
- Status: **AUTHORITATIVE BETA RELEASE ROADMAP / HUMAN DECISIONS PENDING**
- Production integration: **AUDITED / PARTIAL BRANCH FOUNDATIONS PRESENT; FULL MASTER NOT STARTED**

## 1. Authority and status model

This file is the single canonical β roadmap. Earlier roadmap snapshots and research files remain historical evidence, but their stale `OPEN`, `HOLD`, `HUMAN_GATE`, and `NOT_STARTED` labels do not override this rebase.

Every genuine remaining item has exactly one primary disposition:

- **A — BETA RELEASE BLOCKER**
- **B — BETA REQUIRED**
- **C — BETA OPTIONAL IF TIME**
- **D — POST-BETA**
- **E — REJECTED / NO LONGER NEEDED**
- **F — NEEDS HUMAN PRODUCT DECISION**

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

Top-page implementation is not part of this documentation checkpoint.

### β demo requirement

The existing real-Editor demo history is retained, but its β purpose is now explicit: provide a sample manuscript, expose Preview early, show that settings affect the book, introduce explicit work-session tracking, make PDF/JPG export and preflight checking discoverable, and state that the sample/local flow does not silently upload the manuscript. Target-aware responsive card placement, the concise work-session step, work-history discoverability, and 完成前マイチェックリスト guidance are **HUMAN PASS**. A narrow-only `100dvh` guided shell now removes the overall document-scroll burden while preserving internal Editor/Preview/Settings/card scrolling; status is **IMPLEMENTED / HUMAN QA PENDING**. Normal mobile Editor and desktop behavior remain separately scoped. The larger Hero implementation remains roadmap-only until Production integration is authorized.

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
- 11-B work-session tracker: **CLOSED / FORMAL HUMAN PASS**. Counting, Start/End, persistence, share/history data, result/history modal presentation, narrow-width usability, X/copy share, and visible Undo/Redo are Human PASS and frozen. Ruby and TCY remain **CLOSED / HUMAN PASS**.

Passed typesetting quality is a regression guard for integration, not a new design loop.

## 4. BETA RELEASE BLOCKERS

Primary disposition A:

| Item | Current state | Exit condition |
| --- | --- | --- |
| Production integration | AUDITED; full MASTER NOT_STARTED | The ordered integration in §11 is complete without reopening passed typesetting. |
| Browser/Production PDF execution | FEASIBILITY AUDITED; Human architecture decision required | Real Production flow downloads the same Publication PaintPlan with the approved privacy/runtime boundary and no accidental Node-only leakage. |
| Real-manuscript Production E2E | NOT_STARTED | A Human-authored manuscript passes the flow in §12, including reload, images, PDF/JPG, TXT, and preflight. |
| Release Candidate gate | NOT_STARTED | Required tests, build, accessibility/responsive checks, rollback evidence, and Human QA pass; no unresolved A/F blocker remains. |
| Production authorization and smoke | NOT AUTHORIZED | Human explicitly approves the integrated release diff before push/deploy; production smoke passes after deploy. |

The previous final content/UX recheck is Human PASS. Release-blocking F decisions are PDF execution architecture, bleed/trim β policy, TXT serialization contract, and integration rollout policy. They are listed in §8; the one new mobile Demo viewport-fit visual check is B / Human QA pending, not a reopened content gate.

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

## 8. HUMAN DECISIONS REQUIRED

Primary disposition F:

| Decision | Why it is needed | Required before |
| --- | --- | --- |
| Browser/Production PDF execution architecture | Browser bundle spike isolates the blocker to Node `Buffer` font/image readers. The current `output: "export"` site cannot host a Next Route Handler without a deployment change. **Recommendation: client-side browser executor, preferably a Web Worker, using `Uint8Array`/`DataView`; manuscript stays local.** | PDF implementation; release-blocking |
| Bleed/trim β policy | Legacy has fixed 3-mm bleed/full-page artwork; v2 has trim-page geometry only and print-JPG crop is a disclosed no-op. **Recommendation: honest trim-only v2 β with explicit full-bleed limitation and legacy rollback retained.** | Production export contract; release-blocking |
| TXT serialization contract | Existing tokens are known (`【改ページ】`, Ruby, explicit TCY, `【IMG:…】`); safe UTF-8/local plumbing is implemented with no default. **Recommendation: UTF-8 no BOM + LF output, accept BOM/CRLF/LF input, preserve all visible source tokens, disclose that TXT does not contain image binaries or separate page/colophon settings.** | TXT UI/defaults; release-blocking |
| Production export rollout | Production is legacy-pinned; v2 engines/foundations exist separately. **Recommendation: one user experience with an internal staged feature flag, fast legacy rollback, explicit removal criteria after E2E.** | Production export wiring; release-blocking |

Full option/tradeoff evidence and the exact acceptance result for each recommendation are in `typesetting-v2/qa/evidence/BETA_DECISION_PREP_AUDIT.md`. No Human decision remains for the old TCY threshold or old Ruby-contract gates for β: those are E items below.

## 9. RECOVERED OLD ITEMS AND DISPOSITION AUDIT

| Recovered item | Previous state | New disposition | Reason |
| --- | --- | --- | --- |
| Top-page positioning/Hero | Generic “final site copy” / not frozen | **B — BETA REQUIRED** | The product promise and first-viewport journey now have exact approved copy. |
| Existing interactive demo | Content and target placement HUMAN PASS; narrow one-viewport fit implemented, Human QA pending | **B — BETA REQUIRED** | It is the shortest proof of manuscript → book → work session → export/preflight and already has a real-Editor foundation. |
| TXT export | Combined TXT I/O HUMAN_GATE / NOT_STARTED | **B — BETA REQUIRED** | User-owned portability is core to the positioning; structural representation remains an F decision. |
| TXT import | Combined TXT I/O HUMAN_GATE / NOT_STARTED | **B — BETA REQUIRED** | External-manuscript intake is fundamental to “どこで綴っても” and “原稿を持ち込む”. |
| Esc/best-effort export cancel | Current branch paths HUMAN PASS; final v2 path wiring pending | **B — BETA REQUIRED** | Multi-page PDF/JPG/ZIP can be long-running; safe cooperative pause/cancellation is required β export UX. |
| Browser/Production PDF | HUMAN_GATE / NOT_STARTED | **F — NEEDS HUMAN PRODUCT DECISION** | Execution architecture is unresolved; the typesetting/PaintPlan quality is already passed and stays closed. |
| Bleed/trim | HUMAN_GATE | **F — NEEDS HUMAN PRODUCT DECISION** | Existing v2 output cannot honestly claim separate bleed geometry. |
| Export rollout strategy | HUMAN_GATE | **F — NEEDS HUMAN PRODUCT DECISION** | Migration/rollback shape changes Production risk. |
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

## 10. Production integration entry gate

The full Production Integration MASTER remains **NOT_STARTED**, but its existing `src/` foundations and development-only pieces have now been audited. It may begin only after:

1. the four F decisions in §8 are recorded (the former 13-item content/UX gate is already Human PASS);
2. the task explicitly authorizes the Production Integration MASTER;
3. the current diff/noise is inventoried and exact task-owned paths are established;
4. rollback/feature-flag strategy and regression commands are recorded.

This roadmap rebase does not grant Production integration permission.

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

> four Human product/architecture decisions → Production Integration MASTER → browser PDF/JPG/TXT/final cancellation integration → top-page product implementation → mobile Demo targeted Human QA + real-manuscript Production E2E → Release Candidate → fix-only window → explicit Human approval of the Production integration/release diff → push/deploy → Production smoke → β release

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

- **3-DAY TARGET — Beta RC**, if the four Human/architecture decisions are prompt, Production integration has no material `src/` conflict, and real-manuscript E2E does not expose a blocker.
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

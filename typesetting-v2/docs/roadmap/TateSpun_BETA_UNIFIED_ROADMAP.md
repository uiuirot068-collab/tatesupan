# TateSpun β Unified Roadmap

- Updated: 2026-09-20
- **Latest production checkpoint (2026-09-20): `9b3c228` (`merge: release TateSpun UX v3 Loop 3 mobile shared export`) — UX v3 Loop 3 = PRODUCTION PASS / CLOSED (see §40). A4 7-day unattended gate = DAY0 STARTED (2026-09-20). PUBLIC BETA = NOT YET: β start requires A4 Day7 PASS (earliest 2026-09-27) plus the A3/A5 gates. Previous checkpoint `2fcb77a` (Pack A + UX v3 Loop 2, §38). The fixed soft β target date remains withdrawn (§38).**
- Decision-prep baseline HEAD: `12d8c312727c2b414f811ccb40398b274fe39454` (historical decision baseline retained)
- Long-document Editor implementation checkpoint: `ca69e6f` (`fix(editor): rebalance joined pages and reveal caret`) — split/join UX Human PASS
- Announcement Preview checkpoint: `78f7aee` (`fix(preview): keep export menu visible at narrow widths`) — Human PASS
- **Production release checkpoint: `297a8f6` (`merge: release TSP-FRONTEND-RELEASE-001 checkpoint (adedcbb) to production`) — deployed tree = `adedcbb`. Production Human QA ALL PASS (see §16).**
- **Real-manuscript Production E2E (TSP-PRODUCTION-REAL-MANUSCRIPT-E2E-001, 180+ page synthetic fixture): Production Human QA ALL PASS — CLOSED (see §17).**
- Status: **AUTHORITATIVE BETA RELEASE ROADMAP / TSP-FRONTEND-RELEASE-001 DEPLOYED TO PRODUCTION / EDITOR PAGE UX, PDF FILENAME, FOCUS MODE, MEMO UX, HOW TO, REAL-MANUSCRIPT E2E ALL CLOSED / FINAL RC GATE: HOLD — 4-ITEM MINIMAL CHECKLIST REMAINING (§17)**
- Production integration: **TSP-FRONTEND-RELEASE-001 DEPLOYED (frontend-only). DB migration `47d66df` HELD / NOT DEPLOYED — see §16. Further release action beyond this checkpoint is NOT AUTHORIZED by this roadmap.**

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

Top-page implementation: **CLOSED / HUMAN PASS in Production** at `297a8f6` (HOME, §16). Zero-work Home onboarding layout and the zero-work cropped-reference region are covered by that Production HOME pass; do not reopen. Returning Home is bookshelf-first with Create/Demo/Anthology together and the informational brand panel below bookshelf utilities.

### β demo requirement

The existing real-Editor demo history is retained, but its β purpose is now explicit: provide a sample manuscript, expose Preview early, show that settings affect the book, introduce explicit work-session tracking, make PDF/JPG export and preflight checking discoverable, explain the long-document `編集ページ` model, and state that the sample/local flow does not silently upload the manuscript. Target-aware responsive card placement, the concise work-session step, work-history discoverability, 完成前マイチェックリスト guidance, and the final Editor Page split/join guidance are **HUMAN PASS**. Round 3 keeps the global Header in both normal and Demo mobile compositions and assigns dynamic height only to the center manuscript/Preview surface; implementation is **AUTOMATED PASS / HUMAN QA PENDING — still open**. The `/demo` walkthrough is distinct from both the Production HOME pass and the Real-manuscript Production E2E (§12/§16), which used a real long document, not the Demo route — it has not been separately Human-QA'd and is not closed by either. Returning-user Home is **HUMAN PASS** (reconfirmed under Production HOME, §16).

### RC polish Round 3 status

The 100+ page Real-manuscript Production E2E (TSP-PRODUCTION-REAL-MANUSCRIPT-E2E-001, Production Human QA ALL PASS — see §17) substantively exercised several of these items in real output; those are closed below with the evidence link. Items outside that E2E's documented scope remain open and are compressed into the minimal checklist in §17.

- Running-head apply (all pages or selected pages split by physical parity, replacing in-scope overrides only): **CLOSED / HUMAN PASS.** Exercised via the E2E's Settings step (running-head/header setting changed, Preview reflected) and its dedicated folio/running-head/colophon real-output check across a 180+ page document; see §17.
- Main Settings visual order and single continuous drawer: **AUTOMATED PASS / HUMAN QA PENDING — still open.** The E2E changed individual settings and confirmed Preview reflected them, but did not specifically confirm drawer visual ordering/continuity as a UI layout check. In the §17 minimal checklist.
- Publication folio/running-head `max(4, body - 3)` and Web-only body/folio/header `30 / 15 / 20`: **CLOSED / HUMAN PASS.** Exercised via the E2E's dedicated folio/running-head/colophon real-output check (start/middle/end, page transitions) across a 180+ page document; see §17.
- Inline work-scoped Memo draft autosave/restore and confirmed-value protection: **AUTOMATED PASS / HUMAN QA PENDING — still open.** Not exercised by the E2E (no Memo step in that checklist) and distinct from the already-closed focus-mode `📝メモ` entry point (§3/§16). In the §17 minimal checklist.
- JPG no-selection/all, selected canonical order, and Web branding aspect-fit: **CLOSED / HUMAN PASS.** Exercised via the E2E's Web JPG and print JPG steps (order, page count, typography parity checked); see §17.
- Rollout B exact PowerShell rollback procedure is recorded in the consolidated QA packet: **MECHANISM CONFIRMED VIA CODE INSPECTION / PHYSICAL REHEARSAL + PRODUCTION CONFIG CONFIRMATION STILL PENDING — still open.** See §17 for the inspection findings and the remaining gap.

## 3. Closed state — do not reopen

The following state is closed or Human-passed and must be preserved through integration:

- Typography parity, including ordinary glyphs, yakumono, Preview, Publication, and the InDesign-level quality gate: **CLOSED / FORMAL HUMAN E2E PASS**.
- Ruby: **CLOSED / HUMAN PASS**. Numeric-overhang, jukugo segmentation, and group-ruby research are not prerequisites for the already-passed β behavior.
- TCY: **CLOSED where Human-passed**. The historical 2-digit-vs-4-digit auto-detect gate does not reopen the passed explicit/current β behavior.
- Dash, ellipsis, small kana, folio/header, and structural colophon: **CLOSED / HUMAN PASS for β output** where recorded. Consecutive `―` still has a Preview-only visual-fidelity polish item deferred to POST-BETA; exported/Publication output is accepted and must not be reopened for β.
- Real PNG, transparent PNG, and JPEG embedding: **COMPLETE**.
- Canonical Preview, Publication-quality vector PDF in the local development executor, and the JPG engine/browser executor: **PASS in development**.
- 完成前マイチェックリスト: **IMPLEMENTED / HUMAN PASS in the development Editor**. βでは現行の作品スコープ保存を維持し、クラウド共通/作品横断同期はPOST-BETA。
- UI-C drawer integration, Memo, Editor actions, and narrow-width behavior: **HUMAN PASS in the development Editor**.
- Manual page break across Preview/PDF/Web JPG/print JPG: **HUMAN PASS**.
- Writing Check 11-A functional scope: **COMPLETE / HUMAN PASS**.
- 11-B work-session tracker core: **CLOSED / FORMAL HUMAN PASS**. Existing counting, Start/End, persistence, share/history data, result/history presentation, narrow-width usability, X/copy share, and Undo/Redo remain frozen. Pause/Resume: **BETA RC LIMITED EXTENSION — IMPLEMENTED / HUMAN QA PENDING**. Ruby and TCY remain **CLOSED / HUMAN PASS**.
- Canonical Preview edit/multi-page behavior, valid-image Preview, normal PDF download, export Escape pause/resume/cancel, manuscript/Memo/checklist/work-session persistence, and Help TOC: **HUMAN PASS**.
- Missing required-image binary: **AUTOMATED PASS**. Preview shows model-derived HOLD, PDF/JPG controls disable, and shared Publication preflight refuses incomplete export without discarding surrounding manuscript content.
- LEGACY Preview long-document virtualization: **CLOSED / HUMAN PASS**. Large Preview DOM mounting was reduced without changing publication semantics; preserve this as a β regression guard.
- Bookshelf spine thickness: **IMPLEMENTED / SPEC FROZEN** at five character-count bands: `0–9,999 / 10,000–49,999 / 50,000–99,999 / 100,000–299,999 / 300,000+`. `300,000` exactly is the maximum thickness. Only RC visual regression remains.
- Long-document Editor Page split/join UX: **CLOSED / HUMAN PASS** through `ca69e6f`. This includes arbitrary `ここで区切る`, `前のページとつなぐ`, partial pull-up toward the ~50k target, hard-limit protection, session-only layout preferences, Backspace/Delete continuity, caret landing after split/join, mobile controls, and Demo STEP 8. A join operation affects only the current page and its immediately preceding page; later pages are not bulk-merged.
- Narrow-Preview `書き出し` menu clipping: **CLOSED / HUMAN PASS** at `78f7aee`. The menu escapes Preview-frame clipping, stays on-screen at narrow widths, and preserves click/Escape/outside-click behavior.
- Consecutive `―` Preview fidelity: **BETA ACCEPTED / CLOSED FOR BETA**. Human QA confirmed Publication/export output is visually acceptable/correct for β, while Preview may show a different overlap/connection appearance. Do not block β or alter Publication typography for this; improve Preview fidelity in the completed-product/post-beta phase. Reconfirmed Human PASS **in Production** on `297a8f6`/`adedcbb` — see §16.
- PDF submission filename field (`保存ファイル名`, ASCII-only, `TateSpunYYYYMMDD` default, `.pdf` automatic): **CLOSED / HUMAN PASS**. Shipped at `2baaed1` (`feat(pdf): add safe export filename field`) / `81fc164` (`fix(pdf): move export setup to application modal`), deployed and Human-QA-confirmed in Production at `297a8f6`/`adedcbb`. Do not reopen; see §16.
- Desktop focus mode (集中モード) full header collapse and `通常に戻す` exit action: **CLOSED / HUMAN PASS**. Shipped at `f754431` (`fix(editor): collapse header in desktop focus mode with an exit-focus action`), deployed and Human-QA-confirmed in Production at `297a8f6`/`adedcbb`. Mobile `📝メモ` entry in focus mode (`3d02848`) is part of the same Human-passed change and must not be reopened; see §16.
- HOW TO onboarding page (TSP-HOWTO-BETA-016/016A/016B, §15): **CLOSED**. Beyond the earlier standalone checkpoint deploy (`TSP-HOWTO-CHECKPOINT-PRODUCTION-DEPLOY-017`), it is now also folded into and reconfirmed Human PASS under the current Production release `297a8f6`/`adedcbb`; see §16.

Passed typesetting quality is a regression guard for integration, not a new design loop.

## 4. BETA RELEASE BLOCKERS

Primary disposition A:

| Item | Current state | Exit condition |
| --- | --- | --- |
| Production integration (frontend, TSP-FRONTEND-RELEASE-001) | **DEPLOYED / HUMAN QA PASS** at `297a8f6` (deployed tree `adedcbb`) | Closed for this checkpoint. Regression-guard only; see §16. |
| Browser/Production PDF execution | DEPLOYED / HUMAN PASS in Production (part of `297a8f6`); 100+ page scale reconfirmed by the Real-manuscript E2E (§17) | Closed. |
| Long-document horizontal Editor (`編集ページ`) | SPLIT/JOIN UX CLOSED / HUMAN PASS **in Production** | Split/join, partial join, caret landing, IME, Backspace/Delete, mobile, and Demo are closed and reconfirmed in Production at `297a8f6`. Do not reopen split/join UX. |
| Real-manuscript Production E2E | **CLOSED / HUMAN PASS** (§17) | A Human-authored 180+ page manuscript passed the full flow in §12 in Production. Closed; do not repeat. |
| Release Candidate gate | HOLD — **4-item minimal checklist remaining** (§17: Demo Round 3 composition, Settings drawer visual order, app-wide Memo draft autosave, Rollout B Production config/rehearsal confirmation) | Consolidated QA passes once the §17 minimal checklist clears; no unresolved A/F blocker remains. |
| Production authorization and smoke | **TSP-FRONTEND-RELEASE-001 AUTHORIZED AND DEPLOYED** (`297a8f6`) | Closed for this checkpoint's frontend scope. The Supabase auth-cascade safeguard (`47d66df`) remains HELD/NOT DEPLOYED on a separate data-safety track (§16) and is a distinct future authorization decision, not covered by this exit condition. |

The previous final content/UX recheck and the explicit Human passes in §3 remain closed. The four former F decisions are approved and recorded in §8. Editor Page split/join UX and the narrow-Preview export menu are now closed. Remaining Human branch QA includes conditional Home, responsive Editor/single-column Settings, any still-pending Preview→Editor exact-landing RC check, real-file TXT A/B, multi-page/full PDF, JPG/ZIP, mobile Demo viewport fit, and rollout/rollback; it does not reopen passed content, split/join UX, or Publication typography gates.

## 5. BETA REQUIRED

Primary disposition B:

### Product and onboarding

- Apply the frozen Hero, subcopy, manuscript-to-book journey, and privacy/ownership message to the Production top page.
- Rebase the existing demo onto the β purpose in §2: sample available, Preview early, settings visibly affect the book, long-document Editor Pages and manual editor-only splitting are understandable, export/preflight discoverable, local/privacy boundary clear.
- Keep mobile/responsive usability for existing Production workflows; this is regression preservation, not a new vertical-Editor project.

### Production feature integration

- Integrate UI-C, Memo, visible Undo/Redo, manual page break, checklist, 11-B, Canonical Preview, Publication PDF route, JPG, and real images in the exact dependency order in §11.
- Preserve local save and existing-project compatibility. Optional cloud behavior must not become a prerequisite for the manuscript-to-book flow.
- Preserve selected/single/all-page export behavior that the current Production UX exposes where the corresponding v2 output supports it; do not silently narrow existing export scope.
- 完成前マイチェックリスト requires **no new β feature implementation**: development behavior is already Human-passed. Preserve it through Production/RC regression only; cloud-common checklist synchronization stays POST-BETA.

### Long-document Editor / 編集ページ

- **BETA REQUIRED / SPLIT+JOIN UX CLOSED / HUMAN PASS.**
- The performance root cause was the full ~300k manuscript living in one native textarea. β uses Editor-only pagination so the canonical manuscript remains one continuous string while only one bounded horizontal textarea is editable at a time.
- Target Editor Page size is approximately `50,000` UTF-16 code units; hard maximum remains approximately `55,000`.
- `ここで区切る` creates an Editor-only boundary at the current canonical caret. `前のページとつなぐ` operates only on the current page and its immediately preceding page; it never bulk-merges later pages.
- When a full join fits safely, the two adjacent Editor Pages combine. When a full join would exceed the safe limit but the previous page has room, TateSpun moves only enough of the boundary forward to bring the previous page toward the ~50k target, leaving the remainder on the current page.
- If no safe capacity remains, `前のページとつなぐ` stays visible but disabled with a concise limit explanation.
- Split/join never changes canonical manuscript text or Preview/PDF/JPG publication pagination. Layout preferences remain SESSION_ONLY for β.
- After split/join, the global caret is preserved and the active Editor textarea scrolls once to reveal it; ordinary typing/IME is not subjected to continuous scroll-follow.
- `Ctrl+A` keeps native current-Editor-Page semantics; `全文を選択` is the explicit whole-manuscript application action.
- Human QA passed arbitrary split, automatic/manual-origin-agnostic join, progressive adjacent joining, partial pull-up, hard-limit disabling, split-after-join, Backspace/Delete continuity, caret visibility, mobile controls, and Demo STEP 8.
- FULL editor remains the fail-closed rollback path during rollout; paged-editor activation/rollback is still part of RC verification.
- Any still-pending Preview→Editor exact visual landing check remains an RC navigation check and must not reopen this closed split/join UX.

### PDF submission filename

- **CLOSED / HUMAN PASS.** Shipped at `2baaed1`/`81fc164`; deployed and Human-QA-confirmed in Production at `297a8f6`/`adedcbb`. The contract below is preserved as a regression-guard specification, not an open item.
- Keep the existing general pre-submission warning at the top of the PDF dialog.
- Add a `保存ファイル名` text field **below the three output-format choices** in the PDF export dialog.
- Allowed input is ASCII alphanumeric only: `A-Z`, `a-z`, `0-9`. Japanese, spaces, and symbols are rejected.
- Default value: `TateSpunYYYYMMDD`.
- `.pdf` is appended automatically and is not typed by the user.
- Empty filename disables `ダウンロード`.
- The entered value becomes the actual downloaded PDF filename.
- Approved concise helper copy: `入稿用ファイル名は英数字がおすすめです。印刷所の指定もご確認ください。`
- The older post-export “rename afterward” warning concept is superseded by this in-dialog filename control.

### Announcement-video Preview blockers

- Narrow Preview `書き出し` menu clipping: **CLOSED / HUMAN PASS** at `78f7aee`. The menu now uses viewport-aware fixed positioning so the Preview frame's clipping does not hide export choices at narrow pane widths.
- Consecutive `―` in Preview: **CLOSED FOR BETA / POST-BETA POLISH RECORDED**. The Preview can show a different overlap/connection appearance than the final exported output. Human QA accepted β because Publication/export output is correct and the issue does not affect user-owned output files.
- Do not make speculative dash-spacing changes for β. The completed-product/post-beta task is to improve Preview-only continuous-dash fidelity so Preview more closely matches export across supported fonts/zoom levels without disturbing passed Publication typography.

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
- Treat long-document Editor Page boundary behavior, Preview↔Editor navigation, and narrow-width composition as measured E2E risks. The full-text textarea bottleneck itself is no longer an open investigation; optimize only if final Production Human QA demonstrates a remaining release-impacting problem.

## 6. BETA OPTIONAL IF TIME

Primary disposition C:

- Small non-essential copy/layout refinements found after the required top-page/demo journey is clear.
- Additional non-blocking browser/viewport coverage beyond the mandatory Production matrix.
- Extra sample manuscripts that add coverage without changing the demo architecture.

No C item may delay the Release Candidate or enter the fix-only window unless Human promotes it.

## 7. POST-BETA

Primary disposition D:

- Full vertical Editor mode (P3-O10). Horizontal input remains the β default.
- Cloud-common / work-specific checklist synchronization across devices, plus long-term work-session history, analytics, or cross-device history. β keeps the already-approved bounded work-scoped/local metadata model.
- Editor export transformation profiles (P3-O11): markup-preserving/plain/platform-specific transformations, heading/image/colophon transformation policy, and platform presets. Baseline TXT import/export remains β-required; these transformations do not.
- Advanced ruby work: exact class-aware overhang budgets, automatic jukugo-ruby segmentation, and distinct group-ruby distribution. Current Human-passed Ruby remains closed.
- Dedicated HarfBuzz/WASM shaping unless a future required behavior proves unreachable through the selected β architecture.
- Advanced publication features beyond the frozen β policy, including color/publication profiles and any new imposition workflow.
- Expressive dakuten attachment and 3+-dash Writing Check suggestions.
- Preview-only continuous-dash (`――` / `―――`) fidelity polish: make Preview match exported/Publication output more closely across supported fonts and zoom levels without changing the already-accepted β output typography.
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

### Additional approved β product decisions (2026-09-14)

| Decision | Approved choice | Current state |
| --- | --- | --- |
| Long-document horizontal Editor | Editor-only pagination around 50k, hard max ~55k; canonical manuscript remains one string; user-facing split/join is origin-agnostic; partial join pulls the boundary toward ~50k; FULL editor retained as rollback. | CLOSED / HUMAN PASS for split+join UX; rollout/rollback remains RC verification |
| Manual Editor split | Always-visible neutral `ここで区切る` beside `全文を選択`; split at current global caret; editor-only, no manuscript/publication change; session-only for β. | CLOSED / HUMAN PASS (same split/join closure as the row above; reconfirmed in Production at `297a8f6`) |
| PDF filename | In PDF modal below output choices; ASCII alphanumeric only; default `TateSpunYYYYMMDD`; `.pdf` automatic; empty disables download. | CLOSED / HUMAN PASS in Production at `297a8f6` (`2baaed1`/`81fc164`) |
| Checklist cloud scope | Existing work-scoped checklist is the β behavior; cloud-common/cross-device synchronization is post-beta. | CLOSED FOR β |
| Bookshelf thickness | Five levels: `0–9,999 / 10,000–49,999 / 50,000–99,999 / 100,000–299,999 / 300,000+`. | IMPLEMENTED / FROZEN |

## 9. RECOVERED OLD ITEMS AND DISPOSITION AUDIT

| Recovered item | Previous state | New disposition | Reason |
| --- | --- | --- | --- |
| Top-page positioning/Hero | Generic “final site copy” / not frozen | **B — BETA REQUIRED** | The product promise and first-viewport journey now have exact approved copy. |
| Existing interactive demo | Content and target placement HUMAN PASS; narrow one-viewport fit implemented, Human QA pending | **B — BETA REQUIRED** | It is the shortest proof of manuscript → book → work session → export/preflight and already has a real-Editor foundation. |
| Long-document Editor Pages | Full-text native textarea caused severe ~300k typing latency | **A — BETA RELEASE BLOCKER (UX CLOSED; rollout gate remains)** | Paged horizontal editing and split/join UX are Human PASS through `ca69e6f`; preserve them and finish only rollout/rollback plus any still-pending Preview→Editor RC navigation check. |
| PDF submission filename | Old concept was post-export rename guidance | **B — CLOSED / HUMAN PASS in Production (`297a8f6`)** | Filename safety belongs inside the PDF dialog: alphanumeric field, `TateSpunYYYYMMDD` default, `.pdf` automatic. Shipped `2baaed1`/`81fc164`. |
| Bookshelf spine thickness | Earlier thresholds differed | **B — IMPLEMENTED / FROZEN** | Five approved character-count bands are already reflected; preserve them through RC visual regression. |
| Narrow Preview export-menu clipping | Menu was clipped by Preview `overflow-hidden` at narrow pane widths | **B — CLOSED / HUMAN PASS** | Fixed at `78f7aee`; menu stays visible/clickable without horizontal overflow. |
| Preview continuous-dash visual fidelity | Preview and exported `――` appearance are not perfectly identical | **D — POST-BETA POLISH / BETA ACCEPTED** | Exported/Publication output is correct for β. Improve Preview-only fidelity later; do not reopen passed output typography. |
| TXT export | BRANCH-INTEGRATED | **B — BETA REQUIRED** | Approved UTF-8/no-BOM/LF local download is wired with safe title-derived naming. |
| TXT import | BRANCH-INTEGRATED | **B — BETA REQUIRED** | BOM/no-BOM CRLF/LF input is wired with replacement confirmation and image reattachment disclosure. |
| Esc/best-effort export cancel | Current branch paths HUMAN PASS; final v2 path wiring pending | **B — BETA REQUIRED** | Multi-page PDF/JPG/ZIP can be long-running; safe cooperative pause/cancellation is required β export UX. |
| Browser/Production PDF | BRANCH-INTEGRATED / HUMAN QA PENDING | **A — BETA RELEASE BLOCKER** | Browser-local Worker consumes the canonical PaintPlan; global Node Buffer is absent from the browser boundary. |
| Bleed/trim | APPROVED / BRANCH-INTEGRATED | **B — BETA REQUIRED** | v2 β is honestly trim-only; legacy bleed is preserved. |
| Export rollout strategy | APPROVED / BRANCH-INTEGRATED | **B — BETA REQUIRED** | One internal build flag selects v2; unset/invalid restores legacy without manuscript migration. |
| Writing Check visual polish | Branch-integrated; preserve/verify in Production E2E | **B — BETA REQUIRED** | Required clarity/accessibility polish; detection semantics remain closed. |
| Help top TOC | Human PASS | **B — BETA REQUIRED** | Required discoverability for the β feature set. |
| TOC-dialog alignment | Human PASS | **B — BETA REQUIRED** | Small, bounded usability correction already specified by Human QA. |
| UI-C/checklist/Memo/actions | IMPLEMENTED / checklist Human PASS | **B — BETA REQUIRED (preservation/integration only)** | No new checklist feature design remains for β; preserve the passed behavior through final Production/RC integration. |
| TCY 2-vs-4-digit auto-detect gate | HUMAN_GATE | **E — NO LONGER A BETA GATE** | Explicit/current TCY behavior passed Human QA; do not reopen it for an unneeded auto-detect expansion. |
| Ruby numeric/jukugo/group contracts | Partially open HUMAN_GATE | **D — POST-BETA** | Current Ruby passed Human QA. Advanced semantics are separable and must not reopen passed β output. |
| Optional colophon fixture/follow-up | Historical optional follow-up | **E — NO LONGER NEEDED FOR BETA** | Structural colophon has Human PASS and full Publication evidence. |
| P3-O11 export transformations/profiles | HUMAN_GATE | **D — POST-BETA** | Baseline portable TXT is required; lossy/platform transformations need a separate product contract. |
| Full vertical Editor | Future/open | **D — POST-BETA** | High IME/caret complexity; horizontal Editor is the frozen β default. |
| Cloud-common checklist/session history | Deliberately absent / future | **D — POST-BETA** | β keeps the already-approved work-scoped/local checklist behavior; cross-device/common synchronization would add backend scope. |
| Mobile UI | Existing supported flow / integration risk | **B — BETA REQUIRED** | Preserve responsive usability and test it; do not create a new mobile product architecture. |
| Dedicated shaping/advanced publication | Deferred/reopenable | **D — POST-BETA** | No current β acceptance failure requires it. |
| Dropbox artifact `EBUSY` | QA HOLD/noise | **E — REJECTED AS BETA BLOCKER** | Deterministic assertions pass; preserve the artifact noise and rerun release evidence in a non-conflicting output location if needed. |
| Support/affiliate footer | Previously listed as a new β-site requirement | **D — POST-BETA** | It does not validate the core product promise and adds policy/review risk. |

Historical audit/HOLD text remains evidence. This table, the closed-state list, and the primary dispositions above are authoritative for β planning.

## 10. Production integration status

**Superseded by §16.** As of `297a8f6` (deployed tree `adedcbb`), TSP-FRONTEND-RELEASE-001 is **DEPLOYED TO PRODUCTION with Human QA ALL PASS** for the scope listed in §16 — this includes long-document Editor split/join UX (`ca69e6f`), the narrow-Preview export menu fix (`78f7aee`), the PDF filename field (`2baaed1`/`81fc164`), desktop focus mode and `通常に戻す`/`📝メモ` (`f754431`/`3d02848`), and HOW TO. None of these remain unfinished. Its original entry conditions were satisfied:

1. PDF A, Bleed A, TXT A, and Rollout B are recorded;
2. Production integration was explicitly authorized and, for this frontend checkpoint, deployed;
3. unrelated QA noise was inventoried and left untouched;
4. activation, rollback, tests, and Human QA are recorded.

This frontend checkpoint deploy does not by itself authorize any further merge, push, or deploy beyond `297a8f6` — in particular it does **not** authorize deploying the held Supabase DB safeguard `47d66df` (§16), and it does not by itself constitute the formal Beta Release sign-off, which still requires the Real-manuscript Production E2E and consolidated RC gate in §12/§13.

## 11. PRODUCTION INTEGRATION ORDER

Use the following dependency-safe order; verify each slice before continuing. The exact status map is in `BETA_DECISION_PREP_AUDIT.md`.

1. Preserve the four approved architecture decisions and existing internal renderer rollout/rollback; do not retire LEGACY.
2. Preserve the Human-passed long-document Editor Page split/join UX through `ca69e6f`; do not reopen it. Verify only the remaining paged-editor rollout/rollback gate and any still-pending Preview→Editor exact-landing RC navigation check.
3. Preserve the Human-passed narrow-Preview export-menu fix at `78f7aee`; Preview continuous-dash fidelity is accepted for β and deferred to post-beta because Publication/export output is correct.
4. Preserve the already-passed UI-C drawer, direct Memo, checklist, Undo/Redo, publication manual break, 11-B, Writing Check, Help TOC, TOC dialog, export cancellation, and Demo. Do not reopen checklist design.
5. Keep Canonical Preview / real Production image resolution / unresolved-image HOLD wired to the approved Publication path and re-verify them only as RC regressions.
6. Keep the approved browser PDF binary/font executor and bleed/trim policy; measure/verify a realistic 100+ page file.
7. Add the approved PDF `保存ファイル名` field (ASCII alphanumeric only, default `TateSpunYYYYMMDD`, `.pdf` automatic) and use it for actual download naming.
8. Preserve v2 Web/print JPG/ZIP geometry and cooperative cancellation/progress contracts.
9. Preserve local TXT export/import UI using the approved serialization profile and image/settings disclosure.
10. Preserve the frozen Top/Hero/subcopy/journey/privacy copy without redesign.
11. Run the revised real-manuscript E2E, responsive/accessibility/privacy/output-isolation checks, rollback rehearsal, and explicit RC Human gate.

Do not batch all slices into one opaque migration. Do not retire the legacy path before the approved rollout/rollback gate says it is safe.

## 12. CRITICAL PATH AND RC GATE

Critical path:

> approved PDF filename control → remaining consolidated branch/Production Human QA → explicit Human approval of the release diff → merge/push/deploy → Production smoke → β release

### Real-manuscript Production E2E

Use a realistic Human-authored manuscript, not only fixtures:

> external TXT import → Editor/save/reload → long-document `編集ページ` (prev/next, automatic split, `区切り待ち`, `ここで区切る`, `前のページとつなぐ`, partial pull-up toward ~50k, current-page Ctrl+A, explicit 全文を選択, Backspace/Delete cross-boundary, caret landing, Preview→Editor jump, IME) → settings → Writing Check → checklist/11-B → publication manual break → images → Canonical Preview → PDF filename field/validation → PDF → Web/print JPG/ZIP → TXT export/re-import → folio/header/colophon → cancellation/failure recovery

Pass requires source integrity, no silent transmission, stable long-document editing/navigation, consistent page order/geometry, correct validated filenames, usable responsive UI, and no regression of the closed Typography/Ruby/TCY state.

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

- Real-manuscript Production E2E is **CLOSED** (was the prior current target; Human PASS in Production, §17).
- **CURRENT TARGET — clear the §17 minimal 4-item RC checklist**: Demo Round 3 mobile/header composition, Settings drawer visual order, app-wide Memo draft autosave/restore, and Rollout B Production config/rollback confirmation.
- **NEXT TARGET — once §17's checklist clears, a separate explicit release authorization gate** for the formal Beta Release (distinct from the TSP-FRONTEND-RELEASE-001 frontend checkpoint already deployed).
- PDF submission filename is **CLOSED** (shipped and Human-passed in Production at `297a8f6`).

These are targets, not promises.

Primary schedule risks:

- Paged-editor rollout/rollback and any still-pending Preview→Editor exact-landing RC navigation check. Split/join UX itself is CLOSED / Human PASS and must not be reopened.
- Browser PDF binary-reader/font conversion, Worker memory/performance, validated filename flow, and 100+ page measurement.
- Production `src/` integration conflicts or legacy/FULL-editor rollback complexity.
- Real-manuscript E2E uncovering source/geometry/persistence differences missed by fixtures.
- Demo STEP 8 split/join guidance is Human PASS; preserve it as a regression guard.
- Dropbox synchronization locks (`EBUSY`) on generated QA artifacts; they are operational noise unless a deterministic assertion fails.

## 14. Evidence and prompt ownership

Current evidence remains in:

- `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`
- `typesetting-v2/qa/evidence/BETA_PRE_INTEGRATION_AUTONOMOUS_AUDIT.md`
- `typesetting-v2/qa/evidence/BETA_DECISION_PREP_AUDIT.md`
- `typesetting-v2/qa/evidence/TYPOGRAPHY_PARITY_FINAL_HUMAN_E2E_CLOSEOUT.md`
- `typesetting-v2/docs/specs/TateSpun_11A_11B_SPEC.md`
- `typesetting-v2/docs/roadmap/archive/` for historical roadmap snapshots

Recent long-document implementation checkpoints to preserve as evidence:

- `86d5a45` — LEGACY Preview virtualization
- `279c4bb` — paged long-document Editor
- `263a4cd` — paged Editor workspace height fix
- `a01c396` — paged navigation/selection refinements
- `e19f82d` — Preview↔Editor navigation ownership stabilization
- `b38ff78` — Demo Editor Page target placement
- `83652f8` — Editor Page boundary/progress + Preview landing work
- `d8f8dc5` — actionable `区切り待ち` / session forced-boundary support
- `2ce0196` — arbitrary `ここで区切る` + Backspace backward-affinity fix
- `346c532` — manual boundary join
- `daab972` — unified automatic/manual-origin-agnostic split/join controls
- `ca69e6f` — partial join toward ~50k + caret reveal after split/join (**Human PASS; Editor Page split/join UX CLOSED**)
- `78f7aee` — narrow-Preview export menu clipping fix (**Human PASS**)
- Preview continuous-dash (`――`) fidelity — **BETA ACCEPTED / POST-BETA POLISH**; no speculative code change was made because Publication/export output is correct

Implementation prompts are authored/reviewed by ChatGPT. No agent may treat this roadmap as authorization to push, deploy, or start Production integration.

## 15. HOW TO onboarding page — TSP-HOWTO-BETA-016

- **Status: IMPLEMENTED / HUMAN PASS / CLOSED** (B — BETA REQUIRED). First-time-user end-to-end guide (原稿を持ち込む → 編集する → 本の形を確認する → 必要な設定をする → 入稿前チェック → PDF/JPGを書き出す), distinct from `HelpModal`'s detailed feature reference. Human QA passed across three rounds (016, 016A, 016B) covering: Home → HOW TO (zero-book onboarding block and returning-user top action), `/tatespun/howto/` scrolling, correct Hero (`hero-guide-illust.png`) and menu icon (`guide-cat-icon.png`), the `#howto-top` brand anchor, Help, Report via the shared `BetaFeedbackModal`, all 17 prepared images, the Editor Page and PDF-filename explanations, desktop, and mobile. A production checkpoint deploy of this state is authorized as **TSP-HOWTO-CHECKPOINT-PRODUCTION-DEPLOY-017** (this is a checkpoint deploy, not the formal Beta release).
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
- **Human QA: PASS.** This round's changes, plus every item from 016 and 016A, were confirmed by Human QA. See §15 top status.

### TSP-HOWTO-CHECKPOINT-PRODUCTION-DEPLOY-017

HOW TO is **CLOSED**. A checkpoint production deploy of `feature/tatespun-howto-beta` (commits `9609131`, `f121668`, `21e0ac1`, `71b7de7` on top of production checkpoint `6a849fa`) to the Cloudflare Pages `tatespun` project is authorized and tracked separately — see the deploy-gate validation/push/smoke record for the exact pushed SHA and result. This checkpoint deploy does not itself constitute the formal Beta release; remaining Beta RC items (real-manuscript E2E, 72h cloud-image audit, final RC/fix-only window) continue per §4/§12/§13.

Preserved, unmodified by this change:

- β renderer = **LEGACY**; Editor surface = **WINDOWED**.
- V2 Renderer Migration = **POST-BETA / HOLD** (§7).
- Preview continuous-dash fidelity = **POST-BETA polish**.
- PDF filename field / export global modal = **CLOSED** — this page only documents the already-shipped behavior; no export logic was touched.
- Production checkpoint deploy `6a849fa` = **CLOSED** — this work was built on a clean worktree/branch (`feature/tatespun-howto-beta`) off `origin/master` at that checkpoint and does not modify it.

## 16. TSP-FRONTEND-RELEASE-001 — Production release closeout (2026-09-14)

**Production commit: `297a8f6`** (`merge: release TSP-FRONTEND-RELEASE-001 checkpoint (adedcbb) to production`). **Deployed tree = `adedcbb`** (`test(home,editor): fix two stale assertions, no production behavior change`), which is the tip of the HOW TO/focus-mode/PDF-filename/editor-page-split-join development history recorded in §3/§5/§15 above. This is a frontend-only release; it is deployed the same way the earlier HOW TO checkpoint (`TSP-HOWTO-CHECKPOINT-PRODUCTION-DEPLOY-017`) was — a Production checkpoint deploy, not yet a declaration that every item in the formal Beta Release gate (§12/§13) is satisfied.

**Production Human QA — ALL PASS:**

- HOME: **PASS**
- HOW TO: **PASS** (reconfirms and folds in §15's `016`/`016A`/`016B` rounds; HOW TO remains **CLOSED**)
- EDITOR: **PASS**
- WINDOWED editor surface: **PASS**
- Editor Page split/join: **PASS** (reconfirms §3/§5's `ca69e6f` closure; do not reopen)
- Desktop focus mode (集中モード header collapse): **PASS** (`f754431`; now **CLOSED**, see §3)
- `📝メモ` (focus-mode mobile Memo entry): **PASS** (`3d02848`; now **CLOSED**, see §3)
- `通常に戻す` (exit-focus action): **PASS** (`f754431`; now **CLOSED**, see §3)
- Ruby Preview parity: **CLOSED**
- Preview `――` seam: **CLOSED** (reconfirms the existing BETA ACCEPTED / CLOSED FOR BETA disposition in §3 — Publication/export output was already correct; this Production pass adds no new scope)
- PDF submission filename field: covered under the EDITOR pass above; **CLOSED**, see §5.

**Production DB: NOT changed.** No Supabase migration was applied as part of this release.

**HELD / separate track — do not fold into this release or into frontend feature work:**

- `47d66df` (`fix(supabase): prevent auth user deletion from cascading into manuscripts`) is **NOT deployed**. It sits one commit ahead of the deployed tree `adedcbb` on this branch but was deliberately excluded from the `297a8f6` merge, per that merge commit's own message.
- The Supabase CASCADE safeguard is held back from frontend release **by design** and tracked as a separate data-safety decision, not a frontend beta-release blocker.
- The older/legacy user-manuscript-loss investigation remains its own separate track; this closeout does not resolve or reopen it.
- Auth-user deletion / user-ID consolidation work remains **prohibited** until that separate data-safety track is explicitly resolved. No agent may treat this frontend release as authorization to touch Supabase auth/user-identity data.

This entry supersedes the "BRANCH-INTEGRATED; RELEASE ACTION NOT AUTHORIZED" framing for the specific items listed above wherever it appears earlier in this document (§3, §4, §5, §9, §10); those earlier sections were edited in place to point here rather than duplicated. Historical framing for items *not* listed above (Real-manuscript Production E2E, remaining RC Polish Round 3 items, Rollout B rollback rehearsal, the formal Beta Release/RC gate itself) is unchanged and still open — see §13.

## 17. TSP-BETA-RC-FINAL-GATE-001 — Real-manuscript E2E closure, rollback readiness, final RC gate (2026-09-15)

### Real-manuscript Production E2E — CLOSED

**TSP-PRODUCTION-REAL-MANUSCRIPT-E2E-001: Production Human QA ALL PASS.** A synthetic 180+ page QA fixture (106,953 UTF-16 code units, `typesetting-v2/qa/real-manuscript-e2e/TSP-PRODUCTION-REAL-MANUSCRIPT-E2E-001_manuscript.txt`, backed up byte-identically alongside it) was run through the full flow in §12 against Production `297a8f6`/`adedcbb`: import/load, reload/persistence, long-document editing at 100+ page scale, settings, Writing Check/checklist, images, Canonical Preview (start/middle/end), the PDF filename field, PDF export, Web JPG, print JPG, ZIP, TXT round-trip, folio/running-head/colophon, cancellation, and final persistence. No data loss, no crash/freeze, no cloud/bookshelf anomaly. This closes the §4 Real-manuscript Production E2E blocker row.

Caveat for future readers: the per-row checklist template (`typesetting-v2/qa/real-manuscript-e2e/TSP-PRODUCTION-REAL-MANUSCRIPT-E2E-001_CHECKLIST.md`) was prepared but returned to this roadmap filled in only at the summary level (an overall ALL PASS), not with per-row evidence/screenshots. The closure above is recorded on that basis. If item-level evidence is needed later, re-run against the same fixture rather than reconstructing it after the fact.

This closure substantively exercises, and therefore also closes, three of the RC Polish Round 3 items from §2 that were previously only AUTOMATED PASS / HUMAN QA PENDING:

- **Running-head apply** — exercised via the Settings step and the dedicated folio/running-head/colophon real-output check.
- **Publication folio/running-head sizing** (`max(4, body-3)`; Web-only `30/15/20`) — exercised via the same dedicated check across start/middle/end of a 180+ page document.
- **JPG canonical order** (no-selection/all, selected canonical order, Web branding aspect-fit) — exercised via the Web JPG and print JPG steps (order, page count, typography parity).

Do not re-request QA on these three; do not reopen them.

### Rollback readiness — code-inspection findings

Confirmed by reading (no code changed, no rollback performed):

- `src/lib/v2Rollout.ts` — `NEXT_PUBLIC_TATESPUN_RENDERER`: build-time-inlined Next.js env var; only the literal value `"V2_BETA"` enables the v2 renderer, everything else (unset, typo, anything else) **fails closed to `LEGACY`**.
- `src/lib/editorSurfaceRollout.ts` — `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE`: same pattern, independent flag; only `"WINDOWED"` enables the windowed editor, everything else **fails closed to `FULL`**. Deliberately kept as a separate flag from the renderer so the two migrations roll back independently.
- Both are pure static build-time selections with **no server-side flag service and no stored/DB state** — rollback is a rebuild/redeploy with a different env var value, not a data migration.
- `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md:43` already records a Human-tested round trip: "Rollback `V2_BETA → LEGACY → V2_BETA` preserves the same work/title/text" — i.e., toggling the renderer flag back and forth does not corrupt or lose manuscript data.

Gaps found (not blockers to the mechanism, but not independently confirmable by inspection alone):

- No `wrangler.toml` or other in-repo Cloudflare Pages config exists — the actual Production values of both env vars live only in the Cloudflare Pages dashboard, which this session cannot access. The rollback *mechanism* is sound; the current *Production configuration* and the existence of a one-click redeploy/rollback path in Cloudflare Pages still need a human to confirm directly in that dashboard.
- The roadmap's existing claim of an "exact PowerShell rollback procedure...recorded in the consolidated QA packet" does not resolve to a dedicated rollback script — `HUMAN_QA_PRE_INTEGRATION.md` only contains a local-dev **start** snippet (setting `NEXT_PUBLIC_TATESPUN_RENDERER='V2_BETA'` before `npm.cmd run dev`) plus the one-line round-trip confirmation quoted above. This is a minor doc-accuracy gap in the existing record, not a new functional risk — flagging it here rather than silently asserting the described script exists.

**Verdict: rollback mechanism READY at the code level (fail-closed, independent flags, no data migration, Human-tested data-preservation round trip). Physical Production rehearsal and Cloudflare dashboard config confirmation remain open — folded into the minimal checklist below.**

### Minimal remaining RC checklist

Everything else Human-QA-pending in §2/§4 is now closed above. Only four items are genuinely unconfirmed. For each: do the step, compare to the expected result, record PASS/FAIL.

| # | What to do | Expected result | PASS/FAIL |
| --- | --- | --- | --- |
| 1 | Open `/demo` on a mobile-width viewport and on desktop; walk through the Demo steps including STEP 8 (Editor Page split/join guidance). | Global Header stays visible in both normal and Demo mobile compositions; only the center manuscript/Preview surface gets dynamic height; no layout breakage. | |
| 2 | Open the Settings drawer in the Editor, desktop and mobile, and scroll through it. | Settings appear in the approved visual order as one single continuous drawer (not split/tabbed); nothing is out of order or duplicated. | |
| 3 | Open Memo, type an unconfirmed draft, close without confirming, reopen Memo for the same work (including after a page reload). | The draft autosaves and restores; a previously *confirmed* Memo value is protected and not silently overwritten by a stale draft. | |
| 4 | In the Cloudflare Pages dashboard (not code), confirm current Production values of `NEXT_PUBLIC_TATESPUN_RENDERER` and `NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE`, and confirm a redeploy/rollback path exists (e.g. promote a prior deployment, or redeploy with the flags set back to `LEGACY`/`FULL`). | Current Production values are known and recorded; a working rollback path is confirmed to exist and requires no DB/data migration. | |

### Final RC gate decision

**HOLD.** Not RELEASE READY yet — the four items above are unresolved. This is a small, bounded gap: no known regression, no unresolved data-safety issue, no unresolved A/F blocker beyond these four confirmations. Once all four are PASS, re-run this section's decision (do not reopen anything closed in §16/§17 above) and the formal Beta Release authorization gate (§12/§13) becomes the next and only remaining step.

## 18. TSP-RC-HOWTO-RESPONSIVE-VIDEO-001 — HOW TO header fix; guide video BLOCKED (2026-09-15)

**HOW TO sticky header — CLOSED / AUTOMATED PASS, HUMAN VISUAL QA PENDING.** `/howto`'s `.guide-header` was a single flex row (brand + 4-column nav grid) that, at desktop-narrow and every mobile width, let nav labels wrap character-by-character (no `word-break` control) and grew the header tall. Fixed to a hard 2-row structure (`flex-direction: column`, exactly two children) at every width: row 1 = cat icon + brand, row 2 = a single nowrap flex row (`5つの機能 ｜ 便利な小技 10選β版 ｜ FAQ 困ったとき ｜ ヘルプ`, `word-break: keep-all`, `clamp(10.5px, 2.8vw, 13px)` font-size, gap/padding trimmed before the clamp floor). All three `#five-features`/`#tips`/`#faq` hrefs and every body anchor id are unchanged. HOW TO body content/images untouched. Not yet visually confirmed at 320/375/390/430 or desktop-narrow — no browser automation tool is available in-session; do not mark Human PASS until confirmed.

**Self-hosted β guide video — BLOCKED, NOT STARTED.** Required source `D:\TateSpun_assets\source\tatespun-beta-guide-original.mp4` does not exist — `D:\TateSpun_assets` itself is absent from disk. Per instruction, stopped without generating a substitute. No `public/howto/media/tatespun-beta-guide.mp4` or poster was produced by this work.

Found but **not used**: an untracked, unrelated-provenance file already sits at `public/howto/media/publichowtomediatatespun-beta-guide.mp4` (~44.7 MB, mangled filename suggesting a prior interrupted process) inside this worktree — not at the instructed source path, not verified, and not touched. If this is in fact a usable copy of the source video, a human should confirm its provenance/integrity before any agent treats it as the Phase D source.

Next step once a valid source is available: re-run the encode (target ≤20 MiB, hard <25 MiB, H.264/AAC, `faststart`, ~960px max width) to `public/howto/media/tatespun-beta-guide.mp4` + a poster at `public/howto/media/tatespun-beta-guide-poster.webp`, place it directly under the `#five-features` list per the frozen intro copy, and re-run the same Human visual QA pass as the header fix above.

## 19. NEXT PRODUCT TRACK — SpunTales common "support via everyday shopping" affiliate surface

**Recorded 2026-09-15. Roadmap entry only — no implementation.** No affiliate link, button, or tracking code was added by this entry; disposition is **D — POST-BETA / not yet scheduled against the β critical path**, tracked here so it isn't lost, not as a current blocker.

- **Track name:** SpunTales 共通「お買い物で応援」導線.
- **Not a TateSpun-only feature.** Design it as a common spec other SpunTales services can adopt, not something wired one-off into this codebase.
- **Pilot in TateSpun first**; roll out to other SpunTales services only after Human QA on the TateSpun pilot.
- **Re-verify Amazon/楽天's current affiliate program terms, site-registration requirements, and required disclosure copy at actual implementation start** — do not implement against terms remembered from this planning entry.
- **Positioning:** an "everyday shopping supports the operator" surface, not an ebook/product sales link — i.e., general-purpose affiliate links to Amazon/Rakuten's own storefronts, not a TateSpun-authored storefront or book-sales flow.
- **Placement:** footer / bottom-of-page, non-intrusive, by default.
- **Do not** let this become an ad placement that interferes with the writing/export UX — it is explicitly out of the manuscript-to-book critical path.

## 20. TSP-RC-AFFILIATE-FOOTER-001 — HOW TO Amazon/Rakuten pilot: IMPLEMENTED / BLOCKED ON HUMAN INPUT (2026-09-15)

**HOW TO reconfirmed CLOSED / Human PASS** through the header fix (`bd13eb4`) and guide-video work (`c4901ea`, `426e58c`); this entry adds a new, independently-gated bottom section and does not reopen or modify any of that.

**Affiliate footer: IMPLEMENTED (mechanism) / BLOCKED ON HUMAN INPUT (activation).** `/howto`'s bottom "お買い物リンク" section (`resolveAffiliateFooterConfig` in `src/lib/howtoContent.ts`) is config-gated and renders nothing today — neither button, nor any disclosure — because no config exists:

- **Existing Amazon/Rakuten affiliate config found in repo/env/docs: NONE.** Searched `.env.local`, `.env.example`, and the full `src/`/`docs/` tree for any Amazon/Rakuten URL, tag, or generated link snippet before writing any code — zero hits outside this roadmap's own §19 planning note.
- **Formal operator-name conflict found — do not guess.** Amazon's Associates disclosure needs the confirmed legal/registered operator name. `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, and `src/components/legal/LegalArticle.tsx` all consistently say **`caload`**; `/howto`'s own greeting section instead says **`caroad`** (matching the `caroad_main*.png` brand-asset filenames, not necessarily the legal name). This is a real, unresolved discrepancy, not a typo I'm confident enough to silently pick a side on — Amazon's button/disclosure stay hidden until a human confirms which is correct.
- **Rakuten site-registration/compliance evidence: NONE found.** No generated Rakuten link snippet, no program-registration record anywhere in the repo. Rakuten's button stays hidden purely on absent URL config; no separate blocker beyond that was identified, but registration status itself was never confirmed either way.
- **Mechanism:** `NEXT_PUBLIC_AMAZON_AFFILIATE_URL` + `NEXT_PUBLIC_AMAZON_ASSOCIATE_OPERATOR_NAME` (both required for Amazon to render) and `NEXT_PUBLIC_RAKUTEN_AFFILIATE_URL` (alone sufficient for Rakuten) — documented (commented out, no values) in `.env.example`. Each URL is used byte-for-byte verbatim if set; nothing is templated, guessed, or shortened. No secrets required (public affiliate URLs only).
- **Human input required before either button can go live:** (1) confirm `caload` vs `caroad` as the correct Amazon Associates disclosure name; (2) the real Amazon Associates affiliate URL; (3) confirmation Rakuten's affiliate program is actually registered, plus the real Rakuten affiliate URL/snippet. None of these were fabricated or guessed.

## 21. TSP-FRIEND-QA-MOBILE-VISUAL-VIEWPORT-001 — Friend QA consolidation branch, FQ-04 mobile keyboard fix (2026-09-15)

**Built on a clean worktree/branch off Production `master` (`351b3a7`)** — `patch/friend-qa-mobile-2026-09-15` — not on top of this document's own `design/tatespun-typesetting-v2` history. Consolidates two already-approved-but-undeployed commits (cherry-picked, not merged) plus a new local fix:

- `5f79879` FANBOX/OFUSE support links.
- `98969c2` FQ-01 Guide refresh, FQ-02 colon/TCY guidance, FQ-03 `!`/`?`-then-space Writing Check spacing.
- New local commit: FQ-04 mobile keyboard viewport fix (below).

Explicitly **excluded** from this branch: `4894ed3` and `6ed0a54` (stale roadmap-only commits from the same line of work — their prose is superseded by this entry, not imported) and `47d66df` (the held Supabase auth-cascade-delete migration). `47d66df` sits in `98969c2`'s own commit ancestry on `design/tatespun-typesetting-v2` (it was authored in between), but a cherry-pick only replays a commit's own diff — verified the resulting branch has **zero** `.sql`/`supabase`/`migration`/`auth` paths in its diff against `351b3a7`, and `47d66df` is confirmed **not** an ancestor of this branch's `HEAD`.

**PRODUCTION RELEASED 2026-09-15 (TSP-FRIEND-QA-PATCH-RELEASE-001).** Merge commit `5844ff6` (`merge: release friend QA fixes 2026-09-15`) onto `master`, deployed via the existing Cloudflare Pages Git-integration path (auto-build/deploy on push to `master` — no in-repo Cloudflare config exists, confirmed by §17). Production Human PASS: `https://spuntales.net/tatespun/`.

**FQ status — Production (2026-09-15):**

- **FQ-01 (Guide refresh):** IMPLEMENTED / **PRODUCTION PASS**. Automated: `src/lib/friendQaGuide.test.ts` PASS. Live guide content (colon/縦中横 sections) confirmed present at `https://spuntales.net/tatespun/docs/help.md`.
- **FQ-02 (colon / 縦中横 guidance):** IMPLEMENTED / **PRODUCTION PASS**. Automated: `src/lib/v2Bridge/latinOrientationParity.test.ts`, `manuscriptAdapter.test.ts` PASS.
- **FQ-03 (`!`/`?` + space Writing Check spacing):** IMPLEMENTED / **PRODUCTION PASS** (shipped; behavior itself is client-side and was verified via the automated suite against the exact deployed source, not re-exercised in a live browser this session — no browser automation tool available). Automated: `src/lib/writingCheckEngine/rules/punctuation.test.ts` PASS, including the three named quick-regression cases (`本当？次へ` → REVIEW; `「本当？」` → no REVIEW; `本当？　次へ` → no REVIEW).
- **FQ-04 (mobile keyboard shrinks normal-mode textarea):** ~~PRODUCTION PASS / prior local Human PASS~~ — **superseded, see §22.** A later real-device Production check found the shell height did NOT actually follow the keyboard-shrunk visible area despite this line's claim (the `--tsp-visible-vh` custom property was present in the bundle, as stated, but not propagating correctly at runtime on that device — see §22 for the confirmed root cause and fix). Local Human QA (2026-09-15) confirmed: keyboard open/close, practical editor height, multi-line typing, caret movement, textarea scroll, Focus Mode ON/OFF, Settings/Options/Memo recovery, orientation recovery where tested — that local pass stands, only the Production-specific claim above it is retracted.
- **FANBOX/OFUSE:** **PRODUCTION PASS.** Exact URLs (`https://www.fanbox.cc/@caroad`, `https://ofuse.me/caroad`) confirmed live on both `https://spuntales.net/tatespun/` and `.../howto/`.
- **FRIEND QA:** ACTIVE.
- **PUBLIC BETA:** NOT YET.
- **Amazon/Rakuten affiliate footer:** POST-BETA (reconfirms §19/§20 — unchanged, still blocked on human input; confirmed hidden/absent from the deployed `/howto` HTML).
- **Legacy manuscript-loss investigation:** OPEN, separate track (reconfirms §16's framing — not touched here).

**Data safety:** no SQL/migration file in the release diff; `47d66df` confirmed not an ancestor of the merge commit or of `master`'s new tip; no Supabase/Auth/DB mutation performed or deployed.

### FQ-04 — root cause and fix

**Root cause:** `src/components/TategakiEditor.tsx`'s editor-shell root (`[data-editor-shell]`) is pinned to `h-[100dvh]` on mobile (mirrored by a `globals.css` rule locking `html`/`body` to `100dvh` on the same route). `100dvh` does not reliably shrink to the actually-visible area when the on-screen keyboard opens (behavior is inconsistent across iOS Safari/Android Chrome/etc.) — normal-mode Friend QA reported the manuscript textarea becoming impractically small once the keyboard was up, with no existing `visualViewport`/keyboard-aware handling anywhere in the Editor (confirmed by inspection: zero prior `visualViewport` usage in `src/`).

**Fix — new `useMobileKeyboardViewport` hook** (`src/hooks/useMobileKeyboardViewport.ts`), mobile-only (same `(max-width: 767px)` gate as the existing `useIsNarrowViewport`):

- Tracks `window.visualViewport.height`, exposed to `TategakiEditor` as a `--tsp-visible-vh` CSS custom property (inline style on the shell) plus a `keyboardActive` heuristic.
- A new mobile-only `globals.css` rule sizes `[data-editor-shell]` from `var(--tsp-visible-vh, 100dvh)` — falls back to the untouched `100dvh` when the property is unset. Desktop (`md:h-screen`) is a separate Tailwind class, never touched.
- While `keyboardActive`, `EditorPane` temporarily folds away the bottom footer chrome (syntax help, writing-check bar, work counter — both its expanded and one-line-collapsed forms) to free height for the textarea. This is pure derived state — never persisted, clears the instant `keyboardActive` goes false again.
- Deliberately **left unchanged**: the settings/options/memo/help row and the primary action row (undo/redo/page-break/replace/report) — several existing regression tests (`postBlockerUx.test.ts`, `rcPolishRound5.test.ts`, `rcPolishRound6.test.ts`, `reportRestoration.test.ts`) pin an exact literal string on that row's wrapper as a slicing anchor; reworking it to also hide on `keyboardActive` broke 11 of those tests on first attempt, so the row was left exactly as-is and only the footer chrome (confirmed compatible with those same tests' prefix-only assertions) was made to fold away instead.
- Focus Mode is untouched: `keyboardActive` and `focusMode` are independent booleans that both gate the same footer elements (either hides them), so entering/exiting Focus Mode behaves exactly as before regardless of keyboard state.

**Automated QA:** new `src/hooks/useMobileKeyboardViewport.test.ts` (7 tests) covers the pure, DOM-injectable `subscribeToKeyboardViewport` core — unavailable-API fallback, initial read, keyboard-sized shrink detection, sub-threshold browser-chrome change (not flagged as keyboard), restore-on-close, a resize sequence resembling rotation, and listener cleanup on unsubscribe — against a stub window-like object, matching this repo's existing convention of DOM-less hook/component tests (`environment: "node"` in every `vitest.config.ts` under `src/hooks`, `src/components`, etc. — no jsdom, hooks are never rendered). The `useIsNarrowViewport` mobile gate itself (a three-line early return) is exercised by code inspection and Human QA on desktop widths, not by an automated hook-render test, consistent with the rest of this hooks directory (`useMobileFocusMode`, `useEditorFooterCollapsed`, etc. also have no render-level tests).

Full suite re-run on this branch after the fix: `src/hooks` (18/18), `src/components` (19/19), `src/lib` (339/339, includes FQ-01/02/03 above), `src/lib/v2Bridge` (71/71 + 1 pre-existing skip). TypeScript (`tsc --noEmit`) and ESLint on every changed file are clean, modulo two items confirmed **pre-existing on the unmodified base branch** (verified via a temporary stash-and-recheck, not left in the committed diff): `src/app/layout.tsx`'s `LayoutProps` TS error (missing generated Next.js route types — needs a build/dev run to generate, unrelated to this change) and two `react-hooks/set-state-in-effect` errors in `TategakiEditor.tsx`'s existing document-load/autosave effects (lines ~366/550, untouched by this fix).

At initial implementation, `npm run build` failed its `prebuild` Supabase check for lack of `NEXT_PUBLIC_SUPABASE_URL` in this fresh worktree. At release time, an already-authorized local `.env.local` (reused byte-for-byte from the `tatespun-release-friend-beta-2026-09-15` worktree, matching this same production lineage — never printed or committed) was copied in, and `npm run build:basepath` then ran the real gate end to end: Supabase project-ref verification PASS, cutover audit PASS (backend ref unchanged, no cross-database mutation), TypeScript PASS, static export PASS (10 prerendered routes), `/tatespun` basePath rewrite PASS.

**Human QA: PASS** (2026-09-15) — see the FQ-04 status line above for the confirmed scenario list.

**Release record (TSP-FRIEND-QA-PATCH-RELEASE-001, 2026-09-15):** branch pushed to `origin/patch/friend-qa-mobile-2026-09-15` (remote HEAD confirmed matching local); merged into `master` with an explicit merge commit `5844ff6` from an isolated temporary worktree (local `master` was already checked out elsewhere, so a disposable tracking branch was used and pushed to `master` via refspec rather than disturbing that other checkout); `origin/master` re-verified unchanged at the recorded rollback point (`351b3a7`) immediately before both the branch push and the master push. Cloudflare Pages picked up the `master` push automatically; Production smoke (below) confirmed the new content live within the same session.

**NEXT:** Continue Friend QA observation on this shipped patch (FQ-01–04, FANBOX/OFUSE) for any new reports. This release does not resolve or reopen §17's still-outstanding formal-Beta-Release RC checklist (4 items: `/demo` walkthrough, Settings drawer order, Memo draft-protection round trip, Cloudflare dashboard rollback confirmation) — that checklist remains the single actual gate standing between Friend QA and Public Beta authorization.

## 22. TSP-FQ04-SHELL-VISIBLE-HEIGHT-FIX-006 — FQ-04 Production re-fix (2026-09-15)

**FQ-04 status: ~~PRODUCTION PASS~~ → ROOT CAUSE CONFIRMED / FIX DEPLOYED / PRODUCTION HUMAN QA PENDING.** §21's "Production bundle confirmed to contain the fix" claim was correct about the bundle but wrong about the runtime result — a later real-device Production check (`?viewportDebug=1`, gated diagnostic panel added on `de4b7b9`) proved the shell did not actually shrink with the keyboard. The fix below is now live in Production; do not mark FQ-04 PASS until a real-device Human re-check confirms it.

**Diagnostic evidence (Production, real device):**

| | Keyboard CLOSED | Keyboard OPEN |
|---|---|---|
| `visualViewport.height` | ≈ 801.5 | 434.7 |
| `keyboardActive` | false | **true** (correct) |
| hook `visibleHeight` | ≈ 801.5 | **434.7** (correct) |
| `--tsp-visible-vh` (computed) | ≈ 801.5 | **801.5238** (wrong — stuck) |
| shell computed height | ≈ 801.5 | **801.524px** (wrong — stuck) |

**Root cause (confirmed by code trace, not just the numbers above):** the shell received `visibleHeight` only indirectly — `useMobileKeyboardViewport` wrote a `--tsp-visible-vh` CSS custom property via `TategakiEditor`'s inline `style`, consumed by a separate `[data-editor-shell] { height: var(--tsp-visible-vh, 100dvh) }` rule in `globals.css` under `@media (max-width: 767px)`. Grepped the entire codebase: that inline style is the **only** place this property was ever set, and that rule is the **only** consumer — no competing selector, no `!important`, no `@property` registration (so it isn't transition-animatable either), no duplicate `[data-editor-shell]` rule anywhere. With every cascade/duplication/staleness explanation ruled out, and the hook's own React state proven correct in the same snapshot (`visibleHeight`/`keyboardActive` both right), the indirection layer itself — a JS-driven custom property round-tripped through an external stylesheet's `var()` lookup — is the boundary that failed to propagate on the affected device.

**Fix:** `mobileShellHeightStyle(visibleHeight)` (`src/hooks/useMobileKeyboardViewport.ts`) returns a plain `{ height: "…px" }` (or `{ height: undefined }`) object; `TategakiEditor`'s shell now uses that directly as its `style` prop instead of the custom property. A directly-set inline `height` always wins over the `h-[100dvh]`/`md:h-screen` Tailwind classes with zero cascade ambiguity, and there's no separate stylesheet rule left to trace or for a future change to silently break. The now-dead `[data-editor-shell] { height: var(...) }` rule was removed from `globals.css`; the unrelated `html`/`body` viewport-lock rule in the same `@media` block is untouched. `ViewportDebugPanel`'s "computed cssVar" diagnostic line now reads the shell's own raw `style.height` (what React actually wrote) instead of the removed custom property, so a future re-check of this fix isn't reading a field that no longer exists — same diagnostic, still gated behind `?viewportDebug=1`, kept intact per this loop's own instruction not to remove it yet.

Untouched, as required: `visualViewport` shrink threshold, `keyboardActive` detection logic, Focus Mode semantics, manuscript/source handling, DB/Auth/Supabase, and the held migration `47d66df`.

**Automated QA:** 4 new focused cases for `mobileShellHeightStyle` (keyboard open, keyboard closed — a real, non-null height either way, not just "keyboard open" — desktop/unsupported-browser null fallback, and a `0`-height edge case guarding against a truthiness bug) added to the existing DOM-free `useMobileKeyboardViewport.test.ts`. Full re-run: `src/hooks` 11/11 PASS, `src/components` 19/19 PASS. `next build` succeeds (TypeScript clean as part of the build — the standalone `tsc --noEmit` run separately hit the same pre-existing, unrelated `LayoutProps` gap §21 already documented, which a build resolves by generating `.next/types`). ESLint on every changed file: clean except the same two pre-existing `react-hooks/set-state-in-effect` errors §21 already documented in `TategakiEditor.tsx`'s unmodified document-load/autosave effects — confirmed outside this change's diff. `npm run build:basepath`'s export step hit a Dropbox file-lock `EBUSY`/`EPERM` on rename in this local worktree (retried once, same result) — an environment issue with this specific synced folder, not a code/type problem; the plain `next build` it wraps already passed cleanly.

**Preserved, unchanged by this entry:**

- **FRIEND QA:** ACTIVE (§21).
- **PUBLIC BETA:** NOT YET (§21) — this fix does not itself authorize Beta; §17's 4-item RC checklist is still the actual gate.
- **72h cloud-image audit gap:** OPEN, still tracked at §12/§13/§17.
- **Legacy manuscript-loss investigation:** OPEN, separate track (§16's framing, reconfirmed again here — not touched by this fix).

**Release record (TSP-FQ04-SHELL-HEIGHT-FIX-DEPLOY-007, 2026-09-15):** a real end-to-end `npm run build:basepath` PASS was obtained (Supabase verification, cutover audit, TypeScript, static export, basePath rewrite all PASS) by re-running the build in a temporary worktree outside this Dropbox-synced folder tree (`D:/tsp-fq04-shell-height-build-2026-09-15`, removed after verification) — the in-place worktree hit the same known Dropbox `EBUSY`/`EPERM` rename lock §21 already documents; source was not altered to work around it. Branch pushed to `origin/fix/tsp-fq04-shell-height-2026-09-15`; merged into `master` with an explicit merge commit `2fafcf3` (`merge: fix mobile keyboard editor height`) from an isolated temporary worktree, `origin/master` re-verified unchanged at `de4b7b9` immediately before both pushes. Cloudflare Pages auto-deployed the `master` push; Production smoke (this session) confirmed: the deployed `/editor` bundle contains `style:{height:null!=Y?...}` (the direct inline fix) with zero remaining occurrences of `tsp-visible-vh`; the `?viewportDebug=1` diagnostic panel's mount gate is still present and intact; FANBOX/OFUSE and HOW TO remain unaffected.

**NEXT (single action):** ~~Human repeats the exact same real-device diagnostic...~~ **superseded — see §23. That re-check happened, and found a new divergence; do not re-run the old comparison, use §23's improved diagnostic instead.**

## 23. TSP-FQ04-VIEWPORT-STATE-DIVERGENCE-008 — new state-divergence evidence; §22's root cause superseded (2026-09-15)

**FQ-04 status: PRODUCTION HUMAN FAIL / OPEN** (unchanged classification from §21/§22 — this section does not close anything, it narrows what's still wrong).

**New Production evidence (real device, keyboard OPEN), via §22's own diagnostic panel:**

| Field | Value |
| --- | --- |
| `innerHeight` | 801 |
| `visualViewport.height` | 434.7 |
| `isNarrow` (panel's own instance) | true |
| `keyboardActive` (panel's own instance) | true |
| hook `visibleHeight` (panel's own instance) | 434.7 |
| shell inline `style.height` (actual DOM) | 801.524px |
| shell computed height | 801.524px |

**§22's root cause claim is superseded / incomplete.** §22 concluded the failure was the `--tsp-visible-vh` CSS custom-property indirection not propagating, and replaced it with a direct inline `height` style (`mobileShellHeightStyle`) — that fix **is** deployed and **is** the only place the shell's height is set (confirmed again by source read this session). But the evidence above shows the shell's *actual rendered inline style* still pinned at the pre-keyboard value (801.5) at the same moment the diagnostic panel's own reading was already correct (434.7) — i.e. no CSS is involved at all this time (the panel reads the raw `style.height` attribute, not a computed/cascaded value), yet the two numbers still disagree. §22's fix was necessary but evidently not sufficient to explain everything observed.

**Source-level investigation (this session, `origin/master` @ `269e3ab`):**

- **Hook instance count on the Editor page: two, independently subscribed.** `TategakiEditor` calls `useMobileKeyboardViewport()` once (line ~161) and passes its `visibleHeight` straight into `mobileShellHeightStyle` for the shell's `style` prop. `ViewportDebugPanel` — a child of `TategakiEditor`, mounted only under `?viewportDebug=1` — called `useMobileKeyboardViewport()` (and `useIsNarrowViewport()`) **again, independently**, with its own `useState`/`useEffect`/`visualViewport.addEventListener("resize", ...)` subscription, entirely separate from the parent's.
- **No bug found in the hook itself or in `TategakiEditor`'s usage of it:** `subscribeToKeyboardViewport`'s state init, resize handler, dependency array (`[isNarrow]`), narrow gating, and masked return (`isNarrow ? state : INACTIVE`) are all correct by inspection, and match the existing passing unit tests exactly. No variable shadowing, no stale closure, no duplicate `[data-editor-shell]` render site, no memoization wrapper around `TategakiEditor` or its hook call.
- **State-flow diagram (as of this session, before the fix below):**
  ```
  window.visualViewport
    ├─→ TategakiEditor's OWN useMobileKeyboardViewport() instance
    │     → its own useState → its own visibleHeight
    │     → mobileShellHeightStyle(visibleHeight) → shell style.height   [observed: 801.5, stale]
    └─→ ViewportDebugPanel's OWN, SEPARATE useMobileKeyboardViewport() instance
          → its own useState → its own visibleHeight                     [observed: 434.7, fresh]
          → displayed directly in the panel
  ```
  **First point of divergence:** the fork itself — two independent hook instances subscribing to the same browser event target, each with its own React state. Because they are separate instances, there is no code-level guarantee they ever hold the same value at the same moment; the evidence shows they didn't. *Why* the parent's instance specifically stayed stale (a missed/lost event, a delayed commit, or something else) is **not yet proven** — only that the fork is real and is the reason the panel could ever show a value TategakiEditor itself wasn't using.
- **Root cause: NOT YET fully confirmed.** The two-instance fork is confirmed as a real, structural fact (not a guess), and is sufficient to explain how the panel could disagree with the shell. Whether the parent instance's own resize listener specifically missed the event, fired late, or was delayed by a slow re-render of the (large, expensive) `TategakiEditor` subtree remains unconfirmed — no runtime access from this environment, and no proof either way was found in source alone.

**Fix policy applied:** per this loop's own instruction, no product-behavior fix was implemented without deterministic proof. What *is* fully justified by source inspection alone, with zero ambiguity, is removing the redundant second hook instance: **`ViewportDebugPanel` no longer calls `useMobileKeyboardViewport()`/`useIsNarrowViewport()` itself.** It now receives `isNarrow`, `keyboardActive`, and `visibleHeight` as props from `TategakiEditor`'s own single instance, labeled `parent hook ...` in the display. This is observational-only: it does not change `mobileShellHeightStyle`, the hook's detection/threshold logic, Focus Mode, or any rendered layout — it only guarantees that from now on there is **exactly one** `useMobileKeyboardViewport` call for the whole Editor page, so the diagnostic can never again show a value the shell itself didn't use. No new viewport hook, no polling, no hardcoded keyboard height, no Focus Mode change, no body resize, no manuscript/DB/Auth/Supabase change, `47d66df` untouched.

**Files changed:** `src/components/TategakiEditor.tsx` (adds one `useIsNarrowViewport()` call, purely to hand down as a prop; passes `isNarrow`/`keyboardActive`/`visibleHeight` to the panel), `src/components/ViewportDebugPanel.tsx` (drops its own two hook calls, accepts them as props instead, relabels the three display lines `parent hook ...`).

**Tests/build:** `src/hooks` 11/11 PASS (unchanged — hook logic itself was not touched), `src/components` 19/19 PASS. TypeScript and ESLint on both changed files clean (same two pre-existing, unrelated `TategakiEditor.tsx` findings §21/§22 already document, confirmed outside this diff). `npm run build:basepath` — full PASS this time (Supabase verification, cutover audit, TypeScript, static export, basePath rewrite), no Dropbox lock this run.

**Preserved, unchanged:** FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. No old local docs commits (`6f6d153`, `b4da3ba`) touched or pushed.

**Release record (TSP-FQ04-SINGLE-HOOK-DIAGNOSTIC-DEPLOY-009, 2026-09-15):** `npm run build:basepath` full PASS (no Dropbox lock this run). Branch pushed to `origin/diag/fq04-state-divergence-2026-09-15`; merged into `master` with an explicit merge commit `403e0b0` (`merge: unify FQ04 viewport diagnostics with editor state`) from an isolated temporary worktree, `origin/master` re-verified unchanged at `269e3ab` immediately before both pushes. Cloudflare Pages auto-deployed; Production smoke (this session) confirmed the exact prop-based wiring is live: the shell's `style:{height:null!=J?...}` (unchanged fix) and the panel's `d&&(0,r.jsx)(nY,{isNarrow:ee,keyboardActive:Q,visibleHeight:J})` both reference the **same** minified variables (`J`, `Q`) -- i.e. one shared source, confirmed in the actual deployed bundle, not just by source inspection. Panel component itself (`function nY({isNarrow,keyboardActive,visibleHeight})`) confirmed to take these as parameters only, no internal hook call. FANBOX/OFUSE reconfirmed unaffected.

**NEXT (single action):** ~~Human repeats the same real-device Production check...~~ **superseded — see §24. That re-check happened and produced a new, harder contradiction; do not re-run this old comparison, use §24's DOM-instance-scoped diagnostic instead.**

## 24. TSP-FQ04-DOM-INSTANCE-DIAGNOSTIC-010 — instance-scoped diagnostic; multi-instance measurement possibility ruled out by design (2026-09-15)

**FQ-04 status: PRODUCTION HUMAN QA FAIL / INVESTIGATING** (unchanged classification — this section narrows the mystery further, does not close it).

**New Production evidence (real device, keyboard OPEN), via §23's single-hook diagnostic:** `raw vv.height` = 434.7, `parent hook visibleHeight` = 434.7 (now provably TategakiEditor's own value, per §23), `parent keyboardActive` = true — **but** the shell's measured inline height was still 801.524px. This is a harder contradiction than §22/§23: with §23's fix, `visibleHeight` in the SAME render that produces this display value is *literally the same variable* used for `style={mobileShellHeightStyle(visibleHeight)}` — a same-render mismatch between a value and its own use in one JSX return should be impossible in React, unless the *measurement* itself was reading a different DOM element than the one React actually updated.

**Key insight applied:** a single hook CALL SITE (confirmed in §23) does not prove a single runtime DOM INSTANCE. §23's diagnostic still measured the shell via `document.querySelector('[data-editor-shell]')` and the textarea via a global `document.querySelector('[data-demo-target="editor"]')` — both unscoped lookups that would silently read a *different* mounted/hidden instance if one ever existed, rather than the one this specific render actually touched.

**Audit of runtime instance possibility (source-level, `origin/master` @ `e4a12bf`):** exactly one `<TategakiEditor>` JSX usage exists anywhere under `src/app` (`src/app/editor/page.tsx`, wrapped in one `<Suspense>` that Next.js renders as fallback-XOR-children, never both); exactly one `data-editor-shell` JSX render site exists anywhere in `src/` (`TategakiEditor.tsx`, one unconditional top-level return, not behind any loading/conditional branch). The editor's own textarea surface *is* legitimately one-of-four mutually exclusive branches (`EditorPane`'s plain textarea / `PagedEditor` windowed / `DiagnosticShadowEditor` / `WindowedEditorProbe`, gated by `probeMode`/`isWindowed`), but only one renders per `EditorPane` instance, and the perf-debug-only branches require a separate `?perfDebug=1` opt-in not present in this test. **No source-level evidence supports more than one live instance** — but this diagnostic loop's own instruction is correct that this cannot be *assumed* from a grep count, only proven (or disproven) empirically on the real device.

**Diagnostic targeting fix (observational-only, no product behavior change):**

- `ViewportDebugPanel` now takes a `panelRef` and measures its shell via `panelRef.current.closest('[data-editor-shell]')` — since the panel is always rendered *inside* the shell it should describe, this is the one measurement guaranteed to be the correct instance, by construction, regardless of how many other shells might exist.
- The textarea lookup is now scoped the same way: `ownShell.querySelector('[data-demo-target="editor"]')`, never a global query.
- The panel now also displays, for direct comparison: total `[data-editor-shell]` count in the document, total matching-textarea count, a runtime-only `useId()`-derived `shellInstanceId` (TategakiEditor generates one per mount, written only as a `data-shell-instance-id` attribute — never persisted, never sent anywhere) compared three ways (the value TategakiEditor rendered with this render, the one found via `closest()`, and the one found via the old global `querySelector`), and the OLD global-selector's own height readings kept alongside the new scoped ones — so a real multi-instance situation would show up as a visible mismatch (highlighted in the panel) instead of silently mis-measuring.
- `TategakiEditor` computes `mobileShellHeightStyle(visibleHeight)` exactly once per render into `mobileShellStyle`, and reuses that *same object* for both the shell's own `style` prop and a new `expectedShellHeight={mobileShellStyle.height ?? "(unset)"}` prop into the panel — removing any possibility of the displayed "expected" value drifting from what was actually applied by a transcription error.

**Interpretation guide for the next real-device check** (as specified by this loop, unchanged): Case A (own-shell inline/computed both ≈435, matching `parent visibleHeight`) means propagation is actually correct and the remaining problem is layout/UX, not state; Case B (own-shell inline stuck ≈801 despite everything upstream reading ≈435) proves a genuine DOM-mutation/render-application problem; Case C (`[data-editor-shell]` count >1, or own-shell id ≠ global-selector id) proves the *previous* 801px readings were cross-instance-contaminated and therefore not authoritative; Case D (`expected shell style` itself ≈801 despite `parent visibleHeight` ≈435) would mean the helper/value path itself has a bug distinct from anything found so far. **No product fix implemented in this task, per instruction — root cause is still not confirmed**, this loop only removes the remaining measurement ambiguity.

**Files changed:** `src/components/TategakiEditor.tsx` (`useId()` for a per-mount `shellInstanceId`, written as `data-shell-instance-id`; `mobileShellStyle` hoisted to a single local so shell `style` and the panel's `expectedShellHeight` share one value), `src/components/ViewportDebugPanel.tsx` (adds a `panelRef`, switches shell/textarea measurement from global `document.querySelector` to `panelRef.current.closest(...)`-scoped, adds document-wide shell/textarea counts and the three-way instance-id comparison, keeps the old global-selector reading alongside for direct comparison).

**Tests/build:** `src/hooks` 11/11 PASS (unchanged), `src/components` 19/19 PASS, `src/lib` 339/339 PASS (incl. `demoPlacement.test.ts`'s `globals.css`/`[data-editor-shell]` assertions, unaffected by the new sibling attribute). TypeScript and ESLint clean on both changed files (same two pre-existing, unrelated `TategakiEditor.tsx` findings §21–23 already document). `npm run build:basepath` hit the same known Dropbox `EPERM` rename lock in this worktree on the first attempt; re-verified in a separate temporary worktree outside this Dropbox-synced folder tree, full PASS there (same pattern as §22's release record).

**Preserved, unchanged:** FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. No old local docs commits (`6f6d153`, `b4da3ba`) touched or pushed; `47d66df` untouched.

**Release record (TSP-FQ04-DOM-INSTANCE-DIAGNOSTIC-DEPLOY-011, 2026-09-15):** full `npm run build:basepath` PASS in-place this run (no Dropbox lock). Branch pushed to `origin/diag/fq04-dom-instance-2026-09-15`; merged into `master` with an explicit merge commit `2357636` (`merge: scope FQ04 viewport diagnostics to active editor shell`) from an isolated temporary worktree, `origin/master` re-verified unchanged at `e4a12bf` immediately before both pushes. Cloudflare Pages auto-deployed; Production smoke (this session) confirmed the exact scoped wiring is live: `n=e?.closest("[data-editor-shell]")??null` (own-shell) and `n?.querySelector('[dat...` (textarea scoped within that same shell), `"data-editor-shell":!0,"data-shell-instance-id":et` (the per-mount ID written on the shell), and `expectedShellHeight:a` (the shared same-render value) all present in the deployed bundle, not just source. FANBOX/OFUSE reconfirmed unaffected.

**NEXT (single action):** ~~Human repeats the same real-device Production check...~~ **superseded — see §25. That re-check happened: Case B confirmed. Use §25's MutationObserver-based diagnostic for the next round, not this one.**

## 25. TSP-FQ04-INLINE-HEIGHT-MUTATION-FORENSIC-012 — Case B confirmed; effect-ordering hypothesis; MutationObserver instrumentation added (2026-09-15)

**FQ-04 status: PRODUCTION HUMAN QA FAIL / CASE B CONFIRMED** (unchanged overall classification — this section narrows further, does not close anything).

**Confirmed by §24's diagnostic, real device, keyboard OPEN:** `visualViewport.height` = 434.7, `parent hook visibleHeight` = 434.7, `expected shell style` (same render as the above) = 434.666...px, `[data-editor-shell]` count = 1, parent/closest/global shell instance IDs all identical — **but** `own-shell inline style.height` = 801.524px and `own-shell computed height` = 801.524px. Keyboard CLOSED: `visibleHeight`/`expected` ≈801.5, `actual inline height` = "(unset)", computed ≈801.5 via the `h-[100dvh]` CSS class fallback.

**Ruled out by this same evidence** (per §24's own Case classification): wrong shell instance, duplicate `TategakiEditor` instance, an independent diagnostic hook, CSS custom-property propagation, CSS cascade overriding an inline value, `visualViewport`/`keyboardActive` detection failure. This is Case B: `expectedShellHeight` and the parent hook's own `visibleHeight` are correct and mutually consistent from the SAME render, yet the shell's actual DOM inline height does not match.

**Source write audit (`origin/master` @ `e7e7aa5`; searched for `.style.height =`, `style.setProperty`, `setAttribute("style"`, `.cssText`, `ResizeObserver`, `data-editor-shell`, `window.innerHeight`):**

- `.style.height`/`style.setProperty`/`.cssText` hits: `HelpModal.tsx` (sets `document.body`'s `overflow`, unrelated element), `PagedEditor.tsx:194` (`mirror.style.height = "0px"` on an offscreen text-measurement helper element, unrelated to `[data-editor-shell]`), `exportCapture.ts` (a `scaleRoot` transform used only during PDF/JPG export capture, unrelated). **No code path writes to the editor shell's `style` outside `TategakiEditor`'s own `style={mobileShellStyle}` JSX prop.**
- `ResizeObserver` usage: `Bookshelf.tsx`, `PreviewPane.tsx`, `WritingCheckOverlay.tsx` — none observe `[data-editor-shell]` or any ancestor/descendant relevant to it.
- `data-editor-shell` is referenced in exactly two files: `TategakiEditor.tsx` (the one render site) and `ViewportDebugPanel.tsx` (read-only queries). No wrapper/clone/spread composes a second `style` prop onto the shell; `mobileShellHeightStyle` is a pure function with no external mutation of its return value.
- `window.innerHeight` usage confined to `useMobileKeyboardViewport.ts`/its test, `ViewportDebugPanel.tsx`, and an unrelated `feedbackEnvironment.ts` (device/browser info string for the beta feedback report, does not touch layout).

**No second writer found in source.** Given a same-render value (`expectedShellHeight`) is provably correct and consistent with the parent hook, and no other code path can write to the shell's style, the contradiction must be either a genuine React/browser anomaly or -- the leading hypothesis below -- an artifact of how the *diagnostic itself* measures, not of what `TategakiEditor` actually rendered.

**Leading hypothesis (source-derived, not yet empirically confirmed): a one-event-stale diagnostic read caused by React's own effect-ordering guarantee.** `ViewportDebugPanel` is rendered as a plain child of `TategakiEditor` (confirmed: no `createPortal` anywhere in either file). React fires child effects before parent effects on mount. Both `ViewportDebugPanel`'s own `update()` listener and `TategakiEditor`'s `useMobileKeyboardViewport` hook's internal listener are registered via `visualViewport.addEventListener("resize", ...)` -- since the child's effect (and therefore its `addEventListener` call) runs first, its callback is *invoked first* whenever `visualViewport` dispatches a single "resize" event. That means: when the keyboard's resize event fires, `ViewportDebugPanel.measure()` reads the shell's DOM (`own-shell inline style.height`) **before** `TategakiEditor`'s own listener has run `measure()` → `setState` → re-render → commit for that same event -- i.e. the panel's own state-driven snapshot is captured one full event cycle behind the props it displays alongside it (which are always fresh, since props reflect the parent's latest completed render). If no further qualifying event (`resize`/`scroll`/`focusin`/`focusout`) fires after the keyboard settles -- a very plausible real-world sequence, since a human takes the screenshot right after the keyboard finishes animating -- this stale snapshot persists indefinitely, looking exactly like a permanently "stuck" shell height even though `TategakiEditor` actually committed the correct value.

**React commit path audit:** `mobileShellStyle` is a local `const`, never mutated after creation; `mobileShellHeightStyle` is a pure function with no captured/mutable state; no effect anywhere writes a stale value back into `visibleHeight` or `mobileShellStyle`; no ref callback touches the shell's style; `window.innerHeight` is read only inside `subscribeToKeyboardViewport`'s own `measure()` (part of the already-audited, unchanged hook) and does not race with `visualViewport` state -- both are read together, synchronously, in the same `measure()` call. React Strict Mode double-invocation is dev-only and does not apply to this Production build. No evidence of a genuine "second render commits 801 after 434" (Case C in this loop's own framing) was found in source; the effect-ordering explanation above does not require one.

**Diagnostic instrumentation added (observational-only, no product behavior change):** a `MutationObserver` on the panel's own `closest()`-scoped shell, watching only the `style` attribute (`attributeFilter: ["style"]`, `attributeOldValue: true`). Its callback fires as a direct reaction to the actual DOM mutation -- independent of any other listener's registration order on `visualViewport`/`window` -- so it (a) directly tests whether the shell ever receives more than one style write per keyboard transition (confirming or refuting the hypothesis above), and (b) as a side effect, keeps the panel's `own-shell inline style.height`/`computed height` state accurate immediately after any mutation, rather than waiting for the panel's own next resize/scroll/focus event. Each mutation is logged (bounded to the last 10) with a `performance.now()` timestamp, the previous and new `style` attribute strings, and the `visibleHeight`/`expectedShellHeight`/`visualViewport.height`/`keyboardActive` values *at the moment the mutation was observed* (via a ref updated in a no-deps effect after every render, per the `react-hooks/refs` lint rule -- never read or written during the render body itself). A dedicated render-sequence-counter feature originally planned for this loop was dropped: it cannot be implemented without violating that same rule (reading or writing a ref during render), and the mutation log's own per-entry `visibleHeight`/`expectedShellHeight` pairing already serves the same correlation purpose, tied directly to actual DOM mutations rather than an abstract render count.

**Files changed:** `src/components/ViewportDebugPanel.tsx` only (`TategakiEditor.tsx` ends up unchanged from `e7e7aa5` after the render-counter feature was added then reverted for the lint violation above).

**Tests/build:** `src/hooks` 11/11 PASS (unchanged), `src/components` 19/19 PASS, `src/lib` 339/339 PASS. TypeScript clean; ESLint clean on `ViewportDebugPanel.tsx` (same two pre-existing, unrelated `TategakiEditor.tsx` findings §21–24 already document; the new `react-hooks/refs` violations from the render-counter attempt were fixed by moving both ref writes into no-deps effects and then, since reading a ref during render is *also* disallowed by that rule, dropping the render-counter prop entirely rather than fighting the linter for a redundant feature). `npm run build:basepath`: full PASS, no Dropbox lock this run.

**Preserved, unchanged:** FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. No old local docs commits (`6f6d153`, `b4da3ba`) touched; `47d66df` untouched. No product-behavior change -- per this loop's explicit instruction, no fix is implemented until the writer/race is identified; this section only adds instrumentation.

**Release record (TSP-FQ04-MUTATION-DIAGNOSTIC-DEPLOY-013, 2026-09-15):** full `npm run build:basepath` PASS in-place this run (no Dropbox lock). Branch pushed to `origin/diag/fq04-inline-mutation-2026-09-15`; merged into `master` with an explicit merge commit `d0223e7` (`merge: trace FQ04 shell style mutations`) from an isolated temporary worktree, `origin/master` re-verified unchanged at `e7e7aa5` immediately before both pushes. Cloudflare Pages auto-deployed; Production smoke (this session) confirmed the exact `MutationObserver` wiring is live: `t.observe(e,{attributes:!0,attributeFilter:["style"],attributeOldValue:!0})`, the callback's `"attributes"!==r.type||"style"!==r.a...` filter, and the bounded 10-entry log (`slice(-9`) all present in the deployed bundle -- confirmed in the *correct* chunk after an initial false-positive match on an unrelated core-js polyfill (`i.MutationObserver||i.WebKitMutationObserver`, part of a microtask-queue shim, coincidentally containing the same class name). The `closest("[data-editor-shell]")` scoping from §24 remains intact. FANBOX/OFUSE reconfirmed unaffected.

**NEXT (single action):** ~~Human repeats the real-device Production check...~~ **superseded — see §26. That re-check happened: viewport propagation is CONFIRMED CORRECT (MutationObserver logged exactly one clean 801.524→434.667 write, matching expected). The real remaining problem, and its fix, are recorded there.**

## 26. TSP-FQ04-KEYBOARD-COMPACT-LAYOUT-014 — viewport propagation confirmed correct; real cause was chrome, not state; compact-layout fix implemented (2026-09-15)

**FQ-04 status: viewport propagation = CONFIRMED PASS. Old 801px discrepancy = DIAGNOSTIC ARTIFACT (§25's effect-ordering hypothesis, now confirmed). Actual remaining failure = normal-mode chrome consumed too much of the correctly-shrunk shell. Compact-layout fix = IMPLEMENTED / PRODUCTION HUMAN QA PENDING.**

**Confirmed by §25's MutationObserver, real device, keyboard OPEN:** `visualViewport.height` = 434.7, parent hook `visibleHeight` = 434.7, `expectedShellHeight` = 434.67, **own-shell inline height = 434.667, own-shell computed height = 434.667** (both now correct — no longer stuck at 801), single shell / all instance IDs identical, and the mutation log recorded **exactly one** clean write: `801.524 → 434.667`. Second writer: **NONE**. This closes §22–25's entire investigation: the shell height mechanism (`mobileShellHeightStyle`, the hook, the listeners) was never broken; every prior "stuck at 801" reading was the diagnostic panel's own one-event-stale measurement, exactly as §25 hypothesized from source alone.

**The actual remaining problem:** with a correctly-sized ~435px shell, the textarea's own measured rect was `top: 334.6, bottom: 425.9, height: 91.3` — i.e. normal-mode chrome above the manuscript claimed ~335px of the ~435px visible shell, the same fixed amount it claims with the keyboard closed against a much taller (~800px) shell, leaving only ~91px for the textarea itself. Not a state bug — a **layout-priority** gap: nothing had ever told the normal-mode chrome to make room once the visible area shrank.

**Chrome height-consumer inspection (`origin/master` @ `6dd0860`):** `TategakiEditor`'s shell renders, in order, above `<main>`/the manuscript section: `[data-editor-header-slot]` (the global branding `Header`, rendered on mobile too — no existing `md:hidden`/`max-md:hidden` on its wrapper), an `isSampleDocument` banner (conditional), an `unresolvedCloudImages` warning banner (conditional), `MobileEditorNav` (sticky, two rows: `← 一覧` + 本文/プレビュー tabs, then save-status + cloud-save button + focus-mode toggle), then `EditorPane` itself, which further stacks: the title `<input>` (`data-demo-target="title"`), the action row (undo/redo/page-break/replace/report, `data-editor-action-row`), and the secondary row (`data-editor-secondary-row`, ▶設定/▶オプション/▶メモ/▶ヘルプ) before the textarea. `Header`'s own escape/save/focus-toggle affordances are already fully duplicated by `MobileEditorNav` on mobile, making `Header` itself the single most obviously redundant block during active typing.

**Compacted (temporarily, `display: none`, CSS-only, mobile-only, keyed off the existing `data-keyboard-active` attribute — no new state, nothing persisted):**

- `[data-editor-header-slot]` — the global branding Header (redundant with `MobileEditorNav` on mobile).
- `[data-editor-secondary-row]` — ▶設定/▶オプション/▶メモ/▶ヘルプ (each opens its own drawer/modal, requiring the keyboard closed anyway; not needed mid-keystroke).
- `[data-demo-target="title"]` — the document title input (title editing isn't part of active body-text typing).

**Intentionally retained, unaffected:** the primary action row (undo/redo/page-break/replace/report — core editing/safety actions), `MobileEditorNav` in full (escape path `← 一覧` + save/status indicator + focus-mode toggle — exactly the "keep visible" set this loop specified), the textarea itself, and manual Focus Mode (which already hides the same two chrome blocks on its own terms via existing, untouched `focusMode`-driven className logic — this new rule simply also applies in normal mode while the keyboard is open, which is the point of the fix).

**Implementation approach — CSS-only, not a className/state change.** A prior FQ-04 attempt (see the original implementation entry, §21) tried to also hide the secondary nav row via a `className` change in `EditorPane.tsx` and broke 11 tests across `postBlockerUx.test.ts`/`rcPolishRound5.test.ts`/`rcPolishRound6.test.ts`/`reportRestoration.test.ts`, which pin several of that file's lines with exact-string assertions used as slicing anchors. This fix deliberately never touches `EditorPane.tsx`'s or `TategakiEditor.tsx`'s className logic at all — it adds one CSS rule to `globals.css`, inside the existing mobile-only `@media (max-width: 767px)` block, targeting the three elements' stable `data-*` attributes:

```css
[data-editor-shell][data-keyboard-active] [data-editor-header-slot],
[data-editor-shell][data-keyboard-active] [data-editor-secondary-row],
[data-editor-shell][data-keyboard-active] [data-demo-target="title"] {
  display: none;
}
```

`display: none` only, on elements whose own React state (open drawers, the footer-collapsed preference, saved title text, etc.) is completely untouched — closing the keyboard simply removes the `data-keyboard-active` attribute (the existing, unmodified `useMobileKeyboardViewport` heuristic already handles that), instantly restoring the exact prior DOM with nothing stale, lost, or re-persisted. Desktop is untouched (the rule lives inside the mobile-only media query, and `data-keyboard-active` is never set outside mobile scope regardless).

**Files changed:** `src/app/globals.css` (the one new rule + a documentation comment), `src/lib/keyboardCompactLayout.test.ts` (new).

**Textarea before/expected after:** before, ~91px within a ~435px shell (measured). After (not yet Human-confirmed on a real device): freeing the Header (~50–90px), the secondary row (~40–48px), and the title input (~36–44px) should free roughly 130–180px, bringing the textarea to roughly 220–270px within the same ~435px shell — comfortably past this loop's ~180px+ target, pending the actual Human visual check.

**Automated QA:** new `src/lib/keyboardCompactLayout.test.ts` (5 tests, source-text assertions against `globals.css`/`TategakiEditor.tsx`/`EditorPane.tsx`, matching this repo's existing `demoPlacement.test.ts` convention — no component is rendered, consistent with every `vitest.config.ts` in this repo running under `environment: "node"`): the rule is scoped inside the mobile-only media block; it targets exactly the three approved selectors and nothing else (not the action row, not the textarea, not `MobileEditorNav`); `EditorPane`'s and `TategakiEditor`'s existing pinned className strings are unchanged; `MobileEditorNav` has no `keyboardActive`-conditional wrapper; the existing `EditorPane` footer keyboard-compaction (from the original FQ-04 fix, §21) remains intact and independent of this new rule. Full regression: `src/lib` 344/344 PASS (incl. `postBlockerUx`, `rcPolishRound5/6`, `reportRestoration`, `demoPlacement` — zero regressions), `src/hooks` 22/22 PASS (unchanged — `useMobileKeyboardViewport.ts` was not touched), `src/components` 19/19 PASS. TypeScript/ESLint clean. `npm run build:basepath`: full PASS; the compiled CSS was inspected directly and contains the exact rule verbatim.

**Untouched, as required:** `useMobileKeyboardViewport` detection, the 150px keyboard threshold, `mobileShellHeightStyle`, the `visualViewport` listeners, body/global viewport sizing, manual Focus Mode semantics, manuscript/source content, DB/Auth/Supabase, `47d66df`. The `?viewportDebug=1` diagnostic panel (including the §25 MutationObserver) is kept deployed and unmodified, per instruction, until Production Human PASS.

**Preserved, unchanged:** FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. No old local docs commits (`6f6d153`, `b4da3ba`) touched or pushed.

**Pre-deploy activation-selector audit (TSP-FQ04-KEYBOARD-COMPACT-DEPLOY-015):** explicitly re-verified `data-keyboard-active={keyboardActive ? "" : undefined}` before release — React omits the attribute entirely when inactive (never renders `="false"`/`="undefined"` as a literal value), so the plain `[data-keyboard-active]` CSS presence-selector was already exactly correct; no selector change was needed. Added one more test (`8297355`) asserting this contract directly against source, so a future switch to string `"true"`/`"false"` values would fail this test before ever reaching Production.

**Release record (2026-09-15/16):** full `npm run build:basepath` PASS in-place (no Dropbox lock). Branch pushed to `origin/fix/fq04-keyboard-compact-layout-2026-09-15`; merged into `master` with an explicit merge commit `ba1412f` (`merge: improve mobile typing space with keyboard compact layout`) from an isolated temporary worktree, `origin/master` re-verified unchanged at `6dd0860` immediately before both pushes. Cloudflare Pages auto-deployed; Production smoke (this session) confirmed the exact compiled rule live: `[data-editor-shell][data-keyboard-active] [data-editor-header-slot],[data-editor-shell][data-keyboard-active] [data-editor-secondary-row],[data-editor-shell][data-keyboard-active] [data-demo-target=title]{display:none}`. The `?viewportDebug=1` diagnostic panel and its MutationObserver instrumentation remain deployed and unmodified, per instruction. FANBOX/OFUSE and HOW TO reconfirmed unaffected.

**FQ-04 status: ~~KEYBOARD COMPACT FIX DEPLOYED / PRODUCTION HUMAN QA PENDING~~ → PRODUCTION HUMAN PASS / CLOSED — see §27.** The real-device Human check this section called for came back PASS; §27 records the final accepted behavior and the resulting diagnostic-instrumentation cleanup.

## 27. TSP-FQ04-DIAGNOSTIC-CLEANUP-016 — Production Human PASS; FQ-04 CLOSED; diagnostic instrumentation removed (2026-09-16)

**FQ-04 status: PRODUCTION HUMAN PASS / CLOSED.** The keyboard-active compact-layout fix (§26, deployed as `ba1412f`) was confirmed on a real device: keyboard closed shows the normal Editor unchanged; keyboard open shrinks the shell to the real visible viewport (`useMobileKeyboardViewport`/`mobileShellHeightStyle`, unchanged throughout this entire investigation) and additionally hides the three approved secondary-chrome blocks (`Header`, the title input, the ▶設定/▶オプション/▶メモ/▶ヘルプ row), giving the manuscript textarea a substantially larger and practically usable writing area; keyboard close restores the normal layout exactly, with Settings/Options/Memo/Help still functioning afterward.

**Final accepted account of the whole FQ-04 investigation (§21–27), for future readers:**

- Viewport propagation itself (`window.visualViewport` tracking, the 150px keyboard-shrink threshold, `mobileShellHeightStyle`'s direct inline `height`) was **confirmed correct** — never broken at any point.
- Every earlier "shell stuck at ~801px while the hook read ~435px" reading (§22's original `--tsp-visible-vh` custom-property theory, then §24/§25's DOM-instance and mutation-write investigations) was ultimately traced to the **diagnostic panel's own one-event-stale measurement** (§25's effect-ordering hypothesis: the panel, as a child of `TategakiEditor`, had its `visualViewport` "resize" listener registered — and therefore invoked — before `TategakiEditor`'s own hook's listener for the same event, reading the shell's DOM one cycle behind the fresh props displayed alongside it). This was empirically confirmed by §26's `MutationObserver` evidence: exactly one clean `801.524 → 434.667` write, matching expected, no second writer.
- The **actual** remaining FQ-04 defect was a layout-priority gap, not a state bug: normal-mode chrome above the manuscript claimed the same fixed vertical space regardless of how much visible area the keyboard left, so a correctly-sized ~435px shell still left the textarea only ~91px. §26's CSS-only, mobile-only, `data-keyboard-active`-scoped compaction of three specific chrome blocks fixed this directly.

**Diagnostic instrumentation removed (this section), now that its job is done:** `ViewportDebugPanel.tsx` (deleted entirely), the `?viewportDebug=1` query-param parsing/forwarding in `src/app/editor/page.tsx`, and the `viewportDebugEnabled` prop, `ViewportDebugPanel` import/mount, `shellInstanceId` (`useId`), and the diagnostic-only `useIsNarrowViewport` call in `TategakiEditor.tsx`. `/editor?viewportDebug=1` now behaves exactly like ordinary `/editor` — confirmed empirically: the compiled Production bundle at the cleanup commit contains zero occurrences of `viewportDebug`/`data-viewport-debug-panel` in any `/editor`-route chunk.

**Explicitly re-verified unchanged (the actual FQ-04 production behavior, not diagnostics):** `useMobileKeyboardViewport` (detection, 150px threshold, `visualViewport` listeners), `mobileShellHeightStyle`, the direct inline shell height, `data-keyboard-active` (still written by `TategakiEditor`, still driving both the shell height and the §26 compact-layout CSS), `EditorPane`'s footer keyboard-active compaction, manual Focus Mode, and desktop layout — none of these were touched by the cleanup. `47d66df` remains untouched throughout.

**Automated QA:** 5 new tests appended to `src/lib/keyboardCompactLayout.test.ts` (now 11 total in that file) proving: no `viewportDebug` reference remains anywhere in source, `ViewportDebugPanel` is neither imported nor exists on disk, no diagnostic-only props/attributes (`shellInstanceId`, `data-shell-instance-id`, `expectedShellHeight`, the diagnostic-only `useIsNarrowViewport`/`useId` calls) remain, and the real FQ-04 production behavior (the hook call, `mobileShellHeightStyle`, `data-keyboard-active`) is intact. Full regression: `src/lib` 350/350 PASS (11 new/updated, the existing 6 compact-layout tests unaffected), `src/hooks` 22/22 PASS (unchanged), `src/components` 19/19 PASS. TypeScript/ESLint clean (the same two pre-existing, unrelated `TategakiEditor.tsx` findings §21–26 already document, confirmed outside this diff). `npm run build:basepath` hit the same known Dropbox `EPERM` rename lock in this worktree; re-verified in a separate temporary worktree outside this Dropbox-synced folder tree, full PASS there — the compiled bundle was inspected directly and confirmed to contain zero diagnostic code while the compact-layout CSS rule remains present verbatim.

**Files changed:** `src/app/editor/page.tsx`, `src/components/TategakiEditor.tsx`, `src/components/ViewportDebugPanel.tsx` (deleted), `src/lib/keyboardCompactLayout.test.ts`.

**Preserved, unchanged:** FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. No old local docs commits (`6f6d153`, `b4da3ba`) touched or pushed. No CLOSED item outside FQ-04 (Typography/Ruby/TCY, HOW TO, V2 migration, Amazon/Rakuten, etc.) reopened.

**Release record (2026-09-16):** full `npm run build:basepath` PASS on the merge commit itself, run in a temporary worktree outside this Dropbox-synced folder tree after both the in-place merge and the in-place build hit the same known Dropbox filesystem lock (this time as `unlink`/`EPERM` on the merge's own file replacement, not just the export step) — source was not altered to work around it. Branch pushed to `origin/cleanup/fq04-viewport-diagnostics-2026-09-16`; merged into `master` with an explicit merge commit `1754ac3` (`merge: remove FQ04 viewport diagnostics after Production Human PASS`), `origin/master` re-verified unchanged at `94b086a` immediately before both pushes. Cloudflare Pages auto-deployed; Production smoke (this session) independently confirmed **zero** occurrences of `viewportDebug`/`ViewportDebugPanel`/`data-viewport-debug-panel` across every current `/editor`-route chunk, while the compact-layout CSS rule (`[data-editor-shell][data-keyboard-active] [data-editor-header-slot],[...] [data-editor-secondary-row],[...] [data-demo-target=title]{display:none}`) remains present verbatim in the live stylesheet. `?viewportDebug=1` now returns HTTP 200 identically to plain `/editor` (no panel, no behavior difference). FANBOX/OFUSE and HOW TO reconfirmed unaffected.

**FQ-04 status: PRODUCTION HUMAN PASS / CLOSED — diagnostic instrumentation confirmed removed from Production.**

**NEXT (single action):** return to the actual Public Beta gate work: §17's remaining 4-item Human RC checklist (`/demo` walkthrough, Settings drawer visual order, app-wide Memo draft autosave, Cloudflare dashboard rollback confirmation) plus reconciling the still-open 72h cloud-image audit gap (§17 addendum) — those two items, not FQ-04 (now closed and cleaned up), are the actual remaining blockers between Friend QA and Public Beta authorization.

## 28. TSP-GUIDE-SAMPLE-CONTENT-FIX-018 — Guide-sample-only double-indent and flattened ruby (2026-09-16)

**FQ-05 (Guide sample double-indent) — OPEN → IMPLEMENTED → HUMAN PASS → PRODUCTION PASS / CLOSED.** Root cause: the guide's `試し読み（宮沢賢治『ポラーノの広場』より）` excerpt (`src/constants/sampleData.ts`, `SAMPLE_PROJECT.content`) had its 4 paragraphs seeded with a leading half-width space (U+0020) instead of the full-width ideographic space (U+3000) every other sample paragraph in the codebase used at the time (the sibling `src/constants/demoData.ts` then used U+3000; §29 later removes Demo's manual seed whitespace so Demo follows the normal-new-project automatic-indent path). The shared auto-indent exemption (`paragraphNeedsAutoIndent`/`AUTO_INDENT_CHAR` in `src/lib/tategaki.ts`, and the equivalent private `needsAutoIndent`/`AUTO_INDENT_CHAR` in `typesetting-v2/core/compose/line.ts`) only recognizes U+3000 as "already indented"; a leading U+0020 is not exempted, so the renderer's own auto-indent slot stacked on top of the manuscript's own leading space, producing a guide-only 2-cell indent. This is content-only, guide-specific data — no normal new project is seeded with a leading half-width space, so ordinary projects were never affected. **Fix:** corrected the 4 leading characters in `sampleData.ts` from U+0020 to U+3000. The shared renderer/indent logic in `tategaki.ts` and `typesetting-v2/core/compose/line.ts` was deliberately left untouched (existing `typesetting-v2/core/compose/paragraphSemantics.test.ts` already confirms the U+3000 case is correct for normal projects).
**Known latent gap at release time (resolved by §30):** the auto-indent exemption in both `tategaki.ts` and `line.ts` did not treat a leading half-width space (U+0020) as "already indented," unlike `src/lib/txtTransfer.ts`'s `serializeReadableTxt` (`/^[\s　]/`). Human QA later reproduced the same double-indent in Demo and normal user manuscripts; §30 fixes that shared-renderer defect without changing the closed FQ-05 Guide content fix.

**FQ-06 (Guide Polano quote flattened ruby) — OPEN → IMPLEMENTED → HUMAN PASS → PRODUCTION PASS / CLOSED.** Audited the full quoted excerpt in `sampleData.ts` against the reported pattern (kanji immediately followed by its own hiragana reading with no separator). Found exactly two flattened ruby occurrences, both restored to TateSpun's `｜base《reading》` notation:
- `俸給ほうきゅう` → `｜俸給《ほうきゅう》`
- `拵こしらえ直す` → `｜拵《こしら》え直す` — note only `拵`→`こしら` is inside the ruby; the trailing `え` is genuine okurigana (拵える) and stays outside the brackets so the word still reads correctly when expanded.
No other candidates were found in the excerpt (okurigana forms like `生れ付き`, `植え込んだ`, `巨きな` were checked and are not ruby). Attribution line (`■ 試し読み（宮沢賢治『ポラーノの広場』より）`) is unchanged and accurate.

**Sample architecture safety confirmed:** `SAMPLE_PROJECT` (id `-1`) is a static, client-side-only TS constant. `src/lib/db.ts`'s `sampleDocument()`/`listDocuments()`/`loadDocument()` always re-source guide content directly from this constant (never from a stored row), and `saveDocument()`/`deleteDocument()` early-return via `isEphemeralDocId` before touching IndexedDB. `TategakiEditor.tsx`'s `isSampleDocument` gate blocks both the local-save and Supabase cloud-sync paths for the guide. No migration, no DB/Auth/Supabase changes were made or required.

**Regression tests added:** `src/constants/sampleData.test.ts` (new, 7 tests, PASS) + colocated `src/constants/vitest.config.ts` (new, required — no existing scoped config covered `src/constants/*.test.ts`). Covers: absence of the flattened strings / presence of the restored ruby notation; ruby round-trips through the existing `tokenizeTategaki`/`detokenizeTategaki` (`src/lib/tategaki.ts`) without duplicating or dropping the base text; all 4 Polano paragraphs lead with U+3000; `paragraphNeedsAutoIndent` treats the corrected leading space as already-indented while still flagging a bare half-width space (documents the latent gap above without fixing it). No existing test suite touched. Full targeted run: `src/constants` 7/7 PASS (new), `src/lib` `friendQaGuide.test.ts` 3/3 PASS (unaffected), `typesetting-v2/core/compose/paragraphSemantics.test.ts` 15/15 PASS (unaffected). TypeScript/ESLint clean on all changed files (one pre-existing, unrelated `src/app/layout.tsx` `LayoutProps` error confirmed outside this diff). `npm run build:basepath` full PASS.

**Files changed:** `src/constants/sampleData.ts`, `src/constants/sampleData.test.ts` (new), `src/constants/vitest.config.ts` (new).

**Human QA:** PASS. Guide固有の2字下げ解消、通常新規作品の字下げ正常、『ポラーノの広場』のflattened ruby重複解消、ruby表示正常を確認。

**Production release (TSP-GUIDE-SAMPLE-RELEASE-019, 2026-09-16):** rollback point `f2df333`; source branch `fix/tsp-guide-sample-content-2026-09-16` pushed at `48e0b12`; explicit merge commit `6a23e65` (`merge: fix TateSpun guide sample indentation and ruby`) pushed to `master`. Cloudflare Pages Git integration deployed the push with no environment change. Live smoke: HOME / HOW TO / Editor / Guide all HTTP 200; the Editor bundle contains all 4 U+3000-leading Polano paragraphs and canonical `｜俸給《ほうきゅう》` / `｜拵《こしら》え`, with the U+0020-leading first paragraph and flattened `俸給ほうきゅう` / `拵こしらえ` absent. FQ-04's compact mobile CSS remains live, diagnostic viewport UI identifiers remain absent, and FANBOX / OFUSE remain present on HOME and HOW TO. No destructive user-data test, DB mutation, Auth/Supabase change, Cloudflare environment change, or Edge deploy was performed.

**Preserved, unchanged:** FQ-04 remains **CLOSED / Production Human PASS** (not reopened). FRIEND QA = ACTIVE, PUBLIC BETA = NOT YET, 72h cloud-image audit gap = OPEN, legacy manuscript-loss investigation = OPEN. Normal new-project paragraph auto-indent, `「`/`『` paragraph-start exemptions, and shared renderer/indent logic are unchanged.

**FQ-05 status: PRODUCTION PASS / CLOSED.**
**FQ-06 status: PRODUCTION PASS / CLOSED.**

**NEXT (single action):** return to the actual Public Beta gate: complete §17's remaining 4-item Human RC checklist (`/demo` walkthrough, Settings drawer visual order, app-wide Memo draft autosave, Cloudflare dashboard rollback confirmation) and reconcile the still-open 72h cloud-image audit gap. Do not invent new feature work; FRIEND QA remains ACTIVE and PUBLIC BETA remains NOT YET.

## 29. TSP-DEMO-INDENT-PARITY-FIX-020 — Demo seed follows normal new-project auto-indent (2026-09-16)

**FQ-07 (Demo indent parity) — HUMAN QA FAIL / superseded by §30.** Production's disposable おためしデモ used the same `DEFAULT_PAGE_SETTINGS`, `PageCard`, `paragraphNeedsAutoIndent`, pagination, and edit callback as an ordinary project; there is no Demo-only renderer, CSS indent, normalization, or settings override. The initial investigation found a real route-specific data difference: normal new projects start with an empty manuscript, while 4 of the Demo seed's 5 body paragraphs had a literal leading U+3000 embedded since the Demo was introduced. Removing that hidden seed whitespace was valid, but Human QA proved it was not sufficient: a user-entered leading U+0020 still produced two cells in both Demo and a normal new project.

**Fix:** removed only those 4 pre-seeded U+3000 characters from `DEMO_SEED_CONTENT`. The shared renderer now owns the Demo's visual one-cell paragraph indent exactly as it does for a normal new project. No runtime normalization was added: user-entered ASCII space, U+3000, ASCII alphanumeric text, Japanese text, and opening `「` / `『` remain byte-for-byte manuscript input and follow the existing shared contract. Guide FQ-05 deliberately remains different: its quoted source retains exactly one canonical U+3000 per paragraph and receives no automatic prefix.

**Automated QA:** new `src/components/demoIndentParity.test.ts` (11 tests) first reproduced the pre-fix seed failure, then passes after the content-only fix. It covers Demo/New slot parity for no explicit leading space, ASCII half-width space, U+3000, ASCII alphanumeric, ordinary Japanese, `「`, and `『`; tokenizer round-trip source preservation including ruby/TCY; unchanged shared `paragraphNeedsAutoIndent` decisions; and Guide FQ-05's exactly-one-U+3000 contract. Full verification: `src/constants` 7/7 PASS, `src/components` 30/30 PASS, `src/lib` 350/350 PASS, Core 368/368 PASS, Next `typegen` + TypeScript PASS, changed-file ESLint PASS, and `npm run build:basepath` full PASS (Supabase gate DRY RUN / READ ONLY, backend ref unchanged). The emitted bundle was inspected and all 5 Demo body paragraphs now begin with their first real character, not hidden whitespace.

**Files changed:** `src/constants/demoData.ts`, `src/components/demoIndentParity.test.ts`. Implementation commit `e315151` (`fix(demo): align seeded paragraphs with normal auto-indent`). Shared pagination/indent renderers, normal project defaults, Guide content, DB/Auth/Supabase, and user/cloud manuscripts are untouched. No push or deploy.

**Preserved, unchanged:** FQ-05 = CLOSED / Production PASS; FQ-06 = CLOSED / Production PASS; FQ-04 = CLOSED / Production Human PASS; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; 72h cloud-image audit = OPEN; legacy manuscript-loss investigation = OPEN.

**FQ-07 attempt-1 status: HUMAN QA FAIL.** Demo seed cleanup remains, but it did not resolve the shared U+0020 path.

**NEXT:** superseded by the corrected local Human QA gate in §30. **PUSH: NO. DEPLOY: NO. DB MUTATION: NO.**

## 30. TSP-INDENT-HALFWIDTH-FIX-021 — Shared U+0020 one-cell indent contract (2026-09-16)

**FQ-07 corrective implementation — IMPLEMENTED / HUMAN QA PENDING (overall gate BLOCKED on Human QA).** Human QA is authoritative: no-space and leading U+3000 remained correct at one cell, but a leading ASCII half-width space (U+0020) rendered as two cells in both Demo and a normal new project. The §29 Demo seed cleanup remains correct, but could not fix input typed after seed creation and therefore was not FQ-07 acceptance.

**Exact root cause:** tokenization and paragraph handling correctly preserve U+0020 as manuscript text. At paragraph start, however, Current `paragraphNeedsAutoIndent` and V2 `needsAutoIndent` exempted opening brackets and U+3000 only. They therefore reserved/prepended one automatic U+3000 cell before the preserved literal U+0020 cell. Preview placement became `[auto U+3000, source U+0020, first glyph]`, and the first glyph began in cell 3 instead of cell 2. Demo, New Project, and Guide all use this shared behavior for identical input; this was not a Demo-only renderer or normalization defect.

**Why tests missed it:** §29's new parity test encoded `[AUTO_INDENT_CHAR, " ", ...]` as the expected U+0020 output and asserted `paragraphNeedsAutoIndent(" ") === true`. It proved Demo/New shared the same route but did not assert the Human-visible effective indent count. The older FQ-05 test also explicitly treated half-width space as different from already-indented U+3000. Both tests therefore preserved the defect as expected behavior while the seed-only assertions passed.

**Fix:** the two shared indent predicates now suppress an automatic prefix when the first source character is exactly U+0020, just as they already did for U+3000. The literal ASCII space is still emitted as a real Preview slot and retains its V2 source span; no editor normalization or manuscript rewrite was added. The no-space, U+3000, ASCII/Japanese, and `「` / `『` branches were left unchanged. Current and V2 received the same narrow condition so Typography/Ruby/TCY paths cannot diverge.

**Behavior after fix:** no-space = one automatic cell; U+3000 = one literal cell; U+0020 = one literal cell with no automatic prefix; ASCII/Japanese starts = one automatic cell; opening `「` / `『` = unchanged zero automatic cells. A new Preview-slot regression counts effective leading grid cells, and the V2 core regression verifies six source units still fit six cells with the leading U+0020 source span intact.

**Automated QA:** initial red phase reproduced 3 Current failures and 1 V2 failure. Final gates: focused Current 18/18 PASS; focused V2 paragraph semantics 16/16 PASS; constants/FQ-05/FQ-06 7/7 PASS; components 37/37 PASS; shared lib 350/350 PASS; V2 core 369/369 PASS; V2 bridge 71/71 PASS with its artifact-only generator test skipped by design; Next `typegen` + TypeScript PASS; changed-file ESLint PASS; `npm run build:basepath` PASS. The build's Supabase checks were DRY RUN / READ ONLY with backend ref unchanged.

**Files changed:** `src/lib/tategaki.ts`, `typesetting-v2/core/compose/line.ts`, `src/components/demoIndentParity.test.ts`, `typesetting-v2/core/compose/paragraphSemantics.test.ts`, and the corrected FQ-05 expectation in `src/constants/sampleData.test.ts`. Implementation commit `b17b7a0` (`fix(typesetting): prevent half-width space double indent`). No push, deploy, DB, Auth, Supabase, or Cloudflare mutation.

**Preserved, unchanged:** FQ-04 = CLOSED / Production Human PASS; FQ-05 = CLOSED / Production PASS; FQ-06 = CLOSED / Production PASS; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; 72h cloud-image audit = OPEN; legacy manuscript-loss investigation = OPEN.

**FQ-07 status: ~~IMPLEMENTED / BLOCKED — Human QA required~~ → PRODUCTION PASS / CLOSED — see §31.**

**NEXT:** superseded by the completed Human QA and Production release record in §31.

## 31. TSP-FQ07-RELEASE-FINALIZE-023 — Production PASS / CLOSED (2026-09-17)

**FQ-07 status: PRODUCTION PASS / CLOSED. Human QA: PASS.** The approved FQ-07 tree was merged as `6b835ac` (`Merge FQ-07: demo indent parity and half-width space fixes`). Cloudflare Pages Git integration reported `Deployed successfully` for that exact SHA with deployment ID `31dfdc34-a53a-42ed-95ff-e7f58c87de34`; no manual deploy, environment change, DB/Auth/Supabase operation, or user-data mutation was performed.

**Production/live verification:** HOME `/tatespun/`, Editor `/tatespun/editor/`, Demo `/tatespun/editor/?demo=1`, Guide `/tatespun/guide/`, and HOW TO `/tatespun/howto/` all returned HTTP 200. The five Production HTML responses and all 23 referenced JS/CSS assets were byte-identical to the Cloudflare deployment URL for `31dfdc34`, tying the custom domain directly to the successful `6b835ac` deployment.

**FQ-07 live bundle:** the Demo seed paragraphs begin with their real first characters and the old pre-seeded U+3000 form is absent; the shared compiled indent predicate contains both exact exemptions (`" " !== firstChar` and `"　" !== firstChar`). Therefore no-space remains one automatic cell, U+0020 remains one literal source cell without an automatic prefix, and U+3000 remains one literal source cell without an automatic prefix. Source preservation was not changed. Focused verification on a clean `6b835ac` checkout passed: Current Demo/New/Guide contract 18/18, V2 paragraph semantics 16/16, and FQ-05/FQ-06 constants 7/7.

**Regression smoke:** FQ-04's mobile-only keyboard compact CSS (`data-keyboard-active` with the approved header/title/secondary-row selectors) remains in the live stylesheet. FQ-05's four U+3000-leading Guide paragraphs and FQ-06's canonical `｜俸給《ほうきゅう》` / `｜拵《こしら》え` ruby remain in the live bundle. `viewportDebug`, `ViewportDebugPanel`, and `data-shell-instance-id` remain absent. FANBOX and OFUSE destinations remain present and unchanged.

**Release state after close:** FQ-04 = CLOSED / Production Human PASS; FQ-05 = PRODUCTION PASS / CLOSED; FQ-06 = PRODUCTION PASS / CLOSED; FQ-07 = PRODUCTION PASS / CLOSED; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; 72h cloud-image audit = OPEN; legacy manuscript-loss investigation = OPEN.

**NEXT (single action): FRIEND QA継続.** Public Beta work is not started or authorized by this closeout. **DB MUTATION: NO.**

## 32. TSP-EDITOR-DELETION-CORRUPTION-024 — FQ-08 Editor deletion / IME corruption (2026-09-17)

**FQ-08 status: IMPLEMENTED / HUMAN QA PENDING. DATA-INTEGRITY bug reported by a user. FRIEND QA remains ACTIVE; PUBLIC BETA is NOT YET and no Public Beta work is authorized by this entry.** Reported fixture: `今日は、ゴブリン族の宴に呼ばれて、珍しい酒を振舞ってもらった。`; one Backspace/Delete could remove approximately one line (reported result near `今日は`) and subsequent IME input could lag, emit an unexpected glyph/emoji, or repeat text.

**Reproduction and exact source-integrity root cause:** both Editor surfaces are native controlled textareas. `beforeinput` already captured `inputType` and `selectionStart/selectionEnd` (Paged used a native DOM listener; FULL relied on React's unreliable `onBeforeInput` forwarding), but that snapshot was used only for activity/Undo accounting. `onChange` treated the textarea's whole resulting `.value` as authoritative and immediately promoted it to canonical `content` without proving that a `deleteContentBackward/Forward` result matched the advertised range. The event-level regression encodes the report exactly: 31-code-unit fixture, collapsed caret at 31, one `deleteContentBackward`, corrupted DOM result `今日は` (length 3). Before the fix PagedEditor committed all 28 deleted code units to canonical source; after the fix the same transaction resolves to the one intended final character (31 → 30). Ordinary physical Backspace already produced 31 → 30 and remains untouched.

**Post-delete IME/emoji/repeat analysis:** repo-wide tracing found no independent autosave, Preview, renderer, Focus Mode, history, or debounce path writing stale text back during ordinary typing. The persistent corruption was the same transaction boundary: once the anomalous DOM value became canonical `content`, React fed it back as controlled `value`, while Preview/activity/autosave correctly derived from that already-corrupted source. The exact device-specific IME candidate/emoji presentation was not independently reproduced in headless Chromium, so it is not falsely declared a separate proven browser cause; Human device QA remains required. Automated browser QA does prove that after repairing the reported deletion transaction, IME commit, immediate Backspace, key repeat, Undo/Redo, Preview open/closed, and subsequent input remain coherent.

**Fix (`239a6d4`, `fix(editor): guard native deletion source integrity`):** added one shared source-boundary resolver for non-composition `deleteContentBackward/Forward`. Normal native results pass through unchanged. Selected deletion must remove exactly the selected range; a collapsed deletion may remove exactly one adjacent Unicode code point or the browser's one grapheme cluster. Only a contradictory result is repaired to that minimal intended range before it reaches canonical source. Composition, word/line deletion, Cut/Paste, Undo/Redo, and all other input types bypass the guard. No blanket `preventDefault`, manuscript normalization/migration, renderer/typesetting change, or unnecessary selection restoration was added. FULL now reads `inputType` from a native `beforeinput` listener, matching PagedEditor; no-op snapshots are cleared on the next key/blur so they cannot become stale transactions. Repair diagnostics remain behind the existing `?perfDebug=1` gate and record only event type, selection/length facts, and repair lengths — never manuscript text.

**Automated QA:** new pure regression 9/9 PASS (reported 31 → 3 corruption, end/middle Backspace, middle Delete, one/multi selection, Unicode surrogate/emoji/combining/grapheme safety, repeat, non-target input bypass). New real-Chromium E2E passes the required 10-case input matrix on both WINDOWED and FULL surfaces and repeats the Editor check on Demo, Guide, and normal local-project routes. Existing Undo/window model 45/45, editor activity/composition 67/67, editor pagination 75/75, components 37/37, hooks 22/22, and Core 369/369 PASS. `src/lib` full run: 358/359 PASS; the sole failure is the pre-existing unrelated `rcPolishRound5` test attempting to overwrite a tracked QA PNG and receiving `EPERM` in the temporary worktree — no product assertion failed and it was not changed. TypeScript PASS; changed ESLint 0 errors / 0 new warnings (four pre-existing Hook dependency warnings remain outside this diff); `build:basepath` PASS with Supabase cutover gate explicitly DRY RUN / READ ONLY and backend ref unchanged.

**Files:** `src/lib/editorInputIntegrity.ts`, `src/lib/editorInputIntegrity.test.ts`, `src/components/EditorPane.tsx`, `src/components/PagedEditor.tsx`, `tests/e2e/editorInputIntegrity.e2e.mjs`, `package.json`. Roadmap-only record is this section. No user manuscript migration, DB/Auth/Supabase mutation, push, or deploy.

**Human QA required:** on a real affected device/IME, use the reported fixture and verify: end/middle Backspace; middle Delete; one/multi-character selection deletion; Backspace/Delete during conversion; Backspace immediately after conversion commit; held-key repeat; deletion after Undo/Redo; Preview open/closed; Focus Mode; Demo/Guide/normal project; autosave then reload. For every single non-repeat event, compare the intended range with the resulting source and confirm subsequent Japanese composition has no lag, unintended emoji/glyph, or repeated `ああああああ`. Do not reopen FQ-04, FQ-05, FQ-06, or FQ-07; all remain CLOSED.

**Release state:** FQ-08 = IMPLEMENTED / HUMAN QA PENDING. FRIEND QA = ACTIVE. PUBLIC BETA = NOT YET. PUSH = NO. DEPLOY = NO. DB MUTATION = NO.

## 33. TSP-FQ08-PRODUCTION-RELEASE-025 — Production PASS / CLOSED (2026-09-17)

**FQ-08 status: PRODUCTION PASS / CLOSED. DATA INTEGRITY: HUMAN PASS.** Human QA on the affected editing path confirmed that one end-of-text Backspace removes only one character; middle Backspace/Delete and selected-range deletion are exact; Japanese input remains normal immediately after IME commit; no lag, unintended emoji/glyph, or repeated characters recur; and Undo/Redo plus autosave/reload remain coherent.

**Release:** rollback point `a4a8437`; source branch `fix/tsp-editor-deletion-corruption-024` pushed at `9c487ca`; explicit merge commit `30e13cd` (`merge: guard TateSpun editor deletion source integrity`) pushed to `master`. Cloudflare Pages Git integration completed successfully for that exact merge with deployment ID `91316cfc-a615-40c7-afd9-9fe2df60796f`. No manual deploy, Cloudflare environment change, DB/Auth/Supabase operation, migration, or user-data mutation was performed. The held DB commit `47d66df` is not an ancestor of the released source or master line.

**Release gates:** integrity regression 9/9, components 37/37, windowed Editor history/offset 45/45, editor session/activity 67/67, and pagination 75/75 PASS; TypeScript PASS; changed-file ESLint 0 errors (four pre-existing Hook dependency warnings only); real-Chromium 10-case input matrix plus Demo/Guide/normal parity PASS on both WINDOWED and FULL; `build:basepath` PASS with the Supabase cutover audit explicitly DRY RUN / READ ONLY and backend ref unchanged. The gates cover rejection/repair of the reported 31 → 3 transaction, unchanged normal deletion and selected deletion, composition/IME bypass, Unicode code-point/grapheme integrity, key repeat, Preview, Undo/Redo, and autosave activity paths.

**Production/live verification:** HOME `/tatespun/`, Editor `/tatespun/editor`, Demo `/tatespun/editor?demo=1`, Guide `/tatespun/guide`, and HOW TO `/tatespun/howto` all returned HTTP 200. A fresh isolated-browser run against Production passed the same WINDOWED 10-case deletion/IME matrix and Demo/Guide/normal parity without touching an existing user profile or cloud manuscript. All 23 referenced JS/CSS assets were identical between the custom domain and deployment `91316cfc`; HTML was identical after removing only the custom-domain Cloudflare Web Analytics beacon injection and its trailing newline. The live assets contain the FQ-08 repair marker and both deletion input types.

**Regression smoke:** FQ-04's approved keyboard compact CSS remains live; FQ-05/FQ-06 canonical Guide ruby remains live; FQ-07's corrected Demo seed remains live; `viewportDebug`, `ViewportDebugPanel`, and `data-viewport-debug-panel` remain absent; FANBOX and OFUSE destinations remain unchanged. FQ-04, FQ-05, FQ-06, and FQ-07 remain CLOSED and were not reopened.

**Release state after close:** FQ-08 = PRODUCTION PASS / CLOSED; DATA INTEGRITY = HUMAN PASS; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET. The soft β target remains **2026-09-21 12:00 JST** *(historical record — fixed date SUPERSEDED on 2026-09-20; see §38)*. Formal Public Beta remains gated on both the UX 5-minute Gate and the 7-day unattended Gate passing. The 72h audit remains OPEN, and the legacy manuscript-loss investigation remains OPEN.

**NEXT:** UX v3 baseline/spec setup. This release does not start UX v3 implementation or any new feature work. **DB MUTATION: NO.**

## 34. TSP-FQ09-PRODUCTION-VERIFY-RESUME-008 — V2 PDF geometry parity Production PASS / CLOSED (2026-09-17)

**FQ-09 status: PRODUCTION PASS / CLOSED. SYSTEM QA: PASS. HUMAN QA: PASS.** The root cause was an incomplete V2 browser/worker/PDF contract: the selected `pdfMode` was omitted before PDF generation, so V2 output could not preserve the established trim / bleed / full geometry contract. Implementation `a1e9939` (`fix(pdf): restore V2 PDF geometry mode parity`) restored that propagation and geometry behavior; merge `e0f04bd` (`merge: restore TateSpun V2 PDF geometry parity`) is on `master`.

**Cloudflare Pages release:** the Cloudflare GitHub App reported `Deployed successfully` for exact commit `e0f04bdd0d2fcd4abc85c4168e72dde6490dae9a`, deployment ID `a9d3ee02-ca50-4e91-9fc2-94a8e4546663`, at `https://a9d3ee02.tatespun.pages.dev`. HOME `/tatespun/`, Editor `/tatespun/editor`, canonical Demo `/tatespun/editor?demo=1`, Guide `/tatespun/guide`, and HOW TO `/tatespun/howto` all returned HTTP 200. The five HTML responses and all 25 referenced same-origin JS/CSS/font assets were byte-identical between that deployment URL and `https://spuntales.net`; the live JS contained the V2 worker/geometry error marker and all three PDF-mode labels. No manual redeploy or Cloudflare setting/environment change was performed.

**Production FQ-09 verification:** a disposable, non-persistent Demo manuscript was set to A5 and exported through the real V2 Production UI in all three modes. The downloaded PDFs had actual MediaBox dimensions of **148 × 210 mm** (trim), **154 × 216 mm** (3mm bleed, no crop marks), and **184 × 246 mm** (full, 3mm bleed plus crop-mark margin). All three files were distinct. Direct decoded-image comparison proved the trim image was the exact centered 3mm crop of the bleed image with **0 mismatches across 17,165,949 pixels**; the full PDF embedded the exact same bleed image bytes, positioned at a 15mm offset, so the trim region/content placement and page/typesetting result were unchanged between modes. Trim and bleed content streams contained zero crop-mark line segments; full contained the expected 16 crop-mark segments. Download completed for every mode.

**Focused regression smoke:** FQ-04's approved mobile-only keyboard compact CSS remains live with the header/title/secondary-row selectors; FQ-07 live Preview placed no-space, leading U+0020, and leading U+3000 paragraph starts at the same one-cell offset; FQ-08's 31-code-unit reported fixture became exactly 30 code units after one Production Backspace. Normal PDF export passed as above, and Production JPG export produced a valid 1128 × 1600 image. FQ-04 through FQ-08 remain CLOSED and were not reopened.

**Release state after close:** FQ-04–FQ-08 = CLOSED; **FQ-09 = PRODUCTION PASS / CLOSED**; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; Soft Beta target = **2026-09-21 12:00 JST** *(historical record — fixed date SUPERSEDED on 2026-09-20; see §38)*; 72h audit = OPEN; legacy manuscript-loss investigation = OPEN; UX v3 Loop 1 = **UNBLOCKED / READY TO RESUME**. The held migration commit `47d66df` remains unmerged. **DB/Auth/Supabase/migration/env mutation: NO.**

**NEXT:** Resume UX v3 Loop 1 — PDF choice explanations + fixed 3mm note.

## 35. TSP-UX-V3-LOOP1-RELEASE-RECOVERY-014-KILO — Production PASS / CLOSED (2026-09-18)

**UX v3 Loop 1 status: PRODUCTION PASS / CLOSED. SYSTEM QA: PASS. HUMAN QA: PASS.** The human-tested commit `d7f53c1b28b14348570c0fd8009be8755191fc6e` was verified as Loop 1 only and integrated without rebuilding the dirty UX worktree. The clean release branch `release/tsp-ux-v3-loop1-pdf-help-027` is `89e6e545bd6f227fe38b530af1b3c4c86631209a`; the explicit merge is `576617c4e60873531cbdb737cc817afaf2acdf8c` (`merge: release TateSpun UX v3 Loop 1 PDF help`) and is the current `origin/master`.

**Release diff:** exactly five files: `src/components/PdfModeOption.test.tsx`, `src/components/PdfModeOption.tsx`, `src/components/PreviewPane.tsx`, `src/components/ViewportModal.tsx`, and `src/components/pdfModeHelp.ts`. The diff contains the three PDF choices, accessible `?` help, click/tap/native Enter/Space activation, outside-click and Escape closing, the finished-size caution, and the fixed 3mm note. It contains no `OddPageExportWarning` files, Loop 2 warning state/copy/rule, Loop 3 mobile shared export, QA binary artifacts, PDF geometry/export implementation changes, or DB/Auth/Supabase/env/migration changes. `47d66df` remains unmerged.

**Release gates:** `PdfModeOption` 10/10 PASS; FQ-09 V2 PDF geometry 15/15 PASS; PDF/export checklist 9/9 PASS; TypeScript PASS; changed-file ESLint PASS; `npm run build:basepath` PASS with the Supabase cutover gate explicitly DRY RUN / READ ONLY and backend ref unchanged. The three choices remain `trim`, `bleed`, and `full`; default `trim`, pdfMode propagation, FQ-09 geometry, PDF route, JPG route, and the FQ-08 guard remain unchanged.

**Cloudflare Pages:** the Cloudflare GitHub App check for exact commit `576617c` completed successfully with deployment ID `85911c05-13a0-474e-81e4-4352316b4714`, preview URL `https://85911c05.tatespun.pages.dev`, and status `Deployed successfully`. The custom domain `https://spuntales.net/tatespun/` returned HTTP 200 and its HOME HTML was byte-identical to the deployment preview during the smoke check (SHA-256 `AEA254F0CF81CD903BEEBFBD08764D03FBC9643D27DECD35870FFA208AE48217`).

**Production smoke:** HOME `/tatespun/`, Editor `/tatespun/editor`, Demo `/tatespun/editor?demo=1`, Guide `/tatespun/guide`, and canonical HOW TO `/tatespun/howto` returned HTTP 200. The deployed bundle/source contains all three PDF choices, the canonical help copy, the finished-size caution, the fixed 3mm note, `data-pdf-fixed-bleed-note`, independent tooltip controls, and no Loop 2 odd-page product UI. No interactive browser was available, so interaction claims are source/markup evidence rather than a fabricated live interaction PASS; local Human QA remains the interaction authority.

**FQ-09 regression:** A5 remains trim `148 × 210 mm`, bleed `154 × 216 mm`, and full `184 × 246 mm`; no geometry/export implementation changed. PDF and JPG routes remain alive, and the FQ-08 deletion/IME guard remains present.

**Preserved roadmap state:** FQ-04–FQ-09 = CLOSED / PRODUCTION PASS; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; 72h audit = OPEN; legacy manuscript-loss investigation = OPEN; UX v3 Loop 2 = HUMAN_GATE / NOT RELEASED; UX v3 Loop 3 = NOT STARTED. DB/Auth/Supabase/env/migration mutation: NO. *(State as of 2026-09-18; Loop 2 has since reached PRODUCTION PASS / CLOSED — see §38.)*

**NEXT:** Human QA / continuation of existing Loop 2 after primary-agent tokens recover. **STOP** *(Superseded: Loop 2 Human QA ALL PASS and released 2026-09-20 — see §38. Current NEXT: UX v3 Loop 3.)*

## 36. TSP-WRITING-TOOLS-AND-PRODUCT-POLICY-016-KILO — Roadmap-only registration (2026-09-18)

**Scope:** register two future writing-support features, the developer-used / owner-driven Product Policy, and a future top-page canonical draft in this roadmap only. **PRODUCT CODE CHANGE: NO. TOP PAGE IMPLEMENTATION: NO. PUSH: NO. DEPLOY: NO.** This registration does not change the existing UX v3 priority or authorize implementation.

### Writing-support feature 1 — 描写語・修飾表現チェックβ

- **Status:** `PLANNED / NOT STARTED`
- **Purpose:** 文章中の「性質・状態・様子を説明している表現」に、書き手自身が気づけるようにする。文章の正誤判定ではなく、表現を選択し直すための気づきの補助とする。
- **Candidate targets:** 形容詞、形容動詞的表現、連体修飾、連用修飾、および対象の性質・状態・様子を説明しているその他の表現候補。
- **Product intent:** 「美しい花」と書くこと自体を禁止しない。単に「美しい」と説明するのか、情景・行動・感覚・比喩などを通して自分自身の言葉で見せるのかを、書き手自身が考えるきっかけを作る。
- **UI direction:** 文章チェックβ内の追加機能。default OFF。ON時のみ黄色系マーカーを表示し、マーカー選択時に理由を表示する。
- **Candidate labels:** `形容表現候補`、`連体修飾候補`、`連用修飾候補`。
- **Candidate guidance:** `この表現では性質・状態を説明しています。必要であればそのまま残してください。情景や動作として描く余地がないか確認するためのチェックです。`
- **Guardrail:** 黄色マーカーは `削除すべき表現` ではなく `見直し候補 / 気づきの補助` として扱う。書き手を一方的に修正させない。
- **Research gate:** 実装前に独立Loopで、広義の修飾表現に対する日本語解析方式、精度、false positive、browser/local処理の可否、performanceを調査する。単純な品詞判定だけで実装可能と仮定しない。

### Writing-support feature 2 — 音読β / リズム確認

- **Status:** `PLANNED / NOT STARTED`
- **Purpose:** 文章を実際に耳で聞き、リズム・テンポ・文の長短・読点・反復・文章全体のグルーヴ感を確認する。本人が声を出して音読しづらい環境でも、文章の「鳴り」を確認できるようにする。
- **Initial direction:** ブラウザ内読み上げを第一候補として、独立Loopで調査・実装する。
- **Operations:** 選択範囲を読む、現在の段落を読む、全文を読む。
- **Candidate controls:** 再生、一時停止、停止、読み上げ速度、利用可能な音声選択。
- **Purpose boundary:** 高品質な朗読作品の生成ではなく、文章リズムの校正・確認を主目的とする。
- **Privacy:** TateSpunの既存方針を維持する。可能ならlocal/device speechを優先する。外部音声サービスへ原稿本文を送る場合は、明示的な説明・ユーザー操作・同意なしに行わない。

### Future research — VOICEVOX

- **Status:** `FUTURE RESEARCH / NOT COMMITTED TO IMPLEMENTATION`
- **Candidate scope:** local VOICEVOX ENGINE連携、AudioQuery等のJSON export/import、読み、アクセント、話速、抑揚等の調整によるリズム確認。
- **Boundary:** VOICEVOX対応は初期 `音読β` の必須条件ではない。`音読β` をVOICEVOX待ちにしない。

### Addendum A — Review Hub / 見直し

- **Status:** ~~`PLANNED / NOT IMPLEMENTED`~~ → first slice (B1) `FIXED / RELEASE-CANDIDATE READY / NOT RELEASED` on a local branch (2026-09-21, see B1); the future-tool items below (`描写語・修飾表現チェックβ`, `音読β`) remain `PLANNED / NOT IMPLEMENTED` and are not exposed.
- **Canonical UX direction:** top menuの `設定・オプション・メモ・ヘルプ` の4項目は維持し、新しい上部メニュー項目は追加しない。エディターフッターには常時 `▶ 見直し` を配置する構想とし、押下時にはフッターから上方向へReview Hubを展開する。
- **Consolidation target:** 既存の `文章チェックβ`、既存の `文字数カウント`、新規の `描写語・修飾表現チェックβ`、新規の `音読β / リズム確認`、および将来の文章確認・推敲補助機能をReview Hubへ統合する構想。
- **Role:** Review Hubは「機能追加によってEditor UIを肥大化させないための収納・整理レイヤー」として扱う。新しい常時表示メニューや機能の無秩序な追加を許可するものではない。

### Addendum B — Footer pinning

- **Status:** `PLANNED / NOT IMPLEMENTED`
- Review Hub内のツールから、任意の最大2件だけをエディターフッターに常時表示できるようにする構想。
- **Semantic rule:** `フッターに表示すること` と `機能が利用可能 / ONであること` は別とする。ピン留めされていないツールも、Review Hubを開けば通常通り利用可能。
- footer pin / display settingをfeature enable/disableとして実装しない。UI wordingは誤解を避けるため、`フッターに表示` またはpin/favorite相当とする。
- 最大表示数は2 tools。各ツールにはcompact footer representationを用意する。
- **Representation examples:** 文章チェックは `文章チェック 3件`、描写・修飾は `描写・修飾 18件`、音読はcompact playback/action、文字数は `12,843字`。

### Addendum C — Browser-level persistence

- **Status:** `PLANNED / NOT IMPLEMENTED`
- ユーザーが選択したfooter 2 toolsは作品単位ではなくブラウザ単位で保存する。
- **Required behavior:** 新規作品でも維持、別作品へ移動しても維持、原稿削除で消えない、manuscript/cloud dataとは分離、Supabase不要、login不要。別browser/deviceでは別設定でよい。
- browser/local preferenceとして保存する。Implementation mechanismは実装Loopで決定するが、local browser storageを第一候補とする。

### Addendum D — 描写語・修飾表現 A/B/C

- **Status:** `PLANNED / NOT STARTED`（既存の `描写語・修飾表現チェックβ` のcontract addendum）
- A/B/Cは品質評価・良し悪しではなく、検出範囲 / 候補強度の分類とする。
- **A:** 直接的な形容・状態・評価・様子の説明を中心に拾う。最も絞った見直し候補。
- **B:** 描写性を持つ連体・連用修飾まで広げる。すでに情景描写として機能している可能性もあるため、削除推奨ではない。
- **C:** 時間・場所・用途・識別情報なども含む広義の連体 / 連用修飾まで確認する。文章構造を広く観察したいユーザー向け。
- **User choices:** `A`、`A+B`、`A+B+C`。
- **Defaults:** feature defaultはOFF。有効化時のdefaultはA only。
- **Marker:** 原則同じ黄色系。A/B/CでEditorを多色化せず、詳細表示でcategory / reasonを示す。
- **Guardrail:** A/B/Cは「悪い文章ランキング」ではない。

### Addendum E — Analysis philosophy

- **Status:** `PLANNED / NOT STARTED`（既存の `描写語・修飾表現チェックβ` のanalysis contract）
- **Initial implementation policy:** generative AIを必須にしない。manuscriptを外部AI/APIへ送らない。browser/local Japanese analysisを優先する。known sample sentence matchingだけで実装せず、未知の文章にも構造・品詞・修飾関係から反応する設計を目指す。
- Human作成のA/B/C/対象外データは `specification corpus + regression corpus` として扱う。単なる辞書 / whitelistではない。
- **Pre-implementation research:** 独立Loopで日本語解析方式、false positive、performance、browser bundle size、privacyを調査する。

### Addendum F — 音読β minimum contract

- **Status:** `PLANNED / NOT STARTED`（既存の `音読β / リズム確認` のminimum contract）
- **Initial target:** 選択範囲を読む、現在の段落を読む、全文を読む、再生、一時停止、停止、読み上げ速度。
- Available voice selectionは実装調査結果に応じて含める。
- **Primary implementation research:** browser speech synthesis / local-device speech。
- **VOICEVOX:** future optional research only。
- **Purpose boundary:** 高品質朗読生成ではなく、文章のリズム・テンポ・句読点・反復・グルーヴ感の確認。

### Addendum G — QA corpus

- **Status:** `PLANNED / NOT STARTED`
- Human側で今後、次のcorpusを準備する。
- **描写語・修飾表現用:** A / B / C / 対象外 / 迷うの判定付き文章群。ChatGPT初期サンプルにHuman実原稿を追加して育てる。
- **音読β用:** 約1000字の標準QA小説。
- **Required coverage:** `。`、`、`、`！`、`？`、`……`、`――`、会話文、数字、時刻、英字、長い一文、短い文の連続。
- Actual corpus本文そのものはcanonical roadmapを肥大化させないためroadmapへ全文転記しない。`QA corpus to be stored separately before implementation` と記録する。

### Product Policy — developer-used / owner-driven features

TateSpunは、開発者自身が実際に小説執筆へ使用するためのプロダクトでもある。

そのため、開発者自身が実使用の中で `書く・確認する・本にするために欲しい / 必要` と判断した機能については、一般的な文章エディターに必須ではない機能であっても、Roadmapへ追加できる。

既存の方針である「β期間中は原則として新機能追加を抑制する」は削除しない。以下の例外ルールを正式に追加する。

> β期間中は原則として新機能追加を抑制する。ただし、TateSpunの中核目的である「書く・確認する・本にする」を直接強化し、Product Owner自身が実使用上必要と判断した機能については、既存の安定化Loopを阻害しない形でRoadmapへ追加し、独立したSystem QA / Human Gateを経て実装可能とする。

これは「思いついた機能を無制限に画面へ積み上げる」という意味ではない。機能追加と同時に、情報設計、機能の整理、optional / default OFF、progressive disclosure、設定への退避、見つけやすさ、初見ユーザーへの負荷、mobile / desktop双方のUI密度を継続的に確認する。Product Ownerが欲しい機能を追加できることと、ユーザーが使いやすいことを両立する。機能追加によって使いづらくなった場合は、ユーザーからの指摘・Human QAを受けてUI/IAを再整理する。

### Future top-page copy — canonical draft

- **Status:** `BETA PUBLICATION REQUIREMENT / NOT IMPLEMENTED`
- **Scope:** β公開時にTateSpunトップページへ掲載するcanonical draft copyとして保存する。今回のHome componentおよびproduct codeへの追加は行わない。UX v3 Home検討時または独立Copy/UI Loopで実装し、β公開時にはliveとする。
- **Relationship to current copy:** 既存のFrozen top-page copyを置き換えたり、今回のRoadmap登録だけでトップページへ反映したりしない。β公開時の掲載内容として、開発者が実使用中に欲しい機能を追加すること、機能が増える環境を整えること、改善・変更を随時お知らせすることを明示する。

> TateSpunは、私自身が小説を書くためにも使っているエディターです。
>
> なので「書いていて、これが欲しい」と思った機能は、これからも追加していきます。
>
> 中には、使う人によっては必要のない機能もあると思います。そこはご容赦ください。できるだけ必要な機能だけを選んで使えるようにして、機能が増えてもごちゃごちゃしない、書きやすい環境に整えていきたいと思っています。
>
> もし機能が増えたことで使いづらくなったところがあれば、どうぞ遠慮なく教えてください。使いながら、整えながら、TateSpunを育てていきます。
>
> β版の公開期間中にも、いくつか機能追加や改善を予定しています。追加・変更した内容は随時お知らせします。

### Priority and preservation

- 実装順・時期はまだ固定しない。
- UX v3 Loop 1: `CLOSED / PRODUCTION PASS` — unchanged.
- UX v3 Loop 2: **`PRODUCTION PASS / CLOSED`** (2026-09-20, `2fcb77a`; see §38). *(Registered as `HUMAN_GATE / NOT DEPLOYED` when this section was written on 2026-09-18; that entry did not delay or replace the Human Gate, and the gate has since passed.)*
- UX v3 Loop 3: **`PRODUCTION PASS / CLOSED`** (2026-09-20, `9b3c228`; see §40). *(Was `NOT STARTED` when this section was written.)*
- FQ-04〜09: `CLOSED` — unchanged.
- FRIEND QA: `ACTIVE` — unchanged.
- PUBLIC BETA: `NOT YET` — unchanged.
- 72h cloud-image audit: `OPEN` — unchanged.
- legacy manuscript-loss investigation: `OPEN` — unchanged.
- held migration `47d66df`: `UNMERGED` — unchanged.
- DB/Auth/Supabase/env/migration changes: **NO**.

**NEXT:** ~~Return to existing UX v3 Loop 2 Human Gate.~~ *(Superseded 2026-09-20: Loop 2 is PRODUCTION PASS / CLOSED — see §38; next is UX v3 Loop 3.)* The new writing features remain Roadmap-only until their own implementation loops begin. **STOP**

## 37. TateSpun Release Stage Matrix — β公開前 → β公開期間中 → 完成版v1.0 (2026-09-18)

**Scope and authority:** This section is the canonical stage roadmap for TateSpun. It assigns the writing-support, Review Hub, update-history, and bouten decisions to the stage where they belong; it does not authorize implementation or change the current UX v3 gate state. §36 remains the detailed product contract for the writing tools and Product Owner Driven Feature Policy. This section adds the release-stage, feedback, operational, and acceptance rules needed to carry those contracts forward.

**Governing principle:** TateSpun evolves in three different modes. β公開前は安全な原稿持ち込み・確認・持ち帰り導線を確立する段階、β公開期間中は実使用とfeedbackで必要な機能を追加・検証する段階、v1.0はβで役に立ったものを正式化・高精度化し、不要な実験を整理する段階とする。機能を段階に割り当てることは、Safety・essential export・essential mobile usability・正式に合意したPublic Beta Gateを軽視するためのものではない。

### Stage matrix

| Stage | Intent / goal | Decision | Out of scope / change condition |
| --- | --- | --- | --- |
| **β公開前** | **壊れない・迷いすぎない・原稿を持ち込んで書き出して帰れる** | Safety、必須のexport journey、必須のmobile usability、Public Beta Gateを先に閉じる。欲しいauthoring機能すべてが未完成でも、それだけを理由にβ公開を無期限に遅らせない。 | β期間中の実験機能の完成、v1.0相当の高精度化、歴史的全機能の復元は対象外。Safety問題が未解決の場合はHumanの明示的なknown-limitation判断が必要。 |
| **β公開期間中** | **実際に書きながら、Product Owner自身が必要と感じた機能を追加・検証し、利用者feedbackで整理する** | βはfrozen feature setではない。既存のProduct Owner Driven Feature Policyに従い、安定化Loopを迂回しない独立Loopで機能を追加・検証できる。Review Hub、optional/default-OFF、progressive disclosure、feedback、update historyでUIの整理を保つ。 | 機能追加を理由に既存の安定化・Safety・Human Gateを省略しない。beta experimentがv1.0に残ると仮定しない。 |
| **v1.0 / 完成版** | **βで実際に役立った機能を整理・正式化・高精度化し、一般ユーザー向け製品として完成度を上げる** | βのusage/feedback/resultに基づき、機能を正式化、精度・performance・IAを改善し、不要な実験は簡素化・廃止できる。 | βで人気が出なかった機能を無理に残さない。β中に未実装だった機能を自動的にv1.0へ移さない。 |

**Human feedback and plan-change rule:** 各段階のacceptanceは、自動テストだけでなく、実際の執筆・原稿持ち込み・Preview・export・mobile操作・feedbackで確認する。β公開前とβ期間中の境界は「β公開日」だけでなく、Safety・5-minute UX Gate・7-day unattended Gate・Human decisionが揃ったかで判断する。material release change、major manuscript-loss/export-safety issue、またはgate失敗があれば、該当stageのsoak/acceptanceを再開する。

### Phase A — β公開前

### A1. UX v3 Loop 2 — 奇数ページ警告

- **Intent:** 奇数ページ原稿を扱う書き手が、PDF出力の可否と白ページが必要になる可能性があることを混同しないようにする。browser confirmに依存せず、TateSpunのUIで文脈を説明する。
- **Status (updated 2026-09-20): `PRODUCTION PASS / CLOSED`** — Human QA ALL PASS、production merge `2fcb77a`、本番実ブラウザ検証 PASS。証跡は §38。Update History entry（§37-E）は Loop 3 の production release に同梱予定。
- **Decision / stage:** ~~現在のstatus `HUMAN_GATE / NOT DEPLOYED`を維持し、~~ **β公開前必須**として扱った（履歴: 2026-09-18 時点は `HUMAN_GATE / NOT DEPLOYED`）。PDF自体は奇数ページでも出力可能であることと、印刷所・本仕様によって白ページが必要になる可能性があることを分離して説明する。
- **Detailed contract:** 警告UIには `このままPDFを書き出す` と `戻って確認する` を用意する。前者はユーザーの明示的な継続操作としてPDF出力へ進む。後者は編集画面へ戻り、ページ構成・印刷所仕様・白ページ対応を確認できる。警告は「奇数ページだから出力できない」という誤解を生まない。
- **Guardrails:** browser confirmへ置き換えない。PDF生成・ページ数・既存のexport contractを無断に変更しない。警告の文言はHuman QAで、出力可否と白ページ要件が区別できることを確認する。
- **Acceptance / Human feedback:** 奇数ページ原稿で両actionを実操作し、PDFが意図通り出力されること、戻った場合に編集を継続できること、white-page要件が印刷所依存であることが理解できることを確認する。

### A2. UX v3 Loop 3 — Mobile Shared Export

- **Intent:** mobileで本文編集中でもPreview編集中でも、書き出し導線を見つけられるようにする。Previewを強制的に経由させない。
- **Status (updated 2026-09-20): `PRODUCTION PASS / CLOSED`** — production merge `9b3c228`, Cloudflare deployment `d58a371b-59a7-4e00-a7fe-418bdb22768e`. Human QA PASS; production browser smoke PASS (390px Editor view → 書き出し ▾ → sheet → PDF setup, JPG 1135×1600, Preview never visited). **Physical-smartphone software-keyboard-open observation: NOT TESTED; automated real-browser keyboard/compact regression: PASS** (Human judged it not a blocker). Evidence: §39 / §40. Update History (Loop 2 + Loop 3) is live in production.
- **Decision / stage (履歴: 2026-09-18 時点は `NOT STARTED`):** **β公開前必須**として扱う。本文/プレビューの双方からexportへ到達できる共有導線を設計する。
- **Detailed contract:** mobile Editorの本文表示中とPreview表示中の双方で、書き出し操作を発見・実行できる。Preview未訪問でもPDF/JPG exportを開始できる。既存のFQ-04 keyboard-active viewport/shell behaviorを保持し、keyboard表示時のeditor visible areaを回帰させない。
- **Guardrails:** Preview訪問を必須のstate transitionにしない。mobile keyboard compact CSS、Focus Mode、既存のexport selection/output contractを変更しない。
- **Acceptance / Human feedback:** 実deviceで本文→export、Preview→export、keyboard表示中・非表示中の両導線をHuman確認し、FQ-04のkeyboard open/close recoveryに回帰がないことを確認する。

### A3. 5-minute UX Gate

- **Intent:** TateSpunの最初の使用流れが、説明を読まなくても実務として成立するかを確認する。
- **Decision / stage:** Formal Public Betaの**β公開前Human Gate**。automated QAだけでは代替しない。
- **Detailed contract:** 30秒でTateSpunが何をするプロダクトか分かる。2分以内にmanuscriptを持ち込み、Previewを表示できる。5分以内にPDFまたはJPGをexportできる。各時間枠は、書き手が迷わず次の操作を選べることを意味し、単に画面が表示されるだけでは不十分。
- **Guardrails:** gate失敗をautomated passで上書きしない。Demo・通常新規project・実ファイル持ち込みの差異を隠さない。
- **Acceptance / Human feedback:** 初見ユーザーのHuman observationで、各時間枠・操作成功・迷い・説明の必要性を記録する。失敗した導線はβ公開前に修正または明示的なHuman decisionへ回す。

### A4. 7-day unattended Gate

- **Status (updated 2026-09-20): `DAY0 STARTED`.** Day0 = 2026-09-20 (Loop 3 production release day); Frozen RC = production merge `9b3c228` / deployment `d58a371b`; Day1 = 2026-09-21, Day3 = 2026-09-23, **Day7 = 2026-09-27 (earliest possible Day7 PASS)**。Day7 PASS までβ開始条件は満たされない。**PUBLIC BETA = NOT YET。** 詳細は §40。
- **Timeline (updated 2026-09-20):** Day0 は **UX v3 Loop 3 の production release** 後の Frozen RC から数える。したがって最短でも **Loop 3 release日 + 7日** より前に Day7 PASS は成立しない。旧 soft β target `2026-09-21 12:00 JST` はこのGateと両立しないため**廃止**した（§38）。
- **Intent:** 短期のhand testでは検出されにくいautosave、persistence、browser state、cloud state、長時間放置時の不整合を検出する。
- **Decision / stage:** Formal Public Betaの**β公開前gate**。Frozen RCで実施する。
- **Detailed contract:** soak中はproduct deploy、manual DB/storage repair、manual data rescueを行わない。Day0 / Day1 / Day3 / Day7にobservationし、autosave/reload、manuscript/settings/Memo/checklist/work-session、export stateを記録する。
- **Guardrails:** material release change、RC差し替え、data repair、manual rescueが発生したらsoakを再開する。観察結果を「問題未発見」で曖昧にしない。
- **Acceptance / Human feedback:** 各observation dayの結果と異常・再現条件・影響範囲をHumanが確認し、major manuscript-loss/export-safety issueがないこと、または既知β制限として明示的に承認されたことを記録する。

### A5. Safety OPEN items

- **Intent:** β公開前にSafetyの未解決事項をroadmapから消さず、公開判断を透明にする。
- **Decision / stage:** **β公開前Human decision items**。少なくとも `legacy manuscript-loss investigation = OPEN` と `72h cloud-image elapsed audit = OPEN` を維持する。
- **Detailed contract:** Formal Public Beta前に、major manuscript-loss/export-safety issueをCLOSEDにする。CLOSEDにできない場合は、影響、回避方法、観測方法、既知β制限としての許容範囲をHumanが明示的に承認する。
- **Guardrails:** OPEN項目を「βだから問題ない」と黙示的に扱わない。Safety判断をfeature priorityや公開日だけで上書きしない。
- **Acceptance / Human feedback:** OPEN項目それぞれについて、CLOSED証拠またはHuman-approved known beta limitationの記録を残す。

### A6. Top Page Product Policy Copy

- **Intent:** β公開時の利用者へ、TateSpunが開発者自身の実執筆にも使われるプロダクトであり、β期間中に機能追加・改善が続くことを最初に伝える。
- **Status (updated 2026-09-20): `IMPLEMENTED / PRODUCTION PASS`** — Pack A, `2fcb77a`. canonical は **Home 下部の `DEVELOPMENT POLICY` セクション**（`data-product-policy`、見出し「TateSpunは、使いながら育てています。」、Support セクションの直上）。**上部の returning-only Product Policy card 案は却下済み**（Human QA で却下を確認、Home 上部にはカードなし。本0冊でも本ありでも同じ下部 Policy を表示）。段落順は §36 の draft と異なり「β版の公開期間中にも…」が2段落目だが、位置・順序は本節で固定されておらず Human QA PASS。証跡は §38。
- **Decision / stage (履歴: 2026-09-18 時点は `BETA PUBLICATION REQUIREMENT / NOT IMPLEMENTED`):** **β公開時にlive必須**。§36のcanonical draftを維持し、次の一文を追加する。
- **Canonical addition:** `β版の公開期間中にも、いくつか機能追加や改善を予定しています。追加・変更した内容は随時お知らせします。`
- **Detailed contract:** copyは、開発者がTateSpunを実際に小説執筆へ使っていること、実使用中に欲しい機能を追加し得ること、利用者によって不要な機能があること、機能が増えても整理された書きやすい環境を目指すこと、使いづらさの指摘を歓迎すること、β中の追加・変更を随時知らせることを伝える。
- **Guardrails:** 今回のdocs taskでHome/product codeへ入れない。β公開前にCopy/UI Loopで実装し、既存のFrozen top-page copyを無断で置き換えない。
- **Acceptance / Human feedback:** β公開時のHomeでcanonical copyが表示され、機能追加方針と変更通知の約束が初見ユーザーに理解できることをHuman確認する。

### A7. TateSpun Update History infrastructure

- **Status (updated 2026-09-20): infrastructure `IMPLEMENTED / PRODUCTION PASS`** — Pack A, `2fcb77a`。実装: `public/data/tatespun-update-history.json`（TateSpun専用JSON）、`src/lib/updateHistory.ts`（schema検証）、`src/components/UpdateHistoryAccordion.tsx`（Home、Support セクションの直下。collapsed は一行 `▼ 更新・デバッグ・機能追加のお知らせ履歴`、開くと `▲`、内部scroll領域＋▲▼ボタン、`aria-expanded`/`aria-controls`、scroll領域は `tabIndex=0`）。Production Preview の JSON はコミット済みファイルと byte 一致。Human QA では「更新履歴 正常」が ALL PASS に含まれる。**この節が定める個別入力（wheel/touch/keyboard scroll 等）ごとの Human 証跡は §38 の記録以上には残っていない。** **現在のJSONは1件（`26/09/18` PDFサイズ選択）のみ。UX v3 Loop 2 の entry は未追加で、Loop 3 の production release に Loop 2 + Loop 3 の2件を同梱する（§37-E / §38）。単独の履歴releaseは行わない。**
- **Status (履歴: 2026-09-18 時点): `BETA PUBLICATION REQUIREMENT / NOT IMPLEMENTED`**
- **Intent:** SpunTales全体の履歴とは別に、TateSpunの更新・デバッグ・機能追加を利用者へ直接伝える独立した情報源を作る。
- **Decision / stage:** **β公開前必須**。実装pathと mechanismはrepo inspection後のImplementation Loopで決定するが、TateSpun専用JSONとUIを必須contractとする。
- **Detailed contract:** UIは既存のsupport/donation sectionのnear/belowに配置する構想。Collapsed defaultは一行の `▼ 更新・デバッグ・機能追加のお知らせ履歴`。開くとcard/boxed accordionとなり、visible viewportに約5 update rowsを表示する。rowは `YY/MM/DD｜見出し（太字）｜更新内容の詳細文章`。内部categoryはfeature/fix/improvement/notice等でよいが、visual color-codingは必須ではない。
- **Scope boundary:** historyは現在のpublic/development release periodから始め、過去の全履歴を復元する義務はない。β公開前のinfrastructure statusは `NOT IMPLEMENTED` のままとし、実装後にA7のacceptanceを記録する。
- **Acceptance / Human feedback:** JSONが消費可能で、UIがcollapsed/open state、約5行表示、keyboard operationを含めてHuman確認できること。即時運用ルールは次節のEを参照する。

### Phase B — β公開期間中

### B1. Review Hub / 見直し

- **Intent:** すでに密度の高いEditor UIを、機能追加のたびに肥大化させない。文章確認・推敲補助を一つの整理された収納レイヤーへ集約する。
- **Status (updated 2026-09-21, after Human QA): `FIXED / RELEASE-CANDIDATE READY / NOT RELEASED`.** Human QA: all B1 functions PASS. One ~770px observation was investigated: the header density is pre-existing (recorded separately in `typesetting-v2/qa/b1-review-hub/OBSERVATION_770PX_HEADER_DENSITY.md`, not part of B1), but a footer line B1 added at 768–~905px was a B1 regression and is fixed (trigger moved to the hint row; `B1_IMPLEMENTATION_RESULT.md` §8). Not pushed / deployed / merged; Production PASS not claimed. Earlier checkpoint text follows: implemented on the local branch `feat/tsp-b1-review-hub-20260921` (base `6dc820e`); not pushed, not deployed, not merged; Update History not changed; Production PASS not claimed. Scope of this B1: `▶ 見直し` in the Editor footer opening an upward panel with only the tools that already exist (`文章チェックβ`, `文字数カウント`), reusing their existing state/actions; top toolbar unchanged; no B2–B6 behaviour. Automated evidence and open Human decisions: `typesetting-v2/qa/b1-review-hub/` (`B1_IMPLEMENTATION_RESULT.md`, `B1_HUMAN_QA_TEMPLATE.md`, `B1_RELEASE_NOTES_DRAFT.md`). The Human QA has been returned (PASS).
- **Decision / stage:** ~~`PLANNED / NOT STARTED`~~ (see Status above)。β公開期間中のearly target。Review Hubは別機能ではなく、機能の収納・整理・発見可能性を扱うIA layerとして扱う。
- **Detailed contract:** top toolbarの `設定・オプション・メモ・ヘルプ` の4項目を維持し、Review Hubを第五の常時top-menu itemにしない。Editor footerに常時 `▶ 見直し` を置き、押下時にfooterから上方向へpanelを展開する。既存の `文章チェックβ`、`文字数カウント`、`描写語・修飾表現チェックβ`、`音読β`、将来の文章確認・推敲補助機能を統合対象とする。
- **Guardrails:** Review Hubを「機能を無制限に増やす許可」と解釈しない。optional/default-OFF、progressive disclosure、mobile/desktopのUI密度、初見ユーザーの負荷を各実装で確認する。
- **Acceptance / Human feedback:** Production導入後、Hubの開閉、目的のツールへの到達、footerとの関係、mobile densityをHuman確認し、C3のfeedback questionsで継続的なusage evidenceを集める。

### B2. Footer 2-tool customization

- **Intent:** よく使う確認ツールだけをcompactに手元へ残しつつ、Review Hub内の全機能へのアクセスを失わない。
- **Decision / stage:** `FIXED / RELEASE-CANDIDATE READY / NOT RELEASED`。Human QA PASS (2026-09-21 JST)。
- **Detailed contract:** Review Hub内の任意の最大2 toolsをEditor footerへ常時表示できる。各toolにcompact representationを用意する（例: `文章チェック 3件`、`描写・修飾 18件`、音読のcompact playback/action、`12,843字`）。
- **Semantic guardrail:** `フッターに表示すること` は `機能が利用可能 / ONであること` と別。pinされていないtoolもReview Hubを開けば通常通り利用可能。footer pin/display settingをfeature enable/disableとして実装しない。UI wordingは `フッターに表示` またはpin/favorite相当とし、誤解を避ける。
- **Persistence:** 選択はmanuscript単位ではなくbrowser/device local preferenceとし、新規作品、別作品への移動、原稿削除/再作成をまたいで維持する。manuscript/cloud dataと分離し、Supabase/loginを必須にしない。別browser/deviceで別設定でもよい。
- **Acceptance / Human feedback:** 2枠の選択・入替・Hubからの未pin tool利用・browser persistenceをHuman確認し、C3の回答から2枠が妥当か検証する。

### B3. Review Hub feedback/report instrumentation

- **Status (updated 2026-09-21): `HUMAN_GATE / IMPLEMENTED — NOT RELEASED`.** Implemented on the local branch `feat/tsp-b3-feedback-20260921` (base = B2 closeout `a46279a`); automated QA passed; not pushed, not deployed, not merged; Human QA pending; Production PASS not claimed; **not FIXED**. Design: a third tab `見直し` in the existing β 報告 modal (Q1 + Q2 as written below, optional note, and the current footer tools + two per-page-load counters shown before sending), sent as an ordinary `feedback` report through the existing `beta-feedback` transport (Edge Function → Discord forum + 「気になる事」 sheet) — **no backend / schema / env / Edge Function change and no manuscript content**. Q2 currently offers only the two tools that exist in the Hub today (`文章チェックβ`, `文字数カウント`); 描写語・修飾表現チェックβ / 音読β appear automatically once B4/B5 register them in the Hub. Evidence, exact data sent / not sent, rollback and the Human QA checklist: `typesetting-v2/qa/b3-feedback/` (`B3_IMPLEMENTATION_RESULT.md`, `B3_HUMAN_QA.md`, `B3_RELEASE_NOTES_DRAFT.md`).
- **Decision / stage:** `FIXED / RELEASE-CANDIDATE READY / NOT RELEASED`。Human QA PASS (2026-09-21 JST)。
- **Detailed contract:** 既存のuser report/review areaへ次の2問を追加する。Q1 `見直しのフッター表示は最大2枠で足りていますか？` choices: `足りている`、`もう1枠ほしい`、`もっとほしい`、`常時表示は不要`。Q2 `「見直し」の中で、よく使っているものを選んでください`。maximum 2 selections。initial choices: `文章チェックβ`、`描写語・修飾表現チェックβ`、`音読β`、`文字数カウント`。
- **Guardrails:** 質問文で2枠を正解へ誘導しない。未導入ユーザーへ導入済み機能の質問を表示しない。回答を機能の存廃へ機械的に直結させず、usage・Human observation・UI densityと合わせて判断する。
- **Acceptance / release rule:** Review Hub Production Releaseは、対応するreport/review questionsが追加され、回答収集の動作が確認されるまでfully completeとしない。

### B4. 音読β / リズム確認

- **Intent:** 声を出して音読しづらい環境でも、文章の「鳴り」を実際に耳で確認できるようにする。高品質なaudiobook生成ではなく、校正・確認を目的とする。
- **Status (updated 2026-09-22): `IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED`.** Implemented on local branch `feat/tsp-b4-b6-train-20260922` (base = B3 closeout `7d6e4ce`); not pushed / deployed / merged; Human QA pending; **not FIXED**. Design: Review Hub tool #3 (`音読β`), browser `SpeechSynthesis` only — on-device Japanese voice by default, an online voice only by explicit choice (with a warning), never a silent fallback; ruby read as its reading; selection / caret paragraph / full manuscript; play・pause/resume・stop・speed(0.5–2.0)・optional voice selector; footer compact control (`▶ 音読` → ⏸/■ n/N) under the B2 max-2 pin rule; no network path. Evidence, limits (device voices), Human checklist: `typesetting-v2/qa/b4-read-aloud/`. The B1 E2E "no internal scrolling" contract was relaxed to "every control reachable" (the Hub now holds 3 tools) — see `B4_IMPLEMENTATION_RESULT.md` §6.
- **Original decision / stage:** `PLANNED / NOT STARTED`。β公開期間中に導入するcandidate。minimum targetは、選択範囲を読む、現在の段落を読む、全文を読む、再生、一時停止、停止、speed。
- **Detailed contract:** rhythm、pacing、punctuation、repetition、grooveの確認を主目的とする。primary research directionはbrowser/device speech synthesis。local/device behaviorを優先し、manuscript textを外部speech serviceへ黙示的に送らない。available voice selectionは調査結果に応じて含める。
- **Guardrails:** VOICEVOXはseparate future optional researchであり、音読βをVOICEVOX待ちにしない。高品質朗読作品生成、external audio production、cloud voice dependencyを初期contractへ入れない。
- **Acceptance / Human feedback:** 実browser/deviceで範囲・段落・全文、再生/一時停止/停止/speedをHuman確認し、原稿のprivacy boundaryとリズム確認としての実用性を記録する。

### B5. 描写語・修飾表現チェックβ

- **Intent:** 性質・状態・様子を説明する表現を、削除命令ではなく書き手自身の気づきとして提示する。
- **Status (updated 2026-09-22): `IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED` — with a `BETA LIMITATION REVIEW` on the analysis method.** Local branch `feat/tsp-b4-b6-train-20260922`; not pushed / deployed / merged; not FIXED. Review Hub tool #4; default OFF, then mode A; A / A+B / A+B+C; one yellow highlight for all categories, category + reason + "keeping it may be right" in a detail card / Hub; footer pill `描写・修飾 N件`; browser-local pref; no AI, no upload, no dependency. **Analysis is heuristic** (productive morphology + closed-class tables + phrase-span rules; no POS dictionary): blind-run accuracy on the author's own unseen sentences 74 % / 79 % (`qa/b5-description-check/B5_IMPLEMENTATION_RESULT.md` §4); the smallest real analyzer (kuromoji) was measured at a 17 MB dictionary / +318 MB RSS and NOT adopted — a Human decision after real-manuscript QA. Long manuscript (102k chars, real Chrome): analysis 0.6–0.9 s in the background, typing unaffected. Corpus (the human-readable table is the regression data): `qa/b5-description-check/B5_SPEC_REGRESSION_CORPUS.md`.
- **Original decision / stage:** `PLANNED / NOT STARTED`。β公開期間中のcandidate。feature defaultはOFF。有効化時のdefaultはA only。
- **Detailed contract:** detection modesは `A`、`A+B`、`A+B+C`。Aは直接的な形容・状態・評価・様子の説明を中心とした最も絞った候補。Bは描写性を持つ連体・連用修飾まで広げ、情景描写として既に機能している可能性を含む。Cは時間・場所・用途・識別情報などを含む広義の連体/連用修飾を確認する。A/B/Cは品質評価・良し悪し・悪い文章ランキングではなく、検出範囲/候補強度の分類。
- **Marker / explanation:** 原則同じ黄色系。EditorをA/B/Cで多色化しない。詳細表示でcategory/reasonを示し、必要なら残せることと情景・動作・感覚・比喩での再検討を案内する。
- **Analysis policy:** generative AIを必須にしない。manuscriptを外部AI/APIへ送らない。browser/local Japanese analysisを優先し、known sample matchingだけでなく、未知の文章の構造・品詞・修飾関係から反応する設計を目指す。Human作成のA/B/C/対象外/迷う例は `specification corpus + regression corpus` として扱う。
- **Acceptance / Human feedback:** 実原稿でfalse positive、検出漏れ、performance、説明の分かりやすさ、long-manuscript behaviorをHuman確認する。β結果次第でv1.0で簡素化・廃止もあり得る。

### B6. 傍点（圏点）

- **Intent:** 選択した本文範囲に強調点を付け、意味上の強調を縦組みの見た目に反映する。
- **Status (updated 2026-09-22): `BLOCKED / PARITY NOT PROVEN / NOT RELEASED`.** Bounded investigation done on the local branch `feat/tsp-b4-b6-train-20260922`; **no product code was changed**. Reason: export parity must hold in both renderer modes (LEGACY DOM/`html-to-image`/raster-PDF and V2_BETA Core-contract → paint models → vector PDF / raster JPG), V2_BETA needs a change to the frozen Core unit contract plus Preview/Publication paint models, `pdfGenerator` and `rasterGenerator`, and the production renderer flag cannot be verified from the repo. CSS `text-emphasis` was measured to leave the vertical column pitch unchanged (LEGACY Preview only) but does not reach V2_BETA and LEGACY JPG/PDF is unproven; shipping it alone would be partial fake support. Recommended design (string notation `《《…》》`, paint-plan dot primitive, parity harness) and the Human decisions needed (production renderer, ruby-vs-dot side, TCY/punctuation, dot look, go/no-go): `typesetting-v2/qa/b6-emphasis/B6_ARCHITECTURE_DECISION.md`.
- **Original decision / stage:** `BETA CANDIDATE / PLANNED / NOT A RELEASE BLOCKER`。categoryは `AUTHORING / TYPOGRAPHY / TEXT DECORATION`。Review Hub toolではなくmanuscript formattingとして扱う。
- **Detailed contract:** 初期βは標準のblack-dot style一つ。多くのemphasis styleを最初から作らない。傍点とrubyはsemantically distinctで、ruby dataを流用して傍点を偽装しない。Editorで選択範囲へ適用し、Preview/JPG/PDFまで同じ意味・見た目を保持する。
- **Required investigation:** ruby + 傍点 coexistence、overlap、range editing、boundary edits、delete/backspace、Undo/Redo、save/reload、TCY、punctuation、page break。CSS `text-emphasis`は調査候補だが、CSS-only renderingだけでは不十分で、export parityを証明できない場合は採用しない。
- **Guardrails:** 既存のrenderer/typesetting/ruby/TCY/page-break contractsを破壊しない。初期scopeを超えるゴマ点・白丸・多スタイルはv1.0候補へ回す。
- **Acceptance / Human feedback:** Editor/Preview/JPG/PDFのparity、選択・境界編集・削除・Undo/Redo・reloadをHuman確認する。β feedbackで意味上の強調として役立つか、誤操作や視覚的混乱がないかを評価する。parityが証明できなければβ導入を延期する。

### B7. Update History during beta

- **Intent:** Top Pageの「追加・変更した内容は随時お知らせします」という約束を、運用上の実際の更新記録へ変える。
- **Decision / stage:** β公開期間中も継続。user-visible/user-impacting changeが発生するProduction releaseごとに、TateSpun専用update-history JSONを更新する。
- **Detailed contract:** 新feature、user interaction/UI change、behavior bug fix、export behavior change、significant usability improvement、important notice/known-issue resolutionを記録対象とする。docs-only、user-visible effectのないinternal refactor、test-only、CI/tooling-only、comments/formattingは通常除外する。
- **Guardrails:** historyを「後で追加する」状態でuser-visible Production changeを閉じない。即時release ruleは次節Eを参照する。
- **Acceptance / Human feedback:** release resultにupdate-history entryの要否判定、追加/更新、表示/消費可能性のverificationを含める。

### Phase C — v1.0 / COMPLETED PRODUCT

### C1. Review Hub finalization

- **Intent:** βで集めた実際のusage/feedbackに基づき、Review Hubとfooterを一般ユーザー向けの安定したIAへ確定する。
- **Decision / stage:** v1.0 completion target。β公開前blockerではない。
- **Detailed contract:** 2 slotsが妥当か、3以上が必要か、どのtoolsがよくpinされるか、一部のtoolsを別場所へ移すべきか、mobile density、grouping/categories、discoverabilityをbeta evidenceで判断する。
- **Guardrails:** β開始時に2 slotsを永久contractとして固定しない。feedbackが2枠不支持でも、UI全体の密度・目的・操作頻度をHuman reviewする。
- **Acceptance / Human feedback:** pin usage、Hub usage、report answers、Human observationを統合し、v1.0のslot count/layout/IAを決定した記録を残す。

### C2. 描写語・修飾チェック formalization

- **Intent:** βで有用と確認された場合、実用精度と説明品質をv1.0相当へ引き上げる。
- **Decision / stage:** v1.0 target。βでunhelpfulならsimplify/removeできる。
- **Detailed contract:** A/B/C precision向上、false positive低減、performance改善、long-manuscript test、explanation改善、必要なanalysis engine再検討を行う。corpusは継続的にversioningし、回帰結果を記録する。
- **Guardrails:** βの候補表示をv1.0で「正誤判定」へ変えない。精度が証明できない範囲を過剰に自動修正しない。
- **Acceptance / Human feedback:** 実原稿・corpus・performance・Human reviewで、detect/reason/operationの品質を評価する。

### C3. 音読 formalization

- **Intent:** β evidenceが目的の有効性を示した場合に、リズム確認として安定した完成機能へ整える。
- **Decision / stage:** v1.0 target。browser speechで目的が満たされる場合は、追加の音声基盤を必須にしない。
- **Detailed contract:** voice selection、current-reading highlight、paragraph navigation、long-text stability、improved playback stateを候補とする。各項目はβ usage/feedbackとprivacy/performance調査後に採用可否を決定する。
- **Guardrails:** 高品質audiobook生成や外部音声service依存をv1.0の暗黙前提にしない。
- **Acceptance / Human feedback:** 長文・複数段落・操作再開・device/browser差をHuman確認する。

### C4. VOICEVOX

- **Intent:** 必要に応じて、読み・accent・speed・intonation等を細かく扱えるlocal voice optionを検討する。
- **Decision / stage:** `FUTURE / NEED-BASED`。v1.0保証ではない。
- **Detailed contract:** local VOICEVOX ENGINE、AudioQuery、reading/accent/speed/intonation controlsを候補とする。browser speechでrhythm-check goalが十分なら未実装のまま終了し得る。
- **Guardrails:** 音読βをVOICEVOX待ちにしない。external serviceへの原稿送信は明示的な説明・操作・同意なしで行わない。
- **Acceptance / Human feedback:** βの音読利用結果とlocal/device speechの不足から、必要度・privacy・maintenanceをHuman decisionする。

### C5. 傍点 extension

- **Intent:** 初期black-dot styleで十分な場合は拡張せず、必要が確認された場合だけtypography optionを広げる。
- **Decision / stage:** v1.0/future target。β blockerではない。
- **Detailed contract:** ゴマ点、白丸、other emphasis marks、ruby+傍点 guaranteesの強化、advanced typography tuningを候補とする。
- **Guardrails:** 初期βのone-style contractをv1.0前に無断で拡大しない。各styleのEditor/Preview/JPG/PDF parityと既存typography contractを個別に証明する。
- **Acceptance / Human feedback:** 利用目的、視認性、他装飾との衝突、export結果をHuman確認する。

### C6. Advanced print/submission assistance

- **Intent:** βの「持ち込んで・確認して・持ち帰る」を、v1.0で印刷所・再版・複数冊の運用へ拡張する。
- **Decision / stage:** v1.0/future value。β公開前blockerにしない。
- **Detailed contract:** preflight checks、page/blank-page/spread checks、folio/colophon/image checks、filename checks、printer-oriented output presets、PDF+JPG+related files bundle、manuscript snapshot、reprint restore、anthology/reprint compilation、reusable book settingsを候補として保持する。
- **Guardrails:** 全体を一つのβ blockerへまとめない。各項目は独立したSafety/UX/implementation decisionを経て段階配分する。
- **Acceptance / Human feedback:** 実印刷所・実再版・実運用のHuman evidenceがある項目から個別に正式化する。

### E. Immediate update-history operation rule — starts NOW

**Rule:** 現在のdevelopment stageから即時に適用する。Formal Public Betaを待たない。`Any Production deployment containing a user-visible/user-impacting change must update the TateSpun update-history JSON.`

**Intent:** user-visible changeと利用者への説明を切り離し、β公開前の現在のreleaseからTateSpun独自のchange communicationを運用開始する。historyは公開時のpromiseだけでなく、各Production releaseのclosed conditionの一部とする。

**Detailed contract:** 要否対象は、new feature、changed user interaction、利用者が気づくUI change、behaviorに影響するbug fix、export behavior change、significant usability improvement、important notice/known issue resolution。通常除外するのは、docs-only commit、user-visible effectゼロのinternal refactor、test-only work、CI/tooling-only work、comments/formatting。

**Required release contract:** user-impacting Production releaseをCLOSEDとする前に、(1) update-history entryが必要か判定し、(2) 必要ならentryを追加/更新し、(3) entryがvalidでvisible/consumableかverifyし、(4) update-history verificationをrelease resultへ記録する。

**Infra missing condition:** 次のuser-impacting Production deployを準備する時点でhistory JSON/UIが未存在なら、historyをoptional扱い停止する。そのrelease planは、A. minimum update-history JSON/UI infrastructureを先に確立する、またはB. infrastructureをreleaseへ同梱し、CLOSED宣言前にvalidity/visibilityをverifyする。`history will be added later` でuser-visible changeを黙示的にdeployしない。

**Guardrails:** docs task itself does not create or deploy the infrastructure. This rule does not turn every internal commit into a public entry. It does turn every relevant user-impacting Production release into an explicit history decision.

**Acceptance:** release resultにentryの有無、path、title/date/detail、UI表示/消費確認、例外理由（該当する場合）が記録される。

### F. Update-history JSON/data contract

**Intent:** シンプルで公開可能なchange logを維持し、analytics databaseや過度なschemaへ膨らませない。

**Decision:** exact filename/pathはimplementation前のrepo inspectionで決定する。TateSpun専用historyとして、general SpunTales historyと分離する。

**Minimum semantic fields:** `date`、`title`、`detail`。Optional field: `type`（例: `feature`、`fix`、`improvement`、`notice`）。Concept example:

```json
{
  "date": "26/09/21",
  "title": "音読βを追加しました",
  "detail": "選択範囲・段落・全文の読み上げに対応しました。",
  "type": "feature"
}
```

**Guardrails:** date/title/detailの公開意味を壊す過度なmetadataを必須にしない。manuscript text、user data、analytics identifierをhistoryへ混入させない。JSONはpublic change logであり、analytics databaseではない。

**Acceptance:** implementation Loopでpath/schemaを確定し、date/title/detailがUIとrelease resultの両方で消費できることを確認する。

### G. Update-history UI contract

**Intent:** トップページから更新内容を発見できるようにしつつ、常時表示領域を奪わない。

**Detailed contract:** collapsed stateはsingle-line accordion triggerで、canonical labelは `▼ 更新・デバッグ・機能追加のお知らせ履歴`。expanded stateはcard/box presentationとし、visible viewportに約5 entriesを表示、内部でvertical scrollする。visual scrollbarは避けられる場合、conventional barを表示しない。

**Interaction contract:** visibleな `▲` / `▼` controlsを用意する。ただし、▲▼をscrollの唯一の方法にしない。mouse wheel、trackpad、touch swipe、keyboard scrollingをnatural inputとして保持する。controlsはkeyboard-operableでidentifiableにする。

**Guardrails:** visually cleanだがkeyboardやassistive technologyから操作できないcustom scroll trapを作らない。accordionの開閉state、entry focus、internal scrollのkeyboard accessをHuman確認する。

**Acceptance:** collapsed一行、expanded約5行、internal scroll、▲▼、wheel/trackpad/touch/keyboard inputをProduction Human QAで確認する。

### H. Product Policy relationship

**Intent:** Product Owner Driven Feature Policyと、利用者にとって理解可能なUIを両立させるstage policyを明示する。

**Decision:** TateSpunは開発者自身の実執筆に使うため、β期間中に実使用上の必要からfeatureを追加し得る。しかし、feature freedomはUI accumulation without structureを意味しない。

**Detailed contract:** Review Hub、optional/default-OFF tools、progressive disclosure、feedback questions、update historyは、`developer-driven evolution` と `user comprehensibility` を両立させるための構造として扱う。新機能をRoadmapへ追加する際は、既存の安定化Loopを阻害しない独立Loop、System QA/Human Gate、IA/UI density reviewを同時に記録する。

**Change condition:** β feedbackで使いづらさ、発見可能性の低下、mobile densityの問題が確認された場合は、featureの存続とは別にUI/IAを再整理する。βで不要と判断された実験はv1.0へ自動継承しない。

### I. Priority / non-blocking rule

**Intent:** 欲しい機能をRoadmapへ登録することと、Formal Public Beta blockerであることを分離する。

**Decision:** Beta blockersはSafety、essential export journey、essential mobile usability、合意済みPublic Beta Gatesに集中させる。以下をcanonical stage dispositionとして固定する。

- **音読β:** `beta-period planned / not a Public Beta blocker`。
- **描写・修飾チェックβ:** `beta-period planned / not a Public Beta blocker`。
- **Review Hub:** `beta-period early target / not necessarily a Public Beta blocker`。
- **傍点:** `beta candidate / not a Public Beta blocker`。
- **VOICEVOX:** `future research / need-based`。
- **Advanced submission tools:** `v1.0/future / not a β blocker set`。
- **Top Page Product Policy Copy:** `BETA PUBLICATION REQUIREMENT / NOT IMPLEMENTED`。
- **TateSpun Update History infrastructure:** `BETA PUBLICATION REQUIREMENT / NOT IMPLEMENTED`。ただし、即時release operation ruleは**NOW active**。

**Guardrails:** この節はUX v3 Loop 2/3、5-minute UX Gate、7-day unattended Gate、Safety OPEN itemsの既存priorityを下げない。新規authoring featureを「β公開前必須」へ勝手に昇格させない。

### J. Preserved roadmap truth

This stage registration does not reopen or rewrite unrelated canonical state. The current authoritative states remain:

- UX v3 Loop 1: `CLOSED / PRODUCTION PASS` — unchanged.
- UX v3 Loop 2: **`PRODUCTION PASS / CLOSED`** (updated 2026-09-20, §38). *(As written on 2026-09-18: `HUMAN_GATE / NOT DEPLOYED`; this section did not authorize deployment — the deployment was separately authorized and completed.)*
- UX v3 Loop 3: **`PRODUCTION PASS / CLOSED`** (updated 2026-09-20, §40). A4 = `DAY0 STARTED`; PUBLIC BETA = `NOT YET`.
- FQ-04〜09: `CLOSED / PRODUCTION PASS` — unchanged.
- FRIEND QA: `ACTIVE` — unchanged.
- PUBLIC BETA: `NOT YET` — unchanged. **Start condition (updated 2026-09-20, §38): Loop 3 production release + A4 Day7 PASS** (plus the A3 5-minute UX Gate and A5 Safety OPEN items, unchanged). The fixed soft target `2026-09-21 12:00 JST` is withdrawn.
- 72h cloud-image audit: `OPEN` — unchanged.
- legacy manuscript-loss investigation: `OPEN` — unchanged.
- held migration `47d66df`: `UNMERGED` — unchanged.
- DB/Auth/Supabase/env/migration changes from this docs task: **NO**.

**NEXT:** ~~Continue the existing UX v3 Loop 2 Human Gate.~~ *(Superseded 2026-09-20 — Loop 2 closed; see §38.)* Implement none of the new stage items from this docs task. Any future user-impacting Production release must obey the immediate TateSpun update-history rule in §37-E. **STOP**

## 38. Pack A + UX v3 Loop 2 Production Closeout (2026-09-20)

**Pack A status: PRODUCTION PASS. UX v3 Loop 2 status: PRODUCTION PASS / CLOSED. SYSTEM QA: PASS. HUMAN QA: ALL PASS. PRODUCTION BROWSER VERIFICATION: PASS.** Pack A (Home 下部 `DEVELOPMENT POLICY`, Support / FANBOX / OFUSE, TateSpun update-history infrastructure) and UX v3 Loop 2 (odd-page export warning) were verified as one combined release candidate and integrated together.

### Release identifiers

| Item | Value |
| --- | --- |
| Production base before release | `9118b38a809bb8f1148a166a11c3ebac119ff5cb` |
| Feature checkpoint | `3674f31c89449a1eff31e76aa85642ea04be5faa` (`feat(beta): add home policy history and odd-page export warning`) |
| Production merge (`origin/master`) | `2fcb77ad1596c1a74b543e2834ee311cfbea7b82` (`merge: release TateSpun Pack A + UX v3 Loop 2`) |
| Cloudflare Pages deployment | `3bd091fc-ea41-4e9e-95a9-f62403a30077` — completed / success / `Deployed successfully` |
| Production | `https://spuntales.net/tatespun/` |

**Release diff:** exactly 14 files = Pack A 8 + Loop 2 6. The merge tree is identical to the checkpoint tree (`git diff --quiet 3674f31 2fcb77a`). Pack A: `public/data/tatespun-update-history.json`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/UpdateHistoryAccordion.tsx`, `src/lib/updateHistory.ts`, `src/lib/updateHistory.test.ts`, `src/lib/preIntegrationUx.vitest.config.ts`, and this roadmap. Loop 2: `src/components/OddPageExportWarning.tsx`, `OddPageExportWarning.test.tsx`, `oddPageWarningCopy.ts`, `oddPageWarningRule.ts`, `oddPageWarningRule.test.ts`, and `src/components/PreviewPane.tsx`.

### System / release evidence

Combined RC: checkpoint blob match PASS; 16 focused tests PASS; ESLint PASS; TypeScript PASS; production build PASS; `git diff --check` PASS. Production: release-branch push PASS; explicit production merge PASS; `origin/master` push PASS; Cloudflare check green. Preview HOME / Editor / Demo / Guide / HOW TO returned HTTP 200; Preview `DEVELOPMENT POLICY` PASS; the Preview update-history JSON was byte-identical to the committed production file.

### Human QA — ALL PASS (combined RC)

`DEVELOPMENT POLICY` shows at the bottom of Home with zero books and with books, identically; the rejected top Product Policy card is absent; Support / FANBOX / OFUSE and the update history display normally; the odd-page warning appears for an odd total and not for an even total; 戻って確認する / このままPDFを書き出す / PDF export behave correctly; PC and mobile show no visible breakage.

### Production browser verification — PASS (2026-09-20, post-release audit)

A real headless Chromium drove the live disposable Demo (`/tatespun/editor?demo=1`, in-memory, no persistence) at a **1280px** viewport. Downloads went to a scratch directory.

- **Odd total (1 body page, no 奥付):** Preview header `全 1 ページ`; PDF setup → ダウンロード opened the warning with title `全体が奇数ページです（全 1 ページ）` and the two actions `戻って確認する` / `このままPDFを書き出す`. `window.confirm` was called **0** times.
- **戻って確認する:** closed only the warning; the PDF setup modal stayed open; **no PDF** was produced.
- **Second ダウンロード → このままPDFを書き出す:** the same warning reappeared; continuing produced **exactly one** PDF, and both modals closed.
- **Even total (2 body pages via `【改ページ】`):** **no warning**; export started immediately and a PDF was downloaded.
- The production Editor surface was observed as the paged (`WINDOWED`) surface. The renderer flag was not probed.
- Not covered by this browser run (unit-tested only, `oddPageWarningRule.test.ts`): 奥付 ON totals and the selected-page scope (never warned).

### Post-deploy automated harness FAIL — not a product failure

The externally authored post-deploy harness failed several times (wrong history-heading search string, `SHA256.HashData` unavailable in Windows PowerShell, unstable JSON entry comparison, reliance on Japanese strings inside minified bundles) and finally timed out waiting for `document.body.innerText.includes('全 1 ページ')` after injecting text into the Demo textarea. **Root cause of the last failure:** the default `innerWidth` of headless Chromium is **764px**, below the Tailwind `md` breakpoint (768px). The Editor then renders the phone layout, where the Preview `<section>` is `max-md:hidden` (`display:none`) until the プレビュー tab is selected (`TategakiEditor.tsx`, `mobileView` defaults to `"editor"`). `innerText` omits non-rendered elements, so the Preview count could never match even though preview state had updated (`textContent` showed `1`). The same injection reached `全 1 ページ` in about 0.5s at 1280px. Loop 2 behavior was never broken. **Countermeasure:** the permanent smoke test below forces a viewport of at least 1280px (browser flag + CDP emulation) and asserts it before doing anything else.

### Permanent production smoke test (explicit-run only)

`npm run test:e2e:production-odd-page` (`tests/e2e/productionOddPageWarning.e2e.mjs`, helper `tests/e2e/helpers/cdp.mjs`). It is **not** part of `npm test` or the build and never runs implicitly. It refuses to run without `TATESPUN_E2E_BASE_URL`, and refuses any non-loopback host unless `TATESPUN_E2E_ALLOW_PRODUCTION=1` is also set. It uses Chrome/Edge over CDP, a disposable profile, the Demo route only, real DOM and real operations (no bundle string search), and touches no DB/Auth/Supabase. It covers: 1 page → warning; 戻って確認する → warning only closes and PDF setup remains; retry → このままPDFを書き出す → exactly one PDF; 2 pages → no warning.

### Update History (§37-E / A7)

- **Infrastructure:** `IMPLEMENTED / PRODUCTION PASS` (A7).
- **§37-E decision for this release (updated: the two entries were added in the Loop 3 checkpoint and are now **live in production** — see §39 / §40):** an entry **is required** for the Loop 2 user-visible change; at the time of this closeout it was **not yet added**. By explicit Human decision on 2026-09-20 there will be **no standalone history-only production release**. The Loop 3 production release will add **two** entries — UX v3 Loop 2 and UX v3 Loop 3. The Loop 2 wording must make clear to users that the PDF-export confirmation changed from a browser `window.confirm` to an explanatory odd-page warning modal. The current JSON has one entry (`26/09/18`, PDF size choices). Until then the §37-E close condition for Loop 2 is carried by the Loop 3 release rather than closed here.

### Roadmap-state changes recorded by this closeout

- A1 (Loop 2) → `PRODUCTION PASS / CLOSED`.
- A6 → `IMPLEMENTED / PRODUCTION PASS`. The canonical placement is the bottom `DEVELOPMENT POLICY` section; the top returning-only Product Policy card proposal is **rejected**.
- A7 → infrastructure `IMPLEMENTED / PRODUCTION PASS`; Loop 2 history entry ships with Loop 3.
- §35 NEXT, §36 Priority, §37-J and the file header were brought current; superseded statements are retained as marked history, not deleted.
- **Soft β target withdrawn.** The fixed date `2026-09-21 12:00 JST` is incompatible with the A4 Day0/1/3/7 gate. **β start condition: UX v3 Loop 3 production release + A4 Day7 PASS**, with the A3 5-minute UX Gate and the A5 Safety OPEN items unchanged. Any date written later must not be earlier than **Loop 3 release date + 7 days**, and a material release change during the soak restarts it (A4).
- **Delivery of this docs change:** this section is held on the feature branch (`claude/tsp-resume-after-loop2`) and ships inside the Loop 3 final release; no separate docs-only production release.

### Preserved state

FQ-04〜09 = CLOSED / PRODUCTION PASS; FRIEND QA = ACTIVE; PUBLIC BETA = NOT YET; 72h cloud-image audit = OPEN; legacy manuscript-loss investigation = OPEN; UX v3 Loop 1 = CLOSED / PRODUCTION PASS; UX v3 Loop 3 = NOT STARTED. The held migration commit `47d66df` remains **unmerged** (it exists only on `design/tatespun-typesetting-v2`). **DB/Auth/Supabase/env/migration mutation: NO.**

**NEXT:** UX v3 Loop 3 — Mobile Shared Export (A2). Not started by this closeout. **STOP** *(Superseded: Loop 3 is implemented on the feature branch and waits at HUMAN_GATE — see §39.)*

## 39. UX v3 Loop 3 — Mobile Shared Export: implementation checkpoint (2026-09-20)

**Status (final, updated after the production release): `PRODUCTION PASS / CLOSED` — see §40. (Earlier states: `HUMAN_GATE` at checkpoint `bcde1d4`; `HUMAN QA PASS / RELEASE READY — NOT DEPLOYED` before release.)** Branch `claude/tsp-resume-after-loop2` (base = production `2fcb77a` + the §38 closeout commit). **PRODUCTION PASS / CLOSED is NOT claimed:** it has not been released yet. (Checkpoint status at commit `bcde1d4` was `HUMAN_GATE`.) DB/Auth/Supabase/env/migration mutation: **NO**. Held migration `47d66df`: **UNMERGED**.

### Root cause / previous limitation

The export UI (書き出し ▾, PDF setup, odd-page warning, progress) lives inside `PreviewPane`. On a phone the Editor view keeps the Preview mounted but `display:none` (`max-md:hidden`), so a writer had to switch to プレビュー before they could export.

**A second, silent trap found while designing this (measured, not assumed):** the LEGACY renderer's JPG/PDF capture (`capturePageToCanvas`) measures the *live* page-card geometry. Driving the existing JPG handler while the Preview is `display:none` "succeeds" without any error and downloads a **2×2px, 759-byte JPEG** (with the Preview displayed: 1135×1600, 108,793 bytes). The V2 renderer's export is DOM-free and was unaffected. Identical PDF sizes for the same text on production and on a local LEGACY build (27,663 bytes vs 436,838 bytes under V2_BETA) indicate (an inference — the Production flag itself was not read) that Production currently runs LEGACY, so simply exposing the existing handlers from the Editor view would have shipped corrupted exports to real users.

### Design (minimal; no second export implementation)

- `src/components/exportMenuEntries.ts` — the single source of the menu's data (ids, labels, order, PDF-unavailable rule). Pure data; handlers are bound to ids in exactly one place inside `PreviewPane`.
- `PreviewPane` — the desktop dropdown now maps that list (same markup/labels/behavior), and a new `ViewportModal` sheet (title 書き出し, `data-editor-export-sheet`) maps the **same** list. Every entry runs the same handler as before (`handleExportJpg` / `…JpgBatch` / `…Zip` / `…ColophonJpg` / `handleOpenPdfModal`), so PDF setup, the Loop 2 odd-page warning (Return / Continue), the 完成前チェックリスト gate, unresolved-image block, progress, cancellation and both renderer paths are the existing ones. It also reports export begin/finish through the existing `beginExport`/`finishExport`.
- `src/hooks/useMobileSharedExport.ts` (state only) + `src/lib/previewExportStage.ts` — while an export runs on the phone layout and the Preview is not the displayed workspace, the Preview section is given layout **off-screen** (`max-md:fixed left-[-200vw]`, viewport-sized) and returns to `display:none` when the export finishes. The user's workspace never changes; no Preview visit, and export availability is not tied to Preview visibility (the stage is applied by the export itself).
- `MobileEditorNav` — a 書き出し ▾ button in the **first** row (next to 本文 / プレビュー), visible in both workspaces, hidden in 集中モード. Measured on the real layout: the second row has no room for a third button, and placing it there wrapped the sticky nav from 82px to 104px on every phone width in normal documents (also while the keyboard is open). In the first row the nav height is unchanged (82px) at 320/375/390/430.
- `TategakiEditor` — ~10 lines of wiring. `globals.css` (FQ-04 keyboard-compact rule), `EditorPane`, `useMobileKeyboardViewport`, focus-mode logic and every export handler/format contract are unchanged.

### Update History (§37-E)

`public/data/tatespun-update-history.json` gained **two `26/09/20` entries**, newest first: UX v3 Loop 3 (スマホでプレビューへ切り替えずに書き出せる) and UX v3 Loop 2 (従来の簡単な確認から、意味と注意点を説明する奇数ページ警告画面へ). `updateHistory.test.ts` asserts every shipped entry parses (none silently dropped), same-day ordering, and the Loop 2 wording. They reach users only with the Loop 3 production release (no standalone history release, per the 2026-09-20 decision).

### System QA (2026-09-20)

- Unit/structure tests: `src/components` 84/84 (24 new: desktop regression, mobile accessibility, shared contract, Loop 2 rule matrix incl. colophon parity and selected-scope, modal reuse, FQ-04/集中モード guards); `src/lib` 372/373 (11 new/extended); `v2Bridge` 74/74; `editorSessionActivity` 67/67; `hooks` 22/22; `preIntegrationUx` 580 passed / 1 failed / 1 skipped. The single failure in the `src/lib` and `preIntegrationUx` runs is the **pre-existing** `exportCancellation.test.ts` "topmost Escape" mismatch (already stale before Loop 1; out of scope, not touched).
- TypeScript PASS; changed-file ESLint: no new finding (the 3 findings in `TategakiEditor.tsx` are identical to `HEAD`); `git diff --check` clean; `npm run build:basepath` PASS (Supabase gate: backend ref unchanged, cross-database audit skipped — read-only).
- New explicit-run real-browser E2E `npm run test:e2e:mobile-shared-export` (`tests/e2e/mobileSharedExport.e2e.mjs`, helper `tests/e2e/helpers/editorSession.mjs`; local/loopback only unless explicitly allowed): viewports **320×568, 375×667, 390×844, 430×932, 768×1024, 1280×720**. PASS on LEGACY+WINDOWED, LEGACY+FULL, **V2_BETA+WINDOWED**, and on the **static production build** (`out/tatespun`). It proves: entry visible/tappable/in-viewport with the Preview `display:none`; nav height unchanged; sheet and modals inside every phone viewport; desktop dropdown = phone sheet list; PDF odd → warning → return → continue = exactly one PDF, even = none; JPG/JPG一括/JPG ZIP valid and full-size; the phone Editor-view PDF is byte-comparable to the desktop PDF of the same text; progress overlay visible while exporting from the Editor view; FQ-04 keyboard-compact chrome, 集中モード and Preview view unchanged; `window.confirm` never used. A negative run with the off-screen stage disabled **fails** on the 2×2px JPEG, as intended.
- Regressions: `production-odd-page` E2E PASS (dev and static build); `editorInputIntegrity` PASS. `editorSessionActivity` FAILS at an early "現在の原稿文字数" snapshot both here and on the untouched `2fcb77a` baseline (pre-existing, unrelated; out of scope).
- Test side effects: the full `preIntegrationUx` run rewrites the tracked QA artifact `typesetting-v2/qa/publication/p3-o08/typography-parity-final-human-recheck-v2.pdf`; it was restored and is not part of the checkpoint.

### Human QA — PASS (2026-09-20, desktop Chrome DevTools device emulation)

Confirmed by the Human: 390px Editor view exports without switching to the Preview; the phone export sheet; PDF setup; odd-page warning; Return / Continue; **exactly one PDF** generated; JPG is a normal full image (not tiny/corrupt); Focus Mode; the Preview's own existing export; the desktop existing export; 320px nav and modal operation; the Home Update History shows the Loop 3 and Loop 2 entries.

- **Physical smartphone, software keyboard open: NOT TESTED.** "The 書き出し ▾ entry remains while the on-screen keyboard is open" was not observed by a human because DevTools emulation cannot reproduce a physical software keyboard.
- **Automated real-browser keyboard/compact regression: PASS.** At 390×844 in a real browser with the FQ-04 `data-keyboard-active` compact layout engaged, the export entry stays reachable, the compact layout is maintained, and the nav height does not regress (82px). The Human judged the un-observed item **not a release blocker**; FQ-04's keyboard open/close recovery therefore rests on this automated evidence plus FQ-04's own prior Production Human PASS (§27), and remains a candidate for opportunistic real-device observation.

### Open items / observations (not changed here)

- **Human QA (A2 acceptance): PASS** (see above). Still un-observed by a human: physical-smartphone software-keyboard-open (NOT TESTED; automated keyboard/compact regression PASS).
- Pre-existing V2 latent race (unrelated to this loop): exporting JPG within ~100ms of switching the Preview to visible can alert "V2 JPG export could not resolve the selected canonical pages." (apparently the page plan rebuilding when the Preview becomes visible; a 1.5s settle in the E2E removes it). Not reachable at human interaction speed; recorded for awareness.
- At 320×568 the manuscript area is only ~37px tall in the Demo **before and after** this change (measured identical); FQ-04's keyboard-compact rule addresses typing, and Loop 3 adds no vertical space.

**NEXT:** *(Superseded — released; see §40.)* **STOP**

## 40. UX v3 Loop 3 Production Closeout + A4 Day0 (2026-09-20)

**UX v3 Loop 3 status: PRODUCTION PASS / CLOSED. SYSTEM QA: PASS. HUMAN QA: PASS. PRODUCTION BROWSER SMOKE: PASS.** **A4 7-day unattended gate: DAY0 STARTED. PUBLIC BETA: NOT YET.** Loop 3 (Mobile Shared Export, A2) is released together with the §38-era closeout/test infrastructure, the Loop 3 Human QA record, and the two Update History entries (UX v3 Loop 2 + UX v3 Loop 3).

### Release identifiers

| Item | Value |
| --- | --- |
| Production base before release | `2fcb77ad1596c1a74b543e2834ee311cfbea7b82` (§38) |
| Loop 3 feature checkpoint | `bcde1d42ce2ee4e8e1d2fc463470b7af8a1b3560` (`feat(ux-v3): add mobile shared export access`) |
| Pre-release docs commit (Human QA record) | `6afcaeccefa3fa5500d490c63a0673c257985286` = feature branch `claude/tsp-resume-after-loop2` HEAD, pushed to `origin` (no force) and verified equal to the local SHA |
| Release branch | `release-master/tsp-ux-v3-loop3-20260920`, created from `origin/master` in an isolated worktree (local `master` never used) |
| Production merge (`origin/master`) | `9b3c228108a0c56d041b219e465d27138add2219` (`merge: release TateSpun UX v3 Loop 3 mobile shared export`), `--no-ff`, parents `2fcb77ad…` + `6afcaecc…` |
| Cloudflare Pages deployment | ID `d58a371b-59a7-4e00-a7fe-418bdb22768e`, preview `https://d58a371b.tatespun.pages.dev`; check run for the exact commit `9b3c228`: completed / success / `Deployed successfully` |
| Production | `https://spuntales.net/tatespun/` |

**Release diff (vs `2fcb77a`): exactly 16 files** — Loop 3 product code (`PreviewPane.tsx`, `TategakiEditor.tsx`, `MobileEditorNav.tsx`, `exportMenuEntries.ts`, `useMobileSharedExport.ts`, `previewExportStage.ts`), `public/data/tatespun-update-history.json`, tests and explicit-run E2E infrastructure (`mobileSharedExport.test.ts`, `previewExportStage.test.ts`, `updateHistory.test.ts`, `tests/e2e/helpers/{cdp,editorSession}.mjs`, `mobileSharedExport.e2e.mjs`, `productionOddPageWarning.e2e.mjs`), `package.json` (two explicit scripts), and this roadmap. The merge tree is identical to the feature-branch tree, and the product/test/data files are identical to the Human-QA'd checkpoint `bcde1d4`. No DB/Auth/Supabase/migration/env/wrangler/QA-artifact path is in the diff.

### Release gate (re-run on the feature HEAD and again on the production merge tree)

`src/components` 84/84; `src/lib` 372/373; TypeScript PASS; changed-file ESLint = the 3 pre-existing `TategakiEditor.tsx` findings only (identical to `HEAD` before Loop 3, no new finding); `git diff --check` clean; `npm run build:basepath` PASS (Supabase gate: backend ref unchanged, cross-database audit skipped — read-only). **Known out-of-scope items, not release blockers and not touched:** `exportCancellation.test.ts` "topmost Escape" (1, pre-existing since before Loop 1); project-wide ESLint (82 pre-existing errors); the `editorSessionActivity` E2E failure (reproduced on the untouched `2fcb77a` baseline). No new failure was introduced by this change.

**Observation (pre-existing, not a blocker):** the legacy GitHub Actions workflow `Deploy to GitHub Pages` (`build` job) fails on every push — including the previous six releases — because that workflow has no `NEXT_PUBLIC_SUPABASE_URL` and the Supabase project guard rejects it. Production is served by Cloudflare Pages, which passed for the exact commit.

### Human QA — PASS (recorded before release; see §39)

390px Editor view exports without switching to the Preview; mobile export sheet; PDF setup; odd-page warning; Return / Continue; exactly one PDF; JPG is a normal full image; Focus Mode; Preview-side and desktop existing exports; 320px nav/modal; Home Update History shows both entries. **Physical smartphone software-keyboard-open observation: NOT TESTED** (DevTools emulation cannot reproduce it). **Automated real-browser keyboard/compact regression: PASS** (export entry reachable, compact layout maintained, nav height unchanged at 390px). Judged not a release blocker by the Human.

### Production smoke — PASS (2026-09-20, after deploy)

- **HTTP 200:** HOME `/tatespun/`, Editor `/tatespun/editor`, Demo `/tatespun/editor?demo=1`, Guide `/tatespun/guide`, HOW TO `/tatespun/howto`. The HOME HTML on `spuntales.net` is byte-identical to the deployment preview `d58a371b` (production is serving this deployment).
- **HOME (real Chrome DOM, 1280px):** `DEVELOPMENT POLICY` visible (heading 「TateSpunは、使いながら育てています。」); Support section visible; Update History opened with a real click and its rows read from the DOM: `26/09/20` UX v3 Loop 3 entry, `26/09/20` UX v3 Loop 2 entry, then `26/09/18` — order and text as shipped. **Update History production PASS (2 entries).**
- **Loop 2 production browser E2E** (`TATESPUN_E2E_BASE_URL=https://spuntales.net/tatespun TATESPUN_E2E_ALLOW_PRODUCTION=1 npm run test:e2e:production-odd-page`, values taken from the script's own usage header): **PASS** — 1 page → warning; 戻って確認する closes only the warning and keeps PDF setup; retry → このままPDFを書き出す = exactly 1 PDF; 2 pages → no warning.
- **Loop 3 production browser check** (390×844, real Chrome, disposable profile, Demo route only; a repo-external read-only probe, because the repo `mobileSharedExport` E2E also opens the normal `/editor` route and was therefore not pointed at production): Editor view with 本文 active; Preview `display:none`; mobile 書き出し ▾ visible (79×30) and hit-testable inside the viewport; a real pointer tap opens the export sheet inside the viewport (JPG / JPG一括 / JPG ZIP / PDF); PDF setup reachable from the Editor view; **JPG exported from the Editor view = 1135×1600, 108,793 bytes** (not the 2×2px image the pre-Loop-3 code produced) — byte-identical to the local LEGACY Preview-visible export, which also confirms Production runs the LEGACY renderer and the off-screen capture stage works there; afterwards the workspace is still 本文 and the Preview `display:none` again (never visited); no native dialogs. Only client-side actions; no sign-in, no server write.

### A4 — 7-day unattended gate: DAY0 STARTED

- **Day0 = 2026-09-20 (JST)** — the Loop 3 production release day (Cloudflare deploy completed ≈19:40 JST). **Frozen RC = production merge `9b3c228` / deployment `d58a371b`.**
- Observation days (Human, per §37-A4): **Day1 = 2026-09-21, Day3 = 2026-09-23, Day7 = 2026-09-27.** Day7 = 2026-09-27 is the earliest date a Day7 PASS can exist. The Day0 observation results themselves are recorded by the Human; this entry records only the start and baseline.
- Soak rules in force: no product deploy, no manual DB/storage repair, no manual data rescue; a material release change, RC replacement, data repair or manual rescue restarts the soak. The docs-only closeout commit that follows this section does not change the product tree (verified against `9b3c228`).

### Status after this closeout

- UX v3 Loop 1 / Loop 2 / **Loop 3** = CLOSED / PRODUCTION PASS. Pack A = PRODUCTION PASS.
- **PUBLIC BETA = NOT YET.** The beta-start condition is unchanged (§38): Loop 3 production release (done) **+ A4 Day7 PASS**, with the A3 5-minute UX Gate and the A5 Safety OPEN items (72h cloud-image audit; legacy manuscript-loss investigation) still open. **A4 Day7 PASS has not happened, so the beta-start condition is NOT met.**
- FQ-04〜09 = CLOSED / PRODUCTION PASS; FRIEND QA = ACTIVE.
- Held migration `47d66df`: **UNMERGED** (not an ancestor of the production merge). **DB/Auth/Supabase/env/migration mutation: NO.**

**NEXT:** A4 Day1 observation (2026-09-21, Human); prepare the A3 5-minute UX Gate and the A5 decisions. No product deploy during the soak. **STOP**

# TateSpun β Unified Roadmap

- Updated: 2026-09-14
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

**FQ-04 status: KEYBOARD COMPACT FIX DEPLOYED / PRODUCTION HUMAN QA PENDING.** Not CLOSED — only an explicit Human PASS on the real device (confirming the textarea is actually usable with the keyboard open, not just the numeric estimate) can close this.

**NEXT (single action):** Human repeats the real-device Production check with `?viewportDebug=1` on the real project that failed before: keyboard closed (confirm normal Editor unchanged — Header/title/secondary row all visible), keyboard open (confirm `vv`/shell still ≈435, Header/title/secondary row now hidden, textarea top moves substantially upward, textarea height grows substantially past ~91px, typing several lines feels practical, caret movement/scroll works), then keyboard close (confirm all three rows return exactly, with Settings/Options/Memo/Help still functioning). Also quick-check: Focus Mode ON/OFF, keyboard reopen, no horizontal overflow. Do not mark FQ-04 CLOSED/PASS until that Human confirms actual usable layout — the numeric estimate above is not a substitute for that check.

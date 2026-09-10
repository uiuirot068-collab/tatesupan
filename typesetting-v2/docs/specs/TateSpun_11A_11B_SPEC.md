# TateSpun 11-A / 11-B Specification v1.8
Updated: 2026-09-11
Revision reason: record the approved Beta RC limited Pause/Resume extension without reopening the Human-passed 11-B counting semantics.

## 11-A correction / recovered historical authority

The historical TateSpun roadmap already contained an unnumbered future item:
**文章チェックβ v2 — 縦書き・入稿向け原稿チェック**

Its intended categories were:

1. 約物 / punctuation
2. 段落・空白 / paragraph & whitespace
3. 縦書き文字 / vertical-writing character issues
4. TateSpun notation errors
5. 表記 / dictionary / NG-word features

The historical richer finding/fix model also included a **fix-class** concept:

- `SAFE_AUTO_FIX`
- `REVIEW_BEFORE_FIX`
- `NOTICE_ONLY`

This is distinct from severity. A diagnostic may be high-confidence yet still be NOTICE_ONLY, or may have a safe mechanical replacement.

### Current implementation state

11-A Phase 1 is COMPLETE (`26eef0f`):
- reusable local rule engine
- current bracket/punctuation/TCY/ruby rules
- structured diagnostic schema
- HIGH_CONFIDENCE / REVIEW severity
- UTF-16 offsets
- IME/privacy/build regression coverage

11-A Phase 2 is COMPLETE:
- fix-class model implemented: `SAFE_AUTO_FIX` / `REVIEW_BEFORE_FIX` / `NOTICE_ONLY`, a required field on every diagnostic, independent of `severity` (a diagnostic can be HIGH_CONFIDENCE yet NOTICE_ONLY, exactly as this spec's own §11-A correction anticipated)
- paragraph/whitespace category: R6 trailing whitespace (SAFE_AUTO_FIX), R7 leading tab+ideographic-space mixing (REVIEW_BEFORE_FIX), R8 3+ consecutive blank lines (NOTICE_ONLY, REVIEW severity, **disabled by default** -- blank-line conventions vary by author/genre, a real style question left for a later Human decision on defaults)
- vertical-writing character category (partial): R4 half-width katakana detection (REVIEW_BEFORE_FIX, no computed replacement text yet -- a real conversion table is deferred to whenever the Fix UI itself is built), R5 stray control characters (SAFE_AUTO_FIX)
- per-rule configuration contract: `WritingCheckConfig.ruleOverrides` (additive, flips specific rules relative to the engine's own default set) alongside Phase 1's `enabledRuleIds` (absolute whitelist, unchanged)
- rule IDs remain stable/deterministic (explicit regression test), replacement ranges verified safe across emoji/ruby/TCY/multiline/CRLF context
- explicit no-mutation regression tests added

Deliberately NOT attempted in Phase 2 (real false-positive/product-judgment risk without further guidance):
- "excessive indentation" (no reliable existing contract defines an invalid threshold -- this spec's own caution against assuming "one ideographic space is always mandatory")
- ASCII punctuation with a full-width equivalent (URL/code/deliberate-Latin false-positive risk)
- half-width katakana's own auto-conversion replacement text

11-A Phase 3 is COMPLETE / Human QA PASS (checkpoint 2026-09-09, HEAD `97b3df7`):
- remaining rule catalog closed: R9 ellipsis form review (…/……/・・・/..., REVIEW_BEFORE_FIX), R10 dash form review (―/――/―――, REVIEW_BEFORE_FIX for a solo dash, NOTICE_ONLY for 3+), R4 half-width katakana now carries a REAL `suggestedReplacement` (a genuine JIS X 0201↔X 0208 conversion table including dakuten/handakuten combining and the real ウ→ヴ exception) and is promoted to `SAFE_AUTO_FIX`
- category 5 (表記/dictionary/NG-word) implemented: R11 表記ゆれ dictionary and R12 NG words, both parameterized by user-local entries (`WritingCheckConfig.dictionary`/`.ngWords`), both dictionary-safety-aware -- a match overlapping ruby/TCY/image/page-break notation (via the SAME `tokenizeTategakiWithOffsets` the v2Bridge manuscript adapter reuses, never a second parser) is still reported but never offered an automatic replacement
- 3 Human-approved presets, exact verbatim names: 入稿前おすすめ (engine defaults + R8 blank-run + dictionary/NG), 記号だけ (punctuation/notation structural rules only), しっかりチェック (every rule on)
- RED (原稿事故・高確度) / YELLOW (確認推奨) severity surfaced in the UI with BOTH colour and a text label (never colour alone) -- independent of `fixClass`, exactly as this spec's own §11-A correction anticipated
- explicit 直す (single-diagnostic Fix; re-validates the current source substring against the diagnostic's own `originalText` snapshot before ever mutating -- refuses and reruns diagnostics instead if stale), 無視 (occurrence-level, in-memory only, never persisted, naturally forgotten on reload), 安全な項目をまとめて直す (SAFE_AUTO_FIX-only, descending-offset, overlap-safe bulk apply)
- narrowest-possible one-step 元に戻す (undo) -- holds only the manuscript state immediately before the last automated change, cleared the instant the user makes any further manual edit; no general history engine was built
- 文章チェック設定 modal: preset selector, categorized per-rule toggles, わたしの辞書 / NGワード CRUD -- all three new persistence hooks are localStorage-only (`useSyncExternalStore`, matching `useWritingCheckEnabled.ts`'s existing convention), never transmitted anywhere
- output isolation is now a machine-verified proof, not merely an architectural claim: a static scan of every source file under `typesetting-v2/` (Core/Publication/Preview/export) confirms none of them reference the writing-check engine at all
- privacy static scan extended to cover every new Phase 3 file (the existing recursive scan picks up new engine files automatically; the new hooks/UI files outside the engine directory are covered by an explicit file list)

Deliberately NOT attempted in Phase 3:
- "excessive indentation" threshold rule (still no reliable existing contract)
- ASCII punctuation → full-width auto-conversion (still a URL/code/deliberate-Latin false-positive risk)
- React-hook-level automated tests for the 3 new localStorage hooks -- this repo has no jsdom/testing-library dependency and no existing hook-test precedent (`useWritingCheckEnabled.ts` itself has none); adding one requires Human approval per the standing no-new-dependency rule, so this is covered by Human QA on the real Editor instead

### Product principles preserved

- textarea remains manuscript source of truth
- browser-local processing
- no automatic external AI/API manuscript transmission
- no silent mutation -- a fix (single or bulk) only ever applies in direct response to an explicit click
- output PDF/JPG/Preview must not contain diagnostics -- now machine-verified (see output isolation proof above)
- explicit Human actions are required for manuscript modification

### β boundary -- resolved

Human decision (Phase 3 task): category 5 dictionary/NG-word/user-dictionary functionality IS included in β, local/browser-side only, no manuscript transmission, no external AI/API.

Presets, Fix/Ignore UI, and safe bulk fix are implemented (see above).

### Human QA (2026-09-09) -- PASS

Confirmed on the real Editor: preset switching (入稿前おすすめ/記号だけ/しっかりチェック), RED/YELLOW diagnostic display, individual 直す, 元に戻す, 無視, SAFE_AUTO_FIX-only bulk correction (ellipsis/dash are not silently auto-fixed), わたしの辞書 add/detect/fix, NGワード add/detect, and Preview/PDF/JPG isolation. A real blocking bug was found and fixed during this QA pass (`useSyncExternalStore` snapshot-identity loop in the 3 localStorage persistence hooks, triggered by selecting 記号だけ -- see `docs/roadmap/TateSpun_BETA_UNIFIED_ROADMAP.md`'s own 11-A Phase 3 entry and commit `97b3df7`).

A non-blocking Human polish backlog (visual/UI refinements, Help TOC, and TOC-dialog alignment) was recorded without reopening this Phase 3 closure. The later development-only checklist/UI-C work and the Typography Parity follow-up have since passed their applicable Human gates; their current β disposition is authoritative in `docs/roadmap/TateSpun_BETA_UNIFIED_ROADMAP.md`.

### Development-only follow-up checkpoint (2026-09-09)

The safely frozen local portion of 完成前マイチェックリスト is implemented in `typesetting-v2/tools/human-e2e-editor/`, directly beside Memo in the development Editor toolbar. Its versioned model provides three editable presets, reusable personal lists, editable check state/text/name, reset, and defensive localStorage restoration. It has no manuscript dependency, cloud/database client, or external transmission. Status: **IMPLEMENTED / HUMAN PASS IN DEVELOPMENT**; placement in the real Editor remains a **PRODUCTION INTEGRATION GATE**.

The same development Editor implements the approved UI-C drawer interaction, Memo/actions, manual page break, and browser JPG actions from the current Canonical PaintPlan; these applicable development surfaces are **HUMAN PASS**. Help top TOC and TOC-dialog alignment are now implemented in the real Editor and await only their focused Human UX check. Writing Check visual polish remains a separate **BETA REQUIRED / PRODUCTION INTEGRATION GATE**. This does not reopen 11-A detection/fix semantics or its Human PASS.

---

## 11-B work-session tracker — superseding specification

Historical source: Master §9.2 `Session Editing Metrics`.

Status: **CORE CLOSED / FORMAL HUMAN PASS (2026-09-10); PAUSE/RESUME BETA RC LIMITED EXTENSION IMPLEMENTED / HUMAN QA PENDING.** Existing counting, Start/End, share/history, result/history presentation, compact Ruby/TCY help, and Undo/Redo semantics remain frozen. Only the additive Pause/Resume lifecycle and active-time behavior are reopened for focused Human QA.

Human QA produced two product corrections. First, the automatic browser-tab/session lifecycle was superseded by explicit Human-started work sessions. Second, the inserted+deleted mutation-activity total was superseded by a newly written text total. Both implementations matched their then-current specifications; these are product-semantics corrections, not incidental E2E bugs.

### Purpose and unit

- Measures **how many new text characters the Human wrote/inserted during an explicit work session**, not final manuscript length, net growth, total mutations, browser-tab lifetime activity, or automatic all-day activity.
- Every quantity is a Unicode code-point count.
- Only newly inserted user-authored text adds positively. Deletion never subtracts, but also never adds.
- Replacement and paste-over-selection count only the inserted side.
- The compact Editor UI uses `作業スタート`, `作業中`, `一時停止`, `一時停止中`, `作業を再開`, `今回書いた文字数`, `実作業時間`, and `作業終了`. The existing `現在の原稿文字数` remains separately visible.
- The Editor footer keeps Ruby/TCY help on one compact ellipsized line. Its full explanation is exposed by the native hover title and accessible name, and activation opens a lightweight body-portal dialog for keyboard/touch users without permanently enlarging the footer.
- Visible `↶ 元に戻す` and `↷ やり直す` controls invoke the textarea's existing native history; Ctrl/Cmd+Z and platform redo remain available, and every Undo/Redo path adds 0.

### Counted operations

- Ordinary typing and pasted text count their inserted code points. Paste over a selection counts only the pasted text.
- IME composition updates/intermediate conversion count 0. Composition end counts its final committed text delta exactly once. Cancellation counts 0.
- Directly typed ruby source and directly typed structural-token text count normally.
- A future Ruby UI may count user-entered textual fields' inserted side, while generated markup/structural transformation remains excluded.
- User-edited textual image captions or related manuscript text count normally.

### Exclusions

- Backspace, Delete, selection deletion, and Cut count 0 and never decrement the accumulated total.
- Undo and Redo count 0 and never decrement the accumulated total.
- Dedicated UI insertion/removal or rewriting of page-break structure counts 0.
- Image insertion/removal and generated/rewritten image structural tokens count 0.
- Writing Check automatic fixes/replacements, analysis, `無視`, dictionary settings, and NG-word settings count 0.
- Search/replace, generated book parts, automatic formatting, and other programmatic manuscript mutations count 0.
- Loading/opening existing manuscripts, import, normalization, internal migrations, autosave, Preview/typesetting recomposition, and Publication/PDF/JPG generation count 0.

### Work-session lifecycle and persistence

- IDLE is the default. Editing while idle does not accumulate into any work session.
- Selecting `作業スタート` creates a new active session at 0 with a stable id and current `startedAt`. Selecting Start while already active does not replace or reset it.
- Only newly inserted user-authored text occurring while ACTIVE adds to `writtenCharacterCount`. All input while PAUSED adds 0; the separate current manuscript count continues to follow the real document.
- `一時停止` preserves the existing session id/count and freezes active duration. `作業を再開` re-anchors input tracking to the current manuscript before returning to ACTIVE, so paused-period edits never count retroactively. Multiple pause cycles remain one work session.
- Active duration is derived from `startedAt`, accumulated completed pauses, and the current `pausedAt`; paused wall time is excluded. There is no per-second persistent write or event log.
- A normal reload/navigation restore keeps the same id, start time, count, status, `pausedAt`, and accumulated paused duration from `localStorage`. A paused session never silently resumes.
- Selecting `作業終了` stops accumulation immediately and appends one completed metadata-only record containing `id`, `startedAt`, `endedAt`, `durationMs`, and `writtenCharacterCount`.
- Ending while paused is valid: `endedAt` is the actual End action time while `durationMs` contains active work time only. Pause/Resume never create history rows.
- Result and history use the same body-portal, viewport-centered modal shell independent of Editor/footer overflow. Header/actions remain fixed and the bounded body scrolls internally. Result shows activity, duration, start time, and end time and retains copy/X actions. History shows date/time, duration, written count, and each record's X action, never manuscript text. Both support explicit/Escape/backdrop close. Closing either modal does not delete history. Later idle edits cannot change the result. A later Start creates a new session at 0 while preserving completed history.
- Completed history is local-only, capped at the latest 100 records, and evicts the oldest first. No cloud synchronization, analytics, database, manuscript text, or mutation event log is used.

### Share contract

- Result and history records expose `Xでシェア`; the result also exposes `テキストをコピー`.
- The canonical text is exactly `今日は{writtenCharacterCount}文字がんばりました！\n#TateSpun\nhttps://spuntales.net/tatespun/`, with the written count grouped for Japanese display (for example `4,823`).
- X uses the ordinary intent flow with that text prefilled. Share and history data never contain manuscript text.

### Implementation boundary and verification

- Pure policy/input-state/store code lives under `src/lib/editorSessionActivity/`; the React hook and compact Editor UI live under `src/hooks/` and `src/components/`.
- The tracker remains outside Core typesetting, Canonical Layout, Preview layout, Publication output, Ruby, TCY, Typography, and Writing Check semantics. A static isolation test enforces this boundary.
- 63 deterministic 11-B/UI tests cover the frozen written-count semantics plus Pause/Resume state, paused input/IME exclusion, resume baseline, active-time accounting, reload/navigation recovery, legacy defaults, single-record history, isolation, responsive controls, and the shared viewport-modal contract. The existing `/editor?demo=1` browser E2E remains the visual regression baseline. No new dependency was introduced.

### Formal close record

The Human final pass confirms Start/End, newly-written-only counting (including delete/cut/Undo/Redo = +0 and inserted-side replacement/paste), reload recovery, history, X/copy sharing, result/history dialogs at desktop and narrow widths, compact Ruby/TCY help, and visible functional Undo/Redo. Those 11-B semantics and Ruby remain **CLOSED / HUMAN PASS**. The additive Pause/Resume extension is **IMPLEMENTED / HUMAN QA PENDING** and does not reopen the closed behavior.

---

## Prompt ownership

ChatGPT owns implementation-prompt creation and review.
Claude Code / Cursor is the implementation/audit agent.

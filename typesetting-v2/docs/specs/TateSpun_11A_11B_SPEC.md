# TateSpun 11-A / 11-B Specification v1.3
Updated: 2026-09-09
Revision reason: Human QA superseded 11-B's browser-session product definition with an explicit work-session tracker.

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

A non-blocking Human polish backlog (visual/UI refinements, Help TOC, TOC-dialog alignment, 完成前マイチェックリスト, UI-C settings-drawer integration) and a separate open Typography Parity follow-up (InDesign character-pitch comparison) were recorded in the roadmap; neither blocks this Phase 3 closure.

### Development-only follow-up checkpoint (2026-09-09)

The safely frozen local portion of 完成前マイチェックリスト is implemented in `typesetting-v2/tools/human-e2e-editor/`, directly beside Memo in the development Editor toolbar. Its versioned model provides three editable presets, reusable personal lists, editable check state/text/name, reset, and defensive localStorage restoration. It has no manuscript dependency, cloud/database client, or external transmission. Status: **IMPLEMENTED / HUMAN QA PENDING**; placement in the real Editor is a **PRODUCTION INTEGRATION GATE**.

The same development Editor implements the approved UI-C drawer interaction and browser JPG actions from the current Canonical PaintPlan. Writing Check visual polish, Help TOC, and TOC-dialog alignment remain a **PRODUCTION INTEGRATION GATE** because their owning components are under Production `src/`, which this run was explicitly forbidden to modify. This does not reopen 11-A detection/fix semantics or its Human PASS.

---

## 11-B work-session tracker — superseding specification

Historical source: Master §9.2 `Session Editing Metrics`.

Status: **IMPLEMENTED / HOLD FOR FOCUSED HUMAN QA (2026-09-09).**

The earlier automatic browser-tab/session lifecycle was implemented correctly against its then-current contract. Human QA established that the contract itself did not match the intended product. That product definition is therefore **SUPERSEDED**, not classified as an accounting-code bug. The mutation-accounting semantics below remain valid and are reused.

### Purpose and unit

- Measures editing **activity during an explicit Human-started work session**, not final manuscript length, net growth, browser-tab lifetime activity, or automatic all-day activity.
- Every quantity is a Unicode code-point count.
- Insertions and deletions each add positively; replacement is the full deleted operand plus the full inserted operand.
- `totalActivity = insertedCodePoints + deletedCodePoints`.
- The compact Editor UI uses `作業スタート`, `作業中`, `今回の編集量`, `経過時間`, and `作業終了`. The existing `現在の原稿文字数` remains separately visible.

### Counted operations

- Ordinary typing, Delete, Cut, Select-All Delete, and Paste count their actual inserted/deleted code points. Paste over a selection counts both sides.
- IME composition updates/intermediate conversion count 0. Composition end counts its final committed text delta exactly once. Cancellation counts 0.
- Undo/redo count the actual resulting manuscript mutation in the direction it occurs.
- Directly typed ruby source and directly typed structural-token text count normally.
- A future Ruby UI counts user-entered base/readings (including their explicit replacements) but excludes generated markup/structural transformation.
- Explicit Writing Check `直す` and SAFE bulk fix count every applied deleted+inserted operand. Undoing such a fix counts the inverse resulting mutation.
- Search/replace counts each actual replacement's full deleted+inserted operands.
- User-edited textual image captions or related manuscript text count normally.

### Exclusions

- Dedicated UI insertion/removal or rewriting of page-break structure counts 0.
- Image insertion/removal and generated/rewritten image structural tokens count 0.
- Writing Check analysis, `無視`, dictionary settings, and NG-word settings count 0.
- Loading/opening existing manuscripts, import, normalization, internal migrations, autosave, Preview/typesetting recomposition, and Publication/PDF/JPG generation count 0.

### Work-session lifecycle and persistence

- IDLE is the default. Editing while idle does not accumulate into any work session.
- Selecting `作業スタート` creates a new active session at 0 with a stable id and current `startedAt`. Selecting Start while already active does not replace or reset it.
- Only actual manuscript mutations occurring while ACTIVE add to `editingActivity`. Elapsed time is derived from `startedAt`; there is no per-second persistent write or event log.
- A normal reload restores the same active id, start time, active state, and aggregate activity from `localStorage`.
- Selecting `作業終了` stops accumulation immediately and appends one completed metadata-only record containing `id`, `startedAt`, `endedAt`, `durationMs`, and `editingActivity`.
- The result shows activity, duration, start time, and end time. Later idle edits cannot change it. A later Start creates a new session at 0 while preserving completed history.
- Completed history is local-only, capped at the latest 100 records, and evicts the oldest first. No cloud synchronization, analytics, database, manuscript text, or mutation event log is used.
- No pause state is introduced in this beta iteration.

### Share contract

- Result and history records expose `Xでシェア`; the result also exposes `テキストをコピー`.
- The canonical text is exactly `今日は{editingActivity}文字がんばりました！\n#TateSpun\nhttps://spuntales.net/tatespun/`, with the activity number grouped for Japanese display (for example `4,823`).
- X uses the ordinary intent flow with that text prefilled. Share and history data never contain manuscript text.

### Implementation boundary and verification

- Pure policy/input-state/store code lives under `src/lib/editorSessionActivity/`; the React hook and compact Editor UI live under `src/hooks/` and `src/components/`.
- The tracker remains outside Core typesetting, Canonical Layout, Preview layout, Publication output, Ruby, TCY, Typography, and Writing Check semantics. A static isolation test enforces this boundary.
- 33 deterministic 11-B tests cover mutation semantics plus all 18 required work-session/storage/history/share/isolation cases. The actual `/editor?demo=1` browser E2E covers idle → Start at 0 → type/increase → End/result → reload/history. No new dependency was introduced.

---

## Prompt ownership

ChatGPT owns implementation-prompt creation and review.
Claude Code / Cursor is the implementation/audit agent.

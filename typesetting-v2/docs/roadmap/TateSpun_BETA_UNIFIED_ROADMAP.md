# TateSpun β Unified Roadmap
Updated: 2026-09-09
Status: ChatGPT / Claude reconciliation baseline

## 1. Authority rule

This roadmap reconciles:
- historical v2 roadmap/docs
- current repository/commit state
- recent Human decisions
- newly added β requirements

Status labels:
- COMPLETE
- IN_PROGRESS
- NOT_STARTED
- HUMAN_GATE
- DEFERRED_POST_BETA

Historical docs remain evidence, but stale statuses are superseded by later verified commits/Human QA.

---

## 2. Current verified completion

### Typesetting / Publication foundation

- P3-O01 Kinsoku class table: COMPLETE
- P3-O02 Dash/Ellipsis primary source: COMPLETE
- P3-O03 TCY visual renderer: COMPLETE / Human PASS
- P3-O04 Dash visual alignment: COMPLETE / Human PASS
- P3-O05 Ellipsis visual alignment: COMPLETE / Human PASS
- P3-O09 Preview renderer foundation: COMPLETE / Human PASS
- P3-O12 Capacity/margin formula: COMPLETE
- Folio / Header: COMPLETE / Human PASS
- Structural Colophon: COMPLETE / Human PASS
- Real Image Embedding PNG: COMPLETE
- Transparent PNG: COMPLETE
- JPEG real-image embedding: COMPLETE
- Image sizing/aspect/placement fix: COMPLETE / Human PASS
- JPG Node reference engine: COMPLETE
- Browser-native JPG renderer PoC: COMPLETE / Human PASS
- Live Editor → v2 Publication state bridge: COMPLETE
- Writing Check β 2.0 Phase 1: COMPLETE
- Writing Check β 2.0 Phase 2: COMPLETE
- Writing Check β 2.0 Phase 3: COMPLETE / Human QA PASS

Important: P3-O08's historical document status is stale. Many of its subtracks are complete, but overall production migration/acceptance is not yet closed.

---

## 3. Known open product/architecture gates

### GATE-A — TCY auto-detect threshold (P3-O07)
Status: HUMAN_GATE
Decision: 2-digit vs 4-digit auto-detect threshold.
Reason: blocks final TCY rule freeze.

### GATE-B — Ruby contracts
Status: HUMAN_GATE / partially open
Includes:
- P3-O06 numeric ruby overhang budget
- P3-O14 jukugo-ruby segmentation mechanism
- P3-O15 group-ruby break/distribution if required for β acceptance

### GATE-C — Bleed / trim β policy
Status: HUMAN_GATE
Historical roadmap expected bleed/trim porting.
Current v2 canonical page has no separate bleed geometry; current print JPG crop is therefore a disclosed no-op.
Need explicit β product decision:
- β intentionally supports trim-page-only output, or
- add a true bleed/trim model before β.

### GATE-D — PDF production integration path
Status: HUMAN_GATE / architecture
Current app is static/browser-based.
JPG has a browser production executor.
PDF Publication engine exists, but live browser integration is not yet proven.
Preferred audit target: browser-side jsPDF path if client-safe; do not introduce a server runtime unless necessary.

### GATE-E — Export rollout
Status: HUMAN_GATE
Choose:
- additive/feature-flag migration alongside legacy DOM export first, or
- direct replacement.
Historical sequencing recommends non-destructive/flag-gated rollout.

### GATE-F — 11-B event semantics
Status: HUMAN_GATE
Need exact counting policy for:
IME, paste, cut, undo, redo, replace, select-all delete, import, programmatic normalization, ruby input, page-break token, image token, Writing Check fixes.

### GATE-G — 11-A β scope boundary
Status: RESOLVED (Human decision, Phase 3 task)
Historical full 11-A scope includes:
1. punctuation
2. paragraph/whitespace
3. vertical-writing character issues
4. TateSpun notation
5. dictionary/NG-word features

Decision: dictionary/NG-word functionality IS β-required, local/browser-side only, no manuscript transmission, no external AI/API.

### GATE-H — TXT I/O open contract
Status: HUMAN_GATE
Open items include:
encoding, BOM, line endings, ruby/page-break/image round-trip representation, malformed-input handling.

---

## 4. Integrated β roadmap from current position

### 11-A. Writing Check β 2.0 completion
Status: COMPLETE — Human QA PASS (checkpoint 2026-09-09, HEAD `97b3df7`)

#### 11-A Phase 1
COMPLETE — commit `26eef0f`
- reusable local rule engine
- current rule regression
- bracket/punctuation/TCY/ruby high-confidence diagnostics
- UTF-16 offset safety
- IME/privacy/build PASS

#### 11-A Phase 2
COMPLETE
- paragraph/whitespace rules: R6 trailing whitespace (SAFE_AUTO_FIX), R7 mixed tab/ideographic-space indentation (REVIEW_BEFORE_FIX), R8 3+ consecutive blank lines (NOTICE_ONLY, REVIEW severity, disabled by default -- style-sensitive)
- vertical-writing character rules: R4 half-width katakana (REVIEW_BEFORE_FIX, no computed replacement yet), R5 stray control characters (SAFE_AUTO_FIX)
- fix-class model implemented: `SAFE_AUTO_FIX` / `REVIEW_BEFORE_FIX` / `NOTICE_ONLY`, required on every diagnostic, independent of severity
- rule config / per-rule enablement: `ruleOverrides` (additive, relative to the engine's own default set) alongside Phase 1's `enabledRuleIds` (absolute whitelist, unchanged)
- diagnostics result model extended (`fixClass` field), no Fix/Ignore UI built yet
- no silent mutation -- verified by explicit tests

Deferred, explicitly not attempted this phase (real false-positive risk without further product guidance):
- "excessive indentation" rule (no reliable existing contract defines an invalid threshold)
- ASCII punctuation with a full-width equivalent (URL/code/deliberate-Latin false-positive risk)
- half-width katakana auto-conversion replacement text (needs a real conversion table, deferred to the Fix UI phase)

#### 11-A Phase 3
COMPLETE / Human QA PASS
- remaining rule catalog: R9 ellipsis form (…/……/・・・/...), R10 dash form (―/――/―――), R4 half-width katakana now with a REAL suggestedReplacement (JIS X 0201↔X 0208 table, promoted SAFE_AUTO_FIX)
- 表記ゆれ dictionary (R11) and NG-word (R12) rules, both parameterized by user-local entries, dictionary-safety-aware (never suggests a replacement overlapping ruby/TCY/image/page-break notation)
- 3 Human-approved presets (verbatim names): 入稿前おすすめ / 記号だけ / しっかりチェック
- RED (原稿事故・高確度) / YELLOW (確認推奨) severity UI -- independent of `fixClass`, colour paired with a text label (not colour-only)
- explicit 直す (single-diagnostic Fix, stale-range-protected), 無視 (occurrence-level, in-memory only, not persisted), 安全な項目をまとめて直す (SAFE_AUTO_FIX only, descending-offset, overlap-safe)
- narrowest-possible one-step 元に戻す (undo), cleared the moment the user makes any further manual edit
- 文章チェック設定 UI: preset selector, per-rule toggles, わたしの辞書 / NGワード CRUD -- all localStorage-only, never transmitted
- output isolation proof: automated static scan confirms no file under `typesetting-v2/` (Core/Publication/Preview/export) references the writing-check engine at all
- privacy static scan extended to the new engine files (automatic, recursive) and to the new hooks/UI files (explicit list)
- full regression + `next build` PASS

Deferred, explicitly not attempted this phase:
- "excessive indentation" threshold rule (still no reliable contract)
- ASCII punctuation → full-width auto-conversion (still a URL/code/deliberate-Latin false-positive risk)
- React-hook-level automated tests for the 3 new localStorage hooks (no jsdom/testing-library in this repo; no existing precedent either -- covered by Human QA on the real Editor instead)

Human QA confirmed (2026-09-09, on the real Editor at HEAD `97b3df7`):
- preset switching: 入稿前おすすめ / 記号だけ / しっかりチェック
- no useSyncExternalStore crash after the persistence-hook fix (see the bugfix commit `97b3df7`)
- RED/YELLOW diagnostic display
- individual 直す
- 元に戻す
- 無視
- SAFE_AUTO_FIX bulk correction only (ellipsis/dash are NOT silently auto-fixed)
- わたしの辞書 add/detect/fix
- NGワード add/detect
- Preview isolation
- PDF isolation
- JPG isolation

Writing Check diagnostics remain Editor-only and do not enter Preview / PDF / JPG output.

Completion condition:
Local browser-only manuscript checking can detect the agreed β rule set and let the user apply only explicit, safe corrections; no manuscript is sent to external AI/API. MET — Phase 3 is COMPLETE.

#### 11-A Human QA polish backlog (non-blocking, deferred)
Recorded 2026-09-09. None of these block 11-A Phase 3 closure; scheduled as later follow-up polish.

**A. Writing Check visual polish**
- NGワード should use a PURPLE wavy underline (keep the internal RED/YELLOW severity contract unchanged — this is an additional visual category, not a severity change)
- NG status must also be identified by text, not color alone
- current YELLOW/amber underline should be made somewhat lighter
- result-list diagnostic body/snippet text should use approximately the same readable font size as the Editor body text (badges/buttons may remain smaller)

**B. Help navigation**
- add a table of contents at the top of Help
- clicking a TOC item jumps to the relevant Help section

**C. TOC (目次) creation dialog polish**
- move 再検出 to a new line
- align it to the left
- align the empty/result explanatory gray text to the left
- remove the current awkward centered result presentation

**D. 完成前マイチェックリスト**
- still NOT IMPLEMENTED
- preserve as roadmap feature
- directly accessible around Memo / Editor workflow
- presets / editable personal checklist, as already decided

**E. UI-C integration**
- UI-C settings drawer was Human-selected as the PC settings model
- current Editor has NOT yet completed full settings-drawer integration
- preserve as a future UI integration task (see also §16 Settings / UI-C / Export Profiles below)

---

### 11-B. Writing-session total activity counter
Status: NOT_STARTED

Confirmed contract:
START → edit → END
- insertedCharacters
- deletedCharacters
- totalActivity = inserted + deleted
- result display
- SNS share
- separate `Editor Session Metrics` responsibility
- not the same as current manuscript length

Before implementation:
resolve GATE-F.

Suggested β boundary:
- one active session
- input/deletion/total counts
- END result
- explicit SNS share
- local-only processing
- long-term analytics/history can be post-β unless Human chooses otherwise

---

### 12. Real Editor → Production Publication connection
Status: PARTIAL

Bridge state mapping is COMPLETE, but the real Editor UI still uses legacy export.

Tasks:
1. Bind real Editor `title/content/images/settings` into the v2 bridge in the real product flow.
2. Prove real manuscript → Canonical Document → PaintPlan using live state.
3. Preserve line count / chars-per-line propagation.
4. Preserve folio/header/colophon/images.

Human QA:
Conditional; first real-manuscript output should receive Human visual QA.

---

### 13. Browser PDF Publication path
Status: NOT_STARTED

Tasks:
- audit current jsPDF Publication renderer for browser/client safety
- build/verify a real browser PDF download path
- no Node-only leakage
- same PaintPlan as JPG
- static Next build PASS
- first real PDF Human QA

Completion:
real browser user can download v2 Publication PDF from a real v2-composed manuscript.

---

### 14. Export migration
Status: NOT_STARTED

Tasks:
- wire live Editor export buttons to v2 PDF/JPG
- preserve/implement:
  - single page where applicable
  - all pages
  - selected pages if current UX supports them
  - JPG ZIP
  - print JPG
  - web-reading JPG
  - filename rules
  - error handling
- feature-flag/additive rollout preferred until rollback is proven
- legacy DOM capture remains available during migration unless Human chooses direct replacement

Completion:
real Editor users can use v2 Publication output end-to-end.

---

### 15. TXT I/O Contract
Status: HUMAN_GATE → NOT_STARTED

Resolve GATE-H, then implement/test:
- encoding
- BOM
- line endings
- TateSpun notation round-trip
- malformed input behavior
- import/export compatibility

Required by Master §17 acceptance.

---

### 16. Settings / UI-C / Export Profiles
Status: NOT_STARTED / PARTIAL HISTORICAL SPEC

Includes:
- UI-C Settings drawer (HD-010)
- P3-O11 Editor Export Profiles A/B/C
- settings mapping/UI exposure needed by β

Need scope audit before implementation.

Confirmed (2026-09-09, 11-A Phase 3 Human QA checkpoint): UI-C settings drawer is the Human-selected PC settings model. The current Editor (including the new 文章チェック設定 modal) has NOT yet completed full settings-drawer integration — see 11-A's own Human QA polish backlog item E above.

---

### 17. Typography final contract closure
Status: PARTIAL

Resolve:
- P3-O07 TCY threshold
- P3-O06 ruby overhang numeric budget
- P3-O14 jukugo-ruby segmentation
- P3-O15 if β-relevant
- any remaining vertical-writing typography contracts

Then run mandatory matrix:
- A5
- A5 two-column
- web-reading
- other supported paper presets
- chars/line and lines/column variations
- ruby
- TCY
- punctuation
- images
- folio/header
- colophon

Special regression:
character-spacing consistency and line/column spacing.

---

### 17b. Typography Parity — InDesign Character-Pitch Recheck (OPEN follow-up, recorded 2026-09-09)
Status: OPEN — audit complete (2026-09-09, HEAD `985c415`), HUMAN GATE for next step

Audit findings: `qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_CHARACTER_PITCH.md`.
Summary: canonical body pitch is uniform 1em, frozen, previously validated
against real InDesign PDF output; Preview and Publication derive from the
identical Core tick values with no added spacing; Shippori Mincho's own
font metrics are well-formed and uniform (no anomalous glyph found in a
17-character continuous-prose sample). No single code-level cause was
found — no correction was implemented. "InDesign-level is the minimum
acceptance line" remains the frozen standard; this item stays OPEN until a
size-normalized Human visual comparison (recommended next action, see the
evidence doc §8) passes.

Not a numbered P3-O / TSP-LOOP item — a descriptive open follow-up recorded from Human observation.

Human supplied a new comparison (TateSpun Preview vs. InDesign as reference) and observes that TateSpun's vertical character spacing / pitch may still look different from InDesign in continuous prose.

This does NOT reopen Writing Check β 2.0 (11-A) and does NOT invalidate already-passed functional work. No Core/Preview/Publication changes were made at this checkpoint.

Schedule before final v2 Production integration.

Future comparison must use:
- same font
- same font size
- same manuscript text
- same page/preset geometry

Compare:
1. InDesign grid/reference
2. TateSpun Preview
3. TateSpun Publication PDF

Separate findings into:
A. basic body character advance / pitch
B. glyph ink positioning inside the cell
C. punctuation
D. small kana
E. dash / ellipsis
F. ruby if present

Guardrails:
- preserve Natural Pitch
- no page-fill stretching
- no arbitrary screenshot-pixel magic offsets
- do not reopen already-frozen punctuation decisions unless a real regression is demonstrated
- Publication remains canonical
- Preview may visually differ slightly but must not look like different typesetting

Acceptance:
Human visual parity review required before final Production integration.

---

### 18. Real-manuscript End-to-End QA
Status: NOT_STARTED

Use a realistic Human-authored manuscript rather than only fixtures.

Flow:
Editor input
→ settings
→ Writing Check
→ optional session count
→ Preview
→ PDF
→ JPG
→ images
→ folio/header
→ colophon
→ reload/persistence
→ TXT round-trip where applicable

Human QA: YES.

---

### 19. Master §17 full acceptance run
Status: NOT_STARTED

Must explicitly PASS or be formally scoped:
- PDF quality
- JPG quality
- Preview quality
- logical-layout consistency
- mandatory preset matrix
- regression corpus
- kinsoku/hanging/ruby/TCY/dash/ellipsis
- pagination
- image placement
- existing-project compatibility
- TXT I/O
- performance
- privacy
- Human visual QA
- rollback

No production migration while any required item remains undetermined.

---

### 20. Final site / β release update
Status: NOT_STARTED

Tasks:
- TateSpun top page final copy
- β wording / onboarding / Help
- privacy / terms / explanatory copy
- “原稿を勝手にAIへ送らない” assurance copy
- release links / official URL checks
- final accessibility/responsive sanity check

#### NEW requirement: support / affiliate footer
Placement:
TateSpun TOP PAGE lower/footer area only.

Do NOT place ads/support links inside the Editor work area.

Planned block:
- “TateSpunを応援する” style heading/copy
- Amazon affiliate shopping link
- Rakuten affiliate shopping link
- clear affiliate disclosure

Before implementation:
check the current Amazon/Rakuten affiliate program rules and disclosure requirements.

---

### 21. Production build / deploy / Production QA
Status: NOT_STARTED

- full regression
- `next build`
- deploy
- Production URL checks
- Editor smoke
- PDF/JPG download smoke
- privacy/help/site copy
- rollback verification

Human QA: YES for final production smoke.

---

### 22. TateSpun β COMPLETE
Status: NOT_STARTED

Definition:
All β-required Master §17 acceptance conditions and newly-approved β product requirements are PASS, or explicitly deferred by Human as post-β without contradicting the acceptance contract.

---

## 5. Post-β candidates unless Human promotes them

- P3-O10 full vertical Editor-mode feasibility
- P3-O13 HarfBuzz/dedicated shaping
- dakuten typography
- advanced group-ruby behavior if explicitly scoped out of β
- long-term Writing Session history/analytics
- advanced dictionary/user-rule system if excluded from β
- richer monetization/recommendation pages

---

## 6. Current progress interpretation

Core/typesetting engine completion: approximately 85–90%.

β product completion: approximately 65–70%.

Reason:
the layout/rendering engine is advanced, but real Editor export migration, TXT I/O, remaining typography contracts, full acceptance/rollback, and final production integration are still open.

---

## 7. Prompt ownership

Implementation prompts are authored and reviewed by ChatGPT.

Claude Code / Cursor acts as implementation/audit agent and must not be delegated responsibility for creating the next engineering prompt unless Human explicitly asks otherwise.

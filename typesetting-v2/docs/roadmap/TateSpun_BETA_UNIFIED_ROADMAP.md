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
Status: ROOT CAUSE FOUND AND FIXED (Round 3, 2026-09-09, HEAD `4b8e8a4`) — Human visual recheck still required before closing

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

**Round 2 update (2026-09-09, HEAD `31a78b8`)**: Human produced a direct
black/red PDF overlay (TateSpun vs. InDesign) showing visible drift and
froze the product quality bar: "InDesign-level is the minimum acceptance
line," systematic cumulative drift is NOT acceptable, Publication is
canonical and must reach InDesign-class geometry, Preview should follow
wherever technically possible without violating Canonical authority. This
item explicitly does NOT close while drift remains unexplained.

Round 2's own critical finding: **the real product's ONLY user-reachable
PDF export (`src/utils/exportPdf.ts`) is a legacy DOM/CSS screenshot
raster (`html-to-image` → canvas → `jsPDF` image embed) — categorically
different from v2 Core/Publication's vector tick-based renderer**, which
is reachable only via the internal `/renderer-poc` developer route. If
the Human's overlay compared the real product's export button output,
that overlay is not yet evidence against v2 Publication's own typography.
A controlled, real-pipeline v2 Publication reference PDF was generated
this round (`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`,
same canonical continuous-prose sample, real Shippori Mincho, real
`generatePublicationPdf`) for the next comparison. No repo-local InDesign
reference PDF exists yet (expected path:
`typesetting-v2/qa/reference/indesign/molsui-indesign-reference.pdf`) —
full drift quantification (origin offset vs. per-character/per-column
pitch slope) is blocked on it. See
`qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_OVERLAY_DRIFT.md` for the full
record. No Core/Preview/Publication code was changed this round.

**Round 3 update (2026-09-09, HEAD `4b8e8a4`)**: InDesign reference PDF
placed at `qa/reference/indesign/molsui-indesign-reference.pdf` and
independently measured from its own raw PDF bytes (no new dependency —
Node's built-in `zlib` + PDF structural regex parsing). Confirmed: A5
148×210mm, Shippori Mincho 9pt, character pitch exactly 1em (9pt, via the
PDF spec's own DW2 default — no override present), and a column-to-column
(行間) pitch of 15.9095pt — a ratio of 1.7677x the character size, not
1.0x.

**Root cause found: `src/lib/v2Bridge/settingsAdapter.ts`'s
`buildV2LayoutSettings` set `linePitchTicks` (Core's own independent
column-spacing field, `core/compose/column.ts`) equal to the character
advance, silently dropping the Editor's own real, already-shipped
`lineHeightRatio` setting (`pageLayout.ts`, 行間倍率, default 1.7 —
already in the same 1.6–1.8 range the InDesign reference's own measured
1.7677 falls into). Not a Core contract defect — `linePitchTicks` was
always a free field; Preview already reads the same field, so the fix
reaches both renderers.**

**Fixed**: `buildV2LayoutSettings` now derives `linePitchTicks` from the
real, existing `computeLinePitchMm(fontSizePt, lineHeightRatio)` legacy
formula (no new formula, no magic constant), and `columnExtentTicks` was
corrected in step so the Editor's own real `linesPerColumn` target still
resolves to the correct physical capacity. Quantified impact: a
column-anchor diagnostic (`qa/publication/p3-o08/typography-parity-indesign-vs-v2-comparison.pdf`)
shows cumulative drift across 21 columns of **48.75mm before the fix,
0.0004mm after** — on a 148mm-wide A5 page, i.e. this alone was fully
sufficient to explain a "looks systematically wrong" Human verdict.
`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`
was regenerated to match the confirmed InDesign geometry exactly (A5,
9pt, superseding Round 2's guessed 文庫/10.5pt version). Full regression
+ 2 new v2Bridge tests pass. Remaining open (not resolved this round):
absolute page-origin precision (T2) and glyph-ink-position comparison
(T6) — see the evidence doc §17. Human visual recheck of the real Editor
(now that `lineHeightRatio` actually reaches v2 Publication output) is
the recommended next step before this item closes.

**Round 4 update (2026-09-09, HEAD `50133a3`)**: the Round 3 human-recheck
PDF failed Human QA — giant, overlapping glyphs, only a fragment of the
manuscript legible. Root cause: `PublicationDocument.bodyEmMm` (and
Preview's own `fontSizePx`) derived GLYPH PAINT SCALE from
`ctx.linePitchTicks` — a field/value every existing fixture in this
codebase had always set equal to the character em (ratio 1.0) and which
was explicitly documented elsewhere as interchangeable with "the body
font's own em size." Round 3's own column-pitch fix correctly broke that
coincidence for the first time, silently painting every glyph at the
column-pitch size (~1.77x too large). Fixed with a new, additive,
optional `bodyFontSizeTick` field on both render contexts (falls back to
the old behavior when omitted — exact backward compatibility, 542/542
existing Publication tests unaffected). Regenerated and visually
verified (rasterized via the existing `@napi-rs/canvas` executor, no PDF
rasterizer installed in this environment): clean, uniform 9pt
typesetting, full manuscript, no overlaps.

**Round 5 update (2026-09-09, HEAD `50133a3`)**: with the artifact now
valid, Human raised a narrower, in-scope-only concern — intra-column
visual rhythm for ORDINARY Kanji/Hiragana (punctuation explicitly
excluded). Audited G1–G6 (canonical advance, font scale, vertical
origin, vmtx application, GSUB vert/vrt2 substitution, GPOS
valt/vkna) against real, measured font data — all six are either exactly
correct or not applicable to this font/character set (including a real,
initially-unexpected finding: 12 of 18 ordinary hiragana in the test set
DO have a GSUB vrt2 alternate, but its ink bbox is byte-identical to the
horizontal-form source glyph in every case, and the metrics-relevant
part — vpal Y-placement, already measured non-zero and glyph-specific —
is already correctly applied via `VerticalGposContext`, wired into
`generatePublicationPdf` since an earlier P3-O08 round). Repeated-glyph
and alternating-pair controls confirm TateSpun's own renderer is
internally deterministic with zero pair-to-pair advance variance. No
production code changed. Remaining candidate (G7, real font ink-shape
variance, same in InDesign since same font) cannot be independently
confirmed against InDesign's own embedded CFF glyph outlines — this
repo's font tooling is TrueType/glyf-only; a CFF/Type2-charstring
interpreter is new, nontrivial tooling, explicitly out of scope. See
`qa/evidence/TYPOGRAPHY_PARITY_GLYPH_IN_CELL_VERTICAL_RHYTHM.md`.
Genuine HUMAN GATE / tooling-limited STOP, not a deferred implementation.

**Round 6 update (2026-09-09, HEAD `d17bcd0`)**: superseded, not merely
revised — Human independently rendered both the real TateSpun v2
Publication PDF and the real InDesign reference at the same physical
scale and measured per-glyph vertical CENTER offsets directly from the
raster images. Cross-checked against this codebase's own real, measured,
currently-applied `vpal` GPOS Y-placement values (`VerticalGposContext`):
**every ordinary hiragana's measured offset matched TateSpun's own
applied vpal value in sign, and closely in magnitude, for every glyph
checked** (largest: い, measured −1.68pt vs. applied −1.692pt). Root
cause: an earlier round (round 10, `P3_O08_YAKUMONO_GPOS.md`) built
`vpal`-based ink repositioning specifically to fix real yakumono (「」（）
bracket) intrusion, then extended it to apply unconditionally to every
OTHER character too, on the assumption "harmless — verified for ordinary
kanji (real vpal = 0)." That assumption was never verified for ordinary
HIRAGANA, which this font gives real, substantial vpal values — and the
extension was, per this round's own measurement, actively wrong for
them. Yakumono ink placement was already owned entirely by a separate
mechanism (`yakumonoContext`), so real bracket positioning is completely
unaffected by removing this. Fixed: `pdfGenerator.ts`'s
`verticalGraphemeCommands` no longer consumes `vpal` for ordinary
(non-yakumono, non-small-kana) characters. No Core/Preview file touched;
Natural Pitch, `lineHeightRatio`, `linePitchTicks`, column pitch, and
font size all completely unchanged. One existing test asserting the old
(now-understood-to-be-wrong) behavior was corrected, with full history
preserved in its own comment. Full regression (Core/Stage C/Stage
D/Preview/Publication/v2Bridge) and tsc pass. See
`qa/evidence/TYPOGRAPHY_PARITY_GLYPH_IN_CELL_VERTICAL_RHYTHM.md` §11–19.
Human visual recheck of the regenerated artifacts is the natural next
step.

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

**Round 7 update (2026-09-09, HEAD `7dc654e`)**: audit only, punctuation/
brackets/mojikumi scope (C above), Rounds 1–6 findings (A/B) explicitly
untouched and re-confirmed unchanged. Discovered the real InDesign
reference PDF's actual body text is not the "人は驚きすぎると…" sentence
assumed in Rounds 2–6 (a manuscript-content discrepancy that does not
invalidate those rounds' own geometry findings), and built new ToUnicode-
CMap extraction tooling (no new dependency) to recover the real text and
each glyph's real Y position. Result, now backed by an asserted
regression test: InDesign's own real rendering advances **every**
consecutive glyph pair — including every punctuation transition present
in the real document — by exactly 1em, with zero pair-compression for
any character class. This directly closes a portion of a previously-OPEN
item from the historical P3-O08 chain (`P3_O08_YAKUMONO_NORMAL_SPACING_FINAL_ROUND17.md`,
which left 感嘆符/疑問符-before-closing-bracket unverified): the real
document contains two genuine `？」` instances, both measured at exactly
1em advance, confirming (not contradicting) round 17's already-frozen
uncompressed-advance decision. `！」`/`！？」`/`？！」` remain OPEN — no
`！` character appears anywhere in the real reference document, so no
real data exists for those sub-cases; not guessed or hardcoded. No
production code changed — TateSpun's current, unmodified yakumono path
already matches this newly-confirmed InDesign behavior (qualitatively
re-verified via a temporary raster check of the real `？」` sequence,
deleted after inspection). Publication and the new/updated typography-
parity tests pass; tsc clean. See
`qa/evidence/TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md`.

**Round 7A update (2026-09-09, HEAD `d7dddb3`)**: reference-integrity-only
recheck, no production code touched. Round 7's own extraction reported a
manuscript missing the Human's independently-verified sentences ("人は
驚きすぎると…" etc.), raising a contamination concern about
`qa/reference/indesign/molsui-indesign-reference.pdf`. Verified: the file
was **never replaced** (SHA-256 `0029bf70...c1c7a12`, 49522 bytes, now
locked by `renderer/publication/typographyParityIndesignReferenceIntegrity.test.ts`,
which fails loudly on any future drift). Root cause was Round 7's own
extraction regex, which only matched a Tj call immediately adjacent to a
fresh Tm operator — real InDesign paragraph-initial runs continue via a
relative `Td` after the leading indent glyph instead, a pattern the
regex silently skipped, dropping whole paragraphs (including the target
sentence) from Round 7's reconstruction while capturing others intact.
Round 7's two actual `？」` measurements came from correctly-captured
runs and remain valid; its "checked across the entire body text, zero
exceptions" framing is downgraded to spot-verified (2 real instances),
since a real fraction of the manuscript was never examined. tsc was
**not** independently validated this round either (ambiguous worktree-
level invocation against the known standing baseline error). See
`qa/evidence/TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md` §9a. A full-
coverage re-extraction is a reasonable Round 8 candidate, not done here.

**Round 8 update (2026-09-09, HEAD `581bc14`)**: exhaustive extraction,
audit only, no production code touched. Replaced Round 7's regex-
adjacency extractor with a real deterministic PDF text-state token
machine (walks BT/ET/Tf/Tm/Td/TD/T*/Tj/TJ in actual order, fails loudly
on any unmodeled text operator). Achieved full coverage: zero unsupported
operators, 614 glyphs recovered (vs. Round 7's ~150), both previously-
missed paragraphs now present, all three integrity snippets re-confirmed.
Full punctuation inventory taken (、22, 。26, 「」4 each, ？2, ―1, …1,
？」2; 『』（）！・！？？！。」、」！」！？」？！」 all ABSENT — none
closed). Advance is uniform 1em everywhere except 51 real TJ-array
adjustments found in this document (49 negligible +0.09pt noise with no
punctuation correlation, and 2 real -2.25pt gaps, both immediately after
、 before an ordinary kana). Investigated whether the 2 real gaps are
line-end justification, a deliberate post-comma rule, or an extraction
artifact — inconclusive: the same-X run-grouping heuristic used to check
this appears to merge separate physical columns (reconstructed Y reaches
implausible values), so the result cannot be trusted either way. Stopped
per this round's own explicit condition ("more than one plausible
interpretation remains") rather than guess. Classification: HOLD, not an
Implementation Gate — TateSpun's uniform-advance architecture matches
the exhaustive evidence everywhere this round could fully verify; the 2
flagged gaps are unresolved, not acted on. Diagnostic artifact built in
reduced scope (data tables only, no InDesign-side visual overlay, since
that would require geometry this round's tooling cannot yet reconstruct
reliably) at `qa/publication/p3-o08/typography-parity-yakumono-round8-diagnostic.pdf`.
tsc not independently validated (same ambiguity as Round 7A). See
`qa/evidence/TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md` §10. Recommended
next step for a future round: build per-page content-stream splitting
(via the PDF's own page tree) before trusting further Y-position
reconstruction from this reference.

**Round 9 update (2026-09-09, HEAD `557b707`)**: fully explains the two
real 0.25em events Round 8 flagged as unresolved, audit only, no
production code touched. Found and fixed a real bug in Round 8's own
extractor (a matrix-concatenation error doubled every glyph's advance
beyond the first in a multi-glyph run, producing the implausible Y
values -- down to -1651pt on a 595pt page -- Round 8 mis-read as a
multi-column merge). This round's own page-tree inspection additionally
confirms the reference has exactly ONE page and ONE content stream, so a
multi-page merge was never structurally possible. Also corrected a sign
error: per PDF spec, a vertical-writing TJ adjustment has opposite
polarity from horizontal (positive expands, not tightens) -- Round 8's
"-250 = extra gap" was backwards; verified computationally, it is a
0.25em **compression** to 0.75em. Built the full 22-comma table: 20
exactly uniform 1em, 2 negligible +0.01em noise, 2 real 0.75em
compressions. Decisive finding: the document has exactly 2 TJ-using
paragraphs, each containing 2 real commas; one paragraph's commas show
zero compression, the other's both show the full 0.25em compression --
ruling out a fixed per-character comma rule (a real rule would apply to
all four identically) in favor of a paragraph-specific InDesign
composition/justification artifact. Classification: **D** -- an
InDesign-internal justification residual specific to one paragraph's own
layout pass, not a general Japanese typesetting convention TateSpun is
missing. TateSpun's Natural Pitch (uniform 1em, no per-document
justification engine) is confirmed by design, not a gap; rendered both
exceptional contexts through the real unmodified pipeline for the
record. No production code changed, no Implementation Gate met, no
frozen Human decision reopened. See
`qa/evidence/TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md` §11.

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

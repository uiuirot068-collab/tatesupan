# Typography Parity Round 7 — Yakumono / Mojikumi Parity Audit

Scope: punctuation, brackets, dash/ellipsis glyph placement and InDesign
mojikumi (文字組みアキ量設定) behavior. Explicitly excludes ordinary
Kanji/Hiragana pitch (Round 3), glyph scale (Round 4), and the ordinary-
character `vpal` fix (Round 6) — all frozen, re-confirmed unchanged (see
§6 below).

HEAD at start: `7dc654e`.

## §1 — Three quantities, defined separately

- **Character advance**: the distance between one glyph's paint anchor and
  the next along the column axis. TateSpun's Natural Pitch contract (Core
  §18) fixes this at exactly 1em, uniformly, for every character class —
  frozen, independently validated in the historical P3-O08 chain.
- **Glyph-in-cell position**: where a glyph is painted *within* its own
  1em cell (its Y offset from the cell's own top edge). This is what
  `verticalYakumonoAlign.ts`'s `baselineRatioFor` and (for ordinary/small-
  kana glyphs) `deriveBaselineRatioFromFont`/`inkCenteredBaselineRatioForSmallKana`
  govern. NOT touched or measured quantitatively against InDesign this
  round beyond the qualitative raster check in §5.
- **Inter-character mojikumi gap**: an InDesign-specific concept — visible
  whitespace InDesign inserts/removes *between* glyphs via 文字組みアキ量設定
  percentages, independent of (and layered on top of) the base advance.
  This round's real extracted data (§2) shows InDesign's OWN real output,
  for this document/font/settings combination, applies **zero** net
  mojikumi compression or expansion to any of the punctuation classes
  actually present in the reference text — see §4.

## §2 — Real InDesign reference data (NEW this round)

Round 7 discovered that the InDesign reference PDF's real body text
(`qa/reference/indesign/molsui-indesign-reference.pdf`, object 35 — the
only content stream with real Tm/Tj vertical body text) is **not** the
"人は驚きすぎると…" sentence assumed and used as the working fixture in
Rounds 2–6. The real text is:

> 　それからずいぶん長い時間を一緒に過ごした。よく笑うことも、案外世話焼き
> なことも知っている。いつもはひょうきんなくせに、斧を手にすれば驚くほど
> 凛々しい顔をすることも。の少しだけモルとの距離を取る。そうして、胸の内
> にあるものへ蓋をしようとした、その時だった。「スイくん、僕とエタバンし
> ない？」「指輪、便利そうでさあ。金策も二人でやることあるし、あったらよ
> くない？」何も知らない笑顔だった。「ああ」「なるほど」

This does not invalidate Rounds 2–6's own geometric findings (page size,
font, font size, column pitch — all manuscript-content-independent), but
it does mean this round has **genuine, position-verified real InDesign
data** for brackets, comma, period, and — critically — `？」` (question
mark immediately before a closing bracket), extracted via a new
ToUnicode-CMap decoder
(`renderer/publication/typographyParityYakumonoIndesignExtraction.test.ts`,
same raw-PDF-parsing technique as Round 3's own extraction, no new
dependency).

**Finding, now a real asserted regression test** (not just console
inspection): within every one of the real document's own Tj runs, **every**
consecutive glyph pair — ordinary→ordinary, ordinary→punctuation,
punctuation→punctuation, and punctuation→closing-bracket — advances by
**exactly 9.0pt (1em at this document's real 9pt size)**, with zero
exceptions, checked across the entire reconstructed body text. Both real
occurrences of `？」` in the document (`しない？」` and `よくない？」`) are
individually asserted at exactly 9.0pt delta.

Also observed directly in the extracted position data (informational,
not yet a formalized glyph-in-cell measurement): opening brackets (`「`)
carry a **+4.5pt (0.5em) Tm Y offset** relative to the surrounding body
text's own baseline Tm — i.e. InDesign itself paints `「` starting half a
cell "early." This is a glyph-in-cell-position fact, not an advance fact;
it is consistent with (though not a byte-for-byte replication test of)
TateSpun's own existing `verticalYakumonoAlign.ts` edge-alignment
mechanism, which already exists specifically to handle this class of
positioning and was ported from the legacy product's own "round 13"
history. No numeric InDesign-vs-TateSpun comparison of this specific
0.5em figure was performed this round (out of scope for the time-boxed
120-minute audit; flagged as a natural Round 8 candidate if the ChatGPT
roadmap wants to pursue exact-match verification).

## §3 — TateSpun's current yakumono path (unchanged this round)

Unicode → `computeAtoms` (Core, `core/compose/line.ts`) — confirmed via
Grep this round to remain in its exact **round-13** form (no character-
class branching of any kind; `advanceTickFor` TEXT case always returns
`perCellAdvance` unconditionally) → break/kinsoku (untouched, out of
scope) → GSUB vert/vrt2 substitution (`gsubReader.ts`/`verticalGlyphMap.ts`
— hardcoded 8-entry `VERTICAL_FORM_MAP` for 、。「」（）―…) → vertical
metrics (`fontMetrics.ts`, vmtx-derived) → paint transform
(`pdfGenerator.ts`'s `verticalGraphemeCommands`): `effectiveBaselineRatio =
yakumonoBaselineRatio ?? smallKanaBaselineRatio ?? baselineRatio`, with
`gposOffsetMm` hardcoded to `0` since the Round 6 fix (GPOS `vpal` Y-
placement is no longer consumed for the generic/ordinary path at all —
only `yakumonoContext`'s own separate edge-alignment mechanism positions
yakumono glyphs within their cell).

This path was read and re-verified this round; **no code change was
required or made** — see §5/§6.

## §4 — Previous Human decisions cross-referenced (Y-classification)

- **`qa/evidence/P3_O08_YAKUMONO_NORMAL_SPACING_FINAL_ROUND17.md`**
  (pre-dates this session): Human Visual QA HOLD compared TateSpun
  against real Adobe InDesign vertical output and found "visible normal
  spacing before a closing bracket is DESIRED, not a defect," retiring
  two earlier compression experiments (rounds 14, 16) and restoring
  `computeAtoms` to uncompressed, uniform advance. Round 17's own
  evidence doc explicitly left **感嘆符/疑問符 before a closing bracket
  (！」/？」/！？」/？！」) as an OPEN item**, never implemented or
  measured against real InDesign output.
- **This round's real data directly closes the `？」` portion of that
  open item** — using actual, position-verified InDesign output (not a
  synthetic fixture): `？」` advances by exactly 1em in InDesign's own
  real rendering, with no special compression, confirming (not
  contradicting) Round 17's already-frozen uncompressed-advance decision
  and extending it with real evidence to this specific previously-
  unverified case.
  - `！」`/`！？」`/`？！」` remain unverified against real InDesign
    output — no `！` character appears anywhere in the real reference
    document's reconstructed text, so this round has no real data for
    those three sub-cases specifically. **Classification: Y3 (real
    reference data does not cover this case) — left OPEN**, same status
    as before, not newly resolved. A future round would need either a
    different reference document containing `！` before a closing
    bracket, or explicit Human-supplied InDesign output for that
    specific case.
- **Round 5/6 findings** (ordinary hiragana `vpal` over-application, now
  fixed): unrelated character class (ordinary, not yakumono); this
  round's own regression check (§6) confirms the fix remains intact and
  unaffected by anything found here.

## §5 — TateSpun's current rendering vs. the newly-confirmed InDesign fact

A temporary raster check (rasterized via the real, unmodified
`buildPaintPlan`/`renderPaintPlanToRasterPages` pipeline — same technique
used in Rounds 5/6 — then deleted after inspection, not committed) of
TateSpun's current output for `僕とエタバンしない？」` shows uniform,
evenly-spaced 1em cells through the `？」` transition, with no visible
compression or expansion — **qualitatively consistent** with the real
InDesign advance fact from §2. This is a visual/qualitative check, not a
pixel-exact quantitative comparison (no InDesign glyph-outline/ink-bbox
data was extracted this round — the font's CFF/Type2 outlines used by
InDesign's own PDF are out of reach of this repo's TrueType/glyf-only
`fontMetrics.ts` reader, an existing, known, unrelated tooling gap
carried over from Round 5's own G7 classification).

## §6 — Ordinary-text regression check (Step 12, mandatory)

No production code was changed this round. The ordinary sequence
"人は驚きすぎると本当に足が止まるらしい" (Round 6's own control) was
re-rendered unchanged as diagnostic page 1 (§7) through the same,
unmodified pipeline — confirms the Round 6 `vpal`-suppression fix remains
intact.

## §7 — Diagnostic artifact

`qa/publication/p3-o08/typography-parity-yakumono-mojikumi-*.pdf` (5
files, generated via `renderer/publication/typographyParityYakumonoMojikumiDiagnostic.test.ts`,
real unmodified `generatePublicationPdf` pipeline, real Shippori Mincho
font metrics):

1. `page1-ordinary-control` — Round 6 ordinary sequence (regression
   check, §6).
2. `page2-comma-period` — real InDesign-verified comma/period sentences.
3. `page3-brackets` — real InDesign-verified `「ああ」`/`「なるほど」`.
4. `page4-question-closing-bracket` — real InDesign-verified `？」`
   sequence (the previously-open Round 17 item, §4).
5. `page5-long-real-sentence` — the full real long bracket sentence
   (comma + period + `？」` together).

## §8 — Root cause classification (Y1–Y10)

**Y6** — a previously-open historical item (Round 17's `？」`
sub-case) is now closed with real, position-verified InDesign evidence
that confirms the already-frozen architecture requires no change. No new
discrepancy was found between TateSpun's current output and real
InDesign behavior for any punctuation class covered by this round's real
data (comma, period, brackets, `？」`). The one remaining gap (`！`
before a closing bracket) is a **data-coverage gap** (Y3), not a defect —
no real InDesign reference containing that sequence exists in this
repo.

## §9a — Round 7A addendum: reference integrity recheck (2026-09-09)

A follow-up round investigated a suspected contamination of
`qa/reference/indesign/molsui-indesign-reference.pdf`, since §2's own
reconstructed text did not contain the Human's independently-verified
authoritative sentences ("人は驚きすぎると…", "スイはそれを初めて知った",
"数歩先へ行ったモルが振り返る").

**Finding: the reference file was never replaced or contaminated.**
SHA-256 `0029bf7008093105069717c1f72e9e3bf333054a2089003f81487dea4c1c7a12`
(49522 bytes), now locked by
`renderer/publication/typographyParityIndesignReferenceIntegrity.test.ts`,
which fails loudly on any future drift. A broader Tj/TJ-array scan of the
SAME single content stream (object 35) that §2's own extraction already
read finds all three target snippets present, in full context, alongside
everything §2 originally found.

**Real root cause: §2's own extraction regex was incomplete, not the
reference.** It matched a Tj call only when immediately adjacent to a
fresh `9 0 0 9 X Y Tm` operator. Real InDesign paragraph-initial runs
emit the leading full-width indent glyph as its own short Tj, then
reposition via a relative `Td` before emitting the rest of the paragraph
as one long Tj — a pattern the regex silently skipped, dropping whole
paragraphs (including the one containing "人は驚きすぎると") from §2's
own reconstruction, while paragraphs whose entire content sits in a
single Tm-adjacent Tj (most of what §2 did capture) came through intact.

**Effect on §2's specific claims:**
- The two real `？」` measurements (`しない？」`, `よくない？」`) were
  both taken from Tm-adjacent runs the old regex captured correctly —
  independently re-confirmed present, in the same position, in the
  broader Round 7A extraction. **These two measurements remain valid.**
- The claim that uniform 1em advance was checked "across the entire
  reconstructed body text... zero exceptions" **overstated its own
  coverage** — a substantial fraction of the real manuscript (every
  Td-continued paragraph) was never examined by §2's test at all. This
  is a coverage gap in the audit, not a falsified result: no
  counterexample to uniform advance has been found in the newly-visible
  text either, but it has not yet been formally re-measured there.
- The §4/§8 conclusion (uniform advance for `？」`, confirming round 17)
  therefore stands on its own narrower evidence (2 real instances,
  correctly measured), downgraded from "exhaustive" to "spot-verified."
  A future round re-running §2's Y-delta assertion against the FULL,
  correctly-extracted manuscript (all paragraphs, both Tm-adjacent and
  Td-continued) would upgrade this back to exhaustive; not done here
  (out of scope for a reference-integrity-only round).

**Classification revision: still Y6, no defect found; audit coverage
was partial, not the conclusion itself.** No production code change
implied by this addendum.

## §9 — Decision

**IDENTIFIED, no Implementation Gate triggered** (revised by §9a: spot-
verified, not exhaustively verified). No production code change is
warranted this round: TateSpun's current, unmodified yakumono path
already matches the real InDesign advance behavior confirmed for the
`？」` case, on the two real instances that were correctly measured (see
§9a for the coverage caveat on the "checked across the entire document"
framing). This round is audit-only. The `！」`/`！？」`/`？！」` sub-cases
remain explicitly OPEN pending a real InDesign reference containing `！`
before a closing bracket — a data-coverage gap, not a code defect, and
not something to guess/hardcode without real evidence per this round's
own explicit constraint. The reference file itself is verified authentic
and now identity-locked (§9a) — future rounds should trust it without
re-litigating contamination, but a full-coverage re-extraction (all
paragraphs, not just Tm-adjacent ones) is a reasonable Round 8 candidate
before treating any advance/gap finding from this reference as
exhaustive.

## §10 — Round 8: exhaustive operator-level extraction (2026-09-09)

Round 7's regex-adjacency extractor is replaced by a real, deterministic
PDF text-state token machine
(`renderer/publication/typographyParityYakumonoExhaustiveExtraction.test.ts`):
a proper tokenizer (hex strings, literal strings, arrays, dicts, names,
numbers, operator keywords) walks `BT/ET/Tf/Tm/Td/TD/T*/Tj/TJ` in actual
document order, maintaining the real PDF text matrix per §9.4 of the PDF
spec, and **fails loudly** on any text-state operator it does not model
exactly (`Tc`/`Tz`/`Tr`/`Ts` at a non-default value, quote-operators,
malformed operand counts, anything outside a small explicit whitelist of
non-text graphics/marked-content operators known to be position-inert).

**Coverage achieved**: `unsupportedOps = []` — zero unsupported text
operators across the entire content stream (object 35). Operators
actually encountered: `BT`/`ET` ×21, `Tf`/`Tm` ×21, `Tj` ×31, `Td` ×12,
`TJ` ×2, plus 3 non-text operators (`k`, `ri`, `gs`, all position-inert).
614 glyphs recovered (vs. Round 7's ~150), the full manuscript, both
previously-missed paragraphs ("スイはモルが好きだった…", "グリダニアで…")
now present, and all three integrity snippets confirmed recoverable
(re-asserted, still passing).

**New discovery — real TJ-array numeric adjustments exist in this
document.** Round 7 implicitly assumed none (never checked using a TJ-
aware parser). Two categories found, both confirmed via exact glyph-pair
context, not inferred:

1. **49 occurrences of `+10`** (0.01em = 0.09pt), scattered through one
   long ordinary-text TJ run — between kanji-kanji, kana-kana, and
   `、`-kanji pairs alike, with no punctuation-class correlation
   whatsoever. Magnitude is below any plausible visual threshold (0.09pt
   at 9pt size). Read as InDesign PDF-export rounding/optical-kerning
   noise uniformly applied across a paragraph, not a punctuation rule.
2. **2 occurrences of `-250`** (−0.25em = −2.25pt, a real, visually
   significant quarter-em EXTRA gap), both immediately after `、`
   and before an ordinary kana (`、と` in "気が合った、と言って…", `、ど`
   in "けれど気づけば、どこへ…"). This is the first real evidence this
   session of a non-uniform advance anywhere in the InDesign reference.

**Investigated, not resolved: why the `-250` gaps occur.** Tested the
"line-end justification" hypothesis (Japanese vertical justification
conventionally distributes leftover line-fill space preferentially at
punctuation) by checking each occurrence's position within its own
same-X Tm-run: both sit mid-run (positions 5/54 and 27/54 from the
start, 48/54 and 26/54 from the end) — not at either edge, which argues
against a simple line-end-fill explanation. However, that same
same-X-run heuristic groups 54 consecutive glyphs under one physical
column, and the reconstructed Y coordinate for later glyphs in that run
reaches implausible values (as low as −1651pt — no real page is that
tall), indicating the extractor's own same-X run-grouping likely merges
multiple *separate* physical columns that happen to reuse the same
horizontal anchor (a real, expected pattern across a multi-page/multi-
column document), rather than genuinely reflecting one continuous
column. **This means the mid-run positioning result itself cannot be
trusted as conclusive** — it could reflect either genuine mid-column
placement or an artifact of an incorrectly-merged column boundary. No
tooling exists yet in this repo to reconstruct real per-page/per-column
boundaries from this content stream alone (would need the page tree's
own `/Contents` per-page split, not attempted this round).

**Per this round's own explicit STOP condition** ("more than one
plausible interpretation remains"): stopping here rather than guessing.
The `-250` finding is real and verified at the byte level; its
typographic *meaning* (deliberate post-comma mojikumi gap vs. line-
justification artifact vs. an unrelated InDesign export quirk) is
**unresolved** and requires either (a) per-page content-stream splitting
tooling, or (b) direct Human inspection of the actual InDesign document
at those two exact sentences, neither done this round.

### Punctuation inventory (real, from the full 614-glyph extraction)

| class | count | class | count |
|---|---|---|---|
| 、 | 22 | 」 | 4 |
| 。 | 26 | 『 | 0 (ABSENT) |
| 「 | 4 | 』 | 0 (ABSENT) |
| （ | 0 (ABSENT) | ！ | 0 (ABSENT) |
| ） | 0 (ABSENT) | ？ | 2 |
| ・ | 0 (ABSENT) | ―― | 1 |
| …… | 1 | ！？ | 0 (ABSENT) |
| ？！ | 0 (ABSENT) | 。」 | 0 (ABSENT) |
| 、」 | 0 (ABSENT) | ！」 | 0 (ABSENT) |
| ？」 | 2 | ！？」 | 0 (ABSENT) |
| ？！」 | 0 (ABSENT) | | |

No ABSENT case is treated as closed. `！` and every `！`-containing
combination remain OPEN, unchanged from Round 7/7A, for lack of real
data — consistent with, and now on a fully exhaustive rather than
partial basis.

### Advance audit (Step 4)

Every ordinary→ordinary, ordinary→punctuation, and punctuation→ordinary
transition **not** inside the 2 TJ runs is uniform 1em (9.0pt), matching
Round 7's finding, now on exhaustive rather than partial coverage. The
sole exceptions are the 51 TJ-adjusted pairs above (49 negligible, 2
real and unresolved).

### TateSpun comparison (Step 8)

TateSpun's `computeAtoms` (Core) applies strict, unconditional uniform
1em advance with no character-class branching (re-confirmed unchanged
this round — no production code touched). For 、, 。, 「, 」, ？, ―, …:
**MATCH** against the exhaustive InDesign advance data, with one
flagged exception: the 2 real `、`-then-ordinary `-250` gaps have no
TateSpun analogue and are **UNVERIFIED** (not MATCH, not DIFFERENT) —
their own real-world cause is unresolved per above, so no conformance
claim can be made either way yet.

### Previous Human decisions (Step 10)

- `。」`, `、」`, `！」`, `！？`, `？！`: **UNVERIFIED** — absent from this
  real reference; no real data exists to compare against. Not silently
  reopened.
- `？」`: **PRESERVED** — 2 real instances, both exactly 1em, matching
  Round 7's own finding, now re-confirmed via the exhaustive extractor
  independently of Round 7's own (buggy) regex.
- Post-`、` gap: **NEEDS HUMAN REOPEN** is not asserted (the evidence is
  not clean enough to justify reopening a frozen decision), but this is
  flagged as a genuine open question for a future round or direct Human
  review of the source InDesign document, distinct from anything
  previously decided (round 17 concerned closing-bracket compression,
  not post-comma expansion — no existing frozen decision actually
  covers this specific question).

### Ordinary control (Step 9)

No production code touched this round. Round 6/7's ordinary control
(`人は驚きすぎると本当に足が止まるらしい`) is unchanged; its own
diagnostic artifact (`typography-parity-yakumono-mojikumi-page1-ordinary-control.pdf`,
Round 7) was not regenerated since nothing affecting it changed.

### Artifact (Step 12) — reduced scope, explicitly disclosed

The full 6-page diagnostic (including an enlarged InDesign-vs-TateSpun
visual overlay for the `-250` cases) was **not** built this round: doing
so would require correctly-resolved per-column InDesign glyph positions,
which §10's own column-merge caveat above shows this round's tooling
cannot yet produce reliably. Building a visual "comparison" on
unresolved geometry would misrepresent confidence that doesn't exist.
Instead: `qa/publication/p3-o08/typography-parity-yakumono-round8-diagnostic.pdf`
contains only the two things this round can state with confidence — the
punctuation inventory table and the advance-audit summary — both as
plain text/data pages, no InDesign-side visual overlay.

### Decision (Round 8)

**HOLD — real, unresolved finding, not an Implementation Gate.** No
production code change is warranted or attempted: TateSpun's uniform-
advance architecture matches the exhaustive InDesign evidence for every
punctuation class this round could fully verify. The one real exception
(2 `-250` gaps) is flagged, not acted on — its cause is genuinely
ambiguous per this round's own STOP condition, and guessing at a fix
would risk reopening the already-frozen Round 17 architecture on
insufficient evidence. Recommended next step for whoever picks this up:
build content-stream-per-page splitting (using the PDF's own page tree
`/Contents` references) before trusting any further Y-position
reconstruction from this reference beyond simple ordered-glyph advance
checks, which remain valid regardless of the column-merge caveat (they
only depend on within-Tm-run adjacency, not absolute column boundaries).

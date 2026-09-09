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

## §9 — Decision

**IDENTIFIED, no Implementation Gate triggered.** No production code
change is warranted this round: TateSpun's current, unmodified yakumono
path already matches the real InDesign advance behavior newly confirmed
here, including for the previously-open `？」` case. This round is
audit-only. The `！」`/`！？」`/`？！」` sub-cases remain explicitly OPEN
pending a real InDesign reference containing `！` before a closing
bracket — a data-coverage gap, not a code defect, and not something to
guess/hardcode without real evidence per this round's own explicit
constraint.

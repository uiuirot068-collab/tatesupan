# P3-O08 — Font-Derived Vertical Glyph Metrics (Human Visual QA HOLD round 5)

## 1. Human Rejection (Round 5)

- **Ruby: PASS.** rubyScale = 0.5 is FROZEN, canonical, not reopened here.
- **Small kana (っ etc.): REJECTED.** All three candidates (A_BASELINE,
  B_STANDARD, C_STRONG) from round 4 rejected.
- **Punctuation (「」（）、。): REJECTED.** Same three candidates rejected.
- Explicit instruction: do NOT generate a stronger D/E offset candidate, do
  NOT continue subjective numeric tuning. Derive placement from the font's
  own real vertical metrics instead.

## 2. Font Table Availability (measured, `fontMetrics.test.ts`)

Against the exact committed asset
(`qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf`), full
table directory:

```
DSIG, GDEF, GPOS, GSUB, OS/2, cmap, gasp, glyf, head, hhea, hmtx, loca,
maxp, name, post, vhea, vmtx
```

| Table | Present? |
|---|---|
| `head` | YES |
| `maxp` | YES |
| `cmap` | YES |
| `glyf` | YES |
| `loca` | YES |
| `hhea` | YES |
| `hmtx` | YES |
| `vhea` | **YES** |
| `vmtx` | **YES** |
| `VORG` | NO |

`unitsPerEm = 1000`. `vhea.ascent = 500`, `vhea.descent = -500` (vertical
LINE metrics — column spacing — not the per-glyph vertical origin; kept
separate below).

`VORG`'s absence is expected, not a gap: VORG only exists in CFF-outline
OpenType fonts, to override the default vertical-origin-from-vmtx
convention. This is a TrueType-outline font (`glyf`/`loca`), where the
OpenType spec's own default rule — vertical origin Y = glyph's own `yMax`
+ its own `vmtx` topSideBearing — is authoritative with no VORG needed.

**This corrects an unverified claim.** `fontMetrics.ts`'s own header
comment, written before this table was actually read, stated vhea/vmtx
"cannot be trusted as authoritative vertical-origin data" — that
statement was never investigated and turned out to be wrong; both tables
are present and were used for real below. The comment has been corrected
in the same commit as this evidence file (not left standing).

## 3. Glyph Metric Evidence (real, measured — `fontMetrics.test.ts`)

Real per-glyph metrics recovered for every required character (glyph ID,
`hmtx` advance/lsb, `glyf` ink bbox, `vmtx` advance height/topSideBearing/
derived originY), for: っ, ッ, つ (control), た, 、, ﹅(vertical comma
U+FE11), 。, U+FE12, 「, U+FE41, 」, U+FE42, （, U+FE35, ）, U+FE36. Full
JSON dump is in `fontMetrics.test.ts`'s own console output (reproducible
by re-running the test); representative rows:

| Char | Glyph ID | Ink bbox (em) | vmtx originY (units) |
|---|---|---|---|
| た (baseline kanji) | 15228 | x 0.076–0.844, y −0.01–0.771 | 880 |
| っ (small tsu) | 15233 | x 0.16–0.789, y −0.02–0.424 | 880 |
| ッ (small tsu, kana) | 15322 | x 0.238–0.76, y −0.027–0.524 | 880 |
| つ (ordinary tsu, control) | 15232 | x 0.082–0.874, y 0.045–0.602 | 880 |
| 、 comma (source) | 15940 | x 0.059–0.296, y −0.069–0.155 | 880 |
| U+FE11 (vertical comma) | 15941 | x 0.707–0.944, y 0.592–0.816 | 880 |
| 。 period (source) | 15942 | x 0.062–0.323, y −0.06–0.201 | 880 |
| U+FE12 (vertical period) | 15943 | x 0.677–0.938, y 0.56–0.821 | 880 |
| 「 open bracket (source) | 15826 | x 0.602–0.938, y 0.039–0.849 | 880 |
| U+FE41 (vertical open bracket) | 15844 | x 0.159–0.969, y −0.053–0.283 | 880 |
| 」 close bracket (source) | 15827 | x 0.066–0.402, y −0.089–0.721 | 880 |
| U+FE42 (vertical close bracket) | 15845 | x 0.03–0.84, y 0.477–0.813 | 880 |
| （ open paren (source) | 15850 | x 0.693–0.939, y −0.109–0.869 | 880 |
| U+FE35 (vertical open paren) | 15876 | x 0.011–0.989, y −0.059–0.187 | 880 |
| ） close paren (source) | 15851 | x 0.061–0.307, y −0.109–0.869 | 880 |
| U+FE36 (vertical close paren) | 15877 | x 0.011–0.989, y 0.573–0.819 | 880 |

**The `originY` column is 880 for every single row, with zero exceptions**
— proven for 16 hand-picked characters (`fontMetrics.test.ts`) and
re-proven generically for the full small-kana set + every punctuation
class + ordinary kanji/kana (`fontDerivedVerticalOrigin.test.ts`'s own
"every classified character... shares the SAME real vmtx-derived origin"
test). `advanceHeight` is also 1000 (= `unitsPerEm`) for every glyph
tested — a uniform, monospaced vertical grid, exactly matching this
project's own frozen Natural Pitch model.

## 4. Root Cause — What The Font Data Actually Shows

**The font's own `vmtx` table defines a single, uniform vertical origin
for every glyph — it carries NO per-glyph or per-class differentiation
signal at all.** `topSideBearing` is not an independent, ink-following
measurement; it is `880 − yMax` by construction for every glyph (proven
directly: `originY = yMax + topSideBearing` computes to exactly 880 in
every row above, regardless of how different each glyph's own `yMax` is).
This is a well-known, standard font-build convention for CJK vertical
metrics: the vertical origin Y is set equal to the font's own horizontal
ascent-like reference (here, 880/1000 em), uniformly, so that a glyph
painted via ordinary horizontal-baseline fallback (exactly what jsPDF
does — see §5) lands at the same position a normal horizontal line's
baseline would.

**Therefore: the font itself proves there is no font-derived basis for a
per-character-class offset.** Round 4's B_STANDARD/C_STRONG candidates
were not merely unverified — they were provably NOT font-derived,
because the one piece of real per-glyph vertical-origin data this font
provides is identical for brackets, comma, period, small kana, and
ordinary kanji alike. Deviating from the uniform origin for only some
character classes is not something this font's own data supports.

## 5. Current Baseline/Origin Model — Corrected, Not Replaced

`pdfGenerator.ts`'s pre-existing `BASELINE_RATIO = 0.88` (a hand-picked
constant, disclosed as an approximation since the Publication Typography
task) turns out to equal **exactly** `880 / 1000` — the font's own real,
measured vertical-origin fraction. This is not a coincidence uncovered by
guessing; it is now proven by real data. The fix is: derive this ratio
FROM the font (`deriveBaselineRatioFromFont` in `pdfGenerator.ts`, using
`FontMetricsReader`'s new `verticalMetrics()` — reads `vhea`/`vmtx` for
real, computes `originY = yMax + topSideBearing` per the OpenType spec's
own VORG-less-TrueType formula, looks up any representative covered
glyph since the value is uniform) instead of hard-coding it. The NUMERIC
output is unchanged (`0.88`, confirmed byte-identical PDF output via
`fontDerivedVerticalOrigin.test.ts`'s own "canonical PublicationDocument
coordinates are identical... only the PAINT command's own yMm changes"
test using both the fallback and the font-derived value) — what changed
is that this number is now a proven consequence of the real font, not an
assumption, with a documented fallback (`FALLBACK_BASELINE_RATIO`, same
value) for the case where a font resource genuinely lacks `vhea`/`vmtx`
(proven reachable via a corrupted-table-directory test, since the
committed font itself always has both).

jsPDF's own paint mechanism is unchanged and still the real constraint:
it has no vertical-writing-mode API (confirmed exhaustively in the prior
Publication Typography task) and paints every glyph via ordinary
horizontal alphabetic-baseline metrics regardless of anchor position —
this task's finding is that, for THIS font, that horizontal-baseline
fallback already lands in the position the font's own vertical metrics
consider correct, uniformly, for every glyph.

## 6. Small Kana Result

`isSmallKana` (unchanged, generalizes to the full hiragana+katakana small
set — never special-cased to only っ) was used to select 6 small-kana
characters (ぁゃょっゅ + katakana ッ) alongside ordinary kanji/kana in
`fontDerivedVerticalOrigin.test.ts`'s uniformity test — all share
`originY = 880`, identical to た/東/あ. **No font-derived basis exists for
moving small kana away from the same baseline position ordinary
characters use.** The corrected `BASELINE_RATIO` (now font-derived, same
numeric value) applies uniformly; no per-class offset is added.
`small-kana-position-font-metrics.pdf` regenerated (ONE implementation,
not three candidates).

## 7. Punctuation Result

Same finding for 「」（）、。 and their real vertical-presentation-form
substitutes (U+FE41/FE42/FE35/FE36/FE11/FE12) — every one shares
`originY = 880`. **No font-derived basis exists for a bracket/comma/
period-specific offset either.** `punctuation-position-font-metrics.pdf`
regenerated (ONE implementation).

Per this round's own instruction ("if the metric model itself contains
one unresolved convention, create at most 2 alternatives") — no such
ambiguity was found: the uniform-origin result is unambiguous (16/16 and
then the generalized set all agree exactly), so a single implementation
is produced, not two.

## 8. Dependency Gate

**Not triggered.** Font metrics (real `vhea`/`vmtx`, parsed with the
existing minimal in-house SFNT reader, no new dependency) were sufficient
to answer this round's own key question definitively: they show the
font's intended vertical origin IS already what the current paint model
uses, and that the font provides no data to justify differentiating
punctuation/small-kana from ordinary characters. No HarfBuzz/fontkit/
opentype.js dependency was added, requested, or is required by this
finding — a genuine "insufficient metrics, STOP" outcome never occurred,
because the metrics were sufficient to reach a conclusive, evidence-based
answer (uniform origin, no room for a font-derived differentiation).

## 9. What This Does NOT Explain

The original Human-observed symptoms (closing bracket looking far from a
preceding period; small kana "not sitting naturally") are real visual
observations. This task's finding is that the font's own vertical-ORIGIN
data does not support fixing them via a per-glyph Y-offset — origin is
uniform by design. Any remaining visual unevenness is necessarily a
function of each glyph's own INK shape sitting differently within an
identical, correctly-placed advance box (real, measured ink bboxes are in
§3 above and do vary substantially glyph-to-glyph) — the SAME
ink-centroid-vs-em-box phenomenon already identified, and deliberately
left alone by Human/Product decision, in the unrelated Preview-rhythm
investigation (P3-O29). Chasing that further here (e.g. an
ink-centroid-based re-centering scheme) would reintroduce exactly the
"subjective numeric tuning" this round explicitly prohibited, now with
real ink data instead of arbitrary constants but still without a Human
Product decision to pursue it. This task stops at: the font-derived
origin is correct and unchanged; no further offset is added; the
ink-shape variation is disclosed as a known, unresolved, deliberately
not-pursued factor, matching this project's own existing precedent.

## 10. Architecture

`fontMetrics.ts` (Publication-Renderer-paint-only, same boundary as
`fontCapability.ts` — never imported by/shared with Core) gained
`verticalMetrics(glyphId)` (reads real `vhea`/`vmtx`, computes real
`originY`). `fontCapability.ts` gained `createGlyphIdLookup` (the same
cmap parse `createGlyphCoverageChecker` already did, now exposing the
real numeric glyph ID needed for `glyf`/`vmtx` lookups, not just a
boolean). `pdfGenerator.ts` gained `deriveBaselineRatioFromFont`
(Publication-only paint-time helper) and now threads a real `baselineRatio`
parameter through `buildPaintPlan`/`unitCommands`/`verticalGraphemeCommands`
in place of the retired `cellLocalCandidate` machinery. Core's canonical
1em cells/`MeasurementFacts` are completely untouched — no Core consumer
needed this data, so none was added there, per this round's own explicit
scope boundary.

The round-4 `cellLocalOffsetFor`/`CellLocalOffsetCandidateId`/
`CANDIDATES` system (`verticalGlyphMap.ts`) is retired, not merely
un-defaulted — real font data now proves there is nothing for a per-class
offset to be derived from. `classifyPunctuation`/`isSmallKana` are
retained (real, correct, tested classification facts, now used
productively to prove the uniformity finding generalizes beyond the 16
hand-picked characters). The old `cellLocalOffset.test.ts` (candidate
comparison PDFs) is removed and replaced by `fontDerivedVerticalOrigin.test.ts`.
`punctuation-position-comparison-{A,B,C}.pdf` /
`small-kana-position-comparison-*.pdf` from round 4 are left on disk as a
historical record of the rejected candidates; the new
`punctuation-position-font-metrics.pdf` / `small-kana-position-font-metrics.pdf`
are the current, single, font-derived artifacts.

## 11. Tests

- `fontMetrics.test.ts` (4 tests): real table-presence audit, `vhea`/`vmtx`
  presence, real glyph ID + metric extraction/determinism for the full
  required character set.
- `fontDerivedVerticalOrigin.test.ts` (12 tests): classification retained
  correctly; `deriveBaselineRatioFromFont` reads the real font and returns
  the real measured value; every classified character (punctuation +
  small kana, generalized) shares the identical real origin as ordinary
  kanji; determinism; disclosed fallback path proven reachable (corrupted
  vhea/vmtx table-directory tags); canonical `PublicationDocument`
  coordinates unaffected by `baselineRatio` (only paint `yMm` changes);
  a different `baselineRatio` DOES change painted `yMm` (parameter
  actually wired, not ignored); source never mutated; both
  `*-font-metrics.pdf` artifacts generated.
- **Full regression:** Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09
  (Preview) 114/114, P3-O08 (Publication) 94/94 — all PASS. `npx tsc
  --noEmit`: 0 new errors (only the known pre-existing
  `src/app/layout.tsx` baseline error).

## 12. Safety

Core: untouched. Preview: untouched. `src/`/Production: untouched. No new
dependency (HarfBuzz/fontkit/opentype.js NOT added — the dependency gate
was never triggered, per §8). Font asset: unchanged, same committed
Shippori Mincho TTF used throughout this whole task chain. Ruby
(rubyScale=0.5): not reopened, not retested beyond confirming the
existing frozen tests still pass in the same full-suite run.

## 13. Remaining

None for this round's own scope. If a future Human/Product decision
explicitly authorizes pursuing ink-centroid-based visual balancing (§9),
that would be a new, separately-scoped investigation — not a continuation
of offset-candidate tuning, and not started here.

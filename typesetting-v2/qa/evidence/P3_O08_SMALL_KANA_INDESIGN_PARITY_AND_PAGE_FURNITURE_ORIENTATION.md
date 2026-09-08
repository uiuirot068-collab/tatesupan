# P3-O08 — Small-Kana InDesign Parity + Page-Furniture Orientation (Human Visual QA HOLD round 23)

Three Human QA failures found against a direct Adobe InDesign
comparison: small kana (っ) in-cell vertical imbalance, folio painted
sideways, 柱 painted as a stacked vertical column. Continues from
commit `c29b190`.

## Part A — Small kana

### Human's InDesign reference (as supplied)

For "雨だった。", measured ink-CENTER-to-ink-CENTER distances:

| | current Publication | InDesign |
|---|---|---|
| だ→っ | ~33px | ~35.5px |
| っ→た | ~48px | ~35.5px |

InDesign's own numbers are symmetric (35.5/35.5); current Publication's
are not (33/48) — implying っ's own ink sits too early along the
vertical-flow axis, by roughly 0.18em normalized against the ~40.5px
ordinary pitch.

### Real-data audit (this codebase's own measured font data, not memory)

っ paints via its real GSUB vertical-alternate OUTLINE glyph (glyph ID
15477, confirmed present, round 6/7's own established mechanism —
unchanged this round). Its real ink bbox (opentype.js's own
`getBoundingBox()`, this font, this glyph): `yMin=118, yMax=562` (font
units, `unitsPerEm=1000`). Under the CURRENT uniform, vmtx-origin-
derived default baseline ratio (`0.88`, round 5), っ's own ink occupies
roughly the 32%–76% band of its own 1em slot (center ≈ 54%) — already
close to, not far from, the slot's own geometric center (50%).

### Implemented correction — bbox-derived, not a magic constant

`VerticalOutlineContext.inkCenteredBaselineRatioForSmallKana(grapheme)`
(new, `verticalOutlinePaint.ts`): for any cl-11 (small kana) character —
`SMALL_KANA_TEST`, ported verbatim from `core/rules/defaultRuleSet.ts`'s
own cl-11 member list — computes `ratio = 0.5 + (yMax + yMin) / (2 ×
unitsPerEm)` against the ACTUAL painted glyph's own real ink bbox. This
centers the glyph's own ink on its own slot's vertical center, exactly
as the task's own hypothesis specified ("SMALL KANA INK BBOX CENTER →
CANONICAL SLOT CENTER"). For っ, this computes to **ratio ≈ 0.84** (vs.
the uniform default 0.88) — a real, measured, deterministic shift,
proven by a dedicated test (`inkCenteredBaselineRatioForSmallKana("っ")`
≠ `0.88`, reproducibly).

### Honest limitation — magnitude does not fully match Human's own measurement

The bbox-centering model moves the ratio from `0.88` to `0.84` — a
**0.04 shift**, not the **~0.18** Human's own pixel measurement implied.
Two real, disclosed possibilities, neither confirmed within this
round's own timebox:

1. Ordinary characters (だ/た) may not themselves center at exactly 50%
   under the uniform default either (round 5's own vmtx-origin data is
   uniform ACROSS glyphs, not independently proven to center every
   glyph's own ink at the slot midpoint) — if だ/た's own ink sits
   somewhat off-center too, the RELEVANT comparison is not "っ vs its
   own slot center" but "っ vs the actual midpoint between だ's and た's
   own real painted ink," which this round did not independently
   re-derive.
2. GPOS `vpal` data (round 10) may carry its own real per-glyph
   YPlacement for small kana specifically, additively affecting the
   Human-observed screenshot in a way this round's own bbox-only model
   does not capture — round 10's own general "normal-kana-control" vpal
   sample was small (yPlacement +39, 0.039em) but small kana's own real
   entry was not independently re-measured this round.

**This is implemented as the principled, real-data-derived correction
the task explicitly asked for (never a hardcoded 0.18em), applied only
to cl-11 members, generalizing across the whole class (proven by a
dedicated test over every cl-11 character with a resolvable glyph in
this font) — but it is recorded HONESTLY as a real, measured, partial
fix, not claimed to fully resolve the reported symptom.** Human
recheck against `small-kana-indesign-parity-qa.pdf` will show directly
whether this is sufficient or whether a follow-up round (investigating
possibility 1 or 2 above) is needed.

### Invariants preserved

Canonical advance stays 1em (unaffected — paint-only, proven directly).
Page/line breaks unchanged. GSUB glyph selection unchanged (still the
real vert-alternate outline). GPOS `vpal` is gated off for any
character this correction applies to (same no-double-application
pattern already established for yakumono edge-alignment). Ordinary つ
(not small) is unaffected — returns `undefined`, keeps the uniform
default. Generalizes across the full cl-11 set (proven, not just っ).

## Part B/C — Folio and 柱 horizontal orientation

Rounds 20–22 mistakenly routed BOTH through
`verticalGraphemeCommands` — the SAME per-character vertical painter
body text uses, including GSUB vert/vrt2 substitution, small-kana
handling, and yakumono edge-alignment — none of which are meaningful
for generated page furniture (Arabic digits, arbitrary user-authored
柱 text). This painted Arabic numerals sideways/rotated and 柱 text
stacked one character per line — real, confirmed Human QA failures.

**Fix:** new `horizontalFurnitureCommand(text, xCenterMm, yCenterMm,
fontSizePt)` (`pdfGenerator.ts`) — a single, unrotated (`angle: 0`),
unsplit horizontal text command, deliberately bypassing
`verticalGraphemeCommands` entirely. This is the SAME architectural
pattern `tcyCommand` already established for "content that must read
horizontally even inside a vertical-rl document" — not a new paint
concept, a proven one reused.

**Position semantics fully preserved, only orientation changed:**
folio's `center`/`left`/`right` (parity-resolved by Core, round 22,
unchanged) still anchor horizontally at the same computed x; vertical
placement is now the CENTER of the reserved bottom-margin band
(`paperHeightMm - marginBottomMm/2`) rather than its own top edge
(meaningful for a single horizontal line, unlike the old vertical-flow
interpretation). 柱's `top`/`bottom` (unchanged, passed through from
Core) center within their own respective margin band the same way.
Suppression, `nombreStart`, `hideNombreOnFirstPage`, `hashiraOdd`/
`hashiraEven`/`hideHashira`/`hashiraOverride` — all Core-side, round
21/22 logic, completely untouched.

## Body invariants

Small-kana correction is paint-only — canonical advance, page capacity,
line breaks, SourceSpan: all proven unchanged. Folio/header horizontal
repaint does not touch body reflow — proven by structural comparison
(furniture enabled vs. disabled, byte-identical body columns).

## QA artifacts

- `qa/publication/p3-o08/small-kana-indesign-parity-qa.pdf` — 8 fixtures
  (`だった。`/`あった`/`きっと`/`やっぱり`/`ちょっと`/`きゃく`/`きゅう`/
  `きょう`) + a QA-only cell-debug page for `だった。` (cell boundary +
  real ink bbox overlay, never wired into normal Publication output).
- `qa/publication/p3-o08/small-kana-and-page-furniture-final-qa.pdf` —
  Section A (small-kana parity), B (folio: 1/2/10, odd/even outer,
  odd/even gutter), C (header: top/bottom), D (folio+header+body
  together).

## Tests

`renderer/publication/smallKanaAndPageFurnitureOrientation.test.ts` (20
tests): Part A (advance/breaks/GSUB unchanged, deterministic real-data
ratio, つ unaffected, full cl-11 coverage, real painted effect), Part B
(single horizontal command, no vert/vrt2, multi-digit order, position
semantics unchanged), Part C (single horizontal command, top/bottom
unchanged, odd/even content, hide/override), integration (body
invariance, combined-fixture regression, vector-only determinism), and
both QA-artifact generators.

**Full regression:** Core 364/364 (unchanged — zero Core files touched
this round), Stage C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114,
P3-O08 (Publication) 274/274 (254 + 20 new) — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): untouched. Core: untouched (zero files) — both
corrections are Publication paint-only. No new dependency. No push, no
deploy, no reset.

## Human recheck required

1. Does `small-kana-indesign-parity-qa.pdf` show っ meaningfully better
   centered, or does the gap after it remain visually larger than
   before it? Given the honestly-disclosed magnitude gap above, this
   may need a follow-up round.
2. Does `small-kana-and-page-furniture-final-qa.pdf` Section B/C show
   folio numbers and 柱 text reading normally, horizontally, matching
   InDesign?

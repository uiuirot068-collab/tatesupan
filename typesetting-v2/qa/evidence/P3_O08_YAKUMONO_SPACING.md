# P3-O08 — Yakumono (Punctuation-Pair) Spacing (Human Visual QA HOLD round 8)

## 1. Human Status (Recorded, Not Reopened)

- **Ruby: PASS** — frozen (rubyScale=0.5), untouched this round.
- **Small kana: PASS** — closed. Real GSUB vertical-glyph outline paint
  (round 7) confirmed correct by Human Visual QA.
- **Dash: PASS** — closed. Real GSUB vertical-glyph outline paint (round
  7) confirmed correct by Human Visual QA.
- **Punctuation (`。→」`): HOLD** — the sole remaining target of this
  round.

## 2. Prior Eliminated Hypotheses (Not Reinvestigated)

Vertical-form glyph identity (round 3), vhea/vmtx vertical origin (round
5), GSUB glyph identity (round 6), outline paint mechanism (round 7) —
all independently proven correct across four separate rounds. This
round's own premise, confirmed correct: the remaining `。→」` gap is not
a rendering-mechanism defect.

## 3. Canonical Position Audit (Real, Measured)

Fixture: `「今日は、雨だった。」`, `composeLine`/`composeCanonicalDocument`
against the real `DEFAULT_RULE_SET_V2` and fake measurement provider
(1 cell = 3528 ticks at this settings profile).

| Char | Index | Class | xTick | yTick (before fix) |
|---|---|---|---|---|
| 。 | 9 | cl-06 (full stop) | 0 | 9×3528 = 31752 |
| 」 | 10 | cl-02 (closing bracket) | 0 | 10×3528 = 35280 |

**Before this round's fix:** `advanceTickFor` for a `TEXT` unit
unconditionally returns `perCellAdvance` (`core/compose/line.ts`, the
`switch` statement's `case "TEXT": return perCellAdvance;`) — confirmed
directly by reading the code, not inferred. **Every character, including
every punctuation mark, receives the exact same full 1-em canonical
advance, with zero adjacency-based adjustment of any kind.** Start-to-
start distance for `。→」` was exactly `perCellAdvance` (one full em),
identical to every other adjacent pair in the document, including
ordinary kanji.

**Root cause: CANONICAL SPACING** (not "other," not a rendering defect,
not Product-arbitrary-policy) — proven by direct code inspection, not
guessed.

## 4. Rule Evidence

**No FROZEN Phase-3 rule-freeze document addresses this.** Confirmed by
direct audit of `P3_KINSOKU_RULE_FREEZE_CANDIDATE.md` (line-breaking
prohibition only, never advance/width),
`PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` (zero matches for
yakumono/spacing/半角/advance), `P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md`
(cl-08 pairing only, unrelated topic), and the Core Contract's own §18
Natural Pitch text, which reads as absolute/uniform with no punctuation
carve-out named anywhere.

**Real, primary-source evidence DOES exist in this project's own research
cache**, not previously surfaced into a Phase-3 rule-freeze document:
`research/phase3/source-cache/jlreq/punctuations_in_different_sizes.md`
(小林敏, 2021 — a JIS X 4051/JLReq-sourced discussion of adjacent-punctuation
spacing, read directly for this round, not from memory). Key finding,
translated: JLReq's own convention groups periods/commas WITH closing
brackets for this purpose (原文: *"なお，句読点は"終わり"に含める"* —
"note: punctuation marks are included in the 'closing' category"), and
defines four adjacency cases for 括弧類等 (bracket-type-etc characters):

- **a** — closing-type followed by opening-type (e.g. `。「`)
- **b** — opening-type followed by opening-type (e.g. `「「`)
- **c** — closing-type followed by closing-type (e.g. `。」`, `」」`) —
  **this round's exact reported symptom**
- **d** — opening-type followed by closing-type (e.g. `「」`, rare)

For cases a/b/c (same font size, the common case — this project's own
`。→」` symptom is case c), the source states the fix is to remove ONE of
the two characters' own built-in half-cell blank margin, leaving a single
half-em combined gap rather than two half-em blanks stacking into a full
em (原文: *"bとcは，前又は後ろの括弧類等のアキを削除すればよい"* — "for b
and c, it suffices to remove the blank from the front OR back
bracket-type character"). This is NOT the same kind of open,
multiple-legitimate-conventions question ruby overhang was (jlreq
documents several genuinely competing conventions there); for the
same-size case here, the rule is a single, well-established value.

**Official evidence supports adjustment: YES**, for the specific,
common, same-size cases (a/b/c) this round's fixture exercises.

## 5. Core Change

**Canonical spacing: CHANGED.** `core/rules/characterClass.ts`'s
`RuleSetVersion` gained a new frozen field,
`yakumonoSpacingScope: CharacterClassId[]`, populated in
`core/rules/defaultRuleSet.ts` as `["cl-01", "cl-02", "cl-06", "cl-07"]`
(opening brackets, closing brackets, full stops, commas — jlreq's own
grouping, cited above) — **data-driven**, reusing the EXISTING
`characterClassFor`/`CharacterClassId` infrastructure this project
already built for kinsoku and ruby-overhang purposes (Contract §7); no
new classification concept, no `if (char === "。")` special case anywhere.

`core/compose/line.ts` gained `applyYakumonoCompression` (called from
`computeAtoms`, once per atom, right before it is pushed): when the atom
about to be placed AND the atom placed immediately before it both have a
leading/trailing character in `yakumonoSpacingScope`, the PREVIOUS atom's
own `advanceTick` (already pushed to the `atoms` array) is halved. A real
bug was caught and fixed during implementation: `advanceTick` represents
the space AFTER an atom (consumed when the NEXT atom is placed via
`yTick += atom.advanceTick`), not before it — an initial draft compressed
the wrong atom (the one about to be placed) and produced zero effect
(caught by a failing test, not shipped). The corrected version mutates
the ALREADY-PUSHED previous atom in place.

**Disclosed simplification:** the source's rare case "d" (opening
immediately followed by closing, e.g. `「」`) calls for full removal of
both sides' blanks (ベタ/zero gap); this implementation's single uniform
rule instead halves only the pair's leading atom, giving case d a
half-cell gap rather than true zero. The common cases (a/b/c — including
this round's own `。→」` symptom, case c) are handled exactly as the
source specifies. Recorded, not silently absorbed.

**Data-driven: YES.** **Source changed: NO** (proven —
`unit.text`/`SourceSpan` mutation tests pass; only `advanceTick`, a
derived composition value, changes). **Natural Pitch stretch introduced:
NO** — this compresses specific pair advances downward from their
Natural-Pitch baseline; it never stretches anything to fill (INV-004
remains intact, proven by a dedicated
`residualSpaceTick`-still-reflects-real-leftover test).

## 6. Break Consequences

Compressing canonical advance changes total consumed extent per line,
which CAN legitimately shift line-break positions. **Full regression
result: zero existing test broke** — every one of the 364 pre-existing
Core tests, and every Stage C/D/Preview/Publication test, passed
unmodified after this change, meaning no existing fixture in this
project happened to place a yakumono pair at a break-critical position.
This is recorded honestly as an observed fact (no fixture was found that
exercises this interaction), not claimed as a guarantee that no future
fixture ever will. Kinsoku legality itself is untouched — this change
only affects the ADVANCE value fed into the existing, unmodified
break-legality algorithm; a dedicated test confirms `、`/`。`/`」` still
never start a line under a tight extent forcing a break near them.

## 7. Parity

**Preview: YES (N/A additional code)** — Preview's own Renderer consumes
`PlacedUnit.yTick`/`xTick` exactly as Core produces them; no Preview-side
advance/spacing logic exists to update, so it automatically reflects the
corrected canonical positions with zero additional change (confirmed:
Preview's own 114-test suite passes unmodified).

**Publication: YES** — same structural argument, confirmed directly by a
new test (`yakumonoSpacingQa.test.ts`): the `。→」` pitch in a real
`PublicationDocument` built from the real `composeCanonicalDocument` is
measurably smaller than an ordinary full-cell pitch (`、→雨`, an
unaffected pair in the same fixture) — with zero Publication-side
spacing code of any kind. Publication's own paint layer (font-derived
vertical origin, GSUB outline paint) is completely unaware this happened;
it just paints whatever canonical position Core handed it, exactly as
designed.

## 8. QA

`qa/publication/p3-o08/yakumono-spacing-qa.pdf` — real 文庫 105×148mm
paper, real margins, real Shippori Mincho, real vertical-glyph/GSUB
outline pipeline, fixture `「今日は、雨だった。」` prominently rendered.
`publication-typography-qa.pdf` also regenerated (automatically reflects
the corrected canonical positions — no separate Publication code change
was needed for it to do so).

**Human recheck: PENDING.**

## 9. Tests

`core/compose/yakumonoSpacing.test.ts` (16 tests): the reported symptom
fixture (`。→」` compressed, `、→雨` not — both measured in one real
composed line); all four jlreq-cited adjacency cases (a/b/c/d) verified
individually; negative cases (ordinary kanji pairs, a lone yakumono
character next to ordinary text, digits/Latin) proven UNAFFECTED;
structural exclusion (SEMANTIC_RUN Dash, TCY) proven untouched; source/
SourceSpan invariance; grapheme count/order preservation; determinism;
kinsoku legality preservation; Natural Pitch non-stretch invariant.
`renderer/publication/yakumonoSpacingQa.test.ts` (2 tests): real
Publication-layer pitch measurement + QA PDF generation.

**Full regression:** Core 380/380 (364 pre-existing + 16 new), Stage C
21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication)
138/138 (136 pre-existing + 2 new) — all PASS. `npx tsc --noEmit`: 0 new
errors (only the known pre-existing `src/app/layout.tsx` baseline error).

## 10. Safety

Core changed: YES, explicitly authorized by this round's own "Core
Change Gate" (canonical spacing proven wrong/incomplete, §3) and grounded
in real, cited primary-source evidence (§4), not invented. `src/`/
Production: untouched. No new dependency. No push, no deploy.

## 11. Round 9 — Glyph-Size Regression (Found by Human Visual QA, Fixed)

**Human report:** the yakumono spacing fix compressed `。`/`」`'s own
PAINTED GLYPH SIZE to ~50% of body size (~5.25pt vs. ~10.5pt), not merely
the spacing between them.

**Root cause, confirmed by direct code read:** `renderer/publication/
paintModel.ts`'s `buildPaintLine` derives each `PaintPlacedUnit.heightMm`
as `next.yTick - placed.yTick` — the gap to the NEXT unit, i.e. this
atom's own canonical ADVANCE. `pdfGenerator.ts`'s `unitCommands` then
used this SAME `heightMm` value, unconditionally, as the basis for the
painted GLYPH FONT SIZE (`mmToPt(unit.heightMm)`) for TEXT/RUBY-base/
DASH/ELLIPSIS. Before round 8, every atom's advance was uniformly 1em, so
`heightMm` numerically equalled the body em regardless — this conflation
was harmless. Round 8's real, legitimate advance compression for
adjacent yakumono pairs broke that coincidence: a compressed atom's own
`heightMm` (now 0.5 cell) got reused directly as its own font size (now
0.5 × body em) — exactly the reported symptom.

**Fix:** `PublicationDocument` gained a new field, `bodyEmMm` — the
fixed, document-wide body em in mm, derived from `ctx.linePitchTicks`
(a declared `LayoutSettings` constant, `settings.linePitchTicks`, never
a per-atom composed/compressed advance) — computed once in
`buildPublicationDocument`. `pdfGenerator.ts`'s `unitCommands` now
derives every glyph's own FONT SIZE from `doc.bodyEmMm` exclusively;
`unit.heightMm` remains used ONLY for POSITIONING (where an atom sits,
how far apart consecutive graphemes within a multi-character atom like a
Ruby base or Dash run are stacked) — the two quantities are now fully
decoupled, per the round's own explicit "advance ≠ paint em" instruction.
No special case was added for `。`/`」`/any specific character — every
kind (TEXT, RUBY base+annotation, DASH, ELLIPSIS) now derives font size
from the same single, constant source.

**Verified, not merely asserted:** `renderer/publication/
glyphSizeIndependence.test.ts` (14 tests) proves every painted character
in the round-8 fixture shares the exact same `fontSizePt` (including the
compressed `。`/`」` pair), that this size equals the document's own
declared body em (10.5pt), that the round-8 spacing compression is
STILL ACTIVE (not reverted), that source/SourceSpan/canonical coordinates
are all unaffected, and that Ruby/Dash/Ellipsis/TCY all independently
paint at the correct fixed size.

**Full regression after the fix:** Core 380/380 (unchanged — this is a
Publication-only fix, no Core file touched), Stage C 21/21, Stage D
30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 152/152 (138+14) —
all PASS. `npx tsc --noEmit`: 0 new errors.

`yakumono-spacing-qa.pdf` and `publication-typography-qa.pdf`
regenerated with the fix applied — Human recheck of the corrected PDF is
PENDING.


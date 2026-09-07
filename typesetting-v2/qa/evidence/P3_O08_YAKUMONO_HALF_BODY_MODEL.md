# P3-O08 — Yakumono Half-Body Canonical Model (Human Visual QA HOLD round 11)

## 1. History — Why the Model Was Replaced, Not Re-Tuned

- **Round 8** (canonical spacing, first attempt): FAIL — glyphs shrank
  to ~50% of body size. Root cause: `PaintPlacedUnit.heightMm` conflated
  positioning-advance with paint-em (fixed at round 9, but the
  underlying CANONICAL MODEL — "full-em body + negative pair adjustment"
  — was never itself questioned).
- **Round 9** (glyph-size fix): PASS for glyph size, but `」` visibly
  intruded into the preceding sentence-end area once glyphs were
  correctly restored to full size — because the canonical advance model
  was still "shrink the pair by subtracting 0.5em from a full-em body,"
  with no accompanying ink-placement correction.
- **Round 10** (real GPOS `vpal` ink-placement fix): FAIL for the visual
  target — a real, font-derived YPlacement nudge for opening brackets was
  applied, but the reported symptom persisted essentially unchanged. This
  proved the defect was not a rendering/paint-mechanism gap at all — it
  was the CANONICAL MODEL itself.
- **Round 11 (this round):** the canonical model is retired and replaced.
  Not a magnitude tweak of round 8's constant — a genuinely different
  representation.

## 2. Root Architectural Finding

jlreq's 括弧類等 classes (opening brackets cl-01, closing brackets cl-02,
full stops cl-06, commas cl-07) do **not** have a full 1em canonical body
that occasionally receives a negative pair adjustment. They have an
**intrinsic half-em canonical body**, with an **additional, explicit
half-em side space** added only in specific adjacency contexts. Round
8's model was architecturally backwards: it started every character at
1em and only ever subtracted; the correct model starts these four
classes at 0.5em and only ever *adds*.

## 3. Audit of the Retired Model

`core/compose/line.ts`'s `applyYakumonoCompression` (round 8, now
deleted): every TEXT atom's `advanceTickFor` unconditionally returned
`perCellAdvance` (a full cell); a SEPARATE post-hoc pass halved the
PREVIOUS atom's own `advanceTick` only when both it and the current atom
were in `yakumonoSpacingScope`. This is exactly "base unit = 1em, then
subtract 0.5em for a pair," proven directly by re-reading the removed
code before deleting it (not assumed).

**Retired, not preserved for compatibility:** the old `core/compose/
yakumonoSpacing.test.ts` (16 tests asserting the old model's exact
numeric values) has been DELETED, not left standing — its own
assertions are provably wrong under the new model (verified directly:
re-running it against the new code produces `expected 3528 to be
1764`-style failures for every pair case). A new file,
`core/compose/yakumonoHalfBody.test.ts`, replaces it entirely.

## 4. New Canonical Model

`RuleSetVersion.yakumonoSpacingScope` is renamed to
**`yakumonoHalfBodyScope`** (semantic change, not just a rename — see
`characterClass.ts`'s own field doc). Frozen v2 default unchanged:
`["cl-01", "cl-02", "cl-06", "cl-07"]`.

**Body** (`bodyAdvanceTickFor`, `core/compose/line.ts`): any TEXT atom
whose character's class is in `yakumonoHalfBodyScope` gets **half**
`perCellAdvance` as its own intrinsic body — unconditionally, whether
paired with another yakumono character or not. Every other atom
(ordinary TEXT, or any TCY/SEMANTIC_RUN/RUBY/IMAGE atom) is completely
unaffected.

**Side space** (`yakumonoSpaceAfterEm`): computed for the boundary
between atom *i* and atom *i+1*, added directly to atom *i*'s own
`advanceTick` (which is, by this composer's own existing convention,
"the space AFTER this atom"). **Data-driven — reuses the EXISTING
`mayStartLine`/`mayEndLine` class flags already defined for kinsoku
purposes; no new class concept, no hardcoded literal characters
anywhere in the production rule:**

```
function yakumonoSpaceAfterEm(currentClass, nextClass, ruleSet):
  nextInScope = yakumonoHalfBodyScope.includes(nextClass.id)
  if nextInScope and nextClass.mayEndLine === false:      # "opening"-type next
    return 0.5
  if currentClass in scope and currentClass.mayStartLine === false   # "closing"-type current
     and not nextInScope:
    return 0.5
  return 0
```

This single function, verified against every worked numeric example this
round's own task text gave explicitly:

| Adjacency | Rule fired | Result |
|---|---|---|
| ordinary → cl-06/07 | neither | 0 (period/comma attach directly, no leading gap) |
| cl-06/07 → ordinary | rule 2 | 0.5 (body 0.5 + space 0.5 = **1.0em total**, matching `た。次`) |
| cl-06/07 → cl-02 | neither (rule 2 suppressed, `nextInScope`) | 0 (body 0.5 only — matching `た。」`'s own explicit worked example: "no default trailing 0.5em space between them... together occupy one normal em") |
| ordinary → cl-01 | rule 1 | 0.5 ("cl-01 normally has 0.5em before it") |
| cl-01 → ordinary | neither | 0 (no default trailing space after an opening bracket) |
| cl-01 → cl-02 (`「」`) | neither | 0 (ベタ, jlreq's own rare case d) |

## 5. `。 + 」` — the Original Reported Symptom

`。`'s own `advanceTick` = body (0.5) + 0 (suppressed, next=`」` is in
scope) = **exactly half a cell**. No inserted inter-space between the
two bodies; no negative-overlap arithmetic anywhere. `。` and `」`
together occupy exactly one normal em (0.5 + 0.5), verified directly
(`yakumonoHalfBody.test.ts`'s own `た。」`/full-sentence tests) and via
Publication's own real pitch measurement
(`yakumonoSpacingQa.test.ts`/`yakumonoHalfBodyQa.test.ts`).

## 6. Full Class-Pair Truth Table — Verified, Not Assumed

Every pair the round explicitly required is proven by a real
`composeLine` test in `yakumonoHalfBody.test.ts` (see file for exact
pitches): ordinary+cl-06, cl-06+ordinary, ordinary+cl-07, cl-07+ordinary,
ordinary+cl-01, cl-01+ordinary, ordinary+cl-02, cl-02+ordinary,
cl-06+cl-02, cl-07+cl-02, cl-02+cl-01, cl-01+cl-01, cl-02+cl-02.

**Two pairs (`cl-02+cl-01` and `cl-01+cl-01`) have no worked numeric
example anywhere in this round's own task text.** For these, the
class-rule above gives a determinate, documented answer (the
leading-space rule for a next=cl-01 boundary fires unconditionally,
regardless of the current class) — disclosed explicitly here as the
chosen, deterministic resolution of a genuine open question, not
silently assumed to be "obviously correct." A future Human/Product
review specifically of these two pairs (bracket-adjacent-to-bracket
sequences) remains open.

## 7. cl-05 (Middle Dot) — Deliberately Left Open

Not added to `yakumonoHalfBodyScope`. jlreq gives cl-05 a different
(quarter-space) convention this round does not model. `・` keeps its
full 1em body, unaffected — proven directly
(`yakumonoHalfBody.test.ts`'s own "middle dot... unaffected" test).

## 8. Glyph Visual Size — Round 9's Fix Not Regressed

Core has no font-size concept at all (Contract §18) — the half-body
model is purely a canonical-advance/position concept. Publication's own
`bodyEmMm` (round 9) remains the sole source of glyph paint size,
completely decoupled from any atom's own (now sometimes half-cell)
`heightMm`. Verified: `glyphSizeIndependence.test.ts`'s full 14-test
suite passes unmodified against the new Core model — every glyph,
including the now-half-body `。`/`」`, still paints at the identical,
constant `fontSizePt`.

## 9. Font Implementation Independence

The canonical body/space values (0.5em) are **not** derived from
Shippori Mincho's own physical glyph metrics — Core's `yakumonoSpace
AfterEm`/`bodyAdvanceTickFor` never read font bytes, never call
`FontMetricsReader`/`gposReader`/`gsubReader` (all Publication-only
modules, confirmed by import graph — `core/compose/line.ts` imports
`characterClass.ts` and nothing font-related). The real `vpal` YAdvance
values measured in round 10 (period ≈0.40em, closing bracket ≈0.48em)
are FONT-proportional metrics — deliberately NOT used as the canonical
progression value, precisely because jlreq explicitly allows different
fonts to implement punctuation with different inherent widths; Core's
own composition must stay authoritative and font-independent. `vpal`
YPlacement (round 10) remains valid, unchanged Publication paint data —
it still nudges ink within whatever cell Core now hands it, unaffected
by which canonical model produced that cell.

## 10. Natural Pitch Invariant — Not Violated

INV-004 ("never stretch to fill") is about page-fill stretch/arbitrary
tracking — it never mandated that every Japanese punctuation class must
have a full 1em canonical body. jlreq's own half-body punctuation
convention is a deliberate, standard Japanese composition exception,
not a form of "stretching." Verified directly: a dedicated test confirms
`residualSpaceTick` still reflects genuine real leftover extent (the
half-body model only ever shrinks specific bodies below 1em — it never
grows anything beyond what a real, if compressed, character-equivalent
would occupy).

## 11. Parity

Core: canonical `yTick`/`xTick` positions are the single source of
truth. Preview: automatically reflects the corrected model — zero
Preview files touched, zero Preview-side spacing logic exists to update
(confirmed: full 114-test Preview suite passes unmodified). Publication:
automatically reflects the corrected model too (zero Publication-side
canonical-spacing logic — Publication only ever reads `PlacedUnit.yTick`
and paints; its own real `vpal` ink-placement refinement from round 10
is orthogonal and untouched).

## 12. Line-Edge Policy — Explicitly Not Solved This Round

This model represents body-advance and side-space as genuinely separate
quantities (via the `bodyAdvanceTickFor`/`yakumonoSpaceAfterEm` split),
which is exactly the representation a future line-head/line-end
side-space removal/retention policy would need to build on. No such
policy is implemented this round — kinsoku's own existing
`mayStartLine`/`mayEndLine` prohibition rules (unchanged, already
frozen) continue to govern where a line may legally break; this round
never touches that legality decision, only the ADVANCE value fed into
it. Recorded as a distinct, still-open follow-on question.

## 13. QA

`qa/publication/p3-o08/yakumono-half-body-qa.pdf` — new, focused
diagnostic artifact: one page each for fixtures A (`た。次`), B
(`た、次`), C (`た。」`), D (`た、」`), E (`」次`), F (`先「次`), G
(`。」`), plus the original reported sentence
(`「今日は、雨だった。」`), at a generously large diagnostic size.
`yakumono-spacing-qa.pdf` and the combined `publication-typography-qa.pdf`
both regenerated too, automatically reflecting the new model (zero
Publication-side change needed for them to do so).

## 14. Tests

`core/compose/yakumonoHalfBody.test.ts` (27 tests, replaces the deleted
round-8 file): intrinsic body advance for each of the four classes;
this round's own two explicit worked examples (`た。次`, `た。」`) plus
the original reported-symptom fixture; the full required class-pair
truth table (13 pairs); structural exclusion (Dash/TCY unaffected);
cl-05 left open; source/SourceSpan invariance; determinism; kinsoku
legality preservation; Natural Pitch non-stretch invariant.
`core/compose/page.test.ts`: one PRE-EXISTING (pre-round-8) test's own
expected value updated — its fixture (`「いう`) incidentally used `「`
as ordinary text, and its assertion baked in the OLD "opening bracket =
full 1em" assumption; updated with a full explanation, not silently
patched. `renderer/publication/yakumonoHalfBodyQa.test.ts` (2 tests):
the focused diagnostic QA artifact + a direct canonical-pitch proof for
fixture C.

**Full regression:** Core 391/391 (380 pre-existing round-10 baseline −
16 removed round-8 tests + 27 new half-body tests, with one pre-existing
`page.test.ts` assertion updated in place, per §14 above), Stage C
21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication)
165/165 (163 pre-existing + 2 new) — all PASS. `npx tsc --noEmit`: 0 new
errors (only the known pre-existing `src/app/layout.tsx` baseline
error).

## 15. Safety

Core changed: YES — explicitly authorized by this round's own
instruction, since the prior model was proven architecturally wrong
(not merely mistuned) across three independent Human Visual QA rounds
(9, 10, and this round's own re-derivation). `src/`/Production:
untouched. Preview: untouched (zero files). No new dependency. No push,
no deploy.

## 16. Remaining Open Policy Items

- `cl-02+cl-01`/`cl-01+cl-01` (bracket-adjacent-to-bracket): resolved by
  the documented class rule (§6), not by an explicit jlreq worked
  example — flagged for a future, narrower Human/Product review if this
  specific adjacency becomes visually significant.
- cl-05 (middle dot) quarter-space convention: not modeled, left open.
- Line-head/line-end side-space retention/removal policy: not modeled
  this round (§12); the body/space split now exists to support it later.

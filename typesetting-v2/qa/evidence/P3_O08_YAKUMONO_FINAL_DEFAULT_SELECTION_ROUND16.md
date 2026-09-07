# P3-O08 — Yakumono Final Default Selection (Human Visual QA HOLD round 16)

Concise record of the Human A/B decision made against round 15's own two
QA-only comparison PDFs (commit `1197c10`), and the exact product
promotion implemented from it.

## Human decisions

**Small kana:** A_CURRENT (1em advance) = PASS, all 5 fixtures. B_HALF
(0.5em advance) = FAIL, all 5 fixtures. **Product decision: small kana
canonical advance stays 1em.** No code change. The B_HALF prototype test
(`smallKanaAdvanceHumanComparison.test.ts`) is retained as QA history —
it never touched any default file, so there is nothing to retire.

**Yakumono:** controls (`た。次`/`た、次`) — both variants acceptable, no
signal either way. Targeted pairs (`た。」`/`た、」`/full sentence ending
`。」`) — A_CURRENT = FAIL, B_HALF_PAINT_SLOT = PASS, all three.
**Product decision: promote B_HALF_PAINT_SLOT for exactly cl-06/cl-07 →
cl-02, nothing broader.**

## What "B" actually was (corrected framing)

Round 15's own audit found `paintModel.ts`'s `heightMm = next.yTick -
placed.yTick` means a compressed punctuation atom's own PAINT SLOT was
*already* half a cell — "B_HALF" was never really about slot size. The
real, proven variable Human approved is: **the punctuation's own
ink-flush anchor ratio, multiplied against the full, uncompressed
`bodyEmMm`, instead of that atom's own (Core-compressed) per-character
slot height.** Everything else — advance/progression, the closing
bracket's own anchor, glyph size — is unchanged.

## Implementation

`renderer/publication/verticalYakumonoAlign.ts`: `VerticalYakumonoAlignContext`
gains `usesFullEmAnchor(current, next): boolean` — `true` only when
`current` matches cl-06/cl-07's own member characters ("。．、，",
verbatim from `core/rules/defaultRuleSet.ts`) and `next` matches cl-02's
own member characters ("’”）〕］｝〉》」』】〙〗", same source). This
mirrors, never re-decides, Core's own already-narrow rule
(`conditionalYakumonoPairAdvanceTick`, `core/compose/line.ts`, unchanged
by this round).

`renderer/publication/pdfGenerator.ts`: `verticalGraphemeCommands` gains
two additive, optional parameters (`bodyEmMm`, `nextUnitFirstGrapheme`).
When `yakumonoContext.usesFullEmAnchor(ch, nextGrapheme)` is true, the
ink-flush anchor multiplies `bodyEmMm` instead of `perCharHeightMm`;
every other character (including the closing bracket itself, and every
yakumono-classified character with no cl-06/07→cl-02 trigger) keeps the
exact prior formula. `unitCommands`/`buildPaintPlan` thread the next
unit's own first grapheme through — the one new input this decision
needs, computed directly from `line.units[i+1]`, never re-deriving
classification Core hasn't already decided.

**Proven, not merely asserted (`yakumonoFinalDefaultSelection.test.ts`):**
`た。」`'s own 。 anchors at `topMm + bodyEmMm * ratio` (not the old
`topMm + heightMm * ratio`); `た、」`'s own 、 receives the identical
formula; `」` (the bracket) still anchors against its own slot height,
unaffected; `た。次`/`た、次` are unaffected (no cl-02 follows); glyph
`fontSizePt` is unchanged for every character; GPOS `vpal` stays gated
off for the pair (no double application); small kana's own default
paint plan is untouched; source/SourceSpan invariance holds.

## Retired

`renderer/publication/yakumonoHalfPaintSlotHumanComparison.test.ts`
deleted — its own A vs B comparison is now degenerate (A, the real
default, already equals what B used to test), so it no longer
demonstrates anything and would only confuse a future reader. Its
already-generated PDF (`yakumono-half-paint-slot-human-comparison.pdf`,
committed at `1197c10`) is left in place as the historical record of the
approved comparison; nothing regenerates it any more.

## QA artifacts

- `qa/publication/p3-o08/yakumono-final-human-qa.pdf` (new) — one page
  per fixture (`た。次`/`た、次`/`た。」`/`た、」`/full sentence ×2), no
  A/B labels, real production default only.
- `qa/publication/p3-o08/targeted-yakumono-qa.pdf`,
  `yakumono-legacy-parity-qa.pdf`, `publication-typography-qa.pdf`,
  `small-kana-cell-debug.pdf` — all regenerated (their own existing
  generators run against the real, updated default automatically; no
  generator code changed).

## Tests

New: `renderer/publication/yakumonoFinalDefaultSelection.test.ts` (12).
Removed: `yakumonoHalfPaintSlotHumanComparison.test.ts` (4, now
degenerate). Net Publication suite: 209 (was 201 after round 15).

**Full regression:** Core 376/376, Stage C 21/21, Stage D 30/30, P3-O09
(Preview) 114/114, P3-O08 (Publication) 209/209 — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, never modified. Core: untouched this round
(zero files) — the promoted change is Publication paint anchoring only,
exactly as Human specified. Preview: untouched. No new dependency. No
push, no deploy, no reset.

## Human recheck

Required: does `yakumono-final-human-qa.pdf` (the actual, integrated
new default, no labels) read as ordinary Japanese vertical typesetting
for `。」`/`、」`, matching page 10 of the approved
`yakumono-half-paint-slot-human-comparison.pdf` comparison, with
`。次`/`、次` unchanged?

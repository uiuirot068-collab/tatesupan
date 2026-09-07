# P3-O08 — Yakumono Normal Spacing, Final Decision (Human Visual QA HOLD round 17)

## History is not erased — it is superseded

**Round 14** (`qa/evidence/P3_O08_SMALL_KANA_AND_CONDITIONAL_PUNCTUATION_ROUND14.md`)
added a narrow Core canonical-advance suppression for cl-06/cl-07 → cl-02.
**Round 16** (`qa/evidence/P3_O08_YAKUMONO_FINAL_DEFAULT_SELECTION_ROUND16.md`)
promoted a matching Publication paint-anchor override, after Human A/B
approved it against round 15's own comparison PDFs. Both were real,
carefully-scoped, well-tested product changes — not mistakes at the time
they were made.

**Round 17:** Human rechecked against actual Adobe InDesign vertical
typesetting output — the real, authoritative reference this whole
P3-O08 effort has always aimed to match. The InDesign comparison shows
visible normal spacing before a closing bracket (`。」`/`、」`) is
**desired**, not a defect. Round 16's own selection is withdrawn. This
is a correction driven by better reference evidence, not a reversal of
process — round 14/16's own reasoning was sound given the evidence
available at the time (a self-comparison between two v2-only
prototypes); it simply didn't have the real InDesign reference yet.

## Final product decision

- `。」` — NORMAL spacing. No special pair rule.
- `、」` — NORMAL spacing. No special pair rule.
- `。次` / `、次` — unaffected (already normal, never touched by the
  retired rule in the first place).

## What was removed

- `core/compose/line.ts`: `conditionalYakumonoPairAdvanceTick` and its
  call-site lookahead in `computeAtoms` (round 14) — `computeAtoms` is
  back to its exact round-13 form (no `ruleSet` parameter, no
  character-class branching of any kind).
- `renderer/publication/verticalYakumonoAlign.ts`:
  `VerticalYakumonoAlignContext.usesFullEmAnchor` and its two backing
  regexes (round 16) — the class is back to its exact round-13 form.
- `renderer/publication/pdfGenerator.ts`: the `bodyEmMm`/
  `nextUnitFirstGrapheme` threading through `verticalGraphemeCommands`/
  `unitCommands`/`buildPaintPlan` (round 16) — reverted to the exact
  round-13 formula (`yMm` anchors against each atom's own per-character
  slot height, uniformly, for every yakumono-classified character).
- Tests: `core/compose/conditionalYakumonoPair.test.ts`,
  `renderer/publication/yakumonoFinalDefaultSelection.test.ts`,
  `renderer/publication/targetedYakumonoQa.test.ts` deleted (they tested
  the now-removed behavior). Two assertions in `yakumonoLegacyParityQa.test.ts`
  and one in `glyphSizeIndependence.test.ts` (round 14 edits) reverted to
  their original round-13 form (uniform-advance assertions).

## What was preserved (per explicit instruction)

Round 13's own legacy-parity edge alignment
(`classifyYakumonoAlignment`, `HANG_START_TEST`/`HANG_END_TEST`,
`VerticalYakumonoAlignContext.baselineRatioFor`) is **fully intact and
unmodified** — it applies generally to every yakumono-classified
character (opening/closing brackets, quotes, 。/、) independently of the
now-retired pair rule, and is the SAME real, ported legacy mechanism
this whole P3-O08 chain has validated since round 13. Round 10's GPOS
`vpal` infrastructure, round 7's outline paint, round 5's baseline-ratio
derivation: all unaffected, unchanged.

`renderer/publication/smallKanaCellDebug.test.ts` and
`smallKanaAdvanceHumanComparison.test.ts` (rounds 14/15) are retained
unchanged — neither ever touched the cl-06/cl-07 → cl-02 pair; both
remain accurate QA history for the small-kana question, which is
separately CLOSED (see below).

## Small kana — reconfirmed, unaffected by this round

1em canonical advance = Human PASS (round 16). The rejected 0.5em
prototype was never product default and remains unreachable through the
real default pipeline — proven directly (`yakumonoNormalSpacingFinal.test.ts`).
No change this round.

## New open item (recorded, NOT implemented)

**感嘆符/疑問符 before a closing bracket** (`！」`/`？」`/`！？」`/`？！」`):
the Human's own InDesign comparison suggests exclamation/question marks
before a closing bracket may be the real special case InDesign treats
differently — not period/comma. This is explicitly **not implemented**
in this round. Four non-final research-control fixtures
(`「本当！」`/`「本当？」`/`「本当！？」`/`「本当？！」`) are included in
`yakumono-normal-spacing-final-qa.pdf` for observation only, painted via
the exact same unconditional default as everything else — no new rule
applied. A future round must audit this separately against: (a) real
InDesign vertical output, (b) existing jlreq/JIS evidence, (c) current
TateSpun behavior — before any implementation is attempted.

## QA artifact

`qa/publication/p3-o08/yakumono-normal-spacing-final-qa.pdf` — fixtures
1-4 (`「今日は、雨だった。」`/`「今日は、雨だった、」`/`た。次`/`た、次`,
the final, closed product default) then 5-8 (the new open-item research
controls, unlabeled as "final").

Prior artifacts from the now-retired experiment
(`targeted-yakumono-qa.pdf`, `targeted-yakumono-cell-debug.pdf`,
`yakumono-final-human-qa.pdf`, `yakumono-half-paint-slot-human-comparison.pdf`)
are left on disk as historical record — nothing regenerates them any
more, since their generating tests are deleted.
`yakumono-legacy-parity-qa.pdf`/`publication-typography-qa.pdf`
regenerated automatically this round, now reflecting the restored
normal-spacing default.

## Tests

New: `renderer/publication/yakumonoNormalSpacingFinal.test.ts` (12 + 1
QA-generation = 13). Deleted: `core/compose/conditionalYakumonoPair.test.ts` (12),
`renderer/publication/yakumonoFinalDefaultSelection.test.ts` (12),
`renderer/publication/targetedYakumonoQa.test.ts` (5). Reverted (not
deleted): 2 tests in `yakumonoLegacyParityQa.test.ts`, 1 in
`glyphSizeIndependence.test.ts`.

**Full regression:** Core 364/364 (the EXACT pre-round-14 baseline —
confirms clean retirement, same proof pattern round 13 used for its own
retirement of rounds 8/11), Stage C 21/21, Stage D 30/30, P3-O09
(Preview) 114/114, P3-O08 (Publication) 204/204 — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, never modified. Core: reverted only — net
effect is Core returning to the EXACT round-13 state, not a new,
untested one. Preview: untouched. No new dependency. No push, no
deploy, no reset.

## Decision

Period/comma before closing bracket: **CLOSED — normal spacing, no
special rule.** Exclamation/question mark before closing bracket:
**OPEN — new item, not implemented, not assumed.**

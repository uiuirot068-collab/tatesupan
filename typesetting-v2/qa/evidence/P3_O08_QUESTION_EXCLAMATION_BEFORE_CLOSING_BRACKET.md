# P3-O08 — 感嘆符/疑問符 (！/？) Before a Closing Bracket (Human Visual QA HOLD round 18)

Audit + evidence only. **No product rule implemented.** Continues
directly from round 17 (`qa/evidence/P3_O08_YAKUMONO_NORMAL_SPACING_FINAL_ROUND17.md`,
commit `c814568`), which closed the period/comma question with "normal
spacing, no special rule." Human's own Adobe InDesign comparison then
raised a new, distinct question: does `！」`/`？」` need different
treatment from `。」`/`、」`?

## Human InDesign finding

`。」` retains visible normal spacing (confirmed, round 17). `！」`
appears visually more compact in the same InDesign reference. Human's
own hypothesis: question/exclamation spacing may need a different rule
from period/comma — explicitly NOT assumed as fact, flagged for audit.

## Current TateSpun behavior (captured directly, `questionExclamationClosingBracketAudit.test.ts`)

- Canonical advance for `！`/`？` before `」`: uniform 1 cell, exactly
  like any ordinary character — no special rule exists in Core.
- Publication paint anchor: `classifyYakumonoAlignment("！")` and `("？")`
  both return `NORMAL` — they are NOT members of round 13's ported
  `HANG_START_TEST`/`HANG_END_TEST` regexes, so they paint CENTERED, the
  same as any ordinary character. (Confirmed directly against the live
  regex, not from memory.)
- Combined marks (`！？`/`？！`): compose as **two separate ordinary TEXT
  atoms**, one cell each — proven directly (`placedUnits` length and
  per-character pitch). Core's `cl08PairRule`/inseparability mechanism
  is scoped to `SemanticRunKind` (DASH/ELLIPSIS runs only) and never
  applies to cl-04 characters — there is no "punctuation run" grouping
  for `！？` anywhere in this codebase. Each mark in a combined sequence
  is independently classifiable/breakable, exactly like any other
  ordinary character pair.

## Class mapping (existing infrastructure, not invented here)

`core/rules/defaultRuleSet.ts` already classifies:

- `！`/`？` (fullwidth) → **cl-04** ("dividing punctuation marks",
  members `"？！‼⁉"`) — matches jlreq's own cl-04 区切り約物 category
  (cached research, item 1: "cl-04 区切り約物 (dividing punctuation)").
  cl-04 currently carries only kinsoku semantics (`mayStartLine: false`)
  — no spacing rule of any kind is attached to it anywhere in this
  codebase.
- ASCII `!`/`?` (halfwidth) — **NOT** cl-04 members. They fall to the
  generic `DEFAULT_CLASS` (cl-00), same as any unclassified Latin
  character. Recorded, not changed.
- `」` (closing bracket, cl-02) — unaffected by anything in this round.

## Legacy mechanism check

Direct Grep of `src/components/PageCard.tsx` for `！`/`？`: **one match,
entirely unrelated** (a `window.confirm("...？...")` dialog string, not
typesetting code). Legacy has NO `！`/`？`-specific classification or
CSS anywhere — matches the SAME pattern round 14 already found for
small kana. `！`/`？` are also absent from both of legacy's own
`YAKUMONO_HANG_START_TEST`/`YAKUMONO_HANG_END_TEST` regexes (already
fully re-verified, not from memory, this round).

## Standards/font evidence

The cached research
(`research/typography-standards/jlreq-jis-opentype-standards-research.md`,
item 6, high confidence, directly-quoted primary source) documents
OpenType `vchw`/`vhal` — features that DO exist for exactly this kind of
"contextually re-space full-em punctuation glyphs to half-width, e.g. a
closing paren before a comma" — but:

1. The cited example is bracket+comma, not `！`/`？` specifically — no
   standards citation names dividing punctuation (`！`/`？`) as needing
   pair-compression before a closing bracket.
2. **The committed font (Shippori Mincho) does not implement `vchw` or
   `vhal` at all** — round 10's own GPOS audit (re-confirmed this round
   in `gposReader.test.ts`'s own output) found only `vpal` present.
   There is no REAL per-font data this project could read to derive a
   numeric rule from, unlike round 13's period/comma/bracket work,
   which had real `vpal` YPlacement data to ground its (ultimately
   retired) experiments in.

**Conclusion: no legacy mechanism, no real font feature data, no
standards citation naming `！`/`？` specifically. Evidence is AMBIGUOUS
for a new numeric rule.**

## Real ink-bbox measurement — a likely explanation, not a rule

Measured directly (`FontMetricsReader.glyphInkBBox`, same method as
round 14's small-kana audit), ink-height fraction of the em-square:

| Character | Ink height / em |
|---|---|
| `！` | **0.832** |
| `？` | **0.832** |
| `」` (closing bracket) | 0.336 |
| `。` | 0.261 |
| `、` | 0.224 |

`！`/`？` are drawn very TALL in this font — occupying ~83% of the
em-square vertically, more than three times `。`'s own ~26%. Under the
CURRENT, unconditional, centered treatment, a glyph that already nearly
fills its own cell naturally leaves very little visible gap on either
side — including toward a following closing bracket. This is the
**same class of finding** as round 14's small-kana audit (there,
small ink → apparent extra space; here, LARGE ink → apparent tightness)
— strong evidence that the InDesign tightness Human observed for `！」`
is very likely an **inherent property of how tall `！`/`？` glyphs are
drawn**, not evidence that InDesign (or any renderer) needs a dedicated
pair-compression rule for this specific adjacency.

## Decision

**No rule implemented.** Per this round's own explicit instruction
("If rule remains ambiguous... STOP implementation and produce Human
comparison evidence instead"), a QA-only Human A/B comparison was
generated instead of a speculative default:

- **A_CURRENT**: real, unmodified production default (centered,
  unconditional — exactly what commit `c814568` already produces).
- **B_EVIDENCE_DERIVED**: the ONE real, already-proven mechanism this
  codebase has for "flush punctuation ink against a cell edge" — round
  13's own `HANG_START` formula (`baselineRatio = yMax / unitsPerEm`),
  reused verbatim (never a new invented offset), applied experimentally
  to `！`/`？` only when immediately followed by a cl-02 closing
  bracket. Computed entirely inside the QA test file; no product file
  touched.

Both variants painted with QA-only cell-boundary overlays, for 8
fixtures: `「本当！」`, `「本当？」`, `「本当！？」`, `「本当？！」`,
`「今日は、雨だった。」` (control), `「今日は、雨だった、」` (control),
`！次` (control), `？次` (control).

## QA artifact

`qa/publication/p3-o08/question-exclamation-closing-bracket-comparison.pdf`
— one A page then one B page per fixture, 16 pages total.

## Tests

`renderer/publication/questionExclamationClosingBracketAudit.test.ts`
(15 tests): classification, current geometry, combined-mark
tokenization proof, real ink-bbox measurement, period/comma regression
controls (unchanged), glyph-size/source/SourceSpan/determinism
invariants, and the comparison-PDF generator.

**Full regression:** Core 364/364 (unchanged — zero Core files touched
this round), Stage C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114,
P3-O08 (Publication) 219/219 — all PASS. `npx tsc --noEmit`: 0 new
errors (only the known pre-existing `src/app/layout.tsx` baseline
error).

## Safety

`src/` (legacy): read-only, never modified. Core: untouched (zero
files). Publication product files (`pdfGenerator.ts`,
`verticalYakumonoAlign.ts`, `paintModel.ts`): untouched (zero files) —
this round is audit/QA-only, per its own explicit instruction. `。」`/
`、」`: unaffected, still normal per round 17's own closed decision
(re-verified directly, not assumed). No new dependency. No push, no
deploy, no reset.

## Human recheck required

Does `question-exclamation-closing-bracket-comparison.pdf` show
A_CURRENT already looking acceptable (matching this evidence's own
prediction), or does B_EVIDENCE_DERIVED look meaningfully better? If
Human judges A_CURRENT already sufficient, this item can close with
"no rule needed" (same outcome as round 14's small-kana question). If
Human judges B meaningfully better, that would be new, real product
evidence — not yet available at the time of this round.

# P3-O05 — Ellipsis Visual

## 1. Verdict

**HUMAN VISUAL QA PASS. CLOSED (2026-09-07).** Ellipsis (`……`, SEMANTIC_RUN
runKind `ELLIPSIS`) was audited independently of Dash (per the task's
explicit instruction not to assume Dash's paint strategy transfers) and
found to have **no analogous defect**. No Renderer paint code change was
made for ellipsis. The existing native rendering (identical to how any
ordinary unit paints — no special CSS class, no per-grapheme split) is the
deliberate, evidence-based outcome of this task, not an oversight. 26
regression tests (`renderer/preview/ellipsisVisual.test.ts`) prove this is
intentional and protect Dash's own P3-O04 treatment from any incidental
regression.

**Human Visual QA (2026-09-07):** reviewed the `……` run in the `dash-ellipsis`
fixture, NORMAL Preview (`qa/visual/p3-o09-preview/index.html`). Observed:
reads naturally as a vertical Japanese ellipsis; visually centered
acceptably; spacing acceptable; surrounding text unaffected; no line/page
escape; no debug decoration visible. **PASS.** No further ellipsis paint
change was made or requested.

## 2. Frozen Contract

`typesetting-v2/prototypes/phase2-japanese-capability-poc/evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md`
is the only prior frozen evidence covering ellipsis. Its own "Honest status"
section discloses that the specific pre-fix offset numbers it reports
(`~-0.15em` and `~-5.15em` for two ellipsis occurrences) were **captured
against an earlier, buggy build of that PoC page** (before a multi-column
absolute-positioning fix), were **never re-confirmed** after that fix, and
explicitly states "these numbers should not be treated as final" and "no
correction decision is made in this loop at all." That document is not
usable evidence of a real defect in *this* renderer (P3-O09), which has a
different structure entirely (React SSR, its own absolute-positioning
layout, never affected by the old PoC's column-overlap bug). This mirrors
how the old Phase 2 TCY finding also did not recur in the new renderer
structure ([[tsp029-preview-rhythm-glyph-shape]] territory, same category of
stale-PoC-evidence lesson).

## 3. Existing Semantic Run

`core/units/semanticRunUnit.ts`: `SemanticRunUnit { kind: "SEMANTIC_RUN";
span; runKind: "DASH"|"ELLIPSIS"|"TWO_DOT_LEADER"; length }`. For `……`,
`tools/compare/fixtureBuilder.ts` computes `length: Array.from(piece.text).length`
= **2** (two U+2026 HORIZONTAL ELLIPSIS code points — confirmed directly,
not assumed: a fresh test run's canonical-unit dump showed
`{"kind":"SEMANTIC_RUN","length":2,"span":{"start":1,"end":3}}` for a
`……` piece). This is **one Core atom**, never split at the Core layer —
confirmed structurally via `core/breaks/opportunity.ts`'s
`deriveBreakOpportunities`: the unit-kind dispatch (`TEXT`/`RUBY`/
`MANUAL_BREAK`/`PARAGRAPH_BREAK`) has no `SEMANTIC_RUN` branch at all, so
(exactly like TCY/IMAGE) it contributes **zero internal break
opportunities**, for every `runKind` including `ELLIPSIS` — proven, not
inferred from Dash's own already-known identical behavior.

`advanceTickFor` (`core/compose/line.ts`): `case "SEMANTIC_RUN": return
perCellAdvance * unit.length;` — canonical occupied extent = exactly 2
cells for `……`, regardless of Renderer paint strategy (Core carries no
pixel/x-y fields for this unit — "visual glyph centering/alignment is
Renderer-only," per the type's own doc comment).

## 4. Core/Renderer Ownership

Unchanged from the Contract, reconfirmed: Core owns identity, source
mapping, canonical occupancy (2 cells), and break identity (none, internal;
cl-08 keep-together with an adjacent same-kind ELLIPSIS run is a pre-existing,
untouched Core rule — `core/breaks/opportunity.test.ts` group H). Renderer
owns only paint appearance inside that already-fixed 2-cell box. This task
made **zero Core changes**.

## 5. Root Visual Problem

**None proven.** The audit's central finding: Dash's own P3-O04 defect was
architecture-specific to a **continuous stroke glyph** rendered as a shared
text node — a visible gap could appear at the seam between the run's two
"―" characters because nothing enforced overlap between two independent
glyph boxes that must *look like one unbroken line*. Ellipsis's visual unit,
"…", is **not** a continuous stroke: each "…" is already a complete,
self-contained three-dot cluster glyph in any ordinary vertical Japanese
font. Two "…" glyphs placed sequentially in a shared text node (exactly
`……`'s current rendering) do not need to visually *connect* the way a
dash's line does — some visible separation between the two dot-clusters is
the *expected*, correct appearance of a doubled ellipsis, not a defect.
No font-glyph-ink, orientation, centering, per-character-separation,
writing-mode, inherited-CSS, line-height, or transform defect was found
that is specific to ellipsis and absent from ordinary body text (which
already renders correctly under the same `.unit`/`.unit-ink` CSS).

Inline-axis (vertical, under `writing-mode:vertical-rl`) centering: the
run's painted box height (`heightPx`) equals its content's exactly-fitting
natural extent (2 characters × 1 line-height each, `line-height:1`), so
`text-align:center`'s inline-axis effect is invisible here — identical to
how it was invisible for Dash's own body glyphs (not its annotation) before
any P3-O04 correction, and identical to ordinary body text. No inline-axis
defect exists structurally, by the same reasoning already established during
the Ruby Anchor HOLD.

Cross-axis (block/horizontal) centering: no reliable, evidence-backed CSS
lever or correction value was found — same unresolved-in-principle category
as Dash's own original P2-L06 concern, which P3-O04 also left uncorrected at
the Core/CSS level (Dash's fix targeted the seam, not horizontal centering).
No correction is fabricated here for the same reason: there is no genuine
evidence of an off-center defect in *this* renderer to correct.

## 6. Paint Strategy

**Native glyph, unmodified.** No Renderer code change. `……` renders as a
single shared text node inside `.unit-ink`, exactly like any ordinary TEXT
unit — no `.dash-glyph`-equivalent split, no `ellipsis-glyph` CSS class, no
color/opacity/geometric-bar treatment. This was a deliberate choice after
independent audit, not the default/unaudited state the fixture was in
before this task (that prior state was *also* native rendering, but
undocumented and unverified — this task adds the verification and the
regression tests that make it a decided outcome).

## 7. Canonical Bounds

Unchanged and verified: the run's painted `heightPx` equals exactly 2
ordinary single-cell units' worth of extent when a successor atom exists on
the same line to derive an exact (non-approximate) delta from (test 3).
`SourceSpan` is preserved exactly (test 2). The run is never fabricated
into more or fewer cells regardless of scale (test 20) or fixture (tests
5–14).

One **pre-existing, disclosed, out-of-scope** Renderer limitation was
encountered and worked around in the tests, not fixed: when a multi-cell
atom (SEMANTIC_RUN, RUBY, or a multi-cell TCY) is the **last** placed unit
on a line with no successor, `paintModel.ts`'s `buildPaintLine` cannot
derive an exact delta and falls back to a documented DEV-ONLY estimate
(`heightIsApproximate: true`, commented `P3-O09-PAGE-CONTENT-CLIPPING-HOLD`).
This is not an ellipsis-specific defect — it affects any multi-cell atom in
that position — and is out of this task's scope to fix. Tests that need an
exact extent for ellipsis simply place a trailing TEXT unit after it so a
real successor delta exists.

## 8. Dot/Glyph Identity

No per-glyph paint split exists for ellipsis. `PaintPlacedUnit.dashGlyphs`
is populated **only** for `semanticRunKind === "DASH"`
(`paintModel.ts` line ~383); for ELLIPSIS it is `undefined` (test 4). The
rendered dot count is whatever the active font's own "…" glyph shows
(typically 3 dots × 2 characters = 6 dots), read directly from source —
never fabricated, counted, or re-derived by the Renderer. Source is never
mutated (`……` stays `……` — proven by SourceSpan/text equality across every
test).

## 9. Scale/Font Behavior

Test 20: painting the same fixture at 1× and 3× scale multiplies both
`topPx` and `heightPx` by exactly 3, while `text` and `sourceSpan` remain
identical — the same proportional-scaling guarantee already established for
TCY and Dash, with no ellipsis-specific magic number introduced (there is
no ellipsis-specific numeric constant at all).

## 10. Break/Paragraph Interactions

All 13 required fixture-interaction cases were exercised (tests 5–14):
start of line (indent-relative), end of line, adjacent to comma/period,
adjacent to opening/closing brackets, paragraph-first content, immediately
after a bare paragraph break, immediately after a manual page break, at a
column boundary, at a page boundary, and multiple independent ellipsis runs
in one document (each with its own distinct SourceSpan). All compose and
paint via the ordinary, unmodified generic unit path — no ellipsis-specific
branch exists anywhere in the composition or break-opportunity code, so
none of these interactions required or received any special-casing.

## 11. Dash Regression Protection

`dashVisual.test.ts` (20 tests) and `generateDashWeightComparison.test.ts`
(8 tests) were run **unmodified** and both remain 100% passing.
`DEFAULT_DASH_OVERLAP_EM` remains `0.16`. `.dash-glyph` CSS, the
`dashGlyphsFor` per-grapheme split algorithm, and Dash's native-stroke
paint path were not touched by this task (only comments adjacent to them
were updated, to remove now-stale "ELLIPSIS is still OPEN" language — no
functional dash code changed). `ellipsisVisual.test.ts` additionally adds
its own explicit Dash Regression Protection group (4 tests): the 0.16em
constant, 2-glyph seam-node shape, 3-glyph seam-node shape, and the
dash-ellipsis fixture painting both runs side by side with only DASH
carrying `dashGlyphs`.

## 12. Normal vs Debug Preview

NORMAL mode (test 18): the fixture's HTML contains the real `……` text with
no visible provisional decoration (`.provisional-badge { display: none; }`
confirmed present in the generated stylesheet) and no debug-only attribute
text (`runKind=ELLIPSIS` does not leak into NORMAL markup — it only appears
inside a `title` attribute, which is DEBUG-only content, and NORMAL mode's
own render call was checked directly for its absence).

DEBUG mode (test 19): the ellipsis unit's own `title` attribute contains
`runKind=ELLIPSIS`, `runBoxTop=...px`, `runBoxHeight=...px`, and
`paintStrategy=native-glyph` — scoped specifically to the ELLIPSIS unit's
own title text (distinct from the same document's DASH unit, which
legitimately reports the longer `native-glyph, N paint node(s), seam
overlap` string). No individual dot/glyph paint items are exposed, because
none exist for ellipsis.

## 13. Tests

`renderer/preview/ellipsisVisual.test.ts` — 26 tests, all passing:
1. Semantic identity preserved. 2. SourceSpan preserved. 3. Canonical
occupied extent = 2 cells (exact delta case). 4. Dot/glyph identity
deterministic, no fabricated split. 5–14. The 13 required fixture-
interaction cases (start/end of line, punctuation/bracket adjacency,
paragraph-first, after paragraph break, after manual break, column
boundary, page boundary, multiple runs). 15. Surrounding unit coordinates
on the same line unaffected. 16–17. CanonicalDocument deep-equal and
deterministic across independent compositions; never mutated by painting.
18. NORMAL preview shows real ellipsis, no provisional decoration. 19.
DEBUG preview exposes run kind/bounds/paint strategy. 20. Proportional
scaling. 21. No re-tokenization of ordinary periods into ELLIPSIS. 22.
Prolonged sound mark `ー` unaffected (plain TEXT, one unit per character,
as this renderer already places all TEXT content). Plus a 4-test "Dash
Regression Protection" group (§11).

Full regression: Core `npx vitest run` — 347/347 PASS. Stage C
(`tools/compare`) — 21/21 PASS. Stage D (`tools/preview-dev-adapter`) —
30/30 PASS. P3-O09 (`renderer/preview`) — 114/114 PASS (includes the new
26 + all pre-existing 88). `npx tsc --noEmit` — 0 new errors; only the
known pre-existing `src/app/layout.tsx(33,50): TS2304: Cannot find name
'LayoutProps'` baseline error remains, untouched.

## 14. Human Visual Artifact

The existing `typesetting-v2/qa/visual/p3-o09-preview/index.html` and
`debug.html` (regenerated automatically by
`generateFoundationArtifact.test.ts` as part of the full suite run above)
already contain the `dash-ellipsis` fixture with its native-rendered `……`
run, immediately visible alongside the now-closed Dash treatment. No
separate `p3-o05-ellipsis-comparison` artifact was generated: this task
did not produce multiple candidate strategies to compare (the audit
concluded, with justification, that a single strategy — unmodified native
rendering — is correct), so a dedicated comparison page would only
duplicate what the main artifact already shows. The fixture's own label
was updated to state both Dash and Ellipsis are now closed/audited, so a
Human reviewing the main artifact sees accurate status text.

## 15. Remaining Work

None for P3-O05 itself. Human Visual QA (§1) confirmed the native
rendering reads naturally, with no further correction requested. Ellipsis
paint was not modified further, per instruction.

## 16. Next Technical Task

Per the task's own explicit instruction, the next task should **not**
default to assuming P3-O06 must follow — it should first re-audit the
actual remaining P3-O09 blockers from the frozen roadmap/open-item list
(`typesetting-v2/docs/architecture/PHASE3_OPEN_ITEMS.md`) now that both
P3-O03 (TCY) and P3-O04 (Dash) and P3-O05 (Ellipsis) are closed, rather
than assuming any specific numbered item is next.

# P3-O08 — Yakumono Legacy Parity Audit (Human Visual QA HOLD round 12)

**AUDIT ONLY — no source implementation changed this round, per explicit instruction.**

## 1. Why This Audit Was Triggered

Round 10's real GPOS `vpal` ink-placement fix made no visual difference.
Round 11 replaced the entire canonical model (full-em+negative-adjustment
→ half-em body+explicit space) and was STILL reported wrong. Four
independent v2-side theories (glyph identity, font origin, GSUB
substitution, GPOS ink placement, and finally the canonical advance model
itself) had each been tried and found insufficient. Human/Product
redirected investigation away from further v2-side theorizing toward
empirical parity with the legacy renderer, which already produces
accepted Japanese vertical punctuation.

## 2. What the Legacy Renderer Actually Did — Direct Primary Source

`src/components/PageCard.tsx` lines 29–49 (a header comment attached to
`YAKUMONO_VPAL_TEST`/`YAKUMONO_HANG_START_TEST`/`YAKUMONO_HANG_END_TEST`,
itself dated **TSP-LOOP-003** — i.e. an EARLIER, foundational fix than
even the TSP-LOOP-029 hanging-punctuation work found while tracing this
history) states the problem and its real, measured resolution verbatim:

> "FixedSlot absolute-positions every glyph and (by default) flex-centres
> it in its canonical em cell — which is correct for 漢字/かな but
> *discards the font's designed in-cell position* for 約物, so
> 、。「」… ended up floating in the middle of their cell, ~0.5em away
> from the glyph they should hug. **A browser-native `writing-mode:
> vertical-rl` block of the same text (measured) instead places these
> glyphs against one edge of the em cell** — where they connect to the
> adjacent text... **So the fix is a per-typographic-class flex anchor
> (`justify-content`), not a per-glyph offset: the slot coordinates,
> height and advance are all unchanged, only where the glyph sits
> *inside* its unchanged cell.**"

This is, almost verbatim, the exact symptom this entire v2 task chain has
been chasing since round 4. **The legacy team already measured real
browser-native vertical text output and found the answer: the canonical
cell is never touched. Only paint-time ink position, within an unchanged
full cell, changes.**

### 2.1 Exact Mechanism

```js
// src/components/PageCard.tsx:45-49
const YAKUMONO_VPAL_TEST = /[、。，．「」『』（）〈〉《》【】〔〕［］｛｝｟｠“”‘’]/u;
// hang against the column start (visually the top of the cell)
const YAKUMONO_HANG_START_TEST = /[、。，．」』）〉》】〕］｝｠”’]/u;
// hang against the column end (visually the bottom of the cell)
const YAKUMONO_HANG_END_TEST = /[「『（〈《【〔［｛｟“‘]/u;
```

At paint time (`PageCard.tsx` ~2083-2112), each glyph is placed in an
**absolutely-positioned, fixed-size flex container** (`position:
absolute`, explicit `width`/`height` in px, both driven by the SAME
uniform `canonicalSlotExtentPx`/`gridColumnThicknessPx` used for every
other character — confirmed unconditional, no per-class branch on slot
SIZE anywhere):

```js
justifyContent: YAKUMONO_HANG_START_TEST.test(slot.text)
  ? "flex-start"
  : YAKUMONO_HANG_END_TEST.test(slot.text)
    ? "flex-end"
    : "center",
...(YAKUMONO_VPAL_TEST.test(slot.text)
  ? { fontFeatureSettings: '"vpal" 1, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0' }
  : null),
```

- **Closing-type** (、。，．」』）〉》】〕］｝｠”’ — commas, periods,
  closing brackets/quotes): `justify-content: flex-start` — hugs the
  column-START edge (visually the TOP of the cell in `vertical-rl`),
  "hangs right after the preceding glyph."
- **Opening-type** (「『（〈《【〔［｛｟“‘ — opening brackets/quotes):
  `justify-content: flex-end` — hugs the column-END edge (visually the
  BOTTOM), "hangs right before the following glyph."
- **Everything else** (ordinary kanji/kana, and this includes cl-04/05
  and any punctuation NOT in the test regexes): `center`, unchanged.

The DEFAULT body font-feature-settings, confirmed at
`PageCard.tsx:404-405` and `:483-484`, EXPLICITLY DISABLE `vpal`/`vhal`/
`palt`/`vkrn`/`pkna` (`"vpal" 0, ...`) for ordinary text — a deliberate,
documented choice ("FixedSlot body uses stable full-width metrics")
matching TateSpun's OWN Natural-Pitch philosophy exactly. `vpal` is
**selectively re-enabled** (`"vpal" 1`) ONLY for the same
`YAKUMONO_VPAL_TEST`-matched characters — letting the browser apply the
font's own real proportional glyph SHAPE for just these glyphs, while
the outer absolutely-positioned flex container's own fixed px
width/height (computed identically for every character) makes this
purely a glyph-shape/inner-alignment effect — it structurally CANNOT
change the canonical slot size, because the container's size was never a
function of the glyph's own metrics in the first place.

## 3. Legacy Geometry (Recovered From Source, Not a Live Browser Measurement)

Deterministic inspection of the layout math confirms, without needing a
live browser: for fixture `た。」`, all three characters occupy IDENTICAL
canonical slot extents (`canonicalSlotExtentPx`, uniform, unconditional —
no character-class branch exists anywhere in the slot-SIZE computation,
only in the ink-alignment computation). Symbolically:

| Char | Slot start (canonical) | Slot extent | Ink anchor within cell |
|---|---|---|---|
| た | N × slot | 1.0 slot | center |
| 。 | (N+1) × slot | 1.0 slot | flex-start (top edge) |
| 」 | (N+2) × slot | 1.0 slot | flex-start (top edge) |

**`start(。) − start(た) = 1.0 slot`. `start(」) − start(。) = 1.0 slot`.**
Every character-to-character canonical distance is the SAME uniform 1em
slot, always — this is a direct, load-bearing consequence of the source
code's own structure (the slot index ladder is `slotIndex × canonical
SlotExtentPx`, unconditionally), not an inference.

A live-browser pixel measurement was not performed this round (this
audit is source-code-deterministic; §10 below addresses whether one is
still needed).

## 4. Current v2 Geometry (commit `ad30d0a`, round 11's own half-body model)

For the same fixture `た。」` (already proven directly in round 11's own
`yakumonoHalfBody.test.ts`):

| Char | yTick (canonical, ticks) | Own advanceTick |
|---|---|---|
| た | 0 | 1.0 cell (CELL) |
| 。 | CELL | 0.5 cell (HALF_CELL — INTRINSIC half body) |
| 」 | CELL + HALF_CELL | (own trailing space, context-dependent) |

**`start(。) − start(た) = 1.0 cell`. `start(」) − start(。) = 0.5 cell`.**

## 5. Exact Delta — Parity Mismatch Confirmed

| Quantity | Legacy | v2 (round 11) | Match? |
|---|---|---|---|
| `。`'s own canonical advance | 1.0 em (unchanged) | 0.5 em (intrinsic half-body) | **NO** |
| `」`'s own canonical advance | 1.0 em (unchanged) | 0.5–1.0 em (context-dependent) | **NO** |
| Mechanism | paint-time ink alignment only | canonical advance model change | **Different layer entirely** |
| Font vpal usage | selectively ON for real glyph shape | not used for canonical advance (round 10 used it for a small ink YPlacement nudge only, orthogonal) | Partial overlap (ink-placement idea), different scope |

**Half-body model matches old behavior: NO.** Round 11's model changes
the CANONICAL layer (Core `advanceTick`); legacy never touches the
canonical layer for punctuation at all — it only changes where, within
an untouched full cell, the glyph paints.

## 6. Commit Regression Trace (Read From Diffs, Not Assumed)

| Commit | What changed (confirmed via `git show --stat`) |
|---|---|
| `8ba41b5` | OpenType vertical GSUB outline paint (opentype.js). Publication-paint-only. Canonical `。→」` coordinates: **unaffected**. |
| `4d4f6a2` | **FIRST commit to change canonical `。→」` coordinates** — `core/compose/line.ts` gains `applyYakumonoCompression`/`yakumonoSpacingScope` (full-em body + negative pair-adjustment model). |
| `8a9cf90` | Publication-only (`paintModel.ts`, `pdfGenerator.ts`) — fixes glyph SIZE regression from `4d4f6a2`. Canonical coordinates: unaffected (same as `4d4f6a2` left them). |
| `1469a83` | Publication-only (`gposReader.ts`, `verticalGposPaint.ts`, new files; `pdfGenerator.ts`). Real `vpal` YPlacement ink nudge. Canonical coordinates: **unaffected**. |
| `ad30d0a` | **Canonical model replaced** — `core/compose/line.ts`, `core/rules/characterClass.ts`, `core/rules/defaultRuleSet.ts` — `yakumonoSpacingScope` → `yakumonoHalfBodyScope`, half-em intrinsic body + explicit side space. Canonical `。→」` coordinates change AGAIN (now 0.5 cell instead of the pre-`4d4f6a2` 1.0 cell, and different from `4d4f6a2`'s own 0.5-of-original-full-cell result too, due to the differing mechanism). |

**Confirmed directly from `git show --stat` for every commit — not
assumed from commit messages.** `4d4f6a2` is the sole origin of ALL
canonical-layer punctuation changes; `ad30d0a` is the only OTHER commit
that touches the canonical layer for this feature. Every other commit in
the chain (`8ba41b5`, `8a9cf90`, `1469a83`) is Publication-paint-only and
never touched `core/`.

## 7. Which Layer Owns the Discrepancy

**Combination of B and — critically — a MISDIAGNOSIS at the Core layer
that should never have happened: A.**

- **A (Core canonical geometry): YES, and this is the actual root
  problem.** Rounds 8 and 11 both modified Core's own canonical advance
  for punctuation. Legacy's own real, measured, working implementation
  proves this was never necessary — the canonical layer should have
  remained completely untouched (uniform Natural Pitch for every
  character, exactly как v2's OWN pre-round-8 default already was).
- **B (Canonical → Publication paint-model conversion) / C (font glyph
  anchoring/paint): this is where the REAL fix belongs.** Legacy's own
  answer is a pure paint-time, per-typographic-class ink-alignment rule
  within an unchanged cell — architecturally, this is exactly what
  Publication's own `PaintCommand`/`unitCommands` layer already handles
  for other paint-only concerns (round 5's baseline ratio, round 7's
  outline paint, round 10's GPOS YPlacement nudge) — NOT a Core concern.
- **D (browser shaping dependency): a real, secondary factor, not the
  primary one.** Legacy's selective `"vpal" 1` re-enable does let the
  browser's own OpenType engine apply the font's real proportional
  glyph SHAPE for yakumono characters specifically — v2's Publication
  pipeline (jsPDF, no live shaping engine) cannot get this "for free."
  However, per legacy's own header comment, the PRIMARY, load-bearing
  fix is the flex-alignment (edge-hugging) rule — `vpal`'s role is
  described as secondary ("still keeps the glyph shapes on the font's
  punctuation metrics"), not the mechanism that solved the reported
  floating-in-the-middle symptom.

## 8. Does the Half-Body Model Match Legacy?

**NO — confirmed, not defended.** Per this round's own explicit
instruction, this is stated plainly without defending round 11 on
"standards-derived" grounds: jlreq's half-body convention may be
theoretically well-cited, but it is **not what the product's own prior,
accepted implementation actually did**, and product parity with the
already-working legacy renderer is the higher-priority target right now.
Marked: **PRODUCT PARITY MISMATCH.**

## 9. Safest Correction / Rollback Boundary (Candidate Only — Not Performed)

**Candidate: revert Core's yakumono-specific pieces to pre-`4d4f6a2`
behavior (uniform Natural Pitch, zero special-casing for punctuation),
while preserving every later, unrelated infrastructure commit.**

Concretely, proven safe by the commit trace in §6 (nothing else in the
chain depends on Core's own punctuation-advance behavior):
- Revert/remove `core/compose/line.ts`'s `characterClassForAtom`/
  `bodyAdvanceTickFor`/`yakumonoSpaceAfterEm` (round 11) — restore
  `advanceTickFor`'s plain, unconditional `perCellAdvance` for every
  TEXT atom.
- Revert/remove `RuleSetVersion.yakumonoHalfBodyScope` (`characterClass.ts`,
  `defaultRuleSet.ts`).
- **Preserves Ruby PASS: YES** (Ruby's own placement/scale code, rounds
  predating this whole chain, untouched by any of `4d4f6a2`/`8a9cf90`/
  `1469a83`/`ad30d0a`).
- **Preserves Small Kana PASS: YES** (round 7's GSUB outline paint,
  `8ba41b5`, is entirely independent — confirmed via `git show --stat`,
  zero overlap with `core/compose/line.ts`).
- **Preserves Dash PASS: YES** (same file, same independence).
- **Preserves the opentype.js outline path / round 9 glyph-size fix /
  round 10 GPOS ink-placement infrastructure: YES** — all three are
  Publication-paint-only and never depended on Core's own punctuation
  advance value; `gposReader.ts`/`verticalGposPaint.ts`/`VerticalOutlineContext`
  remain fully reusable for implementing the REAL fix (§10).

This candidate is NOT performed this round, per explicit instruction —
recorded for the next task.

## 10. Human Browser Measurement Gate

**Not required to PROCEED with implementation**, but recommended as a
FINAL confirmation step before declaring PASS. The legacy mechanism is
fully recoverable and unambiguous from source code alone (§2-§3) — no
live browser trace was needed to determine WHAT to build. A live-browser
screenshot/computed-style comparison (`writing-mode: vertical-rl` +
`text-orientation: upright`, the exact CSS this project already uses) of
the SAME fixture, AFTER the Publication-side fix is implemented, would
be the appropriate closing verification — comparing v2's own new PDF
output against a fresh legacy screenshot side by side. Not a blocker for
starting the implementation itself.

## 11. Exact Next Implementation Task

1. **Core:** revert the yakumono-specific canonical-advance mechanism
   (§9) — restore uniform, unconditional Natural Pitch for every
   character including punctuation. Delete `yakumonoHalfBodyScope`/
   `yakumonoSpaceAfterEm`/`bodyAdvanceTickFor`/`characterClassForAtom`
   from `core/compose/line.ts`; revert `RuleSetVersion`.
2. **Publication paint-only, new mechanism, ported directly from the
   legacy source (§2), not re-derived from theory:**
   - Classify each grapheme using the SAME two Unicode sets legacy uses
     (`YAKUMONO_HANG_START_TEST`/`YAKUMONO_HANG_END_TEST` — these ARE
     effectively jlreq's cl-02/06/07 "closing" and cl-01 "opening"
     classes, expressed as literal Unicode sets rather than the
     project's own `CharacterClassId` abstraction; using the EXISTING
     `characterClassFor`/`mayStartLine`/`mayEndLine` data is very likely
     equivalent and preferred for consistency with round 11's own
     already-proven-correct class-based approach — confirm the two
     produce IDENTICAL classifications for the four in-scope classes
     before relying on this equivalence).
   - Within the UNCHANGED, full-size canonical cell (no `heightMm`/
     `advanceTick` change of any kind), shift the glyph's own paint
     anchor to one edge instead of centering — closing-type toward the
     cell's own START (matching legacy's "top of cell" in vertical-rl),
     opening-type toward the cell's own END.
   - This is a NEW paint-time offset, but — unlike rounds 4/5's
     Human-rejected arbitrary A/B/C candidates — it is now DIRECTLY
     PORTED from a real, already-accepted, already-measured
     implementation, not invented or tuned by eye.
   - Round 10's real GPOS `vpal` YPlacement nudge and round 7's outline
     paint remain valid and compatible — this new edge-alignment offset
     composes with them (analogous to how legacy's own flex-alignment
     and selective `vpal` re-enable compose together).
3. Regenerate QA artifacts against the SAME fixture set already
   established (`yakumono-half-body-qa.pdf`'s own A-G set remains a
   reasonable diagnostic corpus, `た。」` etc.) — this time verifying
   canonical coordinates are BYTE-IDENTICAL to a fixture with zero
   yakumono content at the same character count (proving zero Core
   impact), while the PAINTED ink position visibly shifts.
4. Full regression (Core should show ZERO test changes beyond the
   revert itself — no new pitch-changing behavior to re-verify against
   kinsoku/other fixtures, since the canonical layer is being restored
   to its pre-`4d4f6a2` state, not modified further).

## 12. Safety

No source implementation changed this round. `src/` was read-only
audited, never modified. No reset, no push, no deploy performed. The
unrelated background git-maintenance permission error (a different
repo path) was not investigated, per explicit instruction.

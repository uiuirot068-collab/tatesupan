# P3-O08 — OpenType Vertical GPOS Audit (Human Visual QA HOLD round 10)

## 1. Human FAIL (Round 9 recheck)

The round-9 glyph-size fix was correct (glyphs now paint at normal body
size). But: 「文末に食い込んでる ダメ」 — the closing `」` now visibly
intrudes into the preceding sentence-end area. Round 8's advance-only
compression, without any accompanying ink-placement correction, was
therefore INCOMPLETE — recorded honestly, not silently re-tuned as
another arbitrary offset.

## 2. Why Advance-Only Compression Failed

Round 8 correctly shrank the CANONICAL ADVANCE between adjacent yakumono
characters (closing the logical layout gap). But every glyph's own ink
continued to be centered within its cell using the exact same
`BASELINE_RATIO`/centering math as any ordinary character — no
per-glyph ink REPOSITIONING was ever applied. For a glyph whose own ink
was drawn assuming a full-width cell (as this project's own round-4/5
work already measured — e.g. 「's real ink bbox spans much of its own
1em box), simply shrinking the ADVANCE to the next character without
also repositioning THIS glyph's own ink leaves the ink sitting where a
full cell would place it — which, once the following cell is now closer,
reads as intrusion/overlap.

## 3. GPOS Table

Real audit (`gposReader.test.ts`), against the exact committed Shippori
Mincho asset:

```
hasGpos: true
featureTagsPresent: ["abvm", "mark", "mkmk", "palt", "vpal"]
```

| Feature | Present? | Lookup types | Adjustments |
|---|---|---|---|
| `vhal` (Alternate Vertical Half Metrics) | **NO** | — | — |
| `vchw` (Vertical Contextual Half-width) | **NO** | — | — |
| `valt` (Alternate Vertical Metrics) | **NO** | — | — |
| `vpal` (Proportional Alternate Vertical Metrics) | **YES** | `[1]` (Single Adjustment) | 446 |
| `vkrn` (Vertical Kerning) | NO | — | — |
| `halt` / `chws` / `kern` | NO | — | — |
| `palt` (horizontal Proportional Alternate Widths) | YES | `[1]` | 869 |

**This font ships exactly one relevant vertical positioning feature:
`vpal`.** `vhal`/`vchw` — the features this round's own hypothesis named
first — are confirmed absent, not merely unresolved.

## 4. `。` and `」` — the Reported Pair

Real `vpal` Single Adjustment values (font units, `unitsPerEm=1000`),
resolved against the POST-GSUB `vert`-substituted glyph ID (15943 for
`。`, 15845 for `」` — confirmed via cross-check against the already-frozen
round-6 GSUB audit, same glyph IDs recorded there):

| Char | Vert glyph | YPlacement | YAdvance | Effective advance |
|---|---|---|---|---|
| `。` | 15943 | −11 (negligible) | −599 | 401/1000 em (≈0.40em) |
| `」` | 15845 | −3 (negligible) | −524 | 476/1000 em (≈0.48em) |

**Both closing-type marks have near-zero YPlacement** — their own ink is
already drawn close to where it needs to sit; the font's real intended
fix for THEM is almost entirely an ADVANCE reduction (already, coincidentally,
close to round 8's own flat 0.5em assumption: 0.40–0.48em vs. 0.5em).
**This is NOT where the reported intrusion comes from.**

## 5. `「` and `（` — the Real Root Cause

| Char | Vert glyph | YPlacement | YAdvance | Effective advance |
|---|---|---|---|---|
| `「` | 15844 | **+527** | −524 | 476/1000 em |
| `（` | 15876 | **+623** | −614 | 386/1000 em |

**Opening-type marks have a LARGE, non-trivial YPlacement** (+0.527em
and +0.623em respectively) — over HALF an em. This is the font's own
real, measured statement that an opening bracket's ink must be shifted
significantly to sit correctly once painted at a proportional (reduced)
width — and this shift was NEVER applied anywhere in this project before
this round. `「` is literally the first character of the reported
fixture (`「今日は、雨だった。」`) — its own un-repositioned ink,
combined with the now-correctly-compressed advance from round 8,
produces exactly the kind of visual mismatch the Human report describes
(content reading as too tightly packed/overlapping near punctuation).

## 6. Context (`。」`) — No Separate Contextual Rule

No `vchw`-style contextual feature exists in this font at all (§3) — so
there is no separate "when 。 is immediately followed by 」, apply X"
rule to discover. Each glyph's own `vpal` adjustment is unconditional
— applied whenever that GLYPH occurs, standalone or adjacent, matching
the font's own real per-glyph proportional-metrics design (not a
pairwise contextual rule).

## 7. Root Cause Classification

**C — Both**, precisely:
- **A (concept correct, missing GPOS placement facts): TRUE** — round
  8's WHEN (jlreq pair-adjacency triggering compression) remains a real,
  correctly-cited, still-valid rule; round 9's font-size fix was
  correct. What was missing is the HOW (ink placement), never sourced
  from real font data.
- **B (advance representation itself wrong): PARTIALLY TRUE** — round
  8's flat 0.5em is a reasonable, citable, font-agnostic LOGICAL
  approximation (jlreq's own convention, not tied to any specific font),
  and is close to (not identical to) this specific font's own real
  per-glyph values (0.40–0.48em for the two closing marks actually in
  the reported fixture). Per this round's own explicit instruction
  ("JLREQ pair rule... Font metrics determine HOW... do not collapse
  these into one constant"), round 8's advance value is KEPT as the
  logical, font-agnostic WHEN — not replaced with a per-font,
  per-glyph-varying canonical advance, which would require wiring real
  font metrics into Core's own composition layer and would conflict
  with the FROZEN Natural Pitch invariant (Core Contract §18: character
  advance is declared-size-based, never a per-glyph font metric — a
  constraint proven and re-confirmed multiple times earlier in this
  same task chain).

## 8. Fix — Publication-Only Ink Placement, Real Font Data

**Architecture (explicit split, matching this round's own instruction):**

```
Core (core/compose/line.ts, round 8, UNCHANGED)
  owns: WHEN a compressed pair triggers (jlreq pair rule, font-agnostic)

renderer/publication/verticalGposPaint.ts (NEW, this round)
  owns: HOW much a glyph's own ink shifts (real `vpal` YPlacement,
  font-specific, Publication-paint-only)
```

`gposReader.ts` (new, mirrors `gsubReader.ts`'s own architecture,
per this round's own "do not replace the working GSUB implementation
unnecessarily" instruction — a SEPARATE, sibling reader, not a rewrite):
minimal GPOS ScriptList/FeatureList/LookupList traversal, full
LookupType 1 (Single Adjustment) resolution for both subtable formats
(uniform-value Format 1, per-glyph-value Format 2), one-level Extension
(LookupType 9) unwrap. Other lookup types recorded, never resolved —
this audit does not implement Pair Adjustment, Cursive, Mark Attachment,
or Contextual GPOS positioning.

`verticalGposPaint.ts`'s `VerticalGposContext` (GSUB + GPOS + `head`
parsed exactly once per document render, per-glyph result memoized):
`yPlacementEmFor(grapheme)` resolves the grapheme's post-GSUB `vert`
glyph ID (reusing the SAME already-frozen `gsubReader.ts` substitution
map round 6/7 already built — not re-derived), looks up its real `vpal`
YPlacement, converts to an em fraction, and NEGATES it once (GPOS
YPlacement is a font-space Y-UP offset, same convention as `glyf`
outline coordinates; our page coordinate system is Y-DOWN — the same
sign flip opentype.js's own `getPath` already applies for outline paint,
kept consistent here).

`pdfGenerator.ts`'s `verticalGraphemeCommands` now applies this offset,
scaled by the atom's own REAL em size (`fontSizePt`, the fixed
`bodyEmMm`-derived value since round 9 — never the atom's own possibly-
compressed `heightMm`, per this round's own explicit "font metrics
determine HOW, never reuse the canonical advance for it" principle), to
BOTH the "text" and "glyphOutline" paint mechanisms uniformly. Applied
unconditionally to every grapheme (not gated on whether this specific
occurrence sits inside a round-8-compressed pair) — since the real
`vpal` values are already near-zero for characters that don't need
repositioning (closing marks, ordinary kanji), applying it everywhere is
harmless and matches the font's own real, context-independent per-glyph
design.

**No YAdvance was used.** Only YPlacement (paint-time ink position) —
YAdvance would mean re-deriving canonical advance from real font data,
which would violate the frozen Natural Pitch invariant (§7). Canonical
`yTick`/`xTick`/`heightMm`/`topMm` are completely untouched by this fix —
proven directly (`verticalGposIntegration.test.ts`'s own "canonical
PublicationDocument coordinates are byte-identical with or without a
gposContext" test).

## 9. Verified, Not Merely Asserted

`gposReader.test.ts` (6 tests): GPOS presence/parse/determinism/
malformed-input, full feature-tag + Single-Adjustment resolution for the
required character set (using post-GSUB glyph IDs, cross-checked against
the pre-existing GSUB audit), determinism.
`verticalGposIntegration.test.ts` (5 tests): real `yPlacementEmFor`
values confirmed (near-zero for `。`/`」`, large for `「`); painting with
a real `gposContext` measurably shifts `「`'s own `yMm` relative to
painting without one, while `。`/`」` barely move; canonical coordinates
unaffected; source unmutated; real PDF generation succeeds.
`yakumonoSpacingQa.test.ts` updated to thread the real `gposContext`
into the regenerated `yakumono-spacing-qa.pdf`; the combined
`publication-typography-qa.pdf` regeneration (`typography.test.ts`)
updated the same way.

**Full regression:** Core 380/380 (unchanged — zero Core files touched
this round, matching §7's own architectural decision), Stage C 21/21,
Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 163/163 —
all PASS. `npx tsc --noEmit`: 0 new errors.

## 10. Parity

Core canonical: unchanged, still correct (round 8's own logical rule,
untouched). Preview: unaffected (zero Preview files touched — this fix
is entirely Publication-paint-only, matching the font-specific,
paint-time-only nature of GPOS data — Preview has never claimed
font-metric-accurate ink placement and this round does not change that
boundary). Publication: uses the real, font-derived ink placement now.

## 11. Remaining

Human recheck of the regenerated `yakumono-spacing-qa.pdf` /
`publication-typography-qa.pdf` — does `「今日は、雨だった。」` now read
as ordinary Japanese vertical typesetting, with no `」` intrusion and no
excessive gap? If `「`'s own real vpal-derived shift direction/magnitude
still looks wrong once actually rendered, that would indicate either a
sign-convention error in this round's own Y-flip (§8, disclosed
explicitly, not silently assumed correct) or a genuine limit of the
"YPlacement alone, no shaping engine" model — to be determined by actual
visual review, not asserted here as certain.

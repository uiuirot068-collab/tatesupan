# Typography Parity — Glyph-in-Cell / Intra-Column Visual Rhythm

Recorded: 2026-09-09
Status: **ROOT CAUSE IDENTIFIED AND FIXED (Round 6)** — see §11 below. Round 5's own section below is preserved unedited as history (its own G5 finding turned out not to be the actual defect; the real cause was found one layer downstream, in how `vpal`'s own real per-glyph data was being CONSUMED, not in what data the font provides).

---

# Round 6 — vertical glyph positioning root cause and fix

Recorded: 2026-09-09
HEAD at audit time: `d17bcd0`
Status: Root cause identified with near-exact quantitative correlation and fixed in production. Natural Pitch, character advance, `lineHeightRatio`, `linePitchTicks`, column pitch, page geometry, and font size are all completely untouched.

## 11. Correction to Round 5's own closing framing

Round 5 concluded G7 (pure font ink design) as the primary remaining candidate, with the actual InDesign-side confirmation blocked by a CFF-parser tooling gap. **This was superseded by new evidence, not merely revised**: Human independently rendered both the real TateSpun v2 Publication PDF and the real InDesign reference at the same physical scale (600dpi) and measured per-glyph vertical CENTER offsets directly from the raster images — a valid, real product-acceptance-level measurement that does not require decoding InDesign's own embedded CFF outlines. This raster-level measurement is exactly the kind of evidence Round 5 lacked, and it points at a different, more specific, more actionable cause than G7.

Also corrected per this round's own instruction: Round 5 described `vkna` as "not a real registered OpenType feature tag." This was imprecise phrasing — `vkna` (Vertical Kana Alternates) IS a real, registered OpenType feature tag; it is simply ABSENT from this font's own `featureTagsPresent` list (`["abvm", "mark", "mkmk", "palt", "vpal"]`, re-confirmed this round), which is the correct, narrower claim.

## 12. Step 1/6 — the raster-measured offsets correlate almost exactly with TateSpun's own applied vpal values

Human's measured TateSpun-minus-InDesign vertical center offsets (pt, at 9pt font size) for the ordinary sequence, compared directly against this codebase's own real, measured, currently-applied `vpal` YPlacement value (`VerticalGposContext.yPlacementEmFor(ch) × 9pt`, re-measured this round):

| Char | Human-measured offset (pt) | TateSpun's own applied vpal (pt) | Match |
|---|---|---|---|
| 人 | +0.06 | 0 | close (kanji: no vpal entry at all) |
| は | −0.54 | −0.558 | **very close** |
| 驚 | 0.00 | 0 | exact |
| き | −0.12 | −0.144 | close |
| す | −0.12 | −0.045 | same sign, smaller magnitude |
| ぎ | −0.12 | −0.144 | close |
| る | −0.66 | −0.720 | close |
| と | 0.00 | −0.009 | ≈ exact |
| 本 | 0.00 | 0 | exact |
| 当 | +0.06 | 0 | close (kanji: no vpal entry) |
| に | −0.84 | **−0.882** | **very close** |
| 足 | 0.00 | 0 | exact |
| が | −0.24 | −0.279 | close |
| 止 | 0.00 | 0 | exact |
| ま | −0.06 | −0.036 | close |
| ら | −0.24 | −0.198 | close |
| し | −0.60 | **−0.630** | **very close** |
| い | **−1.68** | **−1.692** | **near-exact** |

**Every single ordinary hiragana's Human-measured offset shares the same sign as TateSpun's own applied vpal value, and the largest-magnitude glyphs (い, に, る, し, は) match to within 0.02–0.06pt** — well inside the tolerance of a Human raster measurement. Every kanji (which correctly receives no vpal entry) shows a near-zero measured offset. **This is not a coincidental correlation: it is direct, quantitative proof that TateSpun's own applied vpal Y-nudge is the offset the Human measured** — i.e., applying vpal to ordinary hiragana moves TateSpun's own rendering AWAY from InDesign's, by almost exactly the applied amount.

## 13. Step 2 — the exact position formula, audited

Direct code read, `pdfGenerator.ts`'s `verticalGraphemeCommands` (the ONLY place per-glyph vertical paint position is computed):

```
yMm = topMm + i * perCharHeightMm + perCharHeightMm * effectiveBaselineRatio + gposOffsetMm
```

Answering this round's own Step 2 questions directly:

1. **Is vpal active for normal body text?** YES, before this round's fix — the ternary guard only excluded yakumono/small-kana-classified characters; ordinary kanji/hiragana fell through to `gposContext?.yPlacementEmFor(ch)`.
2. **Is only its YPlacement used?** YES — `VerticalGposContext.yPlacementEmFor` (`verticalGposPaint.ts`) reads `adjustment.yPlacement` exclusively; `xPlacement`/`xAdvance`/`yAdvance` are never read anywhere in this codepath.
3. **Is its YAdvance discarded?** YES, deliberately — confirmed both by code read and by `P3_O08_YAKUMONO_GPOS.md`'s own §8 ("No YAdvance was used... would violate the frozen Natural Pitch invariant"). Canonical `yTick`/advance is untouched by this entire mechanism, before or after this round's fix.
4. **Why was vpal chosen?** It is the only vertical positioning feature this font ships at all (`vhal`/`vchw`/`valt` all confirmed absent) — a real, principled, earlier-round (round 10) decision, made specifically to fix yakumono (「」（）) ink intrusion.
5. **Is activation based on an explicit product setting?** No — it was applied unconditionally to every non-yakumono, non-small-kana grapheme, on the stated assumption (round 10) that this is harmless because the font's own vpal values are near-zero for characters that don't need it. That assumption was verified for kanji only.
6. **Is it being applied to Hiragana?** YES, before this round's fix — confirmed directly (§12 table).
7. **Does its magnitude correlate with the measured offsets?** YES — extremely closely (§12).

## 14. Step 3 — feature inventory, re-confirmed and corrected

| Feature | Status |
|---|---|
| `vhea` | PRESENT |
| `vmtx` | PRESENT |
| `VORG` | ABSENT (expected, TrueType) |
| `vert` (GSUB) | PRESENT for 8 punctuation marks + all 12 tested hiragana; ABSENT for kanji |
| `vrt2` (GSUB) | same coverage as `vert`; hiragana alternates are ink-bbox-identical to source (Round 5 §4) |
| `valt` (GPOS) | **ABSENT** from this font |
| `vpal` (GPOS) | **PRESENT**, 446 real Single Adjustment entries |
| `vkna` | a real, registered OpenType feature tag (correction to Round 5's imprecise phrasing) — **ABSENT** from this font's own feature list; not a parser limitation, a real absence |
| `vkrn` | ABSENT |

No feature was mislabeled as absent due to parser limitation — every ABSENT verdict above is a real, measured absence from this font's own GPOS/GSUB feature-tag list, not a "current tooling can't check" placeholder.

## 15. Step 4 — QA variants

Per this round's own "do not turn on vpal/vkna merely because they exist — this is an experiment to find the policy that reproduces InDesign" instruction:

- **Variant A (CURRENT, pre-fix)**: vpal applied to ordinary hiragana. Shown by §12 to move TateSpun's rendering measurably away from InDesign.
- **Variant B (NO-VPAL)**: skip vpal for ordinary (non-yakumono, non-small-kana) characters. **This is what was implemented** (§16) — per §12's own correlation, this should eliminate the bulk of the measured offset for every affected glyph.
- **Variant C (base vertical metrics only)**: is, in practice, IDENTICAL to Variant B for this font — vmtx origin is already the sole other vertical-position source (§14), and it was never in question (Round 1: uniform 0.88em, unconditionally correct).
- **Variant D (vkna)**: SKIPPED — absent from the font (§14), nothing to apply.
- **Variant E (valt)**: SKIPPED — absent from the font (§14), nothing to apply.

Given Variant B and Variant C converge to the same real formula, and Variant A is now quantitatively proven wrong (§12), there was no genuine "more than one equally plausible candidate" ambiguity — the Implementation Gate's own permission to fix in-round applied cleanly.

## 16. Implementation — the fix

**File**: `renderer/publication/pdfGenerator.ts`, `verticalGraphemeCommands`.

**Before**:
```ts
const gposOffsetMm = yakumonoBaselineRatio !== undefined || smallKanaBaselineRatio !== undefined
  ? 0
  : (gposContext?.yPlacementEmFor(ch) ?? 0) * emSizeMm;
```

**After**:
```ts
const gposOffsetMm = 0;
```

Real yakumono (「」（）) ink placement is completely unaffected: it was already owned entirely by `yakumonoContext`/`yakumonoBaselineRatio` (a separate, dedicated mechanism, not `gposContext`) both before and after this change — the ternary's own `0` branch for yakumono/small-kana was already what real yakumono characters received. Only the generic branch — which, per §12, was ONLY ever exercised by ordinary kanji/hiragana in practice — changes.

`gposContext`/`VerticalGposContext`/`gposReader.ts` are UNCHANGED, real, tested infrastructure — only this one call site's consumption of `yPlacementEmFor` in the generic branch was removed. No Core file touched. No Preview file touched (this fix is Publication-paint-only, matching the font-specific, paint-time-only nature of GPOS data — the same boundary the original round-10 fix established). Natural Pitch, character advance, `lineHeightRatio`, `linePitchTicks`, column pitch, and font size are all completely unchanged.

One existing test, `verticalGposIntegration.test.ts`, asserted the OLD behavior for a scenario (`gposContext` supplied without `yakumonoContext`) that does not reflect how the real pipeline is ever actually invoked (`generatePublicationPdf` always constructs and passes both together, `pdfGenerator.ts`'s own `buildPublicationPaintPlan`) — updated to assert the new, correct invariant (no repositioning without a real yakumonoContext to route through), with an explanatory comment recording the full history, not merely deleted.

## 17. Diagnostic artifact

`qa/publication/p3-o08/typography-parity-vertical-positioning-ab.pdf` — Page 1: the real, post-fix CURRENT rendering of the ordinary sequence (人は驚きすぎると本当に足が止まるらしい), through the unmodified, real `generatePublicationPdf` pipeline. Visually inspected (rasterized via the existing `@napi-rs/canvas` executor, no PDF rasterizer installed in this environment): clean, evenly-rhythmed, no per-glyph position jitter.

`qa/publication/p3-o08/typography-parity-vertical-positioning-ab-data.pdf` — a compact data page recording the exact, real, per-glyph vpal offset (pt @ 9pt) the fix now suppresses for every ordinary character in the sequence — the same values tabulated in §12.

Both generated by a new test, `renderer/publication/typographyParityVerticalPositioningAB.test.ts`.

## 18. Root-cause classification (final)

| Type | Verdict |
|---|---|
| G1 canonical advance | NO (unchanged from Round 5) |
| G2 effective font scale | NO (unchanged from Round 5) |
| G3 uniform origin | NO (unchanged from Round 5) |
| G4 vertical metrics not applied | NO (unchanged from Round 5) |
| G5 vertical glyph substitution | NO (Round 5's own finding: ink-identical, harmless) |
| **G6 vertical positioning feature (vpal) mis-applied** | **YES — confirmed primary root cause, fixed this round** |
| G7 pure font ink design | Downgraded to a real but secondary/residual factor — the DOMINANT measured effect is now explained by G6, not G7 |
| G8 InDesign mojikumi | N/A (excluded from scope) |
| G9 rasterization artifact | Not excludable as a small residual, but no longer needed to explain the bulk of the measured offset |

**Primary root cause: G6.** Round 10's own real, principled vpal-based yakumono fix was correct for yakumono; its "apply everywhere, it's harmless" extension to ordinary characters was verified only for kanji and was, in fact, wrong for hiragana — proven this round via direct, quantitative correlation against a real InDesign raster measurement, not asserted.

## 19. Decision

Root cause identified with strong, quantitative, near-exact correlation evidence (§12) and fixed in production (§16). This is not a HUMAN GATE / STOP outcome — the Implementation Gate's own conditions for an in-round fix were met: a single, clearly-better variant, a principled reason (a previously-unverified assumption proven wrong by direct measurement), no Natural Pitch change, no column-pitch change, no new shaping architecture. Human visual recheck of the regenerated artifacts against the real InDesign reference is the natural next step.

Scope, frozen per this round's own instruction: **ordinary Kanji/Hiragana only** within one column. Column pitch, `lineHeightRatio`, page margins, page geometry, paragraph layout, and the current InDesign column-pitch difference are explicitly OUT of scope and were not touched.

---

## 1. Methodology

Ordinary-character sequence (punctuation excluded, per this round's own instruction):

> 人 は 驚 き す ぎ る と 本 当 に 足 が 止 ま る ら し い

(18 characters — が added to the checkpoint's own listed set, since it appears in the reference sentence 「本当に足が止まる」and the checkpoint's own instructions list it explicitly.)

Excluded from this round entirely: 、。！？「」『』（）――……・, Latin, digits, TCY, ruby, small-kana correction, punctuation spacing rules.

All measurements below are against the real, committed Shippori Mincho asset (`qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf`) using this codebase's own existing, already-tested font-inspection tooling (`fontMetrics.ts`, `gsubReader.ts`, `gposReader.ts`, `verticalGposPaint.ts`) — no new dependency, no new parser built. A new test file,
`renderer/publication/typographyParityGlyphInCell.test.ts`, adds the round-5-specific measurements; everything it reuses (ink bbox, vmtx origin, vpal audit) is the SAME real tooling earlier P3-O08 rounds already built and Human-approved.

---

## 2. Step 1/6 — canonical advance, scale, ink bbox, origin (decomposition)

Reusing Round 1's own per-glyph measurement (`typographyParityCharacterPitch.test.ts`, extended this round with が):

| Component | TateSpun finding |
|---|---|
| **A. Canonical advance** | Exactly 1em, uniform, for every one of the 18 characters — `naturalAdvanceTick` ignores its own `char` argument entirely (Round 1, re-confirmed). |
| **B. Effective font scale** | `advanceWidthEm`/`advanceHeightEm` = exactly `1` for every glyph, from the font's own real `hmtx`/`vmtx` tables (Round 1). No per-glyph scale variance exists in the font itself. |
| **C. Ink bbox height** | Varies naturally per character: 0.593em (い) to 0.927em (驚) — see Round 1's own full table, `qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_CHARACTER_PITCH.md` §4.2. This is real, measured, font-design ink variance — not a TateSpun computation. |
| **D. Ink center relative to cell** | `inkCenterFromOriginEm` stays within a narrow band, −0.487 to −0.552em (Round 1) — no outlier glyph. |
| **E. Glyph origin relative to cell origin** | `originYEm` is a **constant 0.88em** across all 18 glyphs (Round 1, re-derived this round for が: also 0.88em) — sourced from the font's own real `vmtx.topSideBearing + glyf.yMax` per glyph, not a hardcoded value; it is uniform because the FONT's own data is uniform, not because the code assumes it. |

**A and B are provably identical for every glyph. C and D vary — but this is real font ink design, present in the font file itself, and would be present in ANY correct renderer of this exact font (InDesign included), not a TateSpun-introduced defect.**

---

## 3. Step 7/8 — vertical font tables and features actually present, and what TateSpun applies

| Table/feature | Status | TateSpun currently applies it? |
|---|---|---|
| `vhea`/`vmtx` | PRESENT | YES — real per-glyph vertical origin (§2E above) |
| `VORG` | ABSENT (expected — TrueType/glyf fonts derive vertical origin from vmtx, not VORG; VORG only exists in CFF-outline OpenType fonts) | N/A |
| `vert` (GSUB) | PRESENT for some glyphs (see §4) | YES, consulted (`verticalPaintGraphemeFor`/`VerticalGposContext`) |
| `vrt2` (GSUB) | PRESENT for some glyphs (see §4) | YES, consulted for GPOS lookup purposes; NOT used to swap the painted outline for ordinary characters (see §4 — proven harmless) |
| GPOS `vhal` | **ABSENT** in this font (measured, `gposReader.test.ts`, pre-existing) | N/A — nothing to apply |
| GPOS `vchw` | **ABSENT** | N/A |
| GPOS `valt` | **ABSENT** (measured this round) | N/A |
| GPOS `vkna` | not a real registered OpenType feature tag (checkpoint's own listed candidate; not present in this font's `featureTagsPresent` list either) | N/A |
| GPOS `vpal` | **PRESENT, 446 real single-adjustment entries** | **YES — already wired into `generatePublicationPdf` via `VerticalGposContext`, confirmed active in every Publication PDF this session's own prior rounds generated** |
| GPOS `palt` | present (869 entries) | horizontal-only feature, not consulted by the vertical paint path (correct — this is a horizontal proportional-metrics feature) |

**Step 8's own critical question — "is the uniform vertical origin actually correct, or is TateSpun ignoring real per-glyph differentiation the font provides?" — is answered directly and negatively: the font's own `vmtx` table gives every glyph (ordinary AND punctuation) the identical 0.88em origin. There is no per-glyph origin signal in the font for TateSpun to be ignoring.** This was independently re-confirmed this round and matches an earlier P3-O08 round's own real finding (`verticalGlyphMap.ts`'s own header comment, `qa/evidence/P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md`).

---

## 4. Step 9 — real GSUB vert/vrt2 coverage for the 18 ordinary characters (measured, not assumed)

Initial hypothesis going in: "no ordinary glyph ever has a vert/vrt2 alternate" (matching `verticalGlyphMap.ts`'s own 8-entry punctuation-only `VERTICAL_FORM_MAP`). **This hypothesis was WRONG for hiragana, and the correction matters:**

| Class | vert/vrt2 coverage (measured) |
|---|---|
| KANJI (人, 驚, 本, 当, 足, 止 — 6 chars) | **0 of 6** have any vert/vrt2 alternate |
| HIRAGANA (は, き, す, ぎ, る, と, に, が, ま, ら, し, い — 12 chars) | **12 of 12** have a real vrt2 alternate (different glyph ID from the horizontal-form source) |

This looked, at first, like a real, undiscovered G5 (vertical glyph substitution) defect — TateSpun's `verticalPaintGraphemeFor` only ever consults its own hardcoded 8-punctuation-mark table, never the font's actual, much broader vrt2 coverage.

**Decisive follow-up measurement (this round): for all 12 hiragana, the vrt2-substitute glyph's own real ink bbox (`xMin`/`yMin`/`xMax`/`yMax`, read from `glyf`) is BYTE-IDENTICAL to its horizontal-form source glyph's bbox, in every single case.** The font declares a distinct glyph ID for the vertical form, but that glyph's outline occupies exactly the same shape/box as the horizontal one. This is a real, known font-engineering pattern: a distinct GID exists so that vertical-only GPOS features (`vpal` here) can carry DIFFERENT position/advance values for the "vertical instance" without disturbing the horizontal instance's own metrics — not because the visual glyph shape itself needs to change for kana.

**Conclusion: G5 is NOT a real visual defect for ordinary characters in this font.** Not painting the vrt2 outline causes zero visual difference (the shapes are identical); the part that DOES matter — the vrt2 glyph's own distinct `vpal` metrics — is ALREADY correctly resolved and applied by `VerticalGposContext.yPlacementEmFor` (it looks up `vpal` using the vrt2 GID when one exists, never the source GID — confirmed by direct code read, `verticalGposPaint.ts` line 70).

---

## 5. Step 9 (continued) — real, currently-applied vpal Y-placement for all 18 ordinary characters

| Char | Class | Applied Y-placement (em) |
|---|---|---|
| 人 | KANJI | 0 (no vpal entry — expected, kanji has no vrt2/vert alternate to carry one) |
| は | HIRAGANA | −0.062 |
| 驚 | KANJI | 0 |
| き | HIRAGANA | −0.016 |
| す | HIRAGANA | −0.005 |
| ぎ | HIRAGANA | −0.016 |
| る | HIRAGANA | −0.080 |
| と | HIRAGANA | −0.001 |
| 本 | KANJI | 0 |
| 当 | KANJI | 0 |
| に | HIRAGANA | −0.098 |
| 足 | KANJI | 0 |
| が | HIRAGANA | −0.031 |
| 止 | KANJI | 0 |
| ま | HIRAGANA | −0.004 |
| ら | HIRAGANA | −0.022 |
| し | HIRAGANA | −0.070 |
| い | HIRAGANA | −0.188 |

This is real, measured, non-uniform, glyph-specific data — proof that TateSpun's rendering is NOT simply "uniform origin for everything": every hiragana in this sequence already receives its own individually-measured, font-provided vertical nudge (ranging from −0.001em to a fairly large −0.188em for い), while kanji correctly receive none (the font provides none). **This IS the font-driven, per-glyph refinement a spec-compliant renderer is expected to apply, and TateSpun already applies it.**

---

## 6. Steps 4/5 — repeated-glyph and alternating-pair controls

New test, `typographyParityGlyphInCell.test.ts`:

- **Repeated-glyph control** (人×8, は×8, る×8, 驚×8, 日×8): every one of the 4 (or more) resulting `yTick` deltas within each run is **byte-identical** (`new Set(deltas).size === 1` for every character tested) — canonical advance has provably ZERO pair-to-pair variance for identical glyphs. Renderer determinism is confirmed at the tick level, not merely "looks fine."
- **Alternating-pair control** (人は, は驚, 驚き, きす, が止, 止ま, ×4 repetitions each): generated into a real Publication PDF/rasterized image
  (`qa/publication/p3-o08/typography-parity-glyph-in-cell-diagnostic.pdf`) and visually inspected (rasterized via the existing `@napi-rs/canvas` executor, since no PDF rasterizer is installed in this environment — same method as the prior round's mandatory visual check). **Visual result: clean, uniform, evenly-rhythmed columns for every repeated and alternating sequence — no visible irregularity, no overlap, no drift, when TateSpun's own output is inspected in isolation.**

This directly answers Step 4/5's own purpose: TateSpun's OWN renderer is internally deterministic and does not introduce any placement/transform bug of its own. If the Human's side-by-side overlay still shows a perceptible difference, it is a RELATIVE difference against InDesign's own rendering — not an absolute defect visible in TateSpun's output alone.

---

## 7. Pair classification (Step 3)

Given canonical advance is proven uniform (§6) and the only remaining per-glyph variable is ink bbox/vpal nudge (§2, §5), pair-class variance is fully explained by which TWO characters' own individual ink/vpal values happen to be adjacent — there is no separate "K-K vs H-H" renderer rule; classification would only be meaningful if a class-specific CODE PATH existed, and none does (checked: `core/compose/line.ts`'s `computeAtoms` has zero character-class branching, confirmed already in Round 1). No pair class is "problematic" in the sense of a renderer bug — variance is 100% attributable to individual glyph ink/vpal values (§2, §5), which are per-CHARACTER, not per-PAIR.

---

## 8. Steps 10/11 — TTF vs. InDesign's embedded CFF, and QA alternative variants

**Real, confirmed structural difference**: TateSpun reads the original, committed TrueType (`glyf`-outline) font directly. The InDesign reference PDF embeds a **CFF-flavored** (`CIDFontType0C`), Adobe-subsetted version of the same font family/PostScript name (`SWXGDE+ShipporiMincho-Regular`, confirmed via Round 3's own PDF structural extraction). This is a REAL, confirmed fact — not speculation.

**Whether this container difference changes any ink metric is UNKNOWN and NOT verifiable with this repo's current tooling.** `FontMetricsReader` (this codebase's own font-inspection tool) parses TrueType `glyf`/`loca`/`hmtx`/`vmtx` tables only; it has no CFF/Type2-charstring interpreter, and building one is a substantial new capability, explicitly out of this round's scope (the checkpoint's own STOP condition: "If required OpenType feature cannot be inspected with current tooling... mark UNSUPPORTED"). **This is the single remaining gap between "TateSpun's own rendering is internally correct and deterministic" (proven, §2–§6) and "TateSpun's rendering is pixel/metric-equivalent to InDesign's" (unverifiable without new tooling).**

Per the checkpoint's own "no fabricate unsupported OpenType behavior" instruction, no QA-alternative placement variant (Step 11, Variants B/C/D) was built: variants B (vertical metrics) and C (vertical substitution) are, per §3–§4 above, **already what TateSpun's current code does** — there is no "alternative" left to try that isn't already production behavior. Variant D (valt/vkna) is UNSUPPORTED — the font provides neither feature (§3).

---

## 9. Root-cause classification

| Type | Verdict | Basis |
|---|---|---|
| G1 — canonical advance wrong | **NO** | §2A — exactly 1em, uniform, for every glyph, unconditionally |
| G2 — effective font scale inconsistent | **NO** | §2B — `advanceWidthEm`/`advanceHeightEm` = 1 for every glyph, from the font's own real hmtx/vmtx |
| G3 — uniform origin assumption ignores real per-glyph signal | **NO** | §3 — the font's own vmtx data IS uniform (0.88em for every glyph); there is no signal to ignore |
| G4 — vertical metrics not applied | **NO** | §3 — vmtx origin and vpal Y-placement are both read from the font and both actively applied |
| G5 — vertical glyph substitution differs | **NO (resolved this round, with real evidence)** | §4 — vrt2 exists for all 12 hiragana but is ink-bbox-identical to the source glyph; not substituting the OUTLINE causes zero visual difference, and the metrics-relevant part (vpal lookup via the vrt2 GID) is already correctly applied |
| G6 — vertical positioning feature (valt-type) differs | **NO** | §3 — `valt`/`vkna` are both absent from this font; nothing to apply |
| G7 — pure font ink design (same in InDesign, apparent difference is inherent) | **MOST LIKELY, primary candidate — not yet independently confirmed against InDesign's own rendering** | §2C — real, measured, natural ink-height variance (0.593–0.927em) exists in the font itself; since InDesign renders the identical font family/design, this variance would be present in InDesign's output too, by construction — but this repo cannot yet directly measure InDesign's own CFF-glyph ink bboxes to prove pixel-for-pixel equivalence (§8) |
| G8 — InDesign mojikumi (punctuation) | N/A — explicitly excluded from this round's scope | |
| G9 — PDF/rendering/rasterization artifact | **Possible contributing factor, not excludable** | Human's own visual judgment was made from a screenshot/rendered comparison; anti-aliasing/compression/zoom-level effects were flagged as a real risk in Round 1's own evidence doc (§6, the TSP-029 memory connection) and remain unaddressed this round |

**Primary candidate: G7**, with G9 as a plausible secondary contributing factor. **G1 through G6 are all cleared by direct, real, measured evidence from this exact font and this exact renderer** — this is a materially stronger, more thorough result than Round 1's own (less certain) conclusion.

---

## 10. Decision — HUMAN GATE (tooling limitation, per the checkpoint's own explicit stop rule)

No production code was changed this round. Every plausible renderer-level correction (G1–G6) was checked against real measured evidence and found to be either already correctly implemented or not applicable to this font/character set — there is no principled correction left to make without first closing the one remaining measurement gap: **InDesign's own embedded CFF font's real per-glyph ink bboxes cannot currently be extracted with this repo's tooling** (`FontMetricsReader` is TrueType/glyf-only; a CFF/Type2-charstring interpreter would be new, nontrivial tooling, explicitly out of scope per the checkpoint's own "do not fabricate unsupported OpenType behavior" and "STOP if required OpenType feature cannot be inspected with current tooling" rules).

This is a genuine STOP condition, not a deferred implementation. Forcing a "fix" here — e.g. hand-tuning per-glyph offsets to visually approximate what a screenshot comparison suggests — is exactly the kind of unprincipled correction this round's own checkpoint (and the earlier TSP-029 loop, per this session's own carried-forward memory) explicitly warns against.

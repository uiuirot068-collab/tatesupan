# Typography Parity — Glyph-in-Cell / Intra-Column Visual Rhythm (Round 5)

Recorded: 2026-09-09
HEAD at audit time: `50133a3`
Status: Root cause largely NARROWED and mostly CLEARED (G1–G6 all checked with real evidence; only G7 vs. a genuine InDesign-side ink-bbox comparison remains open, blocked by tooling). Audit-only — no production code changed this round.

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

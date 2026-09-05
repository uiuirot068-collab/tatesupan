# P2-L03 — Layout Formula & Determinism Audit

- Status: Phase 2 PoC diagnosis, not a Phase 3 spec. No typography was changed; no new preset-specific tuning was added.
- Question: is the preset-dependent P2-L02 Human result (C1 preferred on 5/8 presets, C3 on 2/8, 新書 in-between) caused by a real C1-architecture limitation, or by the P2 PoC's simplified layout formula diverging from TateSpun's actual `computePageLayout`/`PageCard.tsx` rendering formula?
- Method: read (read-only) `src/lib/pageLayout.ts` and `src/components/PageCard.tsx` inside this worktree; no external/parent-directory reads.

---

## 1. Production layout formula (as actually implemented, not as assumed)

Two genuinely separate mechanisms exist in production — conflating them was the root of this loop's key finding:

**(a) Capacity (`computePageLayout`, `src/lib/pageLayout.ts`):** how many characters/columns actually fit, used for pagination.
- `computeFontSizeMm(fontSizePt) = fontSizePt × MM_PER_PT` (MM_PER_PT = 25.4/72)
- `computeColumnHeightMm`: for **2段, TateSpun stacks top/bottom, not side-by-side** — `(textAreaHeightMm − columnGapMm) / 2`, confirmed directly in source (this exactly matches the fix P2-L02 already made for A5 2段 after catching its own bug — now doubly confirmed against the real function, not just self-consistency).
- `computeMaxCapacityChars(textAreaHeightMm, fontSizeMm) = floor(textAreaHeightMm / fontSizeMm)` — i.e., **capacity is always computed at exactly 1 em per character.** A preset's declared `charsPerLine` (from `paperSizes.ts`) is a *target*, clamped down to this max if it would exceed it — but never stretched up.
- `computeLinePitchMm(fontSizePt, lineHeightRatio) = fontSizeMm × lineHeightRatio` — the across-column (page-width direction) pitch.
- `PX_PER_MM = 2.2` — the **preview-only** screen scale production uses to turn any mm value into on-screen CSS px (not a real DPI; a separate `CSS_PX_PER_MM_96DPI` exists only for physical/PDF sizing, unused by the live Preview).
- For `isPx` presets (Web閲覧用): **only the preset's outer `width`/`height` are authored in raw px** (converted via `pxToInternalMm`). Every other field — `marginTop/Bottom/Gutter/Outer`, `fontSizePt` — **is already canonical mm/pt, isPx or not** (confirmed verbatim in `PageSettingsPanel.tsx`'s `applyPaperTemplate` comment: "isPxかどうかに関わらず常にcanonicalなmm/ptとしてそのまま settings に渡す").

**(b) Visual slot pitch (`PageCard.tsx`, FixedSlot renderer):** given the *already-capacity-clamped* `layout.charsPerLine`, how tall each character's on-screen cell actually is:
- `gridMode: "solid"` (A5 1段 only, explicit override, TSP-LOOP-003): `canonicalSlotExtentPx = fontSizePx` — exactly 1 em, leftover space becomes bottom margin.
- `gridMode: "justified"` (the default — 文庫/A5 2段/B5/B6/新書/A6/Web閲覧用): `canonicalSlotExtentPx = textAreaHeightPx / layout.charsPerLine` — **the slot is stretched to exactly fill the column**, using the *same* `charsPerLine` number as capacity. This is a real, current, shipped rendering behavior — not a bug in production, and not something this audit is proposing to change.

## 2. C1 PoC formula (`scripts/build-multipreset.js`, P2-L02)

`charPitch = gridMode==="solid" ? fontSize : columnHeightPt / charsPerLine`, using the preset's *declared* `charsPerLine` from `paperSizes.ts` directly (never separately re-clamped against `computeMaxCapacityChars`), rendered in literal CSS `pt`/`px` units (not run through `PX_PER_MM`).

## 3. Where they differ

**They mostly do NOT differ in the ratio that matters.** Checked whether any preset's declared `charsPerLine` actually gets clamped by `computeMaxCapacityChars` — **none of the 8 do** (see table below, "declared vs. max capacity"). So for every print preset, the PoC's `charPitch = columnHeight/charsPerLine` formula is — apart from a uniform, ratio-preserving CSS-unit scale difference from production's own `PX_PER_MM` preview zoom (real Preview: ≈0.776 px/pt effective; the PoC's literal CSS `pt`: 1.333px/pt, ≈1.72× larger on screen, applied uniformly to both font size and pitch, so it does not change their *ratio*) — **a correct reproduction of production's actual, currently-shipped `canonicalSlotExtentPx` formula.** The one genuine bug is **Web閲覧用**, where the PoC used the preset's numbers as literal raw CSS px, but per `PageSettingsPanel.tsx`'s own comment, `Web閲覧用`'s `marginTop/fontSizePt/etc.` are **already canonical mm/pt**, not raw px (only `width`/`height` are). Skipping the `PX_PER_MM`/mm↔pt round-trip made the PoC's Web sample internally inconsistent (see §5) — a real formula bug, isolated to Web閲覧用.

| Preset | Declared charsPerLine | computeMaxCapacityChars (real, 1em floor) | Clamped in production? | canonicalSlotExtentPx ÷ fontSizePx (the stretch ratio, scale-invariant) |
|---|---|---|---|---|
| 文庫 | 38 | 40 | No | 1.05× |
| A5 1段 | 53 | — (n/a, `solid` mode) | No | 1.00× (solid, by design) |
| A5 2段 | 25 | ~30 (post-stacking-fix column height) | No | 1.13× |
| **B5** | **45** | **64** | **No** | **1.44×** |
| B6 | 40 | 47 | No | 1.18× |
| 新書 | 40 | 50 | No | 1.27× |
| A6 | 38 | 40 | No | 1.05× |
| Web閲覧用 | 29 | 30 | No | **~1.05× (real)**, but PoC rendered an internally-inconsistent ~0.90× (see §5) |

## 4. B5 diagnosis

**Production formula, verified against the real source, gives the same ~1.44× stretch the PoC showed.** B5's preset author chose `charsPerLine: 45`, well below the physically-possible 64 (per `computeMaxCapacityChars`), leaving 19 "characters' worth" of column height as slack — and `gridMode: "justified"` (B5's default, unchanged) spreads that entire slack evenly across all 45 slots, per the exact formula in `PageCard.tsx`. **This is not a PoC bug — the P2-L02 C1 sample for B5 faithfully reproduces what production's FixedSlot renderer actually draws for B5 today.**

**Human result explained:** YES, but not as "C1 architecture is worse." The Human is seeing — accurately, for the first time in a side-by-side comparison — that **B5's own current preset configuration already has a large, deliberately-justified pitch stretch**, and prefers C3's native (effectively ~1em, unstretched) rendering instead. This directly matches Master §5.2's already-frozen product principle: *"版面高を完全に埋めるために、文字送りを無理に伸縮することより自然な文字送りを優先する… 余剰スペースが発生する場合は、原則として版面余白として扱う"* ("prefer natural pitch over forced page-fill stretching; treat leftover space as margin"). **B5's current `justified` gridMode is in tension with Master §5.2 for this specific preset**, independent of which Engine v2 rendering architecture (C1/C2/C3) is eventually chosen.

## 5. Web閲覧用 diagnosis

**This one IS a PoC bug, not a production/architecture finding.** Recomputing with the correct unit model (margins/font-size treated as already-canonical mm/pt, per `PageSettingsPanel.tsx`; only width/height converted from px via `PX_PER_MM`):
- Real internal text-area height ≈ 385.45mm (`1024px/2.2 − 40mm − 40mm`); real fontSizeMm ≈ 12.6mm (36pt × MM_PER_PT).
- Real `canonicalSlotExtentPx` ≈ 29.2px vs. real `fontSizePx` ≈ 27.7px → **≈1.05× stretch — mild, in line with 文庫/A5/A6, not "cramped" at all.**
- The PoC instead used `36` directly as CSS px for font size (skipping the mm/pt canonical step and the `PX_PER_MM` scale entirely) and computed `charPitch` from that same wrong absolute scale, landing at **32.55px — smaller than its own (also wrong) 36px font size**, i.e. a pitch tighter than the glyph's own advance. That inconsistency — not any real architectural or preset property — is what produced the "too cramped" symptom, specifically flagged around 「二人で」.

**Human result explained:** NO — this specific defect is explained by a PoC unit-conversion bug, not by C1's architecture or by Web閲覧用's real configuration. **The P2-L02 Web閲覧用 C1 sample is INVALID and needs to be regenerated with the corrected unit model before its Human result can be trusted as architecture evidence.**

## 6. 新書 diagnosis

Same category as B5 (justified stretch, correctly reproduced, real production behavior) but milder: **1.27× vs. B5's 1.44×.** The Human's "between C1 and C3" reaction (rather than a clean C3 preference like B5) is consistent with a dose-dependent response to the same underlying real-production stretch — not a sign of a different mechanism. No principled *existing* metric was found in this loop that defines a specific "correct" intermediate pitch between 1.00× and 1.27× — Master §5.2 says prefer natural (≈1.00×) pitch, which would argue for moving *toward* C3/solid rather than inventing a literal midpoint. **Leaving this OPEN**, per instruction not to invent a midpoint.

## 7. Other presets

- 文庫 (1.05×), A5 1段 (1.00×, `solid`), A5 2段 (1.13×), A6 (1.05×), B6 (1.18×): all correctly reproduced by the PoC (verified against the real formula, not merely self-consistent), and all fall in the same "mild stretch" band the Human accepted (C1 preferred on all five). This supports a dose-response reading across the whole matrix, not just the B5/新書 pair: **stretch ratio ≤ ~1.2× was accepted; ≥ ~1.27× started to erode preference; 1.44× clearly failed.** This is an observation about the existing shipped presets, not a newly invented threshold — it is not being used here to justify any change.

## 8. Determinism implications

C1's explicit-grid architecture is not what's in question here — the *specific numbers it was fed* (the current `paperSizes.ts` presets' own `justified` slack) are. C1 remains fully deterministic (it always renders exactly what it's told to); the dose-response pattern above is a property of **which pitch values the existing presets currently declare**, reproduced faithfully, not a flaw in explicit-grid positioning as a technique. C3's "preference" on B5/新書 is really a preference for an **untested fourth configuration** — C1 with `solid` (or otherwise de-stretched) pitch — that this loop did not build or show anyone. That configuration, not "C3 the architecture," is the actual open alternative implied by the Human evidence.

## 9. Is P2-L02's C1 sample partially invalid?

- **文庫, A5 1段, A5 2段, B5, B6, 新書, A6: NOT invalid.** All correctly reproduce production's real, current, shipped formula (verified against source, not assumed). The Human preferences recorded for these seven are real evidence about the *existing presets' own configuration* (specifically, B5/新書's justified-stretch degree), not about a PoC bug. **C1 the architecture remains fully viable — nothing here rejects it.**
- **Web閲覧用: INVALID.** A genuine unit-conversion bug in the PoC script, isolated to this one preset. Its Human result (C1 "too cramped") should not be counted as evidence about C1's architecture, C3's architecture, or Web閲覧用's real configuration until re-tested with the corrected formula (§5).

**Human QA that remains valid:** 文庫, A5 1段, A5 2段, B5, B6, 新書, A6 (7/8).
**Human QA requiring re-test:** Web閲覧用 (1/8), with a corrected unit model.

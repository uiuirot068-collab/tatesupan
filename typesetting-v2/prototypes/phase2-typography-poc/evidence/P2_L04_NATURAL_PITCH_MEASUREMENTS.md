# P2-L04 — Natural-Pitch C1 Measurements

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Scope: 5 presets (3 discriminating: B5, 新書, Web閲覧用; 2 controls: 文庫, A5 1段)
- Generator: `scripts/build-natural-pitch.js` → `natural-pitch-comparison.html`, `scripts/natural-pitch-measurements.json`
- All values derived from the same real formulas verified in P2-L03 (`src/lib/pageLayout.ts`, `src/components/PageCard.tsx`), read-only, no src changes.

## 1. C1-NATURAL formula

`naturalSlotMm = fontSizeMm` (exactly 1 em, physical-font-size-derived — Production's own already-shipped "solid" `gridMode`, applied uniformly instead of per-preset). Line pitch (`colPitchMm = fontSizeMm × lineSpacing`) is **identical** to C1-JUSTIFIED — this loop only changes character (down-column) pitch, never line pitch, per instruction. No preset-specific multiplier of any kind was introduced.

## 2. Web unit-fix

- **Old (P2-L02) bug:** treated Web閲覧用's template numbers (`marginTop:40`, `fontSizePt:36`, etc.) as raw CSS px directly, with no conversion.
- **Corrected formula (this loop, matching `PageSettingsPanel.tsx`'s own documented contract):** `marginTop`/`fontSizePt`/etc. are already canonical mm/pt for every preset including `isPx` ones; only outer `width`/`height` are px-authored (converted via `÷ PX_PER_MM`). All values then scale to on-screen px via the same real `PX_PER_MM = 2.2` used everywhere else, plus a uniform `×4` **display zoom** (see §5) applied identically to every number in this document — not a typography change, just legibility.
- **Resulting declared (real, corrected) justified stretch ratio: 1.047×** — mild, in the same band as 文庫/A5 1段, not "cramped." Matches P2-L03's independently-derived figure.

## 3. Per-preset table (all figures include the ×4 uniform display zoom, §5 — ratios are zoom-invariant)

| Preset | fontSizePx | charsPerLine (unchanged) | colPitchPx (unchanged) | C1-JUSTIFIED slotPx | JUSTIFIED ratio | C1-NATURAL slotPx | NATURAL ratio | Residual (NATURAL), mm |
|---|---|---|---|---|---|---|---|---|
| 文庫 | 26.39 | 38 | 44.86 | 27.79 | 1.053× | 26.39 | 1.000× | 6.05mm |
| A5 1段 | 27.94 | 53 | 47.50 | 27.94 (solid, same as NATURAL) | 1.000× | 27.94 | 1.000× | 5.73mm |
| **B5** | 29.49 | 45 | 50.14 | **42.44** | **1.439×** | 29.49 | 1.000× | **66.19mm** |
| 新書 | 26.39 | 40 | 44.86 | 33.44 | 1.267× | 26.39 | 1.000× | 32.06mm |
| Web閲覧用 | 111.76 | 29 | 201.17 | 116.97 | 1.047× | 111.76 | 1.000× | 17.15mm |

(Full precision in `scripts/natural-pitch-measurements.json`.)

## 4. Capacity vs. natural pitch — the central question, answered

**YES — logical `charsPerLine` remains identical between C1-JUSTIFIED and C1-NATURAL for every preset in this table.** Only the *visual* slot pitch changes; the declared capacity (how many characters are placed per column, and therefore pagination) is untouched. The difference shows up entirely as a **residual margin** at the foot of the column — rendered visibly in `natural-pitch-comparison.html` as a hatched stripe under each C1-NATURAL grid, not hidden. Residual size scales with how much slack a given preset's declared `charsPerLine` already leaves below its real physical maximum (B5's 66mm residual is the most dramatic, matching its being the most over-stretched preset under `justified`; A5 1段, already `solid` in Production, is naturally unchanged between the two variants).

This is not a new architectural capability being invented — it is Production's own existing `gridMode:"solid"` mechanism (already shipped for A5 1段) applied to every preset, so the "YES" answer is not a hypothesis, it is a direct consequence of a mechanism that already exists in the codebase.

## 5. Display zoom (legibility only, not a typography change)

Production's real on-screen scale (`PX_PER_MM = 2.2`) renders an 8.5pt character at ≈6.6px — too small to visually judge rhythm from in a browser. A uniform `×4` display zoom is applied to every measurement in this document and in `natural-pitch-comparison.html` (font size, every pitch, column height, residual) — identically across all presets and all three candidates — so it changes no ratio anywhere. This is analogous to a user zooming the real Preview UI, not a rendering-technique change.

## 6. What this loop does NOT establish

- Whether C3's *actual* native capacity (how many of Fixture B's characters it fits before clipping) numerically matches C1-NATURAL's declared capacity — not measured by the agent this loop (no headless tool used, per instruction); left for Human/manual inspection, same open item carried from P2-L02.
- Kinsoku/hanging punctuation correctness for either C1 variant or C3 — explicitly out of scope this loop (v2 rules not finalized; see loop brief's "IMPORTANT: CURRENT JAPANESE TYPESETTING RULE STATUS" section).
- 新書's Human-desired "in-between" rhythm — C1-NATURAL is offered as a candidate answer (1.000× vs. the old 1.267×), but whether it satisfies the Human's stated preference is for the scorecard, not asserted here.

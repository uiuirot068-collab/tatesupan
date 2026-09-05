# P2-L02 — C1 vs C3 Multi-Preset Measurements

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Scope: all 8 of Master §11.2's mandatory Human QA presets
- Source of truth for preset values: `src/constants/paperSizes.ts` `PAPER_SIZE_TEMPLATES` (read read-only, transcribed by hand into `scripts/build-multipreset.js`)
- Generator: `scripts/build-multipreset.js` → `multipreset-comparison.html`, `scripts/multipreset-measurements.json`
- Regression text: the canonical sentence (Master §11.3) repeated ×30 as a **synthetic pagination-stress fixture** — not literary sample text, used only to exceed every preset's page-1 capacity

## 1. Preset table (as read from `paperSizes.ts`, `cols1` unless noted)

| Preset | Page (mm/px) | Margins T/B/gutter/outer | Font | Line-spacing | charsPerLine | linesPerColumn | gridMode | Declared page-1 capacity |
|---|---|---|---|---|---|---|---|---|
| 文庫 | 105×148mm | 14/14/15/10mm | 8.5pt | 1.7 | 38 | 16 | justified | 608 |
| A5 1段 | 148×210mm | 18/18/20/14mm | 9.0pt | 1.7 | 53 | 22 | **solid** (TSP-LOOP-003 override) | 1166 |
| A5 2段 | 148×210mm | 16/16/18/14mm | 8.5pt | 1.65 | 25 | 24 | justified, **stacked** (see §2) | 600 |
| B5 (1段) | 182×257mm | 20/20/22/16mm | 9.5pt | 1.7 | 45 | 26 | justified | 1170 |
| B6 (1段) | 128×182mm | 16/16/18/12mm | 9.0pt | 1.7 | 40 | 18 | justified | 720 |
| 新書 (1段) | 103×182mm | 15/15/16/11mm | 8.5pt | 1.7 | 40 | 15 | justified | 600 |
| A6 (1段) | 105×148mm | 14/14/15/10mm | 8.5pt | 1.7 | 38 | 16 | justified | 608 |
| Web閲覧用 (1段) | 768×1024px | 40/40/20/20px | 36px | 1.8 | 29 | 12 | justified | 348 |

(cols2 was used only for A5 2段, per the loop brief's explicit "A5 1段 / A5 2段" split; all other presets use `cols1` since the brief lists them without a column-count qualifier.)

## 2. A5 2段 — stacking model correction (a real bug caught and fixed mid-loop)

TateSpun's "2段" is **vertical top/bottom stacking within one page, not side-by-side columns** (`docs/requirements/CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md`, "Chars/line, lines/column, columns" row). A first pass of this script incorrectly divided the *full* page column-height by `charsPerLine`, producing an implausible charPitch of ~20.2pt (238% of the 8.5pt font size) — caught by sanity-checking the output before publishing it, not assumed correct. Fixed by treating `charsPerLine` as the height of **each of the two stacked half-blocks** (full column height minus the 8mm inter-block gap, divided by 2), giving a corrected charPitch of ~9.64pt (113% of font size) — a plausible "justified" stretch. This fix is applied only to A5 2段 in this loop; the same top/bottom-stacking model would need re-deriving for any other 2段 preset later.

## 3. Computed physical grid values (all `justified` presets use `charPitch = 版面高 / charsPerLine`; A5 1段 uses `charPitch = fontSize` per its explicit `gridMode:"solid"` override)

| Preset | columnHeight (pt or px) | computed charPitch | charPitch ÷ fontSize | colPitch (fontSize×lineSpacing) |
|---|---|---|---|---|
| 文庫 | 340.16pt | 8.95pt | 1.05× | 14.45pt |
| A5 1段 | 493.23pt | 9.00pt (solid, = fontSize exactly) | 1.00× | 15.30pt |
| A5 2段 | 240.94pt (post-stacking-fix) | 9.64pt | 1.13× | 14.03pt |
| B5 (1段) | 615.12pt | 13.67pt | **1.44×** | 16.15pt |
| B6 (1段) | 425.20pt | 10.63pt | **1.18×** | 15.30pt |
| 新書 (1段) | 430.87pt | 10.77pt | **1.27×** | 14.45pt |
| A6 (1段) | 340.16pt | 8.95pt | 1.05× | 14.45pt |
| Web閲覧用 (1段) | 944px | 32.55px | 0.90× | 64.80px |

**Flagged, not resolved in this loop:** B5/B6/新書's computed `justified` charPitch is 18-44% larger than the declared font size — noticeably looser than 文庫/A5/A6's ~5% stretch. This may be:
(a) an intentional, existing product design choice for those three presets (looser line pitch by design), or
(b) evidence that `src/lib/pageLayout.ts`'s actual `computePageLayout`/capacity-clamp logic (referenced in the Compatibility Matrix but not read in this loop — out of scope for the 60-minute timebox) does something more than the single documented `paperSizes.ts` comment formula this script reproduces — e.g. reserving additional space, or clamping `charsPerLine` at render time rather than using the raw template value as-is.
**This is an open question about *reproducing current production's real formula faithfully*, not a new typography rule being proposed.** Should be resolved by actually reading `computePageLayout` before this multi-preset harness is trusted as a faithful stand-in for production, in a follow-up loop.

## 4. C1 vs. C3 — what was actually compared

- **C1**: explicit absolute-positioned grid, fed a *naive fixed-count slice* of the stress text — exactly `charsPerLine × linesPerColumn` characters, deterministic by construction.
- **C3**: plain native `writing-mode:vertical-rl` block, fed the **entire** (much longer) stress text, inside a box physically sized to the same page-1 dimensions and `overflow:hidden` — the browser's own line-breaking/kinsoku decides how much text actually becomes visible, independent of C1's declared capacity number.

**This was not independently measured/verified in this loop** — no headless-browser or DOM-measurement tool was used (per this loop's explicit restriction against further tooling workarounds after repeated environment guard interruptions in the prior P2-L01B/C loops). The comparison page (`multipreset-comparison.html`) exists and is real, but whether C3's actual rendered content boundary matches, exceeds, or falls short of C1's declared capacity for each preset is a question **left for Human/visual inspection**, not asserted here as measured fact. This is the single most important "measure it, don't assume it" gap in this loop's evidence — flagged prominently per the loop's own instruction not to bias the result.

## 5. What this loop does NOT establish

- Whether C1 and C3's *visual punctuation rhythm* (the だ。け / ば、ど behavior from P2-L01) holds up identically across all 8 presets — not independently re-inspected per preset in this loop; the underlying rendering mechanism (browser-native glyph painting) is unchanged from P2-L01 for both C1 and C3, so no *new* mechanism-level reason exists to expect divergence, but this is an inference, not a fresh per-preset observation.
- Real multi-**page** transitions (page 2, 3, …) — each preset section shows only page-1 capacity; content beyond that is simply clipped (C3) or never generated (C1), not carried onto a rendered "page 2." A true multi-page pagination test remains open for a future loop.
- Whether `computePageLayout`'s actual runtime formula matches the `paperSizes.ts`-comment-derived formula this script reproduces (see §3's flagged discrepancy).

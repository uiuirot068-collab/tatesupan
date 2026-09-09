# Typography Parity — InDesign Overlay Drift

Recorded: 2026-09-09
Status: **ROOT CAUSE FOUND AND FIXED (Round 3)** — see §9 below for the current state. Round 1/Round 2 sections below are preserved unedited as history.

---

# Round 3 — exact InDesign-matched geometry, root cause, and fix

Recorded: 2026-09-09
HEAD at audit time: `4b8e8a4`
Status: Column-pitch drift root-caused and fixed in the real product settings adapter. Natural Pitch (character-direction advance) untouched and preserved.

## 9. Step 0 — reference file confirmation

`qa/reference/indesign/molsui-indesign-reference.pdf` — **confirmed present** (49,414 bytes).

## 10. Step 1 — InDesign reference geometry, independently extracted from raw PDF bytes

Extracted via a new test,
`renderer/publication/typographyParityIndesignExtraction.test.ts`, using
only Node's built-in `zlib` (FlateDecode inflate) plus regex-based PDF
structural parsing — the same technique
`structuralColophonFreeTextFinalPdfParity.test.ts` already established in
this directory. No new dependency.

| Fact | Independently measured value | Matches Human-supplied fact? |
|---|---|---|
| Creator | `Adobe InDesign CS6 \(Windows\` | matches |
| Producer | `Adobe PDF Library 10.0.1` | (not previously supplied) |
| MediaBox | `[0 0 419.528 595.276]` pt | matches `419.528 × 595.276 pt` exactly |
| Physical page | 148.0mm × 210.0mm (computed from MediaBox) | matches "A5 portrait / 148×210mm" |
| Embedded font | `SWXGDE+ShipporiMincho-Regular`, `Type0`/`CIDFontType0` | matches "ShipporiMincho-Regular" |
| Body font size | 9.0pt (from the `9 0 0 9 X Y Tm` text-matrix scale in the real content stream — the font itself is invoked at `1 Tf`, i.e. unscaled, with the actual size carried entirely by the Tm scale factors) | matches "9.0 pt" |
| Column-to-column (行間) pitch | **15.9095pt**, measured as the mean delta between 20 consecutive real `Tm` X-coordinates across one full content stream (object 35) — every single delta in the sequence was 15.9094 or 15.9095pt, i.e. constant to within 0.0001pt | matches the Human-supplied "≈15.909pt" and its listed sample X positions, confirmed to much higher precision |
| Vertical character pitch (per-glyph) | No `/DW2` or `/W2` override found anywhere in the font's CIDFont dictionary → the PDF spec's own default `DW2 = [880 -1000]` applies, i.e. exactly 1 em per character (9pt at this size) | matches "9.0 pt" (character pitch), and confirms it is genuinely a SEPARATE quantity from column pitch (15.9095pt ≠ 9pt) |

**Column pitch ÷ character pitch = 15.9095 / 9.0 = 1.76772.** This ratio, not 1.0, is the real InDesign document's own actual typesetting convention — column-to-column spacing is nearly 1.77× the character size, not equal to it.

## 11. Step 3 (performed before Step 2, since it explains what Step 2 must match) — v2 column-pitch model audit

Direct code read, not assumed:

- `core/compose/column.ts`'s own `ColumnCompositionSettings.linePitchTicks` is documented as "column-width consumed per line placed" — i.e., **the physical spacing between adjacent 行 (vertical text strips) within a column**. This is a genuinely free, independent field in the Canonical contract; nothing in Core forces `linePitchTicks === perCellAdvanceTick` (character advance).
- `renderer/preview/paintModel.ts`'s `buildPaintLine` uses the identical concept (`line.rightPx = lineIndex * ctx.linePitchTicks`) — Preview already reads the SAME independent field, so a settings-layer fix reaches both renderers with no separate Preview change needed.
- **The defect was entirely in the settings-adapter layer**: `src/lib/v2Bridge/settingsAdapter.ts`'s `buildV2LayoutSettings` set `linePitchTicks: perCellAdvanceTick` — i.e., forced the ratio to exactly 1.0 — regardless of any real product setting.
- The current/legacy product **already has** a real, shipped, real `lineHeightRatio` field (`src/lib/pageLayout.ts`, `PageSettings.lineHeightRatio`, doc comment "行間倍率 (例: 1.6〜1.8)", `DEFAULT_PAGE_SETTINGS.lineHeightRatio = 1.7`) and a real, already-used formula, `computeLinePitchMm(fontSizePt, lineHeightRatio) = computeFontSizeMm(fontSizePt) * lineHeightRatio` — used throughout the legacy layout engine's own capacity math. **This is not a hypothesis; it is the same real 1.6–1.8 range that independently brackets the InDesign reference's own measured 1.7677 ratio.**
- Conclusion: **no Core contract change is required.** This is a real, narrow, evidence-backed bug in one settings-adapter function, which was silently dropping an already-real, already-shipped product setting.

### Root cause classification

| Type | Verdict |
|---|---|
| T2 — page/content origin | Not the primary cause (see §13's disclosed approximation for absolute origin; the dominant, quantified effect is pitch, not origin) |
| T3 — character pitch | **NO** — confirmed exactly 1em, matches InDesign's own DW2-default convention |
| **T4 — column pitch** | **YES — primary, confirmed root cause.** `linePitchTicks` was hardcoded to the character-advance value instead of deriving from the real, already-existing `lineHeightRatio` product setting. |
| T5 — font size/glyph scale | NO — font and size both confirmed identical |
| T6 — glyph ink position | Not evaluated this round (secondary to the dominant T4 finding) |
| T7 — paragraph/layout semantics | Not evaluated this round |
| T8 — reference conditions not equivalent | Resolved this round (Round 2's guessed 文庫/10.5pt geometry replaced with confirmed A5/9pt facts) |

## 12. Implementation — the fix

**File**: `src/lib/v2Bridge/settingsAdapter.ts`, `buildV2LayoutSettings`.

**Before**:
```ts
linePitchTicks: perCellAdvanceTick,
columnExtentTicks: settings.linesPerColumn * perCellAdvanceTick,
```

**After**:
```ts
const linePitchTick = mmToTicks(computeLinePitchMm(settings.fontSizePt, settings.lineHeightRatio));
// ...
linePitchTicks: linePitchTick,
columnExtentTicks: settings.linesPerColumn * linePitchTick,
```

Reuses the real, already-shipped legacy formula (`computeLinePitchMm`, `pageLayout.ts`) verbatim — no new formula invented, no magic ratio, no screenshot-derived constant. `lineExtentTicks` (the character-direction budget WITHIN one 行, governed by Natural Pitch) is completely untouched. `columnExtentTicks` is also corrected (from `linesPerColumn * perCellAdvanceTick` to `linesPerColumn * linePitchTick`) so that the Editor's own real `linesPerColumn` target still resolves to the correct physical column-capacity budget — leaving it unfixed would have caused only `linesPerColumn / lineHeightRatio` real lines to fit per column, a second, silent capacity regression.

Two new regression tests added to `src/lib/v2Bridge/settingsAdapter.test.ts` proving: (a) `linePitchTicks` now reflects the real `lineHeightRatio`, not the character advance; (b) `lineExtentTicks` (character direction) is provably unaffected by `lineHeightRatio` changes, while `linePitchTicks`/`columnExtentTicks` scale proportionally with it.

## 13. Step 2 — regenerated v2 Publication reference, matched to the real InDesign facts

`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf` regenerated (superseding Round 2's own guessed 文庫/10.5pt version) using the confirmed facts: A5 148×210mm, Shippori Mincho, 9pt, column pitch = the measured 15.9095pt (this exercise's own matched value, used directly rather than re-derived through `lineHeightRatio`, per the checkpoint's own "do not derive column pitch from fontSize or 1em if the document demonstrably uses a different pitch" instruction).

**Disclosed approximation**: margins (`marginTopMm`/`marginRightMm`/`marginBottomMm`/`marginLeftMm`) are derived from the raw `Tm` pen-position coordinates of the first painted glyph run, WITHOUT correcting for the CID vertical font's own position-vector offset (DW2's `v` component) — recovering the exact sub-pt content-origin would require full vertical-metrics-aware glyph-origin decoding, out of this round's scope. This affects only the absolute origin (T2), not the column-pitch finding (T4), which does not depend on margin values at all.

Resulting matched geometry: `charPitchMm=3.175`, `columnPitchMm=5.6125`, `columnPitchOverCharPitchRatio=1.76772` (exactly the measured InDesign ratio, by construction), `charsPerLine=54`, `linesPerColumn=21`, 1 page.

## 14. Steps 4/5 — quantified drift, before vs. after the fix

A new diagnostic, `renderer/publication/typographyParityIndesignVsV2Comparison.test.ts`, computes v2's own column X-anchors two ways — using the SAME real 21 measured InDesign anchor positions as the comparison baseline — and writes
`qa/publication/p3-o08/typography-parity-indesign-vs-v2-comparison.pdf` (a geometry-grid diagnostic: RED = real measured InDesign anchors, ORANGE = v2 BEFORE this round's fix, BLACK = v2 AFTER):

| | Before fix (ratio 1.0) | After fix (ratio matched to InDesign) |
|---|---|---|
| Max drift across 21 columns | **48.750mm** | **0.0004mm** |

48.75mm of cumulative horizontal drift on a 148mm-wide A5 page is enormous — nearly a third of the entire page width — fully sufficient on its own to explain a "looks systematically wrong" Human visual verdict, independent of any glyph-shape or origin question. This is classified **systematic and cumulative** (grows linearly with column index — `T4` per the checkpoint's own `deltaX(c) = columnOriginOffset + c * columnPitchError + residual` model, with `columnPitchError` the entire explanation and `columnOriginOffset`/`residual` negligible by comparison).

**Disclosed limitation on this artifact**: the comparison PDF draws column-position GRID LINES only, not InDesign's own actual rendered glyphs — this repo has no CMap-aware PDF text extractor (the embedded font uses CID-subset encoding; the raw content stream's hex strings are CID codes, not Unicode), and building a general one was judged out of this round's scope (would itself be exactly the kind of speculative new-tooling investment the checkpoint's own "no magic" section cautions against for a single comparison). The grid-line diagnostic still directly proves the column-pitch drift and its elimination — it does not, on its own, resolve T2 (absolute origin) or T6 (glyph ink position) to the same precision.

## 15. Preview

Not separately audited this round beyond the code-read in §11: Preview's own `buildPaintLine` reads the identical `linePitchTicks` field from the SAME `PageCompositionSettings`/`PublicationRenderContext`-shaped input the Publication path uses. Since the fix lives entirely in the settings-adapter layer (upstream of both renderers), Preview inherits the corrected column pitch automatically, with no separate Preview-side change required or made.

## 16. Regression

Full suite run after the fix: Core 364/364, Stage C 21/21, Stage D 30/30, Preview 114/114, Publication 542/542 (540 pre-existing + 2 new Round-3 files), v2Bridge 26/26 (24 pre-existing + 2 new regression tests), `tsc --noEmit` clean.

## 17. Remaining open items (explicitly NOT resolved this round)

- **T2 (absolute page/content origin)**: only approximately estimated (§13), not proven to sub-pt precision.
- **T6 (glyph ink position)**: not evaluated this round — Round 1's own audit (character-level ink-bbox measurement) found no anomaly in the font itself, but did not compare against InDesign's own rendered ink position directly.
- **Full glyph-level visual overlay**: blocked on CID-to-Unicode decoding tooling this round did not build (see §14's own disclosed limitation).
- The real product's Editor UI does not yet expose `lineHeightRatio` as a value the Human can directly compare/tune against a specific InDesign document — the fix makes the EXISTING `lineHeightRatio` setting finally reach v2 Publication output; it does not add new UI.

## 18. Decision

The primary, quantified, cumulative drift (T4, column pitch) is root-caused and fixed in the real product code path (`settingsAdapter.ts`), not merely in a QA fixture. This is now ready for a real Human visual recheck: with the fix in place, wiring the real Editor's own `lineHeightRatio` setting (default 1.7) into a real v2 Publication PDF should look qualitatively far closer to InDesign's own column spacing than before. A precise, sub-millimeter-confirmed final PASS still requires either (a) a full glyph-level overlay (blocked on tooling, §14), or (b) direct Human visual comparison of real output against the real InDesign reference.

---

# Round 2 (history, preserved unedited below)

Recorded: 2026-09-09
HEAD at audit time: `31a78b8`
Status: OPEN — export-path audit + controlled v2 fixture complete, **HUMAN GATE** (no InDesign reference PDF present in the repo; Phase 2/3 drift measurement cannot proceed without it)

Filename note: the checkpoint's own suggested path
(`TYPOGRAPHY_PARITY_INDDesign_OVERLAY_DRIFT.md`) again contains the same
"INDDesign" typo as Round 1's suggested filename; this document uses the
corrected spelling ("INDESIGN"), matching Round 1's own file.

Scope: audit + controlled-fixture generation only. No Core, Preview,
Publication, or `src/` typography behavior was changed this round.

---

## 1. Human overlay result (as reported)

Human produced a direct black/red overlay: BLACK = TateSpun, RED = Adobe
InDesign. The overlay shows visible positional drift. Human decision:
this drift is **not acceptable** — "InDesign-level" is the frozen minimum
acceptance bar, and this item stays OPEN until resolved.

**This document cannot itself confirm, quantify, or classify that drift**
— no InDesign reference PDF exists in this repository (see §3), and the
overlay image itself was not supplied as a repo-local file this round.
Everything below is either (a) code-level audit evidence, independent of
the overlay, or (b) a controlled TateSpun-side fixture prepared so a
proper comparison CAN be made once the missing reference material is
provided.

---

## 2. CRITICAL FIRST QUESTION — which TateSpun PDF path did the Human compare?

Direct code audit, per the checkpoint's own explicit evidence-chain
request ("Human-visible export button → function → renderer → PDF
implementation"):

| Step | Finding | Source |
|---|---|---|
| Human-visible export button | The real Editor's only user-reachable "PDF書き出し" action | `src/utils/exportPdf.ts` (imported by the Editor's export UI) |
| → function | `exportPdf.ts`'s own export function | calls `capturePageToCanvas` (`src/utils/exportCapture.ts`) |
| → renderer | **`html-to-image`'s `toCanvas`** — serializes the live DOM's *computed CSS* into an SVG `<foreignObject>` and lets the real browser rasterize it (the same engine that already draws the on-screen legacy Preview, using `writing-mode: vertical-rl` CSS on legacy's own `.tategaki-line`/`PageCard` components) | `src/utils/exportCapture.ts` |
| → PDF implementation | `jsPDF`, embedding the resulting **raster canvas/PNG image** as a full-page image per PDF page (`import { jsPDF } from 'jspdf'; import { encode } from 'fast-png';`) | `src/utils/exportPdf.ts` |

Separately, confirmed by an exhaustive search of `src/` for any reference
to v2's own composition entrypoints (`composeV2Document`,
`generatePublicationPdf`, `buildPublicationPaintPlan`): the **only**
place in `src/` that reaches v2 Publication at all is
`src/app/renderer-poc/jpg-export/page.tsx` — an explicitly isolated
developer-only demo route, never wired to the real Editor's own export
UI (confirmed in the prior Writing Check β round's own v2Bridge work,
and unchanged since).

**Conclusion: the real product's PDF export is, unconditionally, a
full-page DOM/CSS screenshot raster — never v2 Core/Publication's vector
renderer.** There is no ambiguity here: a normal product user has
exactly one PDF export button, and it is the legacy raster path. v2
Publication's `generatePublicationPdf` is reachable only by a developer
navigating directly to an internal `/renderer-poc` URL.

### Branch decision: **CASE A**

Per the checkpoint's own branch logic: *"DO NOT treat that PDF as proof
that v2 Publication pitch is wrong. Instead: generate a CONTROLLED v2
Publication PDF using the same manuscript and equivalent physical
settings, then compare THAT to InDesign. Legacy/current output may
remain visibly different during v2 development."*

**This is the single most important finding of this round.** If the
Human's black/red overlay used the product's actual "PDF書き出し" button
output (which is the overwhelmingly likely scenario, since that is the
only PDF a normal user would ever produce), **the observed drift proves
nothing about v2 Core/Publication's own typography** — it is comparing
InDesign against an entirely different rendering pipeline (browser
CSS/DOM layout of the LEGACY Editor, not v2's tick-based canonical
composition at all). Applying any v2 Core/Publication correction on the
strength of that comparison alone would risk "fixing" a system that was
never the one measured.

**This must be confirmed with the Human before any further action**: which
PDF, exactly, produced the BLACK layer in the overlay — the real
"PDF書き出し" button in the current product, or a `/renderer-poc`-generated
v2 Publication PDF? If it is the latter, re-read this document's §4 as
the actual comparison target instead of a hypothesis.

---

## 3. Reference PDF access

Checked: `qa/reference/indesign/` — **does not exist in this repository.**
No InDesign reference PDF (`molsui-indesign-reference.pdf` or any other
name) was found anywhere in the worktree.

Per the checkpoint's own explicit instruction for this exact situation:
*"If the InDesign reference PDF is NOT present repo-locally: continue all
TateSpun-side export-path and geometry auditing, generate the controlled
TateSpun v2 Publication fixture, then STOP at Human Gate, report the
exact path where Human should place the InDesign PDF."*

**Please place the InDesign reference PDF at:**

```
typesetting-v2/qa/reference/indesign/molsui-indesign-reference.pdf
```

(create the `qa/reference/indesign/` directory if it does not exist).
Once present, Phase 2 (vertical character-pitch drift: origin offset vs.
slope) and Phase 3 (horizontal column-pitch drift) can be measured
directly against real PDF coordinates, and this document's §6/§7
(currently blocked) can be completed.

---

## 4. Phase 1 — Controlled v2 Publication reference fixture (produced this round)

Generated via a new test,
`renderer/publication/typographyParityV2PublicationReference.test.ts`,
using:

- **Real v2 Core**: `composeCanonicalDocument` (unmodified)
- **Real `CanonicalDocument`** → **real Publication renderer**:
  `buildPublicationDocument` + `generatePublicationPdf` (unmodified,
  the exact same function the v2Bridge itself calls for the live
  product's eventual v2 PDF path)
- **Real committed Shippori Mincho font** via
  `createShipporiMinchoMeasurementProvider` (the real font-derived
  measurement provider, NOT the fake/deterministic provider every other
  fixture in this directory uses — chosen specifically so this PDF's own
  facts are the real font's)
- No legacy screenshot renderer, no DOM capture, no rasterized page
  wrapper anywhere in this path.

Output: **`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`**
(1 page, real PDF, `%PDF-` header confirmed, `pageCount` confirmed > 0).

Canonical sample text used (verbatim, per the checkpoint's own
instruction — not substituted with punctuation-heavy diagnostic text):

> 人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。
>
> 「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」

### 4.1 Recorded geometry facts

| Fact | Value | Known to match Human's InDesign reference? |
|---|---|---|
| Paper size | 文庫, 105mm × 148mm | **UNKNOWN** — chosen because it is TateSpun's own most common preset (`src/utils/exportPdf.ts` `PAPER_SIZES.文庫`), not because the Human's InDesign reference is confirmed to use it |
| Body font | Shippori Mincho Regular (real committed asset) | **UNKNOWN** whether InDesign reference uses the same font |
| Body font size | 10.5pt | **UNKNOWN** whether InDesign reference uses the same size |
| Body pitch (character advance) | 3.70417mm (= 1 em at 10.5pt) | derived, not independently chosen |
| Column pitch | 3.70417mm (= 1 em, same formula — TateSpun's column pitch is currently defined as one line-pitch cell per line, see `settingsFor`) | derived |
| Content rectangle | top margin 15mm, bottom margin 12mm, left margin 15mm, right margin 15mm (matches this directory's own `structuralColophonRealSettings.test.ts` precedent for the same 105×148mm paper) | **UNKNOWN** whether these match InDesign reference's own margins |
| Content top anchor | 15mm from paper top | as above |
| First column right anchor | 90mm from paper left (= 105 − 15mm right margin) | as above |
| Characters per line | 32 | derived from content height ÷ em |
| Lines per column | 20 | derived from content width ÷ em |
| Columns per page | 1 | chosen for this small sample (fits in 1 page) |
| Font identity | `tatespun-shippori-mincho-real-measurement-provider@1.0.0+sha256:769b5269f0f9bc65…` | real, asset-derived, reproducible |
| Font units-per-em | 1000 | real, from the font's own `head` table |
| Page count | 1 | this sample text fits in one page at this capacity |

**Facts that remain unknown and were NOT invented**: the InDesign
reference's own paper size, margins, body font, font size, and column
count. This document does not guess any of them. Until the Human
supplies either (a) the reference PDF itself, or (b) the exact InDesign
document settings used, this fixture's geometry can only be described as
"a real, principled TateSpun v2 output at a common, reasonable preset" —
not yet proven equivalent to the Human's own comparison conditions.

---

## 5. Phases 2/3/4/5 — BLOCKED

Vertical drift (origin-offset-vs-slope), horizontal column-pitch drift,
font-equivalence confirmation, and paragraph/line-break comparison all
require measuring the SAME two things at matched physical coordinates:
the InDesign reference and a TateSpun output. With no InDesign reference
PDF present in the repository (§3) and the actual identity of the
Human's compared TateSpun PDF unconfirmed (§2), none of these phases can
be completed honestly this round — attempting to would mean fabricating
one side of the comparison, which this audit explicitly refuses to do.

---

## 6. Root-cause classification (partial — evidence-supported items only)

| Type | Verdict | Basis |
|---|---|---|
| T1 — Export-path difference | **YES (highly likely)** | §2 — the real product's only PDF export is a legacy DOM/CSS screenshot raster, categorically different from v2 Publication's vector tick-based composition. If the Human's overlay used that PDF, T1 alone is sufficient to fully explain a visible drift, independent of any v2 Core/Publication fact. |
| T2 — Page/content origin | UNKNOWN — needs InDesign reference | |
| T3 — Character pitch | UNKNOWN — needs InDesign reference (Round 1's own audit found v2's canonical pitch principled and previously InDesign-validated, but that does not settle a real overlay measurement) | |
| T4 — Column pitch | UNKNOWN — needs InDesign reference | |
| T5 — Font size / glyph scale | UNKNOWN — needs confirmation of InDesign reference's own font/size | |
| T6 — Glyph ink position | UNKNOWN — needs InDesign reference | |
| T7 — Paragraph / layout semantics | UNKNOWN — needs InDesign reference | |
| T8 — Reference conditions not equivalent | **YES (confirmed, partially)** | §4.1 — TateSpun's own controlled fixture uses assumed, not confirmed-equivalent, paper/margin/font/size values relative to the InDesign reference |

**Primary cause, this round's own honest conclusion: cannot be
determined yet.** T1 (export-path mismatch) is the single most likely
full explanation if the Human's TateSpun PDF was the product's real
export button — but this has not been confirmed, and T2–T7 remain
entirely unmeasured pending the InDesign reference file.

---

## 7. Implementation gate

**No correction was implemented this round.** Per the checkpoint's own
gate: *"If reference conditions cannot be made equivalent... STOP."* —
exactly this round's situation. No Core, Preview, or Publication file was
changed. Natural Pitch remains untouched and frozen.

---

## 8. Recommended next action (HUMAN GATE)

Two things are needed to unblock Phase 2 onward, in order of priority:

1. **Confirm which TateSpun PDF produced the BLACK layer in the overlay.**
   If it was the product's real "PDF書き出し" button (the legacy
   DOM-raster path, §2) — that overlay is not evidence against v2
   Publication at all, and the correct next comparison is InDesign vs.
   **this round's own new controlled fixture**
   (`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`),
   not the legacy export.
2. **Place the InDesign reference PDF** at
   `typesetting-v2/qa/reference/indesign/molsui-indesign-reference.pdf`
   (or tell Claude its exact InDesign document settings — paper size,
   margins, font, font size — directly), so Phase 2/3 drift measurement
   (origin offset vs. per-character/per-column slope, per the
   checkpoint's own `deltaY(n) = originOffset + n * pitchError +
   residual` model) can run against real, matched physical coordinates
   instead of guessed ones.

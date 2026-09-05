# Research Archive — Publication Output Path (PDF/JPG) for Vertical Japanese

- Status: raw research output, archived verbatim from a Phase 1 research agent (2026-09-05)
- Method: WebSearch/WebFetch against primary sources (PDF/CMap technical notes, library issue trackers/docs, W3C Paged Media spec), confidence-tagged per finding
- Used by: `../../docs/architecture/PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`, `../../docs/architecture/PUBLICATION_OUTPUT_RESEARCH.md`

---

## 1. Does PDF support real vertical text runs, or is it always per-glyph rotation?

**SOURCE:** Adobe CMap Resources spec (Technical Note #5099), CIDFont spec (#5014); pdf.js issue [#12350](https://github.com/mozilla/pdf.js/issues/12350).

**EVIDENCE:** PDF's Type0 (composite) font model does define a real `/WMode` entry (H=0 or V=1) on a CMap, and `Identity-V` is a genuine, spec-defined predefined CMap — not an app convention. When WMode=1, the viewer is instructed to use the font's *vertical metrics* (`W2`/`DW2` arrays: per-glyph vertical displacement vectors) instead of horizontal advance widths, and text-showing operators (`Tj` etc.) advance the "pen" downward instead of rightward. This is a real primitive, not manual rotation — a compliant viewer natively lays out a `Tj` string vertically once WMode=1 is set. However, punctuation/small-kana glyphs still need viewer+font cooperation to pick the *vertical alternate glyph forms* (the `vert` GSUB feature or vertical-specific CID mappings) — pdf.js issue #12350 shows a real-world case where a viewer rendered `ー`/`ュ`/`、` with horizontal-form glyphs because it didn't correctly resolve vertical alternates, i.e., correctness depends on the font having vertical glyph variants and the generator selecting the right CIDs.

**CONCLUSION:** PDF/ISO 32000 does support a genuine vertical-writing-mode text primitive at the spec level (WMode, Identity-V, vertical metrics) — it's not merely "rotate each horizontal glyph 90°." But it only works correctly if (a) the embedded font actually contains vertical alternate glyphs/metrics and (b) the CID mapping selects them — a nontrivial dependency, evidenced by real bugs in mature PDF renderers.

**Confidence: High** (spec claims), **Medium** (how reliably it round-trips through real fonts/viewers).

## 2. CJK font embedding as Type0/CID with ToUnicode — do pdf-lib/PDFKit actually support it?

**SOURCE:** pdf-lib GitHub issues [#1232](https://github.com/Hopding/pdf-lib/issues/1232), [#1429](https://github.com/Hopding/pdf-lib/issues/1429), [#664](https://github.com/Hopding/pdf-lib/issues/664); PDFKit issues [#1106](https://github.com/foliojs/pdfkit/issues/1106), [#908](https://github.com/foliojs/pdfkit/issues/908), [#402](https://github.com/foliojs/pdfkit/issues/402), [#472](https://github.com/foliojs/pdfkit/issues/472).

**EVIDENCE:** Both libraries *can* embed a CJK OTF/TTF and subset it (pdf-lib uses fontkit for subsetting; a full Noto CJK font is 15–20MB, subset embedding used to only ship the glyphs referenced, is the documented mitigation). But this is a known fragile area, not a solid feature: pdf-lib #1232 — subset:true drops/breaks some Japanese glyphs; #1429 — embedded CJK glyphs render invisible in Chrome's PDF viewer for certain fonts; PDFKit #1106/#908 — some Noto CJK OTF glyphs fail to render at all (TTF works, OTF/CFF-outline doesn't for some fonts); #402/#472 — CJK glyphs vanish depending on adjacent characters/string length (subsetting/CID-mapping bugs). Neither library's docs mention WMode/vertical CID metrics at all — confirmed directly from pdfkit.org/docs/text.html and pdf-lib.js.org/docs/api/, neither of which references CJK vertical layout, WMode, or Identity-V.

**CONCLUSION:** CJK embedding is possible in principle but is a genuinely under-tested, bug-prone corner of both libraries (open issues going back years, some still open), and vertical writing mode is entirely unsupported/unexposed — you'd be hand-writing raw PDF operators and CMap dictionaries yourself, not calling a library feature.

**Confidence: High.**

## 3. Would achieving vector vertical text require per-glyph absolute positioning driven externally?

**SOURCE:** PDFKit issue [#971](https://github.com/foliojs/pdfkit/issues/971); general findings above; jsPDF issue trawl.

**EVIDENCE:** PDFKit #971 (opened 2019, "Does PDFKit support vertical writing mode?") — the reporter tried the `vert` OpenType feature (which only swaps glyph *shapes*, e.g. for parens/brackets) and found rotation/positioning is not solved by that alone; no maintainer response indicates a built-in solution exists. Across pdf-lib, PDFKit, and jsPDF, none expose a "lay out this CJK vertical paragraph" API — the only primitives are `drawText`/`text` at an x/y with a rotation angle, or raw low-level operator access (pdf-lib's `pushOperators`). Getting correct vertical CJK output from any of them today means the calling code computes every glyph's position (its own layout engine) and either (a) emits individual rotated horizontal glyphs via each library's per-character `drawText` calls, or (b) drops to raw PDF content-stream operators to set WMode/Identity-V/vertical metrics by hand.

**CONCLUSION:** Confirmed — no JS library offers a higher-level "vertical CJK paragraph" API. Any vector-text approach requires an external layout engine driving per-glyph placement, structurally identical in spirit to today's FixedSlot model, just at the PDF-operator layer instead of the DOM layer.

**Confidence: High.**

## 4. What is Vivliostyle, and is it "Family A refined" rather than a distinct approach?

**SOURCE:** Vivliostyle GitHub/docs; vivliostyle-cli issue [#97](https://github.com/vivliostyle/vivliostyle-cli/issues/97); DeepWiki browser-automation page.

**EVIDENCE:** Vivliostyle is an open-source CSS Paged Media / EPUB-to-print typesetting engine. Its CLI/toolchain (per issue #97 and its architecture docs) drives **Puppeteer controlling actual Chrome/Chromium**, and generates the PDF via **Chromium's own Skia/PDF backend** — i.e., it is fundamentally "load HTML/CSS into a real browser engine, apply CSS Paged Media pagination logic (mostly in JS on top of the DOM), then ask the browser to print." It does support `writing-mode: vertical-rl` since that's native Chromium CSS.

**CONCLUSION:** This confirms the hypothesis directly: Vivliostyle is not a distinct "direct PDF drawing" family — it's DOM/CSS rendering (Family A) with proper CSS Paged Media pagination bolted on top, printed through a browser's own PDF export. Whatever selectable-text quality you get is inherited from Chromium's `print-to-pdf`/Skia-PDF pipeline, not from Vivliostyle itself writing PDF operators. **This matches TateSpun's own existing internal, non-production research spike (`PreviewPaneNew.tsx` / `renderer-poc/p1Adapter.ts`) which already bridges to a Vivliostyle viewer — i.e., this data point was already partially explored internally before Phase 1 began.**

**Confidence: High.**

## 5. Physical-unit reproducibility of browser print-to-PDF vs. html-to-image screenshot

**SOURCE:** puppeteer issues [#666](https://github.com/puppeteer/puppeteer/issues/666), [#2278](https://github.com/puppeteer/puppeteer/issues/2278); MDN devicePixelRatio.

**EVIDENCE:** Browser/Chromium print-to-PDF maps CSS length units directly to PDF points (1 CSS px = 1/96in → 72pt conversion), and this mapping is defined in **logical CSS pixels**, independent of `devicePixelRatio` — a retina (dPR=2) and a standard display produce the same physical PDF page size, because CSS units never touch devicePixelRatio in the first place. This is structurally different from the current html-to-image approach, which screenshots the rendered DOM into a raster **canvas** at some pixel resolution (typically scaled by devicePixelRatio or a fixed scale factor) and then that raster image is placed into the PDF — meaning physical fidelity depends on choosing a high enough capture DPI/scale and on jsPDF's raster placement math, not on a native unit system. That said, headless Chrome print-to-pdf has its own known rounding/margin bugs (puppeteer #2278: page dimensions off by ~1-2mm in some configurations), so "guaranteed accuracy" is not absolute — just a different, generally more robust failure mode than raster screenshotting.

**CONCLUSION:** Print-to-PDF is unit-driven and DPI/pixel-density-independent by design (a real advantage over screenshot rasterization), but it isn't bug-free — known sub-mm rounding discrepancies exist and would need verification against TateSpun's tight trim-size requirements.

**Confidence: Medium-High.**

## 6. DeviceGray support for vector content

**SOURCE:** pdf-lib.js.org API docs (`colors.ts`); pdfkit.org/docs/text.html, vector.html.

**EVIDENCE:** pdf-lib exposes a first-class `grayscale(gray: number)` color constructor (`Color = Grayscale | RGB | CMYK`), used directly with `setFillingColor`/`setStrokingColor`/`drawText`'s `color` option — this maps straightforwardly to PDF's `DeviceGray` colorspace on vector/text content, not just images. PDFKit's docs confirm its fill/stroke color methods apply equally to text as to vector graphics, and its color API accepts a single grayscale value.

**CONCLUSION:** Both libraries support true vector DeviceGray output for real text/paths, not merely raster grayscale conversion of images. This requirement is not a blocker for either library.

**Confidence: High.**

## 7. File size: vector-text vs. raster-per-page for CJK-heavy documents

**SOURCE:** Aggregated blog/industry commentary (kamy.dev — blog, lower confidence; general PDF-optimization sources).

**EVIDENCE:** No rigorous documented benchmark was found comparing a full novel-length raster-PDF vs. vector-text-PDF specifically. Directionally: full CJK fonts run 15–20MB, but subsetting (embedding only glyphs actually used) is standard practice and shrinks this dramatically — commentary suggests subsets covering a few hundred to a few thousand unique CJK characters land around 100KB–low-MB, not tens of MB. A raster PDF stores one full-page image per page; for a novel-length manuscript (hundreds of pages) at print-quality DPI, raster pages likely dominate file size heavily, since each page is an independent bitmap with no cross-page glyph reuse, whereas a subset CJK font is embedded once for the whole document and reused by every page's vector text.

**CONCLUSION:** Directionally, vector text + one subset font should beat per-page raster for a long document, but I found no primary/authoritative side-by-side measurement — this claim rests on generic PDF-optimization blog material, not a controlled comparison.

**Confidence: Low** (claim is plausible but evidentially thin — flagged per instructions).

## 8. Trim marks / bleed (トンボ): library support vs. hand-drawing

**SOURCE:** W3C CSS Paged Media Module Level 3 (`https://www.w3.org/TR/css-page-3/`); DocRaptor printer's-marks tutorial; WeasyPrint issue #1446.

**EVIDENCE:** `marks: crop cross` and `bleed` are real, standardized CSS properties (CSS Paged Media Level 3, still Working Draft status) implemented by dedicated print-formatters like Prince and used via services like DocRaptor and — per Antenna House's own docs — Antenna House Formatter. However, mainstream browsers (Chrome/Chromium, and by extension Vivliostyle's Puppeteer-driven pipeline) do **not** implement `marks`/`bleed` in their print-to-PDF path — these are Paged Media Level 3 features chiefly supported by specialized "formatter" engines, not general browser engines. pdf-lib and PDFKit, being low-level PDF-construction libraries, have no built-in trim-mark concept at all — you draw hairlines yourself with their vector-drawing primitives, exactly as current TateSpun does with jsPDF today.

**CONCLUSION:** Hand-drawing トンボ (as TateSpun already does) remains the normal, expected approach for any of the JS options investigated (pdf-lib, PDFKit, jsPDF, and even a Chromium/Vivliostyle-based pipeline) — only commercial CSS formatters (Prince, Antenna House) get this "for free" via `marks`/`bleed` CSS, and none of those is a JS-embeddable open library.

**Confidence: High** for pdf-lib/PDFKit/jsPDF lacking it; **Medium** for Vivliostyle/Chromium's exact `marks`/`bleed` support status (not independently verified against current Chromium source).

## 9. JPG output from a vector-based renderer

**SOURCE:** Common PDF.js-based tooling patterns (freeCodeCamp, usefulangle.com, multiple dev.to guides — all describe the same standard pattern).

**EVIDENCE:** The well-established pattern for "vector PDF page → raster image" is: render the PDF page via pdf.js (or a PDF rasterizer like pdfium) into an offscreen `<canvas>` at a chosen scale/DPI, then call `canvas.toDataURL('image/jpeg', quality)` or `toBlob`. This is a standard, widely-documented pipeline (PDF→canvas is exactly what pdf.js's own viewer does for on-screen display), not a novel approach. This differs fundamentally from the current approach (screenshotting a *live DOM*) — instead it's "take the already-finalized vector page description and rasterize it at whatever DPI you want," which decouples JPG quality/DPI entirely from screen pixel density and is inherently more controllable and reproducible.

**CONCLUSION:** If TateSpun's Publication renderer produces vector PDF pages (via pdf-lib/PDFKit/raw-operator layer, or via a Chromium/Vivliostyle print-to-pdf step), producing matching JPGs is a solved, well-trodden problem — render the PDF back through pdf.js (or a native rasterizer) to canvas at controlled DPI. This is strictly better-established than the current live-DOM-screenshot approach and would give one shared source of truth (the PDF) for both PDF and JPG outputs, instead of two divergent code paths.

**Confidence: High.**

---

## Overall Verdict

A fully vector-text, selectable, properly-embedded-CJK PDF for **vertical** Japanese is **not a solved, off-the-shelf capability** in any JS PDF library surveyed (pdf-lib, PDFKit, jsPDF). The PDF spec itself genuinely supports vertical writing mode (WMode/Identity-V/vertical metrics — item 1), and CJK font embedding with ToUnicode is *possible* in pdf-lib/PDFKit, but:

- None of the three libraries expose vertical CJK layout as an API — it's an acknowledged gap even in their own issue trackers (PDFKit #971 sat with no resolution; explicit statements found that "most high-level PDF libraries don't expose" the `/V` writing mode).
- CJK font embedding itself is a known bug-prone area in both pdf-lib and PDFKit (glyphs vanishing, subset corruption, OTF-specific failures) — multi-year-old open issues, not a solid foundation.
- Vivliostyle is not a shortcut around this: it is Chromium's own `writing-mode: vertical-rl` + Chromium's Skia/PDF print pipeline under the hood ("Family A refined," not a distinct direct-drawing family) — it inherits whatever vertical-text PDF quality/selectability Chromium's print-to-PDF actually delivers, which was not independently confirmed as bulletproof (real vertical-CJK PDF rendering bugs exist even in mature renderers like pdf.js).

This leaves two realistic paths, matching the framing in the prompt:

**(a) Raster PDF as the pragmatic near-term answer** — continue embedding a raster page image, but ideally generated via a controlled, DPI-independent renderer (browser print-to-PDF or pdf.js-style canvas rasterization) rather than an ad hoc DOM screenshot, addressing items 5/9 without solving selectability.

**(b) A significant custom layer** if selectable vector text is a hard requirement: either (b1) drive Chromium's native `vertical-rl` + print-to-pdf and empirically verify text selectability/glyph-correctness for real Shippori-Mincho-class fonts (cheapest to prototype, since Vivliostyle already exists as an internal spike), or (b2) hand-build a PDF content-stream layer on pdf-lib's low-level operator API that sets WMode/Identity-V and positions/selects each CID glyph directly from TateSpun's own layout engine — architecturally the same per-character positioning discipline as FixedSlot today, just moved from DOM/CSS into PDF operators, with materially higher implementation and QA cost than either raster or (b1).

Given the existing internal Vivliostyle spike, path (b1) is the lowest-cost next experiment: it doesn't require solving CJK Type0/WMode by hand, but its real-world vertical-text selectability/correctness for this project's specific fonts and layout rules would need direct empirical verification before Phase 1 could recommend it — the evidence gathered here is suggestive, not conclusive, on that specific point.

# Phase 1 — Publication Output Path Research (PDF/JPG)

- Status: Phase 1 draft, pending Human Review — no library/technology selected
- Source authority: Master §1.1, §20.6 boundary ("Previewを画像化してPDFへ入れる以外の方式を必ず調査する"), Freeze §2
- Evidence base: `../../research/pdf/publication-output-path-research.md` (full SOURCE/EVIDENCE/CONCLUSION detail)

## 1. The question this had to answer

Current production generates PDF by screenshotting the live Preview DOM (html-to-image) into a raster canvas, converting to grayscale PNG, and embedding that image into a PDF via jsPDF. Master explicitly requires investigating alternatives to this "screenshot the Preview into the PDF" pattern before Engine v2 accepts or rejects it as adequate.

## 2. Finding: no off-the-shelf vector/selectable vertical-CJK PDF path exists

Across pdf-lib, PDFKit, and jsPDF — the realistic JS PDF library candidates — **none expose vertical CJK text layout as an API**. This is confirmed directly from an open, unresolved PDFKit issue (#971, filed 2019, asking exactly this question) and from the absence of any WMode/Identity-V mention in either library's official docs. The PDF spec itself *does* define a genuine vertical-writing-mode primitive (Type0/CID fonts, `/WMode`, `Identity-V`, per-glyph vertical metrics) — this is not a spec gap, it's a library-support gap. See publication-output-path-research.md items 1–3.

CJK font embedding itself (necessary for any vector-text approach, and useful even for a raster approach's font-subsetting concerns) is a documented, currently-active source of bugs in both pdf-lib and PDFKit — glyphs vanishing, subset corruption, OTF-vs-TTF inconsistency (item 2, multiple linked issues spanning several years).

## 3. Finding: Vivliostyle is not a shortcut — it's Chromium's own pipeline

Vivliostyle (the existing internal, non-production research spike already present in this codebase, `PreviewPaneNew.tsx`/`renderer-poc/p1Adapter.ts`) drives a real headless Chromium instance via Puppeteer and produces PDF via Chromium's own Skia/PDF print backend. Architecturally this is "Family A refined" (DOM/CSS + proper CSS Paged Media pagination), not a distinct direct-drawing approach — whatever vertical-text PDF quality it delivers is inherited entirely from Chromium's print-to-PDF pipeline, which was not independently verified in this research pass for real-world vertical-CJK glyph/selectability correctness (item 4).

## 4. Two realistic paths forward (neither selected here)

**(b1) Browser/Chromium print-to-PDF (Vivliostyle-style).** Lower engineering cost — an internal spike already exists. Real, documented advantage over today's html-to-image approach: CSS-px-to-PDF-pt mapping is independent of screen device-pixel-ratio (item 5), which is a structural improvement in physical-unit reproducibility even before considering vector text. Known risk: whether Chromium's print-to-PDF actually produces *selectable* text for vertical Japanese with TateSpun's specific fonts (Shippori Mincho etc.) was not empirically tested in this research pass — flagged explicitly as needing a hands-on experiment, not assumed.

**(b2) Hand-built PDF-operator layer.** Highest ceiling — a custom layout/shaping engine (Family D, per the Architecture Research Matrix) computes exact glyph positions, and a thin layer emits raw PDF content-stream operators (setting WMode/Identity-V, embedding a CID font, positioning each glyph) directly, bypassing any high-level library's missing vertical-CJK API. This gives full determinism and true selectable/searchable vector text, at materially higher build and QA cost than (b1), structurally similar in spirit to what FixedSlot already does at the DOM layer — just relocated to the PDF-operator layer.

## 5. JPG output: a solved problem regardless of which PDF path is chosen

Whichever Publication path is chosen, generating a matching JPG is comparatively easy and well-precedented: render the finalized page (the PDF itself via pdf.js/pdfium, or the Canonical Layout Model directly) to an offscreen canvas at a controlled DPI, independent of screen pixel density (item 9). This is a genuine improvement over today's approach, which screenshots a *live* DOM and is therefore coupled to whatever the screen happened to be rendering. Both PDF and JPG could share one source of truth (the finalized layout) instead of two separately-maintained export code paths.

## 6. Trim marks / bleed (トンボ)

No library or pipeline investigated (including a Vivliostyle/Chromium path) implements CSS Paged Media's `marks`/`bleed` properties — those exist only in specialized commercial formatters (Prince, Antenna House), not in browsers or any JS PDF library (item 8). Hand-drawing トンボ, as TateSpun already does, remains the expected approach under any candidate path.

## 7. Grayscale / DeviceGray

Not a blocker under either path — both pdf-lib and PDFKit support true vector DeviceGray output for text/paths directly (item 6), not merely raster grayscale conversion, so this requirement carries forward cleanly regardless of which path is chosen.

## 8. What Phase 1 concludes, and what it explicitly does not

**Concludes:** the current raster/screenshot approach is not the only option, and at least one lower-cost near-term improvement exists (print-to-PDF's unit-independence, item 5) even without solving vector/selectable text; a genuinely vector, selectable PDF is achievable but requires either accepting an unverified dependency on Chromium's own vertical-CJK PDF quality (b1) or building a custom PDF-operator layer (b2) — this mirrors, rather than resolves, the general finding in the Architecture Research Matrix that a custom logical layer is unavoidable somewhere in the pipeline.

**Does not conclude:** which of (b1)/(b2) TateSpun should build, whether pdf-lib or PDFKit is the better low-level library if (b2) is chosen, or whether raster PDF should simply be kept for a v2.0 release with vector text deferred. These are Phase 2 PoC questions — Phase 2 should specifically include an empirical test of (b1)'s vertical-CJK PDF selectability with TateSpun's actual fonts, since that is the single most Phase-2-actionable unresolved question this research surfaced.

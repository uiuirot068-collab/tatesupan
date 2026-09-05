# Research Archive — Family B (Canvas) vs Family D (HarfBuzz/WASM + Custom Layout)

- Status: raw research output, archived verbatim from a Phase 1 research agent (2026-09-05)
- Method: WebSearch/WebFetch against primary sources (WHATWG spec, MDN, bug trackers, HarfBuzz manual, OpenType spec, library repos/READMEs), confidence-tagged per finding
- Used by: `../../docs/architecture/PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`, `../../docs/architecture/JAPANESE_SHAPING_RESEARCH.md`

---

## 1. Canvas 2D native vertical writing mode

**SOURCE:** WHATWG HTML Living Standard, §4.12.5 "The canvas element" (https://html.spec.whatwg.org/multipage/canvas.html); MDN `CanvasRenderingContext2D.direction` (https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/direction); Mozilla Bugzilla #902799 "support vertical text in canvas text drawing methods" (open feature request).

**EVIDENCE:** The spec's `direction` IDL attribute only enumerates `"ltr"`, `"rtl"`, `"inherit"` — no vertical value exists. The spec text contains no reference to CSS `writing-mode`, `text-orientation`, or top-to-bottom text layout anywhere in the canvas text-rendering algorithms. Bug 902799 (requesting vertical text support in canvas) has been open since 2013 with no shipped resolution.

**CONCLUSION:** Canvas 2D has **no native vertical writing mode**, then or now. `fillText`/`measureText` are fundamentally horizontal-line APIs regardless of the CSS `writing-mode` on the surrounding page. Any vertical layout on Canvas must be built by the application (rotating/positioning individual horizontal glyph draws).

**CONFIDENCE:** HIGH (primary spec + primary bug tracker).

## 2. Canvas `measureText`/`TextMetrics` precision

**SOURCE:** MDN `TextMetrics` (https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics); Mozilla Bugzilla #1646926 and #1692791 (sign/value bugs in `actualBoundingBox*`); Igalia explainer `canvas-formatted-text/text-metrics-additions.md` (https://github.com/Igalia/explainers).

**EVIDENCE:** `TextMetrics` does expose `actualBoundingBoxLeft/Right/Ascent/Descent` (real glyph ink box) distinct from the `fontBoundingBox*` (font design metrics), and these are `double`-precision CSS pixels. But per the spec note, these values "depend on how the host rasterized those glyphs" — i.e., they are not guaranteed cross-browser/cross-platform identical, and real bugs exist (wrong sign, wrong values for color glyphs). The Igalia explainer, filed specifically because of gaps, states caret/selection positioning and per-grapheme control are "missing from canvas text metrics and must be implemented today using javascript," and argues `measureText` should but currently does *not* give DOM-equivalent, editor-grade precision.

**CONCLUSION:** Canvas metrics are more granular than nothing, but not a reliable ground truth for deterministic FixedSlot-style placement — they are rasterizer-dependent and the platform's own standards body (via Igalia) is actively proposing new APIs because today's Canvas text metrics are considered insufficient for exactly this class of tool (structured text editors/typesetting). A production engine would not want to depend on `measureText` output varying by OS font rasterizer.

**CONFIDENCE:** HIGH for "insufficient/host-dependent" claim (spec + explainer + bug reports); MEDIUM on exact numeric error magnitude (not independently benchmarked here).

## 3. Canvas as "dumb glyph painter" pattern

**SOURCE:** koharu.rs explainer "Text Rendering and Vertical CJK Layout" (https://koharu.rs/explanation/text-rendering-and-vertical-cjk-layout/); W3C blog 2008 "Vertical Layouts for Canvas Text (CJK)" (https://www.w3.org/blog/2008/canvas-text-and-cjk/).

**EVIDENCE:** Koharu's documented architecture explicitly converts vertical writing mode into a top-to-bottom **shaping direction before HarfBuzz runs**, so HarfBuzz (not the browser) produces vertical advances and rotated glyph forms; the rendering surface then just paints the shaped output. This is precisely the "Canvas/paint-surface as dumb output, external engine does layout" pattern. The W3C 2008 post is a historical acknowledgment that CJK vertical canvas text needed special-casing even at Canvas's inception.

**CONCLUSION:** Yes — the realistic (and only real-world-documented) architecture for Canvas + vertical CJK is: an external shaper/layout engine computes per-glyph position/rotation/advance, Canvas (or WebGL/other paint surface) just draws each glyph outline or pre-shaped run at those coordinates. This is not Canvas-specific — it's the same requirement DOM/FixedSlot already satisfies; Canvas doesn't remove the need for a custom layout engine, it just changes the paint target.

**CONFIDENCE:** MEDIUM — koharu.rs is a smaller/specialized project's own docs, not a large ecosystem standard, but it is the clearest documented real instance found of exactly this pattern for vertical CJK.

## 4. Canvas + WASM font parser bypassing browser shaper

**SOURCE:** harfbuzz/harfbuzzjs GitHub repo and docs (https://github.com/harfbuzz/harfbuzzjs, https://harfbuzz.github.io/harfbuzzjs/); rsms/fontkit GitHub (https://github.com/rsms/fontkit).

**EVIDENCE:** harfbuzzjs is literally HarfBuzz compiled to WASM with a JS wrapper exposing `getGlyphInfos()`/`getGlyphPositions()` — glyph IDs and x/y advances computed entirely independent of the browser's own text engine. Separately, rsms/fontkit's README states it is "a JavaScript/WebAssembly library for working with fonts, backed by industry-strength Freetype and Harfbuzz" — i.e., glyph outline rendering (FreeType) and shaping (HarfBuzz) both happen inside WASM, sidestepping the browser's native font stack entirely. Canvas would then only receive already-computed glyph paths/positions to paint (via `Path2D` from outline data, or `putImageData`/WebGL from a rasterizer).

**CONCLUSION:** Yes — this is technically proven and already exists as shipping libraries: WASM font engines can fully bypass the browser's native (and inconsistent) text/vertical shaping, giving the application full control of glyph advance/positioning independent of browser quirks. This is the same integration point Family D's HarfBuzz approach would use; Canvas doesn't need it, but could consume it as a painter.

**CONFIDENCE:** HIGH (primary repo descriptions).

## 5. harfbuzzjs vertical shaping surface

**SOURCE:** HarfBuzz Manual, "OpenType features" (https://harfbuzz.github.io/shaping-opentype-features.html); harfbuzz/harfbuzzjs README/docs.

**EVIDENCE:** HarfBuzz Manual states explicitly: "If the text direction is vertical, HarfBuzz applies the `vert` feature by default." This confirms `vert` (and, per general HarfBuzz behavior for CJK, `vrt2` where present as it takes priority) is applied automatically when `hb_direction_t` is set to `HB_DIRECTION_TTB`. harfbuzzjs's JS wrapper exposes `getGlyphInfos()`/`getGlyphPositions()` post-shaping, with position data documented as x-advances for horizontal and **y-advances for vertical** direction — i.e., the wrapper does surface vertical-shaped output, not just horizontal. However, the specific mention of `vpal`/`vkrn` being explicitly documented in harfbuzzjs's own (thin) docs was **not found** — only the core HarfBuzz manual's general feature docs cover them, and harfbuzzjs itself doesn't add commentary beyond exposing whatever the compiled HarfBuzz core does.

**CONCLUSION:** harfbuzzjs surfaces vertical shaping because it's a thin binding over full HarfBuzz — `vert`/`vrt2` are applied automatically by the core engine when direction is set to TTB, and `vpal`/`vkrn` (being ordinary GPOS/GSUB features) are handled the same way any other applicable OpenType feature is, per HarfBuzz's standard feature-application logic. This is inherited capability, not something harfbuzzjs's JS layer had to build — but also not something its own docs explicitly narrate feature-by-feature.

**CONFIDENCE:** MEDIUM-HIGH — the `vert` claim is directly sourced from the HarfBuzz manual; the `vpal`/`vkrn` automatic-application claim is inferred from HarfBuzz's general shaping model rather than a line explicitly naming those two features in a vertical context.

## 6. opentype.js / fontkit: parsers vs shapers

**SOURCE:** OpenType spec `vhea`/`vmtx` (https://learn.microsoft.com/en-us/typography/opentype/spec/vmtx, /vhea); opentype.js GitHub README (https://github.com/opentypejs/opentype.js); foliojs/fontkit README (https://github.com/foliojs/fontkit); rsms/fontkit README (https://github.com/rsms/fontkit).

**EVIDENCE:** opentype.js's own README describes it as a library to parse fonts and get bézier paths for text, with only `liga`/`rlig` ligature features and kern/GPOS-kerning explicitly documented — no mention of full GSUB/GPOS feature application, complex-script reordering, or `vhea`/`vmtx` support. **foliojs/fontkit** (the original, widely-used JS fontkit) explicitly documents "Advanced OpenType features including glyph substitution (GSUB) and positioning (GPOS)" plus `font.layout()` for "OpenType shaping" — so it is more than a pure parser, doing real GSUB/GPOS application, though its README does not explicitly mention `vhea`/`vmtx` vertical tables. **rsms/fontkit** is a distinct, newer project literally wrapping FreeType + HarfBuzz in WASM — meaning it is effectively a full shaper (delegating to real HarfBuzz), not a from-scratch JS implementation.

**CONCLUSION:** This distinction matters architecturally: opentype.js is best treated as a metrics/outline parser plus limited ligature/kerning, requiring the application to write its own shaping/layout logic on top. foliojs/fontkit does real OpenType shaping (GSUB/GPOS) in pure JS, closer to a lightweight shaper, but vertical-table (`vhea`/`vmtx`) support is not confirmed in its docs and would need direct code/source verification before relying on it. rsms/fontkit is architecturally in Family D territory already (it *is* HarfBuzz+FreeType via WASM), not a separate "metrics-only" option.

**CONFIDENCE:** MEDIUM — README-level claims, not verified against source code for `vhea`/`vmtx` presence; recommend a follow-up code-level check before committing to either fontkit variant.

## 7. HarfBuzz-via-WASM client-side feasibility

**SOURCE:** behdad.org "State of Text Rendering 2024" (https://behdad.org/text2024/, blog of HarfBuzz's own maintainer); harfbuzz/harfbuzzjs README (mentions `-DHB_TINY` build).

**EVIDENCE:** The maintainer's own write-up states: "Using HarfBuzz on the web has been on the rise, first transpiled to JavaScript, and more recently cross-compiled to WebAssembly, through harfbuzzjs," and names Photopea, Figma, and Prezi as web apps using HarfBuzz in production, plus developer tools Crowbar and Sploot built entirely as WASM/HarfBuzz web apps. harfbuzzjs's own README confirms it ships a stripped `-DHB_TINY` build specifically to minimize footprint for embedding.

**CONCLUSION:** Client-side production use of harfbuzzjs is real and documented, not merely theoretical — feasible for an interactive editor. Exact KB size of the compiled `.wasm` was **not found** in the docs fetched (README doesn't state a number), so bundle-size due diligence should still measure the actual artifact before committing.

**CONFIDENCE:** MEDIUM — the "who uses it" claim comes from a single (though highly authoritative — project maintainer) blog post; flagged as lower-confidence per instructions since it is blog-sourced, despite the author's authority. No independent confirmation from Figma/Photopea/Prezi's own engineering sources was found in this pass.

## 8. UAX #14 vs. Japanese kinsoku completeness

**SOURCE:** UAX #14 (https://unicode.org/reports/tr14/tr14-51.html); W3C jlreq (https://w3c.github.io/jlreq/); JIS X 4051 (referenced within UAX #14 and jlreq).

**EVIDENCE:** UAX #14 itself acknowledges tailoring is expected/required: e.g., its CJ (Conditional Japanese Starter) class is explicitly defined as ambiguous — "Characters of this class may be treated as either NS or ID" — and the spec notes treating CJ as NS gives "CSS strict" line breaking while ID gives "CSS normal," meaning UAX #14 alone under-determines Japanese behavior without an external policy choice. UAX #14 also references JIS X 4051 directly, noting JIS X 4051 uses table-based classes not fully congruent with UAX #14's own property values, sometimes needing "heuristic analysis or markup." jlreq (W3C Note) is the document that spells out the fuller, publishing-industry-grade Japanese requirements (hanging punctuation placement, ruby, TCY, precise kinsoku exception handling) beyond generic Unicode line-breaking classes.

**CONCLUSION:** UAX #14 is necessary but explicitly insufficient by itself for production-grade Japanese kinsoku — it is a general Unicode algorithm with acknowledged ambiguity points designed to be *tailored*; real Japanese kinsoku (as codified in JIS X 4051 and elaborated in jlreq) requires additional Japan-specific rule layers on top, which is exactly what current TateSpun's FixedSlot hand-written logic already encodes. This confirms Family D still needs a custom kinsoku/jlreq rule layer regardless of shaping engine choice — HarfBuzz does not supply Japanese line-breaking logic at all (it's a shaper, not a line-breaker).

**CONFIDENCE:** HIGH (primary UAX #14 text + W3C jlreq is itself a primary standards document).

## 9. Licensing

**SOURCE:** opentype.js LICENSE file (https://github.com/opentypejs/opentype.js — MIT, copyright Frederik De Bleser, confirmed by direct fetch); foliojs/fontkit README ("License: MIT", confirmed via GitHub); rsms/fontkit repo (MIT license file referenced); harfbuzz/harfbuzzjs (MIT, HarfBuzz core itself is also MIT).

**EVIDENCE:** All four projects checked (opentype.js, foliojs/fontkit, rsms/fontkit, harfbuzzjs) are MIT-licensed based on direct or README-level confirmation. Direct LICENSE-file fetch succeeded for opentype.js; fontkit's LICENSE raw file 404'd but its README's own "License: MIT" section was directly read.

**CONCLUSION:** No licensing blocker for commercial use in any of these four libraries.

**CONFIDENCE:** HIGH for opentype.js (raw LICENSE file read directly) and harfbuzzjs (MIT is well-documented/widely known for HarfBuzz core); MEDIUM for both fontkit variants (README claim, not raw LICENSE file content, due to a 404 on the direct fetch — worth a quick direct repo check before shipping).

## 10. What's free vs. hand-built (Family D)

**SOURCE:** Synthesis of items 5–8 above (HarfBuzz Manual, UAX #14, jlreq, harfbuzzjs/fontkit docs).

**EVIDENCE/CONCLUSION:** Free from HarfBuzz: OpenType GSUB/GPOS application (`vert`/`vrt2`/`vpal`/`vkrn`, ligatures, kerning), producing correct per-glyph vertical advances/positions/rotated glyph IDs for a run. Free from opentype.js/fontkit: font parsing, glyph outline extraction (bézier/SVG paths), `hhea`/`hmtx` (and vhea/vmtx where supported) metrics. **Not free from any of these libraries, still requiring hand-built logic**: (a) Unicode-to-jlreq-grade Japanese line breaking/kinsoku (UAX #14 is only a starting point per item 8); (b) hanging punctuation (ぶら下げ) placement logic; (c) ruby (振り仮名) layout and its interaction with line breaking/kinsoku; (d) TCY (縦中横) run detection and layout; (e) dash/ellipsis run continuity logic (the exact FixedSlot concerns named in the prompt); (f) page/column-level line-breaking decisions (where lines break given the above), which is a distinct problem from character shaping; (g) gluing kinsoku decisions to glyph-level shaping output (HarfBuzz shapes a run you hand it — it does not decide where lines break). None of the researched libraries (HarfBuzz, opentype.js, fontkit) claim to solve Japanese line-breaking/kinsoku/ruby/TCY layout — these remain fully custom regardless of shaping engine.

**CONFIDENCE:** HIGH (directly follows from items 5, 6, 8's documented scopes).

---

## Overall verdict

**(a) Canvas's native advantage:** None found. Canvas 2D has no native vertical writing mode (item 1) and its own metrics are host-rasterizer-dependent and explicitly flagged by the platform's own standards contributors (Igalia) as insufficient for structured/editable text tooling (item 2). The only real documented CJK-vertical Canvas architecture (koharu) still shapes text externally (via HarfBuzz) and uses Canvas purely as a paint surface for pre-computed glyph positions (item 3) — identical in spirit to what FixedSlot already does with DOM spans. Canvas does not remove the "we must build custom vertical Japanese layout logic" requirement; it only relocates the paint target from `<span>` elements to pixels/paths, trading DOM's built-in text hit-testing/accessibility/selection for manual reimplementation of those, while gaining nothing on the actual hard problem (kinsoku/ruby/TCY layout).

**(b) HarfBuzz/WASM lift vs. metrics-only libraries:** The lift for full HarfBuzz-via-WASM is moderate, not extreme — it's a proven, MIT-licensed, already-used-in-production (Photopea/Figma/Prezi per item 7) binding that, crucially, gives correct vertical OpenType feature application (`vert`/`vrt2`/`vpal`/`vkrn`) for free (item 5), including handling the handful of genuine Japanese shaping subtleties: vertical punctuation rotation/repositioning and full-width-to-proportional vertical kerning, which are real (if narrow) shaping concerns, not zero. Metrics-only libraries like opentype.js (item 6) would require reimplementing vertical glyph substitution/repositioning logic by hand from raw `vhea`/`vmtx`/GSUB/GPOS table data — feasible since Japanese is not a joining/reordering script like Arabic or Indic (item's supporting search: Japanese is notably absent from HarfBuzz's dedicated "complex" shaping models — Indic, Arabic/Syriac, Khmer, Thai/Lao — suggesting its per-glyph, mostly non-contextual nature is comparatively simple to hand-roll) — but doing so re-derives a chunk of what HarfBuzz already solved correctly and battle-tested. Either way — HarfBuzz or metrics-only — the large, genuinely hard remaining lift is identical and dominates total effort: Japanese line-breaking/kinsoku beyond UAX #14, hanging punctuation, ruby, and TCY (item 10), none of which any researched library provides. Shaping-engine choice affects a comparatively small slice of the total build; the jlreq-grade layout engine is the real project regardless of path.

Sources: [WHATWG HTML canvas spec](https://html.spec.whatwg.org/multipage/canvas.html) · [MDN CanvasRenderingContext2D.direction](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/direction) · [Bugzilla 902799](https://bugzilla.mozilla.org/show_bug.cgi?id=902799) · [MDN TextMetrics](https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics) · [Bugzilla 1646926](https://bugzilla.mozilla.org/show_bug.cgi?id=1646926) · [Igalia canvas-formatted-text explainer](https://github.com/Igalia/explainers/blob/main/canvas-formatted-text/text-metrics-additions.md) · [koharu.rs vertical CJK](https://koharu.rs/explanation/text-rendering-and-vertical-cjk-layout/) · [W3C 2008 canvas/CJK blog](https://www.w3.org/blog/2008/canvas-text-and-cjk/) · [harfbuzz/harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs) · [HarfBuzz Manual OpenType features](https://harfbuzz.github.io/shaping-opentype-features.html) · [OpenType vmtx spec](https://learn.microsoft.com/en-us/typography/opentype/spec/vmtx) · [OpenType vhea spec](https://learn.microsoft.com/en-us/typography/opentype/spec/vhea) · [opentype.js](https://github.com/opentypejs/opentype.js) · [foliojs/fontkit](https://github.com/foliojs/fontkit) · [rsms/fontkit](https://github.com/rsms/fontkit) · [behdad.org State of Text Rendering 2024](https://behdad.org/text2024/) · [UAX #14](https://unicode.org/reports/tr14/tr14-51.html) · [W3C jlreq](https://w3c.github.io/jlreq/) · [n8willis opentype-shaping-documents](https://github.com/n8willis/opentype-shaping-documents)

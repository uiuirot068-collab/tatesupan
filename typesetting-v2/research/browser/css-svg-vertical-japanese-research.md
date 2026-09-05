# Research Archive — CSS-Native (Family A) & SVG-Native (Family C) Vertical Japanese Typesetting

- Status: raw research output, archived verbatim from a Phase 1 research agent (2026-09-05)
- Method: WebSearch/WebFetch against primary sources (W3C specs, MDN, caniuse, bug trackers), confidence-tagged per finding
- Used by: `../../docs/architecture/PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`, `../../docs/architecture/JAPANESE_SHAPING_RESEARCH.md`

---

## FAMILY A — Browser DOM/CSS

**1. What does `writing-mode: vertical-rl` + `text-orientation` guarantee?**
SOURCE: [CSS Writing Modes Level 3, §5.1](https://www.w3.org/TR/css-writing-modes-3/) (W3C Recommendation-track spec).
EVIDENCE: The spec requires that in vertical modes the UA "must synthesize vertical font metrics for fonts that lack them" but explicitly states "this specification does not define heuristics for synthesizing such metrics." It requires vertical OpenType features be enabled ("the OpenType `vert` feature must be enabled") but for glyphs needing sideways synthesis (Unicode UAX#50 `Tr`/`Tu` classes) the UA merely "may wish to (but is not expected to)" synthesize them.
CONCLUSION: The spec guarantees orientation classification (upright vs. sideways) but explicitly disclaims any guarantee of *how* metrics are synthesized or missing glyphs handled — this is exactly the axis where cross-browser divergence is spec-sanctioned, not a bug.
CONFIDENCE: HIGH (primary spec text).

**2. Native kinsoku mechanism?**
SOURCE: [CSS Text Module Level 3 §5](https://www.w3.org/TR/css-text-3/#line-break-property), [MDN line-break](https://developer.mozilla.org/en-US/docs/Web/CSS/line-break).
EVIDENCE: `line-break: strict` only tightens *which class boundaries count as break opportunities* (e.g., forbids breaks before small kana, prolonged sound marks, certain PO-class punctuation), deferring to Unicode UAX#14 classes (`CJ`, `IN`) rather than defining CSS-native kinsoku character tables. `word-break`/`overflow-wrap` only govern whether/where arbitrary mid-word breaks are allowed, unrelated to kinsoku.
CONCLUSION: `line-break: strict` is real but crude — a coarse three-tier ruleset (loose/normal/strict), not the fully deterministic, publisher-configurable kinsoku tables TateSpun needs (which characters, hanging vs. compression resolution, etc.). It affects break *opportunity*, not visual placement/compression at the line edge.
CONFIDENCE: HIGH.

**3. Native hanging punctuation for 、/。 in vertical mode?**
SOURCE: [MDN hanging-punctuation](https://developer.mozilla.org/en-US/docs/Web/CSS/hanging-punctuation), [caniuse.com/css-hanging-punctuation](https://caniuse.com/css-hanging-punctuation).
EVIDENCE: `allow-end` explicitly lists U+3001 (、) and U+3002 (。) plus fullwidth/halfwidth variants, so the spec was written with Japanese in mind. But caniuse shows **zero support in Chrome, Edge, Firefox, IE, or any Chromium/Gecko browser** — only Safari (desktop/iOS) supports it at all, and only partially. Global usage ~15.7%, entirely from Safari.
CONCLUSION: Spec-complete for 、/。 but practically unusable cross-browser today — Chromium (TateSpun's presumed primary rendering target) has no implementation at all.
CONFIDENCE: HIGH.

**4. Ruby in vertical mode: short/long/overflow handling?**
SOURCE: [CSS Ruby Annotation Layout Module L1](https://www.w3.org/TR/css-ruby-1/) (W3C Working Draft, still WD as of the 2025-12-26 editor's draft — not advanced toward CR), [caniuse ruby-overhang](https://caniuse.com/mdn-css_properties_ruby-overhang), MDN ruby-overhang.
EVIDENCE: Spec defines `ruby-overhang: auto | none` where under `auto` "the extent and conditions for overhang are user-agent determined" (i.e., unspecified by design), and `ruby-merge` governs column-splitting for spanning annotations. Real-world implementation: **`ruby-overhang` is supported only in Safari 18.2+ (Dec 2024); Chrome, Firefox, Edge have zero support.** No browser has ever implemented true per-annotation overhang into an adjacent base's space on Chromium/Firefox.
CONCLUSION: Long-ruby overflow-into-neighbor is spec-permitted but deliberately left to UA discretion, and the UA that does anything is Safari only — Chromium (the practical target) has no ruby-overhang behavior at all; a long ruby in Chrome will either overlap awkwardly or rely on line-height/padding workarounds the spec itself recommends authors provide manually.
CONFIDENCE: HIGH.

**5. TCY (`text-combine-upright`) — digits-only or general, auto-detect?**
SOURCE: MDN text-combine-upright, [caniuse digits value](https://caniuse.com/mdn-css_properties_text-combine-upright_digits), [w3c/clreq issue #249](https://github.com/w3c/clreq/issues/249).
EVIDENCE: `all` value (any consecutive run, not just digits) is well-supported (Blink/Gecko/WebKit all support it, since ~2022). But the `digits <2-4>` auto-detecting value — the one that would let a browser auto-collapse digit runs without manual markup — **has zero implementation in any browser engine**, confirmed explicitly: "No major browsers support the `digits` value... which is a shame since it is a better approach."
CONCLUSION: CSS *can* combine arbitrary runs, but only via manual per-run markup (`<span>` wrapping), identical in spirit to TateSpun's explicit-range approach — the "auto-detect" mode CSS defines on paper does not exist in any shipping browser, so native CSS is strictly behind TateSpun's current explicit-marking capability, not ahead of it.
CONFIDENCE: HIGH.

**6. Deterministic per-glyph advance for proportional punctuation/brackets?**
SOURCE: [Adobe/Fonts OpenType feature docs](https://helpx.adobe.com/fonts/web/language-support-and-opentype-features/open-type-syntax.html), [Mozilla bug 1798297](https://bugzilla.mozilla.org/show_bug.cgi?id=1798297), ICS MEDIA CSS kerning article.
EVIDENCE: `font-feature-settings: "palt" 1` / `"halt" 1` toggle proportional/half-width forms, but which glyphs actually shift and by how much is baked into each font's internal GPOS tables — CSS only flips the feature on/off, it cannot specify target advance widths. Mozilla bug 1798297 (Yu Gothic UI on pixiv.net, 2022, RESOLVED FIXED via an engine-side font-specific workaround) shows a concrete case where enabling spec-correct `kern`+`palt` interaction produced visually broken, overlapping glyphs because of a font's own flawed `palt` table — Mozilla had to hardcode a workaround for that specific font rather than the platform giving authors control.
CONCLUSION: Advance widths for punctuation are opaque to CSS authors — control is delegated entirely to (a) the font's own GPOS tables and (b) the browser's shaping engine's feature-application heuristics, which are demonstrably capable of divergent/broken results per font, requiring browser-vendor-side per-font patches rather than author-side fixes. This is structurally non-deterministic from the page author's perspective.
CONFIDENCE: HIGH.

**7. Known Chromium/WebKit vertical-Japanese bugs?**
SOURCE: [W3C Chinese Layout Gap Analysis (clreq-gap)](https://www.w3.org/TR/clreq-gap/), Mozilla bug 1798297, w3c/clreq issues #241, #238, #550, #249.
EVIDENCE: clreq-gap documents, with issue numbers, that: bopomofo ruby positioning is unsupported in all browsers (#241); "Gecko and Blink skip some punctuation marks [for emphasis-mark placement], but WebKit does not skip any" (#238); Blink has a specific bug where emphasis dots misalign after `letter-spacing` changes, unlike Gecko/WebKit (#550); `text-combine-upright:digits` is unimplemented everywhere (#249); list-marker upright presentation is broken across all three engines (#367).
CONCLUSION: This is a maintained, primary-adjacent W3C document (not a blog) cataloguing multiple concrete, named cross-engine divergences in exactly the vertical-Japanese-typography feature set TateSpun cares about (ruby, emphasis, TCY). Confirms non-determinism/divergence is real and ongoing, not hypothetical.
CONFIDENCE: MEDIUM-HIGH (clreq-gap is a W3C-published gap analysis, strong secondary/quasi-primary source; individual bug-tracker page fetches were partially unreliable in this session — one direct Chromium Monorail fetch returned empty content, so I could not independently re-verify bug #626581's text and rely on the gap-analysis document's citations instead).

**8. Can JS/CSS read vhea/vmtx/GPOS vertical metrics?**
SOURCE: [WICG Local Font Access API spec](https://wicg.github.io/local-font-access/), MDN Local Font Access API.
EVIDENCE: `window.queryLocalFonts()` (Chromium-only, WICG incubation — "not a W3C Standard nor on the W3C Standards Track") can, after an explicit permission prompt, return raw SFNT bytes via `FontData.blob()`, giving access to "the same underlying font data... including glyf, GPOS, GSUB." Nothing in stable CSS or the standard DOM exposes vhea/vmtx/GPOS directly — you would need this experimental API plus a userland parser (e.g., opentype.js) to extract vertical metrics yourself.
CONCLUSION: Vertical font metrics are opaque to CSS/mainstream JS. Reading them requires an experimental, permission-gated, single-vendor API (Chromium) plus manual OpenType table parsing outside the browser's own layout pipeline — not a reliable cross-browser foundation for a production engine, and it does not expose what the *browser's own shaping engine actually used* at layout time, only the raw font bytes for the engine to reinterpret independently.
CONFIDENCE: HIGH for the negative claim (no standard access); MEDIUM on completeness of the Local Font Access API's real-world reach since it's an active incubation and may have moved.

## FAMILY C — SVG

**9. SVG `<text>` + `writing-mode: vertical-rl` support?**
SOURCE: [caniuse writing-mode](https://caniuse.com/css-writing-mode), [W3C SVG WG issue 2175](https://www.w3.org/Graphics/SVG/WG/track/issues/2175), MDN SVG writing-mode attribute.
EVIDENCE: CSS `writing-mode` (which also governs SVG `<text>` in SVG2) has been broadly supported since ~2017. But SVG WG issue 2175 (dating to SVG Tiny 1.2 era) shows vertical text support was historically excluded from SVG Tiny and uncertain even in SVG Full ("it may return in SVG Full... a value not covered in SVG 1.1 Full" — issue left in RAISED status, unresolved in the tracker). SVG1's own `writing-mode` attribute values (`tb-rl` etc.) are deprecated in favor of the CSS property.
CONCLUSION: Modern browsers do apply CSS `writing-mode: vertical-rl` to SVG `<text>`, but SVG's *native* vertical-text machinery has a documented history of being incomplete/unresolved at the spec level — current support is really "CSS layout borrowed into SVG," not a mature SVG-native vertical text model.
CONFIDENCE: MEDIUM (caniuse data is solid; the WG issue is old/unresolved-status and I could not confirm a closing resolution).

**10. Can SVG achieve fully deterministic custom per-glyph positioning?**
SOURCE: [SVG2 spec, Text chapter](https://www.w3.org/TR/SVG2/text.html).
EVIDENCE: `x`/`y`/`dx`/`dy`/`rotate` on `<text>`/`<tspan>` can be supplied as per-character arrays, and the spec explicitly supports this ("useful in high-end typography scenarios where individual glyphs require exact placement"), including correct behavior for multi-character-to-one-glyph mappings (ligatures). Critically, the spec's caveat about "locations of intermediate glyphs are not predictable" applies specifically to cases where the *author does not supply per-glyph values* and lets the UA balance/justify text automatically — when the author explicitly provides a full per-character `x`/`y` (or `dx`/`dy`) array, placement is authoritative and deterministic.
CONCLUSION: Yes — SVG can function as a pure "dumb" glyph-placement surface: a layout engine computes every glyph's coordinates externally (exactly as FixedSlot already does with absolutely-positioned spans) and SVG just paints them. This is architecturally equivalent to Family B/FixedSlot's positioning model, just via SVG primitives instead of CSS absolute-position spans — same ceiling, same floor, this axis is not where Family C differs from current production.
CONFIDENCE: HIGH.

**11. SVG-to-PDF: vector/selectable text preserved?**
SOURCE: [CairoSVG docs](https://cairosvg.org/documentation/), [librsvg/rsvg-convert docs](https://docs.oracle.com/cd/E88353_01/html/E37839/rsvg-convert-1.html).
EVIDENCE: Both CairoSVG and librsvg's `rsvg-convert` support direct SVG→PDF output as a first-class vector target (not just PNG rasterization) — "rsvg-convert converts SVG images into PNG raster images, PDF, PS, or SVG vector images." Whether resulting PDF text stays *selectable* text (vs. outlined paths) depends on whether the converter embeds actual font glyphs/text runs or converts glyphs to paths — this varies by tool and by whether the font is embeddable; I did not find a primary-source guarantee either way for text selectability specifically (only that vector fidelity vs. raster is a known tradeoff axis these tools expose).
CONCLUSION: SVG→PDF vector conversion is real and common (not forced rasterization), but whether text stays as *selectable* text objects rather than outlined vector paths is implementation/tool-dependent and unconfirmed from primary docs in this pass — flag as needing a follow-up hands-on test with the specific toolchain TateSpun would use (Chromium print-to-PDF, or a headless renderer + Cairo/librsvg).
CONFIDENCE: LOW-MEDIUM — this answer is a plausibility statement from tool documentation, not a verified test; treat as a gap requiring direct experiment before any Family C decision.

**12. SVG glyph outline/metrics access beyond DOM/CSS?**
SOURCE: [WICG Local Font Access API](https://wicg.github.io/local-font-access/) (same as Q8) — SVG itself defines no separate glyph-introspection API.
EVIDENCE: Nothing in the SVG spec itself exposes glyph outlines differently from HTML/CSS; both ultimately rely on the same browser font-rasterization stack, and the only path to raw glyph data is the same experimental Local Font Access API (or bundling/parsing your own font files with a JS library like opentype.js, independent of any browser API).
CONCLUSION: No — SVG gives no additional native glyph/metrics introspection over DOM/CSS. Any "custom shaping" capability in Family C comes entirely from the layout engine parsing font files itself (e.g., via opentype.js) and generating SVG coordinates, not from any SVG-specific browser API.
CONFIDENCE: HIGH.

## Overall Verdict

Across all 12 items, the pattern is consistent: every CSS/SVG-native mechanism that *sounds* like it solves a TateSpun requirement is either (a) spec-defined but left explicitly "UA-determined" with no authoring control (vertical metrics synthesis, ruby-overhang, glyph substitution for missing vertical forms), (b) spec-complete but essentially unshipped in Chromium specifically (`hanging-punctuation`, `ruby-overhang`, `text-combine-upright: digits`), or (c) present but coarse/heuristic rather than deterministic (`line-break: strict`, punctuation advance widths via `palt`/`halt` feature flags). The one place where CSS/SVG-native does offer real, deterministic, author-controlled placement is exactly where TateSpun's current FixedSlot approach already lives: per-character absolute/explicit positioning (CSS absolute spans today; SVG per-glyph `x/y/dx/dy` arrays would be an equivalent, not-superior, alternative). No evidence found in this pass suggests either family has closed the gap on kinsoku determinism, hanging punctuation, long-ruby overhang, or auto-detected TCY since TSP-TYPO-LOOP-005 was documented — if anything, the `ruby-overhang`/`hanging-punctuation` Safari-only status and confirmed zero-Chromium-support data make the ceiling look *lower* on Chromium specifically than a cross-browser reading might suggest. The evidence supports the conclusion that a custom logical layout layer (computing kinsoku, hanging, TCY ranges, ruby geometry, and per-glyph advance externally) is structurally required regardless of whether the paint target is DOM/CSS or SVG — the rendering technology choice affects *how* computed positions get painted, not whether native layout can be trusted to compute them.

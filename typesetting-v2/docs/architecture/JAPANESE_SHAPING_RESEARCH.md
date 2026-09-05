# Phase 1 — Japanese Shaping Control Research

- Status: Phase 1 draft, pending Human Review — no shaping approach selected
- Source authority: Master §4.1 ("browser-native is not the authority"), Master §20 boundary that TSP-TYPO-LOOP-005 already found Chromium-native shaping insufficient
- Evidence base: `../../research/browser/css-svg-vertical-japanese-research.md`, `../../research/shaping/canvas-harfbuzz-shaping-research.md`, `../../research/typography-standards/jlreq-jis-opentype-standards-research.md`

## 1. Confirming the premise, with citations (it was a finding, now it's a cited finding)

TSP-TYPO-LOOP-005 established that Chromium's native vertical shaping doesn't reliably clear Publication Quality. Phase 1 research independently confirms specific, citable reasons why, rather than leaving this as an unexplained empirical observation:

- `hanging-punctuation` (the CSS property that would give native ぶら下げ for 、/。) has **zero Chromium implementation** — Safari-only, ~15.7% global usage entirely from Safari (browser research item 3).
- `ruby-overhang` (native long-ruby overflow) is **Safari 18.2+ only**, zero Chromium/Firefox support (item 4).
- `text-combine-upright: digits` (native TCY auto-detection) has **zero implementation in any browser** (item 5) — TateSpun's current explicit-marking approach is ahead of, not behind, what CSS natively offers.
- Punctuation advance width is opaque to page authors and demonstrably capable of font-specific breakage even inside browser engines themselves (Mozilla bug 1798297, a real production bug that needed an engine-side per-font patch) (item 6).
- A W3C-maintained gap-analysis document (clreq-gap) independently catalogs multiple named cross-engine divergences in exactly this feature set (item 7).

This is not "browsers are bad at Japanese" in general — it's specific, named, currently-true gaps in the exact features TateSpun's typography rules depend on.

## 2. What does control the shaping, then?

The OpenType specification itself — not any browser — defines the mechanisms that determine correct vertical Japanese presentation:

- `vert`/`vrt2`: GSUB features that substitute default glyphs for vertical-appropriate rotated/repositioned forms (e.g., U+FF08 opening paren → U+FE35's rotated form). `vrt2` is a superset that overrides `vert` when present (typography-standards item 9, directly quoted from the spec).
- `vchw`/`vhal`/`vpal`: GPOS-adjacent features that re-space glyphs from full-em to half-em heights specifically for CJK punctuation/symbol fit "such as what is described in [JLREQ]" — a direct, spec-text link between the OpenType mechanism and the jlreq layout requirement it implements (item 6, directly quoted).
- HarfBuzz applies `vert` automatically whenever shaping direction is set to top-to-bottom, and handles `vrt2`/`vpal`/`vkrn` through its ordinary GSUB/GPOS feature-application logic (shaping research item 5) — meaning a HarfBuzz-based shaping layer gets correct vertical glyph selection "for free," inherited from the font's own tables, rather than needing bespoke per-glyph substitution logic in TateSpun's own code.

## 3. Can browser-native shaping be overridden from the client side?

Two real (if partial) mechanisms exist:

- **HarfBuzz-via-WASM (harfbuzzjs).** A thin, MIT-licensed WASM binding over real HarfBuzz, already used in production by other web apps per its maintainer (Photopea, Figma, Prezi — flagged MEDIUM confidence as blog-sourced, shaping research item 7). This fully bypasses the browser's own text shaper: HarfBuzz computes glyph IDs and vertical advances/positions directly from the font file, independent of whatever Chromium/Firefox/Safari would have done natively.
- **opentype.js / fontkit (metrics/outline parsers).** Lower-level: give font parsing and glyph outlines, with `foliojs/fontkit` additionally doing real GSUB/GPOS application (closer to a lightweight shaper) — but neither confirms `vhea`/`vmtx` (vertical metrics table) support in their own documentation, which would need direct source-level verification before relying on them for vertical-specific metrics (item 6).

Both paths are MIT-licensed with no commercial-use blocker (item 9).

## 4. What shaping does NOT solve — the larger, unavoidable remainder

This is the single most important finding for scoping Phase 2/3 effort correctly: **no shaping engine (HarfBuzz or otherwise) solves Japanese line-breaking, kinsoku, hanging punctuation, ruby layout, or TCY run detection.** These are layout-level decisions, not glyph-shaping decisions — HarfBuzz shapes whatever run of text you hand it; it does not decide where a line should break or whether a 。 should hang past the line's normal capacity (shaping research item 10; typography-standards item 8's finding that even Unicode's own UAX #14 explicitly punts strict Japanese line-breaking to "higher level software").

This means: **shaping-engine choice (HarfBuzz vs. hand-rolled) is a comparatively small slice of total engineering effort.** The large, unavoidable cost — a jlreq-grounded kinsoku/hanging/ruby/TCY layout engine — exists regardless of which shaping path is chosen, and is in fact largely already written (in a DOM-coupled form) in the current production codebase's `tategaki.ts`. The real Phase 2/3 question is less "which shaper" and more "how do we extract/rebuild the existing kinsoku/hanging/ruby/TCY logic as a paint-surface-independent module."

## 5. Standards grounding for the layout rules themselves (not just glyph shaping)

Separately from OpenType shaping, jlreq (the W3C's own formal document on this exact subject) gives citable normative sources for the layout-level rules TateSpun needs, which the Master's "magic number prohibition, category rules permitted" language (§5.3–5.4) is asking for:

- Kinsoku line-start/end character classes: jlreq §3.1.7–3.1.9, a formal cl-01…cl-08+ class table (typography-standards item 1, MEDIUM confidence — class enumeration beyond cl-01/02/06/07 should be re-verified directly before hard-coding, per that document's own flag).
- ぶら下げ scoped to 、/。 and closing-bracket interaction: jlreq §3.1.9 (item 2).
- Ruby placement and the specific long-ruby-overflow case: jlreq §3.3.3–3.3.8 (item 3).
- TCY: jlreq documents "commonly 2-digit numbers" as a *customary example*, not a hard normative threshold — TateSpun's exact trigger rule remains an app-specific policy choice layered on a soft convention (item 4).
- Dash/ellipsis run inseparability: plausibly an instance of jlreq's cl-08 "inseparable characters" category, but not yet confirmed against the literal clause text in this research pass — flagged explicitly as needing a follow-up direct read before Phase 2 treats it as standards-backed rather than app convention (item 5).

## 6. Phase 2 candidates this research identifies (not selected, just narrowed)

1. Extract the current `tategaki.ts` kinsoku/hanging/ruby/TCY logic into a renderer-independent module, re-grounded explicitly against jlreq clause numbers where citable (per §5 above), and consolidate the currently-duplicated pagination/caret-mapping implementations into one shared module (per Compatibility Matrix's flagged risk) — feasible with or without adopting HarfBuzz.
2. Evaluate harfbuzzjs specifically for: (a) actual compiled bundle size, (b) real-world vertical-shaping output correctness against TateSpun's actual fonts (Shippori Mincho etc.), neither of which was measured in this research pass (both flagged as needing direct experiment, not assumed from documentation).
3. If (2) is not adopted, evaluate whether the jlreq-grounded vertical-metrics/glyph-substitution logic can be hand-rolled from `vhea`/`vmtx`/GSUB tables read via opentype.js/fontkit at acceptable engineering cost, given Japanese's comparatively simple (non-reordering, non-joining) shaping profile relative to scripts HarfBuzz's own "complex" shapers specifically target (Indic, Arabic, Khmer, Thai/Lao) — shaping research item 10's supporting observation.

## 7. Explicit non-conclusion

This document does not select HarfBuzz, opentype.js, or a hand-rolled approach. It establishes that shaping-engine choice is a bounded, comparatively small decision, and that the dominant engineering cost — a jlreq-grounded custom layout engine — is required under every candidate and substantially already exists in the current codebase, meaning Phase 2/3 is closer to "extract and re-ground" than "build from zero."

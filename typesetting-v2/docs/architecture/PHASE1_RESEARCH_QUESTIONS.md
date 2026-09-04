# Phase 1 Research Questions

- Status: Phase 0 draft — questions only, no architecture selected or ranked
- Source authority: `typesetting-v2/docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §7 (White-Sheet Rule), §14 (Phase 1 — Architecture Research)

Master §7 resets all of the following to undecided: FixedSlot, 1-char-1-span, CSS writing-mode, Chromium native shaping, html-to-image, Canvas, SVG, HTML DOM, WebGL, WASM, HarfBuzz/other shapers, PDF library, browser PDF, server-side rendering, client-side rendering. This document records what Phase 1 must go investigate about each candidate axis — it does not recommend, compare, or rank any of them. That comparison is Phase 1's job, per Master §14's comparison axes (Publication Quality ceiling, Japanese vertical shaping, OpenType support, PDF generation, JPG generation, Preview feasibility, browser compatibility, performance, offline/client-side feasibility, font handling, licensing, complexity, maintainability).

## 1. Canonical Layout Model questions

- Can a single logical layout representation (Master §2: page/column/line/source-range/glyph-token/advance/ruby-relation/punctuation-category/kinsoku-state/hanging-state/tcy-state/image-frame/page-break-reason) be produced independently of which renderer consumes it, or does the model need renderer-specific escape hatches?
- What is the minimum data a Preview renderer needs from this model to satisfy Master §1.3 ("same logical typesetting, different renderers allowed") without being pixel-identical to Publication output?
- Added 2026-09-05 after Phase 0 Human Decision Freeze (HD-006, Master §20.6): the colophon (horizontal-writing, currently isolated from body pagination) must become a formal Canonical Layout Model element with page placement, pagination relationship to body pages, font, layout area, and export inclusion all logically managed. Does this mean colophon shares the same page/line/column primitives as vertical body pages, or does the model need a distinct-but-connected representation for a horizontal-writing page embedded in an otherwise-vertical book? What does "pagination relationship to body pages" need to guarantee (e.g. does colophon page count participate in the book's total page numbering)?

## 2. Japanese vertical shaping questions

- Which candidate shaping paths (browser-native vertical writing-mode, a dedicated shaper library, a custom layout engine) can correctly resolve: kinsoku, hanging punctuation, ruby-to-base attachment (including long-ruby overflow), TCY digit runs, and vertical glyph variants for dash/ellipsis — as data-level guarantees, not visual approximations?
- For each candidate, what happens to full-width vs. half-width Latin and mixed-script line breaking?
- Does font metric data (OpenType) needed for natural, magic-number-free character advance (Master §5.3) differ in availability/accuracy across candidate shaping paths?

## 3. Publication (PDF/JPG) generation questions

- Which PDF generation approaches can hit Publication Quality (Master §1.1, §4) for vertical Japanese typesetting specifically (not just general PDF text layout)?
- Can the same Canonical Layout Model instance drive both PDF and JPG output deterministically, or does each output format need its own adaptation layer?
- What are the licensing/cost implications of each PDF generation candidate for a public web app at TateSpun's scale?

## 4. Preview renderer questions

- Given Preview no longer needs to equal Export (Master §1.2), what candidate technologies give "sufficient visual/structural fidelity for editing confidence" at acceptable interactive performance, independent of what Publication rendering uses?
- Can Preview and Publication be built on genuinely different technology stacks while both consuming the same Canonical Layout Model, or does practical engineering cost push toward sharing more?

## 5. Client-side vs. server-side questions

- Which parts of the pipeline (manuscript → Canonical Layout Model → Preview / Publication) can run client-side vs. require server-side processing, and what does that imply for the Privacy Contract (Master §3 priority 3, §15) — i.e., does any candidate architecture require sending manuscript text to a server/external service where it currently doesn't?
- What are the offline/large-manuscript performance implications of each split?

## 6. Font handling questions

- What are the licensing terms and technical integration paths (subsetting, embedding in PDF, webfont loading for Preview) for the fonts TateSpun currently offers (e.g. Shippori Mincho) under each candidate architecture?
- Does any candidate constrain future font additions in a way that matters for the product?

## 7. Integration / migration questions

- For each candidate architecture, what does the eventual integration path into the existing TateSpun Next.js application look like (Master §13.0, §12) — as a rough shape only, not a committed design?
- Does any candidate make the required rollback / parallel-run model (Master §12.3, Phase 8) meaningfully harder or easier?

## 8. Explicitly out of scope for Phase 1

- Ranking or scoring the candidates against each other (Phase 1 output is comparative research; the actual selection/ADR is a decision gated at the end of Phase 1, not embedded in this questions doc).
- Building a working prototype of any candidate (small technical spikes are permitted per Master §14, full prototypes are Phase 2+).
- Answering these questions from prior familiarity/training-data assumptions about how each technology "usually" performs — Master §4.1 explicitly rejects browser-native behavior as an automatic authority, and the same skepticism applies to assumed capabilities of any other candidate until verified.

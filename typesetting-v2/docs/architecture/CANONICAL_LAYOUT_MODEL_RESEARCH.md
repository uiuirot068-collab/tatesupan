# Phase 1 — Canonical Layout Model Feasibility Research

- Status: Phase 1 draft, pending Human Review — no final schema implemented
- Source authority: Master §2 (Canonical Layout Model concept), Master §1.3 (Logical Layout Consistency Contract), Freeze §4
- Evidence base: `PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md` and its four underlying research archives

## 1. Question

Master §2 proposes: `Manuscript → Typesetting Engine → Canonical Layout Model → Preview Renderer → Publication Renderer`. Is a single logical layout representation, shared by (potentially different) Preview and Publication renderers, actually feasible — and what should its unit of representation be? Master §2 explicitly warns against simply porting the current one-character-per-span (FixedSlot) DOM structure into this model unexamined.

## 2. Feasibility verdict: YES, feasible — and the research gives a specific reason why

Every architecture family researched (`PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`) converges on the same structural fact: **no rendering technology natively computes Japanese vertical kinsoku/hanging/ruby/TCY layout** — this has to be a custom logical computation regardless of paint surface. That custom computation's *output* is exactly what a Canonical Layout Model needs to be: a paint-surface-agnostic description of "what goes where, and why" that any renderer (DOM, Canvas, SVG, or direct PDF operators) can consume.

This is not a new invention for TateSpun — it's the same thing the current FixedSlot pagination/kinsoku logic already produces internally (per-line/per-page character assignment, kinsoku decisions, hanging-slot assignment, ruby-base attachment, TCY run boundaries) before it gets turned into DOM spans. The Canonical Layout Model formalizes that intermediate result as a first-class, renderer-independent artifact instead of an implementation detail buried inside one specific renderer's code.

## 3. What should be the layout unit?

The research gives converging evidence for treating **the shaped glyph** (not the raw source character, and not a full line) as the model's atomic positioned unit, sitting on top of — not replacing — a source-text-range concept:

- HarfBuzz-style shaping (Family D, `../../research/shaping/canvas-harfbuzz-shaping-research.md` items 5–6) naturally produces a sequence of `(glyph ID, x-advance/y-advance, position)` tuples per shaped run — this is the standard granularity a shaping engine emits, and it's exactly the granularity SVG's per-glyph `x/y/dx/dy` arrays and PDF's per-CID positioning expect as input (browser research item 10; PDF research items 1, 3).
- But glyph ≠ character in every case: ligatures, TCY runs, and ruby base/reading pairs are documented cases where a single logical unit doesn't map 1:1 to a single glyph or a single source character (SVG spec's own ligature-mapping caveat, browser research item 10; jlreq's ruby/TCY sections, typography-standards research items 3–4).
- Therefore the model needs (at minimum) a **cluster** concept: a source-text-range that maps to one-or-more glyphs, carrying its own category metadata (punctuation category, kinsoku state, hanging state, TCY membership, ruby relation) — closer to the "character/glyph cluster" language Phase 1.6 was asked to investigate than to a pure 1-glyph-per-slot model.

## 4. Candidate model shape (still not a final schema — Phase 3 implements)

A layered structure fits the evidence better than a single flat grid:

1. **Source layer** — the manuscript's plain-text-with-markers representation (already exists: TateSpun's inline notation for ruby/TCY/page-break/image, per Compatibility Matrix). This is the input, not part of the Canonical Layout Model itself.
2. **Logical cluster layer** — the output of kinsoku/hanging/ruby/TCY/dash-ellipsis-run resolution: an ordered sequence of clusters, each with a source-text range, a category tag, and category-specific data (ruby: base+reading text and jlreq §3.3.8 overflow treatment; TCY: the combined run and jlreq's soft "commonly 2-digit" convention vs. TateSpun's own explicit threshold, per `../../research/typography-standards/jlreq-jis-opentype-standards-research.md` item 4; dash/ellipsis: run length and jlreq cl-08-style inseparability, item 5 — flagged there as needing a follow-up direct citation check).
3. **Positioned-glyph layer** — the shaping engine's output per cluster: glyph ID(s), physical-unit advance/position, vertical-appropriate glyph variant selection (OpenType `vert`/`vrt2`, typography-standards item 9).
4. **Page/column/line layer** — pagination's assignment of clusters to lines, columns, and pages, including page-break reason (manual vs. natural), matching Master §1.3's required-identical list.

Preview and Publication renderers would each consume layers 2–4 (the paint-surface-agnostic parts) and independently decide how much of layer 3 to reproduce — Preview could reasonably use a lighter-weight, still-deterministic positioning (DOM absolute-position spans, as today) while Publication uses the full shaping-engine-driven positions, satisfying Master §1.2's explicit permission for different technology while still guaranteeing Master §1.3's required consistency (both renderers agree on layers 2 and 4; layer 3's *exact* pixel/point values may legitimately differ in precision, not in logical outcome).

## 5. Open questions (engineering-resolvable, Phase 2/3, not Phase 1 blockers)

- Exact data structure for a "cluster" (flat array vs. tree) — Phase 3 schema design.
- Whether ruby/TCY clusters need their own sub-model or can reuse the same cluster shape with a discriminant field — Phase 3.
- Whether the Canonical Layout Model should be versioned/serializable (e.g., for storing a "rendered layout" snapshot independent of re-computing it) — relevant to the Compatibility Matrix's note that current pagination has a documented history of drift bugs between independently-maintained mirror implementations; a serializable Canonical Layout Model, computed once and consumed by both Preview and Publication, is one credible way to eliminate that duplication risk structurally — worth carrying into Phase 3 design, not decided here.

## 6. Explicit non-conclusion

This document does not select glyph-vs-cluster-vs-line as a final schema, does not choose a shaping engine, and does not decide whether Preview literally shares code with Publication or merely shares the Canonical Layout Model's data shape. Per Master §7, those remain open for Phase 2/3.

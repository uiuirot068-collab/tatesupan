# Phase 1 — Colophon (奥付) in the Canonical Layout Model

- Status: Phase 1 draft, pending Human Review — no schema implemented
- Source authority: Master §20.6 (HD-006 — colophon is a formal Canonical Layout Model element), Freeze §9/§18
- Evidence base: Compatibility Matrix's colophon row (current implementation facts), `CANONICAL_LAYOUT_MODEL_RESEARCH.md` (layered model this builds on)

## 1. What HD-006 already fixed, and what's left

HD-006 already settled the product requirement: colophon must be a formal Canonical Layout Model element with logically-managed page placement, pagination relationship to body pages, font, layout area, and export inclusion. What Phase 1 investigates is whether the layered Canonical Layout Model design (from `CANONICAL_LAYOUT_MODEL_RESEARCH.md`) can actually accommodate colophon's real structural difference from body pages, and what that implies for Phase 3 schema design.

## 2. The real structural difference: writing-mode mismatch, not just "another page type"

Per the Compatibility Matrix, colophon today is a **horizontal-writing** page (奥付 is conventionally set horizontally even in an otherwise vertical-writing book) appended after body pages, currently implemented as an isolated component (`ColophonPageCard.tsx`) disconnected from body pagination (TSP-LOOP-005). This is a materially different case from "another body page with different content" — it's a different *writing-mode* page embedded in the same book, not just a different content type within the same layout model.

## 3. Does the layered Canonical Layout Model (from CANONICAL_LAYOUT_MODEL_RESEARCH.md) accommodate this?

Reasoning from that model's four layers:

- **Logical cluster layer** and **positioned-glyph layer** are writing-mode-agnostic in principle — a cluster's category/positioning data doesn't inherently assume vertical orientation; a horizontal-writing colophon page's clusters would simply carry a different orientation flag/base-direction than body-page clusters, rather than needing an entirely separate model.
- **Page/column/line layer** already has to represent page-break reasons, page numbers, and pagination relationships for body pages — extending it to include "this page's writing-mode/orientation differs from the surrounding book" is additive metadata on an existing layer, not a structural fork of the whole model. This is the layer that must carry HD-006's "pagination relationship to body pages" requirement (e.g., whether colophon page(s) participate in the book's total page count/numbering sequence, or sit outside it — a data-modeling question, not a Human product question, since HD-006 only requires that this relationship be *logically manageable*, not that it be a specific relationship).

**Conclusion: feasible without a separate, disconnected model** — colophon can plausibly be represented as page(s) within the same Canonical Layout Model, distinguished by orientation/writing-mode metadata at the page layer, rather than requiring the current implementation's total isolation from body pagination. This is the specific thing HD-006 asks Engine v2 to achieve that the current implementation does not.

## 4. Font inheritance (HD-005) intersects here

HD-005 (柱/奥付 font inherits body font by default, independently overridable) applies to colophon specifically. In the layered model, this is naturally a per-page (or per-page-type) font override on top of a default inherited from the document's body font setting — structurally similar to how nombre/柱 font already has its own override mechanism today (`nombreLayoutCustomized` flag, per Compatibility Matrix), just generalized to also cover colophon.

## 5. Export inclusion

HD-006 requires export inclusion be logically manageable. Given the Publication Output research's finding that both PDF and JPG paths ultimately consume "the finalized layout" (whichever Publication path is chosen, `PUBLICATION_OUTPUT_RESEARCH.md` §5), colophon pages being part of the same Canonical Layout Model (rather than a bolted-on separate export step, as today) means they'd naturally flow through the same Publication renderer as body pages — a mixed-writing-mode Publication renderer is a real requirement this surfaces (the Publication renderer must handle a horizontal-writing page appearing after vertical-writing pages in the same PDF), which should be explicitly carried into Phase 2/3 Publication-renderer design rather than assumed away.

## 6. Open questions for Phase 2/3 (not Human decisions — HD-006 already settled the product requirement)

1. Exact discriminant/schema for "this page's writing-mode differs from the book's default" at the page layer — Phase 3 schema design.
2. Whether colophon page count participates in the book's visible page-number sequence, is excluded, or is configurable — an engineering/product-detail question genuinely below the threshold of a Phase 0 Human Decision (HD-006 only required this be *manageable*, not *decided* which way).
3. Whether the Publication renderer chosen in Phase 2 (per `PUBLICATION_OUTPUT_RESEARCH.md`'s (b1)/(b2) paths) can cleanly emit a mixed vertical+horizontal-writing document — should be added as a concrete Phase 2 PoC test case using colophon as the real-world mixed-writing-mode example, rather than treated as a hypothetical edge case.

## 7. Explicit non-conclusion

This document does not specify colophon's final data schema, does not decide whether colophon pages count toward page numbering, and does not select a Publication renderer. It establishes that HD-006's requirement is structurally achievable within the layered Canonical Layout Model already being explored, and flags the mixed-writing-mode Publication rendering question as something Phase 2 PoC work should test concretely rather than discover late.

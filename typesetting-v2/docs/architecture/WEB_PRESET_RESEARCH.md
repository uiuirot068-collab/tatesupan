# Phase 1 — Web Preset (Web閲覧用) Research

- Status: Phase 1 draft, pending Human Review — no unit model or pagination mechanism selected
- Source authority: Master §6.2, §20.1 (HD-001 — page model retained even under scroll presentation), Freeze §6
- Evidence base: `../../research/browser/css-svg-vertical-japanese-research.md` (unit/reproducibility findings), `PUBLICATION_OUTPUT_RESEARCH.md` (physical-unit findings apply here by extension)

## 1. What HD-001 already fixed, and what's left

HD-001 (Master §20.1) already resolved the product-direction question: Web閲覧用 keeps the Canonical Layout Model's logical page unit even if presented as continuous scroll on screen. What remains for Phase 1/2 is narrower and purely engineering: *how* to reconcile "logical pages exist" with "presentation may scroll continuously," and what unit system backs it.

## 2. Shared layout semantics with print presets

Per Freeze §6 and Master §1.3, Web閲覧用 must still agree with print presets on every item in the Logical Layout Consistency Contract: page count, pagination, kinsoku/hanging results, ruby relationships, TCY, punctuation category treatment, image placement, page breaks, page numbers. HD-001 confirms this isn't optional even under a scroll UI — a "page" in the Canonical Layout Model sense continues to exist as a real unit of pagination, just not necessarily rendered as a physically separate sheet on screen.

This is consistent with the Canonical Layout Model research's layered model (`CANONICAL_LAYOUT_MODEL_RESEARCH.md`): layers 2–4 (logical clusters, positioned glyphs, page/column/line assignment) are shared across all presets including Web閲覧用; only how layer 4's page boundaries get *presented* (discrete sheet vs. scroll-through) is preset-specific.

## 3. Web logical units — what the research actually supports

Master §6.2/HD-001 explicitly permit Web閲覧用 to use web logical units (e.g. CSS px) as canonical, unlike print presets which must not use px as their source of truth (Master §6.1, Freeze §5). The browser research (`css-svg-vertical-japanese-research.md`) is relevant here even though it wasn't run specifically for the Web preset: it establishes that native CSS layout does not natively guarantee kinsoku/hanging/ruby/TCY determinism regardless of which unit system is used — so choosing CSS px as Web閲覧用's canonical unit does not, by itself, mean Web閲覧用 can rely on native CSS layout for its typography; the same custom logical-layer requirement found for print presets (Architecture Research Matrix's cross-cutting finding) applies equally to Web閲覧用. The unit choice (px vs. mm/pt) and the shaping/layout-determinism question are independent axes — resolving one does not resolve the other.

## 4. Screen pixel density independence

The current codebase already has direct, hard-won experience with a related problem: `PAPER_SIZE_TEMPLATES`'s Web閲覧用 entry uses `isPx: true` with its own `PX_PER_MM=2.2` preview-scale constant, kept deliberately distinct from the unrelated `CSS_PX_PER_MM_96DPI` conversion constant used elsewhere (Compatibility Matrix, "Web閲覧用 unit model" row) — a real, already-encountered confusion risk between "preview-only render scale" and "physical 96dpi CSS px," flagged as High migration risk. Whatever Web閲覧用's unit model becomes in Engine v2, it needs a single, clearly-named conversion path — not two similarly-named constants serving different purposes, as exists today.

Separately, the Publication Output research (`PUBLICATION_OUTPUT_RESEARCH.md` item, sourced from `publication-output-path-research.md` item 5) found that print-to-PDF's CSS-px-to-PDF-pt mapping is independent of `devicePixelRatio` by design — a relevant data point if Web閲覧用's canonical unit ends up being CSS px: CSS px is not itself device-pixel-density-dependent in the way a raw screenshot capture is, which somewhat de-risks choosing it as canonical for a screen-oriented preset specifically (as opposed to using actual device pixels).

## 5. Remaining open engineering questions (Phase 1/2, not Human decisions — HD-001 already settled the product direction)

1. Does "page" for Web閲覧用 mean a fixed-height scroll segment the UI can snap between (discrete-but-scrollable), or a genuinely continuous flow where "page" is purely a pagination-bookkeeping concept never surfaced as a visual boundary to the reader? Both satisfy HD-001's requirement that the logical page unit isn't abolished; they differ in reader-facing presentation, which is a Preview-layer decision, not a Canonical Layout Model decision.
2. Does Web閲覧用 reuse the exact same pagination algorithm as print presets (with different unit inputs), or does continuous-scroll presentation make certain print-only pagination concerns (e.g. exact page-fill decisions) less load-bearing for Web閲覧用 specifically, allowing a simpler reflow model there while still emitting page-boundary metadata for consistency-contract purposes? Needs Phase 2/3 investigation once a Canonical Layout Model schema exists to test this against.
3. Given the current codebase's isPx/PX_PER_MM confusion (§4 above), what's the cleanest single conversion path for Engine v2 — is there still a need for two distinct scale constants (one for a genuinely screen-relative concern, one for physical accuracy), or can Web閲覧用's model eliminate that duplication entirely by never needing a physical-unit fallback at all? This is answerable once the Canonical Layout Model's actual schema (from Phase 3) exists.

## 6. Explicit non-conclusion

This document does not select a Web閲覧用 pagination mechanism (discrete vs. scroll) or finalize its unit conversion constants. HD-001 fixed the product requirement; this document narrows the remaining engineering question but leaves it for Phase 2/3, consistent with Freeze §17 item 1's framing of this as now a narrower engineering question rather than a standing Human Decision.

# Core Invariants

- Status: DOCUMENTATION ONLY (P3-L02). These are the properties every future Phase 3 Core implementation loop (P3-L03+) must preserve; a change to any of these is an architecture-level decision, not a routine implementation choice, and should get its own Decision Record (Master §16) if ever proposed.

**INV-001 — Source mapping is never lost.** Every LogicalUnit and every PlacedUnit carries its originating SourceSpan, unmodified in meaning, through every transformation (tokenization, grouping, line-breaking, pagination). Contract §22.

**INV-002 — A renderer cannot change logical break decisions.** Preview and Publication renderers consume a finished CanonicalDocument; neither may re-decide a BreakDecision, re-group a ruby/TCY/dash unit, or move a PlacedUnit's logical position. Contract §28.

**INV-003 — Ruby annotation cannot move canonical body positions.** The base-position invariant (Master §25.6, re-verified 0.00px in Phase 2) holds for both atomic and jukugo ruby, unconditionally. Contract §9.

**INV-004 — Natural Pitch default never stretches merely to fill a page.** Residual space is retained and reported (`residualSpaceTick`), never silently absorbed by inflating character advance. Contract §18. No preset-specific pitch multiplier exists in any RuleSetVersion or LayoutSettings shape.

**INV-005 — Same input/rules/measurements yields the same logical layout.** Determinism holds for LogicalUnits, BreakDecisions, page/column/line assignment, PlacedUnit coordinates, SourceSpans, and Decision Trace semantics, given identical (normalized source, LayoutSettings, RuleSetVersion, MeasurementFacts). Renderer-level rasterization differences do not violate this. Contract §24.

**INV-006 — Manual page break is explicit and traceable.** Every `MANUAL_PAGE_BREAK` unit always produces a `MANUAL_FORCED` BreakDecision, recorded in the Decision Trace, regardless of remaining capacity. Contract §13/§23.

**INV-007 — Atomic/group ruby never internally breaks.** Every BreakOpportunity inside an `ATOMIC`-kind RubyUnit is `PROHIBITED_GROUP`. Contract §9.

**INV-008 — Jukugo-ruby internal break may occur only at represented legal segment boundaries.** A `JUKUGO`-kind RubyUnit's internal BreakOpportunities are `RUBY_INTERNAL_ALLOWED` only between declared `segments`, never mid-segment. Contract §8/§9. This does not authorize breaking ruby "anywhere" — it is scoped exactly to jlreq's cl-23 rule as recovered in P3-L01.

**INV-009 — Renderer-only glyph alignment cannot mutate Canonical Layout decisions.** A renderer's own measurement of how a glyph actually paints (e.g. the dash/ellipsis "slightly left-shifted" symptom, P3-O04/O05) may inform that renderer's own visual correction, but must never feed back into and change the Core's already-decided logical layout, coordinates, or MeasurementFacts. A different measurement means a new versioned MeasurementFacts bundle and a fresh Core run — never a live override. Contract §17.

**INV-010 — An unresolved serious layout condition cannot silently become Publication PASS.** If any LayoutError (or a Product-defined class of serious LayoutWarning) remains unresolved, `CanonicalDocument.hold` is true, and Publication approval must respect that per Master §17's Acceptance Principle. Contract §26.

**INV-011 — The Core never fractures a user-perceived character.** No BreakOpportunity, LogicalUnit boundary, or PlacedUnit split point falls inside a surrogate pair, combining-mark sequence, variation-selector pair, or emoji ZWJ sequence. Contract §6.

**INV-012 — The Core has no network dependency and no external-AI dependency.** Consistent with Master §12.1/§20.3, restated as a Core-level invariant, not merely a product promise: nothing in the Core Contract's input/output shapes requires or implies a network call. Contract §27.

**INV-013 — Canonical geometry is stored as integer micrometer ticks, and renderer-side unit conversion never becomes layout authority.** (Added at P3-L02 closeout, hardening the original 0.01mm proposal to 0.001mm/1-tick precision.) Every canonical layout fact — PlacedUnit coordinates, advances, line/column extents, ruby extents, residual space — is an integer `GeometryTick` (1 tick = 0.001mm), never a floating-point millimeter value; a formatted "X.XXX mm" string is diagnostic/UI display only, never canonical storage or a determinism (INV-005) comparison basis. A renderer converts ticks to its own native unit (CSS px, PDF pt) strictly at its own paint boundary; that conversion — and any measurement discrepancy it reveals — must never feed back into and change the Core's canonical tick values (this is the same boundary INV-009 already draws for MeasurementFacts, restated here specifically for geometry precision). Contract §21.

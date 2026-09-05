# TateSpun v2 — Canonical Logical Typesetting Core Contract

- **P3-L02: HUMAN/PRODUCT REVIEW COMPLETE (2026-09-06). CONTRACT: FROZEN FOR IMPLEMENTATION PLANNING.** No new Human Product Decision was required for this freeze — every choice restates an already-frozen Master/P3-L01 decision or is a low-risk, evidence-backed engineering default (see §32). Precision hardened to integer micrometer ticks (1 tick = 0.001mm) and the jukugo-ruby segmentation ownership boundary sharpened at closeout — see Master §27.
- **ENGINE IMPLEMENTATION: NOT STARTED.** This document freezes the contract only; no Phase 3 Core source code exists.
- Master updated to v1.7 (§27) to record this freeze.
- Builds on: Master §2/§5.2/§14/§25/§26 (frozen), `docs/architecture/PHASE2_ARCHITECTURE_NARROWING.md` (C1-NATURAL), `docs/standards/PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` (P3-L01, frozen Japanese rules), read-only inspection of `src/lib/pageLayout.ts` and `src/lib/tategaki.ts` (existing product behavior, not modified).
- Companion documents: `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md` (pseudocode shapes), `CORE_RESPONSIBILITY_MATRIX.md` (who owns which decision), `CORE_INVARIANTS.md` (the non-negotiable properties).

---

## 1. Purpose

Define, before any engine code is written, exactly what the Canonical Logical Typesetting Core is responsible for, what it receives, what it produces, and what it explicitly refuses to decide. This is the contract Phase 3 implementation loops (P3-L03+) build against, and the contract Phase 4/5 renderers (Publication/Preview) consume without re-deciding logical composition.

## 2. Core authority

Per Master §25.1/§25.5 (C1-NATURAL, renderer separation, already frozen — not reopened here): the Core owns **every decision that determines what the finished book means as a book** — page/column/line structure, which characters go where, where breaks happen and why, ruby/TCY/dash/ellipsis grouping, image placement in flow, and the deterministic coordinates of every placed unit. A renderer (Preview or Publication) owns **only how a already-decided placement gets painted** — glyph rasterization, anti-aliasing, exact sub-pixel glyph-box alignment, and file-format encoding (PDF bytes, JPG bytes). See §28 and `CORE_RESPONSIBILITY_MATRIX.md` for the row-by-row split.

## 3. Inputs

The Core accepts exactly three input categories, all local/client-side (§27):

1. **Normalized source content** (§5) — the manuscript, already run through the Source Model normalization step.
2. **Layout settings** (§16) — preset, page geometry, font references, sizes, columns, margins, ruby/TCY settings.
3. **Measurement facts** (§17) — a supplied, versioned bundle of font-metric/image-intrinsic-size data the Core needs but does not itself compute.

The Core never fetches network resources, never calls an external AI/service (Master §12.1/§20.3), and never reads the DOM.

## 4. Source model

**Source Block:** the top-level manuscript is divided into one or more Source Blocks (body text; a colophon is a distinct block kind, see §15). Each block has a stable `blockId`.

**Source Span:** `{ blockId, start, end }`, half-open range. **Offset unit recommendation: Unicode code point offset, not UTF-16 code unit offset, and not extended-grapheme-cluster index.** Rationale: jlreq's own character classification (P3-L01, `#cl-01`–`#cl-30`) operates per Unicode character (code point), not per user-perceived grapheme cluster or per UTF-16 unit; a code-point offset is stable, human-auditable in a decision trace, and avoids surrogate-pair splitting that a naive JS `string[i]` (UTF-16) index would risk. **This is a deliberate contract decision, not an accidental consequence of `String.prototype` indexing** — an internal implementation may still use UTF-16 arrays for performance, but the Core's *public* SourceSpan contract, decision traces, and any persisted/exported data are defined in code points, with an explicit, tested UTF-16↔code-point conversion boundary at the Normalizer (§29 lists the Normalizer as upstream of Core, owning this conversion once).

This is an engineering-internal decision with an obvious, low-risk default — not a Human Gate (see §32's "Open Questions Rule" scope).

## 5. Logical unit model

The Normalizer (upstream of Core, §29) turns raw source text plus TateSpun's existing inline notation (ruby markup, `【改ページ】`, `【IMG:...】`, dash/ellipsis runs) into a flat sequence of **LogicalUnits**, each carrying its SourceSpan. Unit kinds (§6 of the data model candidate has the exact shape):

- `TEXT` — one or more consecutive plain characters sharing no special structure
- `RUBY` — see §9
- `TCY` — see §10
- `DASH_RUN` / `ELLIPSIS_RUN` — see §11
- `MANUAL_PAGE_BREAK` — see §13
- `IMAGE` — see §14
- `COLOPHON_BLOCK` — see §15 (a whole Source Block, not an inline unit)

**Source representation vs. logical composition representation are explicitly distinct layers**: the Normalizer's job is recognizing *that* `【改ページ】` or `《とうきょう》`-style ruby markup means something structural; the Core's job is deciding *what happens* to that structural unit during composition (does it force a break, does its ruby overflow, etc.). The Normalizer does not make composition decisions; the Core does not re-parse raw notation.

## 6. Unicode/grapheme policy

**Minimum text atom: the Unicode code point, grouped into LogicalUnits no finer than an extended grapheme cluster boundary.** The Core must never place a break opportunity, or split a LogicalUnit, in the middle of: a surrogate pair, a combining-mark sequence, a variation-selector pair, or an emoji ZWJ sequence (relevant given Master §23's disclosed, limited emoji policy — emoji that do appear in UI or, in principle, in body text must not be split by a naive per-code-point kinsoku pass). Japanese-typesetting-specific grouping (ruby base groups, TCY groups, dash/ellipsis runs) is a **separate, coarser** grouping layer built on top of this grapheme-safe atom — not a replacement for it. This does not mean every atom gets identical typesetting rules (a combining-mark sequence and a kanji are typeset differently); it means the Core's *addressing* never fractures a user-perceived character.

## 7. Japanese character-class model

Per P3-L01 (frozen, `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`), the Core represents Japanese line-breaking as **data, not conditionals**. Conceptual shape (full pseudocode in the data model candidate):

```
CharacterClass {
  id                 // "cl-01".."cl-30" (jlreq numbering, P3-L01 SOURCE-001)
  mayStartLine       // boolean, derived from HG-1/HG-2-informed policy
  mayEndLine         // boolean
  inseparableGroupKey // for cl-08 only: keyed by specific character identity
                       // (EM DASH only pairs with EM DASH — P3-L01 finding),
                       // not by class membership alone
}
```

A **RuleSetVersion** (see §25) bundles: the class table, the mayStartLine/mayEndLine flags (with HG-1/HG-2's stricter-base-level policy baked in as the v2 default — cl-05, cl-12/13 now prohibited at line start per Master §26.1), the cl-08 inseparability pairing rule, and the hanging-punctuation scope (cl-06/cl-07 only, Master §26/P3-L01 confirmed). **How HG-1/HG-2 strict policy is injected:** as data in the shipped default RuleSetVersion, not as an `if (char === ...)` branch — a future looser conformance profile (jlreq's own "Level 1/Level 2," P3-L01) would be a *different* RuleSetVersion, not a code fork.

## 8. Break opportunity / decision model

Two distinct concepts, not one:

**BreakOpportunity** — a *candidate* position between two adjacent LogicalUnits/atoms, tagged with why it is or isn't a candidate: `ALLOWED`, `PROHIBITED_KINSOKU` (line-start/end class violation), `PROHIBITED_GROUP` (inside an inseparable cl-08 run, or inside an atomic ruby/TCY group), `RUBY_INTERNAL_ALLOWED` (inside a jukugo-ruby group, at a legal base-segment boundary — HG-3), `RUBY_INTERNAL_PROHIBITED` (inside a jukugo-ruby group, mid-segment), `MANUAL_FORCED` (a `MANUAL_PAGE_BREAK` unit).

**BreakDecision** — the *actual, final* choice the line/column/page-filling algorithm made at one specific opportunity, referencing which BreakOpportunity it resolved and why (capacity reached, manual force, hanging-punctuation deferral). Every BreakDecision is a Decision Trace event (§23).

Keeping these separate lets the Core answer "a break was considered here but rejected because X" (loop brief's own example) without conflating "could this break here" with "did the algorithm break here."

## 9. Ruby model

First-class, per Master §26.2/HG-3 and P3-L01's Ruby Standards Review. Two structurally distinct cases (a third, group-ruby, is a recorded CONTRACT GAP, not designed here — see §31):

- **Atomic/group ruby** (jlreq cl-22, Phase 2 Human-approved default): one base-character-group + one reading-annotation-run. `RUBY_INTERNAL_PROHIBITED` everywhere inside it. Matches Phase 2's existing "one unbroken annotation run" policy — **unchanged**.
- **Jukugo-ruby** (jlreq cl-23, HG-3 capability): a compound-word base range with **base segments**, each carrying its own reading segment, plus **legal internal break boundaries** between segments.

**Segmentation ownership boundary (hardened at P3-L02 closeout — not left as an unowned ambiguity):** the Logical Core's responsibility is to **honor** a `JUKUGO` RubyUnit's already-provided `segments` array — treat inter-segment positions as `RUBY_INTERNAL_ALLOWED` and intra-segment positions as `RUBY_INTERNAL_PROHIBITED` (§8) — and nothing more. The Core does **not** linguistically discover where a compound word's reading should be split per kanji; that is a **Normalizer / upstream Logical Analysis** responsibility (`CORE_RESPONSIBILITY_MATRIX.md`), occurring *before* a `JUKUGO` RubyUnit ever reaches the Core. Until that upstream segmentation mechanism itself is designed (a distinct future loop — candidates include explicit authoring markup, a deterministic local parser, or dictionary-assisted local analysis; **no candidate is chosen here**, and none may involve network/AI processing per Master §12.1/§20.3), a RubyUnit with no `segments` array is treated as `ATOMIC` by default. **The Core must never silently guess or invent segment boundaries on its own** — an un-segmented compound word stays atomic/unbroken (Phase 2's existing, valid behavior) rather than being split by an improvised heuristic.

Both cases preserve, unconditionally: the **base-position invariant** (ruby never moves body-text canonical coordinates — Master §25.6, re-verified 0.00px in Phase 2), full source mapping for both base and reading spans, and the existing geometry boundary clamp (CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN, Master §25.6) as the *retained* placement-safety layer (§9.1).

### 9.1 Ruby overhang contract (HG-4)

**Rule data is separate from placement mechanism.** A `RubyOverhangAllowance` table (keyed by adjacent CharacterClass, per P3-L01's jlreq findings — e.g. forbidden onto plain cl-19 kanji by the primary convention, up to full-width onto cl-08/cl-05) answers "given this adjacent class, how much may ruby overhang." The placement mechanism then combines that allowance with base/ruby extent and the **existing, retained** line/column geometry clamp to resolve final placement. **HG-4 approved the existence of this allowance table as a Core-representable concept, in principle — exact numeric values remain OPEN** (P3-L01, `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` row 22b) and are **not invented here**. Until a future Human decision supplies real values, the table may ship with all-zero/no-overhang-onto-anything-but-what-Phase-2-already-does entries, so the Core remains fully functional without fabricated numbers. CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN are the existing approved *names*; nothing here requires renaming them, but they are not treated as sacred API names either — if a cleaner name emerges during P3-L03 implementation, that's an implementation choice, not a re-litigation of the approved *behavior*.

## 10. TCY model

A `TCYUnit` carries: its SourceSpan, display text, the number of logical cells it consumes (structurally, per jlreq cl-30's atomic-group rule, P3-L01 — same-group unbreakable, different-group breakable), and an orientation intent flag for the renderer. **Auto-detection threshold (2-digit vs. up to 4-digit, P3-O07) is explicitly not decided by the Core contract** — the Normalizer may emit explicit `TCY` units from authoring markup without any auto-detection policy being frozen; auto-detection, if/when Product decides its threshold, becomes a Normalizer-level policy that emits the same `TCYUnit` shape. The Core's representational capability does not require P3-O07 to be resolved first.

## 11. Dash/Ellipsis model

A `SemanticRun` unit (covers both dash and ellipsis) carries its SourceSpan, a `runKind` (`DASH` / `ELLIPSIS` / `TWO_DOT_LEADER`), and enough structure for the break-decision layer to apply cl-08's same-kind-inseparable / different-kind-separable rule (P3-L01, resolved, `#notes_a3`). **Visual glyph centering/x-y alignment is explicitly excluded from this unit** — it carries no pixel offsets; P3-O04/O05 (visual alignment) remain Renderer-only concerns operating on the *painted* glyph, downstream of and blind to this semantic unit's own fields.

## 12. Hanging model

Hanging (ぶら下げ) is a **logical composition decision**, not a renderer option: given a `BreakDecision` where the next unit is cl-06/cl-07 (P3-L01-confirmed scope) and hanging is enabled in LayoutSettings, the Core decides *whether* the punctuation hangs past the nominal line/column capacity into one reserved slot (matching TSP-LOOP-029's existing single-slot design, read-only-confirmed in `tategaki.ts`) and records that decision in the Canonical Layout output (a placed unit flagged `hanging: true`) and the Decision Trace. The renderer paints the glyph at the position the Core assigned; it does not independently decide whether to hang.

## 13. Manual break model

A normalized `MANUAL_PAGE_BREAK` LogicalUnit, recognized by the Normalizer from `PAGE_BREAK_MARKER` (`【改ページ】`) using TateSpun's existing three-case disambiguation (alone-on-line vs. trailing-after-visible-text vs. literal-mid-sentence — read-only confirmed in `src/lib/tategaki.ts`'s `pageBreakCommandSpan`), **not** by the Core re-parsing raw strings. The Core receives an already-resolved, unambiguous unit and always records it as a `MANUAL_FORCED` BreakDecision in the Decision Trace (§8/§23) — a forced break is never silent.

## 14. Image model

An `ImageUnit` carries: a source/reference ID (not raw binary — Master §12.1 privacy contract keeps this local regardless, but the Core's contract layer deals in references), intrinsic dimensions or aspect ratio, layout constraints (matching the existing `【IMG:id:width:height:position】` notation's fields, read-only confirmed), break-before/break-after behavior, and its SourceSpan. Final image rendering (decode, scale, paint) is Renderer responsibility (§28); the Core decides *where in the flow* the image sits and what that does to surrounding line/column/page decisions.

## 15. Structured/page element model

Two categories, deliberately not mixed (loop brief's explicit instruction):

- **Manuscript-flow logical content**: body text and its LogicalUnits (§5), which participate in pagination, kinsoku, ruby, etc.
- **Page-decoration layer**: folio (page number) and 柱 (running header), which are derived *from* page position but are not part of the flowing manuscript content stream.

**Colophon (奥付)** is neither, cleanly: per Master §20.6/HD-006, it is a **distinct Source Block** (§4) that participates in the Canonical Layout Model (page placement, its own layout area, export inclusion — all Core-owned) but is explicitly **not** part of body-flow pagination (this mirrors, rather than abandons, the current TSP-LOOP-005 implementation's isolation of the colophon from body writing-mode/pagination — Master §20.6 requires it be brought *into* the Canonical Layout Model's authority, not that its flow-isolation be undone). It is represented as a `COLOPHON_BLOCK` at the CanonicalDocument level (data model candidate §"CanonicalDocument"), with its own page(s), not threaded through body LineLayouts.

## 16. Layout settings

The Core's required settings surface (existing TateSpun product concepts only — no new Editor UI state pulled in, per loop brief): page size/preset, writing orientation (vertical, per Master's publication-output scope — Editor's own optional horizontal/vertical mode, P3-O10, is out of Core's scope entirely), font family reference(s) (body, and independently overridable 柱/奥付 per Master HD-005), font size, line/column geometry (line pitch, char pitch — Natural Pitch, §18), column count, margins, ruby settings (enable/scale), hanging-punctuation enable, and page-numbering settings where they affect Core-owned layout (numbering scheme itself may be a lighter Product setting, but *where* the number sits on the page is Core/page-decoration-layer, §15).

## 17. Measurement-provider boundary

The Core is deterministic **given** a supplied `MeasurementFacts` bundle — it does not itself invoke a font-shaping engine or a browser. A `MeasurementProvider` contract (implementation TBD — HarfBuzz/browser/Canvas selection is explicitly out of scope here, per Master §7 white-sheet rule) supplies: natural per-character advance for a given font+size (Natural Pitch's raw input, §18), ruby-reading-run extent, image intrinsic size, and any font metrics kinsoku/hanging placement needs. **Measurement results are treated as versioned inputs** (§25), not something a renderer may silently recompute mid-flow and use to change layout — see INV-009 (`CORE_INVARIANTS.md`): a renderer may discover its *own* paint surface measures a glyph slightly differently (this is exactly Phase 2's dash/ellipsis "slightly left-shifted" symptom, P3-O04/O05) but that discovery may not feed back into and mutate the Core's already-decided logical layout. If a MeasurementProvider's facts turn out to be wrong for a given font, that is a new versioned MeasurementFacts bundle and a re-run of Core layout, not a live renderer override.

## 18. Natural Pitch

Contractually frozen (Master §5.2/§25.4, re-stated, not reopened): default character advance equals the MeasurementProvider's natural per-character advance for the declared font+size. **The Core must never stretch pitch merely to fill a page.** Residual space at the end of a column/page is retained as margin in the Canonical Layout output (an explicit `residualSpace` field on the relevant PageLayout/ColumnLayout, so it is visible and auditable, not silently absorbed). No preset-specific pitch multiplier exists anywhere in the RuleSetVersion or LayoutSettings shape — if TateSpun ever wants an alternate (e.g. legacy-justified-stretch) composition profile, per Master §25.4 that must be a distinct, explicitly-named composition mode selectable in LayoutSettings, never a hidden per-preset coefficient.

## 19. Capacity model

Building on the read-only-confirmed `pageLayout.ts` (`computeMaxCapacityChars`, `computeAutoCharsPerLine`, `computeAutoLinesPerColumn`, `deriveMaxCapacityFromMargins`): **capacity is derived from geometry** (page size, margins, font size, line pitch — all LayoutSettings inputs) via the existing formula family, **not** an independent explicit Product setting and **not** a validation-only output. It answers "how many logical cells/lines fit," which the Core's line/column/page-filling algorithm consumes as a hard ceiling. Under Natural Pitch (§18), reaching capacity before filling it exactly is the *expected*, correct outcome (residual margin) — capacity is a ceiling, not a target to stretch toward. This explicitly does **not** carry forward legacy `justified` stretch-to-exactly-fill behavior (Master §25.4 already ruled that out); P3-O12 (the B5/B6/新書 `computePageLayout` formula-vs-PoC discrepancy) remains a carried-forward, non-blocking open item for whichever P3-L0x loop first implements real capacity math against production presets.

## 20. Canonical page/column/line hierarchy

```
CanonicalDocument
  → CanonicalPage        (stable id, logical order, physical geometry)
    → CanonicalColumn     (for multi-column presets)
      → CanonicalLine      (stable id, logical order)
        → PlacedUnit        (one per rendered LogicalUnit-or-atom, with coordinates + SourceSpan)
  → ColophonBlock (0..1, page-decoration-layer-adjacent, not threaded through body columns/lines — §15)
```

Renderer DOM tree shape is never canonical — a Preview renderer's actual DOM nesting, or a Publication renderer's actual PDF object structure, is free to differ from this hierarchy's shape as long as it reproduces the same page/break/coordinate facts (Master §1.3).

## 21. Coordinate/unit policy

**Recommendation (not a Human Gate — see rationale): millimeters as the canonical *display/documentation* unit, backed internally by fixed-point integer micrometer ticks (1 tick = 0.001mm), for all Canonical Layout geometry.** Evidence: `src/lib/pageLayout.ts` (read-only-confirmed) *already* treats mm as the physical basis (`MM_PER_PT`, `PX_PER_MM`, `pxToInternalMm`, `cssPxToPhysicalMm` — px is explicitly a *derived* conversion, not the source of truth) and Master §6.1 already mandates print-oriented presets use pt/mm/em/font-units, not px, as canonical. Fixed-point integers (not floating-point mm) avoid accumulating drift across many-page documents and make determinism (§24) exactly checkable (byte/integer equality, not epsilon comparison). A Preview renderer converts ticks→CSS px at its own paint boundary (existing `PX_PER_MM`-style conversion, applied to the mm-equivalent of the tick value); a Publication/PDF renderer converts ticks→PDF points at its own paint boundary. Web preset's own logical-unit question (Master §6.2/HD-001, still explicitly open for Phase 1+) is unaffected — it governs whether a Web *preset's settings* are expressed in web logical units, not what unit the Core's internal Canonical geometry uses once settings are resolved into physical dimensions.

**Precision strategy (hardened at P3-L02 closeout): integer micrometer ticks, 1 tick = 0.001mm, not the originally-proposed 0.01mm.** Publication Quality is TateSpun's highest priority (Master §3); 0.01mm is unnecessarily coarse for repeated character-advance accumulation, fine ruby placement, and eventual Publication PDF output, where errors compound across many characters/lines/pages. 0.001mm ticks remain comfortably within a 32-bit integer range for any realistic page size and stay well below any humanly-visible difference. **Canonical layout facts (coordinates, advances, extents, residual space) are stored and compared as integer ticks, never as floating-point millimeters** — a formatted value like "12.345 mm" belongs to diagnostics/UI display, not to canonical storage or determinism comparison (§24). Renderer-boundary unit conversion (tick→px, tick→pt) is Renderer responsibility (§28) and never becomes a source of canonical layout authority (see INV-013, `CORE_INVARIANTS.md`).

## 22. Source mapping

Every PlacedUnit (§20) and every LogicalUnit (§5) carries its originating SourceSpan (§4) unmodified through every transformation — tokenization, unit expansion, ruby/TCY/dash grouping, line-breaking, pagination. This was already demonstrated representable in Phase 2 (P2-L05); this contract makes it a **named, checkable invariant** (INV-001, `CORE_INVARIANTS.md`) rather than an incidental PoC property.

## 23. Decision trace

A `LayoutDecisionTrace` is a sequence of trace events, each referencing: the SourceSpan involved, the rule/class that applied, what alternative(s) existed, and why a BreakDecision (§8) went the way it did — including hanging applied/not-applied and ruby-boundary-policy applied. This is an **engine evidence contract** for debugging, regression testing, and Human QA support diagnostics — not a Production UI requirement (no UI is implied or designed here). Trace verbosity must be independently reducible/disable-able **without changing layout results** (i.e., tracing is observational, never a side-channel that influences the decisions it records — this is itself worth stating as it rules out a whole class of "tracing changed timing/behavior" bugs).

## 24. Determinism

**Same normalized source + same LayoutSettings + same RuleSetVersion (§25) + same MeasurementFacts ⇒ same LogicalUnits, same BreakDecisions, same PageLayout/ColumnLayout/LineLayout assignment, same PlacedUnit coordinates, same SourceSpans, same Decision Trace semantics.** This was empirically verified for Phase 2's PoC engine (P2-L05, byte-identical repeated runs) and is now a named contract requirement, not merely an observed PoC property. **Renderer-level rasterization differences (anti-aliasing, sub-pixel glyph painting) do not violate this** — determinism is a property of the *logical* Canonical Layout output, not of rendered pixels (which Master §1.2/§1.3 already permit to differ between Preview and Publication).

## 25. Versioning/reproducibility

Canonical Layout output carries: `coreSchemaVersion` (this contract's own version), `ruleSetVersion` (§7 — which kinsoku/dash/ruby rule data was used, e.g. reflecting Master v1.6/§26's frozen HG-1–HG-4 defaults), `settingsVersion` (a hash/id of the LayoutSettings actually used), and `measurementIdentity` (which MeasurementFacts bundle, itself versioned/identified by font+size+provider-version) — sufficient for a saved project to be reproducibly re-laid-out later (supports reprints, regression tests, saved-snapshot fidelity) without solving cloud snapshot storage itself (explicitly out of scope, §29).

## 26. Warning/Error/Hold model

Not exception-only. Three structured severities:

- **LayoutWarning** — a non-blocking condition worth surfacing (e.g. a TCY group unusually long, an image aspect ratio unusual for its slot) that does not prevent a valid Canonical Layout from being produced.
- **LayoutError** — a specific unit could not be placed validly at all (e.g. malformed semantic notation the Normalizer passed through, an image with no resolvable intrinsic size and no MeasurementFacts entry).
- **LayoutHold** — the *document-level* condition that Publication approval must respect: if any LayoutError (or a Product-defined class of serious LayoutWarning) remains unresolved, the Canonical Layout is **HELD**, not silently treated as Publication-PASS-worthy (Master §17's Acceptance Principle already requires all listed PASS gates — this HOLD state is the mechanism that lets Publication respect that principle rather than rely on a human remembering to check). Exact hold-triggering thresholds per condition are an implementation-time detail, not designed exhaustively here.

## 27. Privacy boundary

Restated, not new: Core input/output requires no manuscript upload to any external AI/service (Master §12.1/§20.3). Nothing in this contract introduces a network dependency — MeasurementProvider (§17) is a local/client-side concept (a WASM shaper, a local font-metrics table, a headless-local browser measurement pass — implementation TBD, but not a network call by contract).

## 28. Renderer contract

A Preview or Publication renderer receives a Canonical Layout output (§20) and **may not**: re-decide any BreakDecision, move a PlacedUnit's SourceSpan-mapped logical position, re-decide ruby/TCY/dash grouping, or re-decide hanging. A renderer **may**: choose its own paint technology (DOM/Canvas/SVG/PDF-native/etc. — Master §7 white-sheet rule, still open), apply its own sub-pixel glyph alignment fixes (this is exactly where P3-O04/O05's eventual fix belongs), and convert mm→its own native unit (§21) at its own paint boundary. No specific renderer technology is selected by this document (loop brief's explicit boundary, restated).

## 29. Explicit non-Core responsibilities

Not designed, not owned by Core, and out of scope for this contract:

Editor undo/redo · Memo · session activity counter (Master §9.2) · SNS sharing · TXT import/export UI (though the *normalized source* it produces is Core's input, the I/O UI itself is not) · Editor Export Profiles transformations (P3-O11, separate Editor-side feature) · UI-C drawer or any Production UI surface · browser DOM · Canvas · PDF byte encoding · JPG byte encoding · network/cloud persistence · AI manuscript processing (Master §12.1/§20.3) · renderer visual cosmetics (P3-O04/O05 exact pixel fixes) · font shaping engine selection (Master §7) · Editor vertical-mode feasibility (P3-O10).

## 30. Compatibility matrix

| Feature | Status |
|---|---|
| Vertical Japanese prose | SUPPORTED BY CONTRACT (§5–§8) |
| All 8 mandatory presets | SUPPORTED BY CONTRACT (§16/§19/§21 — geometry-driven, preset-agnostic) |
| Kinsoku | SUPPORTED BY CONTRACT (§7/§8, HG-1/HG-2 baked into default RuleSetVersion) |
| Hanging | SUPPORTED BY CONTRACT (§12) |
| Ruby (atomic/group) | SUPPORTED BY CONTRACT (§9) |
| Jukugo ruby | SUPPORTED BY CONTRACT — Core honors provided segment boundaries (§9, HG-3); automatic segmentation *discovery* is an explicit **upstream (Normalizer/Logical Analysis) open policy question**, not a Core ambiguity — see `CORE_RESPONSIBILITY_MATRIX.md` and `PHASE3_OPEN_ITEMS.md` |
| TCY | SUPPORTED BY CONTRACT — explicit units (§10); auto-detection threshold is CONTRACT GAP (P3-O07, Normalizer-level, not blocking) |
| Dash/ellipsis runs | SUPPORTED BY CONTRACT (§11) |
| Manual page breaks | SUPPORTED BY CONTRACT (§13) |
| Columns | SUPPORTED BY CONTRACT (§20) |
| Page numbers | SUPPORTED BY CONTRACT (§15, page-decoration layer) |
| Images | SUPPORTED BY CONTRACT (§14) |
| Colophon | SUPPORTED BY CONTRACT (§15, distinct Source Block + CanonicalDocument-level element) |
| Web logical page model | SUPPORTED BY CONTRACT AT THE PAGE-MODEL LEVEL (§20 still uses CanonicalPage per Master HD-001) — Web preset's own settings-unit question (Master §6.2/HD-001) is a separate, still-open Phase 1-flagged question this contract does not re-decide |
| Group-ruby (distinct from atomic mono-ruby) | **CONTRACT GAP** — P3-L01 located the concept but not its jlreq break-rule; treated as atomic (same as mono-ruby) by default until researched further |

## 31. Open questions (carried forward, not new Human Gates — see §32)

- Group-ruby's exact break-rule (jlreq) — research gap, not a Product decision yet.
- Exact ruby-overhang numeric budgets (HG-4's residual, P3-L01 row 22b) — already OPEN, not re-opened here.
- TCY auto-detection threshold (P3-O07) — already OPEN, not re-opened here.
- P3-O12 (B5/B6/新書 real capacity-formula reconciliation) — carried forward for whichever loop first implements §19 against production presets.
- Exact LayoutHold trigger thresholds (§26) — implementation-time detail.

## 32. Human Gate

**Human Gate required for this contract: NO.** Every design choice in this document is either (a) a restatement/direct application of an already-frozen Master or P3-L01 decision, or (b) an engineering-internal detail with a low-risk, evidence-backed default (source-offset unit, geometry unit/precision, ruby-overhang-table existence-without-values) that does not fix any user-visible Product behavior irreversibly — per the loop brief's own Open Questions Rule, these receive a recommendation, not a question. The genuinely unresolved items (§31) are pre-existing OPEN items (P3-O07, P3-O12, HG-4's residual, group-ruby) that do not block this contract and are not re-litigated or forced into premature closure here.

---

## Appendix — Representative walkthroughs

Contract sanity checks only — no rendering, no code.

**CASE 1 — normal prose with kinsoku.** Source: "…と、彼は言った。" Normalizer emits `TEXT` LogicalUnits (with an `ELLIPSIS_RUN`/`DASH_RUN` sub-unit for the leading `…` if present per §11). Core's break-opportunity pass marks the position before `、` as `PROHIBITED_KINSOKU` (cl-07, all-levels rule, §7) and before `。` similarly (cl-06). If the line-fill algorithm reaches capacity exactly before `、`, the BreakDecision is `PROHIBITED_KINSOKU` → push `、` to the next line (追い出し) *or*, if hanging is enabled (§12), hang it in the reserved slot instead — both are recorded as trace events (§23) with the SourceSpan of `、` and the class rule that applied.

**CASE 2 — atomic/group ruby.** Source: base "東京" with reading "とうきょう" as one group (not per-character). Normalizer emits one `RUBY` LogicalUnit spanning both base and reading SourceSpans, `rubyKind: ATOMIC`. Every BreakOpportunity inside it is `PROHIBITED_GROUP` (§8/§9). Canonical output: one PlacedUnit group with base PlacedUnits at their normal coordinates (invariant: identical to no-ruby coordinates, §9) and reading PlacedUnits positioned via the geometry clamp (§9.1) relative to the base group's extent.

**CASE 3 — jukugo-ruby with a legal internal break.** Source: a compound word whose reading has already been segmented per-kanji **by the upstream Normalizer/Logical Analysis step** (segmentation *mechanism* itself not designed here, §9/§31 — the Core only ever consumes its output). Normalizer emits one `RUBY` LogicalUnit, `rubyKind: JUKUGO`, with `segments: [{baseSpan, readingSpan}, ...]`. The Core's break-opportunity pass marks the boundary *between* segments as `RUBY_INTERNAL_ALLOWED` (HG-3) and any position *inside* a single segment's base+reading pair as `RUBY_INTERNAL_PROHIBITED`. If the line-fill algorithm needs to break there, it may — recorded as a trace event citing the cl-23 rule.

**CASE 4 — explicit TCY unit.** Source: authoring markup marks "１２" as TCY. Normalizer emits one `TCYUnit` (no auto-detection involved, §10). Core treats it as one atomic group for break purposes (cl-30) and one logical-cell-consuming unit for line-capacity purposes; orientation intent flag tells the renderer to paint it combined.

**CASE 5 — ―― and …… semantic runs.** Source: "――そして、……"（trailing punctuation略）. Normalizer emits two `SemanticRun` units, `runKind: DASH` (2 chars) and `runKind: ELLIPSIS` (2 chars). Break-opportunity pass: within each run, same-kind-adjacent positions are `PROHIBITED_GROUP` (cl-08 same-kind rule, §11); the position between the DASH run's last char and the following `そして` text is a normal `ALLOWED` opportunity (different class entirely, not a cl-08 boundary case).

**CASE 6 — manual page break.** Source: "…章おわり。\n【改ページ】\n第二章…". Normalizer applies the existing three-case disambiguation (§13) and, since the marker is alone on its own line, emits a `MANUAL_PAGE_BREAK` LogicalUnit. Core's BreakDecision at that position is always `MANUAL_FORCED` regardless of remaining column capacity — recorded in the trace unconditionally (§13/§23), and the current column/page is closed even if under capacity (residual space retained per §18, not stretched).

**CASE 7 — image between text blocks.** Source: "…前の段落。\n【IMG:cover-sketch:800:600:center】\n次の段落…". Normalizer emits an `ImageUnit` with its reference ID, intrinsic 800×600 dimensions, and `center` placement constraint, SourceSpan covering the marker text. Core decides whether the image fits the remaining column capacity, whether it forces a break-before (if a full-width/full placement doesn't fit inline), and produces an `ImagePlacedUnit` with Core-owned coordinates; final decode/paint is Renderer's job (§14/§28).

**CASE 8 — two-column page.** Source: any body text under a `columns: 2` LayoutSettings (§16). Core's CanonicalPage contains two CanonicalColumns (§20); the line-fill algorithm fills column 1 to capacity (§19) before starting column 2, applying the same kinsoku/hanging/ruby/TCY/dash rules identically in both columns (no per-column rule variation — Master's "book as a whole" consistency principle, §1.3, restated). Each column's residual space (§18) is tracked independently.

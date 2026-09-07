# P3-O09 — Preview Renderer Closure Readiness Audit

## 1. Verdict

**P3-O09 HAS NARROW REMAINING TECHNICAL BLOCKERS — not ready to close as
fully DONE, but every named special-unit visual-quality item (Ruby anchor,
TCY, Dash, Ellipsis) is now closed.** The only genuine remaining gap found
by this audit is P3-O06's own residual (exact numeric ruby overhang
allowance values) — which the frozen roadmap already treats as a
**separate, narrower, distinct open item**, not a P3-O09 blocker in its
own right (`PHASE3_OPEN_ITEMS.md` P3-O04/P3-O06 rows both already say so
explicitly). Everything else audited below is either PASS, an intentional
disclosed architecture boundary, or explicitly out of P3-O09's own scope
(Production integration, Publication rendering, Core-only features like
F06 Hanging).

No code was changed by this audit. This is a documentation/audit task only.

## 2. Frozen Acceptance Criteria

No standalone "P3-O09 acceptance criteria" document exists separately from
the original task prompt. The closest frozen record is
`qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §7 ("15 MUST IMPLEMENT
items," all satisfied) and §16 ("21 P3-O09 FOUNDATION TESTS," all covered).
`PHASE3_OPEN_ITEMS.md` row P3-O09 itself lists the Foundation's own
"Not yet complete" bullet list at the time it was written: *"ruby
annotation geometry (blocked on Core wiring)... TCY/dash/ellipsis visual
polish, Production integration."* Every item in that list except
"Production integration" has since closed (ruby wiring: Ruby Placement
Micro-Loop, PASS; TCY: P3-O03, CLOSED; dash: P3-O04, CLOSED; ellipsis:
P3-O05, CLOSED, this session). "Production integration" was never part of
P3-O09's own scope — `P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §4 states the
Renderer's contract explicitly excludes any Production/`src/` dependency,
and Production integration is tracked as its own separate future work, not
a P3-O09 acceptance item.

## 3. Completed Capabilities

Confirmed PASS, directly from evidence (not from memory): CanonicalDocument
read-only consumption and immutability (§5 of the Foundation doc, test 1);
page/column/line/unit geometry via one-way `tickToPx` (§6); normal body
rendering — TEXT, paragraph/blank-paragraph, manual break, multi-column,
multi-page, Natural Pitch, bounded page window (§7, §9); image canonical
occupancy + placeholder resolver boundary (§10); Ruby body placement,
annotation geometry, and anchor correctness (all three Human Visual QA
HOLDs resolved — Page Content Clipping, Annotation Missing, Wrong Ruby
Anchor — final Human PASS recorded in `RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md`);
TCY visual (P3-O03 CLOSED); Dash visual (P3-O04 CLOSED); Ellipsis visual
(P3-O05 CLOSED, this session); HOLD/diagnostics distinction (§15); NORMAL
vs. DEBUG mode separation with zero debug leakage into NORMAL (tested
directly, e.g. `generateFoundationArtifact.test.ts` test 21); font/
measurement identity mismatch warning (`fontIdentityMismatch` field,
consumed by a visible `.font-warning` banner in `PreviewRenderer.tsx` —
confirmed present by direct read, §14 below); colophon paint function
(`buildColophonPaintPages`, reuses the identical body page/column/line/unit
paint path, proven against a hand-built `ColophonBlock` — §11 below).

## 4. Remaining Phase 3 Items

Directly read from `PHASE3_OPEN_ITEMS.md`'s current table: P3-O06 (Ruby
overhang exact values, NARROWED/READY FOR CORE CONTRACT at the rule-policy
level, residual exact numeric values still OPEN), P3-O07 (TCY
auto-detection Product policy, OPEN), P3-O08 (Publication renderer, OPEN),
P3-O10 (Editor vertical-mode feasibility, OPEN, Editor-side not Core/
Renderer), P3-O11 (Editor Export Profiles spec, OPEN, Editor-side),
P3-O13 (C2 dedicated shaping, DEFERRED, reopen-conditional only), P3-O14
(jukugo-ruby segmentation policy, OPEN, upstream Normalizer concern),
P3-O15 (group-ruby break rule, OPEN, narrow/low-priority). Plus, outside
the numbered P3-O register: F06 (Hanging punctuation, Core-logical,
deferred — confirmed via `qa/inventory/CURRENT_EDITOR_FEATURE_INVENTORY.md`
line 369/395, classified Category B, not a G1 blocker).

## 5. P3-O09 Blocker Classification

| Item | Classification |
|---|---|
| P3-O06 (Ruby exact overhang values) | **F — Product decision required** (jlreq documents multiple legitimate conventions; none chosen; not a P3-O09 blocker per §6 below) |
| P3-O07 (TCY auto-detection) | **B — P3-O09 non-blocking, separate item** (Normalizer/Editor-side; Renderer only consumes already-built `TCYUnit`) |
| P3-O08 (Publication Renderer) | **D — Publication-renderer only**, not a Preview blocker |
| P3-O09 remaining work | Production integration only — **C, Production-integration blocker, not a Preview-Renderer blocker** |
| F06 (Hanging) | **E — future/deferred Core-logical quality item**, not Renderer-scoped at all |
| Colophon (Preview artifact end-to-end fixture) | **B — non-blocking**, mechanism proven, narrow documentation/demo gap (§11) |
| Folio/Header | **E — future/deferred, pending Core data**, Renderer already handles absence correctly (§12) |
| Image resolver (real images) | **B — non-blocking**, intentional disclosed placeholder boundary (§10) |
| HOLD / diagnostics | PASS, not a blocker (§15) |
| Bounded page window / virtualization | **B — non-blocking**, explicitly sufficient for this foundation per its own evidence (§13) |
| Font identity / MeasurementFacts warning | PASS, not a blocker (§14) |
| Debug/source trace | PASS, not a blocker (§15) |

## 6. Ruby / P3-O06

Current state, confirmed by direct re-read of `RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md`:
body grouping PASS, canonical annotation geometry PASS, NORMAL Preview
annotation visible, Human anchor QA **PASS (Human Visual QA — Final Result,
2026-09-07)** — reading text visible, correctly anchored to the base run's
start, body unmoved, no cross-line/page displacement. Exact class-aware
overhang allowance values and final optical clamp tuning remain OPEN
(`DEFAULT_RULE_SET_V2.rubyOverhangAllowance` ships empty).

**Determination: P3-O09 does NOT require P3-O06 to be closed.**
`PHASE3_OPEN_ITEMS.md`'s own Notes section states: *"Items P3-O03/O04/O05
are Renderer-level, explicitly separated from Architecture-Narrowing by
Product Owner decision"* — P3-O06 is grouped with the ruby *rule* freeze
(P3-O01/O02/O06/O07), not with the Renderer-visual-quality trio. The Ruby
Placement Micro-Loop's own final entry explicitly closed its own scope
("canonical anchor correctness and basic visibility") while leaving P3-O06
"explicitly OPEN," and immediately named **P3-O03 (TCY visual)** — not
P3-O06 — as the next frozen Preview Renderer item, confirming the frozen
roadmap's own view that Preview Renderer progress does not wait on P3-O06's
exact values. This is the legitimate "P3-O09 can close while P3-O06 stays
open" outcome — Ruby is visually *functional and anchored correctly* today;
what remains is optical *fine-tuning* of overhang numbers, a distinct,
narrower Product/Human question already tracked under its own ID.

## 7. TCY / P3-O07

Explicit TCY visual: **PASS/CLOSED** (P3-O03, Human Visual QA confirmed).
Auto-detection (P3-O07): confirmed by `CURRENT_EDITOR_FEATURE_INVENTORY.md`
line 314 and `PHASE3_OPEN_ITEMS.md` row P3-O07 to be a **Product-policy
decision about source interpretation** (2-digit vs. up to 4-digit
threshold) — upstream of Core/Renderer entirely; `TCYUnit` is only ever
produced by explicit fixture/Normalizer input today, never inferred inside
`renderer/preview/` (confirmed directly, `P3_O09_PREVIEW_RENDERER_FOUNDATION.md`
§12: "No auto-detection logic exists"). **Classification: P3-O09
NON-BLOCKING.** Not implemented here, per instruction.

## 8. Publication / P3-O08

Publication Renderer (PDF/JPG output) is a wholly separate, still-OPEN
item (`PHASE3_OPEN_ITEMS.md` row P3-O08), explicitly deferred past Phase 2
by Master §7's white-sheet rule and confirmed by
`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §2's own "Roadmap contradiction
check": Preview and Publication are recorded as **independent, parallel
output-technology tracks** over the same `CanonicalDocument`, not a
sequential dependency in either direction. **Classification: P3-O09
NON-BLOCKING; Publication-renderer blocker for a later release only.** No
PDF/JPG generation performed in this audit.

## 9. Hanging / F06

F06 (Hanging punctuation, ぶら下げ) is a **Core-logical** feature, not yet
implemented in v2 Core at all — confirmed via
`CURRENT_EDITOR_FEATURE_INVENTORY.md` ("Core — F06, classified Expected
Deferred/Later Logical Stage, not yet implemented in v2") and P3-L15A's
own loop-log classification as "Category B, not a G1 blocker." Because the
Preview Renderer only ever paints whatever `CanonicalDocument` geometry
Core already produced (§4/§5 of the Foundation evidence — no
line-breaking/kinsoku/hanging logic exists anywhere in `renderer/preview/`),
there is nothing for the Renderer to paint differently once F06 eventually
lands in Core — the Renderer's existing generic per-atom paint path
requires no Renderer-side change to support it. **P3-O09 can close without
F06.** Not implemented in this audit, per instruction.

## 10. Images

Current P3-O09 state, confirmed by direct re-read of
`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §10: canonical image occupancy
PASS (Core-owned, untouched); Preview paint is a deliberate
`ImageResolver` abstraction boundary, with `defaultPlaceholderImageResolver`
always returning `PLACEHOLDER` (no network/file access, no decode) — "by
design," not an unfinished stub apologized for. Surrounding text is never
repositioned based on any resolved-image dimension.

**Determination:** the frozen P3-O09 scope (§4, "Final Renderer Contract")
never named "real image decoding" as a requirement — only the resolver
*boundary* and canonical occupancy paint. **Classification: P3-O09
NON-BLOCKING.** A real image resolver (actual file/network resolution) is
future work, not a gap in the Renderer's own architecture.

## 11. Colophon

Current state, confirmed by direct re-read of
`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §14: `buildColophonPaintPages`
reuses the exact same page/column/line/unit paint logic as the body,
proven by "a direct test reusing an already-composed page's real geometry
as a hand-built `ColophonBlock`." A separate colophon export path already
exists and shipped (`TSP-LOOP-005`, per this session's own prior work —
horizontal 奥付 page export via the existing pipeline). **Gap found:**
`renderer/preview/fixtures.ts`'s `ALL_FIXTURES` (the Human-visible
`p3-o09-preview` artifact) contains no colophon fixture — the mechanism is
proven at the unit-test level but not demonstrated end-to-end in the main
Human-visible Preview artifact.

**Determination:** this is a narrow documentation/demo completeness gap,
not an architecture gap — the paint function is proven correct against
real geometry, and TSP-LOOP-005 already validated colophon rendering
through its own export pipeline. **Classification: P3-O09 NON-BLOCKING /
PARTIAL** (mechanism complete; a colophon fixture in the main artifact
would be a nice-to-have follow-up, not a blocker).

## 12. Folio / Header

Confirmed by direct re-read (`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §14):
`CanonicalPage.folio?: PlacedUnit` exists in Core's schema but is never
populated anywhere in `core/` (grep-confirmed: `folio` appears only in its
own type declaration). `PaintPage.folio` passes the field through
unchanged; the Renderer correctly paints nothing extra when it is absent.
This is recorded as **PENDING CORE DATA** — a Core-level gap (nobody has
decided/implemented what folio/header content or placement should be),
not a Renderer defect. `folio`/header has no numbered P3-O tracking entry
of its own in `PHASE3_OPEN_ITEMS.md` (confirmed by direct grep — zero
matches).

**Determination:** the Renderer's own architecture already correctly
handles "no folio data" (renders nothing, doesn't crash, doesn't fabricate
placement). **Classification: P3-O09 NON-BLOCKING / PENDING CORE DATA** —
this is a future Core-population task, not a Preview Renderer blocker.

## 13. Performance

Confirmed by direct re-read (`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §9):
bounded page window (`ctx.maxPages`/`renderedPageCount`/`totalPageCount`)
PASS; `PreviewPage` is a standalone, independently-invocable component (the
"stable Page component boundary" needed for future virtualization). Full
windowed/lazy-DOM virtualization is explicitly **not implemented**, per
that task's own instruction that bounded composition is "sufficient for
this foundation." No frozen document states full virtualization is
required for P3-O09 closure. **Classification: P3-O09 NON-BLOCKING.** Not
implemented in this audit.

## 14. Font / Measurement Identity

Confirmed by direct code read (not assumed): `paintModel.ts` line 473
computes `fontIdentityMismatch: ctx.measurementIdentity !== ctx.paintFontIdentity`,
and `PreviewRenderer.tsx` line 278 renders a visible
`<div className="font-warning">FONT / MEASUREMENT IDENTITY MISMATCH —
painted with a different font identity than the document was composed
against; no remeasure performed.</div>` when true. This satisfies the
frozen principle ("Renderer must not remeasure/reflow; if paint font
identity differs from MeasurementFacts, Preview should warn but not
re-layout") exactly — a warning is shown, no re-layout occurs (no code
path exists in `paintModel.ts` that reads `paintFontIdentity` to trigger
any recomposition). **Status: PASS.** Not a blocker.

## 15. HOLD / Diagnostics

Confirmed by direct re-read (`P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §15):
HOLD documents never render `pages`, only a banner with `holdReasons`
(both NORMAL and DEBUG mode, since HOLD is real content information, not
dev-only chrome) — structurally distinguishes an unresolved/fatal document
from an approved layout; source/debug trace (`PaintDebugInfo`: page/
column/line order, source span, unit kind, raw `yTick`, paragraph-start/
manual-break flags) exists and is DEBUG-mode-surfaced, confirmed absent
from NORMAL mode by a direct test (`generateFoundationArtifact.test.ts`
test 21). **Status: PASS.** Not a blocker.

## 16. Acceptance Matrix

| Requirement | Status | Evidence | Blocker? | Required action |
|---|---|---|---|---|
| CanonicalDocument authority | PASS | Foundation §5, test 1 | No | None |
| Renderer immutability | PASS | Foundation §5, test 1 | No | None |
| TEXT | PASS | Foundation §7 | No | None |
| Paragraph | PASS | Foundation §7/§8 | No | None |
| First-line indent | PASS | Foundation §8, test 7 | No | None |
| Blank line | PASS | Foundation §7, test 10 | No | None |
| Manual page break | PASS | Foundation §8, test 8 | No | None |
| Multi-column | PASS | Foundation §7, test 11 | No | None |
| Multi-page | PASS | Foundation §7, test 12 | No | None |
| Natural Pitch | PASS | Foundation §7 | No | None |
| Ruby | PASS (anchor); P3-O06 residual OPEN | `RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md` Final Result | No (see §6) | None for P3-O09; P3-O06 tracked separately |
| TCY | CLOSED/PASS | `P3_O03_TCY_VISUAL.md` | No | None |
| Dash | CLOSED/PASS | `P3_O04_DASH_VISUAL.md` | No | None |
| Ellipsis | CLOSED/PASS | `P3_O05_ELLIPSIS_VISUAL.md` | No | None |
| Image | PASS (placeholder boundary, by design) | Foundation §10 | No | Real resolver is future work |
| Colophon | PARTIAL (mechanism PASS, no artifact fixture) | Foundation §14 | No | Optional: add fixture to main artifact |
| Folio | PENDING CORE DATA | Foundation §14 | No | Future Core population task |
| Header | PENDING CORE DATA | Foundation §14 | No | Future Core population task |
| HOLD | PASS | Foundation §15 | No | None |
| Font identity warning | PASS | `paintModel.ts:473`, `PreviewRenderer.tsx:278` | No | None |
| Page window | PASS (bounded, not virtualized) | Foundation §9 | No | Full virtualization is future work |
| Debug/source trace | PASS | Foundation §15, test 21 | No | None |
| Normal/debug separation | PASS | Foundation §15, test 21 | No | None |
| Production independence | PASS | Foundation §4 | No | Production integration is separate future work, not a P3-O09 item |

## 17. Closure Decision

**B. P3-O09 HAS NARROW REMAINING TECHNICAL BLOCKERS.**

Listed in dependency order — none are Preview Renderer architecture gaps;
all are either separate tracked items or future non-blocking work:

1. None of the audited items above are an actual P3-O09 architecture
   blocker. Every row in §16 is PASS, PARTIAL-non-blocking, or explicitly
   deferred to a different, already-tracked item (P3-O06, P3-O07, P3-O08,
   F06, Core folio/header population, real image resolution, full
   virtualization, Production integration).
2. The one item worth a small, optional follow-up (not required for
   closure): add a colophon fixture to the main `p3-o09-preview` artifact
   so the already-proven mechanism is also Human-visible end-to-end
   alongside body content.

Given that every named special-unit visual-quality item this task's own
history tracked (Ruby anchor, TCY, Dash, Ellipsis) is now Human-PASS
CLOSED, and every other audited gap is a distinct, separately-tracked, or
explicitly-deferred item rather than a defect in the Preview Renderer's
own architecture, **P3-O09 could reasonably be recorded CLOSED for its own
architectural scope** — but this document does not unilaterally declare
that closure. Whether "P3-O09 Preview Renderer implementation" as a
roadmap line item should be marked CLOSED now (with P3-O06/O07/O08/F06
correctly remaining separately OPEN), or should stay IN PROGRESS until the
optional colophon-fixture follow-up lands, is offered as a recommendation
for Human/Product sign-off, not decided unilaterally here.

**Human Product Decision Required: YES** — specifically and only: should
`PHASE3_OPEN_ITEMS.md` row P3-O09 be marked CLOSED now (recommended), or
held IN PROGRESS pending the optional colophon-fixture addition?

## 18. Exact Next Technical Task

Independent of the Product decision in §17: no technical work is blocking.
If Product confirms P3-O09 closure now, the next available, independently
startable items (no dependency on each other) are: (a) P3-O06's exact
ruby overhang numeric values (a Product/Human decision, not a technical
one); (b) P3-O07's TCY auto-detection threshold policy (Product decision);
(c) P3-O08 Publication Renderer selection/proof (separate track). None of
these was started or implemented in this audit.

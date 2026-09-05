# Phase 2 — Architecture Narrowing

- Status: **RECOMMENDATION — pending Human Gate.** Nothing in this document is a final architecture selection. Per Master §14/§16, a Decision Record equivalent to this one requires Human approval before it becomes binding.
- Scope: this document narrows the **Phase 3 logical-typesetting-core direction** only. It does not select a final PDF library, Preview renderer technology, TCY/dash/ellipsis rendering fix, or complete the Japanese standards tables. See §9/§13 for exactly what remains open.
- Full loop-by-loop evidence: `PHASE2_EVIDENCE_SUMMARY.md`. Raw loop log: `../../research/PHASE2_LOOP_LOG.md`.

---

## 1. Scope of the decision

The question this document answers: **which architecture should become the Phase 3 logical-typesetting-core direction** — the layer that owns page/column/line structure, logical units, source ranges, break decisions, ruby associations, TCY groups, and deterministic coordinates?

It does **not** answer: which technology paints pixels for Preview (Phase 5) or Publication (Phase 4); whether TCY/dash/ellipsis's remaining visual defects are fixed a particular way; whether the full JLREQ/JIS kinsoku/ruby/dash tables are correct. These are separated deliberately — Master §7's white-sheet rule defers technology selection, and Phase 2's Human decisions (P2-L06) explicitly deferred the renderer-level items to Phase 3.

## 2. Evidence reviewed

Every Phase 2 loop (P2-L01 through P2-L07E), both PASS and HOLD, per `PHASE2_EVIDENCE_SUMMARY.md`. Both structural PoC evidence (P2-L05: kinsoku/hanging/ruby/TCY/dash/ellipsis representability, determinism, source mapping) and visual/Human evidence (P2-L02/03/04/06/07 series: multi-preset comparison, root-cause diagnosis of preset-dependent results, true vertical-page rendering, ruby body-invariant and boundary-clamp verification) were used. Two real formula/rendering bugs were caught and fixed in-flight (A5 2段 stacking model, P2-L02; ruby annotation sizing, P2-L07B) and one evidence-table display bug was caught and fixed (P2-L07E) — all documented rather than silently corrected.

## 3. C1-NATURAL

**Concept:** explicit, deterministic logical layout + natural (1em) declared-pitch composition + residual space allowed as margin + renderer separated from logical decisions.

**Evidence for:**
- Publication Quality (Human): preferred/acceptable on 文庫, A5 1段, A5 2段, B6, A6 (P2-L02), and on A5 1段, 新書, corrected Web閲覧用 specifically as C1-NATURAL (P2-L04) — with both previously-identified defects (B5 sparse, Web cramped) judged **improved** relative to the C1-JUSTIFIED baseline.
- Determinism: verified programmatically, not just claimed — every P2-L05 fixture (kinsoku, hanging, ruby, TCY, dash, ellipsis) produced byte-identical structural output across repeated runs (`scripts/determinism-check.json`).
- Source mapping: every logical unit (character, ruby-base group, TCY run, dash/ellipsis run) retains its manuscript `[start, end)` range through tokenization, unit expansion, and line-breaking (P2-L05 `evidence/P2_L05_SOURCE_MAPPING.md`).
- Japanese-rule structural control: kinsoku push-out, hanging-with-riding-bracket, ruby grouping, TCY 1-cell collapse, and dash/ellipsis keep-together-or-defer-whole were all demonstrated via a genuine rule-decision layer that runs **before** any position is assigned — not derived from browser measurement.
- Ruby (the last open architectural question): body-position invariant confirmed via an ACTUAL rendered-DOM measurement (`getBoundingClientRect`, not just a logical-coordinate claim) — 0.00px delta on both axes for 東/京; annotation no-wrap fixed and verified (P2-L07B); geometry-based boundary clamping (CENTER/START_CLAMP/END_CLAMP) implemented, independently unit-tested, and Human-approved (P2-L07C/D/E). Final Human gate: **PASS**.

**Known renderer gaps (not architecture gaps):** TCY visual combine (`text-combine-upright`) not yet working correctly in the shared renderer; dash/ellipsis final visual alignment not yet confirmed — both explicitly deferred to Phase 3 Renderer work by Product Owner decision (P2-L06), not blocking this narrowing.

**Risk:** the PoC's rule-decision algorithm (`scripts/engine.js`) is explicitly a new, simplified, single-pass reimplementation — not `tategaki.ts`'s own iterative algorithm, and not yet handling the full kinsoku class table or a resolved dash/ellipsis primary-source rule (both remain Phase 3 standards blockers, P3-O01/O02, independent of architecture).

## 4. C3 (browser-native)

**Evidence:** visually competitive on some presets — preferred outright on B5 (P2-L02, P2-L04) and received a marginal preference from a second Human reviewer in P2-L01's single-sentence 文庫 comparison. Capable of natural-looking basic vertical prose with zero compensation layer.

**Strengths:** simplicity; native browser painting; good baseline visual rhythm; zero new infrastructure.

**Limitations (control/authority, not visual quality):** every P2-L02/04 C3 sample relied on the browser's own uncontrolled reflow — there is no TateSpun-owned, source-mapped break-decision trace equivalent to C1-NATURAL's (P2-L05's central deliverable). Master §4.1 already establishes that browser-native behavior is not the Publication Quality authority regardless of how it looks. Determinism and rule-reproducibility are structurally weaker as a *contract*, independent of any single comparison's visual outcome.

**Recommended role:** control/reference baseline and a candidate **painting** technology for whichever Preview/Publication renderer Phase 3-5 select — not the logical-layout authority.

## 5. C2 (dedicated shaping)

**Evidence:** HarfBuzz-via-WASM shaping proven feasible (P2-L01) — real glyph IDs, advances, and offsets measured against Shippori Mincho; vertical OpenType features (`vert`/`vrt2`/`vpal`) tested and measured, not assumed. Concretely falsified the hope that dedicated shaping alone "solves" the punctuation-gap problem: `vpal` nudges glyph offset only, never advance, in the one font tested.

**Why deferred, not rejected:** the P2-L01/L01B/L01C comparison was never made fair/legible enough for a final visual Human verdict (clipping/scale bugs), and once C1-NATURAL independently passed Human QA (P2-L04 onward), there was no further evidence-driven reason to keep developing C2 in parallel.

**Reopen conditions:** (a) a required glyph-level behavior proves unreachable via C1-NATURAL + browser painting; (b) the Publication PDF path (P3-O08) specifically requires dedicated shaping evidence to achieve genuine vector/selectable text with full shaping control.

## 6. Logical layout authority recommendation

**Recommend C1-NATURAL's explicit logical layer as the Phase 3 logical-typesetting-core authority** — owning page/column/line structure, logical units, source ranges, break decisions, ruby associations, TCY groups, semantic runs, and deterministic coordinates — over C3's browser-native authority. Evidence basis: only C1-NATURAL produced a reproducible, source-mapped, independently-verifiable decision trace (P2-L05's central deliverable, unmatched by any C3 sample in any loop); C3's competitive visual results (B5, marginal 文庫 preference) are about painting quality, not about which side owns composition decisions, and Master §4.1 already rules out "the browser decided it" as a sufficient basis for Publication Quality regardless of appearance.

## 7. Natural-pitch recommendation

**Recommend natural (1em) pitch as the default logical composition principle for Phase 3**, per Master §5.2's already-frozen "prefer natural pitch over forced page-fill" principle — now with direct empirical support: B5's ~1.44× and 新書's ~1.27× legacy `justified` stretch were the two presets Human QA reacted against, in a clear dose-response pattern across all 8 presets (P2-L03), and switching to natural pitch measurably improved both without any preset-specific tuning (P2-L04). Residual space is treated as margin, matching Master §5.2 directly — this is not a new principle, this is the first empirical confirmation of an existing one.

**文庫's mild preference for legacy `justified` (P2-L04) is recorded, not authorized as an exception.** 文庫's stretch ratio (~1.05×) is mild enough that the Human didn't react against it — this is consistent with, not contradictory to, natural pitch as the *default* principle. No preset-specific optical multiplier is introduced or implied by this recommendation.

## 8. Renderer separation recommendation

**Recommend preserving** Master §2's `Manuscript → Typesetting Engine → Canonical Layout Model → Preview Renderer → Publication Renderer` pipeline. Phase 2 evidence supports this directly: every C1-NATURAL PoC already demonstrates the logical decision layer (`engine.js`) producing output consumed by a *replaceable* painting step (plain HTML/CSS in Phase 2's PoCs) — the same logical decisions were never re-derived per renderer. That the PoC renderers currently use browser painting is a Phase 2 convenience, **not** a selection of the final Publication renderer technology (Master §7 white-sheet rule remains in force for that choice; see P3-O08/O09).

## 9. Phase 3 deferred Renderer items

TCY visual renderer (P3-O03), dash final alignment (P3-O04), ellipsis final alignment (P3-O05) — all explicitly deferred to Phase 3 Renderer work by Product Owner decision in P2-L06. **Not resolved. Not Architecture-Narrowing blockers.**

## 10. Phase 3 standards blockers

Full kinsoku class table (P3-O01), dash/ellipsis primary-source rule (P3-O02), ruby final overflow/distribution standards (P3-O06), TCY auto-detection Product policy (P3-O07). Full detail: `PHASE3_OPEN_ITEMS.md`. None of these block starting Phase 3 architecture work; all block the final Japanese-typesetting-rule freeze that must happen before that work is considered complete.

## 11. Risks

- `scripts/engine.js`'s break-decision algorithm is a simplified single-pass reimplementation, not `tategaki.ts`'s battle-tested iterative one — Phase 3 must decide whether to port, replace, or redesign it, informed by (not blocked on) this PoC.
- The B5/B6/新書 `justified`-vs-`computePageLayout` discrepancy (P3-O12) means the exact production capacity formula for those three presets should be re-confirmed before Phase 3 treats any Phase 2 preset arithmetic as production-ready.
- TCY's `text-combine-upright` renderer bug (P3-O03) is unresolved and its root cause unknown — Phase 3 should budget real investigation time, not assume a quick fix.
- Ruby's boundary-clamp policy (CENTER/START_CLAMP/END_CLAMP) is a Human-approved **Product/Renderer policy**, explicitly not a claim of JLREQ/JIS standards compliance (P3-O06) — must not be mistaken for a closed standards question.

## 12. Reopen conditions

- **C2**: per §5 above.
- **C3 as logical authority**: would require new evidence that C1-NATURAL's decision-layer approach cannot represent a required behavior without collapsing into renderer-specific hacks — no such evidence exists in any Phase 2 loop to date.
- **Natural-pitch default**: would require new preset-specific Human QA evidence overturning the dose-response pattern found in P2-L03/P2-L04 — a single preset's mild preference (文庫) is not such evidence.

## 13. Explicit non-decisions

This document does **not** select: a final PDF/Publication renderer technology (P3-O08 open); a final Preview renderer technology (P3-O09 open); a fix for TCY/dash/ellipsis rendering (P3-O03/04/05 open); the full kinsoku/dash/ellipsis/ruby-overflow standards tables (P3-O01/02/06/07 open); Editor vertical-mode feasibility (P3-O10, out of Typesetting Engine scope); Editor Export Profiles implementation (P3-O11, recorded as a requirement only, see `EDITOR_EXPORT_PROFILES_MEMO.md`). It does not reopen any already-frozen Master §18-§24 Human Decision.

## 14. Recommended Phase 3 starting architecture

**Primary Phase 3 logical-typesetting-core candidate: C1-NATURAL's explicit, deterministic, source-mapped logical layer**, using natural (1em) declared pitch as the default composition principle, with residual space treated as margin, and with the existing Master §2 renderer-separation pipeline preserved (logical core independent of whichever Preview/Publication painting technology Phase 3-5 eventually select).

**C3 (browser-native)**: retained as a visual control/reference baseline, and as a candidate **painting** technology for a future renderer — not as logical-layout authority.

**C2 (dedicated shaping)**: retained as a **deferred, reopenable** shaping option, per the reopen conditions in §5/§12 — not rejected.

---

## Architecture decision matrix

| Axis | C1-NATURAL | C3 (browser-native) | C2 (dedicated shaping) |
|---|---|---|---|
| Publication Quality evidence | Human-preferred/acceptable on 6/8 tested presets, both known defects improved (P2-L02/04) | Preferred on 2/8 (B5, Web-marginal); good baseline rhythm, no compensation | Not brought to a fair final Human comparison (P2-L01B/C) |
| Determinism | Verified twice per fixture, code-level (P2-L05) | Relies on browser's own (uncontrolled) reflow | N/A — shaping-level only, not brought to a layout PoC |
| Source mapping | Every unit source-mapped through every stage (P2-L05) | None — no TateSpun-owned decision trace | N/A |
| Rule traceability ("why did this line break here?") | Full trace artifact exists (P2-L05 `P2_L05_BREAK_DECISION_TRACE.md`) | Not reproducible/inspectable | N/A |
| Kinsoku control | Explicit rule-decision layer, pre-position (P2-L05) | Browser-native, opaque | N/A |
| Hanging control | Explicit, geometry-derived (P2-L05) | Browser-native, opaque | N/A |
| Ruby support | Body-invariant + no-wrap + boundary-aware centering, all independently verified (P2-L07 series) | Native `<ruby>`, opaque, not tested for invariant | N/A |
| TCY logical support | 1-cell collapse, source-mapped (P2-L05); visual combine still broken (P3-O03) | Native, not decision-traced | Real shaping measured (P2-L01), not carried to layout |
| Renderer flexibility | Logical layer independent of paint technology, demonstrated (§8) | Painting and (implicitly) decision-making coupled | N/A |
| PDF path | Shares the still-open P3-O08 question (Publication renderer not yet selected) | Same (native print-to-PDF confirmed selectable-text-capable for single-page content, P2-L01) | Would need its own PDF-operator path if reopened |
| Browser dependence | Uses browser for painting only, in current PoCs | Full dependence (shaping + painting + layout) | None for shaping; independent of browser |
| Complexity | Higher than C3 (new decision layer); lower than C2 (no new shaping engine) | Lowest | Highest (WASM shaping engine + integration) |
| Reopen risk if wrong | Low — decision layer is a thin, replaceable abstraction over painting | N/A (not being selected as authority) | Low — genuinely reopenable, no sunk architecture cost from deferring it |

Evidence-backed prose, not arbitrary numeric scoring, per instruction.

---

## Human Gate — approval requested

1. Approve C1-NATURAL as the Phase 3 logical-typesetting-core direction? —
2. Keep C3 as browser-native control/reference rather than Core authority? —
3. Keep C2 deferred but reopenable? —
4. Approve natural-pitch default principle (§7)? —
5. Approve renderer separation (§8)? —
6. Accept the Phase 3 deferred/open-item register (`PHASE3_OPEN_ITEMS.md`)? —
7. Approve the Editor Export Profiles requirement for later specification (`EDITOR_EXPORT_PROFILES_MEMO.md`)? —

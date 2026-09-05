# Core Migration / Rollback Plan

- Status: **P3-L03: REVIEWED / FROZEN FOR IMPLEMENTATION (2026-09-06, Master v1.8 §28.9).** Core implementation: NOT STARTED. The old TateSpun engine (`src/lib/pageLayout.ts`, `src/lib/tategaki.ts`, and their callers) is untouched by this plan and stays untouched through every stage below except the explicit Stage G integration gate — and even then, it is not deleted.

## 1. Migration stages

| Stage | Description | Old engine status | New Core status |
|---|---|---|---|
| **A** | Isolated v2 Core development (`typesetting-v2/core/`) — P3-L04 through P3-L14 | Untouched, fully live in Production | Pure, isolated, not imported by anything in `src/` |
| **B** | Core contract regression complete — P3-L15 passes, Gate G1 Human review done | Untouched | All INV-001–013 verified together; still not imported by `src/` |
| **C** | Non-Production adapter / comparison mode — a small, explicitly separate comparison harness (e.g. `typesetting-v2/tools/compare/`) runs the same manuscript through both old engine and new Core and diffs *logical* results (page count, break positions) — no shared runtime coupling | Untouched | Read-only consumer of old engine's output for comparison; still not wired into `src/` runtime |
| **D** | Preview comparison behind an explicit development path (e.g. a local-only dev route or flag, never default-on in Production) | Untouched | First point a Preview Renderer (P3-O09, separate future work) consumes Core output for visual comparison |
| **E** | Publication comparison — same idea, for PDF/print output (P3-O08, separate future work) | Untouched | Publication Renderer consumes Core output; compared against old engine's Publication output |
| **F** | Human QA across mandatory presets — all 8 presets visually reviewed via both Preview and Publication comparison paths | Untouched | Full visual+logical parity (or an intentionally-approved divergence) established per preset |
| **G** | Controlled integration — new Core becomes the default logical engine for some or all of Production, behind explicit Human/Product approval (see `P3_CORE_IMPLEMENTATION_PLAN.md` §18 entry criteria) | Retained, selectable as fallback | Becomes primary for approved scope |
| **H** | Old engine retirement gate — a distinct, future, explicitly Human-approved decision; **not scheduled by this plan** | Removed only after this gate | Sole engine |

No stage before G touches `src/`. No stage assumes Stage H's timing.

## 2. Comparison adapter concept (Stage C)

- Lives under `typesetting-v2/tools/compare/` (or similar, non-production location) — never under `src/`.
- Takes one manuscript + `LayoutSettings`, runs it through the old engine (read-only call into `src/lib/pageLayout.ts`/`tategaki.ts` — reading their exported functions, not modifying them) and the new Core (`typesetting-v2/core/index.ts`), and diffs: page count, break positions, column assignment.
- A divergence is not automatically a Core bug — the whole point of Phase 3 is that some behavior is *intentionally* different (HG-1/HG-2 stricter kinsoku, INV-004's no-stretch Natural Pitch vs. legacy `justified` stretch). Every divergence found here gets classified as EXPECTED (a frozen Contract decision) or UNEXPECTED (a real regression) before Stage D begins.

## 3. Integration entry criteria (first `src/` touch)

No `src/` integration occurs merely because Core unit/fixture tests pass. Entry into Stage G requires **all** of:

1. Core invariant suite (INV-001–013) — PASS, via P3-L15.
2. All mandatory logical features (§30 compatibility matrix in the Core Contract) represented, including the two CONTRACT GAPs (group-ruby, jukugo auto-segmentation) explicitly still defaulting safely (atomic fallback), not silently broken.
3. Deterministic multi-page fixture (F19) — PASS.
4. Source mapping (INV-001) — PASS across the full fixture set.
5. No serious `LayoutError`/HOLD condition silently downgraded (INV-010) — PASS.
6. A comparison adapter (Stage C) exists and has been run at least once against a real manuscript shape.
7. This rollback plan's Stage-level rollback path (§4) is in place and understood.
8. Explicit Human/Product approval to begin integration — a distinct decision, not an automatic consequence of tests passing.

## 4. Rollback

**Implementation-Loop-level rollback:** every Loop in `P3_CORE_LOOP_ROADMAP.md` has its own named rollback boundary (a specific set of files/modules to revert) and ends with a checkpoint commit — reverting one Loop never requires reverting a later, independently-checkpointed Loop's work unless a genuine dependency was broken (in which case the dependency, not just the one Loop, is what gets reverted).

**Product-level rollback:** the old engine (`src/lib/pageLayout.ts`, `src/lib/tategaki.ts`) remains fully intact and live in Production through Stages A–F unconditionally, and remains present (as a selectable fallback) through Stage G until the separate, not-yet-scheduled Stage H retirement gate. No migration step in this plan makes rollback to the old engine harder — Stage G's integration is explicitly designed as "new Core becomes primary for approved scope," not "old engine is deleted."

**Rollback triggers (illustrative, not exhaustive):** a Stage D/E/F Human QA finds a regression the comparison adapter didn't catch; a Stage G integration reveals a Production-scale performance or correctness issue; a Contract-level invariant is found to be violated in real manuscripts after integration. Any of these routes back to "old engine remains primary," not to deleting Core work — Core state is preserved for a fix-forward attempt, not thrown away.

**Rollback method (concept only, not implemented here):** feature-flag or explicit settings-level selection between "legacy engine" and "v2 Core" at the point Stage G wires them into `src/` — the exact mechanism (env flag, settings field, route split) is an implementation-time decision for whichever Loop first performs Stage G, not decided in this planning document.

## 5. What this plan deliberately does not decide

- Old engine retirement date (Stage H) — not scheduled.
- Final Preview/Publication renderer technology (P3-O08/O09) — unaffected by this migration plan, decided separately.
- Exact feature-flag/selection mechanism for Stage G — implementation-time detail for that future Loop.

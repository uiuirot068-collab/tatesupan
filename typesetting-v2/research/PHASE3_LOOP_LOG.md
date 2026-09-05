# Phase 3 — Loop Engineering Log

- Status: Phase 3 draft, pending Human Review
- Format: QUESTION → HYPOTHESIS → METHOD → PRIMARY EVIDENCE → RESULT → DECISION (ACCEPT/REJECT/OPEN/HUMAN_GATE) → WHY → NEXT
- Scope of this file so far: P3-L01 only (standards research/specification). Phase 3 Core implementation loops (P3-L02+) are not started — see Master §14 Phase 3 scope and `docs/architecture/PHASE3_OPEN_ITEMS.md`.

---

## P3-L01 — Japanese Typesetting Standards Recovery & Rule-Freeze Candidate

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `7cfa8172ac51c68cbb1870fe91c8064d179514f3` (matches expected checkpoint "TSP v2: close Phase 2 and select logical core direction"), worktree clean before start.

**Timebox:** 90 minutes hard stop; 75-minute research-only cutoff. Both respected — research (source recovery) stopped once the primary rule text for all three questions was directly verified; the remaining time went to classification and document packaging, per the loop brief's time plan.

### P3-L01-A — Kinsoku source recovery (P3-O01)

**QUESTION:** Can the full jlreq character-class table (cl-01 through cl-30, plus the actual line-start/line-end break rules) be retrieved with primary-source confidence, correcting/extending P1-L10a's incomplete result?

**HYPOTHESIS:** A different retrieval method than Phase 1's (which failed due to WebFetch's summarizer truncating a ~1.9MB single-page document before reaching the appendix) should succeed, since the failure was a tool-capability limit, not an evidentiary negative.

**METHOD:** Downloaded the official jlreq HTML (`https://w3c.github.io/jlreq/`) verbatim into this worktree (`research/phase3/source-cache/jlreq/jlreq-index.html`, 1,925,819 bytes) and searched it directly with exact-text grep, bypassing the AI-summarization step that caused the earlier truncation. Also located and downloaded the repo's dedicated Table-2 PDF (`tables/table_ja3.pdf`) via `gh api`.

**PRIMARY EVIDENCE:** Full cl-01–cl-30 table recovered verbatim, with English/Japanese names and example characters for every class that has one (`jlreq-index.html` lines 5548–5827). The actual pairwise break-rule prose (not just class names) was also recovered for the classes relevant to TateSpun's feature set: cl-08 (dash/ellipsis), cl-21/22/23 (ruby complexes), cl-30 (TCY) — `#notes_a3`, lines 21976–22036. The four-level conformance system (`#addendum_a3`) was also recovered, lines 22044–22130+.

**RESULT:** Materially exceeds P1-L10a's result (which only confirmed the scheme "extends to at least cl-27" via inline citations, without the actual class definitions or break rules). Full class table now directly verified. The one gap: the full 30×30 pairwise grid (Table 2 itself) exists only as an official PDF, downloaded successfully but not text-extracted (`pdftoppm`/poppler-utils not installed in this environment) — recorded as OPEN, not silently treated as resolved.

**DECISION: ACCEPT** (class table + all TateSpun-relevant break rules); **OPEN** (full 900-cell grid, low product impact — see Kinsoku Freeze Candidate §OPEN).

**WHY:** Directly grepped against a locally-cached, official, unmodified primary source — not a model's paraphrase of one.

**NEXT:** `docs/standards/P3_KINSOKU_RULE_FREEZE_CANDIDATE.md`.

---

### P3-L01-B — Dash / ellipsis source recovery (P3-O02)

**QUESTION:** Does jlreq contain a real, findable rule for dash/ellipsis run-inseparability, and can the earlier invalid "§3.1.10" citation be corrected with a real anchor?

**HYPOTHESIS:** A rule exists (Phase 1's `engine.js`-adjacent conventions and general Japanese-typesetting knowledge both assume it does); the specific numbered citation was likely an artifact of an earlier summarization pass rather than a real clause number, per P1-L10a's own suspicion.

**METHOD:** Same direct-grep method as P3-L01-A, searching the cached jlreq HTML for `cl-08` (the class WebSearch discovery suggested dashes/ellipses belong to) and for any section-numbering pattern resembling "3.1.10" anywhere in the document.

**PRIMARY EVIDENCE:** `#cl-08` class definition (EM DASH/HORIZONTAL ELLIPSIS/TWO DOT LEADER, verbatim). `#notes_a3` id589–595: the exact pairwise rule, with a **worked example naming EM DASH and HORIZONTAL ELLIPSIS explicitly** ("when two EM DASH appear consecutively, these two characters are inseparable, and consecutive EM DASH and HORIZONTAL ELLIPSIS are separable"). No "§3.1.10" or any numbered-clause pattern found anywhere in the document.

**RESULT:** The rule is real, complete, and directly citable via anchor IDs. The old citation is confirmed not just "unverifiable" (P1-L10a's finding) but **structurally impossible** — this document edition has no numbered-clause scheme at all, so no future retry of "find §3.1.10" should be attempted against this source.

**DECISION: ACCEPT.**

**WHY:** Verbatim worked example naming the exact two character types in question, directly quoted from the primary source.

**NEXT:** `docs/standards/P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md`. The old "§3.1.10" citation should be treated as permanently retired, not "still needs verification," in any future reference to this history.

---

### P3-L01-C — Ruby standards review (P3-O06)

**QUESTION:** How does jlreq's own ruby guidance compare to Phase 2's Human-approved ruby policy (Master §25.6/HD-020)?

**HYPOTHESIS:** Unknown going in, per the loop brief's explicit instruction not to assume agreement or conflict.

**METHOD:** Direct-grep of the cached jlreq HTML for ruby-related sections (`#ruby_and_emphasis_dots`, `#positioning_of_jukugoruby` and its four subsections, and the cl-21/22/23 entries in `#notes_a3`).

**PRIMARY EVIDENCE:** jlreq distinguishes mono-ruby (cl-22, atomic per-pair), jukugo-ruby (cl-23, internally breakable between base-char+ruby-segment pairs — a real structural distinction Phase 2's policy does not make), and group-ruby (mentioned but its break-rule not located this pass). Overhang rules onto specific adjacent character classes (forbidden onto plain kanji by default, up to full-width onto cl-08/cl-05, optional onto brackets) were also recovered — a finer-grained axis than Phase 2's line/column-geometry-only clamp policy.

**RESULT:** Real, evidence-backed differences found — not fabricated for the sake of having something to report. Per the loop brief's explicit instruction, **Phase 2's Human-approved policy was not overwritten.** Two concrete Human-decision questions were framed instead (HD-Q1: jukugo-ruby internal breakability; HD-Q2: character-class-aware overhang).

**DECISION: HUMAN_GATE** (both differences require a Product Owner decision, not a unilateral research-loop choice).

**WHY:** The loop brief explicitly prohibits silently choosing for the user when standard and current product behavior diverge.

**NEXT:** `docs/standards/P3_RUBY_STANDARDS_REVIEW.md` §6 (the two HD-Q questions) is the direct input for the Human Rule-Freeze Gate on this item.

---

### P3-L01-D — Rule classification / freeze candidate packaging

**QUESTION:** Can P3-L01-A/B/C's findings be organized into a single classified matrix (STANDARD_BACKED / PRODUCT_POLICY / RENDERER_POLICY / OPEN) without manufacturing false completeness?

**HYPOTHESIS:** Yes — most rules cleanly classify; a minority will legitimately need HUMAN_GATE or remain OPEN, and that is an acceptable, honest result per the loop brief.

**METHOD:** Cross-referenced all three freeze-candidate documents plus a read-only comparison against `src/lib/tategaki.ts`'s current `LINE_START_PROHIBITED`/`LINE_END_PROHIBITED`/`HANGING_PUNCTUATION` constants (read-only; nothing in `src/` was modified).

**PRIMARY EVIDENCE:** `docs/standards/PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` — 15 rows: 8 READY, 4 HUMAN_GATE, 2 OPEN, 1 RENDERER_ONLY.

**RESULT:** A useful, honestly-incomplete matrix, matching the loop brief's own worked example of an acceptable outcome shape (some rows READY, some HUMAN_GATE, some RENDERER_ONLY, none forced).

**DECISION: ACCEPT** (as a packaging exercise — the matrix accurately reflects P3-L01-A/B/C, it does not add new unverified claims).

**WHY:** Every row cites back to a specific freeze-candidate section, which in turn cites a specific primary-source anchor — traceable end to end.

**NEXT:** Human Rule-Freeze Gate review of the 4 HUMAN_GATE rows (2 kinsoku conformance-level questions, HD-Q1, HD-Q2) is the concrete next action before Master v1.5 is touched.

---

## P3-L01 — Human Rule-Freeze Gate closeout (2026-09-05)

**QUESTION:** Do the 4 HUMAN_GATE rows raised by P3-L01-A/B/C/D (HG-1 cl-05, HG-2 cl-12/13, HG-3 jukugo-ruby breakability, HG-4 class-aware ruby overhang) have a Human decision?

**RESULT:** Yes, all 4. Product Owner reviewed the matrix and supporting freeze-candidate documents directly (no new research opened, per this closeout task's own timebox constraint).

- **HG-1 (cl-05 middle-dots line-start prohibition): APPROVED — stricter base-level policy** as the v2 Core default, superseding legacy `tategaki.ts` looser behavior (retained as comparison evidence only, not deleted).
- **HG-2 (cl-12/13 abbreviations line-start prohibition): APPROVED — stricter base-level policy**, same reasoning as HG-1, distinct character class.
- **HG-3 (jukugo-ruby internal breakability): APPROVED — Core capability requirement.** Core must be able to represent legal internal break opportunities between base-character+ruby-segment pairs within a jukugo-ruby group. Explicitly **not** "all ruby may break anywhere" — Phase 2's Human-approved unbroken-run behavior for mono-ruby/group-ruby is retained. Data-model shape deferred to P3-L02 Core Contract.
- **HG-4 (ruby overhang onto adjacent character classes): APPROVED IN PRINCIPLE — layer class-aware overhang budgets on top of the retained (not replaced) Phase 2 geometry clamp.** Exact numeric budget/convention values explicitly **not** frozen — jlreq documents multiple legitimate conventions for several of these, and no convention was silently picked. Recorded as a distinct, still-OPEN sub-question (`PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` row 22b) for a future, narrower Human decision.

**DECISION: P3-L01 Human Rule-Freeze Gate — PASS, 4/4 APPROVED.**

**WHY:** Every decision cites the specific jlreq evidence it is built on (via the freeze-candidate documents and `P3_L01_PRIMARY_SOURCE_LEDGER.md`'s new Source-ID map), and every decision is recorded as PRODUCT_POLICY/CORE-CAPABILITY built on STANDARD_BACKED evidence — not re-labeled as a standards mandate. Rule-category discipline (STANDARD_BACKED / PRODUCT_POLICY / RENDERER_POLICY / OPEN) preserved throughout; HG-4's residual OPEN sub-question was deliberately not forced to READY.

**NEXT:** Master updated to v1.6 (§26) to record this gate. Documents updated: `P3_KINSOKU_RULE_FREEZE_CANDIDATE.md`, `P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md` (status note only — no HG question existed for it), `P3_RUBY_STANDARDS_REVIEW.md`, `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`, `PHASE3_OPEN_ITEMS.md` (P3-O01/O06 now RESOLVED/READY FOR CORE CONTRACT; P3-O02 already RESOLVED; P3-O03/04/05/07/08/09/10/11 unchanged, still OPEN). **P3-L01: CLOSED. P3-L02 (Core Contract): READY to begin** — no Phase 3 Core code exists yet; this closeout is documentation/policy only.

---

## Summary

| Loop | Decision |
|---|---|
| P3-L01-A Kinsoku source recovery | ACCEPT (class table + relevant break rules); OPEN (full 900-cell grid, low impact) |
| P3-L01-B Dash/ellipsis source recovery | ACCEPT — prior invalid citation corrected, not merely re-flagged |
| P3-L01-C Ruby standards review | HUMAN_GATE — two concrete questions framed, Phase 2 policy not overwritten |
| P3-L01-D Rule classification/packaging | ACCEPT |
| P3-L01 Human Rule-Freeze Gate closeout | **PASS — 4/4 HG decisions APPROVED (HG-1, HG-2, HG-3, HG-4-in-principle)** |

---

## P3-L02 — Canonical Logical Typesetting Core Contract

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `323d4451f7b20c7bed8db86d9d4db26e4cb4888d` (matches expected checkpoint "TSP v2: freeze Phase 3 Japanese rule decisions"), worktree clean before start.

**QUESTION:** Can TateSpun define a renderer-independent, deterministic, source-mapped Canonical Logical Core contract before implementing the engine?

**HYPOTHESIS:** Yes — the Phase 2 C1-NATURAL evidence and the P3-L01 rule freeze (Master v1.6 §26) are sufficient to specify Core responsibilities and data boundaries without selecting final renderer technology.

**METHOD:** Contract modeling against Master §2/§5.2/§14/§25/§26 and the P3-L01 freeze documents; a responsibility audit (one owner per concern, no shared ownership); read-only inspection of `src/lib/pageLayout.ts` (confirmed existing mm/pt-based physical unit model — informs §21's unit recommendation) and `src/lib/tategaki.ts` (confirmed manual-break marker three-case disambiguation and image marker syntax — informs §13/§14); eight representative manuscript-case walkthroughs (Contract Appendix) exercising every major unit kind without rendering anything.

**PRIMARY EVIDENCE:** `docs/core/TATESPUN_V2_CORE_CONTRACT.md` (32 sections + 8-case appendix), `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md` (pseudocode shapes), `CORE_RESPONSIBILITY_MATRIX.md` (one owner per row, one explicit CONTRACT GAP — jukugo segmentation — left unowned rather than assigned arbitrarily), `CORE_INVARIANTS.md` (12 invariants, INV-001–INV-012).

**RESULT:** A complete, source-grounded contract was produced without needing to force a Human Gate — every design choice was either a direct restatement of an already-frozen Master/P3-L01 decision, or an engineering-internal detail with a low-risk, evidence-backed default (source-offset unit = code points; geometry unit = mm, fixed-point, informed directly by `pageLayout.ts`'s existing mm-based model; ruby-overhang table shape without inventing values). One deliberate scope boundary was drawn rather than designed around: jukugo-ruby's automatic per-kanji segmentation algorithm is recorded as an explicit CONTRACT GAP (unowned in the Responsibility Matrix), per the loop brief's own instruction not to design automatic segmentation in this loop.

**DECISION: PASS.**

**WHY:** All 20 acceptance-criteria items (loop brief) are met: Core/Renderer/Normalizer/Measurement-Provider authority is explicit (§2, Responsibility Matrix); source mapping, logical units, ruby atomic/jukugo, break decisions, character-class data boundary, measurement boundary, Natural Pitch, page/column/line hierarchy, decision trace, determinism, versioning, and error/hold model all have contract sections; the coordinate/unit question was resolved by evidence-backed recommendation rather than either an arbitrary choice or an unnecessary Human Gate; every required existing TateSpun feature is either SUPPORTED BY CONTRACT or an explicitly named CONTRACT GAP (§30); no renderer technology was accidentally selected; no source code was written; Master was not touched (stays v1.6); nothing was committed.

**NEXT:** P3-L03 should pick a first vertical slice to actually implement against this contract — the loop brief's own walkthrough cases (Appendix) are a natural starting scope (CASE 1 kinsoku + CASE 6 manual break are the smallest, most self-contained slice). The jukugo-ruby segmentation CONTRACT GAP should get its own research/design loop before jukugo-ruby is usable end-to-end, though it does not block starting elsewhere.

---

---

## P3-L02 — Closeout: Contract Freeze + Precision Hardening (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `323d4451f7b20c7bed8db86d9d4db26e4cb4888d` (matches expected checkpoint), worktree clean before start (only P3-L02's own uncommitted drafts present).

**Human decision questions:** NONE. Contract review outcome: ACKNOWLEDGED / APPROVED FOR FREEZE, no Product decision needed.

**Corrections applied:**

1. **Precision hardening:** the Core Contract's original 0.01mm fixed-point recommendation is superseded by **integer micrometer ticks (1 tick = 0.001mm)** as the canonical storage/comparison unit for all layout geometry (coordinates, advances, extents, residual space); mm remains the Product-facing/display unit only. Applied consistently across `TATESPUN_V2_CORE_CONTRACT.md` §21, `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md` (new `GeometryTick` type; `PlacedUnit.xTick/yTick`, `CanonicalColumn.residualSpaceTick`, `MeasurementFacts.*Tick`, `RuleSetVersion.rubyOverhangAllowance`), and `CORE_INVARIANTS.md` (new INV-013).
2. **Jukugo segmentation ownership sharpened:** the Core's responsibility is now stated explicitly as "honor provided `segments`, never discover them" — segmentation *discovery* is an upstream Normalizer/Logical Analysis responsibility, mechanism not yet chosen (no candidate selected; no network/AI, per Master §12.1/§20.3). An un-segmented jukugo candidate defaults to `ATOMIC`, never a guessed split. This removed the prior "CONTRACT GAP — unowned" phrasing from `CORE_RESPONSIBILITY_MATRIX.md` in favor of an explicit two-row split (discovery vs. honoring). New Phase 3 open item **P3-O14** created for the segmentation mechanism itself; group-ruby's own break-rule (P3-L01's separate, pre-existing gap) is now similarly tracked as its own item, **P3-O15**, rather than only living inside P3-O06's prose.

**Contract freeze:** Core/Renderer/Normalizer/Measurement-Provider authority boundaries, source addressing (Unicode code-point offsets, grapheme-safe unit boundaries), the data-driven Japanese character-class model, the BreakOpportunity/BreakDecision split, ruby ATOMIC/JUKUGO capability, Natural Pitch, decision trace, determinism, versioning, and the Warning/Error/HOLD model are all recorded as **FROZEN for implementation planning** — restated, not newly invented, in `docs/core/TATESPUN_V2_CORE_CONTRACT.md` §32 and Master §27. **Core engine implementation has not begun.**

**DECISION: P3-L02 — CLOSED. Core Contract: FROZEN.**

**WHY:** Both corrections were evidence/principle-driven (Master §3's Publication-Quality priority for the precision hardening; the loop brief's own "Core does not discover, only honors" instruction for the segmentation boundary), not arbitrary — and both were applied consistently across every document that referenced the old values, not just the primary contract file, avoiding the exact kind of drift a closeout audit exists to catch.

**NEXT:** Master updated to v1.7 (§27). `PHASE3_OPEN_ITEMS.md` updated (P3-O14, P3-O15 added, history preserved). **P3-L03 (Core Implementation Plan) is ready to begin** — it may plan directories/modules, implementation sequence, tests, fixtures, rollout boundaries, migration-from-PoC strategy, and further loop breakdown, but must not deploy Production. Neither the jukugo segmentation mechanism (P3-O14) nor any other remaining Renderer/Publication/Preview-level open item blocks starting P3-L03, provided the segmentation interface stays explicit (i.e. `segments` optional, `ATOMIC` default) rather than silently assumed away.

---

No rejected hypothesis is silently reopened without new evidence, per the loop-engineering rule established in Phase 1/2.

---

## P3-L03 — Canonical Core Implementation Plan

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `3732bb866de690ac9b885c59832ca24548c00e23` (matches expected checkpoint "TSP v2: freeze canonical core contract"), worktree clean before start.

**QUESTION:** Can the frozen Canonical Core Contract be implemented as small deterministic Loops with isolated rollback and without touching Production until explicit integration gates?

**HYPOTHESIS:** Yes.

**METHOD:** Module decomposition against the frozen Contract and data-model candidate (25 modules, `CORE_MODULE_MAP.md`); dependency-DAG derivation (12 tiers, no DOM/Canvas/PDF/React/UI/SNS/cloud/AI dependency at any tier); Loop planning (12 Loops, P3-L04–P3-L15, 45–90 min each, `P3_CORE_LOOP_ROADMAP.md`); test-tooling audit (read-only — no runner currently installed; `tsc --noEmit` already works repo-wide with zero config change; Vitest recommended as the one future dependency, gated behind explicit Human approval, not installed here); fixture taxonomy (20 F-series fixtures, cross-referenced against the pre-existing `REGRESSION_CORPUS_SPEC.md` 23-category corpus); invariant test matrix (all 13 `CORE_INVARIANTS.md` entries mapped to a Loop); open-item dependency mapping (all 8 relevant OPEN items confirmed non-blocking, each given a safe default or a deferred stage); migration/rollback planning (8 stages A–H, old engine untouched through H); risk register (10 named risks with mitigation/rollback/blocking milestone).

**PRIMARY EVIDENCE:** `docs/implementation/P3_CORE_IMPLEMENTATION_PLAN.md`, `CORE_MODULE_MAP.md`, `P3_CORE_LOOP_ROADMAP.md`, `CORE_TEST_STRATEGY.md`, `CORE_MIGRATION_ROLLBACK_PLAN.md`, `CORE_IMPLEMENTATION_RISK_REGISTER.md`.

**RESULT: PASS.** Implementation location recommended (`typesetting-v2/core/`, isolation verified by read-only inspection — nothing in `src/` currently references `typesetting-v2/`); module boundaries and dependency direction explicit with no DOM/Renderer dependency anywhere in Core; a concrete 12-Loop sequence exists from first source file to a Canonical Core regression milestone, none exceeding 90 minutes; test strategy, fixture taxonomy, and invariant coverage all exist and are cross-mapped; the Measurement Provider strategy (fake/deterministic first, real adapter deferred) is explicit; every OPEN item is mapped to a safe stage, none silently closed; migration stages, rollback (Loop-level and Product-level), and the first `src/`-integration entry gate are all explicit; the old engine remains fully untouched; Human QA is scoped to exactly one gate inside this plan (G1, P3-L15, logical-trace review only — no rendering exists yet to judge); the PoC reuse policy classifies Phase 2 material without adopting any of it verbatim; the risk register names 10 risks with concrete mitigations. No Core implementation code was written. Master remains v1.7, unmodified. No commit, push, or deploy was performed by this Loop.

**WHY:** Every module traces to a specific Core Contract section or Responsibility Matrix row (no invented scope); every Loop's dependency list traces to the dependency DAG (no Loop assumes an unbuilt prerequisite); every invariant traces to `CORE_INVARIANTS.md`'s own numbering (none renumbered); every OPEN item traces to `PHASE3_OPEN_ITEMS.md`'s existing entries (none newly invented or silently resolved by this planning pass).

**DECISION: P3-L03 — PASS.**

**NEXT:** Human/Product review of this implementation plan and its five companion documents. On acceptance, P3-L04 (Core Foundation) may begin — its own zeroth step is the one Human-approved dependency install (Vitest) named in `P3_CORE_LOOP_ROADMAP.md`'s pre-requisite section. No further Master version bump is implied by this Loop; Master changes only if/when the plan review itself surfaces a Product-level decision this Loop did not anticipate.

---

## P3-L03 — Closeout: Implementation Plan Freeze (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `3732bb866de690ac9b885c59832ca24548c00e23` (matches expected checkpoint, unchanged since P3-L03 itself made no commit), worktree dirty only under `typesetting-v2/` (the six P3-L03 planning documents plus this log) before start.

**RESULT: P3-L03 — PASS.** Plan review: APPROVED / FROZEN. All six companion documents (`P3_CORE_IMPLEMENTATION_PLAN.md`, `CORE_MODULE_MAP.md`, `P3_CORE_LOOP_ROADMAP.md`, `CORE_TEST_STRATEGY.md`, `CORE_MIGRATION_ROLLBACK_PLAN.md`, `CORE_IMPLEMENTATION_RISK_REGISTER.md`) had their status headers updated to "REVIEWED / FROZEN FOR IMPLEMENTATION" with "Core implementation: NOT STARTED" restated explicitly — no content was reopened or re-litigated at this closeout. Master updated **v1.7 → v1.8** (§28), recording the planning freeze: implementation location (`typesetting-v2/core/`, planned, not created), the 25-module/12-tier boundary, the 12-Loop roadmap (P3-L04–P3-L15, max 90 min, none >120 min), the deterministic Core-first test strategy, the F01–F20 fixture taxonomy (long Human prose corpus kept separate), full INV-001–013 mapping (no renumbering), all 8 relevant open items (P3-O03/04/05/06 residual/07/08/09/14/15) confirmed staged and non-blocking, the 8-stage A–H migration plan with old-engine preservation, the explicit first-`src/`-integration gate, the three-way Logical/Preview/Publication quality-gate separation, and the single Human Gate (G1, after P3-L15).

**Vitest dependency gate:** RECOMMENDED, **NOT INSTALLED**. The user verbally pre-approved installing Vitest during plan review ("Vitest導入：YES"), but per this closeout's explicit write-boundary instruction, no `package.json`/lockfile change was made here — that single `npm install -D vitest` step is deliberately deferred to the start of P3-L04 itself, so it happens inside that Loop's own scope/audit/checkpoint, not folded into this documentation-only closeout. The verbal approval is recorded here so it is not lost or re-asked unnecessarily at P3-L04's start; the actual write-boundary/install action still happens there.

**WHY:** Every frozen claim in Master §28 traces to one of the six companion documents produced in P3-L03's own body (no new architecture invented at closeout); no open item was silently closed; no invariant was renumbered; the old engine and `src/` remain completely unreferenced by anything written in this closeout.

**DECISION: P3-L03 — CLOSED.**

**NEXT:** P3-L04 (Core Foundation) — its zeroth step is resolving the Vitest dependency/write-boundary gate (already verbally approved; the install action itself happens inside that Loop), then scaffolding `typesetting-v2/core/geometry/`, `core/version/`, `core/source/span.ts`, `core/layout/schema.ts`, `core/settings/` per `P3_CORE_LOOP_ROADMAP.md`.

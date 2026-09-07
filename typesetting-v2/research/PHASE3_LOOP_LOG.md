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

**Vitest dependency gate:** RECOMMENDED, **NOT INSTALLED**, explicit Product Owner dependency approval **NOT YET RECORDED** — gate **OPEN**. **Correction (2026-09-06):** this entry originally stated the user had verbally pre-approved installing Vitest ("Vitest導入：YES"); that was inaccurate — the message it was based on only requested the next prompt and did not constitute explicit dependency-install approval. Per this closeout's explicit write-boundary instruction, no `package.json`/lockfile change was made here; that single `npm install -D vitest` step waits on a distinct, explicit approval not yet given, and then happens inside P3-L04's own scope/audit/checkpoint, not folded into this documentation-only closeout.

**WHY:** Every frozen claim in Master §28 traces to one of the six companion documents produced in P3-L03's own body (no new architecture invented at closeout); no open item was silently closed; no invariant was renumbered; the old engine and `src/` remain completely unreferenced by anything written in this closeout.

**DECISION: P3-L03 — CLOSED.**

**NEXT:** P3-L04 (Core Foundation) — its zeroth step is obtaining explicit Product Owner approval to install Vitest (not yet given — dependency gate OPEN), then performing that install inside that Loop's own write boundary, then scaffolding `typesetting-v2/core/geometry/`, `core/version/`, `core/source/span.ts`, `core/layout/schema.ts`, `core/settings/` per `P3_CORE_LOOP_ROADMAP.md`.

---

## P3-L03A — Correction: Vitest Approval Record

**QUESTION:** Did the P3-L03 closeout accurately record whether the Product Owner had given explicit dependency-install approval for Vitest?

**RESULT:** No. The closeout entry above and `CORE_TEST_STRATEGY.md`'s status header both stated the user had "verbally pre-approved" installing Vitest, citing "Vitest導入：YES". On review, the message this was drawn from ("プロンプト出して") only requested the next prompt in the sequence — it was not a dependency-install approval. This was a misattribution, corrected in place in both documents (no other document in `typesetting-v2/` contained the false claim — `P3_CORE_IMPLEMENTATION_PLAN.md` and `P3_CORE_LOOP_ROADMAP.md` already correctly stated approval was required and not yet given; Master §28 already correctly stated the gate requires future explicit approval without claiming one had occurred).

**CORRECTED CANONICAL STATUS:** Vitest — recommended: YES; installed: NO; explicit Product Owner dependency approval: NOT YET RECORDED; dependency gate: OPEN. P3-L04 is otherwise ready to begin once that approval is obtained.

**DECISION: CLOSED.** No architecture, plan content, or Master section required correction — this was a factual-attribution fix only, confined to the two documents named above.

**NEXT:** Await explicit Product Owner approval before any `npm install -D vitest` / `package.json`/lockfile change is performed, at the start of P3-L04.

---

## P3-L04 — Core Foundation

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `c683088` (matches expected checkpoint "TSP v2: correct Vitest dependency gate status"), worktree clean before start.

**QUESTION:** Can TateSpun close the Vitest dependency gate and scaffold the first real Core source files (`geometry/`, `version/`, `source/span.ts`, `layout/schema.ts` types, `settings/` types) with both `tsc --noEmit` and Vitest green, and zero forbidden imports?

**HYPOTHESIS:** Yes — the frozen Contract/data-model candidate already specify these five modules' exact shapes; the only open item was the Vitest install itself.

**METHOD:** Obtained explicit Product Owner approval to install Vitest (recorded via interactive confirmation). `npm install -D vitest` initially failed peer-dependency resolution against `vitest@5` (requires `@types/node >=22`, incompatible with this repo's pinned `@types/node@^20`); installed `vitest@^3.2.7` instead, the newest release compatible with the existing `@types/node` pin, avoiding an unrelated/unapproved dependency bump. A transitive `nanoid` high-severity advisory (GHSA-2v37-7h3g-55p8, dev-only) surfaced on install and was resolved via `npm audit fix` (0 vulnerabilities remain). Implemented the five P3-L04 modules per `TATESPUN_V2_CORE_CONTRACT.md`/`TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md`/`CORE_MODULE_MAP.md` rows 1–3, 21, 24; added `vitest.config.ts` scoping test discovery to `typesetting-v2/core/**/*.test.ts`; added `test`/`test:watch` npm scripts.

**PRIMARY EVIDENCE:** `typesetting-v2/core/geometry/tick.ts` (+ test), `core/version/index.ts`, `core/source/span.ts`, `core/layout/schema.ts`, `core/settings/index.ts`. `npx tsc --noEmit`: only pre-existing, unrelated `src/app/layout.tsx` error (`LayoutProps` — a Next.js 16 generated type absent because `.next/` hasn't been built in this worktree; confirmed via `git diff --stat HEAD -- src/` showing zero changes). `npx vitest run`: 6/6 tests pass. Grep confirmed zero DOM/React/Next/`src/` imports anywhere under `core/`.

**RESULT: PASS.** `layout/schema.ts`'s `CanonicalDocument` deliberately omits `trace`/`warnings`/`errors`/`hold` for this Loop — those fields depend on `trace/` (P3-L07) and `diagnostics/` (P3-L14), which are not allowed deps for this module yet per `CORE_MODULE_MAP.md` row 21 (geometry/source-span/version only) — documented inline rather than silently under- or over-built.

**DECISION: P3-L04 — CLOSED.**

**WHY:** Every type traces directly to the frozen data-model candidate; the Vitest version choice traces to a concrete peer-dependency conflict, not preference; the CanonicalDocument scope-narrowing traces to the module map's own allowed-deps table.

**NEXT:** Checkpoint commit `TSP v2: implement core geometry foundation` (`e1182cd`). P3-L05 (Source Mapping + Grapheme Safety + LogicalUnit Foundation) authorized to begin.

---

## P3-L05 — Source Mapping + Grapheme Safety + LogicalUnit Foundation

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `e1182cd` (matches expected P3-L04 checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun safely represent source positions by Unicode code-point offsets, while guaranteeing grapheme-safe logical-unit boundaries, and declare all six `LogicalUnit` kinds as a discriminated union without implementing any composition behavior?

**HYPOTHESIS:** Yes.

**METHOD:** Implemented `core/source/graphemeSafety.ts` (`codePointLength`, `codePointSlice`, `assertGraphemeSafeBoundary`, `assertGraphemeSafeSpan`, `GraphemeSafetyError`), isolating `Intl.Segmenter` (grapheme granularity) behind this module's boundary per Contract §6/INV-011 — the module validates a given boundary against already-Normalizer-processed text; it does not re-segment raw manuscript strings (`CORE_RESPONSIBILITY_MATRIX.md`). Implemented `core/units/*.ts` (`TextUnit`, `RubyUnit`+`RubySegment`, `TCYUnit`, `SemanticRunUnit`, `ManualBreakUnit`, `ImageUnit`) and `core/units/index.ts`'s `LogicalUnit` discriminated union, exactly matching the frozen data-model candidate's shapes — no new fields invented. F16 regression fixture (surrogate pair, base+combining-mark, variation-selector, emoji+modifier, ZWJ family-emoji sequences) written with explicit `\u` escapes throughout (never literal glyphs) to prevent silent editor/encoding re-normalization. An exhaustive `switch` over `LogicalUnit.kind` (with a `never`-typed default) proves the union discriminates correctly at compile time.

**PRIMARY EVIDENCE:** `core/source/graphemeSafety.ts` + `.test.ts` (16 tests: code-point-vs-UTF-16-length divergence, adversarial naive-slice-vs-`codePointSlice` fixture, F16 grapheme-boundary rejection for combining marks/variation selectors/emoji modifiers/ZWJ sequences, out-of-range rejection, repeated-call determinism). `core/units/index.test.ts` (5 tests: all six kinds discriminate, `JUKUGO` with/without explicit `segments` both type-check with no fabricated split, `TextUnit` source-span/substring round-trip proves INV-001, a deliberately-fractured span is rejected by `assertGraphemeSafeSpan` proving INV-011). `npx tsc --noEmit`: only the same pre-existing unrelated `src/app/layout.tsx` error as P3-L04. `npx vitest run`: 27/27 tests pass (6 carried from P3-L04 + 21 new: 16 grapheme-safety + 5 unit-mapping). Grep confirmed zero DOM/React/Next/`src/` imports anywhere under `core/`; `git status --short` confirmed no `package.json`/lockfile/`vitest.config.ts` change — only `core/source/graphemeSafety.ts`, `.test.ts`, and `core/units/` are new.

**RESULT: PASS.** No automatic jukugo segmentation, no TCY auto-detection, no break-opportunity/composition logic introduced — `RubyUnit.segments` and all other kind-specific fields remain pure data shapes, matching the roadmap's "types only, no behavior" scope for the five non-TEXT kinds.

**DECISION: P3-L05 — CLOSED.**

**WHY:** Every grapheme-safety test case traces to a named Unicode mechanism (surrogate pair, combining mark, variation selector, emoji modifier, ZWJ) called out by Contract §6/INV-011; every `LogicalUnit` field traces to `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md` verbatim; the segmentation-ownership boundary (Core validates, Normalizer segments) traces to `CORE_RESPONSIBILITY_MATRIX.md` row 1.

**NEXT:** Checkpoint commit `TSP v2: implement source mapping foundation`. P3-L06 (Japanese Rule Data + Character Classes) authorized to begin.

---

## P3-L05A — Grapheme Safety Hardening + Validation Closure

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `76cbca4` (matches expected P3-L05 checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun guarantee grapheme safety even when the runtime does not provide the expected segmentation capability?

**HYPOTHESIS:** Yes, by failing explicitly rather than silently degrading to code-point boundaries.

**METHOD:** Identified two P3-L05 gaps: (1) `graphemeBoundaryOffsets`'s fallback, when `Intl.Segmenter` is unavailable, treated every code point as its own grapheme boundary — this can incorrectly report a combining-mark/variation-selector/ZWJ sequence's interior as "safe," which is an unsafe silent guess, not a defensive default; (2) `assertGraphemeSafeSpan` validated `span.start` and `span.end` independently but never rejected a reversed span (`end < start`). Fixed (1) by replacing the module-level `Intl.Segmenter` singleton with a `SegmenterFactory` seam (`defaultSegmenterFactory` throws a new `GraphemeSegmentationUnavailableError` — a `GraphemeSafetyError` subclass — when `Intl.Segmenter` is absent, per INV-010's "no silent PASS on an unresolved serious condition") and a test-only override (`__setGraphemeSegmenterFactoryForTesting`, restored via `afterEach`) so the unavailable path is exercised without mutating the process-global `Intl` object. Fixed (2) by adding an explicit reversed-span check at the top of `assertGraphemeSafeSpan` (the only span-validating function that exists — `core/source/span.ts` itself stays an untouched pure type, per P3-L04).

**PRIMARY EVIDENCE:** `core/source/graphemeSafety.ts` (modified), `core/source/graphemeSafety.test.ts` (+5 tests: reversed-span rejection, segmentation-unavailable throws `GraphemeSegmentationUnavailableError`, out-of-range check still works without a segmenter, factory-restore resumes real validation). `npx vitest run`: 31/31 pass (graphemeSafety.test.ts grew from 16 to 20 tests; units/index.test.ts, source/span.test.ts, geometry/tick.test.ts unchanged at 5+3+3 = 11; 20+11 = 31). `npx tsc --noEmit`: overall command exit non-zero, but the only reported error is the same pre-existing, unrelated `src/app/layout.tsx(33,50): TS2304 Cannot find name 'LayoutProps'` seen at P3-L04/P3-L05 — **0 new TypeScript errors from P3-L05A**, reported precisely rather than rounding the command's exit code to a bare PASS. Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only the two intended files changed.

**RESULT: PASS.** No new dependency, no `package.json`/lockfile change, no LogicalUnit/composition/break-rule work introduced — scope stayed exactly to the two named gaps.

**DECISION: P3-L05A — PASS. P3-L05: CLOSED (hardened).**

**WHY:** The fallback-removal traces directly to INV-010 (no silent PASS on an unresolved serious condition) and INV-011 (never fracture a user-perceived character) — a guessed boundary risked violating both; the reversed-span fix traces to the original P3-L05 acceptance criteria's own "invalid source-span behavior is explicit" requirement, which the initial implementation left partially unmet.

**NEXT:** Checkpoint commit `TSP v2: harden grapheme safety guarantees`. P3-L06 (Japanese Rule Data + Character Classes) authorized to begin.

---

## P3-L06 — Japanese Character Classes + Break Opportunity / Decision Foundation

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `ed092f8` (matches expected P3-L05A checkpoint), worktree clean before start.

**Re-scoping note:** Product Owner instructions for this Loop explicitly merged the original roadmap's P3-L06 (rules data only) and P3-L07 (break-opportunity derivation + trace) into one combined Loop, and renumbered the *next* Loop (Natural-Pitch Line Composer, originally P3-L09) to P3-L07. `P3_CORE_LOOP_ROADMAP.md`'s own P3-L06/P3-L07 section bodies were updated in place to record this rather than silently drifting from what the frozen document said.

**QUESTION:** Can TateSpun convert grapheme-safe logical boundaries into deterministic, source-mapped Japanese break opportunities and explain every allowed/prohibited decision through versioned rule data?

**HYPOTHESIS:** Yes.

**METHOD:** Read the three frozen rule-freeze documents directly (`P3_KINSOKU_RULE_FREEZE_CANDIDATE.md`, `P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md`, `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`) for exact character membership rather than inventing any — only classes with a READY row are encoded (cl-01/02/04/05/06/07/09/10/11/12/13 plus a `cl-00` "ordinary text" fallback); the 900-cell Table-2 grid stays OPEN, not fabricated. Implemented `core/rules/characterClass.ts` (generic `buildCharacterClassLookup(definitions)` — the rule-evaluation *algorithm* — plus `CharacterClass`/`RuleSetVersion` types) and `core/rules/defaultRuleSet.ts` (`DEFAULT_RULE_SET_V2`, the actual jlreq-sourced membership *data*), keeping algorithm and data in separate files per the loop brief's explicit "data-driven, not `if (char === ...)` chains" instruction. Implemented `core/trace/index.ts` (`TraceEvent`/`LayoutDecisionTrace`/`createTraceRecorder`, observational-only per Contract §23). Implemented `core/breaks/opportunity.ts` (`deriveBreakOpportunities(units, ruleSet, trace?)`): TextUnit internal candidates are enumerated exclusively via P3-L05's `graphemeBoundaries()` (extended with one new export doing the same internal enumeration P3-L05A already used, now surfaced publicly) so a candidate can never land inside a grapheme cluster by construction; cl-08 dash/ellipsis pairing is evaluated by `SemanticRunKind` identity via `cl08PairRule`, not by character class; RubyUnit ATOMIC and undeclared-JUKUGO generate zero internal opportunities (INV-007 holds by construction, not by an explicit per-position prohibition); JUKUGO-with-`segments` generates exactly one `RUBY_INTERNAL_ALLOWED` opportunity per declared boundary and nothing else (HG-3, never guesses a split); `MANUAL_BREAK` always generates a `MANUAL_FORCED` opportunity. Implemented `core/breaks/decision.ts` (`deriveManualBreakDecisions`) — deliberately narrow: the only capacity-INDEPENDENT `BreakDecision` this Loop can make without a line-filling algorithm is the manual-forced case (INV-006), so that is the only one implemented; every other reason's actual taken/not-taken decision is left to the renumbered P3-L07 (Natural-Pitch Line Composer), which needs physical capacity math this Loop explicitly does not build.

**PRIMARY EVIDENCE:** `core/rules/characterClass.ts`, `core/rules/defaultRuleSet.ts` (+`.test.ts`, 24 tests: class lookup, unknown-character fallback, HG-1 cl-05 strict (F04), HG-2 cl-12/cl-13 strict (F05), cl-08 pair rule, hanging scope, empty overhang table, determinism). `core/trace/index.ts`. `core/breaks/opportunity.ts` (+`.test.ts`, 17 tests: F02 line-start, F03 line-end, F11 dash keep-together + dash/ellipsis separability, F12 ellipsis keep-together, F07 atomic ruby zero internal opportunities, F08 jukugo declared/undeclared boundaries, F10 TCY atomicity, F13 manual-forced, code-point-vs-UTF-16 source mapping, grapheme-interior-never-a-candidate, determinism, trace-on/off byte-identical output, stable rule-id in trace, ImageUnit boundary neutrality). `core/breaks/decision.ts` (+`.test.ts`, 3 tests). One small, necessary extension to `core/source/graphemeSafety.ts`: exported `graphemeBoundaries(text): number[]` (previously an unexported internal helper) — reused, not duplicated. `npx vitest run`: 75/75 pass. `npx tsc --noEmit`: only the same pre-existing, unrelated `src/app/layout.tsx` `LayoutProps` error seen at every prior Loop — 0 new errors. Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/rules/`, `core/breaks/`, `core/trace/` (new) and `core/source/graphemeSafety.ts` (the one-export addition) changed.

**RESULT: PASS.**

- HG-1 strict (cl-05): PASS. HG-2 strict (cl-12/13): PASS.
- Line-start / line-end kinsoku: PASS.
- Dash/ellipsis cl-08 keep-together: PASS.
- Atomic ruby internal-break prohibition: PASS (by construction — zero opportunities generated, matching INV-007's "every opportunity inside is PROHIBITED_GROUP" vacuously and intentionally, a documented design choice within the loop brief's own sanctioned "do not create internal break opportunities" option).
- Jukugo legal declared boundary: PASS. Undeclared/non-legal boundary: PASS (no opportunity generated — the loop brief explicitly sanctions "prohibited or not generated").
- TCY atomic grouping: PASS.
- Manual forced break + decision + trace: PASS.
- Determinism (opportunity derivation and decision derivation): PASS.
- No Line Composer (capacity math, `composeLine`, residual-space accounting) leaked in: confirmed absent.

**DECISION: P3-L06 (combined with original P3-L07) — PASS / CLOSED.**

**WHY:** Every character-class membership traces verbatim to one of the three frozen rule-freeze documents' own tables/legacy-comparison rows, not to this Loop's invention; the algorithm/data split directly answers the loop brief's explicit anti-pattern warning; every BreakOpportunityReason value is exercised by a named F-series fixture or Contract §8 case; the ruby/TCY/manual-break scope boundaries all trace to explicit "Explicitly NOT included" lines in this same entry's brief.

**NEXT:** Checkpoint commit `TSP v2: implement Japanese break analysis`. P3-L07 (renumbered; originally P3-L09, Natural-Pitch Line Composer + Break Decision) authorized to begin — first Loop that may implement capacity-aware line filling and the remaining `BreakDecisionCause` values (`CAPACITY_REACHED`, `HANGING_DEFERRAL`).

---

## P3-L06A — Trace Reproducibility Hardening

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `e9130d5` (matches expected P3-L06 checkpoint), worktree clean before start.

**QUESTION:** Can a break-analysis trace unambiguously answer "which RuleSetVersion produced these events," and is the manual-forced-only scope of `breaks/decision.ts` an intentional contract boundary rather than an unnoticed gap?

**HYPOTHESIS:** Yes to both — the fix is additive (one new field), not a redesign; the scope boundary is already implied by `CORE_MODULE_MAP.md` row 12.

**METHOD:** Added `ruleSetVersion: string` to `LayoutDecisionTrace` (stored once on the container, not duplicated per-event — one analysis run always uses exactly one RuleSetVersion) and changed `createTraceRecorder()` to `createTraceRecorder(ruleSetVersion: string)`. Updated the two existing `opportunity.test.ts` call sites to pass `DEFAULT_RULE_SET_V2.id`. Audited `breaks/decision.ts`'s manual-forced-only scope directly against `CORE_MODULE_MAP.md` row 12, which assigns the full `BreakDecision` algorithm (capacity-aware) to the Natural-Pitch Line Composer's own Loop, not this one — confirmed intentional, documented in place with a new comment rather than silently left implicit.

**TESTS:** Two new tests in `core/breaks/opportunity.test.ts`: trace exposes the exact `RuleSetVersion` id used; the id is preserved identically across a repeated analysis run (alongside byte-identical events). All prior P3-L06 tests remain green, unmodified in assertion content.

**RESULT: PASS.** `npx vitest run`: 77/77 pass (75 prior + 2 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero forbidden imports; `git status --short` confirmed only `core/trace/index.ts`, `core/breaks/opportunity.test.ts`, `core/breaks/decision.ts` (comment only) changed.

**INVARIANTS:** Contract §25 (versioning/reproducibility) now has a concrete, tested answer at the trace level, not just at the future `CanonicalDocument.version` level. No invariant renumbered; no existing invariant's test weakened.

**DECISION: P3-L06A — PASS.**

**COMMIT:** `TSP v2: harden break trace reproducibility`.

**NEXT:** P3-L07 (Natural-Pitch Line Composer) authorized to begin.

---

## P3-L07 — Natural-Pitch Line Composer

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `86e5887` (matches expected P3-L06A checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun combine P3-L06's break-legality analysis with deterministic, integer-tick Natural-Pitch measurement to choose actual line content for exactly one line, never stretching to fill and never silently splitting an atomic/grapheme-safe unit?

**HYPOTHESIS:** Yes — reusing P3-L06's `deriveBreakOpportunities` output directly as the atom-boundary source (rather than re-deriving decomposition rules) keeps grapheme-safety and kinsoku/group legality automatically consistent with zero duplication risk.

**METHOD:** Implemented `core/measurement/facts.ts` (`MeasurementFacts` contract type, Contract §17 — a prerequisite this Loop needed that the original roadmap assigned to a separate Loop, absorbed here since the Line Composer cannot function without it) and `core/measurement/fakeProvider.ts` (`createFakeMeasurementProvider`: every character gets the same deterministic advance for a given font+size — Natural Pitch's one-cell-per-character fixture). Implemented `core/compose/line.ts` (`composeLine`): atom boundaries are derived from the UNION of {each LogicalUnit's own span edges} ∪ {every `BreakOpportunity` position `deriveBreakOpportunities` already produced} — an atom can therefore never be finer than an already-established grapheme-safe/kinsoku-legal/ruby-segment boundary, because the Line Composer never invents a boundary of its own. Cell-count per atom is unit-kind-aware (`TEXT`=1, `TCY`=`logicalCells`, `SEMANTIC_RUN`=`length`, `RUBY`=base-span code-point width, `MANUAL_BREAK`/`IMAGE`=0 — images out of this Loop's scope, P3-L13). The fill algorithm walks atoms accumulating advance, tracking the LATEST boundary seen that is both legal (`ALLOWED`/`RUBY_INTERNAL_ALLOWED`) and still within budget; a `MANUAL_FORCED` boundary cuts immediately and unconditionally (INV-006); if overflow occurs before any legal boundary was ever seen (including a single atom alone exceeding the extent), the result is a structured `hold`, never a guess or a split.

**TESTS:** `core/measurement/fakeProvider.test.ts` (3: determinism, uniform per-character advance, code-point-aware ruby-extent scaling). `core/compose/line.test.ts` (13, covering every required test group A–M): ordinary fill (F01), residual space reported not absorbed (INV-004), two kinsoku cases — extending through a legally-includable prohibited-start character (offset-3-to-4 for `、`) AND retreating past it (oidashi) when extending would overflow, same-kind dash-run atomicity (never split), jukugo declared-segment legal cut vs. undeclared-segment hold, a base+combining-mark grapheme treated as one indivisible cell (built via `String.fromCharCode(0x0301)`, never a literal glyph, after an encoding mismatch on a literal `é` was caught by a failing test rather than silently passing), a too-large TCY atom producing `SINGLE_ATOM_EXCEEDS_LINE_EXTENT` hold, full-run determinism, integer-tick-only geometry (INV-013), manual-forced mid-stream cutoff (INV-006), and trace `RuleSetVersion` + chosen-boundary identification (test group M) via the same `TraceRecorder` P3-L06A hardened.

**RESULT: PASS.** One test-authoring bug caught and fixed during this Loop, not silently worked around: an initial kinsoku fixture assumed the composer should retreat before a line-start-prohibited character even when extending through it and cutting after it was legal and fit exactly — that assumption was wrong (jlreq only prohibits breaking *before* the character, not including it), so the test was corrected to assert the actually-correct behavior, and a second test was added for the genuine retreat case (extent too small to include the prohibited character at all). `npx vitest run`: 93/93 pass. `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/measurement/` and `core/compose/` (both new) changed.

**INVARIANTS:** INV-004 (Natural Pitch never stretches) — residual reported, never absorbed. INV-005 (determinism) — repeat-run test passes. INV-006 (manual break explicit/forced) — passes. INV-011 (grapheme safety) — passes, by construction via reused atom boundaries. INV-013 (integer ticks) — passes. No column/page composition, ruby/TCY visual placement, or image flow implemented — explicitly out of this Loop's scope, confirmed absent.

**DECISION: P3-L07 — PASS / CLOSED.**

**WHY:** Every atomicity guarantee traces to reusing P3-L06's own opportunity output rather than re-deciding legality; the "prefer latest legal boundary that fits" algorithm directly implements jlreq's oidashi/oikomi behavior without inventing a different policy; the caught test bug demonstrates the test suite is actually exercising jlreq semantics, not just asserting whatever the code happened to do.

**COMMIT:** `TSP v2: implement natural pitch line composer`.

**NEXT:** P3-L08 (Canonical Column/Page Composer) authorized to begin.

---

## P3-L08 — Canonical Column / Page Composer

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `f79e9dd` (matches expected P3-L07 checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun assemble deterministic CanonicalColumn/CanonicalPage flow on top of P3-L07's Line Composer, correctly closing a column/page immediately on a manual break (INV-006) even under capacity, and correctly propagating a line-level HOLD rather than silently discarding it?

**HYPOTHESIS:** Yes.

**METHOD:** Added one field to `core/compose/line.ts`'s `LineCompositionResult`: `forcedBreak: boolean`, true only when a line ended on a `MANUAL_FORCED` opportunity — the signal the column/page composer needs to distinguish "line ended because of ordinary capacity" from "line ended because of a manual break" (Contract Appendix CASE 6: the current column/page is closed even if under capacity). Implemented `core/compose/column.ts` (`composeColumn`): repeatedly calls `composeLine` against the remaining LogicalUnit stream until the column's own width capacity (`columnExtentTicks`) is exhausted, a `forcedBreak` is hit (stops immediately), or a `hold` occurs (propagated, not swallowed); `sliceUnitsFrom` re-slices a partially-consumed `TextUnit` (via `codePointSlice`, since the consumed offset is already grapheme-safe by construction) so the next line continues exactly where the last one stopped — non-`TEXT` units are never partially consumed (JUKUGO cross-line splitting is ruby-placement territory, P3-L11+, not exercised here). Implemented `core/compose/page.ts` (`composePage` for one page, `composePages` as the pure multi-page logical driver used for F19): a page fills columns up to `columnsPerPage`, stopping immediately (without starting another column) on a column's `forcedBreak` or `hold`; `composePages` loops `composePage` until the unit stream is exhausted, with a stuck-progress guard that compares the remaining stream's **source start offset** (not array length — a sliced `TextUnit` keeps its array slot, so length alone falsely looked "stuck" every time a page ended mid-unit, a bug caught by two failing tests and fixed before commit, not worked around).

**TESTS:** `core/compose/column.test.ts` (4: multi-line fill with correct cross-line continuation, residual column-width space (INV-004), manual-forced immediate column closure, hold propagation). `core/compose/page.test.ts` (20, covering every required test group A–M): single-page one-column and two-column, multi-page one-column and two-column (both initially failed on the array-length progress-check bug above, fixed), manual page break force-closes a page under capacity (INV-006), source mapping is contiguous with no gap/overlap across every page/column/line transition (INV-001), residual space + unchanged per-character pitch (INV-004), all 8 mandatory presets (文庫/A5 1段/A5 2段/B5/B6/新書/A6/Web閲覧用) instantiate a valid non-hold page set under placeholder geometry (P3-O12's real capacity-formula reconciliation against production presets remains a carried-forward, non-blocking open item — not resolved here, not fabricated), the Web preset still paginates long content rather than being special-cased into one infinite page (HD-001), full-document determinism (INV-005), hold propagation at both `composePage` and `composePages` levels, and integer-tick-only geometry everywhere in the hierarchy (INV-013).

**RESULT: PASS.** `npx vitest run`: 117/117 pass. `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/compose/line.ts` (the one-field addition) and the four new `core/compose/column.*`/`core/compose/page.*` files changed. No Preview/Publication renderer, ruby/TCY visual placement, or image flow implemented — explicitly out of scope, confirmed absent.

**INVARIANTS:** INV-001 (source mapping through page hierarchy) — PASS, verified contiguous. INV-004 (Natural Pitch, residual reported not stretched) — PASS at both column and page level. INV-005 (determinism) — PASS. INV-006 (manual break explicit/forced) — PASS at column AND page level (both close immediately under capacity). INV-013 (integer ticks) — PASS throughout the full hierarchy.

**DECISION: P3-L08 — PASS / CLOSED.**

**WHY:** Every closure rule (column/page stopping on `forcedBreak` or `hold`) traces to Contract Appendix CASE 6 and INV-006; the progress-check bug was caught by tests actually asserting multi-page behavior rather than only single-page happy paths, and was fixed at its root cause (measuring the wrong quantity), not patched around it.

**COMMIT:** `TSP v2: implement canonical page composition`.

**NEXT:** Per this batch's explicit instruction, STOP here — do not begin P3-L09 (renumbered; originally P3-L11, Ruby Composition) without further authorization.

---

## P3-L09 — Ruby Composition (Atomic + Jukugo)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `433aeb7` (matches expected P3-L08 checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun implement ruby break-opportunity mapping and geometry-clamp placement as a dedicated `ruby/` module — matching `CORE_MODULE_MAP.md` row 16's exact file boundary — while preserving INV-003 (base position never moves), INV-007 (atomic never breaks), and INV-008 (jukugo breaks only at declared boundaries), all already partially proven inline in P3-L06's `breaks/opportunity.ts`?

**HYPOTHESIS:** Yes — the ruby break-opportunity logic already existed inline in `breaks/opportunity.ts` (written before this module existed) and can be extracted verbatim into `ruby/` with `breaks/opportunity.ts` calling into it, exactly as the frozen roadmap's "Files/modules expected to change" line specifies, with zero behavior change (same 128-test-minus-new baseline stays green throughout the refactor).

**METHOD:** Created `core/ruby/index.ts` with two exports: `deriveRubyBreakOpportunities(unit)` (the extracted, unmodified logic — ATOMIC and undeclared-segments JUKUGO produce zero internal opportunities; declared-segments JUKUGO produces exactly one `RUBY_INTERNAL_ALLOWED` per declared boundary) and `placeRuby(input)` (new: Contract §9.1's geometry-clamp mechanism, layered on `resolveOverhangAllowance` — a trivial `RuleSetVersion.rubyOverhangAllowance` map lookup falling back to 0, never fabricating a value). `breaks/opportunity.ts` was edited to import and call `deriveRubyBreakOpportunities`, moving trace-event recording for ruby opportunities into the main loop (single recording site) rather than duplicating it inside the ruby module. `placeRuby`'s first design used a rigid 50/50 overflow split between before/after allowance, which failed two tests (a side with full allowance should absorb the whole overflow alone, not be capped at "half") — caught immediately by the test suite, fixed at the root cause (switched to greedy sequential absorption: try the preceding side's allowance first, spill remainder to the following side), not patched around.

**TESTS:** `core/ruby/index.test.ts` (11 tests): F07 (zero opportunities for ATOMIC, verified both in isolation and through the full `deriveBreakOpportunities` pipeline), F08 (exactly one opportunity per declared segment boundary; never at an undeclared intra-segment position, tested with a 3-segment fixture), missing-segments and single-element-segments fallback (both ATOMIC, zero opportunities, proving no guessed split), F09 (CENTER when reading fits; `resolveOverhangAllowance` against the shipped `DEFAULT_RULE_SET_V2` confirmed to return 0 for an arbitrary class, proving no fabricated HG-4 value; OVERFLOW_OPEN with that real all-zero table; START_CLAMP and END_CLAMP exercised with locally-injected non-zero test allowances — never shipped as product data, purely fixture values proving the mechanism), a structural assertion that `placeRuby`'s return shape has no base-coordinate field at all (INV-003 by construction), and a determinism test. All 117 pre-existing tests re-ran unmodified and green throughout — this Loop changed zero existing assertions, only moved code and added new tests.

**RESULT: PASS.** `npx vitest run`: 128/128 pass (117 prior + 11 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/ruby/` (new) and `core/breaks/opportunity.ts` (the exact file the roadmap names as needing extension) changed.

**INVARIANTS:** INV-003 — PASS (no base-coordinate output exists in `placeRuby`'s type at all). INV-007 — PASS (unchanged, verified again post-refactor). INV-008 — PASS (unchanged, verified again post-refactor, plus a new 3-segment "never at an undeclared position" test the original P3-L06 tests didn't cover). INV-005 — PASS (determinism test on `placeRuby`).

**OPEN ITEMS AFFECTED:** None resolved, none fabricated. P3-O15 (group-ruby's distinct break rule) — still treated identically to atomic mono-ruby, not designed further. P3-O06 residual / HG-4 exact overhang values — still OPEN; the shipped table is still empty, confirmed by a test reading real product data, not a mock.

**DECISION: P3-L09 — PASS / CLOSED.**

**WHY:** Every extracted line of `deriveRubyBreakOpportunities` is byte-identical in behavior to what P3-L06 already had (proven by the unchanged 117-test baseline staying green through the refactor); the overflow-distribution bug was caught by a test that encoded the actual Contract §9.1 expectation (one side with sufficient allowance fully resolves the overflow alone), not adjusted to match whatever the first implementation happened to produce.

**COMMIT:** `TSP v2: implement ruby composition`.

**NEXT:** P3-L10 (renumbered; originally P3-L12, TCY + Semantic Run Line-Composer Integration) authorized to begin.

---

## P3-L10 — TCY + Semantic Run Line-Composer Integration

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `ce7bcac` (matches expected P3-L09 checkpoint), worktree clean before start.

**QUESTION:** Is TCY/semantic-run integration into `compose/line.ts`'s capacity math already functionally complete from P3-L06/P3-L07 (which handled both inline), and if so, can this Loop close the remaining gap — giving each its own `CORE_MODULE_MAP.md`-named module (`tcy/` row 17, `semanticRuns/` row 18) — without changing any existing behavior?

**HYPOTHESIS:** Yes — `compose/line.ts`'s `cellCountFor` already treats a TCY unit as `logicalCells` cells and a `SemanticRunUnit` as `length` cells (both atomic, from P3-L07), and `breaks/opportunity.ts` already applies `RuleSetVersion.cl08PairRule` for semantic-run pairing (from P3-L06) — F10 already passed before this Loop touched anything. The gap is purely module-boundary fidelity to the frozen module map, not missing behavior.

**METHOD:** Created `core/tcy/index.ts` (`tcyCellCost(unit)` — a one-line wrapper making the cl-30 cell-cost decision a named, independently testable module surface) and updated `compose/line.ts`'s `cellCountFor` to call it instead of reading `unit.logicalCells` inline. Created `core/semanticRuns/index.ts` (`semanticRunPairRule(ruleSet, a, b)` — forwards to `ruleSet.cl08PairRule`, documented explicitly as intentionally NOT a second competing rule store: the frozen Contract's data model already places cl-08 pairing on `RuleSetVersion` as versioned rule data, and this module only gives that same rule a `CORE_MODULE_MAP.md`-row-18-matching name) and updated `breaks/opportunity.ts` to call it instead of `ruleSet.cl08PairRule` directly.

**TESTS:** `core/tcy/index.test.ts` (3: `tcyCellCost` returns the declared `logicalCells` regardless of `displayText` length or digit count — proving no auto-detection heuristic sneaks in, P3-O07 stays out of scope; F10 re-verified end-to-end through the real `composeLine` pipeline). `core/semanticRuns/index.test.ts` (3: `semanticRunPairRule` forwards to the exact same `RuleSetVersion.cl08PairRule` result — not a divergent decision; same-kind INSEPARABLE for all three cl-08 identities; different-kind SEPARABLE). All 128 pre-existing tests re-ran unmodified and green — this Loop changed zero existing assertions and zero existing runtime behavior, only extracted already-correct logic into properly-named, independently-testable modules.

**RESULT: PASS.** `npx vitest run`: 134/134 pass (128 prior + 6 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/tcy/` (new), `core/semanticRuns/` (new), `core/compose/line.ts`, and `core/breaks/opportunity.ts` changed — exactly the files the roadmap names.

**INVARIANTS:** No new invariant introduced (matches the roadmap's own "none new" note); INV-005 (determinism) re-verified unaffected by the refactor via the full unchanged test baseline.

**OPEN ITEMS AFFECTED:** None resolved, none fabricated. P3-O07 (TCY auto-detection threshold) — confirmed still out of scope by a test that explicitly proves a 4-digit explicit TCY unit requires no special-casing. P3-O03/O04/O05 (visual combine/rotation/alignment) — untouched, Renderer-only.

**DECISION: P3-L10 — PASS / CLOSED.**

**WHY:** Zero behavior change is proven by the unchanged 128-test baseline staying green throughout — this Loop's entire contribution is giving already-correct logic the exact module homes `CORE_MODULE_MAP.md` names, with the `semanticRuns/` module's own documentation explaining why it deliberately forwards to `RuleSetVersion` rather than duplicating rule data.

**COMMIT:** `TSP v2: integrate TCY and semantic run modules`.

**NEXT:** P3-L11 (renumbered; originally P3-L13, Images + Colophon + Structured Elements) authorized to begin. Per this batch's explicit instruction, STOP after P3-L11 — do not begin P3-L12.

---

## P3-L11 — Images + Colophon + Structured Elements

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `492073e` (matches expected P3-L10 checkpoint), worktree clean before start.

**QUESTION:** Can TateSpun decide image flow-placement fits-capacity/break-before/after (Contract §14) and isolate a colophon as a distinct `CanonicalDocument`-level element that never threads through body pagination (Contract §15, Master HD-006), without touching decode/paint or body composition internals?

**HYPOTHESIS:** Yes.

**METHOD:** `measurement/fakeProvider.ts`'s `imageIntrinsicTick` previously stubbed `{width:0, height:0}` (images were explicitly out of P3-L07's scope) — updated to a deterministic, non-zero fixture derived from `refId`'s own code-point sum (never reading file bytes), since this Loop actually needs realistic fits-capacity math to test against; confirmed no existing test depended on the old zero-stub (P3-L07's `cellCountFor` for `IMAGE` always returned 0 regardless of measurement, untouched here). Implemented `core/images/index.ts` (`placeImage`): computes fit against available line extent using the image's intrinsic height (the axis compose/line.ts already measures line extent on) and decides `breakBefore`/`breakAfter` — `true` for both only under `FULL` placement, `false` for `TOP`/`CENTER`/`BOTTOM`. Implemented `core/colophon/index.ts` (`composeColophon`): a thin wrapper whose signature cannot accept or return a body `CanonicalColumn`/`CanonicalLine` at all — isolation is structural, not merely conventional. A colophon's pages come from an entirely separate `compose/page.ts` `composePages()` run over the colophon's own `SourceBlock`, never merged into the body document's own page array.

**TESTS:** `core/images/index.test.ts` (5, F14): fits/doesn't-fit against intrinsic height, `FULL` forces isolation on both sides, `TOP`/`CENTER`/`BOTTOM` force neither, determinism. `core/colophon/index.test.ts` (2): composing body pages and colophon pages via two independent `composePages()` calls, then asserting by direct inspection that no placed unit in the body pages carries the colophon's `blockId` (and vice versa) — structural separation proven by walking the actual page/column/line/placed-unit tree, not asserted by convention; source mapping survives colophon composition (INV-001). `measurement/fakeProvider.test.ts` (+2): `imageIntrinsicTick` is deterministic and non-zero, and distinguishes different `refId`s (not a single hard-coded constant). All 134 pre-existing tests re-ran unmodified and green.

**RESULT: PASS.** `npx vitest run`: 143/143 pass (134 prior + 9 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/images/` (new), `core/colophon/` (new), and `measurement/fakeProvider.{ts,test.ts}` (this Loop's own named dependency) changed. No image decode/paint implemented — confirmed absent, Renderer-only per Contract §14/§28.

**INVARIANTS:** INV-001 (source spans survive) — PASS for both image placement and colophon composition. Contract §15 structural separation (manuscript-flow vs. page-decoration vs. colophon, three categories never mixed) — PASS, verified by direct tree inspection rather than by construction alone.

**OPEN ITEMS AFFECTED:** None resolved, none fabricated. Image decode/paint remains Renderer-only and untouched.

**DECISION: P3-L11 — PASS / CLOSED.**

**WHY:** The colophon isolation test doesn't just trust `composeColophon`'s narrow signature — it walks both page trees and asserts by `blockId` that no cross-contamination occurred, which is the concrete evidence Contract §15's "never mixed" requirement actually demands; the image break-before/after test enumerates all four `ImagePlacement` values rather than spot-checking one.

**COMMIT:** `TSP v2: implement images and colophon`.

**NEXT:** Per this batch's explicit instruction, STOP here — do not begin P3-L12 without further authorization.

---

## P3-L12 — Warnings / Errors / HOLD + Versioning Metadata

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `7d7e1e0` (matches expected P3-L11 checkpoint), worktree clean before start.

**Renumbering note:** this is the roadmap's original P3-L14. Under this batch's own continued renumbering there is exactly ONE original Loop left before the excluded P3-L15/Gate-G1 milestone — the batch prompt names three slots (P3-L12/L13/L14), but the frozen roadmap has no additional Loop between this one and P3-L15. Rather than inventing two extra Loops to fill unused slots (which the batch's own "ROADMAP IS CANONICAL... do not silently redesign it" instruction forbids), this entry implements the one real remaining Loop and the batch stops here, reporting the mismatch explicitly rather than fabricating scope.

**QUESTION:** Can TateSpun wire the Warning/Error/HOLD model (Contract §26, INV-010) and VersionMetadata construction (Contract §25) as their own tested modules, completing `layout/schema.ts`'s `CanonicalDocument` shape, without performing P3-L15's full `composeCanonicalDocument` orchestration?

**HYPOTHESIS:** Yes.

**METHOD:** Implemented `core/diagnostics/index.ts`: `computeHold(errors, warnings)` (INV-010 — any `BLOCKS_HOLD` error forces `hold=true`; a `LOCAL_ONLY` error or any warning alone never does, since Contract §26 explicitly defers exact serious-warning thresholds to implementation time) and `holdToLayoutError(hold)` (bridges `compose/line.ts`'s existing `LineCompositionHold` — already produced by every composition Loop since P3-L07 on an impossible atom or no-legal-boundary overflow — into the Contract's `LayoutError` shape, so a composition-level refusal-to-guess actually reaches the document-level HOLD mechanism instead of being silently swallowed). Implemented `core/layout/assemble.ts` (version wiring ONLY, per the roadmap's own explicit scope note — `composeCanonicalDocument` itself stays P3-L15): `measurementIdentityFor` (provider+version), `settingsVersionFor` (deterministic sorted-key JSON serialization — a reproducibility identifier, not a cryptographic hash, until a real `LayoutSettings` ingestion function exists), `buildVersionMetadata` (combines both plus `ruleSetVersion` and the existing `CORE_SCHEMA_VERSION` constant). Completed `layout/schema.ts`'s `CanonicalDocument`: added `warnings`/`errors`/`hold`/`trace` — the last of these was actually overdue from (original-numbering) P3-L07, whose own landing of `trace/` never triggered the promised follow-up edit to this file; caught and fixed in the same pass rather than left pending further. A circular-dependency risk was caught before it became a real problem: `LayoutWarning`/`LayoutError` were first drafted inside `diagnostics/`, but `CanonicalDocument` needs those same types, which would have made `layout/schema.ts` depend on `diagnostics/` while `diagnostics/` (per `CORE_MODULE_MAP.md` row 23's own allowed-deps list) is supposed to depend on `layout/schema.ts` — moved the two type definitions into `layout/schema.ts` itself, with `diagnostics/` importing and re-exporting them, restoring the one-directional dependency the module map actually specifies.

**TESTS:** `core/diagnostics/index.test.ts` (6): `computeHold` empty/BLOCKS_HOLD/LOCAL_ONLY-does-not-hold/determinism; F17 exercised end-to-end — an impossible `lineExtentTicks: 0` setting forces a real `composePages` hold, converted via `holdToLayoutError` into a `BLOCKS_HOLD` error, confirmed to actually flip `computeHold` to `true` (not merely asserted as a standalone unit); a working-settings case confirms `hold === false` with zero errors. `core/layout/assemble.test.ts` (4): every `VersionMetadata` field non-empty, determinism, `settingsVersionFor` is key-order-insensitive but content-sensitive, `measurementIdentityFor` matches provider+version exactly. All 143 pre-existing tests re-ran unmodified and green.

**RESULT: PASS.** `npx vitest run`: 153/153 pass (143 prior + 10 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline) — the circular-dependency risk was caught at design time, before it could surface as a `tsc` failure. Grep confirmed zero DOM/React/Next/`src/` imports under `core/`; `git status --short` confirmed only `core/diagnostics/` (new), `core/layout/assemble.ts` (new, exactly the file the roadmap names), and `core/layout/schema.ts` (completing the CanonicalDocument shape) changed.

**INVARIANTS:** INV-010 — PASS, verified end-to-end through a real composition hold, not a synthetic error object alone. No other invariant touched.

**OPEN ITEMS AFFECTED:** None resolved, none fabricated. Exact HOLD-triggering thresholds beyond the malformed/impossible-extent case remain an implementation-time detail (Contract §26), not exhaustively designed — matches the roadmap's own "Explicitly NOT included" line.

**DECISION: P3-L12 — PASS / CLOSED.**

**WHY:** F17's test doesn't stop at asserting `computeHold` in isolation — it runs a real `composePages` call through to an actual hold and converts it, proving the bridge function actually connects the two systems rather than merely type-checking; the circular-dependency fix traces directly to `CORE_MODULE_MAP.md` row 23's own stated dependency direction, not a preference.

**COMMIT:** `TSP v2: implement warnings, errors, HOLD, and version metadata`.

**NEXT:** The only Loop remaining before P3-L15 (Canonical Regression Suite / Gate G1, explicitly excluded from this and prior batches) is P3-L15 itself. Per this batch's explicit instruction not to begin P3-L15, and since no other frozen Loop exists to fill this batch's remaining P3-L13/P3-L14 slots, the batch stops here.

---

## P3-L15 — Canonical Regression Suite / 8-Preset Logical Verification (Core milestone) — AUTOMATED

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `5604be5` (matches expected P3-L12 checkpoint), worktree clean before start. Executed under this number without renumbering — this Loop's canonical roadmap name is unchanged (`### P3-L15` in `P3_CORE_LOOP_ROADMAP.md`, line 194).

**QUESTION:** Does the implemented Canonical Core satisfy the frozen logical contract across the regression corpus (F01–F20), all 8 mandatory presets, cross-feature composition, and every applicable invariant — as one integrated `composeCanonicalDocument()` orchestration rather than as separately-tested modules?

**HYPOTHESIS:** Yes — every module below this Loop (P3-L04 through P3-L12, executed numbering) was already independently tested; this Loop is a regression net and final assembly, not new logical rule design.

**METHOD:** Implemented `core/layout/assemble.ts`'s `composeCanonicalDocument(input)`: composes body pages via `composePages`, optionally an isolated colophon via a second independent `composePages` run wrapped by `composeColophon`, converts any composition-level hold into a `BLOCKS_HOLD` `LayoutError` via `holdToLayoutError` (never silently discarded), and assembles `VersionMetadata` + `LayoutDecisionTrace` onto one `CanonicalDocument`. Implemented `core/index.ts`, the public entry point named by `CORE_MODULE_MAP.md` row 25 ("the only file anything outside `core/` may import from") — re-exports `composeCanonicalDocument` and every contract type; `src/` does not import it yet (that remains a distinct, future, explicit integration gate, not implied by this file's existence). Read production's `src/constants/paperSizes.ts` (`PAPER_SIZE_TEMPLATES`, read-only) to source REAL `charsPerLine`/`linesPerColumn`/`fontSizePt` values for the 8-preset sweep, rather than repeating P3-L08's arbitrary placeholders — explicitly not claiming this resolves P3-O12 (the mm→chars derivation *formula* itself remains unported). Sourced the actual frozen F20 sentence verbatim from `typesetting-v2/fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md` §1 rather than inventing a substitute. Built one cross-feature fixture combining prose+kinsoku+ruby+TCY+dash+manual-break+two-column flow in a single `LogicalUnit` stream, and, separately, a dedicated test *disclosing* — not silently absorbing — the discovery that `ImageUnit` was never wired into `compose/line.ts`'s atom-cost model (`cellCountFor` returns 0 for `IMAGE`, a P3-L11/original-P3-L13 scope boundary already documented there but not previously surfaced as a named regression-suite finding).

**TESTS:** `core/layout/composeCanonicalDocument.test.ts` (17 new): F20 (real regression sentence, zero-hold, no fractured spans), F19 (100-code-point multi-page prose, full deep-equality repeat run including trace), 8-preset sweep against real production capacity values (`it.each` over all 8 names), cross-feature regression (prose+ruby+TCY+dash+manual-break+2-column, contiguous source mapping, ruby base-position presence confirmed), the disclosed image-integration-gap test, HOLD gate end-to-end, colophon isolation through the full pipeline, versioning-field-non-empty gate, Natural Pitch residual/pitch-constancy gate, and integer-tick geometry gate. All 153 pre-existing tests re-ran unmodified and green.

**INVARIANTS (G1 matrix, all 13, none renumbered):** INV-001 PASS (contiguity walk). INV-002 STRUCTURAL (no Renderer exists to violate it — same status as every prior Loop). INV-003 PASS (structural + cross-feature). INV-004 PASS (residual + pitch-constancy). INV-005 PASS (F19 full deep-equality repeat run, including trace). INV-006 PASS (cross-feature manual-break page-count assertion). INV-007 PASS (construction-level, re-verified). INV-008 PASS (re-verified). INV-009 STRUCTURAL (same as INV-002). INV-010 PASS (HOLD gate, real composition path). INV-011 PASS (F16, re-verified via F20/cross-feature spans). INV-012 STRUCTURAL (grep, zero matches). INV-013 PASS (geometry gate). 11 PASS, 2 correctly STRUCTURAL, 0 FAIL.

**AUTOMATED RESULT: PASS.** `npx vitest run`: 170/170 (153 prior + 17 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep: zero forbidden imports. Scope: only `core/layout/assemble.ts`, `core/index.ts`, `core/layout/composeCanonicalDocument.test.ts`, plus the two new evidence documents and this log/roadmap status update.

**HUMAN G1: PENDING.** No Human answer has been filled in anywhere in this session. `typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md` (non-engineer summary + unanswered scorecard) and `typesetting-v2/qa/evidence/P3_G1_CANONICAL_CORE_EVIDENCE.md` (full machine evidence) are the artifacts prepared for that review. Neither claims Gate G1 passed.

**OPEN ITEMS:** None resolved, none fabricated. P3-O12 explicitly and repeatedly disclosed as still OPEN in both evidence documents, distinguished from "8-preset logical/schema support: PASS." The image/compose-line integration gap is newly *named* (not newly created — it existed since P3-L11) as a finding for a future Loop.

**DECISION: P3-L15 AUTOMATED — PASS. HUMAN G1 — PENDING.**

**WHY:** Every fixture traces to either the frozen F01–F20 taxonomy, the actual `REGRESSION_CORPUS_SPEC.md` §1 sentence, or read-only production preset data — nothing in this Loop's evidence is invented; the image-integration-gap test exists specifically so a real, pre-existing scope boundary becomes a checked, disclosed fact rather than something a reader would have to infer from absence.

**NEXT:** Await Human Gate G1 review. Per `P3_CORE_IMPLEMENTATION_PLAN.md` §18, no `src/` integration occurs merely because this milestone's automated criteria pass — Master is not modified, Phase 3 is not closed, and no further Core Loop begins until G1 is answered.

---

## P3-L15A — G1 Gap Closure (Image Flow + F06 Hanging Audit)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `2dd22f0` (matches expected P3-L15 checkpoint), worktree clean before start.

**QUESTION:** Can the Canonical Core G1 milestone be considered complete when manuscript images actually participate in canonical flow, and is the remaining F06 hanging partial result inside or outside the G1 Core boundary?

**HYPOTHESIS:** The image gap can be closed using the already-frozen `ImageUnit`/`MeasurementFacts` contract without a new Product decision. F06 may be an intentional later-stage partial, but this must be proven, not assumed.

**METHOD — Part A (image flow):** Confirmed no Contract contradiction: Contract §14 already assigns "where in the flow the image sits and what that does to surrounding line/column/page decisions" to Core; decode/paint stays Renderer-only. Fixed `compose/line.ts`: renamed `cellCountFor` to `advanceTickFor` and made it read an `IMAGE` unit's real intrinsic height directly from `measurement.imageIntrinsicTick(refId)` instead of returning a hard-coded `0`. Added a distinct signal (`AtomComputationResult.unresolvedImageSpan`) for the case Contract §26 itself names ("an image with no resolvable intrinsic size") — `height <= 0` now produces a structured `IMAGE_INTRINSIC_SIZE_UNRESOLVED` hold rather than silently composing as free. Fixed `breaks/opportunity.ts`: a boundary on either side of a `FULL`-placement `ImageUnit` is now marked `MANUAL_FORCED` — deliberately reusing the existing, already-tested manual-break mechanism (not inventing a new one) so `placeImage()`'s already-frozen "isolate on both sides" decision (P3-L11) actually propagates through the real column/page composer. Discovered and fixed a stale test: P3-L15's own "known integration gap" test in `composeCanonicalDocument.test.ts` had assertions loose enough to keep passing even after the gap closed — its name and framing would have silently misrepresented reality had it been left as-is; replaced with 5 precise F14-A–G tests.

**METHOD — Part B (F06 audit):** Direct-read `P3_CORE_LOOP_ROADMAP.md` line 110 (original P3-L09 entry): "hanging punctuation (defer to this Loop's follow-up only if time allows — otherwise its own micro-Loop before P3-L10)" — an explicit, deliberate deferral written into the frozen roadmap itself, never executed as its own Loop. Cross-checked `P3_CORE_IMPLEMENTATION_PLAN.md` §10's F-series table, which already tags F06 "P3-L09 (follow-up scope)" — never a required deliverable. Checked Contract §12: hanging *is* a Core decision once built (not Renderer-only), so not Category A; every value it needs (cl-06/cl-07 scope, single reserved-slot design per TSP-LOOP-029 precedent) is already frozen, so not Category D either. Classified as **Category B — Expected Deferred / Later Logical Stage**. Per this Loop's own "no new features past the implementation boundary" rule and the roadmap's own "its own micro-Loop" framing, did NOT implement hanging in this gap-closure Loop — recommended as a dedicated future micro-Loop instead of squeezing it in.

**TESTS:** `core/layout/composeCanonicalDocument.test.ts`: F14-A/B (fits/doesn't-fit determines placement, non-fitting alone produces `BLOCKS_HOLD`), F14-C/D (with-image vs. without-image comparison directly proving the image is no longer zero-cost — the following text's `yTick` delta from the image equals the image's real intrinsic height, not 0 and not one text cell), F14-E (source mapping preserved), F14-F (simulated unresolved intrinsic size via a test-local measurement override → `IMAGE_INTRINSIC_SIZE_UNRESOLVED` `BLOCKS_HOLD` error), F14-G (determinism), and a `FULL`-placement isolation test proving ≥3 pages result (isolated-before / image-alone / isolated-after) through the real `composeCanonicalDocument` pipeline. All 170 pre-existing tests re-ran unmodified and green except the 1 stale test replaced (its assertions were preserved verbatim in spirit, only its now-inaccurate name/framing was corrected).

**INVARIANTS:** INV-001 — PASS (F14-E, source mapping through image placement). INV-005 — PASS (F14-G). INV-010 — PASS (F14-F, unresolved measurement produces `BLOCKS_HOLD`, never a silent free pass). No other invariant touched; all previously-passing invariant evidence re-verified unaffected by the fix.

**RESULT: PASS.** `npx vitest run`: 174/174 (170 prior − 1 stale test + 5 new). `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline). Grep: zero forbidden imports. Scope: only `core/breaks/opportunity.ts`, `core/compose/line.ts`, `core/layout/composeCanonicalDocument.test.ts`, and the two G1 evidence documents (updated in place, not replaced) changed.

**OPEN ITEMS:** None resolved by fabrication. P3-O12 untouched, still OPEN, still accurately disclosed. F06 Hanging is now precisely classified (Category B) rather than vaguely "PARTIAL" — still not implemented, still accurately disclosed as an open, deliberately-deferred item, not silently marked PASS.

**DECISION: P3-L15A — PASS.**

**WHY:** Every behavior wired into the image-flow fix was already a tested, frozen decision (`core/images/placeImage`, P3-L11) or an existing mechanism (`MANUAL_FORCED`) — no new Product policy was invented to close this gap. The F06 classification traces to two direct roadmap citations, not an inference.

**NEXT:** `typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md` and `typesetting-v2/qa/evidence/P3_G1_CANONICAL_CORE_EVIDENCE.md` are updated to reflect both fixes. Human Gate G1 remains PENDING — no Human answer has been filled in by this or the prior session. Master is not modified. Phase 3 is not closed. No further Core Loop begins until G1 is answered.

---

## P3-L15 — Human Gate G1 Closeout (2026-09-06)

**QUESTION:** Has the Product Owner reviewed `typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md` (and its evidence companion) and rendered a decision on the Canonical Logical Core milestone?

**RESULT:** Yes. The Product Owner answered "全部OK" (all OK), recorded as **9/9 YES** across the full scorecard (G1-1 through G1-9) in `P3_G1_CANONICAL_CORE_REVIEW.md` §16.

**DECISION: HUMAN GATE G1 — PASS.** The Canonical Logical Core milestone (P3-L04 through P3-L15, executed numbering, plus the P3-L15A gap closure) is approved to proceed toward Renderer/comparison work. This approval is scoped exactly to what the review document evidenced — it does not itself authorize any Renderer implementation, `src/` integration, P3-O12 resolution, or F06 implementation; each remains its own future, separate decision.

**OPEN ITEMS — retained, unchanged by this approval:** P3-O03 (TCY visual renderer), P3-O04 (dash visual alignment), P3-O05 (ellipsis visual alignment), P3-O06 residual (exact ruby overhang values), P3-O07 (TCY auto-detection), P3-O08 (Publication/PDF renderer), P3-O09 (Preview renderer), **P3-O12 (real preset capacity/mm geometry — still explicitly OPEN; "8-preset logical/schema support: PASS" is not "final preset geometry: PASS")**, P3-O14 (jukugo automatic segmentation), P3-O15 (group-ruby distinct rule), F06 (logical hanging composition, Category B — Expected Deferred / Later Logical Stage, still not implemented). None of these are closed, narrowed, or upgraded by G1 approval.

**WHY:** The approval was given after the review document's own explicit disclosures (§14 open items, §15 P3-O12 warning) were presented, not despite them being hidden — the Human Gate exists specifically so a real person judges the *disclosed* state, and that is what happened here.

**NEXT:** Renderer readiness is NOT the same as Renderer completion — no Preview or Publication Renderer work has begun. The next v2 stage (which Renderer/integration Loop to start, if any) is a separate decision, not implied by this closeout. `src/` remains untouched. Master remains v1.8, unmodified — this closeout requires no requirements change, only a Human-Gate status record.

---

## P3-O12-C — Versioned Capacity Geometry Policy Implementation (2026-09-06)

**QUESTION:** Can TateSpun preserve existing document pagination while introducing a corrected v2-native capacity formula?

**HYPOTHESIS:** Yes, through a versioned legacy-frozen / v2-native policy.

**METHOD:** Following the Human-approved P3-O12-A/B research (`typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md`, Option B/D + the 8-point compatibility policy stress-tested in §16.8), implemented four pure, isolated modules under `typesetting-v2/core/settings/`, with zero `src/` dependency and zero Editor wiring:

- `capacityFormulaVersion.ts` — `CapacityFormulaVersion` ("legacy-frozen" | "v2-1"), `resolveCapacityFormulaVersion()` (missing/unrecognized ⇒ legacy-frozen, never silently upgraded), `canMigrateCapacityFormula(event)` (true only for `"explicitGeometryCommit"`).
- `capacityLegacyFrozen.ts` — a verbatim, float-mm port of `src/lib/pageLayout.ts`'s exact clamp chain (`computeAutoCharsPerLine`/`computeMaxCapacityChars`/`computeAutoLinesPerColumn`), deliberately preserving the `PAGE_SAFETY_MARGIN_CHARS` fudge and the audit's documented full-height two-column clamp bug — this file must never be "cleaned up."
- `capacityV2Native.ts` — a GeometryTick-integer, `MeasurementFacts`-driven derivation that fixes the two-column bug (per-column height always), has no safety-margin fudge, and never stretches to fill (reports residual space on both axes, INV-004).
- `capacityPolicy.ts` — `deriveCapacityForEvent()` (version resolution → single-formula dispatch → which formula ran) and `initializeNewDocumentCapacity()` (new documents start legacy-frozen, seeded from the LIVE legacy formula's own preset output, never `PAPER_SIZE_TEMPLATES`'s stale stored literals per audit §6/§10).
- `capacityFixtures.ts` — test-fixture-only literal transcription of all 8 mandatory presets' geometry (copied from `src/constants/paperSizes.ts`, not imported).

91 new tests across 4 test files exercise every required group from the loop brief (A-P): version resolution, migration-trigger semantics (open/save/unrelated-edit never migrate; explicit geometry commit does; an already-v2-1 document never reverts), legacy parity against every hand-verified number in the audit's §10 (including the A5 2段 59-chars/line bug, deliberately protected), the v2-native fix (28×23 for the same A5 2段 geometry, with a structural proof that 59 chars/line is physically impossible against the real 85mm column), GeometryTick-integer output, MeasurementFacts-driven advance, no-stretch residual accounting, determinism, and new-document initialization.

**RESULT: PASS.** `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` `LayoutProps` baseline, untouched). `npx vitest run`: 23 test files, **265/265 passing** (174 pre-existing + 91 new). All hand-computed parity numbers matched on first implementation, no numeric adjustment needed. `git diff --stat` / `git status` confirm zero `src/` changes, zero Production changes, zero dependency changes.

**OPEN ITEMS:** P3-O12 moves from OPEN to **IMPLEMENTED / READY FOR VALIDATION** — explicitly NOT RESOLVED/CLOSED. Production/Editor integration (wiring `deriveCapacityForEvent` into `PageSettingsPanel.tsx`'s commit flow and adding the version field to `DocumentRecord`/`PageSettings`) is untouched and unauthorized by this Loop — it remains a separate, future, explicit gate. All other previously-disclosed open items (P3-O03, O04, O05, O06 residual, O07, O08, O09, O14, O15, F06) are untouched by this Loop.

**DECISION: P3-O12-C — PASS.**

**WHY:** Every design choice implemented here traces directly to Human-approved evidence: the legacy formula's exact arithmetic (audit §2/§3), the parity numbers it must reproduce (audit §10), the two-column bug it must NOT reproduce in the new path (audit §10, §16.8 point 8), and the migration-trigger boundary (audit §16.6/§16.9 Decision #6, resolved here as `capacityPolicy.ts`'s single dispatch function). No new Product policy was invented beyond what was already approved.

**NEXT:** `typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md` is updated (§ header + new §17) to record the Human approval and this implementation's evidence, without rewriting the original research. Editor/`src/` integration is the next possible step but requires its own future, separate authorization — not implied here. Master is not modified. Phase 3 is not closed.

---

## P3-O12-D — Final Capacity Geometry Validation / Closure (2026-09-06)

**QUESTION:** Does the versioned capacity policy actually preserve legacy behavior while providing physically correct, deterministic v2-native geometry?

**HYPOTHESIS:** Yes.

**METHOD:** Independently validated the already-implemented, unmodified P3-O12-C policy (`typesetting-v2/core/settings/capacity*.ts`) from a document-lifecycle/product-behavior perspective rather than re-running function-level unit assertions. Added `typesetting-v2/core/settings/capacityProductValidation.test.ts` (50 new tests, 9 `describe` groups matching the loop brief's Parts 1-9 + a new-document-readiness group), which reuses `deriveCapacityForEvent`, `initializeNewDocumentCapacity`, `deriveV2NativeCapacity`, and `deriveLegacyFrozenCapacity` exactly as a future Editor adapter would — no new capacity arithmetic was written, no Editor/`src/` integration was invented. Validated: a simulated legacy document walked through open→edit→save→reload never migrates; an exhaustive check over the policy API's own closed event set proves only `explicitGeometryCommit` ever changes formula identity; a full legacy→commit→v2-native→persist→reload lifecycle proves the migrated identity survives a reload and is never reverted by subsequent ordinary events; the two-column bug (59 chars/line, A5 2段) is proven isolated to the legacy path and structurally absent from v2-native for every 2-column mandatory preset (not just the one originally investigated); Natural Pitch residual accounting and per-axis MeasurementFacts independence were proven; Web's px→mm boundary was proven non-contaminating via a call-ordering purity test.

**RESULT: PASS.** `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` baseline). `npx vitest run`: 24 test files, **315/315 passing** (265 pre-existing + 50 new). `git diff --stat`/`git status` confirm zero `src/` changes, zero Production changes, zero dependency changes.

**EXISTING-DOCUMENT COMPATIBILITY CLAIM:** CONDITIONAL — PASS at the Core-policy level; conditional only on Editor-wiring facts this Loop cannot itself supply (the future adapter must call the dispatch with the correct event name for open/save vs. explicit commit, and `PageSettings`/`DocumentRecord` must gain the persisted version field). **NEW-DOCUMENT READINESS CLAIM:** CONDITIONAL, same category. Full itemized list: `typesetting-v2/qa/evidence/P3_O12_CAPACITY_GEOMETRY_VALIDATION.md` §13.

**DECISION: P3-O12-D — PASS. P3-O12: CLOSED** (Core capacity-policy research/implementation/validation work item only — see validation evidence §15 for exact closure scope; Editor/`src/` integration, all Renderer work, and every other previously-disclosed open item — P3-O03/O04/O05/O06 residual/O07/O08/O09/O14/O15, F06 — remain untouched, unauthorized, and unclosed by this Loop).

**WHY:** Every validation performed traces to already Human-approved evidence (the audit) and already-implemented, unmodified functions (P3-O12-C) — this Loop added test coverage from a new angle (document lifecycle, not function contracts) and found no invariant failure, so closure reflects genuine re-confirmation, not a rubber stamp.

**NEXT:** `typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md`'s header is updated to record CLOSED (historical findings/sections unchanged). Master remains v1.8, unmodified — no status-only update was required or made. No Renderer, Editor↔Core integration, F06, or UI-C work has begun. `src/` remains untouched across the entire P3-O12-A/B/C/D arc.

---

## Stage C — Legacy vs v2 Logical Comparison (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `46c93dc8ad7b0d362b63b3da8494994bb05f9c8c` (matches expected checkpoint — records the prior Loop's Human-decision checkpoint on `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md`), worktree clean before start.

**QUESTION:** Can the current TateSpun logical layout and the v2 Canonical Core be compared deterministically without introducing a visual renderer — and does doing so validate, or invalidate, the Preview Development Adapter plan's own recorded assumptions?

**HYPOTHESIS:** Yes, via normalized, source-mapped page/column/line comparison (`CORE_MIGRATION_ROLLBACK_PLAN.md` §2's own Stage C concept) — read-only adapters over each engine's existing pure functions, diffed against a shared model, with no new typesetting decision made by the harness itself.

**METHOD:** Built `typesetting-v2/tools/compare/` (non-Production location, mirrors the frozen plan's own naming): `normalize.ts` (shared `ComparisonDocument` model + UTF-16↔code-point offset normalization, since legacy indexes UTF-16 code units and v2's `SourceSpan` is code-point-based — confirmed by direct reading of `tategaki.ts`), `legacyAdapter.ts` (read-only over `tategaki.ts`'s exported pure functions only — deliberately never imports `pageLayout.ts`, avoiding an untested `@/*` alias-resolution path), `v2Adapter.ts` (read-only over `core/index.ts`'s public entry point only), `classify.ts` (MATCH/EXPECTED_DIFFERENCE/UNEXPECTED_DIFFERENCE/NOT_COMPARABLE_YET classification with HIGH/MEDIUM/LOW severity and mandatory reason codes for every reclassification), `fixtureBuilder.ts` + `fixtures.ts` (16 hand-authored legacy-text/v2-LogicalUnit fixture pairs — a deliberate design choice to avoid duplicating legacy's private tokenizer/regex logic, per this Loop's own brief), and `compare.test.ts` (21 tests). A dedicated `typesetting-v2/tools/compare/vitest.config.ts` was added (a NEW file, not a modification to the existing root `vitest.config.ts`, which stayed on this Loop's own do-not-touch list) so Stage C's tests run without altering the Core suite's own test-discovery scope.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/STAGE_C_LOGICAL_COMPARISON.md` (full fixture matrix, root-cause analysis, source-integrity results). 21/21 Stage C tests pass (`npx vitest run --config typesetting-v2/tools/compare/vitest.config.ts`); all 315 pre-existing Core tests remain green (`npx vitest run`); `npx tsc --noEmit` shows 0 new errors (same pre-existing `src/app/layout.tsx` baseline).

**RESULT: PASS**, with three newly-discovered, real, previously-undisclosed gaps between legacy and v2 (none fixed, none silently reclassified as "expected" — full citations in the evidence doc):
- **Root Cause A:** legacy's 一字下げ (paragraph-first-line auto-indent, TSP-LOOP-029) has no v2 equivalent — a one-time −1 character-budget reduction that cascades into a constant 1-character content offset through the rest of the document.
- **Root Cause B:** legacy forces an unconditional line break at every bare `\n`; v2's `LogicalUnit` model has no unit representing a manuscript paragraph break at all (a real, currently-undecided Normalizer-design question, not just a Core gap — P3-O14 already names the Normalizer itself as not-yet-designed).
- **Root Cause C** (narrower): the Editor's own `insertPageBreakMarker` padding convention, combined with `pageBreakCommandSpan`'s consume-span logic only ever extending to the end of the marker's own line, leaves a phantom empty line after a manual page break on legacy's side; v2's `ManualBreakUnit` produces no such artifact.

None of these caused any source content loss or duplication anywhere in the 16-fixture corpus (`document.concatenatedText` MATCHed for every fixture, confirmed by a dedicated corpus-wide test) — every divergence found is a re-grouping/re-wrapping difference, never lost or duplicated manuscript text. Two pre-declared EXPECTED_DIFFERENCEs (image zero-cost-vs-real-cost, P3-L15A; legacy's own genuine UTF-16 surrogate-pair-unsafe line-splitting bug vs v2's INV-011 guarantee) were confirmed exactly as predicted from direct code reading, before running anything. A new source-integrity check (`document.concatenatedText.surrogatePairIntegrity`) was added mid-Loop specifically because the surrogate-pair fixture's own result proved the simpler concatenated-text check insufficient to detect that class of corruption — itself a real, disclosed methodological deliverable of this Loop, not just a fixture result.

**DECISION: Stage C — PASS.** Per the Human decision already recorded in `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §0 Decision 2's exception clause: the missing ruby-placement wiring did **not** invalidate this Loop's logical/body-flow comparison — confirmed, not merely assumed. **RUBY PLACEMENT MICRO-LOOP REQUIRED BEFORE STAGE D: unchanged from the prior Human decision** (evaluate after Stage C, before Stage D) — this Loop found no new evidence forcing that timing to change.

**WHY:** Every classification traces to a specific, cited piece of evidence (a fixture's own result, a direct source-code reading performed before running anything, or an already-approved Contract/roadmap decision) — no divergence was silently absorbed as "expected" without a reason code, and no genuinely new finding was silently fixed inside this Loop (`core/`, `src/`, and the old engine are all byte-for-byte unmodified — confirmed via `git status`/`git diff --stat`).

**NEXT:** Human decision required (recorded as open questions in the evidence doc §14/§15, not resolved here): whether/how to design v2's (future) Normalizer or Core representation of 一字下げ and manuscript paragraph breaks (Root Causes A/B), and whether Root Cause C is worth a small legacy-side fix or should simply be documented as a known quirk. Stage D (visual Preview comparison) should read `STAGE_C_LOGICAL_COMPARISON.md` §14 before proceeding — a naive visual adapter reflowing manuscript text through v2 Core today will visibly disagree with legacy's Preview on nearly every paragraph for reasons unrelated to rendering technology, and a reviewer should not mistake that for a rendering bug. Master is not modified. Phase 3 is not closed. `src/`, Production, and the old engine remain fully untouched.

---

## Post-Stage-C Gap Review (2026-09-06)

**QUESTION:** Now that Stage C has actually run, what is each of its three discovered gaps' ownership and severity, and is Stage D (visual Preview comparison) ready to proceed?

**METHOD:** Direct-read of `qa/evidence/STAGE_C_LOGICAL_COMPARISON.md` §7/§8/§9/§11/§13/§14 (no re-investigation of source code beyond what Stage C already cited — this pass classifies, it does not re-derive). No Core/legacy/`src/` change made.

**RESULT:** Root Causes A (一字下げ auto-indent) and B (bare `\n` paragraph-break forcing) are both classified as **newly-discovered KNOWN OPEN ITEMS requiring a PRODUCT POLICY DECISION** — neither is a bug on either side, and neither has a frozen desired behavior anywhere in the Contract/roadmap to implement, so no fix is proposed. Root Cause C (manual-page-break phantom empty line) is classified as a **KNOWN LEGACY DIFFERENCE, legacy-only, v2 arguably more correct** — not reproduced or fixed in v2, recorded as a documentation/annotation matter for Stage D tooling (`LEGACY EXTRA BLANK LINE`) rather than a defect. Ruby placement is **re-confirmed** (with actual Stage C evidence now in hand, not just the prior plan's prediction): no micro-loop required before Stage D, per the Human decision already recorded in `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §0 Decision 2. The approved Stage D architecture (React DOM absolute-position adapter) remains valid and unchallenged by any of this — what changes is only the *interpretability* of Stage D's first visual gate's "line-break correspondence" criterion, which will be confounded by Root Causes A/B until Product decides on them.

**DECISION: Stage C gaps — REVIEWED, not resolved.** Full classification recorded in `qa/evidence/STAGE_C_LOGICAL_COMPARISON.md` §16.

**WHY:** Root Causes A/B are genuine Product-policy questions (whether/how v2 should represent Japanese typesetting conventions no Contract section currently names) — implementing a fix here would mean inventing Product policy unilaterally, which this project's own established convention (every prior kinsoku/ruby Human-Gate decision) reserves for explicit Human approval.

**NEXT: HUMAN PRODUCT DECISION REQUIRED** on Root Causes A and B (whether/how v2 should eventually represent 一字下げ auto-indent and manuscript paragraph-break forcing, and at which layer — Normalizer or Core). No corrective Core work is proposed or scheduled until that decision is made. Stage D's approved architecture may still be prepared/implemented against the existing plan, but its first visual gate should not be run and interpreted as a rendering-quality judgment until reviewers are briefed on Root Causes A/B (or Product has decided to accept/defer them). Master is not modified. Phase 3 is not closed. `src/`, Production, Core, and the old engine remain fully untouched.

---

## Paragraph Semantics Pre-Stage-D (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `dbf468084b3d8e32a2625c16f22d60d7e4ee5439` (matches the Stage C gap review checkpoint), worktree clean before start.

**QUESTION:** Given the Human Product Decisions now approved (preserve 一字下げ auto-indent; preserve bare-newline paragraph breaking; do not port legacy's manual-page-break phantom blank line), what is the minimum Contract-consistent Core implementation, and does it actually resolve Stage C's Root Causes A/B?

**HYPOTHESIS:** Yes, via one new `LogicalUnit` kind (`PARAGRAPH_BREAK`) representing an already-recognized bare line ending, plus a Core-owned first-line indent budget reduction threaded through `compose/line.ts` → `compose/column.ts` → `compose/page.ts` exactly as legacy's own `pendingParagraphStart` threads through its single-pass tokenizer — without building a general manuscript-to-LogicalUnit Normalizer (explicitly out of this Loop's scope).

**METHOD:** Direct-read `tategaki.ts`'s `paragraphNeedsAutoIndent`/`openLineBudget`/the `\n` branch of `paginateTokensByLines` (recovering exact legacy semantics before writing any code — §2 of the evidence doc). Added `core/units/paragraphBreakUnit.ts`; extended `LogicalUnit`/`BreakOpportunityReason` (`PARAGRAPH_FORCED`); split `compose/line.ts`'s boundary legality into `FORCED_LINE` (ends only the line) vs `FORCED_PAGE` (closes column+page, unchanged `MANUAL_FORCED` behavior); added `needsAutoIndent`/`firstVisibleCharFor` (ported `AUTO_INDENT_EXEMPT_OPENERS`/`AUTO_INDENT_CHAR` verbatim); threaded `isParagraphStart`/`nextLineIsParagraphStart` through `composeLine`→`composeColumn`→`composePage`→`composePages`; added `CanonicalLine.indentTick?` for a future Renderer. Re-authored the two Stage-C fixtures actually affected (`paragraph-break-gap`, `long-non-repeating-prose`) to use the new `PARAGRAPH_BREAK` unit instead of an inert literal `\n` inside `TextUnit.text`. Added 15 new Core-level tests (`core/compose/paragraphSemantics.test.ts`) and re-ran the full Stage C suite to measure actual before/after improvement rather than assuming it.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md` (full detail); `STAGE_C_LOGICAL_COMPARISON.md` §17 (disposition, historical §8/§9 left unmodified). 330/330 Core tests pass (315 pre-existing + 15 new; 3 pre-existing `compose/page.test.ts` fixtures needed their leading character changed to an indent-exempt opener so unrelated capacity-mechanics tests weren't perturbed by the now-correct indent behavior — retuned, not weakened). 21/21 Stage C tests pass. `npx tsc --noEmit`: 0 new errors.

**RESULT: PASS.** Root Cause B (bare-`\n` paragraph break): **fully resolved** — `paragraph-break-gap` now MATCHes cleanly. Root Cause A (一字下げ): **resolved for every ordinary-TEXT-first paragraph** (`baseline-ascii-kana`, `two-column-flow`, `dash-run`, `explicit-tcy` all improved to 0 unexpected differences on this account); two narrow residuals disclosed, not hidden: (a) Core's `RubyUnit`/`SemanticRunUnit` don't store literal text, so a paragraph starting with either kind still can't be auto-indented in v2 (architecture constraint, would need a schema change, out of scope) — affects `atomic-ruby`/`ellipsis-run`, both reclassified with an explicit reason code; (b) `long-non-repeating-prose` retains a smaller residual difference on its 2nd/3rd paragraphs that this Loop investigated but did **not** fully root-cause within its timebox — left as a genuine, undeclared `UNEXPECTED_DIFFERENCE`, explicitly flagged for follow-up rather than guessed at or silently reclassified. One unrelated, pre-existing structural artifact was also surfaced and documented (legacy's fixed 2-element column array vs v2's populated-only columns) — zero content difference, LOW severity.

**DECISION: PASS. READY FOR STAGE D: YES**, with the two disclosed residuals above briefed to reviewers rather than resolved.

**WHY:** Every Core addition traces to a specific, cited piece of already-approved Human Product policy (§1) or a direct legacy source-code reading performed before writing code (§2) — no behavior was invented, and the two residual gaps that remain are disclosed with their exact cause (or, for the long-prose case, an honest statement that the cause is not yet fully known) rather than silently absorbed as resolved. `core/`-only change (`git status`/`git diff --stat` confirm zero `src/`, Production, `package.json`, or lockfile changes); no dependency installed; `vitest.config.ts` untouched.

**NEXT:** Stage D (Preview Development Adapter implementation) may proceed against the already-approved architecture (`qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md`) and the ruby-placement disposition already recorded there — no further Human Product decision is required to begin. A future, separate, small investigation should resolve `long-non-repeating-prose`'s remaining not-fully-diagnosed residual (§9 of the evidence doc names the candidate causes) and, if ever prioritized, the RUBY/SEMANTIC_RUN indent-exemption architecture gap (would require storing literal text on those `LogicalUnit` kinds — a Core Contract-level schema change, its own future decision). Master is not modified. Phase 3 is not closed. `src/`, Production, and the old engine remain fully untouched.

---

## Stage D — Preview Development Adapter Implementation (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `597b2affb2a98d376fd28933ba88e4e0e2a57227` (matches the paragraph-semantics checkpoint), worktree clean before start.

**QUESTION:** Can `CanonicalDocument` be painted into a Human-inspectable development preview without creating a second typesetting engine, using only already-installed tooling (no new dependency, no `src/` change, no bundler)?

**HYPOTHESIS:** Yes, through a paint-only React absolute-position adapter, server-rendered to static HTML via `react-dom/server` (already an installed dependency) as a `vitest` test's side effect — reusing the exact test-running mechanism already proven throughout this Phase, rather than introducing a new build/serve path.

**METHOD:** Implemented `typesetting-v2/tools/preview-dev-adapter/`: `geometry.ts` (one centralized, one-way `tickToPx` conversion), `viewModel.ts` (`CanonicalDocument` + read-only `LogicalUnit[]` lookup + render context → paint-only `PreviewViewModel`, mirroring Stage C's own `v2Adapter.ts` span-lookup convention, including its fix for the per-atom text-duplication bug), `PreviewApp.tsx` (the React painter — `position:absolute` everywhere content is placed, a pure-CSS checkbox-driven NORMAL/DEBUG toggle with zero client-side JavaScript), `fixtures.ts` (11 fixtures reusing Stage C's own `buildFixtureUnits`, including both mandatory Human QA fixtures — F20 and the approved long non-repeating prose, the latter re-authored with explicit `PARAGRAPH_BREAK` units), and `generateArtifact.test.ts` (composes every fixture through the real `composeCanonicalDocument`, builds view models, renders via `ReactDOMServer.renderToStaticMarkup`, writes the static artifact to `typesetting-v2/qa/visual/stage-d/index.html`). Added 17 tests (`viewModel.test.ts` + `generateArtifact.test.ts`) covering determinism, `CanonicalDocument` immutability (INV-002/INV-009), HOLD state, bounded page-window sizing, manual-page-break/no-phantom-line, paragraph-indent metadata, and font-identity-mismatch flagging. A dedicated `vitest.config.ts` (new file) keeps this Stage's tests separate from the root config's `core/**`-scoped include, exactly as Stage C's own config already does.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` (full detail, Human Visual QA instructions). Artifact confirmed non-trivial (~86KB, contains real fixture content — ruby base text, HOLD banner, 6 provisional-unit badges — verified by direct inspection, not just test assertions). 17/17 new tests pass; all 330 Core tests and all 21 Stage C tests remain green; `npx tsc --noEmit` shows 0 new errors.

**RESULT: IMPLEMENTED.** Every MUST-HAVE v0 feature from the approved plan is represented: plain text, multi-line/column/page (bounded to 6 pages), manual page break (with the no-phantom-line fix from the previous Loop visibly confirmed), the new paragraph/indent semantics, Natural Pitch residual, and a HOLD state that is structurally excluded from normal page painting (not just visually de-emphasized). Ruby/TCY/dash/ellipsis/image are painted with an explicit "provisional" badge, never presented as approved typography — ruby's own reading annotation is deliberately NOT painted at all in this v0 (the simpler of the two options the approved plan offered), a disclosed choice, not an oversight; the ruby-placement Core wiring gap remains untouched and OPEN. **Human Visual QA has not been performed by this Loop** — it cannot be; that is the next, distinct, Human step.

**DECISION: Stage D implementation — PASS. Human Visual QA — PENDING.**

**WHY:** Every architectural choice traces to the already-approved plan (`PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md`) or to this Loop's own disclosed, narrow deviations (skipping ruby-reading-annotation painting, no break-reason-per-unit debug attribution) — nothing was silently decided as if it were Product policy. The artifact-generation mechanism (a vitest test writing a file) was chosen specifically because it required no new dependency, no `package.json` change, and no deviation from tooling already proven throughout Phase 3.

**NEXT:** Human Visual QA per `STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` §13 — open the artifact, compare against the current live Preview using the first-visual-gate criteria already on record. This Stage does not close P3-O03/O04/O05/O06/O08/O09, F06, or the ruby-placement wiring gap — all remain OPEN, unaffected. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Stage D Blank-Body Visual HOLD — Root Cause + Fix (2026-09-06)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `2b458f9205a021a482ad0ad6c899ac4f9a8d8e6b` (matches the Stage D implementation checkpoint), worktree clean before start.

**QUESTION:** Human Visual QA reported the Stage D artifact's page shells/guides render but manuscript body text is completely invisible — where, precisely, does it disappear, and what is the minimal fix?

**HYPOTHESIS:** Unknown going in, per this task's own explicit instruction not to guess a layer — investigated in order: CanonicalDocument, view model, React server markup, generated HTML, CSS/coordinates.

**METHOD:** Direct inspection at each layer. CanonicalDocument and the view model were both confirmed correct (full manuscript text present and correctly ordered). An isolated single-fixture React render was also confirmed correct (every character present as its own element). A search of the generated HTML for multi-character substrings ("これは", "あいうえお", etc.) found none — initially looked like proof of data loss, but was a dead end: Core atomizes plain TEXT per grapheme cluster, so consecutive characters are *always* separate sibling elements and a multi-character substring can never appear contiguous in the HTML regardless of any bug. The real root cause was found in CSS: `.line` elements (absolutely positioned, `right` set) had no explicit `width`; since their `.unit` children are also absolutely positioned (out of flow, by design — they must paint exact canonical coordinates), they never contribute to `.line`'s own auto/shrink-to-fit width, which collapsed to ~0 and clipped every character invisible via `.unit`'s own `overflow:hidden` — while the correct text remained genuinely present in the DOM throughout.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` §16 (full layer-by-layer trace, including the substring-search dead end recorded so it is not repeated). Fix: `ViewLine.widthPx` added (`viewModel.ts`) and used as `.line`'s explicit CSS width (`PreviewApp.tsx`), replacing the ad hoc `width: line.units.length ? undefined : 4` special-case that was the actual source of the bug. New regression test directly parses every rendered `.line` element's width out of the generated HTML and asserts each is finite and positive, plus asserts a single isolated character (`>気<`) appears as element text content — the only valid kind of substring check for this failure class.

**RESULT: FIXED.** 18/18 Stage D tests pass (17 previous + 1 new regression guard); all 330 Core tests and 21 Stage C tests remain green; `npx tsc --noEmit` shows 0 new errors. Artifact regenerated and directly re-verified (every `.line` element now carries a real, non-zero pixel width).

**DECISION: Root cause — PROVEN. Blank body — FIXED. Stage D machine state — PASS. Human Visual QA — PENDING (recheck requested).**

**WHY:** The fix traces to a single, precisely-identified CSS sizing defect (absolutely-positioned children never size an unsized absolutely-positioned ancestor) — no architectural change, no re-layout, no Core involvement, confined entirely to `typesetting-v2/tools/preview-dev-adapter/`. The dead-end substring-search approach is recorded, not hidden, so a future Loop doesn't waste time repeating it.

**NEXT:** Human recheck of the regenerated artifact (`typesetting-v2/qa/visual/stage-d/index.html`) against the same §13 checklist. This task did not touch, and does not resolve, any of P3-O03/O04/O05/O06/O08/O09, F06, the ruby-placement wiring gap, or `long-prose`'s residual. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Stage D QA Visual Scale + Glyph Paint Scale (2026-09-06)

Two small, sequential Human Visual QA readability fixes to the Stage D adapter, logged together.

**STAGE-D-QA-VISUAL-SCALE:** `DEFAULT_SCALE_MULTIPLIER` (`geometry.ts`) raised 4x → 10x (~2.5x larger) after Human feedback that the page was too small to judge typography. Pure display constant; `tickToPx`'s formula and every canonical value it reads are unchanged. New regression test (`viewModel.test.ts`) confirms `CanonicalDocument` is byte-identical across scales and that page/column/line/unit counts, source spans, and text are all scale-independent — only px dimensions differ, proportionally.

**STAGE-D-GLYPH-PAINT-SCALE:** Human then reported the enlarged page still showed tiny, unscaled glyphs. Root cause, proven by tracing the font-size source: `PreviewApp.tsx`'s CSS had a hardcoded `.unit { font-size: 12px; }`, completely disconnected from `scaleMultiplier` — every page/column/line dimension scaled via `tickToPx`, but glyph text size was a static constant on a separate, unscaled path. Fix: `PreviewViewModel.fontSizePx = tickToPx(ctx.linePitchTicks, ctx.scaleMultiplier)` — reusing `linePitchTicks` (already the canonical body font's own em-size in ticks, per `fixtures.ts`'s `settingsFor`) and the same conversion function every other geometry value uses, rather than inventing a separate font metric. Applied as each unit's own inline `style.fontSize`, threaded down from the view model. New regression test asserts the font-size ratio between two scales equals both the page-width ratio and the line-width ratio exactly — uniform scaling across geometry and glyph paint together.

**RESULT: both PASS.** 20/20 Stage D tests pass total across both fixes; 330 Core tests and 21 Stage C tests remain green throughout; 0 new tsc errors at either step. Full detail in `qa/evidence/STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` §17/§18. `src/`, Production, Core, `package.json`, the lockfile, and the root `vitest.config.ts` were never touched by either fix. Human Visual QA recheck remains PENDING.

---

## Stage D First-Line Indent Visual HOLD (2026-09-06/07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `79298c6` (one commit ahead of the task's stated `ff6e176` — the extra commit was the already-completed, unrelated 1.5x scale tuning; proceeded, worktree clean), worktree clean before start.

**QUESTION:** Human Visual QA found the approved, machine-test-passing paragraph first-line indent (一字下げ) does not visually appear in the Stage D artifact — which layer (Normalizer/Core/View Model/Painter) is responsible, and what is the minimal correction?

**HYPOTHESIS:** Unknown going in, per this task's own explicit instruction to prove the layer before fixing.

**METHOD:** Traced `ParagraphBreakUnit`/paragraph-start state through `composeLine` → `composeColumn` → `composePage`/`composePages` → `CanonicalLine.indentTick` → Stage D's `viewModel.ts` → `PreviewApp.tsx`'s CSS `top`. Found two independent bugs, one per layer, the second surfaced only while authoring the task's own required regression test 6.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` §19 (full trace, before/after values, constraint-by-constraint verification).

1. **VIEW MODEL bug (the directly reported symptom).** Core's own documented contract keeps `PlacedUnit.yTick` line-relative from 0 always, exposing the indent only as separate `CanonicalLine.indentTick` metadata for a Renderer to add at paint time. `viewModel.ts`'s `buildViewLine` computed `topPx` straight from `placed.yTick`, never adding `line.indentTick` — Core was correct throughout; the painter simply never performed its own documented half of the contract. Fixed by adding `const indentOffsetTicks = line.indentTick ?? 0;` to the `topPx` computation.
2. **CORE bug (newly discovered, not the reported symptom).** While writing the required regression test "manual page break does not fabricate a paragraph indent," `core/compose/column.ts`'s `currentIsParagraphStart` carry-forward logic was found to preserve the pre-line paragraph-start value unchanged across a `MANUAL_FORCED` (page-closing) cut, instead of treating it as consumed like every other cut does — a genuine general-case Core correctness gap (legacy's `pendingParagraphStart` is unconditionally consumed by any line's real content regardless of how that line ends; a page break itself never re-arms it). Fixed by simplifying `currentIsParagraphStart = lineResult.endedAtParagraphBreak ? true : lineResult.forcedBreak ? currentIsParagraphStart : false` to `currentIsParagraphStart = lineResult.endedAtParagraphBreak;` — matching the task's own explicit authorization ("if Core merely reduces available line extent but leaves the first glyph at line-start y=0, that is a genuine Core implementation gap... a minimal Core correction IS AUTHORIZED, but ONLY after root cause is proven"), extended to this closely related state-threading defect the same investigation surfaced.

10 required regression tests added/verified (`viewModel.test.ts` tests 1/2/3/5/6/7/8/9 + the U+3000 case; `generateArtifact.test.ts` test 10 asserting the generated HTML itself, not just the view model, paints the shifted position).

**RESULT: PASS.** 30/30 Stage D tests pass (27 from before this task's own additions + 3 new: tests 7, 9, 10); all 330 Core tests and 21 Stage C tests remain green (Stage C exercises `composeColumn` transitively — no regression); `npx tsc --noEmit` shows 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error). No source fabricated, no fake `SourceSpan`, no pitch stretched (verified directly: every glyph-to-glyph `yTick` delta within an indented line is identical, and the indent equals exactly one such delta), ordinary lines unaffected, U+3000 suppression preserved, blank paragraphs preserved, manual-page-break semantics preserved (the very bug this task fixed), ruby/TCY atomicity untouched, determinism preserved (test 9).

**DECISION: Stage D First-Line Indent Visual HOLD — FIXED (both layers).**

**WHY:** The view-model fix traces directly to Core's own pre-existing, already-documented `indentTick`/`yTick` contract (`schema.ts`, `PARAGRAPH_SEMANTICS_PRE_STAGE_D.md`) — nothing new was designed, only the painter's missing half of an existing contract was implemented. The Core fix traces to the task's own explicit authorization clause and to a concretely reproduced failing test, not a hypothetical — no paragraph semantics were redesigned, only a one-line simplification of already-existing state-threading logic.

**NEXT:** Human recheck of the regenerated artifact (`typesetting-v2/qa/visual/stage-d/index.html`) — paragraph-start lines should now show a visible indent band with the first glyph painted below it. This task did not touch, and does not resolve, any of P3-O03/O04/O05/O06/O08/O09, F06, the ruby-placement wiring gap, or `long-prose`'s residual. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Stage D Human Gate — Closeout (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `a7a2558` (matches the first-line-indent checkpoint), worktree clean before start.

**RESULT: Stage D Human Visual Gate — PASS. CLOSED.** Full findings recorded in `qa/evidence/STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md` §20, preserving §16–§19's history unmodified. Body text visible, display scale usable, font-size proportional, ordinary vertical flow readable, automatic first-line indent visible, blank paragraph preserved, manual page break correct (no phantom line), multi-column/multi-page flow correct, F20 readable. One explicit Human observation recorded as a scope boundary, not a defect: the line break separating 気づけ / ば、 is not a kinsoku failure (`ば` is not a prohibited line-start character in any frozen rule table) — it is a phrase-aware semantic line-breaking preference, and phrase-aware breaking is explicitly not part of the current frozen contract. Ruby annotation paint, TCY shaping, and dash/ellipsis optical alignment remain visibly unfinished and are recorded as **ACCEPTED PROVISIONAL NON-BLOCKERS** (P3-O03/O04/O05/O06, all still OPEN) — their logical grouping/identity is PASS; their visual quality is explicitly not called PASS.

**DECISION: Stage D — CLOSED (implementation PASS + Human Visual QA PASS).**

**NEXT:** P3-O09 Preview Renderer Foundation work begins immediately (see below) — Stage D remains as historical record, not deleted, and is superseded in purpose, not content.

---

## P3-O09 — Preview Renderer Foundation (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `a7a2558` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Can the first architectural slice of the final v2 Preview Renderer be built under `typesetting-v2/renderer/preview/`, distinct from the disposable Stage D QA adapter, without Production integration and without finishing special-unit (ruby/TCY/dash/ellipsis) visual quality?

**Roadmap audit (required before implementing):** confirmed via direct read of `docs/architecture/PHASE3_OPEN_ITEMS.md` and the Master's Phase list that P3-O09 (Phase 5, Preview Renderer) is the correct frozen next item; Phase 4 (Publication Renderer, P3-O08) and Phase 5 are recorded as independent, parallel output-technology tracks (`REQUIREMENTS_TRACEABILITY.md` V2-ARCH-003: renderers may differ in technology; `PHASE3_OPEN_ITEMS.md` Notes: "output-technology decisions... deferred past Phase 2"), not a strict sequence — no contradiction found, proceeded without a Human stop. No numeric sub-loop invented; this entry uses the descriptive label "P3-O09 Preview Renderer Foundation."

**METHOD:** Audited every Stage D piece (`tools/preview-dev-adapter/`) into REUSE AS-IS / REUSE CONCEPT ONLY / REWRITE / DISCARD (full table: `qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §3). Implemented `typesetting-v2/renderer/preview/`: `geometry.ts` (fresh one-way `tickToPx` copy, no Stage D import), `paintModel.ts` (`CanonicalDocument`+`LogicalUnit[]`→`PaintDocument`, carrying forward the STAGE-D-GLYPH-PAINT-SCALE and STAGE-D-FIRST-LINE-INDENT-VISUAL-HOLD fixes as already-correct behavior from line one, plus a new `ImageResolver` abstraction, `RubyAnnotationStatus = "PENDING"`, and a `PaintDebugInfo` per unit), `PreviewRenderer.tsx` (React painter with a real `mode: "normal" | "debug"` split — NORMAL omits every dev-only DOM node entirely, not just CSS-hidden), `fixtures.ts` (11 controlled fixtures re-declared, not imported from Stage D; builder function reused from `tools/compare/fixtureBuilder.ts`, already shared by Stage C and Stage D), `vitest.config.ts` (own scoped config, same pattern as Stage C/D), `paintModel.test.ts` (19 tests) and `generateFoundationArtifact.test.ts` (5 tests, writes NORMAL+DEBUG static HTML artifacts to `qa/visual/p3-o09-preview/`, leaving the historical Stage D artifact untouched).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md` (19 sections, full detail). 24/24 new tests pass; all 330 Core tests, 21 Stage C tests, and 30 Stage D tests remain green (no cross-contamination — the new module has zero imports from `tools/preview-dev-adapter/` or `tools/compare/`'s non-builder files); `npx tsc --noEmit` shows 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error).

**RESULT: FOUNDATION — PASS.** All 15 "MUST IMPLEMENT" normal-body items present and tested. Colophon: sufficient geometry already exists (`ColophonBlock` is structurally identical to body pages by Core's own design) — basic structural support included (`buildColophonPaintPages`, fixed horizontal orientation convention). Folio/header: Core never populates `folio` (confirmed by grep) — recorded as PENDING CORE DATA, nothing invented. Ruby: body placement PASS; annotation genuinely PENDING (`placeRuby()` confirmed never invoked by the compose pipeline) — **ruby placement micro-loop required next: YES**, a concrete technical dependency, not a Human Product question. TCY/dash/ellipsis: logical identity/order/placement preserved exactly, no optical hacks added, clean paint boundaries left for P3-O03/O04/O05. Renderer cannot mutate `CanonicalDocument`, page count, or line breaks (tests 1–3). NORMAL mode contains zero dev-only DOM nodes (test 21, verified against actual rendered class attributes, not just CSS text). No Production/`src/` file touched.

**DECISION: P3-O09 Foundation — PASS. P3-O09 (full item) — IN PROGRESS, not closed.**

**WHY:** Every reused piece traces to a specific Stage D file/fix already proven correct (§3's audit table); every new piece (ImageResolver, RubyAnnotationStatus, mode split, PaintDebugInfo) traces to an explicit task instruction, not invented scope; the ruby-annotation PENDING state and the folio PENDING-CORE-DATA recording both trace to a direct grep confirming the underlying Core capability genuinely does not exist yet, not a guess.

**NEXT:** Ruby Placement Micro-Loop (wire `core/ruby/index.ts`'s `placeRuby()` into the compose pipeline so a `PlacedUnit` carries real annotation geometry) — chosen by dependency order (the Preview Renderer cannot paint ruby annotation in any form without it), not Human preference. P3-O03 (TCY visual)/P3-O04 (dash)/P3-O05 (ellipsis) remain independently available whenever prioritized, since they need no further Core change. P3-O08 (Publication Renderer) remains fully separate and untouched. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Ruby Placement Micro-Loop (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `8955174` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Can `core/ruby/index.ts`'s already-implemented `placeRuby()` be wired into `core/compose/line.ts` so a `PlacedUnit` carries real canonical annotation geometry, and can the P3-O09 Preview Renderer Foundation consume it — without moving body text, changing breaks/capacity/Natural Pitch, or closing P3-O06?

**AUDIT (before implementation, per this task's own required questions):** `placeRuby()` returns only `{policy, readingOffsetTick}` (no base-coordinate output — INV-003-safe by construction, confirmed by its own pre-existing test). Its inputs (`baseExtentTick`, `readingExtentTick`, two overhang allowances) are all already-available `GeometryTick` values, EXCEPT `readingExtentTick`, which requires calling `measurement.rubyReadingExtentTick(fontRef, sizePt, text)` — a `MeasurementFacts` method that already existed (since P3-L04) but was never callable in practice, because `RubyUnit`/`RubySegment` stored no literal reading text (only spans) and Core's `DocumentCompositionInput` never carries a raw source string. This is the same class of disclosed gap `compose/line.ts` already documented for indent-exemption on RUBY/SEMANTIC_RUN. **Resolved, not redesigned:** applied the already-established `TextUnit.text`/`TCYUnit.displayText` convention to `RubyUnit`/`RubySegment` (`readingText: string`, new required field, populated at fixture-build time in `tools/compare/fixtureBuilder.ts` from data the builder already had). `PlacedUnit.rubyBoundaryPolicy` turned out to be a pre-existing, never-populated placeholder field (schema.ts, since P3-L04/L15) — completed with two new sibling fields (`rubyReadingOffsetTick`, `rubyReadingExtentTick`) rather than inventing a new structure.

**METHOD:** Wired `placeRuby()` into `compose/line.ts`'s placed-unit-building loop: for any atom owned by a RUBY unit, resolves the atom's own reading text (matching JUKUGO segment, or the whole unit — mirrors `deriveRubyBreakOpportunities`'s own segment/atomic distinction), measures it, resolves adjacent-atom overhang allowance via the already-existing `RuleSetVersion.characterClassFor`/`resolveOverhangAllowance` (reading the literal boundary character of an already-placed same-line neighbor, never a raw source string, 0 when no same-line neighbor exists), calls `placeRuby()`, and attaches the result — never touching `xTick`/`yTick` for any atom. Updated `renderer/preview/paintModel.ts`/`PreviewRenderer.tsx` to read these fields back (never recompute them) and paint the real annotation text, visible in both NORMAL and DEBUG mode (a geometry debug tooltip stays DEBUG-only). Added `core/compose/rubyPlacement.test.ts` (17 tests, all 20 required cases covered) and 3 renderer-level tests. 22 pre-existing test-file `RubyUnit`/`RubySegment` object literals across 6 files needed a mechanical `readingText` addition to keep type-checking (no assertion changed).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md` (15 sections, full detail). 347/347 Core tests pass (330 + 17 new), 21/21 Stage C, 30/30 Stage D, 25/25 P3-O09 renderer/preview tests; `npx tsc --noEmit` 0 new errors. Body-placement invariant directly proven (test 17: cumulative `yTick`/`xTick`/`sourceSpan` identical to a plain advance model). Determinism proven (test 18). Manual-break/paragraph-break/column/page-boundary interactions all proven non-disruptive (tests 11–15).

**RESULT: PASS.** Ruby annotation is now visible end-to-end for the first time (artifact: `qa/visual/p3-o09-preview/index.html`/`debug.html`, regenerated, Stage D's own artifact untouched) — but this is a wiring/foundation result, not final optical quality: `DEFAULT_RULE_SET_V2.rubyOverhangAllowance` ships empty (P3-O06 residual, HG-4 exact values still OPEN), so every overflowing case in the new tests reaches `OVERFLOW_OPEN` (the least-refined of the four policies), never a fabricated `START_CLAMP`/`END_CLAMP` with an invented nonzero budget. The class-aware overhang LOOKUP mechanism itself is proven wired (test 7) — its eventual VALUES remain a distinct, not-yet-asked Human Product question. No auto jukugo-segment discovery was introduced (test 10, P3-O14 unchanged). P3-O03/O04/O05/O06/O08 all remain explicitly OPEN, none silently closed.

**DECISION: Ruby Placement Micro-Loop — PASS.**

**WHY:** The one schema addition (`RubyUnit.readingText`) traces directly to an already-existing, already-approved `MeasurementFacts.rubyReadingExtentTick` signature that could not otherwise ever be called — not a new Product decision, a plumbing completion. The `PlacedUnit` fields complete an already-frozen, already-declared placeholder rather than inventing new architecture. No body-coordinate, break, capacity, or Natural Pitch behavior changed (proven, not assumed, by test 17 and the full regression suite).

**NEXT:** P3-O03 (TCY visual) recommended next by dependency order (no further Core change needed, unlike ruby annotation which was blocked until this task); P3-O04/P3-O05 (dash/ellipsis optical) independently available after or alongside it; the P3-O06 exact overhang-value question remains a distinct, narrower Human Product decision for whenever Product priorities call for it — not required to proceed with P3-O03/04/05. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O09 Page Content Clipping HOLD (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `450332f` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human Visual QA reported manuscript content clipped/truncated at the bottom of essentially every rendered page in the P3-O09 NORMAL PREVIEW artifact (F20 and Long Non-Repeating Prose both cited) — which exact layer is responsible, and what is the minimal correction?

**METHOD:** Traced F20 page 0 end-to-end (CanonicalDocument → page/line geometry → placed units → view model → CSS box), then swept EVERY placed unit across every line/column/page of F20 and all 3 pages of Long Non-Repeating Prose for a bottom/right-edge-vs-page-bounds violation. Found zero Core-level violations (Natural Pitch's own zero-stretch invariant means a full line's last character's bottom edge lands EXACTLY on the page's own bottom edge — an exact, not overflowing, fit) — ruling out Core geometry (A), Renderer scale inconsistency (B), and coordinate-origin double-counting (C). Directly diffed the P3-O09 `.unit` CSS rule against the already Human-approved Stage D `.unit` rule and found three properties missing (`line-height: 1`, `writing-mode: vertical-rl`, `white-space: nowrap`) that this foundation's own from-scratch rewrite had dropped. Separately, writing the required "no placed unit's bottom edge exceeds its page height" regression test surfaced a second, independent, smaller-magnitude bug: `paintModel.ts`'s DEV-ONLY last-atom height approximation could overestimate a line's final atom's height by borrowing an unrelated, wider preceding atom's own delta (reproduced concretely by `dash-ellipsis` and `image-placeholder`).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md` "Human Visual QA — Page Content Clipping HOLD" section (full trace table, binary-check disposition, both root causes, both fixes). 5 new regression tests (`generateFoundationArtifact.test.ts`): a full no-overflow sweep across every fixture, an F20-specific edge-fit check, an F20 full-sentence paint-item reconstruction check, a Long-Prose page-0/page-1 sweep, and a direct stylesheet assertion that `.unit` carries the three restored CSS properties.

**RESULT: FIXED (both root causes), category D (CSS clipping hiding otherwise-correct content) — Core and view-model coordinate math were proven correct throughout, never at fault.**

1. **Root Cause 1 (dominant, matches the Human's "whole lower portions missing" report):** `.unit` lacked `line-height: 1`, so the browser's default line-height (taller than the deliberately zero-margin `heightPx = fontSizePx` box) made each glyph's own rendered line box overflow its tightly-fitted box, clipped by `overflow: hidden`. Fixed by restoring the three properties Stage D's own `.unit` rule already had and depended on.
2. **Root Cause 2 (independent, smaller-magnitude, surfaced by writing the required regression test itself):** the last-atom height estimate's "borrow the previous atom's delta" fallback could overestimate when the previous atom was a wider unit. Fixed by clamping the estimate to the atom's own actual remaining line extent — it can only shrink an already-inexact guess toward safety, never grow it.

**DECISION: Page Content Clipping — FIXED. P3-O09 machine state — PASS.**

**WHY:** Root Cause 1 traces to a direct, provable diff against the already Human-approved Stage D baseline (not a guess); Root Cause 2 traces to a concretely reproduced numeric overshoot the new regression test itself caught (dash-ellipsis, image-placeholder), not a hypothetical. Neither fix touches Core, pagination, breaks, or `CanonicalDocument` — both are confined to `renderer/preview/PreviewRenderer.tsx` (CSS text) and `renderer/preview/paintModel.ts` (one clamped estimate).

**NEXT:** Human recheck of the regenerated artifact (`qa/visual/p3-o09-preview/index.html`/`debug.html`). Ruby/TCY/dash/ellipsis visual-quality evaluation remains explicitly deferred until this recheck confirms ordinary body text renders without clipping. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O09 Ruby Annotation Missing HOLD (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `e20571d` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human Visual QA confirmed ordinary page-content clipping fixed, but reported the actual artifact shows ruby body text with NO visible reading annotation, and a stale fixture heading still claiming "annotation painting PENDING" — directly contradicting the prior machine report "normal ruby annotation visible: YES". Where is the discrepancy, and what is the minimal fix?

**METHOD:** Directly confirmed the reading text ("とうきょう") IS present in the generated artifact HTML (one occurrence, matching prior test assertions) — ruling out missing canonical data or a missing paint item. Inspected the exact surrounding markup and CSS: `.ruby-annotation` was a DOM child of `.unit`, positioned via `left: 100%` (deliberately outside `.unit`'s own box), while `.unit` carried `overflow: hidden` (added one task earlier, for the Page Content Clipping HOLD, to clip glyph ink to its tightly-fitted paint box). CSS overflow clips all descendants regardless of their own positioning — so the annotation was unconditionally clipped by its own parent in any real browser, a class of bug the prior task's SSR-string-presence tests structurally could not detect (no real layout engine runs during `renderToStaticMarkup`).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md` "Human Visual QA — Annotation Missing HOLD" section (full trace, discrepancy explanation, root cause, fix). 5 new regression tests (`generateFoundationArtifact.test.ts`, "Ruby Annotation Missing HOLD"), all against the real `atomic-ruby` fixture through the full pipeline, asserting DOM STRUCTURE (a sibling-relationship regex requiring `.unit-ink`'s closing tag before `.ruby-annotation` opens) rather than mere string presence — the exact class of check that would have caught this originally.

**RESULT: FIXED.** Introduced an inner `.unit-ink` wrapper carrying `overflow: hidden` instead of `.unit` itself; base text/image-placeholder/provisional-badge moved inside it, while `.ruby-annotation` (and debug-only decoration) remain direct children of `.unit`, siblings of `.unit-ink`, never clipped by it. Corrected the stale "annotation painting PENDING" fixture heading to "body + annotation geometry active; exact overhang/optical tuning pending — P3-O06" — accurate without claiming P3-O06 closed. No Core file touched; the Page Content Clipping HOLD's own no-overflow regression tests still pass unchanged, confirming glyph-ink clipping is preserved exactly as before.

**DECISION: Ruby Annotation Missing — FIXED. P3-O09 machine state — PASS.**

**WHY:** Root cause traces to a directly-inspected CSS containment conflict (overflow clips descendants regardless of their own position), not a guess; the fix is the minimal structural change (move the clip one DOM level down) that resolves the conflict without touching Core, breaks, or the already-fixed Page Content Clipping HOLD's own properties.

**NEXT:** Human recheck of the regenerated artifact — ruby annotation ("とうきょう") should now be visible beside its base ("東京"). Ruby/TCY/dash/ellipsis visual-quality evaluation (P3-O03/O04/O05/O06 optical values) remains explicitly deferred until this recheck confirms. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O09 Ruby Annotation Wrong Anchor HOLD (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `43693b4` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human Visual QA confirmed the ruby annotation ("とうきょう") is now visible, but reported it visually begins around the body run's second character ("京") instead of anchoring to the full "東京" run from its correct start — flagged explicitly as anchor correctness, not P3-O06 optical tuning. Where does the wrong start position originate?

**METHOD:** Traced the exact atomic-ruby fixture. Confirmed the RUBY unit's own placed atom covers `sourceSpan [3,5)` and paints `text: "東京"` together as ONE atom (ATOMIC ruby never splits per grapheme) — ruling out the "annotation anchored to only 京" body-run hypothesis directly (Case: body run is a single, full-run atom, not two). Confirmed `placeRuby()`'s own inputs/outputs (`rubyReadingOffsetTick = 0`) are anchored to that same full-run atom's own `yTick` — canonical geometry was already correct. Traced the RENDERING path and found `.ruby-annotation` inherits `text-align: center` from `.unit` — and under `writing-mode: vertical-rl`, `text-align` aligns content along the INLINE axis, which for vertical-rl IS THE VERTICAL axis (not horizontal, as intuition from horizontal writing would suggest). Since the annotation's own box height (the reading's full logical extent, 5 cells) is much larger than its actual rendered text (5 characters at a smaller font, ~2.75 cells), the inherited centering visibly shifted the text's apparent start down by roughly half the unused space (~1.1 cells) — landing almost exactly at "京"'s own position.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md` "Human Visual QA — Wrong Ruby Anchor HOLD" section (full trace, binary-check disposition, root cause, fix). 7 new regression tests (`generateFoundationArtifact.test.ts`, "Ruby Annotation Anchor HOLD"), all against the real fixture, directly asserting `annotationStartPx (topPx + offsetPx) === bodyRun.topPx` (never a later unit's own `topPx`) and a stylesheet check for `text-align: start`.

**RESULT: FIXED. Case 2 (Renderer CSS paint mapping), never Core — canonical geometry (body-run extent, annotation offset) was correct throughout.** Added `text-align: start` to `.ruby-annotation`'s own CSS rule, anchoring its text to the beginning of the inline axis (the top, in vertical-rl) regardless of unused box height below it. Extended the DEBUG-only tooltip to show body-run text/span/top/height alongside annotation text/policy/start/extent (per the task's optional "if inexpensive" suggestion) — never shown in NORMAL PREVIEW.

**DECISION: Ruby Annotation Anchor — FIXED. P3-O09 machine state — PASS.**

**WHY:** Root cause traces to the CSS Writing Modes specification's own defined behavior of `text-align` under vertical writing modes (not a browser quirk or a guess), directly confirmed by computing the expected centering offset (~1.1 cells) and finding it matches the Human's "around 京" report almost exactly. The fix is the minimal, targeted override (one property, one selector) — no Core change, no redesign of ruby placement, and 東/京's own body coordinates are provably unaffected (a CSS rule on a different element).

**NEXT:** Human recheck of the regenerated artifact — "とうきょう" should now visibly begin aligned with "東", not "京". If confirmed, P3-O03 (TCY visual) is the next recommended task by dependency order. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Ruby Human Visual QA — Final PASS (2026-09-07)

Human reopened the regenerated artifact and confirmed the ruby annotation ("とうきょう") is visible, begins aligned with the parent run ("東京", not "京"), follows the correct body run, and that the body did not move with no cross-line/page displacement. **DECISION: Ruby canonical placement + Preview annotation — Human Visual QA PASS.** P3-O06 remains explicitly OPEN (exact class-aware overhang allowances, final START/END clamp optical tuning, final Publication-level spacing all remain unresolved) — recorded in `qa/evidence/RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md`'s own "Human Visual QA — Final Result" section, not silently closed.

---

## P3-O03 — TCY Visual (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `788fc31` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Can the already-canonical, already-atomic explicit TCYUnit be shown correctly as 縦中横 in the P3-O09 Preview Renderer, without changing TCY recognition, pagination, Core grouping, or capacity (P3-O07 auto-detection remains untouched and OPEN)?

**Roadmap audit:** direct-read of `docs/architecture/PHASE3_OPEN_ITEMS.md` row P3-O03 and its cited evidence (`prototypes/phase2-japanese-capability-poc/evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md`, TCY section) confirmed the frozen finding: `text-combine-upright: all` is the correct, standard CSS mechanism (not invented from general CSS knowledge) — its logical model was already PASS in Phase 2, but visual combination failed in that PoC's full-page context despite working in 3 isolated tests, root cause never found. This history was followed, not re-derived from scratch.

**METHOD:** Audited the existing `TCYUnit`/`tcyCellCost`/break-opportunity model (all Core-owned, all already PASS, confirmed untouched by `git diff --stat`). Wrapped only the TCY unit's own text in a new `<span className="tcy">` (`renderer/preview/PreviewRenderer.tsx`), with a new CSS rule `.tcy { text-combine-upright: all; }` — no scaleX/font-size/letter-spacing invented, the browser's own built-in fitting algorithm handles compression per the CSS Writing Modes spec. `.unit` itself (canonical position/orientation) is completely unchanged. Added 18 regression tests (`renderer/preview/tcyVisual.test.ts`) covering all 20 required interaction/invariant cases against real composed fixtures.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O03_TCY_VISUAL.md` (14 sections, full detail). 347/347 Core, 21/21 Stage C, 30/30 Stage D, 60/60 P3-O09 renderer/preview tests pass; `npx tsc --noEmit` 0 new errors. No Core file touched.

**RESULT: PARTIAL, not PASS.** All machine-verifiable structural properties (DOM nesting, stylesheet declaration, atomicity, coordinate invariants, paragraph/break/column/page interaction safety, scale proportionality, NORMAL/DEBUG geometry parity) are PASS. **Visual confirmation in a real browser is not independently confirmed** — this environment cannot open a browser, and Phase 2's own historical uncertainty (does `text-combine-upright` visually combine in a full-page context, not just isolated tests?) was never resolved for the OLD PoC's DOM structure; this task's Renderer has a structurally different shape (absolute-position paint boxes), so the old failure may or may not recur here. Reported honestly as PARTIAL rather than PASS, per this task's own explicit instruction not to claim PASS merely because something horizontal appears in markup.

**DECISION: P3-O03 — PARTIAL. Human Visual QA required before PASS.**

**WHY:** The mechanism traces directly to the frozen P2-L06B finding (not invented), and every structural claim is backed by a passing test against a real composed fixture — but the ONE open question (does it visually work here) is exactly the kind of claim this environment cannot verify, and claiming PASS without that verification would misrepresent the actual state, matching the task's own explicit warning against exactly that.

**NEXT:** Human Visual QA of the regenerated artifact for TCY. P3-O04 (dash visual) and P3-O05 (ellipsis visual) remain available as parallel next candidates regardless of TCY's own outcome (same dependency reasoning as Ruby: pure Renderer-side visual polish, no further Core change needed) — not forced into a specific order by the frozen roadmap. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## TCY Human Visual QA — Final PASS (2026-09-07)

Human reopened the regenerated artifact and confirmed the Explicit TCY fixture's "2026" appears cleanly horizontal inside the vertical line — the historical Phase 2 P2-L06B full-page-combination failure did NOT recur in this Renderer's own DOM structure. One canonical TCY unit, visually contained in its own column; surrounding text not displaced; no line/page escape; no debug decoration in NORMAL Preview. **DECISION: P3-O03 (TCY Visual) — Human Visual QA PASS. CLOSED**, recorded in `qa/evidence/P3_O03_TCY_VISUAL.md` §15. **P3-O07 (TCY auto-detection) remains explicitly OPEN** — this closure covers only visual shaping of an already-explicit TCYUnit, not recognition/threshold policy.

---

## Future Typography Memo — Dakuten Attachment / 濁点付与組版 (2026-09-07)

Recorded as a descriptive future item, **not implemented, no numeric P3-O identifier assigned** (`docs/architecture/PHASE3_OPEN_ITEMS.md`, new "Non-P3-O Future Items" section): creative/manga-style expressive nonstandard dakuten attachment (examples: お゛, あ゛, い゛, ん゛, っ゛ — 濁点喘ぎ and similar). Desired future behavior: base glyph + dakuten should visually occupy ONE body character slot, dakuten attached to the base glyph — never a base glyph in one cell followed by a dakuten in a separate second vertical cell. A future scoping pass would need to distinguish combining dakuten (U+3099) vs. spacing dakuten (U+309B) vs. user-entered quote-like substitutes, plus normalization policy, source preservation, vertical positioning, and font support/fallback. Not classified as TCY or any existing `LogicalUnit` kind — this is purely a recorded future requirement, no design or implementation work was done.

---

## P3-O04 — Dash Visual (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `ba8e5c6` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Can canonical DASH semantic runs (e.g. "――") be painted as visually continuous, appropriately centered vertical dash runs in the P3-O09 Preview Renderer, resolving the frozen P2-L06 finding, without changing Core breaks, source spans, canonical occupancy, or surrounding text?

**Roadmap audit:** direct-read of `docs/architecture/PHASE3_OPEN_ITEMS.md` row P3-O04 and its cited evidence confirmed the frozen finding is a real, MEASURED (not Human-perception-only) glyph-ink off-center problem, for which Phase 2 explicitly decided no correction (measurement without a correction decision). This history was followed, not re-derived or reinterpreted.

**METHOD:** Audited the existing `SemanticRunUnit`/break-opportunity/canonical-extent model (all Core-owned, all already correct, confirmed untouched by `git diff --stat`). Evaluated the three listed paint strategies (native glyph / controlled-overlap wrapper / painted rule) against canonical fidelity, continuity, font independence, deterministic scale, and Publication portability — selected the painted-rule strategy specifically because it removes the ENTIRE class of font-dependent uncertainty the frozen finding names, rather than attempting an unverifiable in-browser fix. Implemented a `<span class="unit-ink">::after` pseudo-element bar (percentage-width, never fixed px) for DASH runs only, with the real text kept in the DOM (`color: transparent`) for source/semantic fidelity. Added a read-only `semanticRunKind` passthrough field to the paint model (mirrors the existing ruby/image never-recompute convention) so the Renderer can distinguish DASH from ELLIPSIS without re-tokenizing.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` (14 sections, full detail). 20 new regression tests (`renderer/preview/dashVisual.test.ts`) covering semantic identity, source span, canonical extent, break/paragraph/column/page interactions, proportional scaling, determinism, CanonicalDocument immutability, and an explicit proof that ELLIPSIS in the same fixture is never touched by the dash-specific CSS class.

**RESULT: PASS (structural).** 347/347 Core, 21/21 Stage C, 30/30 Stage D, 80/80 P3-O09 renderer/preview tests pass; 0 new tsc errors. No Core file touched. The painted-bar approach is structurally guaranteed continuous and centered by construction (not dependent on unverifiable font/browser behavior) — Human Visual QA of the regenerated artifact is the remaining, distinct confirmation step (a different kind of check than TCY's, since this task does not depend on any uncertain browser mechanism the way `text-combine-upright` did).

**DECISION: P3-O04 — PASS (structural). Human Visual QA pending.**

**WHY:** The strategy traces directly to the frozen P2-L06 measured finding and Phase 2's own explicit "no correction decided" disposition — this task does not claim to have measured or corrected the SAME font-glyph problem, it removes the dependency on font glyph ink entirely, a categorically different and structurally verifiable approach. Every claim (continuity, centering, proportional scale, no Core change) is backed by a passing test against a real composed fixture.

**NEXT:** Human Visual QA of the dash treatment specifically (not ellipsis — P3-O05 remains untouched and OPEN, explicitly not to be judged in this recheck). P3-O05 (ellipsis visual) is the natural next candidate by dependency order once dash is confirmed, though its own root visual problem should be independently audited rather than assumed to need the identical painted-bar treatment. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 Dash Stroke Weight HOLD (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `7db26d3` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human Visual QA confirmed dash continuity is structurally correct but rejected the painted stroke as far too thick ("heavy vertical rule, not publication-like prose punctuation"). Can the thickness be corrected to a body-font-relative value without regressing continuity, canonical bounds, or any other already-verified property?

**METHOD:** Audited the current rule directly: `width: 12%` on `.unit-ink::after`, a percentage of the unit's own cross-axis box width (the line's per-cell width) — computed at the fixture's actual scale to ≈2.52px, roughly 1/8 of the full cell, visually closer to a rule/border weight than a punctuation stroke. Switched to an `em`-relative value (`width: 0.06em`), resolving directly against `.unit`'s own inline `font-size` (== the canonical `fontSizePx`) — matching the task's own preferred `dashStrokeEm = bodyEmPaintSize × relativeStrokeFactor` formula more directly than the prior box-width percentage. Since no single thickness value is objectively evidenced (Phase 2's own P2-L06 measurement concerned horizontal centering, not stroke weight, and no Human Product decision on an exact value exists), generated a small, non-Production, 3-candidate comparison artifact (`qa/visual/p3-o04-dash-weight-comparison/index.html`) of the identical fixture, differing only in stroke width (0.03em / 0.06em / 0.09em) — applying the middle candidate (0.06em) as the interim default to the main P3-O09 artifact.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` §15 (full trace, before/after values, candidate table). Updated one existing stylesheet regression test to match the new formula and explicitly assert the rejected `12%` value never recurs; added one new test generating the comparison artifact. 81/81 renderer/preview tests pass (80 previous + 1 new); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` 0 new errors.

**RESULT: Interim fix applied (0.06em), pending Human confirmation via the comparison artifact.** Continuity strategy unchanged (only the `width` parameter differs); scale proportionality preserved (`em` resolves against an already-`tickToPx`-scaled `font-size`); all previously-verified invariants (canonical extent, surrounding coordinates, line/page breaks, ellipsis untouched) re-verified unchanged.

**DECISION: P3-O04 stroke weight — HOLD, interim value applied, Human recheck required.**

**WHY:** The prior value's root cause (percentage-of-box-width in a range that reads as a rule, not a stroke) is directly traceable to the numeric relationship computed above, not a guess; since no objective evidence pins one exact replacement value, offering 3 candidates (rather than guessing a single "correct" number a second time) directly follows this task's own explicit fallback instruction.

**NEXT:** Human review of `qa/visual/p3-o04-dash-weight-comparison/index.html` to confirm or adjust the stroke thickness. P3-O05 (ellipsis) remains untouched and OPEN, not to be started until dash passes Human QA. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 Dash Paint Strategy Audit (2026-09-07, second review)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `83a49f5` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human rejected ALL three thickness candidates (0.03em/0.06em/0.09em) as still too thick, with no meaningful visible difference between them despite a 3x declared range. Is the painted-bar implementation itself defective, or is a different root cause responsible — and does the painted-bar strategy remain viable at all?

**METHOD:** Directly audited the generated artifact and `PreviewRenderer.tsx` source (no browser, no shell probes) against 6 specific mechanical questions: glyph-hiding, single-bar-only, no-overlap, no-stray-background, no-transform-distortion, correct-per-candidate-override. All six passed clean — no implementation defect anywhere. Computed the three candidates' actual theoretical pixel widths directly from the confirmed font-size (20.999px): 0.630px / 1.260px / 1.890px — all under 2 device pixels, spanning barely more than 1 full device pixel of declared difference. This is squarely the range where standard browser rasterization for solid-fill elements at 1x device-pixel-ratio rounds/clamps toward similar effective widths — a provable-by-arithmetic, not guessed, explanation for "3x range, no visible difference." Also reconsidered whether the underlying Phase 2 P2-L06 off-center finding (measured in a different, superseded PoC structure) actually recurs in THIS renderer's structure at all — never previously tested, and directly analogous to TCY's own historical uncertainty which did NOT recur here.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` §16 (full audit table, classification, three-strategy comparison). Regenerated `qa/visual/p3-o04-dash-weight-comparison/index.html` with three genuinely different STRATEGIES (not just three more numbers): (A) corrected native glyph, no painted bar at all — real font ink, no invented value, tests whether the historical off-center problem even recurs here; (B) ultra-light geometric bar using a width just above the proven rasterization floor (0.05em) combined with reduced opacity (0.4), achieving visual lightness via alpha blending instead of further geometric shrinkage; (C) the current solid bar (0.06em), unchanged, kept for direct side-by-side comparison. 81/81 renderer/preview tests pass (unchanged count — the one comparison-generator test was rewritten in place); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` 0 new errors. No Core file touched; the main P3-O09 artifact's own dash rule left unchanged (still 0.06em) pending this strategy decision.

**RESULT: Root cause classified as D (device/subpixel rasterization floor), proven by direct arithmetic on already-known values, not guessed.** Classification E (uniform bar is the wrong optical model) not ruled out as a secondary factor but is not the dominant explanation for the specific "indistinguishable candidates" symptom. Painted-bar strategy viability: UNCERTAIN on the geometric-width lever alone (further reduction repeats the same floor problem); a different lever (opacity) may remain viable, offered as Strategy B.

**DECISION: P3-O04 — HOLD, Human strategy recheck required (not just a thickness pick).**

**WHY:** Every claim in the audit traces to a directly-confirmed value (font-size read from the generated HTML, em-to-px arithmetic, direct CSS-rule inspection) or a well-established, non-codebase-specific rendering behavior (sub-pixel rasterization rounding) — no aspect of the "why does it still look thick" question was answered by guessing a smaller number a second time, matching the task's own explicit instruction not to repeat that pattern.

**NEXT:** Human review of `qa/visual/p3-o04-dash-weight-comparison/index.html` to choose among strategies A/B/C or describe a different direction. P3-O05 remains untouched and OPEN. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 Native Dash Glyph Continuity/Centering POC (2026-09-07, third review)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `202cea4` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human rejected BOTH geometric-bar strategies (solid: too rule-like; opacity-reduced: too pale/blurred) — the native-glyph candidate was judged visually closer to typography but needs continuity and centering review. Can native font glyph ink be retained while correcting only paint position/continuity, without any geometric bar, opacity trick, or font-size/weight change?

**METHOD:** Audited the DASH run's actual rendering path directly: confirmed it composes as exactly one atom and paints as one text node ("――", both characters together) inside one `.unit-ink` box — no separate per-character DOM elements exist to "overlap." Identified `letter-spacing` as the one well-defined, canonical-extent-independent CSS lever for inter-character spacing within that single text node (works correctly along the inline/vertical axis under `writing-mode: vertical-rl`). Found no evidence-backed CSS lever for cross-axis centering without fabricating an unverified offset — the original P2-L06 measurement was taken against a different, superseded PoC structure, not transferable here, and no live-browser re-measurement tool exists in this environment (the same category of uncertainty already resolved-by-non-recurrence for TCY).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` §17 (full audit, three-candidate table). Regenerated `qa/visual/p3-o04-dash-weight-comparison/index.html`, retitled "NATIVE DASH PAINT COMPARISON," with three native-glyph-only candidates: (A) baseline, no correction at all; (B) `letter-spacing: -0.05em` seam-tightening only; (C) same seam-tightening plus a disclosed, explicitly-labeled EXPERIMENTAL `transform: translateX(-0.03em)` centering nudge (never presented as a proven fix). A stylesheet regression test directly asserts none of the rejected geometric/opacity mechanisms (`content: ""`, `opacity:`, `background: #111`) appear anywhere in the new artifact. 81/81 renderer/preview tests pass (unchanged count); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` 0 new errors. No Core file touched; `PreviewRenderer.tsx`'s own main stylesheet left unchanged (still the geometric rule from the prior HOLD) pending this decision.

**RESULT: native glyph stroke preserved (confirmed — no opacity, no bar, no replacement anywhere in the candidates); geometric bar removed from all three candidates.** Root cause of the seam: the two dash characters share one text node with no independent positioning to correct via overlap, so `letter-spacing` (not a transform-based "overlap") is the correct lever. Centering correction offered only as a disclosed experiment, not a proven fix, given the lack of a transferable measurement.

**DECISION: P3-O04 — HOLD, Human recheck required on the native-glyph candidates (not the abandoned geometric direction).**

**WHY:** Every claim traces to a direct structural fact (one atom, one text node, confirmed via source/artifact reading) or an honestly-disclosed absence of evidence (no transferable centering measurement) — nothing was guessed and presented as settled; the experimental candidate is explicitly labeled as such in the artifact itself, not silently offered as equal-confidence with A/B.

**NEXT:** Human review of `qa/visual/p3-o04-dash-weight-comparison/index.html` to judge candidates A/B/C. P3-O05 remains untouched and OPEN. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 Native Dash Seam Continuity (2026-09-07, fourth review)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `fbb0a63` (matches expected checkpoint), worktree clean before start.

**QUESTION:** Human accepted the native-glyph stroke weight direction but found "――" visibly discontinuous (breaks in the middle). Can the seam be closed with a Renderer-internal per-glyph paint split, preserving real font ink and canonical Core semantics exactly?

**METHOD:** Confirmed (again, directly) that a DASH run composes as exactly one Core atom with completely unchanged `SourceSpan`/occupancy. Implemented `paintModel.ts`'s `dashGlyphsFor(text, heightPx, ctx)`: subdivides the run's own already-canonical `heightPx` into one deterministic slot per grapheme (`Array.from(text).length`), with an em-relative overlap (`ctx.dashOverlapEm`, new optional `PreviewRenderContext` field, default `DEFAULT_DASH_OVERLAP_EM = 0.12`) between consecutive slots — the first slot starts at exactly 0, the last ends at exactly `heightPx`, so the canonical run's painted length is never shortened, only the internal glyph boundary shifts. `PreviewRenderer.tsx` renders one `<span class="dash-glyph">` per slot using real glyph ink — both prior geometric strategies (solid bar, opacity bar) were fully removed, not just deprioritized.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` §18 (full architecture description, before/after values). Regenerated the comparison artifact (retitled "P3-O04 Native Dash Seam Comparison") using the REAL mechanism (three different `dashOverlapEm` context values: 0.08/0.12/0.16em — not a CSS string hack this time). 82/82 renderer/preview tests pass (81 previous + 1 new; two existing tests updated in place to match the new mechanism); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` 0 new errors. No Core file touched.

**RESULT: the per-glyph native-paint-with-overlap architecture is now the actual implementation** (confirmed by regression tests: exactly N paint nodes per N-grapheme run, first node at top 0, last node's bottom exactly equals canonical `heightPx`, genuine overlap between consecutive nodes, zero `::after`/`opacity`/`color:transparent` anywhere, canonical `heightPx` identical across all three overlap candidates). **The exact overlap value remains HOLD**, pending Human confirmation among the three regenerated candidates.

**DECISION: P3-O04 — architecture resolved and implemented; overlap VALUE — HOLD, Human seam recheck required.**

**WHY:** Every claim traces to a directly-computed value (grapheme count, canonical heightPx, overlap arithmetic) or a passing regression test — the architecture change (one atom, many paint nodes) was explicitly authorized by the task's own instruction that Renderer-only paint splitting is allowed as long as Core's own semantic run stays single; nothing about Core, SourceSpan, or canonical occupancy was altered.

**NEXT:** Human review of `qa/visual/p3-o04-dash-weight-comparison/index.html` to pick among overlap candidates A (0.08em) / B (0.12em, current default) / C (0.16em). P3-O05 remains untouched and OPEN. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 — Human Visual QA Final PASS / CLOSED (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `ae7ea75` (matches expected checkpoint), worktree clean before start.

**HUMAN SELECTION:** candidate C (0.16em) from the 3-way seam-overlap comparison — continuity PASS, native stroke weight PASS, slight antialias/color variation at the join accepted for Preview, no dark knot or heavy doubled stroke. `DEFAULT_DASH_OVERLAP_EM` updated from `0.12` to `0.16` in `paintModel.ts`.

**REQUIRED FINAL CONFIRMATION:** before closing, a 3-glyph "―――" fixture was exercised against the SAME already-generalized `dashGlyphsFor` rule (no special-casing needed for N=3) at the selected 0.16em, and verified against all 8 required checks: no gap glyph1/2, no gap glyph2/3, middle glyph extends proportionately (not disproportionately) versus the end glyphs, run not shortened (first glyph at 0, last glyph's bottom exactly equals canonical `heightPx`), canonical `SemanticRun` remains exactly one unit, `SourceSpan`/canonical extent unchanged (3 cells exactly), surrounding text unaffected, and the ー (U+30FC) prolonged sound mark directly confirmed unaffected (composes as ordinary `TEXT`, never gets `semantic-dash`/`dashGlyphs`). All 8 passed on the first attempt — no new candidates were created, per instruction not to reopen the strategy.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O04_DASH_VISUAL.md` §19 (full checklist, before/after values). Comparison artifact regenerated and retitled "P3-O04 Dash Seam Final Confirmation," now showing the approved 2-glyph and newly-confirmed 3-glyph runs side by side at the single shipped default (no longer an A/B/C pick). 88/88 renderer/preview tests pass (82 previous + 6 new); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` 0 new errors. No Core file touched throughout this entire multi-review history.

**DECISION: P3-O04 (Dash Visual) — Human Visual QA PASS. CLOSED.** Final architecture: real native font glyph ink, split into one Renderer-only paint node per grapheme (any N), with a 0.16em overlap between consecutive nodes. `PHASE3_OPEN_ITEMS.md` row P3-O04 updated to CLOSED/PASS. **P3-O05 (ellipsis) remains untouched and OPEN** — no shared-component behavior change was introduced for it at any point across this history.

**WHY:** Every one of the 8 required checks traces to a directly-computed value or a passing regression test against the actual generalized implementation (not a special N=3 code path) — the closure is backed by proof the same rule generalizes correctly, not by assumption.

**NEXT:** P3-O05 (Ellipsis Visual) is the next active Preview Renderer item. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O04 — Product Scope Clarification (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `0b17f92` (matches expected checkpoint), worktree clean before start.

**DECISION (Product/Human, not a technical finding):** the publication-quality continuous dash treatment closed in the prior entry is **guaranteed only for the standard 2-glyph run "――"**. Runs of 3+ consecutive U+2015 characters render via the SAME unmodified `dashGlyphsFor` mechanism (already generalized, no special-casing exists or is needed) — source and `SourceSpan` always preserved, input never rejected or rewritten — but seam continuity across every join is explicitly **NOT** a guaranteed-quality claim for N≥3, and no additional Renderer complexity was added or is planned solely to guarantee it. The ー (U+30FC) prolonged sound mark remains completely unaffected (already directly confirmed in the prior entry).

**No code change was made or needed** — the existing implementation already behaves exactly as newly specified; this is a documentation/scope-boundary clarification only. `qa/evidence/P3_O04_DASH_VISUAL.md` §§20–21 and `docs/architecture/PHASE3_OPEN_ITEMS.md`'s P3-O04 row and "Non-P3-O Future Items" section updated accordingly.

**Future item recorded (not implemented):** 文章チェックβ v2 may eventually flag 3+ consecutive U+2015 characters with a NOTICE_ONLY recommendation favoring the supported "――" form — descriptive only, no numeric identifier, no design/implementation work performed.

**DECISION: P3-O04 remains CLOSED**, scope now precisely bounded. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O05 — Ellipsis Visual Audit (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `a8a74b3` at start (one commit ahead of the task's stated checkpoint `0b17f92` — the legitimate result of the just-completed P3-O04 Product Scope Clarification task; not a blocker, not reopened), worktree clean.

**QUESTION:** does ELLIPSIS (`……`, SEMANTIC_RUN runKind ELLIPSIS) suffer the same seam-continuity defect Dash had, or any other proven visual defect, requiring a Renderer paint correction — audited independently, per explicit instruction not to assume Dash's own fix transfers.

**METHOD:** re-confirmed via fresh Read/Grep (not memory) that `semanticRunUnit.ts`, `core/breaks/opportunity.ts` (zero internal break opportunities for any SEMANTIC_RUN runKind, including ELLIPSIS — no dispatch branch exists for it at all), and the current `fixtures.ts`/`paintModel.ts`/`PreviewRenderer.tsx` all treat ELLIPSIS identically to ordinary TEXT — no special CSS class, no paint-model field, plain shared text node. Re-read the frozen `P2_L06_SPECIAL_GLYPH_ALIGNMENT.md` in full: its own "Honest status" section discloses the historical ellipsis off-center numbers (~-0.15em / ~-5.15em, internally inconsistent) were captured against an earlier, buggy PoC page build (pre column-overlap-fix) and were never re-confirmed — explicitly not final evidence. Reasoned that Dash's fix was justified by a CONTINUOUS-STROKE-specific problem (a shared text node leaving a visible seam between two "―" glyphs that must look like one unbroken line); ellipsis's "…" glyph is a self-contained discrete dot-cluster, not a continuous stroke, so no analogous seam-continuity requirement applies. No other structural defect (font ink, orientation, centering, per-character separation, writing-mode, inherited CSS, line-height, transform) specific to ellipsis (and absent from ordinary body text) was found.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O05_ELLIPSIS_VISUAL.md` (full 16-section audit). `renderer/preview/ellipsisVisual.test.ts` — 26 new tests, all passing, including 4 explicit Dash Regression Protection checks (0.16em constant, 2-glyph and 3-glyph seam-node shapes, dash-ellipsis fixture painting both runs correctly side by side). Full regression: Core 347/347, Stage C 21/21, Stage D 30/30, P3-O09 (renderer/preview) 114/114 (88 pre-existing + 26 new) — all PASS, including `dashVisual.test.ts` (20) and `generateDashWeightComparison.test.ts` (8) unmodified. `npx tsc --noEmit` — 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error remains).

**DECISION: P3-O05 (Ellipsis Visual) — MACHINE PASS.** No Renderer paint code changed for ellipsis (native, unmodified rendering confirmed correct by audit, not left as an unexamined default). Only stale "still OPEN"/"provisional" comments and the `dash-ellipsis` fixture's own label text were updated to reflect the closed, audited status. `PHASE3_OPEN_ITEMS.md` row P3-O05 updated to CLOSED/MACHINE PASS, pending Human Visual QA. Ready for Human Visual QA on the `……` run's appearance in `qa/visual/p3-o09-preview/index.html`; not yet Human PASS.

**WHY:** Every claim traces to a directly-read code fact (opportunity.ts's dispatch, paintModel.ts's field population) or a passing regression test — the "no change needed" conclusion is the audited, evidence-based outcome of independently examining ellipsis's own structural nature, not an assumption inherited from Dash.

**NEXT:** Per this task's own instruction, the next task should re-audit `PHASE3_OPEN_ITEMS.md`'s actual remaining blockers rather than assuming P3-O06 follows by default. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## Roadmap Documentation — 縦罫線 / Vertical Rule Future Item (2026-09-07)

**DOCUMENTATION ONLY — no Core/Renderer/src/Production change.** Recorded a Human-approved future typography feature: 縦罫線 (Vertical Rule), a proper explicit vertical-rule typesetting element for a long continuous line, distinct from and never automatically converted from repeated dash punctuation ("―――" etc. — source meaning stays under user control, no silent reinterpretation). Initial Human-approved spec: length by character count (never arbitrary px); one standard stroke width only (no user-selectable thickness initially); black only (no color/gray); must not push surrounding text or cause reflow; modeled as ONE formal semantic/canonical unit (not N repeated dash glyphs, exact type name not frozen). Future ownership split (Editor/notation creates it, Normalizer recognizes explicit notation, Core owns position/length/occupancy/identity/association, both Preview and Publication Renderers reproduce the same semantic rule from canonical data — never a browser-only CSS trick, never DOM-measurement-derived length). Cross-referenced with the previously-recorded 文章チェックβ v2 dash notice (a future NOTICE_ONLY suggestion could point authors at this feature) and grouped alongside Dakuten Attachment as a future special-typography item, while kept independently specified. Recorded in `docs/architecture/PHASE3_OPEN_ITEMS.md`'s "Non-P3-O Future Items" section. No numeric P3-O identifier assigned, per instruction. Did not interrupt or modify the concurrently active P3-O05 task.

---

## P3-O05 — Human Visual QA Final PASS / CLOSED (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `9e08bff` (matches expected checkpoint), worktree clean before start.

**HUMAN OBSERVATION:** the `……` run in NORMAL Preview (`qa/visual/p3-o09-preview/index.html`, `dash-ellipsis` fixture) reads naturally as a vertical ellipsis, is visually centered acceptably, spacing is acceptable, surrounding text is unaffected, no line/page escape, no debug decoration visible.

**DECISION: P3-O05 (Ellipsis Visual) — Human Visual QA PASS. CLOSED.** No further ellipsis paint change made. `qa/evidence/P3_O05_ELLIPSIS_VISUAL.md` §1/§15 and `PHASE3_OPEN_ITEMS.md` row P3-O05 updated from "MACHINE PASS, pending Human Visual QA" to full "CLOSED / PASS," matching the P3-O03/P3-O04 pattern exactly.

**WHY:** The Human's own observation directly confirms the prior machine audit's conclusion (native, unmodified rendering is correct) — no new evidence contradicted it, so no further investigation or paint change was warranted.

**NEXT:** Audit the actual remaining Phase 3 / P3-O09 open-item list rather than assuming P3-O06 follows by default (see the Closure Readiness Audit entry immediately below, completed as part of the same task). Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched.

---

## P3-O09 — Closure Readiness Audit (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `9e08bff` (matches expected checkpoint), worktree clean before start. Documentation/audit only — no Core/Renderer/`src/`/Production code read for modification, only for evidence gathering.

**QUESTION:** with P3-O03/O04/O05 all now Human-PASS CLOSED and Ruby's own anchor-correctness Human-PASS CLOSED, what exactly remains before "P3-O09 Preview Renderer implementation" can be called complete — audited directly from frozen docs, not assumed, and without automatically executing P3-O06/O07/O08/F06 merely because they remain OPEN elsewhere.

**METHOD:** direct-read `PHASE3_OPEN_ITEMS.md`, `P3_O09_PREVIEW_RENDERER_FOUNDATION.md` (including its two Human Visual QA HOLD addenda), `RUBY_PLACEMENT_PREVIEW_MICRO_LOOP.md` (including its three Human Visual QA HOLD addenda, ending in Final Result PASS), `P3_O03_TCY_VISUAL.md`, `P3_O04_DASH_VISUAL.md`, `P3_O05_ELLIPSIS_VISUAL.md`, `STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md`, `CURRENT_EDITOR_FEATURE_INVENTORY.md` (for F06's true classification), and direct code reads (`paintModel.ts`, `PreviewRenderer.tsx`, `fixtures.ts`) to verify font-identity-warning and colophon-fixture claims rather than trusting prior evidence-doc prose alone.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O09_CLOSURE_READINESS_AUDIT.md` (full 18-section audit + acceptance matrix + blocker classification). Every audited remaining item (P3-O06 residual, P3-O07, P3-O08, F06, image resolver, colophon artifact fixture, folio/header, virtualization) classified as either a separately-tracked item, an intentional disclosed architecture boundary, or a narrow non-blocking follow-up — none is a Preview Renderer architecture defect. Font-identity-mismatch warning directly confirmed present and wired (`paintModel.ts:473`, `PreviewRenderer.tsx:278`). Colophon paint mechanism confirmed proven at the unit-test level but absent from the main Human-visible artifact's fixture list (narrow, non-blocking gap).

**DECISION: P3-O09 — HAS NARROW REMAINING TECHNICAL BLOCKERS (none of which are Preview Renderer architecture gaps).** Recommends (does not unilaterally decide) that `PHASE3_OPEN_ITEMS.md` row P3-O09 could be marked CLOSED now, with P3-O06/O07/O08/F06 correctly remaining separately OPEN under their own IDs — final call left to Human/Product, per the audit's own §17. `PHASE3_OPEN_ITEMS.md` row P3-O09 was **not** changed by this task (its status remains IN PROGRESS pending that Human decision, to avoid unilaterally closing a roadmap item this audit itself flags as needing sign-off).

Also recorded, documentation only, not implemented: the Human-approved future Editor feature **文章チェックβ v2 — 縦書き・入稿向け原稿チェック** (local-only, no manuscript transmission to AI/external APIs; five future check categories; SAFE_AUTO_FIX/REVIEW_BEFORE_FIX/NOTICE_ONLY fix-class model; cross-referenced with the existing 縦罫線/Vertical Rule and Dakuten Attachment future items) — added to `PHASE3_OPEN_ITEMS.md`'s "Non-P3-O Future Items" section, no numeric P3-O identifier assigned.

**WHY:** Every classification traces to a directly-read frozen document or a directly-read code fact (not memory) — the "non-blocker" calls for P3-O06/O07/O08/F06/image/virtualization all rest on those items' own frozen documents already describing them as separate, intentionally-deferred, or out-of-Renderer-scope, not on this audit's own convenience.

**NEXT:** Pending the Human decision on P3-O09's own closure (§17 of the audit), the next independently-startable items are P3-O06's exact ruby overhang values, P3-O07's TCY auto-detection threshold, or P3-O08 Publication Renderer work — none started here. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No code was changed by this task.

---

## P3-O09 Closure + P3-O08 Publication Renderer Foundation (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `1a0dc86` (matches expected checkpoint), worktree clean before start.

**P3-O09 CLOSURE (Human/Product decision):** APPROVED to close now — the optional colophon end-to-end artifact fixture is explicitly NOT a blocker. `PHASE3_OPEN_ITEMS.md` row P3-O09 updated from IN PROGRESS to **CLOSED / PASS**. P3-O06/O07/O08/F06/folio-header/real-image-resolver/virtualization all remain correctly, separately OPEN or DEFERRED — none silently folded into this closure.

**P3-O08 AUDIT:** Direct-read of Master §1.3/§4.2/§11.2/§25.5/§25.6/§28.8/§28.10, `PHASE3_OPEN_ITEMS.md` row P3-O08, and the legacy export pipeline (`src/utils/exportPdf.ts`, `src/utils/exportCapture.ts`, read-only). Confirmed the legacy pipeline is entirely screenshot-based (`html-to-image` DOM capture → grayscale PNG → jsPDF `addImage()`) — jsPDF is used only as a raster-image container today, never for vector text/shape placement. This is exactly the "Preview DOM as layout authority" antipattern the frozen contract forbids for the new architecture. `jspdf` already exists as a repository dependency (`package.json`) — no new dependency was added.

**FOUNDATION IMPLEMENTED:** `typesetting-v2/renderer/publication/` — `geometry.ts` (`tickToMm`, Contract §21's 1 tick = 0.001mm, no display-scale concept), `paintModel.ts` (`buildPublicationDocument`, a renderer-independent physical-mm paint model, sibling to but never dependent on `renderer/preview/`), `pdfGenerator.ts` (`generatePublicationPdf`, real jsPDF vector `rect()` calls at true physical coordinates — never a screenshot, never Preview DOM), `fixtures.ts` (own re-declared fixture corpus, same convention as Preview/Stage C/Stage D), `vitest.config.ts`.

**HONEST LIMITATION FOUND, NOT WORKED AROUND:** jsPDF's built-in fonts have zero CJK glyph coverage — drawing real Japanese text via `pdf.text()` would silently fail/tofu, which would be a fake "finished" PDF (explicitly forbidden by instruction). Rather than fake it, this foundation draws each placed unit's own canonical bounding box as a vector rectangle (no font needed) — proving coordinate/architecture fidelity end-to-end from `CanonicalDocument`, honestly not claiming finished typography. Font embedding is named as the exact next technical task, correctly framed as a Product/dependency-gate decision (no font file committed, no new dependency added, per instruction).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O08_PUBLICATION_RENDERER_FOUNDATION.md` (full 22-section audit). 21 new tests (18 `paintModel.test.ts` + 3 `generatePublicationArtifact.test.ts`), all passing, covering the task's own required 18-item list plus a real generated PDF artifact (`qa/publication/p3-o08/dash-ellipsis.pdf`, verified `%PDF-` header, non-trivial size). Dash's own P3-O04 seam-overlap treatment is explicitly NOT reproduced at the Publication layer (disclosed gap, test 13) — Master §28.10's own gate-separation principle ("Preview PASSはPublication PASSを意味しない") means Preview's Human-approved fix does not automatically transfer, and this task does not fabricate a false claim of parity. Full regression: Core 347/347, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 21/21 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: P3-O09 — CLOSED / PASS. P3-O08 — FOUNDATION PASS, item remains IN PROGRESS.** `PHASE3_OPEN_ITEMS.md` rows for both updated accordingly.

**WHY:** Every claim traces to a directly-read frozen document, a directly-read legacy source file, or a passing test against real generated bytes — the "font embedding is the blocker" conclusion is a proven architectural fact (jsPDF's own standard-14-fonts limitation, well-documented), not a guess, and the decision not to fake glyph rendering follows directly from the task's own explicit instruction.

**NEXT:** Font embedding decision (Product/dependency-gate) is the named next technical task before further Publication visual work (TCY shaping, Dash/Ellipsis/Ruby treatment) can proceed meaningfully. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Font Embedding Gate Audit (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `dfe20d5` (matches expected checkpoint), worktree clean before start. (A GAME-LOOP-018 prompt for an unrelated project was pasted into this session mid-turn by mistake — confirmed via `git status`/`git rev-parse HEAD` that it caused zero file changes before being disregarded entirely, per explicit user instruction; not otherwise recorded here.)

**QUESTION:** can TateSpun's actual body font be legally embedded in a Publication PDF, and does jsPDF (already installed) technically support it — audited before attempting any PoC, per instruction not to guess.

**METHOD:** direct-read `src/lib/pageLayout.ts`/`src/app/layout.tsx` for the real font identity (Shippori Mincho, loaded from Google Fonts CDN, no local copy); `core/measurement/facts.ts`/`fakeProvider.ts` for MeasurementFacts identity (confirmed: no real provider exists anywhere in v2 Core yet — fully synthetic, a pre-existing system-wide gap, not new); a repository-wide file search for any existing Shippori Mincho/Noto/Zen Old Mincho font binary (none found — only an unrelated HarfBuzz prototype's Latin/Devanagari/Arabic test fonts exist, no CJK coverage); `node_modules/jspdf/types/index.d.ts` and `node_modules/jspdf/README.md` (version 4.2.1, matching the repository's own declared dependency) for jsPDF's own documented custom-font/CJK capability; WebFetch against Google's own official `google/fonts` GitHub repository's `OFL.txt` for Shippori Mincho — the authoritative upstream license source, not an inference from "free font" status.

A first attempt to fetch the actual font binary via `curl` into `/tmp` was correctly interrupted and cancelled by the user mid-task, since it preceded completing the license/asset audit — the audit was then finished using only Read/Grep/Glob/WebFetch against already-permitted sources, with no further download attempted.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md` (full 15-section audit). License: SIL Open Font License 1.1, confirmed via Google's own official repository — explicitly grants "embed" and "redistribute" by name (not inferred). jsPDF: `addFont`'s own `Identity-H` encoding option and the README's own worked example ("if you want to have for example Chinese text in your pdf...") directly confirm the library is designed for exactly this use case. **No blocker found in license or technology — the sole gap is that no font binary exists anywhere in this repository to actually embed.**

**DECISION: HOLD — asset acquisition gate.** Classified as Category F (missing local asset), explicitly not a license, format, or jsPDF-capability blocker (all of those cleared favorably). No PoC PDF was generated; no `renderer/publication/` code was changed; the existing 21 P3-O08 Foundation tests were re-run unmodified to confirm (still 21/21 PASS). `PHASE3_OPEN_ITEMS.md`'s P3-O08 row is unchanged (already correctly IN PROGRESS).

**WHY:** Every claim traces to a directly-read local file, a directly-read jsPDF source/doc file, or an authoritative upstream license source fetched via WebFetch — no font-embedding capability claim was inferred from "it's a free font" or from generic Unicode-support marketing text, per the task's own explicit caution.

**NEXT (at the time):** A Human decision on how to obtain the Shippori Mincho binary. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency, no font binary committed at this point.

**RESOLUTION (same task, continued after Human approval):** the Human approved a one-time, controlled fetch of the exact audited asset from Google's own official fonts repository. `ShipporiMincho-Regular.ttf` + its `OFL.txt` were fetched into `typesetting-v2/qa/publication/p3-o08/font-poc/fonts/` (repo-local, non-Production). The isolated PoC (`renderer/publication/fontPoc.test.ts`) succeeded on every check: font registration, real Japanese vector-text PDF generation (`気が合った。`/`東京`/`2026`/`――`/`……`), and a controlled vertical column of six upright characters at increasing physical y coordinates (never a whole-string rotation, which would read sideways). `pdfGenerator.ts` gained an optional, backward-compatible `fontResource` parameter — when supplied, ordinary TEXT units now draw real embedded glyphs at their own already-fixed canonical coordinates; RUBY/TCY/SEMANTIC_RUN/IMAGE remain rectangles (disclosed, deliberately out of this task's scope). Proven non-re-layouting (a `PublicationDocument` deep-equal snapshot is unchanged whether or not a font is supplied) and non-breaking (the original rectangle-only artifact regenerates byte-for-byte at its original size when no font is given). 9 new tests, all passing. Full regression: Core 347/347, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 30/30 — all PASS; `npx tsc --noEmit` 0 new errors. `qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md` updated from HOLD to PASS; `PHASE3_OPEN_ITEMS.md` row P3-O08 updated accordingly.

**DECISION: P3-O08 Font Embedding Gate — PASS.** Ordinary CJK Publication body text is now technically proven viable end-to-end. Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment remains explicitly OPEN, named as the next task, not started here.

**NEXT:** Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment (independently re-derived for vector PDF text, not copied from Preview's own CSS-DOM techniques). Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Real Shippori Mincho MeasurementFacts (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `7c77439` (matches expected checkpoint), worktree clean before start. Human PDF QA recorded PASS for the prior task's CJK/vertical PoCs (Japanese visible, no tofu/mojibake, Shippori Mincho appearance confirmed) — recorded in `qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md` §14.

**QUESTION:** with real CJK font embedding proven, does v2 Core's own `MeasurementFacts` need to switch from its synthetic fake provider to real, font-derived glyph metrics before Ruby/TCY/Dash/Ellipsis Publication work can proceed?

**METHOD:** direct-read Core Contract §17/§18, Master HD-015/HD-018 (§25.1/§25.4), and this session's own prior falsification-test memory (InDesign's real PDF output independently confirmed uniform 1em advance per character, not per-glyph proportional width) — before writing any code. Audited every real `MeasurementFacts` consumer (`compose/line.ts`'s `advanceTickFor`/ruby-atom placement) to confirm exactly which facts are geometry-producing vs. identity-only.

**CENTRAL FINDING:** Natural Pitch is a FROZEN Human Product Decision — "natural 1em declared-pitch composition": character advance equals the declared point size itself, never a per-glyph font metric. A real provider that read Shippori Mincho's own glyph-width tables and used them would be a CONTRACT VIOLATION, not an improvement. The actual gap was never the arithmetic — it was that `measurementIdentity` had no real, verifiable connection to an actual font asset.

**IMPLEMENTED:** `core/measurement/sfntReader.ts` (a deliberately minimal SFNT table-directory reader — no glyph outlines, no cmap mappings, no hmtx/vmtx per-glyph widths parsed, none needed) and `core/measurement/shipporiMinchoProvider.ts` (`createShipporiMinchoMeasurementProvider`, built against the exact already-committed, Human-QA'd font asset from the Font Embedding Gate — no new binary added). Its `naturalAdvanceTick`/`rubyReadingExtentTick` are proven byte-identical to the fake provider's own formulas, both at the single-function level and via full `CanonicalDocument` composition parity (F20, ruby, TCY, dash/ellipsis fixtures). What is genuinely new: a `crypto.createHash("sha256")`-derived (Node built-in, no new dependency) content-tied `providerVersion`, making `measurementIdentity` vs. Publication's own `paintFontIdentity` a meaningful, provably-detectable match/mismatch for the first time (`fontPoc.test.ts`'s new identity test group). `fakeProvider.ts` is untouched and remains the correct choice for ordinary test/fixture code.

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O08_REAL_MEASUREMENT_FACTS.md` (full 16-section audit). 22 new Core tests + 2 new Publication identity tests. Full regression: Core 364/364 (347 + 17 net new), Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 32/32 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: P3-O08 Real Measurement Facts — PASS.** No Natural Pitch behavior changed (proven, not merely claimed). `rubyScale` was found to be unapplied anywhere in the ruby-reading-extent call path — recorded honestly as a pre-existing, out-of-scope Core-composition observation, not fixed here.

**WHY:** Every claim traces to a directly-read frozen contract clause, a directly-read Human-approved decision, an already-passing pre-existing regression, or a new passing test comparing real-vs-fake output byte-for-byte — the "no formula change needed" conclusion is the evidence-driven, contract-derived answer, not an assumption of convenience (the task's own instructions explicitly warned against exactly the mistake this audit avoided: replacing a correct 1em advance with fabricated per-glyph proportional widths).

**NEXT:** Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment — not started here, per instruction (deferred a second time, now with a real, verifiable measurement identity available to any future Publication evidence that wants to cite it). Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency, no new font binary.

---

## P3-O08 — Publication Typography (Ruby/TCY/Dash/Ellipsis) (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `ef23de2` (matches expected checkpoint), worktree clean before start.

**AUDIT:** direct-read jsPDF's actual `text()`/`getTextWidth()`/`rect()` API (`node_modules/jspdf/types/index.d.ts`) before writing paint code. Discovered `vi.spyOn(jsPDF.prototype, "text")` does not work — jsPDF v4's plugin system attaches paint methods as per-instance own properties, not prototype methods (proven directly by a failing spy, not assumed). **Architectural response:** split `pdfGenerator.ts` into `buildPaintPlan` (pure, jsPDF-free plain-data `PaintCommand[]`) and `renderPaintPlanToPdf` (a thin mechanical executor) — every typography test now asserts against the pure plan directly, more precise than spying on library internals.

**RUBY SCALE OBSERVATION, classified before writing Ruby paint code:** Category B (paint-only choice), not a canonical measurement gap — the canonical `rubyReadingExtentTick` defines RESERVED SPACE, not a mandated paint font size; Preview's own already-Human-approved `0.55em` annotation font-size ratio already demonstrates this exact paint-time-sizing freedom. Publication re-derives the same `0.55` ratio independently, citing Preview's precedent rather than copying its CSS mechanism. No Core change made or needed; did not stop the Ruby branch.

**IMPLEMENTED, each independently re-derived (never copied from Preview's CSS/DOM technique):** Ruby (per-grapheme base + annotation painting at canonical offset/extent, smaller paint-time font size); TCY (one horizontal, UNROTATED text command — an initial `angle: -90` draft mistake, which would have made digits read sideways, was caught and fixed before shipping — fit via a single measure-then-scale pass against the real font, bounded by the canonical single-cell width); Dash (P3-O04's own per-grapheme 0.16em overlap concept, re-derived in physical mm); Ellipsis (native glyph, explicitly proven to NOT share Dash's overlap treatment — even per-grapheme spacing instead).

**PRIMARY EVIDENCE:** `typesetting-v2/qa/evidence/P3_O08_PUBLICATION_TYPOGRAPHY.md` (full 16-section audit). 27 new tests (Ruby 5, TCY 5, Dash 7, Ellipsis 3, cross-cutting 8 including a combined Human QA PDF). A test-methodology note recorded: invariant snapshots use `structuredClone` rather than JSON round-trip, since JSON silently normalizes a pre-existing, harmless `-0` (a float curiosity in one ruby offset computation, predating this task) to `0`, which would otherwise read as a false mutation. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 59/59 — all PASS; `npx tsc --noEmit` 0 new errors.

**HUMAN QA ARTIFACT:** `qa/publication/p3-o08/publication-typography-qa.pdf` — one real, 4-page, manual-page-break-separated composition covering ordinary text + Ruby + TCY + Dash + Ellipsis together, through the exact same pipeline every test exercises (no screenshot, no demo-only code path).

**DECISION: P3-O08 Publication Typography — MACHINE PASS.** Ready for Human Visual QA; not yet claimed as final Publication Quality. P3-O06 (exact ruby overhang values) and P3-O07 (TCY auto-detection) remain untouched and separately OPEN.

**WHY:** Every claim traces to a directly-read jsPDF API surface, a directly-read frozen Core/Preview precedent, or a passing test against real generated PDF bytes — the jsPDF-prototype-spy discovery and the TCY rotation mistake were both caught through direct verification (a failing test, a code review before shipping) rather than assumed correct from memory.

**NEXT:** Human Visual QA of the combined and per-fixture PDFs; afterward, either refine a Human-flagged treatment or proceed to a still-open P3-O08 item (grayscale color space, paper-size/bleed/trim, JPG output). Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Publication Typography HOLD: Page Geometry + Ruby Overlap + Oversized Glyphs (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `da2b084` (matches expected checkpoint), worktree clean before start.

**HUMAN VISUAL QA REPORT: HOLD.** The combined QA PDF's page measured ~7.4×44.4mm — a single-column test-fixture strip, not a real page, invalidating typography judgment at that scale. Ruby annotation visibly overlapped the base run. Dash flagged as "suspicious," to be rechecked after page geometry was fixed.

**A. Page-size ownership investigated first, per required order.** Direct-read `core/layout/schema.ts`: `CanonicalPage` carries zero physical geometry fields (`{id, order, columns, folio?}` only) — `LayoutSettings.pageWidthMm`/`pageHeightMm` are declared but never consumed by composition. Page size is legitimately DERIVED from capacity (Contract §19), the same convention Preview's own `paintModel.ts` already uses unchanged. **No canonical geometry defect found — no Core change made.** The real defect: the combined-QA-PDF test used a tiny test-fixture capacity. Fixed to `charsPerLine:40, linesPerColumn:28` (10.5pt) → ~104×148mm, close to a real bunko/A6 page.

**D. Traced the Ruby mismatch and found TWO independent, real bugs (neither a scale illusion) while investigating:**
1. **Oversized glyphs** (also explains Dash's "suspicious" appearance): `bodyFontSizePt` was derived from a canonical atom's WHOLE `heightMm`, correct only for TEXT (one atom per character already) — wrong for Ruby base, Dash, and Ellipsis (multi-character atoms), painting every glyph ~2x (or Nx) too large. Fixed: derive font size from `heightMm / graphemeCount`.
2. **Ruby annotation overlap:** clearance was computed as a fraction of the BASE run's own width — an unrelated scale from the annotation's own similarly-sized font, producing too small a gap. Fixed: clearance now derives from the annotation's own em-width.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_PUBLICATION_TYPOGRAPHY.md` §17 (new). 3 new regression tests (Ruby base font-size, Ruby annotation non-overlap, Dash font-size) proving the corrected formulas by construction. Combined QA PDF regenerated at realistic page size. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 62/62 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: two real bugs fixed; page-size root-caused to a test-fixture choice, not Core.** Human Visual QA remains HOLD until re-reviewed against the regenerated PDF — this task does not self-declare PASS on visual quality.

**WHY:** Every claim traces to a directly-read Core schema (proving no physical-geometry field exists to have been "used wrong"), or arithmetic proof that the pre-fix formula used the wrong divisor/reference scale — not assumed from the Human's own description alone.

**NEXT:** Await fresh Human Visual QA on the regenerated PDF. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Publication Physical Page & Vertical Paint Foundation (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `12ffaf0` (matches expected checkpoint), worktree clean before start.

**HUMAN HOLD (round 2):** the page's outer size looked realistic but the body column painted flush against the paper's own right edge (no margin); Ruby reading text existed in the PDF content stream but was not rendered visibly (Human's own hypothesis: pushed off-page); Dash painted as two horizontal bars, not a vertical line; Ellipsis used horizontal dot orientation.

**A. Page-size ownership investigated first, per required order (again, more deeply this time — the prior task's finding that `CanonicalPage` has no physical field was correct but insufficient: it doesn't by itself justify treating content extent AS paper size).** Confirmed no authoritative resolved physical-paper-geometry source exists anywhere in the currently-implemented Core (`LayoutSettings.pageWidthMm`/`marginsMm` declared but never consumed by `composePage`/`composeColumn`/`composeLine`, confirmed by direct read of all three files). Adopted the task's own explicitly-permitted architecture: a Renderer-only `PublicationPageGeometry` (paper size + margins) in `pdfGenerator.ts`, optional and additive to `buildPaintPlan`, content now painted INSET from real paper edges rather than assumed to fill them. No Core change made.

**B/C.** Regenerated the combined QA PDF using a real 文庫 paper preset (105×148mm, matching the legacy Production export pipeline's own `PAPER_SIZES` table, cited not imported) with realistic margins (12/12/15/10mm) and content-area-derived capacity (33/21), rather than an arbitrary page size with zero margins.

**D. Traced Ruby before patching position, per instruction.** Confirmed the annotation's own offset/extent math (already regression-tested) was correct all along — the root cause was purely the missing margin: the base run's rightmost line sat AT the (fake, content-sized) page boundary, leaving the annotation with zero room. Fixed by the page-geometry change itself; proven by a dedicated regression test (annotation's own painted column stays within paper bounds).

**Vertical glyph orientation — capability audit, then targeted fix.** Confirmed exhaustively (case-insensitive search of jsPDF's entire type surface) that jsPDF has NO OpenType vertical-substitution (`vert`/`vrt2`) capability — only whole-string `angle` rotation exists. Applied a 90° glyph rotation (`angle: -90`, direction is a disclosed best-effort choice, not independently visually verified) to Dash and Ellipsis specifically — the smallest deterministic, vector-only fix available without a new dependency.

**Ordinary punctuation audited honestly, NOT special-case-patched.** Confirmed brackets/commas/periods currently share the same unrotated paint path as any kanji character — real vertical typesetting needs its own (larger, curated) treatment per character class. Classified as a distinct **GENERAL VERTICAL GLYPH ORIENTATION BLOCKER**, explicitly named and scoped OUT of this task rather than silently left unaddressed or naively patched.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_PUBLICATION_PHYSICAL_PAGE_AND_VERTICAL_PAINT.md` (new, full 15-section record). 4 new regression tests (margin inset, Ruby-within-bounds, rotation-per-kind, backward-compatible-without-geometry) plus inline paper-size and no-content-off-page proofs in the combined QA PDF's own test. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 66/66 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: PARTIAL.** Page/content-box model and Ruby: fixed and proven. Dash/Ellipsis: rotated (direction unverified, flagged). General punctuation orientation: classified, not fixed. Human Visual QA required again before any PASS claim.

**WHY:** Every claim traces to a directly-read Core file (proving no physical-geometry source exists), a direct jsPDF API-surface search (proving no vertical-substitution capability exists), or an arithmetic trace of the exact coordinate chain that pushed Ruby off-page — never assumed from the Human's own description alone.

**NEXT:** Fresh Human Visual QA on the regenerated PDF, specifically the margin, Ruby visibility/position, and Dash/Ellipsis rotation direction. Separately, a Product/technical decision on whether to invest in the General Vertical Glyph Orientation Blocker now or defer it. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Vertical Glyph Paint Foundation (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `8d898ac` (matches expected checkpoint), worktree clean before start.

**HUMAN HOLD (round 3):** ordinary kanji/kana broadly readable; Ruby now visible (final QA pending); TCY broadly plausible; Dash's vertical stroke intruded into the following character's cell; general vertical punctuation still unresolved. Instruction: stop ad-hoc rotation patching, build ONE deterministic vertical-glyph paint layer.

**AUDIT FIRST, per instruction:** wrote a minimal, self-contained OpenType `cmap` reader (`renderer/publication/fontCapability.ts`, formats 4 and 12 — never touching Core's own `sfntReader.ts`, staying Publication-paint-only) and ran it against the exact committed Shippori Mincho asset. Sourced the exact Unicode vertical presentation-form code points from Unicode's own official Names List (fetched, not recalled from memory) before writing the map. Real, measured result: 、。「」（）―… ALL have real vertical-form glyphs in this font (U+FE11/FE12/FE41/FE42/FE35/FE36/FE31/FE19); ！？：； do not (but are conventionally left upright anyway, per standard Japanese vertical-typesetting practice, so this blocks nothing).

**ROOT CAUSE OF THE DASH INTRUSION BUG, found not assumed:** the prior 90° rotation approach rotated a horizontal glyph's own bounding box, which does not reliably match the assumed per-character cell height — the exact mechanism of the reported intrusion. **Fix:** built ONE deterministic paint layer (`verticalGlyphMap.ts`, a plain `Map<number,number>` + `verticalPaintGraphemeFor`) consulted by TEXT, RUBY base/annotation, DASH, and ELLIPSIS alike — Dash and Ellipsis now paint their real vertical-form glyph UPRIGHT via the exact same per-character-height-slot algorithm already proven correct for ordinary text, eliminating the custom rotation/overlap machinery entirely (removed as dead code, not merely disabled). P3-O04's own Product scope (2-glyph guarantee, source/extent unchanged) is preserved exactly — only the paint mechanism changed, as explicitly permitted.

**Ordinary punctuation — fixed this time, not merely classified.** The same real cmap audit found brackets/comma/full-stop/parentheses already covered by the font, so `「今日は、雨だった。」` and `（仮）` are now painted correctly via the identical generic mechanism, not a one-off patch — a stronger outcome than the prior task's own honest "classified but not fixed" position.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_VERTICAL_GLYPH_PAINT.md` (new, full 12-section record, including the real coverage table). 11 new/rewritten tests (4 cmap audit + Dash/Ellipsis rewrites + 4 new punctuation tests). Ruby/TCY untouched, re-verified via their own unchanged regression suites. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 77/77 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: MACHINE PASS for the paint-layer architecture and code-point selection; Human Visual QA still required for actual rendered appearance** — this task does not and cannot machine-declare visual typography correctness (a font's own glyph design quality is not something a coverage/coordinate test can judge).

**WHY:** Every claim traces to a directly-implemented and directly-run cmap parser against the real committed font file, or an authoritative Unicode Names List fetch — never assumed rotation would work, never guessed code point values from memory without verification.

**NEXT:** Human Visual QA of the regenerated PDF. If glyphs look correct, proceed to JPG/grayscale/paper-size-bleed-trim (still deferred). If still wrong despite correct code-point selection, the next investigation is the font's own glyph design/metrics — a different class of problem than code-point selection, which this task has proven correct. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Vertical Cell-Local Positioning & Ruby Scale Correction (2026-09-07)

**Preflight:** branch `design/tatespun-typesetting-v2`, HEAD `13b6513` (matches expected checkpoint), worktree clean before start.

**HUMAN HOLD (round 4):** closing bracket `」` visually far from preceding `。`; small kana `っ` doesn't sit naturally in its cell; Ruby `とうきょう` spans much too much vertical distance. Instruction: treat as two separate problems — (A) cell-local glyph positioning, (B) canonical ruby extent/rubyScale.

**PART B — diagnosed first, via a real test, not memory:** `rubyScaleDiagnostic.test.ts` traced the exact `atomic-ruby` fixture numbers — base run 7.408mm, canonical `rubyReadingExtentTick` 18.52mm (5 × full body em), ratio 2.5×. Confirmed **classification B**: `rubyScale` is a declared `LayoutSettings` field never read anywhere in the measurement call path. Searched the entire codebase and Master's own decision text for a frozen numeric value — none exists (Master explicitly: "specific numeric values... not frozen by this decision"). Per instruction, did not invent one — asked the Human directly. **Decision: rubyScale = 0.5**, then clarified as a canonical, single-authoritative-value requirement across Core, Preview, AND Publication (not Publication-only).

**IMPLEMENTED:** `DEFAULT_RUBY_SCALE = 0.5` defined once (`core/settings/index.ts`, exported via `core/index.ts`). `core/compose/line.ts`'s `CompositionSettings` gained an optional `rubyScale?` field (optional so no existing settings-construction call site needed updating); the reading-extent measurement call now uses `bodyFontSizePt * (rubyScale ?? DEFAULT_RUBY_SCALE)`. Preview's `.ruby-annotation` CSS `font-size` (was an independently-hardcoded `0.55em`) now interpolates the same constant. Publication's `RUBY_ANNOTATION_FONT_RATIO` (was its own separate `0.55`) now IS the same constant. Result: 9.26mm extent, 1.25× ratio — down from 18.52mm/2.5×. 6 pre-existing `rubyPlacement.test.ts` assertions updated to the correctly-scaled expected values (using a `READING_CELL` constant computed the same way the real code computes it). Body-run coordinates, breaks, and Natural Pitch all proven unchanged (pre-existing regressions pass unmodified).

**PART A — infrastructure built, not machine-selected, per explicit instruction not to guess blindly:** confirmed jsPDF paints every glyph via ordinary horizontal baseline metrics, never the font's own vertical origin/metrics — vertical-form glyph SHAPE substitution (prior task) does not guarantee correct cell-local INK position. Rather than invent one offset number, built a data-driven classification layer (`classifyPunctuation`, `isSmallKana`, `cellLocalOffsetFor` in `verticalGlyphMap.ts`) and THREE named candidates (A_BASELINE = no-op/prior behavior; B_STANDARD and C_STRONG = reasoned, disclosed, unverified magnitude/direction choices per standard convention) threaded through `pdfGenerator.ts`'s paint pipeline as an opt-in parameter (default stays A_BASELINE — no unverified offset is shipped). Generated `punctuation-position-comparison-{A,B,C}.pdf` and `small-kana-position-comparison-{A,B,C}.pdf` for Human comparison.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_VERTICAL_CELL_AND_RUBY_SCALE.md` (full 8-section record). 13 new tests (1 ruby diagnostic + 12 cell-local offset/classification/comparison-generation). Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 90/90 — all PASS; `npx tsc --noEmit` 0 new errors. **Disclosed limitation:** the main combined QA PDF's underlying logic is corrected and proven by tests, but the file on disk was found locked (likely open in a PDF viewer for Human review) on a later regeneration attempt — not silently claimed fresh.

**DECISION: Ruby scale — FIXED (Core change, explicitly Human-authorized). Cell-local positioning — INFRASTRUCTURE READY, Human candidate selection required.**

**WHY:** Every claim traces to a directly-run diagnostic test against real fixture numbers, a directly-searched codebase/Master-text confirmation that no frozen value existed, an explicit Human decision for the number that was missing, or a directly-proven (never assumed) jsPDF baseline-metrics limitation — no offset or scale value was invented without either proof or explicit Human sign-off.

**NEXT:** Human review of the two comparison PDF sets (choose A/B/C, or request a different candidate); separately, close the PDF viewer holding `publication-typography-qa.pdf` and re-run this task's own test suite once more to refresh that specific file. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Font-Derived Vertical Glyph Metrics (2026-09-07)

**HUMAN HOLD (round 5):** ALL THREE round-4 cell-local-offset candidates (A/B/C) REJECTED for both small kana and punctuation, for both classes. Ruby: PASS, frozen at rubyScale=0.5, not reopened. Explicit instruction: do NOT generate a stronger arbitrary offset candidate, do NOT continue subjective numeric tuning — derive placement from the font's own real vertical metrics instead, or STOP and report what's missing.

**AUDITED THE ACTUAL FONT, not assumed:** built `fontMetrics.ts` (a second minimal SFNT reader, `head`/`maxp`/`loca`/`glyf`/`hhea`/`hmtx`/`vhea`/`vmtx`, Publication-paint-only, never shared with Core), extended `fontCapability.ts` with `createGlyphIdLookup` (same cmap parse, now returning the real glyph ID, not just boolean coverage), and ran both against the exact committed Shippori Mincho Regular TTF. Table audit: `vhea`/`vmtx` ARE present (VORG absent — expected, VORG only applies to CFF-outline fonts, this one is TrueType). Extracted real glyph ID + `hmtx`/`vmtx`/ink-bbox metrics for っ, ッ, つ (control), た, 、。「」（）and their U+FE11/FE12/FE41/FE42/FE35/FE36 vertical-form substitutes.

**KEY FINDING:** every single glyph tested — punctuation, small kana, AND ordinary kanji/kana — shares the IDENTICAL real vertical origin from `vmtx` (`originY = yMax + topSideBearing = 880`, out of `unitsPerEm = 1000`), re-proven generically (not just for the 16 hand-picked characters) across the full small-kana set and every punctuation class. The font's own vertical-metrics data provides NO per-glyph or per-class differentiation signal — a uniform origin is the font's own intentional design (a standard CJK vertical-font convention: vertical origin Y set equal to the horizontal ascent-like reference, so horizontal-baseline-fallback rendering — exactly what jsPDF does, confirmed exhaustively in a prior task — already lands correctly). This also proves the pre-existing hand-picked `BASELINE_RATIO = 0.88` constant already equals the font's real measured ratio (880/1000) exactly — not a coincidence uncovered by more guessing, a fact now proven by real data — and explains why round 4's B/C offsets looked WORSE: they deviated away from a position the font itself defines as correct, uniformly, for every character class.

**IMPLEMENTED (correction, not replacement):** `deriveBaselineRatioFromFont` (`pdfGenerator.ts`) derives the baseline ratio from the real font's `vhea`/`vmtx` via `FontMetricsReader.verticalMetrics()`, with a disclosed, proven-reachable fallback (`FALLBACK_BASELINE_RATIO = 0.88`, same value) for a font resource that genuinely lacks `vhea`/`vmtx`. `generatePublicationPdf` now computes and threads this real value; numeric PDF output is unchanged (byte-identical, directly proven) — what changed is that the number is now a derived fact, not an assumption. The round-4 `cellLocalOffsetFor`/`CellLocalOffsetCandidateId`/`CANDIDATES` system is RETIRED (not merely un-defaulted) — real data proves there is nothing for a per-class offset to be derived from. `classifyPunctuation`/`isSmallKana` are retained (real, tested classification facts) and now used to prove the uniformity finding generalizes. Old `cellLocalOffset.test.ts` removed, replaced by `fontDerivedVerticalOrigin.test.ts`. Regenerated ONE font-derived implementation each: `punctuation-position-font-metrics.pdf`, `small-kana-position-font-metrics.pdf` (no A/B/C arbitrary strength scale — the uniform-origin finding was unambiguous, no genuine convention ambiguity was found to justify even 2 alternatives).

**DEPENDENCY GATE: NOT TRIGGERED.** The existing in-house minimal SFNT reader was sufficient to reach a conclusive, evidence-based answer. No HarfBuzz/fontkit/opentype.js added, requested, or required.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md` (full 13-section record, including an honest note that the ink-shape-vs-em-box residual variation this does NOT explain matches the already-known, deliberately-not-pursued P3-O29 Preview-rhythm phenomenon). 16 new tests (4 font-table/metric audit + 12 classification/origin-uniformity/paint-integration/artifact-generation). Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 94/94 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: Font-derived vertical origin — CONFIRMED CORRECT (constant unchanged, now proven rather than assumed). Per-character-class offset — CLOSED, no font-derived basis exists; not pursued further.**

**WHY:** Every claim traces to a directly-run test against the real committed font file's own raw bytes (table presence, glyph IDs, ink bboxes, vmtx origins) — no offset, ratio, or table-presence claim was asserted without a passing test reading real bytes first. The one prior unverified claim in this task's own draft code (`fontMetrics.ts`'s header comment doubting vhea/vmtx trustworthiness) was caught and corrected with real evidence before being left standing.

**NEXT:** None required by this round's own scope. A future ink-centroid-based visual-balancing investigation (§9 of the evidence doc) would need a separate Human/Product decision to authorize — not started here. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — OpenType Vertical GSUB Audit (2026-09-07)

**HUMAN HOLD (round 6):** small kana and punctuation both remain HOLD despite the round-5 finding that vmtx-derived vertical origin was correct and uniform — that fix did not resolve the visual failures. Explicit instruction: do NOT continue baseline/origin tuning, do NOT create more offset candidates; instead audit whether Shippori Mincho relies on OpenType GSUB `vert`/`vrt2` glyph substitution that jsPDF never applies.

**FIRST — RECORDED THE CORRECT PRIOR CONCLUSION:** vmtx/vhea vertical-origin correctness is confirmed and unchanged; that model was NOT the root cause of the remaining visual failures. Small kana and punctuation are NOT marked PASS by this round.

**AUDITED THE ACTUAL FONT'S GSUB TABLE, not assumed:** built `gsubReader.ts` (a minimal GSUB reader — ScriptList/FeatureList/LookupList traversal, full SingleSubst Format 1+2 resolution via Coverage tables, one-level Extension-Substitution unwrap; any other lookup type recorded, not resolved) and ran it against the exact committed Shippori Mincho Regular TTF. **Result: GSUB is present, and BOTH `vert` and `vrt2` features exist** (408 and 667 SingleSubst substitution entries respectively, both LookupType 1 only). Resolved real glyph-ID substitutions for every required character (small kana both hiragana/katakana, ordinary kana control set, punctuation, dash, ellipsis, uncovered ！？：；).

**KEY FINDING — root cause confirmed, broader than originally framed:** every small-kana character (っゃゅょ + katakana equivalents) has a real, distinct `vert`/`vrt2` glyph alternate the current paint path never selects. **Discovered while building the control set: this is not small-kana-specific — ordinary hiragana つ/た ALSO get distinct vertical alternates, while ordinary kanji 日 gets none.** The font's real convention is "all kana get a redesigned vertical glyph; kanji generally doesn't" — recorded honestly, broader than this round's own framing. **Punctuation: GSUB confirms the EXISTING manual Unicode-presentation-form mapping already selects the identical glyph for all six of 、。「」（）** — no change needed there. **Ellipsis: same — already correct.** **Dash: a real, previously-unknown discrepancy** — GSUB's own vertical alternate for ― differs from the manually-mapped U+FE31 glyph; recorded, not acted on (Dash's P3-O04 semantic policy is not reopened).

**HARD TECHNICAL GATE FOUND:** built `findCodePointForGlyphId` (reverse cmap scan, both format 4 and format 12) to check whether ANY of these GSUB-selected alternates are reachable through some other Unicode code point jsPDF's `text()` API could paint. **None of the 8 kana alternates, and not the dash's own alternate either, are reachable through any code point this font's cmap defines** — sanity-checked against a known-reachable code point to prove the lookup mechanism itself works. jsPDF has no glyph-ID-addressed paint primitive (confirmed exhaustively in a prior task). Checked whether the 9 unreachable target glyphs are at least simple (not composite) outlines — confirmed all 9 are simple — but painting a decoded TrueType simple-glyph outline as a real PDF vector path still requires, from scratch: contour/flag/delta-coordinate parsing, on/off-curve classification with implied-midpoint reconstruction, quadratic-to-cubic Bézier conversion, a new `PaintCommand` variant threaded through the existing pure/jsPDF-free paint-plan architecture, and a genuinely new visual-correctness verification bar. **Judged substantial new machinery — STOPPED per this round's own explicit instruction, no implementation attempted.**

**DEPENDENCY GATE: a real fork in the road, not silently defaulted either way.** jsPDF's own `moveTo`/`lineTo`/`curveTo` ARE sufficient (confirmed present in its type surface) — no new PDF engine is needed regardless. The open choice is hand-rolled outline decoder (real but bounded, first-time codebase machinery, real risk of subtle visual bugs) vs. a library (`opentype.js` or equivalent) that already implements decode+GSUB+path generation. Not decided here — a genuine Human/Product decision, explicitly flagged, no dependency installed.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md` (full 14-section record). 9 new tests (GSUB presence/parse/determinism/malformed-input, full substitution resolution + manual-mapping comparison, paint-capability reverse-lookup, dash discrepancy, outline-kind audit). No production paint code changed — `gsubReader.ts`/`findCodePointForGlyphId` are audit-only, not wired into any paint path. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 103/103 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: Root cause IDENTIFIED (GSUB vertical glyph substitution, unreachable via jsPDF's text API). Small kana: HOLD (root cause known, fix requires new machinery/dependency decision). Punctuation: glyph SELECTION confirmed already correct by GSUB cross-check, but the original visual complaint is NOT re-tested/re-claimed-fixed since no paint change was made — HOLD stands. Ruby: untouched, still FROZEN PASS. No implementation, no new dependency, no PDF regenerated this round.**

**WHY:** Every claim traces to a directly-run test against the real committed font's own raw GSUB/cmap bytes — no substitution, reachability, or outline-kind claim was asserted without a passing test reading real bytes first. The STOP decision itself traces directly to this round's own explicit "if substantial, STOP and report" instruction, applied honestly rather than attempting a rushed, undertested outline decoder to appear more complete.

**NEXT:** Human/Product decision required: hand-rolled outline decoder vs. font-shaping dependency (`opentype.js` or equivalent) for the confirmed-unreachable kana/dash vertical alternates; scope should cover ALL kana (not just the originally-flagged small-kana set, per the broader finding above) once a path is chosen. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — OpenType Outline Paint (2026-09-07)

**HUMAN/PRODUCT DEPENDENCY DECISION (round 7):** APPROVED adding `opentype.js` for Publication Renderer font-outline access, ONLY as a glyph-outline resource (never a Core measurement/shaping/line-breaking/tokenizing authority, never a Preview dependency). Explicit instruction: keep the round-6 `gsubReader.ts` as the deterministic source-glyph→vertical-glyph authority, do not rewrite it; do not depend on `toPathData()` string serialization, use structured `path.commands` directly; document and test any Q→C conversion.

**INSTALLED:** `opentype.js@2.0.0` (MIT) + `@types/opentype.js@1.3.10` (moved to `devDependencies`, matching this repo's existing `@types/file-saver`/`@types/jszip` convention) — via `npm install`, minimal `package.json`/lockfile diff, no other dependency touched.

**PoC PROVEN (`verticalOutlinePaint.test.ts`):** the real committed Shippori Mincho asset parses with `opentype.js`; glyph 15477 (っ's own GSUB `vert` alternate, from round 6) retrieves by ID; its real outline exists (`["M","Q","L"]` commands, non-empty); its bbox reads correctly; every `Q` (quadratic) command converts losslessly to an equivalent cubic `C` via the standard degree-elevation formula `C1=P0+2/3*(Q1-P0), C2=P2+2/3*(Q1-P2)` — verified against a hand-computed synthetic case AND against every real `Q` command opentype.js emits for all 9 unreachable target glyphs (8 kana + Dash's own alternate — Dash's happened to contain zero `Q` commands, a pure straight-line shape, handled by the same code path without special-casing).

**BRIDGE:** `opentype.js`'s own `Glyph.getPath(x,y,fontSize)` already performs translation/scale/Y-flip when `x`/`y`/`fontSize` are passed directly in mm (confirmed by reading its own source, not assumed) — reused as-is rather than hand-deriving the same math again. `renderPaintPlanToPdf` maps the resulting `M`/`L`/`C`/`Z` commands directly onto jsPDF's own lower-level path plugin (`moveTo`/`lineTo`/`curveTo`/`close`/`fill`, confirmed present in its own dist source) — multiple glyph contours accumulate into one path before a single `fill()` call, letting PDF's native nonzero-winding rule handle enclosed counter-shapes correctly.

**INTEGRATION (`verticalOutlineIntegration.test.ts`):** a new `VerticalOutlineContext` (parses GSUB + the opentype.js Font exactly once per render, memoizes per-glyph resolution) decides, per grapheme, "text" (unchanged) vs. "glyphOutline" (new) — wired into `verticalGraphemeCommands`/`unitCommands`/`buildPaintPlan`/`generatePublicationPdf`, all backward-compatible (every existing call site without an `outlineContext` is byte-for-byte unaffected). Confirmed: small kana (っゃゅょ etc.) AND ordinary kana (つ/た — the broader, not-small-kana-only finding from round 6) now paint via real outline; punctuation (「」、。) and Ellipsis (…) correctly stay on the existing "text" path (GSUB already matches the manual mapping — round 6's own finding, reconfirmed here); ordinary kanji unaffected; Dash's real GSUB alternate (glyph 15901) now supersedes the old manual U+FE31 substitute for the guaranteed 2-glyph "――" run, with no geometric bars reintroduced and P3-O04's own scope untouched. Canonical `PublicationDocument` coordinates and `LogicalUnit`/`SourceSpan` proven byte-identical with or without an `outlineContext`.

**QA ARTIFACTS:** `small-kana-gsub-outline.pdf`, `punctuation-gsub-outline.pdf`, `dash-gsub-outline.pdf` (new, focused), and `publication-typography-qa.pdf` regenerated with the outline context threaded through (only after all 33 new tests passed). Punctuation's original `。→」` visual-gap complaint was NOT re-judged this round — no punctuation paint mechanism changed (glyph/position were already correct per rounds 5–6), so per this round's own instruction, if the gap persists after Human review it should be recorded as a separate yakumono/punctuation-spacing question, not a glyph-position bug.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_OPENTYPE_OUTLINE_PAINT.md` (14-section record). 33 new tests (19 PoC/unit + 14 pipeline integration), all passing before any QA artifact was generated. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 136/136 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: Outline path — PASS (mechanism proven end-to-end, real font data, real vector paint, zero Core/Preview/src changes). Small kana — READY FOR HUMAN RECHECK. Punctuation — READY FOR HUMAN RECHECK (glyph/position unchanged from round 5–6's already-correct state; recheck is to confirm the combined artifact, not because anything about punctuation's own treatment changed). Dash — READY FOR HUMAN RECHECK (now painting the font's real GSUB alternate, not the superseded manual mapping). Ruby: untouched, FROZEN PASS. P3-O08: IN PROGRESS. Not ready for JPG/grayscale.**

**WHY:** Every claim traces to a directly-run test against real font bytes/real opentype.js output/real jsPDF path-plugin source — no coordinate-transform, curve-conversion, or paint-routing claim was asserted without a passing test. The dependency itself was added only after explicit Human/Product approval, scoped exactly as instructed (glyph-outline resource only), with the pre-existing GSUB authority reused unmodified rather than rebuilt.

**NEXT:** Human Visual QA of the four regenerated PDFs (small kana, punctuation, dash, combined). Master is not modified. Phase 3 is not closed. `src/`, Production, and the root `vitest.config.ts` remain fully untouched. `package.json`/lockfile changed ONLY as explicitly approved (`opentype.js` + its types). No push, no deploy.

---

## P3-O08 — Yakumono (Punctuation-Pair) Spacing (2026-09-07)

**HUMAN VISUAL QA (round 8):** Ruby PASS (frozen). Small kana PASS (round 7's real GSUB outline paint closed it). Dash PASS (same). Punctuation (`。→」`) remains HOLD — explicit instruction to STOP local Renderer offset tuning and audit Japanese yakumono advance/spacing at the CANONICAL layer instead, since glyph identity/GSUB/vhea-vmtx origin/outline paint were all already proven correct across four prior rounds.

**CANONICAL AUDIT (real, not guessed):** direct code read of `core/compose/line.ts`'s `advanceTickFor` confirmed the root cause: every TEXT character — punctuation included — receives the exact same full 1-em canonical advance, with ZERO adjacency-based adjustment. `。→」`'s start-to-start distance was exactly one full cell, identical to any ordinary character pair. Root cause: CANONICAL SPACING, proven from code, not inferred.

**RULE EVIDENCE:** no FROZEN Phase-3 rule-freeze document (Kinsoku, Dash/Ellipsis, Freeze Matrix) addresses punctuation-pair spacing/advance — confirmed by direct audit. But this project's own cached primary-source research, `research/phase3/source-cache/jlreq/punctuations_in_different_sizes.md` (小林敏, 2021, JIS X 4051/JLReq-sourced), read directly this round, DOES define the exact rule needed: adjacent 括弧類等 (opening/closing brackets, periods, commas — jlreq explicitly groups punctuation WITH closing brackets for this purpose) in cases a/b/c (same font size — covering `。」` exactly, jlreq's own case "c") should have their combined gap reduced to a single half-em by removing one side's own built-in half-em blank, rather than stacking two half-em blanks into a full em. Unlike ruby overhang (genuinely multiple competing conventions), this is a single, well-established value for the same-size case — evidence supports adjustment, not ambiguous.

**CORE CHANGE (authorized by this round's own Core Change Gate, since canonical spacing was proven wrong):** `RuleSetVersion` gained a new frozen, DATA-DRIVEN field `yakumonoSpacingScope` (`characterClass.ts`), populated as `["cl-01","cl-02","cl-06","cl-07"]` in `defaultRuleSet.ts` — reusing the EXISTING character-class infrastructure (no new classification concept, no `if (char === "。")` special case). `core/compose/line.ts` gained `applyYakumonoCompression`, halving the PREVIOUS atom's own `advanceTick` when both it and the atom about to be placed have a leading/trailing character in scope. **A real bug was caught and fixed during implementation** (not shipped): `advanceTick` is the space AFTER an atom, not before it — a first draft compressed the wrong (current, not previous) atom and produced zero measurable effect, caught immediately by a failing test. Source/SourceSpan: unchanged (proven). Natural Pitch stretch: not introduced (this only ever shrinks specific pair advances, INV-004 intact).

**BREAK CONSEQUENCES:** full regression shows zero existing test broke — no pre-existing fixture in this project happened to place a yakumono pair at a break-critical position. Kinsoku legality itself untouched (only the advance FED INTO the unmodified break algorithm changed); a dedicated test confirms `、`/`。`/`」` still never start a line under a tight forced-break extent.

**PARITY:** Preview and Publication both consume Core's own `PlacedUnit.yTick`/`xTick` with zero renderer-side spacing logic of their own — both automatically reflect the corrected canonical positions with no additional code (confirmed directly for Publication via a new test measuring the real compressed pitch in a real `PublicationDocument`).

**QA:** `yakumono-spacing-qa.pdf` (new, focused, real font/geometry/GSUB-outline pipeline) + `publication-typography-qa.pdf` (regenerated, automatically reflects the fix).

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_SPACING.md` (10-section record). 18 new tests (16 Core + 2 Publication). Full regression: Core 380/380 (364+16), Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 138/138 (136+2) — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: YAKUMONO SPACING — READY FOR HUMAN RECHECK.** Ruby/small kana/Dash: recorded PASS, not reopened. P3-O08: IN PROGRESS. Not ready for JPG/grayscale.

**WHY:** Every claim traces to a direct code read (the root-cause proof), a directly-read primary source (the rule evidence, not memory/assumption), or a passing test against real composed output (the fix itself, including catching and correcting a real implementation bug via a failing test before it shipped) — no numeric value was invented; the half-em compression factor comes from the cited jlreq/JIS X 4051 source, not a guess.

**NEXT:** Human Visual QA of `yakumono-spacing-qa.pdf` and the regenerated combined PDF — does `。→」` now read as normal Japanese vertical typesetting? Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Glyph-Size Regression Fix (2026-09-07)

**HUMAN QA (round 9):** the round-8 yakumono spacing fix produced a real Publication bug — `。`/`」` painted at ~50% of normal body font size (~5.25pt vs ~10.5pt), not merely closer together. Explicit instruction: do not revert round 8's canonical spacing; find and fix the actual glyph-size defect.

**ROOT CAUSE (confirmed by direct code read, not guessed):** `renderer/publication/paintModel.ts`'s `buildPaintLine` derives each `PaintPlacedUnit.heightMm` as `next.yTick - placed.yTick` — this atom's own canonical ADVANCE, a positioning quantity. `pdfGenerator.ts` then reused this SAME value, unconditionally, as the basis for the painted glyph's own FONT SIZE for TEXT/RUBY-base/DASH/ELLIPSIS. Before round 8 this was harmless (every atom's advance was uniformly 1em, so advance and font size were numerically identical by coincidence); round 8's legitimate compression of specific adjacent-pair advances broke that coincidence, shrinking the compressed atom's own glyph too.

**FIX:** `PublicationDocument` gained `bodyEmMm` — a fixed, document-wide body-em-in-mm value derived from `ctx.linePitchTicks` (a declared `LayoutSettings` constant, never a per-atom composed/compressed advance), computed once in `buildPublicationDocument`. `pdfGenerator.ts`'s `unitCommands` now derives every glyph's own font size from `doc.bodyEmMm` exclusively, for every kind (TEXT, RUBY base+annotation, DASH, ELLIPSIS) uniformly — no per-character special case. `unit.heightMm` remains used ONLY for positioning (atom location, per-grapheme Y-stepping within a multi-character atom) — advance and paint-em are now fully decoupled, matching the round's own explicit architectural instruction.

**VERIFIED:** `renderer/publication/glyphSizeIndependence.test.ts` (14 new tests) proves every character in the round-8 fixture — including the compressed `。`/`」` pair — shares the identical `fontSizePt`, equal to the document's own declared body em; that round 8's spacing compression remains fully active (not reverted); that source/SourceSpan/canonical coordinates are unaffected; and that Ruby/Dash/Ellipsis/TCY each independently paint at the correct fixed size. Two small existing test-fixture object literals (`PublicationDocument` HOLD stubs in `fontPoc.test.ts`/`paintModel.test.ts`/`typography.test.ts`) needed a `bodyEmMm` field added — mechanical, no behavior change.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_SPACING.md` §11 (appended, not a new file — same investigation thread). Full regression: Core 380/380 (unchanged — Publication-only fix, zero Core files touched), Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 152/152 (138+14) — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: GLYPH SHRINK BUG — FIXED.** Yakumono spacing (round 8's own canonical compression) — STILL ACTIVE, READY FOR HUMAN RECHECK now that the glyph-size defect is resolved. Ruby/small kana/Dash: unaffected, still recorded PASS. P3-O08: IN PROGRESS. Not ready for JPG/grayscale.

**WHY:** The root cause traces to a direct read of `paintModel.ts`'s own `heightMm` derivation, not a guess; the fix traces to a principled separation (advance vs. paint-em) the round's own instructions explicitly called for, verified by 14 new tests before being called done — including a determinism check that round 8's own spacing compression is still in effect, so this round did not silently regress the previous one while fixing this one.

**NEXT:** Human Visual QA of the regenerated `yakumono-spacing-qa.pdf`/combined PDF — glyphs should now read at normal body size with the `。→」` spacing still visibly tighter than an ordinary pair. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — OpenType Vertical GPOS Audit (2026-09-07)

**HUMAN QA (round 10):** round 9's glyph-size fix confirmed correct, but `」` now visibly intrudes into the preceding sentence-end area — round 8's advance-only compression was incomplete. Explicit instruction: audit the real Shippori Mincho GPOS table for `vhal`/`vchw` vertical positioning data before any further tuning; do not add another arbitrary renderer-local offset.

**GPOS AUDIT (real, `gposReader.ts` — new, mirrors `gsubReader.ts`'s architecture, not a rewrite of it):** `vhal`/`vchw`/`valt` are confirmed ABSENT in this font. The only real vertical positioning feature present is `vpal` (Proportional Alternate Vertical Metrics, 446 real per-glyph Single Adjustment values). Resolved against the correct POST-GSUB `vert`-substituted glyph IDs (cross-checked against the already-frozen round-6 GSUB audit): `。`/`」` (the reported pair) have near-zero YPlacement — their own ink was already correctly positioned, the round-8 advance compression alone was nearly right for them. **`「`/`（` (opening marks) have a LARGE real YPlacement (+527/+623 font units, over half an em)** — this, never applied anywhere before this round, is the real root cause of the reported intrusion: `「` is the very first character of the fixture, and its own un-repositioned ink collided with the now-correctly-compressed following content.

**ROOT CAUSE CLASSIFICATION: C — Both**, precisely: round 8's WHEN (jlreq pair-adjacency rule) remains correct and font-agnostic; what was missing was the HOW (real font-derived ink placement), never sourced from actual font data. Round 8's flat 0.5em advance is KEPT, not replaced with per-font real values — using real per-glyph `vpal` YAdvance for CANONICAL advance would mean re-deriving Core's own measurement from font metrics, directly conflicting with the FROZEN Natural Pitch invariant (Core Contract §18, re-confirmed, not reopened).

**FIX (Publication-only, real font data, zero Core changes):** new `verticalGposPaint.ts`'s `VerticalGposContext` resolves each grapheme's real `vpal` YPlacement (via the existing GSUB substitution map, reused not re-derived) and applies it as a small paint-time Y nudge — scaled by the atom's own real `bodyEmMm`-derived font size (round 9's fix, never the atom's own possibly-compressed `heightMm`), applied uniformly to both "text" and "glyphOutline" paint mechanisms, for every grapheme unconditionally (harmless where the real value is near-zero). No YAdvance used — only YPlacement, keeping this strictly a paint-time ink correction, never a canonical-layout change.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_GPOS.md` (11-section record). 11 new tests (6 GPOS audit + 5 pipeline integration). `yakumono-spacing-qa.pdf` and the combined `publication-typography-qa.pdf` both regenerated with the real GPOS-derived ink placement. Full regression: Core 380/380 (unchanged, zero Core files touched), Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 163/163 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: root cause identified and fixed with real font data, not tuning. YAKUMONO — READY FOR HUMAN RECHECK.** Ruby/small kana/Dash: unaffected, still recorded PASS. P3-O08: IN PROGRESS. Not ready for JPG/grayscale.

**WHY:** Every claim traces to a directly-run test against the font's own raw GPOS bytes, cross-checked against the already-frozen GSUB substitution map from round 6 — no YPlacement value was invented or tuned; the architecture split (Core owns WHEN via jlreq, Publication owns HOW via real vpal data) directly follows this round's own explicit instruction not to collapse a font-agnostic policy rule and a font-specific metric into one constant.

**NEXT:** Human Visual QA of the regenerated PDFs — does `「今日は、雨だった。」` now read as ordinary Japanese vertical typesetting, with no `」` intrusion? Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Yakumono Half-Body Canonical Model (2026-09-07)

**HUMAN QA (round 11):** round 10's real GPOS `vpal` ink-placement fix made no visual difference — `。`/`」` still collide. This proved the defect was not a rendering/paint-mechanism gap at all (four independent rounds — glyph identity, vhea/vmtx origin, GSUB substitution, real GPOS ink placement — had all already been proven correct or ineffective in turn) — it was the CANONICAL MODEL itself. Explicit instruction: retire round 8's "full-em body + negative pair adjustment" model entirely, not tune it further.

**RETIRED, PROVEN WRONG BY RE-READING BEFORE DELETION:** `applyYakumonoCompression` (round 8) gave every TEXT atom a full 1em body unconditionally, then subtracted 0.5em from a PAIR after the fact. The old `core/compose/yakumonoSpacing.test.ts` (16 tests asserting this model's own numeric values) was deleted, not preserved for compatibility — re-running it against the new code first, to prove its assertions really were wrong under the new model (not merely different), produced exactly the expected `3528 vs 1764`-style failures.

**NEW MODEL:** jlreq's 括弧類等 classes (cl-01/02/06/07) have an INTRINSIC half-em canonical body (`RuleSetVersion.yakumonoHalfBodyScope`, renamed from `yakumonoSpacingScope` — a semantic change, not a rename for its own sake), unconditionally — never a full em that gets negatively adjusted. An ADDITIONAL, EXPLICIT half-em side space (`yakumonoSpaceAfterEm`) is added only in specific adjacency contexts, computed via a single, data-driven function that REUSES the existing `mayStartLine`/`mayEndLine` kinsoku class flags — no new class concept, no hardcoded literal characters. Verified against every worked numeric example this round's own task text gave explicitly (`た。次` → period gets body+trailing-space=1.0em total; `た。」` → period's trailing space is suppressed because next is also in scope, so `。`+`」` together total exactly 1.0em, not 1.5em) — both matched exactly once the space-suppression condition was corrected (a real bug in the first draft, caught by re-checking against the task's own worked examples before shipping, not merely by tests passing).

**REPORTED SYMPTOM RESOLVED AT THE MODEL LEVEL:** `。`'s own advanceTick under the new model = body(0.5) + 0 (suppressed, next=`」` in scope) = exactly half a cell — no inserted inter-space, no negative-overlap arithmetic anywhere.

**FONT INDEPENDENCE PRESERVED:** the 0.5em canonical values are NOT derived from Shippori Mincho's own real `vpal` metrics (period ≈0.40em, closing bracket ≈0.48em, measured in round 10) — Core's own composition stays font-agnostic, per jlreq's own allowance for different fonts implementing punctuation at different inherent widths. Round 10's real `vpal` YPlacement ink nudge remains valid, unchanged Publication paint data, orthogonal to which canonical model produced the cell it nudges within.

**GLYPH SIZE UNREGRESSED:** round 9's `bodyEmMm` fix needed no changes — Core has no font-size concept at all; the full 14-test `glyphSizeIndependence.test.ts` suite passes unmodified against the new Core model.

**ONE PRE-EXISTING TEST LEGITIMATELY UPDATED, NOT SILENTLY PATCHED:** `core/compose/page.test.ts`'s own Natural Pitch test (predates ALL yakumono work) incidentally used `「` as ordinary fixture text and baked in the old "opening bracket = full 1em" assumption — updated with a full explanation of why the new model correctly changes this specific pitch.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_HALF_BODY_MODEL.md` (16-section record, including two explicitly disclosed open policy questions: `cl-02+cl-01`/`cl-01+cl-01` adjacency, resolved by the documented class rule but with no worked numeric example given this round to confirm against; and cl-05/line-edge policy, left open). 27 new Core tests (`yakumonoHalfBody.test.ts`) + 2 new Publication tests (focused diagnostic QA + a direct canonical-pitch proof). Full regression: Core 391/391, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 165/165 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: canonical model corrected with real, disclosed, class-rule-driven logic — not tuned, not guessed. YAKUMONO HALF-BODY MODEL — READY FOR HUMAN RECHECK.** Ruby/small kana/Dash: unaffected, still recorded PASS. P3-O08: IN PROGRESS. Not ready for JPG/grayscale.

**WHY:** Every numeric claim traces to either a directly-run test against real `composeLine` output or a direct re-reading of this round's own task text's worked examples (both of which caught and corrected a real bug in the first draft of the space-suppression rule before it shipped) — no constant was invented or tuned by eye; the two genuinely open pair cases (cl-02+cl-01, cl-01+cl-01) are disclosed as open, not silently resolved and hidden.

**NEXT:** Human Visual QA of `yakumono-half-body-qa.pdf` (fixtures A-G + the original sentence) and the regenerated combined PDF. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Yakumono Legacy Parity Audit (2026-09-07, AUDIT ONLY)

**HUMAN DECISION (round 12):** STOP speculative v2-side theory iteration (rounds 8-11 each tried a different theoretical model — full-em+negative-adjustment, real GPOS ink placement, jlreq half-body — none matched). The legacy browser renderer already produces accepted Japanese vertical punctuation; empirically audit its own real, working mechanism instead of inventing another v2 model. Audit-only round, no implementation.

**DECISIVE FINDING, direct primary source (`src/components/PageCard.tsx` lines 29-49, dated TSP-LOOP-003 — an EARLIER, foundational fix than even the TSP-LOOP-029 hanging-punctuation work):** the legacy renderer's own header comment diagnoses the EXACT symptom this whole v2 chain has chased ("、。「」… ended up floating in the middle of their cell, ~0.5em away from the glyph they should hug") and documents its own real, MEASURED fix against real browser-native vertical text: **the canonical cell/slot/advance for punctuation is NEVER touched — only PAINT-TIME ink position, within an unchanged full-size cell, changes**, via a per-typographic-class CSS flex anchor (`justify-content: flex-start` for closing-type 、。「」』）etc., `flex-end` for opening-type「『（etc., `center` otherwise) plus a selective `"vpal" 1` re-enable (font's own real glyph shape) for just those characters — both applied within an absolutely-positioned, fixed-px-size container whose size is computed identically for every character, so structurally cannot be affected by either technique.

**PARITY MISMATCH CONFIRMED, not defended:** round 11's own half-body model (and round 8's before it) modifies Core's own CANONICAL advance for punctuation — legacy never does this at all. Marked explicitly: PRODUCT PARITY MISMATCH, regardless of round 11's own jlreq citations.

**COMMIT REGRESSION TRACE (from `git show --stat`, not assumed):** `4d4f6a2` is the sole origin of every canonical-layer punctuation change; `ad30d0a` is the only other commit touching it. `8ba41b5`/`8a9cf90`/`1469a83` are all confirmed Publication-paint-only, zero `core/` touched.

**SAFE ROLLBACK CANDIDATE (not performed):** revert Core's yakumono-specific pieces (`characterClassForAtom`/`bodyAdvanceTickFor`/`yakumonoSpaceAfterEm`/`yakumonoHalfBodyScope`) to pre-`4d4f6a2` uniform Natural Pitch, while preserving every later infrastructure commit (Ruby/small-kana/Dash/outline-paint/GPOS-ink-placement all independently confirmed unaffected by the revert, via the same commit trace).

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_LEGACY_PARITY_AUDIT.md` (12-section record). No tests added (audit-only, no implementation). No source file changed — confirmed via `git status --porcelain` showing only the new evidence file.

**DECISION: Yakumono — HOLD. Root cause and exact next task now known with high confidence (Publication-paint-only edge-alignment, ported directly from the working legacy mechanism, not re-derived from theory).** Ruby/small kana/Dash/TCY/Ellipsis/outline-paint: unaffected, still PASS. P3-O08: IN PROGRESS. Not ready for JPG.

**WHY:** Every claim traces to a direct read of the legacy source's own code and its own dated header comment recording a REAL, MEASURED browser observation — not re-derived jlreq theory. The commit regression trace is read from `git show --stat` output, not assumed from commit messages.

**NEXT:** Implement the Publication-paint-only edge-alignment fix (§11 of the evidence doc): revert Core's canonical yakumono advance model to uniform Natural Pitch; add a paint-time-only cell-edge alignment (closing-type toward cell start, opening-type toward cell end) within the unchanged full cell, composing with round 10's existing GPOS ink-placement infrastructure. Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Yakumono Legacy-Parity Paint Port (2026-09-08)

**IMPLEMENTATION of round 12's own audit recommendation.** Core's yakumono-specific pieces are RETIRED, not tuned further: `core/compose/line.ts`'s `computeAtoms` is back to the exact pre-round-8 form (`advanceTickFor` returns `perCellAdvance` unconditionally for every TEXT atom, zero character-class branching); `RuleSetVersion` no longer carries any yakumono-scope field. Core's own regression suite returns to **364/364 — the EXACT count before round 8 ever touched this file**, confirming a clean retirement back to an earlier, already-validated state.

**PORT, not re-derivation:** `renderer/publication/verticalYakumonoAlign.ts` (new) ports the already-working legacy renderer's own real mechanism VERBATIM — `HANG_START_TEST`/`HANG_END_TEST`, copied character-for-character from `src/components/PageCard.tsx:47,49`, classify each grapheme exactly as legacy does. The CSS `flex-start`/`flex-end` edge-anchor is translated into jsPDF's baseline-anchored paint model using REAL, already-measured per-glyph ink bounding boxes (`fontMetrics.ts`'s `glyphInkBBox`, round 5/7 infrastructure) — `baselineRatio = yMax/unitsPerEm` (HANG_START, flush ink-top to cell-top) or `1 + yMin/unitsPerEm` (HANG_END, flush ink-bottom to cell-bottom), both verified directly against independently-computed values from the real font, resolved against the ACTUAL painted glyph (post-presentation-form substitution) not the source character's own glyph.

**No double application:** round 10's real GPOS `vpal` YPlacement nudge is explicitly gated OFF for any grapheme this edge-alignment override applies to — legacy's own comment describes `vpal` as secondary to the edge-anchor fix, not a second correction to stack on top of it. Verified directly: a classified character's own `yMm` is byte-identical whether or not a `gposContext` is also supplied.

**No glyph scaling, no canonical mutation:** font size stays the fixed `bodyEmMm` (round 9) for every character; `PublicationDocument` is byte-identical with or without a `yakumonoContext` supplied — both verified directly.

**CLEANUP:** round 11's own test file (`core/compose/yakumonoHalfBody.test.ts`) deleted (round 8's own file was already deleted in round 11). One pre-existing `page.test.ts` assertion restored to its original pre-round-8 value. Round 8's and round 11's own Publication QA-generation test files (`yakumonoSpacingQa.test.ts`, `yakumonoHalfBodyQa.test.ts`) deleted — their own numeric assertions encoded the now-retired models — replaced by a single new `yakumonoLegacyParityQa.test.ts` generating `yakumono-legacy-parity-qa.pdf` (fixtures A-G + the original sentence, per this round's own required set).

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_YAKUMONO_LEGACY_PAINT_PORT.md` (12-section record). 21 new/rewritten tests (11 in `verticalYakumonoAlign.test.ts` + 10 in `yakumonoLegacyParityQa.test.ts`), 1 test in `glyphSizeIndependence.test.ts` rewritten to assert the new (uniform) invariant instead of the retired (compressed) one. Full regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 182/182 — all PASS; `npx tsc --noEmit` 0 new errors.

**DECISION: YAKUMONO LEGACY PARITY — implementation complete, READY FOR HUMAN RECHECK.** Ruby/small kana/Dash/TCY/Ellipsis/outline-paint/GPOS infrastructure: all preserved, unaffected. P3-O08: IN PROGRESS. Not ready for JPG.

**WHY:** Every claim traces to a direct re-read of the legacy source's own regex/mechanism (not memory), a real font ink-bbox computation independently verified against the context's own output, or a passing regression test. The Core retirement's own correctness is proven by an exact test-count match to the pre-round-8 baseline, not merely "tests still pass."

**NEXT:** Human Visual QA of `yakumono-legacy-parity-qa.pdf` (all 8 fixtures) and the regenerated combined PDF — does `「今日は、雨だった。」` now read as ordinary Japanese vertical typesetting? Master is not modified. Phase 3 is not closed. `src/` (read-only audited, never modified), Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

## P3-O08 — Small-Kana In-Cell Parity + Conditional 。/、→」 Spacing (2026-09-08)

**HUMAN FINDING (round 14):** round 13's real, font-grounded paint-edge-alignment port was still visually insufficient. Two distinct symptoms in "だった": (1) っ shows too much apparent space; (2) 。」/、」 are still too loose.

**PART 1 — small kana, AUDIT FIRST per explicit instruction.** Direct Grep of `src/components/PageCard.tsx` for every plausible small-kana term (`小さ|捨て仮名|拗音|促音|small.?kana|smallKana|ぁぃぅぇぉ|っゃゅょ`) found only two unrelated matches — legacy has **no small-kana-specific mechanism anywhere**, and small kana is confirmed absent from all three yakumono regexes already ported in round 13. Rules out classification C (nothing to port). Two new tests (`renderer/publication/smallKanaCellDebug.test.ts`) prove DIRECTLY — not by inference from `classifyYakumonoAlignment("っ") === "NORMAL"` — that っ's own painted `yMm` and its own real outline path commands are byte-identical whether or not round 13's `yakumonoContext` is supplied: commit `639c63f` provably changed nothing about っ. Rules out classification A (regression). A third test measures っ's real glyph ink-height fraction (`glyphInkBBox`/`unitsPerEm`) against だ/た's and finds it measurably smaller, at the identical uniform baseline anchor — the reported "extra space" is real, measured, and inherent to the glyph's own smaller drawn size within an unchanged, correctly-sized cell.

**DECISION: classification B — NO REGRESSION, pre-existing optical characteristic. No paint correction made.** QA-only `qa/publication/p3-o08/small-kana-cell-debug.pdf` generated (cell-boundary + real ink-bbox overlay for "だった"), never wired into normal Publication output.

**PART 2 — conditional cl-06/cl-07 → cl-02 pair suppression, IMPLEMENTED.** `core/compose/line.ts`'s `computeAtoms` gained one new, narrow, evidence-scoped function (`conditionalYakumonoPairAdvanceTick`): a cl-06/cl-07 atom immediately followed by a cl-02 atom (via `RuleSetVersion.characterClassFor`, the same generic data-driven lookup every other class-aware Core computation uses — no hardcoded character) loses its own trailing half-cell canonical advance. Explicitly distinguished from round 8/11's retired GLOBAL models by scope (one pair only) and by being tested, for the first time, IN COMBINATION with round 13's already-ported real paint-edge-alignment layer — the user's own stated rationale for why this attempt might succeed where the earlier standalone attempts did not.

**Controls verified:** `た。次`/`た、次` (ordinary text following 。/、) completely unaffected; `」次` (cl-02 followed by ordinary text) unaffected — rule only fires on the punctuation SIDE; `先「次` (cl-01) never a trigger; `。。` (two cl-06 in a row) never fires (next class must be cl-02); glyph `fontSizePt` unaffected for every character in the compressed pairs; っ completely unaffected (not cl-06/07/02); no source/SourceSpan mutation; deterministic.

**Round 13 tests updated, not deleted:** two assertions in `yakumonoLegacyParityQa.test.ts` and one in `glyphSizeIndependence.test.ts` had asserted uniform advance for the exact `。→」` pair this round intentionally changes — rewritten to assert the new, correct relationship (`cell - Math.round(cell * 0.5)` for that one pair, `cell` unchanged everywhere else in the same fixtures), preserving the underlying "ordinary adjacency stays uniform" audit intent.

**PRIMARY EVIDENCE:** `qa/evidence/P3_O08_SMALL_KANA_AND_CONDITIONAL_PUNCTUATION_ROUND14.md`. New tests: `core/compose/conditionalYakumonoPair.test.ts` (12), `renderer/publication/smallKanaCellDebug.test.ts` (6), `renderer/publication/targetedYakumonoQa.test.ts` (5). Full regression: Core 376/376 (364 + 12), Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 193/193 (188 + 5) — all PASS; `npx tsc --noEmit` 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error).

**DECISION: SMALL KANA — READY FOR HUMAN RECHECK (no code change, diagnostic only). `。」`/`、」` — READY FOR HUMAN RECHECK (real, narrow canonical-advance change).** Ruby/Dash/TCY/Ellipsis: unaffected, still PASS. P3-O08: IN PROGRESS. Not ready for JPG.

**WHY:** Every claim traces to a direct Grep/read of the legacy source, a test that compares actual paint-plan output byte-for-byte (not code-path inference), or a real `FontMetricsReader.glyphInkBBox` measurement against the committed font — never a guessed offset or an unverified assumption.

**NEXT:** Human Visual QA of `qa/publication/p3-o08/small-kana-cell-debug.pdf` (does the debug overlay confirm っ's cell is correctly sized, with the gap being empty ink area, not extra advance?) and `qa/publication/p3-o08/targeted-yakumono-qa.pdf`/`targeted-yakumono-cell-debug.pdf` (fixtures A-E — do `。」`/`、」` now read tight, with `。次`/`、次` unmoved?). Master is not modified. Phase 3 is not closed. `src/`, Production, `package.json`, the lockfile, and the root `vitest.config.ts` remain fully untouched. No push, no deploy, no new dependency.

---

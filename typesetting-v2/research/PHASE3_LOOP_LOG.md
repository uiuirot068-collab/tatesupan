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

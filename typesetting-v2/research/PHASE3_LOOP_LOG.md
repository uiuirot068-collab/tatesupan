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

No rejected hypothesis is silently reopened without new evidence, per the loop-engineering rule established in Phase 1/2.

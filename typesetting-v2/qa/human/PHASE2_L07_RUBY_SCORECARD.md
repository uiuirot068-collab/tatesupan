# P2-L07 — Ruby Annotation-Layer Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed. Base-position invariant confirmed YES (main axis unchanged, matches P2-L07's automated check). But the ruby ANNOTATION itself wrapped/broke instead of running as one continuous vertical unit — both short and long ruby judged UNNATURAL for this reason. See P2-L07B (`evidence/P2_L07B_UNBROKEN_RUBY.md`) for the fix.
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/visual-fidelity-comparison.html` → Feature C (Ruby). A "診断表示" toggle reveals the ruby annotation's bounds outline (off by default).
- Context: P2-L06 Human QA judged Ruby UNNATURAL — the main text shifted merely because ruby was present. P2-L07 rebuilt ruby rendering as a separate annotation layer (`position:absolute`, removed from normal text flow) so the base characters use byte-identical markup whether or not ruby is present. An **automated, deterministic check** (not a screenshot) built into the page itself compares base-character row positions WITH ruby vs. WITHOUT ruby (same prose) and reports **PASS**. A Human visual check is still needed to confirm this looks right, not just computes right.
- TCY, Dash, and Ellipsis remain explicitly **deferred to Phase 3** by Product Owner decision (P2-L06 freeze) — not addressed and not to be judged as blocking here.

---

## 1. Without ruby vs. with ruby

Do the main characters remain on the same axis? **YES.**

## 2. 東京 / とうきょう

Does ruby clearly belong to the whole base group (not just one character)? **NO** — the annotation wraps/breaks instead of reading as one continuous run.

## 3. Shift check

Does ruby's presence make the main text visibly shift? **NO** (invariant held).

## 4. Group ruby quality

**UNNATURAL** (wrapping annotation).

## 5. Long ruby (其 / なにがし)

**UNNATURAL** (wrapping annotation, worse for the long case — root cause traced in P2-L07B to the annotation box's height being sized from the BASE's cell count rather than the READING's own required extent).

## 6. Continue this ruby renderer direction?

**NO** (as shipped in P2-L07) — see P2-L07B for the fix and a repeat pass.

---

Any other observations: the base-position invariant itself is confirmed good — the remaining problem is purely in how the annotation's own box is sized, not in whether ruby displaces the body.

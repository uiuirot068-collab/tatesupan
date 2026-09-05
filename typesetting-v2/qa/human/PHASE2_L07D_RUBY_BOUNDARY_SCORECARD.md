# P2-L07D — Ruby Boundary Human QA Scorecard

- Status: **FROZEN 2026-09-05 — FINAL RUBY HUMAN QA PASS.** This closes the Ruby Architecture-Narrowing gate. See P2-L08.
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/visual-fidelity-comparison.html` → Feature C (Ruby). A live browser-side measurement panel under the 東京 example reports the ACTUAL rendered body-position delta (not just a code-level claim) the moment the page loads.
- **UPDATE (P2-L07E): the anomaly below was a display-only bug in the evidence table (`geomRow` was showing a stale binary check, not the real `placement` value) — the actual renderer was correct the whole time. Fixed and independently re-verified via `scripts/verify-ruby-boundary-policy.js`; see `evidence/P2_L07E_RUBY_BOUNDARY_AUDIT.md`. The geometry table in the shipped page now correctly shows START_CLAMP/CENTER/END_CLAMP.** Original note, for history: this loop's own geometry table showed all three boundary-test fixtures (其 at column-middle, column-start, column-end) reporting `CENTER`, when column-start and column-end were each expected to report `START_CLAMP`/`END_CLAMP`.
- Please also read the live "ACTUAL rendered body-position invariant" text under 東京 and report its verdict (PASS or FAIL) verbatim — this is a real, automatic, non-Human-judgment measurement, distinct from your own visual impression.

---

## 東京

- Ruby association natural: **YES**
- Body axis unchanged (per own eye AND live measurement panel verdict): **YES** — rendered delta: 東 main-axis 0.00px / cross-axis 0.00px; 京 main-axis 0.00px / cross-axis 0.00px.
- Placement natural: **YES**

## Boundary policy (CENTER / START_CLAMP / END_CLAMP)

- CENTER: **Human PASS**
- START_CLAMP: **Human PASS**
- END_CLAMP: **Human PASS**

## 其（なにがし）

- **Human PASS** — natural, body fixed.

---

## Overall

Ruby never wraps: **YES**

Body text never moves (per live measurement): **YES** (0.00px delta)

Continue with this CENTER/CLAMP policy? **YES** — this closes the Ruby Architecture-Narrowing gate (see P2-L08).

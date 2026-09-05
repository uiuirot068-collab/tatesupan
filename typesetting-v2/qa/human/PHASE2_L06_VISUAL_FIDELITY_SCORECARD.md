# P2-L06 — Visual Fidelity Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed. Result: Kinsoku/Hanging preferred/acceptable; Ruby UNNATURAL (main text shifts merely because ruby is present — a new, more specific defect than what the agent's own screenshot check caught); TCY/Dash/Ellipsis all judged not correct, but the Product Owner explicitly deferred those three to Phase 3 Renderer work rather than blocking this Phase 2 loop on them. Current renderer state: NOT publication quality; publication continuation in the current renderer state: NO. **This does not reject the C1-NATURAL logical architecture** — see P2-L07 (ruby annotation-layer fix).
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/visual-fidelity-comparison.html` directly in a browser (no server needed). Preset: A5 1段 (Human-preferred as C1-NATURAL in P2-L04). "診断表示" toggle reveals boundary/rule notes (off by default).
- **Known issue going in — please specifically check Feature D (TCY):** the "12"/TCY run did **not** visually combine into one horizontal unit in the full page as of P2-L06 (rendered as two stacked vertical digits instead), even though isolated minimal tests confirmed the underlying CSS mechanism (`text-combine-upright:all`) works correctly in the same browser. A follow-up loop (P2-L06B) narrowed the likely cause (the real page's column has an explicit CSS width the working isolated tests lacked) but did **not** complete or confirm a fix — status remains **OPEN**, logical model unaffected (confirmed PASS: source mapping, one-cell occupancy). Please report exactly what you see for Feature D; do not assume it is fixed. See `evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md` for the full root-cause trail.
- Kinsoku (Feature A), Hanging (Feature B), and Ruby (Feature C) were visually confirmed correct by the agent via screenshot before this scorecard was written (see loop log) — Ruby in particular now shows the base run grouped under ONE reading, fixing the P2-L05 "one-character-level" complaint.
- Dash/Ellipsis (Feature E/F) include a live, browser-side glyph-alignment measurement (not Human-perception-based) — read its on-page output directly; see `evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md` for what it measures and its own honesty caveat (numbers not independently re-confirmed after a layout bug fix made mid-loop).
- You are judging visual/structural plausibility, not final standards correctness — kinsoku table, dash/ellipsis rule, ruby overflow policy, and TCY threshold all remain OPEN.

---

## Kinsoku

**Preferred / acceptable.**

## Hanging

**Preferred / acceptable.**

## Ruby

**UNNATURAL.** Reason: the main/body characters must not shift merely because ruby is present. → Addressed in P2-L07 (`evidence/P2_L07_RUBY_ANNOTATION_INVARIANT.md`).

## TCY

**NOT CORRECT** — "12" is not horizontal and is displaced from the center axis. **Deferred by the Product Owner to Phase 3 Renderer work** — not resolved, not blocking this or the next loop.

## Dash

**UNNATURAL** — visually left-shifted. **Deferred by the Product Owner to Phase 3 Renderer work.**

## Ellipsis

**UNNATURAL** — visually left-shifted. **Deferred by the Product Owner to Phase 3 Renderer work.**

---

## Overall

Does C1-NATURAL (current renderer state) look publication-quality? **NO.**

Any visually broken feature? **Ruby (main-text-shift), TCY, Dash, Ellipsis** — see per-feature notes above.

Continue with C1-NATURAL (the logical architecture, not the current renderer)? **YES** — this freeze does not reject the C1-NATURAL logical architecture; TCY/Dash/Ellipsis are explicitly deferred to Phase 3, and Ruby is being addressed in P2-L07.

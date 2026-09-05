# P2-L07C — Overlong Ruby Centering Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed. 東京: centered placement visually NATURAL, ruby one run, whole-group association confirmed — **BUT body 東京 visibly moved on screen**, contradicting the P2-L07 code-level invariant. This is treated as a rendering issue requiring ACTUAL rendered-DOM measurement (not just logical-coordinate re-assertion) — see P2-L07D. 其: NATURAL, no regression. Multi-char overlong: NATURAL. Non-overlong control: correctly avoided centering. Human wants continued geometry-based conditional centering, gated on: (1) line-start behavior handled, (2) line-end behavior handled, (3) actual rendered body text confirmed not to move.
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/visual-fidelity-comparison.html` → Feature C (Ruby). A geometry table at the top of the section shows the computed baseExtent/rubyExtent/placement for each fixture — read it alongside the visual result.
- Context: P2-L07B fixed ruby wrapping but Human rejected its start-anchored-only placement for overlong ruby (其/なにがし), explicitly requiring a geometry-based rule (not a base-length==1 special case). P2-L07C implements: center when `rubyExtent > baseExtent`, else start-anchor. Verified generic via 4 fixtures (see evidence doc) — not independently screenshotted this loop.
- Note: 東京's reading turned out to be 5 characters (not 4 as assumed earlier), so it is actually an overlong/CENTER case, not the non-overlong control it was originally meant to be — a new fixture (本日/ほんじつ) was added as the genuine non-overlong control. This was caught and corrected this loop, not hidden.

---

## 東京（とうきょう）

- Ruby remains one run: **YES**
- Ruby belongs to whole base: **YES**
- Placement: **NATURAL** (centering itself) — **but body 東京 visibly moved on screen**, requiring rendered-DOM re-measurement (P2-L07D).

## 其（なにがし）

- Ruby remains one run: **YES**
- Ruby centered relative to 其: **YES**
- Body 其 unchanged: **YES**
- Placement: **NATURAL**

## 地図（ちけいずめん） — multi-character overlong ruby

- Generic CENTER rule triggered: **YES**
- Placement: **NATURAL**

## 本日（ほんじつ） — non-overlong control

- Unnecessary centering avoided: **YES**

---

## Overall

Body axis preserved across all four ruby fixtures? **NO for 東京 (visibly moved) — see P2-L07D for the rendered-DOM re-measurement.**

Continue with this conditional-centering rule? **YES, conditional on**: (1) line-start behavior handled, (2) line-end behavior handled, (3) actual rendered body confirmed unchanged.

Continue with this conditional-centering ruby rule? YES / NO —

Any other observations —

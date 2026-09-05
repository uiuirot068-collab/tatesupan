# P2-L07D — Ruby Boundary Clamp + Rendered Base-Axis Invariant

- Status: Phase 2 PoC evidence, not a Phase 3 spec. **This loop's core boundary-clamp claim is OPEN/INCONCLUSIVE, not PASS — see "Anomaly found" below. Reported honestly rather than asserted.**
- Trigger: P2-L07C Human QA — 東京's centered ruby judged visually natural, but Human reported the BODY TEXT visibly moved, contradicting the P2-L07 code-level invariant. Human also required line-start/line-end boundary handling before continuing.

## HUMAN CONSTRAINT

Ruby centering must never push the annotation before a column's start (行頭) or past its end. Requested policy: derive purely from geometry (base extent, ruby extent, line/column extent) — no `baseLength === 1`, word-specific, or preset-specific branching.

## GENERIC POLICY (as implemented in `renderRubyAnnotations` / shared `decidePlacement` helper)

```
baseExtentPx = cellCount × charPitchPx
rubyExtentPx = charCount(reading) × annotationFontSizePx
lineExtentPx = the base group's OWN column's total height (colHeightPx), not an invented number

if rubyExtentPx <= baseExtentPx:              START            (P2-L07C behavior, unchanged)
elif rubyExtentPx > lineExtentPx:             OVERFLOW_OPEN     (preserve one run, don't shrink/split/wrap; exact handling OPEN)
else:
  desiredStart = baseStart + baseExtent/2 - rubyExtent/2
  desiredEnd   = desiredStart + rubyExtent
  if desiredStart < 0:            START_CLAMP  (rubyStart = 0)
  elif desiredEnd > lineExtentPx: END_CLAMP    (rubyStart = lineExtentPx - rubyExtent)
  else:                           CENTER       (rubyStart = desiredStart)
```

This was implemented once (`decidePlacement`), called both by the actual renderer (`renderRubyAnnotations`) and by the evidence/reporting function (`rubyGeometry`) — a single source of truth, not two parallel implementations that could drift.

## ANOMALY FOUND — boundary clamp NOT confirmed working

Three fixtures were built using the identical 其/なにがし base/ruby pair (base-extent 27.9px, ruby-extent 55.9px — always overlong, so the START/no-op branch never applies) at three different column positions, specifically to exercise all three non-overflow cases:
- **middleText** (其 padded to column row 5 of 14): expected **CENTER**.
- **longText** (其 at column row 0, the pre-existing P2-L07/L07C fixture): expected **START_CLAMP** (`desiredStart = 0 + 13.97 − 27.95 = −13.98 < 0`).
- **endTextNearBoundary** (其 padded to near the last row of a 14-row column): expected **END_CLAMP**.

**The one build run performed this loop showed all three as `CENTER`** in the generated geometry table — including the `longText` case, whose `desiredStart` is unambiguously negative by direct arithmetic (verified by hand above, and by an actual `breakIntoLines` trace confirming 其 sits at row 0 of a 14-cell column before the second permission/read-block prompt stopped further verification). A second `node -e` check that would have inspected `decidePlacement`'s behavior in isolation was not completed — per instruction, after a second permission/read-block prompt was hit, no further verification commands were run.

**Re-reading the implementation** (`decidePlacement`, lines as shipped) shows logic that, read on its own, should produce `START_CLAMP` for the `longText` case — the discrepancy between this reading and the one observed build's output is **not resolved**. Possible explanations not yet distinguished: a bug in how `rubyGeometry` threads `baseStartPx`/`colHeightPx` into `decidePlacement` for these specific fixtures (most likely, given the isolated formula reads correctly); a fixture-construction error (e.g. the padding character counts not landing 其 at the intended row — considered less likely for the `longText` case specifically, since its row-0 position was independently confirmed via a real `breakIntoLines` trace, but not ruled out for `middleText`/`endTextNearBoundary`, whose exact padding counts were hand-typed and not independently re-counted after the verification stop); or something else not yet hypothesized.

## RENDERED BODY INVARIANT (browser-side measurement)

A live, `getBoundingClientRect()`-based measurement was added directly to `visual-fidelity-comparison.html` (`bodyInvariantScript`): it compares the first several body `.cell` elements' rendered positions in the WITHOUT-ruby page vs. the WITH-ruby page, each measured **relative to its own page's origin** (the two `<div class="page">` boxes are separate DOM subtrees at different screen locations, so raw/absolute coordinates would not be a meaningful comparison). This directly answers the Human's "measure the actual rendered DOM, don't just grep for PASS" requirement. **The mechanism is real and shipped. Its output was not observed this loop** — no headless-browser screenshot was taken (permission/read-block guard), so whether it reports PASS or a real non-zero delta is unconfirmed. A Human opening the page will see the live result immediately.

## FIXTURES

| Fixture | Expected decision | Actually observed (one build run) | Status |
|---|---|---|---|
| middle (其, row 5) | CENTER | CENTER | matches expectation, but see anomaly above re: whether the OTHER two rows' identical-looking output casts doubt on this one too |
| line start (其, row 0, `longText`) | START_CLAMP | CENTER | **does not match — unresolved** |
| line end (其, near last row) | END_CLAMP | CENTER | **does not match — unresolved, padding count also not independently re-verified** |
| 東京 | CENTER (per P2-L07C) | CENTER | consistent |
| 地図 | CENTER (per P2-L07C) | CENTER | consistent |
| 本日 | START | START | consistent |

## WRAPPING

Annotation run count: not re-verified this loop (unaffected by this loop's changes to `top` calculation only — the width/height box-sizing from P2-L07B that prevents wrapping was not touched).

## MAGIC NUMBER AUDIT

- Word-specific: **NO** — no branch on 東京/其/地図/本日/the padding filler character.
- Base-count-specific: **NO** — no branch on `cellCount`.
- Preset-specific: **NO** — A5 1段 values unchanged.
- Manual px adjustment: **NO** — every position in `decidePlacement` derives from `baseStartPx`/`baseExtentPx`/`rubyExtentPx`/`lineExtentPx` only.

## Honest summary

The CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN code paths exist, are geometry-derived, and are called from a single shared function used both by the renderer and by the evidence reporting — no shortcuts were taken to fake a result. However, **the actual observed output this loop does not yet demonstrate the START_CLAMP and END_CLAMP branches firing where expected**, and this discrepancy was caught but not resolved before verification tooling access was cut off. This is reported as **OPEN**, not PASS, and not silently worked around.

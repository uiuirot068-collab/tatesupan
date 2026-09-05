# P2-L07E — Ruby Boundary Decision Audit

- Status: Phase 2 PoC evidence, not a Phase 3 spec. **Root cause found, fixed, and independently re-verified this loop — the P2-L07D anomaly is resolved.**
- Trigger: P2-L07D reported all three boundary fixtures (其 at column-middle/start/end) resolving as `CENTER`, contradicting the expected `CENTER`/`START_CLAMP`/`END_CLAMP` split, with the discrepancy unresolved at the time.

## PURE POLICY TEST (`scripts/verify-ruby-boundary-policy.js`, imports the real `decidePlacement`, no reimplementation)

| Case | Expected | Actual |
|---|---|---|
| CENTER (baseStart=40, baseExtent=20, rubyExtent=30, lineExtent=100) | CENTER | **CENTER** |
| START_CLAMP (baseStart=0, baseExtent=10, rubyExtent=30, lineExtent=100) | START_CLAMP | **START_CLAMP** |
| END_CLAMP (baseStart=90, baseExtent=10, rubyExtent=30, lineExtent=100) | END_CLAMP | **END_CLAMP** |
| OVERFLOW_OPEN (rubyExtent=120 > lineExtent=100) | OVERFLOW_OPEN | **OVERFLOW_OPEN** |
| START, non-overlong (rubyExtent=20 <= baseExtent=30) | START | **START** |

**Policy logic correct: YES.** All five synthetic cases passed — `decidePlacement` itself was never wrong.

## COORDINATE SPACE

Both `lineStart`/`lineEnd` and `baseStart` are the same coordinate system: px offsets within one column, `0` = column top, increasing downward — `baseStartPx = rowIndex × charPitchPx` and `lineExtentPx = colHeightPx` (both computed the same way, from the same per-column cell-counting loop in `rubyGeometry`/`renderPage`). **Same coordinate system: YES.** This was never the problem.

## FIXTURE VALIDITY (re-run via `verify-ruby-boundary-policy.js`, real `rubyGeometry()`, real fixture text)

| Fixture | baseStartPx | baseExtentPx | rubyExtentPx | colHeightPx | desiredStart | desiredEnd | Condition expected | Condition actually true |
|---|---|---|---|---|---|---|---|---|
| MIDDLE | 139.70 | 27.94 | 55.88 | 251.46 | 125.73 | 181.61 | fits inside [0, 251.46] | **YES** |
| LINE START (`longText`) | 0.00 | 27.94 | 55.88 | 391.16 | −13.97 | 41.91 | desiredStart < 0 | **YES** |
| LINE END | 363.22 | 27.94 | 55.88 | 391.16 | 349.25 | 405.13 | desiredEnd (405.13) > lineEnd (391.16) | **YES** |

All three fixtures were genuinely valid — their numeric geometry actually satisfies the condition each was built to test, confirmed by direct computation, not assumed from prose position. **Fixture validity: YES for all three.**

## ROOT CAUSE (of the P2-L07D anomaly)

**Category E — the displayed "observed decision" was wired to the wrong data.** `buildRubySection`'s `geomRow` display function (added in P2-L07C, before `placement` existed as a field) still read `g.overlong ? "<b>CENTER</b>" : "START"` — a leftover **binary** overlong check from before P2-L07D introduced the boundary-aware `placement` field (`START`/`CENTER`/`START_CLAMP`/`END_CLAMP`/`OVERFLOW_OPEN`). Every overlong case therefore displayed `CENTER` regardless of what `decidePlacement` had actually decided. **The real renderer (`renderRubyAnnotations`) was calling `decidePlacement` correctly all along and was never affected** — this was purely a stale display formula in the evidence table, not a bug in the policy or the renderer.

## FIX

- Policy modified: **NO** (`decidePlacement` was correct from the start, per the pure policy test).
- Fixture modified: **NO** (all three fixtures' geometry was already valid).
- Coordinate normalization modified: **NO** (was already consistent).
- **Display bug fixed**: `geomRow` now reads `g.placement` directly instead of re-deriving a stale binary approximation.
- Magic number added: **NO**.

## RE-VERIFICATION (after the fix, real generated HTML, read directly — not grepped)

```
其/なにがし (middle)        -> CENTER
其/なにがし (longText/start) -> START_CLAMP
其/なにがし (end)            -> END_CLAMP
東京/とうきょう              -> START_CLAMP   (its base is ALSO at column-start, rowStart=0 — same
                                              reason as longText; this was previously mislabeled
                                              CENTER in P2-L07C's evidence, before boundary-awareness
                                              existed — that was correct for P2-L07C's simpler policy,
                                              not an error, but the P2-L07D/E policy now correctly
                                              clamps it too)
地図/ちけいずめん            -> START_CLAMP   (same reason — also at column-start)
本日/ほんじつ                -> START          (non-overlong control, unaffected)
```

All six match the geometry-derived expectation once the display bug is fixed.

## RENDERED BODY

The `getBoundingClientRect()`-based rendered-DOM body-invariant panel (added in P2-L07D) is unchanged and still shipped in `visual-fidelity-comparison.html`. **Its output was still not read this loop** (no headless-browser verification was used, per this loop's own scope — the fix above was confirmed entirely via a real Node script and direct file inspection, not a browser). Actual body invariant: **OPEN** — a Human opening the page will see the real number immediately.

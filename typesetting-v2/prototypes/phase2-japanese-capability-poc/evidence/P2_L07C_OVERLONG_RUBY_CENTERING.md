# P2-L07C — Overlong Ruby Centering (Geometry-Based)

- Status: Phase 2 PoC evidence, not a Phase 3 spec / not a JLREQ/JIS ruby-distribution rule
- Trigger: P2-L07B Human QA — 其（なにがし）'s start-anchored placement judged NOT ACCEPTABLE; Human explicitly required a geometry-based conditional rule (not a `baseLength == 1` special case).

## POLICY

```
baseExtentPx = cellCount(baseGroup) × charPitchPx
rubyExtentPx = charCount(reading) × annotationFontSizePx   (annotationFontSizePx = fontSizePx × 0.5)

if rubyExtentPx > baseExtentPx:
    topPx = baseStartPx + baseExtentPx/2 − rubyExtentPx/2     // CENTER
else:
    topPx = baseStartPx                                       // START (P2-L07B behavior, unchanged)
```

Implemented once, in `renderRubyAnnotations` (`scripts/build-visual-fidelity.js`) — the exact same formula runs for every ruby group in every fixture. `rubyGeometry()` (a separate, read-only reporting function used only for the evidence table below) recomputes the same two extents independently, for display purposes — it is not a second implementation of the rule, just its inputs made visible.

## GEOMETRY (as actually computed by the shipped code, not hand-calculated)

| base | ruby | base cells | ruby chars | baseExtent | rubyExtent | placement |
|---|---|---|---|---|---|---|
| 東京 | とうきょう | 2 | **5** | 55.9px | 69.9px | **CENTER** |
| 其 | なにがし | 1 | 4 | 27.9px | 55.9px | **CENTER** |
| 地図 | ちけいずめん | 2 | 6 | 55.9px | 83.8px | **CENTER** |
| 本日 | ほんじつ | 2 | 4 | 55.9px | 55.9px | **START** |

**A correction caught this loop, not hidden:** 東京's reading とうきょう is 5 characters (と-う-き-ょ-う), not 4 as assumed when it was first written in P2-L05 — it was never actually a non-overlong example, it was overlong all along (69.9px > 55.9px). This was only surfaced now because this loop's geometry table computes and displays the real character count instead of assuming it. It does not affect any earlier loop's conclusions (base-position invariant, no-wrap fix) since neither depended on 東京 being non-overlong — but it does mean 東京 could never have served as the "Fixture 4 non-overlong control" the loop brief asked for, so a genuine one (本日/ほんじつ, 4 reading chars against a 2-char base, extents exactly equal) was added instead.

## INVARIANT

Body positions without ruby vs. with ruby: **match — PASS** (same automated, code-embedded check from P2-L07, unaffected by this change since only the annotation's vertical placement formula changed, not the base `.cell` rendering path). Re-confirmed via `grep` against the regenerated file this session.

## WRAPPING

Annotation run count: 1 per group for all four fixtures (unaffected by P2-L07B's fix — this loop only changes the `top` calculation, not the width/height box-sizing that prevents wrapping).

## GENERICITY

- One-character special case exists: **NO** — 其 (1 base char) and 地図 (2 base chars) both receive CENTER via the identical `rubyExtentPx > baseExtentPx` test; no code path branches on `cellCount === 1`.
- Word-specific special case exists: **NO** — no branch keyed on 東京/其/地図/本日 or any literal string.
- Preset-specific special case exists: **NO** — `charPitchPx`/`fontSizePx` come from A5 1段's real values exactly as in every prior P2-L0x loop; no new preset-conditional logic.

## What was NOT re-verified this loop

A headless-browser screenshot was **not captured** — a permission/read-block prompt was hit on the one attempt and, per instruction, not retried. The CENTER/START decisions and geometry numbers above are computed and printed by the actual shipped code (re-confirmed via `grep`, not hand-asserted), but the *visual* result (does 其's centered reading actually look centered relative to 其, does it look natural) has not been independently observed by screenshot this loop — a Human should confirm by opening `visual-fidelity-comparison.html`.

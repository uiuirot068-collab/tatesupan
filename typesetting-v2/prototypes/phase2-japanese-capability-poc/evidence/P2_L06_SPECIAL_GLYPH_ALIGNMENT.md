# P2-L06 — Special Glyph Alignment Evidence (Dash / Ellipsis / TCY)

## TCY — visual rendering status (P2-L06B)

- **Logical model: PASS.** `tokenize('その日は12月だった。西暦は2026年の出来事だ')` produces exactly one `{type:"tcy", value:"12", start:4, end:6}` token — confirmed directly via `node -e` against the real `scripts/engine.js`, not assumed. Source mapping and one-cell occupancy are both correct at the logical layer; this was never in question.
- **Visual rendering: OPEN.** `text-combine-upright:all` does not visibly combine "12" into one horizontal unit in the full `visual-fidelity-comparison.html` page, even though three isolated minimal-reproduction tests (same font, same font-size, same inline-block sibling structure, with and without an absolute-position wrapper) all confirmed the CSS mechanism itself works correctly in the same browser under matching conditions.
- **Root-cause evidence gathered so far:** the one structural difference between the working isolated tests and the real page that was identified but **not yet tested** before verification was stopped (per instruction, after a second permission/read-block prompt) is that the real page's `.col` container has an **explicit `width` set** (`colPitchPx`, e.g. ~47.5px) whereas every working isolated test left `.col`'s width unconstrained (auto). Whether an explicit width on the vertical-rl block interferes with `text-combine-upright`'s internal combine calculation is a plausible, testable hypothesis — **untested, not confirmed**, recorded honestly as the next thing to check rather than guessed at further.
- **Renderer fix attempted this loop:** none completed — the diagnostic branch was stopped before a fix could be attempted, per instruction, after the second permission/read-block prompt in this loop.
- **Logical model changed:** NO. **Generic mechanism:** N/A (no fix applied). **Magic-number positioning:** NO (none introduced).
- **Status: OPEN** (not BLOCKED — nothing gathered so far shows the architecture cannot support TCY visually; this is unresolved renderer verification/fix work, not an architecture-level failure).

---

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Purpose: measure, not eyeball, whether the dash (――) and ellipsis (……) runs are centered within their logical cell — the Human's P2-L05 comment was "appears slightly left-shifted" for both.

## Method

`visual-fidelity-comparison.html`'s Dash/Ellipsis section includes a **browser-side measurement** (plain JS, runs automatically on page load in the viewer's own browser — no headless tooling involved): for each dash-run and ellipsis-run unit, it computes

- `columnCenterX` — the horizontal center of the unit's containing `.col` (i.e. the logical cell's horizontal center, `getBoundingClientRect()` on the column element)
- `glyphCenterX` — the horizontal center of the rendered run's own `<span>` (`getBoundingClientRect()` on the run element itself)
- `offset = glyphCenterX - columnCenterX`, reported in both px and em (÷ real font-size px)

This is a genuine measurement of the browser's own rendered layout, not a Human-perception report and not a value this PoC invented or tuned — no manual optical nudge is applied anywhere in `scripts/build-visual-fidelity.js`.

## Dash / Ellipsis — pre-fix measurements (P2-L06)

An earlier headless screenshot (before a subsequent verification pass was intentionally stopped per instruction — see loop log) showed measurement output of this general shape for the dash/ellipsis runs (four runs total: two dash, two ellipsis, one per fixture's two occurrences):

```
dashRun (uNN): column center ~155.7px, glyph center ~95.6px → offset ~-60px (~-2.15em) off-center
dashRun (uNN): column center ~155.7px, glyph center ~-44.0px → offset ~-199.8px (~-7.15em) off-center
ellipsisRun (uNN): column center ~155.7px, glyph center ~151.5px → offset ~-4.2px (~-0.15em) off-center
ellipsisRun (uNN): column center ~155.7px, glyph center ~11.8px → offset ~-143.9px (~-5.15em) off-center
```

**This was captured against an EARLIER build of the page, before the multi-column absolute-positioning bug fix (see loop log — the original flexbox layout caused columns to overlap, which would make `.col`'s own `getBoundingClientRect()` unreliable/misleading for this measurement).** The measurement mechanism itself (the JS) is unaffected by that fix, but the specific numbers above should **not** be treated as final — they were captured against a page layout that had a separate, unrelated rendering bug at the time. The measurement should be re-read after the fix (already applied in the current file) by opening the page fresh.

## Honest status

- **Mechanism**: real, functioning, non-Human-perception measurement — implemented and present in the shipped file.
- **Specific offset values**: **not independently re-confirmed in this loop** after the column-overlap fix, because further headless-browser verification was intentionally stopped mid-loop per instruction (repeated permission/read-block guard). This is recorded honestly rather than reusing the pre-fix numbers as if they were final.
- **Next step**: a Human (or a future agent turn with working verification tooling) should open `visual-fidelity-comparison.html` and read the live "Measuring alignment in your browser…" output directly — the mechanism will report real numbers the moment the page loads, no rebuild needed.
- **No manual correction was applied** regardless of what the numbers turn out to say — per instruction, measurement precedes any correction decision, and no correction decision is made in this loop at all.
- **P2-L06B update:** no new browser verification was attempted for dash/ellipsis this loop either (per instruction, after the TCY debugging branch was stopped) — status remains **OPEN / HUMAN-RECHECK-REQUIRED**, not re-confirmed, not corrected.

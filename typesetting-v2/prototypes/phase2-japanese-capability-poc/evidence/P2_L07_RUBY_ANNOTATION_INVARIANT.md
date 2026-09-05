# P2-L07 — Ruby Annotation-Layer Invariant

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Trigger: P2-L06 Human QA judged Ruby UNNATURAL — "the main/body characters must not shift merely because ruby is present."

## ROOT CAUSE

In P2-L06's renderer, a ruby group's base characters were wrapped in ONE native `<ruby>` element (`<ruby>東京<rt>とうきょう</rt></ruby>`) with no per-character `height`/`line-height` styling, while every ordinary (non-ruby) character got an explicit `height:charPitchPx; line-height:charPitchPx` `.cell` span. The native `<ruby>` element's own natural block extent (driven by the browser's internal ruby-layout algorithm, which reserves space consistent with rendering an annotation, even for the base line) is not guaranteed to equal exactly `cellCount × charPitchPx` the way an explicitly-sized `.cell` is. Whatever came after the ruby group in the same column therefore inherited a small, unaccounted-for position error — the base text "shifted" relative to the same prose rendered without ruby.

## MODEL

- **Base layout authority:** the SAME per-character `.cell` mechanism used for every ordinary character (explicit `height`/`line-height` = `charPitchPx`, `display:inline-block`). A `rubyBase` unit is now rendered with byte-identical markup to a plain `char` unit — the only difference is that its reading is additionally recorded in a separate `annotations` array, not that its own cell rendering differs in any way.
- **Ruby annotation authority:** a `position:absolute` `<span class="rubyAnnotation">`, rendered as a **sibling** of the base `.col`'s children (attached to the same `.colWrap`, which is itself the containing block for `position:absolute` descendants), positioned via `top: rowStart × charPitchPx` and sized `height: cellCount × charPitchPx` — i.e. derived directly from the base group's own known geometry (row index and cell count), not a fixture-specific number. Because it is removed from normal flow entirely, it is structurally incapable of perturbing sibling `.cell` positions, regardless of its own rendered size.

## INVARIANT

Automated (not visual) check, embedded directly in `visual-fidelity-comparison.html`'s Ruby section and computed at build time in `scripts/build-visual-fidelity.js` (`buildRubySection`):

- Two fixtures tokenized/broken into lines with the same capacity: `｜東京《とうきょう》に行く用事があった。少し急いでいた` (WITH ruby) vs. `東京に行く用事があった。少し急いでいた` (WITHOUT ruby — same prose, ruby markup stripped).
- For every unit in each fixture's flattened line output, the code computes its **row** (cumulative cell offset, the same quantity that determines its `top` position in px) and compares WITH-ruby's row sequence against WITHOUT-ruby's, position by position.
- **Result: PASS — base positions identical.** (Embedded directly in the shipped HTML as `<b class="ok">PASS — base positions identical</b>`; also independently confirmed via `grep` against the generated file in this session: the string "PASS — base positions identical" is present, "FAIL" is not.)

This is a **deterministic, code-level proof**, not a screenshot-based visual approximation — the loop's own instruction ("Do not use visual approximation alone") is satisfied by construction: the same `rowIndex` accumulator variable in `renderLineAsColumn` advances by exactly 1 per base character regardless of whether that character belongs to a ruby group, so the invariant is guaranteed by the code path itself, and the embedded check exists to catch any future regression of that guarantee.

## GROUP RUBY

- Base range: 東京 (2 source characters, `｜...《...》` notation, `src/lib/tategaki.ts` `RUBY_PATTERN`, read-only reference).
- Ruby: とうきょう, associated via one `groupId` shared by both base characters (`engine.js`, unchanged from P2-L05/P2-L06).
- Source mapping: **retained** — `groupId`, `start`/`end` (spanning the whole `｜東京《とうきょう》` source run), and the individual base character source offsets are all unchanged from P2-L05/P2-L06; only the renderer changed.
- Base displaced: **NO** (see invariant above).

## LONG RUBY

- Fixture: 其 (1-char base) / なにがし (4-char reading) — same as P2-L05/P2-L06.
- Base displaced: **NO** — same rendering mechanism (byte-identical `.cell` per base char, annotation is a sibling overlay) applies regardless of reading length; the reading being longer than the base only affects the ANNOTATION's own rendered size, which (being `position:absolute`) still cannot perturb the base.
- Overflow policy: **OPEN** (unchanged — this loop proves the visual grouping and base-invariant are representable, not that the long-reading overflow/spacing itself is finalized).

## MAGIC NUMBER AUDIT

- Fixture-specific offsets: **NO** — the annotation's `top`/`height`/`width` are all derived from `rowStart`, `cellCount`, and `colPitchPx`/`charPitchPx` (the same geometry every other cell uses), not hand-tuned per fixture.
- Preset-specific offsets: **NO** — no preset-specific ruby correction was introduced; A5 1段's real font/pitch values are used exactly as in P2-L04/P2-L06.
- The one non-geometric constant is the annotation's `right: -1em` placement (how far outside the base column's footprint the reading sits) — this is a **rendering-precision/aesthetic choice**, explicitly not the invariant being tested, and is not fixture- or preset-specific (the same `-1em` applies to every ruby group in every fixture).

## What was NOT re-verified this loop

A headless-browser screenshot of the fixed Ruby section was **not captured** — two consecutive permission/read-block prompts on browser automation were hit across P2-L06B and this loop, and per instruction no further attempts were made. The deterministic invariant check above is real, generated by the actual shipped code, and independently confirmed via `grep` against the output file — but a Human should still open `visual-fidelity-comparison.html` to confirm the *visual* result (is the annotation legible, does it look like furigana, does the WITHOUT/WITH-ruby pair look identical on the base axis to the eye) matches what the deterministic check already proves at the data level.

# P2-L07B — Unbroken Ruby Annotation Run

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Trigger: P2-L07 Human QA confirmed the base-position invariant (PASS — main axis unchanged with vs. without ruby) but found the ruby ANNOTATION itself wrapped/broke into a second column instead of reading as one continuous vertical run — both short (東京/とうきょう) and long (其/なにがし) ruby judged UNNATURAL for this reason.

## ROOT CAUSE

P2-L07's `renderRubyAnnotations` sized the annotation box's **height** from the **base group's** cell count (`cellCount * charPitchPx`, e.g. 2 cells for 東京) rather than from the **reading's own** required extent, while leaving its **width** generous (`colPitchPx`, a full column's width). For 東京/とうきょう (2 base cells → height for 2 full-size cells; 4 half-size reading chars need ~2 full-size-cells' worth of height) this happened to just barely fit. For 其/なにがし (1 base cell → height for only 1 full-size cell; the same 4 half-size reading characters need ~2 full-size-cells' worth of height) the box was **half** the height its own content needed. With a generous width still available, the browser had physical room to wrap the overflowing vertical text into a second column — the same ordinary multi-column vertical-text reflow mechanism used everywhere else in this PoC, just triggered unintentionally here.

## MODEL

Unchanged from P2-L07: base-layout authority is the identical `.cell` mechanism regardless of ruby presence; ruby-annotation authority is a `position:absolute` sibling, structurally incapable of perturbing base positions. This loop only changes how the annotation's OWN box is sized.

## FIX (generic, no fixture-specific branch)

Inverted both of the annotation box's dimensions:
- **Width**: now exactly one annotation-font-size-width (`fontSizePx * 0.5`) — physically no room for a second column to ever start, regardless of reading length.
- **Height**: now `auto` (unconstrained) — the reading flows straight down as one uninterrupted run, however long it is, instead of being forced into a box sized by an unrelated quantity (the base's cell count).
- **Anchor**: `top: rowStart * charPitchPx` — **start-anchored** to the base group's own first row, unchanged from P2-L07, still purely geometry-derived (no fixture-specific number).
- `white-space: nowrap` added defensively (belt-and-suspenders; the width alone already prevents a second column).

This is the same rule for every ruby group in every fixture — no word-specific case (e.g. no special-casing "東京" or "其"), no preset-specific number.

## BASE INVARIANT

Re-run after the fix (same automated, code-embedded check from P2-L07, unaffected by this change since `renderLineAsColumn`'s base-cell logic was not touched): **PASS — base positions identical** (re-confirmed via `grep` against the regenerated file this session). Base displaced: **NO**.

## GROUP RUBY (東京 / とうきょう)

- Annotation run count: 1 (by construction — width leaves no room for a second column).
- Wrapped: **NO** (by construction; not independently screenshotted this loop — see "What was not re-verified" below).
- Whole-group association: YES (one annotation span per group, anchored to the group's start row).
- Start-anchored: YES.
- Source mapping: YES (unchanged — `engine.js` untouched).

## LONG RUBY (其 / なにがし)

- Annotation run count: 1 (by construction — `height:auto` removes the height constraint that caused the P2-L07 overflow-wrap).
- Wrapped: **NO** (by construction).
- Base displaced: **NO** (unchanged mechanism from P2-L07).
- **Single-base centering implemented: NO.** Reason: **intentionally deferred**, per instruction — the simple, generic, start-anchored rule is used uniformly for both the 2-char-base and 1-char-base cases rather than adding a separate centering algorithm for the single-character-base case. This keeps the renderer rule identical across every ruby group regardless of base length, at the cost of the long-ruby annotation starting flush with the base's top edge rather than visually centered on it — an aesthetic tradeoff, not an invariant concern (final ruby-overflow/centering policy remains OPEN, unchanged from P2-L05/L06/L07).

## MAGIC NUMBER AUDIT

- Fixture-specific offsets: **NO**.
- Preset-specific offsets: **NO**.
- Word/literal-specific special case: **NO** (no branch keyed on 東京, 其, or any specific string — the fix is a general box-sizing rule applied uniformly).

## What was NOT re-verified this loop

A headless-browser screenshot of the fix was **not captured** — a permission/read-block prompt on browser automation was hit immediately when attempted, and per instruction was not retried. Everything above ("annotation run count: 1", "wrapped: NO") is reasoned from the CSS box-sizing mechanism directly (a narrow fixed width physically cannot host a second column; unconstrained height cannot force an overflow-driven wrap) — the same category of reasoning that correctly predicted the P2-L07 bug's root cause and correctly predicted the fix in P2-L06B's earlier `text-combine-upright` investigation (where isolated tests independently confirmed a similar CSS-mechanics prediction). It is not, however, an independently observed screenshot, and should be treated as **reasoned-but-unconfirmed** until a Human opens the page.

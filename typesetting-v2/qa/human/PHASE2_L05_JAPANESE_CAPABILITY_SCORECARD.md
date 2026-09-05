# P2-L05 — Japanese Typesetting Capability Human QA Scorecard

- Status: **FROZEN 2026-09-05 (first pass)** — Human QA found the diagnostic-box presentation insufficient to judge several features; a follow-up loop (P2-L06, `visual-fidelity-comparison.html`) builds a true vertical-page presentation before a second pass. This freeze approves *continuing development of the C1-NATURAL structure* — it does NOT approve the current diagnostic renderer as publication-quality presentation.
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/capability-comparison.html` directly in a browser (no server needed). A "診断表示" checkbox toggles rule-category highlighting (off by default).
- **Important — you are NOT yet judging final standards correctness.** The full kinsoku class table and the dash/ellipsis primary-source rule are still OPEN (Master, Phase 1). Judge structural/visual plausibility only: does the special element look coherent, is base/ruby association clear, does TCY read as one unit, does hanging look visually possible, are line breaks clearly controlled, are there obvious layout collapses? Do not judge whether a specific line-break is the "textbook correct" one yet.
- All fixtures use Shippori Mincho, the same font as every prior Phase 2 loop.

---

## Kinsoku sample (F-KINSOKU, F-LINE-END)

- Visually coherent? —
- Obvious collapse? —

## Kinsoku (F-KINSOKU, F-LINE-END)

- **Human visual result: HOLD / difficult to judge** — diagnostic-box presentation insufficient. Follow-up: P2-L06 `visual-fidelity-comparison.html`.

## Hanging sample (F-HANGING, F-HANGING-BRACKET)

- **Human visual result: HOLD / difficult to judge** — same presentation issue. Follow-up: P2-L06.

## Ruby (F-RUBY-SHORT, F-RUBY-LONG, F-RUBY-BOUNDARY)

- **Human visual result: HOLD / difficult to judge.**
- **Human concern:** multi-kanji ruby appeared visually as if the ruby annotation is attached at a one-character level (a real renderer bug in this loop's presentation — each base character got its own `<ruby>` element with only the first getting the `<rt>` — not a logical-model problem; the engine's own `groupId` association was correct, only the HTML rendering was wrong). Fixed in P2-L06.

## TCY (F-TCY-BARE)

- **Human visual result: HOLD / difficult to judge.**
- **Human concern:** C3 visibly shows "12" horizontally in vertical text, but C1's diagnostic-box presentation made it unclear whether the final vertical result is correct. Follow-up: P2-L06 renders TCY inline within real vertical prose instead of an isolated box.

## Dash / ellipsis (F-DASH-FIT, F-DASH-DEFER, F-ELLIPSIS)

- **Human visual result: provisionally NATURAL** for both dash and ellipsis.
- **Human concern:** both appear slightly left-shifted. **Not yet measured** — P2-L06 adds a browser-side glyph-center measurement (`evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md`) before any correction is considered; no manual optical nudge applied here.

---

## Overall

Does C1-NATURAL still look publication-quality with these special elements present? **Overall spacing/density: YES, remains natural** (Human's assessment, independent of the per-feature HOLDs above, which are presentation-judgeability issues, not spacing complaints).

Any feature that obviously breaks the architecture? **NONE.**

Continue development with this structure? **YES** — this freeze approves continuing the C1-NATURAL structure; it does not approve the current diagnostic renderer as publication-quality presentation for special features (see P2-L06).

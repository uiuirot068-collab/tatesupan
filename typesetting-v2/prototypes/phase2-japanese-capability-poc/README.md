# Phase 2 — P2-L05 Japanese Typesetting Capability PoC

Master: `../../docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §14 Phase 2.
Loop log: `../../research/PHASE2_LOOP_LOG.md` (P2-L05).
Human QA: `../../qa/human/PHASE2_L05_JAPANESE_CAPABILITY_SCORECARD.md` (unscored).

## What this is

A capability spike testing whether **C1-NATURAL** (the deterministic explicit-grid layout variant from P2-L04, using natural 1em character pitch with residual margin) can structurally support Japanese composition rules — kinsoku, hanging punctuation, ruby, TCY, dash/ellipsis runs — through a deterministic logical-decision layer, rather than delegating those decisions irreversibly to browser-native flow.

**This is not the Phase 3 Canonical Layout Model, and it does not freeze any Japanese typesetting rule.** The full kinsoku class table and the dash/ellipsis primary-source rule remain OPEN (Master's Phase 1 standards-verification status) — this loop tests architecture, not standards compliance.

## How to view

Open `capability-comparison.html` directly in a browser (no server). A "診断表示" checkbox reveals rule-category highlighting (off by default). Each fixture shows C1-NATURAL (this loop's engine) side by side with C3 (plain browser-native, no rule layer) for comparison.

## The pipeline demonstrated

```
source text -> tokenize() -> expandToUnits() -> breakIntoLines() -> renderer
   (STAGE 1)      (STAGE 2)          (STAGE 3)         (HTML/CSS paint)
```

- **STAGE 1 (`scripts/engine.js` `tokenize`)**: splits source into ruby/TCY/text tokens, using the exact `RUBY_PATTERN`/`TCY_PATTERN` regexes from `src/lib/tategaki.ts` (read-only reference, copied verbatim — classified PRODUCT REQUIREMENT, since the notation itself is an existing user-facing contract).
- **STAGE 2 (`expandToUnits`)**: flattens tokens into logical units — one per ordinary character, one per ruby-base character (grouped into a keep-together group carrying the reading as metadata), one per TCY run (always 1 cell, matching the existing product simplification), one per dash/ellipsis run (grouped, kept together). Every unit retains its manuscript `[start, end)` source range.
- **STAGE 3 (`breakIntoLines`)**: a rule-decision layer that resolves kinsoku (行頭/行末禁則) and hanging punctuation (ぶら下げ) **before** any position is assigned — a simplified, single-pass, PoC-only reimplementation, explicitly **not** `tategaki.ts`'s own iterative algorithm (classified LEGACY IMPLEMENTATION DETAIL, deliberately not reused, since this loop's question is architectural).
- **Renderer**: paints the engine's decided line/unit structure via native `writing-mode:vertical-rl` (same technique C1-NATURAL has used since P2-L02/L04) — the renderer does not make any composition decisions itself.

## Evidence

- `evidence/P2_L05_JAPANESE_CAPABILITY_MATRIX.md` — per-feature support/determinism/standards-status table.
- `evidence/P2_L05_BREAK_DECISION_TRACE.md` — generated directly from engine output (not hand-transcribed) for every fixture: naive break, rule decisions applied, final line content, next-line start. Answers "why did this line break here?" without screenshot-guessing.
- `evidence/P2_L05_SOURCE_MAPPING.md` — every logical unit's manuscript source range, generated directly from engine output.
- `scripts/determinism-check.json` — every fixture run twice; structural output compared. All 11 fixtures: deterministic.
- `FIXTURES.md` — the fixture manifest, each labeled POC CAPABILITY DEMONSTRATION (never FINAL), with its purpose and expected structural behavior.

## What this loop does NOT claim

- That the full kinsoku class table is complete (Master §19: partially confirmed only).
- That the dash/ellipsis primary-source citation is resolved (Master §19/24: OPEN).
- That the long-ruby overflow/spacing rule or the TCY digit-run threshold are decided (both explicitly OPEN, Corpus §4 / Freeze §17).
- That `engine.js`'s break algorithm is Phase 3-ready — it is a minimal, single-pass demonstration of separability (rule decisions happen independently of rendering), not a production algorithm.
- That any architecture has been finally selected. C2 remains DEFERRED; C1-NATURAL is the leading candidate per P2-L04's Human QA, not a final choice.

## Dependency policy

No new dependencies — `scripts/engine.js` and `scripts/build-capability-poc.js` are plain Node, no npm install.

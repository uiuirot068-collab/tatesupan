# P3-L15 — Canonical Core Regression Suite — Human Gate G1 Review

- Status: **AUTOMATED WORK COMPLETE (P3-L15 + P3-L15A gap closure). HUMAN GATE G1: PENDING.**
- This document is written for a non-engineer reviewer. It does not require reading source code.
- **Update (P3-L15A):** the image-placement gap first found while preparing this review (§14 below) has been fixed and re-verified — images now consume real page space. The hanging-punctuation item (§14) has been precisely classified as a deliberately deferred, already-planned future item — not a surprise gap.

## 1. What G1 is judging

Whether the **Canonical Logical Core** — the part of TateSpun v2 that decides *where line breaks happen, why, and what goes on which page* — behaves correctly, consistently, and safely across every feature it currently supports (plain prose, kinsoku punctuation rules, ruby annotations, TCY, dash/ellipsis runs, manual page breaks, multi-column/multi-page flow, and a colophon page).

## 2. What G1 is NOT judging

- **Not** how the text looks visually (font rendering, glyph shape, spacing aesthetics). No renderer exists yet — nothing has been painted to a screen or PDF.
- **Not** Publication (PDF/JPG) quality.
- **Not** the Editor UI.
- **Not** final page dimensions for 文庫/A5/B5/etc. (see §14 below — this is explicitly still open).

This gate only asks: *did the Core make sound, explainable, reproducible logical decisions?*

## 3. The pipeline, in simple terms

```
manuscript text
   → split into safe "atoms" (never breaking mid-character)
   → each character classified (can a line start/end with it?)
   → candidate break points found, each tagged legal/illegal and why
   → lines filled to their natural width (never artificially stretched)
   → lines grouped into columns, columns into pages
   → ruby, TCY, dash/ellipsis, manual breaks all respected as their own logical groups
   → the whole result is checked for problems (HOLD if something's wrong)
   → a version record is attached so this exact result can be reproduced later
```

## 4. Representative source (F20 — the project's canonical regression sentence)

```
「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」
```

This sentence is the project's own frozen regression fixture (`typesetting-v2/fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md` §1). The Core composes it into a valid document with zero errors and zero HOLD — see `core/layout/composeCanonicalDocument.test.ts`, "F20" tests.

## 5. Where the Core chose line breaks, and why

Kinsoku example, verified by an automated test: given the text `あいう、え` and a line that can fit exactly 4 characters —

- The Core does **not** stop the line right after `う`, because that would put `、` (a comma) at the very start of the next line — Japanese typesetting forbids this.
- Instead it checks: does including `、` on the current line fit? Yes (4 characters exactly) — so it extends the line to include `、`, then wraps before `え`.
- If the line could only fit 3 characters, including `、` would overflow — so the Core retreats *past* `う` as well, wrapping before `う`, and starts the next line with `う、`. This is the standard 追い出し (push-out) behavior.

Both cases are automated tests, not manual inspection — see `core/compose/line.test.ts`, "Prohibited boundary is skipped in favor of an earlier legal one."

## 6. Page/column assignment

- A page holds a fixed number of columns; each column holds a fixed number of lines; each line holds as many characters as fit.
- When one page fills up, the next page starts automatically, continuing exactly where the last page left off (no gap, no duplicated character).
- Two-column pages fill the first column completely before starting the second.

Verified by `core/compose/page.test.ts` (single/multi-page, one/two-column) and the cross-feature test in `core/layout/composeCanonicalDocument.test.ts`.

## 7. Ruby (annotation) logical behavior

- **Atomic ruby** (a single annotated word, e.g. 東京 with a reading): never splits across a line break — the whole word+reading stays together as one unit.
- **Jukugo ruby** (a compound word with per-character reading breakdown, when explicitly marked up that way): may only break at the exact points the manuscript already declared as legal — the Core never guesses where a compound word's reading should split.
- The base word's own position on the page is **never** shifted because of its ruby annotation — this is checked directly, not assumed.

## 8. Manual page break behavior

When the author's `【改ページ】` marker is present, the current page closes **immediately**, even if there was room left on it, and the next content starts a fresh page. Verified end to end (`core/layout/composeCanonicalDocument.test.ts`, cross-feature test): a manual break mid-manuscript reliably produces at least 2 pages, and the content after the break is confirmed to start the next page, not the current one.

## 9. Source-mapping proof

Every single placed character in the output document still carries a record of exactly which position in the original manuscript it came from. This was checked by walking every page → column → line → character in a combined test manuscript and confirming: no character's position is missing, none is duplicated, and the positions are contiguous (no invisible gap or overlap) from start to end.

## 10. Natural Pitch / residual-space proof

TateSpun's typesetting principle is: characters are always spaced at their natural size — never artificially stretched to make a line or page look "full." Verified: when a line or column isn't completely full, the Core reports the leftover space explicitly (e.g. "1 character's worth of space is unused here") rather than spreading that space between characters.

## 11. HOLD example (safety mechanism)

If the Core is given a layout that is physically impossible (e.g., a line width of zero, so not even one character can fit), it does **not** silently produce a broken-looking result and call it done. It sets a document-wide `hold: true` flag and attaches a specific error explaining what went wrong and where in the source it happened. This was directly tested — the error is present, and it is never quietly downgraded to a mere "warning."

## 12. Determinism proof

The exact same manuscript, composed twice with identical settings, produces an **identical** result down to every character's position, every page break, and every internal decision log entry — checked by deep structural comparison, not by eye.

## 13. Version metadata

Every composed document carries four identifying tags so this exact result could be reproduced or compared later: which version of the Core logic ran, which Japanese rule set was used, an identifier for the settings used, and an identifier for the measurement data used. Verified: none of these are ever blank.

## 14. Open items still remaining (not resolved by this milestone)

| Item | Status |
|---|---|
| TCY visual rotation/rendering | OPEN — no renderer exists yet |
| Dash/ellipsis visual (optical) alignment | OPEN — renderer-only concern |
| Exact ruby overhang distance values | OPEN — the *mechanism* works (tested), but real numeric values are a separate future Product decision |
| TCY auto-detection (vs. explicit markup only) | OPEN — not attempted |
| Publication (PDF) renderer | OPEN — not started |
| Preview renderer | OPEN — not started |
| **Real 文庫/A5/B5/B6/新書/A6/Web page geometry** | **OPEN — see §15 below, read this carefully** |
| Jukugo automatic segmentation (splitting a compound word's reading automatically) | OPEN — the Core only ever honors reading splits the manuscript already declares |
| Group-ruby's distinct break rule | OPEN — currently treated the same as ordinary ruby |
| Image placement wired into automatic page-filling | **FIXED (see below)** |
| Hanging punctuation (ぶら下げ) composition decision | OPEN, but deliberately deferred — see below |

**Image gap: fixed.** An image now consumes its own real amount of page space when the manuscript flows around it — a following paragraph is confirmed (by test) to land in a different position depending on whether an image precedes it. An image that's too large to fit anywhere produces the same safety mechanism as any other impossible layout (see §11). Image *decode/rendering* itself is still not built — that remains a separate, later Renderer stage, not judged here.

**Hanging punctuation: deliberately deferred, not a surprise gap.** TateSpun's rule for "a trailing 。or 、 hangs one extra character past the normal line end" is not yet implemented. This was **always planned as its own separate, later step** — the project's own roadmap explicitly scoped it that way from the start, and the piece of information needed to build it (which punctuation qualifies, how many characters may hang) is already decided, not an open question. It is not judged as part of this milestone.

## 15. ⚠️ Important disclosure about page presets (P3-O12)

This milestone proves the Core's logical machinery can accept and process all 8 mandatory presets (文庫, A5 1段, A5 2段, B5, B6, 新書, A6, Web閲覧用) using their **real, production character-count and line-count values** (read directly from `src/constants/paperSizes.ts`, not invented).

**However:** the underlying formula that converts physical page size + margins (in millimeters) into those character/line counts has **not** been reimplemented or re-verified in the new Core. This milestone only proves the Core can *consume* those already-known numbers correctly — it does not prove the Core can *derive* them from raw page dimensions the way the current product does. That reconciliation is tracked as **P3-O12, and remains explicitly OPEN.**

**Do not read "8 presets: PASS" as "final preset page geometry is validated." It is not.**

## 16. Human Gate G1 Scorecard (unanswered — awaiting your review)

| # | Question | Answer |
|---|---|---|
| G1-1 | Can you follow why the Core broke the representative text where it did? | ☐ YES ☐ NO |
| G1-2 | Does the page/column logical flow look internally consistent? | ☐ YES ☐ NO |
| G1-3 | Is source mapping visibly preserved through the example? | ☐ YES ☐ NO |
| G1-4 | Does Natural Pitch behave as intended (no page-fill stretching)? | ☐ YES ☐ NO |
| G1-5 | Are Ruby / TCY / dash / ellipsis being treated as the intended logical groups? | ☐ YES ☐ NO |
| G1-6 | Does manual page break produce the expected logical page transition? | ☐ YES ☐ NO |
| G1-7 | Does the HOLD example correctly stop unsafe canonical approval? | ☐ YES ☐ NO |
| G1-8 | Are the remaining OPEN items clearly distinguished from PASSed Core work? | ☐ YES ☐ NO |
| G1-9 | Approve the Canonical Logical Core milestone to proceed toward renderer/comparison work? | ☐ YES ☐ NO |

See `typesetting-v2/qa/evidence/P3_G1_CANONICAL_CORE_EVIDENCE.md` for the full machine-checked evidence backing every claim above.

# TateSpun Engine v2 — Regression Corpus Spec

- Status: Phase 0 draft — spec only, corpus text not yet generated
- Source authority: `typesetting-v2/docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §11.3
- Scope: defines *what* the regression corpus must cover and *why*. Does not yet contain the full corpus text (Phase 2 assembles and renders it across candidate architectures per Master §14 Phase 2).

This spec exists so that Phase 1–2 architecture comparisons, and every later renderer, are checked against the same fixed set of typography phenomena — independent of which technology is chosen.

---

## 1. Canonical Regression Sentence

```
「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」
```

**Why retained:** this sentence was the working example during the pre-v2 typography investigation (TSP-TYPO-LOOP series). It exposed cumulative character-advance drift and local punctuation/visual-rhythm differences between renderers (see memory: `tsp029-preview-rhythm-glyph-shape`) that were not reducible to a simple coordinate bug — this is part of what motivated the Engine v2 reset (Master §0). It stays in the corpus as a known-hard case: any candidate architecture must be checked against it before being trusted on the rest of the corpus.

It is not sufficient by itself — it exercises 、。「」and ordinary prose rhythm but none of ruby, TCY, brackets other than 「」, dashes, ellipsis, kinsoku edges, or pagination. Hence the categories below.

---

## 2. Corpus Categories

Each category lists: purpose, phenomenon tested, expected logical guarantee, and whether Human Visual QA is required (per Master §11.1 — automated tests supplement, never replace, Human QA for Publication Quality PASS).

| # | Category | Purpose | Phenomenon tested | Expected logical guarantee | Human QA required? |
|---|----------|---------|--------------------|------------------------------|----------------------|
| 1 | Ordinary kanji/kana | Baseline prose rhythm | Uniform character advance across a full column of mixed kanji/kana | Even visual rhythm; no cumulative drift over a full page | Yes |
| 2 | 、。(comma/full-stop) | Punctuation placement | Position and spacing of 、and 。relative to preceding character; behavior at line end | Correct glyph placement per category rule (Master §5.4), not per-character hack | Yes |
| 3 | Opening brackets (start-of-line) | Kinsoku interaction | Opening bracket forced to line start | No orphaned opening bracket at line end; consistent inset | Yes |
| 4 | Closing brackets (end-of-line) | Kinsoku + hanging interaction | Closing bracket at natural line end vs. forced overflow | Correct kinsoku/hanging resolution, logically identical across renderers | Yes |
| 5 | 「」single quotation | Dialogue quoting | Nesting, spacing, nested bracket nesting with『』 | Bracket pairing preserved; no visual collision with adjacent punctuation | Yes |
| 6 | 『』double quotation | Nested/title quoting | Quotation-within-quotation | Same as #5, verifies nesting depth ≥ 2 | Yes |
| 7 | ――(dash, em-dash pair) | Long dash rendering | Two-character dash run, vertical orientation | Continuous unbroken dash glyph run, correct vertical glyph variant | Yes |
| 8 | ……(ellipsis) | Ellipsis rendering | Two-character ellipsis run, vertical orientation | Continuous unbroken ellipsis glyph run, correct vertical glyph variant | Yes |
| 9 | Ruby (short) | Furigana over 1–2 base characters | Ruby-to-base alignment | Ruby stays attached to its base character across line/page reflow | Yes |
| 10 | Ruby (long) | Furigana longer than its base run | Ruby overflow into neighboring characters | Defined overflow/spacing rule (not ad hoc), consistent across renderers | Yes |
| 11 | TCY (縦中横) | Horizontal-in-vertical runs (e.g. two-digit numbers) | Digit run rotation/sizing inside vertical column | TCY run treated as one logical unit for line-breaking and pagination | Yes |
| 12 | Half-width Latin | Mixed-script inline Latin | Latin word/acronym inside vertical Japanese text | Correct orientation and line-breaking around the Latin run | Yes |
| 13 | Full-width Latin | Full-width Latin characters | Distinguish full-width vs half-width handling | Full-width Latin behaves as a normal vertical character, not rotated like half-width | Yes |
| 14 | Numbers (mixed) | Numeral runs of varying length | Single digit vs. multi-digit vs. TCY threshold | Consistent, documented threshold for when a number run becomes TCY | Yes |
| 15 | Mixed Japanese/Latin | Realistic prose mixing scripts | Combined effect of #12–14 in running text | No compounding drift or spacing artifacts from script transitions | Yes |
| 16 | Line-start kinsoku | Prohibited leading characters | Small kana, closing punctuation forced away from line start | Correct character pushed to previous line per kinsoku rule set | Yes |
| 17 | Line-end kinsoku | Prohibited trailing characters | Opening punctuation forced away from line end | Correct character pushed to next line per kinsoku rule set | Yes |
| 18 | Hanging punctuation (ぶら下げ) | Punctuation exceeding the column box | 、。at column end | Punctuation hangs outside the column per rule, without shifting sibling characters | Yes |
| 19 | Manual page break | Author-inserted break | Explicit break token forces new page regardless of fill | Page break position identical across Preview/PDF/JPG (Master §1.3) | Yes |
| 20 | Multi-column (段組) | Column-count variation | 2-column layout page | Column order (RTL for vertical Japanese), balance, and break behavior | Yes |
| 21 | Image mixed content | Image placed within manuscript flow | Image frame affecting surrounding text flow | Image position and resulting reflow identical across renderers | Yes |
| 22 | Long pagination | Multi-page manuscript (stress case) | Cumulative pagination correctness over many pages | Deterministic page count or determinstic page-break points (Master §2 "same logical typesetting"); no drift accumulation | Yes (spot-check every N pages) |
| 23 | Paragraph boundaries | Indentation / paragraph start rule | First-line indent, paragraph separation | Consistent indent rule applied uniformly, independent of surrounding kinsoku | Yes |

## 3. Non-goals of this spec

- Does not select a rendering technology to test against (Master §7).
- Does not yet contain the actual corpus manuscript text — only the category design. Assembling full sample text per category is a Phase 1/2 task once a candidate architecture exists to test.
- Does not define pass/fail pixel thresholds — Human Visual QA is the PASS authority (Master §11.1); automated checks (Phase 3+) verify logical/data-level guarantees (page count, break positions, category assignment), not pixel identity.

## 4. Open questions (engineering-resolvable, not product decisions)

- Exact TCY digit-run threshold (2 digits vs. up to 4) — resolve during Phase 2 typography PoC against InDesign reference (Master §4.2), not here.
- Whether corpus manuscripts should be hand-authored per category or extracted from a real full-length work (a full novel likely already covers most categories organically) — Phase 1 decision, not Phase 0.

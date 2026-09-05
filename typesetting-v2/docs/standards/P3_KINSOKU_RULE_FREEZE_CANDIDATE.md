# P3 — Kinsoku Rule Freeze Candidate (P3-O01)

- Status: **Human Rule-Freeze Gate CLOSED (2026-09-05).** HG-1 and HG-2 below are now binding Product Policy for Phase 3 Core. Master updated to v1.6 (§26).
- Resolves/narrows: Phase 3 Open Item P3-O01 (`PHASE3_OPEN_ITEMS.md`)
- Primary source: `../../research/phase3/P3_L01_PRIMARY_SOURCE_LEDGER.md` SOURCE-001 (W3C jlreq, `https://w3c.github.io/jlreq/`, cached locally, verified by direct text search — not AI summarization)

## Human Rule-Freeze Decisions (2026-09-05)

**HG-1 — cl-05 (middle dots ・：；) line-start prohibition: STRICTER BASE-LEVEL POLICY APPROVED.** Phase 3 Core's v2 default prohibits cl-05 at line start, per jlreq's base-level rule, **not** TateSpun's current looser `tategaki.ts` behavior (which is retained below only as legacy-comparison evidence, not carried forward as the v2 default). A future configurable "loose" composition profile remains possible but is not implemented by this decision.

**HG-2 — cl-12/13 (pre/postfixed abbreviations ￥＄￡＃ / °′″℃￠％‰) line-start prohibition: STRICTER BASE-LEVEL POLICY APPROVED.** Same reasoning and same scope-limit as HG-1, applied to this distinct character class and its distinct jlreq relaxation level (Level 1/"very loose," not Level 2).

**Classification discipline:** HG-1/HG-2 are **PRODUCT_POLICY decisions built on STANDARD_BACKED evidence** (jlreq's base-level rule and its documented relaxation levels) — they are TateSpun's choice of *which* jlreq-legitimate conformance level to adopt, not a claim that jlreq mandates this exact configuration. See `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` rows for cl-05/cl-12/13, now **READY**.

---

## CLASS SOURCE

jlreq (SOURCE-001, anchors `#cl-01` through `#cl-30`) defines **30 character classes**, cl-01–cl-30, each with an English name, a Japanese name, and (for most) example characters. This is a direct successor/refinement of JIS X 4051's own character-class scheme — jlreq explicitly documents where and why it splits or renames JIS X 4051 classes (e.g. cl-09/cl-10/cl-11 are three separate jlreq classes that JIS X 4051 merges into one "行頭禁則和字" class).

**Full class list, verbatim from source (English name / Japanese name / example characters where given):**

| Class | English name | Japanese name | Examples (verbatim from source) |
|---|---|---|---|
| cl-01 | Opening brackets | 始め括弧類 | ‘“（〔［｛〈《「『【 etc. |
| cl-02 | Closing brackets | 終わり括弧類 | ’”）〕］｝〉》」』】 etc. |
| cl-03 | Hyphens | ハイフン類 | ‐〜 etc. |
| cl-04 | Dividing punctuation marks | 区切り約物 | ？！ etc. |
| cl-05 | Middle dots | 中点類 | ・：； |
| cl-06 | Full stops | 句点類 | 。． |
| cl-07 | Commas | 読点類 | 、， |
| cl-08 | **Inseparable characters** | **分離禁止文字** | **—…‥ etc. (EM DASH, HORIZONTAL ELLIPSIS, TWO DOT LEADER)** |
| cl-09 | Iteration marks | 繰返し記号 | ヽヾゝゞ々 etc. |
| cl-10 | Prolonged sound marks | 長音記号 | ー |
| cl-11 | Small kana | 小書きの仮名 | ぁぃぅぇぉァィゥェォっゃゅょッャュョ etc. |
| cl-12 | Prefixed abbreviations | 前置省略記号 | ￥＄￡＃ etc. |
| cl-13 | Postfixed abbreviations | 後置省略記号 | °′″℃￠％‰ etc. |
| cl-14 | Full-width ideographic space | 和字間隔 | U+3000 |
| cl-15 | Hiragana | 平仮名 | あいうえお… etc. |
| cl-16 | Katakana | 片仮名 | アイウエオ… etc. |
| cl-17 | Math symbols | 等号類 | ＝≠＜＞≦≧⊆⊇∪∩ etc. |
| cl-18 | Math operators | 演算記号 | ＋－÷× etc. |
| cl-19 | Ideographic characters | 漢字等 | 亜唖娃阿哀愛挨〃仝〆♂♀ etc. |
| cl-20 | Characters as reference marks | 合印中の文字 | (contextual, no fixed list) |
| cl-21 | Ornamented character complexes | 親文字群中の文字（添え字付き） | (structural class, not a character list) |
| cl-22 | Simple-ruby character complexes | 親文字群中の文字（熟語ルビ以外のルビ付き） | (structural class) |
| cl-23 | Jukugo-ruby character complexes | 親文字群中の文字（熟語ルビ付き） | (structural class) |
| cl-24 | Grouped numerals | 連数字中の文字 | (numeral runs) |
| cl-25 | Unit symbols | 単位記号中の文字 | (SI unit combinations) |
| cl-26 | Western word space | 欧文間隔 | (space) |
| cl-27 | Western characters | 欧文用文字 | (Latin script + Western punctuation) |
| cl-28 | Warichu opening brackets | 割注始め括弧類 | （〔［ etc. |
| cl-29 | Warichu closing brackets | 割注終わり括弧類 | ）〕］ etc. |
| cl-30 | Characters in tate-chu-yoko | 縦中横中の文字 | (structural class) |

This resolves the "not just cl-01/02/06/07, extends to at least cl-27" open question left by P1-L10a — the **full cl-01–cl-30 table is now directly verified**, not merely inferred from inline citations.

**Not transcribed in this pass:** the full N×N pairwise breakability grid ("Table 2", SOURCE-002) exists only as an official PDF; it was downloaded into this worktree but not text-extracted (missing `poppler-utils` in this environment — see ledger). What *is* directly verified below is (a) the complete class list/definitions, and (b) every specific pairwise rule that appears in the HTML body's prose/notes sections (which, for TateSpun's actual feature set, covers the practically relevant cases — see "Verified rules" below).

---

## CORE DATA MODEL CANDIDATE

This is a **conceptual sketch only** — no schema is implemented in this loop (loop brief forbids Core implementation).

Phase 3's Core should not hard-code 30 special-cased branches. jlreq's own structure suggests a maintainable shape:

- Each source character/unit carries a **character class** (one of cl-01…cl-30, or a TateSpun-scoped subset of these — see Product Policy below).
- Each class carries class-level flags, not per-character flags:
  - `mayBreakBefore: boolean` (can a line start with this class?) — inverse of "line-start prohibited."
  - `mayBreakAfter: boolean` (can a line end with this class?) — inverse of "line-end prohibited."
  - `inseparableGroup: string | null` — for cl-08, this is keyed by the *specific character identity within the class* (EM DASH only pairs with EM DASH; HORIZONTAL ELLIPSIS only pairs with HORIZONTAL ELLIPSIS — see Dash/Ellipsis Freeze Candidate), not the class as a whole. This is the one class where "same class" is not the same as "same inseparability group" — worth a dedicated field rather than overloading class identity.
- A separate **conformance level** setting (see "Addendum" finding below) determines which of the class-level `mayBreakBefore/After` flags are relaxed. This maps naturally to a single Product-level "strictness" setting rather than per-preset special-casing (which Master §5.3 would prohibit as a magic number anyway).

This shape is compatible with (not a redesign requirement for) the existing `LINE_START_PROHIBITED` / `LINE_END_PROHIBITED` `Set<string>` approach in `src/lib/tategaki.ts` — those sets are effectively a pre-computed flattening of "which characters belong to a class with `mayBreakBefore/After = false` at TateSpun's currently-chosen conformance level." Phase 3 Core can either keep that flattened-set shape (simple, proven) or introduce the class layer explicitly (more traceable, easier to audit against jlreq directly) — **this choice is deferred to Phase 3 Core Contract, not decided here.**

---

## VERIFIED RULES

Directly supported by SOURCE-001, quoted or closely paraphrased with anchor citations:

1. **Line-end prohibition (行末禁則), all conformance levels:** breaking a line **after** cl-01 (opening brackets) is prohibited at every level (`#addendum_a3`: "Note that breaking a line after opening brackets (cl-01)... is prohibited at all levels"). TateSpun's `LINE_END_PROHIBITED` set (`（［｛〔〈《「『【〘〖`) matches this class **exactly** in scope (see Legacy Comparison).

2. **Line-start prohibition (行頭禁則), all conformance levels:** breaking a line **before** cl-02 (closing brackets), cl-06 (full stops), or cl-07 (commas) is prohibited at every level (same anchor, same sentence). TateSpun's `LINE_START_PROHIBITED` set includes the cl-02/cl-06/cl-07 characters.

3. **cl-08 inseparability (分離禁止):** there is no line-break opportunity between two consecutive cl-08 characters **of the same specific kind** — verbatim enumerated pairs (`#notes_a3`, item id589): EM DASH+EM DASH, HORIZONTAL ELLIPSIS+HORIZONTAL ELLIPSIS, TWO DOT LEADER+TWO DOT LEADER, and two specific vertical-kana-repeat-mark pairs (〳+〵, 〴+〵). A **different**-kind cl-08 pair (e.g. EM DASH followed by HORIZONTAL ELLIPSIS) **is** breakable. Full detail and TateSpun mapping in the Dash/Ellipsis Freeze Candidate.

4. **cl-21/cl-22 "ornamented"/"simple-ruby" complex inseparability:** no line-break opportunity between two characters of the **same** complex; a break opportunity **does** exist between two **different** complexes (`#notes_a3`, id595/id596). This is the class-level backing for treating a single (non-jukugo) ruby base+annotation group as an atomic, unbroken unit — directly relevant to Phase 2's Human-approved ruby policy (see Ruby Standards Review).

5. **cl-23 jukugo-ruby complex — partial breakability:** unlike cl-21/cl-22, jlreq explicitly **permits** a line break **between base characters of the same jukugo-ruby group** (and between their corresponding ruby-text segments), while still forbidding a break **within** a single base-character-plus-its-ruby-segment pair (`#notes_a3`, id597). This is a real, standards-backed distinction TateSpun's current ruby model does not yet make — flagged in the Ruby Standards Review, not resolved here.

6. **cl-30 (tate-chu-yoko) grouping:** no break within the same TCY group; a break opportunity exists between different TCY groups (`#notes_a3`, id602). This directly backs TCY's "1-cell collapse" treatment as a structural (not merely visual) rule.

7. **Hanging punctuation (ぶら下げ組) scope:** applies **only** to cl-06 (full stops) and cl-07 (commas) — not to closing brackets or any other class (`#line_adjustment` region, id in the "line-adjustment-by-hanging-punctuation" area: "a method which is only applied to full stops (cl-06) and commas (cl-07)"). Matches `src/lib/tategaki.ts`'s current `HANGING_PUNCTUATION = new Set("、。，．")` scope exactly (see Legacy Comparison). Also directly confirmed: hanging punctuation is explicitly **not** formally mandated by JIS X 4051's normative body ("この方法は，JIS X 4051では規定していないが，その"解説"では説明が行われている") — it is a documented, common, but non-mandatory convention, consistent with treating it as enable/disable Product Policy (which TateSpun already does) rather than an unconditional requirement.

---

## PRODUCT POLICY

jlreq itself frames these as implementation-defined choices, not fixed rules — TateSpun must choose, and any choice is standards-consistent:

1. **Conformance level (行頭禁則の強さ).** jlreq's own Addendum (`#addendum_a3`) defines (at least) two named looser levels relative to a stricter baseline: **Level 1 ("very loose," newspapers)** relaxes line-start/end prohibition for cl-03 (hyphens), cl-04 (？！), cl-05 (middle dots), **same-kind cl-08 pairs**, cl-09 (iteration marks), cl-10 (prolonged sound), cl-11 (small kana), cl-12/cl-13 (pre/postfixed abbreviations). **Level 2 ("loose," magazines)** relaxes a narrower subset: cl-03, katakana middle dot specifically, **only the ellipsis/two-dot-leader same-kind pairs of cl-08 (not the dash pair)**, 々, cl-10, cl-11, and percent sign. TateSpun currently implements a level that is *stricter than Level 1* for cl-08 (no explicit relaxation) but *looser than the strict baseline* for cl-03/cl-12/cl-13 (not in `LINE_START_PROHIBITED` at all — see Legacy Comparison). **This is a real product decision, not yet consciously mapped to one of jlreq's named levels.**
2. **Whether hanging punctuation is enabled at all**, and (if the current TSP-LOOP-029 design of a single dedicated hang-slot rather than unlimited hanging is kept) how many characters may hang — jlreq documents the *existence* and *scope* (cl-06/cl-07 only) of the technique but does not mandate its use or a specific slot count.
3. **Whether cl-09/cl-10/cl-11 remain independently classed (jlreq's own default) or merged back into a single class (JIS X 4051's older convention, which jlreq explicitly says it split apart)** — both are legitimate; jlreq documents the JIS X 4051 alternative directly (`#cl-09` note n177, `#cl-10` note n179–181, `#cl-11` note n182–184) as an implementation-definable option.

---

## OPEN

1. **Full N×N pairwise breakability grid (Table 2, SOURCE-002).** The class-level and prose-level rules above cover every pairing that is directly relevant to TateSpun's current feature set (brackets, stops, commas, cl-08, ruby complexes, TCY). They do **not** cover every one of the 30×30 = 900 possible class-pair cells (e.g. exact behavior between cl-17/cl-18 math symbols and cl-27 Western characters was not verified this pass — TateSpun does not currently implement math-symbol-specific kinsoku, so this gap has no near-term product impact, but it is not closed as a general matter). **Recommend:** treat as OPEN, revisit only if/when TateSpun adds a feature that would touch an unverified cell, rather than blocking Phase 3 Core on full-grid transcription.
2. **jlreq document version/date** was not checked against a specific dated edition in this pass (the URL serves the "living document" head). If a future Human Gate wants a pinned, dated citation rather than "the document as of 2026-09-05," that is a quick follow-up, not a research gap.

---

## LEGACY COMPARISON (read-only; not mutated)

`src/lib/tategaki.ts` (lines ~426–469) was read for comparison only; nothing in it was changed by this loop.

| TateSpun current behavior | jlreq classification | Verdict |
|---|---|---|
| `LINE_START_PROHIBITED` includes 、。，．！？‼⁉ (cl-06/cl-07/cl-04), closing brackets (cl-02), small kana (cl-11), ー (cl-10), 々/ゝゞヽヾ (cl-09) | Matches base-level line-start prohibition for cl-02/04/06/07/09/10/11 | **Matches evidence** |
| `LINE_START_PROHIBITED` does **not** include ・：；(cl-05, middle dots) | jlreq's base level prohibits cl-05 at line start; only Level 2 relaxes it (katakana middle dot specifically) | **Differs** — TateSpun is already at (or looser than) jlreq's "Level 2" for this one class, whether or not that was a deliberate choice |
| `LINE_START_PROHIBITED` does **not** include cl-12/cl-13 (￥＄￡＃ / °′″℃￠％‰) | jlreq's base level prohibits these; only Level 1 (very loose) relaxes them | **Differs** — legacy implementation detail, not previously framed as a conformance-level choice |
| `LINE_END_PROHIBITED` = exactly cl-01's opening-bracket set | Matches jlreq's all-levels rule exactly | **Matches evidence** |
| `HANGING_PUNCTUATION` = exactly cl-06 ∪ cl-07 (、。，．) | Matches jlreq's documented hanging-punctuation scope exactly | **Matches evidence** |
| No dedicated inseparable-run handling for cl-08 (—…‥) in `tategaki.ts`'s kinsoku constants | jlreq requires same-kind cl-08 pairs to be unbreakable | **Unknown / not implemented here** — cl-08 inseparability is not encoded in `tategaki.ts`'s `LINE_START_PROHIBITED`/`LINE_END_PROHIBITED` constants (it is a different mechanism, run-inseparability, not a start/end prohibition); the Phase 2 PoC (`engine.js`, `DASH_RUN_FAMILY`/`ELLIPSIS_RUN_FAMILY`) handles this separately. Phase 3 Core must decide where this logic lives — flagged, not resolved, here. |

None of these "differs" rows are framed as bugs — per the loop brief, they are legacy implementation details now traceable to a specific standards choice, to be ratified or changed deliberately at the Human Rule-Freeze Gate rather than silently carried forward.

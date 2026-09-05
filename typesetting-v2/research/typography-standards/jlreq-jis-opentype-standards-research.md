# Research Archive — Japanese Typesetting Standards (jlreq / JIS X 4051 / OpenType / Unicode)

- Status: raw research output, archived verbatim from a Phase 1 research agent (2026-09-05)
- Method: WebFetch against primary/near-primary sources (W3C jlreq, OpenType spec, Unicode UAX reports; some via fetch-tool summarization rather than raw byte-for-byte reads — confidence tagged accordingly, with explicit flags where a follow-up direct read is recommended
- Used by: `../../docs/architecture/JAPANESE_SHAPING_RESEARCH.md`, `../../fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md` (TCY threshold question), Phase 2 kinsoku/hanging/ruby implementation
- **Correction (2026-09-05, P1-L10a in `../PHASE1_LOOP_LOG.md`):** item 5 below cites "jlreq §3.1.10" for dash/ellipsis inseparability. A dedicated timeboxed follow-up could not corroborate this as a real section number — jlreq's own visible table of contents shows no such subsection. Treat that specific section citation as unreliable; the underlying claim (dash/ellipsis inseparability is plausibly an instance of jlreq's cl-08 category) remains unconfirmed either way, now on firmer "actively checked and not found" footing rather than "not yet checked." This archive's body text is otherwise left as originally produced, per this file's own archival policy — see the loop log for the full correction record.

---

## 1. jlreq: 行頭禁則/行末禁則 character classes
**SOURCE:** W3C TR "Requirements for Japanese Text Layout" (jlreq.w3.org / www.w3.org/TR/jlreq/), §3.1.7–3.1.9, Appendix A (character class table).
**EVIDENCE:** jlreq defines a formal class table (cl-01, cl-02, cl-03…). Confirmed classes: cl-01 始め括弧類 (opening brackets: （「『), cl-02 終わり括弧類 (closing brackets: ）」』), cl-03 ハイフン類 (hyphens), cl-04 区切り約物 (dividing punctuation), cl-05 中点類 (middle dots), cl-06 句点類 (full stops/。), cl-07 読点類 (commas/、), cl-08 分離禁止文字 (inseparable characters), cl-09 iteration marks, cl-10 chōonpu (ー), cl-11 small kana (ぁぃぅ etc.), cl-12 prefix abbreviations, continuing through additional classes not fully re-verified by me. §3.1.7 forbids cl-02/04/05/06/07 from starting a line; §3.1.8 forbids cl-01 (and hyphens, cl-03) from ending a line.
**CONCLUSION:** Directly citable normative source for kinsoku character-class taxonomy — this is exactly the "category, not per-character hack" evidence the project rules require. **Confidence: medium** — the class list came through a fetch-summarization pass (small model reading the rendered page), not a byte-for-byte read of the raw table by me; the core cl-01/02/06/07 mappings are well-corroborated by independent knowledge of jlreq's structure, but cl-09–cl-30 enumeration should be re-verified directly before hard-coding into engine constants.

## 2. ぶら下げ (hanging punctuation)
**SOURCE:** jlreq §3.1.9 "Positioning of Closing Brackets, Full Stops, Commas and Middle Dots at Line End"; JIS X 4051 (cited by jlreq, not independently fetched).
**EVIDENCE:** jlreq treats hanging as one of the named optional treatments specifically for cl-06 (。) and cl-07 (、) — and cl-02 closing brackets — at line end, as an alternative to compressing spacing or forcing overflow. jlreq explicitly discusses coordination between hanging cl-06/07 and adjacent cl-02 to avoid double-hanging/stacking artifacts.
**CONCLUSION:** Standards-backed — ぶら下げ scoped to 、/。 (and its interaction with closing brackets) is a documented jlreq treatment, not a TateSpun invention. **Confidence: medium** (section identified correctly; exact clause wording not independently re-verified word-for-word).

## 3. ルビ (ruby) placement and long-ruby overflow
**SOURCE:** jlreq §3.3 (ruby), specifically §3.3.3 (ruby size), §3.3.4 (placement side), §3.3.5–3.3.7 (mono/group/jukugo-ruby), §3.3.8 "Adjustments of Ruby with Length Longer than that of the Base Characters," Appendix F (jukugo-ruby positioning).
**EVIDENCE:** jlreq formally names the "ruby longer than base" case and prescribes spacing-adjustment treatment (distributing the ruby overhang into adjacent base-character gaps) rather than leaving it undefined.
**CONCLUSION:** Standards-backed — TateSpun's ruby overflow handling should be built against jlreq §3.3.8/Appendix F rather than an ad hoc heuristic. Cross-line-break ruby-base attachment is not something I found an explicit formal jlreq clause for in this pass — **flag as unverified**, worth a follow-up fetch. **Confidence: medium** for placement/overflow existence; **low** for cross-linebreak attachment specifics.

## 4. 縦中横 (tate-chu-yoko) threshold
**SOURCE:** jlreq §2.3.2.2.3 and §3.2.5; JIS X 4051 §4.8 (cited).
**EVIDENCE:** jlreq states TCY is "usually" applied to two-digit numbers but does **not** give a hard numeric character-count rule as a normative requirement — it's presented as customary practice/example, not a MUST. Secondary Japanese-language sources (JAGAT, kikakurui.com mirror of JIS X 4051) corroborate: JIS X 4051 §4.8 covers 縦中横 as horizontal-in-vertical setting of alphanumerics, with two-digit numbers as the common case but not an exclusive numeric threshold.
**CONCLUSION:** "TCY commonly used for 2-digit numbers" **is** a documented convention (citable to jlreq §2.3.2.2.3 / JIS X 4051 §4.8), but any hard rule like "exactly N characters trigger TCY, N+1 don't" is an app-specific policy decision layered on top of a standard that only gives a soft/customary example — this must be documented as TateSpun's own threshold choice, not "the standard." **Confidence: medium-high** on the "customary, not hard-specified" conclusion.

## 5. Dash (ダッシュ) / ellipsis (三点リーダ) run splitting
**SOURCE:** jlreq §3.1.10 ("unbreakable character sequences," 分割禁止) and cl-08 (分離禁止文字).
**EVIDENCE:** jlreq does define a class of "characters that should not be separated by line breaks," but in this pass I could **not** confirm that ダーシ (dash) or 三点リーダ (ellipsis) are explicitly named exemplar characters in that clause — the fetch explicitly said the section references JIS X 4051 for the detailed list rather than reproducing it. This is a real gap, not a confirmed negative.
**CONCLUSION:** **Not verified either way this pass.** Given that jlreq's cl-08 category ("inseparable characters") exists and is clearly the right conceptual bucket, TateSpun's "don't split ――/…… across a line break" rule is very likely defensible as an instance of a documented category (cl-08-style inseparability), but I cannot yet cite the exact clause naming dash/ellipsis specifically. **Recommend before Phase 2:** direct fetch of jlreq's raw HTML (not fetch-tool summarization) for §3.1.10 to get the literal character list, and/or JIS X 4051:2004 table via kikakurui.com/x4/X4051-2004-02.html. **Confidence: low** as stated, pending direct verification.

## 6. Optical/proportional spacing for punctuation
**SOURCE:** OpenType spec, Microsoft Learn "Registered features, u-z" (learn.microsoft.com/.../features_uz) — `vchw`, `vhal`, `vpal`, `vapk` feature definitions; cross-referenced to jlreq §3.1.4 and Appendix B ("Spacing between Characters").
**EVIDENCE (verbatim from spec):** `vchw` "Contextually re-spaces glyphs that have full-em heights by default, fitting them onto half-width vertical heights to approximate more sophisticated text layout, such as what is described in [JLREQ]... This feature can be invoked to get better fit for punctuation or symbol glyphs without disrupting the monospaced alignment." Example given: a vertical closing paren (U+FE36) followed by a vertical ideographic comma (U+FE11) gets half-em of height removed between them. `vhal`: "should turn this feature on by default, or should selectively apply this feature to particular characters that require special treatment for CJK text-layout purposes, such as brackets, punctuation, and quotation marks."
**CONCLUSION:** **Strongly standards-backed, high confidence, directly quoted primary source.** "Each punctuation category gets its own spacing rule, derived from font/glyph design intent" is exactly what `vchw`/`vhal`/`vpal` formalize — this is the single strongest citation TateSpun has for its punctuation-category spacing philosophy. jlreq's own §3.1.4 and Appendix B are the layout-side counterpart the OpenType features implement.

## 7. UAX #11 (East Asian Width)
**SOURCE:** unicode.org/reports/tr11/.
**EVIDENCE:** UAX #11 defines Fullwidth/Halfwidth/Wide/Narrow/Ambiguous/Neutral. Per the fetch summary: "Wide characters remain upright in vertical text layout. Narrow characters are kept together in words or runs that are rotated sideways... Halfwidth characters are rotated like narrow characters." The OpenType `vkrn` spec (item 6 fetch) explicitly recommends using East_Asian_Width `Wide`/`Fullwidth` values to identify glyphs with fixed-height metrics by default.
**CONCLUSION:** Standards-backed and directly citable for the full-width-vs-half-width Latin distinction, and it's explicitly cross-referenced by the OpenType spec itself as the correct property to gate vertical-metrics behavior on. **Confidence: medium-high** (OpenType cross-reference was directly quoted; the UAX#11 body text is paraphrased, not independently re-read verbatim by me).

## 8. UAX #14 (Line Breaking) vs. jlreq
**SOURCE:** unicode.org/reports/tr14/, §1 (Overview/Scope), §5.1 (class CJ).
**EVIDENCE:** UAX #14 explicitly disclaims completeness: "For most Unicode characters, considerable variation in line breaking behavior can be expected... the line breaking properties provided for these characters are informative," and "The selection of actual line break positions... is not covered by the Unicode Line Breaking Algorithm, but is in the domain of higher level software." Its CJ (Conditional Japanese Starter) class explicitly defers strict/normal/loose Japanese behavior to CSS Text Level 3 / application-level policy rather than specifying it itself.
**CONCLUSION:** UAX #14 is a **general-purpose, script-agnostic scaffold** (OP/CL/EX/IN/NS/ID/PR/PO classes cover CJK punctuation at a coarse level) but by its own text is **not** a substitute for jlreq/JIS X 4051 — it explicitly punts strict Japanese kinsoku behavior to "higher level software." TateSpun should treat jlreq as the primary normative source for kinsoku classification, with UAX #14 as a useful secondary cross-check for Unicode line-break class assignments (e.g., confirming a character is CJ/NS/ID) rather than the authority for Japanese-specific rules. **Confidence: medium** (direct quotes captured, but via fetch-summarization rather than my own raw read).

## 9. OpenType `vert`/`vrt2`
**SOURCE:** Microsoft Learn OpenType spec, features_uz (directly quoted, verbatim, verified primary source).
**EVIDENCE:** `vert`: "Transforms default glyphs into glyphs that are appropriate for upright presentation in vertical writing mode... some must be transformed — usually by rotation, shifting, or different component ordering." Example: U+FF08 opening paren → rotated form U+FE35. `vrt2`: "Replaces some fixed-width... or proportional-width glyphs (mostly Latin or katakana) with forms suitable for vertical writing (rotated 90 degrees clockwise)... a superset of the glyphs covered by vert... Overrides the 'vert' feature." `vert` should never be combined with `vrt2` since `vrt2` supplies pre-rotated glyphs directly.
**CONCLUSION:** **High confidence, directly quoted primary source.** This is exactly the standards-based mechanism that should determine ――/…… glyph-variant selection in vertical mode: whether a dash/ellipsis renders as its rotated/vertical presentation form is a `vert`/`vrt2` GSUB substitution concern, not something TateSpun should special-case per-glyph. If the font implements `vrt2`, TateSpun's renderer should request it and get the correct pre-rotated glyph; `vert` is the fallback for fonts without `vrt2`.

## 10. "Natural pitch" (均等な文字送り) — no forced stretch-to-fill
**SOURCE:** jlreq's basic-page-layout model (§2, 基本版面 / grid-based character pitch); secondary corroboration via Adobe/Morisawa/JAGAT articles on InDesign 禁則処理 and 文字組みアキ量設定 (search results: blog.adobe.com, note.morisawa.co.jp, jagat.or.jp).
**EVIDENCE:** Japanese book typesetting is conventionally grid-based (文字送り = fixed character pitch on a 方眼/grid), unlike Western full-justification which stretches word-spacing to fill a line. InDesign's 文字組みアキ量設定 exposes min/optimal/max spacing specifically for kinsoku *adjustment* (追い込み/追い出し = squeeze-in/push-out), not for routine per-line stretch-justification of ordinary text. This confirms "べた組み" (solid/uniform-pitch setting) as the default expectation, with adjustment reserved for kinsoku exception-handling.
**CONCLUSION:** "Leftover space at line end becomes margin, don't stretch to fill" is a real, well-established convention distinguishing Japanese grid typesetting from Western justification, and is defensible by reference to jlreq's fixed-pitch/基本版面 model plus industry-standard InDesign practice — but I did **not** find one single normative clause stating this as a MUST in jlreq itself; it is more an emergent property of the grid model than an explicit named rule. **Confidence: medium** — treat as "standards-consistent, industry-corroborated" rather than "one-sentence-citable."

---

## Summary for Phase 2: standards-backed vs. app-specific

**Standards-backed (citable now):**
- Kinsoku line-start/line-end character classes (cl-01/02/03/04/05/06/07) — jlreq §3.1.7–3.1.8
- ぶら下げ scoped to 、/。/closing-bracket interaction — jlreq §3.1.9
- Ruby placement, sizing, and long-ruby overflow handling — jlreq §3.3.3–3.3.8
- Per-category punctuation spacing (not full em-box) — OpenType `vchw`/`vhal`/`vpal` (high confidence, directly quoted)
- Vertical glyph-variant selection for ――/…… and brackets via `vert`/`vrt2` — OpenType spec (high confidence, directly quoted)
- Full-width/half-width Latin distinction via East_Asian_Width — UAX #11

**App-specific conventions to document explicitly as TateSpun's own choice (not "the standard"):**
- The exact TCY trigger rule (e.g., "exactly 2 digits") — jlreq only gives a soft customary example, not a hard threshold
- The dash/ellipsis run non-splitting rule — plausibly an instance of jlreq's cl-08 "inseparable characters" category, but **not yet confirmed** against the literal clause text; needs a follow-up direct read of jlreq §3.1.10 / JIS X 4051 before claiming it as standards-backed
- "No stretch-to-fill, leftover becomes margin" — consistent with the grid/べた組み model but not one explicit normative sentence; should be documented as "standards-consistent design choice," not "JIS-mandated"
- Cross-line-break ruby-base attachment behavior — not found explicitly in jlreq this pass; needs further research

**Recommended before Phase 2 sign-off:** a direct (non-summarized) read of jlreq §3.1.10's raw text and the JIS X 4051:2004 table mirror (kikakurui.com/x4/X4051-2004-02.html) to close items 1 and 5's confidence gaps, since those feed directly into kinsoku character-class constants that Phase 2 will hard-code.

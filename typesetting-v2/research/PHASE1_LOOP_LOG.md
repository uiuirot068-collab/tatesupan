# Phase 1 — Loop Engineering Log

- Status: Phase 1 draft, pending Human Review
- Format: HYPOTHESIS → RESEARCH/EXPERIMENT → EVIDENCE → RESULT → ACCEPT/REJECT/OPEN → WHY → NEXT, per Master's Loop Engineering requirement for this phase
- Each loop cites its underlying evidence archive rather than restating it — see the linked research files for full detail

---

## P1-L01 — Browser-native vertical Japanese quality ceiling

**QUESTION:** What is the actual, current, citable ceiling of native CSS/browser vertical-writing-mode layout for TateSpun's specific requirements (kinsoku, hanging, ruby, TCY, dash/ellipsis)?

**HYPOTHESIS:** Native CSS layout cannot reliably clear Publication Quality for these features on Chromium specifically — consistent with TSP-TYPO-LOOP-005's prior finding, but not yet independently cited against primary sources.

**METHOD:** Web research against W3C specs, MDN, caniuse, and a W3C gap-analysis document (clreq-gap), targeting each feature individually.

**EVIDENCE:** `../research/browser/css-svg-vertical-japanese-research.md` items 1–8. Concretely: `hanging-punctuation` zero Chromium support; `ruby-overhang` Safari-only; `text-combine-upright: digits` zero support anywhere; punctuation advance width opaque/font-fragile (a real Mozilla production bug); a W3C gap-analysis document independently cataloging multiple named cross-engine divergences in this exact feature set.

**RESULT:** Confirmed, with citations, not merely re-asserted from institutional memory.

**DECISION: ACCEPT** (the hypothesis — native CSS ceiling is low for these specific features).

**WHY:** Four independent, primarily-sourced findings converge; no counter-evidence found.

**NEXT:** Feeds `JAPANESE_SHAPING_RESEARCH.md` §1 and the Architecture Research Matrix's Family A ceiling rating.

---

## P1-L02 — Canvas as a typography-control upgrade over DOM

**QUESTION:** Does Canvas 2D offer any native advantage for vertical Japanese typesetting over DOM/CSS?

**HYPOTHESIS (initial, untested):** Canvas might give finer glyph-level control since it's a lower-level paint surface.

**METHOD:** Web research against WHATWG canvas spec, MDN TextMetrics, a Mozilla bug tracker, and a documented real-world vertical-CJK Canvas architecture (koharu.rs).

**EVIDENCE:** `../research/shaping/canvas-harfbuzz-shaping-research.md` items 1–4. Canvas has zero native vertical writing-mode support (open bug since 2013); its own `TextMetrics` are explicitly flagged by browser-standards contributors (Igalia) as insufficient for structured-text tooling; the one real documented CJK-vertical Canvas architecture found still shapes text externally via HarfBuzz and uses Canvas purely as a paint surface.

**RESULT:** Hypothesis falsified — Canvas offers no native advantage; it only relocates the paint target and loses DOM's free text-selection/accessibility/caret handling.

**DECISION: REJECT** (the "Canvas gives finer native control" hypothesis).

**WHY:** Directly contradicted by primary spec text (no vertical mode) and by the standards community's own stated view of Canvas metrics' inadequacy for this exact tool category.

**NEXT:** Canvas remains viable only as a Publication/JPG *rasterization target* paired with externally-computed positions (Family D output) — not as the editor's interaction surface. Recorded in the Rejection Register as downweighted for the editing-surface role specifically, not eliminated for the rasterization role.

---

## P1-L03 — SVG as a typography-control upgrade over DOM

**QUESTION:** Does SVG offer a native advantage for vertical Japanese typesetting over DOM/CSS absolute positioning?

**HYPOTHESIS (initial):** SVG's native per-glyph `x/y/dx/dy` arrays might give more deterministic control than CSS absolute-position spans.

**METHOD:** Web research against the SVG2 spec, caniuse, an old SVG WG issue on vertical-text completeness, and SVG-to-PDF tooling docs (CairoSVG, librsvg).

**EVIDENCE:** `../research/browser/css-svg-vertical-japanese-research.md` items 9–12. SVG per-glyph positioning is authoritative and deterministic when explicitly supplied by the author — but this is the *same* ceiling as CSS absolute positioning, not higher. SVG-to-PDF text-selectability is tool-dependent and unconfirmed from primary docs (flagged LOW-MEDIUM confidence).

**RESULT:** Partially confirmed (deterministic positioning is real) but the "advantage over DOM" half of the hypothesis is falsified — it's a lateral option, not a strict improvement, and carries at least one unresolved question (PDF text-selectability) that DOM's html-to-image path doesn't have in the same form.

**DECISION: OPEN** (not rejected outright — SVG remains a legitimate candidate specifically as an alternative Preview/Publication paint surface, but with a real open question flagged rather than resolved).

**WHY:** Evidence doesn't clear the bar for ACCEPT (no proven advantage) or REJECT (no proven blocker, just an unconfirmed detail worth a hands-on test).

**NEXT:** If Phase 2 PoC work considers SVG as a Publication paint surface, the PDF-selectability question should be tested empirically rather than assumed either way.

---

## P1-L04 — Dedicated shaping (HarfBuzz/WASM) feasibility

**QUESTION:** Is a HarfBuzz-via-WASM shaping layer client-side-feasible and does it materially raise the achievable ceiling over browser-native shaping?

**HYPOTHESIS:** Yes to both, but at nontrivial integration cost, and it likely doesn't remove the need for a custom jlreq-grade layout layer on top.

**METHOD:** Web research against the HarfBuzz manual, harfbuzzjs/opentype.js/fontkit repos and licenses, UAX #14, and a maintainer's own writeup on real-world HarfBuzz-on-web usage.

**EVIDENCE:** `../research/shaping/canvas-harfbuzz-shaping-research.md` items 5–10. HarfBuzz applies `vert`/`vrt2`/`vpal`/`vkrn` automatically and correctly per the OpenType spec; it's MIT-licensed and documented in real (if blog-sourced) production use; but UAX #14 itself explicitly disclaims sufficiency for Japanese kinsoku, confirming a custom layout layer remains necessary regardless of shaping-engine choice.

**RESULT:** Both halves of the hypothesis confirmed.

**DECISION: ACCEPT.**

**WHY:** Converging evidence from the OpenType spec, the HarfBuzz manual, and Unicode's own UAX #14 all point the same direction independently.

**NEXT:** Phase 2 should measure harfbuzzjs's actual compiled bundle size and test real vertical-shaping output against TateSpun's actual fonts (Shippori Mincho etc.) — both flagged as unmeasured in this research pass, not assumed.

---

## P1-L05 — Publication (PDF/JPG) output path alternatives to DOM-screenshot

**QUESTION:** Does a viable alternative to "screenshot Preview → raster PDF" exist for vertical Japanese?

**HYPOTHESIS:** A fully vector/selectable-text PDF path is desirable but not necessarily achievable off-the-shelf; some intermediate improvement (decoupling from screen pixel density) may be achievable more cheaply than full vector text.

**METHOD:** Web research against the PDF/CMap technical notes, pdf-lib/PDFKit/jsPDF issue trackers and docs, Vivliostyle's own architecture, and Puppeteer print-to-PDF issue reports.

**EVIDENCE:** `../research/pdf/publication-output-path-research.md` items 1–10. No JS PDF library exposes vertical CJK layout as an API (confirmed via an unresolved multi-year-old PDFKit issue); Vivliostyle is Chromium's own print pipeline, not a distinct direct-drawing approach; print-to-PDF's unit mapping is devicePixelRatio-independent (a real, achievable improvement) but not itself bug-free; PDF→canvas rasterization for JPG is a solved, well-precedented pattern regardless of which PDF path is chosen.

**RESULT:** Hypothesis confirmed on both counts — no off-the-shelf full solution, but a real, lower-cost partial improvement (unit-independence) exists.

**DECISION: ACCEPT** (as stated — partial confirmation, not full).

**WHY:** Multiple independent primary/near-primary sources (PDF spec, library issue trackers, browser print-to-PDF behavior docs) converge on the same two-tier conclusion.

**NEXT:** Phase 2 should empirically test Chromium/Vivliostyle print-to-PDF's real vertical-CJK text selectability with TateSpun's actual fonts — the single most actionable open item from this loop.

---

## P1-L06 — Canonical Layout Model feasibility

**QUESTION:** Is Master §2's proposed Manuscript→Engine→Canonical Layout Model→Preview/Publication pipeline actually buildable, and what should its atomic unit be?

**HYPOTHESIS:** Feasible, and the atomic unit should be a "cluster" (source-range + shaped-glyph(s) + category metadata), not a raw character or a raw glyph alone, given ruby/TCY/ligature cases where these don't map 1:1.

**METHOD:** Synthesis of P1-L01 through P1-L05's findings (no new external research — this loop reasons from already-gathered evidence) plus direct examination of the current codebase's own kinsoku/ruby/TCY tokenization model (`tategaki.ts`, per the Compatibility Matrix survey conducted at Phase 0).

**EVIDENCE:** `CANONICAL_LAYOUT_MODEL_RESEARCH.md` §2–4. All researched paint surfaces (DOM/Canvas/SVG) converge on requiring the same externally-computed logical layer; HarfBuzz-style shaping naturally emits glyph-cluster tuples; jlreq's own ruby/TCY sections require multi-character-to-one-unit and one-character-to-multi-glyph handling.

**RESULT:** Feasibility confirmed; cluster-based design is well-supported by the converging evidence, though not yet a finalized schema.

**DECISION: ACCEPT** (feasibility); **OPEN** (exact schema — explicitly deferred to Phase 3).

**WHY:** The "feasible" half is well-evidenced; the "exact shape" half is legitimately not yet decidable without Phase 3 implementation experience.

**NEXT:** Phase 3 schema design, informed by this loop's layered-model sketch.

---

## P1-L07 — Preview/Publication renderer separation viability

**QUESTION:** Can Preview and Publication legitimately use different rendering technology (per Master §1.2) while still satisfying the Logical Layout Consistency Contract (Master §1.3)?

**HYPOTHESIS:** Yes, because the Logical Layout Consistency Contract's required-identical items (page count, breaks, kinsoku/hanging/TCY/ruby results, etc.) live in the Canonical Layout Model's layers 2/4, which are paint-surface-agnostic by construction — only layer 3 (positioned glyphs) needs per-surface adaptation, and Master §1.2 explicitly permits that layer to differ.

**METHOD:** Direct reasoning from P1-L06's layered model, cross-checked against the Architecture Research Matrix's per-family "Preview suitability" vs. "Publication ceiling" ratings (Family A rates high on Preview suitability but capped Publication ceiling; Family D rates opposite).

**EVIDENCE:** `PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md` cross-cutting finding; `CANONICAL_LAYOUT_MODEL_RESEARCH.md` §4.

**RESULT:** Confirmed as architecturally sound — this is precisely why the Hybrid family (F) scores best in the matrix: it lets Preview stay closer to today's proven DOM approach (satisfying Master §13's "don't put implementation ease over quality, but also don't over-engineer Preview" balance) while Publication gets the more rigorous custom treatment.

**DECISION: ACCEPT.**

**WHY:** This isn't a new empirical finding so much as confirmation that the Master's own already-frozen requirement (§1.2–1.3) is technically realizable given everything else this research found — an important sanity check, since if it had turned out layers 2/4 couldn't actually be made paint-surface-agnostic, that would have been a serious problem for the whole Engine v2 premise.

**NEXT:** Carries directly into the Shortlist's recommended Hybrid framing.

---

## P1-L08 — Web preset unit model

**QUESTION:** Does Web閲覧用's permitted use of web logical units (Master §6.2/HD-001) create any tension with the rest of the architecture research?

**HYPOTHESIS:** No fundamental tension — the unit-system choice (px vs. mm/pt) and the shaping/layout-determinism requirement are independent axes; choosing px for Web閲覧用 doesn't grant it an exemption from needing the same custom logical layer everything else needs.

**METHOD:** Direct reasoning from the Architecture Research Matrix's cross-cutting finding, applied to the Web preset specifically; cross-referenced against the current codebase's own documented isPx/PX_PER_MM vs. CSS_PX_PER_MM_96DPI confusion (Compatibility Matrix).

**EVIDENCE:** `WEB_PRESET_RESEARCH.md` §3–4.

**RESULT:** Hypothesis confirmed; additionally surfaced a concrete, already-real risk (the two similarly-named conversion constants) worth carrying into Phase 3 design explicitly.

**DECISION: ACCEPT.**

**WHY:** Directly follows from the cross-cutting finding plus a real, already-encountered bug-risk pattern in the existing codebase.

**NEXT:** Phase 3 schema design should ensure Web閲覧用's unit handling doesn't reproduce the current dual-constant confusion.

---

## P1-L09 — Colophon within the Canonical Layout Model

**QUESTION:** Can HD-006's requirement (colophon as a formal Canonical Layout Model element) actually be satisfied given colophon's real structural difference (horizontal writing-mode) from body pages?

**HYPOTHESIS:** Yes, achievable as page-layer metadata (an orientation/writing-mode flag) rather than requiring a wholly separate model, because the lower layers (clusters, positioned glyphs) are not inherently vertical-only.

**METHOD:** Direct reasoning from P1-L06's layered model applied to colophon's documented current implementation (Compatibility Matrix's colophon row, TSP-LOOP-005).

**EVIDENCE:** `COLOPHON_RESEARCH.md` §2–5.

**RESULT:** Confirmed feasible; surfaced a concrete new Phase 2 PoC requirement — the Publication renderer must be tested against a mixed vertical+horizontal-writing document, not just uniform vertical text.

**DECISION: ACCEPT** (feasibility); flagged as a required Phase 2 PoC test case, not yet run.

**WHY:** Follows directly from the layered model's own logic; the mixed-writing-mode Publication test is a genuinely new requirement this loop surfaced that wasn't explicit in Master/Freeze before this analysis.

**NEXT:** Add "mixed vertical+horizontal-writing PDF output" as an explicit Phase 2 PoC test case.

---

## P1-L10 — Standards grounding for TateSpun's typography rules

**QUESTION:** Which of TateSpun's current typography rules (kinsoku, hanging, ruby, TCY, dash/ellipsis, punctuation spacing) are backed by a real citable standard (jlreq/JIS/OpenType/Unicode), vs. app-specific conventions that should be documented as such rather than disguised as "the standard" (per Master §5.3–5.4's magic-number-prohibition/category-rules-permitted distinction)?

**HYPOTHESIS:** Most are standards-backed at the category level; a few specific numeric thresholds (TCY digit count) are app-specific choices layered on soft standards guidance.

**METHOD:** Direct fetch of jlreq (W3C TR), the OpenType spec's vertical/spacing feature definitions, and UAX #11/#14, targeting each TateSpun rule individually.

**EVIDENCE:** `../research/typography-standards/jlreq-jis-opentype-standards-research.md`, full summary table at the end of that document.

**RESULT:** Hypothesis confirmed for most items (kinsoku classes, ぶら下げ scope, ruby overflow, punctuation spacing via `vchw`/`vhal`/`vpal`, vertical glyph selection via `vert`/`vrt2`, full/half-width Latin via UAX #11 all standards-backed with citations of varying confidence). TCY's exact threshold confirmed as a soft convention, not a hard standard. Dash/ellipsis inseparability and "natural pitch, no stretch-to-fill" were **not fully confirmed** against literal clause text this pass — both flagged explicitly as needing a follow-up direct read before Phase 2 treats them as citable rather than app-convention.

**DECISION: ACCEPT** (for the confirmed items); **OPEN** (dash/ellipsis inseparability's exact jlreq citation, and the precise class enumeration beyond cl-01/02/06/07).

**WHY:** The research agent itself flagged these as fetch-summarization-derived rather than raw-text-verified, and recommended a specific follow-up (direct jlreq §3.1.10 read, JIS X 4051 table mirror) rather than treating the summary as final.

**NEXT:** Before Phase 2 hard-codes kinsoku character-class constants, do the recommended direct (non-summarized) read of jlreq §3.1.10 and the JIS X 4051:2004 table.

---

## P1-L10a — Source-closeout follow-up on P1-L10's two OPEN items (timeboxed, 2026-09-05)

**QUESTION:** Can direct (non-summarized) reads of jlreq and JIS X 4051 close P1-L10's two open items — (1) dash/ellipsis inseparability citation, (2) full kinsoku class enumeration beyond cl-01/02/06/07?

**HYPOTHESIS:** A direct fetch targeting the specific claimed section (jlreq "§3.1.10") and the jlreq character-class appendix will either confirm or correct the earlier citations.

**METHOD:** Six targeted WebFetch passes: three against `https://w3c.github.io/jlreq/` (the living W3C document) asking for verbatim text of the dash/ellipsis rule and the character-class appendix table, and asking explicitly for the document's real section numbering (to check whether "§3.1.10" is accurate); two against the JIS X 4051:2004 mirror at kikakurui.com/x4/ asking for the same content and for navigation links to the relevant sub-page; one asking kikakurui.com's page for its own outbound links to locate the right sub-page. Timebox: 30 minutes, respected.

**EVIDENCE:**
- **Correction, not confirmation:** jlreq's own visible table of contents, as returned by the fetch tool, does **not** show a "§3.1.10" — the document's top-level sections returned were "1. Introduction," "2. Basics of Japanese Composition," "3. Line Composition," "4. Hanmen Design," with no finer subsection numbering surfaced. The earlier Phase 1 citation of "jlreq §3.1.10" for dash/ellipsis inseparability **could not be corroborated as a real section number** in this pass — it should be treated as an artifact of the earlier fetch-summarization pass (which may have been extrapolating a plausible-sounding number) rather than a verified citation, until proven otherwise by a source that actually shows document-internal section numbers (e.g., a PDF or paginated print edition with numbered clauses, which the live HTML document may not carry in the same form).
- **No dash/ellipsis inseparability rule found**, either in jlreq (three attempts, including one explicitly searching for ダーシ/三点リーダ/長音記号/一の字点 and terms like "同じ行"/"kept together") or in the JIS X 4051:2004 kikakurui.com mirror's accessible preamble page. This is a genuine "not found in what was accessible," not a confirmed absence — the fetch tool repeatedly reported that relevant content (an appendix, or sibling pages of the JIS mirror) exists but was outside what it could retrieve/summarize for a document of this size, i.e. this is at least partly a **tool-capability limit** (very large single-page HTML document; a small summarization model given a truncated view), not solely an evidentiary negative.
- **Partial, real progress on kinsoku classes:** the fetch tool's inline-reference scan of jlreq's body text confirmed additional class numbers beyond the previously-verified cl-01/02/06/07 — specifically cl-15 (hiragana/平仮名), cl-16 (katakana/片仮名), cl-19 (ideographic/漢字等), and cl-27 (unnamed in the summary) all appear as inline citations in the document's running text, confirming the class-numbering scheme genuinely extends at least to cl-27. However, the **formal appendix table itself** (with every class's full name and example characters, referenced in-document as `#character_classes`) could not be retrieved — the fetch tool explicitly reported the appendix exists (via the document's own internal link fragments) but was not present in the content slice it processed.

**RESULT:** Item 2 (kinsoku classes) is now better-evidenced than before (real confirmation the scheme extends to cl-27, not just cl-01/02/06/07) but still not fully closed — the complete class-to-character mapping remains unretrieved. Item 1 (dash/ellipsis) is **not closed**, and the earlier citation that named it is now flagged as unreliable rather than merely "needs re-verification."

**DECISION: OPEN**, both items — but with an important correction attached to item 1 (see above), and incremental evidence attached to item 2.

**WHY:** A 30-minute timeboxed pass with a fetch-and-summarize tool cannot force retrieval of content a single fetch call's context window truncates before reaching it. This is an honest tool-capability limit, not a decision to stop looking prematurely — three independent attempts were made against jlreq alone, varying the prompt each time to target the appendix specifically.

**NEXT (carried forward to Phase 2, not resolved here):** The appendix table and the dash/ellipsis rule (if it exists at all in jlreq — it may instead live only in JIS X 4051 proper, which jlreq might merely reference rather than reproduce) need either: (a) a fetch against a smaller, paginated, or PDF version of jlreq/JIS X 4051 where a single fetch call's context can actually reach the appendix section rather than truncating before it, or (b) direct human access to a physical/PDF copy of JIS X 4051:2004. Until then, Phase 2 should treat TateSpun's dash/ellipsis run-inseparability rule as an **app-specific convention**, not a cited standard, in any code comments or documentation it produces — this is now a firmer conclusion than P1-L10's original "not yet confirmed," since a dedicated follow-up specifically failed to confirm it rather than simply not having looked yet.

---

## Summary

| Loop | Decision |
|---|---|
| P1-L01 Browser-native ceiling | ACCEPT |
| P1-L02 Canvas as upgrade | REJECT (for editing surface); viable for rasterization only |
| P1-L03 SVG as upgrade | OPEN |
| P1-L04 HarfBuzz/WASM feasibility | ACCEPT |
| P1-L05 Publication path alternatives | ACCEPT (partial) |
| P1-L06 Canonical Layout Model feasibility | ACCEPT (feasibility); OPEN (schema) |
| P1-L07 Preview/Publication separation | ACCEPT |
| P1-L08 Web preset unit model | ACCEPT |
| P1-L09 Colophon in Canonical Layout Model | ACCEPT (feasibility); new PoC test case surfaced |
| P1-L10 Standards grounding | ACCEPT (mostly); OPEN (2 items need direct-text follow-up) |
| P1-L10a Source-closeout follow-up (timeboxed) | OPEN, both items — dash/ellipsis citation corrected (earlier "§3.1.10" unverifiable), kinsoku class scheme confirmed to extend to at least cl-27 but full table still unretrieved (tool-capability limit, not a confirmed negative) |

No rejected hypothesis is silently reopened without new evidence, per the loop-engineering rule. See `PHASE1_REJECTION_REGISTER.md` for the formal rejection entries.

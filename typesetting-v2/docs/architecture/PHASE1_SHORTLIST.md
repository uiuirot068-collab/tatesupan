# Phase 1 — Shortlist for Phase 2 Proof-of-Concept

- Status: Phase 1 draft, pending Human Review
- **FINAL ARCHITECTURE NOT SELECTED HERE.** This narrows the field to candidates worth building small, comparable proofs-of-concept for in Phase 2 (Master §14). Selection remains a later Human Gate, after Phase 2 evidence, per Master §7/§14.
- Built from: `PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`, `CANONICAL_LAYOUT_MODEL_RESEARCH.md`, `PUBLICATION_OUTPUT_RESEARCH.md`, `JAPANESE_SHAPING_RESEARCH.md`, `../../research/PHASE1_LOOP_LOG.md`, `../../research/PHASE1_REJECTION_REGISTER.md`

All three candidates share the same Canonical Layout Model premise (per Master §1.2–1.3 and `CANONICAL_LAYOUT_MODEL_RESEARCH.md`) and the same starting point: extracting/re-grounding the current `tategaki.ts` kinsoku/hanging/ruby/TCY logic against jlreq citations, consolidating its currently-duplicated pagination/caret-mapping implementations. They differ in how much further they go on shaping control and Publication rigor.

---

## Candidate 1 — Evolved Preview, Custom Publication ("Pragmatic Hybrid")

**Architecture concept:** Keep Preview close to today's proven DOM/CSS absolute-positioning approach (FixedSlot's positioning discipline, not its DOM-screenshot export path) — it already works and DOM gives editing UX for free. Extract the kinsoku/hanging/ruby/TCY logic into a renderer-independent Canonical Layout Model module. For Publication, adopt path (b1): drive the existing internal Vivliostyle/Chromium print-to-PDF spike, pending the R-004 empirical test.

**Strengths:** Lowest migration risk — Preview UI/UX barely changes from today; reuses an already-existing internal spike (Vivliostyle) rather than building new Publication infrastructure from scratch; fastest realistic path to a working Phase 2 PoC.

**Weaknesses:** Publication quality ceiling is capped by whatever Chromium's print-to-PDF actually delivers for vertical CJK — not yet empirically verified (R-004); does not solve the "shaping is opaque to the author" problem (`css-svg-vertical-japanese-research.md` item 6) at the Preview layer, since Preview still relies on browser-native glyph rendering within DOM spans, same as today.

**Publication-quality ceiling:** Medium — bounded by Chromium's own vertical-CJK PDF correctness, unverified.

**Preview strategy:** DOM/CSS absolute-positioned spans (today's model), fed by the extracted Canonical Layout Model instead of ad hoc inline logic.

**PDF strategy:** Chromium/Vivliostyle print-to-PDF (path b1).

**JPG strategy:** Rasterize the same finalized page (via pdf.js/pdfium canvas rendering) rather than screenshotting a live DOM — decouples JPG from screen pixel density (`PUBLICATION_OUTPUT_RESEARCH.md` §5).

**Shaping strategy:** No new shaping engine — continue relying on Chromium's own text shaper for glyph rendering, mitigated only by the extracted logical layer's kinsoku/hanging/ruby/TCY decisions (which control *what* renders where, not *how* each glyph is shaped).

**Privacy:** Fully client-side if Vivliostyle's Puppeteer/Chromium step can run client-side (needs confirmation) or requires a server-side print step (needs confirmation) — **this is an open question this candidate must answer in Phase 2**, since Puppeteer traditionally implies a server-side headless browser process, which could be a Privacy Contract (Master §12) consideration if manuscript content must leave the client to reach it.

**Migration:** Lowest of the three — Preview/editor UI is barely touched.

**Risk:** Publication ceiling dependent on unverified third-party (Chromium) behavior; the Puppeteer/server-side question above is a real architectural unknown, not a detail.

**Phase 2 experiment required:** The R-004 test (render the Regression Corpus through the existing Vivliostyle spike, check selectability/glyph-correctness/physical accuracy) **and** resolve whether this pipeline can run client-side or requires a server component.

---

## Candidate 2 — Full Custom Shaping Core ("Maximal Ceiling")

**Architecture concept:** A HarfBuzz-via-WASM shaping core, driving a shared Canonical Layout Model that both Preview and Publication renderers consume. Preview paints the shaped output via DOM absolute-positioning or SVG per-glyph coordinates (either satisfies the same ceiling per `PHASE1_ARCHITECTURE_RESEARCH_MATRIX.md`'s Family C finding). Publication uses path (b2): a hand-built PDF-operator layer (WMode/Identity-V + per-CID positioning) driven directly by the same shaping core's output, giving genuine vector/selectable vertical CJK text.

**Strengths:** Highest achievable ceiling on every axis — shaping is fully controlled (not opaque to browser quirks), Publication text is genuinely vector/selectable, one shaping core serves both Preview and Publication, eliminating a class of Preview/Publication divergence risk that Candidate 1 keeps.

**Weaknesses:** Highest engineering cost and newest skillset requirement (WASM/OpenType internals) for the team; bundle size and shaping-correctness against TateSpun's actual fonts not yet measured (`JAPANESE_SHAPING_RESEARCH.md` §6); hand-building PDF operators is a substantial, high-QA-cost undertaking (`PUBLICATION_OUTPUT_RESEARCH.md` §4).

**Publication-quality ceiling:** Highest — genuine vector/selectable text, full shaping control, no dependency on any browser's internal behavior.

**Preview strategy:** DOM or SVG paint surface, consuming the shaping core's exact glyph output — Preview and Publication share the same shaped positions, only the paint API differs.

**PDF strategy:** Hand-built PDF-operator layer (path b2) — highest cost, highest ceiling.

**JPG strategy:** Same shaping core's output rendered to canvas at controlled DPI — same solved-problem status as Candidate 1's JPG approach, but sourced from the custom shaping core instead of a Chromium print pipeline.

**Shaping strategy:** HarfBuzz-via-WASM (harfbuzzjs), giving `vert`/`vrt2`/`vpal`/`vkrn` OpenType feature application "for free" per the font's own tables (`JAPANESE_SHAPING_RESEARCH.md` §2–3).

**Privacy:** Highest — WASM shaping runs entirely client-side, no server dependency for the shaping step itself; the PDF-operator layer can also run client-side (it's just data assembly, no browser-automation dependency unlike Candidate 1's Vivliostyle path).

**Migration:** Highest of the three — both Preview's rendering internals and the entire Publication pipeline change.

**Risk:** Largest unknowns are engineering-execution risk (has anyone on the team built a PDF-operator layer or integrated harfbuzzjs before?) rather than technical-feasibility risk (the research found no structural blocker, only unmeasured costs).

**Phase 2 experiment required:** A small technical spike — shape the Regression Corpus's canonical sentence through harfbuzzjs, measure bundle size, verify vertical glyph output correctness against a real font (e.g. Shippori Mincho), and prototype emitting a minimal WMode/Identity-V PDF for that same sentence to confirm the hand-built-operator approach is tractable before committing to it for the full engine.

---

## Candidate 3 — Unified Browser Pipeline ("Conservative Evolution")

**Architecture concept:** Keep DOM/CSS as the technology for *both* Preview and Publication (via Chromium print-to-PDF, same as Candidate 1's Publication path, but here also used for Preview's own internal consistency guarantee — i.e., Preview and Publication share literally the same rendering technology, which Master §1.2 permits but does not require). Investment goes entirely into extracting and hardening the jlreq-grounded logical layer as a single shared module, without adopting any new shaping engine or PDF-operator layer.

**Strengths:** Lowest total new-technology surface area — no WASM shaping engine, no hand-built PDF layer, no separate Preview/Publication technology to keep in sync; directly builds on the existing Vivliostyle spike and existing `tategaki.ts` logic with the least net-new infrastructure.

**Weaknesses:** Inherits every Chromium-specific gap found in `css-svg-vertical-japanese-research.md` (opaque punctuation advance, no native hanging/ruby-overhang/TCY-auto-detect) at *both* the Preview and Publication layers, since both now depend on the same browser engine's shaping — this candidate has the lowest quality ceiling of the three specifically because it doesn't introduce the shaping-control layer that Candidates 1–2 use to compensate. Text vector/selectability for Publication is no better than Candidate 1, and unlike Candidate 1, this option doesn't even keep Preview technology distinct as an area for future independent improvement.

**Publication-quality ceiling:** Lowest of the three — no shaping-control compensation layer for either renderer's actual glyph output; only the logical layer (page breaks, kinsoku decisions, ruby attachment *decisions*, not glyph shaping) is improved over today.

**Preview strategy:** Same technology as Publication (Chromium/CSS), differing only in pagination mode (live interactive vs. print-formatted).

**PDF strategy:** Chromium/Vivliostyle print-to-PDF (same as Candidate 1, path b1), pending the same R-004 verification.

**JPG strategy:** Same as Candidate 1.

**Shaping strategy:** None beyond browser-native — this candidate explicitly accepts the ceiling documented in `css-svg-vertical-japanese-research.md` rather than compensating for it.

**Privacy:** Same open question as Candidate 1 (Puppeteer/server-side dependency unconfirmed).

**Migration:** Low — similar to Candidate 1.

**Risk:** The research gives no evidence this candidate clears Publication Quality for the specific features Master cares about (hanging punctuation, long-ruby overflow, TCY auto-detection all remain unshipped in Chromium regardless of which pipeline stage uses it) — this is this candidate's central, well-evidenced risk, not a speculative one.

**Phase 2 experiment required:** Same R-004 test as Candidate 1, plus an explicit side-by-side comparison against the Regression Corpus's harder cases (long ruby, TCY, hanging 、/。) to confirm whether the extracted logical layer alone (without shaping-engine compensation) is sufficient — this is the specific question that would validate or eliminate this candidate.

---

## How to read this shortlist

Candidate 1 and Candidate 3 share the same Publication path (b1) and differ only in whether Preview also adopts a compensating shaping layer; Candidate 1 is very likely at least as good as Candidate 3 on every axis for comparable near-term cost, so **Candidate 3 is retained mainly as the "do we even need shaping compensation" control case for Phase 2's comparative PoC**, not because it's expected to win. Candidate 2 represents the highest-ceiling, highest-cost end of the range. Phase 2's job is to run comparable PoCs (using the Regression Corpus, per Master §11.3/§14) across at minimum Candidate 1 and Candidate 2, with Candidate 3 as a baseline/control, and report back with evidence — not to guess which one wins from this document alone.

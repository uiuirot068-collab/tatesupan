# Phase 1 — Rejection Register

- Status: Phase 1 draft, pending Human Review
- Purpose: record what was downweighted/rejected during Phase 1 research, with evidence, so Phase 2/3 doesn't quietly re-litigate the same question without new evidence.

---

## R-001 — Canvas as the live editor's interaction surface

**Candidate:** Building TateSpun Engine v2's editor (the live, editable writing surface — not Preview/Publication) directly on Canvas 2D, with hand-rolled caret/selection/IME handling.

**Reason rejected:** Canvas 2D has zero native vertical-writing-mode support (an open browser feature request since 2013) and its own `measureText`/`TextMetrics` API is explicitly flagged by browser-standards contributors (the Igalia canvas-formatted-text explainer) as insufficient for structured/editable text tooling — the exact category TateSpun's editor is. No compensating quality benefit was found: the one real documented CJK-vertical Canvas architecture (koharu.rs) still does all shaping externally via HarfBuzz and uses Canvas purely as a paint surface, meaning Canvas would add the cost of rebuilding text-editing UX from scratch while gaining nothing on the actual hard problem (kinsoku/hanging/ruby/TCY layout).

**Evidence:** `../research/shaping/canvas-harfbuzz-shaping-research.md` items 1–3; `PHASE1_LOOP_LOG.md` P1-L02.

**Blocker:** Structural (no native vertical text; metrics inadequacy is the platform's own stated assessment, not a workaround-able bug).

**Reversible?** Yes, in principle — if a future need arose (e.g. extremely high-performance rendering of read-only content) Canvas could be reconsidered for that narrower role. Not reversible as "the editor surface" without new evidence that the caret/IME/selection rebuild cost is actually justified by a benefit not found in this research pass.

**What would justify reopening:** A concrete, measured performance problem with DOM/CSS-based editing at TateSpun's realistic manuscript scale that Canvas would demonstrably fix, not a general "Canvas might be faster" assumption.

**Not fully closed:** Canvas remains a live candidate for a narrower role — rasterizing already-shaped/positioned glyph output (e.g., for JPG export) — which does not require solving editing UX. This rejection applies specifically to the editor-surface role.

---

## R-002 — Treating browser-native CSS vertical layout as sufficient without a custom logical layer

**Candidate:** Relying on `writing-mode: vertical-rl` + native CSS text layout (kinsoku via `line-break: strict`, hanging via `hanging-punctuation`, ruby via native `<ruby>`, TCY via `text-combine-upright`) without a custom logical layer on top, for any renderer (Preview or Publication).

**Reason rejected:** Specific, named, currently-true gaps confirmed against primary sources: `hanging-punctuation` has zero Chromium implementation; `ruby-overhang` (long-ruby overflow) is Safari-only; `text-combine-upright: digits` (TCY auto-detect) is unimplemented in any browser; punctuation advance width is opaque and demonstrably font-fragile even inside browser engines (a real, historical production bug). A W3C-maintained gap-analysis document independently corroborates multiple cross-engine divergences in this exact feature set.

**Evidence:** `../research/browser/css-svg-vertical-japanese-research.md` items 2–7; `PHASE1_LOOP_LOG.md` P1-L01.

**Blocker:** Structural (unshipped/UA-discretionary spec behavior, not a bug fixable by TateSpun).

**Reversible?** Only if the relevant browsers ship the missing features to spec completeness and TateSpun is willing to accept Safari-only or partial-support behavior on other engines in the meantime — not reversible on Chromium today.

**What would justify reopening:** Chromium shipping `hanging-punctuation`, `ruby-overhang`, or `text-combine-upright: digits` to parity with the spec — a checkable, objective trigger, not a subjective reassessment.

---

## R-003 — Full CJK vertical vector PDF via an existing high-level JS library, unmodified

**Candidate:** Using pdf-lib, PDFKit, or jsPDF's existing high-level text APIs to produce vector, selectable, vertical-writing-mode CJK PDF output "out of the box."

**Reason rejected:** None of the three libraries expose vertical CJK layout as an API — confirmed via an unresolved, multi-year-old open issue directly asking this question (PDFKit #971) with no maintainer resolution, and confirmed by the absence of any WMode/Identity-V/vertical-metrics mention in either library's official documentation. CJK font embedding itself is additionally a documented source of active, unresolved bugs (glyph vanishing, subset corruption) in both libraries.

**Evidence:** `../research/pdf/publication-output-path-research.md` items 1–3; `PHASE1_LOOP_LOG.md` P1-L05.

**Blocker:** Structural (library capability gap, not a configuration issue).

**Reversible?** Yes — if either library's maintainers ship vertical-CJK support, or if a hands-on test of the existing APIs (not yet performed) reveals a workable manual approach using their low-level operator access that this research didn't fully explore.

**What would justify reopening:** A library release note or changelog entry confirming vertical CJK/WMode support, or a Phase 2 hands-on spike demonstrating a workable manual low-level-operator approach that meets quality/effort expectations.

**Not fully closed:** The libraries' low-level raw-operator access (not their high-level text APIs) remains a viable foundation for a custom-built PDF-operator layer (Publication research path b2) — this rejection applies to relying on their high-level APIs unmodified, not to the libraries as a foundation entirely.

---

## R-004 — Vivliostyle (or any Chromium-print-to-PDF pipeline) as a solved, no-further-verification-needed Publication path

**Candidate:** Adopting the existing internal Vivliostyle spike as the Publication renderer on the assumption that "it uses real browser CSS layout, so vertical CJK PDF quality is already solved."

**Reason rejected — this is a partial rejection of an assumption, not of the technology itself:** Vivliostyle's PDF output is entirely inherited from Chromium's own Skia/PDF print pipeline (confirmed: it drives Puppeteer/real Chromium). This research did not find independent verification that Chromium's print-to-PDF actually produces correct, selectable vertical-CJK text for TateSpun's specific fonts — the assumption of "solved" is unverified, not confirmed false. Treating it as settled without a hands-on test would be premature.

**Evidence:** `../research/pdf/publication-output-path-research.md` item 4; `PHASE1_LOOP_LOG.md` P1-L05.

**Blocker:** Evidentiary gap, not a structural blocker — this is the weakest rejection in this register and is really a "don't skip the test" flag.

**Reversible?** Trivially — a Phase 2 empirical test resolves this either direction.

**What would justify reopening (i.e., closing this gap in Vivliostyle's favor):** A direct Phase 2 test rendering TateSpun's actual Regression Corpus through the existing Vivliostyle spike to real PDF, then checking (a) text selectability, (b) correct vertical glyph forms for punctuation/dash/ellipsis, (c) physical dimension accuracy. This is the single most concrete, cheapest-to-run Phase 2 action this Phase 1 research identified.

---

## R-005 — Assuming TCY's threshold, and dash/ellipsis inseparability, are "the standard" without further verification

**Candidate:** Documenting TateSpun's current TCY trigger rule (e.g. exactly 2 digits) and dash/ellipsis run-inseparability rule as directly standards-mandated, rather than as app-specific conventions.

**Reason rejected:** jlreq documents TCY-for-2-digit-numbers only as a customary/soft example, not a hard normative threshold — treating a specific numeric threshold as "the standard" would overstate the evidence. Dash/ellipsis inseparability was not confirmed against jlreq's literal clause text in this research pass (the fetch tool's summary indicated the relevant section defers to JIS X 4051 for the detailed character list, which was not independently re-fetched).

**Evidence:** `../research/typography-standards/jlreq-jis-opentype-standards-research.md` items 4–5; `PHASE1_LOOP_LOG.md` P1-L10, P1-L10a.

**Blocker:** Evidentiary gap (not yet verified either way for dash/ellipsis; confirmed-as-soft-not-hard for TCY).

**Update (2026-09-05, P1-L10a, timeboxed closeout attempt):** A dedicated follow-up specifically tried to close this via six targeted fetches against jlreq and the JIS X 4051 mirror. Result: the earlier citation "jlreq §3.1.10" for dash/ellipsis could **not** be corroborated — jlreq's own visible table of contents shows no such subsection number, so that citation should be treated as unreliable, not merely unverified. No dash/ellipsis inseparability rule was found in either source's accessible content, though this is partly a tool-capability limit (the fetch tool could not retrieve jlreq's character-class appendix, which it confirmed exists via internal link references but was too large to reach in one pass) rather than a clean confirmed negative. Kinsoku class coverage improved: inline citations within jlreq's body text confirm the class scheme extends to at least cl-27 (cl-15 hiragana, cl-16 katakana, cl-19 ideographic, cl-27 also cited), beyond the previously-verified cl-01/02/06/07 — still short of the complete formal table.

**Reversible?** Yes — a read of jlreq/JIS X 4051 through a tool or format that doesn't truncate before reaching the appendix (a PDF, a paginated version, or direct human access to a physical/PDF copy of JIS X 4051:2004) would resolve the dash/ellipsis question either direction, and could complete the kinsoku class table.

**What would justify reopening:** The above follow-up, via a fetch method that can actually reach jlreq's appendix content. Until then, Phase 2 should document TateSpun's dash/ellipsis run-inseparability rule explicitly as an **app-specific convention**, not a cited standard — this is now a firmer instruction than before, since a dedicated, timeboxed attempt specifically failed to confirm it.

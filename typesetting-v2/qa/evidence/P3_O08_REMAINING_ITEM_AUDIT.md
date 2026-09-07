# P3-O08 — Remaining Item Audit (before JPG gate), 2026-09-08

Audit only, HEAD `850da83`. Read directly against current code and
`docs/architecture/PHASE3_OPEN_ITEMS.md`'s own P3-O08 row (not from
memory) — the row's own "not yet complete" list (grayscale color space,
paper-size/bleed/trim porting, colophon/folio/header, real image
embedding, Production integration) was written back at round 6/7 and
never revisited since; every yakumono/punctuation round since (12–19)
touched only vertical-glyph paint and punctuation spacing. This audit
re-verifies that list directly against the live code rather than
trusting it still holds.

**On "JPG":** no Phase 3 planning doc (`PHASE3_OPEN_ITEMS.md`,
`TATESPUN_V2_CORE_CONTRACT.md`) names a JPG deliverable at all. It
traces to `docs/architecture/PUBLICATION_OUTPUT_RESEARCH.md` §5 (Phase
1 research): JPG export is "a solved problem regardless of which PDF
path is chosen... rendering the finalized page... to an offscreen
canvas" — deliberately deferred as low-cost/low-risk ONCE a stable
Publication PDF path exists. Zero JPG-related code exists anywhere in
`typesetting-v2/` (confirmed by direct search — every "jpg"/"jpeg"
match in the codebase is in a Phase 1 research/planning doc, not
implementation). "Ready for JPG" therefore means "is Publication PDF
materially stable enough that starting JPG export is a good use of
time," not that JPG has any existing scope to check off.

## Audit table

| Item | Status | Human QA | Blocks PDF | Blocks JPG | Exact next action |
|---|---|---|---|---|---|
| 1. Physical page geometry (文庫 size, content rect, margins) | **D — PASS**. `PublicationPageGeometry` (paper/margins) implemented since the Foundation task; every yakumono QA PDF this whole chain used it (`DIAGNOSTIC_GEOMETRY`). | Implicit (every QA PDF reviewed used it) | No | No | None |
| 2. Shippori Mincho embedding (vector text, font identity, no tofu) | **D — PASS**. Font Embedding Gate (round-named evidence doc), real jsPDF custom-TTF embedding, license-cleared (SIL OFL 1.1). | Yes, historically PASS | No | No | None |
| 3. Ordinary vertical text / GSUB vert/vrt2 | **D — PASS**. Round 6 GSUB audit + round 7 outline paint; ordinary kana/kanji verified. | Yes | No | No | None |
| 4. Punctuation/brackets | **D — PASS (closed 2026-09-08)**. Round 13 legacy-parity edge alignment; round 17 closed period/comma (normal spacing); round 19 closed `！`/`？` (no meaningful A/B difference). | Yes, both CLOSED | No | No | None |
| 5. Small kana | **D — PASS**. 1em canonical advance, real GSUB outline paint; round 14/16 audit found no regression, Human PASS. | Yes | No | No | None |
| 6. Ruby | **D — PASS**. rubyScale=0.5 frozen, real vector paint, Human PASS since round 5. | Yes | No | No | None |
| 7. TCY | **D — PASS**. Real fit-to-width paint, Human PASS. | Yes | No | No | None |
| 8. Dash | **D — PASS**. Real GSUB outline paint, Human PASS. | Yes | No | No | None |
| 9. Ellipsis | **D — PASS**. Native vertical-form glyph, Human PASS. | Yes | No | No | None |
| 10. Manual page break | **D — PASS (inherited)**. Core's `MANUAL_FORCED`/`forcedBreak` closes column+page (Contract §13/INV-006, extensively tested in Core's own suite); Publication maps one `CanonicalPage` → one PDF page directly — no separate Publication-side break logic needed, and none is missing. | No dedicated round, but structurally proven by Core's own 376-test suite | No | No | None (verify visually once, not a code gap) |
| 11. Paragraph break / first-line indent | **D — PASS**. `line.indentTick`/`indentMm` (Human Product Decision A, 一字下げ) is folded directly into each unit's own `topMm` in `paintModel.ts` — confirmed by direct read; Publication paint requires no separate indent-handling code because the offset is already baked into the canonical position it reads. | Not dedicated, but the same mechanism Preview already got Human PASS on | No | No | None |
| 12. Page/column clipping | **D — PASS (inherited)**. The last-atom `heightMm` "approximate" clamp (`Math.min(guess, remainingLineExtentTicks)`) is shared code in `paintModel.ts` between Preview and Publication — Preview's own clipping-HOLD fix (P3-O09) already covers this file for both renderers. | Inherited from P3-O09 CLOSED | No | No | None |
| 13. Deterministic output | **D — PASS**. Proven directly, repeatedly, across every round in this chain (compose-same-source-twice tests). | N/A (structural proof) | No | No | None |
| 14. Vector-only manuscript requirement (no screenshot/raster text) | **D — PASS**. Architectural guarantee, not a claim — `pdfGenerator.ts` never touches a DOM/canvas/screenshot; jsPDF vector primitives only, confirmed by direct read of the module's own header. | N/A (structural) | No | No | None |
| 15. Grayscale / monochrome color space | **C — separate open item, non-blocking**. Every paint command uses pure black (`setFillColor(0,0,0)`/`setDrawColor(0,0,0)`) — visually monochrome — but jsPDF emits DeviceRGB, not an explicit DeviceGray color space declaration. Per `PUBLICATION_OUTPUT_RESEARCH.md` §7, this is "not a blocker under either path" (both pdf-lib/PDFKit support true DeviceGray if ever needed) — a real but low-risk spec-compliance gap, not a visual defect. | No | No (visual output already reads as black/white) | No | If Production ever requires a literal DeviceGray PDF color space (not just visually-black RGB), a small jsPDF-level change would be needed — not scoped yet |
| 16. Bleed / trim (トンボ) | **C — separate open item, non-blocking for typography PASS**. Confirmed absent from `renderer/publication/` (no bleed/trim/トンボ code). Per `PUBLICATION_OUTPUT_RESEARCH.md` §6, hand-drawn トンボ is the expected approach under any path — not yet built here. Blocks a true "print-ready" PASS but not a typography-correctness Human PASS. | No | No (typography), Yes (print-ready) | No | Needs its own scoping/implementation round if physical print submission is imminent |
| 17. Folio / header | **C — separate open item**. `CanonicalPage.folio?` exists in Core's own schema (confirmed) but Publication never reads or paints it — confirmed by direct search, zero "folio" references in `renderer/publication/pdfGenerator.ts`'s own logic (only a doc-comment citing the schema field). Not implemented. | No | No | No | Needs its own scoping round: what folio content (running page number? title?) and where it paints |
| 18. Image support | **C — separate open item, real functional gap**. `pdfGenerator.ts`'s own IMAGE branch is an unconditional vector-rectangle placeholder (confirmed, unchanged since Foundation) — no real image resolution/embedding exists. Any manuscript using inline images cannot get a real Publication PDF for those pages yet. | No | Yes, for image-containing manuscripts only | No | Needs its own scoping round: image format support, embedding mechanism, resolver wiring |
| 19. Structural colophon (奥付) | **C — separate open item, partially scaffolded**. `core/colophon/index.ts`'s `composeColophon` exists (Core Contract §15) — a `ColophonBlock` with its own isolated pages, never threaded through body composition. NOT wired into Publication's own `buildPaintPlan`/`generatePublicationPdf` at all (confirmed — `pdfGenerator.ts` never imports/reads `ColophonBlock`). Core-side data model exists; Publication-side rendering does not. | No | No (manuscripts without colophon), Yes (manuscripts needing one) | No | Needs a Publication-side colophon paint path once Core's own colophon composition is exercised end-to-end |
| 20. Warnings / HOLD behavior | **D — PASS**. `generatePublicationPdf` throws explicitly for a HOLD document rather than emitting a partial/silent PDF (confirmed by direct read) — mirrors Preview's own HOLD exclusion. | Implicit | No | No | None |
| 21. PDF metadata / output naming | **Not audited as a frozen requirement** — no Phase 3 doc names a specific metadata/naming contract for P3-O08. Not a gap because nothing was ever promised here. | N/A | No | No | Only relevant if/when a Production integration task defines a naming contract |
| 22. JPG canonical export | **NOT STARTED**. Zero implementation anywhere in `typesetting-v2/`. Deliberately deferred per Phase 1's own research (§5) until Publication PDF is stable — which items 1–14 above show it now materially is, for text-only manuscripts without images/colophon/folio. | N/A | N/A | Yes (this IS the JPG item) | Scope a JPG export task: render the finalized `PublicationDocument`/PDF to a raster canvas at a controlled DPI, independent of screen pixel density (per the Phase 1 research's own recommended approach) |

## Explicitly kept separate / NOT folded into P3-O08 by this audit

Per this round's own instruction — unaffected by anything above:

- **P3-O06** (ruby overhang exact optics) — still its own open item.
- **P3-O07** (auto-TCY detection) — still open.
- **F06** (hanging punctuation, if tracked separately) — untouched.
- Image mixed-line compatibility boundary (`isGridRenderableLine`-equivalent, recorded round 13) — still an open, disclosed gap, unrelated to item 18's own broader "no real image embedding" finding (that one is about IMAGE painting at all; the mixed-line boundary is about a DIFFERENT, narrower legacy-parity caveat).
- Future vertical rule (縦罫線) — documentation-only, untouched.
- Future dakuten attachment — documentation-only, untouched.
- 文章チェックβ — documentation-only, untouched.

None of these were touched, closed, or reopened by this audit.

## Publication QA freshness

`qa/publication/p3-o08/publication-typography-qa.pdf` was regenerated
automatically by `typography.test.ts` during this session's own last
full-suite run (fresh timestamp, HEAD `850da83`'s own behavior) —
confirmed current, not stale. No regeneration action needed.

## Tests

No source changed this round — audit only. Existing full regression
re-run for currency: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09
(Preview) 114/114, P3-O08 (Publication) 219/219 — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Conclusion

**For a TEXT-ONLY manuscript (no inline images, no colophon, no folio,
no print-bleed requirement) — Publication PDF typography is Human PASS
across every unit kind this project models, and the remaining items
(15–19) are real but scoped, non-blocking-for-typography gaps, each
needing its own dedicated round.** JPG export has not been started and
is the next concrete, well-scoped, low-risk task per Phase 1's own
research — but only after a decision on whether image/colophon/folio
support should land first (they change what "the finalized page" even
contains).

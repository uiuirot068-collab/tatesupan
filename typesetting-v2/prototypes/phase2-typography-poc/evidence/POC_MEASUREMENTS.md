# P2-L01 — PoC Measurements

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Scope: 文庫 (1-column) preset only, per loop brief

## 1. 文庫 preset values used (read read-only from `src/constants/paperSizes.ts`, `'文庫'.cols1`)

| Field | Value |
|---|---|
| Paper | 105mm × 148mm |
| marginTop / marginBottom | 14mm / 14mm |
| marginGutter / marginOuter | 15mm / 10mm |
| fontSizePt | 8.5pt |
| lineSpacing | 1.7 |
| charsPerLine | 38 |
| linesPerColumn | 16 |
| columnGap | 0 (1-column mode) |

Font: Shippori Mincho (first/default option in `src/constants/fonts.ts` `FONT_FAMILY_OPTIONS`; same family used for the prior investigated typography issue per project memory). Same family used by all three candidates below — see README §Font fairness.

## 2. Glyph advance vs. ink extent — 。/、 vs. ordinary kana

Measured directly from HarfBuzz-shaped glyph outlines (`font.glyphToPath`, parsed for min/max X/Y in 1000-units-per-em font space), shaped with `vpal=1` (the only vertical GPOS feature this font declares):

| Glyph | Unicode name | yAdvance (em-box consumed) | Ink height | Ink as % of advance | Ink top | Ink bottom |
|---|---|---|---|---|---|---|
| 。 | uniFE12 (vertical kuten) | 1000u | 261u | **26.1%** | 821 | 560 |
| 、 | uniFE11 (vertical touten) | 1000u | 224u | **22.4%** | 816 | 592 |
| け | uni3051.vert (ordinary kana) | 1000u | 821u | 82.1% | 781 | -40 |
| ま | uni307E.vert (ordinary kana) | 1000u | 834u | 83.4% | 806 | -28 |

**Reading:** 。and 、consume a full 1em of column pitch (same as every other character — confirmed in §3 of SHAPING_EVIDENCE.md, `vpal` does not change this), but their actual ink occupies roughly a quarter of that box, sitting near the *top* of the cell. Ordinary kana ink fills 80%+ of the same box. The visually "large gap" reported after 。/、 is this: for punctuation specifically, ~700-780 units out of every 1000-unit advance are blank, concentrated *below* the glyph's ink (ink bottom at 560/592, next glyph's cell starts at 0) — versus ~150-200 blank units for ordinary kana. This is a measured, font-metric-derived fact (permissible basis for a future category rule per Master §5.4), not an eyeballed pixel offset.

## 3. Column-length check (advance-sum sanity check)

Full canonical sentence (56 characters incl. brackets), shaped end-to-end: sum of `yAdvance` = exactly 56000 font-units under **every** feature combination tested (default, `vert`, `vrt2`, `vpal`, `vhal`, `vchw`, `vkrn`, and combinations) — i.e. **no feature combination available in this font changes the total column length for this sentence.** Confirms §3 of SHAPING_EVIDENCE.md at the whole-sentence level, not just the two flagged sequences.

## 4. C1 vs. C3 pagination-capacity check

Both C1 (explicit grid, `charsPerLine=38`) and C3 (plain `writing-mode:vertical-rl` block, height capped to `38 × fontSizePt`) wrap the 56-character canonical sentence at the **same point** — character 38/39 — confirmed visually in `outputs/comparison-screenshot.png` (both show the sentence split into "…それまでだ。けれど気づけば、どこへ行くにも二人で" (column 1, 38 chars) / "いることが当たり前になっていた。」" (column 2, remainder)). This is expected (§ shortlist: C1's explicit grid at capacity-38 was deliberately set to match C3's natural reflow at the same height) — it demonstrates C1's *capacity is deterministic by construction*, not that C1 currently diverges from C3's wrap point (it doesn't, by design of this test).

C2 was **not** wrapped into a 38-char column in this loop (rendered as one continuous 56-glyph column) — multi-column splitting of the raw HarfBuzz output was out of scope for the 90-minute timebox. **Recorded as OPEN, not silently omitted.**

## 5. Publication (PDF) spike — page geometry

`outputs/c1-c3-bunko-native-printtopdf.pdf` (native Chromium/Edge `--print-to-pdf`, not Vivliostyle — see README §PDF spike for why): page size in the generated PDF matches the requested 105mm × 148mm @page rule; margins visually consistent with the 14/10/14/15mm CSS `@page` margin declaration. Text is **genuinely selectable** (confirmed: the PDF's own text-extraction layer returns the exact source sentence in correct reading order, not an OCR guess or an image). This is a real, previously-unverified-per-Phase-1 (R-004) positive result. **Not verified in this loop:** whether the same pipeline correctly generates a *second page* when content overflows the first — see README/loop log for why this is flagged OPEN rather than PASS.

## 6. What this PoC does NOT measure

- Full-page density / natural-pitch behavior across a filled 文庫 page (Master §5.2) — this loop only exercises one sentence, not a multi-page manuscript.
- Kinsoku, hanging punctuation, ruby, or TCY behavior for any candidate — the canonical sentence in this loop contains none of those (by design, per loop brief's narrow scope); the fuller Regression Corpus (`fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md`) still needs to be assembled and run through these same three candidates in a later P2-L0x loop.

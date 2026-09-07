# P3-O08 — OpenType Outline Paint (Human Visual QA HOLD round 7)

## 1. Dependency Decision

**Human/Product APPROVED adding `opentype.js` as a new dependency**, for
Publication Renderer font-outline access only. `package.json`:

```
"opentype.js": "^2.0.0"          (dependencies)
"@types/opentype.js": "^1.3.10"  (devDependencies, matching this repo's
                                   existing @types/file-saver, @types/jszip
                                   convention)
```

Resolved version: `opentype.js@2.0.0` (exact, confirmed via `npm view`
before install). License: **MIT** — permissive, no attribution burden
beyond normal `package.json`/lockfile metadata; no vendoring, no source
copy, standard `node_modules` dependency. No font files are bundled or
exposed to the user beyond the already-committed, already-license-cleared
Shippori Mincho asset this whole task chain already uses.

**Why required (not optional):** the round-6 GSUB audit
(`P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md`) proved Shippori Mincho's real
vertical-alternate glyphs for small kana + Dash are unreachable through
any Unicode code point, and jsPDF's `text()` API only accepts Unicode
strings — painting the font's real intended glyph shape requires reading
its raw outline data, which this project's own minimal SFNT readers
(`fontCapability.ts`/`fontMetrics.ts`) deliberately never implemented
(contour/flag/delta-coordinate decoding, composite-glyph resolution).

## 2. Architecture Boundary

```
CanonicalDocument (Core, unchanged)
  -> PublicationDocument (paint model, unchanged)
  -> buildPaintPlan (pdfGenerator.ts)
       - gsubReader.ts        : source glyph ID -> vertical glyph ID   (UNCHANGED, round 6)
       - verticalOutlinePaint.ts (opentype.js) : glyph ID -> outline path / bbox ONLY
       - jsPDF (renderPaintPlanToPdf) : vector path emission (moveTo/lineTo/curveTo/fill)
```

`opentype.js` is used for EXACTLY ONE thing:
`font.glyphs.get(glyphId).getPath(x, y, fontSize)` → real outline
commands. It is never asked to decide wrapping, vertical layout,
kinsoku, ruby placement, TCY detection, or page flow — those remain
entirely Core's and this Renderer's own existing responsibility, provably
unchanged (§9). `gsubReader.ts` (round 6) was **not rewritten** — it
remains the sole authority for "which glyph ID," reused as-is.

## 3. PoC (`verticalOutlinePaint.test.ts`, "opentype.js PoC" describe block)

Against the real committed Shippori Mincho asset:

1. **Font parses successfully**: `opentype.parse(buf)` → `unitsPerEm=1000`, real `numGlyphs`.
2. **Glyph retrieval by ID**: `font.glyphs.get(15228)` → `glyph.index === 15228`.
3. **Vertical alternate glyph 15477 (っ's GSUB vert alternate) retrieved**: `numberOfContours:1, xMin:279, yMin:118, xMax:908, yMax:562, advanceWidth:1000`.
4. **Outline/path exists**: real, non-empty command stream — `["M","Q","L"]` command types for this glyph (confirmed by direct dump, not assumed).
5. **Bbox reads correctly**: `getBoundingBox()` gives a real, non-degenerate box.
6. **Converts to deterministic jsPDF-paintable commands**: every output command is `M`/`L`/`C`/`Z` only (no `Q` survives), and converting twice yields an identical result.

## 4. TrueType Curves — Q → C Conversion

Real audit result for every target glyph
(`REAL_GLYPH_HAS_Q` in `verticalOutlinePaint.test.ts`): 8 of the 9
target glyphs (all kana alternates) DO contain quadratic (`Q`) segments;
the dash alternate (15901) does not (it's built entirely from straight
lines — a simple bar shape). **Both cases are handled by the same code
path**, not special-cased.

**Formula used** (standard, lossless quadratic-to-cubic Bézier degree
elevation — not an approximation/flattening): given current point `P0`,
quadratic control point `Q1`, and endpoint `P2`:

```
C1 = P0 + (2/3)*(Q1 - P0)
C2 = P2 + (2/3)*(Q1 - P2)
```

Tested three ways: (a) a hand-computed synthetic case
(`P0=(0,0), Q1=(10,10), P2=(20,0) → C1=(20/3,20/3), C2=(40/3,20/3)`,
verified by hand-arithmetic, not merely asserted), (b) a degenerate case
(control point coincident with the start point), (c) against EVERY real
`Q` command opentype.js emits for all 9 target glyphs — confirmed no `Q`
survives conversion for any of them. No flattening into line segments —
each quadratic segment becomes exactly one cubic segment.

## 5. jsPDF Vector Path Bridge

`opentype.js`'s own `Glyph.getPath(x, y, fontSize)` already performs
translation, unitsPerEm→target-unit scaling, and the Y-axis flip
(confirmed by direct read of its own source:
`p.moveTo(x + cmd.x*xScale, y + -cmd.y*yScale)`, etc.) — passing `x`/`y`
in **mm** and `fontSize` as **one em's own mm size** (the same
`perCharHeightMm` quantity already used everywhere else in this
renderer) means the returned path commands are ALREADY in mm
page-coordinate space, matching jsPDF's own `unit:"mm"` page. No
separate scale/translate/Y-flip math was hand-written — this reuses
opentype.js's own, already-correct implementation rather than
re-deriving it (per this round's own "don't invent new manual offsets"
principle, extended to coordinate math too).

Horizontal centering (matching jsPDF's own `align:"center"` convention
used throughout this file) is done from the glyph's own REAL
`advanceWidth` (not assumed to equal one em, though it happens to for
this font).

`renderPaintPlanToPdf`'s executor (`pdfGenerator.ts`): for a
`"glyphOutline"` command, each `M`/`L`/`C` maps directly to jsPDF's own
`moveTo`/`lineTo`/`curveTo` (its own lower-level path plugin, confirmed
present via `node_modules/jspdf/dist/jspdf.node.js` — these compile
directly to the PDF content-stream operators `m`/`l`/`c`); each `Z` maps
to `.close()` (PDF `h`). A glyph with multiple contours (e.g. ゅ has 4)
accumulates ALL its contours' `M...Z` sequences before a single `.fill()`
call at the end, letting PDF's own nonzero-winding-rule fill correctly
render enclosed counter-shapes — this is PDF's native multi-subpath
model, not custom logic.

## 6. Small Kana

`VerticalOutlineContext.resolveOutlineGlyphId` correctly resolves outline
glyph IDs for the FULL small-kana set (ぁぃぅぇぉっゃゅょゎ + katakana
equivalents, per `isSmallKana`'s existing generalization — reused, not
re-narrowed) whenever GSUB provides a genuinely unreachable alternate.
**Confirmed broader than "small kana only" (round 6's own finding,
reconfirmed here at the paint-integration level):** ordinary kana つ/た
ALSO resolve to a real outline glyph ID — `verticalOutlineIntegration.test.ts`'s
own "ORDINARY KANA... ALSO paints as glyphOutline" test proves this is
not blocked or special-cased away. Canonical position: unchanged
(`"CANONICAL CELL UNCHANGED"` test — `PublicationDocument` is
byte-identical whether or not an `outlineContext` is supplied). Source:
unchanged (`"SOURCE / SourceSpan UNCHANGED"` test).

## 7. Punctuation

Confirmed: `resolveOutlineGlyphId` returns `undefined` for every one of
「」（）、。 in a real mixed fixture (`"「今日は、雨だった。」"`) —
these continue painting via the EXISTING, unchanged "text" command using
the manual Unicode Vertical-Forms substitution (`verticalGlyphMap.ts`,
untouched), which round 6 already proved selects the identical glyph
GSUB itself would. **Glyph selection was never the punctuation bug.**

**On the original `。→」` visual-gap complaint:** this round did NOT
re-render or re-judge that specific symptom — no punctuation paint
mechanism changed (still "text", still the same glyph, still the same
font-derived baseline position from round 5). Per this round's own
explicit instruction, if outline-based vertical-origin paint still left
that gap after a real fix was attempted, it should be recorded as a
SEPARATE punctuation-spacing/yakumono-advance question rather than a
glyph-position problem — but since no punctuation paint mechanism
changed here, this determination is **PENDING HUMAN** re-review of the
regenerated `punctuation-gsub-outline.pdf` (which is byte-observably
identical, for punctuation specifically, to what round 5 already
produced — the file was regenerated to also show the now-fixed kana in
the same fixture, not because punctuation's own treatment changed).

## 8. Dash

Round 6 found the font's real GSUB vertical alternate for ― (glyph
15901) differs from the manually-mapped U+FE31 glyph (15892) and is
itself unreachable via any Unicode code point. This round: **the manual
U+FE31 substitution is now superseded by the font's real GSUB alternate**
whenever an `outlineContext` is supplied —
`verticalOutlineIntegration.test.ts`'s own "Dash: the SEMANTIC_RUN dash
fixture actually resolves to the real GSUB outline glyph (15901), not
the old manual U+FE31" test confirms both dash glyphs in a guaranteed
2-glyph "――" run paint via outline, using glyph 15901, not 15892. No
geometric bars reintroduced. P3-O04's own scope (2-glyph guaranteed
quality, 3+ best-effort) is untouched — only the paint MECHANISM changed,
exactly the same pattern as every prior Dash fix in this task chain.

## 9. Regression

Ruby: untouched (`rubyScale`, Core measurement, Ruby positioning — no
code path touched; `"RUBY unchanged"` integration test confirms an
`outlineContext`'s mere presence doesn't alter Ruby's own plan length/
structure). TCY: untouched (no code path touched at all — TCY never
calls `verticalGraphemeCommands`). Ellipsis: confirmed unaffected
(`resolveOutlineGlyphId` returns `undefined` for … — stays on "text",
`"ELLIPSIS: …… paints entirely as TEXT"` test). Core: zero files under
`core/` touched. Preview: zero files under `renderer/preview/` touched.
`src/`/Production: untouched.

## 10. Performance

`VerticalOutlineContext` parses the GSUB table and the opentype.js
`Font` object **exactly once per document render** (constructor-time,
not per-glyph) — confirmed by the class's own structure (single
`auditGsub`/`parseOpenTypeFont` call in the constructor) and by the
`"is memoized"` test. `resolveOutlineGlyphId` results are cached per
source glyph ID within one context's lifetime (`outlineGlyphCache`), so
a document with many repeated kana characters (the common case) does at
most one GSUB-lookup+reachability-scan per DISTINCT glyph, not per
occurrence. `glyphOutlineCommandsMm` itself is not separately cached
(each call re-derives the position-specific translated path, since the
translation coordinates differ per occurrence) — this is real per-glyph
outline-decode work (opentype.js's own `getPath`), not re-parsing the
font file. PDF size impact: not separately measured this round (no
byte-size regression test was written); qualitatively, embedded vector
fill paths for a handful of characters per document are a small addition
relative to the already-embedded font file.

## 11. Font Embedding

Unchanged: ordinary manuscript text continues through the existing
embedded-font jsPDF `text()` path exactly as before. This task did
**not** convert all text to vector outlines — outline paint applies
ONLY to the specific glyphs `resolveOutlineGlyphId` proves are otherwise
unpaintable (confirmed: `"ORDINARY KANJI... paints entirely as TEXT"`,
`"PUNCTUATION... never appear in an outline command"`).

## 12. QA Artifacts

- `qa/publication/p3-o08/small-kana-gsub-outline.pdf` — `だった。`, real font-derived outline paint.
- `qa/publication/p3-o08/punctuation-gsub-outline.pdf` — `「今日は、雨だった。」`.
- `qa/publication/p3-o08/dash-gsub-outline.pdf` — `――` (SEMANTIC_RUN DASH fixture, real GSUB glyph, not the old U+FE31).
- `qa/publication/p3-o08/publication-typography-qa.pdf` — regenerated with the new `outlineContext` threaded through, so the combined artifact reflects this round's fix, not just round 5's.

All four generated only after every integration test above passed
(19 PoC/unit tests in `verticalOutlinePaint.test.ts` + 14 pipeline tests
in `verticalOutlineIntegration.test.ts`, all green before artifact
generation ran).

## 13. Remaining Blockers

- **Punctuation's original `。→」` visual gap**: not re-judged (§7) —
  needs real Human review of the regenerated combined QA PDF; if the gap
  persists despite correct glyph+origin, treat as a separate yakumono/
  punctuation-advance-spacing question, not a glyph-position bug.
- **PDF file-size/performance** at real document scale: not measured.
- No other known blocker for kana/Dash outline correctness — the
  mechanism is now font-derived end-to-end (GSUB → real outline → real
  vector path), superseding every hand-tuned offset from rounds 4–5 for
  the specific characters that needed it.

## 14. Tests

`verticalOutlinePaint.test.ts` (19: PoC ×6, Q→C conversion ×3,
`VerticalOutlineContext` ×10 — resolution, memoization, cross-check
against the independent GSUB audit, deterministic outline commands,
structural failure for an invalid glyph ID). `verticalOutlineIntegration.test.ts`
(14: small kana / punctuation / ellipsis / ordinary kanji / ordinary kana
paint-path routing, canonical-cell-unchanged, source-unchanged, Ruby
regression, real PDF generation via the full `generatePublicationPdf`
entry point, no-DOM/no-Canvas/no-raster structural check, 3 focused QA
artifacts, the Dash-uses-real-GSUB-glyph proof). `gsubReader.ts` (round
6, 9 tests) unchanged and still passing.

**Full regression:** Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09
(Preview) 114/114, P3-O08 (Publication) 136/136 — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

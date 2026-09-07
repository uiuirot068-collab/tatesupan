# P3-O08 — OpenType Vertical GSUB Audit (Human Visual QA HOLD round 6)

## 1. Verdict

**vmtx/vhea vertical-origin correctness is CONFIRMED, and now proven to be
correctly NOT the root cause of the small-kana/punctuation visual
failures.** The real root cause IS what this round's hypothesis
predicted: Shippori Mincho defines dedicated OpenType `vert`/`vrt2`
glyph-substitution alternates for essentially all kana (small AND
ordinary) and for the dash, and the current Publication paint path never
applies them — it always paints the horizontal-design source glyph (or,
for punctuation, a manually-selected Unicode Vertical Forms substitute).
**This is a genuine technical gate, not a further tuning problem:** the
kana vertical alternates (and the dash's own real vertical alternate) are
NOT reachable through any Unicode code point this font's `cmap` defines —
they exist ONLY as GSUB-selected glyph IDs. jsPDF's `text()` API accepts
Unicode strings, never raw glyph IDs, so it cannot paint them as-is.
Painting them would require decoding raw TrueType glyph outlines
(`glyf` contours) into vector path commands from scratch — substantial
new machinery, correctly out of this round's own scope per its explicit
"if substantial, STOP and report" instruction. **STOPPING here; no
implementation attempted.**

## 2. Why vmtx Was Insufficient

The prior round (`P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md`) proved
`vhea`/`vmtx` give every glyph the SAME vertical origin — correct, and
still true, but it only answers "where does the horizontal baseline sit
within the cell." It says nothing about WHICH glyph outline gets painted.
Human HOLD remained active after that round specifically because fixing
*origin* did not fix the reported visual defects — this round's own
premise (that a *different, GSUB-selected glyph shape* might be involved,
not a position offset) is now directly confirmed.

## 3. GSUB Table

Real audit (`gsubReader.test.ts`, against the exact committed
`ShipporiMincho-Regular.ttf`):

```
hasGsub: true
scriptTags: ["DFLT"]
```

Only one script record (`DFLT`) — this font applies its GSUB features
script-independently (no separate `kana`/`hani`/`latn` script table; a
single default applies to everything), confirmed by direct read of the
ScriptList, not assumed.

## 4. `vert` / `vrt2` Features

| Feature | Present? | Lookup types used | Substitution entries |
|---|---|---|---|
| `vert` | **YES** | `[1]` (SingleSubst only) | 408 |
| `vrt2` | **YES** | `[1]` (SingleSubst only) | 667 |

Both features use ONLY GSUB LookupType 1 (Single Substitution) — no
ligature, no contextual, no extension-wrapped-other-type lookups. This
kept the audit's scope to exactly the lookup type this reader fully
resolves (see `gsubReader.ts`'s own doc comment on what it deliberately
does not implement).

## 5. Small Kana

Real glyph-ID substitution results (`gsubReader.test.ts`), for every
required small-kana character, both hiragana and katakana:

| Char | Source glyph | `vert`/`vrt2` glyph | Different? |
|---|---|---|---|
| っ | 15233 | 15477 | **YES** |
| ゃ | 15265 | 15509 | **YES** |
| ゅ | 15267 | 15511 | **YES** |
| ょ | 15269 | 15513 | **YES** |
| ッ | 15322 | 15566 | **YES** |
| ャ | 15362 | 15606 | **YES** |
| ュ | 15364 | 15608 | **YES** |
| ョ | 15366 | 15610 | **YES** |

**Root cause supported: YES.** Every small-kana character has a real,
distinct vertical-alternate glyph in this font, and the current paint
path never selects it.

**Important scope correction, discovered while building the control
set:** ordinary hiragana つ (glyph 15232→15476, different) and た
(15228→15472, different) ALSO have distinct `vert`/`vrt2` alternates —
this is NOT limited to small kana. Ordinary kanji 日 (4979) has NO
`vert`/`vrt2` entry at all (no substitution). **The font's own
convention is: all KANA (hiragana+katakana, small and ordinary alike)
get a dedicated vertical-glyph redesign; KANJI generally does not.** This
is a real, measured fact, broader than this round's own small-kana-only
framing — recorded honestly rather than narrowed to fit the original
question.

## 6. Punctuation / Brackets

| Char | GSUB `vert` glyph | Existing manual Unicode-presentation-form glyph | Match? |
|---|---|---|---|
| 、 | 15941 | 15941 (U+FE11) | **YES** |
| 。 | 15943 | 15943 (U+FE12) | **YES** |
| 「 | 15844 | 15844 (U+FE41) | **YES** |
| 」 | 15845 | 15845 (U+FE42) | **YES** |
| （ | 15876 | 15876 (U+FE35) | **YES** |
| ） | 15877 | 15877 (U+FE36) | **YES** |

**All six punctuation marks: GSUB and the existing manual Unicode
Vertical-Forms substitution already select the IDENTICAL glyph.** The
prior task's manual mapping was correct — confirmed, not merely assumed
— by cross-checking it against the font's own authoritative GSUB
substitution. **Punctuation requires no change.**

## 7. Dash / Ellipsis

| Char | GSUB `vert` glyph | Manual mapping glyph | Match? |
|---|---|---|---|
| … (ellipsis) | 15766 | 15766 (U+FE19) | **YES** |
| ― (dash) | **15901** | **15892** (U+FE31) | **NO — differ** |

**Ellipsis: confirmed correct, no change needed.** **Dash: a real,
previously-unknown discrepancy.** The font's own GSUB `vert` feature
substitutes the source em dash (U+2015) to glyph 15901 — a DIFFERENT
glyph than the one the manual mapping currently paints (glyph 15892, via
U+FE31, the Unicode "vertical em dash" presentation-form code point).
Checked whether glyph 15901 is reachable via ANY Unicode code point
(`findCodePointForGlyphId`): **it is not** — same unreachability as the
kana alternates (§8). Per this round's own explicit instruction ("do not
reopen Dash's Product policy" — P3-O04's semantic/break rule is
untouched), this is recorded as a genuine, measured discrepancy in glyph
SHAPE selection only, not acted on: painting glyph 15901 has the exact
same "not reachable via jsPDF's text API" blocker as the kana case, so
no change is possible without the same outline-decoder work this task
stops short of (§9).

## 8. Glyph-ID Paint Capability

**jsPDF arbitrary glyph-ID paint: NO.** Confirmed exhaustively in a
prior task (P3-O08 Publication Typography) — jsPDF's entire public API
surface has no glyph-index-addressed text primitive; `text()` accepts
only a Unicode string.

**Are the GSUB-selected vertical alternates reachable via SOME OTHER
Unicode code point (a `findCodePointForGlyphId` reverse-cmap scan,
covering every codepoint this font's cmap actually maps, not merely the
ones already tried)?**

| Glyph | Reachable via any code point? |
|---|---|
| っ's vert alternate (15477) | **NO** |
| ゃ's vert alternate (15509) | **NO** |
| ゅ's vert alternate (15511) | **NO** |
| ょ's vert alternate (15513) | **NO** |
| ッ's vert alternate (15566) | **NO** |
| ャ's vert alternate (15606) | **NO** |
| ュ's vert alternate (15608) | **NO** |
| ョ's vert alternate (15610) | **NO** |
| ―'s vert alternate (15901) | **NO** |

Sanity check: the same reverse-lookup mechanism correctly finds た's own
SOURCE code point (U+305F) for た's own source glyph ID — proving the
"not reachable" results above are genuine absence, not a broken lookup.

**Vertical alternate directly paintable: NO.**

## 9. Outline Fallback Audit

Checked whether the already-parsed `glyf` per-glyph header data (this
project's existing `FontMetricsReader.glyphInkBBox`) shows these
specific unreachable glyphs as simple or composite:

All 9 target glyphs (8 kana alternates + dash alternate) are **simple**
glyphs (`isComposite: false`, contour counts 1–4) — not composite, which
somewhat bounds the scope (no component/transform resolution needed for
this specific character set).

**Even so, this is judged substantial new machinery, not audit-scope
work**, because painting a simple TrueType glyph outline as a real PDF
vector path requires, from scratch:

1. Parsing `endPtsOfContours[]`, `instructionLength`, and skipping
   hinting instructions.
2. Parsing the flags array with its own run-length REPEAT compression
   (flag bit 0x08).
3. Parsing delta-encoded x/y coordinate arrays, each point's encoding
   width and sign determined by two different flag bits per axis
   (short-vector + same-or-positive-sign) — a well-defined but
   easy-to-get-subtly-wrong binary format.
4. Classifying on-curve vs. off-curve points (flag bit 0x01) and
   reconstructing TrueType's IMPLIED on-curve midpoint whenever two
   off-curve points appear consecutively (a real, separate algorithmic
   step, not just coordinate decoding).
5. Converting each resulting quadratic Bézier segment to jsPDF's own
   cubic `curveTo(x1,y1,x2,y2,x3,y3)` primitive (confirmed present in
   jsPDF's type surface, alongside `moveTo`/`lineTo`/`path` — so a vector
   path CAN be drawn without a new dependency, once the outline is
   correctly decoded).
6. A new `PaintCommand` variant (e.g. `{op:"glyphPath", contours, ...}`)
   threaded through the existing pure/jsPDF-free `buildPaintPlan` and the
   mechanical `renderPaintPlanToPdf` executor, plus new branch logic in
   `verticalGraphemeCommands`/`unitCommands` to route unreachable
   characters through it instead of `text()`.
7. A correctness verification path that is NOT just "produces a
   %PDF-prefixed byte buffer" (every existing test's own bar) but
   requires genuine visual/geometric proof that the decoded outline
   matches the font's real design — meaningfully harder to test than
   anything else built so far in this task chain.

**Outline fallback practical without dependency: HOLD** (technically
possible — jsPDF exposes the needed path primitives, the target glyphs
are all simple, not composite — but this is new, first-time, first-party
rendering machinery for this codebase, not an audit-scope fix; building
and correctly verifying it does not fit safely inside this round's own
90-minute audit timebox, and the round's own instructions explicitly
call for STOP-and-report at this exact judgment point).

## 10. Architecture Decision

**STOP.** No glyph-outline decoder implemented this round. No new
`PaintCommand` variant added. No paint-path routing change made. The
existing paint pipeline (Unicode `text()` for everything, including the
already-correct punctuation vertical-forms and the already-correct
ellipsis) is left exactly as it was after the prior round.

`gsubReader.ts` (new, Publication-Renderer-paint-only, same boundary as
`fontCapability.ts`/`fontMetrics.ts` — never imported by/shared with
Core) is committed as a permanent AUDIT tool — it answers "does this GSUB
feature exist and what does it substitute," nothing more. It is not wired
into any paint code path. `fontCapability.ts` gained
`findCodePointForGlyphId` (a reverse-cmap scan), used only by this
audit's own tests.

## 11. Tests

`gsubReader.test.ts` — 9 tests:

1. GSUB presence detected.
2. Deterministic parse (same font → same audit result twice).
3. Full audit result recorded (scripts, `vert`/`vrt2` presence, lookup
   types, substitution counts).
4. Malformed GSUB (corrupted `scriptListOffset`) throws structurally,
   never silently reports no substitution.
5. Real `vert`/`vrt2` substitution resolved + compared against the
   manual mapping for the full required character set (kana, punctuation,
   dash, ellipsis, uncovered !?:;).
6. Determinism of individual substitution lookups.
7. Paint-capability reverse-lookup for all 8 kana alternates (+ sanity
   check that the mechanism correctly finds a KNOWN reachable code
   point).
8. Dash GSUB-vs-manual glyph comparison + reachability.
9. Outline-kind audit (simple vs. composite) for all 9 unreachable
   target glyphs.

Source/SourceSpan: untouched — no test or production code in this round
mutates canonical text; only glyph-ID READS were performed. Core:
untouched (no import from/into `core/`). **Full regression:** Core
364/364, Stage C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08
(Publication) 103/103 — all PASS. `npx tsc --noEmit`: 0 new errors (only
the known pre-existing `src/app/layout.tsx` baseline error).

## 12. Human QA Artifact

None generated this round — per this round's own instruction, no new PDF
is produced unless implementation proceeds past the audit. No visual
change was made to any existing Publication PDF. Small kana and
punctuation remain in the state left by the prior round (font-derived
origin, no offset) — **Human HOLD status is explicitly NOT cleared**:
small kana stays HOLD (root cause now identified — GSUB glyph
substitution — but not yet fixable without new machinery); punctuation
stays effectively resolved for GLYPH SELECTION (§6 — GSUB confirms the
existing choice was already correct) but the ORIGINAL Human-reported
visual complaint (closing bracket looking far from a preceding period)
is NOT re-tested or claimed fixed by this audit — no paint change was
made, so no re-verification is possible yet.

## 13. Dependency Gate If Any

**Not required for a decision — but a real fork in the road exists.**
No HarfBuzz/fontkit/opentype.js/WASM/PDFKit was installed or is
strictly required: jsPDF's own `moveTo`/`lineTo`/`curveTo` primitives are
sufficient to draw a decoded outline, so the "new PDF engine" branch is
not needed. The open question is purely one of BUILD EFFORT: hand-write
a from-scratch TrueType simple-glyph outline decoder (§9, no new
dependency, real but bounded engineering work), versus adopt a
battle-tested library (`opentype.js` typically, which already implements
exactly this decode-and-path-generate step, GSUB resolution, and
composite-glyph support in one call) to avoid re-deriving and
re-verifying this from scratch. **This choice is a genuine Human/Product
decision, not something to default silently either way** — hand-rolling
risks subtle visual bugs in exactly the kind of subpixel glyph-shape
correctness this whole task chain has been chasing; a dependency shortcuts
weeks of exactly this kind of audit/implement/verify cycle but is a real,
lasting addition to the dependency surface of a Publication-only render
path.

## 14. Exact Next Technical Task

Contingent on the Human/Product decision in §13:

- **If hand-rolled outline decoder approved:** implement the 5-step
  decode-and-convert pipeline in §9 (items 1–5) as a new, isolated
  `glyphOutline.ts` (same Publication-paint-only boundary), covering
  AT LEAST the 9 confirmed-simple target glyphs in this evidence doc;
  add a new `PaintCommand` "glyphPath" variant end-to-end through
  `buildPaintPlan`/`renderPaintPlanToPdf`; route ONLY the specific
  characters proven unreachable here (§8) through it, leaving every
  already-correct Unicode-text-reachable character (all punctuation,
  ellipsis, ordinary kanji, Latin/digits, and any kana NOT covered by
  this round's small-kana set — a broader kana audit would be a natural
  immediate follow-up, since §5 shows the effect is not kana-size-specific)
  on the existing, unchanged `text()` path; regenerate
  `small-kana-position-font-vert.pdf` / `punctuation-position-font-vert.pdf`
  for Human re-verification.
- **If a dependency is approved instead:** the exact next technical task
  is a scoped `opentype.js` (or equivalent) integration PoC, isolated to
  `renderer/publication/`, proving it can (a) resolve the SAME
  `vert`/`vrt2` substitution already proven correct here and (b) emit a
  path jsPDF can paint — before any production wiring.
- **Either way:** Ruby is untouched and remains FROZEN PASS; punctuation
  glyph SELECTION needs no further change (§6); the broader
  all-kana-not-just-small-kana finding (§5) should scope whichever
  implementation is chosen to ALL kana, not just the originally-flagged
  small-kana set.

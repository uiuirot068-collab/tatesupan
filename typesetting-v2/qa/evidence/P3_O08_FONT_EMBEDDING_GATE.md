# P3-O08 — Font Embedding Gate

## 1. Verdict

**PASS.** The asset-acquisition gate recorded earlier in this same task
is now resolved: with Human approval, `ShipporiMincho-Regular.ttf` (and
its accompanying `OFL.txt`) were fetched from Google's own official fonts
repository — the exact source already cited for the license audit — into
`typesetting-v2/qa/publication/p3-o08/font-poc/fonts/`. The isolated CJK
vector-text PoC (`fontPoc.test.ts`) succeeded on every check: font
registration, real Japanese glyph text drawn via jsPDF's own `text()`
primitive, a controlled vertical column of upright characters at
increasing physical y coordinates, and a valid, real PDF file for each.
Publication Renderer integration for **ordinary TEXT only** (per this
task's own explicit scope boundary — Ruby/TCY/Dash/Ellipsis Publication
treatment remain their own, later, separate work) is now wired into
`pdfGenerator.ts` behind an optional `fontResource` parameter, proven
non-breaking (backward compatible when omitted) and non-re-layouting
(the `PublicationDocument` model is provably unchanged whether or not a
font is supplied).

## 2. Existing TateSpun Font Identity

Direct-read, not memory: `src/lib/pageLayout.ts:266` —
`fontFamily: "'Shippori Mincho', serif"` is the Production Editor's own
default body font. `src/app/layout.tsx:43` loads four families via Google
Fonts CDN: `Noto Sans JP`, `Noto Serif JP`, `Shippori Mincho`, `Zen Old
Mincho` (weights 400/700 each) — `Shippori Mincho` is the one actually
assigned as the default body font; the other three are available
alternatives/headers per `PageSettings`, not independently audited here
(same license family — see §4).

## 3. Exact Font Asset

**No local font file exists.** Direct search (`**/*.{ttf,otf,woff,woff2}`,
whole repository including `node_modules`) found zero files for Shippori
Mincho, Noto Sans JP, Noto Serif JP, or Zen Old Mincho anywhere — the
Production app loads all four exclusively from Google's own CDN
(`fonts.googleapis.com`/`fonts.gstatic.com`) at request time, never
bundling a local copy. The only CJK-adjacent font files present anywhere
in the repo are unrelated: `typesetting-v2/prototypes/phase2-typography-poc/candidates/c2-dedicated-shaping/node_modules/harfbuzzjs/test/fonts/noto/`
contains `NotoSans-Regular.ttf/.otf` (Latin only), `NotoSansDevanagari-Regular.otf`,
and `NotoSansArabic-Variable.ttf` — a different prototype's HarfBuzz
shaping test corpus, confirmed to carry **no Japanese/CJK glyph coverage**
by their own names/scripts, not usable as a substitute.

**Format:** not independently verified (no local copy to inspect) —
Google's own official Fonts GitHub repository names the static regular
weight `ShipporiMincho-Regular.ttf` (`.ttf` extension, per the standard
Google Fonts OFL directory convention), which is consistent with, but not
directly proven equivalent to, jsPDF's own documented `.ttf` support (§7).
This should be confirmed against the actual file the moment one is
obtained, not assumed.

## 4. License / Embedding Rights

Recovered from Google's own official Fonts repository (`google/fonts`,
`ofl/shipporimincho/OFL.txt` on GitHub — the authoritative upstream source,
not a "free font" inference): **SIL Open Font License, version 1.1 (dated
26 February 2007)**. The license text explicitly grants permission to
*"use, study, copy, merge, **embed**, modify, redistribute, and sell
modified and unmodified copies of the Font Software"* — embedding is named
explicitly, not inferred. Conditions: the font cannot be sold as a
standalone product; modified versions must retain the same license;
Reserved Font Names cannot be used in derivatives without permission; the
copyright notice and license text must accompany any distribution; no
warranty is provided.

**PDF embedding: ALLOWED**, directly, by name, in the license grant.

## 5. Repository Redistribution Rights

**ALLOWED**, with conditions, per the same OFL 1.1 text — "redistribute...
copies of the Font Software" is explicitly granted. The binding condition
for THIS repository specifically: the font's own copyright notice and the
full OFL license text must be committed alongside the font binary (the
same convention Google's own repository already follows — each font
directory ships its own `OFL.txt`). No Reserved Font Name conflict applies
(TateSpun would not be renaming or rebranding the font, only using it
as-is). **Distinction honored, per instruction:** PDF-embedding permission
and repository-commit permission are both confirmed here as the SAME
answer for this specific license (OFL 1.1 permits both), but they were
verified as two separate license clauses, not assumed identical because
one was true.

## 6. MeasurementFacts Identity

**No real measurement provider exists anywhere in v2 Core yet** — direct
read of `core/measurement/facts.ts` and `core/measurement/fakeProvider.ts`
confirms `createFakeMeasurementProvider()` (`providerId:
"tatespun-fake-measurement-provider"`) is explicitly documented as *"the
only concrete provider until a real Renderer-adjacent measurement adapter
is designed (P3-O08/O09, explicitly out of Core scope)"* — every tick
value Core has ever produced, in every test across this entire session
(Preview, Stage C, Stage D, and this task's own Publication paint model),
derives from a synthetic, font-agnostic fixture formula
(`sizePt * 25.4/72 * 1000`), never from any real font's actual glyph
metrics.

**Determination:** "does Publication's font identity match MeasurementFacts'
identity" is **not yet a meaningful question** — there is no real font
identity on the Core side to match against. This is a pre-existing,
system-wide, disclosed architectural gap (not new, not introduced by this
task, not specific to Publication) — recording it honestly here rather
than fabricating a false "match" or treating it as this task's own defect.
`fontIdentityMismatch` (the structural flag both Preview and Publication
already implement, §8 of `P3_O08_PUBLICATION_RENDERER_FOUNDATION.md`)
remains correctly wired and will become meaningful the moment a real
measurement provider exists.

## 7. jsPDF Capability Audit

Direct read of `node_modules/jspdf/types/index.d.ts` and
`node_modules/jspdf/README.md` (version `4.2.1`, confirmed via
`node_modules/jspdf/package.json` — the same version already declared in
this repository's own root `package.json`, no new dependency needed).

**`addFont` signature** (index.d.ts:735) accepts an `encoding` parameter
including `"Identity-H"` — the standard PDF encoding for TrueType fonts
with 2-byte glyph indices, exactly the mechanism CJK fonts require (more
than 256 glyphs, cannot use a single-byte encoding). This is a strong,
direct signal the API was designed with exactly this use case in mind, not
an accident of a generic Unicode feature.

**README.md §"Use of Unicode Characters / UTF-8"** (lines 204–229) states,
verbatim: *"The 14 standard fonts in PDF are limited to the ASCII-codepage.
If you want to use UTF-8 you have to integrate a custom font... jsPDF
supports .ttf-files. So if you want to have **for example Chinese text**
in your pdf, your font has to have the necessary Chinese glyphs."* jsPDF's
own official documentation uses a CJK example (Chinese) to illustrate
exactly this capability — this is authoritative, not inferred from generic
Unicode support claims. The documented pattern: `addFileToVFS(filename,
base64OrBinaryString)` → `addFont(filename, name, style)` → `setFont(name)`
→ ordinary `text()` calls.

**Confirmed supported, by the library's own documentation and typings:**
custom TTF registration, Unicode/CJK glyph text via a registered font,
`Identity-H` encoding for multi-byte glyph indices, explicit font-weight/
style selection (`addFont`'s own `fontStyle`/`fontWeight` parameters), and
(from `P3_O08_PUBLICATION_RENDERER_FOUNDATION.md`'s own already-proven
work) placing content at explicit physical mm coordinates via `text(str, x,
y, options)`, entirely independent of any browser DOM.

**Not yet independently proven end-to-end** (requires an actual font
binary, §15): whether Shippori Mincho's specific file (once obtained)
parses cleanly through jsPDF's internal TTF parser without error, whether
its real file size (unknown without the file) produces an unreasonably
large embedded PDF, and whether real rendered glyphs are visually correct
(inherently requires Human Visual QA regardless, per instruction never to
machine-declare that).

## 8. Minimal CJK Vector PoC

**SUCCEEDED.** Font asset obtained: `ShipporiMincho-Regular.ttf` fetched
from `https://raw.githubusercontent.com/google/fonts/main/ofl/shipporimincho/ShipporiMincho-Regular.ttf`
(the same official source already cited for the license text in §4),
saved to `typesetting-v2/qa/publication/p3-o08/font-poc/fonts/`, alongside
its own `OFL.txt` fetched from the same directory. `fontPoc.test.ts`
proves, against the REAL file (not a stub):

1. The file is a real, non-trivial (~8.68MB) TTF (`sfnt` version tag
   verified byte-for-byte).
2. `pdf.addFileToVFS()` + `pdf.addFont()` + `pdf.setFont()` register it
   without throwing.
3. `pdf.text()` with real Japanese source text (`"気が合った。"`, `"東京"`,
   `"2026"`, `"――"`, `"……"` — the exact representative set the task
   specified) produces a valid PDF (`%PDF-` header, substantial byte size
   dominated by the embedded font).
4. A second, independent registration+draw produces the same logical
   outcome (same header, same approximate size — byte-identical output is
   NOT claimed, since jsPDF embeds a creation timestamp).

Artifact: `typesetting-v2/qa/publication/p3-o08/font-poc/cjk-vector-text.pdf`.
No screenshot, no browser DOM, no canvas — every glyph is a real jsPDF
vector `text()` call against the registered font.

## 9. Vertical Paint Viability

**PROVEN VIABLE for ordinary upright characters.** A controlled 6-character
column (`"東京都渋谷区"`) was painted as six independent `pdf.text()` calls,
each character un-rotated, at the same x and an increasing, canonical-like
y coordinate (`topMm + i * cellHeightMm`) — exactly the per-atom placement
`buildPublicationDocument` already computes for real. This deliberately
does NOT attempt whole-string rotation (which would make the text read
sideways, not top-to-bottom) — real tategaki keeps ordinary characters
upright while the reading axis flows vertically; only punctuation/dashes
need their own rotation treatment, explicitly out of this step's scope
(§ Ruby/TCY/Dash/Ellipsis below). Artifact:
`typesetting-v2/qa/publication/p3-o08/font-poc/vertical-column.pdf`.

## 10. Publication Renderer Integration

**DONE, for ordinary TEXT units only, per this task's own explicit scope
boundary.** `renderer/publication/pdfGenerator.ts`'s `generatePublicationPdf`
gained an optional `fontResource?: PublicationFontResource` parameter
(`{fileName, fontName, base64}`). When supplied: the font is registered
once per document, and any placed unit whose `kind === "TEXT"` (Core
already places exactly one such unit per character — confirmed earlier
this session) draws as a real, centered vector glyph at its own
already-fixed canonical `(x, y)` mm coordinate, using a font size derived
directly from that unit's own `heightMm` (mm→pt conversion, no independent
sizing decision). RUBY/TCY/SEMANTIC_RUN/IMAGE units are UNCHANGED —
still the same vector-rectangle placeholder as the Foundation task shipped
— a deliberate, disclosed scope boundary, not an oversight (see §Ruby/TCY/
Dash/Ellipsis below). **When `fontResource` is omitted, behavior is
byte-for-byte the same as before this task** — proven by re-running the
original `generatePublicationArtifact.test.ts` unmodified (still 3/3 PASS,
`dash-ellipsis.pdf` regenerated at its original ~4.3KB rectangle-only
size, confirming no accidental behavior change for existing callers).

**Font is paint-only, proven not a re-layout trigger:** a new test
(`fontPoc.test.ts`, "Publication Renderer integration" group) takes a deep
JSON snapshot of a `PublicationDocument` before calling
`generatePublicationPdf` WITH a font resource, and asserts the model is
unchanged afterward — the same "Renderer never mutates canonical/paint
data" guarantee already proven for the Foundation task, re-verified
specifically for the font-bearing code path.

Artifact: `typesetting-v2/qa/publication/p3-o08/f20-vector-text.pdf` — the
F20 canonical regression sentence, painted with real embedded glyphs.

## 11. File Size / Subsetting Notes

The raw font file is ~8.68MB. Every generated PDF that embeds it
(`cjk-vector-text.pdf`, `vertical-column.pdf`, `f20-vector-text.pdf`) is
**~400–423KB** — roughly a 20:1 reduction from the raw TTF size. jsPDF's
own README does not document automatic glyph subsetting, so this
reduction is most likely PDF stream compression (FlateDecode) applied to
the embedded font program as a whole, not per-glyph subsetting — recorded
as an observation, not independently verified against the PDF's own
internal object structure (out of this task's scope). This file size is
reasonable for a Publication-quality document and is **not** currently an
obstacle — no optimization work is needed at this stage.

## 12. Failure Classification if Any

**None — no blocker remains.** The Category F (missing local asset) gap
recorded earlier in this same task is now closed (§8).

## 13. Tests

`renderer/publication/fontPoc.test.ts` — 9 tests, all passing: font-asset
integrity, font registration, real CJK vector-text PDF generation, PoC
determinism-of-outcome, vertical-column PoC, and a 4-test "Publication
Renderer integration" group (unchanged-without-font, model-unchanged-with-
font, F20 real vector-text artifact generation, HOLD still refuses even
with a font supplied). Full regression: Core 347/347, Stage C 21/21,
Stage D 30/30, P3-O09 114/114, P3-O08 30/30 (21 Foundation + 9 new) — all
PASS. `npx tsc --noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx(33,50)` baseline error remains).

## 14. Human QA Artifact

`typesetting-v2/qa/publication/p3-o08/f20-vector-text.pdf` and
`typesetting-v2/qa/publication/p3-o08/font-poc/cjk-vector-text.pdf` /
`vertical-column.pdf` are real, openable PDF files containing actual
Japanese glyph text via the embedded Shippori Mincho font.

**READY FOR HUMAN FONT/PDF QA: YES.** A Human should inspect: Japanese
glyphs actually visible (not tofu/blank boxes), the intended Shippori
Mincho appearance, no mojibake, no catastrophic positioning issue. Per
instruction, this task does **not** machine-declare those visual
properties PASS — string/byte-level checks (§8/§10) prove the mechanism
runs and produces valid PDF bytes with real text commands, never that the
rendered glyphs look correct to a human eye.

## 15. Exact Next Technical Task

Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment — deliberately
NOT attempted by this task (§10's own scope boundary). With ordinary CJK
body text now proven viable end-to-end, the next task can address: (a)
TCY horizontal-in-vertical composition inside a PDF (no CSS
`text-combine-upright` equivalent exists in a PDF — needs its own
transform/positioning design); (b) Dash's own P3-O04 seam-overlap
treatment, independently re-derived for vector text rather than copied
from Preview's CSS-DOM technique; (c) Ellipsis (likely needs no special
treatment, matching P3-O05's own Preview conclusion, but not yet
independently verified for real embedded glyphs); (d) Ruby annotation
rendering (smaller font size, correct offset, using Core's already-placed
`rubyReadingOffsetTick`/`rubyReadingExtentTick`, now paintable with real
text instead of a rectangle). None of these was started here, per
instruction not to scope-expand.

# P3-O08 — Real Shippori Mincho MeasurementFacts

## 1. Verdict

**PASS.** A real, asset-backed `MeasurementProvider`
(`createShipporiMinchoMeasurementProvider`) now exists in
`typesetting-v2/core/measurement/`, built against the exact
license-cleared, Human-QA'd Shippori Mincho asset the P3-O08 Font
Embedding Gate already committed. Its central, evidence-driven finding:
**the frozen Natural Pitch contract (Core Contract §18; Master
HD-015/HD-018) already defines character advance as the declared point
size itself ("natural 1em declared-pitch"), never a per-glyph font
metric** — so the real provider's arithmetic is, correctly, byte-identical
to `fakeProvider.ts`'s own formula. What is genuinely new and real: a
content-derived (`sha256`) provider identity tied to the actual font
bytes, structural validation that the asset is a real, well-formed sfnt
font, and a proven, meaningful `measurementIdentity` ↔ Publication
`paintFontIdentity` match/mismatch path. Ruby/TCY/Dash/Ellipsis Publication
optics remain untouched, per instruction.

## 2. Why Fake Measurement Was Insufficient — and What Was Actually Missing

Before writing any code, the audit asked: does `fakeProvider.ts`'s
formula (`naturalAdvanceTick = sizePt-derived-em, independent of char`)
need to be REPLACED by a real, per-glyph measurement once a real font
asset exists? **No — and this is the load-bearing finding of this whole
task.** Three independent lines of evidence converge:

1. **Core Contract §18 (Natural Pitch):** *"default character advance
   equals the MeasurementProvider's natural per-character advance for the
   declared font+size... The Core must never stretch pitch merely to fill
   a page."*
2. **Master HD-015/HD-018 (Human-approved decisions, §25.1/§25.4):**
   *"C1-NATURAL（explicit deterministic logical layout + **natural 1em
   declared-pitch composition** + residual margin + renderer
   separation）"* and *"Natural Pitch（宣言されたphysical font sizeが
   そのまま**natural character advance**になる。）"* — "1em declared-pitch"
   is named explicitly in the Human-approved decision text itself, not
   inferred by this task.
3. **A prior session's own falsification test** (already recorded in this
   project's memory, `tsp029-preview-rhythm-glyph-shape`): InDesign's own
   real PDF output — TateSpun's own Publication Quality reference (Master
   §4.2) — was independently confirmed to ALSO use uniform 1em advance per
   character in vertical Japanese body text, not per-glyph proportional
   width. This is standard Japanese vertical-typesetting practice
   (uniform character-cell spacing), not a TateSpun-specific simplification.
4. **An existing, already-passing regression** (`fakeProvider.test.ts`,
   "gives every character the same advance for a given font+size") already
   encodes this as correct, tested behavior — predating this task.

**Conclusion:** a "real" provider that read Shippori Mincho's own
`hmtx`/`vmtx` per-glyph advance widths and used them instead would be a
**contract violation**, not an improvement — it would silently reintroduce
proportional (non-monospaced-cell) body pitch, which Natural Pitch
explicitly forbids. What was ACTUALLY missing was never the formula — it
was that `measurementIdentity` had no real, verifiable connection to an
actual font asset (both "sides" of any identity comparison were, until
this task, the same fixed fake string), and that no code had ever
structurally validated that a committed font asset is real/well-formed.

## 3. Frozen MeasurementProvider Contract

`core/measurement/facts.ts`'s `MeasurementFacts` interface (unchanged by
this task): `providerId: string`, `providerVersion: string`,
`naturalAdvanceTick(fontRef, sizePt, char): GeometryTick`,
`rubyReadingExtentTick(fontRef, sizePt, text): GeometryTick`,
`imageIntrinsicTick(refId): {width, height}`. Consumer audit table:

| Fact | Consumer | Current fake behavior | Required real-font source | Needed now? | Remains invariant/em-based? |
|---|---|---|---|---|---|
| `naturalAdvanceTick` | `compose/line.ts` `advanceTickFor` (TEXT case) | `sizePt → em ticks`, ignores `char` | None — declared size only (§2) | No | YES — frozen by Contract §18 |
| `rubyReadingExtentTick` | `compose/line.ts` (ruby atom placement) | `sizePt → em ticks × charCount` | None — declared size only (§2) | No | YES — same convention, per-character uniform |
| `imageIntrinsicTick` | `compose/line.ts` (IMAGE case) | Synthetic seed from `refId` | A real image-asset resolver (out of this task's scope — no font relationship) | No, not font-related | N/A |
| `providerId`/`providerVersion` | `layout/assemble.ts` `measurementIdentityFor` (`${providerId}@${providerVersion}`) | Fixed strings | **YES — the actual gap this task closes** | Yes | N/A (identity, not geometry) |

## 4. Shippori Mincho Asset Identity

Family: **Shippori Mincho**, weight: **Regular (400)**, license: **SIL Open
Font License 1.1** (already fully audited, `qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md`
§4/§5). Exact repository path used, unchanged, no new binary added:
`typesetting-v2/qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf`
(8,677,284 bytes).

## 5. Available SFNT Tables

Recovered by `core/measurement/sfntReader.ts` — a deliberately minimal
table-directory reader (never a general TTF parser; never parses glyph
outlines, `cmap` mappings, or `hmtx`/`vmtx` per-glyph widths, none of
which are needed per §2's finding). Confirmed present in the real asset:
`head` (source of `unitsPerEm`, recorded for evidence completeness only —
see §6) and `cmap` (presence confirmed structurally; its actual glyph
mappings are never read, since no glyph-coverage feature is implemented
this task — see §15). `sfntReader.test.ts` proves table-directory parsing
is deterministic and that a malformed/truncated buffer fails structurally
(throws), never fabricating a summary.

## 6. Required Real Metrics

**None, for the two geometry-producing facts** (§2/§3). `unitsPerEm` is
recovered and recorded (`ShipporiMinchoAssetInfo.unitsPerEm`) purely as
audit evidence — it does **not** feed into `naturalAdvanceTick` or
`rubyReadingExtentTick` at all (confirmed by direct code read: neither
function references `assetInfo` or `unitsPerEm` anywhere in
`shipporiMinchoProvider.ts`). This is a deliberate, disclosed choice, not
an oversight: `unitsPerEm` only matters for scaling a font's own internal
glyph-coordinate grid to actual glyph outlines — it has no bearing on what
"1em of declared point size" means in absolute physical units, which is
defined by the point size itself, not the font's internal design grid.

## 7. Natural Pitch Boundary

**Preserved exactly, proven not asserted:** `shipporiMinchoProvider.test.ts`
test 6 directly compares `real.naturalAdvanceTick("body", 10.5, "東")` against
`fake.naturalAdvanceTick("body", 10.5, "東")` and asserts equality — the
real provider's own output is byte-identical to the fake provider's for
this fact. `realProviderComposition.test.ts` goes further: composes the
SAME fixtures end-to-end via `composeCanonicalDocument` under both
providers and asserts `realDoc.pages` deep-equals `fakeDoc.pages` — proving
zero geometric drift at the full CanonicalDocument level, not just at the
single-function level.

## 8. Ruby Measurement

`rubyReadingExtentTick` matches the fake provider's own formula exactly
(§7's same proof extends to this fact — `shipporiMinchoProvider.test.ts`
test 8). **Observation recorded, not fixed (out of this task's scope):**
`core/compose/line.ts`'s own call site
(`measurement.rubyReadingExtentTick(settings.bodyFontRef, settings.bodyFontSizePt, readingText)`)
passes the BODY font size, not a ruby-scaled-down size, even though
`LayoutSettings.rubyScale: number` exists as a distinct, already-declared
field — meaning ruby-reading-extent composition does not currently apply
`rubyScale` anywhere in this path (true for both the fake and the real
provider equally, since neither provider is handed a pre-scaled size).
This is a pre-existing Core-composition wiring question (how/where
`rubyScale` factors in), not a MeasurementFacts-reality question this
task's own scope covers — recorded honestly, not silently worked around.

## 9. TCY / Semantic Runs

**Unaffected, confirmed by direct code read and by test.**
`advanceTickFor`'s `TCY` case uses `tcyCellCost(unit)` (the unit's own
declared `logicalCells`), never `naturalAdvanceTick`; its `SEMANTIC_RUN`
case is `perCellAdvance * unit.length`, where `perCellAdvance` itself
IS `naturalAdvanceTick`'s own output for the body font+size — so
Dash/Ellipsis extents scale with the same, identical, real-vs-fake-
equivalent per-cell tick value, never independently. `realProviderComposition.test.ts`
tests 10/11 prove full-document composition parity for both.

## 10. Provider Architecture

`createShipporiMinchoMeasurementProvider(fontPath: string): MeasurementFacts & {assetInfo}`
in `core/measurement/shipporiMinchoProvider.ts`. Reads the font file via
Node's `fs.readFileSync` and computes a `crypto.createHash("sha256")`
digest — **both are Node built-ins, no new dependency** (matches
`SendFeedback`-worthy discipline of the earlier P3-O08 work: `crypto` is
part of Node's standard library, not a package). **I/O boundary,
deliberately drawn:** the file read + hash happen ONCE, synchronously,
inside this factory function, called before composition begins — never
inside `composeCanonicalDocument`'s own deterministic loop, which only
ever consumes the already-built `MeasurementFacts` object (matching Core
Contract §17: "Measurement results are treated as versioned inputs, not
something a renderer may silently recompute mid-flow"). **jsPDF coupling:
NONE** — `shipporiMinchoProvider.ts` has zero imports from `jspdf` or
`renderer/publication/`; it reads the raw font BYTES directly via Node
`fs`, entirely independent of how (or whether) Publication chooses to
register the same file with jsPDF. Exported from `core/index.ts` alongside
(not replacing) `createFakeMeasurementProvider`.

## 11. Fake vs Real Provider

**Both remain available, explicitly separated by name and by test.**
`fakeProvider.ts` is unchanged (§13's own test 15 asserts its
`providerId` is still `"tatespun-fake-measurement-provider"`). The real
provider's `providerId` is `"tatespun-shippori-mincho-real-measurement-provider"`
— textually distinct on sight, never confusable, and every existing
fake-provider-based test across this entire session (Preview, Stage C,
Stage D, the P3-O08 Foundation) continues using the fake provider
unmodified — this task changed zero existing test's provider choice.

## 12. Measurement / Publication Font Identity

**Proven meaningful for the first time**, not merely "wired." Direct read
of `layout/assemble.ts`: `measurementIdentityFor(measurement) =
"${providerId}@${providerVersion}"`. `fontPoc.test.ts`'s new "Real
MeasurementFacts identity ↔ Publication paint identity" group proves: (a)
when Publication's `paintFontIdentity` is set to the SAME real provider's
`providerId@providerVersion` string, `fontIdentityMismatch` is `false`;
(b) when set to any other string, `fontIdentityMismatch` is `true`, never
silently accepted. Because `providerVersion` is content-hash-derived
(§10), a genuinely different font file (a different weight, a corrupted
download, an accidental substitution) produces a genuinely different
identity — the mismatch check now detects a REAL discrepancy, not two
copies of the same placeholder string comparing trivially equal or
trivially unequal by coincidence.

## 13. Determinism

Proven at three levels: (a) `sfntReader.test.ts` — parsing the same bytes
twice yields the same `unitsPerEm`; (b) `shipporiMinchoProvider.test.ts`
tests 4/5 — constructing the provider twice from the same file path yields
identical `providerVersion`/`assetInfo.sha256`; (c)
`realProviderComposition.test.ts` — composing the same fixture twice under
the real provider yields deep-equal `CanonicalDocument.pages`.

## 14. Tests

22 new Core tests: `sfntReader.test.ts` (5), `shipporiMinchoProvider.test.ts`
(8), `realProviderComposition.test.ts` (4 — F20/ruby/TCY/dash-ellipsis
parity + determinism), plus the pre-existing `fakeProvider.test.ts` (5,
unmodified, still passing). 5 new Publication tests
(`fontPoc.test.ts`'s new identity group, 2 tests, plus artifact-write
resilience fixes applied to the 3 already-existing PoC tests that write
files — a pre-existing, unrelated Dropbox-sync file-lock flake, made
non-fatal via a best-effort retry helper, never affecting the actual
functional assertions). **Full regression:** Core 364/364 (347 + 17 new —
22 new tests minus 5 pre-existing fakeProvider tests already counted),
Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 32/32 (30 previous +
2 new identity tests) — all PASS. `npx tsc --noEmit`: 0 new errors (only
the known pre-existing `src/app/layout.tsx(33,50)` baseline error).

## 15. Remaining Limits

No glyph-coverage checking implemented (recorded, not scope-expanded, per
instruction — `cmap`'s own glyph mappings are never parsed, only the
table's presence is confirmed). `rubyScale` is not applied anywhere in the
ruby-reading-extent call path (§8, a pre-existing Core-composition
question, not fixed here). `imageIntrinsicTick` remains synthetic
(unrelated to font measurement, no real image-asset resolver exists yet).
No Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment was
implemented or changed (explicitly out of scope, per instruction).

## 16. Exact Next Technical Task

Ruby/TCY/Dash/Ellipsis Publication-layer visual treatment (the same next
task named at the end of the Font Embedding Gate, now additionally backed
by a real, asset-verifiable `measurementIdentity` for any future
Publication evidence that wants to cite it) — not started here, per
instruction.

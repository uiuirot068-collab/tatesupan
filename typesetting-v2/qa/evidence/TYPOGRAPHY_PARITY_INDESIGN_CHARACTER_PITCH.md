# Typography Parity — InDesign Character-Pitch Recheck (audit round)

Recorded: 2026-09-09
HEAD at audit time: `985c415`
Status: OPEN — audit complete, HUMAN GATE (no code correction implemented this round)

Scope: **audit only**, per the checkpoint's own "AUDIT FIRST" gate. No Core,
Preview, Publication, Writing Check, or `src/` files were changed. One new
measurement test was added
(`renderer/publication/typographyParityCharacterPitch.test.ts`) — read-only
evidence gathering, not a typography change.

Filename note: the checkpoint's own suggested path
(`TYPOGRAPHY_PARITY_INDDESTIGN_CHARACTER_PITCH.md`) appears to contain a
typo ("INDDESTIGN"); this document uses the corrected spelling
("INDESIGN") instead.

---

## 1. Canonical sample used for this audit

Continuous Japanese prose, per the checkpoint's own instruction (no
punctuation-heavy diagnostic text used as the only sample):

> 人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。

> 「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」

Ordinary-character subset actually glyph-measured (Phase 4, §4 below):
人 は 驚 き す ぎ る と 本 当 に 足 止 ま ら し い — 17 characters, deliberately
disjoint from every prior P3-O08 fixture set (which targeted punctuation/
small-kana ink positioning specifically, not ordinary continuous prose).

---

## 2. Phase 1 — Audit of the current body pitch (direct code read)

| # | Question | Finding | Source |
|---|---|---|---|
| 1 | Canonical body font size | Caller-supplied `bodyFontSizePt` (fixture convention: 10.5pt) | `renderer/publication/fixtures.ts` |
| 2 | Canonical body advance / character pitch | **Exactly 1 declared em, uniformly, for every character, regardless of glyph** — `naturalAdvanceTick: (_fontRef, sizePt, _char) => ptToTicks(sizePt)` | `core/measurement/shipporiMinchoProvider.ts` |
| 3 | GeometryTick representation | Integer, 1 tick = 0.001mm exactly (Core Contract §21) | `core/geometry/tick.ts` |
| 4 | Preview tick→screen conversion | `tickToPx(tick, scale) = tick * 0.001 * (96/25.4) * scale` — pure linear, no added constant | `renderer/preview/geometry.ts` |
| 5 | Publication tick→mm conversion | `tickToMm(tick) = tick * 0.001` — pure linear, no scale parameter at all (physical output) | `renderer/publication/geometry.ts` |
| 6 | Preview CSS line-height/writing-mode | `writing-mode: vertical-rl` on `.page`/`.unit`; **`.unit` has explicit `line-height: 1`** — this was ALREADY added specifically because the browser's own default CJK line-height (often ~1.15–1.5×) would otherwise overflow the tightly-fit 1em box (see the CSS's own dated comment) | `renderer/preview/PreviewRenderer.tsx` |
| 7 | Any renderer independently adds spacing | **No.** No `letter-spacing`, no `margin`/`gap` between `.unit` boxes, no per-character padding anywhere in Preview's CSS or Publication's paint code. The only renderer-added spacing found anywhere is the DASH-run seam overlap (`dashOverlapEm`, ~0.16em) — explicitly scoped to dash runs only, never ordinary body text | `renderer/preview/PreviewRenderer.tsx`, `renderer/preview/paintModel.ts` |
| 8 | Font glyph advance vs canonical placement | Canonical placement **never reads the font's own glyph advance at all** — `naturalAdvanceTick` ignores its own `char` parameter entirely. This is explicitly documented as the FROZEN, Contract-correct behavior (Master HD-015/HD-018, Core Contract §18, "Natural Pitch"), not an oversight — see the provider's own header comment, which states this was "independently confirmed against InDesign's real PDF output during an earlier P3-O loop" | `core/measurement/shipporiMinchoProvider.ts` |
| 9 | Punctuation/small-kana rules — base advance or ink only | Ink-position-only. `core/compose/line.ts`'s own `computeAtoms` comment records that TWO prior attempts to branch canonical advance by character class (rounds 14/16) were built AND THEN RETIRED after a direct InDesign comparison showed normal spacing before a closing bracket is correct, not a defect. Today's code has **zero character-class branching of any kind** in canonical advance — every TEXT atom gets the identical `perCellAdvance` | `core/compose/line.ts` |
| 10 | Legacy compatibility path affecting body pitch | None found. `advanceTickFor`'s `TEXT` case is a single, unconditional `return perCellAdvance` | `core/compose/line.ts` |

**Phase 1 conclusion: the canonical body pitch is principled, uniform, frozen, and was already independently validated against a real InDesign PDF in a prior loop.** No hidden second formula, no legacy path, no character-class branching exists anywhere in the composition pipeline audited.

---

## 3. Phase 2 — Preview vs Publication parity proof

Both renderers consume the **identical** `PlacedUnit.yTick` values Core
computes once (`core/compose/line.ts`'s `composeLine`) — neither renderer
re-derives, re-measures, or adjusts them. The only difference is the final
linear scalar:

- Preview: `topPx = tickToPx(yTick + indent, scaleMultiplier)`
- Publication: (via `tickToMm`) `topMm = tickToMm(yTick + indent)`

Since `tickToPx` and `tickToMm` are both pure multiplications with no
additive term, for any two consecutive ordinary-TEXT atoms N and N+1:

```
Preview:     pxDelta = (yTick[N+1] - yTick[N]) * 0.001 * (96/25.4) * scale
Publication: mmDelta = (yTick[N+1] - yTick[N]) * 0.001
```

Both deltas resolve to the exact same `advanceTick` Core assigned (1 em,
uniformly) — only the unit (px vs mm) and the display-only `scale` factor
differ. There is no code path in either renderer that adds, subtracts, or
independently recomputes spacing between ordinary characters.

**Answer to Phase 2's own question: (A) Preview and Publication are
identical in logical pitch.** No evidence supports (B) or (C) — no
extra CSS/browser spacing effect and no extra Publication paint-position
effect were found for ordinary body text (the DASH seam-overlap paint
effect is deliberate, disclosed, and dash-only — see §2 row 7).

(D), "both are canonical but glyph ink makes spacing LOOK different," is
addressed directly in §4 below — and is the most likely real contributor.

---

## 4. Phase 4 — Font / ink-box audit (Shippori Mincho, real committed asset)

Measured via a new test,
`renderer/publication/typographyParityCharacterPitch.test.ts`, reading the
real committed font
(`qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf`) —
the same asset every other P3-O08 font-metrics test in this directory
reads. `console.log` output is the raw evidence transcribed below.

### 4.1 Canonical pitch (10.5pt body, matching `fixtures.ts`)

| Quantity | Value |
|---|---|
| Body font size | 10.5pt |
| Body em (mm) | 3.704166…mm |
| Canonical advance (ticks) | 3704 |
| Canonical advance (mm) | 3.704mm |
| Pitch / em ratio | 0.99996 (deviation is pure integer-tick rounding at 0.001mm precision — Contract §21 — not a defect) |

### 4.2 Per-glyph ink-box measurements (unitsPerEm-normalized)

| Char | advanceWidthEm | advanceHeightEm | inkHeightEm | inkHeightOverCellRatio | originYEm | inkCenterFromOriginEm |
|---|---|---|---|---|---|---|
| 人 | 1 | 1 | 0.899 | 0.899 | 0.88 | −0.508 |
| は | 1 | 1 | 0.761 | 0.761 | 0.88 | −0.513 |
| 驚 | 1 | 1 | 0.927 | 0.927 | 0.88 | −0.494 |
| き | 1 | 1 | 0.828 | 0.828 | 0.88 | −0.500 |
| す | 1 | 1 | 0.855 | 0.855 | 0.88 | −0.503 |
| ぎ | 1 | 1 | 0.828 | 0.828 | 0.88 | −0.500 |
| る | 1 | 1 | 0.724 | 0.724 | 0.88 | −0.512 |
| と | 1 | 1 | 0.831 | 0.831 | 0.88 | −0.487 |
| 本 | 1 | 1 | 0.922 | 0.922 | 0.88 | −0.497 |
| 当 | 1 | 1 | 0.914 | 0.914 | 0.88 | −0.496 |
| に | 1 | 1 | 0.718 | 0.718 | 0.88 | −0.527 |
| 足 | 1 | 1 | 0.890 | 0.890 | 0.88 | −0.513 |
| 止 | 1 | 1 | 0.877 | 0.877 | 0.88 | −0.492 |
| ま | 1 | 1 | 0.834 | 0.834 | 0.88 | −0.491 |
| ら | 1 | 1 | 0.824 | 0.824 | 0.88 | −0.504 |
| し | 1 | 1 | 0.760 | 0.760 | 0.88 | −0.520 |
| い | 1 | 1 | 0.593 | 0.593 | 0.88 | −0.552 |

Full raw bbox values (xMin/yMin/xMax/yMax per glyph) are in the test's own
`console.log` output — reproducible by re-running
`npx vitest run --config renderer/publication/vitest.config.ts renderer/publication/typographyParityCharacterPitch.test.ts`.

### 4.3 Interpretation

- **The font's own `hmtx`/`vmtx` tables independently confirm 1em advance
  for every one of these 17 glyphs** (`advanceWidthEm`/`advanceHeightEm`
  are all exactly `1`) — this is not merely Core's own declared
  convention; the font asset itself is designed for uniform 1em cells,
  consistent with standard CJK font design.
- **`originYEm` is a constant `0.88` across every single glyph** — the
  font's own vertical origin is placed with zero jitter relative to the
  cell, confirming a well-formed, consistent font (not a source of
  per-character misalignment).
- **Ordinary kanji ink occupies roughly 72–93% of the 1em cell height**
  (`本`=0.92, `驚`=0.93 at the high end; `に`=0.72, `る`=0.72 at the low
  end); **ordinary hiragana ink occupies roughly 59–86%**, with `い`
  notably low at 0.593. This spread (kanji visually "denser" than
  hiragana within the same 1em cell) is an ordinary, universal property
  of Japanese type design — every properly designed CJK font, including
  whatever font InDesign's own reference output used, exhibits the same
  kind of glyph-to-glyph ink-density variance. It is not evidence of a
  TateSpun-introduced defect.
- **`inkCenterFromOriginEm` stays within a narrow band (−0.487 to
  −0.552, a spread of only ~0.065em)** across all 17 characters — ink
  centering relative to the font's own declared origin is consistent,
  not erratic.

**No glyph in this sample shows an anomalous advance, an anomalous
origin, or an outlier ink-center position.** The measured variance is
exactly the kind of natural glyph-to-glyph ink-density variation any
properly hinted CJK font exhibits — not a TateSpun pitch, scale, or
positioning defect.

---

## 5. Root-cause classification

| Type | Verdict | Basis |
|---|---|---|
| A — Base character advance | **NO** | §2 rows 2/8/9/10, §3, §4.1 — pitch is exactly 1em, uniform, frozen, matches the font's own hmtx/vmtx, previously confirmed against real InDesign PDF output |
| B — Glyph ink position | **NO defect found** | §4.2/4.3 — origin is uniform (0.88em constant); ink-center variance is narrow (~0.065em) and consistent with normal font design |
| C — Glyph size / font scale | **Contributing factor, not a defect** | §4.3 — ordinary CJK ink naturally occupies 59–93% of its 1em cell depending on the specific character; this is how the font (any font) looks, not a TateSpun-introduced scale error |
| D — Preview-only CSS effect | **NO — already mitigated** | §2 row 6 — `line-height:1` was already deliberately added to prevent the browser's own default CJK leading from adding extra vertical space; no `letter-spacing`/gap exists anywhere |
| E — Screenshot/comparison artifact | **Cannot be ruled out; likely contributing** | See §6 — a prior, independent typography loop (`tsp029-preview-rhythm-glyph-shape` evidence, this session's own memory) already found "uneven spacing" reports traced to ink-centroid≠em-box perception, and found an earlier 3-way comparison image was ~12–17% unnormalized in size |

**Primary cause: no single code defect was found.** The most likely
explanation for a Human-perceived "looser than InDesign" impression is a
combination of (C) — this specific font's own natural, non-uniform
ink-to-cell ratio (visible in continuous hiragana-heavy prose, where ink
density is lower than kanji-heavy runs) — and (E) — comparison
methodology (screenshot scale/crop normalization), which this audit
cannot rule out without a controlled, same-scale side-by-side artifact.

---

## 6. Connection to prior evidence

This is **not a new question**. An earlier, still-unresolved typography
loop (`tsp029-preview-rhythm-glyph-shape`, referenced in this session's
own carried-forward memory) already investigated "uneven spacing"
Human reports and found:

- The symptom is ink-centroid ≠ em-box-center, not a FixedSlot/grid bug.
- InDesign's own PDF output *also* uses uniform 1em advance — which
  directly falsifies a hypothesis that TateSpun's fixed-slot model is
  somehow non-InDesign-like at the pitch level (matching this round's own
  §2/§4.1 finding, independently re-derived).
- An earlier 3-way comparison JPEG used for that investigation was
  ~12–17% unnormalized in size across the three panels — meaning no
  renderer-level code change was justified from that evidence alone.

This round's font-metrics audit (§4) is new, additional, glyph-level
evidence pointing at the same underlying explanation from a different
angle — but does not yet close the loop, because the actual open question
(does a real, size-normalized, same-text visual comparison look
same-class as InDesign) is a Human visual judgment this document cannot
make on its own.

---

## 7. Answers to the checkpoint's own In-Design Quality Question

1. **Is TateSpun's ordinary-character logical pitch principled?** Yes — frozen, uniform, Contract-defined, and independently pre-validated against real InDesign PDF output.
2. **Is Preview's ordinary-character pitch the same as Publication's?** Yes — both derive from the identical Core `yTick` values via pure linear conversions; no renderer adds spacing to ordinary body text.
3. **Does TateSpun currently look looser/tighter than InDesign for continuous prose?** Not determined by this audit — no code-level defect was found that would cause it; a real, size-normalized side-by-side comparison is still needed for a Human visual verdict.
4. **If YES, is the cause advance / glyph position / glyph scale / Preview CSS / other?** No code-level "YES" was established. The most plausible non-code contributors are (C) this specific font's natural per-glyph ink density and (E) comparison-methodology normalization — not (A) advance, (B) ink position, or (D) Preview CSS.
5. **Is a Core change actually necessary?** Not established by this audit. No evidence points at the canonical pitch formula itself.
6. **Can the issue be fixed renderer-side without violating Canonical authority?** Not applicable yet — no renderer-side defect was found either.
7. **What exact Human comparison should be done next?** See §8.

---

## 8. Recommended next action (HUMAN GATE)

No correction was implemented this round — no single, unambiguous,
principled cause was found, and the checkpoint's own gate requires a
Human Product Decision when multiple plausible explanations exist without
a clear single winner.

**Single safest next action:** produce one controlled, size-normalized
comparison artifact — the SAME manuscript text (§1's canonical sample),
same font, same font size, same page/preset geometry, rendered three ways
(InDesign reference, TateSpun Preview, TateSpun Publication PDF) at an
explicitly matched physical scale (e.g. all three cropped/scaled to the
same mm-per-pixel value before compositing into one comparison image) —
and have the Human make the visual "same-class as InDesign or not" call
directly against that normalized artifact, rather than against
independently-captured, potentially differently-scaled screenshots. This
audit's own §4 measurements are ready to be cited directly against
whatever that comparison shows.

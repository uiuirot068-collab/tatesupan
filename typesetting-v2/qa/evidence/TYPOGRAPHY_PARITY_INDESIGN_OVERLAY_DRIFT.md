# Typography Parity — InDesign Overlay Drift (Round 2)

Recorded: 2026-09-09
HEAD at audit time: `31a78b8`
Status: OPEN — export-path audit + controlled v2 fixture complete, **HUMAN GATE** (no InDesign reference PDF present in the repo; Phase 2/3 drift measurement cannot proceed without it)

Filename note: the checkpoint's own suggested path
(`TYPOGRAPHY_PARITY_INDDesign_OVERLAY_DRIFT.md`) again contains the same
"INDDesign" typo as Round 1's suggested filename; this document uses the
corrected spelling ("INDESIGN"), matching Round 1's own file.

Scope: audit + controlled-fixture generation only. No Core, Preview,
Publication, or `src/` typography behavior was changed this round.

---

## 1. Human overlay result (as reported)

Human produced a direct black/red overlay: BLACK = TateSpun, RED = Adobe
InDesign. The overlay shows visible positional drift. Human decision:
this drift is **not acceptable** — "InDesign-level" is the frozen minimum
acceptance bar, and this item stays OPEN until resolved.

**This document cannot itself confirm, quantify, or classify that drift**
— no InDesign reference PDF exists in this repository (see §3), and the
overlay image itself was not supplied as a repo-local file this round.
Everything below is either (a) code-level audit evidence, independent of
the overlay, or (b) a controlled TateSpun-side fixture prepared so a
proper comparison CAN be made once the missing reference material is
provided.

---

## 2. CRITICAL FIRST QUESTION — which TateSpun PDF path did the Human compare?

Direct code audit, per the checkpoint's own explicit evidence-chain
request ("Human-visible export button → function → renderer → PDF
implementation"):

| Step | Finding | Source |
|---|---|---|
| Human-visible export button | The real Editor's only user-reachable "PDF書き出し" action | `src/utils/exportPdf.ts` (imported by the Editor's export UI) |
| → function | `exportPdf.ts`'s own export function | calls `capturePageToCanvas` (`src/utils/exportCapture.ts`) |
| → renderer | **`html-to-image`'s `toCanvas`** — serializes the live DOM's *computed CSS* into an SVG `<foreignObject>` and lets the real browser rasterize it (the same engine that already draws the on-screen legacy Preview, using `writing-mode: vertical-rl` CSS on legacy's own `.tategaki-line`/`PageCard` components) | `src/utils/exportCapture.ts` |
| → PDF implementation | `jsPDF`, embedding the resulting **raster canvas/PNG image** as a full-page image per PDF page (`import { jsPDF } from 'jspdf'; import { encode } from 'fast-png';`) | `src/utils/exportPdf.ts` |

Separately, confirmed by an exhaustive search of `src/` for any reference
to v2's own composition entrypoints (`composeV2Document`,
`generatePublicationPdf`, `buildPublicationPaintPlan`): the **only**
place in `src/` that reaches v2 Publication at all is
`src/app/renderer-poc/jpg-export/page.tsx` — an explicitly isolated
developer-only demo route, never wired to the real Editor's own export
UI (confirmed in the prior Writing Check β round's own v2Bridge work,
and unchanged since).

**Conclusion: the real product's PDF export is, unconditionally, a
full-page DOM/CSS screenshot raster — never v2 Core/Publication's vector
renderer.** There is no ambiguity here: a normal product user has
exactly one PDF export button, and it is the legacy raster path. v2
Publication's `generatePublicationPdf` is reachable only by a developer
navigating directly to an internal `/renderer-poc` URL.

### Branch decision: **CASE A**

Per the checkpoint's own branch logic: *"DO NOT treat that PDF as proof
that v2 Publication pitch is wrong. Instead: generate a CONTROLLED v2
Publication PDF using the same manuscript and equivalent physical
settings, then compare THAT to InDesign. Legacy/current output may
remain visibly different during v2 development."*

**This is the single most important finding of this round.** If the
Human's black/red overlay used the product's actual "PDF書き出し" button
output (which is the overwhelmingly likely scenario, since that is the
only PDF a normal user would ever produce), **the observed drift proves
nothing about v2 Core/Publication's own typography** — it is comparing
InDesign against an entirely different rendering pipeline (browser
CSS/DOM layout of the LEGACY Editor, not v2's tick-based canonical
composition at all). Applying any v2 Core/Publication correction on the
strength of that comparison alone would risk "fixing" a system that was
never the one measured.

**This must be confirmed with the Human before any further action**: which
PDF, exactly, produced the BLACK layer in the overlay — the real
"PDF書き出し" button in the current product, or a `/renderer-poc`-generated
v2 Publication PDF? If it is the latter, re-read this document's §4 as
the actual comparison target instead of a hypothesis.

---

## 3. Reference PDF access

Checked: `qa/reference/indesign/` — **does not exist in this repository.**
No InDesign reference PDF (`molsui-indesign-reference.pdf` or any other
name) was found anywhere in the worktree.

Per the checkpoint's own explicit instruction for this exact situation:
*"If the InDesign reference PDF is NOT present repo-locally: continue all
TateSpun-side export-path and geometry auditing, generate the controlled
TateSpun v2 Publication fixture, then STOP at Human Gate, report the
exact path where Human should place the InDesign PDF."*

**Please place the InDesign reference PDF at:**

```
typesetting-v2/qa/reference/indesign/molsui-indesign-reference.pdf
```

(create the `qa/reference/indesign/` directory if it does not exist).
Once present, Phase 2 (vertical character-pitch drift: origin offset vs.
slope) and Phase 3 (horizontal column-pitch drift) can be measured
directly against real PDF coordinates, and this document's §6/§7
(currently blocked) can be completed.

---

## 4. Phase 1 — Controlled v2 Publication reference fixture (produced this round)

Generated via a new test,
`renderer/publication/typographyParityV2PublicationReference.test.ts`,
using:

- **Real v2 Core**: `composeCanonicalDocument` (unmodified)
- **Real `CanonicalDocument`** → **real Publication renderer**:
  `buildPublicationDocument` + `generatePublicationPdf` (unmodified,
  the exact same function the v2Bridge itself calls for the live
  product's eventual v2 PDF path)
- **Real committed Shippori Mincho font** via
  `createShipporiMinchoMeasurementProvider` (the real font-derived
  measurement provider, NOT the fake/deterministic provider every other
  fixture in this directory uses — chosen specifically so this PDF's own
  facts are the real font's)
- No legacy screenshot renderer, no DOM capture, no rasterized page
  wrapper anywhere in this path.

Output: **`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`**
(1 page, real PDF, `%PDF-` header confirmed, `pageCount` confirmed > 0).

Canonical sample text used (verbatim, per the checkpoint's own
instruction — not substituted with punctuation-heavy diagnostic text):

> 人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。
>
> 「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」

### 4.1 Recorded geometry facts

| Fact | Value | Known to match Human's InDesign reference? |
|---|---|---|
| Paper size | 文庫, 105mm × 148mm | **UNKNOWN** — chosen because it is TateSpun's own most common preset (`src/utils/exportPdf.ts` `PAPER_SIZES.文庫`), not because the Human's InDesign reference is confirmed to use it |
| Body font | Shippori Mincho Regular (real committed asset) | **UNKNOWN** whether InDesign reference uses the same font |
| Body font size | 10.5pt | **UNKNOWN** whether InDesign reference uses the same size |
| Body pitch (character advance) | 3.70417mm (= 1 em at 10.5pt) | derived, not independently chosen |
| Column pitch | 3.70417mm (= 1 em, same formula — TateSpun's column pitch is currently defined as one line-pitch cell per line, see `settingsFor`) | derived |
| Content rectangle | top margin 15mm, bottom margin 12mm, left margin 15mm, right margin 15mm (matches this directory's own `structuralColophonRealSettings.test.ts` precedent for the same 105×148mm paper) | **UNKNOWN** whether these match InDesign reference's own margins |
| Content top anchor | 15mm from paper top | as above |
| First column right anchor | 90mm from paper left (= 105 − 15mm right margin) | as above |
| Characters per line | 32 | derived from content height ÷ em |
| Lines per column | 20 | derived from content width ÷ em |
| Columns per page | 1 | chosen for this small sample (fits in 1 page) |
| Font identity | `tatespun-shippori-mincho-real-measurement-provider@1.0.0+sha256:769b5269f0f9bc65…` | real, asset-derived, reproducible |
| Font units-per-em | 1000 | real, from the font's own `head` table |
| Page count | 1 | this sample text fits in one page at this capacity |

**Facts that remain unknown and were NOT invented**: the InDesign
reference's own paper size, margins, body font, font size, and column
count. This document does not guess any of them. Until the Human
supplies either (a) the reference PDF itself, or (b) the exact InDesign
document settings used, this fixture's geometry can only be described as
"a real, principled TateSpun v2 output at a common, reasonable preset" —
not yet proven equivalent to the Human's own comparison conditions.

---

## 5. Phases 2/3/4/5 — BLOCKED

Vertical drift (origin-offset-vs-slope), horizontal column-pitch drift,
font-equivalence confirmation, and paragraph/line-break comparison all
require measuring the SAME two things at matched physical coordinates:
the InDesign reference and a TateSpun output. With no InDesign reference
PDF present in the repository (§3) and the actual identity of the
Human's compared TateSpun PDF unconfirmed (§2), none of these phases can
be completed honestly this round — attempting to would mean fabricating
one side of the comparison, which this audit explicitly refuses to do.

---

## 6. Root-cause classification (partial — evidence-supported items only)

| Type | Verdict | Basis |
|---|---|---|
| T1 — Export-path difference | **YES (highly likely)** | §2 — the real product's only PDF export is a legacy DOM/CSS screenshot raster, categorically different from v2 Publication's vector tick-based composition. If the Human's overlay used that PDF, T1 alone is sufficient to fully explain a visible drift, independent of any v2 Core/Publication fact. |
| T2 — Page/content origin | UNKNOWN — needs InDesign reference | |
| T3 — Character pitch | UNKNOWN — needs InDesign reference (Round 1's own audit found v2's canonical pitch principled and previously InDesign-validated, but that does not settle a real overlay measurement) | |
| T4 — Column pitch | UNKNOWN — needs InDesign reference | |
| T5 — Font size / glyph scale | UNKNOWN — needs confirmation of InDesign reference's own font/size | |
| T6 — Glyph ink position | UNKNOWN — needs InDesign reference | |
| T7 — Paragraph / layout semantics | UNKNOWN — needs InDesign reference | |
| T8 — Reference conditions not equivalent | **YES (confirmed, partially)** | §4.1 — TateSpun's own controlled fixture uses assumed, not confirmed-equivalent, paper/margin/font/size values relative to the InDesign reference |

**Primary cause, this round's own honest conclusion: cannot be
determined yet.** T1 (export-path mismatch) is the single most likely
full explanation if the Human's TateSpun PDF was the product's real
export button — but this has not been confirmed, and T2–T7 remain
entirely unmeasured pending the InDesign reference file.

---

## 7. Implementation gate

**No correction was implemented this round.** Per the checkpoint's own
gate: *"If reference conditions cannot be made equivalent... STOP."* —
exactly this round's situation. No Core, Preview, or Publication file was
changed. Natural Pitch remains untouched and frozen.

---

## 8. Recommended next action (HUMAN GATE)

Two things are needed to unblock Phase 2 onward, in order of priority:

1. **Confirm which TateSpun PDF produced the BLACK layer in the overlay.**
   If it was the product's real "PDF書き出し" button (the legacy
   DOM-raster path, §2) — that overlay is not evidence against v2
   Publication at all, and the correct next comparison is InDesign vs.
   **this round's own new controlled fixture**
   (`qa/publication/p3-o08/typography-parity-v2-publication-reference.pdf`),
   not the legacy export.
2. **Place the InDesign reference PDF** at
   `typesetting-v2/qa/reference/indesign/molsui-indesign-reference.pdf`
   (or tell Claude its exact InDesign document settings — paper size,
   margins, font, font size — directly), so Phase 2/3 drift measurement
   (origin offset vs. per-character/per-column slope, per the
   checkpoint's own `deltaY(n) = originOffset + n * pitchError +
   residual` model) can run against real, matched physical coordinates
   instead of guessed ones.

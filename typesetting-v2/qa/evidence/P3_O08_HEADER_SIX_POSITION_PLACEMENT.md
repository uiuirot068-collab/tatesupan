# P3-O08 — Header (柱) Six-Position Placement (Human Visual QA HOLD round 24, corrected round 25)

## CORRECTION (round 25, 2026-09-08)

**Previous interpretation (round 24, this document's own original
text below): TOP/CENTER/BOTTOM × OUTER/GUTTER — WRONG.** Human QA
caught the error directly against the round-24 QA PDF: pages 3/4
showed 柱 text sitting at the vertical middle of the physical page.
"CENTER" was never meant as vertical page-center — it means HORIZONTAL
centering within the top/bottom band, the same 小口/中央/ノド axis
folio's own `FolioPosition` already models.

**Correct model: `HeaderBand` ("top"|"bottom", the ONLY vertical axis)
× `FolioPosition` reused directly ("outer"|"center"|"gutter",
horizontal axis).** Six real combinations: TOP×OUTER, TOP×CENTER,
TOP×GUTTER, BOTTOM×OUTER, BOTTOM×CENTER, BOTTOM×GUTTER — no vertical
center anywhere. `core/layout/schema.ts`'s `HeaderVerticalPosition`/
`HeaderSide` types (round 24) are RETIRED, not kept as hidden aliases —
replaced by `HeaderBand` and a direct reuse of `FolioPosition`/
`ResolvedFolioPosition`. `resolveFolioPhysicalSide` is now called with
its own FULL input range (including `"center"`, previously only ever
called with `"outer"`/`"gutter"` for header) — the SAME function,
genuinely exercising the branch this round's own horizontal-center
case needs, still zero duplicate parity logic.

Legacy mapping is unaffected by the correction: `headerSettingsFromLegacy`
still maps `"top"|"bottom"` → `{band, horizontal: "outer"}` — the field
names changed (`vertical`→`band`, `side`→`horizontal`) but the
recovered legacy behavior itself (always outer, band = the literal
legacy value) is identical to round 24's own correct part.

Round 24's own record below is preserved as history, not erased — it
documents what was actually built and why the correction was needed,
consistent with this project's own established practice of recording
corrections rather than deleting the record of what preceded them.

---

## Round 24's own original record (superseded interpretation, kept for history)

Continues from commit `a7a740b` (Human PASS: small kana, folio, header
orientation/content/parity). New Human Product Decision: expand 柱
placement from legacy's own limited top/bottom-only, always-outer
contract to a v2-native 2-axis semantic grid.

### Human Product Decision (round 24, later corrected)

Six supported positions: TOP×OUTER, TOP×GUTTER, CENTER×OUTER,
CENTER×GUTTER, BOTTOM×OUTER, BOTTOM×GUTTER. An intentional TateSpun v2
enhancement — CENTER (vertical) and GUTTER (side) are both new
capabilities with no legacy equivalent.
**[Round 25 correction: "CENTER" here was wrongly read as a vertical
position — see the correction section at the top of this document.]**

## Six-position semantic model

`core/layout/schema.ts`:

```ts
export type HeaderVerticalPosition = "top" | "center" | "bottom";
export type HeaderSide = "outer" | "gutter";
export interface HeaderPositionSetting { vertical: HeaderVerticalPosition; side: HeaderSide; } // settings-level
export interface ResolvedHeaderPosition { vertical: HeaderVerticalPosition; side: "left" | "right"; } // Core-resolved
```

Not represented as six unrelated magic coordinates — a genuine 2-axis
product (3 vertical × 2 side = 6), matching the task's own explicit
instruction.

## Legacy mapping — recovered exactly, not guessed

Direct read of `src/components/PageCard.tsx`'s own `HashiraOverlay`
(:1517-1569): the container spans the SAME left/right inset as the body
frame; text alignment is `isOddPage ? "left" : "right"` — its own
comment states this explicitly: "コンテナの「小口側の端」は奇数=左端・
偶数=右端になる...NombreOverlayの「小口」判定と同じ規約" ("the
container's own 小口-side edge is odd=left, even=right — same
convention as NombreOverlay's own 小口 determination"). This is
EXACTLY `resolveFolioPhysicalSide("outer", isOddPage)` — legacy 柱 was
**always** anchored to 小口 (outer), never configurable, never gutter.

`core/header/index.ts`'s new `headerSettingsFromLegacy(hashiraOdd,
hashiraEven, hashiraPosition)` recovers this exactly: `{vertical:
hashiraPosition, side: "outer"}` — `side` is always `"outer"` for a
legacy-sourced document, matching real behavior, not an assumption.
`"gutter"` and `"center"` have no legacy equivalent to recover — they
are genuinely new v2-only capabilities, not backfilled from anything.

## Parity reuse — not duplicated

`core/header/index.ts`'s `resolveHeaderPosition` calls
`core/folio/index.ts`'s own `resolveFolioPhysicalSide(setting.side,
isOddPage)` directly — `HeaderSide` ("outer"|"gutter") is a structural
subset of `FolioPosition` ("center"|"gutter"|"outer"), so this is a
real, direct function reuse, not a second parity implementation. The
"center" branch of `resolveFolioPhysicalSide` is provably unreachable
for a `HeaderSide` input (TypeScript union proves this at the type
level); the runtime code narrows the return type without an unsafe
cast.

## Physical geometry ownership — unchanged boundary

Core resolves ONLY parity (odd/even → left/right) — pure logic, no
paper geometry needed (unchanged principle from round 22). Publication
(`pdfGenerator.ts`) resolves the FULL 2-axis semantic position into
real mm using `PublicationPageGeometry`'s own margins: `side` uses the
SAME left/right anchor formula folio's own "left"/"right" already
established; `vertical: "top"`/`"bottom"` reuse the existing margin-band
centering (round 23); `vertical: "center"` (new) centers on
`paperHeightMm / 2` — the FULL PAGE height, explicitly NOT the body
content column's own center (per the task's own clarification: "It does
NOT mean: center of the body text column. It is page-furniture
placement."). No paper geometry moved into Core.

## Header text / typography — unchanged

`hashiraOdd`/`hashiraEven`/`hideHashira`/`hashiraOverride`/
`headerFontSize`/HD-005 body-font inheritance: all untouched, round
22/23 logic reused as-is. Horizontal/upright orientation (round 23's
own `horizontalFurnitureCommand`): unchanged, proven for all six
positions by a dedicated test. This round changes placement only, no
new typography behavior.

## Body invariance

Body geometry (`document.pages[0].columns`) proven byte-identical
across all six position combinations, by direct structural comparison
against a furniture-free baseline.

## Preview contract

`GeneratedHeader`/`ResolvedHeaderPosition` are renderer-independent Core
types — Preview's own `PaintPage.header?: GeneratedHeader` field
(round 22) picks up the new shape automatically via its existing
type-only pass-through; no Preview behavior change, still painting
neither folio nor header (pre-existing, unchanged, explicitly not
broadened into this round's own scope).

## QA artifact

`qa/publication/p3-o08/header-six-position-qa.pdf` — 6 odd-page pages
(one per TOP/CENTER/BOTTOM × OUTER/GUTTER combination, visible body
text, header string "作品名"/"章名"), plus an even-page parity proof for
OUTER and GUTTER via a real 2-page manuscript (manual page break).

## Tests

`renderer/publication/headerSixPositionPlacement.test.ts` (21 tests):
six combinations valid, TOP/CENTER/BOTTOM determinism, OUTER/GUTTER
odd/even parity (direct resolver proof + real document proof), legacy
mapping (side always "outer", hashiraOdd/hashiraEven preserved, full
document-level proof), hideHashira/hashiraOverride unaffected,
horizontal orientation unchanged, font-size inheritance unchanged, body
layout byte-identical across all six positions, folio/small-kana
regression, combined-fixture regression, and the QA-artifact generator.
Two prior test files (`folioHeaderCompleteContract.test.ts`,
`smallKanaAndPageFurnitureOrientation.test.ts`) updated to the new
`{vertical, side}` shape — no tests removed, only the fixture syntax
changed to match the new type.

**Full regression:** Core 364/364 (unchanged — zero Core-behavior
change for any existing caller, only additive types), Stage C 21/21,
Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 295/295
(274 + 21 new) — all PASS. `npx tsc --noEmit`: 0 new errors (only the
known pre-existing `src/app/layout.tsx` baseline error).

## Future UI implication (not implemented, documentation only)

A future Editor settings UI would need a 2-select control
(vertical: TOP/CENTER/BOTTOM, side: OUTER/GUTTER) instead of legacy's
single top/bottom radio — out of this round's own scope ("No UI work"),
recorded for whoever scopes that surface next.

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
changed additively (`core/layout/schema.ts`, `core/header/index.ts`) —
every existing caller/test byte-identical (the only BREAKING type
change — `HeaderSettings.position` shape and `GeneratedHeader.position`
shape — is confined to this round's own test files, which were updated
in the same commit; no other production code consumed the old shape).
Preview: zero behavior change. No new dependency. No push, no deploy,
no reset.

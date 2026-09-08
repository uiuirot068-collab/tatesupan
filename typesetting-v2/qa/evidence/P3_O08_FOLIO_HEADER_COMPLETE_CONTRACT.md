# P3-O08 — Folio/Header Complete Contract (Human Visual QA HOLD round 22)

Continues from `qa/evidence/P3_O08_FOLIO_HEADER_CORE_CONTRACT.md`
(commit `5195878`), which left `"gutter"`/`"outer"` folio positions and
柱 (running header) entirely unimplemented. This round completes both
— legacy already answers every question the prior round's own audit
left open; no Human/Product decision was actually needed.

## 1. Legacy parity behavior — recovered exactly, not guessed

`src/components/PageCard.tsx:335`: `const isOddPage = pageNumber % 2
=== 1;` — parity is the PHYSICAL page number (1-based), never the
displayed folio value (which can be offset by `nombreStart` and is
resolved separately). Cross-checked identical in TWO independent
places in the same file:

- `sheetStyle`'s own padding logic (:357-363): `paddingLeft: isOddPage
  ? marginOuter : marginGutter`, `paddingRight: isOddPage ? marginGutter
  : marginOuter`.
- `NombreOverlay`'s own `anchoredSide` logic (:1384-1391): `position ===
  "outer" ? (isOddPage ? "left" : "right") : (isOddPage ? "right" :
  "left")`.

Both encode the SAME right-bound (右綴じ) tategaki convention: an odd
page (recto) is the LEFT side of a 見開き spread, so 小口/outer=left,
ノド/gutter=right; an even page (verso) mirrors. Blank pages are not
separately handled — parity is purely `pageNumber % 2`. This is fully
recoverable, deterministic LOGIC (no physical geometry needed to decide
WHICH side), so — correcting round 21's own working assumption —
**this was never actually a Human/Product decision; it was an
un-investigated implementation detail.**

## 2. Outer/gutter semantics — implemented

`core/folio/index.ts`'s `resolveFolioPhysicalSide(position, isOddPage)`
ports the above verbatim. `composeFolioForPage` now accepts the full
`FolioPosition` (`"center"|"gutter"|"outer"`) and resolves it to a
`ResolvedFolioPosition` (`"center"|"left"|"right"`) before attaching to
`CanonicalPage.folio` — proven by 4 dedicated tests (odd+outer→left,
odd+gutter→right — the exact mirror on the same page, center-unaffected,
determinism).

## 3. Core vs. Publication geometry ownership — clarified, not broadened

Resolving `"gutter"`/`"outer"` → `"left"`/`"right"` needs ONLY page
parity (Core already has `page.order`) — no paper width/margins
required, so this stays entirely in Core, matching "Core owns
parity-sensitive positioning." Converting `"left"`/`"right"`/`"center"`
into an actual mm coordinate DOES need real margins
(`PublicationPageGeometry.marginLeftMm`/`marginRightMm`/`paperWidthMm`)
— that conversion stays in `pdfGenerator.ts`, unchanged from round 21's
own boundary. No physical-geometry ownership moved into Core; the split
is exactly as narrow as the actual logic required.

## 4. Header canonical representation — added

New `core/layout/schema.ts` types: `HeaderPosition` (`"top"|"bottom"`,
ported from legacy `HashiraPosition`) and `GeneratedHeader` (`{text,
position}`) — kept SEPARATE from `GeneratedPageFurniture` (folio's own
type) rather than force-fit into one shared shape: 柱's own position
axis (top/bottom) is a genuinely different concept from folio's
(center/left/right), and this codebase's own established convention
(the entire P3-O08 yakumono history) is to avoid a shared abstraction
two real, differently-shaped concepts would have to be awkwardly
squeezed into. `CanonicalPage.header?: GeneratedHeader` (new field,
alongside the existing `folio?`).

## 5. Header odd/even logic

New `core/header/index.ts`: `composeHeaderForPage` ports
`PageCard.tsx:515`'s own `defaultHashiraText = isOddPage ?
masterPage.hashiraOdd : masterPage.hashiraEven` verbatim, using the
SAME parity definition folio now uses (`pageNumber % 2 === 1`).

## 6. Suppression/override

`HeaderPageOverride` ports legacy `PageOverride`'s own
`hideHashira`/`hashiraOverride` exactly — `hideHashira` suppresses
(returns `undefined`, same optional-field convention as folio's own
suppression), `hashiraOverride` replaces the normal odd/even content
for that one page. `DocumentCompositionInput.headerPageOverrides`
mirrors legacy `PageSettings.pageOverrides`'s own 1-based-page-number-
keyed shape exactly. An empty resolved string (legacy's own
`hashiraOdd`/`hashiraEven: ""` default) produces no header at all —
matches `NombreOverlay`'s own "nothing to paint" convention for empty
content, proven by a dedicated test using `DEFAULT_HEADER_SETTINGS`.

## 7. Font inheritance

HD-005's own default (inherit body font) is what's implemented — same
as folio's own round-20/21 scope. No separate font-family/font-size
override mechanism exists in Publication's rendering pipeline (same
gap already recorded for folio); `headerFontSize`'s own real legacy
value is not yet threaded through, consistent with "Do NOT create
separate font-family settings" / "Shippori remains the current
Publication font" from this round's own instruction.

## 8. Preview/Publication parity

Both renderers consume the SAME `CanonicalPage.folio`/`header` fields.
Preview's own `PaintPage` gained a `header?: GeneratedHeader`
pass-through field (mirroring its own pre-existing `folio?` pass-
through) — no duplicate content/parity/suppression logic; Preview still
paints neither (pre-existing gap, unchanged, not this round's scope).
Publication resolves and paints both, using the real vector font path,
proven by a dedicated test.

## 9. Remaining compatibility differences (not implemented this round)

- Per-page `hideNombre` override for FOLIO specifically (header's own
  `hideHashira`/`hashiraOverride` ARE implemented this round; folio's
  analogous per-page override remains a real, recorded gap).
- `nombreBottomMargin` (exact legacy distance value) — Publication uses
  `PublicationPageGeometry.marginBottomMm` directly instead of a
  separate configurable distance.
- `nombreFontSize`/`nombreFontFamily`/`headerFontSize` real override
  values — only HD-005's own default is implemented.
- `showHiddenNombre` (trim-guide-adjacent faint always-on nombre) — not
  audited this round, not implemented.
- Preview paint logic for either folio or header — still zero, both
  rounds 21 and 22 only built Core generation + Publication paint.

## 10. QA artifact

`qa/publication/p3-o08/folio-header-complete-contract-qa.pdf` — 12
pages, ALL through the real `composeCanonicalDocument({ folioSettings,
headerSettings, headerPageOverrides })` pipeline (zero synthetic
injection): odd+center, even+center, odd+outer (left), even+outer
(right), odd+gutter (right), even+gutter (left), first-page suppression,
odd/even header, hideHashira, hashiraOverride, folio+header together,
body-unaffected (no furniture at all).

## Tests

`renderer/publication/folioHeaderCompleteContract.test.ts` (20 tests):
folio gutter/outer resolution (4 + determinism + suppression-
interaction + no-SourceSpan), header content/position/suppression/
override/empty-default/no-SourceSpan/font-inheritance (7), integration
(coexistence, body-layout invariance, vector-only paint, Preview pass-
through) (4), combined-fixture regression, and the QA-artifact
generator.

**Full regression:** Core 364/364 (the EXACT unchanged count — the new
`headerSettings`/`headerPageOverrides` fields are additive and optional,
every existing caller byte-identical), Stage C 21/21, Stage D 30/30,
P3-O09 (Preview) 114/114, P3-O08 (Publication) 254/254 (234 + 20 new) —
all PASS. `npx tsc --noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
changed additively (`core/layout/schema.ts`, `core/layout/assemble.ts`,
`core/folio/index.ts` extended, new `core/header/index.ts`, `core/index.ts`
exports) — every existing caller/test byte-identical. Preview: one
type-only pass-through field added, zero behavior change. No new
dependency. No push, no deploy, no reset.

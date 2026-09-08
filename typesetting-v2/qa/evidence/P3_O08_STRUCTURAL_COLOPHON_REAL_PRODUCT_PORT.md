# P3-O08 — Structural Colophon: Real Product Settings Port (Human Visual QA HOLD round 27, Step 2B)

Final-page completion, Step 2 continued (Folio/Header → Structural
Colophon → Real Image Embedding → JPG Export). Continues from commit
`1da3406`. Round 26 (`P3_O08_STRUCTURAL_COLOPHON.md`) proved the
STRUCTURAL PRIMITIVE using plain-text fixtures and explicitly withheld
Human PASS pending this round's own real-settings port. **This round
still does not claim full parity — two real gaps remain disclosed in
§9 — Structural Colophon is NOT marked Human PASS by this document.**

## 1. Legacy `ColophonSettings` contract (direct read, `src/lib/colophon.ts`)

```
ColophonSettings {
  enabled: boolean;
  templateId: "standard" | "center" | "minimal" | "classic";
  fontFamily: string;          // "" (COLOPHON_FONT_SAME_AS_BODY) = same as body
  fields: ColophonField[];     // { id, label, value, visible }
  freeText: string;
  pagePosition: ColophonPagePosition;  // {mode:"end"} | {mode:"after-body-page", afterBodyPage}
  placement: ColophonPlacement;        // horizontal/vertical/respectGutter/respectVerticalMargins
}
```

`defaultColophonFields()` (`colophon.ts:101-111`) — 7 real fields, in
this exact order: 書名/著者名/サークル名/発行日/印刷所/連絡先 (all
`visible:true`), 発行者 (`visible:false`). `DEFAULT_COLOPHON_PLACEMENT`
(`colophon.ts:76-81`) = `{horizontal:"center", vertical:"center",
respectGutter:true, respectVerticalMargins:true}`.
`DEFAULT_COLOPHON_PAGE_POSITION` = `{mode:"end"}`.

Own doc comment at `colophon.ts:55`: pagePosition ("A") and placement
("B") are explicitly "完全に別概念" (completely separate concepts) — not
conflated in this port either (see §5).

## 2. Product compiler — `compileColophonContent` (Core, `core/colophon/index.ts`)

Ported verbatim from `colophonRenderModel` (`colophon.ts:400-405`):

```ts
export function compileColophonContent(settings: ColophonContentSettings): ColophonCompiledContent {
  const rows = settings.fields
    .filter((f) => f.visible && (f.label.trim() !== "" || f.value.trim() !== ""))
    .map((f) => ({ label: f.label, value: f.value }));
  return { rows, freeText: settings.freeText };
}
```

Filter condition is byte-identical to legacy's own: a field is included
only when `visible` AND (`label` OR `value` has non-whitespace
content). Order preserved exactly as supplied (legacy never re-sorts).
`freeText` passed through unfiltered — legacy's own blank-suppression
(`FreeText` component: `if (text.trim()==="") return null;`) is a
render-time concern the compiler does not need to duplicate; callers
apply the same `trim()!==""` check (this round's fixture builder does,
§6).

Exported publicly via `core/index.ts` for the first time this round,
alongside `composeColophon` itself (previously internal-only).

## 3. Templates — confirmed content-agnostic, not ported as a parameter

Direct read of `src/components/ColophonPageCard.tsx`: all 4 templates
(`StandardTemplate`/`CenterTemplate`/`MinimalTemplate`/`ClassicTemplate`)
consume the exact same `{rows, freeText}` from `colophonRenderModel` —
own comment: "4テンプレートは同一ColophonSettingsを描画するだけ".
Templates are a VISUAL/placement concern only. `compileColophonContent`
therefore correctly takes no `templateId` parameter — proven by test
("templates are a visual concern only", round-27 test file, describe
block "Product compiler").

## 4. Field ordering / blank-field filtering — proven, not asserted

Tests: legacy field order preserved exactly (`書名`→`著者名`→`サークル名`
→`発行日`→`印刷所`→`連絡先`); hidden `発行者` filtered even with a real
value; a field with both label AND value blank filtered; a field with
only a value (blank label) KEPT (matches legacy's OR condition, not
AND); an invisible field always excluded regardless of content.

## 5. pagePosition vs placement — recovered as distinct, not conflated

**pagePosition** (WHERE the colophon's pages land): ported as a pure
decision function, `resolveColophonInsertion` (verbatim from
`colophon.ts:266-277`):

```ts
export function resolveColophonInsertion(position: ColophonPagePosition, bodyPageCount: number): ColophonInsertion {
  const n = Math.max(0, Math.floor(bodyPageCount));
  if (position.mode === "after-body-page") {
    const req = position.afterBodyPage;
    if (req <= n) return { precedingBodyPages: req, fallback: false, requestedPage: req };
    return { precedingBodyPages: n, fallback: true, requestedPage: req };
  }
  return { precedingBodyPages: n, fallback: false, requestedPage: null };
}
```

Proven: `{mode:"end"}` → `precedingBodyPages` equals the full real body
count; `{mode:"after-body-page", afterBodyPage:3}` within range →
resolves to exactly 3, no fallback; `afterBodyPage:300` against a
5-page body → falls back to end (`fallback:true`, `precedingBodyPages:5`),
**never crashes, never loses the colophon** — legacy's own real
guarantee, ported and tested exactly.

**placement** (WHERE content sits WITHIN a colophon page — block-level
horizontal/vertical anchor, `ColophonPlacement`): **NOT ported this
round.** See §9.

These are two different axes and neither is stood in for the other
anywhere in this round's code or tests.

## 6. Provenance (INV-001)

Compiled colophon content is built into `LogicalUnit[]` via a
QA/test-only helper, `colophonFixturePieces` (round-27 test file) —
converts each compiled row into a `"label\tvalue"` TEXT piece on its
own composed line, using the REAL `PARAGRAPH_BREAK` FixturePiece kind
(`core/compose/line.ts:64`'s own "bare manuscript line ending"
mechanism) between rows/freeText lines — never a literal `\n` character
embedded mid-string (round 26's own fixture used that; it does not
actually force a Core line break, an undetected gap this round's
approach avoids). The resulting `LogicalUnit[]` is fed through
`buildFixtureUnits("colophon", ...)`, producing a real `SourceSpan`
against the colophon's OWN dedicated block (`blockId:"colophon"`),
proven by test — never fabricated against the body's own source.

## 7. Publication rendering — real compiled rows painted as label/value pairs

`pdfGenerator.ts`'s `buildColophonPaintPage`: each composed colophon
line's joined text is checked for a `\t`. If present (a real compiled
row), it is split into `[label, value]` and painted as **two separate**
`{op:"text"}` commands — label flush to the content-left margin
(`align:"left"`), value flush to the content-right margin
(`align:"right"`), same `yCenter` — the closest faithful text-level
equivalent of legacy's real `FragmentRow` 2-column CSS grid
(`ColophonPageCard.tsx`), which has NO literal separator character
between label and value (confirmed by direct read — no "：" or similar
is invented here). The raw tab character never reaches a painted
command's own `text` field — proven by test. A line without a tab
(freeText) continues to paint as one centered line, unchanged from
round 26. This "row column layout" is a paint-detail choice, distinct
from `ColophonPlacement` (§5/§9) — it does not attempt to satisfy
`ColophonPlacement.horizontal`.

## 8. Overflow — no silent clip, proven with a real oversized fixture

A deliberately long, real-settings colophon (all 7 legacy fields + an
extra field + 3-line freeText, ~11 real content lines) composed against
a `linesPerColumn:3` capacity: `document.colophon.pages.length > 1` —
Core's own pre-existing `composePages` mechanism (already proven,
round 26, capable of producing an array of pages) naturally overflows
onto additional colophon pages rather than clipping. Folio values
across the resulting pages are monotonically increasing with no gap —
folio/header continuation (round 26's own mechanism) holds correctly
across a multi-page colophon, not just a single one. **No new overflow
algorithm was written** — this is the existing generic page-composition
mechanism, exercised honestly rather than assumed.

## 9. Remaining gaps — disclosed, not faked

1. **`{mode:"after-body-page"}` is not wired into actual page
   composition.** `resolveColophonInsertion`'s DECISION is real, tested,
   and correct in isolation (§5), but `core/layout/assemble.ts` still
   always appends the colophon after the FULL real body page count
   (`{mode:"end"}` behavior), regardless of what `pagePosition` a
   caller supplies. Executing `after-body-page` for real requires
   re-interleaving `CanonicalDocument.pages` itself and re-deriving
   every subsequent body page's own folio/header `pageIndex` —
   materially larger than this round's scope. Proven directly by test
   ("DISCLOSED GAP: after-body-page's resolved insertion is NOT wired
   into actual page composition this round").
2. **`ColophonPlacement` (block-level horizontal/vertical page anchor)
   is not ported.** Colophon content always starts near the page's own
   top margin, spanning the full content-width column — `"center"`/
   `"top"`/`"bottom"` block anchoring, `respectGutter`,
   `respectVerticalMargins` are all real legacy fields with no v2
   effect yet. (Coincidentally, legacy's own DEFAULT is
   `horizontal:"center"`, and the current top-anchored default does not
   contradict any test fixture used so far — but this is not the same
   as having ported the mechanism.)
3. **Multi-column colophon overflow within a single page** (disclosed
   round 26, unchanged): only the first column of each colophon page is
   painted. §8's overflow proof relies on Core producing MORE PAGES,
   not more columns per page — real, but a narrower guarantee than full
   multi-column layout.

None of these are silently generalized or assumed away; each has a
direct test naming the gap.

## 10. QA artifact

`qa/publication/p3-o08/structural-colophon-real-settings-qa.pdf` — 3
documents (6 pages total), **every colophon compiled from a real
`ColophonFieldInput[]`/`freeText` fixture through `compileColophonContent`,
zero synthetic plain-text final fixtures**:
- Minimal structured colophon (single visible field: 書名/短編).
- Fuller structured colophon (5 of the 7 legacy default fields
  populated + 2-line freeText), real folio + header.
- Blank-optional-field + hidden-field colophon (書名 visible; one
  fully-blank field; one `visible:false` field with a real value) —
  proven, by direct assertion on the compiled content, that neither
  survives into the row list actually painted.

## 11. Tests

`renderer/publication/structuralColophonRealSettings.test.ts` (26
tests): product compiler determinism/ordering/filtering (8), placement
vs pagePosition recovery including the disclosed after-body-page gap
(4), Canonical real-settings flow + provenance + body invariance (3),
page furniture folio/header on real-settings colophon (3), overflow
proof (1), Publication rendering incl. the label/value row split proof
(4), regression incl. small-kana (2), and the real-settings QA
generator (1).

**Full regression:** Core 364/364 (unchanged), Stage C 21/21, Stage D
30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 338/338 (312 +
26 new) — all PASS. `npx tsc --noEmit`: 0 new errors (only the known
pre-existing `src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
changed additively (`core/colophon/index.ts` — new
`compileColophonContent`/`resolveColophonInsertion`/types;
`core/index.ts` — new barrel exports). Publication: additive change to
`buildColophonPaintPage`'s own line-painting branch (tab-detection
row-split), no change to any other paint path. No new dependency. No
push, no deploy, no reset. No image embedding, no JPG, no DeviceGray,
no bleed/trim, no UI, no Production changes.

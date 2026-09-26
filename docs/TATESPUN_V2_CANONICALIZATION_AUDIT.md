# TateSpun V2 Canonicalization & LEGACY Dependency Audit

Phase 2 of the post-beta typography train. Branch `tsp-post-beta-typography-phase1`
(base `origin/master` 0635395; Phase 1 606ebb3, Phase 1.1 313d322). Date 2026-09-26.
Scope: map what is truly V2-canonical, what still depends on LEGACY, and where
Preview and Publication interpret the same composition differently. Conservative
fixes only; nothing pushed/merged/deployed. Every claim below cites source or a
probe that was run on this branch.

Legend for classifications: **A** V2 canonical · **B** V2 with duplicated
renderer logic · **C** V2 + LEGACY dependency · **D** LEGACY-only ·
**E** separate / non-render path · **F** unclear / unsafe to change.

---

## 1. Runtime architecture

```
manuscript string (Editor state; IndexedDB / cloud `content`)
  │
  ├─ LEGACY side (still runs in V2 mode, main thread, every 180 ms debounce)
  │    tokenizeTategaki ─► paginateTokens (src/lib/tategaki.ts)
  │         └─► PreviewPane `pages`  ─► page list, selection, colophon slot,
  │              image-break pages, odd-page warning, JPG/ZIP/PDF scopes,
  │              page reorder, PageCard per page (+ LEGACY image/folio overlays)
  │    computePageSourceRanges ─► caret ↔ page, TOC page numbers, reorder splice
  │
  └─ V2 side (Web Worker `src/workers/v2Preview.worker.ts`)
       tokenizeTategakiWithOffsets ─► manuscriptAdapter (LogicalUnit[])
       ─► composeCanonicalDocument (Core: breaks, atoms, lines, pages, folio,
          header, colophon, pageSequence)
       ─► buildPublicationDocument (mm) + buildPaintPlan  [plan unused, see §12]
       ─► buildV2PreviewDocument (px)  ─► PageCard `v2PreviewPage` ─► PreviewPage
     export (main thread): bridge.model ─► buildPublicationPaintPlan(font)
       ─► JPG: rasterGeneratorBrowser (Canvas)   ─► PDF: v2Pdf.worker (jsPDF)
```

Renderer selection: `src/lib/v2Rollout.ts` — unset → `V2_BETA` (production
GitHub Pages build sets no value, `.github/workflows/deploy.yml`); explicit
`LEGACY` = emergency rollback; dev (`NODE_ENV !== "production"`) always V2
(`PreviewPane.tsx` `useV2Engine`). The flag is read in exactly one component
(`PreviewPane.tsx`, 17 references) plus `feedbackEnvironment.ts` (reporting).

## 2. Feature-path matrix

| Feature | Source → Parse → Adapter → Core → Preview → JPG → PDF | Class |
|---|---|---|
| Plain body text | string → tokenizer → TEXT units → Core atoms → PreviewPage (CSS glyphs) → Canvas text / jsPDF text+outline | **A** (glyph *placement technology* intentionally differs, §5) |
| Ruby | `｜基《よみ》` → ruby token → `pushRubyUnit` (ATOMIC) → `placeRuby` → shared `rubyLane.ts` in both painters | **A** |
| TCY | tokenizer → TCY unit (1 cell) → CSS `text-combine-upright` / jsPDF horizontal fit | **A** (fit mechanism intentionally differs) |
| 傍点 | `《《…》》` → decoration → `InlineDecoration` → paint-only → shared `emphasisMarks.ts` → DOM dot / `circle` op | **A** |
| Dash `――` | adapter DASH SEMANTIC_RUN → cl-08 inseparable → one CSS run / per-grapheme outline | **A** |
| Ellipsis `……` | adapter ELLIPSIS SEMANTIC_RUN (`‥` stays TEXT) | **A** |
| Kinsoku / hanging | V2: `DEFAULT_RULE_SET_V2` classes; LEGACY: `LINE_START_PROHIBITED` etc. (stricter V2 for cl-05/12/13) | **C** — page list uses LEGACY rules (§8) |
| Paragraph indent | Core `needsAutoIndent` (V2) / `paragraphNeedsAutoIndent` (LEGACY), ported verbatim | **C** (two copies of the rule; ruby-first paragraph differs: V2 no indent) |
| Manual page break `【改ページ】` | tokenizer pageBreak → MANUAL_BREAK → Core page close | **A** for pages; LEGACY page list mirrors it |
| Blank pages (consecutive breaks) | same as above | **A/C** |
| Images (layout) | IMG marker → IMAGE unit (advance = intrinsic height) → Core | **A** in export; **C** in Preview (§7) |
| Image paint | Preview: LEGACY `ImagePositionOverlay`/`FullPageImage` on LEGACY page tokens (`PageCard.tsx` 969-983, `paintImages={false}`); export: `pdfGenerator.unitCommands` IMAGE branch | **B/C — divergent** (§7) |
| Running head (柱) | Preview: LEGACY `HashiraOverlay`; export: Core `core/header` + `pdfGenerator` | **B** divergent geometry |
| Folio / ノンブル | Preview: LEGACY `NombreOverlay` (`nombreBottomMargin`, `nombreFontFamily`, per-page `hideNombre`, hidden nombre); export: Core `core/folio` (those four listed out of scope in `core/folio/index.ts:12-13,76`) + `marginBottom/2` placement | **B** divergent |
| Web閲覧用 footer branding | Preview: LEGACY `WebFooterOverlay`; export: none in V2 | **D** (missing in V2 JPG) |
| Title / TOC / front matter | `BookPartsModal` + `utils/bookStructure`/`tocGenerator` generate manuscript TEXT; TOC page numbers from LEGACY `computePageSourceRanges` | **E** (+**C** for TOC numbers) |
| Colophon | Preview (V2 mode too): LEGACY `ColophonPageCard` (`PreviewPane.tsx` ~2659), slot from LEGACY `resolveColophonInsertion(pages.length)`; export: Core colophon block + `pageSequence` (`buildColophonPaintPages` output is built but not shown) | **B/C** — two painters, two placement computations (agree while page counts agree) |
| Preview (desktop) | PreviewPane (LEGACY page list) + V2 page paint | **C** |
| Mobile Preview / export | same PreviewPane + `exportMenuEntries` handlers | **C** (identical to desktop) |
| Single / selected / batch JPG, ZIP | `exportV2JpgPages` → shared PaintPlan → Canvas | **A** for pixels; **C** for page selection (body indices from LEGACY list) |
| PDF | `runPdfExport` → `requireV2PublicationPlan` → v2Pdf.worker | **A** pixels; **C** scope/odd-page count |
| TXT export | raw source (`encodeUtf8Txt`) / readable (`serializeReadableTxt`) | **E** |
| Cloud restore | content + settings + images → same paths; missing images → `unresolvedImageIds` (LEGACY pages) and `findUnresolvedImageIssues` (V2 plan refusal) | **C** |
| Print/export-specific DOM | LEGACY only (`utils/exportCapture.ts`, `exportPdf.ts`, `exportImage.ts`, `ensureExportMount`) | **D** (rollback path) |

## 3. V2 canonical areas (A)

- Composition: `typesetting-v2/core/**` (breaks, atoms, lines, columns, pages,
  colophon insertion, `pageSequence`, folio/header generation).
- Manuscript → units: `src/lib/v2Bridge/manuscriptAdapter.ts` (single tokenizer, no
  second parser).
- Paint semantics shared by both painters: `renderer/rubyLane.ts`,
  `renderer/emphasisMarks.ts`, **`renderer/lastAtomExtent.ts` (new, §9)**.
- Export pixels: one Publication `PaintPlan` for JPG (all variants, ZIP) and PDF.
- Architecture lock (new): `src/lib/v2Bridge/canonicalArchitecture.test.ts` —
  no file under `src/lib/v2Bridge`, `src/workers`, `src/lib/v2BrowserExport.ts`,
  `typesetting-v2/core`, `typesetting-v2/renderer` imports PageCard,
  ColophonPageCard, `utils/export{Capture,Pdf,Image}`, `html-to-image`, `html2canvas`.

## 4. Remaining LEGACY dependencies

| Dependency | Where | Why it exists | Production depends? | Removal safe now? |
|---|---|---|---|---|
| `paginateTokens` page list | `PreviewPane.tsx:548` | Preview page cards, selection, reorder, all body indices predate V2 | **Yes** (V2 mode too) | No — every UI index flows from it (§8) |
| `computePageSourceRanges` | `PreviewPane.tsx:612`, `utils/tocGenerator.ts:101,163`, reorder | caret↔page, TOC numbers, exact source splicing | Yes | No |
| Image overlays in V2 Preview | `PageCard.tsx:969-983` | V2 Preview renderer never gained image paint parity (`paintImages={false}`) | Yes | No (§7) |
| Folio/柱/hidden nombre/web footer overlays | `PageCard.tsx:1146-1184` | V2 Preview paints no page furniture (`preview/paintModel.ts` pass-through comment) | Yes | No |
| Colophon Preview card | `ColophonPageCard.tsx` via `PreviewPane.tsx` ~2659 | V2 colophon paint pages never wired into the Preview | Yes | No |
| `onBodyPageCountChange` from LEGACY count | `PreviewPane.tsx:676-678` (and V2 at 770-774) | two effects report two counts; last writer wins | Yes | Only after §8 decision |
| LEGACY capture/export stack | `utils/exportCapture.ts`, `exportPdf.ts`, `exportImage.ts`, `ensureExportMount`, `waitForCaptureTargetsReady` | `LEGACY` rollback | Only when flag = LEGACY | Keep (rollback) |
| `PageCard` FixedSlot text renderer | `PageCard.tsx` (≈2600 lines) | rollback + non-V2 fallback surface | Only when flag = LEGACY | Keep (rollback) |
| `nowrapRunBoundaryEdge` etc. | `src/lib/tategaki.ts` ← `src/app/renderer-poc/p1Adapter.ts` | PoC | No (`renderer-poc` has no `page.tsx`; test `releaseBlockerFix.test.ts:69` enforces) | Yes, later (dead code) |
| `PreviewPaneNew.tsx` | unmounted (test `releaseBlockerFix.test.ts:18-19` forbids import) | earlier V2 shell | No | Yes, later (dead code; `rcUiInformationArchitecture.test.ts:50` still reads it) |
| Tests | ~40 LEGACY-renderer tests (`PageCard.test.ts`, `pagedEditor*`, `tategakiPageSourceRangeAudit`, `verify-*.mjs`) | rollback contract | — | Keep with rollback |

## 5. Preview / Publication duplicated responsibilities

| Responsibility | Preview | Publication | Verdict |
|---|---|---|---|
| Unit order / span / top / height | `preview/paintModel.ts` | `publication/paintModel.ts` | Same algorithm, two copies (px vs mm). Locked by parity test (§9). **SHOULD SHARE LATER** (one tick-level model + unit conversion) |
| Line-final atom extent | was inline in both | was inline in both, **different fallback** | **SHARED NOW** (`lastAtomExtent.ts`, bug fix) |
| Ruby lane (cross-axis) | `rubyLane.ts` | `rubyLane.ts` | Already shared |
| 傍点 geometry | `emphasisMarks.ts` | `emphasisMarks.ts` | Already shared |
| Glyph placement inside the cell | browser layout (vertical-rl, CSS) | baseline ratio, GSUB outlines, `vpal`, yakumono edge align | **INTENTIONALLY DIFFERENT** (technology), semantics identical |
| Dash / ellipsis paint | one native CSS run | per-grapheme vertical forms / outlines | **INTENTIONALLY DIFFERENT** |
| TCY fit | `text-combine-upright` | jsPDF measure-then-scale | **INTENTIONALLY DIFFERENT** |
| Image geometry | LEGACY overlay: cap 90% text width × 60% text height, flex row with 4 mm gap, layer order, grayscale CSS | Core box, cap 100% content box, each image centered independently, no layer order, **original colour** | **DIVERGENT — SHOULD SHARE (Phase 3)** |
| Folio / 柱 geometry | LEGACY overlays from settings | Core furniture + `pdfGenerator` mm placement | **DIVERGENT — SHOULD SHARE LATER** |
| Page bounds / clipping | `.unit-ink` overflow + page box | none (vector) | Intentionally different |

## 6. Export dependencies

- Every V2 JPG/ZIP/PDF export obtains pages from **one** canonical composition
  (`v2Adapter.bridge`) → one `buildPublicationPaintPlan` per export. No
  re-pagination, no DOM capture, no dependency on virtualized/mounted Preview
  pages (the LEGACY `ensureExportMount`/`waitForCaptureTargetsReady` path is
  rollback-only).
- **Page selection is LEGACY-indexed**: body indices come from the LEGACY page
  list and are mapped to physical PaintPlan indices by
  `physicalIndexForBodyIndex` (now one helper, §9). PDF "all" uses the V2 plan
  length, but the odd-page warning uses the LEGACY `pages.length`
  (`PreviewPane.tsx` `shouldWarnOddPageExport`).
- **Stale-composition race (Phase 3)**: `useV2PreviewAdapter` keeps the
  previous `bridge` while a new compose runs and does not flip `loading` on
  restart; export reads `v2Adapter.bridge` without checking it matches the
  current content. Exporting within ~180 ms + compose time of an edit can export
  the previous text. LEGACY `pages` (another debounce) may transiently disagree
  with the bridge on page count.
- Plan is rebuilt (font parse, outline/GPOS/yakumono contexts) on every export
  click; the worker also builds an unused plan (§12).
- File naming: body JPGs use **body** number (`buildPageJpgFileName(title,
  index + 1)`), the colophon JPG uses its **physical** number; Preview labels and
  folios are physical. With `after-body-page` colophon, body page N is labelled
  N+1 in Preview but saved as `…N.jpg`. Not changed (naming semantics).

## 7. Image rendering path

1. Insert: `PreviewPane.handleInsertImage` → `fitImageToMm(…, textArea × 0.9,
   textArea × 0.6)` → marker `【IMG:id:w:h:pos】` appended at the page's source end.
2. Storage: IndexedDB originals + cloud sync/expiry; unresolved ids →
   `unresolvedImageIds` → LEGACY page tokens → footer warning / page-scoped
   export block; V2 export additionally refuses via `findUnresolvedImageIssues`.
   UI placeholders are LEGACY DOM with `data-no-print` and never reach V2
   export (V2 does not capture DOM) — safe.
3. Layout: V2 Core IMAGE atom advance = marker height; LEGACY image = 0-length
   overlay with `appendTrailingImage` (an image right after a full page stays on
   that page).
4. Paint: Preview = LEGACY overlays on LEGACY pages; export = V2 geometry.

Probe results (this branch, default 文庫 settings):
- **Boundary image page mismatch**: 30 paragraph+center-image blocks → same
  page count, but 4 pages differ in which images they hold (e.g. `a6` on body
  page 2 in Preview, page 3 in JPG/PDF). Cause: LEGACY `appendTrailingImage`
  has no V2 equivalent.
- **V2 HOLD on tall images**: an image taller than the line extent
  (`charsPerLine × em`, 120 mm here) → Core `SINGLE_ATOM_EXCEEDS_LINE_EXTENT` →
  document HOLD → Preview error + export refused. Insert caps height at 60 %, so
  this is reached by later settings changes (bigger font / margins / smaller
  paper) or hand-edited markers. LEGACY display-scales instead.
- Size cap differs (90 %×60 % vs 100 % content box); multiple images at one
  position flow in a row in Preview but overlap in export; layer order is
  Preview-only; export images are colour while Preview (CSS filter) and the
  LEGACY PDF spec are grayscale (V2 grayscale listed "not yet complete",
  `typesetting-v2/docs/architecture/PHASE3_OPEN_ITEMS.md` P3-O08).

## 8. Page / index ownership

| Quantity | Authoritative owner (today) | Other copies |
|---|---|---|
| Paper size, margins | `PageSettings` → `resolvePaperSize`; V2 `buildV2PageGeometry` | LEGACY `computePageLayout` / `sheetStyle` |
| Effective chars/line, lines/column | **Two owners**: LEGACY `computePageLayout` clamps to capacity; V2 `buildV2LayoutSettings` uses the persisted target as-is (header comment records this as a Human instruction) | settings panel commits the clamped value (`PageSettingsPanel.tsx` TSP-LOOP-029 C) |
| Column count / line pitch | `PageSettings` → both | — |
| Character advance | Core (measurement provider) / LEGACY 1 slot | — |
| Page break boundaries | V2 Core for pixels; LEGACY `paginateTokens` for UI | `computePageSourceRanges` (third copy of the loop, kept in lock-step by hand) |
| Physical page index | Core `pageSequence` (V2); LEGACY `presentationSequence` (PreviewPane) | now `pageIndex.ts` for V2 conversions |
| Body page index | LEGACY page list | image warnings, JPG names, selection |
| Page number (folio) | Core folio (export) / `nombreStart + physical − 1` in PageCard (Preview) | ColophonPageCard |

Measured parity (`canonicalArchitecture.test.ts`): LEGACY and V2 body page
counts are **identical** for committed settings across demo, long prose,
kinsoku-heavy, ruby-first, image+page-break and 傍点 manuscripts, 1段 and 2段.
They **diverge** when stored targets exceed capacity (probe: 60 chars/line on
文庫 → LEGACY 19 pages, V2 13; 40 lines → 19 vs 8) — then Preview shows blank
cards for missing V2 pages and JPG export of those pages fails closed. Reachable
only through non-panel writers (e.g. `update()` outside margin mode, older saved
projects).

## 9. Safe canonicalizations completed (Phase 2)

1. **`src/lib/v2Bridge/pageIndex.ts`** — `physicalIndexForBodyIndex`,
   `colophonPhysicalIndex`, `resolvePdfPhysicalIndices`; replaces four inline
   copies in `PreviewPane.tsx` (single JPG, colophon JPG, batch/ZIP via the same
   helper, PDF scope). Behavior-identical incl. the −1 fail-closed path.
2. **`typesetting-v2/renderer/lastAtomExtent.ts`** — one line-final-atom extent
   for both paint models. Bug fixed: Publication fell back to `linePitchTicks`
   (column pitch) for a line's only atom, so a document-final single character
   (e.g. `完`) was painted ~0.44 em lower in PDF/JPG than in Preview.
3. **Architecture tests** (`src/lib/v2Bridge/canonicalArchitecture.test.ts`):
   index vocabulary, Core `pageSequence` colophon placement, LEGACY↔V2 page-count
   parity, Preview↔Publication unit/extent/decoration parity, line-final atom
   parity, V2-path import boundary.

## 10. Deferred risky changes

| Item | Risk / reason deferred |
|---|---|
| Make V2 the owner of the Preview page list (replace `paginateTokens`) | Touches selection, reorder, TOC, caret mapping, image warnings — editor-wide |
| Single effective-grid owner (V2 adapter uses `computePageLayout`) | Overrides a recorded Human instruction in `settingsAdapter.ts`; needs product sign-off |
| V2 image paint in Preview + one image geometry contract | User-visible size/flow/layer/colour changes; product decision on caps |
| V2 image HOLD guard (scale oversize images like LEGACY) | Needs the same cap decision; changes export geometry |
| Trailing-image rule in Core | Core composition contract change |
| V2 grayscale images, folio extras, hidden nombre, web footer | Publication feature work (Phase 3 export hardening) |
| Stale-bridge export guard | Export pipeline change (Phase 3) |
| Drop unused `plan` from preview worker | Changes `V2BridgeResult` shape used by tests |
| Remove `PreviewPaneNew.tsx`, `renderer-poc` | Dead code, but tests reference them; cleanup-only phase |

## 11. Recommended LEGACY retirement order

1. Dead code: `PreviewPaneNew.tsx`, `src/app/renderer-poc/**` (+ their test refs).
2. Colophon Preview: show V2 colophon paint pages (already built) instead of `ColophonPageCard`.
3. Page furniture: port `nombreBottomMargin`/font family/hidden nombre/per-page
   hide/web footer to Core+Publication, then paint furniture in V2 Preview.
4. Images: one geometry contract (Core) → V2 Preview image paint → drop LEGACY
   overlays in V2 mode.
5. Page list: drive PreviewPane pages/selection/warnings from V2 `pageSequence`
   (keep `computePageSourceRanges` for caret until V2 exposes source ranges).
6. Only then: remove the LEGACY capture/export stack and FixedSlot renderer
   together with the `LEGACY` rollback value (explicit Human go/no-go).

## 12. Performance notes (not optimized in this phase)

Per 180 ms preview debounce in V2 mode: 3 full tokenizations (`paginateTokens`,
`computePageSourceRanges`, worker adapter), 2 LEGACY pagination passes, V2
compose, Preview paint model, **plus an unused Publication model + PaintPlan
(`composeV2Document` → `buildPaintPlan`) structured-cloned back from the worker
with the whole bridge**; `pageSignatures` detokenizes every page. Per export:
font parse + outline/GPOS/yakumono context construction + full plan rebuild.
`buildV2UnitsFromManuscript` recomputes `Array.from(source).length` per ruby
(O(n·rubies)).

## Phase 3 recommendation

Export hardening on the canonical plan: stale-bridge guard + explicit
"composition matches content" token, V2 image HOLD guard and single image
geometry contract (with product decision on caps/grayscale), furniture parity
(folio extras, hidden nombre, web footer), consistent body/physical numbering in
file names and warnings, and dropping the unused worker plan.

---

## Phase 3 — V2 export hardening (4c4874a)

| Item | Change | Where |
|---|---|---|
| Stale-layout export guard | Every V2 composition is tagged with the exact input (content/settings/title/images) it was built from. Export snapshots the Editor's LIVE text (`getLatestContent`, not the debounced Preview prop) and waits — on the pipeline's own completion event, no sleep/timeout — for the layout of exactly that input. A newer edit/settings change rejects the pending export (`StaleCompositionError`); a failed composition rejects with its HOLD message. Equal inputs are never recomposed. | `v2Bridge/compositionRevision.ts`, `useV2PreviewAdapter.ts`, `PreviewPane.requireV2ExportPlan`, `TategakiEditor` |
| Oversized-image clamp | IMAGE units are fitted (aspect kept, never upscaled) into the shared box, and never longer than one line — an image can no longer HOLD the whole document. Markers already inside the box are untouched. | `composeV2Document.capEditorImageUnits` |
| Shared image sizing contract | One definition (90% text-frame width × 60% height) used by insertion, the LEGACY Preview overlay and V2. Export now matches the size the Preview already showed for over-size markers. | `src/lib/imageGeometry.ts` |
| Export layer order | Image paint commands carry `refId`; the Editor's `imageLayerOrder` re-orders image commands back-to-front with the Preview's own key (`layerOrder[id] ?? token order`); text keeps its slots. | `exportPlan.applyImageLayerOrder`, `pdfGenerator`, publication `paintModel` |
| Grayscale restoration | Images converted to 1-channel (or gray+alpha) PNG with the LEGACY DeviceGray luminance before PDF/JPG. Evidence: `utils/exportPdf.ts` (DeviceGray 正式仕様), compatibility matrix (grayscale = Freeze §2 requirement), LEGACY JPGs captured `filter: grayscale(100%)` images. | `exportPlan.grayscalePlanImages` |
| Paint-plan reuse | Export plan cached per (layout object, font, layer order) — all immutable per revision; failed builds are never cached. | `exportPlan.ExportPlanCache` |
| Unused Preview plan removed | Worker uses `composeV2Layout` (no PaintPlan); `composeV2Document` = layout + plan for tests/tools. | `composeV2Document.ts`, `v2Preview.worker.ts` |
| Page-number helpers | `bodyPageNumber` / `physicalPageNumber` / `bodyPageCount`; every V2 export resolves pages from the SAME awaited layout it paints. "No selection" JPG/ZIP = every body page of the current layout. File names unchanged (body pages: body number; colophon: physical number). | `v2Bridge/pageIndex.ts` |
| Running-head override fix | Editor `pageOverrides` are keyed by BODY page; Core applied them by PHYSICAL page → off by one after a mid-book colophon, and the colophon inherited a body override. Now re-resolved after composition with Core's own `composeHeaderForPage`. | `v2Bridge/pageFurniture.ts` |
| Per-page folio hide | `pageOverrides[n].hideNombre` (Preview 表示/非表示 toggle) was dropped by V2; now removes that body page's folio in PDF/JPG. | `v2Bridge/pageFurniture.ts` |
| Odd-page warning | Whole-book count = body pages of the current V2 layout (+ colophon) = the pages the PDF actually contains; LEGACY count only when not V2. | `PreviewPane.performDownloadPdf` |

QA evidence: `src/lib/v2Bridge/exportHardening.test.ts` (25), full vitest vs Phase 2 (no new failures), build, `productionOddPageWarning` + `mobileSharedExport` E2E PASS on a loopback production build, and a real-browser check (edit → immediate PDF = new page count; red image → JPG 0 coloured pixels, PDF image `/DeviceGray`, no `/DeviceRGB`).

### Still deferred after Phase 3

- **Boundary image page**: an image right after a full page stays on that page in the Preview (LEGACY `appendTrailingImage`) but starts the next page in export (V2 images occupy a line). Needs a product rule for V2 image flow, then Preview page list → V2.
- **Multiple images at one position** overlap in export (each centred independently) while the Preview flows them in a row.
- **Height cap mismatch in one case**: V2 also caps at one line's extent; with very few chars/line an image is smaller in export than in the Preview overlay.
- **Page furniture not in V2 export**: `nombreBottomMargin` (export uses marginBottom/2 — geometry decision), `nombreFontFamily` (only Shippori is embedded), hidden nombre (print-shop marker, bleed-area placement), Web閲覧用 footer branding (web JPG only). Classified: folio margin/font = publication-required (needs decision); hidden nombre = publication-required when enabled; web footer = web-only.
- Colophon Preview is still LEGACY `ColophonPageCard`; Preview page list still LEGACY.

---

## Phase 4 — broken-image warning contract (image recovery)

**Two states, deliberately separate** (`src/lib/imageWarningLifecycle.ts`):

| State | Question | Owner | Cleared by |
|---|---|---|---|
| Technical | Can this image be rendered in this browser now? | `TategakiEditor.unresolvedCloudImages` (manifest missing/expired/unmanifested, minus images available locally — `cloudImageSync.technicallyUnresolvedImages`) | same-ID replacement, successful resync, marker deletion |
| Acknowledgment | Has the user acknowledged a detected break? | `PreviewPane` pending warnings, per document (`imageWarningScope`) | `通知解除` only |

- A new technical break becomes a pending warning (footer, one interruption modal; breaks present when the document was opened — `silentImageWarningIds` — get the footer only). It blocks export of its pages.
- **Repair does not auto-dismiss**: a replacement may be the wrong picture and a fix may have reflowed pages, so exporting those pages follows an explicit look + 通知解除. The footer row shows 「再配置済み・確認して通知解除」.
- **Marker deletion keeps the last-known page**: the warning and the page-scoped block stay on the page the image was on (「原稿から削除済み」) until acknowledged, so the user can still see where it was.
- `通知解除` is refused while the image is still broken (marker present, technically unresolved, no local data); accepted after repair or deletion. A later break of the same id re-arms and announces again.
- Export block = pending pages ∪ currently unresolved pages (`affectedExportPageNumbers`); the colophon JPG checks no body page. Page indices are still the LEGACY Preview list (unchanged).

**Bug fixed while auditing**: opening a cloud project restored images from the cloud copy only, so an expired/purged cloud copy showed as broken even when this browser still had the original in IndexedDB. The open path now falls back to local originals (`mergeCloudRestoreWithLocalOriginals`; a same-ID cloud copy still wins). The first-load "no modal" rule no longer depends on render timing (explicit baseline ids).

**Coverage**: `src/lib/imageRecovery.test.ts` (manifest/local cases A–G with fixture rows and a fixed clock, full lifecycle, 5P/12P export-block matrix before/after repair/deletion/acknowledgment, placeholder safety); `tests/e2e/imageWarningLifecycle.e2e.mjs` (demo route, TXT-import break → repair → still blocked → 通知解除 → allowed; break → refused → delete → 通知解除). Cloud TTL/manifest paths are not browser-tested (no backend in E2E).

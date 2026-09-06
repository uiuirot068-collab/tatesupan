# TateSpun Current Editor Feature Inventory

- Status: READ-ONLY source audit of the current production TateSpun app (`src/`), performed 2026-09-06 against `design/tatespun-typesetting-v2` HEAD `23e7d52`. Nothing in `src/` was modified. This document records what the audit actually found in source — where something could not be confirmed within scope, it is marked **UNKNOWN / NEEDS HUMAN CHECK** rather than guessed.
- Companion to the v2 Canonical Core, now implemented through P3-L15A (Human Gate G1 PENDING). This inventory exists so v2 Editor/Renderer/integration work has an accurate map of what must not be silently lost, not to plan that work itself.
- Classification codes used throughout: **A** CURRENT—IMPLEMENTED · **B** CURRENT—PARTIAL · **C** CURRENT—LEGACY ENGINE DEPENDENT · **D** V2 REQUIREMENT—NOT CURRENTLY IMPLEMENTED · **E** DESIGN DECIDED—IMPLEMENTATION PENDING · **F** DEFERRED/OPEN · **G** UNKNOWN.

---

## 1. Executive Summary

TateSpun's current Editor is a single-page Next.js app (`src/app/editor/page.tsx` → `TategakiEditor.tsx`) built around **one plain-text `<textarea>`** whose content is a manuscript with inline notation markers (ruby, TCY, images, manual page breaks, headings). A pure-function pipeline — tokenize (`tategaki.ts`) → paginate (`tategaki.ts`) → compute physical layout (`pageLayout.ts`) → render (`PageCard.tsx`, one absolutely-positioned `<span>` per character glyph, "FixedSlot") — turns that text into a live vertical-writing preview. Export (PDF via jsPDF, JPG via html-to-image + canvas) captures that same rendered DOM as a raster image, not a re-typeset document. Saves are local-first (IndexedDB) with an explicit, login-gated "save to cloud" action; images optionally sync to private cloud storage for 72 hours. Nothing is sent anywhere by ordinary editing/preview/export.

The v2 Canonical Core (`typesetting-v2/core/`) is a from-scratch, deterministic, integer-tick logical typesetting engine that has **not yet been connected to any of this** — `src/` has never been imported from or modified by any v2 Core Loop, and no Preview/Publication Renderer exists yet. This document's job is to make sure that when that connection work begins, nothing here gets silently dropped.

Three findings are worth flagging up front:
1. **Two independent colophon mechanisms coexist today** (§13) — a vertical, body-content-embedded one (`bookStructure.ts`) and a horizontal, isolated dedicated-page one (`colophon.ts`, TSP-LOOP-005) — surfaced to the user as two distinct buttons in the same modal (「奥付（縦）」／「奥付（横）」). Only the horizontal one has any v2-Core-relevant status (Contract §15 formally requires it be a Canonical Layout element).
2. **Kinsoku/hanging/pagination logic exists as two independently-maintained mirror implementations** in `tategaki.ts` (`paginateTokensByLines` for display, `computePageSourceRanges` for caret↔page mapping) — already flagged by the project's own code comments as a duplication risk.
3. **Every Preview page mounts simultaneously** (no virtualization/lazy-loading found in `PreviewPane.tsx`) — a potential performance cliff for long manuscripts that a v2 Renderer should deliberately not reproduce without consideration.

## 2. Current Architecture

```
CURRENT:
  <textarea> (EditorPane.tsx)
    ↓ raw string with inline markers
  tokenizeTategakiWithOffsets()      (src/lib/tategaki.ts)
    ↓ TategakiToken[] (text/ruby/tcy/image/pageBreak) + source offsets
  paginateTokensByLines() / computePageSourceRanges()   (src/lib/tategaki.ts)
    ↓ TategakiPage[] (tokens grouped into lines/columns/pages)
  computePageLayout()                (src/lib/pageLayout.ts)
    ↓ physical mm geometry (chars/line, lines/column, margins)
  PageCard.tsx "FixedSlotLine"       (one absolutely-positioned <span> per glyph)
    ↓ rendered DOM (Preview) ─────────────┐
  capturePageToCanvas() (html-to-image)    │
    ↓ raster canvas                        │
  exportPdf.ts / exportImage.ts            │
    ↓ PDF (jsPDF, 600dpi, grayscale) / JPG (long-side 1600px)
                                    Preview (live, in-browser)

V2 TARGET (per frozen Contract; not yet connected to any of the above):
  Editor
    ↓ raw manuscript text
  Normalizer                (upstream of Core; not yet designed/built)
    ↓ LogicalUnit[] with SourceSpan
  Canonical Logical Core    (typesetting-v2/core/ — IMPLEMENTED through P3-L15A,
                              Human Gate G1 PENDING)
    ↓ CanonicalDocument (deterministic, integer-tick, page/column/line/placed-unit tree)
  Preview Renderer  /  Publication Renderer     (NEITHER EXISTS YET — P3-O09 / P3-O08)
```

**Key files** (all `src/`, read-only inspected):
- Editor entry: `src/app/editor/page.tsx` → `src/components/TategakiEditor.tsx`
- Main state owner: `TategakiEditor.tsx` (title/content/settings/plotNote/images all live here, lifted from `EditorPane`)
- Manuscript representation: a single JS `string` (`content`), with inline notation — never a structured document model (confirmed; matches the project's own "TXT round-trip" framing)
- Editor→Preview path: `content` + `settings` passed as props straight into `PreviewPane.tsx`, which re-tokenizes/re-paginates on every render (no separate Normalizer/Core layer exists)
- Editor→Export path: `PreviewPane.tsx` owns export triggers; both PDF and JPG capture the **already-rendered Preview DOM**, not a fresh re-typeset pass
- Settings state: `useEditorSettings.ts` (localStorage last-used, per-device) + per-document `PageSettings` persisted via `db.ts`
- Preset state: `src/constants/paperSizes.ts` `PAPER_SIZE_TEMPLATES` (canonical) — a second, dead `src/lib/constants/presets.ts` `PAGE_PRESETS` exists with **zero importers**, confirmed by search
- Image state: `images: Record<string, string>` (id → dataURL) in `TategakiEditor.tsx`, persisted via `db.ts`'s `images` table; `imageLayerOrder` kept fully separate from manuscript text
- Memo state: `plotNote: string`, a single per-document field, edited inside `PageSettingsPanel.tsx`'s 「メモ」 tab
- Cloud/save state: `db.ts` (IndexedDB, always-on local autosave) + `src/lib/supabase/*` (explicit, login-gated cloud save)
- Current typesetting engine entry point: `tokenizeTategakiWithOffsets` + `paginateTokensByLines`/`computePageSourceRanges` (both in `src/lib/tategaki.ts`)
- Current Preview renderer entry point: `PageCard.tsx` (`FixedSlotLine`, "G1" — this is the *current codebase's own* internal name, unrelated to v2's Gate G1)
- Current PDF export entry point: `src/utils/exportPdf.ts` (`exportCustomPdf`)
- Current JPG export entry point: `src/utils/exportImage.ts` (`exportPageToJpg` / `exportPagesToZip` / `exportPagesAsIndividualJpgs`)

## 3. Editor Features

| Feature | Status | Evidence |
|---|---|---|
| Plain manuscript editing | A | `EditorPane.tsx` — a single `<textarea>`, `value={content}` |
| Horizontal Editor input | A | The textarea itself is horizontal; TateSpun's own vertical *preview* is a separate rendered surface |
| Vertical Editor mode | D | Confirmed absent from `src/`. Compatibility matrix already frames this as a Phase 1+ research direction (HD-011: horizontal stays default), not a v2.0 commitment |
| IME handling | B | Only `onCompositionStart`/`onCompositionEnd` handlers exist, and only to gate 文章チェックβ re-analysis timing (`isComposingRef`) — no custom IME override of the textarea's native composition behavior |
| Undo | A (browser-native) | No custom undo code found anywhere in `EditorPane.tsx`/`TategakiEditor.tsx`/`useShortcuts.ts`. Relies entirely on the `<textarea>`'s native browser undo stack |
| Redo | A (browser-native) | Same as Undo — no custom implementation |
| Paste | A (browser-native) | No custom paste handler found; standard textarea paste behavior |
| Selection behavior | A | Standard textarea selection; `onSelect`/`onClick`/`onKeyUp` all just report `selectionStart` to `onCursorIndexChange` for Preview page-scroll sync — not a custom selection model |
| Manual page-break insertion (toolbar) | A | `EditorPane.tsx` 改ページ挿入 button → `insertPageBreak()` → `insertPageBreakMarker()` |
| Manual page-break notation | A | `【改ページ】`, three-case disambiguation (alone-on-line / trailing-with-text / literal-mid-sentence) — `tategaki.ts` `pageBreakCommandSpan` |
| Ruby notation/input | A (notation only, no dedicated UI) | Two forms: `｜漢字《かんじ》` (explicit) and bare `漢字《かんじ》` for pure-kanji runs — `RUBY_PATTERN` in `tategaki.ts`. Typed directly into the textarea; no ruby-insert toolbar button found |
| TCY notation/input | A (notation only) | Auto-detect: 2-digit numbers, `!!`/`??`/`!?`/`?!` pairs; explicit `[tate]…[/tate]` (1–8 chars) — `TCY_PATTERN` in `tategaki.ts` |
| Dash handling | A | `――` (2+ em dash run) never stranded 1+1 across a line wrap — `NOWRAP_RUN_FAMILIES`/`adjustSplitForNowrapRun` |
| Ellipsis handling | A | `……`/`‥‥` — same mechanism as dash, same family list |
| Image marker notation | A | `【IMG:id:widthMm:heightMm:position】`, position ∈ top/center/bottom/full |
| Find/search | A | `SearchReplaceModal.tsx`, opened via EditorPane's 置換 button |
| Replace | A | Same modal — confirmed a real find-and-replace UI exists (not just browser Ctrl+F) |
| Character count | A | `countVisualLength(content)` shown live in EditorPane's footer — counts *visual* length (ruby counts its base only, images/breaks count 0, TCY counts 1) |
| Page/capacity estimate | A | Live 「1ページの文字数」／「1段の文字数」badges in `PageSettingsPanel.tsx`, computed from `computePageLayout` |
| Session activity counter (typed+deleted cumulative) | D | Confirmed absent. Compatibility matrix already notes this does not exist yet and is explicitly a net-new Master §9.2 requirement — `feedbackEnvironment.ts` (TSP-LOOP-030) is an unrelated one-shot device fingerprint, not an activity tracker (confirmed by reading it directly; no counter state anywhere in it) |
| Typed-character / deleted-character counters | D | Same as above — no such counters found anywhere |
| SNS-share counter behavior | G | Not investigated this pass — no SNS-share code path was encountered in the files read; UNKNOWN / NEEDS HUMAN CHECK |
| Heading / TOC-extraction markup | A | `# 第一章` or `■ はじめに` recognized as headings — `tocGenerator.ts` `extractHeadings`/`extractHeadingOffsets`, surfaced via the 📖 奥付・目次 modal's 目次作成 tab |
| Ctrl/Cmd+S save shortcut | A | `useShortcuts.ts` registers exactly one binding: `{ key: "s", handler: saveNow }` in `TategakiEditor.tsx`. **No other keyboard shortcuts are registered anywhere** (no Ctrl+Z/Y custom binding, no Ctrl+F, etc.) |

## 4. Toolbar / Direct Actions

**EditorPane.tsx toolbar row** (above the textarea):

| Label | Action | Status | v2 dest. note |
|---|---|---|---|
| 📖 奥付・目次 | Opens `BookPartsModal` (title page / vertical colophon / horizontal colophon / TOC generation) | A | Core (colophon is a Contract §15 Canonical Layout element) |
| 改ページ挿入 | `insertPageBreak()` — inserts `【改ページ】` at caret, padded onto its own line | A | Core (Contract §13, already supported) |
| 置換 | Opens `SearchReplaceModal` | A | Editor-side only |
| 報告 (β) | Opens `BetaFeedbackModal`, gated by `BETA_FEEDBACK_ENABLED` | A | Editor-side only |

**Header.tsx** (desktop, `md+` only — phone gets equivalents from `MobileEditorNav.tsx`):

| Label | Action | Status |
|---|---|---|
| 集中モード / 通常に戻す | `focusMode` toggle — hides settings strip, shrinks Preview to a side rail | A |
| ？ | Opens `HelpModal` | A |
| クラウドに保存 | Login-gated cloud save (`handleSave` in `TategakiEditor.tsx`); prompts `AuthModal` if not logged in | A |
| 保存作品一覧 | Opens `ProjectListModal` | A |
| 画面モード | `ThemeToggle` (light/dark) | A |
| ログイン/ログアウト | `AuthModal` / `signOut()` | A |

**Undo ↶ / Redo ↷ as dedicated toolbar buttons: absent (D).** No such buttons exist in `Header.tsx`, `EditorPane.tsx`, or `MobileEditorNav.tsx` — only the browser-native textarea undo stack (see §3).

**Settings ⚙️ as a dedicated toggle button: absent on desktop (see §14 — HD-010 not yet implemented).** On desktop, `PageSettingsPanel` is always mounted inline inside `EditorPane` (`id="tsp-settings"`, `hidden md:block`) — there is no button that opens/closes it as a drawer; its own three tab-headers (see §5) are the only click affordance. On phone, `MobileEditorNav.tsx` provides an explicit 設定 tab that switches `mobileView` to `"settings"`.

**Image insert**: no dedicated toolbar button was found in `EditorPane.tsx`'s own row; image insertion happens through `PreviewPane.tsx` (not audited in full this pass — image insert UI lives in the Preview pane's own controls, confirmed by `onImageAdd`/`onImageDelete` props flowing from `TategakiEditor` into `PreviewPane`). **NEEDS HUMAN CHECK** for the exact in-Preview insert affordance (button/drag-drop/paste) — not directly read this pass.

**Memo access from Editor**: reachable only via `PageSettingsPanel`'s メモ tab (see §9) — not its own toolbar button.

## 5. Settings

All settings live in one component, `PageSettingsPanel.tsx` (1533 lines), three tabs: 「ページ設定」／「ノンブル・柱」／「メモ」, plus a ヘルプ button.

| Setting | User-adjustable | Current engine dependency | Intended v2 ownership |
|---|---|---|---|
| Paper/preset size | YES | `PAPER_SIZE_TEMPLATES` (`paperSizes.ts`) | Settings (Product-facing input) |
| Layout mode (margin vs. capacity) | YES | `PageSettings.layoutMode`, `applyLayoutModeAdjustment` | Settings |
| Margins (天/地/ノド/小口) | YES (margin mode) or derived (capacity mode via 3×3 anchor) | `textFramePosition.ts` `deriveFrameMargins`/`inferPositionFromMargins` | Settings (LayoutSettings, mm-authored per Contract §16/§21) |
| Font family | YES | `FONT_FAMILY_OPTIONS` (`fonts.ts`) — 4 web fonts + system serif | Settings; font *shaping* is Measurement Provider/Renderer (Contract §17) |
| Font size (pt) | YES | `PageSettings.fontSizePt` | Settings |
| Line height ratio (行間倍率) | YES | `PageSettings.lineHeightRatio` | Settings — feeds `computeLinePitchMm` |
| Columns (1/2段) | YES | `PageSettings.columnCount` | Settings — Core already supports N columns (Contract §20) |
| Column gap (段間mm) | YES | `PageSettings.columnGapMm` | Settings |
| Chars/line, lines/column (target) | YES (capacity mode) | `computePageLayout`'s clamp chain (`computeAutoCharsPerLine`, `computeMaxCapacityChars`, `computeAutoLinesPerColumn`) | **OPEN — P3-O12.** This exact formula chain is NOT ported to v2 Core; v2 P3-L08's 8-preset sweep only *consumed* the resulting numbers, never re-derived them |
| Ruby enable/scale | G | No dedicated "ruby enabled" toggle was found — ruby is always-on via notation. **NEEDS HUMAN CHECK** whether a global disable exists anywhere unaudited |
| TCY settings | G | No dedicated TCY settings UI found beyond the notation itself; auto-detect threshold (2-digit) is hard-coded in `TCY_PATTERN`, not user-configurable — matches P3-O07 being unresolved on both sides |
| Page numbers (nombre): position/start/margin/fontsize/fontfamily | YES | `MasterPageSettings` fields, `PageSettingsPanel`'s 「ノンブル・柱」 tab | Product Policy (scheme) / Core (placement, Contract §15) |
| Hide-nombre-on-first-page | YES | `hideNombreOnFirstPage` + linked `showHiddenNombre` auto-enable | Core (page-decoration layer) |
| Header (柱): odd/even text, position, font size | YES | `hashiraOdd`/`hashiraEven`/`hashiraPosition`/`headerFontSize` | Core (page-decoration layer) |
| Per-page overrides (hide nombre/hashira, hashira text) | YES | `PageOverride`, `updatePageOverrides`, selection-driven UI tied to `PreviewPane`'s page selection | Core |
| Colophon (horizontal, dedicated page) | YES | `ColophonSettings` (`colophon.ts`) via `ColophonModal.tsx` | **Core, formally (Contract §15/HD-006)** — see §13 |
| Output settings (PDF mode, JPG scope) | YES | Modal-local state in `PreviewPane.tsx` (not deep-audited) | Publication Renderer |
| Preview zoom | G | Not directly confirmed this pass — `PreviewPane.tsx` imports `pageOrder.ts` (spread grouping) suggesting a spread/zoom UI exists; **NEEDS HUMAN CHECK** for exact mechanism |
| Memo (plotNote) | YES | Plain string, edit/preview toggle inside the メモ tab | Editor-side (Contract §29 explicitly excludes Memo from Core) |

## 6. Presets

Current live source: `src/constants/paperSizes.ts` `PAPER_SIZE_TEMPLATES` — **confirmed the only importer-referenced preset table**; `src/lib/constants/presets.ts` `PAGE_PRESETS` has a different, incompatible shape (`PagePreset` with `marginInner`/`targetCharCount`/`showFooter`, unrelated to `PaperSizeColumnProfile`) and **zero non-self importers**, confirmed by search — dead code, must not be migrated as if live.

| Preset | UI presence | 1段 charsPerLine × linesPerColumn (fontSizePt) | 2段 charsPerLine × linesPerColumn (fontSizePt) | v2 logical support | Real v2 capacity geometry |
|---|---|---|---|---|---|
| 文庫 | YES | 38×16 (8.5pt) | 20×18 (7.5pt) | PASS (P3-L15 8-preset sweep) | **OPEN — P3-O12** |
| A5 (1段) | YES | 53×22 (9.0pt) | — | PASS | OPEN |
| A5 (2段) | YES (via 段数 selector) | — | 25×24 (8.5pt) | PASS | OPEN |
| B5 | YES | 45×26 (9.5pt) | 28×28 (8.5pt) | PASS | OPEN |
| B6 | YES | 40×18 (9.0pt) | 22×20 (8.0pt) | PASS | OPEN |
| 新書 | YES | 40×15 (8.5pt) | 22×17 (7.5pt) | PASS | OPEN |
| A6 | YES | 38×16 (8.5pt) | 20×18 (7.5pt) | PASS | OPEN |
| Web閲覧用 | YES | 29×12 (36pt, `isPx` preset, 768×1024px) | 16×14 (32pt) | PASS | OPEN |

All values above read directly from `PAPER_SIZE_TEMPLATES` (`cols1`/`cols2` profiles), not inferred. **v2's P3-L15 8-preset logical/schema sweep already consumed these exact real numbers** (typesetting-v2/core/layout/composeCanonicalDocument.test.ts) — but, as that Loop's own evidence explicitly states, this proves the Core can *consume* them, not that it can *derive* them from raw mm/margin inputs the way `computePageLayout`/`deriveMaxCapacityFromMargins` do today. **P3-O12 remains OPEN.**

Also confirmed real (read from `pageLayout.ts`): `PDF_EXPORT_DPI = 600`, `PRINT_JPG_LONG_SIDE_PX = 1600`, `BLEED_MM = 3`, `PX_PER_MM = 2.2` (preview-only render scale, distinct from the real `CSS_PX_PER_MM_96DPI = 96/25.4` used only for Web閲覧用's physical-size derivation) — two similarly-named but functionally distinct constants, exactly as the compatibility matrix already flagged as a confusion risk.

## 7. Preview

- Component: `PreviewPane.tsx` (imports `PageCard.tsx` for print presets, `ColophonPageCard.tsx` for the horizontal colophon, `PreviewPaneNew.tsx` as an experimental alternate).
- **CURRENT PREVIEW = LEGACY.** `PageCard.tsx`'s own code comments explicitly describe it as "FixedSlot absolute-positions every glyph" and explicitly contrast this with "a browser-native `writing-mode: vertical-rl` block" — i.e., it deliberately does NOT use native CSS vertical writing mode. This is exactly the architecture Master §7 "white-sheets" (resets to undecided) for v2.
- Page model: one `TategakiPage` per printed page, `lines`/`columnLines` pre-computed by pagination so the DOM never re-wraps text itself.
- **Every page mounts simultaneously — no virtualization found.** Grepped `PreviewPane.tsx` for `IntersectionObserver`/`lazy`/`Suspense`/virtualization patterns: zero matches. All pages in `pages.map(...)` render at once. Potential performance risk for long manuscripts, worth deliberate consideration (not necessarily reproduction) in a v2 Renderer.
- Zoom / spread behavior: `pageOrder.ts` provides `computeSpreadGroups`; exact zoom UI **NEEDS HUMAN CHECK** (not directly read this pass).
- Ruby rendering: `FixedSlotRubyAnnotation` — manually-positioned annotation glyphs matching the FixedSlot grid, **not** native CSS `<ruby>`/`<rt>` (confirmed in `PageCard.tsx`).
- TCY rendering: present (`FixedSlotTcy`, referenced by name in the compatibility matrix; not deep-read this pass) — fixed 1-character-cell budget regardless of content width (confirmed via `tategaki.ts`'s `tokenLength` returning 1 for every TCY token).
- Dash/ellipsis rendering: `nowrapRunBoundaryEdge` (dash-only optical edge spacing) — a deliberately separate function/regex from the pagination-side `NOWRAP_RUN_FAMILIES`, per its own code comment, to avoid the two drifting.
- Images: rendered as absolute overlays (zero pagination cost, confirmed via `tokenLength`'s `image` case returning 0).
- Page numbers/header: `NombreOverlay`/`HiddenNombreOverlay` referenced from `pageLayout.ts`'s exports; rendering itself lives in `PageCard.tsx` (not deep-read this pass).
- Colophon: `ColophonPageCard.tsx` — a **separate renderer component** from `PageCard.tsx`, confirming the horizontal colophon is architecturally isolated from body pagination today, exactly as Master §20.6/HD-006 describes as the thing v2 must formally bring into the Canonical Layout Model (not undo the isolation, per that same decision).
- Manual page breaks: reflected via `paginateTokensByLines`'s page-splitting, with `lastSoftClosedPage`/soft-close-vs-hard-break bookkeeping to avoid phantom blank pages when an explicit break coincides with a natural one (confirmed in `tategaki.ts`).
- Responsive/mobile Preview: `mobileView === "preview"` full-viewport surface, `max-md:overflow-hidden` clipping transient spread overflow (confirmed in `TategakiEditor.tsx`).
- `PreviewPaneNew.tsx`: an experimental, dev-only A/B alternate renderer piping through a Vivliostyle research bridge — explicitly incomplete per the compatibility matrix (no export, no 2-column, no image-layer editing); imported by `PreviewPane.tsx` but its exact activation gate was not audited this pass (**NEEDS HUMAN CHECK**).

## 8. Export / Output

| Path | Status | Evidence |
|---|---|---|
| PDF (trim/bleed/full) | A (LEGACY-coupled) | `exportPdf.ts` `exportCustomPdf` — jsPDF, `unit: 'mm'`, page format set per mode; トンボ (crop marks) hand-drawn with `pdf.line()` in `full` mode only |
| PDF resolution | A | Fixed 600dpi (`PDF_EXPORT_DPI`), no user-facing UI to change it — confirmed "正式仕様の固定解像度（ユーザーが変更するUIは設けない）" in source comment |
| PDF color | A | Grayscale — `canvasToGrayscalePng` converts to a true 1-channel DeviceGray PNG via `fast-png` (JPEG-then-jsPDF would be misjudged as DeviceRGB) |
| JPG (single page) | A | `exportPageToJpg` |
| JPG (ZIP batch) | A | `exportPagesToZip` (JSZip + file-saver) |
| JPG (individual batch, non-ZIP) | A | `exportPagesAsIndividualJpgs` — explicitly for phones where ZIP is awkward, per source comment; 300ms stagger between downloads |
| JPG resolution | A | Long-side fixed 1600px (`PRINT_JPG_LONG_SIDE_PX`), crop ratio **live-measured from the rendered TrimGuide DOM element** (`exportCapture.ts` `measureTrimGuideRatioRect`), not a hardcoded bleed offset; quality 0.95 |
| Web閲覧用 export exemption | A | Confirmed: `PrintJpgGeometry` is `undefined` for Web閲覧用 — no crop, no resize, canonical px output as-is |
| PNG export | D | Not found anywhere; matches compatibility matrix's "not a v2.0 required feature, design space reserved" framing |
| TXT import | D | Confirmed absent (grep for `.txt`/`text/plain` import patterns found nothing in the files read) — net-new v2 requirement, not a preservation item |
| TXT export | D | Same — net-new |
| Export Profile A (notation-preserving) | D | Not found; net-new v2 concept |
| Export Profile B (plain/posting-friendly) | D | Not found; net-new v2 concept |
| Export Profile C (future, platform-specific) | D | Not found; explicitly future-only even in v2 planning |
| Filename behavior | A | `exportFilename.ts` exists (not deep-read this pass); a post-export filename reminder modal (`PdfExportNoticeModal.tsx`) exists, gated by a per-device localStorage preference |
| Multi-page export | A | All batch JPG paths and the PDF path iterate every selected/all page element |
| Image inclusion | A | Images render as part of the captured DOM (absolute overlay), included automatically in any page capture |
| Page numbers/colophon in output | A | Rendered DOM (including nombre/hashira/colophon) is what gets captured — WYSIWYG by construction, since export = "photograph the Preview" |

**Preview and Publication currently share the same layout authority** — both derive from the identical `paginateTokensByLines`/`computePageLayout` pipeline and the same rendered DOM; there is no separate "Publication-only" layout pass. This is precisely the architecture Master §1.2/§1.3 already permits v2 to diverge from (Preview ≠ canonical output), and precisely what `capturePageToCanvas`'s tight coupling to FixedSlot DOM internals (documented in-source as "a deeply-commented workaround stack: transform neutralization, font-size clone bug workaround, Safari fallback") makes risky to carry forward as-is.

## 9. Images

- Insert UI: lives in `PreviewPane.tsx` (not fully audited this pass — **NEEDS HUMAN CHECK** for exact affordance).
- Accepted types: PSD (converted client-side) plus standard web image formats (implied by `readFileAsDataUrl` in `image.ts`, not exhaustively enumerated this pass).
- PSD conversion: `src/utils/psdConverter.ts`, using the `ag-psd` library, **browser-only** (throws if not in a browser environment), renders via Canvas — confirmed no server round-trip.
- Storage representation: `ImageRecord { id, dataUrl, createdAt, layerOrder? }` in IndexedDB (`db.ts`); referenced from manuscript `content` only by `id` inside `【IMG:...】` markers — the dataURL itself never touches the document text.
- Placement options: top / center / bottom / full (`ImagePosition` type in `tategaki.ts`), each with explicit width/height in mm.
- Layer front/back ordering: `imageLayerOrder` state, deliberately kept independent of the marker's position in `content` so reordering never touches pagination/tokenLength (confirmed via code comment in `TategakiEditor.tsx`).
- Preview rendering: absolute overlay, zero pagination cost.
- PDF/JPG rendering: captured as part of the DOM, same as any other Preview content.
- Cloud/local persistence: local via `db.ts`'s `images` table (unconditional); cloud sync is opt-in, occurring only as part of an explicit "クラウドに保存" action, to a **private** Storage bucket (`manuscript-cloud-images`) with a **72-hour TTL** (`CLOUD_IMAGE_TTL_HOURS`, `cloudImageSync.ts`) and a 5-hour pre-expiry warning threshold — confirmed real, not inferred.
- Source/data ownership: images never leave the client during ordinary editing/Preview/local export; they leave the client **only** on the explicit cloud-save action, to the user's own private storage prefix (RLS + prefix double-enforced per `projects.ts`'s delete-path comment).

## 10. Memo

- **Exists today** as `plotNote: string`, a single free-text field per document.
- Where accessible: `PageSettingsPanel.tsx`'s メモ tab, with an edit/preview mode toggle (renders as Markdown-adjacent preview — `plotMode` state; exact rendering not deep-read this pass).
- On desktop, reachable without leaving the Editor screen (the Settings strip, including the メモ tab, sits inline above/beside the manuscript) — but reaching it still requires opening the メモ tab specifically, which is one click, not zero.
- On phone, メモ lives inside the dedicated 設定 workspace (`mobileView === "settings"`) — reaching it from 本文 (Editor) requires switching workspaces via `MobileEditorNav`, i.e. a genuine "Settings detour" on mobile.
- Storage: plain string, part of `PageSettings`'s sibling field on `DocumentRecord` (`db.ts`), autosaved with the rest of the document.
- Relationship to manuscript: entirely separate from `content` — never inserted into the typeset body, never exported.
- **v2 requirement (HD-009): Memo must be reachable directly from Editor without a Settings detour.** Current implementation does **not yet fully satisfy this** — it is one tab-click away inside Settings on desktop, and a full workspace-switch away on phone. Status: **B (CURRENT — PARTIAL)** against the HD-009 requirement; implementation mechanism for full compliance is **PENDING**.

## 11. 文章チェックβ

- Where it lives: `src/lib/writingCheck.ts` (pure functions) + `EditorPane.tsx` (wiring) + `WritingCheckOverlay.tsx`/`WritingCheckBar.tsx` (UI).
- Input consumed: the raw `content` string only.
- Does it change the manuscript: **no** — confirmed by source comment ("NO... auto-fix... document text is never touched") and by the implementation (`analyzeWriting` returns issue ranges only, never mutates).
- Network/external calls: **none** — confirmed "NO network, NO external API, NO AI" in source comment, and no `fetch`/API import anywhere in `writingCheck.ts`.
- Rules implemented: R1 (bracket correspondence, 5 full-width pairs only), R2 (obvious 。/、 duplication only — deliberately excludes ！！／…… as often-intentional), R3-tcy / R3-ruby (broken/incomplete notation detection, reads-only, matches `tategaki.ts`'s own canonical patterns).
- Debounced 300ms (`WRITING_CHECK_DEBOUNCE_MS`), suppressed during active IME composition.
- **Editor-side, confirmed matching the frozen v2 rule** that 文章チェックβ stays Editor-side, not Core-side.

## 12. Save / Cloud / Privacy

- **Local state**: React state in `TategakiEditor.tsx`, source of truth during an editing session.
- **IndexedDB (Dexie)**: `db.ts`, `tategaki-editor-db`, schema versions 1→3 already tracked in-code (`documents`, `images` tables). Autosave debounced 1500ms (`AUTOSAVE_DELAY_MS`), unconditional (no explicit user action required) — except for two in-memory-only ephemeral routes (使い方ガイド id `-1`, おためしデモ id `-2`) which never write to IndexedDB at all.
- **localStorage**: `useEditorSettings.ts` mirrors last-used `PageSettings` to key `tatespun_settings` (per-device convenience, becomes the starting point for new documents); `PageSettingsPanel.tsx` also reads/writes `tatespun_has_opened_settings` (a one-time first-open UX flag, not manuscript data).
- **Cloud save**: `src/lib/supabase/projects.ts` — explicit action only (クラウドに保存 button), login-gated (prompts `AuthModal` otherwise). `Project.settings` is stored as **untyped** `Record<string, any>` in the cloud schema (confirmed — a real looseness the compatibility matrix already flagged), unlike the strictly-typed local `PageSettings`.
- **Cloud project count limit**: enforced primarily by a Postgres trigger; a UX-only pre-check reads `getCloudPlan()`/`getCloudProjectCount()` and surfaces `CLOUD_PROJECT_LIMIT_ERROR` via **string-matching** the returned Postgres error message (`isCloudProjectLimitError`) — confirmed fragile-by-design, not a typed error code.
- **Cloud image sync**: opt-in (only as part of a cloud save that also has images), 72h TTL private storage, confirmed above (§9).
- **AI/external service calls**: none found in any file read this pass (Editor, Preview, export, save, writing-check, feedback-environment). No `fetch` to an AI endpoint was encountered.
- **Privacy verdict for this audit's scope**:
  - Ordinary edit/Preview/PDF/JPG sends manuscript externally: **NO** (confirmed — entirely local computation + local file save/download).
  - Cloud save sends manuscript externally: **YES, but only on explicit user action** (クラウドに保存), to the user's own account, matching the frozen "no ambient upload" requirement rather than violating it.
  - AI/service explicit-consent boundary: **N/A this pass** — no AI/external-service code path exists in current `src/` to evaluate against that boundary at all; nothing to fail or pass. Confirmed absence, not confirmed compliance of a feature that doesn't exist.
  - `feedbackEnvironment.ts` (TSP-LOOP-030): collects only low-entropy, already-in-every-request data (UA string, viewport/screen size, DPR, touch capability) — explicitly avoids high-entropy UA-Client-Hints, IP/geolocation, and any persistent identifier (confirmed by direct code inspection of every field it collects). Attached only to β-feedback submissions the user explicitly initiates via the 報告 button.

## 13. Folio / Header / Colophon

**Page number (folio/nombre) and header (柱, running header/footer)**: both configured together in `PageSettingsPanel.tsx`'s 「ノンブル・柱」 tab; both are page-decoration-layer concepts under v2's own Contract §15 vocabulary. Per-page overrides exist for both (hide nombre, hide hashira, hashira text override), keyed by 1-based physical page number (`PageOverride`).

**Colophon — two entirely separate mechanisms exist today, surfaced as two distinct choices in the same 📖 奥付・目次 modal:**

| | 奥付（縦） | 奥付（横） |
|---|---|---|
| Writing mode | Vertical (part of body pagination) | Horizontal, dedicated |
| Mechanism | `bookStructure.ts` `generateColophonText()` — generates plain text, inserted directly into `content` like any other manuscript text | `colophon.ts` `ColophonSettings` + `ColophonModal.tsx` + `ColophonPageCard.tsx` — a distinct settings object and its own renderer, isolated from body pagination |
| Affects body char count/pagination | YES (it becomes ordinary manuscript text) | NO, by design (confirmed: "本文の文字数・改ページ・縦書き設定には影響しません" in `BookPartsModal.tsx`'s own UI copy) |
| v2 Contract relevance | None directly named | **Contract §15/HD-006 explicitly requires this be a formal Canonical Layout Model element** — page placement, pagination relationship to body, font, layout area, export inclusion all Core-owned |
| Font | Follows body (it's just text) | Independent `fontFamily` field, defaults to "same as body" (`COLOPHON_FONT_SAME_AS_BODY`) |
| Page position | Wherever the user typed/pasted the generated text | `{ mode: "end" }` or `{ mode: "after-body-page", afterBodyPage: N }`, with a documented non-destructive fallback if the requested page no longer exists |

The horizontal colophon (`ColophonSettings`) is the one TSP-LOOP-005 precedent memory and Master HD-006 are both about — it is already isolated from body writing-mode/pagination today (matches the memory's description exactly), and v2's job per HD-006 is to bring it *into* the Canonical Layout Model's authority, not to undo that isolation.

**Font inheritance**: both 柱 and 奥付（横） default to "same as body," independently overridable — matches the frozen v2 requirement (HD-005) exactly; this is *already* the case in current `src/`, not something that needs to change.

## 14. Responsive / UI

- Breakpoint: Tailwind `md` (768px) is the primary split point throughout (`TategakiEditor.tsx`, `EditorPane.tsx`, `PageSettingsPanel.tsx` all branch on it).
- Below `md`: `TategakiEditor.tsx`'s `mobileView` state (`"editor" | "preview" | "settings"`) makes the three workspaces **mutually exclusive, full-width, no simultaneous display** — confirmed via `max-md:hidden` toggling, not CSS-only responsive reflow.
- At `md+`: Editor and Settings render **simultaneously** (Settings as an always-visible inline strip inside `EditorPane`, not a drawer, not a modal) — Preview sits side-by-side, resizable via a drag divider (`editorWidthPercent`).
- **Frozen HD-010 decision (PC Settings drawer): NOT YET IMPLEMENTED.** Current desktop behavior is exactly the "simultaneous always-visible display" the Phase 1 UI Human QA Freeze explicitly moved away from — confirmed directly in source, not inferred. `typesetting-v2/prototypes/ui-comparison/ui-c.html` (the approved interaction-model prototype) is not imported or referenced anywhere in current `src/` (confirmed by search) — it remains a standalone prototype file, not integrated.
- 集中モード (focus mode): a per-device localStorage-only preference (`useMobileFocusMode.ts`), extended in TSP-LOOP-023 to also work at `md+` (hides the settings strip, shrinks Preview to a side rail) — the closest thing to "more room for the manuscript" that exists today, but it is not the approved drawer mechanism; it's an orthogonal, older feature.
- Mobile UI-C: confirmed **not implemented** — current mobile layout (tri-state `mobileView` + sticky `MobileEditorNav`) predates and is architecturally unrelated to the UI-C prototype; matches "Mobile UI-C: NOT YET APPROVED" status exactly (nothing to accidentally implement against an unapproved design, and nothing here contradicts that).
- `MobileEditorNav.tsx`: sticky phone-only nav bar, duplicates save status / help / feedback / focus-mode-toggle from the desktop `Header.tsx` so they stay reachable regardless of which workspace tab is active (confirmed via `TategakiEditor.tsx`'s prop wiring).

## 15. V2 Requirements Not Yet Implemented

Confirmed absent from current `src/` by direct source inspection (not assumed from planning documents):

- New Canonical Core integration (`typesetting-v2/core/` is never imported anywhere in `src/` — confirmed by search)
- New Preview Renderer (P3-O09) — does not exist; current Preview is `PageCard.tsx` FixedSlot (legacy)
- New Publication Renderer (P3-O08) — does not exist; current PDF/JPG export captures the legacy Preview DOM
- TXT import / TXT export — confirmed absent (§8)
- Export Profile A / B / (future C) — confirmed absent (§8)
- Session activity counter (typed+deleted cumulative) — confirmed absent (§3)
- Vertical Editor mode — confirmed absent (§3), and explicitly not yet researched per the compatibility matrix
- UI-C PC Settings drawer — confirmed NOT implemented (§14); current desktop is simultaneous-display
- Direct Memo access from Editor (HD-009) — confirmed only PARTIALLY satisfied (§10)
- Privacy consent boundary for AI/external processing — N/A, no such feature exists yet to gate (§12)
- New deterministic Canonical output as the actual Preview/Export data source — confirmed not wired; Preview/Export still run entirely on the legacy pipeline (§2)

## 16. Legacy → V2 Migration Matrix

| Feature | Current state | Current owner/file | v2 destination | Action | Risk |
|---|---|---|---|---|---|
| Manuscript text model (plain string + inline markers) | Implemented | `content` state, `tategaki.ts` tokenizer | Normalizer input contract | RECONNECT TO V2 CORE | LOW |
| Kinsoku (行頭/行末禁則) | Implemented, dual-mirror | `tategaki.ts` `LINE_START_PROHIBITED`/`LINE_END_PROHIBITED`, duplicated across `paginateTokensByLines`/`computePageSourceRanges` | Core (already implemented, P3-L06, single implementation) | RECONNECT TO V2 CORE | MEDIUM (dual-mirror today; v2 already collapses to one) |
| Hanging punctuation (ぶら下げ) | Implemented | `tategaki.ts` `HANGING_PUNCTUATION`/`HANGING_CLOSE_BRACKETS` | Core — **F06, classified Expected Deferred/Later Logical Stage, not yet implemented in v2** | RECONNECT TO V2 CORE (once F06 lands) | MEDIUM |
| Ruby (both notations, no-split guarantee) | Implemented | `tategaki.ts` `RUBY_PATTERN`; `PageCard.tsx` manual-annotation rendering | Core (logical) implemented (P3-L09); Renderer (visual) not started | RECONNECT TO V2 CORE (logic) / REBUILD (rendering) | HIGH (visual-fidelity gap flagged since Phase 0) |
| TCY (auto-detect + explicit) | Implemented | `tategaki.ts` `TCY_PATTERN`; fixed 1-cell budget | Core (logical, P3-L10) implemented; auto-detection (P3-O07) and visual rendering (P3-O03) both still OPEN | RECONNECT TO V2 CORE (explicit only) | HIGH (fixed-cell simplification may not survive a non-FixedSlot renderer) |
| Dash/ellipsis runs | Implemented, dual-definition | `tategaki.ts` pagination-side + `PageCard.tsx` render-side, deliberately separate | Core (logical, P3-L06/L10) implemented; visual alignment (P3-O04/O05) OPEN | RECONNECT TO V2 CORE (logic) / REBUILD (visual) | MEDIUM |
| Manual page break (3-case notation) | Implemented, intricate soft-close bookkeeping | `tategaki.ts` `pageBreakCommandSpan`/`lastSoftClosedPage` | Core (P3-L08) implemented | RECONNECT TO V2 CORE | HIGH (researcher-flagged intricate off-by-one risk) |
| Images (flow placement) | Implemented | `tategaki.ts` marker + `db.ts` storage | Core (P3-L11) implemented | RECONNECT TO V2 CORE | MEDIUM |
| Image decode/paint | Implemented (DOM overlay) | `PageCard.tsx` | Publication/Preview Renderer | REBUILD | MEDIUM |
| Colophon (横, dedicated page) | Implemented, isolated | `colophon.ts` + `ColophonPageCard.tsx` | Core (P3-L11, formally required by HD-006) implemented | RECONNECT TO V2 CORE | MEDIUM |
| Colophon (縦, body text) | Implemented (just generates text) | `bookStructure.ts` | Editor-side text generator; body flows through Core like any other text | KEEP AS-IS (Editor) + RECONNECT (typeset flow) | LOW |
| Page numbers / header (folio/柱) | Implemented | `pageLayout.ts` `MasterPageSettings` | Core (page-decoration layer, P3-L08 partial via `folio?` field) | RECONNECT TO V2 CORE | MEDIUM (subtle hidden-nombre / empty-header-≠-hidden distinctions must survive) |
| Capacity/margin derivation formulas | Implemented, single source-of-truth (already centralized within `src/`) | `pageLayout.ts` (`computeAutoCharsPerLine` etc.) | **P3-O12 — not ported to Core** | PENDING PRODUCT DECISION (which formula becomes canonical) | HIGH (highest-flagged migration risk in the compatibility matrix) |
| Preview rendering (FixedSlot) | Implemented | `PageCard.tsx` | Preview Renderer (P3-O09, not started) | REBUILD | HIGH (Master §7 explicitly white-sheets this) |
| PDF export (capture pipeline) | Implemented, DOM-coupled | `exportPdf.ts` + `exportCapture.ts` | Publication Renderer (P3-O08, not started) | REBUILD | HIGH |
| JPG export (capture pipeline) | Implemented, DOM-coupled, shares capture with PDF | `exportImage.ts` | Publication Renderer | REBUILD | HIGH |
| Local save (IndexedDB) | Implemented | `db.ts` | Unchanged persistence layer; v2 adds its own reproducibility metadata (VersionMetadata) on top | KEEP AS-IS | LOW |
| Cloud save/projects | Implemented, some schema looseness | `supabase/*.ts` | Unchanged, schema hardening is a separate improvement, not a v2-Core concern | KEEP AS-IS (flag schema looseness separately) | LOW–MEDIUM |
| 文章チェックβ | Implemented | `writingCheck.ts` | Editor-side, frozen to stay there | KEEP AS-IS | LOW |
| Memo | Implemented, partially satisfies HD-009 | `plotNote` + `PageSettingsPanel.tsx` | Editor-side (Contract §29 excludes it from Core) | MOVE TO EDITOR-SIDE (already there) + REBUILD access affordance for HD-009 | LOW |
| Settings UI (simultaneous display) | Implemented | `PageSettingsPanel.tsx` inline strip | UI-C drawer (HD-010, approved interaction model only) | REBUILD (interaction structure only — visual identity preserved) | MEDIUM |
| Session activity counter | Not implemented | N/A | Editor-side, net-new | PENDING PRODUCT DECISION (mechanism) | LOW (net-new, no regression risk) |
| TXT import/export | Not implemented | N/A | Editor I/O, net-new | PENDING PRODUCT DECISION | LOW (net-new) |
| Vertical Editor mode | Not implemented | N/A | Editor, explicitly research-stage only | PENDING PRODUCT DECISION | LOW (explicitly not a v2.0 commitment) |
| Undo/Redo | Browser-native only | textarea | Unclear whether v2 needs anything beyond this | PENDING PRODUCT DECISION | LOW (works today; only a question if a structured document model changes the editing surface) |

No feature above is assigned REMOVE — none has existing Human approval for removal, per this audit's own constraint.

## 17. Migration-Loss Risks

**HIGH**
1. **Ruby/TCY/dash visual fidelity.** Current rendering is hand-tuned, manually-positioned FixedSlot glyphs (not native CSS). A new Renderer that doesn't deliberately study and reproduce (or consciously, visibly accept a difference from) this exact positioning risks a silent visual regression users will notice immediately — this is precisely why P3-O03/O04/O05 exist as named open items rather than being closed by assumption.
2. **Manual-page-break edge-case bookkeeping** (`lastSoftClosedPage`, trailing-image-attaches-to-soft-closed-page). Already flagged by the original researcher as a likely off-by-one source if reimplemented differently without reading this exact logic first.
3. **Capacity/margin formula fidelity (P3-O12).** If a v2 Renderer derives its own chars-per-line/lines-per-column from mm inputs using a *different* formula than `computeAutoCharsPerLine`/`computeMaxCapacityChars`, every existing saved document's `PageSettings` (authored against the current formula) could silently re-layout differently on first v2 open.
4. **Export capture → real typeset divergence.** Today, "what you export" and "what you preview" are the same raster capture, by construction. Once a Publication Renderer no longer shares that identity, any drift between Preview and Publication rendering becomes newly *possible* in a way it structurally cannot be today — worth deliberate QA, not an accidental side effect of the redesign.

**MEDIUM**
5. **Dual colophon mechanisms** (§13) — a v2 migration that only "brings colophon into the Core" via the horizontal one, while quietly dropping or mishandling the vertical/body-text one, would surprise users who use 奥付（縦）today.
6. **Hidden-nombre / empty-header-≠-hidden-header distinctions** — subtle, easy to flatten by accident in a rewrite (explicitly named as a risk by the compatibility matrix; independently confirmed present in current `pageLayout.ts`/`PageSettingsPanel.tsx` this pass).
7. **Preview mounting every page simultaneously.** Not itself a v2 regression risk per se, but a new Renderer that "fixes" this via virtualization needs to preserve the current spread/selection/scroll-to-cursor behaviors that assume all pages are always mounted.

**LOW**
8. **Dead `PAGE_PRESETS` table** — zero current risk (unused), but a real risk if a future migration script naively "finds all preset-shaped data" and picks up the wrong one.
9. **Cloud schema looseness** (untyped `settings` column, string-matched error sentinel) — a pre-existing smell, not something v2 Core migration itself would worsen or fix; worth a separate cleanup decision.

## 18. Known OPEN Items

Carried forward from `typesetting-v2/` planning/loop-log documents, unaffected by this audit (this audit closes none of them):

- P3-O03 — TCY visual renderer
- P3-O04 — dash visual alignment
- P3-O05 — ellipsis visual alignment
- P3-O06 (residual) — exact ruby overhang budgets
- P3-O07 — TCY auto-detection threshold
- P3-O08 — Publication/PDF renderer
- P3-O09 — Preview renderer
- P3-O12 — real preset capacity/geometry math (confirmed still unported this pass — see §6/§16)
- P3-O14 — jukugo-ruby segmentation policy
- P3-O15 — group-ruby distinct break rule
- F06 — logical hanging application, deferred to a future Core micro-Loop (classified Category B, not a G1 blocker, per the P3-L15A loop-log entry)

Also newly *named* (not newly created) by this audit, for Product awareness:
- HD-010 (Settings drawer): approved interaction model, **not yet implemented** anywhere in current `src/` (§14)
- HD-009 (Memo direct access): **only partially satisfied** by current `src/` (§10)

## 19. Unknown / Human Verification Needed

Marked here rather than guessed, per this audit's own instruction:

- Exact in-Preview image-insert affordance (button vs. drag-drop vs. paste) — `PreviewPane.tsx` was not fully read this pass.
- Preview zoom/spread UI mechanism in detail — `pageOrder.ts`'s `computeSpreadGroups` confirms a spread concept exists; exact zoom control not confirmed.
- `PreviewPaneNew.tsx`'s exact activation gate (feature flag? route param? always dev-only?) — not audited.
- Global ruby-enable/disable toggle — not found, but `PageSettingsPanel.tsx`'s full 1533 lines were not entirely read; a small chance one exists in an unread section.
- SNS-share counter behavior — no code path encountered; may not exist, may exist somewhere unaudited.
- `ExportProgressModal.tsx`, `CombineModal.tsx`, `DemoTour.tsx`, `AuthModal.tsx`, `ProjectListModal.tsx`, `WritingCheckOverlay.tsx`, `WritingCheckBar.tsx` internals — referenced and their role inferred from call sites, but not individually read in full this pass.
- Exact accepted image file types/formats beyond PSD — `image.ts` not fully read.
- `MANUSCRIPT_IMAGE_MIME` allowlist's exact contents — truncated in the grep output used; full list not confirmed.

## 20. Recommended Migration Order

Not an authorization to implement — a dependency-ordered suggestion for Human review, adjusted from the batch prompt's own template based on this audit's actual findings:

1. **P3-O12 resolution** (or an explicit Product decision to defer it further) — nearly every downstream Renderer/Editor-integration step needs to know whether v2 Core will own capacity derivation or continue delegating to `pageLayout.ts`'s existing, already-centralized formula.
2. **Preview development adapter** — a thin bridge letting `typesetting-v2/core/`'s `composeCanonicalDocument()` output feed a *temporary*, even minimal, visual check, so ruby/TCY/dash visual-fidelity work (P3-O03/04/05) has a real target to compare against before a full Renderer exists.
3. **New Preview Renderer** (P3-O09) — the first point Human visual QA of real painted output becomes meaningful (per `CORE_TEST_STRATEGY.md`'s own boundary).
4. **F06 Hanging micro-Loop** — small, already fully scoped (values frozen), worth closing before or alongside Renderer work rather than after.
5. **Current Editor ↔ v2 Core connection** — replacing `tokenizeTategakiWithOffsets`/`paginateTokensByLines` calls with a Normalizer + `composeCanonicalDocument()` call, behind a flag, non-destructively.
6. **Settings mapping** — `PageSettings` → v2 `LayoutSettings`, including the HD-010 drawer UI work (independent of Core wiring, could proceed in parallel).
7. **Images/colophon/special elements** — wiring `core/images/`, `core/colophon/`, `core/ruby/`, `core/tcy/` outputs into whatever Renderer exists by that point (image capacity-cost wiring already closed at P3-L15A on the Core side; the Editor/Renderer side is still new work).
8. **Publication Renderer** (P3-O08) — after Preview Renderer validates visual fidelity, not before.
9. **Export migration** — replacing `capturePageToCanvas`-based PDF/JPG with real Publication Renderer output.
10. **UI-C** — Settings drawer (HD-010) and any further Editor UI work, largely independent of the Core/Renderer critical path.
11. **Optional Editor enhancements** — session activity counter, TXT import/export, vertical Editor mode, HD-009 full compliance — all net-new or partial items with no regression risk, safe to sequence last or interleave opportunistically.

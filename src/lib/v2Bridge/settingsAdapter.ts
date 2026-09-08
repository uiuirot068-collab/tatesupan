/**
 * TateSpun Live Editor -> v2 Publication Bridge: format/typography +
 * folio/header/colophon settings adapter.
 *
 * Maps the real, already-persisted `PageSettings` (`src/lib/pageLayout.ts`)
 * into v2 Core's real, unchanged input contracts. Deliberately DEEP
 * imports only (never the `typesetting-v2/core` barrel) -- a real
 * production `next build` proved that barrel pulls in Node-only code for
 * any browser consumer (see `core/index.ts`'s own disclosure comment).
 *
 * CRITICAL RULE (Human instruction): this module reads the Editor's own
 * ALREADY-CHOSEN `charsPerLine`/`linesPerColumn` (real, persisted target
 * numbers -- confirmed real, not always-recomputed, by direct read of
 * `pageLayout.ts:141-142`'s own comments) and converts them directly to
 * v2 tick extents via the same `fontSizePt -> perCellAdvanceTick` formula
 * every other v2 fixture/QA convention already uses. It never invents a
 * new default capacity and never re-derives from margins -- the Editor's
 * own value IS the source of truth. This is what the Human's "tight PoC
 * column spacing" note asked to be proven: real Editor settings must
 * reach the canonical geometry, not a renderer-chosen default.
 */
import { resolvePaperSize, type PageSettings } from "../pageLayout";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import type { PageCompositionSettings } from "../../../typesetting-v2/core/compose/page";
import { headerSettingsFromLegacy, type HeaderSettings, type HeaderPageOverride } from "../../../typesetting-v2/core/header";
import type { FolioSettings } from "../../../typesetting-v2/core/folio";
import type { FolioPosition, ColophonPlacement } from "../../../typesetting-v2/core/layout/schema";
import { compileColophonContent, type ColophonPagePosition } from "../../../typesetting-v2/core/colophon";
import type { PublicationPageGeometry } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

/**
 * `PageCompositionSettings` -- consumed by `composeCanonicalDocument`.
 * `charsPerLine`/`linesPerColumn` come directly from the Editor's own
 * real, persisted target values (see module doc). `bodyFontRef` is a
 * synthetic id (v2's measurement-identity concept, not a real font
 * asset path) since the real font resource is only needed downstream by
 * the Publication paint/raster executors, never by composition itself.
 */
export function buildV2LayoutSettings(settings: PageSettings): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks((settings.fontSizePt * 25.4) / 72);
  return {
    bodyFontRef: settings.fontFamily,
    bodyFontSizePt: settings.fontSizePt,
    lineExtentTicks: settings.charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: settings.linesPerColumn * perCellAdvanceTick,
    columnsPerPage: settings.columnCount,
  };
}

/**
 * Margin mapping is DIRECT, matching v2's own documented vertical-rl
 * convention (`PublicationPageGeometry`'s own field comments):
 * ノド/gutter (inside) -> marginRightMm, 小口/outer (outside) -> marginLeftMm.
 */
export function buildV2PageGeometry(settings: PageSettings): PublicationPageGeometry {
  const paper = resolvePaperSize(settings.paperSize);
  return {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    marginTopMm: settings.marginTop,
    marginBottomMm: settings.marginBottom,
    marginRightMm: settings.marginGutter,
    marginLeftMm: settings.marginOuter,
    marginGutterMm: settings.marginGutter,
    marginOuterMm: settings.marginOuter,
  };
}

/**
 * `nombrePosition === "hidden"` has no v2 `FolioPosition` equivalent
 * (v2 only has center/gutter/outer) -- returns `undefined` in that case,
 * meaning the caller omits `folioSettings` from
 * `composeCanonicalDocument` entirely (no page ever gets a folio),
 * which is v2's own real, documented way to represent "no folio."
 */
export function buildV2FolioSettings(settings: PageSettings): FolioSettings | undefined {
  const { nombrePosition, hideNombreOnFirstPage, nombreStart } = settings.masterPage;
  if (nombrePosition === "hidden") return undefined;
  return {
    nombreStart,
    hideNombreOnFirstPage,
    position: nombrePosition as FolioPosition,
  };
}

export function buildV2HeaderSettings(settings: PageSettings): HeaderSettings {
  const { hashiraOdd, hashiraEven, hashiraPosition } = settings.masterPage;
  return headerSettingsFromLegacy(hashiraOdd, hashiraEven, hashiraPosition);
}

/**
 * Legacy `PageSettings.pageOverrides` (1-based page number keys) maps
 * DIRECTLY onto v2's `headerPageOverrides` for the hashira-relevant
 * subset (`hideHashira`/`hashiraOverride`) -- confirmed field-identical
 * by `core/header/index.ts`'s own "Matches legacy PageOverride exactly"
 * comment. Folio's own per-page `hideNombre` override has NO v2
 * equivalent yet (explicitly out of scope per that same module's own
 * comment, not a gap introduced by this adapter) -- silently dropped
 * here, not silently claimed as supported.
 */
export function buildV2HeaderPageOverrides(settings: PageSettings): Record<number, HeaderPageOverride> | undefined {
  const entries = Object.entries(settings.pageOverrides)
    .map(([pageNumber, override]): [number, HeaderPageOverride] | null => {
      const mapped: HeaderPageOverride = {};
      if (override.hideHashira) mapped.hideHashira = true;
      if (override.hashiraOverride !== undefined) mapped.hashiraOverride = override.hashiraOverride;
      return Object.keys(mapped).length > 0 ? [Number(pageNumber), mapped] : null;
    })
    .filter((e): e is [number, HeaderPageOverride] => e !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Colophon content (compiled label/value rows + freeText) becomes plain
 * text using the SAME "label\tvalue" row convention, newline-joined,
 * every real colophon QA fixture in this project already used (see
 * `renderer/publication/structuralColophon*.test.ts`) -- this is v2's
 * own already-established real content-to-text convention, not invented
 * here. The resulting text string is then fed through the SAME
 * `buildV2UnitsFromManuscript`-style plain-text tokenizer the body
 * manuscript uses (ruby/TCY/images are not meaningful inside colophon
 * fields, so this returns the source text for the caller to convert,
 * keeping this module free of a manuscript-adapter dependency).
 */
export function buildV2ColophonText(colophon: PageSettings["colophon"]): string {
  const compiled = compileColophonContent({ fields: colophon.fields, freeText: colophon.freeText });
  const rowLines = compiled.rows.map((row) => `${row.label}\t${row.value}`);
  const lines = compiled.freeText.trim().length > 0 ? [...rowLines, compiled.freeText] : rowLines;
  return lines.join("\n");
}

/**
 * `pagePosition`/`placement` field NAMES and SHAPES are already
 * identical between legacy `ColophonSettings` and v2's own
 * `ColophonPagePosition`/`ColophonPlacement` (v2 was built by porting
 * this exact contract in an earlier round) -- direct field extraction,
 * no transformation.
 */
export function buildV2ColophonPagePosition(colophon: PageSettings["colophon"]): ColophonPagePosition {
  return colophon.pagePosition;
}

export function buildV2ColophonPlacement(colophon: PageSettings["colophon"]): ColophonPlacement {
  return colophon.placement;
}

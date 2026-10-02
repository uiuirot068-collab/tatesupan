/**
 * TateSpun Live Editor -> v2 Publication Bridge: orchestration.
 *
 * Ties `manuscriptAdapter.ts` + `settingsAdapter.ts` together into a real
 * v2 `CanonicalDocument` / `PublicationDocument` / `PaintPlan`, using
 * ONLY v2's own real, unchanged composition entrypoints
 * (`composeCanonicalDocument`, `buildPublicationDocument`, `buildPaintPlan`)
 * -- never a second layout/composition engine. Deep imports only, same
 * rationale as `settingsAdapter.ts`'s own doc comment.
 */
import { buildV2UnitsFromManuscript, type ManuscriptSourceMap } from "./manuscriptAdapter";
import { compileColophonContent, type ColophonPagePosition } from "../../../typesetting-v2/core/colophon";
import { buildV2LayoutSettings, buildV2PageGeometry, buildV2FolioSettings, buildV2HeaderSettings, buildV2ColophonText, buildV2ColophonPagePosition, buildV2ColophonPlacement } from "./settingsAdapter";
import { applyEditorPageOverrides } from "./pageFurniture";
import { computePageLayout, type PageSettings } from "../pageLayout";
import { buildTocCompositionInsertion } from "../tocSettings";
import { fitImageToBox, imageMaxBoxForTextArea } from "../imageGeometry";
import { composeCanonicalDocument } from "../../../typesetting-v2/core/layout/assemble";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import { DEFAULT_RULE_SET_V2 } from "../../../typesetting-v2/core/rules/defaultRuleSet";
import type { MeasurementFacts } from "../../../typesetting-v2/core/measurement/facts";
import type { CanonicalDocument } from "../../../typesetting-v2/core/layout/schema";
import type { LogicalUnit } from "../../../typesetting-v2/core/units";
import type { PageCompositionSettings } from "../../../typesetting-v2/core/compose/page";
import { buildPublicationDocument, type ImageResolver, type PublicationRenderContext, type PublicationDocument } from "../../../typesetting-v2/renderer/publication/paintModel";
import { buildPaintPlan, FALLBACK_BASELINE_RATIO, type PaintPlan, type PublicationPageGeometry } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

export interface V2BridgeInput {
  title: string;
  content: string;
  settings: PageSettings;
  /** A real per-character-advance measurement provider -- callers choose
   * which (e.g. `createFakeMeasurementProvider` for deterministic tests,
   * or a real font-derived provider) -- this module makes no measurement
   * policy decision of its own. */
  measurement: MeasurementFacts;
  imageResolver?: ImageResolver;
}

/**
 * The canonical layout (Core document + Publication model + Preview inputs)
 * WITHOUT a PaintPlan. The live Preview worker only needs this: export builds
 * its own font-aware plan from `model` (`buildPublicationPaintPlan`), so the
 * worker no longer composes and structured-clones an unused plan per update.
 */
export type V2LayoutResult = Omit<V2BridgeResult, "plan">;

export interface V2TocPlacement {
  rawOffset: number;
  rawLength: number;
  firstCanonicalPage: number;
  pageCount: number;
}

export interface V2BridgeResult {
  document: CanonicalDocument;
  model: PublicationDocument;
  plan: PaintPlan;
  units: LogicalUnit[];
  source: string;
  /** Body flow code point → raw manuscript offsets (manuscriptAdapter), for the Preview page model. */
  bodySourceMap: ManuscriptSourceMap;
  /**
   * Phase 11: the work-owned TOC, when present. `rawOffset`/`rawLength` locate
   * the composition-only TOC text spliced into the composed body source (the
   * Editor's `content` never contains it); `firstCanonicalPage`/`pageCount`
   * are the canonical BODY pages it occupies. Preview page model, page
   * furniture and export all classify TOC pages from this one value.
   */
  toc?: V2TocPlacement;
  colophonUnits?: LogicalUnit[];
  colophonSource?: string;
  layoutSettings: PageCompositionSettings;
  pageGeometry: PublicationPageGeometry;
  /** Paint-only placement: TateSpun 2段 stacks canonical columns top-to-bottom. */
  columnStackDirection: "horizontal" | "vertical";
  columnGapTicks: number;
  /** The legacy 段 frame height (`computePageLayout().columnHeightMm`), in ticks. */
  columnFrameTicks: number;
}

/** 2段 is a top/bottom stack of legacy-sized 段 frames (see renderer/columnStack.ts). */
function editorColumnStack(settings: PageSettings) {
  return {
    columnStackDirection: settings.columnCount === 2 ? ("vertical" as const) : ("horizontal" as const),
    columnGapTicks: mmToTicks(settings.columnGapMm),
    columnFrameTicks: mmToTicks(computePageLayout(settings).columnHeightMm),
  };
}

/**
 * The full bridge: real Editor manuscript + settings -> real v2
 * Publication PaintPlan (the SAME PaintPlan PDF/Node-QA/browser JPG
 * executors all consume). Colophon is composed only when
 * `settings.colophon.enabled` is true, matching legacy's own real
 * "colophon is off by default" contract (`src/lib/colophon.ts`).
 */
export function composeV2Document(input: V2BridgeInput): V2BridgeResult {
  const layout = composeV2Layout(input);
  return { ...layout, plan: buildPaintPlan(layout.model, true, layout.pageGeometry, FALLBACK_BASELINE_RATIO) };
}

/**
 * Caps every IMAGE unit to the shared 挿絵 box (`lib/imageGeometry.ts`: the
 * insertion caps, plus never longer than one line — an atom longer than the
 * line has no legal break and would HOLD the whole document). Aspect ratio is
 * preserved; a marker that already fits is untouched.
 */
function capEditorImageUnits(units: LogicalUnit[], settings: PageSettings, lineExtentTicks: number): LogicalUnit[] {
  if (!units.some((unit) => unit.kind === "IMAGE")) return units;
  const frame = computePageLayout(settings);
  const box = imageMaxBoxForTextArea(frame.textAreaWidthMm, frame.textAreaHeightMm);
  const lineExtentMm = lineExtentTicks / mmToTicks(1);
  const maxBox = { maxWidthMm: box.maxWidthMm, maxHeightMm: Math.min(box.maxHeightMm, lineExtentMm) };
  const tickMm = mmToTicks(1);
  return units.map((unit) => {
    if (unit.kind !== "IMAGE") return unit;
    const size = { widthMm: unit.intrinsicWidth / tickMm, heightMm: unit.intrinsicHeight / tickMm };
    const fitted = fitImageToBox(size, maxBox);
    if (fitted === size) return unit;
    return { ...unit, intrinsicWidth: mmToTicks(fitted.widthMm), intrinsicHeight: Math.min(mmToTicks(fitted.heightMm), lineExtentTicks) };
  });
}

/**
 * Composes the layout. With a TOC whose body continuation must stay a
 * paragraph start, the TOC is first padded to fill its last page exactly
 * (`buildTocCompositionInsertion`); if Core's real composition shows that the
 * padding did not land exactly on a page end (a TOC page sharing a page with
 * body text, or a padding-only page), the layout is recomposed with the
 * page-break close instead — the composition itself is the authority.
 */
export function composeV2Layout(input: V2BridgeInput): V2LayoutResult {
  const padded = composeV2LayoutOnce(input, true);
  return padded.tocNeedsPageBreakClose ? composeV2LayoutOnce(input, false).layout : padded.layout;
}

function composeV2LayoutOnce(input: V2BridgeInput, padToPageEnd: boolean): { layout: V2LayoutResult; tocNeedsPageBreakClose: boolean } {
  // Body-only typography (post-beta Phase 1, see manuscriptAdapter.ts):
  // 傍点 decoration, and ――/…… runs as inseparable SEMANTIC_RUN units. `charsPerLine - 1`
  // keeps every grouped run narrower than a paragraph-first (一字下げ) line.
  // The colophon (horizontal, its own painter) keeps the prior plain units.
  const tocInsertion = buildTocCompositionInsertion(
    input.content,
    input.settings.toc,
    { cellsPerLine: input.settings.charsPerLine, linesPerColumn: input.settings.linesPerColumn, columnsPerPage: input.settings.columnCount },
    { padToPageEnd }
  );
  const composedBodySource = tocInsertion
    ? input.content.slice(0, tocInsertion.offset) + tocInsertion.text + input.content.slice(tocInsertion.offset)
    : input.content;
  const { units: rawUnits, source, sourceMap: bodySourceMap } = buildV2UnitsFromManuscript("body", composedBodySource, {
    maxSemanticRunCells: Math.floor(input.settings.charsPerLine) - 1,
    decorations: true,
  });
  const layoutSettings = buildV2LayoutSettings(input.settings);
  const pageGeometry = buildV2PageGeometry(input.settings);
  const folioSettings = buildV2FolioSettings(input.settings);
  const headerSettings = buildV2HeaderSettings(input.settings);
  const columnStack = editorColumnStack(input.settings);
  const units = capEditorImageUnits(rawUnits, input.settings, layoutSettings.lineExtentTicks);

  const colophonEnabled = input.settings.colophon.enabled;
  const colophonComposition = colophonEnabled ? buildV2UnitsFromManuscript("colophon", buildV2ColophonText(input.settings.colophon)) : undefined;

  // Core deliberately asks MeasurementFacts for an image's intrinsic box.
  // The Editor marker already carries that authoritative, persisted box in
  // millimetres and manuscriptAdapter has converted it to ticks on ImageUnit.
  // Keep the provider identity/font measurements intact, but answer image
  // measurements from those real units. Without this bridge, the Shippori
  // provider's deterministic fixture fallback derives a tiny box from refId,
  // discarding the IMG marker's real width/height before either renderer sees
  // it. Existing non-Editor Core callers retain their provider-owned policy.
  const editorImageMeasurements = new Map(
    units
      .filter((unit): unit is Extract<LogicalUnit, { kind: "IMAGE" }> => unit.kind === "IMAGE")
      .map((unit) => [unit.refId, { width: unit.intrinsicWidth, height: unit.intrinsicHeight }])
  );
  const measurement: MeasurementFacts = editorImageMeasurements.size === 0
    ? input.measurement
    : {
        ...input.measurement,
        imageIntrinsicTick: (refId) => editorImageMeasurements.get(refId) ?? input.measurement.imageIntrinsicTick(refId),
      };

  // Editor page overrides are keyed by BODY page number; Core would apply
  // header overrides by PHYSICAL number (and has no per-page hideNombre), so
  // they are resolved once after composition — see pageFurniture.ts.
  const composeWithColophonPosition = (colophonPagePosition: ColophonPagePosition | undefined) =>
    composeCanonicalDocument({
      bodyUnits: units,
      colophonUnits: colophonComposition?.units,
      colophonBlockId: colophonEnabled ? "colophon" : undefined,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings: layoutSettings,
      folioSettings,
      headerSettings,
      colophonPagePosition,
      colophonPlacement: colophonEnabled ? buildV2ColophonPlacement(input.settings.colophon) : undefined,
    });
  const requestedColophonPosition = colophonEnabled ? buildV2ColophonPagePosition(input.settings.colophon) : undefined;
  let composed = composeWithColophonPosition(requestedColophonPosition);

  const tocPages = tocInsertion
    ? classifyTocPages(composed, composedBodySource, bodySourceMap, tocInsertion.offset, tocInsertion.text.length)
    : null;
  const toc: V2TocPlacement | undefined = tocInsertion && tocPages && tocPages.pageCount > 0
    ? { rawOffset: tocInsertion.offset, rawLength: tocInsertion.text.length, firstCanonicalPage: tocPages.firstCanonicalPage, pageCount: tocPages.pageCount }
    : undefined;

  // 「Nページ目の後に奥付」 is an EDITOR body page number. Core counts the
  // synthetic TOC pages as canonical body pages, so when the TOC sits at or
  // before that point shift the request past them (the TOC then precedes the
  // colophon). Body composition never depends on colophon placement
  // (assemble.ts "body composition invariant"), so the TOC page range above
  // stays valid. Recompose only in that case (TOC + mid-book colophon).
  if (toc && requestedColophonPosition?.mode === "after-body-page" && toc.firstCanonicalPage <= requestedColophonPosition.afterBodyPage) {
    composed = composeWithColophonPosition({
      mode: "after-body-page",
      afterBodyPage: requestedColophonPosition.afterBodyPage + toc.pageCount,
    });
  }
  const document = applyEditorPageOverrides(composed, headerSettings, input.settings.pageOverrides, toc);

  const ctx: PublicationRenderContext = {
    linePitchTicks: layoutSettings.linePitchTicks,
    lineExtentTicks: layoutSettings.lineExtentTicks,
    columnExtentTicks: layoutSettings.columnExtentTicks,
    columnsPerPage: layoutSettings.columnsPerPage,
    ...columnStack,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
    imageResolver: input.imageResolver,
    // The current Editor UI labels FULL as 「全面（ページを覆う）」 and its
    // established Preview painter uses object-fit:cover over the paper.
    fullImageCoversPage: true,
    // Typography Parity Round 4 (2026-09-09): `linePitchTicks` above is now
    // genuinely the column-to-column pitch (Round 3's own fix), no longer
    // interchangeable with the body font's own em size -- glyph paint scale
    // must be supplied separately, or every glyph paints at the (wrong)
    // column-pitch size. See paintModel.ts's own `bodyFontSizeTick` doc.
    bodyFontSizeTick: mmToTicks((layoutSettings.bodyFontSizePt * 25.4) / 72),
    folioFontSizePt: input.settings.masterPage.nombreFontSize,
    runningHeadFontSizePt: input.settings.masterPage.headerFontSize,
  };

  const model = colophonComposition
    ? buildPublicationDocument(
        "editor-doc",
        input.title,
        document,
        units,
        source,
        ctx,
        colophonComposition.units,
        colophonComposition.source,
        {
          templateId: input.settings.colophon.templateId,
          fontSizePt: input.settings.colophon.fontSizePt,
          // TSP-PHASE13-001: 奥付は常に本文と同じフォント（保存済みの奥付フォント指定は無視）。
          fontFamily: input.settings.fontFamily,
          ...(() => {
            const compiled = compileColophonContent({
              fields: input.settings.colophon.fields,
              freeText: input.settings.colophon.freeText,
            });
            // TSP-PHASE13-001: keep each row's field id (the same rows the
            // Preview's `colophonRenderModel` builds), so id-dependent
            // template styling such as the classic title weight matches.
            const ids = input.settings.colophon.fields
              .filter((f) => f.visible && (f.label.trim() !== "" || f.value.trim() !== ""))
              .map((f) => f.id);
            return {
              rows: compiled.rows.map((row, index) => ({ id: ids[index], ...row })),
              freeText: compiled.freeText,
              titleFallback: input.title.trim(),
            };
          })(),
        }
      )
    : buildPublicationDocument("editor-doc", input.title, document, units, source, ctx);

  const layout: V2LayoutResult = {
    document,
    model,
    units,
    source,
    bodySourceMap,
    ...(toc ? { toc } : {}),
    ...(colophonComposition
      ? { colophonUnits: colophonComposition.units, colophonSource: colophonComposition.source }
      : {}),
    layoutSettings,
    pageGeometry,
    ...columnStack,
  };
  return { layout, tocNeedsPageBreakClose: padToPageEnd && tocInsertion !== null && (tocPages?.inexact ?? false) };
}

/**
 * Finds the canonical body pages the spliced TOC text occupies, from Core's
 * own placed units. Newline (paragraph-break) units are ignored for
 * ownership. `inexact` reports a page shared by TOC and body text, or a page
 * holding only TOC padding — i.e. the padding did not end exactly on a page.
 */
function classifyTocPages(
  composed: CanonicalDocument,
  composedSource: string,
  sourceMap: ManuscriptSourceMap,
  tocOffset: number,
  tocLength: number
): { firstCanonicalPage: number; pageCount: number; inexact: boolean } {
  const tocEnd = tocOffset + tocLength;
  let first = -1;
  let count = 0;
  let inexact = false;
  composed.pages.forEach((page, index) => {
    let inside = 0;
    let outside = 0;
    let newlinesInside = 0;
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const placed of line.placedUnits) {
          const flowIndex = placed.sourceSpan.start;
          if (flowIndex < 0 || flowIndex >= sourceMap.rawStart.length) continue;
          const raw = sourceMap.rawStart[flowIndex];
          const isNewline = composedSource[raw] === "\n";
          const inToc = raw >= tocOffset && raw < tocEnd;
          if (isNewline) {
            if (inToc) newlinesInside += 1;
          } else if (inToc) inside += 1;
          else outside += 1;
        }
      }
    }
    if (inside > 0 && outside > 0) inexact = true;
    const isToc = (inside > 0 && outside === 0) || (inside === 0 && outside === 0 && newlinesInside > 0 && first >= 0 && index === first + count);
    if (isToc && inside === 0) inexact = true; // a padding-only page
    if (isToc && (first < 0 || index === first + count)) {
      if (first < 0) first = index;
      count += 1;
    }
  });
  return { firstCanonicalPage: Math.max(0, first), pageCount: first < 0 ? 0 : count, inexact };
}

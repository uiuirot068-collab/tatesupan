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
import { buildV2UnitsFromManuscript } from "./manuscriptAdapter";
import { buildV2LayoutSettings, buildV2PageGeometry, buildV2FolioSettings, buildV2HeaderSettings, buildV2ColophonText, buildV2ColophonPagePosition, buildV2ColophonPlacement } from "./settingsAdapter";
import { applyEditorPageOverrides } from "./pageFurniture";
import { computePageLayout, type PageSettings } from "../pageLayout";
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

export interface V2BridgeResult {
  document: CanonicalDocument;
  model: PublicationDocument;
  plan: PaintPlan;
  units: LogicalUnit[];
  source: string;
  colophonUnits?: LogicalUnit[];
  colophonSource?: string;
  layoutSettings: PageCompositionSettings;
  pageGeometry: PublicationPageGeometry;
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

export function composeV2Layout(input: V2BridgeInput): V2LayoutResult {
  // Body-only typography (post-beta Phase 1, see manuscriptAdapter.ts):
  // 傍点 decoration, and ――/…… runs as inseparable SEMANTIC_RUN units. `charsPerLine - 1`
  // keeps every grouped run narrower than a paragraph-first (一字下げ) line.
  // The colophon (horizontal, its own painter) keeps the prior plain units.
  const { units: rawUnits, source } = buildV2UnitsFromManuscript("body", input.content, {
    maxSemanticRunCells: Math.floor(input.settings.charsPerLine) - 1,
    decorations: true,
  });
  const layoutSettings = buildV2LayoutSettings(input.settings);
  const pageGeometry = buildV2PageGeometry(input.settings);
  const folioSettings = buildV2FolioSettings(input.settings);
  const headerSettings = buildV2HeaderSettings(input.settings);
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
  const composed = composeCanonicalDocument({
    bodyUnits: units,
    colophonUnits: colophonComposition?.units,
    colophonBlockId: colophonEnabled ? "colophon" : undefined,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings: layoutSettings,
    folioSettings,
    headerSettings,
    colophonPagePosition: colophonEnabled ? buildV2ColophonPagePosition(input.settings.colophon) : undefined,
    colophonPlacement: colophonEnabled ? buildV2ColophonPlacement(input.settings.colophon) : undefined,
  });
  const document = applyEditorPageOverrides(composed, headerSettings, input.settings.pageOverrides);

  const ctx: PublicationRenderContext = {
    linePitchTicks: layoutSettings.linePitchTicks,
    lineExtentTicks: layoutSettings.lineExtentTicks,
    columnExtentTicks: layoutSettings.columnExtentTicks,
    columnsPerPage: layoutSettings.columnsPerPage,
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
    ? buildPublicationDocument("editor-doc", input.title, document, units, source, ctx, colophonComposition.units, colophonComposition.source)
    : buildPublicationDocument("editor-doc", input.title, document, units, source, ctx);

  return {
    document,
    model,
    units,
    source,
    ...(colophonComposition
      ? { colophonUnits: colophonComposition.units, colophonSource: colophonComposition.source }
      : {}),
    layoutSettings,
    pageGeometry,
  };
}

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
import { buildV2LayoutSettings, buildV2PageGeometry, buildV2FolioSettings, buildV2HeaderSettings, buildV2HeaderPageOverrides, buildV2ColophonText, buildV2ColophonPagePosition, buildV2ColophonPlacement } from "./settingsAdapter";
import type { PageSettings } from "../pageLayout";
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
  const { units, source } = buildV2UnitsFromManuscript("body", input.content);
  const layoutSettings = buildV2LayoutSettings(input.settings);
  const pageGeometry = buildV2PageGeometry(input.settings);
  const folioSettings = buildV2FolioSettings(input.settings);
  const headerSettings = buildV2HeaderSettings(input.settings);
  const headerPageOverrides = buildV2HeaderPageOverrides(input.settings);

  const colophonEnabled = input.settings.colophon.enabled;
  const colophonComposition = colophonEnabled ? buildV2UnitsFromManuscript("colophon", buildV2ColophonText(input.settings.colophon)) : undefined;

  const document = composeCanonicalDocument({
    bodyUnits: units,
    colophonUnits: colophonComposition?.units,
    colophonBlockId: colophonEnabled ? "colophon" : undefined,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement: input.measurement,
    settings: layoutSettings,
    folioSettings,
    headerSettings,
    headerPageOverrides,
    colophonPagePosition: colophonEnabled ? buildV2ColophonPagePosition(input.settings.colophon) : undefined,
    colophonPlacement: colophonEnabled ? buildV2ColophonPlacement(input.settings.colophon) : undefined,
  });

  const ctx: PublicationRenderContext = {
    linePitchTicks: layoutSettings.linePitchTicks,
    lineExtentTicks: layoutSettings.lineExtentTicks,
    columnExtentTicks: layoutSettings.columnExtentTicks,
    columnsPerPage: layoutSettings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
    imageResolver: input.imageResolver,
    // Typography Parity Round 4 (2026-09-09): `linePitchTicks` above is now
    // genuinely the column-to-column pitch (Round 3's own fix), no longer
    // interchangeable with the body font's own em size -- glyph paint scale
    // must be supplied separately, or every glyph paints at the (wrong)
    // column-pitch size. See paintModel.ts's own `bodyFontSizeTick` doc.
    bodyFontSizeTick: mmToTicks((layoutSettings.bodyFontSizePt * 25.4) / 72),
  };

  const model = colophonComposition
    ? buildPublicationDocument("editor-doc", input.title, document, units, source, ctx, colophonComposition.units, colophonComposition.source)
    : buildPublicationDocument("editor-doc", input.title, document, units, source, ctx);

  const plan = buildPaintPlan(model, true, pageGeometry, FALLBACK_BASELINE_RATIO);

  return {
    document,
    model,
    plan,
    units,
    source,
    ...(colophonComposition
      ? { colophonUnits: colophonComposition.units, colophonSource: colophonComposition.source }
      : {}),
    layoutSettings,
    pageGeometry,
  };
}

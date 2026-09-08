// Public Core entry point (CORE_MODULE_MAP.md row 25). The only file
// anything outside typesetting-v2/core/ may import from — production src/
// does not import this yet (integration is a distinct, future, explicit
// gate, not implied by this file's existence).

export { composeCanonicalDocument, buildVersionMetadata } from "./layout/assemble";
export type { DocumentCompositionInput } from "./layout/assemble";

export type {
  CanonicalDocument,
  CanonicalPage,
  CanonicalColumn,
  CanonicalLine,
  PlacedUnit,
  ColophonBlock,
  ColophonPlacement,
  ColophonHorizontalPlacement,
  ColophonVerticalPlacement,
  PhysicalPageRef,
  LayoutWarning,
  LayoutError,
  GeneratedPageFurniture,
  FolioPosition,
  ResolvedFolioPosition,
  GeneratedHeader,
  HeaderBand,
  HeaderPositionSetting,
  ResolvedHeaderPosition,
} from "./layout/schema";

export type { FolioSettings } from "./folio";
export { DEFAULT_FOLIO_SETTINGS, composeFolioForPage, resolveFolioPhysicalSide } from "./folio";

export type { HeaderSettings, HeaderPageOverride } from "./header";
export { DEFAULT_HEADER_SETTINGS, composeHeaderForPage, headerSettingsFromLegacy } from "./header";

export type { ColophonFieldInput, ColophonContentSettings, ColophonCompiledRow, ColophonCompiledContent, ColophonPagePosition, ColophonInsertion } from "./colophon";
export { composeColophon, compileColophonContent, resolveColophonInsertion, DEFAULT_COLOPHON_PLACEMENT } from "./colophon";

export type { VersionMetadata } from "./version";

export type {
  LogicalUnit,
  TextUnit,
  RubyUnit,
  RubyKind,
  RubySegment,
  TCYUnit,
  SemanticRunUnit,
  SemanticRunKind,
  ManualBreakUnit,
  ImageUnit,
  ImagePlacement,
  ParagraphBreakUnit,
} from "./units";

export type { RuleSetVersion, CharacterClass, CharacterClassId } from "./rules/characterClass";
export { DEFAULT_RULE_SET_V2 } from "./rules/defaultRuleSet";

export type { MeasurementFacts } from "./measurement/facts";
export { createFakeMeasurementProvider } from "./measurement/fakeProvider";
// Real, asset-backed provider (P3-O08 Font Embedding Gate follow-up) — does
// local, synchronous file I/O inside its factory function only (never
// inside composeCanonicalDocument's own deterministic loop). Test/fixture
// code should keep using createFakeMeasurementProvider unless it
// specifically needs a real, asset-tied measurementIdentity.
export { createShipporiMinchoMeasurementProvider } from "./measurement/shipporiMinchoProvider";
export type { ShipporiMinchoAssetInfo } from "./measurement/shipporiMinchoProvider";

export type { PageCompositionSettings } from "./compose/page";

// TateSpun v2's single authoritative ruby-scale value (Human/Product
// decision, 2026-09-07) — Core measurement, Preview paint, and
// Publication paint must all derive their own ruby-annotation sizing
// from THIS constant, never an independently-hardcoded one.
export type { LayoutSettings } from "./settings";
export { DEFAULT_RUBY_SCALE } from "./settings";

// P3-O12-C: capacity-formula policy (typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md).
// IMPLEMENTED / READY FOR VALIDATION — not yet wired to any Editor/src/ caller.
export type { CapacityFormulaVersion, CapacitySettingsEvent } from "./settings/capacityFormulaVersion";
export { resolveCapacityFormulaVersion, canMigrateCapacityFormula } from "./settings/capacityFormulaVersion";
export type { LegacyCapacityInputMm, LegacyCapacityResult } from "./settings/capacityLegacyFrozen";
export { deriveLegacyFrozenCapacity } from "./settings/capacityLegacyFrozen";
export type { V2NativeCapacityInputMm, V2NativeCapacityResult } from "./settings/capacityV2Native";
export { deriveV2NativeCapacity } from "./settings/capacityV2Native";
export type { CapacityDerivationInput, CapacityDerivationResult } from "./settings/capacityPolicy";
export { deriveCapacityForEvent, initializeNewDocumentCapacity } from "./settings/capacityPolicy";

export type { GeometryTick } from "./geometry/tick";
export { mmToTicks } from "./geometry/tick";

export type { SourceSpan, SourceBlock, BlockId } from "./source/span";

export type { LayoutDecisionTrace, TraceEvent } from "./trace";
export { createTraceRecorder } from "./trace";

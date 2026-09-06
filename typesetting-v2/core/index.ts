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
  LayoutWarning,
  LayoutError,
} from "./layout/schema";

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
} from "./units";

export type { RuleSetVersion, CharacterClass, CharacterClassId } from "./rules/characterClass";
export { DEFAULT_RULE_SET_V2 } from "./rules/defaultRuleSet";

export type { MeasurementFacts } from "./measurement/facts";
export { createFakeMeasurementProvider } from "./measurement/fakeProvider";

export type { PageCompositionSettings } from "./compose/page";

export type { GeometryTick } from "./geometry/tick";
export { mmToTicks } from "./geometry/tick";

export type { SourceSpan, SourceBlock, BlockId } from "./source/span";

export type { LayoutDecisionTrace, TraceEvent } from "./trace";
export { createTraceRecorder } from "./trace";

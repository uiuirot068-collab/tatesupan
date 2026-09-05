# TateSpun v2 — Core Data Model Candidate

- Status: **DOCUMENTATION ONLY — implementation candidate / contract-level schema, not production source.** P3-L02 frozen (2026-09-06, see Master §27). TypeScript-like pseudocode, discriminated-union style where useful. No source files created; no implementation begins here. Precision hardened at closeout: all canonical geometry fields use the `GeometryTick` type (1 tick = 0.001mm), not floating-point millimeters.
- Companion to `TATESPUN_V2_CORE_CONTRACT.md` — each shape below is explained in prose there; this file exists so a future Core Contract loop (P3-L03) has a concrete starting shape to react to, not to freeze exact field names.

```ts
// ---------- Canonical geometry precision (Contract §21, hardened at P3-L02 closeout) ----------

// 1 GeometryTick = 0.001 mm. All CANONICAL layout facts (coordinates, advances,
// extents, residual space) are integers in this unit — never floating-point mm.
// "12.345 mm" is a display/diagnostic formatting of a GeometryTick value, never
// canonical storage. Renderer-boundary conversion (tick -> CSS px, tick -> PDF pt)
// happens only at the Renderer's own paint boundary (Contract §28) and is never
// fed back as layout authority (INV-013, CORE_INVARIANTS.md).
type GeometryTick = number; // integer, 1 tick = 0.001mm

// ---------- Source model (Contract §4) ----------

type BlockId = string;

interface SourceSpan {
  blockId: BlockId;
  start: number; // Unicode code point offset, half-open range start
  end: number;   // Unicode code point offset, half-open range end
}

type SourceBlockKind = "BODY" | "COLOPHON";

interface SourceBlock {
  blockId: BlockId;
  kind: SourceBlockKind;
  normalizedText: string; // already Normalizer-processed
}

// ---------- Logical units (Contract §5) ----------

type LogicalUnit =
  | TextUnit
  | RubyUnit
  | TCYUnit
  | SemanticRunUnit
  | ManualBreakUnit
  | ImageUnit;

interface TextUnit {
  kind: "TEXT";
  span: SourceSpan;
  text: string; // grapheme-cluster-safe (Contract §6), not necessarily 1 char
}

// ---------- Ruby (Contract §9) ----------

type RubyKind = "ATOMIC" | "JUKUGO"; // group-ruby: CONTRACT GAP, treated as ATOMIC for now — §31

interface RubySegment {
  baseSpan: SourceSpan;
  readingSpan: SourceSpan;
}

interface RubyUnit {
  kind: "RUBY";
  span: SourceSpan;       // covers base + reading combined
  rubyKind: RubyKind;
  baseSpan: SourceSpan;
  readingSpan: SourceSpan;
  // JUKUGO only — ATOMIC ruby has no internal segmentation
  segments?: RubySegment[];
}

// ---------- TCY (Contract §10) ----------

interface TCYUnit {
  kind: "TCY";
  span: SourceSpan;
  displayText: string;
  logicalCells: number; // structural cell consumption, cl-30 atomic group
}

// ---------- Dash / Ellipsis (Contract §11) ----------

type SemanticRunKind = "DASH" | "ELLIPSIS" | "TWO_DOT_LEADER"; // jlreq cl-08 identities

interface SemanticRunUnit {
  kind: "SEMANTIC_RUN";
  span: SourceSpan;
  runKind: SemanticRunKind;
  length: number; // number of same-kind cl-08 characters in the run
  // deliberately NO pixel/x-y fields — visual alignment is Renderer-only (P3-O04/O05)
}

// ---------- Manual break (Contract §13) ----------

interface ManualBreakUnit {
  kind: "MANUAL_BREAK";
  span: SourceSpan; // covers the resolved 【改ページ】 marker
}

// ---------- Image (Contract §14) ----------

type ImagePlacement = "TOP" | "CENTER" | "BOTTOM" | "FULL";

interface ImageUnit {
  kind: "IMAGE";
  span: SourceSpan;
  refId: string;               // reference, never raw binary in this contract layer
  intrinsicWidth: GeometryTick;
  intrinsicHeight: GeometryTick;
  placement: ImagePlacement;
}

// ---------- Japanese character-class model (Contract §7) ----------

type CharacterClassId = `cl-${string}`; // "cl-01".."cl-30", jlreq numbering

interface CharacterClass {
  id: CharacterClassId;
  mayStartLine: boolean;
  mayEndLine: boolean;
  // cl-08 only: identity-keyed, not class-keyed (P3-L01 finding)
  inseparableGroupKey?: string;
}

interface RuleSetVersion {
  id: string; // versioned, referenced from VersionMetadata
  characterClasses: CharacterClass[];
  cl08PairRule: (a: SemanticRunKind, b: SemanticRunKind) => "INSEPARABLE" | "SEPARABLE";
  hangingPunctuationScope: CharacterClassId[]; // frozen: ["cl-06", "cl-07"]
  rubyOverhangAllowance: Map<CharacterClassId, GeometryTick>; // §9.1 — values OPEN, may be empty/zero
}

// ---------- Break opportunity / decision (Contract §8) ----------

type BreakOpportunityReason =
  | "ALLOWED"
  | "PROHIBITED_KINSOKU"
  | "PROHIBITED_GROUP"
  | "RUBY_INTERNAL_ALLOWED"
  | "RUBY_INTERNAL_PROHIBITED"
  | "MANUAL_FORCED";

interface BreakOpportunity {
  position: SourceSpan; // zero-width span at the candidate boundary
  reason: BreakOpportunityReason;
}

interface BreakDecision {
  opportunity: BreakOpportunity;
  taken: boolean;
  hangingApplied?: boolean;
  causedBy: "CAPACITY_REACHED" | "MANUAL_FORCE" | "HANGING_DEFERRAL";
}

// ---------- Measurement boundary (Contract §17) ----------

interface MeasurementFacts {
  providerId: string;
  providerVersion: string;
  naturalAdvanceTick: (fontRef: string, sizePt: number, char: string) => GeometryTick;
  rubyReadingExtentTick: (fontRef: string, sizePt: number, text: string) => GeometryTick;
  imageIntrinsicTick: (refId: string) => { width: GeometryTick; height: GeometryTick };
}

// ---------- Layout settings (Contract §16) ----------

// LayoutSettings is Product-facing input, authored/edited in mm (the
// documentation/display unit, Contract §21) — the Core converts these to
// GeometryTicks once, at ingestion, before any canonical computation begins.
// This is the one legitimate place a "*Mm" field remains; every canonical
// FACT computed from it downstream (PlacedUnit coordinates, extents,
// residual space) is a GeometryTick, never re-expressed as floating mm.
interface LayoutSettings {
  presetId: string;
  pageWidthMm: number;
  pageHeightMm: number;
  writingOrientation: "VERTICAL"; // Editor's own horizontal/vertical mode is out of Core scope (P3-O10)
  bodyFontRef: string;
  bodyFontSizePt: number;
  headerFooterFontRef?: string; // 柱/奥付, independently overridable — Master HD-005
  columns: number;
  marginsMm: { top: number; right: number; bottom: number; left: number };
  hangingPunctuationEnabled: boolean;
  rubyEnabled: boolean;
  rubyScale: number;
  naturalPitch: true; // Contract §18 — always true for the default composition mode;
                       // an alternate mode would be a distinct, explicitly-named settings variant
}

// ---------- Canonical layout hierarchy (Contract §20) ----------

interface PlacedUnit {
  id: string;
  sourceSpan: SourceSpan;
  xTick: GeometryTick;
  yTick: GeometryTick;
  hanging?: boolean;
  rubyBoundaryPolicy?: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN";
}

interface CanonicalLine {
  id: string;
  order: number;
  placedUnits: PlacedUnit[];
}

interface CanonicalColumn {
  id: string;
  order: number;
  lines: CanonicalLine[];
  residualSpaceTick: GeometryTick; // Contract §18 — Natural Pitch leftover, never silently absorbed
}

interface CanonicalPage {
  id: string;
  order: number;
  columns: CanonicalColumn[];
  folio?: PlacedUnit; // page-decoration layer, Contract §15
}

interface ColophonBlock {
  sourceBlockId: BlockId;
  pages: CanonicalPage[]; // its own page(s), not threaded through body columns/lines
}

interface VersionMetadata {
  coreSchemaVersion: string;
  ruleSetVersion: string;
  settingsVersion: string;
  measurementIdentity: string;
}

interface CanonicalDocument {
  pages: CanonicalPage[];
  colophon?: ColophonBlock;
  version: VersionMetadata;
  warnings: LayoutWarning[];
  errors: LayoutError[];
  hold: boolean; // Contract §26 — true if Publication approval must be withheld
  trace: LayoutDecisionTrace;
}

// ---------- Decision trace (Contract §23) ----------

interface TraceEvent {
  sourceSpan: SourceSpan;
  ruleApplied: string; // e.g. "cl-07 line-start prohibition" or "cl-23 jukugo internal break"
  alternativesConsidered: string[];
  outcome: string;
}

interface LayoutDecisionTrace {
  events: TraceEvent[];
}

// ---------- Warning / Error / Hold (Contract §26) ----------

interface LayoutWarning {
  sourceSpan: SourceSpan;
  message: string;
}

interface LayoutError {
  sourceSpan: SourceSpan;
  message: string;
  severity: "BLOCKS_HOLD" | "LOCAL_ONLY";
}
```

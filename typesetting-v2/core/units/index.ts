// LogicalUnit discriminated union (Contract §5, data model candidate).
// Only TextUnit is fully exercised by P3-L05 (see graphemeSafety.test.ts /
// index.test.ts) — the other five kinds are declared so later Loops extend
// this union rather than restructure it (P3-L06 rules data, P3-L07
// break-opportunity derivation, P3-L11 ruby, P3-L12 TCY/semantic runs,
// P3-L13 images all consume these types without changing their shape).

export type { TextUnit } from "./textUnit";
export type { RubyKind, RubySegment, RubyUnit } from "./rubyUnit";
export type { TCYUnit } from "./tcyUnit";
export type { SemanticRunKind, SemanticRunUnit } from "./semanticRunUnit";
export type { ManualBreakUnit } from "./manualBreakUnit";
export type { ImagePlacement, ImageUnit } from "./imageUnit";

import type { TextUnit } from "./textUnit";
import type { RubyUnit } from "./rubyUnit";
import type { TCYUnit } from "./tcyUnit";
import type { SemanticRunUnit } from "./semanticRunUnit";
import type { ManualBreakUnit } from "./manualBreakUnit";
import type { ImageUnit } from "./imageUnit";

export type LogicalUnit =
  | TextUnit
  | RubyUnit
  | TCYUnit
  | SemanticRunUnit
  | ManualBreakUnit
  | ImageUnit;

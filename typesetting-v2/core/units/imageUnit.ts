import type { GeometryTick } from "../geometry/tick";
import type { SourceSpan } from "../source/span";

export type ImagePlacement = "TOP" | "CENTER" | "BOTTOM" | "FULL";

// Contract §14. `refId` is a reference, never raw binary, at this contract
// layer (Master §12.1 privacy contract). Decode/paint is Renderer-only.
export interface ImageUnit {
  kind: "IMAGE";
  span: SourceSpan;
  refId: string;
  intrinsicWidth: GeometryTick;
  intrinsicHeight: GeometryTick;
  placement: ImagePlacement;
}

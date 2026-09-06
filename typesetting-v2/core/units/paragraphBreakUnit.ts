import type { SourceSpan } from "../source/span";

// A manuscript bare line-ending that ends the current paragraph (Human
// Product Decision B, `qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md`).
// Distinct from ManualBreakUnit (§13, an explicit 【改ページ】 command that
// forces a PAGE/column close): a PARAGRAPH_BREAK forces only the current
// LINE to end — ordinary column/page flow continues normally afterward.
//
// `span` covers the actual source line-ending characters — 1 code point for
// a bare `\n`, 2 for `\r\n` (recognition/normalization of which raw
// character sequence this is stays Normalizer-owned, per Contract §12.1;
// this unit represents an already-recognized, unambiguous break, mirroring
// ManualBreakUnit's own "already-resolved marker" convention). Non-zero
// width, not a zero-width marker: this preserves the newline's own source
// range for mapping purposes (no source content is silently discarded),
// exactly like production's own 【改ページ】 marker (which has real source
// width but zero pagination cost — see ManualBreakUnit/tokenLength).
export interface ParagraphBreakUnit {
  kind: "PARAGRAPH_BREAK";
  span: SourceSpan;
}

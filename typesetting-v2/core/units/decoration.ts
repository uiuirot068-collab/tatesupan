// Inline decoration metadata (post-beta typography Phase 1, 傍点).
//
// Carried as an OPTIONAL field on the content-bearing units (TEXT / RUBY /
// TCY / SEMANTIC_RUN). Composition never reads it: a decorated unit has
// exactly the same span, advance, break opportunities and placement as an
// undecorated one — decoration is a paint-time fact only (Preview and
// Publication paint models read it back from the owning unit, the same
// read-only convention ruby readings already use). Absent == no decoration,
// so every pre-existing unit literal keeps its exact meaning.
//
// Phase 1 ships one emphasis mark (black dot). Further vertical decorations
// (sesame / open dot / side line) extend this interface rather than adding
// new unit kinds.
export type EmphasisMarkKind = "DOT";

export interface InlineDecoration {
  emphasis?: EmphasisMarkKind;
}

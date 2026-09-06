// Colophon (奥付) as a distinct CanonicalDocument-level element (Core
// Contract §15, Master HD-006). A ColophonBlock has its own page(s) and is
// never threaded through body CanonicalColumn/CanonicalLine — this is
// enforced by construction here: composeColophon takes only pages already
// produced by an entirely separate compose/page.ts run over the colophon's
// own SourceBlock, and nothing in this module's signature can accept or
// return a body CanonicalColumn/CanonicalLine at all. Mirrors, rather than
// undoes, the existing TSP-LOOP-005 colophon flow-isolation precedent.

import type { BlockId } from "../source/span";
import type { CanonicalPage, ColophonBlock } from "../layout/schema";

export function composeColophon(sourceBlockId: BlockId, pages: CanonicalPage[]): ColophonBlock {
  return { sourceBlockId, pages };
}

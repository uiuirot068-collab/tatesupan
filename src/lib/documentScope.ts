/**
 * Document-scoped async guard (Phase 6 editor state audit).
 *
 * TategakiEditor is NOT remounted when the open document changes: the
 * `/editor` route keeps the same component while `?id=` / `?cloudId=` /
 * `?demo=` change, and 保存作品一覧 swaps a cloud project into the same state
 * in place. An async flow started for document A (cloud save, image
 * replacement, TXT/DOCX import) can therefore resolve after document B is
 * open, and must not write A's result into B's state.
 *
 * The load effect has its own `cancelled` flag; this covers the event-handler
 * flows, which have no effect cleanup to cancel them. `advance()` is called
 * exactly where the open document changes; a flow `capture()`s before its
 * first await and checks the returned predicate before every state write.
 * See docs/TATESPUN_EDITOR_STATE_ARCHITECTURE.md §8.
 */
export class DocumentEpoch {
  private epoch = 0;

  /** The open document changed: every earlier capture becomes stale. */
  advance(): void {
    this.epoch += 1;
  }

  /** True only while the document that was open at capture time is still open. */
  capture(): () => boolean {
    const at = this.epoch;
    return () => this.epoch === at;
  }
}

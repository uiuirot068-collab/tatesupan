/**
 * Phase 6.1: drag gestures (the editor/preview divider, the Preview pan)
 * disable text selection on <body> while they run. If the component unmounts
 * mid-drag the mouseup handler never runs, so the lock must be released by
 * the component's cleanup too. `lockUserSelect` remembers the value it
 * replaced and returns an idempotent release that restores exactly that value.
 */
export function lockUserSelect(style: { userSelect: string }): () => void {
  const previous = style.userSelect;
  style.userSelect = "none";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    style.userSelect = previous;
  };
}

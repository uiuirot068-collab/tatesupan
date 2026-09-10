/** Empty selection means every page; otherwise return valid pages in book order. */
export function resolveJpgPageIndices(
  pageCount: number,
  selectedIndices: Iterable<number>
): number[] {
  const all = Array.from({ length: Math.max(0, pageCount) }, (_, index) => index);
  const selected = Array.from(new Set(selectedIndices))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < pageCount)
    .sort((a, b) => a - b);
  return selected.length === 0 ? all : selected;
}

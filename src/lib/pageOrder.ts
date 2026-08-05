/**
 * Shifts every selected index by one slot in `direction`, swapping past
 * unselected neighbors. Blocked items (whose neighbor in `direction` is the
 * array boundary) stay put. Selection indices are updated to follow the move.
 */
export function moveSelected<T>(
  items: T[],
  selected: ReadonlySet<number>,
  direction: -1 | 1
): { items: T[]; selected: Set<number> } {
  const arr = [...items];
  const sel = new Set(selected);
  const order = [...sel].sort((a, b) => (direction < 0 ? a - b : b - a));

  for (const i of order) {
    const j = i + direction;
    if (j < 0 || j >= arr.length || sel.has(j)) continue;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    sel.delete(i);
    sel.add(j);
  }

  return { items: arr, selected: sel };
}

/**
 * Moves the items at `movingIndices` (kept in their original relative order)
 * so the block sits immediately before whatever item currently sits at
 * `dropIndex`. Pass `items.length` as `dropIndex` to move the block to the end.
 */
export function reorderByDrag<T>(
  items: T[],
  movingIndices: ReadonlySet<number>,
  dropIndex: number
): T[] {
  const moving: T[] = [];
  const rest: T[] = [];
  const restOriginalIndices: number[] = [];

  items.forEach((item, i) => {
    if (movingIndices.has(i)) {
      moving.push(item);
    } else {
      rest.push(item);
      restOriginalIndices.push(i);
    }
  });

  if (moving.length === 0) return items;

  let insertAt = restOriginalIndices.findIndex((idx) => idx >= dropIndex);
  if (insertAt === -1) insertAt = rest.length;

  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
}

/** Range-select helper for shift-click: all indices between `from` and `to`, inclusive. */
export function rangeIndices(from: number, to: number): number[] {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}

/**
 * 面付け (imposition) grouping for 見開き (spread) preview: page 1 (奇数
 * ページ始まり) stands alone as a lone recto page, then every following pair
 * of pages forms a spread — (2,3), (4,5), (6,7), ... — so each pair lands on
 * the correct verso/recto (even/odd) sides. A trailing unpaired page (when
 * the total page count is even) is returned as its own single-item group.
 */
export function computeSpreadGroups(pageCount: number): number[][] {
  if (pageCount === 0) return [];
  const groups: number[][] = [[0]];
  for (let i = 1; i < pageCount; i += 2) {
    groups.push(i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return groups;
}

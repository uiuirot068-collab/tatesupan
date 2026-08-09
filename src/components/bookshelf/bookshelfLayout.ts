export const BOOK_GAP = 8;
export const BOOKS_SIDE_PADDING = 34;
export const MAX_BOOKS_PER_SHELF = 8;
export const GUIDE_BOOK_WIDTH = 46;

const RACK_SCALE = 0.6;
const RACK_OVERLAP = 0.75;
const RACK_RENDERED_OVERLAP = 1;
const RACK_END_WIDTH = 122.262;
const RACK_CENTER_WIDTH = 117.27;
const BOOKS_SIDE_SPACE = 70;
const RACK_MIN_WIDTH = 215.576;

export type BookWidth = 40 | 46 | 52 | 60 | 70;

export const MAX_VISIBLE_SPINE_TITLE_LENGTH = 7;

export function truncateSpineTitle(title: string): string {
  const characters = Array.from(title);
  if (characters.length <= MAX_VISIBLE_SPINE_TITLE_LENGTH) return title;
  return `${characters.slice(0, MAX_VISIBLE_SPINE_TITLE_LENGTH - 1).join("")}…`;
}

export function bookWidthForCharacterCount(characterCount: number): BookWidth {
  if (characterCount <= 1_000) return 40;
  if (characterCount <= 10_000) return 46;
  if (characterCount <= 30_000) return 52;
  if (characterCount <= 80_000) return 60;
  return 70;
}

export interface ShelfBook<T> {
  item: T;
  width: number;
}

function shelfMetricsForCenterCount(centerCount: number) {
  const rackSegmentCount = centerCount + 2;
  const shelfWidth =
    (RACK_END_WIDTH * 2 + RACK_CENTER_WIDTH * centerCount) * RACK_SCALE -
    RACK_OVERLAP * (rackSegmentCount - 1);
  return { centerCount, shelfWidth };
}

/** Matches the actual flex row, whose adjacent rendered SVGs overlap by 1px. */
export function shelfFrontLipWidth(centerCount: number): number {
  const rackSegmentCount = centerCount + 2;
  const renderedWidth =
    (RACK_END_WIDTH * 2 + RACK_CENTER_WIDTH * centerCount) * RACK_SCALE -
    RACK_RENDERED_OVERLAP * (rackSegmentCount - 1);
  return Math.max(RACK_MIN_WIDTH, renderedWidth);
}

export function shelfMetricsForContentWidth(contentWidth: number) {
  const scaledCenterWidth = RACK_CENTER_WIDTH * RACK_SCALE;
  const centerCount = Math.max(
    1,
    Math.ceil((contentWidth - BOOKS_SIDE_SPACE) / scaledCenterWidth),
  );
  return shelfMetricsForCenterCount(centerCount);
}

export function shelfMetricsForAvailableWidth(availableWidth: number) {
  let best = shelfMetricsForCenterCount(1);
  for (let centerCount = 2; centerCount <= 100; centerCount += 1) {
    const candidate = shelfMetricsForCenterCount(centerCount);
    if (candidate.shelfWidth > availableWidth) break;
    best = candidate;
  }
  return best;
}

export function packShelfBooks<T>(
  books: ShelfBook<T>[],
  availableWidth: number,
): ShelfBook<T>[][] {
  const usableWidth = Math.max(0, availableWidth - BOOKS_SIDE_PADDING * 2);
  const shelves: ShelfBook<T>[][] = [];
  let row: ShelfBook<T>[] = [];
  let rowWidth = 0;

  for (const book of books) {
    const nextWidth = rowWidth + (row.length > 0 ? BOOK_GAP : 0) + book.width;
    if (
      row.length > 0 &&
      (row.length >= MAX_BOOKS_PER_SHELF ||
        nextWidth > usableWidth ||
        shelfMetricsForContentWidth(nextWidth).shelfWidth > availableWidth)
    ) {
      shelves.push(row);
      row = [];
      rowWidth = 0;
    }

    rowWidth += (row.length > 0 ? BOOK_GAP : 0) + book.width;
    row.push(book);
  }

  if (row.length > 0) shelves.push(row);
  return shelves;
}

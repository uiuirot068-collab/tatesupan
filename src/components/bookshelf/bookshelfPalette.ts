export const BOOK_PALETTE_SIZE = 5;

/** Stable FNV-1a hash. Book IDs are persisted, so this survives reloads. */
export function stableBookHash(id: string): number {
  let hash = 0x811c9dc5;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface PaletteBook {
  key: string;
  isSample: boolean;
}

/**
 * Gives every regular book an ID-derived base color. Only a would-be third
 * identical color is adjusted, using the same book's hash for the fallback.
 * Samples do not consume a palette position and receive -1 (gold elsewhere).
 */
export function assignBookPaletteIndices<T extends PaletteBook>(
  books: T[],
): Array<T & { paletteIndex: number }> {
  const recentColors: number[] = [];

  return books.map((book) => {
    if (book.isSample) return { ...book, paletteIndex: -1 };

    const hash = stableBookHash(book.key);
    const baseColor = hash % BOOK_PALETTE_SIZE;
    const wouldMakeThree =
      recentColors.at(-1) === baseColor && recentColors.at(-2) === baseColor;
    const fallbackOffset = 1 + ((hash >>> 8) % (BOOK_PALETTE_SIZE - 1));
    const paletteIndex = wouldMakeThree
      ? (baseColor + fallbackOffset) % BOOK_PALETTE_SIZE
      : baseColor;

    recentColors.push(paletteIndex);
    return { ...book, paletteIndex };
  });
}

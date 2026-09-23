/**
 * TSP-B4 (Revision 3) — local pronunciation dictionary.
 *
 * Corrects how 音読β SPEAKS a word without ever changing the manuscript text itself. Priority when
 * building speech (see `readAloud.ts`'s `buildSpeechText`):
 *   1. explicit ruby (｜漢字《かんじ》) — always wins, never touched here;
 *   2. this dictionary, applied only to plain TEXT runs;
 *   3. the browser/device voice's own default reading for anything left over.
 * One browser/device-local dictionary shared across manuscripts (no account sync, no Supabase, no
 * per-project data, no external dictionary service) — same storage model as 文章チェックβ's
 * existing わたしの辞書 (`useWritingCheckDictionary.ts`). Never sent anywhere; not part of the
 * manuscript, an export, or the B3 feedback payload.
 */

export interface PronunciationEntry {
  id: string;
  /** The manuscript text this entry corrects (e.g. "人気"). */
  surface: string;
  /** The reading 音読β should speak instead (e.g. "ひとけ"). */
  reading: string;
}

/**
 * A reading must be phonetic kana (plus the long-vowel mark ー) — the browser's speech engine needs
 * something it can actually pronounce, not another kanji spelling or Latin letters.
 */
const READING_PATTERN = /^[ぁ-んァ-ヴー]+$/u;

export function isValidPronunciationReading(reading: string): boolean {
  return READING_PATTERN.test(reading.trim());
}

export function makePronunciationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pron-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Adds a new entry, or — when `surface` (trimmed) already matches an existing entry exactly —
 * updates that entry's reading instead of creating a duplicate (upsert; "duplicate surface" is
 * therefore never an ambiguous state). An empty surface or an invalid reading is rejected: the
 * list is returned unchanged (still a new array reference, so callers can always `setEntries(...)`
 * safely; equality checks should compare contents, not identity).
 */
export function upsertPronunciationEntry(
  entries: readonly PronunciationEntry[],
  surface: string,
  reading: string,
): PronunciationEntry[] {
  const trimmedSurface = surface.trim();
  const trimmedReading = reading.trim();
  if (!trimmedSurface || !isValidPronunciationReading(trimmedReading)) return [...entries];
  const existing = entries.find((entry) => entry.surface === trimmedSurface);
  if (existing) {
    return entries.map((entry) => (entry.id === existing.id ? { ...entry, reading: trimmedReading } : entry));
  }
  return [...entries, { id: makePronunciationId(), surface: trimmedSurface, reading: trimmedReading }];
}

export function removePronunciationEntry(entries: readonly PronunciationEntry[], id: string): PronunciationEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** One matcher for the whole list: surfaces sorted longest-first, so a longer entry wins at any position where two overlap. */
export function buildPronunciationMatcher(entries: readonly PronunciationEntry[]): RegExp | null {
  const surfaces = [...new Set(entries.map((entry) => entry.surface).filter((surface) => surface.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  if (surfaces.length === 0) return null;
  return new RegExp(surfaces.map(escapeRegExp).join("|"), "gu");
}

/**
 * Replaces every dictionary surface found in `text` with its reading. Regex alternation tries
 * longer surfaces first at each position (so "東京都" wins over "東京" where both would match), and
 * a left-to-right non-overlapping scan means an entry that already matched consumes its
 * characters, so a shorter entry starting inside it never double-fires. Punctuation, spacing and
 * everything not matched by an entry passes through unchanged.
 *
 * Callers pass this only PLAIN TEXT speech runs (see `readAloud.ts`) — never a ruby reading or a
 * 縦中横 value — so an explicit ｜漢字《かんじ》 always keeps its own reading regardless of what the
 * dictionary contains for the same characters.
 */
export function applyPronunciationDictionary(text: string, entries: readonly PronunciationEntry[]): string {
  const matcher = buildPronunciationMatcher(entries);
  if (!matcher) return text;
  const bySurface = new Map(entries.map((entry) => [entry.surface, entry.reading]));
  return text.replace(matcher, (matched) => bySurface.get(matched) ?? matched);
}

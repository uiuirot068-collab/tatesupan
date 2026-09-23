/**
 * TSP-B4 音読β / リズム確認 — pure text + voice model (no React, no DOM, no network).
 *
 * The manuscript is a plain string with inline notation (ruby, tate-chu-yoko,
 * 挿絵 / 改ページ markers). Reading it aloud must not speak that notation, so the
 * text handed to the device's speech engine is derived from the app's own
 * tokenizer: ruby is read as its reading (rt), 縦中横 as its characters, 挿絵 is
 * skipped and a 改ページ becomes a pause (paragraph break).
 *
 * Nothing here talks to a speech engine; see `readAloudEngine.ts`. Nothing here
 * sends text anywhere. The text only ever reaches `SpeechSynthesisUtterance`.
 */
import { tokenizeTategakiWithOffsets } from "./tategaki";
import { applyPronunciationDictionary, type PronunciationEntry } from "./readAloudPronunciation";

export type ReadAloudMode = "selection" | "paragraph" | "full";

export interface ReadAloudRange {
  readonly start: number;
  readonly end: number;
}

export const READ_ALOUD_MODE_LABELS: Record<ReadAloudMode, string> = {
  selection: "選択範囲を読む",
  paragraph: "現在の段落を読む",
  full: "全文を読む",
};

/** Shown when a mode has nothing to read. Wording explains the fix, never blames the writer. */
export const READ_ALOUD_EMPTY_NOTICES: Record<ReadAloudMode, string> = {
  selection: "読みたい範囲を原稿で選んでから押してください。",
  paragraph: "カーソルのある段落に読める文字がありません。文章の途中にカーソルを置いてください。",
  full: "原稿がまだ空です。",
};

/**
 * The [start, end) of the paragraph (= one line; a manuscript paragraph ends at a
 * newline) that contains `caret`. A caret at the very end of a line belongs to
 * that line, matching how a writer thinks of "the paragraph I am in".
 */
export function paragraphRangeAt(source: string, caret: number): ReadAloudRange {
  const at = Math.max(0, Math.min(caret, source.length));
  const start = at === 0 ? 0 : source.lastIndexOf("\n", at - 1) + 1;
  const newline = source.indexOf("\n", at);
  return { start, end: newline === -1 ? source.length : newline };
}

/**
 * Speakable text for the manuscript, optionally limited to `range` (raw source
 * offsets). A notation token the range only partially covers is included whole
 * (never a half-spoken `｜漢字《かん`), while plain text is cut exactly at the range.
 *
 * `pronunciation` (optional, browser-local — see `readAloudPronunciation.ts`) is applied ONLY to
 * plain `text` runs, after the range cut. Ruby (`case "ruby"`, below) and 縦中横 always keep their
 * own reading/value regardless of the dictionary, so an explicit ｜漢字《かんじ》 in the manuscript
 * can never be overridden by a dictionary entry for the same characters.
 */
export function buildSpeechText(source: string, range?: ReadAloudRange, pronunciation?: readonly PronunciationEntry[]): string {
  let out = "";
  for (const { token, start, end } of tokenizeTategakiWithOffsets(source)) {
    if (range && (end <= range.start || start >= range.end)) continue;
    switch (token.type) {
      case "text": {
        const from = range ? Math.max(range.start, start) - start : 0;
        const to = range ? Math.min(range.end, end) - start : token.value.length;
        const slice = token.value.slice(from, to);
        out += pronunciation && pronunciation.length > 0 ? applyPronunciationDictionary(slice, pronunciation) : slice;
        break;
      }
      case "ruby":
        out += token.rt;
        break;
      case "tcy":
        out += token.value;
        break;
      case "pageBreak":
        out += "\n";
        break;
      case "image":
        break;
    }
  }
  return out;
}

/** Source range a mode reads. `selection` is the raw editor selection, `paragraph` is derived from its caret. */
export function resolveReadAloudRange(
  mode: ReadAloudMode,
  source: string,
  selection: ReadAloudRange,
): ReadAloudRange | undefined {
  if (mode === "full") return undefined;
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  if (mode === "selection") return { start, end };
  return paragraphRangeAt(source, start);
}

const SENTENCE_END = /[。！？!?…]+[」』）)”’】]*/g;
/** A sentence longer than this is cut at a 読点 (or hard-cut) so a single utterance stays short and reliable. */
export const READ_ALOUD_MAX_CHUNK_CHARS = 160;

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= READ_ALOUD_MAX_CHUNK_CHARS) return [sentence];
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > READ_ALOUD_MAX_CHUNK_CHARS) {
    const window = rest.slice(0, READ_ALOUD_MAX_CHUNK_CHARS);
    const cut = Math.max(window.lastIndexOf("、"), window.lastIndexOf("，"), window.lastIndexOf(","));
    const at = cut > 0 ? cut + 1 : READ_ALOUD_MAX_CHUNK_CHARS;
    pieces.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Sentence-sized utterances. Splitting at 。！？ and line ends keeps the natural
 * pause the writer's own punctuation asks for, which is the very thing being
 * checked; blank / whitespace-only pieces are dropped.
 */
export function splitSpeechChunks(text: string): string[] {
  const chunks: string[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    let last = 0;
    const sentences: string[] = [];
    for (const match of line.matchAll(SENTENCE_END)) {
      const end = (match.index ?? 0) + match[0].length;
      sentences.push(line.slice(last, end));
      last = end;
    }
    if (last < line.length) sentences.push(line.slice(last));
    for (const sentence of sentences) {
      for (const piece of splitLongSentence(sentence)) {
        if (piece.trim() !== "") chunks.push(piece.trim());
      }
    }
  }
  return chunks;
}

/** Chunks for a mode, or `[]` when there is nothing to read (the caller shows `READ_ALOUD_EMPTY_NOTICES`). */
export function buildReadAloudChunks(
  mode: ReadAloudMode,
  source: string,
  selection: ReadAloudRange,
  pronunciation?: readonly PronunciationEntry[],
): string[] {
  const range = resolveReadAloudRange(mode, source, selection);
  return splitSpeechChunks(buildSpeechText(source, range, pronunciation));
}

// ---------------------------------------------------------------- speed

export const READ_ALOUD_RATE_MIN = 0.5;
export const READ_ALOUD_RATE_MAX = 2;
export const READ_ALOUD_RATE_STEP = 0.1;
export const READ_ALOUD_RATE_DEFAULT = 1;

export function clampReadAloudRate(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : READ_ALOUD_RATE_DEFAULT;
  const clamped = Math.min(READ_ALOUD_RATE_MAX, Math.max(READ_ALOUD_RATE_MIN, n));
  return Math.round(clamped * 10) / 10;
}

export function formatReadAloudRate(rate: number): string {
  return `×${clampReadAloudRate(rate).toFixed(1)}`;
}

// ---------------------------------------------------------------- voices

/** The slice of `SpeechSynthesisVoice` this model reads (real voices and test stubs both fit). */
export interface ReadAloudVoiceLike {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
}

export const isJapaneseVoice = (voice: Pick<ReadAloudVoiceLike, "lang">): boolean =>
  /^ja([-_]|$)/i.test(voice.lang.trim());

export interface ReadAloudVoiceChoice<V extends ReadAloudVoiceLike> {
  /** Japanese voices that run on this device: the default pool. */
  readonly local: V[];
  /** Japanese voices the browser may serve from the network. Never picked automatically. */
  readonly online: V[];
  /** The voice to speak with, or null = do not speak (no on-device Japanese voice and no explicit choice). */
  readonly selected: V | null;
  /** True when `selected` is an online voice the writer chose explicitly. */
  readonly selectedIsOnline: boolean;
}

/**
 * PRIVACY RULE: the manuscript is only ever handed to an on-device Japanese voice
 * unless the writer explicitly picked an online voice from the selector. With
 * neither, no voice is returned and nothing is spoken — the engine is never
 * allowed to fall back to "whatever the browser's default voice is", because
 * that default can be a cloud voice.
 */
export function chooseReadAloudVoice<V extends ReadAloudVoiceLike>(
  voices: readonly V[],
  preferredVoiceURI: string | null,
): ReadAloudVoiceChoice<V> {
  const japanese = voices.filter(isJapaneseVoice);
  const local = japanese.filter((voice) => voice.localService);
  const online = japanese.filter((voice) => !voice.localService);
  const preferred = preferredVoiceURI ? japanese.find((voice) => voice.voiceURI === preferredVoiceURI) : undefined;
  const selected = preferred ?? local[0] ?? null;
  return { local, online, selected, selectedIsOnline: !!selected && !selected.localService };
}

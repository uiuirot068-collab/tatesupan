import { describe, expect, it } from "vitest";
import {
  READ_ALOUD_MAX_CHUNK_CHARS,
  READ_ALOUD_RATE_DEFAULT,
  buildReadAloudChunks,
  buildSpeechText,
  chooseReadAloudVoice,
  clampReadAloudRate,
  formatReadAloudRate,
  isJapaneseVoice,
  paragraphRangeAt,
  resolveReadAloudRange,
  splitSpeechChunks,
  type ReadAloudVoiceLike,
} from "./readAloud";
import type { PronunciationEntry } from "./readAloudPronunciation";

const pron = (surface: string, reading: string): PronunciationEntry => ({ id: surface, surface, reading });

const voice = (voiceURI: string, lang: string, localService: boolean): ReadAloudVoiceLike => ({
  voiceURI,
  name: voiceURI,
  lang,
  localService,
});

describe("B4 speech text (notation is never spoken)", () => {
  it("reads ruby as its reading, in both the ｜ form and the bare-kanji form", () => {
    expect(buildSpeechText("｜宇宙《そら》を見た")).toBe("そらを見た");
    expect(buildSpeechText("漢字《かんじ》を書く")).toBe("かんじを書く");
    expect(buildSpeechText("|宇宙《そら》へ")).toBe("そらへ");
  });

  it("reads 縦中横 as its characters, skips 挿絵 markers, and turns 改ページ into a pause", () => {
    expect(buildSpeechText("[tate]A5[/tate]判")).toBe("A5判");
    expect(buildSpeechText("12月")).toBe("12月");
    expect(buildSpeechText("前【IMG:abc:10:20:top】後")).toBe("前後");
    expect(splitSpeechChunks(buildSpeechText("一章\n【改ページ】\n二章"))).toEqual(["一章", "二章"]);
    expect(buildSpeechText("一章\n【改ページ】\n二章")).toMatch(/^一章\n+二章$/);
    expect(buildSpeechText("一章\n【改ページ】\n二章")).not.toContain("改ページ");
  });

  it("keeps plain text, punctuation and blank lines untouched", () => {
    expect(buildSpeechText("「はい」、と彼は言った。\n\n次の段落。")).toBe("「はい」、と彼は言った。\n\n次の段落。");
    expect(buildSpeechText("")).toBe("");
  });

  it("cuts plain text exactly at a range but never speaks half a notation token", () => {
    const source = "あいう｜宇宙《そら》えお";
    // range ends inside the ruby token -> the whole token is read
    expect(buildSpeechText(source, { start: 1, end: 6 })).toBe("いうそら");
    // range that only touches the middle of plain text
    expect(buildSpeechText("あいうえお", { start: 1, end: 3 })).toBe("いう");
    // range covering only the ruby base characters still reads the reading, never the raw notation
    const partial = buildSpeechText(source, { start: 4, end: 5 });
    expect(partial).toBe("そら");
    expect(partial).not.toMatch(/[｜《》]/);
  });
});

describe("B4 paragraph / selection / full ranges", () => {
  const source = "一行目です。\n二行目です。\n\n四行目です。";

  it("finds the paragraph (line) that holds the caret, including the caret at its very end and start", () => {
    expect(paragraphRangeAt(source, 0)).toEqual({ start: 0, end: 6 });
    expect(paragraphRangeAt(source, 3)).toEqual({ start: 0, end: 6 });
    expect(paragraphRangeAt(source, 6)).toEqual({ start: 0, end: 6 }); // caret at the end of line 1
    expect(paragraphRangeAt(source, 7)).toEqual({ start: 7, end: 13 });
    expect(paragraphRangeAt(source, 13)).toEqual({ start: 7, end: 13 });
    expect(paragraphRangeAt(source, 14)).toEqual({ start: 14, end: 14 }); // blank line
    expect(paragraphRangeAt(source, 20)).toEqual({ start: 15, end: source.length });
    expect(paragraphRangeAt(source, 9999)).toEqual({ start: 15, end: source.length });
    expect(paragraphRangeAt("\nabc", 0)).toEqual({ start: 0, end: 0 });
  });

  it("resolves each mode from the same selection object", () => {
    expect(resolveReadAloudRange("full", source, { start: 3, end: 5 })).toBeUndefined();
    expect(resolveReadAloudRange("selection", source, { start: 5, end: 3 })).toEqual({ start: 3, end: 5 }); // backwards selection
    expect(resolveReadAloudRange("paragraph", source, { start: 9, end: 9 })).toEqual({ start: 7, end: 13 });
    // a selection spanning paragraphs: "現在の段落" is the paragraph at the selection start
    expect(resolveReadAloudRange("paragraph", source, { start: 9, end: 20 })).toEqual({ start: 7, end: 13 });
  });

  it("builds the right chunks for selection, paragraph and full", () => {
    expect(buildReadAloudChunks("selection", source, { start: 7, end: 13 })).toEqual(["二行目です。"]);
    expect(buildReadAloudChunks("paragraph", source, { start: 9, end: 9 })).toEqual(["二行目です。"]);
    expect(buildReadAloudChunks("full", source, { start: 9, end: 9 })).toEqual(["一行目です。", "二行目です。", "四行目です。"]);
  });

  it("returns nothing to read for an empty selection, a blank paragraph or an empty manuscript", () => {
    expect(buildReadAloudChunks("selection", source, { start: 4, end: 4 })).toEqual([]);
    expect(buildReadAloudChunks("paragraph", source, { start: 14, end: 14 })).toEqual([]);
    expect(buildReadAloudChunks("full", "", { start: 0, end: 0 })).toEqual([]);
    expect(buildReadAloudChunks("paragraph", "【改ページ】", { start: 0, end: 0 })).toEqual([]);
  });
});

describe("B4 chunking keeps the writer's own pauses", () => {
  it("splits at sentence ends (with trailing closing brackets) and line ends, dropping blanks", () => {
    expect(splitSpeechChunks("彼は言った。「行こう！」そして歩いた。\n\n静かだった")).toEqual([
      "彼は言った。",
      "「行こう！」",
      "そして歩いた。",
      "静かだった",
    ]);
    expect(splitSpeechChunks("   \n\n")).toEqual([]);
  });

  it("cuts an over-long sentence at 読点 and never exceeds the chunk cap", () => {
    const clause = "あ".repeat(50) + "、";
    const long = clause.repeat(6) + "終わり。";
    const chunks = splitSpeechChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(READ_ALOUD_MAX_CHUNK_CHARS);
    expect(chunks.join("")).toBe(long); // nothing lost, nothing added
    const noBreak = "い".repeat(500);
    expect(splitSpeechChunks(noBreak).join("")).toBe(noBreak);
  });
});

describe("B4 speed", () => {
  it("clamps to 0.5–2.0 in 0.1 steps and falls back to 1.0", () => {
    expect(clampReadAloudRate(0.1)).toBe(0.5);
    expect(clampReadAloudRate(9)).toBe(2);
    expect(clampReadAloudRate(1.26)).toBe(1.3);
    expect(clampReadAloudRate("fast")).toBe(READ_ALOUD_RATE_DEFAULT);
    expect(clampReadAloudRate(NaN)).toBe(READ_ALOUD_RATE_DEFAULT);
    expect(formatReadAloudRate(1)).toBe("×1.0");
    expect(formatReadAloudRate(1.55)).toBe("×1.6");
  });
});

describe("B4 voice choice (privacy: on-device unless explicitly chosen)", () => {
  const localJa = voice("local-ja", "ja-JP", true);
  const onlineJa = voice("online-ja", "ja-JP", false);
  const localEn = voice("local-en", "en-US", true);

  it("recognises Japanese language tags in the shapes browsers use", () => {
    for (const lang of ["ja", "ja-JP", "ja_JP", "JA-jp"]) expect(isJapaneseVoice({ lang })).toBe(true);
    for (const lang of ["en-US", "jav-ID", "", "zh-CN"]) expect(isJapaneseVoice({ lang })).toBe(false);
  });

  it("picks the first on-device Japanese voice and lists online ones separately", () => {
    const choice = chooseReadAloudVoice([localEn, onlineJa, localJa], null);
    expect(choice.selected).toBe(localJa);
    expect(choice.selectedIsOnline).toBe(false);
    expect(choice.local).toEqual([localJa]);
    expect(choice.online).toEqual([onlineJa]);
  });

  it("NEVER falls back to an online or non-Japanese voice on its own", () => {
    expect(chooseReadAloudVoice([onlineJa], null).selected).toBeNull();
    expect(chooseReadAloudVoice([localEn], null).selected).toBeNull();
    expect(chooseReadAloudVoice([], null).selected).toBeNull();
  });

  it("uses an online voice only when the writer picked it explicitly, and flags it", () => {
    const choice = chooseReadAloudVoice([localJa, onlineJa], "online-ja");
    expect(choice.selected).toBe(onlineJa);
    expect(choice.selectedIsOnline).toBe(true);
    // a stale / unknown / non-Japanese preference falls back to the automatic on-device voice
    expect(chooseReadAloudVoice([localJa, onlineJa], "gone").selected).toBe(localJa);
    expect(chooseReadAloudVoice([localJa, localEn], "local-en").selected).toBe(localJa);
  });
});

describe("B4 (Revision 3) pronunciation priority: ruby > dictionary > browser default", () => {
  it("with no dictionary, plain text is unchanged (browser default reading applies)", () => {
    expect(buildSpeechText("人気がない。")).toBe("人気がない。");
  });

  it("applies the dictionary to plain text", () => {
    expect(buildSpeechText("人気がない。", undefined, [pron("人気", "ひとけ")])).toBe("ひとけがない。");
  });

  it("an explicit ruby reading ALWAYS wins over a dictionary entry for the same characters -- the dictionary is never even consulted for ruby", () => {
    const withRuby = "｜人気《にんき》がない。";
    expect(buildSpeechText(withRuby, undefined, [pron("人気", "ひとけ")])).toBe("にんきがない。");
    expect(buildSpeechText(withRuby)).toBe("にんきがない。"); // same result without the dictionary at all
  });

  it("the dictionary still applies to plain text elsewhere in the same sentence as a ruby", () => {
    const text = "｜人気《にんき》のある大分に行く。";
    expect(buildSpeechText(text, undefined, [pron("人気", "ひとけ"), pron("大分", "おおいた")])).toBe("にんきのあるおおいたに行く。");
  });

  it("縦中横 keeps its own value regardless of the dictionary (not a text run either)", () => {
    expect(buildSpeechText("[tate]12[/tate]月", undefined, [pron("12", "じゅうに")])).toBe("12月");
  });

  it("applies within a partial (selection/paragraph) range exactly as it would to the full text", () => {
    const text = "人気がない。大分に行く。";
    const range = { start: 0, end: "人気がない。".length };
    expect(buildSpeechText(text, range, [pron("人気", "ひとけ"), pron("大分", "おおいた")])).toBe("ひとけがない。");
  });

  it("reaches buildReadAloudChunks (the function the engine actually calls) and survives chunking", () => {
    expect(buildReadAloudChunks("full", "人気がない。", { start: 0, end: 0 }, [pron("人気", "ひとけ")])).toEqual(["ひとけがない。"]);
  });

  it("an empty or omitted dictionary changes nothing (no accidental empty-array behaviour difference)", () => {
    expect(buildSpeechText("人気がない。", undefined, [])).toBe(buildSpeechText("人気がない。"));
  });

  it("does not mutate the manuscript string itself -- buildSpeechText only ever returns a NEW string for speech", () => {
    const manuscript = "人気がない。";
    buildSpeechText(manuscript, undefined, [pron("人気", "ひとけ")]);
    expect(manuscript).toBe("人気がない。");
  });
});

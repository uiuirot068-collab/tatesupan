import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPronunciationDictionary,
  buildPronunciationMatcher,
  isValidPronunciationReading,
  removePronunciationEntry,
  upsertPronunciationEntry,
  type PronunciationEntry,
} from "./readAloudPronunciation";

const entry = (surface: string, reading: string, id = surface): PronunciationEntry => ({ id, surface, reading });

describe("B4 pronunciation dictionary: validation", () => {
  it("accepts hiragana, katakana and the long-vowel mark", () => {
    for (const reading of ["ひとけ", "ヒトケ", "コーヒー", "ぱーてぃー"]) expect(isValidPronunciationReading(reading)).toBe(true);
  });

  it("rejects kanji, Latin letters, digits, empty and whitespace-only readings", () => {
    for (const reading of ["人気", "hitoke", "ひとけ1", "", "   ", "ひと　け"]) expect(isValidPronunciationReading(reading)).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidPronunciationReading("  ひとけ  ")).toBe(true);
  });
});

describe("B4 pronunciation dictionary: CRUD (save / reload / edit / delete)", () => {
  it("adds a new entry with a trimmed surface and reading", () => {
    const next = upsertPronunciationEntry([], " 人気 ", " ひとけ ");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ surface: "人気", reading: "ひとけ" });
    expect(next[0].id.length).toBeGreaterThan(0);
  });

  it("rejects an empty surface or an invalid reading, returning an unchanged (but new-reference) list", () => {
    const before = [entry("人気", "ひとけ")];
    expect(upsertPronunciationEntry(before, "", "ひとけ")).toEqual(before);
    expect(upsertPronunciationEntry(before, "気分", "kibun")).toEqual(before);
    expect(upsertPronunciationEntry(before, "気分", "")).toEqual(before);
  });

  it("duplicate surface handling: registering the same surface again UPDATES the existing entry's reading (upsert), never creates a second row", () => {
    const first = upsertPronunciationEntry([], "人気", "にんき");
    const second = upsertPronunciationEntry(first, "人気", "ひとけ");
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ surface: "人気", reading: "ひとけ", id: first[0].id }); // same row, same id
  });

  it("repeated identical registration (same surface, same reading) stays a single, stable entry", () => {
    const once = upsertPronunciationEntry([], "人気", "ひとけ");
    const twice = upsertPronunciationEntry(once, "人気", "ひとけ");
    expect(twice).toEqual(once);
  });

  it("editing = upsert on the existing surface with a new reading", () => {
    const list = upsertPronunciationEntry([entry("人気", "にんき")], "人気", "ひとけ");
    expect(list).toEqual([{ id: "人気", surface: "人気", reading: "ひとけ" }]);
  });

  it("deletes by id and leaves other entries untouched", () => {
    const list = [entry("人気", "ひとけ", "a"), entry("大分", "おおいた", "b")];
    expect(removePronunciationEntry(list, "a")).toEqual([entry("大分", "おおいた", "b")]);
    expect(removePronunciationEntry(list, "missing")).toEqual(list);
  });

  it("persistence is the caller's job (browser-local storage) -- these functions are pure and take/return plain arrays, so 'save then reload' is just storing and re-reading the returned array unchanged", () => {
    const saved = upsertPronunciationEntry([], "人気", "ひとけ");
    const reloaded = JSON.parse(JSON.stringify(saved)) as PronunciationEntry[];
    expect(reloaded).toEqual(saved);
  });
});

describe("B4 pronunciation dictionary: matching (longest-match-first, safe on real text)", () => {
  it("replaces a plain word with its registered reading, repeated occurrences included", () => {
    expect(applyPronunciationDictionary("人気がない。人気者。", [entry("人気", "ひとけ")])).toBe("ひとけがない。ひとけ者。");
  });

  it("longer registered surfaces win over shorter overlapping ones at the same position", () => {
    const entries = [entry("東京", "とうきょう", "a"), entry("東京都", "とうきょうと", "b")];
    expect(applyPronunciationDictionary("東京都に住む。東京タワー。", entries)).toBe("とうきょうとに住む。とうきょうタワー。");
  });

  it("overlapping entries never double-fire: the winning (longer) match consumes its characters", () => {
    const entries = [entry("大", "だい", "a"), entry("大分", "おおいた", "b")];
    expect(applyPronunciationDictionary("大分県は大きい。", entries)).toBe("おおいた県はだいきい。");
  });

  it("punctuation, spacing and Latin/Japanese mixed text are preserved untouched around a replacement", () => {
    expect(applyPronunciationDictionary("Tokyo は人気の街、人気！", [entry("人気", "ひとけ")])).toBe("Tokyo はひとけの街、ひとけ！");
  });

  it("an empty dictionary, or text with no matching surface, passes through unchanged", () => {
    expect(applyPronunciationDictionary("普通の文章です。", [])).toBe("普通の文章です。");
    expect(applyPronunciationDictionary("普通の文章です。", [entry("人気", "ひとけ")])).toBe("普通の文章です。");
  });

  it("regex-special characters in a surface are treated literally, never as a pattern", () => {
    expect(applyPronunciationDictionary("A+B株式会社", [entry("A+B", "エイプラスビー")])).toBe("エイプラスビー株式会社");
  });

  it("buildPronunciationMatcher sorts distinct surfaces longest-first and de-duplicates repeats", () => {
    const matcher = buildPronunciationMatcher([entry("人気", "x", "a"), entry("人気者", "y", "b"), entry("人気", "z", "c")]);
    expect(matcher).not.toBeNull();
    expect(matcher!.source.startsWith("人気者|人気")).toBe(true);
  });

  it("returns null for an empty or surface-less dictionary (caller skips the replace step entirely)", () => {
    expect(buildPronunciationMatcher([])).toBeNull();
    expect(buildPronunciationMatcher([entry("", "x")])).toBeNull();
  });
});

describe("B4 pronunciation dictionary: privacy / no manuscript mutation", () => {
  it("has no fetch / XHR / network / AI API in its source", () => {
    const code = readFileSync(resolve("src/lib/readAloudPronunciation.ts"), "utf8");
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\/|openai|anthropic|gemini/i);
  });
});

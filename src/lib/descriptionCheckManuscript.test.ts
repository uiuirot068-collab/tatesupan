import { describe, expect, it } from "vitest";
import {
  analyzeDescriptionSource,
  analyzeDescriptionSourceAsync,
  createDescriptionCache,
  findMarkAt,
} from "./descriptionCheckManuscript";
import { buildMarkSegments, marksForPage, mergeMarkRanges } from "./descriptionMarkSegments";

describe("B5 manuscript analysis: raw offsets", () => {
  it("returns raw manuscript offsets across paragraphs (mark.text is exactly the source slice)", () => {
    const source = "静かな夜だった。\n\n冷たい風が吹く。\n昨日の雨。";
    const marks = analyzeDescriptionSource(source);
    expect(marks.length).toBeGreaterThan(2);
    for (const mark of marks) expect(source.slice(mark.start, mark.end)).toBe(mark.text);
    expect(marks.map((m) => m.text)).toEqual(expect.arrayContaining(["静かな", "冷たい", "昨日の"]));
    for (let i = 1; i < marks.length; i += 1) expect(marks[i].start).toBeGreaterThanOrEqual(marks[i - 1].start);
  });

  it("looks through ruby notation: the base is analysed and the mark covers the whole ｜…《…》", () => {
    const bare = analyzeDescriptionSource("美《うつく》しい花が咲いた。");
    expect(bare.find((m) => m.category === "A")?.text).toBe("美《うつく》しい");
    const piped = analyzeDescriptionSource("彼は｜静《しず》かな夜を過ごした。");
    expect(piped.find((m) => m.category === "A")?.text).toBe("｜静《しず》かな");
    // the rt (reading) is never analysed as text: a reading that looks like an adjective is not a candidate
    expect(analyzeDescriptionSource("｜夜《やさしい》の街").filter((m) => m.category === "A")).toEqual([]);
  });

  it("treats 改ページ / 挿絵 markers as boundaries and 縦中横 as its characters, without shifting later offsets", () => {
    const source = "静かな夜。\n【改ページ】\n昨日の夜、[tate]12[/tate]日の朝の光。";
    const marks = analyzeDescriptionSource(source);
    for (const mark of marks) expect(source.slice(mark.start, mark.end)).toBe(mark.text);
    expect(marks.map((m) => m.text)).toEqual(expect.arrayContaining(["静かな", "昨日の"]));
    const withImage = "前【IMG:abc:10:20:top】美しい景色";
    const imageMarks = analyzeDescriptionSource(withImage);
    expect(imageMarks.find((m) => m.category === "A")?.text).toBe("美しい");
  });

  it("handles empty text, blank lines and a lone newline", () => {
    expect(analyzeDescriptionSource("")).toEqual([]);
    expect(analyzeDescriptionSource("\n\n\n")).toEqual([]);
  });
});

describe("B5 per-paragraph cache", () => {
  it("re-analyses only changed paragraphs and gives identical results with and without the cache", () => {
    const cache = createDescriptionCache();
    const a = "静かな夜だった。";
    const b = "冷たい風が吹く。";
    const first = analyzeDescriptionSource(`${a}\n${b}`, cache);
    expect(cache.size).toBe(2);
    const edited = analyzeDescriptionSource(`${a}\n${b}美しい`, cache);
    expect(cache.size).toBe(3); // only the edited paragraph was added
    expect(edited.map((m) => m.text)).toEqual(analyzeDescriptionSource(`${a}\n${b}美しい`).map((m) => m.text));
    expect(first.length).toBeGreaterThan(0);
  });

  it("is bounded: an LRU evicts the oldest paragraphs", () => {
    const cache = createDescriptionCache(3);
    for (const p of ["一。", "二。", "三。", "四。", "五。"]) cache.set(p, []);
    expect(cache.size).toBe(3);
    expect(cache.get("一。")).toBeUndefined();
    expect(cache.get("五。")).toBeDefined();
  });

  it("shifts cached (paragraph-relative) candidates to the paragraph's new position", () => {
    const cache = createDescriptionCache();
    analyzeDescriptionSource("静かな夜。", cache);
    const moved = analyzeDescriptionSource("前置き。\n静かな夜。", cache);
    const mark = moved.find((m) => m.text === "静かな")!;
    expect(mark.start).toBe("前置き。\n".length);
  });
});

describe("B5 time-sliced async runner (typing must never be blocked)", () => {
  const paragraphs = Array.from({ length: 200 }, (_, i) => `第${i}段落。静かな夜に、美しい花が咲いていた。`);
  const source = paragraphs.join("\n");

  it("yields to the browser between slices and returns the same result as the synchronous run", async () => {
    let clock = 0;
    let yields = 0;
    const result = await analyzeDescriptionSourceAsync(source, {
      budgetMs: 8,
      now: () => (clock += 3), // each paragraph "costs" 3 ms
      yieldToBrowser: async () => {
        yields += 1;
      },
    });
    expect(yields).toBeGreaterThan(20);
    expect(result).not.toBeNull();
    expect(result!.map((m) => `${m.start}:${m.end}`)).toEqual(analyzeDescriptionSource(source).map((m) => `${m.start}:${m.end}`));
  });

  it("stops and resolves null as soon as a newer edit cancels it", async () => {
    let clock = 0;
    let cancelled = false;
    const result = await analyzeDescriptionSourceAsync(source, {
      budgetMs: 8,
      now: () => (clock += 3),
      isCancelled: () => cancelled,
      yieldToBrowser: async () => {
        cancelled = true;
      },
    });
    expect(result).toBeNull();
  });

  it("uses the default macrotask yield when none is given (a real setTimeout boundary)", async () => {
    const result = await analyzeDescriptionSourceAsync("静かな夜。", { budgetMs: 0, now: () => 1e9 });
    expect(result?.length).toBeGreaterThan(0);
  });
});

describe("B5 long-manuscript performance (generous budgets; measured numbers are in the QA evidence)", () => {
  const unit = "朝の光が窓に差していた。彼女は美しく微笑み、ゆっくりと歩いた。昨日の夜、駅前の店で泣いている少女に会った。まるで夢のような景色だった。\n";
  const long = unit.repeat(1500); // ≈ 100k characters, 1500 paragraphs

  it("analyses ~100k characters cold well under a second, then re-analyses a one-paragraph edit almost instantly", () => {
    const cache = createDescriptionCache();
    const t0 = performance.now();
    const cold = analyzeDescriptionSource(long, cache);
    const coldMs = performance.now() - t0;
    expect(cold.length).toBeGreaterThan(1000);
    expect(coldMs).toBeLessThan(2500);
    const edited = `${long}静かな夜。`;
    const t1 = performance.now();
    analyzeDescriptionSource(edited, cache);
    expect(performance.now() - t1).toBeLessThan(600);
  });

  it("identical paragraphs share one cache entry", () => {
    const cache = createDescriptionCache();
    analyzeDescriptionSource(long, cache);
    expect(cache.size).toBe(2); // the repeated paragraph + the trailing empty one
  });
});

describe("B5 caret lookup and painting helpers", () => {
  const marks = [
    { start: 2, end: 6 },
    { start: 4, end: 9 },
    { start: 12, end: 15 },
  ];

  it("finds the mark under a caret (including the inner one of two overlapping marks) and none outside", () => {
    expect(findMarkAt(marks, -1)).toBeNull(); // no caret reported yet
    expect(findMarkAt(marks, 0)).toBeNull();
    expect(findMarkAt(marks, 3)).toBe(marks[0]);
    expect(findMarkAt(marks, 5)).toBe(marks[1]); // last-starting candidate that still covers it
    expect(findMarkAt(marks, 8)).toBe(marks[1]);
    expect(findMarkAt(marks, 9)).toBeNull(); // end is exclusive
    expect(findMarkAt(marks, 13)).toBe(marks[2]);
    expect(findMarkAt([], 3)).toBeNull();
  });

  it("merges overlapping candidates into one yellow run and clips to the text", () => {
    expect(mergeMarkRanges(marks, 100)).toEqual([
      { start: 2, end: 9 },
      { start: 12, end: 15 },
    ]);
    expect(mergeMarkRanges([{ start: -3, end: 2 }, { start: 8, end: 400 }], 10)).toEqual([{ start: 0, end: 2 }, { start: 8, end: 10 }]);
    expect(mergeMarkRanges([{ start: 5, end: 5 }], 10)).toEqual([]);
  });

  it("splits text into marked / unmarked segments that reassemble to the original", () => {
    const text = "0123456789ABCDEFG";
    const segments = buildMarkSegments(text, marks);
    expect(segments.map((s) => s.text).join("")).toBe(text);
    expect(segments.filter((s) => s.marked).map((s) => s.text)).toEqual(["2345678", "CDE"]);
  });

  it("re-bases marks to a page for the paged (WINDOWED) editor, keeping only the intersecting ones", () => {
    const page = marksForPage(marks, 5, 13);
    expect(page).toEqual([
      { start: 0, end: 1 },
      { start: 0, end: 4 },
      { start: 7, end: 8 },
    ]);
    expect(marksForPage(marks, 20, 30)).toEqual([]);
  });
});

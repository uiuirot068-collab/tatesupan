import { describe, expect, it } from "vitest";
import {
  computePageSourceRanges,
  countVisualLength,
  detokenizeTategaki,
  paginateTokens,
  stripBoutenNotation,
  tokenEmphasis,
  tokenizeTategaki,
  tokenizeTategakiWithOffsets,
  type TategakiToken,
} from "./tategaki";
import { buildSpeechText } from "./readAloud";
import { decodeUtf8Txt, encodeUtf8Txt, serializeReadableTxt } from "./txtTransfer";

// Post-beta typography Phase 1 — 傍点 notation contract (`《《…》》`) at the
// tokenizer / legacy pagination layer. The V2 composition + paint side is
// covered by `v2Bridge/typographyPhase1.test.ts`.

const plain = (tokens: TategakiToken[]) =>
  tokens.map((t) => (t.type === "text" || t.type === "tcy" ? t.value : t.type === "ruby" ? t.base : "")).join("");

const emphasized = (tokens: TategakiToken[]) =>
  tokens.filter((t) => tokenEmphasis(t) === "dot").map((t) => (t.type === "ruby" ? t.base : t.type === "text" || t.type === "tcy" ? t.value : "")).join("");

describe("傍点 notation: tokenizer contract", () => {
  it("plain text regression: text without the notation tokenizes exactly as before (no decoration key at all)", () => {
    const tokens = tokenizeTategaki("吾輩は猫である。名前はまだ無い。");
    expect(tokens).toStrictEqual([{ type: "text", value: "吾輩は猫である。名前はまだ無い。" }]);
  });

  it("basic bouten: removes the markers and decorates only the enclosed characters", () => {
    const tokens = tokenizeTategaki("これは《《強調》》です。");
    expect(tokens).toStrictEqual([
      { type: "text", value: "これは" },
      { type: "text", value: "強調", decoration: { emphasis: "dot" } },
      { type: "text", value: "です。" },
    ]);
  });

  it("multi-char bouten and several ranges on one line", () => {
    const tokens = tokenizeTategaki("《《とても大切な言葉》》と《《もう一つ》》");
    expect(plain(tokens)).toBe("とても大切な言葉ともう一つ");
    expect(emphasized(tokens)).toBe("とても大切な言葉もう一つ");
  });

  it("bouten + plain text: source offsets of every surrounding and enclosed character stay exact", () => {
    const source = "前《《強調》》後";
    const tokens = tokenizeTategakiWithOffsets(source);
    for (const { token, start, end } of tokens) {
      if (token.type === "text") expect(source.slice(start, end)).toBe(token.value);
    }
    // The markers themselves belong to no token (offset gaps), like a consumed 改ページ.
    expect(tokens.map((t) => [t.start, t.end])).toEqual([[0, 1], [3, 5], [7, 8]]);
  });

  it("bouten + ruby: a ruby written inside the range stays a ruby and carries the decoration (both ruby notations)", () => {
    for (const source of ["《《｜漢字《かんじ》》》", "《《漢字《かんじ》》》"]) {
      const tokens = tokenizeTategaki(source);
      expect(tokens).toStrictEqual([{ type: "ruby", base: "漢字", rt: "かんじ", decoration: { emphasis: "dot" } }]);
    }
    const mixed = tokenizeTategaki("《《私の｜本当《ほんとう》の話》》");
    expect(mixed.map((t) => t.type)).toEqual(["text", "ruby", "text"]);
    expect(mixed.every((t) => tokenEmphasis(t) === "dot")).toBe(true);
  });

  it("bouten + TCY: auto-detected and explicit 縦中横 inside a range stay TCY and carry the decoration", () => {
    const tokens = tokenizeTategaki("《《12月》》と《《[tate]A5[/tate]判》》");
    expect(tokens).toStrictEqual([
      { type: "tcy", value: "12", decoration: { emphasis: "dot" } },
      { type: "text", value: "月", decoration: { emphasis: "dot" } },
      { type: "text", value: "と" },
      { type: "tcy", value: "A5", decoration: { emphasis: "dot" } },
      { type: "text", value: "判", decoration: { emphasis: "dot" } },
    ]);
  });

  it("empty syntax 《《》》 stays literal text and never crashes", () => {
    expect(tokenizeTategaki("空《《》》です")).toStrictEqual([{ type: "text", value: "空《《》》です" }]);
  });

  it("unclosed syntax stays literal text and never crashes (also across a newline)", () => {
    expect(tokenizeTategaki("未閉じ《《強調です")).toStrictEqual([{ type: "text", value: "未閉じ《《強調です" }]);
    expect(tokenizeTategaki("改行《《ま\nたぐ》》")).toStrictEqual([{ type: "text", value: "改行《《ま\nたぐ》》" }]);
    expect(() => tokenizeTategaki("《《《《》》》》《《")).not.toThrow();
  });

  it("ruby regression: existing ruby notation is untouched and never mistaken for bouten", () => {
    expect(tokenizeTategaki("｜漢字《かんじ》と東京《とうきょう》")).toStrictEqual([
      { type: "ruby", base: "漢字", rt: "かんじ" },
      { type: "text", value: "と" },
      { type: "ruby", base: "東京", rt: "とうきょう" },
    ]);
  });

  it("TCY regression: bare 2-digit and !? detection is unchanged outside any range", () => {
    expect(tokenizeTategaki("第12話!?")).toStrictEqual([
      { type: "text", value: "第" },
      { type: "tcy", value: "12" },
      { type: "text", value: "話" },
      { type: "tcy", value: "!?" },
    ]);
  });

  it("the notation is not counted as characters (visual length == the same text without markers)", () => {
    expect(countVisualLength("これは《《強調》》です。")).toBe(countVisualLength("これは強調です。"));
  });

  it("image / 改ページ markers split a range cleanly instead of being swallowed", () => {
    const tokens = tokenizeTategaki("《《前半》》\n【改ページ】\n《《後半》》");
    expect(tokens.filter((t) => t.type === "pageBreak")).toHaveLength(1);
    expect(emphasized(tokens)).toBe("前半後半");
  });
});

describe("傍点 notation: detokenize round-trip (page reorder / backup safety)", () => {
  it.each([
    "これは《《強調》》です。",
    "《《｜漢字《かんじ》》》と《《12月》》",
    "前《《a》》後\n次の段落",
  ])("round-trips %s through tokenize -> detokenize -> tokenize with identical meaning", (source) => {
    const once = tokenizeTategaki(source);
    expect(tokenizeTategaki(detokenizeTategaki(once))).toStrictEqual(once);
  });

  it("re-joins a range pagination split across lines into ONE 《《…》》 per contiguous run", () => {
    const pages = paginateTokens(tokenizeTategaki("《《あいうえおかきくけこ》》"), { charsPerLine: 4, linesPerPage: 10 });
    const text = detokenizeTategaki(pages[0].tokens);
    expect(text).toBe("《《あいうえおかきくけこ》》");
  });
});

describe("傍点 notation: legacy pagination (editor page mapping / LEGACY renderer)", () => {
  const metrics = { charsPerLine: 5, linesPerPage: 2 };

  it("pagination regression: a decorated manuscript paginates exactly like the same text without markers", () => {
    const decorated = paginateTokens(tokenizeTategaki("あいう《《えおかきく》》けこさしすせそ"), metrics);
    const bare = paginateTokens(tokenizeTategaki("あいうえおかきくけこさしすせそ"), metrics);
    expect(decorated.map((p) => p.lines.map((l) => plain(l)))).toEqual(bare.map((p) => p.lines.map((l) => plain(l))));
  });

  it("line-end bouten: a range that wraps keeps its decoration on both lines", () => {
    const [page] = paginateTokens(tokenizeTategaki("あい《《うえおか》》き"), { charsPerLine: 4, linesPerPage: 10 });
    // Line 1 reserves one cell for the paragraph 一字下げ (3 + indent).
    expect(page.lines.map((l) => plain(l))).toEqual(["あいう", "えおかき"]);
    expect(page.lines.map((l) => emphasized(l))).toEqual(["う", "えおか"]);
  });

  it("page-boundary bouten: a range crossing a page break keeps its decoration on both pages", () => {
    const pages = paginateTokens(tokenizeTategaki("あいうえおかき《《くけこさし》》す"), metrics);
    expect(pages).toHaveLength(2);
    // Page 1 = 4 (+一字下げ) + 5 cells: "あいうえ" / "おかきくけ".
    expect(emphasized(pages[0].tokens)).toBe("くけ");
    expect(emphasized(pages[1].tokens)).toBe("こさし");
  });

  it("page source ranges still map every enclosed character to the page that renders it", () => {
    const source = "あいうえおかき《《くけこさし》》す";
    const ranges = computePageSourceRanges(source, metrics);
    expect(ranges).toHaveLength(2);
    expect(source.slice(ranges[0].start, ranges[0].end)).toBe("あいうえおかき《《くけ");
    expect(source.slice(ranges[1].start, ranges[1].end)).toBe("こさし》》す");
  });

  it("dash regression: ―― runs are still never split 1+1 by legacy pagination", () => {
    const [page] = paginateTokens(tokenizeTategaki("あいう――えお"), { charsPerLine: 4, linesPerPage: 10 });
    expect(page.lines.map((l) => plain(l))).toEqual(["あいう", "――えお"]);
  });
});

describe("傍点 notation: other manuscript consumers", () => {
  it("read-aloud never speaks the markers", () => {
    expect(buildSpeechText("これは《《強調》》です。")).toBe("これは強調です。");
  });

  it("TXT backup round-trips the notation byte-for-byte (save/restore keep 《《…》》)", () => {
    const source = "これは《《強調》》と《《｜漢字《かんじ》》》です。\r\n次";
    for (const newlines of ["preserve", "lf", "crlf"] as const) {
      const profile = { bom: true, newlines };
      const restored = decodeUtf8Txt(encodeUtf8Txt(source, profile), { newlines: "preserve" });
      expect(restored.replace(/\r\n?/g, "\n")).toBe(source.replace(/\r\n?/g, "\n"));
      expect(restored).toContain("《《強調》》");
    }
  });

  it("readable TXT export drops the notation but keeps the emphasised words (ruby inside included)", () => {
    expect(serializeReadableTxt("これは《《強調》》と《《｜漢字《かんじ》》》です。")).toBe("　これは強調と漢字です。");
    expect(stripBoutenNotation("空《《》》と未閉じ《《")).toBe("空《《》》と未閉じ《《");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildTxtFileName,
  decodeUtf8Txt,
  encodeUtf8Txt,
  readLocalTxtFile,
  serializeReadableTxt,
} from "./txtTransfer";

const SOURCE = [
  "第一章\r\n",
  "｜東京《とうきょう》で[tate]2026[/tate]\n",
  "【改ページ】\r",
  "【IMG:image-1:30:40:full】",
].join("");

describe("safe TXT transfer boundary", () => {
  it("round-trips plain UTF-8 and every existing source token opaquely", () => {
    const bytes = encodeUtf8Txt(SOURCE, { bom: false, newlines: "preserve" });
    expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(decodeUtf8Txt(bytes, { newlines: "preserve" })).toBe(SOURCE);
  });

  it("supports explicit BOM and newline profiles without choosing a Product default", () => {
    const bytes = encodeUtf8Txt(SOURCE, { bom: true, newlines: "lf" });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(decodeUtf8Txt(bytes, { newlines: "preserve" })).toBe(
      SOURCE.replace(/\r\n?/g, "\n")
    );

    expect(
      decodeUtf8Txt(
        encodeUtf8Txt("a\nb\r\nc\r", { bom: false, newlines: "crlf" }),
        { newlines: "preserve" }
      )
    ).toBe("a\r\nb\r\nc\r\n");
  });

  it("uses the existing safe title-derived filename contract", () => {
    expect(buildTxtFileName(' 原稿:/第1稿? ')).toBe("原稿第1稿.txt");
    expect(buildTxtFileName("  ...  ")).toBe("無題のドキュメント.txt");
  });

  it("rejects malformed UTF-8 with a user-facing error", () => {
    expect(() => decodeUtf8Txt(new Uint8Array([0xc3, 0x28]), { newlines: "preserve" }))
      .toThrow("TXTをUTF-8として読み込めませんでした");
  });

  it("wraps local file-read failures and contains no request API", async () => {
    await expect(readLocalTxtFile({
      arrayBuffer: async () => { throw new Error("disk failure"); },
    }, { newlines: "preserve" })).rejects.toThrow("TXTファイルの読み込みに失敗しました");

    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("./txtTransfer.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
  });

  it("creates readable TXT while preserving visible prose", () => {
    const source = [
      "# 第一章",
      "",
      "これは**強い**言葉と*静かな*言葉です。",
      "｜東京《とうきょう》で[tate]25[/tate]年を迎えた。",
      "【改ページ】",
      "【IMG:local:20:30:center】",
      "![挿絵](https://example.invalid/private-image.jpg)",
      "続きの段落です。通常URL https://example.com/story は残します。",
    ].join("\n");

    expect(serializeReadableTxt(source)).toBe([
      "第一章",
      "",
      "　これは強い言葉と静かな言葉です。",
      "　東京で25年を迎えた。",
      "",
      "　続きの段落です。通常URL https://example.com/story は残します。",
    ].join("\n"));
  });

  it("normalizes paragraph gaps and never double-indents suitable lines", () => {
    expect(serializeReadableTxt("　字下げ済み。\n\n\n\n次の段落。\n■ 特殊構造\n- 箇条書き"))
      .toBe("　字下げ済み。\n\n　次の段落。\n■ 特殊構造\n箇条書き");
  });

  it("keeps A round-trip opaque after readable TXT support is added", () => {
    const bytes = encodeUtf8Txt(SOURCE, { bom: false, newlines: "lf" });
    expect(decodeUtf8Txt(bytes, { newlines: "lf" })).toBe(SOURCE.replace(/\r\n?/g, "\n"));
  });
});

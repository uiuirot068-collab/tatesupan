import { describe, expect, it } from "vitest";
import {
  buildTxtFileName,
  decodeUtf8Txt,
  encodeUtf8Txt,
  readLocalTxtFile,
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
});

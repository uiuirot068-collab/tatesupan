import { describe, expect, it, vi } from "vitest";

// TSP-PRINT-004: the Web閲覧用 footer on the JPG canvas (the Preview's
// WebFooterOverlay measurements, lib/webFooterLayout.ts).
vi.mock("@/lib/basePath", () => ({ withBasePath: (p: string) => p }));

describe("drawWebFooter", () => {
  it("draws the full-width rule, then the wordmark, URL and hashtag centred in one row", async () => {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FakeImage);
    const { drawWebFooter } = await import("./snsCreditCanvas");
    const calls: Array<{ op: string; args: unknown[]; font?: string }> = [];
    let font = "";
    const ctx = {
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
      fillText: (...args: unknown[]) => calls.push({ op: "fillText", args, font }),
      drawImage: () => {},
      measureText: (text: string) => ({ width: text.length * 10, fontBoundingBoxAscent: 20, fontBoundingBoxDescent: 6 }),
      set font(value: string) {
        font = value;
      },
      get font() {
        return font;
      },
    } as unknown as CanvasRenderingContext2D;
    // 2× JPG of the 768×1024 page, body 23.3px.
    await drawWebFooter(ctx, 1536, 2048, 23.3);
    const rule = calls.find((c) => c.op === "fillRect")!;
    expect(rule.args[0]).toBe(0);
    expect(rule.args[2]).toBe(1536);
    const texts = calls.filter((c) => c.op === "fillText");
    expect(texts.map((c) => c.args[0])).toEqual(["TateSpun", "https://spuntales.net/tatespun/", "#スパンテイルズ"]);
    // Row bottom: 15px + 6px padding above the page bottom (×2); every box is
    // 26px high here, so each baseline is 20px below its box top.
    const rowBottom = 2048 - 2 * (15 + 6);
    for (const text of texts) expect(text.args[2]).toBeCloseTo(rowBottom - 26 + 20);
    // Rule: above the row and the 4px top padding.
    expect(rule.args[1]).toBeCloseTo(rowBottom - 26 - 2 * (4 + 1));
    // Wordmark at 75% of the body, the rest one step smaller.
    expect(texts[0].font).toContain(`${23.3 * 0.75 * 2}px`);
    expect(texts[1].font).toContain(`${23.3 * 0.75 * 0.82 * 2}px`);
  });
});

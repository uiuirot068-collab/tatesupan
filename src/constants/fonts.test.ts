import { describe, expect, it } from "vitest";
import { resolveNombreFontFamily } from "./fonts";

describe("TSP-PHASE13-001: ノンブルは本文と同じフォント", () => {
  it("always uses the body font, even when an old document stored another nombre font", () => {
    expect(resolveNombreFontFamily("", "'Zen Old Mincho', serif")).toBe("'Zen Old Mincho', serif");
    expect(resolveNombreFontFamily("'Noto Sans JP', sans-serif", "'Shippori Mincho', serif")).toBe("'Shippori Mincho', serif");
    expect(resolveNombreFontFamily(undefined, "serif")).toBe("serif");
  });
});

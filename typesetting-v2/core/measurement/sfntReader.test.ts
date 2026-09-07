import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readSfntSummary } from "./sfntReader";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

describe("readSfntSummary — Shippori Mincho Regular", () => {
  it("recognizes the real committed asset as a valid TrueType-flavored sfnt", () => {
    const bytes = readFileSync(FONT_PATH);
    const summary = readSfntSummary(bytes);
    expect(summary.flavor).toBe("truetype");
    expect(summary.numTables).toBeGreaterThan(0);
  });

  it("recovers unitsPerEm deterministically from the head table", () => {
    const bytes = readFileSync(FONT_PATH);
    const a = readSfntSummary(bytes);
    const b = readSfntSummary(bytes);
    expect(a.unitsPerEm).toBe(b.unitsPerEm);
    expect(a.unitsPerEm).toBeGreaterThan(0);
    // Common, well-known values for real OpenType/TrueType fonts (usually a
    // power of two, e.g. 1000, 2048) -- a sanity bound, not a magic number
    // this task invented.
    expect(a.unitsPerEm).toBeLessThanOrEqual(16384);
  });

  it("recovers the required table directory entries (head, cmap present)", () => {
    const bytes = readFileSync(FONT_PATH);
    const summary = readSfntSummary(bytes);
    expect(summary.tables.has("head")).toBe(true);
    expect(summary.tables.has("cmap")).toBe(true);
  });

  it("rejects a non-sfnt buffer structurally, never fabricating a summary", () => {
    const garbage = Buffer.from("this is not a font file, just plain text padding to be long enough");
    expect(() => readSfntSummary(garbage)).toThrow(/sfntReader/);
  });

  it("rejects a truncated sfnt header structurally", () => {
    const bytes = readFileSync(FONT_PATH);
    const truncated = bytes.subarray(0, 6); // real version tag, but cut mid-header
    expect(() => readSfntSummary(truncated)).toThrow(/sfntReader/);
  });
});

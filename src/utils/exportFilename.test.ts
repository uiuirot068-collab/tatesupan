import { describe, expect, it } from "vitest";
import {
  buildDefaultPdfFilenameStem,
  buildPdfFileNameFromStem,
  sanitizePdfFilenameStem,
} from "./exportFilename";

describe("TSP-PDF-SAFE-FILENAME-014 — PDF export filename contract", () => {
  it("defaults to TateSpunYYYYMMDD from the given date, zero-padded", () => {
    expect(buildDefaultPdfFilenameStem(new Date(2026, 8, 14))).toBe("TateSpun20260914");
    expect(buildDefaultPdfFilenameStem(new Date(2026, 0, 5))).toBe("TateSpun20260105");
  });

  it("leaves valid ASCII alphanumeric input unchanged", () => {
    expect(sanitizePdfFilenameStem("Book01")).toBe("Book01");
    expect(sanitizePdfFilenameStem("abcXYZ123")).toBe("abcXYZ123");
  });

  it("strips hyphens, underscores, and spaces", () => {
    expect(sanitizePdfFilenameStem("Book-01")).toBe("Book01");
    expect(sanitizePdfFilenameStem("Book_01")).toBe("Book01");
    expect(sanitizePdfFilenameStem("Book 01")).toBe("Book01");
  });

  it("strips Japanese text, keeping only the ASCII alphanumeric remainder", () => {
    expect(sanitizePdfFilenameStem("新刊Book01")).toBe("Book01");
    expect(sanitizePdfFilenameStem("新刊")).toBe("");
  });

  it("strips full-width Latin letters/digits — they are not ASCII", () => {
    expect(sanitizePdfFilenameStem("ＡＢＣ１２３")).toBe("");
  });

  it("strips mixed Japanese/symbol/ASCII paste content down to [A-Za-z0-9]", () => {
    expect(sanitizePdfFilenameStem("My-Book_01")).toBe("MyBook01");
    expect(sanitizePdfFilenameStem("新刊(Book)#01!")).toBe("Book01");
  });

  it("appends .pdf exactly once, never doubling the extension", () => {
    expect(buildPdfFileNameFromStem("MyNovel01")).toBe("MyNovel01.pdf");
    expect(buildPdfFileNameFromStem("Book01")).not.toBe("Book01.pdf.pdf");
  });
});

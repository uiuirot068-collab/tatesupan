import { describe, expect, it } from "vitest";
import { parseBookmakingSections } from "./useBookmakingSections";

describe("CST-PORT-011B bookmaking accordion state", () => {
  it("defaults to both sections closed", () => {
    expect(parseBookmakingSections(null)).toEqual({ book: false, files: false });
    expect(parseBookmakingSections("")).toEqual({ book: false, files: false });
  });

  it("restores sections the user left open", () => {
    expect(parseBookmakingSections('{"book":true,"files":false}')).toEqual({ book: true, files: false });
    expect(parseBookmakingSections('{"files":true}')).toEqual({ book: false, files: true });
  });

  it("falls back to closed on malformed values", () => {
    expect(parseBookmakingSections("not json")).toEqual({ book: false, files: false });
    expect(parseBookmakingSections('{"book":"yes"}')).toEqual({ book: false, files: false });
    expect(parseBookmakingSections("null")).toEqual({ book: false, files: false });
  });
});

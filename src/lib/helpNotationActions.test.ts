import { describe, expect, it, vi } from "vitest";
import {
  copyHelpNotation,
  RUBY_HELP_NOTATION,
  TCY_HELP_NOTATION,
} from "./helpNotationActions";

describe("Help notation convenience actions", () => {
  it("copies the canonical TateSpun ruby notation", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyHelpNotation(RUBY_HELP_NOTATION, writeText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("｜親文字《よみ》");
  });

  it("copies the canonical explicit TCY notation", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyHelpNotation(TCY_HELP_NOTATION, writeText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("[tate]12[/tate]");
  });

  it("reports a clipboard failure without changing the notation", async () => {
    const writeText = vi.fn(async () => { throw new Error("denied"); });
    await expect(copyHelpNotation(RUBY_HELP_NOTATION, writeText)).resolves.toBe(false);
  });
});

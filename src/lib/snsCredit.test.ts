import { describe, expect, it } from "vitest";
import { formatSnsId, showsSnsCredit } from "./snsCredit";

describe("SPN-XFIX-002 SNS credit", () => {
  it("shows the credit on SNS 4:5 only, unless turned off", () => {
    expect(showsSnsCredit({ paperSize: "SNS用 4:5" })).toBe(true);
    expect(showsSnsCredit({ paperSize: "SNS用 4:5", snsCredit: false })).toBe(false);
    expect(showsSnsCredit({ paperSize: "SNS用 正方形" })).toBe(false);
    expect(showsSnsCredit({ paperSize: "A5" })).toBe(false);
  });
  it("formats ids", () => {
    expect(formatSnsId("")).toBe("");
    expect(formatSnsId("  natsuo ")).toBe("@natsuo");
    expect(formatSnsId("@natsuo")).toBe("@natsuo");
    expect(formatSnsId("natsuo.bsky.social")).toBe("natsuo.bsky.social");
    expect(formatSnsId("a".repeat(60)).length).toBe(41);
  });
});

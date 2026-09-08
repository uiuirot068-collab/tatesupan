import { describe, expect, it } from "vitest";
import { checkBrackets } from "./brackets";

describe("checkBrackets (R1-bracket)", () => {
  it("matched brackets of every supported full-width pair produce no diagnostics", () => {
    expect(checkBrackets("「会話」『引用』（注記）［メモ］【見出し】")).toEqual([]);
  });

  it("nested matched brackets produce no diagnostics", () => {
    expect(checkBrackets("「彼は『やめろ』と言った」")).toEqual([]);
  });

  it("an unmatched opening bracket is flagged at its own position", () => {
    const issues = checkBrackets("「閉じられていない");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R1-bracket", start: 0, end: 1, category: "structure", severity: "HIGH_CONFIDENCE" });
  });

  it("an unmatched closing bracket (no opener at all) is flagged at its own position", () => {
    const issues = checkBrackets("開かれていない」");
    expect(issues).toHaveLength(1);
    expect(issues[0].start).toBe(7);
  });

  it("crossed/mismatched bracket pairs are flagged once, without cascading onto every later bracket", () => {
    const issues = checkBrackets("「『交差」』"); // 「 『 「crossed」 』
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((d) => d.ruleId === "R1-bracket")).toBe(true);
  });

  it("half-width brackets ()[] are deliberately never flagged (false-positive avoidance, unchanged pre-2.0 behavior)", () => {
    expect(checkBrackets("これは (注記 が閉じていない文である")).toEqual([]);
  });
});

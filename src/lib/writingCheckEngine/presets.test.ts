import { describe, expect, it } from "vitest";
import { PRESET_LABELS, PRESET_DEFINITIONS, ALL_TOGGLEABLE_RULE_IDS } from "./presets";
import { runWritingCheck } from "./engine";

describe("Writing Check presets", () => {
  it("uses the exact, Human-approved verbatim preset names", () => {
    expect(PRESET_LABELS).toEqual({
      "submission-recommended": "入稿前おすすめ",
      "symbols-only": "記号だけ",
      thorough: "しっかりチェック",
    });
  });

  it("入稿前おすすめ additionally enables blank-run and dictionary/NG on top of engine defaults", () => {
    expect(PRESET_DEFINITIONS["submission-recommended"].ruleOverrides).toEqual({
      "R8-blank-run": true,
      "R11-dictionary": true,
      "R12-ngword": true,
    });
  });

  it("記号だけ enables only punctuation/notation structural rules, nothing else", () => {
    const overrides = PRESET_DEFINITIONS["symbols-only"].ruleOverrides;
    const enabled = ALL_TOGGLEABLE_RULE_IDS.filter((id) => overrides[id]);
    expect(enabled.sort()).toEqual(["R1-bracket", "R2-punct", "R3-ruby", "R3-tcy", "R10-dash", "R9-ellipsis"].sort());
  });

  it("しっかりチェック enables every toggleable rule", () => {
    const overrides = PRESET_DEFINITIONS.thorough.ruleOverrides;
    for (const id of ALL_TOGGLEABLE_RULE_IDS) {
      expect(overrides[id]).toBe(true);
    }
  });

  it("記号だけ, applied via runWritingCheck, suppresses whitespace/character/dictionary rules", () => {
    const text = "行末に空白がある \n"; // R6-trailing-whitespace would normally fire
    const issues = runWritingCheck(text, { ruleOverrides: PRESET_DEFINITIONS["symbols-only"].ruleOverrides });
    expect(issues.some((i) => i.ruleId === "R6-trailing-whitespace")).toBe(false);
  });

  it("しっかりチェック, applied via runWritingCheck, includes R8-blank-run (off by default)", () => {
    const text = "一行目\n\n\n\n二行目"; // 3+ blank lines
    const issues = runWritingCheck(text, { ruleOverrides: PRESET_DEFINITIONS.thorough.ruleOverrides });
    expect(issues.some((i) => i.ruleId === "R8-blank-run")).toBe(true);
  });
});

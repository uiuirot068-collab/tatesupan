import { describe, expect, it } from "vitest";
import { deriveLegacyFrozenCapacity } from "./capacityLegacyFrozen";
import { PRODUCTION_PRESET_FIXTURES_MM, toLegacyInputMm } from "./capacityFixtures";

function findFixture(name: string) {
  const fixture = PRODUCTION_PRESET_FIXTURES_MM.find((f) => f.name === name);
  if (!fixture) throw new Error(`fixture not found: ${name}`);
  return fixture;
}

// Parity fixtures (test group F/G/legacy parity) — every expected number here
// is copied verbatim from
// typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md §10. These
// numbers must NEVER change to make a test pass — a mismatch means this
// port has drifted from Production, not that the audit's numbers were wrong.
describe("legacy-frozen capacity — production parity (audit §10)", () => {
  it("文庫 1段 auto: 39 chars x 15 lines", () => {
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm(findFixture("文庫 1段")));
    expect(result.charsPerLine).toBe(39);
    expect(result.linesPerColumn).toBe(15);
  });

  it("文庫 1段 explicit-target clamp (margin-mode max): 40 chars x 15 lines", () => {
    // A target far larger than what fits exercises the clamp path
    // (computeMaxCapacityChars), matching deriveMaxCapacityFromMargins's
    // "maximum" output distinctly from the safety-margined auto value above.
    const result = deriveLegacyFrozenCapacity(
      toLegacyInputMm(findFixture("文庫 1段"), { charsPerLine: 9999, linesPerColumn: 9999 })
    );
    expect(result.charsPerLine).toBe(40);
    expect(result.linesPerColumn).toBe(15);
  });

  it("A5 1段 auto: 54 chars x 21 lines", () => {
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm(findFixture("A5 1段")));
    expect(result.charsPerLine).toBe(54);
    expect(result.linesPerColumn).toBe(21);
  });

  it("A5 2段 auto: 26 chars x 23 lines", () => {
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm(findFixture("A5 2段")));
    expect(result.charsPerLine).toBe(26);
    expect(result.linesPerColumn).toBe(23);
  });

  it("A5 2段 explicit-target clamp reproduces the known full-height 2-column bug: 59 chars x 23 lines (test group G)", () => {
    // This is NOT a bug in this port — it is the exact, verbatim, documented
    // Production inconsistency (audit §3.2/§10): computeMaxCapacityChars is
    // checked against the FULL (undivided) 天地 height even for a 2-column
    // page, yielding a physically-impossible 59 chars/line for an 85mm-tall
    // column. This test exists to PROTECT that exact number in the legacy
    // path (byte-for-byte compatibility for existing documents) — it must
    // never be "fixed" here. capacityV2Native.test.ts proves the corrected
    // formula does NOT reproduce this number.
    const result = deriveLegacyFrozenCapacity(
      toLegacyInputMm(findFixture("A5 2段"), { charsPerLine: 9999, linesPerColumn: 9999 })
    );
    expect(result.charsPerLine).toBe(59);
    expect(result.linesPerColumn).toBe(23);
  });

  it("modified margins (文庫 1段, top/bottom widened to 20mm): 35 chars x 15 lines", () => {
    const fixture = findFixture("文庫 1段");
    const result = deriveLegacyFrozenCapacity(
      toLegacyInputMm({ ...fixture, marginTopMm: 20, marginBottomMm: 20 })
    );
    expect(result.charsPerLine).toBe(35);
    expect(result.linesPerColumn).toBe(15);
  });

  it("modified font size (文庫 1段, 8.5pt -> 10pt): 33 chars x 13 lines", () => {
    const fixture = findFixture("文庫 1段");
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm({ ...fixture, fontSizePt: 10 }));
    expect(result.charsPerLine).toBe(33);
    expect(result.linesPerColumn).toBe(13);
  });

  it("Web閲覧用 1段 auto: 29 chars x 13 lines", () => {
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm(findFixture("Web閲覧用 1段")));
    expect(result.charsPerLine).toBe(29);
    expect(result.linesPerColumn).toBe(13);
  });

  it("Web閲覧用 1段 explicit-target clamp: 30 chars x 13 lines", () => {
    const result = deriveLegacyFrozenCapacity(
      toLegacyInputMm(findFixture("Web閲覧用 1段"), { charsPerLine: 9999, linesPerColumn: 9999 })
    );
    expect(result.charsPerLine).toBe(30);
    expect(result.linesPerColumn).toBe(13);
  });
});

describe("legacy-frozen capacity — all 8 mandatory presets representable (test group O)", () => {
  it.each(PRODUCTION_PRESET_FIXTURES_MM)("$name derives a valid, positive capacity", (fixture) => {
    const result = deriveLegacyFrozenCapacity(toLegacyInputMm(fixture));
    expect(result.charsPerLine).toBeGreaterThan(0);
    expect(result.linesPerColumn).toBeGreaterThan(0);
    expect(Number.isInteger(result.charsPerLine)).toBe(true);
    expect(Number.isInteger(result.linesPerColumn)).toBe(true);
  });
});

describe("legacy-frozen capacity — determinism (test group N)", () => {
  it("same inputs repeat identically", () => {
    const input = toLegacyInputMm(findFixture("A5 1段"));
    const a = deriveLegacyFrozenCapacity(input);
    const b = deriveLegacyFrozenCapacity(input);
    expect(a).toEqual(b);
  });
});

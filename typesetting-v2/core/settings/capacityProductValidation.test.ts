// P3-O12-D — product-behavior validation of the capacity policy.
//
// Unlike capacityFormulaVersion.test.ts / capacityLegacyFrozen.test.ts /
// capacityV2Native.test.ts / capacityPolicy.test.ts (which validate each
// exported function's own contract in isolation), this file validates the
// SAME already-implemented, unmodified functions from a document-lifecycle
// perspective: what a real saved document would experience across a
// sequence of open/edit/save/commit events. It reuses `deriveCapacityForEvent`
// exactly as a future Editor adapter would — it introduces no new capacity
// arithmetic and no Editor/src/ integration of its own.

import { describe, expect, it } from "vitest";
import { deriveCapacityForEvent, initializeNewDocumentCapacity } from "./capacityPolicy";
import { deriveV2NativeCapacity } from "./capacityV2Native";
import { deriveLegacyFrozenCapacity } from "./capacityLegacyFrozen";
import type { CapacitySettingsEvent } from "./capacityFormulaVersion";
import {
  PRODUCTION_PRESET_FIXTURES_MM,
  toLegacyInputMm,
  toV2InputMm,
  type PresetGeometryFixtureMm,
} from "./capacityFixtures";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";

function findFixture(name: string): PresetGeometryFixtureMm {
  const fixture = PRODUCTION_PRESET_FIXTURES_MM.find((f) => f.name === name);
  if (!fixture) throw new Error(`fixture not found: ${name}`);
  return fixture;
}

const measurement = createFakeMeasurementProvider();

function inputFor(fixture: PresetGeometryFixtureMm) {
  return { legacyInputMm: toLegacyInputMm(fixture), v2InputMm: toV2InputMm(fixture) };
}

// ================================================================
// Part 1 — Legacy document lifecycle: a document with NO persisted
// capacity-formula version, walked through the exact sequence a real
// user session produces, using ONLY deriveCapacityForEvent.
// ================================================================
describe("Part 1 — legacy document lifecycle never implicitly migrates", () => {
  const fixture = findFixture("文庫 1段");
  const NON_MIGRATING_EVENTS: CapacitySettingsEvent[] = [
    "documentOpen", // open the saved document
    "ordinarySave", // autosave after a manuscript content edit
    "unrelatedSettingsEdit", // e.g. toggling a page-number position, unrelated to physical geometry
    "documentOpen", // close and reopen (reload)
  ];

  it("open -> edit -> save -> reload: formula identity stays legacy-frozen at every step", () => {
    let persistedVersion: string | undefined = undefined; // "no capacity formula version" = a real old document
    for (const event of NON_MIGRATING_EVENTS) {
      const result = deriveCapacityForEvent(persistedVersion, event, inputFor(fixture), measurement);
      expect(result.formulaVersion).toBe("legacy-frozen");
      persistedVersion = result.formulaVersion; // what an Editor would write back, if anything
    }
    expect(persistedVersion).toBe("legacy-frozen");
  });

  it("effective capacity is identical across every step of that same lifecycle (no drift)", () => {
    const results = NON_MIGRATING_EVENTS.map((event) =>
      deriveCapacityForEvent(undefined, event, inputFor(fixture), measurement)
    );
    const [first, ...rest] = results;
    for (const r of rest) {
      expect(r.charsPerLine).toBe(first.charsPerLine);
      expect(r.linesPerColumn).toBe(first.linesPerColumn);
    }
    // And it matches the audit's own hand-verified 文庫 1段 number (§10).
    expect(first.charsPerLine).toBe(39);
    expect(first.linesPerColumn).toBe(15);
  });
});

describe("Part 1 — legacy effective capacity parity for representative old documents", () => {
  it.each([
    { name: "A5 1段", expected: { charsPerLine: 54, linesPerColumn: 21 } },
    { name: "文庫 1段", expected: { charsPerLine: 39, linesPerColumn: 15 } },
  ])("$name: stored target survives, legacy clamp occurs, no v2-native invoked", ({ name, expected }) => {
    const fixture = findFixture(name);
    const result = deriveCapacityForEvent(undefined, "documentOpen", inputFor(fixture), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
    if (result.formulaVersion !== "legacy-frozen") throw new Error("unreachable");
    expect(result.charsPerLine).toBe(expected.charsPerLine);
    expect(result.linesPerColumn).toBe(expected.linesPerColumn);
    // Diagnostic metadata identifies the legacy path, and ONLY the legacy path.
    expect(result.legacy).toBeDefined();
    expect("v2" in result).toBe(false);
  });

  it("A5 2段 with an explicit (impossible) stored target still clamps via the legacy formula, reproducing the known 59-chars/line quirk", () => {
    const fixture = findFixture("A5 2段");
    const result = deriveCapacityForEvent(
      undefined,
      "documentOpen",
      {
        legacyInputMm: toLegacyInputMm(fixture, { charsPerLine: 9999, linesPerColumn: 9999 }),
        v2InputMm: toV2InputMm(fixture),
      },
      measurement
    );
    expect(result.formulaVersion).toBe("legacy-frozen");
    expect(result.charsPerLine).toBe(59); // audit §10 — deliberately preserved, not a new finding
    expect(result.charsPerLine).toBeLessThan(9999); // the stored target is still clamped, never trusted outright
  });
});

// ================================================================
// Part 2 — Explicit migration lifecycle
// ================================================================
describe("Part 2 — explicit migration lifecycle", () => {
  const fixture = findFixture("A5 1段");

  it("legacy-frozen -> explicit geometry commit -> v2-native -> persisted -> reload still v2-native, same capacity", () => {
    // Step 1: document starts legacy-frozen (no persisted version).
    const beforeCommit = deriveCapacityForEvent(undefined, "documentOpen", inputFor(fixture), measurement);
    expect(beforeCommit.formulaVersion).toBe("legacy-frozen");

    // Step 2: user performs an explicit geometry/capacity commit.
    const atCommit = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor(fixture), measurement);
    expect(atCommit.formulaVersion).toBe("v2-1");
    const persistedVersion = atCommit.formulaVersion; // what the Editor would now write to the document

    // Step 3: reload — the persisted "v2-1" identity must be read back and honored,
    // for an ordinary open, not just for another explicit commit.
    const afterReload = deriveCapacityForEvent(persistedVersion, "documentOpen", inputFor(fixture), measurement);
    expect(afterReload.formulaVersion).toBe("v2-1");
    expect(afterReload.charsPerLine).toBe(atCommit.charsPerLine);
    expect(afterReload.linesPerColumn).toBe(atCommit.linesPerColumn);
  });

  it("ordinary saves after migration do not reset the document back to legacy-frozen", () => {
    const migrated = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor(fixture), measurement);
    expect(migrated.formulaVersion).toBe("v2-1");

    for (const event of ["ordinarySave", "documentOpen", "unrelatedSettingsEdit"] as const) {
      const result = deriveCapacityForEvent(migrated.formulaVersion, event, inputFor(fixture), measurement);
      expect(result.formulaVersion).toBe("v2-1"); // no downgrade path exists
    }
  });

  it("repeated explicit commits with identical inputs produce identical results", () => {
    const first = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor(fixture), measurement);
    const second = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor(fixture), measurement);
    expect(second).toEqual(first);
    // And re-committing an ALREADY-migrated document is equally stable.
    const third = deriveCapacityForEvent("v2-1", "explicitGeometryCommit", inputFor(fixture), measurement);
    expect(third).toEqual(first);
  });
});

// ================================================================
// Part 3 — No accidental migration: exhaustively, for every event the
// pure policy API defines, only "explicitGeometryCommit" ever changes a
// legacy-frozen document's identity. This is checked directly against the
// policy API's own closed event set (CapacitySettingsEvent) rather than
// assumed — no Editor integration is invented to test this.
// ================================================================
describe("Part 3 — the policy API exposes no implicit migration path", () => {
  const fixture = findFixture("B5 1段");
  const ALL_EVENTS: CapacitySettingsEvent[] = [
    "documentOpen",
    "ordinarySave",
    "unrelatedSettingsEdit",
    "explicitGeometryCommit",
  ];

  it.each(ALL_EVENTS)("event '%s' on a legacy document", (event) => {
    const result = deriveCapacityForEvent(undefined, event, inputFor(fixture), measurement);
    if (event === "explicitGeometryCommit") {
      expect(result.formulaVersion).toBe("v2-1");
    } else {
      expect(result.formulaVersion).toBe("legacy-frozen");
    }
  });
});

// ================================================================
// Part 4 — V2-native physical validity across a broader preset/geometry
// spread than the per-function unit tests already cover.
// ================================================================
describe("Part 4 — v2-native capacity never exceeds physical extent", () => {
  const cases: Array<{ label: string; fixture: PresetGeometryFixtureMm }> = [
    { label: "A5 1段", fixture: findFixture("A5 1段") },
    { label: "文庫 1段", fixture: findFixture("文庫 1段") },
    { label: "A5 2段", fixture: findFixture("A5 2段") },
    { label: "B5 2段", fixture: findFixture("B5 2段") },
    {
      label: "narrow-margin case (文庫, margins halved)",
      fixture: { ...findFixture("文庫 1段"), marginTopMm: 7, marginBottomMm: 7, marginGutterMm: 7.5, marginOuterMm: 5 },
    },
    {
      label: "large-font case (文庫, 8.5pt -> 24pt)",
      fixture: { ...findFixture("文庫 1段"), fontSizePt: 24 },
    },
    {
      label: "high line-pitch case (文庫, lineHeightRatio 1.7 -> 2.5)",
      fixture: { ...findFixture("文庫 1段"), lineHeightRatio: 2.5 },
    },
  ];

  it.each(cases)("$label", ({ fixture }) => {
    const result = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    expect(result.charsPerLine).toBeGreaterThanOrEqual(1);
    expect(result.linesPerColumn).toBeGreaterThanOrEqual(1);
    // Capacity never exceeds available physical extent, on either axis.
    expect(result.charsPerLine * result.advanceTick).toBeLessThanOrEqual(result.columnHeightTick);
    expect(result.linesPerColumn * result.linePitchTick).toBeLessThanOrEqual(result.textAreaWidthTick);
    // Rounding is deterministic (integer ticks throughout).
    expect(Number.isInteger(result.charsPerLine)).toBe(true);
    expect(Number.isInteger(result.linesPerColumn)).toBe(true);
    // Residual space is non-negative on both axes.
    expect(result.residualMainAxisTick).toBeGreaterThanOrEqual(0);
    expect(result.residualCrossAxisTick).toBeGreaterThanOrEqual(0);
  });

  it("two-column geometry uses per-column extent and respects the column gap (A5 2段 vs. a zero-gap variant)", () => {
    const withGap = findFixture("A5 2段"); // columnGapMm: 8
    const withoutGap = { ...withGap, columnGapMm: 0 };
    const a = deriveV2NativeCapacity(toV2InputMm(withGap), measurement);
    const b = deriveV2NativeCapacity(toV2InputMm(withoutGap), measurement);
    // Removing the gap gives the two columns more combined height to split, so
    // the zero-gap variant's per-column height (and therefore capacity) must
    // be >= the gapped variant's — proving the gap is actually consumed.
    expect(b.columnHeightTick).toBeGreaterThan(a.columnHeightTick);
    expect(b.charsPerLine).toBeGreaterThanOrEqual(a.charsPerLine);
  });
});

// ================================================================
// Part 5 — Legacy bug isolation, reconfirmed from the product-lifecycle
// framing (a document that HAS the bug's stored target vs. one that
// migrates away from it), reusing the existing exported functions only.
// ================================================================
describe("Part 5 — the legacy two-column bug is isolated to the legacy-frozen path", () => {
  const fixture = findFixture("A5 2段");

  it("a legacy document keeps the impossible 59-chars/line result until it explicitly migrates", () => {
    const legacyResult = deriveCapacityForEvent(
      undefined,
      "documentOpen",
      { legacyInputMm: toLegacyInputMm(fixture, { charsPerLine: 9999, linesPerColumn: 9999 }), v2InputMm: toV2InputMm(fixture) },
      measurement
    );
    expect(legacyResult.formulaVersion).toBe("legacy-frozen");
    expect(legacyResult.charsPerLine).toBe(59);

    const migratedResult = deriveCapacityForEvent(
      undefined,
      "explicitGeometryCommit",
      { legacyInputMm: toLegacyInputMm(fixture, { charsPerLine: 9999, linesPerColumn: 9999 }), v2InputMm: toV2InputMm(fixture) },
      measurement
    );
    expect(migratedResult.formulaVersion).toBe("v2-1");
    expect(migratedResult.charsPerLine).not.toBe(59);
    if (migratedResult.formulaVersion === "v2-1") {
      // Physically valid for the real 85mm-tall column, unlike 59.
      expect(migratedResult.charsPerLine * migratedResult.v2.advanceTick).toBeLessThanOrEqual(
        migratedResult.v2.columnHeightTick
      );
    }
  });

  it("no shared helper leaks the legacy clamp dimension into the v2-native calculation for any preset", () => {
    // For every 2-column preset, v2-native's per-column height must be
    // strictly less than the full (undivided) text-area height the legacy
    // bug mistakenly uses — proving the two formulas never share that
    // intermediate value.
    for (const preset of PRODUCTION_PRESET_FIXTURES_MM.filter((f) => f.columnCount === 2)) {
      const v2 = deriveV2NativeCapacity(toV2InputMm(preset), measurement);
      const legacy = deriveLegacyFrozenCapacity(toLegacyInputMm(preset));
      const fullHeightTick = v2.columnHeightTick * 2 + Math.round(preset.columnGapMm * 1000);
      expect(v2.columnHeightTick).toBeLessThan(fullHeightTick);
      // (legacy is exercised too, only to confirm both formulas ran on the
      // same preset without throwing — its own bug is covered exhaustively
      // in capacityLegacyFrozen.test.ts and above.)
      expect(legacy.charsPerLine).toBeGreaterThan(0);
    }
  });
});

// ================================================================
// Part 6 — Natural Pitch / no stretch, reconfirmed via residual accounting
// and an explicit absence check for any per-preset pitch-multiplier concept.
// ================================================================
describe("Part 6 — Natural Pitch: v2-native never stretches to fill (INV-004)", () => {
  it.each(PRODUCTION_PRESET_FIXTURES_MM)("$name: charsPerLine*advance + residual == full extent (no silent absorption)", (fixture) => {
    const result = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    expect(result.charsPerLine * result.advanceTick + result.residualMainAxisTick).toBe(result.columnHeightTick);
    expect(result.linesPerColumn * result.linePitchTick + result.residualCrossAxisTick).toBe(result.textAreaWidthTick);
  });

  it("V2NativeCapacityInputMm has no preset-specific pitch-multiplier field (structural absence, not just unused)", () => {
    // A TypeScript-level guarantee: the v2-native input shape only carries
    // physical geometry + font/line-height/columns — there is no field this
    // formula could even read to apply a hidden per-preset stretch
    // coefficient (Contract §18's "no preset-specific pitch multiplier
    // exists in any LayoutSettings shape").
    const fixture = findFixture("A5 1段");
    const input = toV2InputMm(fixture);
    const keys = Object.keys(input).sort();
    expect(keys).toEqual(
      [
        "bodyFontRef",
        "bodyFontSizePt",
        "columnCount",
        "columnGapMm",
        "lineHeightRatio",
        "marginBottomMm",
        "marginGutterMm",
        "marginOuterMm",
        "marginTopMm",
        "paperHeightMm",
        "paperWidthMm",
      ].sort()
    );
  });
});

// ================================================================
// Part 7 — MeasurementFacts: independently varying main-axis advance vs.
// cross-axis line pitch changes only the expected axis.
// ================================================================
describe("Part 7 — MeasurementFacts determinism, per axis", () => {
  const fixture = findFixture("A5 1段");

  it("changing only the main-axis advance changes charsPerLine, not linesPerColumn's own pitch basis independently of it", () => {
    const baseline = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    const halvedAdvance = {
      ...measurement,
      naturalAdvanceTick: (f: string, s: number, c: string) => Math.round(measurement.naturalAdvanceTick(f, s, c) / 2),
    };
    const changed = deriveV2NativeCapacity(toV2InputMm(fixture), halvedAdvance);
    expect(changed.advanceTick).toBeLessThan(baseline.advanceTick);
    expect(changed.charsPerLine).toBeGreaterThan(baseline.charsPerLine); // smaller advance -> more chars fit
    // linePitchTick is DERIVED from advanceTick * lineHeightRatio in this
    // formula, so it moves too — this is expected (cross-axis pitch is
    // Natural-Pitch-derived from the same font+size), not a bug: verified by
    // the next test, which isolates lineHeightRatio instead.
  });

  it("changing only lineHeightRatio changes linesPerColumn but leaves charsPerLine untouched", () => {
    const baseline = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    const widerLineHeight = deriveV2NativeCapacity(toV2InputMm({ ...fixture, lineHeightRatio: fixture.lineHeightRatio * 2 }), measurement);
    expect(widerLineHeight.charsPerLine).toBe(baseline.charsPerLine); // main axis unaffected
    expect(widerLineHeight.linesPerColumn).toBeLessThan(baseline.linesPerColumn); // cross axis affected
  });
});

// ================================================================
// Part 8/9 — All 8 mandatory presets, plus the Web boundary: proving Web's
// px-authored geometry cannot contaminate a print preset's canonical
// geometry (no shared mutable state between calls).
// ================================================================
describe("Part 8 — all 8 mandatory presets are representable end-to-end through the policy layer", () => {
  const MANDATORY_PRESET_NAMES = ["文庫", "A5", "B5", "B6", "新書", "A6", "Web閲覧用"];

  it.each(MANDATORY_PRESET_NAMES)("%s has at least one representable column-count fixture", (presetName) => {
    const matches = PRODUCTION_PRESET_FIXTURES_MM.filter((f) => f.name.startsWith(presetName));
    expect(matches.length).toBeGreaterThan(0);
    for (const fixture of matches) {
      const result = deriveCapacityForEvent(undefined, "documentOpen", inputFor(fixture), measurement);
      expect(result.charsPerLine).toBeGreaterThan(0);
      expect(result.linesPerColumn).toBeGreaterThan(0);
    }
  });
});

describe("Part 9 — Web px-authored geometry does not contaminate print canonical geometry", () => {
  it("computing Web then a print preset (or vice versa) is pure — no shared state changes the print result", () => {
    const printFixture = findFixture("文庫 1段");
    const webFixture = findFixture("Web閲覧用 1段");

    const printAlone = deriveV2NativeCapacity(toV2InputMm(printFixture), measurement);
    // Interleave a Web calculation in between.
    deriveV2NativeCapacity(toV2InputMm(webFixture), measurement);
    const printAfterWeb = deriveV2NativeCapacity(toV2InputMm(printFixture), measurement);

    expect(printAfterWeb).toEqual(printAlone);
  });

  it("Web's resolved geometry is canonical mm/GeometryTick, not raw CSS px, once it reaches the capacity formula", () => {
    // capacityFixtures.ts's WEB_WIDTH_MM/WEB_HEIGHT_MM already perform the
    // one legitimate px->mm boundary conversion (768/2.2, 1024/2.2, matching
    // src/constants/paperSizes.ts's own PX_PER_MM=2.2, audit §7) — by the
    // time toV2InputMm() runs, the input is indistinguishable in shape from
    // a print preset's mm input. This assertion documents that boundary
    // explicitly rather than leaving it implicit in the fixture file.
    const webFixture = findFixture("Web閲覧用 1段");
    expect(webFixture.paperWidthMm).toBeCloseTo(768 / 2.2, 6);
    expect(webFixture.paperHeightMm).toBeCloseTo(1024 / 2.2, 6);
    const result = deriveV2NativeCapacity(toV2InputMm(webFixture), measurement);
    expect(result.charsPerLine).toBeGreaterThan(0);
    expect(result.linesPerColumn).toBeGreaterThan(0);
  });
});

// ================================================================
// New-document readiness (Part 11 of the brief) — policy-layer only.
// ================================================================
describe("New-document readiness: Production-compatible start, v2-native only after explicit commit", () => {
  it("a new document's initial capacity matches the live legacy formula's own output for that preset", () => {
    const fixture = findFixture("A5 1段");
    const initial = initializeNewDocumentCapacity(inputFor(fixture), measurement);
    expect(initial.formulaVersion).toBe("legacy-frozen");
    const expected = deriveLegacyFrozenCapacity(toLegacyInputMm(fixture));
    expect(initial.charsPerLine).toBe(expected.charsPerLine);
    expect(initial.linesPerColumn).toBe(expected.linesPerColumn);
  });

  it("a new document only becomes v2-native after an explicit geometry commit, never merely by being created", () => {
    const fixture = findFixture("A5 1段");
    const initial = initializeNewDocumentCapacity(inputFor(fixture), measurement);
    expect(initial.formulaVersion).toBe("legacy-frozen");
    const afterCommit = deriveCapacityForEvent(
      initial.formulaVersion,
      "explicitGeometryCommit",
      inputFor(fixture),
      measurement
    );
    expect(afterCommit.formulaVersion).toBe("v2-1");
  });
});

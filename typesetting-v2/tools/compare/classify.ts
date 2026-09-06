// Stage C — diff classification (Stage C brief's own "DIFF CLASSIFICATION"
// section). A mechanical differ produces raw structural diffs against the
// normalized ComparisonDocument model; a fixture's own, hand-authored
// `FixtureExpectations` then reclassifies any raw UNEXPECTED_DIFFERENCE the
// fixture author already knows the reason for (a frozen Contract decision,
// a still-OPEN item, an adapter-boundary limitation) into EXPECTED_DIFFERENCE
// or NOT_COMPARABLE_YET, each carrying an explicit reason code — never a
// bare "expected" (per the brief's own instruction). Anything the fixture
// did NOT declare in advance stays UNEXPECTED_DIFFERENCE: this file never
// invents a justification after the fact.

import type { ComparisonDocument, ComparisonUnitKind } from "./normalize";

export type DiffCategory = "MATCH" | "EXPECTED_DIFFERENCE" | "UNEXPECTED_DIFFERENCE" | "NOT_COMPARABLE_YET";
export type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface DiffEntry {
  path: string;
  category: DiffCategory;
  severity: Severity;
  reasonCode?: string;
  legacyValue: string;
  v2Value: string;
  notes?: string;
}

export interface ExpectedDifferenceRule {
  /** A diff whose `path` starts with this prefix is a candidate match. */
  pathPrefix: string;
  reasonCode: string;
  severity: Severity;
  notes: string;
}

export interface FixtureExpectations {
  expectedDifferences: ExpectedDifferenceRule[];
  notComparable: ExpectedDifferenceRule[];
  // legacy encodes dash/ellipsis as plain TEXT tokens (nowrap-grouped only
  // at pagination time); v2 encodes them as a distinct SEMANTIC_RUN unit
  // (Core Contract §11). Real, intentional, already-disclosed representational
  // difference (not a bug on either side) — when true, a line's unitKinds
  // sequence is compared with TEXT and SEMANTIC_RUN treated as the same
  // "kind" for equivalence purposes, so this labeling difference doesn't
  // drown the text-content comparison that actually matters.
  treatTextSemanticRunEquivalent?: boolean;
}

export const NO_EXPECTATIONS: FixtureExpectations = { expectedDifferences: [], notComparable: [] };

function rawDiff(
  path: string,
  category: DiffCategory,
  severity: Severity,
  legacyValue: string,
  v2Value: string,
  notes?: string
): DiffEntry {
  return { path, category, severity, legacyValue, v2Value, notes };
}

function reclassify(diff: DiffEntry, expectations: FixtureExpectations): DiffEntry {
  if (diff.category !== "UNEXPECTED_DIFFERENCE") return diff;
  const expected = expectations.expectedDifferences.find((r) => diff.path.startsWith(r.pathPrefix));
  if (expected) {
    return { ...diff, category: "EXPECTED_DIFFERENCE", severity: expected.severity, reasonCode: expected.reasonCode, notes: expected.notes };
  }
  const notComparable = expectations.notComparable.find((r) => diff.path.startsWith(r.pathPrefix));
  if (notComparable) {
    return { ...diff, category: "NOT_COMPARABLE_YET", severity: notComparable.severity, reasonCode: notComparable.reasonCode, notes: notComparable.notes };
  }
  return diff;
}

function concatAllText(doc: ComparisonDocument): string {
  return doc.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.map((l) => l.text))).join("");
}

// A lone (unpaired) UTF-16 surrogate half, on either side of a LINE
// boundary specifically — never inside `concatAllText`'s own re-joined
// string, since simply concatenating two strings back together always
// trivially reconstructs a surrogate pair that was merely split between
// them (string concatenation doesn't "know" about the split at all). This
// is exactly why source-integrity checks alone (loss/duplication) cannot
// detect this class of corruption — it has to be checked per-LINE, where
// the split actually manifests as a real, displayable lone surrogate.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function findLoneSurrogateLine(doc: ComparisonDocument): string | null {
  for (let p = 0; p < doc.pages.length; p++) {
    const page = doc.pages[p];
    for (let c = 0; c < page.columns.length; c++) {
      const column = page.columns[c];
      for (let li = 0; li < column.lines.length; li++) {
        if (LONE_SURROGATE.test(column.lines[li].text)) {
          return `page[${p}].column[${c}].line[${li}]`;
        }
      }
    }
  }
  return null;
}

const KIND_EQUIVALENCE_KEY = (kind: ComparisonUnitKind, treatTextSemanticRunEquivalent: boolean): string =>
  treatTextSemanticRunEquivalent && (kind === "TEXT" || kind === "SEMANTIC_RUN") ? "TEXT_OR_SEMANTIC_RUN" : kind;

// Legacy groups an unbroken run of plain characters into ONE "text" token
// (one array entry); v2 atomizes a TextUnit into one PlacedUnit per
// grapheme cluster (confirmed by direct fixture testing — see this
// harness's own `compare.test.ts`). Comparing raw per-atom kind arrays
// would therefore show "TEXT" vs "TEXT,TEXT,TEXT,..." on nearly every line
// of every fixture — a real granularity difference between the two
// engines' OWN internal representations, not a logical difference in what
// content is where. Collapsing consecutive identical kinds before
// comparing keeps the signal meaningful: the KIND SEQUENCE (what shows up,
// in what order), not the atom count either engine happened to use.
function collapseRuns(kinds: ComparisonUnitKind[], treatTextSemanticRunEquivalent: boolean): ComparisonUnitKind[] {
  const collapsed: ComparisonUnitKind[] = [];
  for (const kind of kinds) {
    const prev = collapsed[collapsed.length - 1];
    if (prev === undefined || KIND_EQUIVALENCE_KEY(prev, treatTextSemanticRunEquivalent) !== KIND_EQUIVALENCE_KEY(kind, treatTextSemanticRunEquivalent)) {
      collapsed.push(kind);
    }
  }
  return collapsed;
}

function kindsEqual(a: ComparisonUnitKind[], b: ComparisonUnitKind[], treatTextSemanticRunEquivalent: boolean): boolean {
  const ca = collapseRuns(a, treatTextSemanticRunEquivalent);
  const cb = collapseRuns(b, treatTextSemanticRunEquivalent);
  if (ca.length !== cb.length) return false;
  return ca.every((k, i) => KIND_EQUIVALENCE_KEY(k, treatTextSemanticRunEquivalent) === KIND_EQUIVALENCE_KEY(cb[i], treatTextSemanticRunEquivalent));
}

/**
 * Compares two normalized ComparisonDocuments and returns every raw diff,
 * reclassified per the fixture's own declared expectations. Order:
 * document-level (page count, concatenated text = source-integrity proxy),
 * then per-page (source span, manual break), then per-column/line (text,
 * unit kinds) — matching the Stage C brief's own HIGH/MEDIUM/LOW guidance
 * (source loss/duplication and manual-break/order issues are HIGH; a
 * localized line-break difference is MEDIUM; kind-labeling detail is LOW).
 */
export function compareDocuments(
  legacy: ComparisonDocument,
  v2: ComparisonDocument,
  expectations: FixtureExpectations = NO_EXPECTATIONS
): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  // Document-level: concatenated flowed text is the source-integrity proxy
  // (§ "no source unit lost/duplicated") — robust to mere re-grouping of
  // lines/pages, unlike a positional per-line comparison.
  const legacyText = concatAllText(legacy);
  const v2Text = concatAllText(v2);
  diffs.push(
    rawDiff(
      "document.concatenatedText",
      legacyText === v2Text ? "MATCH" : "UNEXPECTED_DIFFERENCE",
      "HIGH",
      legacyText,
      v2Text,
      legacyText === v2Text ? undefined : "concatenated flowed text differs between engines — possible source loss/duplication or genuine content-encoding difference"
    )
  );

  // Distinct from the concatenated-text check above: a lone (unpaired)
  // surrogate half on either side of a LINE boundary is a real, displayable
  // corruption that simple concatenation cannot detect (concatenation
  // always trivially rejoins a split pair). Each engine is checked
  // independently — a genuinely useful signal even standing alone, since
  // v2's INV-011 guarantees this is always null on v2's side.
  const legacyLoneSurrogateLine = findLoneSurrogateLine(legacy);
  const v2LoneSurrogateLine = findLoneSurrogateLine(v2);
  diffs.push(
    rawDiff(
      "document.concatenatedText.surrogatePairIntegrity",
      legacyLoneSurrogateLine === null && v2LoneSurrogateLine === null ? "MATCH" : "UNEXPECTED_DIFFERENCE",
      "HIGH",
      legacyLoneSurrogateLine ?? "<none>",
      v2LoneSurrogateLine ?? "<none>",
      legacyLoneSurrogateLine || v2LoneSurrogateLine
        ? `lone surrogate half found at ${legacyLoneSurrogateLine ?? v2LoneSurrogateLine} — a supplementary-plane character was split across a line boundary`
        : undefined
    )
  );

  diffs.push(
    rawDiff(
      "document.hold",
      legacy.hold === v2.hold ? "MATCH" : "UNEXPECTED_DIFFERENCE",
      "HIGH",
      String(legacy.hold),
      String(v2.hold),
      v2.holdReasons.join("; ") || undefined
    )
  );

  diffs.push(
    rawDiff(
      "pages.length",
      legacy.pages.length === v2.pages.length ? "MATCH" : "UNEXPECTED_DIFFERENCE",
      "HIGH",
      String(legacy.pages.length),
      String(v2.pages.length)
    )
  );

  const pageCount = Math.max(legacy.pages.length, v2.pages.length);
  for (let p = 0; p < pageCount; p++) {
    const lp = legacy.pages[p];
    const vp = v2.pages[p];
    if (!lp || !vp) {
      diffs.push(
        rawDiff(`page[${p}]`, "UNEXPECTED_DIFFERENCE", "HIGH", lp ? "present" : "<missing>", vp ? "present" : "<missing>", "page present on only one side")
      );
      continue;
    }

    diffs.push(
      rawDiff(
        `page[${p}].manualBreakBefore`,
        lp.manualBreakBefore === vp.manualBreakBefore ? "MATCH" : "UNEXPECTED_DIFFERENCE",
        "HIGH",
        String(lp.manualBreakBefore),
        String(vp.manualBreakBefore)
      )
    );

    const colCount = Math.max(lp.columns.length, vp.columns.length);
    for (let c = 0; c < colCount; c++) {
      const lc = lp.columns[c];
      const vc = vp.columns[c];
      if (!lc || !vc) {
        diffs.push(
          rawDiff(`page[${p}].column[${c}]`, "UNEXPECTED_DIFFERENCE", "HIGH", lc ? "present" : "<missing>", vc ? "present" : "<missing>", "column present on only one side")
        );
        continue;
      }

      diffs.push(
        rawDiff(
          `page[${p}].column[${c}].lines.length`,
          lc.lines.length === vc.lines.length ? "MATCH" : "UNEXPECTED_DIFFERENCE",
          "MEDIUM",
          String(lc.lines.length),
          String(vc.lines.length)
        )
      );

      const lineCount = Math.max(lc.lines.length, vc.lines.length);
      for (let li = 0; li < lineCount; li++) {
        const ll = lc.lines[li];
        const vl = vc.lines[li];
        const path = `page[${p}].column[${c}].line[${li}]`;
        if (!ll || !vl) {
          diffs.push(rawDiff(`${path}`, "UNEXPECTED_DIFFERENCE", "MEDIUM", ll ? ll.text : "<missing>", vl ? vl.text : "<missing>", "line present on only one side"));
          continue;
        }
        diffs.push(rawDiff(`${path}.text`, ll.text === vl.text ? "MATCH" : "UNEXPECTED_DIFFERENCE", "MEDIUM", ll.text, vl.text));
        const treatEquiv = expectations.treatTextSemanticRunEquivalent ?? false;
        diffs.push(
          rawDiff(
            `${path}.unitKinds`,
            kindsEqual(ll.unitKinds, vl.unitKinds, treatEquiv) ? "MATCH" : "UNEXPECTED_DIFFERENCE",
            "LOW",
            collapseRuns(ll.unitKinds, treatEquiv).join(","),
            collapseRuns(vl.unitKinds, treatEquiv).join(",")
          )
        );
      }
    }
  }

  return diffs.map((d) => reclassify(d, expectations));
}

export interface ClassificationSummary {
  match: number;
  expectedDifference: number;
  unexpectedDifference: number;
  notComparableYet: number;
  unexpectedHigh: number;
  unexpectedEntries: DiffEntry[];
}

export function summarize(diffs: DiffEntry[]): ClassificationSummary {
  const summary: ClassificationSummary = {
    match: 0,
    expectedDifference: 0,
    unexpectedDifference: 0,
    notComparableYet: 0,
    unexpectedHigh: 0,
    unexpectedEntries: [],
  };
  for (const d of diffs) {
    if (d.category === "MATCH") summary.match += 1;
    else if (d.category === "EXPECTED_DIFFERENCE") summary.expectedDifference += 1;
    else if (d.category === "NOT_COMPARABLE_YET") summary.notComparableYet += 1;
    else {
      summary.unexpectedDifference += 1;
      summary.unexpectedEntries.push(d);
      if (d.severity === "HIGH") summary.unexpectedHigh += 1;
    }
  }
  return summary;
}

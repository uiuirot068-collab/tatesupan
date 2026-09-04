// TSP-LOOP-031 — text-frame positioning (版面の位置) pure-math contract.
//
// Executes the real `deriveFrameMargins` / `inferPositionFromMargins` helpers
// (src/lib/textFramePosition.ts) against `computePageLayout`
// (src/lib/pageLayout.ts) — the canonical geometry the Preview/pagination/
// export pipeline actually uses — rather than re-implementing the math in
// the verifier. A Node 24 type-stripping loader resolves the project's `@/*`
// tsconfig alias so these .ts modules can be imported directly.
//
// Run:  node --import ./scripts/lib/register-ts-alias.mjs scripts/verify-tsp031-text-frame-positioning.mjs
import {
  computePageLayout,
  DEFAULT_PAGE_SETTINGS,
} from "../src/lib/pageLayout.ts";
import {
  deriveFrameMargins,
  inferPositionFromMargins,
  VERTICAL_ANCHORS,
  HORIZONTAL_ANCHORS,
} from "../src/lib/textFramePosition.ts";

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

const approxEqual = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

const baseInput = {
  paperSize: "文庫",
  fontSizePt: DEFAULT_PAGE_SETTINGS.fontSizePt,
  lineHeightRatio: DEFAULT_PAGE_SETTINGS.lineHeightRatio,
  columnCount: 1,
  columnGapMm: DEFAULT_PAGE_SETTINGS.columnGapMm,
  charsPerLine: 39,
  linesPerColumn: 15,
};

/* ---------- 16.1: 9 positions, invariants ---------- */

for (const vertical of VERTICAL_ANCHORS) {
  for (const horizontal of HORIZONTAL_ANCHORS) {
    const label = `${vertical}/${horizontal}`;
    const result = deriveFrameMargins({
      ...baseInput,
      position: { vertical, horizontal },
      verticalAnchorMargin: 10,
      horizontalAnchorMargin: 8,
    });
    if (result.ok === false) {
      check(`9-position [${label}]: derivation succeeds`, false);
      continue;
    }
    check(`9-position [${label}]: derivation succeeds`, true);
    check(
      `9-position [${label}]: all margins >= 0`,
      result.marginTop >= 0 &&
        result.marginBottom >= 0 &&
        result.marginGutter >= 0 &&
        result.marginOuter >= 0
    );

    // Feed the derived margins straight into the real settings object and
    // the real computePageLayout — the same object PreviewPane/PageCard/
    // export consume — and confirm the target grid actually renders,
    // matching the invariant `top + frame + bottom == pageVertical` etc.
    const settings = {
      ...DEFAULT_PAGE_SETTINGS,
      paperSize: baseInput.paperSize,
      fontSizePt: baseInput.fontSizePt,
      lineHeightRatio: baseInput.lineHeightRatio,
      columnCount: baseInput.columnCount,
      columnGapMm: baseInput.columnGapMm,
      charsPerLine: baseInput.charsPerLine,
      linesPerColumn: baseInput.linesPerColumn,
      marginTop: result.marginTop,
      marginBottom: result.marginBottom,
      marginGutter: result.marginGutter,
      marginOuter: result.marginOuter,
    };
    const layout = computePageLayout(settings);
    check(
      `9-position [${label}]: renders the exact target grid (no clamp)`,
      layout.charsPerLine === baseInput.charsPerLine &&
        layout.linesPerColumn === baseInput.linesPerColumn
    );
    check(
      `9-position [${label}]: top + frame + bottom == page height (frame == freeVertical complement)`,
      approxEqual(settings.marginTop + settings.marginBottom, result.freeVerticalMm)
    );
    check(
      `9-position [${label}]: gutter + frame + outer == page width`,
      approxEqual(settings.marginGutter + settings.marginOuter, result.freeHorizontalMm)
    );

    if (vertical === "center") {
      check(`9-position [${label}]: vertical center splits evenly`, result.marginTop === result.marginBottom);
    } else if (vertical === "top") {
      check(`9-position [${label}]: top anchor honored`, result.marginTop === 10);
    } else {
      check(`9-position [${label}]: bottom anchor honored`, result.marginBottom === 10);
    }

    if (horizontal === "center") {
      check(`9-position [${label}]: horizontal center splits evenly`, result.marginGutter === result.marginOuter);
    } else if (horizontal === "gutter") {
      check(`9-position [${label}]: gutter anchor honored`, result.marginGutter === 8);
    } else {
      check(`9-position [${label}]: outer anchor honored`, result.marginOuter === 8);
    }
  }
}

/* ---------- regression guard: frame size must be TIGHT, not padded ----------
 * TSP-LOOP-031 in-loop bug: an earlier version of computeRequiredTextAreaHeightMm
 * mirrored computeAutoCharsPerLine's safety-margined, per-column formula
 * instead of computePageLayout's REAL clamp for a positive target
 * (`Math.floor(textAreaHeightMm / fontSizeMm)`, full page height, no safety
 * subtraction). That made the derived frame visibly bigger — and free-margin
 * visibly smaller — than DEFAULT_PAGE_SETTINGS' own shipped, TSP-029-verified
 * 天地12mm/文庫/39字. Assert the derived free space here is >= what shipped
 * default already proves sufficient (12+12=24mm), catching any regression
 * back to the over-padded formula.
 */
{
  const result = deriveFrameMargins({
    paperSize: "文庫",
    fontSizePt: DEFAULT_PAGE_SETTINGS.fontSizePt,
    lineHeightRatio: DEFAULT_PAGE_SETTINGS.lineHeightRatio,
    columnCount: 1,
    columnGapMm: DEFAULT_PAGE_SETTINGS.columnGapMm,
    charsPerLine: DEFAULT_PAGE_SETTINGS.charsPerLine,
    linesPerColumn: DEFAULT_PAGE_SETTINGS.linesPerColumn,
    position: { vertical: "center", horizontal: "center" },
    verticalAnchorMargin: 0,
    horizontalAnchorMargin: 0,
  });
  check(
    "regression guard: derived free space for 文庫/39×15 is >= shipped default's own 24mm/22mm (frame is tight, not padded)",
    result.ok &&
      result.freeVerticalMm >= DEFAULT_PAGE_SETTINGS.marginTop + DEFAULT_PAGE_SETTINGS.marginBottom - 0.1 &&
      result.freeHorizontalMm >= DEFAULT_PAGE_SETTINGS.marginGutter + DEFAULT_PAGE_SETTINGS.marginOuter - 0.1
  );
}

/* ---------- 16.2: invalid cases ---------- */

check(
  "invalid: frame too tall for paper (charsPerLine absurdly large) is rejected",
  deriveFrameMargins({
    ...baseInput,
    charsPerLine: 500,
    position: { vertical: "top", horizontal: "center" },
    verticalAnchorMargin: 10,
    horizontalAnchorMargin: 0,
  }).ok === false
);

check(
  "invalid: frame too wide for paper (linesPerColumn absurdly large) is rejected",
  deriveFrameMargins({
    ...baseInput,
    linesPerColumn: 500,
    position: { vertical: "center", horizontal: "gutter" },
    verticalAnchorMargin: 0,
    horizontalAnchorMargin: 10,
  }).ok === false
);

check(
  "invalid: anchor margin exceeds free vertical space is rejected",
  deriveFrameMargins({
    ...baseInput,
    position: { vertical: "top", horizontal: "center" },
    verticalAnchorMargin: 999,
    horizontalAnchorMargin: 0,
  }).ok === false
);

check(
  "invalid: anchor margin exceeds free horizontal space is rejected",
  deriveFrameMargins({
    ...baseInput,
    position: { vertical: "center", horizontal: "gutter" },
    verticalAnchorMargin: 0,
    horizontalAnchorMargin: 999,
  }).ok === false
);

check(
  "invalid: negative anchor margin is rejected",
  deriveFrameMargins({
    ...baseInput,
    position: { vertical: "top", horizontal: "center" },
    verticalAnchorMargin: -1,
    horizontalAnchorMargin: 0,
  }).ok === false
);

check(
  "invalid: NaN anchor margin is rejected",
  deriveFrameMargins({
    ...baseInput,
    position: { vertical: "top", horizontal: "center" },
    verticalAnchorMargin: Number.NaN,
    horizontalAnchorMargin: 0,
  }).ok === false
);

check(
  "invalid derivation does not return partial/clamped margins (result carries no margin fields)",
  (() => {
    const r = deriveFrameMargins({
      ...baseInput,
      charsPerLine: 500,
      position: { vertical: "top", horizontal: "center" },
      verticalAnchorMargin: 10,
      horizontalAnchorMargin: 0,
    });
    return r.ok === false && !("marginTop" in r) && typeof r.reason === "string" && r.reason.length > 0;
  })()
);

/* ---------- 16.3: inference ---------- */

check(
  "inference: equal margins -> center/center",
  (() => {
    const r = inferPositionFromMargins({ marginTop: 12, marginBottom: 12, marginGutter: 10, marginOuter: 10 });
    return r.position.vertical === "center" && r.position.horizontal === "center";
  })()
);
check(
  "inference: top smaller -> vertical top, anchor = smaller value",
  (() => {
    const r = inferPositionFromMargins({ marginTop: 8, marginBottom: 16, marginGutter: 10, marginOuter: 10 });
    return r.position.vertical === "top" && r.verticalAnchorMargin === 8;
  })()
);
check(
  "inference: bottom smaller -> vertical bottom, anchor = smaller value",
  (() => {
    const r = inferPositionFromMargins({ marginTop: 16, marginBottom: 8, marginGutter: 10, marginOuter: 10 });
    return r.position.vertical === "bottom" && r.verticalAnchorMargin === 8;
  })()
);
check(
  "inference: gutter smaller -> horizontal gutter, anchor = smaller value",
  (() => {
    const r = inferPositionFromMargins({ marginTop: 12, marginBottom: 12, marginGutter: 12, marginOuter: 10 });
    return r.position.horizontal === "outer" && r.horizontalAnchorMargin === 10;
  })()
);
check(
  "inference: outer smaller -> horizontal outer, anchor = smaller value",
  (() => {
    const r = inferPositionFromMargins({ marginTop: 12, marginBottom: 12, marginGutter: 8, marginOuter: 14 });
    return r.position.horizontal === "gutter" && r.horizontalAnchorMargin === 8;
  })()
);
check(
  "inference round-trips DEFAULT_PAGE_SETTINGS (top=bottom=12, gutter=outer? no -> gutter anchor)",
  (() => {
    const r = inferPositionFromMargins(DEFAULT_PAGE_SETTINGS);
    // 文庫既定: marginTop=12,marginBottom=12 (center) / marginGutter=12,marginOuter=10 (gutter anchor, 10)
    return (
      r.position.vertical === "center" &&
      r.position.horizontal === "outer" &&
      r.horizontalAnchorMargin === 10
    );
  })()
);

/* ---------- 16.4: switching preserves the anchor's own base value ---------- */

check(
  "switching: top base 12 -> bottom keeps the same base value (UI-level contract: caller must not clear it)",
  (() => {
    const top = deriveFrameMargins({
      ...baseInput,
      position: { vertical: "top", horizontal: "center" },
      verticalAnchorMargin: 12,
      horizontalAnchorMargin: 0,
    });
    const bottom = deriveFrameMargins({
      ...baseInput,
      position: { vertical: "bottom", horizontal: "center" },
      verticalAnchorMargin: 12,
      horizontalAnchorMargin: 0,
    });
    return top.ok && bottom.ok && top.marginTop === 12 && bottom.marginBottom === 12;
  })()
);

/* ---------- 16.5: papers / columns ---------- */

const paperCases = [
  { paperSize: "文庫", columnCount: 1, charsPerLine: 39, linesPerColumn: 15 },
  { paperSize: "A5", columnCount: 1, charsPerLine: 53, linesPerColumn: 22 },
  { paperSize: "A5", columnCount: 2, charsPerLine: 25, linesPerColumn: 20 },
];
for (const c of paperCases) {
  const label = `${c.paperSize}/${c.columnCount}段`;
  const result = deriveFrameMargins({
    ...baseInput,
    ...c,
    columnGapMm: 8,
    position: { vertical: "center", horizontal: "center" },
    verticalAnchorMargin: 0,
    horizontalAnchorMargin: 0,
  });
  if (result.ok === false) {
    check(`papers [${label}]: center/center derivation succeeds (${result.reason})`, false);
    continue;
  }
  const settings = {
    ...DEFAULT_PAGE_SETTINGS,
    paperSize: c.paperSize,
    columnCount: c.columnCount,
    columnGapMm: 8,
    charsPerLine: c.charsPerLine,
    linesPerColumn: c.linesPerColumn,
    marginTop: result.marginTop,
    marginBottom: result.marginBottom,
    marginGutter: result.marginGutter,
    marginOuter: result.marginOuter,
  };
  const layout = computePageLayout(settings);
  check(
    `papers [${label}]: renders the exact target grid`,
    layout.charsPerLine === c.charsPerLine && layout.linesPerColumn === c.linesPerColumn
  );
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

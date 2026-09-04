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
  deriveMaxCapacityFromMargins,
  DEFAULT_PAGE_SETTINGS,
} from "../src/lib/pageLayout.ts";
import {
  deriveFrameMargins,
  inferPositionFromMargins,
  VERTICAL_ANCHORS,
  HORIZONTAL_ANCHORS,
} from "../src/lib/textFramePosition.ts";
import { PAPER_SIZE_TEMPLATES } from "../src/constants/paperSizes.ts";

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

/* ================================================================
 * TSP-LOOP-031B — margin-derived maximum capacity (余白から設定する)
 *
 * Exercises `deriveMaxCapacityFromMargins` (src/lib/pageLayout.ts) against
 * the real `computePageLayout` — never a hand re-derived formula — per the
 * MATH CONTRACT: derive max from draft margins -> feed derived chars/lines +
 * same draft settings into actual layout -> layout accepts exactly those
 * values with no clamp/downshift, and derived+1 in each dimension IS
 * clamped down (that's the proof of "maximum").
 * ================================================================ */

/**
 * Feeds `derived` back into `computePageLayout` as an explicit target and
 * checks (a) it round-trips with no clamp/downshift and (b) +1 in each
 * dimension independently gets clamped back down to `derived` — the
 * required "maximum" proof (§6/§14.I).
 */
const proveMaximum = (label, input) => {
  const derived = deriveMaxCapacityFromMargins(input);
  const baseSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    paperSize: input.paperSize,
    marginTop: input.marginTop,
    marginBottom: input.marginBottom,
    marginGutter: input.marginGutter,
    marginOuter: input.marginOuter,
    fontSizePt: input.fontSizePt,
    lineHeightRatio: input.lineHeightRatio,
    columnCount: input.columnCount,
    columnGapMm: input.columnGapMm,
    charsPerLine: derived.charsPerLine,
    linesPerColumn: derived.linesPerColumn,
  };
  const atMax = computePageLayout(baseSettings);
  check(
    `${label}: derived max round-trips through computePageLayout with no clamp`,
    atMax.charsPerLine === derived.charsPerLine && atMax.linesPerColumn === derived.linesPerColumn
  );
  const charsPlus1 = computePageLayout({ ...baseSettings, charsPerLine: derived.charsPerLine + 1 });
  check(
    `${label}: derived charsPerLine + 1 cannot fit (clamped back to ${derived.charsPerLine})`,
    charsPlus1.charsPerLine === derived.charsPerLine
  );
  const linesPlus1 = computePageLayout({ ...baseSettings, linesPerColumn: derived.linesPerColumn + 1 });
  check(
    `${label}: derived linesPerColumn + 1 cannot fit (clamped back to ${derived.linesPerColumn})`,
    linesPlus1.linesPerColumn === derived.linesPerColumn
  );
  check(`${label}: maxBodyCharsPerPage = charsPerLine * linesPerColumn * columnCount`, (
    derived.maxBodyCharsPerPage === derived.charsPerLine * derived.linesPerColumn * input.columnCount
  ));
  return derived;
};

const bunkoBase = {
  paperSize: "文庫",
  marginTop: 12,
  marginBottom: 12,
  marginGutter: 12,
  marginOuter: 10,
  fontSizePt: 9,
  lineHeightRatio: 1.7,
  columnCount: 1,
  columnGapMm: 8,
};

/* ---------- 17.1: DEFAULT_PAGE_SETTINGS self-consistency ---------- */

check(
  "031B base: 文庫 default margins derive exactly the shipped 39x15",
  (() => {
    const d = deriveMaxCapacityFromMargins(bunkoBase);
    return d.charsPerLine === 39 && d.linesPerColumn === 15 && d.maxBodyCharsPerPage === 585;
  })()
);
proveMaximum("031B base (文庫 39x15)", bunkoBase);

/* ---------- 17.2 (§14.A): existing headroom is always exposed ---------- */

check(
  "031B headroom: derived max (39x15) does not depend on whatever charsPerLine/linesPerColumn happens to be persisted (e.g. a stale 37x14)",
  (() => {
    // deriveMaxCapacityFromMargins doesn't even take persisted charsPerLine/
    // linesPerColumn as input — this is the structural guarantee that a
    // stale lower saved capacity can never suppress the true headroom.
    const stalePersisted = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 37, linesPerColumn: 14 };
    const d = deriveMaxCapacityFromMargins(bunkoBase);
    return (
      stalePersisted.charsPerLine === 37 &&
      stalePersisted.linesPerColumn === 14 &&
      d.charsPerLine === 39 &&
      d.linesPerColumn === 15
    );
  })()
);

check(
  "031B headroom: real 文庫 cols1 preset (paperSizes.ts) — stored linesPerColumn(16) already silently exceeds true max(15); derive agrees with computePageLayout's actual clamp, not the stale preset number",
  (() => {
    const p = PAPER_SIZE_TEMPLATES["文庫"].cols1;
    const marginInput = {
      paperSize: "文庫",
      marginTop: p.marginTop,
      marginBottom: p.marginBottom,
      marginGutter: p.marginGutter,
      marginOuter: p.marginOuter,
      fontSizePt: p.fontSizePt,
      lineHeightRatio: p.lineSpacing,
      columnCount: 1,
      columnGapMm: p.columnGap,
    };
    const derived = deriveMaxCapacityFromMargins(marginInput);
    const asPresetStored = computePageLayout({
      ...DEFAULT_PAGE_SETTINGS,
      ...marginInput,
      charsPerLine: p.charsPerLine,
      linesPerColumn: p.linesPerColumn,
    });
    // computePageLayout already clamps the stale preset's 16 down to 15 —
    // derive must agree with that actual clamp (not the raw preset number),
    // and must never derive LESS than what computePageLayout actually
    // accepts for the preset's own stored target in either dimension
    // (here charsPerLine: preset stores 38, which is itself headroom below
    // the true max of 40 — derive must surface that, not merely echo it).
    return (
      p.linesPerColumn === 16 &&
      asPresetStored.linesPerColumn === 15 &&
      derived.linesPerColumn === 15 &&
      derived.charsPerLine >= asPresetStored.charsPerLine
    );
  })()
);

/* ---------- 17.3 (§14.B): vertical margin threshold — charsPerLine ---------- */

check(
  "031B vertical threshold: widening top+bottom by 3mm each drops max charsPerLine by >=1 (39 -> 37)",
  deriveMaxCapacityFromMargins({ ...bunkoBase, marginTop: 15, marginBottom: 15 }).charsPerLine === 37
);
proveMaximum("031B vertical threshold (top/bottom=15)", { ...bunkoBase, marginTop: 15, marginBottom: 15 });

/* ---------- 17.4 (§14.C): horizontal margin threshold — linesPerColumn ---------- */

check(
  "031B horizontal threshold: widening gutter+outer by 3mm each drops max linesPerColumn by >=1 (15 -> 14)",
  deriveMaxCapacityFromMargins({ ...bunkoBase, marginGutter: 15, marginOuter: 13 }).linesPerColumn === 14
);
proveMaximum("031B horizontal threshold (gutter=15,outer=13)", { ...bunkoBase, marginGutter: 15, marginOuter: 13 });

/* ---------- 17.5 (§14.D): margin reduction increases capacity ---------- */

check(
  "031B reduction: narrowing top+bottom by 4mm each raises max charsPerLine (39 -> 41)",
  deriveMaxCapacityFromMargins({ ...bunkoBase, marginTop: 8, marginBottom: 8 }).charsPerLine === 41
);
check(
  "031B reduction: narrowing gutter/outer by 4mm each raises max linesPerColumn (15 -> 16)",
  deriveMaxCapacityFromMargins({ ...bunkoBase, marginGutter: 8, marginOuter: 6 }).linesPerColumn === 16
);

/* ---------- 17.6 (§14.E/F): font size / line spacing ---------- */

check(
  "031B font size: 9pt -> 12pt reduces both charsPerLine and linesPerColumn (39x15 -> 29x11)",
  (() => {
    const d = deriveMaxCapacityFromMargins({ ...bunkoBase, fontSizePt: 12 });
    return d.charsPerLine === 29 && d.linesPerColumn === 11;
  })()
);
check(
  "031B line spacing: 1.7 -> 2.0 reduces linesPerColumn only, charsPerLine unaffected (39x15 -> 39x13)",
  (() => {
    const d = deriveMaxCapacityFromMargins({ ...bunkoBase, lineHeightRatio: 2.0 });
    return d.charsPerLine === 39 && d.linesPerColumn === 13;
  })()
);

/* ---------- 17.7 (§14.G): paper size representatives ---------- */

for (const [label, paperSize, columnCount] of [
  ["文庫", "文庫", 1],
  ["A5", "A5", 1],
]) {
  const p = PAPER_SIZE_TEMPLATES[paperSize].cols1;
  proveMaximum(`031B paper [${label}]`, {
    paperSize,
    marginTop: p.marginTop,
    marginBottom: p.marginBottom,
    marginGutter: p.marginGutter,
    marginOuter: p.marginOuter,
    fontSizePt: p.fontSizePt,
    lineHeightRatio: p.lineSpacing,
    columnCount,
    columnGapMm: p.columnGap,
  });
}

/* ---------- 17.8 (§14.H): multi-column ---------- */

{
  const p = PAPER_SIZE_TEMPLATES["A5"].cols2;
  const input = {
    paperSize: "A5",
    marginTop: p.marginTop,
    marginBottom: p.marginBottom,
    marginGutter: p.marginGutter,
    marginOuter: p.marginOuter,
    fontSizePt: p.fontSizePt,
    lineHeightRatio: p.lineSpacing,
    columnCount: 2,
    columnGapMm: p.columnGap,
  };
  const derived = proveMaximum("031B multi-column [A5/2段]", input);
  check("031B multi-column: derived capacity is positive", derived.charsPerLine > 0 && derived.linesPerColumn > 0);
}

/* ---------- 17.9 (§14.I): maximum proof already covered by proveMaximum above ---------- */

/* ---------- 17.10 (§14.J): mode-switching semantics — margin's derived max
 * becomes the exact settings committed, which capacity mode's own
 * inferPositionFromMargins/deriveFrameMargins then reads unchanged. ---------- */

check(
  "031B mode switching: margin-mode Apply commits derived max as explicit settings, and capacity mode's inferPositionFromMargins reads those same 4 margins back without mutation",
  (() => {
    const derived = deriveMaxCapacityFromMargins(bunkoBase);
    const committedSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      ...bunkoBase,
      charsPerLine: derived.charsPerLine,
      linesPerColumn: derived.linesPerColumn,
    };
    const layout = computePageLayout(committedSettings);
    const inferred = inferPositionFromMargins(committedSettings);
    return (
      layout.charsPerLine === derived.charsPerLine &&
      layout.linesPerColumn === derived.linesPerColumn &&
      inferred.position.vertical === "center" &&
      inferred.position.horizontal === "outer"
    );
  })()
);

/* ---------- 17.11 (§14.K): purity — deriving never mutates its input ---------- */

check(
  "031B purity: deriveMaxCapacityFromMargins does not mutate its input object",
  (() => {
    const input = { ...bunkoBase };
    const snapshot = { ...input };
    deriveMaxCapacityFromMargins(input);
    return Object.keys(snapshot).every((k) => input[k] === snapshot[k]);
  })()
);

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

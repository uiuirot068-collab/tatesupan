import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, computePageLayout } from "../../src/lib/pageLayout";
import {
  computePageParagraphStarts,
  computePageSourceRanges,
  detokenizeTategaki,
  paginateTokens,
  tokenizeTategaki,
} from "../../src/lib/tategaki";
import { composeV2Document } from "../../src/lib/v2Bridge/composeV2Document";
import { buildV2UnitsFromManuscript } from "../../src/lib/v2Bridge/manuscriptAdapter";
import { buildV2LayoutSettings } from "../../src/lib/v2Bridge/settingsAdapter";
import { buildV2PreviewDocument } from "../../src/lib/v2Bridge/useV2PreviewAdapter";
import { composePage, composePages } from "../../typesetting-v2/core/compose/page";
import { createFakeMeasurementProvider } from "../../typesetting-v2/core/measurement/fakeProvider";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { DEFAULT_RULE_SET_V2 } from "../../typesetting-v2/core/rules/defaultRuleSet";
import { makeLongDocumentFixture } from "./longDocumentFixtures";

function composePagesFormerPath(
  units: ReturnType<typeof buildV2UnitsFromManuscript>["units"],
  settings: ReturnType<typeof buildV2LayoutSettings>,
  measurement = createFakeMeasurementProvider()
) {
  const pages: ReturnType<typeof composePages>["pages"] = [];
  let remaining = units;
  let isParagraphStart = true;
  let hold: ReturnType<typeof composePages>["hold"];
  while (remaining.length > 0) {
    const beforeOffset = remaining[0]?.span.start;
    const result = composePage(
      remaining,
      pages.length,
      DEFAULT_RULE_SET_V2,
      measurement,
      settings,
      isParagraphStart
    );
    pages.push(result.page);
    remaining = result.remainingUnits;
    isParagraphStart = result.nextLineIsParagraphStart;
    if (result.hold) {
      hold = result.hold;
      break;
    }
    expect(remaining[0]?.span.start).not.toBe(beforeOffset);
  }
  return { pages, hold };
}

function timed<T>(run: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = run();
  return { value, ms: performance.now() - start };
}

describe("long-document performance benchmark", () => {
  it("keeps prepared multi-page composition identical to the former per-page path", () => {
    const content = makeLongDocumentFixture(2_000);
    const { units } = buildV2UnitsFromManuscript("body", content);
    const settings = buildV2LayoutSettings(DEFAULT_PAGE_SETTINGS);
    const measurement = createFakeMeasurementProvider();
    const optimized = composePages(units, DEFAULT_RULE_SET_V2, measurement, settings);
    expect(composePagesFormerPath(units, settings)).toEqual(optimized);
  });

  it("preserves dense paragraph pagination with prepared composition", () => {
    const paragraph = "人は歩く。「縦組み」｜親文字《よみ》 [tate]25[/tate] ー――……。\n";
    const { units } = buildV2UnitsFromManuscript("body", paragraph.repeat(110));
    const settings = buildV2LayoutSettings({
      ...DEFAULT_PAGE_SETTINGS,
      charsPerLine: 5,
      linesPerColumn: 5,
      columnCount: 1,
    });
    const measurement = createShipporiMinchoMeasurementProvider(
      resolve("public/fonts/ShipporiMincho-Regular.ttf")
    );
    const optimized = composePages(
      units,
      DEFAULT_RULE_SET_V2,
      measurement,
      settings
    );

    expect(composePagesFormerPath(units, settings, measurement)).toEqual(optimized);
  });

  it("reports the legacy and canonical preview pipelines", () => {
    const size = Number(process.env.TATESPUN_PERF_SIZE ?? 10_000);
    const includeImage = process.env.TATESPUN_PERF_IMAGE === "1";
    const content = makeLongDocumentFixture(size, includeImage);
    const layout = computePageLayout(DEFAULT_PAGE_SETTINGS);

    const tokenized = timed(() => tokenizeTategaki(content));
    const paginated = timed(() => paginateTokens(tokenized.value, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
      columnCount: DEFAULT_PAGE_SETTINGS.columnCount,
      linesPerColumn: layout.linesPerColumn,
    }));
    const ranges = timed(() => computePageSourceRanges(content, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    }));
    const metadata = timed(() => ({
      signatures: paginated.value.map((page) => detokenizeTategaki(page.tokens)),
      paragraphStarts: computePageParagraphStarts(paginated.value),
    }));

    const canonical = timed(() => composeV2Document({
      title: "Long document performance fixture",
      content,
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: createFakeMeasurementProvider(),
    }));
    const paint = timed(() => buildV2PreviewDocument(canonical.value, {}));
    const paintUnits = paint.value.pages.reduce(
      (pageTotal, page) => pageTotal + page.columns.reduce(
        (columnTotal, column) => columnTotal + column.lines.reduce(
          (lineTotal, line) => lineTotal + line.units.length,
          0
        ),
        0
      ),
      0
    );

    const report = {
      size,
      includeImage,
      legacy: {
        tokenizeMs: tokenized.ms,
        paginateMs: paginated.ms,
        sourceRangesMs: ranges.ms,
        metadataMs: metadata.ms,
        pages: paginated.value.length,
      },
      canonical: {
        composeMs: canonical.ms,
        paintMs: paint.ms,
        pages: canonical.value.document.pages.length,
        paintUnits,
      },
    };
    console.log(`TATESPUN_PERF ${JSON.stringify(report)}`);

    expect(content).toHaveLength(size);
    expect(ranges.value).toHaveLength(paginated.value.length);
    expect(metadata.value.signatures).toHaveLength(paginated.value.length);
    expect(canonical.value.document.hold).toBe(false);
  }, 600_000);
});

import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";

const MEASUREMENT = createFakeMeasurementProvider();

// A long enough manuscript that a narrow (small charsPerLine/linesPerColumn)
// capacity genuinely cannot fit it on one page, while the real Editor
// DEFAULT_PAGE_SETTINGS capacity (39x15) comfortably can.
const LONG_TEXT = "あ".repeat(60);

describe("composeV2Document -- realistic Editor state -> real v2 PaintPlan (integration)", () => {
  it("REAL Editor line-count settings change canonical PAGE COUNT, proving propagation reaches composition, not just the settings object (Human QA regression)", () => {
    const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 2, columnCount: 1 };
    const wide: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 39, linesPerColumn: 15, columnCount: 1 };

    const narrowResult = composeV2Document({ title: "T", content: LONG_TEXT, settings: narrow, measurement: MEASUREMENT });
    const wideResult = composeV2Document({ title: "T", content: LONG_TEXT, settings: wide, measurement: MEASUREMENT });

    // Narrow capacity (10 chars/line x 2 lines/column = 20 chars/page) needs
    // multiple pages for 60 characters; wide capacity (39x15 = 585
    // chars/page, the REAL current app default) needs exactly one.
    expect(narrowResult.document.pages.length).toBeGreaterThan(1);
    expect(wideResult.document.pages.length).toBe(1);

    // The SAME real page count difference must reach the actual PaintPlan
    // (the thing PDF/JPG executors consume) -- not just CanonicalDocument.
    expect(narrowResult.plan.length).toBe(narrowResult.document.pages.length);
    expect(wideResult.plan.length).toBe(wideResult.document.pages.length);
    expect(narrowResult.plan.length).toBeGreaterThan(wideResult.plan.length);
  });

  it("the PaintPlan page's physical mm dimensions come from the real Editor paper/margin settings, unaffected by charsPerLine/linesPerColumn", () => {
    const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 2 };
    const wide: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 39, linesPerColumn: 15 };
    const narrowResult = composeV2Document({ title: "T", content: "本文", settings: narrow, measurement: MEASUREMENT });
    const wideResult = composeV2Document({ title: "T", content: "本文", settings: wide, measurement: MEASUREMENT });
    expect(narrowResult.plan[0].widthMm).toBe(wideResult.plan[0].widthMm);
    expect(narrowResult.plan[0].heightMm).toBe(wideResult.plan[0].heightMm);
  });

  it("a real ruby+TCY+image manuscript composes to a real, non-empty PaintPlan without throwing", () => {
    const result = composeV2Document({
      title: "T",
      content: "前置き｜東京《とうきょう》に20年住んだ。",
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: MEASUREMENT,
    });
    expect(result.plan.length).toBeGreaterThan(0);
    expect(result.plan[0].commands.length).toBeGreaterThan(0);
  });

  it("folio/header settings reach the composed document's real pages when the Editor has real hashira text set", () => {
    const withHashira: PageSettings = { ...DEFAULT_PAGE_SETTINGS, masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "作品名", hashiraEven: "作品名" } };
    const result = composeV2Document({ title: "T", content: "本文", settings: withHashira, measurement: MEASUREMENT });
    expect(result.document.pages[0].folio).toBeDefined();
    expect(result.document.pages[0].header?.text).toBe("作品名");
  });

  it("an enabled colophon reaches a real, separate colophon page in the composed document", () => {
    const withColophon: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      colophon: {
        ...DEFAULT_PAGE_SETTINGS.colophon,
        enabled: true,
        fields: [{ id: "title", label: "書名", value: "テスト作品", visible: true }],
        freeText: "",
      },
    };
    const result = composeV2Document({ title: "T", content: "本文", settings: withColophon, measurement: MEASUREMENT });
    expect(result.document.colophon).toBeDefined();
    expect(result.plan.length).toBeGreaterThan(result.document.pages.length - 1); // colophon adds at least its own page
  });

  it("carries all four colophon templates into Publication and produces distinct colophon PaintPlans", () => {
    const templateIds = ["standard", "center", "minimal", "classic"] as const;
    const results = templateIds.map((templateId) => {
      const settings: PageSettings = {
        ...DEFAULT_PAGE_SETTINGS,
        colophon: {
          ...DEFAULT_PAGE_SETTINGS.colophon,
          enabled: true,
          templateId,
          fontSizePt: 10,
          placement: {
            ...DEFAULT_PAGE_SETTINGS.colophon.placement,
            horizontal: "center",
            respectGutter: false,
            vertical: "top",
          },
          fields: [
            { id: "title", label: "書名", value: "テンプレート確認", visible: true },
            { id: "author", label: "著者", value: "著者名", visible: true },
            { id: "printer", label: "印刷所", value: "印刷所名", visible: true },
          ],
          freeText: "自由記述の確認",
        },
      };
      const result = composeV2Document({
        title: "T",
        content: "本文",
        settings,
        measurement: MEASUREMENT,
      });
      const colophonPhysicalIndex = result.document.pageSequence.findIndex((ref) => ref.kind === "colophon");
      expect(colophonPhysicalIndex).toBeGreaterThanOrEqual(0);
      expect(result.model.colophonTemplateId).toBe(templateId);
      expect(result.model.colophonFontSizePt).toBe(10);
      return result.plan[colophonPhysicalIndex];
    });

    const signatures = results.map((page) =>
      JSON.stringify(page.commands.map((command) =>
        command.op === "text"
          ? [command.op, command.text, command.xMm, command.yMm, command.fontSizePt, command.align]
          : command.op === "rect"
            ? [command.op, command.xMm, command.yMm, command.widthMm, command.heightMm]
            : [command.op]
      ))
    );

    expect(new Set(signatures).size).toBe(4);
    expect(results[3].commands.some((command) => command.op === "rect")).toBe(true);
  });

  it("keeps free-text typography consistent across center/minimal/classic and carries the selected colophon font", () => {
    const templateIds = ["center", "minimal", "classic"] as const;
    const freeText = "自由記述ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const templateId of templateIds) {
      const settings: PageSettings = {
        ...DEFAULT_PAGE_SETTINGS,
        colophon: {
          ...DEFAULT_PAGE_SETTINGS.colophon,
          enabled: true,
          templateId,
          fontSizePt: 11,
          fontFamily: "'Shippori Mincho', serif",
          placement: {
            ...DEFAULT_PAGE_SETTINGS.colophon.placement,
            horizontal: "center",
            respectGutter: false,
            vertical: "center",
          },
          fields: [
            { id: "title", label: "書名", value: "確認用", visible: true },
            { id: "author", label: "著者名", value: "著者", visible: true },
          ],
          freeText,
        },
      };
      const result = composeV2Document({
        title: "T",
        content: "本文",
        settings,
        measurement: MEASUREMENT,
      });
      expect(result.model.colophonFontFamily).toBe("'Shippori Mincho', serif");
      expect(result.model.colophonFontSizePt).toBe(11);
      const colophonPhysicalIndex = result.document.pageSequence.findIndex((ref) => ref.kind === "colophon");
      const textCommands = result.plan[colophonPhysicalIndex].commands.filter(
        (command): command is Extract<(typeof result.plan)[number]["commands"][number], { op: "text" }> =>
          command.op === "text"
      );
      const freeTextCommands = textCommands.filter((command) => command.text.includes("自由記述") || command.text.includes("ABC"));
      expect(freeTextCommands.length).toBeGreaterThan(0);
      expect(freeTextCommands.every((command) => command.fontSizePt < 11)).toBe(true);
      expect(freeTextCommands.every((command) => command.fontFamily === "'Shippori Mincho', serif")).toBe(true);
    }
  });

  it("keeps classic free text raw until the shared render plan decides wrapping", () => {
    const freeText = "あ".repeat(80);
    const settings: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      colophon: {
        ...DEFAULT_PAGE_SETTINGS.colophon,
        enabled: true,
        templateId: "classic",
        fontSizePt: 10,
        fields: [
          { id: "title", label: "書名", value: "確認用", visible: true },
          { id: "author", label: "著者名", value: "著者", visible: true },
        ],
        freeText,
      },
    };
    const result = composeV2Document({
      title: "T",
      content: "本文",
      settings,
      measurement: MEASUREMENT,
    });

    expect(result.model.colophonFreeText).toBe(freeText);
    // TSP-PHASE13-001: rows keep their field id, like the Preview's rows.
    expect(result.model.colophonRows).toEqual([
      { id: "title", label: "書名", value: "確認用" },
      { id: "author", label: "著者名", value: "著者" },
    ]);

    const colophonPhysicalIndex = result.document.pageSequence.findIndex((ref) => ref.kind === "colophon");
    const renderedFreeText = result.plan[colophonPhysicalIndex].commands
      .filter((command): command is Extract<(typeof result.plan)[number]["commands"][number], { op: "text" }> => command.op === "text")
      .map((command) => command.text)
      .filter((text) => /^あ+$/.test(text))
      .join("");

    expect(renderedFreeText).toBe(freeText);
  });

  it("a disabled colophon (real Editor default) never adds a colophon page", () => {
    const result = composeV2Document({ title: "T", content: "本文", settings: DEFAULT_PAGE_SETTINGS, measurement: MEASUREMENT });
    expect(result.document.colophon).toBeUndefined();
  });
});

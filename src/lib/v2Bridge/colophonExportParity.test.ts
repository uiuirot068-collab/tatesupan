// TSP-PHASE13-001 item 4: the colophon's Preview-only styling reaches PDF/JPG.
// - text opacity / rule & frame alpha → equivalent gray ink (`inkGray`)
// - weight 600 → fill+stroke (`strokeWidthMm`)
// - respectGutter → the Preview's parity-aware placement area
import { describe, expect, it } from "vitest";
import { createGuideColophonSettings, type ColophonSettings } from "../colophon";
import { buildColophonRenderPlan } from "../colophonRenderPlan";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PaintCommand } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { composeV2Document } from "./composeV2Document";

function compose(colophon: Partial<ColophonSettings>, settings: Partial<PageSettings> = {}) {
  const page: PageSettings = { ...DEFAULT_PAGE_SETTINGS, ...settings, colophon: { ...createGuideColophonSettings(), freeText: "", ...colophon } };
  const bridge = composeV2Document({ title: "colophon", content: "本文です。", settings: page, measurement: createFakeMeasurementProvider() });
  const index = bridge.document.pageSequence.findIndex((r) => r.kind === "colophon");
  expect(index).toBeGreaterThanOrEqual(0);
  return { bridge, index, commands: bridge.plan[index].commands };
}

const texts = (commands: PaintCommand[]) => commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text" && c.furnitureRole === undefined);

describe("colophon export carries the Preview's tone and weight", () => {
  it("text with opacity < 1 in the render plan prints as gray, opaque text stays black", () => {
    const { commands } = compose({ templateId: "standard" });
    const plan = buildColophonRenderPlan({
      templateId: "standard",
      rows: createGuideColophonSettings().fields.map((f) => ({ id: f.id, label: f.label, value: f.value })),
      freeText: "",
      titleFallback: "",
      availableWidthEm: 40,
    });
    const translucent = plan.items.filter((i) => i.kind === "text" && (i.opacity ?? 1) < 1);
    expect(translucent.length).toBeGreaterThan(0);
    const painted = texts(commands);
    for (const item of translucent) {
      if (item.kind !== "text") continue;
      const cmd = painted.find((c) => c.text === item.text);
      expect(cmd?.inkGray).toBeCloseTo(1 - (item.opacity ?? 1), 9);
    }
    expect(painted.some((c) => c.inkGray === undefined)).toBe(true);
  });

  it("rules and frames with alpha < 1 print as gray strokes", () => {
    const { commands } = compose({ templateId: "classic" });
    const rects = commands.filter((c): c is Extract<PaintCommand, { op: "rect" }> => c.op === "rect");
    expect(rects.length).toBeGreaterThan(0);
    expect(rects.every((r) => r.inkGray === undefined || (r.inkGray > 0 && r.inkGray < 1))).toBe(true);
    expect(rects.some((r) => r.inkGray !== undefined)).toBe(true);
  });

  it("weight 600 (classic title) prints with a fill+stroke", () => {
    const { commands } = compose({ templateId: "classic" });
    expect(texts(commands).some((c) => c.strokeWidthMm !== undefined && c.strokeWidthMm > 0)).toBe(true);
  });
});

describe("colophon respectGutter in export", () => {
  const asymmetric: Partial<PageSettings> = { marginGutter: 26, marginOuter: 11 };
  // The block's outer frame (widest rect) spans the whole block.
  const center = (commands: PaintCommand[]) => {
    const rects = commands.filter((c): c is Extract<PaintCommand, { op: "rect" }> => c.op === "rect");
    const frame = rects.reduce((a, b) => (b.widthMm > a.widthMm ? b : a));
    return frame.xMm + frame.widthMm / 2;
  };

  it("OFF: the block is centred on the paper (symmetric min margin)", () => {
    const { bridge, commands } = compose({ templateId: "classic", placement: { horizontal: "center", vertical: "center", respectGutter: false, respectVerticalMargins: true } }, asymmetric);
    expect(center(commands)).toBeCloseTo(bridge.pageGeometry.paperWidthMm / 2, 3);
  });

  it("ON: the block shifts away from the ノド, per physical parity", () => {
    const { bridge, index, commands } = compose({ templateId: "classic", placement: { horizontal: "center", vertical: "center", respectGutter: true, respectVerticalMargins: true } }, asymmetric);
    const isOdd = (index + 1) % 2 === 1;
    // odd: 小口(11) left / ノド(26) right → area centre left of paper centre
    const paperCentre = bridge.pageGeometry.paperWidthMm / 2;
    const expectedShift = isOdd ? -(26 - 11) / 2 : (26 - 11) / 2;
    expect(center(commands) - paperCentre).toBeCloseTo(expectedShift, 3);
  });
});

describe("colophon ink/weight survive both executors", () => {
  it("renders to PDF (gray + fillThenStroke operators) and to JPG", async () => {
    const { renderPaintPlanToPdf } = await import("../../../typesetting-v2/renderer/publication/pdfGenerator");
    const { exportPaintPlanToJpgPages } = await import("../../../typesetting-v2/renderer/publication/jpgExport");
    const { bridge, index } = compose({ templateId: "classic" });
    const page = [bridge.plan[index]];
    const pdf = renderPaintPlanToPdf(page);
    expect(pdf.pageCount).toBe(1);
    const jpg = await exportPaintPlanToJpgPages(page, undefined, "colophon", "WEB", 72);
    expect(jpg).toHaveLength(1);
  });
});

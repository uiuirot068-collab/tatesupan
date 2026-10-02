// TSP-PHASE13-001 item 3: 隠しノンブル is printed in PDF/JPG (it used to exist
// only in the Preview), with the geometry the V2 Preview overlay also uses.
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PaintCommand } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { HIDDEN_NOMBRE_FONT_SIZE_PT, hiddenNombreGlyphCentres, hiddenNombreText } from "../../../typesetting-v2/renderer/furnitureGeometry";
import { composeV2Document } from "./composeV2Document";

function settingsWith(masterPage: Partial<PageSettings["masterPage"]>): PageSettings {
  return { ...DEFAULT_PAGE_SETTINGS, masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, ...masterPage } };
}

function compose(settings: PageSettings) {
  const content = Array.from({ length: 40 }, () => "あいうえおかきくけこさしすせそたちつてと".repeat(3)).join("\n");
  return composeV2Document({ title: "hidden nombre", content, settings, measurement: createFakeMeasurementProvider() });
}

function hiddenNombreCommands(commands: PaintCommand[]) {
  return commands.filter(
    (c): c is Extract<PaintCommand, { op: "text" }> =>
      c.op === "text" && c.fontSizePt === HIDDEN_NOMBRE_FONT_SIZE_PT && c.furnitureRole === undefined && c.angle === 0
  );
}

describe("隠しノンブル in export", () => {
  it("is absent when the setting is off", () => {
    const bridge = compose(settingsWith({ showHiddenNombre: false }));
    for (const page of bridge.plan) expect(hiddenNombreCommands(page.commands)).toHaveLength(0);
  });

  it("is printed on every body page at the ノド edge, even when the visible folio is hidden", () => {
    const bridge = compose(settingsWith({ showHiddenNombre: true, nombrePosition: "hidden", nombreStart: 3 }));
    expect(bridge.plan.length).toBeGreaterThan(1);
    bridge.plan.forEach((page, index) => {
      const physical = index + 1;
      const text = hiddenNombreText(undefined, 3, physical);
      const at = hiddenNombreGlyphCentres(text, { paperWidthMm: page.widthMm, paperHeightMm: page.heightMm }, physical % 2 === 1);
      const painted = hiddenNombreCommands(page.commands);
      expect(painted.map((c) => c.text).join("")).toBe(text);
      painted.forEach((c, i) => {
        expect(c.xMm).toBeCloseTo(at.xCenterMm, 6);
        expect(c.yMm).toBeCloseTo(at.yCentersMm[i], 6);
      });
      // odd pages: ノド on the right edge; even pages: on the left edge
      if (physical % 2 === 1) expect(at.xCenterMm).toBeGreaterThan(page.widthMm / 2);
      else expect(at.xCenterMm).toBeLessThan(page.widthMm / 2);
    });
  });

  it("follows the visible folio number when there is one", () => {
    expect(hiddenNombreText("12", 1, 5)).toBe("12");
    expect(hiddenNombreText(undefined, 1, 5)).toBe("5");
    expect(hiddenNombreText("", 2, 5)).toBe("6");
  });
});

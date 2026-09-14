import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createShipporiMinchoMeasurementProvider } from "../../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import {
  buildPublicationPaintPlan,
  type PaintCommand,
  type PublicationFontResource,
} from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";

const FONT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "typesetting-v2",
  "qa",
  "publication",
  "p3-o08",
  "font-poc",
  "fonts",
  "ShipporiMincho-Regular.ttf",
);

const FIXTURE = [
  "「モオル——Mole……」",
  "モオルは｜髑髏《もぐらもち》と云ふ英語だった。",
  "この｜聯想《れんそう》も僕には愉快ではなかった。",
  "が、僕は三三秒の後、[tate]Mole[/tate]を la mort に綴り直した。",
].join("\n");

function fontResource(): PublicationFontResource {
  return {
    fileName: "ShipporiMincho-Regular.ttf",
    fontName: "Shippori Mincho",
    base64: readFileSync(FONT_PATH).toString("base64"),
  };
}

function compose(content: string) {
  return composeV2Document({
    title: "Latin orientation fixture",
    content,
    settings: DEFAULT_PAGE_SETTINGS,
    measurement: createShipporiMinchoMeasurementProvider(FONT_PATH),
  });
}

function textCommands(commands: PaintCommand[]) {
  return commands.filter(
    (command): command is Extract<PaintCommand, { op: "text" }> => command.op === "text",
  );
}

describe("three-blocker ordinary Latin orientation parity", () => {
  it("paints ordinary Mole and la mort as upright one-cell text commands even with real vertical outlines enabled", () => {
    const bridge = compose(FIXTURE);
    const plan = buildPublicationPaintPlan(
      bridge.model,
      fontResource(),
      bridge.pageGeometry,
      "Latin orientation fixture",
    );
    const commands = textCommands(plan.flatMap((page) => page.commands));
    const ordinaryLatin = commands.filter((command) => /^[A-Za-z ]$/.test(command.text));
    const ordinaryText = ordinaryLatin.map((command) => command.text).join("");

    expect(ordinaryText).toContain("Mole");
    expect(ordinaryText).toContain(" la mort ");
    expect(ordinaryLatin.every((command) => command.angle === undefined || command.angle === 0)).toBe(true);
    expect(ordinaryLatin.every((command) => command.text.length === 1)).toBe(true);
    expect(plan.flatMap((page) => page.commands).some(
      (command) => command.op === "text" && command.text === "Mole",
    )).toBe(true); // explicit [tate], kept on its separate TCY path
  });

  it("keeps one digit upright, automatic two-digit TCY atomic, and explicit [tate] atomic", () => {
    const bridge = compose("甲7乙20丙[tate]Mole[/tate]丁");
    const plan = buildPublicationPaintPlan(
      bridge.model,
      fontResource(),
      bridge.pageGeometry,
      "Latin/TCY separation fixture",
    );
    const commands = textCommands(plan.flatMap((page) => page.commands));
    const oneDigit = commands.find((command) => command.text === "7");
    const autoTcy = commands.find((command) => command.text === "20");
    const explicitTcy = commands.find((command) => command.text === "Mole");

    expect(oneDigit).toMatchObject({ text: "7", align: "center" });
    expect(oneDigit?.angle).toBeUndefined();
    expect(autoTcy).toMatchObject({ text: "20", angle: 0, baseline: "middle" });
    expect(autoTcy?.maxWidthMm).toBeGreaterThan(0);
    expect(explicitTcy).toMatchObject({ text: "Mole", angle: 0, baseline: "middle" });
    expect(explicitTcy?.maxWidthMm).toBeGreaterThan(0);
    expect(commands.filter((command) => command.text === "2" || command.text === "0")).toHaveLength(0);
  });

  it("does not alter canonical units, Japanese context, or publication geometry", () => {
    const bridge = compose(FIXTURE);
    const documentBefore = structuredClone(bridge.document);
    const modelBefore = structuredClone(bridge.model);
    const textUnits = bridge.units.filter((unit) => unit.kind === "TEXT");
    const explicit = bridge.units.find((unit) => unit.kind === "TCY" && unit.displayText === "Mole");

    buildPublicationPaintPlan(bridge.model, fontResource(), bridge.pageGeometry, "fixture");
    expect(textUnits.some((unit) => unit.text.includes("Mole"))).toBe(true);
    expect(textUnits.some((unit) => unit.text.includes("la mort"))).toBe(true);
    expect(explicit).toBeDefined();
    expect(bridge.document).toEqual(documentBefore);
    expect(bridge.model).toEqual(modelBefore);
  });
});

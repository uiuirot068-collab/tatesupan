import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { createShipporiMinchoMeasurementProvider } from "../../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan, findUnresolvedImageIssues, renderPaintPlanToPdf, type PublicationFontResource } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { decodeUtf8Txt, encodeUtf8Txt } from "../txtTransfer";
import { composeV2Document } from "./composeV2Document";

describe("v2 branch production integration", () => {
  it("composes and emits a 100+ page real-font PDF without a global Node Buffer", () => {
    const fontBytes = readFileSync(resolve("typesetting-v2/qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf"));
    const font: PublicationFontResource = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: fontBytes.toString("base64") };
    const paragraph = "人は歩く。「縦組み」｜親文字《よみ》 [tate]25[/tate] ー――……。\n";
    const content = `${paragraph.repeat(55)}【IMG:e2e-image:20:30:center】\n【改ページ】\n${paragraph.repeat(55)}`;
    const settings = {
      ...DEFAULT_PAGE_SETTINGS,
      charsPerLine: 5,
      linesPerColumn: 5,
      columnCount: 1 as const,
      masterPage: {
        ...DEFAULT_PAGE_SETTINGS.masterPage,
        hashiraOdd: "RC作品名",
        hashiraEven: "RC章題",
      },
      colophon: {
        ...DEFAULT_PAGE_SETTINGS.colophon,
        enabled: true,
        fields: [{ id: "title", label: "書名", value: "RC長文作品", visible: true }],
        freeText: "ブラウザローカル統合確認",
      },
    };
    const imageBytes = Uint8Array.from(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    ));
    const started = performance.now();
    const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
    const bridge = composeV2Document({
      title: "RC長文",
      content,
      settings,
      measurement,
      imageResolver: (refId) => refId === "e2e-image"
        ? { kind: "RESOLVED", url: "local-editor-image://e2e-image", bytes: imageBytes, format: "PNG", pixelWidth: 1, pixelHeight: 1 }
        : { kind: "MISSING" },
    });
    expect(measurement.providerId).toBe("tatespun-shippori-mincho-real-measurement-provider");
    expect(bridge.document.version.measurementIdentity).toContain(measurement.providerId);
    expect(bridge.document.pages.length).toBeGreaterThan(100);
    expect(bridge.document.pages[0].folio).toBeDefined();
    expect(bridge.document.pages[0].header?.text).toBe("RC作品名");
    expect(bridge.document.colophon).toBeDefined();
    const plan = buildPublicationPaintPlan(bridge.model, font, bridge.pageGeometry, "browser integration");
    expect(plan.some((page) => page.commands.some((command) => command.op === "image"))).toBe(true);

    const originalBuffer = Object.getOwnPropertyDescriptor(globalThis, "Buffer");
    let resultByteLength = 0;
    try {
      Object.defineProperty(globalThis, "Buffer", { configurable: true, writable: true, value: undefined });
      const result = renderPaintPlanToPdf(plan, font);
      resultByteLength = result.bytes.byteLength;
      expect(result.pageCount).toBe(plan.length);
      expect(result.bytes.subarray(0, 4)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    } finally {
      if (originalBuffer) Object.defineProperty(globalThis, "Buffer", originalBuffer);
      else Reflect.deleteProperty(globalThis, "Buffer");
    }
    const elapsedMs = performance.now() - started;
    console.info("V2_BROWSER_PDF_100_PLUS", { pages: plan.length, bytes: resultByteLength, elapsedMs: Math.round(elapsedMs) });
    expect(elapsedMs).toBeLessThan(30_000);
  }, 35_000);

  it("round-trips the approved TXT notation contract", () => {
    const source = "章【改ページ】\r\n｜親文字《よみ》\r\n[tate]25[/tate]\r\n【IMG:local:20:30:center】";
    const bytes = encodeUtf8Txt(source, { bom: false, newlines: "lf" });
    expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(decodeUtf8Txt(bytes, { newlines: "lf" })).toBe(source.replace(/\r\n/g, "\n"));
  });

  it("holds every browser export when a required image is unresolved without discarding safe text", () => {
    const content = "書き出しに残す本文。\n【IMG:missing-image:20:30:center】\n画像後にも残す本文。";
    const bridge = composeV2Document({
      title: "未解決画像HOLD",
      content,
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: createFakeMeasurementProvider(),
      imageResolver: () => ({ kind: "MISSING" }),
    });

    expect(bridge.source).toContain("書き出しに残す本文。");
    expect(bridge.source).toContain("画像後にも残す本文。");
    expect(bridge.document.pages.length).toBeGreaterThan(0);
    expect(findUnresolvedImageIssues(bridge.model)).toEqual([
      expect.stringContaining("source not found"),
    ]);
    expect(() => buildPublicationPaintPlan(
      bridge.model,
      undefined,
      bridge.pageGeometry,
      "browser export",
    )).toThrow(/unresolved required image/i);
  });
});

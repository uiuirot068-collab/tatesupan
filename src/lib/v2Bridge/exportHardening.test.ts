import { describe, expect, it } from "vitest";
import { decode } from "fast-png";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Document, composeV2Layout, type V2LayoutResult } from "./composeV2Document";
import { CompositionGate, StaleCompositionError, compositionInputsEqual, type V2CompositionInput } from "./compositionRevision";
import { applyImageLayerOrder, ExportPlanCache, grayscalePlanImages, rgbaToGrayscalePng } from "./exportPlan";
import { bodyPageCount, bodyPageNumber, colophonPhysicalIndex, physicalIndexForBodyIndex, physicalPageNumber } from "./pageIndex";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { renderPaintPlanToPdf, type PaintCommand, type PaintPlan } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { shouldWarnOddPageExport } from "../../components/oddPageWarningRule";
import { fitImageToBox, imageMaxBoxForTextArea } from "../imageGeometry";

const MEASUREMENT = createFakeMeasurementProvider();
const compose = (content: string, settings: PageSettings = DEFAULT_PAGE_SETTINGS) =>
  composeV2Document({ title: "T", content, settings, measurement: MEASUREMENT });
const input = (content: string, settings: PageSettings = DEFAULT_PAGE_SETTINGS, images: Record<string, string> = {}): V2CompositionInput => ({
  content,
  settings,
  title: "T",
  images,
});
const layoutFor = (i: V2CompositionInput): V2LayoutResult => composeV2Layout({ ...i, measurement: MEASUREMENT });

describe("stale-layout export guard (compositionRevision.ts)", () => {
  it("current layout → export allowed immediately", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const a = input("本文A");
    const layout = layoutFor(a);
    gate.complete(a, layout);
    await expect(gate.waitFor(input("本文A"))).resolves.toBe(layout);
  });

  it("edit → immediate export waits for the NEW layout and never returns the previous one", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const before = input("旧");
    gate.complete(before, layoutFor(before));
    const after = input("旧に追記した本文");
    let resolved: V2LayoutResult | null = null;
    const pending = gate.waitFor(after).then((value) => (resolved = value));
    await Promise.resolve();
    expect(resolved).toBeNull(); // the old layout is NOT handed out
    const fresh = layoutFor(after);
    gate.complete(after, fresh);
    await pending;
    expect(resolved).toBe(fresh);
    expect(fresh.source).toBe("旧に追記した本文");
  });

  it("an older intermediate composition finishing after the click does not satisfy the export", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const clicked = input("あいうえお");
    let resolvedWith: string | null = null;
    const pending = gate.waitFor(clicked).then((layout) => (resolvedWith = layout.source));
    gate.complete(input("あいう"), layoutFor(input("あいう"))); // debounce chain delivers an older snapshot first
    await Promise.resolve();
    expect(resolvedWith).toBeNull();
    gate.complete(clicked, layoutFor(clicked));
    await pending;
    expect(resolvedWith).toBe("あいうえお");
  });

  it("multiple rapid edits → export: typing again after the click rejects the pending export (no stale output)", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const clicked = input("第一稿");
    const pending = gate.waitFor(clicked);
    gate.supersede(input("第一稿を書き直した")); // PreviewPane sees the live text move on
    await expect(pending).rejects.toBeInstanceOf(StaleCompositionError);
    expect(gate.pendingCount).toBe(0);
    // A fresh export of the newest text then succeeds normally.
    const latest = input("第一稿を書き直した");
    const next = gate.waitFor(latest);
    gate.complete(latest, layoutFor(latest));
    await expect(next).resolves.toMatchObject({ source: "第一稿を書き直した" });
  });

  it("settings change → immediate export waits for the layout of the NEW settings", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 20 };
    gate.complete(input("本文"), layoutFor(input("本文")));
    let done = false;
    const pending = gate.waitFor(input("本文", narrow)).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    gate.complete(input("本文", narrow), layoutFor(input("本文", narrow)));
    await pending;
    expect(done).toBe(true);
  });

  it("the same source with a new-but-equal settings object is the same revision", () => {
    expect(compositionInputsEqual(input("a"), input("a", { ...DEFAULT_PAGE_SETTINGS }))).toBe(true);
    expect(compositionInputsEqual(input("a", DEFAULT_PAGE_SETTINGS, { x: "data:1" }), input("a", DEFAULT_PAGE_SETTINGS, { x: "data:2" }))).toBe(false);
    expect(compositionInputsEqual(input("a"), { ...input("a"), title: "別題" })).toBe(false);
  });

  it("a failed composition of the exported source rejects instead of falling back", async () => {
    const gate = new CompositionGate<V2LayoutResult>();
    const clicked = input("x");
    const pending = gate.waitFor(clicked);
    gate.fail(clicked, new Error("V2 HOLD: font unavailable"));
    await expect(pending).rejects.toThrow("V2 HOLD");
  });
});

describe("oversized images can no longer HOLD the document (imageGeometry.ts)", () => {
  it.each([
    ["center, taller than the line", "【IMG:x:40:140:center】"],
    ["full page, taller than the line", "【IMG:x:100:150:full】"],
    ["top, huge", "【IMG:x:400:600:top】"],
  ])("%s → layout continues, aspect ratio preserved", (_label, marker) => {
    const bridge = compose(`前文。\n${marker}\n後文。`);
    expect(bridge.document.hold).toBe(false);
    expect(bridge.source).toContain("後文");
    const image = bridge.units.find((unit) => unit.kind === "IMAGE")!;
    if (image.kind !== "IMAGE") throw new Error("unreachable");
    const [, w, h] = /IMG:x:([\d.]+):([\d.]+)/.exec(marker)!.map(Number);
    expect(image.intrinsicWidth / image.intrinsicHeight).toBeCloseTo(w / h, 2);
    expect(image.intrinsicHeight).toBeLessThanOrEqual(bridge.layoutSettings.lineExtentTicks);
  });

  it("an image already inside the shared cap box keeps its exact persisted size", () => {
    const bridge = compose("前文。\n【IMG:x:40:30:center】\n後文。");
    const image = bridge.units.find((unit) => unit.kind === "IMAGE");
    expect(image).toMatchObject({ intrinsicWidth: 40000, intrinsicHeight: 30000 });
  });

  it("uses the same box as insertion / the Preview overlay (90% × 60% of the text frame)", () => {
    expect(imageMaxBoxForTextArea(100, 200)).toEqual({ maxWidthMm: 90, maxHeightMm: 120 });
    expect(fitImageToBox({ widthMm: 180, heightMm: 60 }, { maxWidthMm: 90, maxHeightMm: 120 })).toEqual({ widthMm: 90, heightMm: 30 });
    const small = { widthMm: 10, heightMm: 10 };
    expect(fitImageToBox(small, { maxWidthMm: 90, maxHeightMm: 120 })).toBe(small);
  });
});

describe("export plan: image layer order + grayscale (exportPlan.ts)", () => {
  const img = (refId: string, x: number): PaintCommand => ({ op: "image", xMm: x, yMm: 0, widthMm: 5, heightMm: 5, bytes: new Uint8Array([x]), format: "PNG", refId });
  const text: PaintCommand = { op: "text", text: "本", xMm: 0, yMm: 0, fontSizePt: 9, align: "center" };

  it("re-orders only image commands back-to-front by the Editor's layer rank; text keeps its slot", () => {
    const plan: PaintPlan = [{ widthMm: 10, heightMm: 10, commands: [img("a", 1), text, img("b", 2), img("c", 3)] }];
    const ordered = applyImageLayerOrder(plan, { a: 2, b: 0, c: 1 });
    expect(ordered[0].commands.map((c) => (c.op === "image" ? c.refId : c.op))).toEqual(["b", "text", "c", "a"]);
  });

  it("no layer metadata → the plan object is returned untouched (token order, as before)", () => {
    const plan: PaintPlan = [{ widthMm: 10, heightMm: 10, commands: [img("a", 1), img("b", 2)] }];
    expect(applyImageLayerOrder(plan, {})).toBe(plan);
    expect(applyImageLayerOrder(plan, { a: 0, b: 1 })[0]).toBe(plan[0]);
  });

  it("grayscale PNG uses the LEGACY DeviceGray luminance, 1 channel when opaque, gray+alpha otherwise", () => {
    const opaque = decode(rgbaToGrayscalePng(new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), 2, 1));
    expect(opaque.channels).toBe(1);
    expect(Array.from(opaque.data)).toEqual([Math.round(0.299 * 255), Math.round(0.114 * 255)]);
    const translucent = decode(rgbaToGrayscalePng(new Uint8Array([0, 255, 0, 128]), 1, 1));
    expect(translucent.channels).toBe(2);
    expect(Array.from(translucent.data)).toEqual([Math.round(0.587 * 255), 128]);
  });

  it("every image command becomes grayscale PNG (each distinct image decoded once) and jsPDF embeds it", async () => {
    const shared = new Uint8Array([1]);
    const plan: PaintPlan = [
      { widthMm: 20, heightMm: 20, commands: [{ ...(img("a", 1) as Extract<PaintCommand, { op: "image" }>), bytes: shared, format: "JPEG" }, text] },
      { widthMm: 20, heightMm: 20, commands: [{ ...(img("a", 2) as Extract<PaintCommand, { op: "image" }>), bytes: shared, format: "JPEG" }] },
    ];
    let decodes = 0;
    const gray = await grayscalePlanImages(plan, async () => {
      decodes += 1;
      return { data: new Uint8Array([10, 200, 30, 255, 10, 200, 30, 0]), width: 2, height: 1 };
    });
    expect(decodes).toBe(1);
    const images = gray.flatMap((page) => page.commands.filter((c): c is Extract<PaintCommand, { op: "image" }> => c.op === "image"));
    expect(images.every((c) => c.format === "PNG" && c.refId === "a")).toBe(true);
    expect(gray[0].commands[1]).toBe(text);
    expect(renderPaintPlanToPdf(gray).pageCount).toBe(2);
  });

  it("the export plan cache reuses a plan only for the identical (layout, font, layer order) revision", async () => {
    const cache = new ExportPlanCache<[object, object, object]>();
    const [layout, font, layers] = [{}, {}, {}];
    let builds = 0;
    const build = async (): Promise<PaintPlan> => {
      builds += 1;
      return [];
    };
    await cache.get([layout, font, layers], build);
    await cache.get([layout, font, layers], build);
    expect(builds).toBe(1);
    await cache.get([{}, font, layers], build); // a new composition
    await cache.get([layout, font, {}], build); // a layer change
    expect(builds).toBe(3);
    await expect(cache.get([layout, font, layers], async () => { throw new Error("HOLD"); })).rejects.toThrow("HOLD");
    await cache.get([layout, font, layers], build); // a failed build is never cached
    expect(builds).toBe(4);
  });

  it("V2 image paint commands carry the Editor image id (needed for layer order)", () => {
    const bridge = composeV2Document({
      title: "T",
      content: "前文。\n【IMG:pic:40:30:center】\n後文。",
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: MEASUREMENT,
      imageResolver: () => ({ kind: "RESOLVED", url: "x", bytes: new Uint8Array([1]), format: "PNG", pixelWidth: 1, pixelHeight: 1 }),
    });
    const image = bridge.plan.flatMap((p) => p.commands).find((c) => c.op === "image");
    expect(image).toMatchObject({ op: "image", refId: "pic" });
  });
});

describe("page overrides are applied by BODY page number (pageFurniture.ts)", () => {
  const withColophonAfter = (afterBodyPage: number, pageOverrides: PageSettings["pageOverrides"]): PageSettings => ({
    ...DEFAULT_PAGE_SETTINGS,
    masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "柱奇", hashiraEven: "柱偶", nombrePosition: "center" },
    colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: { mode: "after-body-page", afterBodyPage } },
    pageOverrides,
  });
  const longText = Array.from({ length: 80 }, () => "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。").join("\n");

  it("a body-page override lands on that body page even after a mid-book colophon, never on the colophon", () => {
    const bridge = compose(longText, withColophonAfter(1, { 2: { hideHashira: true } }));
    const sequence = bridge.document.pageSequence;
    expect(colophonPhysicalIndex(sequence)).toBe(1);
    expect(bridge.document.pages[1].header).toBeUndefined(); // body page 2 (physical 3): hidden
    expect(bridge.document.pages[0].header?.text).toBe("柱奇");
    expect(bridge.document.pages[2].header).toBeDefined(); // body page 3 untouched
    expect(bridge.document.colophon?.pages[0].header).toBeDefined(); // colophon not hijacked
  });

  it("per-page ノンブル 非表示 removes that body page's folio in export (was ignored)", () => {
    const bridge = compose(longText, withColophonAfter(99, { 2: { hideNombre: true } }));
    expect(bridge.document.pages[1].folio).toBeUndefined();
    expect(bridge.document.pages[0].folio?.text).toBe("1");
    expect(bridge.document.pages[2].folio?.text).toBe("3");
    const pageTwoTexts = bridge.plan[1].commands.filter((c) => c.op === "text" && c.furnitureRole === "folio");
    expect(pageTwoTexts).toHaveLength(0);
  });

  it("hashiraOverride keyed by body page is used as that page's running head", () => {
    const bridge = compose(longText, withColophonAfter(1, { 3: { hashiraOverride: "特別" } }));
    expect(bridge.document.pages[2].header?.text).toBe("特別");
  });

  it("no overrides + colophon at the end: furniture identical to Core's own result", () => {
    const settings = withColophonAfter(999, {});
    const bridge = compose(longText, settings);
    bridge.document.pageSequence.forEach((ref, physicalIndex) => {
      const page = ref.kind === "body" ? bridge.document.pages[ref.index] : bridge.document.colophon!.pages[ref.index];
      expect(page.folio?.text).toBe(String(physicalIndex + 1));
      expect(page.header?.text).toBe(physicalIndex % 2 === 0 ? "柱奇" : "柱偶");
    });
  });
});

describe("page-number vocabulary and odd-page warning source", () => {
  it("body vs physical numbers are distinct, explicit helpers", () => {
    expect(bodyPageNumber(0)).toBe(1);
    expect(physicalPageNumber(2)).toBe(3);
    const sequence = [{ kind: "body" as const, index: 0 }, { kind: "colophon" as const, index: 0 }, { kind: "body" as const, index: 1 }];
    expect(bodyPageCount(sequence)).toBe(2);
    // Body page 2 is physical page 3 after a colophon after page 1.
    expect(physicalPageNumber(physicalIndexForBodyIndex(sequence, 1))).toBe(3);
    expect(bodyPageNumber(1)).toBe(2);
  });

  it("odd-page warning counts the canonical V2 body pages (+ colophon) the PDF will contain", () => {
    const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true } };
    const bridge = compose(Array.from({ length: 60 }, () => "吾輩は猫である。名前はまだ無い。").join("\n"), settings);
    const count = bodyPageCount(bridge.document.pageSequence);
    const warning = shouldWarnOddPageExport({ scope: "all", bodyPageCount: count, includeColophon: true });
    expect(count + 1).toBe(bridge.plan.length); // exactly the pages a whole-book PDF exports
    expect(warning?.totalPages ?? bridge.plan.length).toBe(bridge.plan.length);
    expect(warning !== null).toBe(bridge.plan.length % 2 === 1);
  });
});

describe("the live Preview layout carries no PaintPlan", () => {
  it("composeV2Layout returns the same document/model as composeV2Document, without plan", () => {
    const i = input("本文。\n｜漢字《かんじ》");
    const layout = layoutFor(i);
    const full = compose("本文。\n｜漢字《かんじ》");
    expect("plan" in layout).toBe(false);
    expect(layout.document).toEqual(full.document);
    expect(layout.model).toEqual(full.model);
  });
});

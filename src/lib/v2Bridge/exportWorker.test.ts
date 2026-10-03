import { readFileSync } from "node:fs";
import { Canvas } from "@napi-rs/canvas";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Layout } from "./composeV2Document";
import { applyImageLayerOrder, grayscalePlanImages, type RgbaDecoder } from "./exportPlan";
import { ExportWorkerSession, type ExportWorkerReply } from "./exportWorkerProtocol";
import { readPagesAhead, V2ExportWorkerClient, type ExportWorkerLike } from "./exportWorkerClient";
import { publicationModelOf, V2_EXPORT_REFUSAL_PREFIX, type V2PublicationModel } from "./previewWorkerProtocol";
import { ReusablePreviewWorker, type PreviewWorkerLike } from "./previewWorkerClient";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import {
  buildPublicationPaintPlan,
  createPublicationPaintPlanBuilder,
  renderPaintPlanToPdfAsync,
  type PublicationFontResource,
} from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import type { ImageResolver } from "../../../typesetting-v2/renderer/publication/paintModel";

// Phase 9: export builds its PaintPlan inside the export worker, page by
// page, from the publication model the Preview worker delivers: PDF is
// written there; JPG pages are handed to the main-thread rasterizer. Output must equal the Phase 8 path
// (whole plan → layer order → grayscale → selection). No timing assertions.

const MEASUREMENT = createFakeMeasurementProvider();
const FONT: PublicationFontResource = {
  fileName: "ShipporiMincho-Regular.ttf",
  fontName: "Shippori Mincho",
  base64: readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf")).toString("base64"),
};
const IMAGE_A = new Uint8Array([1, 2, 3]);
const IMAGE_B = new Uint8Array([4, 5, 6]);
const resolver: ImageResolver = (refId) =>
  refId === "a" || refId === "b"
    ? { kind: "RESOLVED", url: `local-editor-image://${refId}`, bytes: refId === "a" ? IMAGE_A : IMAGE_B, format: "PNG", pixelWidth: 2, pixelHeight: 1 }
    : { kind: "MISSING" };
/** Deterministic stand-in for the canvas decoder: 2×1 pixels derived from the bytes. */
const decode: RgbaDecoder = async (bytes) => ({ data: new Uint8Array([bytes[0] * 10, 20, 30, 255, bytes[1] * 10, 40, 50, 128]), width: 2, height: 1 });

const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 6, columnCount: 1, colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true } };
const MANUSCRIPT = [
  "　吾輩は｜猫《ねこ》である。名前はまだ無い。《《傍点》》どこで生れたかとんと見当がつかぬ――。",
  "【IMG:a:20:15:center】【IMG:b:20:15:center】",
  "　何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している……。",
  "【改ページ】",
  "　吾輩はここで始めて人間というものを見た。",
].join("\n").repeat(3);

function publication(content = MANUSCRIPT, imageResolver: ImageResolver = resolver): V2PublicationModel {
  return structuredClone(publicationModelOf(composeV2Layout({ title: "T", content, settings, measurement: MEASUREMENT, imageResolver })));
}

/** The Phase 8 main-thread path: whole plan, layer order, grayscale, then the selection. */
async function phase8Plan(model: V2PublicationModel, layerOrder: Record<string, number>, indices: number[]) {
  const plan = await grayscalePlanImages(applyImageLayerOrder(buildPublicationPaintPlan(model.model, FONT, model.pageGeometry, V2_EXPORT_REFUSAL_PREFIX), layerOrder), decode);
  return indices.map((index) => plan[index]);
}

const normalizePdf = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("latin1").replace(/\/CreationDate \(D:[^)]*\)/g, "").replace(/\/ID \[\s*<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*\]/g, "");

describe("per-page PaintPlan builder", () => {
  it("pageAt(i) equals the full plan's page i for every page, in any order (body, colophon, ruby, 傍点, ――/……, images)", () => {
    const model = publication();
    const full = buildPublicationPaintPlan(model.model, FONT, model.pageGeometry, "t");
    const builder = createPublicationPaintPlanBuilder(model.model, FONT, model.pageGeometry, "t");
    expect(builder.pageCount).toBe(full.length);
    expect(model.pageSequence.some((ref) => ref.kind === "colophon")).toBe(true);
    const reversed = [...full.keys()].reverse();
    for (const index of reversed) expect(builder.pageAt(index)).toEqual(full[index]);
    const ops = new Set(full.flatMap((page) => page.commands.map((command) => command.op)));
    expect([...ops].sort()).toEqual(expect.arrayContaining(["circle", "image", "text"]));
  });

  it("applies the same HOLD / unresolved-image refusal up front", () => {
    const broken = publication(`${MANUSCRIPT}\n【IMG:zz:20:15:center】`);
    expect(() => createPublicationPaintPlanBuilder(broken.model, FONT, broken.pageGeometry, "P")).toThrow("P with unresolved required image(s)");
  });
});

describe("export worker session builds the PDF itself", () => {
  const session = (loadFont = vi.fn(async () => FONT)) => ({ worker: new ExportWorkerSession({ loadFont, decode }), loadFont });

  it("PDF bytes equal the Phase 8 path (whole plan → layer order → grayscale → selection) after date/ID normalization", async () => {
    const model = publication();
    const layerOrder = { a: 5, b: 1 }; // b painted below a
    const indices = [0, 1, model.pageSequence.length - 1];
    const { worker } = session();
    worker.receiveModel({ ok: true, publication: model });
    const progress: number[] = [];
    const pdf = await worker.renderPdf({ physicalIndices: indices, layerOrder, mode: "bleed" }, { onProgress: (current) => progress.push(current) });
    const expectedPlan = await phase8Plan(model, layerOrder, indices);
    expect(expectedPlan).not.toEqual(await phase8Plan(model, {}, indices)); // the layer order really moves images here
    const expected = await renderPaintPlanToPdfAsync(expectedPlan, FONT, { mode: "bleed" });
    expect(pdf.pageCount).toBe(3);
    expect(normalizePdf(pdf.bytes)).toBe(normalizePdf(expected.bytes));
    expect(progress).toEqual([1, 2, 3]);
    expect(worker.pagesBuilt).toBe(3); // only the selected pages were built
  }, 60_000);

  it("CST-PORT-013 確認用PDF: leading / trailing pages wrap the body, unchanged and not grayscaled", async () => {
    const model = publication();
    const indices = [0, 1];
    const jpeg = new Uint8Array(new Canvas(4, 6).toBuffer("image/jpeg"));
    const cover = { widthMm: 148, heightMm: 210, commands: [{ op: "image" as const, xMm: -3, yMm: -3, widthMm: 154, heightMm: 216, bytes: jpeg, format: "JPEG" as const }] };
    const back = { ...cover, commands: [{ ...cover.commands[0], xMm: -3.5 }] };
    const { worker } = session();
    worker.receiveModel({ ok: true, publication: model });
    const progress: number[] = [];
    const pdf = await worker.renderPdf(
      { physicalIndices: indices, layerOrder: {}, mode: "bleed", leadingPages: [cover], trailingPages: [back] },
      { onProgress: (current, total) => progress.push(current * 10 + total) }
    );
    const expected = await renderPaintPlanToPdfAsync([cover, ...(await phase8Plan(model, {}, indices)), back], FONT, { mode: "bleed" });
    expect(pdf.pageCount).toBe(4);
    expect(normalizePdf(pdf.bytes)).toBe(normalizePdf(expected.bytes));
    expect(progress).toEqual([14, 24, 34, 44]);
    expect(worker.pagesBuilt).toBe(2); // the covers are not built from the model
  }, 60_000);

  it("the font is loaded once per worker and the model is kept between exports", async () => {
    const { worker, loadFont } = session();
    worker.receiveModel({ ok: true, publication: publication() });
    await worker.renderPdf({ physicalIndices: [0], layerOrder: {}, mode: "trim" });
    await worker.renderPdf({ physicalIndices: [1], layerOrder: {}, mode: "trim" });
    expect(loadFont).toHaveBeenCalledTimes(1);
    expect(worker.modelsReceived).toBe(1);
  }, 60_000);

  it("a failed font load is retried by the next export", async () => {
    const loadFont = vi.fn().mockRejectedValueOnce(new Error("font 503")).mockResolvedValue(FONT);
    const { worker } = session(loadFont);
    worker.receiveModel({ ok: true, publication: publication() });
    await expect(worker.renderPdf({ physicalIndices: [0], layerOrder: {}, mode: "trim" })).rejects.toThrow("font 503");
    await expect(worker.renderPdf({ physicalIndices: [0], layerOrder: {}, mode: "trim" })).resolves.toMatchObject({ pageCount: 1 });
    expect(worker.fontLoads).toBe(2);
  }, 60_000);

  it("refuses without a model, with a refused delivery, and with pages outside the layout", async () => {
    const { worker } = session();
    await expect(worker.renderPdf({ physicalIndices: [0], layerOrder: {}, mode: "trim" })).rejects.toThrow("no publication model");
    expect(() => worker.receiveModel({ ok: false, message: "V2 Beta export for a HOLD document (x)" })).toThrow("HOLD document");
    expect(worker.hasModel).toBe(false);
    const model = publication();
    worker.receiveModel({ ok: true, publication: model });
    await expect(worker.renderPdf({ physicalIndices: [model.pageSequence.length], layerOrder: {}, mode: "trim" })).rejects.toThrow("could not resolve");
    await expect(worker.rasterPage(-1, {})).rejects.toThrow("could not resolve");
  });

  it("JPG pages built in the worker equal the Phase 8 plan pages (body, colophon, layer order, grayscale)", async () => {
    const model = publication();
    const layerOrder = { a: 5, b: 1 };
    const colophon = model.pageSequence.findIndex((ref) => ref.kind === "colophon");
    const indices = [colophon, 1, 0];
    const { worker, loadFont } = session();
    worker.receiveModel({ ok: true, publication: structuredClone(model) });
    const expected = await phase8Plan(model, layerOrder, indices);
    for (const [i, index] of indices.entries()) {
      // What crosses to the main thread is a structured clone of the page.
      expect(structuredClone(await worker.rasterPage(index, layerOrder))).toEqual(expected[i]);
    }
    expect(worker.pagesBuilt).toBe(3);
    expect(loadFont).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("a HOLD / broken-image document is refused for JPG pages too, with the Phase 8 message", async () => {
    const { worker } = session();
    worker.receiveModel({ ok: true, publication: publication(`${MANUSCRIPT}\n【IMG:zz:20:15:center】`) });
    await expect(worker.rasterPage(0, {})).rejects.toThrow(`${V2_EXPORT_REFUSAL_PREFIX} with unresolved required image(s)`);
  });

  it("the cancellation hook stops before the next page is built", async () => {
    const { worker } = session();
    worker.receiveModel({ ok: true, publication: publication() });
    let calls = 0;
    const beforePage = async () => {
      calls += 1;
      if (calls === 2) throw new DOMException("Export cancelled", "AbortError");
    };
    await expect(worker.renderPdf({ physicalIndices: [0, 1, 2], layerOrder: {}, mode: "trim" }, { beforePage })).rejects.toThrow("Export cancelled");
    expect(worker.pagesBuilt).toBe(1);
  }, 60_000);
});

class FakeExportWorker implements ExportWorkerLike {
  posted: Array<{ message: Record<string, unknown>; transfer?: Transferable[] }> = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message: message as Record<string, unknown>, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: ExportWorkerReply) {
    this.onmessage?.({ data: message } as MessageEvent);
  }
  get jobs() {
    return this.posted.filter((entry) => entry.message.type === "pdf");
  }
}

function exportClient() {
  const workers: FakeExportWorker[] = [];
  let channels = 0;
  const client = new V2ExportWorkerClient(
    () => {
      const worker = new FakeExportWorker();
      workers.push(worker);
      return worker;
    },
    () => {
      channels += 1;
      return { port1: { id: `p1-${channels}` } as unknown as MessagePort, port2: { id: `p2-${channels}` } as unknown as MessagePort };
    }
  );
  return { client, workers };
}

const pdfRequest = (layout: object, deliverModel = vi.fn(async () => undefined), onProgress = vi.fn()) => ({
  layout,
  deliverModel,
  physicalIndices: [0, 1],
  layerOrder: {},
  mode: "trim" as const,
  onProgress,
});

describe("export worker client: JPG page stream", () => {
  it("pulls pages one request at a time, delivers the model once, and keeps the worker after close", async () => {
    const { client, workers } = exportClient();
    const layout = {};
    const deliver = vi.fn(async () => undefined);
    const stream = client.openPages({ layout, deliverModel: deliver, layerOrder: { a: 1 } });
    expect(() => client.startPdf(pdfRequest({}))).toThrow("still running");
    const first = stream.pageAt(4);
    const request = workers[0].posted[0];
    expect(request.message).toMatchObject({ type: "page", physicalIndex: 4, layerOrder: { a: 1 }, modelPort: { id: "p2-1" } });
    expect(request.transfer).toEqual([{ id: "p2-1" }]);
    const page = { widthMm: 1, heightMm: 2, commands: [] };
    workers[0].reply({ type: "page", jobId: request.message.jobId as number, requestId: request.message.requestId as number, page });
    await expect(first).resolves.toEqual(page);
    const second = stream.pageAt(5);
    expect(workers[0].posted[1].message).not.toHaveProperty("modelPort");
    stream.close();
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    await expect(stream.pageAt(6)).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].terminated).toBe(false);
    // The same layout exported again (e.g. as PDF) reuses the held model.
    client.startPdf(pdfRequest(layout, deliver));
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("a refused page (HOLD) fails the stream and discards the worker", async () => {
    const { client, workers } = exportClient();
    const stream = client.openPages({ layout: {}, deliverModel: vi.fn(async () => undefined), layerOrder: {} });
    const page = stream.pageAt(0);
    workers[0].reply({ type: "error", jobId: workers[0].posted[0].message.jobId as number, message: "V2 Beta export for a HOLD document (x)" });
    await expect(page).rejects.toThrow("HOLD document");
    await expect(stream.pageAt(1)).rejects.toThrow("HOLD document");
    expect(workers[0].terminated).toBe(true);
    expect(client.isRunning).toBe(false);
  });

  it("readPagesAhead keeps exactly one page requested ahead, in order, and never past the end", async () => {
    const asked: number[] = [];
    const stream = { pageAt: vi.fn(async (index: number) => { asked.push(index); return { widthMm: index, heightMm: 0, commands: [] }; }), close: vi.fn() };
    const read = readPagesAhead(stream, [7, 3, 9]);
    expect((await read(0)).widthMm).toBe(7);
    expect(asked).toEqual([7, 3]);
    expect((await read(1)).widthMm).toBe(3);
    expect((await read(2)).widthMm).toBe(9);
    expect(asked).toEqual([7, 3, 9]); // each page requested once, nothing beyond the selection
  });

  it("dispose (unmount) rejects a pending page", async () => {
    const { client } = exportClient();
    const stream = client.openPages({ layout: {}, deliverModel: vi.fn(async () => undefined), layerOrder: {} });
    const page = stream.pageAt(0);
    client.dispose();
    await expect(page).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("export worker client", () => {
  it("delivers the model once per layout, reuses the worker, and forwards progress and bytes", async () => {
    const { client, workers } = exportClient();
    const layout = {};
    const deliver = vi.fn(async () => undefined);
    const onProgress = vi.fn();
    const first = client.startPdf(pdfRequest(layout, deliver, onProgress));
    const job = workers[0].jobs[0];
    expect(deliver).toHaveBeenCalledWith({ id: "p1-1" });
    expect(job.message.modelPort).toEqual({ id: "p2-1" });
    expect(job.transfer).toEqual([{ id: "p2-1" }]); // the port is transferred, the model never passes here
    expect(job.message).not.toHaveProperty("plan");
    expect(job.message).not.toHaveProperty("font");
    expect(job.message).not.toHaveProperty("leadingPages"); // a plain PDF carries no proof pages
    expect(job.message).not.toHaveProperty("trailingPages");
    workers[0].reply({ type: "progress", jobId: job.message.jobId as number, current: 1, total: 2 });
    workers[0].reply({ type: "complete", jobId: job.message.jobId as number, bytes: new Uint8Array([7]), pageCount: 2 });
    await expect(first.result).resolves.toEqual(new Uint8Array([7]));
    expect(onProgress).toHaveBeenCalledWith({ current: 1, total: 2 });

    const second = client.startPdf(pdfRequest(layout, deliver));
    const secondJob = workers[0].jobs[1];
    expect(deliver).toHaveBeenCalledTimes(1); // same layout: the worker keeps its model
    expect(secondJob.message).not.toHaveProperty("modelPort");
    workers[0].reply({ type: "complete", jobId: secondJob.message.jobId as number, bytes: new Uint8Array([8]), pageCount: 2 });
    await second.result;

    const coverPage = { widthMm: 1, heightMm: 2, commands: [] };
    const proof = client.startPdf({ ...pdfRequest(layout, deliver), leadingPages: [coverPage], trailingPages: [coverPage] });
    const proofJob = workers[0].jobs[2];
    expect(proofJob.message).toMatchObject({ leadingPages: [coverPage], trailingPages: [coverPage] });
    workers[0].reply({ type: "complete", jobId: proofJob.message.jobId as number, bytes: new Uint8Array([9]), pageCount: 4 });
    await proof.result;

    client.startPdf(pdfRequest({}, deliver)); // a newer layout
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(workers).toHaveLength(1);
    expect(client.modelsRequested).toBe(2);
  });

  it("cancel terminates the worker; a late reply is ignored; the next export uses a new worker and a new model", async () => {
    const { client, workers } = exportClient();
    const layout = {};
    const deliver = vi.fn(async () => undefined);
    const handle = client.startPdf(pdfRequest(layout, deliver));
    const jobId = workers[0].jobs[0].message.jobId as number;
    handle.cancel();
    await expect(handle.result).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].posted.at(-1)?.message).toEqual({ type: "cancel" });
    expect(workers[0].terminated).toBe(true);
    workers[0].reply({ type: "complete", jobId, bytes: new Uint8Array([1]), pageCount: 1 }); // ignored
    client.startPdf(pdfRequest(layout, deliver));
    expect(workers).toHaveLength(2);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it("a delivery that fails (Preview worker stopped) fails the job and discards the worker", async () => {
    const { client, workers } = exportClient();
    const handle = client.startPdf(pdfRequest({}, vi.fn(async () => {
      throw new Error("V2 export: the Preview worker stopped.");
    })));
    await expect(handle.result).rejects.toThrow("Preview worker stopped");
    expect(workers[0].terminated).toBe(true);
    expect(client.isRunning).toBe(false);
  });

  it("an error reply or a crash fails the job and the worker is never reused", async () => {
    const { client, workers } = exportClient();
    const first = client.startPdf(pdfRequest({}));
    workers[0].reply({ type: "error", jobId: workers[0].jobs[0].message.jobId as number, message: "V2 Beta export for a HOLD document (x)" });
    await expect(first.result).rejects.toThrow("HOLD document");
    expect(workers[0].terminated).toBe(true);
    const second = client.startPdf(pdfRequest({}));
    workers[1].onerror?.({ message: "boom" } as ErrorEvent);
    await expect(second.result).rejects.toThrow("boom");
    expect(workers[1].terminated).toBe(true);
  });

  it("one job at a time; pause/resume reach the worker; dispose (unmount) rejects the running job", async () => {
    const { client, workers } = exportClient();
    const handle = client.startPdf(pdfRequest({}));
    expect(() => client.startPdf(pdfRequest({}))).toThrow("still running");
    handle.pause();
    handle.resume();
    expect(workers[0].posted.slice(-2).map((entry) => entry.message.type)).toEqual(["pause", "resume"]);
    client.dispose();
    await expect(handle.result).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].terminated).toBe(true);
  });
});

class FakePreviewWorker implements PreviewWorkerLike {
  posted: Array<{ message: Record<string, unknown>; transfer?: Transferable[] }> = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message: message as Record<string, unknown>, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: Record<string, unknown>) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("Preview worker client: model delivered to a port", () => {
  const input = { content: "x", settings, title: "T", images: {} };

  it("transfers the port, resolves on the delivery acknowledgement, and never receives the model itself", async () => {
    const workers: FakePreviewWorker[] = [];
    const client = new ReusablePreviewWorker(() => {
      const worker = new FakePreviewWorker();
      workers.push(worker);
      return worker;
    });
    const port = { id: "port" } as unknown as MessagePort;
    const delivered = client.deliverPublication(3, [{ kind: "body", index: 0 }], input, port);
    const sent = workers[0].posted[0];
    expect(sent.message).toMatchObject({ type: "publication", layoutId: 3, port });
    expect(sent.transfer).toEqual([port]);
    // Typing while the delivery is pending queues behind it instead of terminating the worker.
    client.request(input, () => undefined);
    expect(workers[0].terminated).toBe(false);
    workers[0].reply({ type: "publication", requestId: sent.message.requestId, delivered: true });
    await expect(delivered).resolves.toBeUndefined();
  });


});

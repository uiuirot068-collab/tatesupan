import { describe, expect, it } from "vitest";
import { serialize } from "node:v8";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Layout } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { buildV2PreviewPageModel } from "./previewPageModel";
import {
  buildLivePreviewDocument,
  EXPORT_ONLY_LAYOUT_KEYS,
  PreviewWorkerSession,
  type PreviewWorkerInput,
  type PreviewWorkerLayoutReply,
  type PreviewWorkerPublicationReply,
} from "./previewWorkerProtocol";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { ImageResolver } from "../../../typesetting-v2/renderer/publication/paintModel";

// Phase 8: the Preview worker reply carries only what Preview reads; export
// asks for the publication model of one exact layout. Deterministic (fake
// measurement), no timing assertions.

const MEASUREMENT = createFakeMeasurementProvider();
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const resolver: ImageResolver = (refId) =>
  refId === "a" ? { kind: "RESOLVED", url: "local-editor-image://a", bytes: new Uint8Array([1]), format: "PNG", pixelWidth: 1, pixelHeight: 1 } : { kind: "MISSING" };

const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 6, columnCount: 1 };
const colophonSettings: PageSettings = { ...settings, colophon: { ...settings.colophon, enabled: true } };

const input = (content: string, pageSettings: PageSettings = settings): PreviewWorkerInput => ({
  content,
  settings: pageSettings,
  title: "T",
  images: content.includes("IMG:a") ? { a: PNG } : {},
});
const composeFor = (value: PreviewWorkerInput) =>
  composeV2Layout({ title: value.title, content: value.content, settings: value.settings, measurement: MEASUREMENT, imageResolver: resolver });

function session() {
  const composed: string[] = [];
  const worker = new PreviewWorkerSession(async (value) => {
    composed.push(value.content);
    return composeFor(value);
  });
  return { worker, composed };
}

const MANUSCRIPT = [
  "　吾輩は｜猫《ねこ》である。名前はまだ無い。《《傍点》》どこで生れたかとんと見当がつかぬ――。",
  "【IMG:a:20:15:center】",
  "　何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している……。",
  "【改ページ】",
  "　吾輩はここで始めて人間というものを見た。",
].join("\n").repeat(4);

describe("normal Preview layout reply excludes export-only data", () => {
  it("the layout reply has no Core document, Publication model, units or source map at any level", async () => {
    const { worker } = session();
    const reply = (await worker.handle({ type: "compose", requestId: 7, input: input(MANUSCRIPT, colophonSettings) })) as PreviewWorkerLayoutReply;
    expect(Object.keys(reply).sort()).toEqual(["layout", "preview", "requestId", "type"]);
    expect(Object.keys(reply.layout).sort()).toEqual(["layoutId", "pageModel", "pageSequence"]);
    expect(reply.preview.kind).toBe("full"); // Phase 9: the first layout is a full Preview snapshot
    const preview = reply.preview.kind === "full" ? reply.preview.document : null;
    for (const part of [reply, reply.layout, reply.layout.pageModel, preview!]) {
      for (const key of EXPORT_ONLY_LAYOUT_KEYS) expect(Object.keys(part)).not.toContain(key);
    }
    const json = JSON.stringify(reply, (_key, value) => (value instanceof Map ? [...value] : value));
    expect(json).not.toContain('"placedUnits":'); // Core CanonicalDocument lines
    expect(json).not.toContain('"bodyEmMm":'); // Publication model
    expect(json).not.toContain('"debug":');
    expect(json).not.toContain("data:image"); // images are PageCard overlays; the reply never carries data URLs
  });

  it("the reply is much smaller than the layout it replaces, and smaller than the export model alone", () => {
    const layout = composeFor(input(MANUSCRIPT));
    const legacyReply = { bridge: layout, preview: buildV2PreviewDocument(layout, { a: PNG }) };
    const live = buildLivePreviewDocument(layout);
    const replyBytes = serialize({ layout: { pageSequence: layout.document.pageSequence, pageModel: buildV2PreviewPageModel(layout, MANUSCRIPT) }, preview: live }).length;
    expect(replyBytes).toBeLessThan(serialize(layout.model).length);
    expect(replyBytes * 3).toBeLessThan(serialize(legacyReply).length);
  });

  it("the live preview keeps every paint field the Editor renders (only debug info, image URLs, and ids/source spans differ)", () => {
    const layout = composeFor(input(MANUSCRIPT));
    const full = buildV2PreviewDocument(layout, {});
    const live = buildLivePreviewDocument(layout);
    const paintOnly = (value: typeof full) => JSON.parse(JSON.stringify(value, (key, v) => (key === "debug" || key === "sourceSpan" || key === "id" ? undefined : v)));
    expect(paintOnly(live)).toEqual(paintOnly(full));
    // Phase 9: spans are page-relative (same lengths, first unit at 0) and ids positional.
    live.pages.forEach((page, p) => {
      const units = page.columns.flatMap((column) => column.lines.flatMap((line) => line.units));
      const fullUnits = full.pages[p].columns.flatMap((column) => column.lines.flatMap((line) => line.units));
      if (units.length === 0) return;
      expect(Math.min(...units.map((unit) => unit.sourceSpan.start))).toBe(0);
      const shift = Math.min(...fullUnits.map((unit) => unit.sourceSpan.start));
      units.forEach((unit, i) => expect(unit.sourceSpan).toEqual({ ...fullUnits[i].sourceSpan, start: fullUnits[i].sourceSpan.start - shift, end: fullUnits[i].sourceSpan.end - shift }));
      expect(page.columns[0].lines[0].id).toBe("line-0");
    });
  });

  it("the page model in the reply equals the one the main thread used to build", async () => {
    const { worker } = session();
    const reply = (await worker.handle({ type: "compose", requestId: 1, input: input(MANUSCRIPT, colophonSettings) })) as PreviewWorkerLayoutReply;
    const direct = composeFor(input(MANUSCRIPT, colophonSettings));
    expect(reply.layout.pageModel).toEqual(buildV2PreviewPageModel(direct, MANUSCRIPT));
    expect(reply.layout.pageSequence).toEqual(direct.document.pageSequence);
  });
});

describe("export obtains the publication model of the exact layout it resolved", () => {
  it("answers from the kept layout without composing again", async () => {
    const { worker, composed } = session();
    const layoutReply = (await worker.handle({ type: "compose", requestId: 3, input: input(MANUSCRIPT) })) as PreviewWorkerLayoutReply;
    const reply = (await worker.handle({ type: "publication", requestId: 4, layoutId: 3, pageSequence: layoutReply.layout.pageSequence, input: input(MANUSCRIPT) })) as PreviewWorkerPublicationReply;
    expect(composed).toHaveLength(1);
    expect(worker.recompositionsForExport).toBe(0);
    const direct = composeFor(input(MANUSCRIPT));
    expect(reply.publication!.model).toEqual(direct.model);
    expect(reply.publication!.pageGeometry).toEqual(direct.pageGeometry);
  });

  it("a newer layout replaced the kept one: the exact older input is recomposed, equal to its own composition", async () => {
    const { worker, composed } = session();
    const older = input(MANUSCRIPT);
    const olderReply = (await worker.handle({ type: "compose", requestId: 1, input: older })) as PreviewWorkerLayoutReply;
    await worker.handle({ type: "compose", requestId: 2, input: input(`${MANUSCRIPT}追記`) });
    const reply = (await worker.handle({ type: "publication", requestId: 3, layoutId: 1, pageSequence: olderReply.layout.pageSequence, input: older })) as PreviewWorkerPublicationReply;
    expect(worker.recompositionsForExport).toBe(1);
    expect(composed.at(-1)).toBe(MANUSCRIPT); // never the newer text
    expect(reply.publication!.model).toEqual(composeFor(older).model);
  });

  it("a fresh worker (the old one was replaced) recomposes; a result that paginates differently is refused", async () => {
    const { worker } = session();
    const reply = (await worker.handle({ type: "publication", requestId: 1, layoutId: 99, pageSequence: composeFor(input(MANUSCRIPT)).document.pageSequence, input: input(MANUSCRIPT) })) as PreviewWorkerPublicationReply;
    expect(reply.publication!.model).toEqual(composeFor(input(MANUSCRIPT)).model);
    await expect(
      worker.handle({ type: "publication", requestId: 2, layoutId: 99, pageSequence: [{ kind: "body", index: 0 }], input: input(MANUSCRIPT) })
    ).rejects.toThrow("does not match");
  });

  it("colophon, ruby, 傍点, dash/ellipsis and image models survive the lazy path unchanged", async () => {
    const { worker } = session();
    const value = input(MANUSCRIPT, colophonSettings);
    const layoutReply = (await worker.handle({ type: "compose", requestId: 5, input: value })) as PreviewWorkerLayoutReply;
    const reply = (await worker.handle({ type: "publication", requestId: 6, layoutId: 5, pageSequence: layoutReply.layout.pageSequence, input: value })) as PreviewWorkerPublicationReply;
    const direct = composeFor(value);
    expect(direct.document.pageSequence.some((ref) => ref.kind === "colophon")).toBe(true);
    expect(reply.publication!.pageSequence).toEqual(direct.document.pageSequence);
    expect(structuredClone(reply.publication!.model)).toEqual(direct.model);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Layout } from "./composeV2Document";
import { applyPreviewTransfer, encodePreviewTransfer, previewTransferStats, type KeptPreview, type PreviewTransfer } from "./previewDelta";
import { buildLivePreviewDocument, PreviewWorkerSession, type PreviewWorkerInput, type PreviewWorkerLayoutReply } from "./previewWorkerProtocol";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { ImageResolver } from "../../../typesetting-v2/renderer/publication/paintModel";

// Phase 9: the Preview is sent as a delta against the Preview the main thread
// holds. Whatever the matching finds, the rebuilt document must equal the
// full one. Deterministic (fake measurement), no timing assertions.

const MEASUREMENT = createFakeMeasurementProvider();
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const resolver: ImageResolver = (refId) =>
  refId === "a" ? { kind: "RESOLVED", url: "local-editor-image://a", bytes: new Uint8Array([1]), format: "PNG", pixelWidth: 1, pixelHeight: 1 } : { kind: "MISSING" };
const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 6, columnCount: 1 };

const PARAGRAPHS = Array.from({ length: 40 }, (_, i) =>
  i % 7 === 3 ? "【IMG:a:20:15:center】" : `　第${i}段。吾輩は｜猫《ねこ》である。《《名前》》はまだ無い――どこで生れたか……。`
);
const text = (paragraphs: string[]) => paragraphs.join("\n");
const input = (content: string, pageSettings: PageSettings = settings): PreviewWorkerInput => ({ content, settings: pageSettings, title: "T", images: { a: PNG } });

function worker() {
  const session = new PreviewWorkerSession(async (value) =>
    composeV2Layout({ title: value.title, content: value.content, settings: value.settings, measurement: MEASUREMENT, imageResolver: resolver })
  );
  let requestId = 0;
  let applied: KeptPreview | null = null;
  /** One layout round trip as the adapter does it: send the applied base, apply the reply. */
  const layout = async (value: PreviewWorkerInput, base: number | null = applied?.layoutId ?? null) => {
    requestId += 1;
    const reply = (await session.handle({ type: "compose", requestId, input: value, basePreviewLayoutId: base ?? undefined })) as PreviewWorkerLayoutReply;
    const document = applyPreviewTransfer(reply.preview, applied);
    if (!document) throw new Error("stale delta");
    const previous = applied;
    applied = { layoutId: reply.layout.layoutId, document };
    return { reply, document, previous, stats: previewTransferStats(reply.preview) };
  };
  return { session, layout };
}

const fullDocument = (value: PreviewWorkerInput) =>
  buildLivePreviewDocument(composeV2Layout({ title: value.title, content: value.content, settings: value.settings, measurement: MEASUREMENT, imageResolver: resolver }));

describe("Preview delta transfer", () => {
  it("first layout is a full snapshot; a one-character edit sends only the changed page and reuses the rest by identity", async () => {
    const { layout } = worker();
    const first = await layout(input(text(PARAGRAPHS)));
    expect(first.stats.kind).toBe("full");
    const edited = [...PARAGRAPHS];
    edited[20] = edited[20].replace("吾輩", "我輩");
    const second = await layout(input(text(edited)));
    expect(second.stats.kind).toBe("delta");
    expect(second.document).toEqual(fullDocument(input(text(edited))));
    expect(second.stats.pagesSent).toBeGreaterThanOrEqual(1);
    expect(second.stats.pagesSent).toBeLessThan(second.document.pages.length / 4);
    // Unchanged pages are the very objects the main thread already held.
    const reusedIdentity = second.document.pages.filter((page) => first.document.pages.includes(page)).length;
    expect(reusedIdentity).toBe(second.stats.pagesReused);
    expect(JSON.stringify(second.reply.preview).length * 4).toBeLessThan(JSON.stringify(first.reply.preview).length);
  });

  it("an inserted page (改ページ) and a removed page still rebuild exactly", async () => {
    const { layout } = worker();
    await layout(input(text(PARAGRAPHS)));
    const withBreak = [...PARAGRAPHS];
    withBreak.splice(10, 0, "【改ページ】");
    const inserted = await layout(input(text(withBreak)));
    expect(inserted.document).toEqual(fullDocument(input(text(withBreak))));
    expect(inserted.document.pages.length).toBeGreaterThan(inserted.previous!.document.pages.length);
    const removed = PARAGRAPHS.filter((_, i) => i < 5 || i > 14);
    const shrunk = await layout(input(text(removed)));
    expect(shrunk.document).toEqual(fullDocument(input(text(removed))));
    expect(shrunk.document.pages.length).toBeLessThan(inserted.document.pages.length);
  });

  it("reordered paragraphs and a moved image rebuild exactly", async () => {
    const { layout } = worker();
    await layout(input(text(PARAGRAPHS)));
    const reordered = [...PARAGRAPHS];
    [reordered[5], reordered[30]] = [reordered[30], reordered[5]];
    const moved = await layout(input(text(reordered)));
    expect(moved.document).toEqual(fullDocument(input(text(reordered))));
  });

  it("a settings change that affects every page sends a full snapshot", async () => {
    const { layout } = worker();
    await layout(input(text(PARAGRAPHS)));
    const wider: PageSettings = { ...settings, charsPerLine: 12 };
    const changed = await layout(input(text(PARAGRAPHS), wider));
    expect(changed.stats.kind).toBe("full");
    expect(changed.document).toEqual(fullDocument(input(text(PARAGRAPHS), wider)));
  });

  it("no base (document switch) or a base the worker no longer holds → full snapshot", async () => {
    const { layout } = worker();
    await layout(input(text(PARAGRAPHS)));
    const switched = await layout(input(text(PARAGRAPHS.slice(0, 20))), null);
    expect(switched.stats.kind).toBe("full");
    const unknownBase = await layout(input(text(PARAGRAPHS.slice(0, 21))), 999);
    expect(unknownBase.stats.kind).toBe("full");
  });

  it("a delta whose base is not the Preview the main thread holds is rejected (stale)", () => {
    const base: KeptPreview = { layoutId: 1, document: fullDocument(input(text(PARAGRAPHS))) };
    const edited = [...PARAGRAPHS];
    edited[2] += "。";
    const transfer = encodePreviewTransfer(fullDocument(input(text(edited))), base);
    expect(transfer.kind).toBe("delta");
    expect(applyPreviewTransfer(transfer, null)).toBeNull();
    expect(applyPreviewTransfer(transfer, { ...base, layoutId: 2 })).toBeNull();
    expect(applyPreviewTransfer(transfer, base)).toEqual(fullDocument(input(text(edited))));
    const broken: PreviewTransfer = { ...(transfer as Extract<PreviewTransfer, { kind: "delta" }>), pages: [9_999] };
    expect(applyPreviewTransfer(broken, base)).toBeNull();
  });

  it("the worker keeps only the requester's base and the latest sent Preview", async () => {
    const { session, layout } = worker();
    await layout(input(text(PARAGRAPHS))); // 1 applied
    // Request 2 is sent but superseded before the main thread applies it.
    await session.handle({ type: "compose", requestId: 2, input: input(text([...PARAGRAPHS, "　追記一。"])), basePreviewLayoutId: 1 });
    // Request 3 still names base 1: the worker must still have it.
    const reply = (await session.handle({ type: "compose", requestId: 3, input: input(text([...PARAGRAPHS, "　追記二。"])), basePreviewLayoutId: 1 })) as PreviewWorkerLayoutReply;
    expect(reply.preview.kind).toBe("delta");
    const sent = (session as unknown as { sentPreviews: KeptPreview[] }).sentPreviews.map((kept) => kept.layoutId);
    expect(sent).toEqual([1, 3]);
  });
});

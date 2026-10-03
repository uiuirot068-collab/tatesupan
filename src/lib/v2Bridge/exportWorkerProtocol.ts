/**
 * Phase 9: the V2 export worker — PDF export without a main-thread PaintPlan.
 *
 * Before Phase 9 the main thread received the publication model (structured
 * clone), built the whole PaintPlan (~1.5 MB per page of nested drawing
 * commands), and posted plan + font (base64) to a fresh PDF worker. At 300
 * pages that post alone serialized ~513 MB on the main thread (~17.6 s).
 *
 * Now:
 *   main thread → export worker: job (page indices, layer order, PDF mode)
 *   Preview worker → export worker (MessagePort): the publication model of
 *                    the exact layout the export resolved (Phase 8 contract)
 *   export worker: font (fetched once per worker), paint contexts (once per
 *                  font), PaintPlan page by page, layer order, grayscale,
 *                  jsPDF, then the PDF bytes (transferred) to the main thread.
 *
 * JPG/ZIP (rasterized on the main thread with the document's webfont) asks
 * the same worker for one built page at a time (`ExportPageRequest`): a
 * page clones in ~30 ms, while building pages on the main thread first needs
 * the model (~0.9 s clone at 300 pages) and the font paint contexts (~0.75 s).
 *
 * The main thread keeps export freshness (`awaitComposition`), page scope,
 * warnings and blocks, progress UI and the download. Each page is built,
 * painted and dropped; the plan is never held whole. `pageAt(i)` is the same
 * function the full plan is built from (`createPublicationPaintPlanBuilder`),
 * so the output is the same.
 */
import type { PublicationPdfMode } from "../../../typesetting-v2/renderer/publication/pdfOutputGeometry";
import {
  createPublicationPaintPlanBuilder,
  preparePublicationFontPaintContext,
  renderPaintPagesToPdfAsync,
  type AsyncPdfRenderOptions,
  type PaintPagePlan,
  type PaintPlanPageSource,
  type PublicationFontPaintContext,
  type PublicationFontResource,
  type PublicationPdfResult,
} from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { applyPageImageLayerOrder, createPageGrayscaler, type RgbaDecoder } from "./exportPlan";
import { V2_EXPORT_REFUSAL_PREFIX, type PublicationPortMessage, type V2PublicationModel } from "./previewWorkerProtocol";

export interface ExportPdfJob {
  type: "pdf";
  jobId: number;
  /** Set when this job's model arrives on this port (the held model is replaced). */
  modelPort?: MessagePort;
  /** Physical page indices of the layout, in output order. */
  physicalIndices: number[];
  layerOrder: Record<string, number>;
  mode: PublicationPdfMode;
  /**
   * CST-PORT-013 確認用PDF: finished pages painted before / after the body
   * (the cover and back cover as one image each). Not grayscaled.
   */
  leadingPages?: PaintPagePlan[];
  trailingPages?: PaintPagePlan[];
}

/** One built page for the JPG rasterizer (layer order and grayscale applied). */
export interface ExportPageRequest {
  type: "page";
  jobId: number;
  requestId: number;
  modelPort?: MessagePort;
  physicalIndex: number;
  layerOrder: Record<string, number>;
}

export type ExportWorkerControl = { type: "pause" } | { type: "resume" } | { type: "cancel" };
export type ExportWorkerRequest = ExportPdfJob | ExportPageRequest | ExportWorkerControl;

export type ExportWorkerReply =
  | { type: "progress"; jobId: number; current: number; total: number }
  | { type: "complete"; jobId: number; bytes: Uint8Array; pageCount: number }
  | { type: "page"; jobId: number; requestId: number; page: PaintPagePlan }
  | { type: "cancelled"; jobId: number }
  | { type: "error"; jobId: number; message: string };

export interface ExportWorkerDeps {
  /** The embeddable font for an Editor CSS family (TSP-PHASE13-001); omitted = the default font. */
  loadFont: (cssFamily?: string) => Promise<PublicationFontResource>;
  decode: RgbaDecoder;
}

/** The worker's state, separate from `self` so it can be tested. */
export class ExportWorkerSession {
  /** Paint contexts per body CSS family ("" = default font). */
  private fontContexts = new Map<string, Promise<PublicationFontPaintContext>>();
  private held: {
    publication: V2PublicationModel;
    grayscale: (page: PaintPagePlan) => Promise<PaintPagePlan>;
    pages?: PaintPlanPageSource;
  } | null = null;
  /** Diagnostics (tests, benchmark). */
  fontLoads = 0;
  modelsReceived = 0;
  pagesBuilt = 0;

  constructor(private readonly deps: ExportWorkerDeps) {}

  /** Font bytes and paint contexts: loaded once per worker and body font, retried after a failure. */
  font(cssFamily?: string): Promise<PublicationFontPaintContext> {
    const key = cssFamily ?? "";
    let pending = this.fontContexts.get(key);
    if (!pending) {
      this.fontLoads += 1;
      const created = (key ? this.deps.loadFont(key) : this.deps.loadFont()).then(preparePublicationFontPaintContext);
      created.catch(() => {
        if (this.fontContexts.get(key) === created) this.fontContexts.delete(key);
      });
      this.fontContexts.set(key, created);
      pending = created;
    }
    return pending;
  }

  /**
   * TSP-PHASE13-001: the ノンブル / 奥付 fonts PDF also embeds, when they
   * differ from the body font (JPG uses the browser's webfonts instead).
   */
  private async extraFonts(model: V2PublicationModel["model"]): Promise<NonNullable<AsyncPdfRenderOptions["extraFonts"]>> {
    const body = (model.bodyFontFamily ?? "").trim();
    const families = [...new Set([model.folioFontFamily, model.colophonFontFamily].map((family) => (family ?? "").trim()))].filter(
      (family) => family !== "" && family !== body
    );
    return Promise.all(families.map(async (cssFamily) => ({ cssFamily, font: await this.deps.loadFont(cssFamily) })));
  }

  get hasModel(): boolean {
    return this.held !== null;
  }

  /** Replaces the held model with the one the Preview worker delivered (or its refusal). */
  receiveModel(message: PublicationPortMessage): void {
    this.held = null;
    if (!message.ok) throw new Error(message.message);
    this.modelsReceived += 1;
    this.held = { publication: message.publication, grayscale: createPageGrayscaler(this.deps.decode) };
  }

  async renderPdf(
    job: Pick<ExportPdfJob, "physicalIndices" | "layerOrder" | "mode" | "leadingPages" | "trailingPages">,
    hooks: Pick<AsyncPdfRenderOptions, "beforePage" | "onProgress"> = {}
  ): Promise<PublicationPdfResult> {
    const { held, source, fontContext } = await this.pageSource();
    const extraFonts = await this.extraFonts(held.publication.model);
    const indices = job.physicalIndices;
    if (indices.length === 0 || indices.some((index) => !Number.isInteger(index) || index < 0 || index >= source.pageCount)) {
      throw new Error("V2 PDF export could not resolve the selected canonical pages.");
    }
    const leading = job.leadingPages ?? [];
    const trailing = job.trailingPages ?? [];
    return renderPaintPagesToPdfAsync(
      leading.length + indices.length + trailing.length,
      (i) => {
        if (i < leading.length) return leading[i];
        const bodyIndex = i - leading.length;
        if (bodyIndex >= indices.length) return trailing[bodyIndex - indices.length];
        this.pagesBuilt += 1;
        return held.grayscale(applyPageImageLayerOrder(source.pageAt(indices[bodyIndex]), job.layerOrder));
      },
      fontContext.fontResource,
      { mode: job.mode, ...(extraFonts.length > 0 ? { extraFonts } : {}), ...hooks }
    );
  }

  /** One page for the JPG rasterizer: exactly what `renderPdf` paints for that index. */
  async rasterPage(physicalIndex: number, layerOrder: Record<string, number>): Promise<PaintPagePlan> {
    const { held, source } = await this.pageSource();
    if (!Number.isInteger(physicalIndex) || physicalIndex < 0 || physicalIndex >= source.pageCount) {
      throw new Error("V2 JPG export could not resolve the selected canonical pages.");
    }
    this.pagesBuilt += 1;
    return held.grayscale(applyPageImageLayerOrder(source.pageAt(physicalIndex), layerOrder));
  }

  /** The held model's page builder (refusal checked once per model). */
  private async pageSource() {
    const held = this.held;
    if (!held) throw new Error("V2 export: the export worker has no publication model.");
    // TSP-PHASE13-001: the body font paints (and supplies glyph metrics for) the plan.
    const fontContext = await this.font(held.publication.model.bodyFontFamily);
    held.pages ??= createPublicationPaintPlanBuilder(held.publication.model, fontContext.fontResource, held.publication.pageGeometry, V2_EXPORT_REFUSAL_PREFIX, fontContext);
    return { held, source: held.pages, fontContext };
  }
}

/** Resolves with the first message on `port` (the Preview worker's delivery), then closes it. */
export function receivePortMessage(port: MessagePort): Promise<PublicationPortMessage> {
  return new Promise((resolve) => {
    port.onmessage = (event: MessageEvent<PublicationPortMessage>) => {
      port.onmessage = null;
      port.close();
      resolve(event.data);
    };
    port.start();
  });
}

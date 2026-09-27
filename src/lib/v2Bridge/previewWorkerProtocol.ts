/**
 * Phase 8: the V2 Preview worker's message protocol.
 *
 * Before Phase 8 every layout reply structured-cloned the whole
 * `V2LayoutResult` (Core `document`, Publication `model`, units, source map)
 * plus the Preview `PaintDocument` to the main thread: about 38 MB of
 * structured-clone data per 100 pages. Only a small part of it has a
 * consumer during editing. Classification:
 *
 * | data                                   | consumer                     | class | crosses on every layout |
 * |----------------------------------------|------------------------------|-------|-------------------------|
 * | preview body pages (paint geometry)    | PageCard → PreviewPage       | A     | yes                     |
 * | preview `fontSizePx`                   | PageCard                     | A     | yes                     |
 * | page model (`buildV2PreviewPageModel`) | page list, selection, caret, | B     | yes (built in worker)   |
 * |                                        | reorder, image pages         |       |                         |
 * | `pageSequence`                         | export page selection        | B     | yes                     |
 * | Publication `model` + `pageGeometry`   | export PaintPlan only        | C     | no: on export request   |
 * | per-unit `debug` paint info            | PreviewRenderer debug mode   | D     | no: stripped            |
 * | IMAGE unit data URLs in the preview    | none (Editor paints images   | E     | no: placeholders        |
 * |                                        | as PageCard overlays)        |       |                         |
 * | Core `document`, units, source, source | page model + model builders  | E     | no: stay in the worker  |
 * |   map, layout settings                 |   (both run in the worker)   |       |                         |
 *
 * Export freshness (Phase 3) is unchanged: export still waits, through the
 * `CompositionGate`, for the layout of exactly the current input, and then
 * asks the worker for THAT layout's publication model (`layoutId`). The
 * worker answers from the layout it kept, or, if it no longer has it (a
 * newer layout replaced it, or the worker was replaced), recomposes the SAME
 * exact input and checks the page sequence against the layout the export
 * already resolved.
 *
 * Phase 9: the model no longer has to cross to the main thread at all.
 *  - PDF: the request carries a `MessagePort` whose other end belongs to
 *    the export worker. The model goes worker → worker; the main thread only
 *    gets a small acknowledgement (`delivered`).
 *    JPG pages are built by the same export worker (exportWorkerProtocol.ts).
 */
import type { PageSettings } from "../pageLayout";
import type { V2LayoutResult } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { buildV2PreviewPageModel, type V2PreviewPageModel } from "./previewPageModel";
import type { PhysicalPageRef } from "../../../typesetting-v2/core/layout/schema";
import type { PaintDocument } from "../../../typesetting-v2/renderer/preview/paintModel";
import { encodePreviewTransfer, type KeptPreview, type PreviewTransfer } from "./previewDelta";
import type { PublicationDocument } from "../../../typesetting-v2/renderer/publication/paintModel";
import type { PublicationPageGeometry } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

/** What a worker composes from (images already trimmed to the referenced ones). */
export interface PreviewWorkerInput {
  content: string;
  settings: PageSettings;
  title: string;
  images: Record<string, string>;
}

/**
 * The main thread's view of one V2 composition: everything Preview and page
 * UI read, and the key to ask for its publication model on export.
 */
export interface V2PreviewLayout {
  /** The worker request that composed this layout (key of the worker's kept publication model). */
  layoutId: number;
  /** Publication (physical) page order: body pages and the colophon. */
  pageSequence: PhysicalPageRef[];
  pageModel: V2PreviewPageModel;
}

/** Export-only data (class C), requested per export for one exact layout. */
export interface V2PublicationModel {
  model: PublicationDocument;
  pageGeometry: PublicationPageGeometry;
  pageSequence: PhysicalPageRef[];
}

/** The refusal prefix of every V2 browser export (HOLD / unresolved images). */
export const V2_EXPORT_REFUSAL_PREFIX = "V2 Beta export";

export interface PreviewWorkerLayoutReply {
  type: "complete";
  requestId: number;
  layout: V2PreviewLayout;
  /** Phase 9: a full snapshot, or only the pages that differ from the requester's base (previewDelta.ts). */
  preview: PreviewTransfer;
}

export interface PreviewWorkerPublicationReply {
  type: "publication";
  requestId: number;
  /** Absent when the model was delivered to a port instead (`delivered: true`). */
  publication?: V2PublicationModel;
  delivered?: boolean;
}

/** What the Preview worker posts to an export port (Phase 9). */
export type PublicationPortMessage =
  | { ok: true; publication: V2PublicationModel }
  | { ok: false; message: string };

/** Keys that must never cross the boundary in a normal layout reply (architecture test). */
export const EXPORT_ONLY_LAYOUT_KEYS = ["document", "model", "units", "source", "bodySourceMap", "colophonUnits", "colophonSource", "layoutSettings", "pageGeometry"] as const;

/**
 * The Preview paint document as the Editor paints it: images are drawn by
 * PageCard overlays (`PreviewPage paintImages={false}`), so IMAGE units carry
 * placeholders instead of data URLs, and the per-unit debug info (read only by
 * the renderer's debug mode) is dropped. Mutates the freshly built document.
 */
export function buildLivePreviewDocument(layout: V2LayoutResult): PaintDocument {
  const preview = buildV2PreviewDocument(layout, {});
  for (const page of [...preview.pages, ...(preview.colophonPages ?? [])]) {
    // Phase 9: page-relative source positions. Line/unit ids and source spans
    // carried absolute manuscript offsets, so one inserted character made
    // every later page differ although it paints identically, and the delta
    // transfer (previewDelta.ts) had to resend all of them. In the Editor
    // they are only React keys and debug-mode labels (debug info is dropped
    // here anyway); caret and selection mapping use the page model, which
    // keeps absolute offsets.
    let base = Infinity;
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const unit of line.units) base = Math.min(base, unit.sourceSpan.start);
      }
    }
    if (!Number.isFinite(base)) base = 0;
    for (const column of page.columns) {
      column.lines.forEach((line, lineIndex) => {
        line.id = `line-${lineIndex}`;
        line.units.forEach((unit, unitIndex) => {
          delete unit.debug;
          unit.id = `unit-${unitIndex}`;
          // A new object: the span is shared with the Core document the page
          // model and the export model are built from.
          const span = unit.sourceSpan;
          unit.sourceSpan = { ...span, start: span.start - base, end: span.end - base };
        });
      });
    }
  }
  return preview;
}

export function buildPreviewWorkerReply(
  requestId: number,
  layout: V2LayoutResult,
  preview: PreviewTransfer,
  content: string
): PreviewWorkerLayoutReply {
  return {
    type: "complete",
    requestId,
    layout: {
      layoutId: requestId,
      pageSequence: layout.document.pageSequence,
      pageModel: buildV2PreviewPageModel(layout, content),
    },
    preview,
  };
}

export function publicationModelOf(layout: V2LayoutResult): V2PublicationModel {
  return { model: layout.model, pageGeometry: layout.pageGeometry, pageSequence: layout.document.pageSequence };
}

export type PreviewWorkerRequest =
  | {
      type: "compose";
      requestId: number;
      input: PreviewWorkerInput;
      /** Phase 9: the layoutId of the Preview the main thread shows; absent = send a full snapshot. */
      basePreviewLayoutId?: number;
    }
  | {
      type: "publication";
      requestId: number;
      layoutId: number;
      pageSequence: PhysicalPageRef[];
      input: PreviewWorkerInput;
      /** Phase 9: deliver the model here (the export worker's port) instead of in the reply. */
      port?: MessagePort;
    };

/**
 * The worker's state machine, separate from `self` so it can be tested. It
 * keeps the publication model of the LAST layout it composed and answers an
 * export request from it when the ids match; otherwise it recomposes the
 * request's exact input and refuses a result that paginates differently from
 * the layout the export resolved.
 */
export class PreviewWorkerSession {
  private kept: { layoutId: number; publication: V2PublicationModel } | null = null;
  /**
   * Phase 9: the Preview documents this worker sent that the main thread may
   * hold: the requester's current base and the latest one sent (at most two).
   */
  private sentPreviews: KeptPreview[] = [];
  /** Diagnostics (tests, benchmark). */
  recompositionsForExport = 0;

  constructor(private readonly compose: (input: PreviewWorkerInput) => Promise<V2LayoutResult>) {}

  async handle(message: PreviewWorkerRequest): Promise<PreviewWorkerLayoutReply | PreviewWorkerPublicationReply> {
    if (message.type === "compose") {
      const layout = await this.compose(message.input);
      const preview = buildLivePreviewDocument(layout);
      this.kept = { layoutId: message.requestId, publication: publicationModelOf(layout) };
      const base = message.basePreviewLayoutId === undefined ? null : this.sentPreviews.find((kept) => kept.layoutId === message.basePreviewLayoutId) ?? null;
      const transfer = encodePreviewTransfer(preview, base);
      this.sentPreviews = [...(base ? [base] : []), { layoutId: message.requestId, document: preview }];
      return buildPreviewWorkerReply(message.requestId, layout, transfer, message.input.content);
    }
    let publication = this.kept?.layoutId === message.layoutId ? this.kept.publication : null;
    if (!publication) {
      this.recompositionsForExport += 1;
      publication = publicationModelOf(await this.compose(message.input));
      if (!samePageSequence(publication.pageSequence, message.pageSequence)) {
        throw new Error("V2 export: the recomposed layout does not match the Preview layout.");
      }
    }
    return { type: "publication", requestId: message.requestId, publication };
  }
}

export function samePageSequence(a: readonly PhysicalPageRef[], b: readonly PhysicalPageRef[]): boolean {
  return a.length === b.length && a.every((ref, i) => ref.kind === b[i].kind && ref.index === b[i].index);
}

/**
 * CST-PORT-013: 確認用PDFに入れる表紙・裏表紙を画像にする（ブラウザ専用）。
 *
 * 表紙の書き出し（coverExportRun）と同じ描画命令・同じ解像度（350dpi、
 * 端末の上限を超えるときだけ下げる）で、反映済みの面だけを JPG にする。
 */
import type { CoverSettings } from "./coverModel";
import { getCoverFaceGeometry } from "./coverGeometry";
import { coverExportDpi, pxPerMmForDpi } from "./coverExport";
import { buildCoverFacePlan } from "./coverPaint";
import { canvasCoverMeasure, canvasToJpegBlob, ensureCoverFonts, renderCoverPlanToCanvas } from "./coverCanvas";
import { loadImages } from "./coverExportRun";
import { coverProofSides, type CoverProofRaster } from "./coverProof";

export interface CoverProofRasterRequest {
  cover: CoverSettings | undefined;
  paperSize: string;
  /** 表紙画像の dataUrl（IndexedDB の id → dataUrl） */
  imageDataUrls: Record<string, string>;
}

/** 反映済みの面を、表紙 → 裏表紙の順に画像にする。どちらも未反映なら空。 */
export async function renderCoverProofRasters(request: CoverProofRasterRequest): Promise<CoverProofRaster[]> {
  const { cover, paperSize, imageDataUrls } = request;
  const sides = coverProofSides(cover);
  if (!cover || sides.length === 0) return [];
  const face = getCoverFaceGeometry(paperSize);
  const options = { measure: canvasCoverMeasure, showGuides: false };
  const build = () => sides.map((side) => ({ side, plan: buildCoverFacePlan(cover, side, face, options) }));
  let jobs = build();
  // フォントを読み込んだら文字幅が変わるので、組み直してから描く
  if (await ensureCoverFonts(jobs.map((job) => job.plan))) jobs = build();
  const images = await loadImages(
    jobs.map((job) => job.plan),
    imageDataUrls,
  );

  const rasters: CoverProofRaster[] = [];
  const outputPxPerMm = pxPerMmForDpi(coverExportDpi(face.widthMm, face.heightMm));
  for (const job of jobs) {
    const refPxPerMm = job.plan.widthPx / face.widthMm;
    const canvas = renderCoverPlanToCanvas(job.plan, outputPxPerMm / refPxPerMm, images);
    const jpeg = new Uint8Array(await (await canvasToJpegBlob(canvas)).arrayBuffer());
    canvas.width = 0;
    canvas.height = 0;
    rasters.push({
      side: job.side,
      jpeg,
      trimWidthMm: face.trimWidthMm,
      trimHeightMm: face.trimHeightMm,
      bleedMm: face.bleedMm,
    });
  }
  return rasters;
}

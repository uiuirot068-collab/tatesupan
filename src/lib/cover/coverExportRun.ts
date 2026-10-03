/**
 * CST-PORT-011: 表紙ファイルを作って保存する（ブラウザ専用）。
 *
 * プレビューと同じ描画命令（buildCover*Plan）を、ガイドなし・印刷解像度で
 * canvas に描き、JPG はそのまま、PDF は仕上がり＋塗り足しの大きさのページに
 * 1枚の画像として入れる。2つ以上のファイルは ZIP にまとめる。
 */
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { CoverFaceSide, CoverSettings } from "./coverModel";
import { getCoverFaceGeometry, getCoverSpreadGeometry } from "./coverGeometry";
import {
  coverExportAvailability,
  coverExportDpi,
  coverFileName,
  pxPerMmForDpi,
  type CoverExportContent,
  type CoverExportFormat,
} from "./coverExport";
import { buildCoverFacePlan, buildCoverSpreadPlan, coverPlanImageIds, type CoverPlan } from "./coverPaint";
import {
  canvasCoverMeasure,
  canvasToJpegBlob,
  ensureCoverFonts,
  loadCoverImage,
  renderCoverPlanToCanvas,
  type CoverImageSources,
} from "./coverCanvas";

type NamedFile = { name: string; blob: Blob };

type Job = { name: string; plan: CoverPlan; widthMm: number; heightMm: number };

export interface CoverExportRequest {
  cover: CoverSettings;
  paperSize: string;
  content: CoverExportContent;
  format: CoverExportFormat;
  stem: string;
  /** 表紙画像の dataUrl（IndexedDB の id → dataUrl） */
  imageDataUrls: Record<string, string>;
  onProgress?: (message: string) => void;
}

const FACE_LABEL: Record<CoverFaceSide, string> = { front: "表紙", back: "裏表紙" };

function buildJobs(request: CoverExportRequest): Job[] {
  const { cover, paperSize, content, format, stem } = request;
  const availability = coverExportAvailability(content, cover);
  if (!availability.ok) throw new Error(availability.reason);
  const options = { measure: canvasCoverMeasure, showGuides: false };
  if (content === "cover-spread") {
    const spread = getCoverSpreadGeometry(paperSize, cover.spine.widthMm);
    return [
      {
        name: coverFileName.spread(stem, format),
        plan: buildCoverSpreadPlan(cover, spread, options),
        widthMm: spread.widthMm,
        heightMm: spread.heightMm,
      },
    ];
  }
  const face = getCoverFaceGeometry(paperSize);
  return availability.sides.map((side) => ({
    name: coverFileName.face(stem, side, format),
    plan: buildCoverFacePlan(cover, side, face, options),
    widthMm: face.widthMm,
    heightMm: face.heightMm,
  }));
}

async function loadImages(plans: CoverPlan[], dataUrls: Record<string, string>): Promise<CoverImageSources> {
  const ids = Array.from(new Set(plans.flatMap(coverPlanImageIds)));
  const sources: CoverImageSources = {};
  for (const id of ids) {
    const dataUrl = dataUrls[id];
    if (!dataUrl) {
      throw new Error("表紙の画像がこの端末に見つかりません。表紙の画面で画像を選び直してください。");
    }
    sources[id] = await loadCoverImage(dataUrl);
  }
  return sources;
}

/** 表紙ファイルを作って保存する。保存したファイル名を返す。 */
export async function exportCoverFiles(request: CoverExportRequest): Promise<string[]> {
  const progress = request.onProgress ?? (() => {});
  const { format } = request;

  progress("フォントを準備中…");
  let jobs = buildJobs(request);
  // フォントを読み込んだら文字幅が変わるので、組み直してから描く
  if (await ensureCoverFonts(jobs.map((job) => job.plan))) jobs = buildJobs(request);
  const images = await loadImages(
    jobs.map((job) => job.plan),
    request.imageDataUrls,
  );

  const files: NamedFile[] = [];
  for (const job of jobs) {
    const side = job.name.includes("_back.") ? "back" : job.name.includes("_front.") ? "front" : null;
    progress(side ? `${FACE_LABEL[side]}を書き出し中…` : "見開きの表紙を書き出し中…");
    const dpi = coverExportDpi(job.widthMm, job.heightMm);
    const outputPxPerMm = pxPerMmForDpi(dpi);
    const refPxPerMm = job.plan.widthPx / job.widthMm;
    const canvas = renderCoverPlanToCanvas(job.plan, outputPxPerMm / refPxPerMm, images);
    const jpeg = await canvasToJpegBlob(canvas);
    if (format === "jpg") {
      files.push({ name: job.name, blob: jpeg });
    } else {
      const pdf = new jsPDF({
        unit: "mm",
        format: [job.widthMm, job.heightMm],
        orientation: job.widthMm > job.heightMm ? "landscape" : "portrait",
        compress: true,
      });
      const bytes = new Uint8Array(await jpeg.arrayBuffer());
      pdf.addImage(bytes, "JPEG", 0, 0, job.widthMm, job.heightMm, undefined, "NONE");
      files.push({ name: job.name, blob: pdf.output("blob") });
    }
    canvas.width = 0;
    canvas.height = 0;
  }

  if (files.length === 1) {
    saveAs(files[0].blob, files[0].name);
  } else {
    progress("ZIPを作成中…");
    const zip = new JSZip();
    for (const file of files) zip.file(file.name, file.blob);
    // JPG・PDF はすでに圧縮済みなので STORE（無圧縮でまとめるだけ）
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    saveAs(blob, coverFileName.zip(request.stem));
  }
  return files.map((file) => file.name);
}

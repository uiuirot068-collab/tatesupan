/**
 * CST-PORT-011: 表紙の描画命令を canvas に描く（ブラウザ専用）。
 *
 * プレビューも書き出しもこの1つの関数で描く。違うのは倍率（scale）だけ。
 */
import type { CoverFont, CoverMeasure, CoverPaintOp, CoverPlan } from "./coverPaint";
import { coverPlanFonts, patternPrimitives } from "./coverPaint";

export type CoverImageSources = Record<string, CanvasImageSource | undefined>;

export function fontString(font: CoverFont, sizePx = font.sizePx): string {
  return `${font.weight} ${sizePx}px ${font.family}`;
}

const MEASURE_SIZE_PX = 100;
let measureContext: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, number>();

/** ブラウザのフォントで測る文字幅（100px で測って比例で縮める）。 */
export const canvasCoverMeasure: CoverMeasure = (text, font) => {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
  }
  if (!measureContext) return Array.from(text).length * font.sizePx;
  const key = `${font.weight}|${font.family}|${text}`;
  let width = measureCache.get(key);
  if (width === undefined) {
    measureContext.font = fontString(font, MEASURE_SIZE_PX);
    width = measureContext.measureText(text).width;
    measureCache.set(key, width);
  }
  return (width * font.sizePx) / MEASURE_SIZE_PX;
};

/** フォント読み込み後は測り直す（読み込み前の代替フォントの幅を使わない）。 */
export function clearCoverMeasureCache(): void {
  measureCache.clear();
}

/** 描画で使うフォントを、使う文字の分だけ先に読み込む（Google Fonts は文字ごとに分割配信）。 */
export async function ensureCoverFonts(plans: CoverPlan[]): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return false;
  const requests = plans.flatMap((plan) => coverPlanFonts(plan));
  const needed = requests.filter(({ font, text }) => text && !document.fonts.check(fontString(font, 16), text));
  if (needed.length === 0) return false;
  await Promise.all(needed.map(({ font, text }) => document.fonts.load(fontString(font, 16), text).catch(() => [])));
  clearCoverMeasureCache();
  return true;
}

export function loadCoverImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("表紙の画像を読み込めませんでした。"));
    image.src = dataUrl;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
  ctx.lineTo(x + radius, y + h);
  ctx.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function paintOp(ctx: CanvasRenderingContext2D, op: CoverPaintOp, images: CoverImageSources): void {
  switch (op.kind) {
    case "fill": {
      if (op.fill.type === "solid") {
        ctx.fillStyle = op.fill.color;
      } else {
        const gradient = ctx.createLinearGradient(op.fill.x0, op.fill.y0, op.fill.x1, op.fill.y1);
        gradient.addColorStop(0, op.fill.color0);
        gradient.addColorStop(1, op.fill.color1);
        ctx.fillStyle = gradient;
      }
      if (op.radius) {
        roundedRectPath(ctx, op.rect.x, op.rect.y, op.rect.width, op.rect.height, op.radius);
        ctx.fill();
      } else {
        ctx.fillRect(op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      }
      return;
    }
    case "pattern": {
      const primitives = patternPrimitives(op.design, op.rect);
      ctx.save();
      ctx.beginPath();
      ctx.rect(op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      ctx.clip();
      ctx.fillStyle = primitives.color;
      ctx.beginPath();
      for (const points of primitives.polygons) {
        ctx.moveTo(points[0], points[1]);
        for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
        ctx.closePath();
      }
      for (const [x, y, r] of primitives.circles) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill("nonzero");
      ctx.restore();
      return;
    }
    case "image": {
      const source = images[op.assetId];
      if (!source) return;
      ctx.save();
      ctx.globalAlpha = op.opacity;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      ctx.restore();
      return;
    }
    case "line": {
      ctx.save();
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.setLineDash(op.dash ?? []);
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case "strokeRect": {
      ctx.save();
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.setLineDash(op.dash ?? []);
      ctx.strokeRect(op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      ctx.restore();
      return;
    }
    case "glyph": {
      ctx.fillStyle = op.color;
      ctx.font = fontString(op.font);
      if (op.mode === "horizontal") {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(op.text, op.x, op.y);
        return;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (op.mode === "rotated") {
        ctx.save();
        ctx.translate(op.x, op.y);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(op.text, 0, 0);
        ctx.restore();
        return;
      }
      if (op.mode === "tcy") {
        // 縦中横: 1マス（1em）の幅に横組みで収める
        ctx.fillText(op.text, op.x, op.y, op.font.sizePx * 0.98);
        return;
      }
      ctx.fillText(op.text, op.x, op.y);
      return;
    }
    case "clip": {
      ctx.save();
      ctx.beginPath();
      ctx.rect(op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      ctx.clip();
      return;
    }
    case "unclip":
      ctx.restore();
      return;
  }
}

/** 描画命令を、基準 px × scale の大きさで描く。 */
export function paintCoverPlan(
  ctx: CanvasRenderingContext2D,
  plan: CoverPlan,
  scale: number,
  images: CoverImageSources,
): void {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const op of plan.ops) paintOp(ctx, op, images);
  ctx.restore();
}

/** 新しい canvas に描いて返す（書き出し用）。 */
export function renderCoverPlanToCanvas(plan: CoverPlan, outputPxPerRefPx: number, images: CoverImageSources): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(plan.widthPx * outputPxPerRefPx));
  canvas.height = Math.max(1, Math.round(plan.heightPx * outputPxPerRefPx));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("表紙を描く準備ができませんでした（canvas を使えません）。");
  paintCoverPlan(ctx, plan, canvas.width / plan.widthPx, images);
  return canvas;
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPG を作れませんでした。"))),
      "image/jpeg",
      quality,
    );
  });
}

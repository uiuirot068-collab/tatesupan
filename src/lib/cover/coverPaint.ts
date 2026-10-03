/**
 * CST-PORT-011: 表紙の「描く手順」（純粋関数・ブラウザ不要）。
 *
 * COLUMNSTAND は表紙を HTML/CSS で組み、書き出しは html-to-image で画面を
 * 写し取る。TateSpun の書き出しは画面の写し取りではなく描画命令から PDF を
 * 作る方式なので、表紙も同じ考え方で作り直した:
 *
 *   設定 + 寸法 ──buildCover*Plan──▶ 描画命令の並び（基準 px 単位）
 *                                   ├─ プレビュー: canvas に縮小して描く
 *                                   └─ 書き出し:   canvas に 350dpi で描く → JPG / PDF
 *
 * プレビューと書き出しは同じ命令を同じ関数（coverCanvas.paintCoverPlan）で
 * 描くので、見た目がずれない。違いは倍率とガイド線の有無だけ。
 *
 * 寸法・文字の大きさ・余白は、COLUMNSTAND の Human QA 合格時の CSS 値
 * （editor-v3.css の .cover-*、塗り足し込み1面 = 幅308px）をそのまま基準 px
 * として使う。文字幅だけはブラウザのフォントで測る必要があるので、
 * `measure` として外から渡す（テストでは近似の測り方を渡す）。
 */
import { FONT_FAMILY_OPTIONS } from "../../constants/fonts";
import { verticalPaintGraphemeFor } from "../../../typesetting-v2/renderer/publication/verticalGlyphMap";
import {
  activeCoverTemplate,
  artworkForSide,
  designForSide,
  isImageOnlyCover,
  type CoverFaceSide,
  type CoverPatternId,
  type CoverSettings,
  type CoverSideDesign,
  type CoverTemplateId,
} from "./coverModel";
import {
  ptToMm,
  spineTextState,
  type CoverFaceGeometry,
  type CoverSpreadGeometry,
} from "./coverGeometry";
import {
  coverInlineSegments,
  coverPlainText,
  spineTextParts,
  SPINE_LETTER_SPACING_EM,
  SPINE_PART_GAP_EM,
} from "./coverText";

/* ── 型 ─────────────────────────────────────────────────────────── */

export type Rect = { x: number; y: number; width: number; height: number };

export type CoverFont = { family: string; sizePx: number; weight: number };

/** 文字列の幅（px）。`font.sizePx` の大きさで測った値を返す。 */
export type CoverMeasure = (text: string, font: CoverFont) => number;

export type CoverFill =
  | { type: "solid"; color: string }
  | { type: "linear"; x0: number; y0: number; x1: number; y1: number; color0: string; color1: string };

/**
 * glyph の位置:
 *  - horizontal: x = 字の左端、y = 行の中央
 *  - upright / rotated / tcy: (x, y) = 縦組みの字のマスの中心
 */
export type CoverGlyphMode = "horizontal" | "upright" | "rotated" | "tcy";

export type CoverPaintOp =
  | { kind: "fill"; rect: Rect; fill: CoverFill; radius?: number }
  | { kind: "pattern"; rect: Rect; design: CoverSideDesign }
  | { kind: "image"; assetId: string; rect: Rect; opacity: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: number[] }
  | { kind: "strokeRect"; rect: Rect; color: string; width: number; dash?: number[] }
  | { kind: "glyph"; text: string; x: number; y: number; font: CoverFont; color: string; mode: CoverGlyphMode }
  | { kind: "clip"; rect: Rect }
  | { kind: "unclip" };

export type CoverPlan = { widthPx: number; heightPx: number; ops: CoverPaintOp[] };

export type CoverPlanOptions = {
  measure: CoverMeasure;
  /** 仕上がり線・折り位置の点線（プレビューだけ。書き出しには出さない） */
  showGuides: boolean;
};

/* ── フォント・色（COLUMNSTAND の CSS 値） ───────────────────────── */

export const COVER_MINCHO_FAMILY = "'Shippori Mincho', serif";
export const COVER_SANS_FAMILY = "'Noto Sans JP', sans-serif";
/** CSS の line-height: normal の近似（Noto / しっぽり明朝） */
const LINE_HEIGHT_NORMAL = 1.45;

const GUIDE_COLOR = "rgba(92, 71, 95, 0.62)";
const FOLD_GUIDE_COLOR = "rgba(92, 71, 95, 0.5)";
const GUIDE_DASH = [4, 3];

export function templateDefaultTextColor(template: CoverTemplateId): string {
  return template === "lower-band" ? "#ffffff" : "#16131a";
}

export function isStripePattern(patternId: CoverPatternId): boolean {
  return patternId === "vertical-stripes" || patternId === "horizontal-stripes" || patternId === "diagonal-stripes";
}

export function spineFontFamily(fontId: string): string {
  return FONT_FAMILY_OPTIONS.some((option) => option.value === fontId)
    ? fontId
    : FONT_FAMILY_OPTIONS[0]?.value ?? COVER_MINCHO_FAMILY;
}

function rgbaFromHex(hex: string, opacity: number): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/* ── 背景・模様 ─────────────────────────────────────────────────── */

/** CSS linear-gradient(角度) と同じ始点・終点（180deg=上→下, 90deg=左→右, 135deg=左上→右下）。 */
export function backgroundFill(design: CoverSideDesign, rect: Rect): CoverFill {
  if (design.backgroundType === "solid") return { type: "solid", color: design.solidColor };
  const angleDeg = design.gradientDirection === "horizontal" ? 90 : design.gradientDirection === "diagonal" ? 135 : 180;
  const angle = (angleDeg * Math.PI) / 180;
  // 90°/180° で sin・cos に出る 1e-16 程度の誤差を 0 にそろえる
  const snap = (value: number) => (Math.abs(value) < 1e-9 ? 0 : value);
  const dx = snap(Math.sin(angle));
  const dy = snap(-Math.cos(angle));
  const half = (Math.abs(rect.width * dx) + Math.abs(rect.height * dy)) / 2;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    type: "linear",
    x0: cx - dx * half,
    y0: cy - dy * half,
    x1: cx + dx * half,
    y1: cy + dy * half,
    color0: design.gradientColor1,
    color1: design.gradientColor2,
  };
}

export type PatternPrimitives = {
  color: string;
  /** 塗りつぶす四角形（4点、x0,y0,…,x3,y3） */
  polygons: number[][];
  /** 円 [cx, cy, r] */
  circles: Array<[number, number, number]>;
};

/** 模様1単位の大きさ（基準 px）。CST: max(4, 18 × サイズ%) */
export function patternUnitPx(design: Pick<CoverSideDesign, "patternScale">): number {
  return Math.max(4, 18 * (design.patternScale / 100));
}

/** ストライプの線の太さ（基準 px）。CST: max(0.75, 単位 × 0.13 × 太さ%) */
export function stripeWidthPx(design: Pick<CoverSideDesign, "patternScale" | "stripeThickness">): number {
  return Math.max(0.75, patternUnitPx(design) * 0.13 * (design.stripeThickness / 100));
}

/**
 * 模様の図形。回転は模様の座標だけを回し（面・文字・帯は回さない）、
 * 面の対角線を半径とする範囲まで敷き詰めるので、回しても角に隙間が出ない。
 */
export function patternPrimitives(design: CoverSideDesign, rect: Rect): PatternPrimitives {
  const unit = patternUnitPx(design);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const reach = Math.hypot(rect.width, rect.height) / 2 + unit;
  const rotation = (design.patternRotation * Math.PI) / 180;
  const polygons: number[][] = [];
  const circles: Array<[number, number, number]> = [];
  const color = rgbaFromHex(design.patternColor, design.patternOpacity);

  // 方向 θ（CSS の角度: 0 = 上向き, 90 = 右向き）に沿って、周期 period・太さ width の帯を並べる。
  const bands = (cssAngleRad: number, period: number, width: number) => {
    const dx = Math.sin(cssAngleRad);
    const dy = -Math.cos(cssAngleRad);
    const px = -dy;
    const py = dx;
    const first = Math.floor(-reach / period) - 1;
    const last = Math.ceil(reach / period) + 1;
    for (let k = first; k <= last; k += 1) {
      const t0 = k * period;
      const t1 = t0 + width;
      polygons.push([
        cx + dx * t0 + px * reach, cy + dy * t0 + py * reach,
        cx + dx * t1 + px * reach, cy + dy * t1 + py * reach,
        cx + dx * t1 - px * reach, cy + dy * t1 - py * reach,
        cx + dx * t0 - px * reach, cy + dy * t0 - py * reach,
      ]);
    }
  };

  // 格子状に並べる点（模様の座標で (u, v) → 面の座標へ回す）
  const toFace = (u: number, v: number): [number, number] => [
    cx + u * Math.cos(rotation) - v * Math.sin(rotation),
    cy + u * Math.sin(rotation) + v * Math.cos(rotation),
  ];

  switch (design.patternId) {
    case "vertical-stripes":
      bands(Math.PI / 2 + rotation, unit, stripeWidthPx(design));
      break;
    case "horizontal-stripes":
      bands(rotation, unit, stripeWidthPx(design));
      break;
    case "diagonal-stripes":
      bands(Math.PI / 4 + rotation, unit, stripeWidthPx(design));
      break;
    case "grid":
      bands(rotation, unit, 1);
      bands(Math.PI / 2 + rotation, unit, 1);
      break;
    case "dots": {
      const radius = Math.max(1.25, unit * 0.17);
      const steps = Math.ceil(reach / unit) + 1;
      for (let i = -steps; i <= steps; i += 1) {
        for (let j = -steps; j <= steps; j += 1) {
          const [x, y] = toFace((i + 0.5) * unit, (j + 0.5) * unit);
          circles.push([x, y, radius]);
        }
      }
      break;
    }
    case "checkerboard": {
      // CST の conic-gradient: 1単位の右上と左下の4分の1が塗り
      const half = unit / 2;
      const steps = Math.ceil(reach / half) + 1;
      for (let i = -steps; i <= steps; i += 1) {
        for (let j = -steps; j <= steps; j += 1) {
          if ((((i + j) % 2) + 2) % 2 !== 1) continue;
          const u0 = i * half;
          const v0 = j * half;
          polygons.push([
            ...toFace(u0, v0),
            ...toFace(u0 + half, v0),
            ...toFace(u0 + half, v0 + half),
            ...toFace(u0, v0 + half),
          ]);
        }
      }
      break;
    }
  }
  return { color, polygons, circles };
}

/** 画像の置き方。中央配置は 350dpi の原寸で中央に置き、はみ出すときだけ縮める。 */
export function imageDestinationRect(
  fit: "cover" | "contain" | "center",
  imageWidthPx: number,
  imageHeightPx: number,
  face: Rect,
  facePxPerMm: number,
): Rect {
  if (imageWidthPx <= 0 || imageHeightPx <= 0) return { ...face };
  let scale: number;
  if (fit === "cover") {
    scale = Math.max(face.width / imageWidthPx, face.height / imageHeightPx);
  } else if (fit === "contain") {
    scale = Math.min(face.width / imageWidthPx, face.height / imageHeightPx);
  } else {
    const natural = (25.4 / 350) * facePxPerMm;
    scale = Math.min(natural, face.width / imageWidthPx, face.height / imageHeightPx);
  }
  const width = imageWidthPx * scale;
  const height = imageHeightPx * scale;
  return {
    x: face.x + (face.width - width) / 2,
    y: face.y + (face.height - height) / 2,
    width,
    height,
  };
}

/* ── 文字組み ───────────────────────────────────────────────────── */

const SMALL_KANA = new Set(Array.from("ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ"));
/** 縦組みで横倒しにする字（フォントの縦用字形を canvas が使えないため） */
const ROTATE_IN_VERTICAL = new Set(Array.from("ー〜～－＝‐—–→←⇒"));

function isAsciiPrintable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x20 && code <= 0x7e;
}

type VerticalGlyph = { text: string; mode: "upright" | "rotated" | "tcy"; advance: number; nudge: boolean };

/** 縦組みの字を1字ずつ並べる（縦中横は1マス、半角英数は横倒し、句読点・括弧は縦用の字形）。 */
function verticalGlyphs(source: string, font: CoverFont, measure: CoverMeasure): VerticalGlyph[] {
  const glyphs: VerticalGlyph[] = [];
  for (const segment of coverInlineSegments(source)) {
    if (segment.kind === "tcy") {
      glyphs.push({ text: segment.value, mode: "tcy", advance: font.sizePx, nudge: false });
      continue;
    }
    for (const ch of Array.from(segment.value)) {
      if (ch === "\n" || ch === "\r") continue;
      if (isAsciiPrintable(ch) || ROTATE_IN_VERTICAL.has(ch)) {
        glyphs.push({ text: ch, mode: "rotated", advance: Math.max(font.sizePx * 0.25, measure(ch, font)), nudge: false });
      } else {
        glyphs.push({ text: verticalPaintGraphemeFor(ch), mode: "upright", advance: font.sizePx, nudge: SMALL_KANA.has(ch) });
      }
    }
  }
  return glyphs;
}

export type VerticalColumn = { glyphs: Array<VerticalGlyph & { offset: number }>; length: number };

/**
 * 縦書きの段落を、長さ maxLength の列へ右から左へ折り返す（CSS の
 * writing-mode: vertical-rl + max-height と同じ考え方）。length は字送り＋字間の合計。
 */
export function layoutVerticalColumns(
  source: string,
  font: CoverFont,
  letterSpacingEm: number,
  maxLength: number,
  measure: CoverMeasure,
): VerticalColumn[] {
  const spacing = letterSpacingEm * font.sizePx;
  const columns: VerticalColumn[] = [];
  let current: VerticalColumn = { glyphs: [], length: 0 };
  for (const glyph of verticalGlyphs(source, font, measure)) {
    const step = glyph.advance + spacing;
    if (current.glyphs.length > 0 && current.length + glyph.advance > maxLength) {
      columns.push(current);
      current = { glyphs: [], length: 0 };
    }
    current.glyphs.push({ ...glyph, offset: current.length + glyph.advance / 2 });
    current.length += step;
  }
  if (current.glyphs.length > 0) columns.push(current);
  return columns;
}

export type HorizontalLine = { glyphs: Array<{ text: string; x: number }>; width: number };

/** 横書きの段落を幅 maxWidth で折り返す（字間込み。行末の字間は幅に入れない）。 */
export function layoutHorizontalLines(
  source: string,
  font: CoverFont,
  letterSpacingEm: number,
  maxWidth: number,
  measure: CoverMeasure,
): HorizontalLine[] {
  const spacing = letterSpacingEm * font.sizePx;
  const lines: HorizontalLine[] = [];
  for (const paragraph of coverPlainText(source).split(/\r?\n/)) {
    let line: HorizontalLine = { glyphs: [], width: 0 };
    let cursor = 0;
    for (const ch of Array.from(paragraph)) {
      const advance = measure(ch, font);
      if (line.glyphs.length > 0 && cursor + advance > maxWidth) {
        lines.push(line);
        line = { glyphs: [], width: 0 };
        cursor = 0;
      }
      line.glyphs.push({ text: ch, x: cursor });
      line.width = cursor + advance;
      cursor += advance + spacing;
    }
    lines.push(line);
  }
  return lines;
}

/** 行をまとめて置く: 各行を左・中央・右にそろえ、上から lineHeight ずつ。 */
function placeLines(
  ops: CoverPaintOp[],
  lines: HorizontalLine[],
  font: CoverFont,
  color: string,
  box: { x: number; y: number; width: number },
  lineHeightPx: number,
  align: "left" | "center" | "right",
): void {
  lines.forEach((line, index) => {
    const offsetX = align === "left" ? 0 : align === "center" ? (box.width - line.width) / 2 : box.width - line.width;
    const centerY = box.y + lineHeightPx * index + lineHeightPx / 2;
    for (const glyph of line.glyphs) {
      ops.push({ kind: "glyph", text: glyph.text, x: box.x + offsetX + glyph.x, y: centerY, font, color, mode: "horizontal" });
    }
  });
}

function maxLineWidth(lines: HorizontalLine[]): number {
  return lines.reduce((max, line) => Math.max(max, line.width), 0);
}

/** 縦の列を置く。blockRight = いちばん右の列の右端、top = 列の上端。 */
function placeColumns(
  ops: CoverPaintOp[],
  columns: VerticalColumn[],
  font: CoverFont,
  color: string,
  blockRight: number,
  top: number,
  columnWidth: number,
): void {
  columns.forEach((column, index) => {
    const centerX = blockRight - columnWidth * (index + 0.5);
    for (const glyph of column.glyphs) {
      const nudge = glyph.nudge ? font.sizePx * 0.1 : 0;
      ops.push({
        kind: "glyph",
        text: glyph.text,
        x: centerX + nudge,
        y: top + glyph.offset - nudge,
        font,
        color,
        mode: glyph.mode,
      });
    }
  });
}

/* ── 面のテンプレート ───────────────────────────────────────────── */

type FaceBox = { W: number; H: number; safeX: number; safeY: number };

function faceBox(face: CoverFaceGeometry): FaceBox {
  const safePx = (face.bleedMm + face.safeMm) * face.pxPerMm;
  return { W: face.widthPx, H: face.heightPx, safeX: safePx, safeY: safePx };
}

function verticalPillarOps(settings: CoverSettings, box: FaceBox, color: string, measure: CoverMeasure): CoverPaintOp[] {
  const { W, H, safeX, safeY } = box;
  const right = settings.simple.pillarSide !== "left";
  const ops: CoverPaintOp[] = [];

  const bandWidth = Math.max(W * 0.24, 58);
  const bandX = right ? W - bandWidth : 0;
  ops.push({ kind: "fill", rect: { x: bandX, y: 0, width: bandWidth, height: H }, fill: { type: "solid", color: "rgba(255,255,255,0.88)" } });
  const ruleX = right ? bandX - 0.5 : bandWidth + 0.5;
  ops.push({ kind: "line", x1: ruleX, y1: 0, x2: ruleX, y2: H, color: "rgba(30,26,32,0.4)", width: 1 });

  const contentWidth = Math.max(50, Math.min(W * 0.2, 74));
  const contentHeight = H - safeY * 2;
  const contentX = right ? W - safeX - contentWidth : safeX;
  const content: Rect = { x: contentX, y: safeY, width: contentWidth, height: contentHeight };
  ops.push({ kind: "clip", rect: content });

  const title = settings.simple.title || "タイトル";
  const subtitle = settings.simple.subtitle || "サブタイトル";
  const author = settings.simple.author || "著者名";

  const titleFont: CoverFont = { family: COVER_MINCHO_FAMILY, sizePx: 19, weight: 500 };
  const titleColumnWidth = titleFont.sizePx * 1.1;
  const titleColumns = layoutVerticalColumns(title, titleFont, 0.12, contentHeight * 0.56, measure);
  const titleBlockWidth = titleColumns.length * titleColumnWidth;
  const titleRight = right ? content.x + content.width : content.x + titleBlockWidth;
  placeColumns(ops, titleColumns, titleFont, color, titleRight, content.y, titleColumnWidth);

  const subFont: CoverFont = { family: COVER_MINCHO_FAMILY, sizePx: 10, weight: 400 };
  const subColumnWidth = subFont.sizePx * 1.1;
  const subColumns = layoutVerticalColumns(subtitle, subFont, 0.08, contentHeight * 0.52, measure);
  const subRight = right
    ? content.x + content.width * (1 - 0.42)
    : content.x + content.width * 0.42 + subColumns.length * subColumnWidth;
  placeColumns(ops, subColumns, subFont, color, subRight, content.y + contentHeight * 0.13, subColumnWidth);

  const authorFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 9, weight: 400 };
  const authorColumnWidth = authorFont.sizePx * 1.1;
  const authorColumns = layoutVerticalColumns(author, authorFont, 0.16, contentHeight * 0.28, measure);
  const authorBlockHeight = authorColumns.reduce((max, column) => Math.max(max, column.length), 0);
  const authorRight = right
    ? content.x + content.width * (1 - 0.42)
    : content.x + content.width * 0.42 + authorColumns.length * authorColumnWidth;
  placeColumns(ops, authorColumns, authorFont, color, authorRight, content.y + contentHeight - authorBlockHeight, authorColumnWidth);

  ops.push({ kind: "unclip" });
  return ops;
}

function lowerBandOps(settings: CoverSettings, box: FaceBox, color: string, measure: CoverMeasure): CoverPaintOp[] {
  const { W, H, safeX, safeY } = box;
  const ops: CoverPaintOp[] = [];
  const bandTop = (settings.simple.lowerBandTop / 100) * H;
  const bandHeight = (settings.simple.lowerBandHeight / 100) * H;
  ops.push({ kind: "fill", rect: { x: 0, y: bandTop, width: W, height: bandHeight }, fill: { type: "solid", color: "rgba(16,15,18,0.78)" } });
  ops.push({ kind: "fill", rect: { x: 0, y: bandTop, width: W, height: 1 }, fill: { type: "solid", color: "rgba(255,255,255,0.75)" } });
  ops.push({ kind: "fill", rect: { x: 0, y: bandTop + bandHeight - 3, width: W, height: 3 }, fill: { type: "solid", color: "rgba(255,255,255,0.84)" } });

  const top = Math.max(safeY, bandTop);
  const bottom = H - Math.max(safeY, H - bandTop - bandHeight);
  const content: Rect = { x: safeX, y: top, width: W - safeX * 2, height: Math.max(0, bottom - top) };
  if (content.height <= 0) return ops;
  ops.push({ kind: "clip", rect: content });

  const padding = W * 0.03;
  const innerTop = content.y + padding;
  const innerHeight = content.height - padding * 2;

  const subtitle = settings.simple.subtitle || "サブタイトル";
  const title = settings.simple.title || "タイトル";
  const author = settings.simple.author || "著者名";

  const subFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 8, weight: 400 };
  const subLineHeight = subFont.sizePx * LINE_HEIGHT_NORMAL;
  const subLines = layoutHorizontalLines(subtitle, subFont, 0.12, content.width, measure);
  const subHeight = subLines.length * subLineHeight;

  const authorFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 8, weight: 400 };
  const authorLineHeight = authorFont.sizePx * LINE_HEIGHT_NORMAL;
  const authorMax = content.width * 0.5;
  const authorLines = layoutHorizontalLines(author, authorFont, 0.12, authorMax, measure);
  const authorWidth = Math.min(authorMax, maxLineWidth(authorLines));
  const authorHeight = authorLines.length * authorLineHeight;

  const columnGap = 10;
  const titleFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 20, weight: 700 };
  const titleLineHeight = titleFont.sizePx * 1.3;
  const titleWidth = Math.max(titleFont.sizePx, content.width - authorWidth - columnGap);
  const titleLines = layoutHorizontalLines(title, titleFont, 0, titleWidth, measure);
  const titleHeight = titleLines.length * titleLineHeight;

  const rowGap = 4;
  const row2Height = Math.max(titleHeight, authorHeight);
  const total = subHeight + rowGap + row2Height;
  const startY = innerTop + (innerHeight - total) / 2;

  placeLines(ops, subLines, subFont, color, { x: content.x, y: startY, width: content.width }, subLineHeight, "left");
  const row2Top = startY + subHeight + rowGap;
  placeLines(ops, titleLines, titleFont, color, { x: content.x, y: row2Top + row2Height - titleHeight, width: titleWidth }, titleLineHeight, "left");
  placeLines(
    ops,
    authorLines,
    authorFont,
    color,
    { x: content.x + content.width - authorWidth, y: row2Top + row2Height - authorHeight, width: authorWidth },
    authorLineHeight,
    "left",
  );

  ops.push({ kind: "unclip" });
  return ops;
}

function frameLabelOps(settings: CoverSettings, box: FaceBox, color: string, measure: CoverMeasure): CoverPaintOp[] {
  const { W, H, safeX, safeY } = box;
  const ops: CoverPaintOp[] = [];
  ops.push({
    kind: "strokeRect",
    rect: { x: safeX - 0.5, y: safeY - 0.5, width: W - safeX * 2 + 1, height: H - safeY * 2 + 1 },
    color: "rgba(255,255,255,0.9)",
    width: 1,
  });

  // 未入力は見本の文字、スペースだけなら「空欄」= その部分（文字の台紙ごと）を出さない。
  const title = frameLabelText(settings.simple.title, "タイトル");
  const subtitle = frameLabelText(settings.simple.subtitle, "サブタイトル");
  const author = frameLabelText(settings.simple.author, "著者名");
  const paper = "rgba(247,242,232,0.96)";

  if (title !== null || subtitle !== null) {
    const labelWidth = Math.min(W * 0.56, W - safeX * 2);
    const labelX = (W - labelWidth) / 2;
    const padV = W * 0.07;
    const padH = W * 0.06;
    const innerWidth = Math.max(1, labelWidth - padH * 2);

    const titleFont: CoverFont = { family: COVER_MINCHO_FAMILY, sizePx: 18, weight: 500 };
    const titleLineHeight = titleFont.sizePx * LINE_HEIGHT_NORMAL;
    const titleLines = title === null ? [] : layoutHorizontalLines(title, titleFont, 0, innerWidth, measure);
    const titleHeight = titleLines.length * titleLineHeight;

    const subFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 8, weight: 400 };
    const subLineHeight = subFont.sizePx * LINE_HEIGHT_NORMAL;
    const subLines = subtitle === null ? [] : layoutHorizontalLines(subtitle, subFont, 0, innerWidth, measure);
    const subHeight = subLines.length * subLineHeight;

    // 罫線はタイトルとサブタイトルの両方があるときだけ（その間に引く）
    const both = title !== null && subtitle !== null;
    const gap = 7;
    const ruleAndPad = 1 + 7;
    const labelHeight = padV * 2 + titleHeight + subHeight + (both ? gap + ruleAndPad : 0);
    ops.push({ kind: "fill", rect: { x: labelX, y: safeY, width: labelWidth, height: labelHeight }, fill: { type: "solid", color: paper } });

    const innerX = labelX + padH;
    const titleTop = safeY + padV;
    placeLines(ops, titleLines, titleFont, color, { x: innerX, y: titleTop, width: innerWidth }, titleLineHeight, "center");
    let subTop = titleTop + titleHeight;
    if (both) {
      const ruleY = titleTop + titleHeight + gap + 0.5;
      ops.push({ kind: "line", x1: innerX, y1: ruleY, x2: innerX + innerWidth, y2: ruleY, color: "rgba(40,30,40,0.35)", width: 1 });
      subTop = ruleY - 0.5 + ruleAndPad;
    }
    placeLines(ops, subLines, subFont, color, { x: innerX, y: subTop, width: innerWidth }, subLineHeight, "center");
  }

  if (author !== null) {
    const authorFont: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 8, weight: 400 };
    const authorLineHeight = authorFont.sizePx * 1.4;
    const pillPadV = 6;
    const pillPadH = 13;
    const authorMaxWidth = Math.max(1, W - safeX * 2 - pillPadH * 2);
    const authorLines = layoutHorizontalLines(author, authorFont, 0.22, authorMaxWidth, measure);
    const textWidth = Math.min(authorMaxWidth, maxLineWidth(authorLines) + authorFont.sizePx * 0.22);
    const pillWidth = textWidth + pillPadH * 2;
    const pillHeight = authorLines.length * authorLineHeight + pillPadV * 2;
    const pillBottom = Math.max(H * 0.07, safeY);
    const pillX = (W - pillWidth) / 2;
    const pillY = H - pillBottom - pillHeight;
    ops.push({
      kind: "fill",
      rect: { x: pillX, y: pillY, width: pillWidth, height: pillHeight },
      fill: { type: "solid", color: paper },
      radius: Math.min(pillHeight, pillWidth) / 2,
    });
    placeLines(ops, authorLines, authorFont, color, { x: pillX + pillPadH, y: pillY + pillPadV, width: textWidth }, authorLineHeight, "center");
  }
  return ops;
}

/**
 * 額縁ラベルの文字: 未入力 → 見本の文字（placeholder）、スペースだけ → null（空欄＝台紙ごと出さない）。
 * 入力欄の案内「空欄にしたい場合はスペースのみ入れてください」に合わせる。
 */
export function frameLabelText(value: string, placeholder: string): string | null {
  if (!value) return placeholder;
  return value.trim() === "" ? null : value;
}

function backTextOps(settings: CoverSettings, box: FaceBox, measure: CoverMeasure): CoverPaintOp[] {
  const { backTitle, backAuthor, backPublishedDate, backPanelEnabled } = settings.simple;
  if (!backTitle && !backAuthor && !backPublishedDate) return [];
  const { W, H, safeX, safeY } = box;
  const ops: CoverPaintOp[] = [];
  const areaWidth = W - safeX * 2;
  const areaHeight = H - safeY * 2;
  const boxWidth = Math.min(areaWidth * 0.7, 220);
  const padV = 18;
  const padH = 20;
  const innerWidth = Math.max(1, boxWidth - padH * 2);

  type Item = { lines: HorizontalLine[]; font: CoverFont; color: string; lineHeight: number };
  const items: Item[] = [];
  const ink = "#17131a";
  if (backTitle) {
    const font: CoverFont = { family: COVER_MINCHO_FAMILY, sizePx: 20, weight: 600 };
    items.push({ lines: layoutHorizontalLines(backTitle, font, 0, innerWidth, measure), font, color: ink, lineHeight: 20 * 1.4 });
  }
  if (backAuthor) {
    const font: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 10, weight: 400 };
    items.push({ lines: layoutHorizontalLines(backAuthor, font, 0.08, innerWidth, measure), font, color: ink, lineHeight: 10 * LINE_HEIGHT_NORMAL });
  }
  if (backPublishedDate) {
    const font: CoverFont = { family: COVER_SANS_FAMILY, sizePx: 9, weight: 400 };
    items.push({
      lines: layoutHorizontalLines(backPublishedDate, font, 0.06, innerWidth, measure),
      font,
      color: "rgba(23,19,26,0.72)",
      lineHeight: 9 * LINE_HEIGHT_NORMAL,
    });
  }
  const gap = 7;
  const contentHeight = items.reduce((sum, item) => sum + item.lines.length * item.lineHeight, 0) + gap * (items.length - 1);
  const boxHeight = contentHeight + padV * 2;
  const boxX = safeX + (areaWidth - boxWidth) / 2;
  const boxY = safeY + (areaHeight - boxHeight) / 2;
  if (backPanelEnabled) {
    ops.push({ kind: "fill", rect: { x: boxX, y: boxY, width: boxWidth, height: boxHeight }, fill: { type: "solid", color: "rgba(255,255,255,0.78)" } });
  }
  let y = boxY + padV;
  for (const item of items) {
    placeLines(ops, item.lines, item.font, item.color, { x: boxX + padH, y, width: innerWidth }, item.lineHeight, "center");
    y += item.lines.length * item.lineHeight + gap;
  }
  return ops;
}

/* ── 面・見開き ─────────────────────────────────────────────────── */

/** 1面（塗り足し込み）の描画命令。原点 = 面の左上。 */
export function buildCoverFacePlan(
  settings: CoverSettings,
  side: CoverFaceSide,
  face: CoverFaceGeometry,
  options: CoverPlanOptions,
): CoverPlan {
  const box = faceBox(face);
  const full: Rect = { x: 0, y: 0, width: box.W, height: box.H };
  const design = designForSide(settings, side);
  const artwork = artworkForSide(settings, side);
  const ops: CoverPaintOp[] = [];

  // 1. 背景（単色 / 2色グラデ）
  ops.push({ kind: "fill", rect: full, fill: backgroundFill(design, full) });
  // 2. 重ねるもの（なし / 画像 / 模様）
  if (design.foregroundType === "pattern") {
    ops.push({ kind: "pattern", rect: full, design });
  } else if (design.foregroundType === "image" && artwork) {
    ops.push({
      kind: "image",
      assetId: artwork.assetId,
      rect: imageDestinationRect(artwork.fit, artwork.width, artwork.height, full, face.pxPerMm),
      opacity: design.imageOpacity / 100,
    });
  }
  // 3. テンプレートの帯・文字（テンプレートなしは何も足さない）
  if (!isImageOnlyCover(settings)) {
    if (side === "back") {
      ops.push(...backTextOps(settings, box, options.measure));
    } else {
      const template = activeCoverTemplate(settings);
      const color = settings.simple.textColor ?? templateDefaultTextColor(template);
      if (template === "lower-band") ops.push(...lowerBandOps(settings, box, color, options.measure));
      else if (template === "frame-label") ops.push(...frameLabelOps(settings, box, color, options.measure));
      else ops.push(...verticalPillarOps(settings, box, color, options.measure));
    }
  }
  // ガイド（プレビューだけ）
  if (options.showGuides) {
    const inset = face.bleedMm * face.pxPerMm;
    ops.push({
      kind: "strokeRect",
      rect: { x: inset, y: inset, width: box.W - inset * 2, height: box.H - inset * 2 },
      color: GUIDE_COLOR,
      width: 1,
      dash: GUIDE_DASH,
    });
  }
  return { widthPx: box.W, heightPx: box.H, ops };
}

function translateOp(op: CoverPaintOp, dx: number, dy: number): CoverPaintOp {
  const move = (rect: Rect): Rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy });
  switch (op.kind) {
    case "fill":
      return {
        ...op,
        rect: move(op.rect),
        fill:
          op.fill.type === "linear"
            ? { ...op.fill, x0: op.fill.x0 + dx, y0: op.fill.y0 + dy, x1: op.fill.x1 + dx, y1: op.fill.y1 + dy }
            : op.fill,
      };
    case "pattern":
    case "image":
    case "strokeRect":
    case "clip":
      return { ...op, rect: move(op.rect) };
    case "line":
      return { ...op, x1: op.x1 + dx, y1: op.y1 + dy, x2: op.x2 + dx, y2: op.y2 + dy };
    case "glyph":
      return { ...op, x: op.x + dx, y: op.y + dy };
    case "unclip":
      return op;
  }
}

/** 背文字: 1本の縦列を背の中央に、上下位置（仕上がりの高さの%）を中心に置く。 */
export function spineTextOps(settings: CoverSettings, spread: CoverSpreadGeometry, measure: CoverMeasure): CoverPaintOp[] {
  if (spineTextState(settings.spine.widthMm) === "disabled") return [];
  const parts = spineTextParts(settings.spine);
  if (parts.length === 0) return [];
  const pxPerMm = spread.pxPerMm;
  const sizePx = ptToMm(settings.spine.fontSize) * pxPerMm;
  const family = spineFontFamily(settings.spine.fontId);
  const spacing = SPINE_LETTER_SPACING_EM * sizePx;

  type Placed = { glyph: VerticalGlyph; font: CoverFont; start: number };
  const placed: Placed[] = [];
  let cursor = 0;
  parts.forEach((part, index) => {
    const font: CoverFont = { family, sizePx, weight: index === 0 ? 600 : 400 };
    if (index > 0) cursor += SPINE_PART_GAP_EM * sizePx;
    for (const glyph of verticalGlyphs(part, font, measure)) {
      placed.push({ glyph, font, start: cursor });
      cursor += glyph.advance + spacing;
    }
  });
  const length = cursor;
  const centerY = (spread.bleedMm + (spread.face.trimHeightMm * settings.spine.positionY) / 100) * pxPerMm;
  const top = centerY - length / 2;
  const centerX = (spread.spine.x + spread.spine.width / 2) * pxPerMm;
  const color = settings.spine.textColor;
  return placed.map(({ glyph, font, start }) => {
    const nudge = glyph.nudge ? font.sizePx * 0.1 : 0;
    return {
      kind: "glyph" as const,
      text: glyph.text,
      x: centerX + nudge,
      y: top + start + glyph.advance / 2 - nudge,
      font,
      color,
      mode: glyph.mode,
    };
  });
}

/** 表紙・背・裏表紙を1枚に並べた描画命令（右綴じ: 表紙が左）。 */
export function buildCoverSpreadPlan(
  settings: CoverSettings,
  spread: CoverSpreadGeometry,
  options: CoverPlanOptions,
): CoverPlan {
  const px = spread.pxPerMm;
  const ops: CoverPaintOp[] = [];
  ops.push({ kind: "fill", rect: { x: 0, y: 0, width: spread.widthPx, height: spread.heightPx }, fill: { type: "solid", color: "#ffffff" } });

  for (const region of [spread.left, spread.right]) {
    const facePlan = buildCoverFacePlan(settings, region.side, spread.face, { ...options, showGuides: false });
    const faceWindow: Rect = { x: region.rect.x * px, y: region.rect.y * px, width: region.rect.width * px, height: region.rect.height * px };
    const dx = faceWindow.x + region.faceOffsetXMm * px;
    ops.push({ kind: "clip", rect: faceWindow });
    ops.push(...facePlan.ops.map((op) => translateOp(op, dx, faceWindow.y)));
    ops.push({ kind: "unclip" });
  }

  if (spread.spineWidthMm > 0) {
    const spineRect: Rect = { x: spread.spine.x * px, y: 0, width: spread.spine.width * px, height: spread.spine.height * px };
    ops.push({ kind: "fill", rect: spineRect, fill: { type: "solid", color: settings.spine.color } });
    ops.push({ kind: "clip", rect: spineRect });
    ops.push(...spineTextOps(settings, spread, options.measure));
    ops.push({ kind: "unclip" });
  }

  if (options.showGuides) {
    ops.push({
      kind: "strokeRect",
      rect: { x: spread.trim.x * px, y: spread.trim.y * px, width: spread.trim.width * px, height: spread.trim.height * px },
      color: GUIDE_COLOR,
      width: 1,
      dash: GUIDE_DASH,
    });
    for (const x of Array.from(new Set(spread.foldXsMm))) {
      ops.push({
        kind: "line",
        x1: x * px,
        y1: spread.trim.y * px,
        x2: x * px,
        y2: (spread.trim.y + spread.trim.height) * px,
        color: FOLD_GUIDE_COLOR,
        width: 1,
        dash: GUIDE_DASH,
      });
    }
  }
  return { widthPx: spread.widthPx, heightPx: spread.heightPx, ops };
}

/** 描画に使う文字とフォント（描く前にフォントを読み込んでおくため）。 */
export function coverPlanFonts(plan: CoverPlan): Array<{ font: CoverFont; text: string }> {
  const byKey = new Map<string, { font: CoverFont; chars: Set<string> }>();
  for (const op of plan.ops) {
    if (op.kind !== "glyph") continue;
    const key = `${op.font.weight}|${op.font.family}`;
    const entry = byKey.get(key) ?? { font: op.font, chars: new Set<string>() };
    for (const ch of Array.from(op.text)) entry.chars.add(ch);
    byKey.set(key, entry);
  }
  return Array.from(byKey.values()).map(({ font, chars }) => ({ font, text: Array.from(chars).join("") }));
}

/** 描画で使う画像の id。 */
export function coverPlanImageIds(plan: CoverPlan): string[] {
  return Array.from(new Set(plan.ops.flatMap((op) => (op.kind === "image" ? [op.assetId] : []))));
}

/** テスト・近似用の文字幅（全角 1em、半角 0.56em）。 */
export const approximateCoverMeasure: CoverMeasure = (text, font) =>
  Array.from(text).reduce((sum, ch) => sum + (/^[\x00-\x7f]$/.test(ch) ? 0.56 : 1) * font.sizePx, 0);

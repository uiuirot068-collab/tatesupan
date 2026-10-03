/**
 * CST-PORT-011: 表紙の書き出しの約束（COLUMNSTAND `coverExport.ts` の移植）。
 *
 * 書き出しは表紙を描き直さない。プレビューと同じ描画（coverPaint → coverCanvas）
 * を、ガイドなし・印刷解像度で1回描くだけ。ここでは「どの面を・どの解像度で・
 * どのファイル名で」だけを決める。色は RGB のまま（CMYK 変換なし）。
 */
import type { CoverFaceSide, CoverSettings } from "./coverModel";
import {
  COVER_SAFE_MM,
  getCoverFaceGeometry,
  ptToMm,
  roundSpineWidthMm,
  spineTextState,
} from "./coverGeometry";
import { estimateSpineTextLengthMm, hasRubyMarkup, spineTextParts } from "./coverText";

export type CoverExportContent = "cover-separate" | "cover-front" | "cover-spread";
export type CoverExportFormat = "jpg" | "pdf";

export const COVER_EXPORT_CONTENT_OPTIONS: ReadonlyArray<{ id: CoverExportContent; label: string; hint: string }> = [
  {
    id: "cover-separate",
    label: "表紙・裏表紙を別々に書き出す（背幅不要・おすすめ）",
    hint: "各面に天地左右3mmの塗り足し。背幅が分からなくても書き出せます。",
  },
  { id: "cover-front", label: "表紙のみ", hint: "表紙1面（天地左右3mmの塗り足し込み）" },
  {
    id: "cover-spread",
    label: "背表紙込みの見開き（背幅が分かる人向け）",
    hint: "表紙＋背＋裏表紙を1枚に。天地・小口3mm、背との接合面は塗り足しなし。",
  },
];

/** 単独の表紙ファイルの印刷解像度（PDF・JPG 共通）。 */
export const COVER_EXPORT_DPI = 350;

/**
 * 1枚のキャンバスの画素数の上限。iPhone / iPad の Safari は約1677万画素を
 * 超えるキャンバスを描けないため、大きな見開き（B5 など）は解像度を下げて収める。
 */
export const COVER_EXPORT_MAX_CANVAS_PIXELS = 16_000_000;

export function pxPerMmForDpi(dpi: number): number {
  return dpi / 25.4;
}

/** 面の大きさ（mm）に対する書き出し解像度。上限を超えるときだけ下げる。 */
export function coverExportDpi(widthMm: number, heightMm: number, dpi = COVER_EXPORT_DPI): number {
  const pxPerMm = pxPerMmForDpi(dpi);
  const pixels = widthMm * pxPerMm * heightMm * pxPerMm;
  if (pixels <= COVER_EXPORT_MAX_CANVAS_PIXELS) return dpi;
  const fitted = Math.sqrt(COVER_EXPORT_MAX_CANVAS_PIXELS / (widthMm * heightMm)) * 25.4;
  return Math.floor(fitted);
}

/** 半角英数字の役割名を付ける。`stem` は exportFilename.ts で安全化済み。 */
export const coverFileName = {
  face: (stem: string, side: CoverFaceSide, ext: CoverExportFormat) => `${stem}_${side}.${ext}`,
  spread: (stem: string, ext: CoverExportFormat) => `${stem}_cover_spread.${ext}`,
  zip: (stem: string) => `${stem}_cover.zip`,
};

export type CoverExportAvailability = {
  sides: CoverFaceSide[];
  ok: boolean;
  reason: string;
};

/**
 * いま書き出せる表紙ファイル。「表紙に反映」「裏表紙に反映」を押した面だけを
 * 書き出す。別々の書き出しは背幅がなくても書き出せる。
 */
export function coverExportAvailability(content: CoverExportContent, cover: CoverSettings): CoverExportAvailability {
  const applied: CoverFaceSide[] = [];
  if (cover.frontApplied) applied.push("front");
  if (cover.backApplied) applied.push("back");

  if (content === "cover-front") {
    return cover.frontApplied
      ? { sides: ["front"], ok: true, reason: "" }
      : { sides: [], ok: false, reason: "表紙がまだ反映されていません。表紙の画面で「表紙に反映」を押してください。" };
  }

  if (content === "cover-separate") {
    return applied.length > 0
      ? { sides: applied, ok: true, reason: "" }
      : {
          sides: [],
          ok: false,
          reason: "表紙・裏表紙がまだ反映されていません。表紙の画面で「表紙に反映」「裏表紙に反映」を押してください。",
        };
  }

  if (!cover.frontApplied || !cover.backApplied) {
    return {
      sides: [],
      ok: false,
      reason:
        "見開きには表紙と裏表紙の両方の反映が必要です。背幅が分からない場合は「表紙・裏表紙を別々に書き出す」を使ってください。",
    };
  }
  if (roundSpineWidthMm(cover.spine.widthMm) <= 0) {
    return {
      sides: [],
      ok: false,
      reason: "背幅が未入力です（表紙 → 背表紙）。背幅が分からない場合は「表紙・裏表紙を別々に書き出す」を使ってください。",
    };
  }
  return { sides: ["front", "back"], ok: true, reason: "" };
}

/** 書き出すファイル名の一覧（画面に予告として出す）。 */
export function coverExportFileNames(
  content: CoverExportContent,
  cover: CoverSettings,
  stem: string,
  format: CoverExportFormat,
): string[] {
  const availability = coverExportAvailability(content, cover);
  if (!availability.ok) return [];
  if (content === "cover-spread") return [coverFileName.spread(stem, format)];
  return availability.sides.map((side) => coverFileName.face(stem, side, format));
}

/** 背文字の注意（止めない。目安）。 */
export function coverSpineIssues(cover: CoverSettings, paperSize: string): string[] {
  const issues: string[] = [];
  const widthMm = roundSpineWidthMm(cover.spine.widthMm);
  if (spineTextState(widthMm) === "disabled") return issues;
  const parts = spineTextParts(cover.spine);
  if (parts.length === 0) return issues;
  const fontMm = ptToMm(cover.spine.fontSize);
  if (fontMm > widthMm - 1) {
    issues.push(
      `文字サイズ（約${fontMm.toFixed(1)}mm）が背幅に対して大きすぎます。背幅より1mm以上小さくしてください。`,
    );
  }
  const face = getCoverFaceGeometry(paperSize);
  const lengthMm = estimateSpineTextLengthMm(parts, fontMm);
  const centerMm = (face.trimHeightMm * cover.spine.positionY) / 100;
  if (centerMm - lengthMm / 2 < COVER_SAFE_MM || centerMm + lengthMm / 2 > face.trimHeightMm - COVER_SAFE_MM) {
    issues.push("背文字が天地10mmの安全域にかかっている可能性があります（目安）。文字サイズか上下位置を調整してください。");
  }
  if (parts.some(hasRubyMarkup)) {
    issues.push("ルビ記法が含まれています。背表紙では親文字だけを表示します。");
  }
  return issues;
}

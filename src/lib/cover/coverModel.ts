/**
 * CST-PORT-011: 表紙（かんたん表紙）のデータ。
 *
 * COLUMNSTAND `src/lib/coverModel.ts`（V3本線 478d135）と同じ形・同じ
 * フィールド名・同じ丸め規則。作品の `PageSettings.cover` に入り、ローカル
 * 保存・クラウド保存（settings JSON）にそのまま乗る（DB変更なし）。
 *
 * TSPとの違い:
 *  - 画像の実体は CST の Blob アセットではなく、本文の挿絵と同じ
 *    IndexedDB `images` テーブル（id + dataUrl）に置く。`CoverArtworkRef.assetId`
 *    がその id。
 *  - `frontSource` / `backSource`（元ファイルの添付）は CST とデータを
 *    そろえるために読み書きだけ残す。TSP の画面では使わない。
 */

export type CoverFitMode = "cover" | "contain" | "center";
export type CoverTextMode = "template" | "free";
/**
 * "none" = テンプレートなし: タイトル・著者名・帯・額縁などを一切足さず、
 * 背景＋画像（または模様）だけを描く。完成済みの表紙画像向け。
 */
export type CoverTemplateId = "vertical-pillar" | "lower-band" | "frame-label" | "none";

/** normalize が受け付けるテンプレート（並び = 画面の並び）。 */
export const COVER_TEMPLATE_IDS: readonly CoverTemplateId[] = [
  "vertical-pillar",
  "lower-band",
  "frame-label",
  "none",
];

export type CoverBackgroundType = "solid" | "gradient";
export type CoverForegroundType = "none" | "image" | "pattern";
export type CoverGradientDirection = "vertical" | "horizontal" | "diagonal";
export type CoverPatternId =
  | "vertical-stripes"
  | "horizontal-stripes"
  | "diagonal-stripes"
  | "dots"
  | "grid"
  | "checkerboard";

export const COVER_PATTERN_IDS: readonly CoverPatternId[] = [
  "vertical-stripes",
  "horizontal-stripes",
  "diagonal-stripes",
  "dots",
  "grid",
  "checkerboard",
];

export type CoverPillarSide = "left" | "right";
export type CoverFaceSide = "front" | "back";

export type CoverArtworkRef = {
  /** IndexedDB `images` の id */
  assetId: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  fit: CoverFitMode;
};

export type CoverSourceAttachmentRef = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export type CoverSideDesign = {
  backgroundType: CoverBackgroundType;
  solidColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: CoverGradientDirection;
  foregroundType: CoverForegroundType;
  imageOpacity: number;
  patternId: CoverPatternId;
  patternColor: string;
  patternOpacity: number;
  patternScale: number;
  patternRotation: number;
  stripeThickness: number;
};

export type CoverSimpleSettings = {
  title: string;
  subtitle: string;
  author: string;
  /** null = テンプレートの既定の文字色 */
  textColor: string | null;
  pillarSide: CoverPillarSide;
  frameGradientColor: string;
  lowerBandTop: number;
  lowerBandHeight: number;
  backTitle: string;
  backAuthor: string;
  backPublishedDate: string;
  backPanelEnabled: boolean;
  frontDesign: CoverSideDesign;
  backDesign: CoverSideDesign;
};

export type CoverSpineSettings = {
  widthMm: number;
  color: string;
  textMode: CoverTextMode;
  title: string;
  volume: string;
  author: string;
  freeText: string;
  fontId: string;
  fontSize: number;
  textColor: string;
  positionY: number;
};

export type CoverSettings = {
  front: CoverArtworkRef | null;
  back: CoverArtworkRef | null;
  frontSource: CoverSourceAttachmentRef | null;
  backSource: CoverSourceAttachmentRef | null;
  templateId: CoverTemplateId | null;
  frontApplied: boolean;
  backApplied: boolean;
  simple: CoverSimpleSettings;
  spine: CoverSpineSettings;
};

export const DEFAULT_COVER_SIDE_DESIGN: CoverSideDesign = {
  backgroundType: "solid",
  solidColor: "#f7f2e8",
  gradientColor1: "#f7f2e8",
  gradientColor2: "#e9d8e8",
  gradientDirection: "vertical",
  foregroundType: "none",
  imageOpacity: 100,
  patternId: "vertical-stripes",
  patternColor: "#7a6482",
  patternOpacity: 80,
  patternScale: 100,
  patternRotation: 0,
  stripeThickness: 100,
};

export const DEFAULT_COVER_SIMPLE_SETTINGS: CoverSimpleSettings = {
  title: "",
  subtitle: "",
  author: "",
  textColor: null,
  pillarSide: "right",
  frameGradientColor: "#241f27",
  lowerBandTop: 66,
  lowerBandHeight: 24,
  backTitle: "",
  backAuthor: "",
  backPublishedDate: "",
  backPanelEnabled: true,
  frontDesign: { ...DEFAULT_COVER_SIDE_DESIGN },
  backDesign: { ...DEFAULT_COVER_SIDE_DESIGN },
};

export const DEFAULT_COVER_SPINE_SETTINGS: CoverSpineSettings = {
  widthMm: 0,
  color: "#ffffff",
  textMode: "template",
  title: "",
  volume: "",
  author: "",
  freeText: "",
  fontId: "",
  fontSize: 10,
  textColor: "#000000",
  positionY: 50,
};

export function createDefaultCoverSettings(): CoverSettings {
  return {
    front: null,
    back: null,
    frontSource: null,
    backSource: null,
    templateId: null,
    frontApplied: false,
    backApplied: false,
    simple: {
      ...DEFAULT_COVER_SIMPLE_SETTINGS,
      frontDesign: { ...DEFAULT_COVER_SIDE_DESIGN },
      backDesign: { ...DEFAULT_COVER_SIDE_DESIGN },
    },
    spine: { ...DEFAULT_COVER_SPINE_SETTINGS },
  };
}

/** テンプレートなし（完成画像をそのまま使う）か。 */
export function isImageOnlyCover(settings: Pick<CoverSettings, "templateId">): boolean {
  return settings.templateId === "none";
}

/** 画面・描画で使うテンプレート（未選択は縦柱）。 */
export function activeCoverTemplate(settings: Pick<CoverSettings, "templateId">): CoverTemplateId {
  return settings.templateId ?? "vertical-pillar";
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function clampStep(value: unknown, fallback: number, min: number, max: number, step: number): number {
  const numeric = finiteNumber(value, fallback);
  const clamped = Math.min(max, Math.max(min, numeric));
  return Math.round(clamped / step) * step;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function color(value: unknown, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

function artworkRef(value: unknown): CoverArtworkRef | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const assetId = text(raw.assetId);
  if (!assetId) return null;
  const fit: CoverFitMode = raw.fit === "contain" || raw.fit === "center" ? raw.fit : "cover";
  return {
    assetId,
    fileName: text(raw.fileName),
    mimeType: text(raw.mimeType, "application/octet-stream"),
    width: finiteNumber(raw.width, 0),
    height: finiteNumber(raw.height, 0),
    fit,
  };
}

function sourceRef(value: unknown): CoverSourceAttachmentRef | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const attachmentId = text(raw.attachmentId);
  if (!attachmentId) return null;
  return {
    attachmentId,
    fileName: text(raw.fileName),
    mimeType: text(raw.mimeType, "application/octet-stream"),
    byteSize: Math.max(0, finiteNumber(raw.byteSize, 0)),
  };
}

export function normalizeSideDesign(value: unknown): CoverSideDesign {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const backgroundType: CoverBackgroundType = raw.backgroundType === "gradient" ? "gradient" : "solid";
  const foregroundType: CoverForegroundType =
    raw.foregroundType === "image" || raw.foregroundType === "pattern" ? raw.foregroundType : "none";
  const gradientDirection: CoverGradientDirection =
    raw.gradientDirection === "horizontal" || raw.gradientDirection === "diagonal"
      ? raw.gradientDirection
      : "vertical";
  const patternId = COVER_PATTERN_IDS.includes(raw.patternId as CoverPatternId)
    ? (raw.patternId as CoverPatternId)
    : "vertical-stripes";

  return {
    backgroundType,
    solidColor: color(raw.solidColor, DEFAULT_COVER_SIDE_DESIGN.solidColor),
    gradientColor1: color(raw.gradientColor1, DEFAULT_COVER_SIDE_DESIGN.gradientColor1),
    gradientColor2: color(raw.gradientColor2, DEFAULT_COVER_SIDE_DESIGN.gradientColor2),
    gradientDirection,
    foregroundType,
    imageOpacity: clampStep(raw.imageOpacity, 100, 10, 100, 10),
    patternId,
    patternColor: color(raw.patternColor, DEFAULT_COVER_SIDE_DESIGN.patternColor),
    patternOpacity: clampStep(raw.patternOpacity, 80, 10, 100, 10),
    patternScale: clampStep(raw.patternScale, 100, 25, 400, 25),
    patternRotation: clampStep(raw.patternRotation, 0, 0, 180, 15),
    stripeThickness: clampStep(raw.stripeThickness, 100, 25, 300, 25),
  };
}

export function normalizeCoverSettings(value: unknown): CoverSettings {
  if (!value || typeof value !== "object") return createDefaultCoverSettings();

  const raw = value as Record<string, unknown>;
  const spineRaw = raw.spine && typeof raw.spine === "object" ? (raw.spine as Record<string, unknown>) : {};
  const simpleRaw = raw.simple && typeof raw.simple === "object" ? (raw.simple as Record<string, unknown>) : {};

  const widthMm = Math.max(0, Math.round(finiteNumber(spineRaw.widthMm, 0) * 10) / 10);
  const positionY = Math.min(100, Math.max(0, finiteNumber(spineRaw.positionY, 50)));

  return {
    front: artworkRef(raw.front),
    back: artworkRef(raw.back),
    frontSource: sourceRef(raw.frontSource),
    backSource: sourceRef(raw.backSource),
    templateId: COVER_TEMPLATE_IDS.includes(raw.templateId as CoverTemplateId)
      ? (raw.templateId as CoverTemplateId)
      : null,
    frontApplied: raw.frontApplied === true,
    backApplied: raw.backApplied === true,
    simple: {
      title: text(simpleRaw.title),
      subtitle: text(simpleRaw.subtitle),
      author: text(simpleRaw.author),
      textColor: isHexColor(simpleRaw.textColor) ? simpleRaw.textColor : null,
      pillarSide: simpleRaw.pillarSide === "left" ? "left" : "right",
      frameGradientColor: color(simpleRaw.frameGradientColor, "#241f27"),
      lowerBandTop: clampStep(simpleRaw.lowerBandTop, 66, 0, 82, 1),
      lowerBandHeight: clampStep(simpleRaw.lowerBandHeight, 24, 18, 50, 1),
      backTitle: text(simpleRaw.backTitle),
      backAuthor: text(simpleRaw.backAuthor),
      backPublishedDate: text(simpleRaw.backPublishedDate),
      backPanelEnabled: simpleRaw.backPanelEnabled !== false,
      frontDesign: normalizeSideDesign(simpleRaw.frontDesign),
      backDesign: normalizeSideDesign(simpleRaw.backDesign),
    },
    spine: {
      widthMm,
      color: color(spineRaw.color, "#ffffff"),
      textMode: spineRaw.textMode === "free" ? "free" : "template",
      title: text(spineRaw.title),
      volume: text(spineRaw.volume),
      author: text(spineRaw.author),
      freeText: text(spineRaw.freeText),
      fontId: text(spineRaw.fontId),
      fontSize: Math.min(30, Math.max(4, finiteNumber(spineRaw.fontSize, 10))),
      textColor: color(spineRaw.textColor, "#000000"),
      positionY,
    },
  };
}

export function designForSide(settings: CoverSettings, side: CoverFaceSide): CoverSideDesign {
  return side === "front" ? settings.simple.frontDesign : settings.simple.backDesign;
}

export function artworkForSide(settings: CoverSettings, side: CoverFaceSide): CoverArtworkRef | null {
  return side === "front" ? settings.front : settings.back;
}

/** 表紙・裏表紙の画像 id（IndexedDB から読み込む対象）。 */
export function coverImageIds(settings: CoverSettings | undefined): string[] {
  if (!settings) return [];
  return [settings.front?.assetId, settings.back?.assetId].filter((id): id is string => Boolean(id));
}

function sideDesignHasData(design: CoverSideDesign): boolean {
  return (
    design.backgroundType !== DEFAULT_COVER_SIDE_DESIGN.backgroundType ||
    design.solidColor !== DEFAULT_COVER_SIDE_DESIGN.solidColor ||
    design.gradientColor1 !== DEFAULT_COVER_SIDE_DESIGN.gradientColor1 ||
    design.gradientColor2 !== DEFAULT_COVER_SIDE_DESIGN.gradientColor2 ||
    design.gradientDirection !== DEFAULT_COVER_SIDE_DESIGN.gradientDirection ||
    design.foregroundType !== "none" ||
    design.imageOpacity !== 100 ||
    design.patternId !== DEFAULT_COVER_SIDE_DESIGN.patternId ||
    design.patternColor !== DEFAULT_COVER_SIDE_DESIGN.patternColor ||
    design.patternOpacity !== 80 ||
    design.patternScale !== 100 ||
    design.patternRotation !== 0 ||
    design.stripeThickness !== 100
  );
}

export function hasFrontCoverDraft(settings: CoverSettings): boolean {
  return Boolean(
    settings.front ||
      settings.frontSource ||
      settings.templateId ||
      settings.simple.title ||
      settings.simple.subtitle ||
      settings.simple.author ||
      settings.simple.textColor ||
      settings.simple.pillarSide !== "right" ||
      settings.simple.frameGradientColor !== "#241f27" ||
      settings.simple.lowerBandTop !== 66 ||
      settings.simple.lowerBandHeight !== 24 ||
      sideDesignHasData(settings.simple.frontDesign),
  );
}

export function hasBackCoverDraft(settings: CoverSettings): boolean {
  return Boolean(
    settings.back ||
      settings.backSource ||
      settings.simple.backTitle ||
      settings.simple.backAuthor ||
      settings.simple.backPublishedDate ||
      sideDesignHasData(settings.simple.backDesign),
  );
}

export type CoverApplyState = "applied" | "draft" | "empty";

export function coverApplyState(settings: CoverSettings, side: CoverFaceSide): CoverApplyState {
  const applied = side === "front" ? settings.frontApplied : settings.backApplied;
  if (applied) return "applied";
  const draft = side === "front" ? hasFrontCoverDraft(settings) : hasBackCoverDraft(settings);
  return draft ? "draft" : "empty";
}

export const COVER_APPLY_STATE_LABEL: Record<CoverApplyState, string> = {
  applied: "配置済み",
  draft: "未反映",
  empty: "未配置",
};

function frontSnapshot(settings: CoverSettings): string {
  return JSON.stringify({
    front: settings.front,
    templateId: settings.templateId,
    title: settings.simple.title,
    subtitle: settings.simple.subtitle,
    author: settings.simple.author,
    textColor: settings.simple.textColor,
    pillarSide: settings.simple.pillarSide,
    frameGradientColor: settings.simple.frameGradientColor,
    lowerBandTop: settings.simple.lowerBandTop,
    lowerBandHeight: settings.simple.lowerBandHeight,
    design: settings.simple.frontDesign,
  });
}

function backSnapshot(settings: CoverSettings): string {
  return JSON.stringify({
    back: settings.back,
    // テンプレートなしでは裏表紙の文字も描かない: 見た目が変わるときだけ反映し直し
    backTextShown:
      !isImageOnlyCover(settings) &&
      Boolean(settings.simple.backTitle || settings.simple.backAuthor || settings.simple.backPublishedDate),
    backTitle: settings.simple.backTitle,
    backAuthor: settings.simple.backAuthor,
    backPublishedDate: settings.simple.backPublishedDate,
    backPanelEnabled: settings.simple.backPanelEnabled,
    design: settings.simple.backDesign,
  });
}

/**
 * CST と同じ「反映」ルール: 表紙（または裏表紙）の見た目が変わったら、その面は
 * 「未反映」に戻る。背表紙の設定は面の反映状態に影響しない。
 */
export function withApplyReset(previous: CoverSettings, next: CoverSettings): CoverSettings {
  const frontChanged = frontSnapshot(previous) !== frontSnapshot(next);
  const backChanged = backSnapshot(previous) !== backSnapshot(next);
  return {
    ...next,
    frontApplied: frontChanged ? false : next.frontApplied,
    backApplied: backChanged ? false : next.backApplied,
  };
}

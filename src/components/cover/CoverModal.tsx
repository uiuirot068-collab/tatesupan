"use client";

/**
 * CST-PORT-011: かんたん表紙（COLUMNSTAND の CoverSettingsModal を TateSpun へ移植）。
 *
 * 背景 → 画像または模様 → テンプレ文字の3層で、表紙・裏表紙・背表紙を作る。
 * 画面の並び・言葉・値の範囲は COLUMNSTAND と同じ。描画は TateSpun 用に
 * 作り直した coverPaint / coverCanvas（書き出しと同じ描き方）を使う。
 * 3D プレビューはロードマップ4番で別に移植する。
 */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import ViewportModal from "@/components/ViewportModal";
import { FONT_FAMILY_OPTIONS } from "@/constants/fonts";
import {
  COVER_APPLY_STATE_LABEL,
  activeCoverTemplate,
  artworkForSide,
  coverApplyState,
  createDefaultCoverSettings,
  designForSide,
  withApplyReset,
  type CoverArtworkRef,
  type CoverFaceSide,
  type CoverFitMode,
  type CoverForegroundType,
  type CoverGradientDirection,
  type CoverPatternId,
  type CoverSettings,
  type CoverSideDesign,
  type CoverSpineSettings,
  type CoverTemplateId,
} from "@/lib/cover/coverModel";
import {
  SPINE_FONT_MAX_PT,
  SPINE_FONT_MIN_PT,
  clampSpineFontPt,
  getCoverFaceGeometry,
  getCoverSpreadGeometry,
  ptToMm,
  roundSpineWidthMm,
  spineTextState,
} from "@/lib/cover/coverGeometry";
import { coverSpineIssues } from "@/lib/cover/coverExport";
import {
  COVER_IMAGE_ACCEPT,
  createCoverImageId,
  prepareCoverImage,
} from "@/lib/cover/coverImage";
import {
  buildCoverFacePlan,
  buildCoverSpreadPlan,
  isStripePattern,
  spineFontFamily,
  templateDefaultTextColor,
  type CoverPlan,
} from "@/lib/cover/coverPaint";
import CoverCanvas, { useCoverImageSources, useCoverPlan } from "./CoverCanvas";
import {
  CoverSection,
  HexColorField,
  NumberField,
  Segmented,
  SliderField,
  coverInputClass,
} from "./CoverFields";

const TEMPLATES: Array<{ id: CoverTemplateId; name: string; description: string }> = [
  { id: "vertical-pillar", name: "縦柱", description: "右の縦帯に縦組み。小説・詩・エッセイ向け。" },
  { id: "lower-band", name: "下帯", description: "下部の帯で情報を整理。コラム・評論・レポート向け。" },
  { id: "frame-label", name: "額縁ラベル", description: "絵を囲って見せる。イラスト集・ファンブック向け。" },
  { id: "none", name: "テンプレートなし", description: "完成済みの表紙画像をそのまま使用" },
];

const PATTERNS: Array<{ id: CoverPatternId; name: string }> = [
  { id: "vertical-stripes", name: "縦ストライプ" },
  { id: "horizontal-stripes", name: "横ストライプ" },
  { id: "diagonal-stripes", name: "斜めストライプ" },
  { id: "dots", name: "ドット" },
  { id: "grid", name: "格子" },
  { id: "checkerboard", name: "市松" },
];

const FIT_OPTIONS: Array<{ id: CoverFitMode; name: string }> = [
  { id: "cover", name: "全面に敷く" },
  { id: "contain", name: "画像全体を収める" },
  { id: "center", name: "中央配置" },
];

const GRADIENT_DIRECTIONS: Array<{ id: CoverGradientDirection; name: string }> = [
  { id: "vertical", name: "縦" },
  { id: "horizontal", name: "横" },
  { id: "diagonal", name: "斜め" },
];

const FOREGROUNDS: Array<{ id: CoverForegroundType; name: string }> = [
  { id: "none", name: "なし" },
  { id: "image", name: "画像" },
  { id: "pattern", name: "模様" },
];

const SIDES: Array<{ id: CoverFaceSide; name: string }> = [
  { id: "front", name: "表紙" },
  { id: "back", name: "裏表紙" },
];

function updateSideDesign(settings: CoverSettings, side: CoverFaceSide, patch: Partial<CoverSideDesign>): CoverSettings {
  return {
    ...settings,
    simple: {
      ...settings.simple,
      [side === "front" ? "frontDesign" : "backDesign"]: { ...designForSide(settings, side), ...patch },
    },
  };
}

function updateArtwork(settings: CoverSettings, side: CoverFaceSide, artwork: CoverArtworkRef | null): CoverSettings {
  return side === "front" ? { ...settings, front: artwork } : { ...settings, back: artwork };
}

/** 画面の幅を測る（プレビューを枠いっぱいに描くため）。 */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function PlanCanvas({
  build,
  images,
  cssWidth,
  className,
  ariaLabel,
}: {
  build: Parameters<typeof useCoverPlan>[0];
  images: ReturnType<typeof useCoverImageSources>;
  cssWidth: number;
  className?: string;
  ariaLabel?: string;
}) {
  const plan = useCoverPlan(build);
  return <CoverCanvas plan={plan} images={images} cssWidth={cssWidth} className={className} ariaLabel={ariaLabel} />;
}

function swatchPlan(design: CoverSideDesign, patternId: CoverPatternId): CoverPlan {
  const rect = { x: 0, y: 0, width: 56, height: 36 };
  return {
    widthPx: rect.width,
    heightPx: rect.height,
    ops: [
      { kind: "fill", rect, fill: { type: "solid", color: design.backgroundType === "solid" ? design.solidColor : design.gradientColor1 } },
      { kind: "pattern", rect, design: { ...design, patternId, patternOpacity: 100, patternScale: 100, patternRotation: 0 } },
    ],
  };
}

export interface CoverModalProps {
  cover: CoverSettings | undefined;
  paperSize: string;
  /** 表紙画像（IndexedDB の id → dataUrl） */
  imageDataUrls: Record<string, string>;
  initialSide?: CoverFaceSide;
  onChange: (next: CoverSettings) => void;
  /** 新しい表紙画像を保存する（IndexedDB）。 */
  onImageAdd: (id: string, dataUrl: string) => Promise<void> | void;
  onOpenExport: () => void;
  onClose: () => void;
}

export default function CoverModal({
  cover,
  paperSize,
  imageDataUrls,
  initialSide = "front",
  onChange,
  onImageAdd,
  onOpenExport,
  onClose,
}: CoverModalProps) {
  const settings = cover ?? createDefaultCoverSettings();
  const [side, setSide] = useState<CoverFaceSide>(initialSide);
  const [previewMode, setPreviewMode] = useState<"single" | "spread">("single");
  const [spreadZoom, setSpreadZoom] = useState(1);
  const [imageError, setImageError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewRef, previewWidth] = useElementWidth<HTMLDivElement>();
  const images = useCoverImageSources(imageDataUrls);

  const design = designForSide(settings, side);
  const artwork = artworkForSide(settings, side);
  const activeTemplate = activeCoverTemplate(settings);
  const imageOnly = activeTemplate === "none";
  const textTemplate = imageOnly ? "vertical-pillar" : activeTemplate;
  const applyState = coverApplyState(settings, side);
  const sideName = side === "front" ? "表紙" : "裏表紙";

  const face = getCoverFaceGeometry(paperSize);
  const spineWidthMm = roundSpineWidthMm(settings.spine.widthMm);
  const spread = getCoverSpreadGeometry(paperSize, spineWidthMm);
  const spineState = spineTextState(spineWidthMm);
  const spineTextEnabled = spineState !== "disabled";
  const spineFontMm = ptToMm(settings.spine.fontSize);
  const spineIssues = coverSpineIssues(settings, paperSize);
  const artworkMissing = Boolean(design.foregroundType === "image" && artwork && !imageDataUrls[artwork.assetId]);

  /** 見た目が変わった面は「未反映」へ戻す（CST と同じ）。 */
  const change = (next: CoverSettings) => onChange(withApplyReset(settings, next));
  const changeSimple = (patch: Partial<CoverSettings["simple"]>) => change({ ...settings, simple: { ...settings.simple, ...patch } });
  const changeDesign = (patch: Partial<CoverSideDesign>) => change(updateSideDesign(settings, side, patch));
  const changeSpine = (patch: Partial<CoverSpineSettings>) => change({ ...settings, spine: { ...settings.spine, ...patch } });
  const applyCurrentSide = () =>
    onChange({
      ...settings,
      frontApplied: side === "front" ? true : settings.frontApplied,
      backApplied: side === "back" ? true : settings.backApplied,
    });

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageError(null);
    setProcessing(true);
    try {
      const prepared = await prepareCoverImage(file);
      const id = createCoverImageId(side);
      await onImageAdd(id, prepared.dataUrl);
      const nextArtwork: CoverArtworkRef = {
        assetId: id,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        fit: artwork?.fit ?? "cover",
      };
      change(updateSideDesign(updateArtwork(settings, side, nextArtwork), side, { foregroundType: "image" }));
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "画像の読み込みに失敗しました。");
    } finally {
      setProcessing(false);
    }
  };

  const removeImage = () => {
    if (!artwork) return;
    change(updateSideDesign(updateArtwork(settings, side, null), side, { foregroundType: "none" }));
  };

  const updateFit = (fit: CoverFitMode) => {
    if (!artwork) return;
    change(updateArtwork(settings, side, { ...artwork, fit }));
  };

  // プレビューの大きさ: 1面は枠の幅の82%まで（最大 320px）、見開きは枠の幅いっぱい × 倍率
  const singleWidth = Math.max(120, Math.min(320, previewWidth * 0.82));
  const spreadFitWidth = Math.max(160, previewWidth);
  const spreadWidth = spreadFitWidth * spreadZoom;

  return (
    <ViewportModal
      title="表紙"
      titleId="cover-modal-title"
      closeLabel="表紙の画面を閉じる"
      onClose={onClose}
      panelClassName="max-w-5xl md:h-[calc(100dvh-2rem)]"
      overlayProps={{ "data-cover-modal": "" } as React.HTMLAttributes<HTMLDivElement>}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-snug text-ink/55">
            変更は作品と一緒に自動で保存されます。書き出しは「表紙に反映」「裏表紙に反映」を押した面だけです。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenExport}
              className="rounded border border-ink/25 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              書き出しへ
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-base hover:opacity-90"
            >
              閉じる
            </button>
          </div>
        </div>
      }
    >
      <p className="-mt-1 mb-3 text-xs text-ink/60">
        背景 → 画像または模様 → テンプレ文字の3層で作ります。
      </p>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ── 設定 ── */}
        <div className="flex min-w-0 flex-col gap-4" data-cover-controls="">
          <div className="flex items-end justify-between gap-3 border-b border-ink/15">
            <div role="tablist" aria-label="表紙面" className="flex gap-4">
              {SIDES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={side === option.id}
                  onClick={() => setSide(option.id)}
                  className={`-mb-px border-b-2 px-1 pb-1.5 text-sm ${
                    side === option.id ? "border-accent font-semibold text-ink" : "border-transparent text-ink/55 hover:text-ink"
                  }`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2" data-cover-apply={applyState}>
            <p className="text-xs text-ink/60">
              {sideName}の状態：
              <strong
                className={`ml-1 ${applyState === "applied" ? "text-emerald-700 dark:text-emerald-400" : applyState === "draft" ? "text-amber-700 dark:text-amber-400" : "text-ink/60"}`}
              >
                {COVER_APPLY_STATE_LABEL[applyState]}
              </strong>
            </p>
            <button
              type="button"
              onClick={applyCurrentSide}
              disabled={applyState === "empty"}
              className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-paper-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {side === "front" ? "表紙に反映" : "裏表紙に反映"}
            </button>
          </div>

          {side === "front" ? (
            <CoverSection title="01 テンプレ" note="文字の置き方だけを切り替えます">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-cover-templates="">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={activeTemplate === template.id}
                    onClick={() => change({ ...settings, templateId: template.id })}
                    className={`flex min-w-0 flex-col items-stretch gap-1 rounded border p-1.5 text-left ${
                      activeTemplate === template.id ? "border-accent ring-1 ring-accent" : "border-ink/15 hover:border-ink/35"
                    }`}
                  >
                    <span className="flex justify-center bg-ink/5 py-1">
                      <PlanCanvas
                        build={(measure) => buildCoverFacePlan({ ...settings, templateId: template.id }, "front", face, { measure, showGuides: false })}
                        images={images}
                        cssWidth={52}
                      />
                    </span>
                    <strong className="text-xs text-ink">{template.name}</strong>
                    <small className="text-[10px] leading-snug text-ink/55">{template.description}</small>
                  </button>
                ))}
              </div>

              {imageOnly ? (
                <div className="text-xs leading-relaxed text-ink/65" role="note">
                  <p>完成済みの表紙画像をそのまま使用します。タイトルや装飾は追加されません。</p>
                  {design.foregroundType !== "image" || !artwork ? (
                    <p className="mt-1 text-ink/55">
                      「03 重ねるもの」→「画像」で表紙画像を選んでください。画像がないあいだは背景色だけで表示されます。
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    {(
                      [
                        ["title", "タイトル"],
                        ["subtitle", "サブタイトル"],
                        ["author", "著者名"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="grid gap-1 text-xs text-ink/65">
                        <span>{label}</span>
                        <input
                          value={settings.simple[key]}
                          placeholder="空欄にしたい場合はスペースのみ入れてください。"
                          onChange={(event) =>
                            change({
                              ...settings,
                              templateId: settings.templateId ?? "vertical-pillar",
                              simple: { ...settings.simple, [key]: event.target.value },
                            })
                          }
                          className={coverInputClass}
                        />
                      </label>
                    ))}
                    <p className="text-[11px] leading-snug text-ink/50">
                      縦柱では縦中横が使えます：[tate]A5[/tate]／2桁の数字は自動で縦中横。ルビは表紙では親文字だけを表示します。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <HexColorField
                      label="文字色"
                      value={settings.simple.textColor ?? templateDefaultTextColor(textTemplate)}
                      onChange={(textColor) => changeSimple({ textColor })}
                    />
                    <button
                      type="button"
                      disabled={settings.simple.textColor === null}
                      onClick={() => changeSimple({ textColor: null })}
                      className="text-xs text-ink/60 underline-offset-2 hover:underline disabled:opacity-40 disabled:hover:no-underline"
                    >
                      テンプレ既定に戻す
                    </button>
                  </div>

                  {activeTemplate === "vertical-pillar" ? (
                    <div className="flex items-center gap-3 text-xs text-ink/65">
                      <span>縦柱の位置</span>
                      <Segmented
                        label="縦柱の位置"
                        small
                        value={settings.simple.pillarSide}
                        options={[
                          { id: "right", name: "右" },
                          { id: "left", name: "左" },
                        ]}
                        onChange={(pillarSide) => changeSimple({ pillarSide })}
                      />
                    </div>
                  ) : null}

                  {activeTemplate === "lower-band" ? (
                    <div className="grid gap-2 border-t border-dashed border-ink/15 pt-2">
                      <SliderField
                        label="帯の位置"
                        value={settings.simple.lowerBandTop}
                        min={0}
                        max={Math.max(0, 100 - settings.simple.lowerBandHeight)}
                        step={1}
                        unit="%"
                        onChange={(value) =>
                          changeSimple({ lowerBandTop: Math.min(value, 100 - settings.simple.lowerBandHeight) })
                        }
                      />
                      <SliderField
                        label="帯の高さ"
                        value={settings.simple.lowerBandHeight}
                        min={18}
                        max={Math.max(18, Math.min(50, 100 - settings.simple.lowerBandTop))}
                        step={1}
                        unit="%"
                        onChange={(value) =>
                          changeSimple({ lowerBandHeight: Math.min(value, 100 - settings.simple.lowerBandTop) })
                        }
                      />
                      <p className="text-[11px] leading-snug text-ink/50">
                        帯は動かせますが、文字は仕上がり線から天地左右10mm内側の安全域から出ません。
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </CoverSection>
          ) : (
            <CoverSection title="01 裏表紙の文字" note="中央に横書きで配置します">
              {imageOnly ? (
                <p className="text-xs leading-relaxed text-ink/65" role="note">
                  テンプレートなしのため、裏表紙にも文字は追加されません。完成済みの裏表紙画像を「03 重ねるもの」→「画像」で配置してください。
                </p>
              ) : (
                <>
                  {(
                    [
                      ["backTitle", "タイトル", ""],
                      ["backAuthor", "著者名", ""],
                      ["backPublishedDate", "発行日", "2026年10月3日"],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <label key={key} className="grid gap-1 text-xs text-ink/65">
                      <span>{label}</span>
                      <input
                        value={settings.simple[key]}
                        placeholder={placeholder}
                        onChange={(event) => changeSimple({ [key]: event.target.value })}
                        className={coverInputClass}
                      />
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={settings.simple.backPanelEnabled}
                      onChange={(event) => changeSimple({ backPanelEnabled: event.target.checked })}
                      className="h-4 w-4"
                    />
                    <span>文字の背面に半透明の白い四角を表示</span>
                  </label>
                  <p className="text-[11px] leading-snug text-ink/50">
                    文字と白い四角は、画像・模様より上のテンプレレイヤーに配置されます。
                  </p>
                </>
              )}
            </CoverSection>
          )}

          <CoverSection title="02 背景" note="単色または2色グラデーション">
            <Segmented
              label="背景の種類"
              value={design.backgroundType}
              options={[
                { id: "solid", name: "単色" },
                { id: "gradient", name: "2色グラデ" },
              ]}
              onChange={(backgroundType) => changeDesign({ backgroundType })}
            />
            {design.backgroundType === "solid" ? (
              <HexColorField label="背景色" value={design.solidColor} onChange={(solidColor) => changeDesign({ solidColor })} />
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <HexColorField label="色1" value={design.gradientColor1} onChange={(gradientColor1) => changeDesign({ gradientColor1 })} />
                  <HexColorField label="色2" value={design.gradientColor2} onChange={(gradientColor2) => changeDesign({ gradientColor2 })} />
                </div>
                <Segmented
                  label="グラデーションの向き"
                  small
                  value={design.gradientDirection}
                  options={GRADIENT_DIRECTIONS}
                  onChange={(gradientDirection) => changeDesign({ gradientDirection })}
                />
              </>
            )}
          </CoverSection>

          <CoverSection title="03 重ねるもの" note="なし / 画像 / 模様のどれか1つ">
            <Segmented
              label="重ねるもの"
              value={design.foregroundType}
              options={FOREGROUNDS}
              onChange={(foregroundType) => changeDesign({ foregroundType })}
            />

            {design.foregroundType === "image" ? (
              <div className="grid gap-2">
                <input ref={fileInputRef} type="file" hidden accept={COVER_IMAGE_ACCEPT} onChange={handleImageFile} />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded border border-ink/25 px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
                  >
                    {processing ? "読み込み中…" : artwork ? "画像を差し替える" : "画像を選ぶ"}
                  </button>
                  {artwork ? <span className="min-w-0 truncate text-xs text-ink/60">{artwork.fileName}</span> : null}
                  {artwork ? (
                    <button type="button" onClick={removeImage} className="text-xs text-ink/60 underline-offset-2 hover:underline">
                      削除
                    </button>
                  ) : null}
                </div>
                {imageError ? (
                  <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                    {imageError}
                  </p>
                ) : null}
                {artworkMissing ? (
                  <p role="status" className="text-xs leading-snug text-amber-800 dark:text-amber-300">
                    この画像はこの端末に保存されていません（別の端末で選んだ画像です）。もう一度選び直してください。
                  </p>
                ) : null}
                {artwork ? (
                  <>
                    <Segmented label="画像の置き方" small value={artwork.fit} options={FIT_OPTIONS} onChange={updateFit} />
                    <SliderField
                      label="画像の不透明度"
                      value={design.imageOpacity}
                      min={10}
                      max={100}
                      step={10}
                      unit="%"
                      onChange={(imageOpacity) => changeDesign({ imageOpacity })}
                    />
                  </>
                ) : null}
                <p className="text-[11px] leading-snug text-ink/50">
                  印刷用画像は、断裁位置より外側の3mm塗り足しまで絵柄が続くデータを推奨します。PNG / JPG / WebP / PSD が使えます。
                </p>
              </div>
            ) : null}

            {design.foregroundType === "pattern" ? (
              <div className="grid gap-2">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-cover-patterns="">
                  {PATTERNS.map((pattern) => (
                    <button
                      key={pattern.id}
                      type="button"
                      aria-pressed={design.patternId === pattern.id}
                      onClick={() => changeDesign({ patternId: pattern.id })}
                      className={`flex flex-col items-center gap-1 rounded border p-1 ${
                        design.patternId === pattern.id ? "border-accent ring-1 ring-accent" : "border-ink/15 hover:border-ink/35"
                      }`}
                    >
                      <CoverCanvas plan={swatchPlan(design, pattern.id)} images={{}} cssWidth={44} />
                      <small className="text-[10px] text-ink/65">{pattern.name}</small>
                    </button>
                  ))}
                </div>
                <HexColorField label="模様色" value={design.patternColor} onChange={(patternColor) => changeDesign({ patternColor })} />
                <details className="border-t border-dashed border-ink/15 pt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-ink/70">模様詳細</summary>
                  <div className="mt-2 grid gap-2">
                    <SliderField
                      label="不透明度"
                      value={design.patternOpacity}
                      min={10}
                      max={100}
                      step={10}
                      unit="%"
                      onChange={(patternOpacity) => changeDesign({ patternOpacity })}
                    />
                    <SliderField
                      label="サイズ"
                      value={design.patternScale}
                      min={25}
                      max={400}
                      step={25}
                      unit="%"
                      onChange={(patternScale) => changeDesign({ patternScale })}
                    />
                    {isStripePattern(design.patternId) ? (
                      <SliderField
                        label="線の太さ"
                        value={design.stripeThickness}
                        min={25}
                        max={300}
                        step={25}
                        unit="%"
                        onChange={(stripeThickness) => changeDesign({ stripeThickness })}
                      />
                    ) : null}
                    <SliderField
                      label="回転"
                      value={design.patternRotation}
                      min={0}
                      max={180}
                      step={15}
                      unit="°"
                      onChange={(patternRotation) => changeDesign({ patternRotation })}
                    />
                  </div>
                </details>
              </div>
            ) : null}
          </CoverSection>

          <details className="border-t border-ink/15 pt-3" open data-cover-spine="">
            <summary className="flex cursor-pointer items-baseline justify-between gap-3">
              <span>
                <strong className="text-sm text-ink">04 背表紙</strong>
                <small className="ml-2 text-[11px] text-ink/50">印刷向け詳細設定</small>
              </span>
              <b className="text-xs text-ink">{spineWidthMm.toFixed(1)}mm</b>
            </summary>
            <div className="mt-2.5 grid gap-2.5">
              <NumberField
                label="背幅"
                value={spineWidthMm}
                min={0}
                max={100}
                unit="mm"
                onCommit={(value) => changeSpine({ widthMm: roundSpineWidthMm(value) })}
              />
              <p
                className={`border-l-[3px] px-2 py-1 text-[11px] leading-snug ${
                  spineState === "disabled"
                    ? "border-ink/25 text-ink/60"
                    : spineState === "narrow"
                      ? "border-amber-500 text-amber-800 dark:text-amber-300"
                      : "border-emerald-600 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {spineState === "disabled"
                  ? "背幅4.0mm未満では背文字を配置しません。背色だけ設定できます。"
                  : spineState === "narrow"
                    ? "背幅4.0〜5.9mmは細幅です。文字が窮屈にならないか書き出し前に確認してください。"
                    : "背文字を配置できます。"}
              </p>
              <p className="text-[11px] leading-snug text-ink/50">
                背幅は本文の紙の厚さとページ数で決まります。分からないときは印刷所の背幅計算を使うか、表紙・裏表紙を別々に書き出してください。
              </p>
              <HexColorField label="背色" value={settings.spine.color} onChange={(color) => changeSpine({ color })} />

              <fieldset disabled={!spineTextEnabled} className="grid gap-2.5 disabled:opacity-45">
                <Segmented
                  label="背文字の入力方法"
                  value={settings.spine.textMode}
                  options={[
                    { id: "template", name: "項目ごと" },
                    { id: "free", name: "自由入力" },
                  ]}
                  onChange={(textMode) => changeSpine({ textMode })}
                />
                {settings.spine.textMode === "template" ? (
                  <div className="grid gap-2">
                    {(
                      [
                        ["title", "タイトル", ""],
                        ["volume", "巻数・号数", "例：02 / 第二巻"],
                        ["author", "著者名", ""],
                      ] as const
                    ).map(([key, label, placeholder]) => (
                      <label key={key} className="grid gap-1 text-xs text-ink/65">
                        <span>{label}</span>
                        <input
                          value={settings.spine[key]}
                          placeholder={placeholder}
                          onChange={(event) => changeSpine({ [key]: event.target.value })}
                          className={coverInputClass}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="grid gap-1 text-xs text-ink/65">
                    <span>背文字</span>
                    <textarea
                      rows={3}
                      value={settings.spine.freeText}
                      placeholder="タイトル・巻数・著者名など"
                      onChange={(event) => changeSpine({ freeText: event.target.value })}
                      className={`${coverInputClass} resize-y leading-relaxed`}
                    />
                  </label>
                )}
                <p className="text-[11px] leading-snug text-ink/50">
                  {settings.spine.textMode === "template"
                    ? "タイトル → 巻数 → 著者名の順に、背の中央の1本の縦列に並びます。"
                    : "改行は列を増やさず、同じ1本の縦列の中の間隔になります。"}
                </p>
                <p className="text-[11px] leading-snug text-ink/50">
                  <span className="mr-1.5 rounded bg-ink/10 px-1.5 py-0.5 font-semibold text-ink/75">背表紙ではルビ非対応</span>
                  縦中横のみ対応：[tate]A5[/tate]／2桁の数字は自動で縦中横。
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-0 items-center gap-2 text-xs text-ink/65">
                    <span className="min-w-[4.5em] shrink-0 whitespace-nowrap">フォント</span>
                    <select
                      value={spineFontFamily(settings.spine.fontId)}
                      onChange={(event) => changeSpine({ fontId: event.target.value })}
                      className={`${coverInputClass} w-auto`}
                    >
                      {FONT_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="文字サイズ"
                    value={settings.spine.fontSize}
                    min={SPINE_FONT_MIN_PT}
                    max={SPINE_FONT_MAX_PT}
                    unit="pt"
                    onCommit={(value) => changeSpine({ fontSize: clampSpineFontPt(Math.round(value * 2) / 2) })}
                  />
                </div>
                <HexColorField label="文字色" value={settings.spine.textColor} onChange={(textColor) => changeSpine({ textColor })} />
                <SliderField
                  label="文字の上下位置"
                  value={Math.round(Math.min(90, Math.max(10, settings.spine.positionY)))}
                  min={10}
                  max={90}
                  step={1}
                  unit="%"
                  onChange={(positionY) => changeSpine({ positionY })}
                />
              </fieldset>
            </div>
          </details>
        </div>

        {/* ── プレビュー ── */}
        <aside className="min-w-0 md:sticky md:top-0 md:self-start" data-cover-preview={previewMode}>
          <div role="tablist" aria-label="プレビュー切替" className="mb-3 flex gap-4 border-b border-ink/15">
            {(
              [
                ["single", sideName],
                ["spread", "見開き"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={previewMode === mode}
                onClick={() => setPreviewMode(mode)}
                className={`-mb-px border-b-2 px-1 pb-1.5 text-sm ${
                  previewMode === mode ? "border-accent font-semibold text-ink" : "border-transparent text-ink/55 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={previewRef} className="min-w-0">
            {previewMode === "single" ? (
              <div>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm text-ink">{sideName}プレビュー</strong>
                  <span className="text-[11px] text-ink/55">
                    {COVER_APPLY_STATE_LABEL[applyState]}・塗り足し3mm
                  </span>
                </div>
                <div className="flex justify-center py-2">
                  <PlanCanvas
                    build={(measure) => buildCoverFacePlan(settings, side, face, { measure, showGuides: true })}
                    images={images}
                    cssWidth={singleWidth}
                    className="shadow-[0_0_0_1px_rgba(40,32,44,0.18),0_14px_38px_rgba(20,15,22,0.16)]"
                    ariaLabel={`${sideName}のプレビュー`}
                  />
                </div>
                <ul className="mt-2 list-disc border-t border-ink/10 pl-5 pt-2 text-[11px] leading-relaxed text-ink/55">
                  <li>点線＝仕上がり線（外側3mmが塗り足し）。</li>
                  <li>10mm安全域は内部で保持し、画面には表示しません。</li>
                  <li>ガイドは書き出しません。</li>
                </ul>
              </div>
            ) : (
              <div>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm text-ink">見開きプレビュー</strong>
                  <span className="text-[11px] text-ink/55">縦書き（右綴じ）・表紙が左</span>
                </div>
                <div className="mb-2 flex items-center gap-3">
                  <SliderField
                    label="表示倍率"
                    value={Math.round(spreadZoom * 100)}
                    min={100}
                    max={400}
                    step={25}
                    unit="%"
                    onChange={(value) => setSpreadZoom(value / 100)}
                  />
                  <button
                    type="button"
                    onClick={() => setSpreadZoom(1)}
                    disabled={spreadZoom === 1}
                    className="shrink-0 rounded border border-ink/20 px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-40"
                  >
                    全体表示
                  </button>
                </div>
                <div className={`max-h-[60dvh] ${spreadZoom > 1 ? "overflow-auto overscroll-contain" : "overflow-hidden"}`}>
                  <PlanCanvas
                    build={(measure) => buildCoverSpreadPlan(settings, spread, { measure, showGuides: true })}
                    images={images}
                    cssWidth={spreadWidth}
                    className="shadow-[0_10px_22px_rgba(20,15,22,0.16)]"
                    ariaLabel="表紙・背・裏表紙の見開きプレビュー"
                  />
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <div className="flex gap-1">
                    <dt className="text-ink/55">背幅</dt>
                    <dd className="font-semibold text-ink">{spineWidthMm.toFixed(1)}mm</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-ink/55">背文字</dt>
                    <dd className="font-semibold text-ink">
                      {spineTextEnabled
                        ? `${settings.spine.fontSize.toFixed(1)}pt（約${spineFontMm.toFixed(2)}mm）`
                        : "なし（4.0mm未満）"}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-ink/55">状態</dt>
                    <dd className={`font-semibold ${spineState === "narrow" ? "text-amber-700 dark:text-amber-300" : "text-ink"}`}>
                      {spineState === "disabled" ? "背文字なし" : spineState === "narrow" ? "細背注意" : "通常"}
                    </dd>
                  </div>
                </dl>
                {spineIssues.length > 0 ? (
                  <ul role="status" className="mt-2 list-disc border-l-[3px] border-amber-500 py-1 pl-6 pr-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    {spineIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                <ul className="mt-2 list-disc border-t border-ink/10 pl-5 pt-2 text-[11px] leading-relaxed text-ink/55">
                  <li>表紙・背・裏表紙を1枚の印刷面として表示しています。</li>
                  <li>点線＝仕上がり線と背の折り位置。塗り足しは天地・小口のみ3mm、背との接合面は塗り足しなし。</li>
                  <li>ガイドは書き出しません。</li>
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </ViewportModal>
  );
}

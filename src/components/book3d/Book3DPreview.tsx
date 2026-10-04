"use client";

/**
 * CST-PORT-012: 3D book preview (表紙＋背＋本文の2ページ). Visual check only;
 * never printed, exported or saved.
 *
 * Ported from COLUMNSTAND `EditorBook3D.tsx` (same model, camera, curl,
 * ノド注意 guide, toolbar and wording). What differs in TateSpun:
 *   - pages: TateSpun pages are heavy DOM, so the book never renders page
 *     components. PreviewPane photographs the two pages it shows
 *     (utils/book3dCapture.ts) and passes image URLs; every curl strip reuses
 *     that one image. While the book is closed no page is drawn at all.
 *   - covers / spine: images painted from the 表紙 plans (useBook3DCoverTextures).
 *   - always right-bound (縦書き): the spine is on the right of the front cover.
 *
 * Gutter curve: each open page = one flat window + N narrow windows ("curl
 * strips") chained toward the spine with growing angles, so the SAME page
 * image bends into the gutter. Nothing is cropped or deleted; the gutter
 * content is only foreshortened / shaded by the 3D geometry.
 */
import { memo, useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Book3DToolbar from "./Book3DToolbar";
import { useBook3DOrbit, useElementSize } from "./useBook3DOrbit";
import type { Book3DCoverTextures } from "./useBook3DCoverTextures";
import { getCoverFaceGeometry } from "@/lib/cover/coverGeometry";
import {
  BOOK3D_FRONT_VIEW,
  BOOK3D_ZOOM_MAX,
  BOOK3D_ZOOM_MIN,
  spineViewYaw,
  type Book3DView,
} from "@/lib/book3d/book3dView";
import {
  BOOK3D_BINDING_LABEL,
  buildGutterChain,
  getGutterModel,
  type Book3DBinding,
  type GutterModel,
} from "@/lib/book3d/book3dBinding";
import {
  BOOK3D_CURL_INTENSITY,
  BOOK3D_OPEN_LABEL,
  book3dFitScale,
  book3dOpenAngle,
  book3dViewForOpenState,
  type Book3DOpenState,
  type Book3DSpread,
} from "@/lib/book3d/book3dModel";
import {
  describeBook3DThickness,
  describeBook3DThicknessNotice,
  getBook3DThickness,
} from "@/lib/book3d/book3dThickness";

/** Shown in the status tooltip: the 3D is a look-only binding simulation. */
export const BOOK3D_SIMULATION_NOTE =
  "3D表示は見た目を確認するための製本シミュレーションです（印刷仕様・背幅の計算ではありません）。";

export const GUTTER_GUIDE_TOOLTIP = "製本後に見づらくなる可能性がある範囲";
const GUTTER_GUIDE_TOOLTIP_WITH_HELP = `${GUTTER_GUIDE_TOOLTIP}（クリックで説明）`;

/** TateSpun is always right-bound (縦書き). */
const SPINE_EDGE = "right" as const;

/** A page image for the open book: a URL, still being prepared, or not available. */
export type Book3DPageTexture = { status: "ready"; url: string } | { status: "loading" } | { status: "missing" };

export type Book3DPreviewProps = {
  paperSize: string;
  /** physical pages of the book (目次・奥付 included) */
  pageCount: number;
  spread: Book3DSpread;
  pageTextures: Record<number, Book3DPageTexture>;
  covers: Book3DCoverTextures;
  spineWidthMm: number;
  view: Book3DView;
  zoom: number;
  openState: Book3DOpenState;
  binding: Book3DBinding;
  showGutterGuide: boolean;
  showGuideHelp: boolean;
  onViewChange: (view: Book3DView) => void;
  onZoomChange: (zoom: number) => void;
  onOpenStateChange: (state: Book3DOpenState) => void;
  onBindingChange: (binding: Book3DBinding) => void;
  onShowGutterGuideChange: (value: boolean) => void;
  onDismissGuideHelp: () => void;
  /** 「ノドを調整する」: opens 設定 at the ノド field (CST: ページ設定 › ノド). Optional. */
  onAdjustGutter?: () => void;
  /** SPN-XFIX-001: 「画像で保存」の保存名（拡張子なし）。 */
  snapshotFileStem?: string;
};

/* ── one page texture (image of the trim area) ───────────────────────── */

function PageTexture({
  texture,
  w,
  h,
  guide,
}: {
  texture: Book3DPageTexture | null;
  w: number;
  h: number;
  guide: { side: "left" | "right"; widthPx: number; onClick?: () => void } | null;
}) {
  return (
    <div className="eb3d-page-crop" style={{ width: `${w}px`, height: `${h}px` }}>
      {texture?.status === "ready" ? (
        <div
          className="eb3d-page-image"
          style={{ width: `${w}px`, height: `${h}px`, backgroundImage: `url("${texture.url}")` }}
        />
      ) : (
        <div className="eb3d-blank-page" data-loading={texture?.status === "loading" ? "" : undefined} />
      )}
      {guide ? (
        // Preview-only guide (never part of the page image, so never exported).
        <div
          className="eb3d-gutter-guide"
          data-gutter-guide=""
          title={guide.onClick ? GUTTER_GUIDE_TOOLTIP_WITH_HELP : GUTTER_GUIDE_TOOLTIP}
          style={{ width: `${guide.widthPx}px`, [guide.side]: 0 } as CSSProperties}
          onClick={(event) => {
            event.stopPropagation();
            guide.onClick?.();
          }}
        />
      ) : null}
    </div>
  );
}

function CoverTexture({ url, w, h }: { url: string; w: number; h: number }) {
  return <div className="eb3d-cover-image" style={{ width: `${w}px`, height: `${h}px`, backgroundImage: `url("${url}")` }} />;
}

/* ── curved page: valley chain anchored on the spine axis ─────────────── */

/**
 * Local frame of one open page: the page faces +Z, "into its own half of the
 * book" is −Z, and the spine axis is the point (gutterX, 0). The curl chain
 * starts exactly on that axis and rises outward; the flat part continues at
 * height `rise`. Underneath, a page-stack edge (top / bottom / fore-edge) is
 * drawn per strip down to the cover board at z = −stackPx, so the 天地 edges
 * follow the same curve as the page surface.
 */
function CurvedPage({
  texture,
  w,
  h,
  px,
  gutterSide,
  model,
  intensity,
  showGuide,
  stackPx,
  renderCover,
  onGuideClick,
}: {
  texture: Book3DPageTexture | null;
  w: number;
  h: number;
  px: number;
  /** spine side in this page's own texture coordinates */
  gutterSide: "left" | "right";
  model: GutterModel;
  intensity: number;
  showGuide: boolean;
  /** constant thickness of this half's page stack (page surface → cover board) */
  stackPx: number;
  /** cover texture (w × h) for the board under the flat part, seen from outside */
  renderCover: () => ReactNode;
  onGuideClick?: () => void;
}) {
  const curlPx = Math.min(w * 0.45, model.curlZoneMm * px);
  const chain = buildGutterChain(curlPx, model, intensity);
  const right = gutterSide === "right";
  const gutterX = right ? w : 0;
  const dir = right ? -1 : 1; // direction from the spine toward the fore-edge
  const flatWidth = w - curlPx;
  const guide = showGuide ? { side: gutterSide, widthPx: model.warnMm * px, onClick: onGuideClick } : null;
  const pageTexture = (offsetPx: number) => (
    <div style={{ position: "absolute", top: 0, left: `${-offsetPx}px` }}>
      <PageTexture texture={texture} w={w} h={h} guide={guide} />
    </div>
  );
  // gradient direction "from the spine toward the fore-edge" in texture space
  const awayFromSpine = right ? "270deg" : "90deg";

  // Stack edge (天/地) under a segment. The stack has CONSTANT thickness, so both
  // its upper and lower outline follow the page curve (no flat "board" bottom).
  const depth = Math.max(1, stackPx);
  const edge = (key: string, width: number, transform: string, origin: string) =>
    [0, h].map((y) => (
      <div
        key={`${key}-${y}`}
        className="eb3d-stack-edge"
        style={{
          top: `${y}px`,
          width: `${width}px`,
          height: `${depth}px`,
          transformOrigin: origin.replace("50%", "0"),
          transform: `${transform} rotateX(-90deg)`,
        }}
      />
    ));

  const flatX = gutterX + dir * chain.reachPx; // spine-side edge of the flat part
  const flatLeft = right ? flatX - flatWidth : flatX;
  const flatTransform = `translate3d(${flatLeft}px, 0, ${chain.risePx}px)`;
  const foreEdgeX = right ? flatLeft : flatLeft + flatWidth;

  return (
    <div className="eb3d-curved-page" style={{ width: `${w}px`, height: `${h}px` }}>
      {/* flat part */}
      <div
        className="eb3d-page-window"
        style={{ left: 0, width: `${flatWidth}px`, height: `${h}px`, transform: flatTransform }}
      >
        {pageTexture(right ? 0 : curlPx)}
        {/* the valley shade continues softly onto the flat part */}
        <div
          className="eb3d-strip-shade"
          style={{
            background: `linear-gradient(${right ? "270deg" : "90deg"}, rgba(30,22,32,${chain.flatShadeAlpha.toFixed(3)}), rgba(30,22,32,0) 28%)`,
          }}
        />
      </div>
      {edge("flat", flatWidth, flatTransform, "0 50%")}
      {/* cover board under the flat part (cover art, seen from outside) */}
      <div
        className="eb3d-board"
        style={{ left: 0, width: `${flatWidth}px`, height: `${h}px`, transform: `${flatTransform} translateZ(${-depth}px)` }}
      >
        <div className="eb3d-board-face" style={{ width: `${flatWidth}px`, height: `${h}px` }}>
          <div style={{ position: "absolute", top: 0, left: `${-(w - flatLeft - flatWidth)}px` }}>{renderCover()}</div>
        </div>
      </div>
      {/* fore-edge of the page stack, under the flat part's outer edge */}
      <div
        className="eb3d-stack-fore"
        style={{
          left: 0,
          width: `${depth}px`,
          height: `${h}px`,
          transformOrigin: "0 50%",
          transform: `translate3d(${foreEdgeX}px, 0, ${chain.risePx}px) rotateY(90deg)`,
        }}
      />

      {chain.strips.map((strip, j) => {
        const textureOffset = right ? w - (j + 1) * strip.widthPx : j * strip.widthPx;
        const edgeX = gutterX + dir * strip.fromSpinePx; // spine-side edge of this strip
        const transform = right
          ? `translate3d(${edgeX - strip.widthPx}px, 0, ${strip.risePx}px) rotateY(${strip.angleDeg}deg)`
          : `translate3d(${edgeX}px, 0, ${strip.risePx}px) rotateY(${-strip.angleDeg}deg)`;
        const origin = right ? "100% 50%" : "0 50%";
        return (
          <div key={j} style={{ display: "contents" }}>
            <div
              className="eb3d-page-window"
              style={{
                left: 0,
                width: `${strip.widthPx + 0.6}px`,
                height: `${h}px`,
                transformOrigin: origin,
                transform,
              }}
            >
              {pageTexture(textureOffset)}
              <div
                className="eb3d-strip-shade"
                style={{
                  // follows the bend: darkest at the valley, fading toward the flat part
                  background: `linear-gradient(${awayFromSpine}, rgba(30,22,32,${chain.shadeAt(j).toFixed(3)}), rgba(30,22,32,${chain.shadeAt(j + 1).toFixed(3)}))`,
                }}
              />
            </div>
            {edge(`s${j}`, strip.widthPx + 0.6, transform, origin)}
            {/* the board bends with the stack */}
            <div
              className="eb3d-board eb3d-board-plain"
              style={{
                left: 0,
                width: `${strip.widthPx + 0.6}px`,
                height: `${h}px`,
                transformOrigin: origin,
                transform: `${transform} translateZ(${-depth}px)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── the book (memoised: camera drags do not re-render it) ─────────────── */

type ModelProps = {
  paperSize: string;
  pageCount: number;
  spread: Book3DSpread;
  pageTextures: Record<number, Book3DPageTexture>;
  covers: Book3DCoverTextures;
  spineWidthMm: number;
  openState: Book3DOpenState;
  binding: Book3DBinding;
  showGutterGuide: boolean;
  /** stable callback (memo-safe): pink guide clicked */
  onGuideClick?: () => void;
};

const BookModel = memo(function BookModel(props: ModelProps) {
  const { paperSize, pageCount, spread, pageTextures, covers, spineWidthMm, openState, binding, showGutterGuide } = props;
  const face = getCoverFaceGeometry(paperSize);
  const px = face.pxPerMm;
  const w = face.trimWidthMm * px;
  const h = face.trimHeightMm * px;
  const thickness = getBook3DThickness(spineWidthMm, pageCount);
  const model = getGutterModel(binding, thickness.thicknessMm);
  const t = thickness.thicknessMm * px;
  const half = t / 2;
  const spineSign = SPINE_EDGE === "right" ? 1 : -1;
  const angle = book3dOpenAngle(openState, model);
  const isOpen = angle > 0;
  const intensity = BOOK3D_CURL_INTENSITY[openState];

  // odd page on the static (back-cover) half, even page on the hinged (front-cover) half
  const textureAt = (index: number | null) => (index === null ? null : pageTextures[index] ?? { status: "loading" as const });

  const placeholderCover = (side: "front" | "back"): ReactNode => (
    <div className="eb3d-placeholder-cover" style={{ width: `${w}px`, height: `${h}px` }}>
      <strong>{side === "front" ? "表紙未設定" : "裏表紙未設定"}</strong>
      <span>本文 {pageCount}P の仮冊子</span>
    </div>
  );

  // Closed book only: flat page-block faces. When open, the curved pages draw
  // their own stack edges that follow the curve.
  const blockSide = (sign: number, zCenter: number): CSSProperties => ({
    width: `${half}px`,
    height: `${h}px`,
    left: `${(w - half) / 2}px`,
    transform: `translateZ(${zCenter}px) rotateY(${90 * sign}deg) translateZ(${w / 2}px)`,
  });
  const blockCap = (sign: number, zCenter: number): CSSProperties => ({
    width: `${w}px`,
    height: `${half}px`,
    top: `${(h - half) / 2}px`,
    transform: `translateZ(${zCenter}px) rotateX(${90 * sign}deg) translateZ(${h / 2}px)`,
  });

  const oppositeEdge = SPINE_EDGE === "right" ? "left" : "right";
  const pageProps = {
    w,
    h,
    px,
    model,
    intensity,
    showGuide: showGutterGuide,
    stackPx: half,
    onGuideClick: props.onGuideClick,
  };
  const backCover = (): ReactNode => (covers.back ? <CoverTexture url={covers.back} w={w} h={h} /> : placeholderCover("back"));
  const frontCover = (): ReactNode => (covers.front ? <CoverTexture url={covers.front} w={w} h={h} /> : placeholderCover("front"));

  return (
    <>
      {/* static half: back cover + page block (closed) / curved odd page (open) */}
      {isOpen ? (
        <div className="eb3d-page-anchor" style={{ width: `${w}px`, height: `${h}px` }}>
          <CurvedPage {...pageProps} texture={textureAt(spread.leftIndex)} gutterSide={SPINE_EDGE} renderCover={backCover} />
        </div>
      ) : (
        <>
          <div className="cb3d-face cb3d-back" style={{ width: `${w}px`, height: `${h}px`, transform: `rotateY(180deg) translateZ(${half}px)` }}>
            {backCover()}
          </div>
          <div className="cb3d-face cb3d-fore-edge" style={blockSide(-spineSign, -half / 2)} />
          <div className="cb3d-face cb3d-cap" style={blockCap(1, -half / 2)} />
          <div className="cb3d-face cb3d-cap" style={blockCap(-1, -half / 2)} />
        </>
      )}
      {angle <= 40 ? (
        <div
          className="cb3d-face cb3d-spine"
          style={{
            width: `${t}px`,
            height: `${h}px`,
            left: `${(w - t) / 2}px`,
            transform: `rotateY(${90 * spineSign}deg) translateZ(${w / 2}px)`,
          }}
        >
          {covers.spine ? (
            <CoverTexture url={covers.spine} w={t} h={h} />
          ) : (
            <div className="eb3d-plain-spine" style={{ width: `${t}px`, height: `${h}px` }} />
          )}
        </div>
      ) : null}

      {/* hinged half: rotates about the spine axis, which is also where both
          pages' valley chains start — so the two pages always meet. */}
      <div
        className="eb3d-hinge"
        style={{
          width: `${w}px`,
          height: `${h}px`,
          transformOrigin: `${spineSign === 1 ? w : 0}px 50% 0`,
          transform: `rotateY(${angle * spineSign}deg)`,
        }}
      >
        {isOpen ? (
          // rotateY(180) about the page centre mirrors the frame: the spine is on the
          // opposite texture side, and the spine axis maps onto the hinge axis.
          <div className="eb3d-page-anchor" style={{ width: `${w}px`, height: `${h}px`, transform: "rotateY(180deg)" }}>
            <CurvedPage {...pageProps} texture={textureAt(spread.rightIndex)} gutterSide={oppositeEdge} renderCover={frontCover} />
          </div>
        ) : (
          <>
            <div className="cb3d-face cb3d-front" style={{ width: `${w}px`, height: `${h}px`, transform: `translateZ(${half}px)` }}>
              {frontCover()}
            </div>
            <div className="cb3d-face cb3d-fore-edge" style={blockSide(-spineSign, half / 2)} />
            <div className="cb3d-face cb3d-cap" style={blockCap(1, half / 2)} />
            <div className="cb3d-face cb3d-cap" style={blockCap(-1, half / 2)} />
          </>
        )}
      </div>
    </>
  );
});

/* ── viewer ───────────────────────────────────────────────────────────── */

export default function Book3DPreview(props: Book3DPreviewProps) {
  const {
    paperSize,
    pageCount,
    spread,
    pageTextures,
    covers,
    spineWidthMm,
    view,
    zoom,
    openState,
    binding,
    showGutterGuide,
    showGuideHelp,
    onViewChange,
    onZoomChange,
    onOpenStateChange,
    onBindingChange,
    onShowGutterGuideChange,
    onDismissGuideHelp,
    onAdjustGutter,
    snapshotFileStem = "",
  } = props;

  const [snapshotState, setSnapshotState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [guideInfoOpen, setGuideInfoOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const openGuideInfo = useCallback(() => {
    setDontShowAgain(false);
    setGuideInfoOpen(true);
  }, []);
  // After "次からこの説明を表示しない" the guide keeps only its hover tooltip.
  const onGuideClick = showGuideHelp ? openGuideInfo : undefined;
  const closeGuideInfo = (action: "keep" | "hide" | "adjust") => {
    if (dontShowAgain) onDismissGuideHelp();
    if (action === "hide") onShowGutterGuideChange(false);
    setGuideInfoOpen(false);
    // the guide stays visible so the effect of a new ノド value can be checked in 3D
    if (action === "adjust") onAdjustGutter?.();
  };

  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageSize = useElementSize(stageRef);
  const { dragging, rotate, stageHandlers } = useBook3DOrbit(view, onViewChange);

  const face = getCoverFaceGeometry(paperSize);
  const w = face.trimWidthMm * face.pxPerMm;
  const h = face.trimHeightMm * face.pxPerMm;
  const thickness = getBook3DThickness(spineWidthMm, pageCount);
  const model = getGutterModel(binding, thickness.thicknessMm);
  const spineSign = SPINE_EDGE === "right" ? 1 : -1;
  const angle = book3dOpenAngle(openState, model);
  const shiftX = -spineSign * (w / 2) * (angle / 180);
  const bookWidthPx = angle > 90 ? w * 2 : w + thickness.thicknessMm * face.pxPerMm;
  const fitScale = book3dFitScale(stageSize, bookWidthPx, h, openState);

  const selectOpenState = (state: Book3DOpenState) => {
    onOpenStateChange(state);
    onViewChange(book3dViewForOpenState(state, SPINE_EDGE));
  };
  const setClosedView = (yaw: number) => {
    onOpenStateChange("closed");
    onViewChange({ yaw, pitch: 0 });
  };
  const clampZoom = (value: number) =>
    Math.round(Math.min(BOOK3D_ZOOM_MAX, Math.max(BOOK3D_ZOOM_MIN, value)) * 10) / 10;

  const preparing =
    openState !== "closed" &&
    [spread.leftIndex, spread.rightIndex].some((index) => index !== null && pageTextures[index]?.status !== "ready" && pageTextures[index]?.status !== "missing");
  const status = [
    BOOK3D_BINDING_LABEL[binding],
    describeBook3DThickness(thickness),
    openState !== "closed" ? `左 ${spread.leftPage ?? "–"}P｜右 ${spread.rightPage ?? "–"}P` : `${pageCount}P`,
    showGutterGuide ? `ノド注意 約${model.warnMm}mm` : null,
    showGutterGuide && showGuideHelp ? "ピンク＝ノド注意範囲（クリックで説明）" : null,
    preparing ? "ページを準備中…" : null,
  ]
    .filter(Boolean)
    .join("・");
  const thicknessNotice = describeBook3DThicknessNotice(thickness);

  const saveSnapshot = async () => {
    const stage = stageRef.current;
    if (!stage || snapshotState === "saving") return;
    setSnapshotState("saving");
    try {
      const { saveBook3DSnapshot, book3dSnapshotFileName } = await import("@/utils/book3dSnapshot");
      await saveBook3DSnapshot(stage, book3dSnapshotFileName(snapshotFileStem));
      setSnapshotState("saved");
      window.setTimeout(() => setSnapshotState((state) => (state === "saved" ? "idle" : state)), 6000);
    } catch (error) {
      console.error(error);
      setSnapshotState("error");
    }
  };

  return (
    <div className="eb3d-root" data-book3d-preview="">
      <div
        ref={stageRef}
        className={`cb3d-stage eb3d-stage ${dragging ? "is-dragging" : ""}`}
        {...stageHandlers}
        role="img"
        aria-label={`本の3Dプレビュー（${BOOK3D_BINDING_LABEL[binding]}・${BOOK3D_OPEN_LABEL[openState]}・横${Math.round(view.yaw)}度・縦${Math.round(view.pitch)}度）`}
      >
        <div className="cb3d-zoom" style={{ transform: `scale(${fitScale * zoom})` }}>
          <div
            className="cb3d-book eb3d-book"
            data-open-state={openState}
            data-binding={binding}
            data-spine-edge={SPINE_EDGE}
            style={{
              width: `${w}px`,
              height: `${h}px`,
              transform: `rotateX(${view.pitch}deg) rotateY(${view.yaw}deg) translateX(${shiftX}px)`,
            }}
          >
            <BookModel
              paperSize={paperSize}
              pageCount={pageCount}
              spread={spread}
              pageTextures={pageTextures}
              covers={covers}
              spineWidthMm={spineWidthMm}
              openState={openState}
              binding={binding}
              showGutterGuide={showGutterGuide}
              onGuideClick={onGuideClick}
            />
          </div>
        </div>
      </div>

      {guideInfoOpen ? (
        <div className="eb3d-guide-info" role="dialog" aria-modal="false" aria-labelledby="eb3d-guide-info-title">
          <strong id="eb3d-guide-info-title">ノド注意範囲について</strong>
          <p>
            このピンク色の範囲は、製本後に文字や画像が見づらくなる可能性がある目安です。
            印刷データには出力されません。
          </p>
          <p>範囲に文字や画像がかかって見づらい場合は、ページ設定の『ノド』の数値を大きくしてください。</p>
          <label className="eb3d-guide-info-check">
            <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
            <span>次からこの説明を表示しない</span>
          </label>
          <div className="eb3d-guide-info-actions">
            <button type="button" className="is-primary" onClick={() => closeGuideInfo("keep")} autoFocus>
              このまま表示
            </button>
            <button type="button" onClick={() => closeGuideInfo("hide")}>
              非表示にする
            </button>
            {onAdjustGutter ? (
              <button type="button" className="is-adjust" onClick={() => closeGuideInfo("adjust")}>
                ノドを調整する
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="eb3d-snapshot-row flex flex-none flex-wrap items-center justify-end gap-x-3 gap-y-1 px-3 pt-1.5 text-xs">
        {snapshotState === "saved" ? (
          <span role="status" className="text-ink/60">PNG画像を保存しました。</span>
        ) : snapshotState === "error" ? (
          <span role="status" className="text-red-600">画像にできませんでした。少し待ってもう一度押してください。</span>
        ) : null}
        <button
          type="button"
          data-book3d-save-image=""
          onClick={() => void saveSnapshot()}
          disabled={snapshotState === "saving" || preparing}
          className="rounded border border-ink/25 px-2.5 py-1 font-medium text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {snapshotState === "saving" ? "保存中…" : "画像で保存（PNG）"}
        </button>
      </div>

      <Book3DToolbar
        zoom={zoom}
        openState={openState}
        binding={binding}
        showGutterGuide={showGutterGuide}
        status={status}
        statusTitle={`${status}\n${BOOK3D_SIMULATION_NOTE}`}
        notice={thicknessNotice}
        onZoom={(delta) => onZoomChange(clampZoom(zoom + delta))}
        onRotate={rotate}
        onFront={() => setClosedView(0)}
        onSpine={() => setClosedView(spineViewYaw(SPINE_EDGE))}
        onBack={() => setClosedView(180)}
        onOpenView={() => selectOpenState("open")}
        onReset={() => {
          onViewChange(BOOK3D_FRONT_VIEW);
          onZoomChange(1);
        }}
        onOpenStateChange={selectOpenState}
        onBindingChange={onBindingChange}
        onShowGutterGuideChange={onShowGutterGuideChange}
      />
    </div>
  );
}

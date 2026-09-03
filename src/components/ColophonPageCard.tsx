"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BLEED_MM, PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";
import {
  COLOPHON_FONT_SAME_AS_BODY,
  colophonRenderModel,
  resolveColophonNombre,
  type ColophonRenderRow,
  type ColophonSettings,
  type ColophonTemplateId,
} from "@/lib/colophon";
import { resolveNombreFontFamily } from "@/constants/fonts";
import { NombreOverlay } from "./PageCard";

/**
 * TSP-LOOP-005 — 本文とは完全に独立した「横書き専用の奥付ページ」1枚。
 *
 * - 用紙サイズ・余白・塗り足しは本文と同じ paper preset を使う（本文と同じ
 *   orientation。奥付だけ landscape にはしない）。
 * - `writing-mode: horizontal-tb` の通常フロー。本文用の固定スロット組版・
 *   本文トークナイザ・改ページ解析・縦中横・欧文ラン・ルビ本文レンダラは
 *   一切使わない（該当モジュールを import しない）。
 * - β版では複数ページへ自動分割しない。1ページに収まらない場合は
 *   `onOverflowChange` で呼び出し側へ通知し、プレビュー上に警告を出す
 *   （文字を極小化・切り捨てはしない）。
 * - ノンブル（ページ番号）: 本文のノンブルが表示 ON なら、奥付にも「実際の
 *   作品ページ順（物理ページ順）」に従った続き番号を表示する（奥付を途中へ
 *   入れた場合も物理順）。本文用 NombreOverlay をそのまま再利用。本文が
 *   非表示なら奥付にも出さない。柱は付けない。
 * - ページ位置（本文の何ページ後 / 末尾）は呼び出し側が Presentation Sequence
 *   で決める。ページ内の配置（左右 / 上下 / ノド・天地考慮）は placement で。
 *
 * エクスポート: `.page-card` / `[data-page-card]` と `[data-bleed-guide]` を
 * 本文ページと同じ構造で持つため、既存の capture pipeline
 * （exportCapture / exportImage / exportPdf）がそのまま本文ページと同様に扱える。
 */
interface ColophonPageCardProps {
  settings: PageSettings;
  layout: PageLayout;
  colophon: ColophonSettings;
  /** 作品タイトル（書名 項目が空のときのフォールバック表示に使う）。 */
  title: string;
  /**
   * 奥付ページの物理ページ番号（Presentation Sequence 上の 1 始まりの位置）。
   * ノンブル値・見開きの左右（parity）・綴じ側の判定にそのまま使う。
   */
  physicalPageNumber: number;
  /** 1ページに収まらないかどうかを呼び出し側へ通知する（警告表示用）。 */
  onOverflowChange?: (overflowing: boolean) => void;
}

export default function ColophonPageCard({
  settings,
  layout,
  colophon,
  title,
  physicalPageNumber,
  onOverflowChange,
}: ColophonPageCardProps) {
  const { paper } = layout;
  const bleedMm = paper.isPx ? 0 : BLEED_MM;
  const { masterPage } = settings;
  const { placement } = colophon;

  // 物理ページ番号から見開きの左右を決める（本文 PageCard と同じ規則:
  // 奇数=recto=見開き左、偶数=verso=見開き右。綴じ側 = 奇数は右 / 偶数は左）。
  const isOddPage = physicalPageNumber % 2 === 1;

  // `.page-card` 外形は本文ページと完全一致（塗り足し込み）。余白の内側は
  // PlacementArea 側で扱うため、ここでは padding を持たせない。
  const sheetStyle: CSSProperties = {
    position: "relative",
    writingMode: "horizontal-tb",
    width: (paper.widthMm + bleedMm * 2) * PX_PER_MM,
    height: (paper.heightMm + bleedMm * 2) * PX_PER_MM,
  };

  // B. BLOCK PLACEMENT: 奥付ブロックの配置基準となる矩形（PlacementArea）を
  // 既存の余白値だけから決める（勝手な印刷数値を発明しない）。
  //  - respectGutter ON : ノド側=marginGutter / 小口側=marginOuter（左右非対称、parity 依存）
  //  - respectGutter OFF: 既存 marginGutter/marginOuter の小さい方を左右対称に
  //  - respectVerticalMargins ON : 天=marginTop / 地=marginBottom
  //  - respectVerticalMargins OFF: 既存 marginTop/marginBottom の小さい方を天地対称に
  const gutterOuterMin = Math.min(settings.marginGutter, settings.marginOuter);
  const leftMarginMm = placement.respectGutter
    ? isOddPage
      ? settings.marginOuter
      : settings.marginGutter
    : gutterOuterMin;
  const rightMarginMm = placement.respectGutter
    ? isOddPage
      ? settings.marginGutter
      : settings.marginOuter
    : gutterOuterMin;
  const vMarginMin = Math.min(settings.marginTop, settings.marginBottom);
  const topMarginMm = placement.respectVerticalMargins ? settings.marginTop : vMarginMin;
  const bottomMarginMm = placement.respectVerticalMargins ? settings.marginBottom : vMarginMin;

  const placementAreaStyle: CSSProperties = {
    position: "absolute",
    top: (topMarginMm + bleedMm) * PX_PER_MM,
    bottom: (bottomMarginMm + bleedMm) * PX_PER_MM,
    left: (leftMarginMm + bleedMm) * PX_PER_MM,
    right: (rightMarginMm + bleedMm) * PX_PER_MM,
    overflow: "hidden",
    display: "flex",
    justifyContent:
      placement.horizontal === "left"
        ? "flex-start"
        : placement.horizontal === "right"
          ? "flex-end"
          : "center",
    alignItems:
      placement.vertical === "top"
        ? "flex-start"
        : placement.vertical === "bottom"
          ? "flex-end"
          : "center",
  };

  // 本文と同じ preview スケール係数で文字サイズを決める（export の crop も
  // この canonical px を前提にしているため、本文と同じ扱いになる）。
  const basePx = layout.fontSizeMm * PX_PER_MM;
  const fontFamily =
    colophon.fontFamily && colophon.fontFamily !== COLOPHON_FONT_SAME_AS_BODY
      ? colophon.fontFamily
      : settings.fontFamily || "'Shippori Mincho', serif";

  const { rows, freeText } = colophonRenderModel(colophon);
  const titleFallback = title.trim();

  // ノンブル: 本文の masterPage 設定をそのまま解釈する（本文ノンブルが
  // 非表示なら奥付にも出さない）。物理ページ番号 - 1 = 奥付より前の本文ページ数。
  const colophonNombre = resolveColophonNombre(masterPage, physicalPageNumber - 1);
  const isWebPreset = settings.paperSize === "Web閲覧用";

  const placementRef = useRef<HTMLDivElement | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const reportedOverflowRef = useRef<boolean | null>(null);

  // ページサイズ・テンプレート・項目・自由記述・フォントのいずれかが変われば
  // 収まり具合を測り直す。Web フォント読み込み完了でメトリクスがずれる場合も
  // あるため、document.fonts.ready 後に nonce を1回上げて再計測する。
  const [fontsNonce, setFontsNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) setFontsNonce((n) => n + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const measureSignature = JSON.stringify([
    colophon.templateId,
    colophon.fields,
    colophon.freeText,
    fontFamily,
    basePx,
    sheetStyle.width,
    sheetStyle.height,
    placementAreaStyle.top,
    placementAreaStyle.left,
    placementAreaStyle.right,
    placementAreaStyle.bottom,
    placement.horizontal,
    placement.vertical,
    fontsNonce,
  ]);

  useEffect(() => {
    const area = placementRef.current;
    const block = blockRef.current;
    if (!area || !block) return;
    // block は自然サイズ（PlacementArea 側が overflow:hidden で視覚的に
    // クリップする）。block の外形が PlacementArea の内寸を超えたら overflow。
    // 1px の丸め誤差は無視する。
    const isOver =
      block.offsetHeight > area.clientHeight + 1 || block.offsetWidth > area.clientWidth + 1;
    setOverflowing((prev) => (prev === isOver ? prev : isOver));
    if (reportedOverflowRef.current !== isOver) {
      reportedOverflowRef.current = isOver;
      onOverflowChange?.(isOver);
    }
  }, [measureSignature, onOverflowChange]);

  const blockStyle: CSSProperties = {
    maxWidth: "100%",
    maxHeight: "100%",
    color: "#000000",
    fontFamily,
    fontSize: `${basePx}px`,
    lineHeight: 1.8,
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 p-1">
      {overflowing && (
        <div
          data-no-print="true"
          className="no-print w-full max-w-full rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-800"
        >
          奥付の内容が1ページに収まりきりません。項目を減らす・自由記述を短くする・
          非表示にするなどで調整してください（β版では自動でページ分割・縮小はしません）。
        </div>
      )}
      <div
        data-page-card="true"
        data-colophon-page="true"
        data-is-px-page={paper.isPx ? "true" : undefined}
        className="page-card shrink-0 overflow-hidden border border-gray-200 bg-paper shadow-md dark:border-gray-700 dark:shadow-[0_0_0_1px_rgba(170,180,212,0.15),0_12px_36px_-8px_rgba(0,0,0,0.85)]"
        style={sheetStyle}
      >
        {/* PlacementArea（余白/ノドを考慮した配置基準） > ColophonBlock > Template */}
        <div ref={placementRef} style={placementAreaStyle}>
          <div ref={blockRef} style={blockStyle}>
            <ColophonTemplate
              templateId={colophon.templateId}
              rows={rows}
              freeText={freeText}
              basePx={basePx}
              titleFallback={titleFallback}
            />
          </div>
        </div>
        {colophonNombre && (
          <NombreOverlay
            value={colophonNombre.value}
            position={
              isWebPreset
                ? "left"
                : (masterPage.nombrePosition as "center" | "gutter" | "outer")
            }
            isOddPage={colophonNombre.isOddPage}
            bottomMarginMm={masterPage.nombreBottomMargin}
            marginGutterMm={settings.marginGutter}
            marginOuterMm={settings.marginOuter}
            fontSize={masterPage.nombreFontSize}
            // ページ番号は本全体で一貫させる: 本文ページと同じ解決規則
            // （明示指定があればそれ、なければ本文フォント）を使う——奥付の
            // 本文フォント（横書き用）ではなく本文組版のフォントを渡す。
            fontFamily={resolveNombreFontFamily(
              masterPage.nombreFontFamily,
              settings.fontFamily || "'Shippori Mincho', serif"
            )}
            bleedMm={bleedMm}
          />
        )}
        {!paper.isPx && (
          <div
            data-bleed-guide="true"
            className="border-dashed"
            style={{
              position: "absolute",
              top: BLEED_MM * PX_PER_MM,
              bottom: BLEED_MM * PX_PER_MM,
              left: BLEED_MM * PX_PER_MM,
              right: BLEED_MM * PX_PER_MM,
              border: "1px dashed #A0A0A0",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <span className="text-xs text-ink/60">奥付</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  4テンプレート — すべて同じ ColophonRenderRow[] / freeText を描画する。
 *  共通の行データを持ち、レイアウト/装飾だけをテンプレートごとに分ける
 *  （完全別コンポーネントへのコピー実装はしない）。
 * ------------------------------------------------------------------ */

interface TemplateProps {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
}

function ColophonTemplate({ templateId, rows, freeText, basePx, titleFallback }: TemplateProps) {
  switch (templateId) {
    case "center":
      return <CenterTemplate rows={rows} freeText={freeText} basePx={basePx} />;
    case "minimal":
      return (
        <MinimalTemplate
          rows={rows}
          freeText={freeText}
          basePx={basePx}
          titleFallback={titleFallback}
        />
      );
    case "classic":
      return <ClassicTemplate rows={rows} freeText={freeText} basePx={basePx} />;
    case "standard":
    default:
      return <StandardTemplate rows={rows} freeText={freeText} basePx={basePx} />;
  }
}

function FreeText({ text, basePx, align = "left" }: { text: string; basePx: number; align?: "left" | "center" }) {
  if (text.trim() === "") return null;
  return (
    <p
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        fontSize: `${basePx * 0.86}px`,
        textAlign: align,
        opacity: 0.85,
      }}
    >
      {text}
    </p>
  );
}

/** 標準: 左にラベル・右に値。読みやすさ最優先、情報量中程度。上詰め。 */
function StandardTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * 1.4}px` }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: `${basePx * 1.6}px`,
          rowGap: `${basePx * 0.7}px`,
        }}
      >
        {rows.map((row) => (
          <FragmentRow key={row.id} label={row.label} value={row.value} />
        ))}
      </div>
      <FreeText text={freeText} basePx={basePx} />
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </>
  );
}

/** 中央: 中央揃え。静かな作品集風。label と value を縦に整理。 */
function CenterTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${basePx * 1.1}px`,
        textAlign: "center",
      }}
    >
      {rows.map((row) => (
        <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: `${basePx * 0.15}px` }}>
          {row.label.trim() !== "" && (
            <span style={{ fontSize: `${basePx * 0.78}px`, opacity: 0.6 }}>{row.label}</span>
          )}
          <span>{row.value}</span>
        </div>
      ))}
      {freeText.trim() !== "" && <div style={{ height: `${basePx * 0.6}px` }} />}
      <FreeText text={freeText} basePx={basePx} align="center" />
    </div>
  );
}

/** ミニマル: 書名を主役に。装飾は最小、情報はコンパクト、余白を活かす。 */
function MinimalTemplate({
  rows,
  freeText,
  basePx,
  titleFallback,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
}) {
  const titleRow = rows.find((r) => r.id === "title") ?? rows[0];
  const rest = rows.filter((r) => r !== titleRow);
  const mainTitle = (titleRow?.value ?? "").trim() || titleFallback;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${basePx * 2.4}px`,
      }}
    >
      {mainTitle !== "" && (
        <div style={{ fontSize: `${basePx * 1.7}px`, fontWeight: 600, letterSpacing: "0.02em" }}>
          {mainTitle}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * 0.4}px` }}>
        {rest.map((row) => (
          <div key={row.id} style={{ fontSize: `${basePx * 0.9}px`, opacity: 0.8 }}>
            {row.label.trim() !== "" ? `${row.label}：${row.value}` : row.value}
          </div>
        ))}
      </div>
      <FreeText text={freeText} basePx={basePx} />
    </div>
  );
}

/** クラシック: 情報整理型。罫線を必要最低限。項目が多くても読みやすい。 */
function ClassicTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.55)",
        padding: `${basePx * 1.1}px ${basePx * 1.3}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, index) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              gap: `${basePx * 1}px`,
              padding: `${basePx * 0.5}px 0`,
              borderBottom:
                index === rows.length - 1 ? "none" : "1px solid rgba(0,0,0,0.15)",
              fontWeight: row.id === "title" ? 600 : 400,
            }}
          >
            <span style={{ minWidth: `${basePx * 6}px`, opacity: 0.7 }}>{row.label}</span>
            <span style={{ flex: 1 }}>{row.value}</span>
          </div>
        ))}
      </div>
      {freeText.trim() !== "" && (
        <>
          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.3)",
              margin: `${basePx * 0.9}px 0`,
            }}
          />
          <FreeText text={freeText} basePx={basePx} />
        </>
      )}
    </div>
  );
}

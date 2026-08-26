"use client";

/**
 * TateSpun Renderer PoC — Phase P0-A / P0-A2
 *
 * 完全隔離されたstatic PoC。既存Editor/Preview/PageCard/export経路とは
 * 一切接続しておらず、このファイル群(page.tsx / convert.ts / native.css /
 * dashDiagnostics.tsx)の外へは何も書き出さない。目的は「FixedSlot方式
 * (1文字ずつabsolute配置)ではなく、ブラウザ標準の縦書きCSSに本文組版を
 * 任せた場合、現行より自然に見えるか」を確認すること。完成実装ではない。
 *
 * P0-A2: Browser Visual QAで「――の2文字接続gapは改善したが、縦線自体が
 * 中心軸に完全に中央配置とは言えない」と判明したため、実装補正はせず
 * DOM/canvas上のgeometryを測定するだけの診断セクション(DashDiagnostics)
 * を追加。詳細は dashDiagnostics.tsx のコメント参照。
 *
 * 依存関係は追加していない(package.json/lockfile未変更)。Vivliostyleは
 * 導入していない — React / Next.js / browser-native HTML+CSSのみ。
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import type { TategakiToken } from "@/lib/tategaki";
import { splitIntoPocLines, type PocLine } from "./convert";
import DashDiagnostics from "./dashDiagnostics";
import P1Section from "./P1Section";
import FontMatrixSection from "./FontMatrixSection";
import TcyMatrixSection from "./TcyMatrixSection";
import TcyAsciiFullwidthSection from "./TcyAsciiFullwidthSection";
import PaltMatrixSection from "./PaltMatrixSection";
import "./native.css";

const POC_FONTS = {
  "Shippori Mincho": '"Shippori Mincho", serif',
  "Noto Serif JP": '"Noto Serif JP", serif',
} as const;

type PocFontFamily = (typeof POC_FONTS)[keyof typeof POC_FONTS];

// ==================================================
// STATIC GOLDEN CORPUS
// ==================================================
// TateSpunの生原稿記法(｜base《rt》・shorthand《rt》・U+3000・ruby等)を
// そのまま文字列として保持する。既存tokenizeTategaki()がこれを解釈する。

const GOLDEN_CORPUS_PAGE1 = `\
　これは通常の段落です。
これは字下げ無し比較です。

「若、お疲れ様」
『二重鉤括弧です』

■特等席

だが男……花厳には髪の事など関係のないことだった。

　花厳は自炊が得意というわけではない。

　卓上に置かれたスマートフォンが、軽快な音楽とともに震えた。

一般的な賃貸のため、台所の調理台は花厳にとって低いので少々やりづらい。

夕日の差す台所に――、長身の男は立っていた。

12月25日
!?
！？

｜花厳《かざり》
漢字《かんじ》`;

// Page 2: 複数列への自然な折返しを見るための長文（特殊記法なしの地文）。
const GOLDEN_CORPUS_PAGE2 = `\
　窓の外では、粉雪が音もなく降り積もっていた。花厳はしばらくその白さを眺めていたが、やがて視線を戻し、鍋の中身をかき混ぜはじめた。湯気が立ちのぼるたび、狭い台所は白く曇り、換気扇の低い唸りだけが部屋に響いている。二十年近く住んだこの部屋も、来月には引き払うことになる。棚の奥にしまい込んだままの写真立てを、花厳はまだ一度も開けていなかった。

「――そろそろ、決めなきゃな」

独り言のように呟いた声は、湯気の向こうへ溶けて消えた。窓辺に置かれたカレンダーには、赤いペンで丸く囲まれた日付がひとつ。それを見るたび、花厳は小さく息を吐いた。まだ何も、心の準備ができていないのに、時間だけが律儀に過ぎていく。`;

function TokenSpan({ token }: { token: TategakiToken }): ReactNode {
  if (token.type === "ruby") {
    return (
      <ruby>
        {token.base}
        <rt>{token.rt}</rt>
      </ruby>
    );
  }
  if (token.type === "tcy") {
    return <span className="poc-tcy">{token.value}</span>;
  }
  if (token.type === "text") {
    return token.value;
  }
  return null;
}

function PocLineView({ line }: { line: PocLine }) {
  return (
    <p className={line.autoIndent ? "poc-indent" : "poc-no-indent"}>
      {line.tokens.length === 0
        ? "​" /* 空行: 段落間の空きを1行分確保するためのゼロ幅スペース */
        : line.tokens.map((token, i) => <TokenSpan key={i} token={token} />)}
    </p>
  );
}

function PageBox({
  title,
  source,
  showGrid,
}: {
  title: string;
  source: string;
  showGrid: boolean;
}) {
  const lines = splitIntoPocLines(source);
  return (
    <div className="poc-page-wrap">
      <div className={`poc-a5-page poc-vertical-text${showGrid ? " poc-grid" : ""}`}>
        {lines.map((line) => (
          <PocLineView key={line.key} line={line} />
        ))}
      </div>
      <div className="poc-page-caption">{title}</div>
    </div>
  );
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
const DEFAULT_ZOOM = 100;

export default function RendererPocPage() {
  const [showGrid, setShowGrid] = useState(false);
  const [selectedFont, setSelectedFont] = useState<PocFontFamily>(POC_FONTS["Shippori Mincho"]);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);

  const stepZoom = (direction: 1 | -1) => {
    setZoom((current) => {
      const idx = ZOOM_LEVELS.indexOf(current as (typeof ZOOM_LEVELS)[number]);
      const nextIdx = idx === -1 ? ZOOM_LEVELS.indexOf(DEFAULT_ZOOM) : idx + direction;
      return ZOOM_LEVELS[Math.min(Math.max(nextIdx, 0), ZOOM_LEVELS.length - 1)];
    });
  };

  // 表示倍率はPoCのpreview表示レイヤーだけに適用する — font-size/
  // line-height/A5寸法/text-combine-upright等、authored組版CSSの値は
  // 一切変更しない。`transform: scale()`ではなくCSS `zoom`を使うのは、
  // scale()だと祖先のlayoutサイズが変わらず200%等でボックスが確保する
  // 領域を超えて隣接コンテンツと重なってしまうため——zoomは真にreflow
  // するのでFont Matrix等を並べて比較する用途でも重なりが出ない。
  // ただしzoomもgetBoundingClientRect()が返す値を見た目どおり拡大/縮小
  // させる点はscale()と同じ——DashDiagnosticsはgetBoundingClientRect()
  // による自己測定(実測値表示)を行うため、このwrapperの外に置き影響を
  // 受けないようにしている。P0-A/P1Section/FontMatrixSectionは自己測定
  // を行わない静的表示のみのため、zoomしても実測値に影響しない。
  const scaleStyle: CSSProperties = { zoom: zoom / 100 } as CSSProperties;

  return (
    <div
      className="poc-root"
      data-renderer-poc-page="true"
      style={{ "--poc-font-family": selectedFont } as CSSProperties}
    >
      <header className="poc-header">
        <h1>TateSpun Renderer P0-A</h1>
        <p className="poc-subtitle">Browser Native CSS（縦組み・絶対座標なし）</p>
        <label className="poc-font-select">
          Font
          <select
            value={selectedFont}
            onChange={(event) => setSelectedFont(event.target.value as PocFontFamily)}
          >
            {Object.entries(POC_FONTS).map(([label, fontFamily]) => (
              <option key={label} value={fontFamily}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setShowGrid((v) => !v)}>
          Grid {showGrid ? "ON" : "OFF"}
        </button>
      </header>
      <div className="poc-zoom-bar" role="group" aria-label="表示倍率（Visual QA用、組版条件には影響しません）">
        <button type="button" onClick={() => stepZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]}>
          −
        </button>
        <span className="poc-zoom-value">{zoom}%</span>
        <button type="button" onClick={() => stepZoom(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>
          ＋
        </button>
        <button type="button" onClick={() => setZoom(DEFAULT_ZOOM)}>
          Reset
        </button>
      </div>
      <p className="poc-note">
        完全隔離PoC — 既存Editor/Preview/PageCard/exportとは接続していません。
        writing-mode: vertical-rl と text-orientation: mixed、ネイティブ
        &lt;ruby&gt;、text-combine-upright、CSS text-indent、line-break: strict
        だけで縦組みを行い、1文字単位のabsolute配置は一切使用していません。
        表示倍率はVisual QA用の見た目調整のみで、9pt/A5寸法/line-height等の組版条件は変更されません。
      </p>
      <div className="poc-zoom-scale-wrapper" style={scaleStyle}>
        <main className="poc-pages">
          <PageBox title="Page 1 — Golden Corpus" source={GOLDEN_CORPUS_PAGE1} showGrid={showGrid} />
          <PageBox title="Page 2 — 長文折返しテスト" source={GOLDEN_CORPUS_PAGE2} showGrid={showGrid} />
        </main>
      </div>
      {/* DashDiagnosticsは自己測定(getBoundingClientRect)を行うため、
          表示倍率のtransform: scaleの影響を受けない位置に置く。 */}
      <DashDiagnostics fontFamily={selectedFont} />
      <div className="poc-zoom-scale-wrapper" style={scaleStyle}>
        <P1Section />
        <FontMatrixSection />
        <TcyMatrixSection />
        <TcyAsciiFullwidthSection />
        <PaltMatrixSection />
      </div>
    </div>
  );
}

"use client";

/**
 * TateSpun Renderer PoC — Phase P0-A2
 *
 * Browser Visual QAで「――の2文字接続gapはNative CSSで改善したが、縦線
 * そのものが本文の文字列中心軸に対して完全に中央配置とは言えない」と
 * 判明したことを受けた、診断専用の追加コンポーネント。
 *
 * P0-Aと同じ禁止事項を維持する: translateX・margin offset・relative
 * left/right・scale・overlay(位置補正用)・connector・glyphごとの位置
 * 補正は一切行わない。ここでやるのは「measure」だけ。
 *
 * 2種類の指標を切り分ける:
 *
 *  1. BOX geometry（DOM実測）
 *     無装飾の<span>（position/transform/marginなし）でcolumn内の対象
 *     文字を包み、getBoundingClientRect()を親column要素のそれと比較する。
 *     spanでのwrapping自体はレイアウトを一切変えない（測定のための
 *     instrumentationであり、P0-Aで禁止した「1文字ずつspan化してtopを
 *     計算し配置する」こととは別物 — ここでは計算した値を*描画に使わない*）。
 *
 *  2. INK geometry（canvas実測）
 *     同じfont-family/font-sizeで CanvasRenderingContext2D.measureText()
 *     の actualBoundingBoxAscent/Descent/Left/Right を読む。――（U+2015等）
 *     は text-orientation: mixed によりCSS側で同一グリフが90°回転される
 *     "R"category文字（フォント側の縦書き代替グリフ差し替えではない、
 *     CSS Writing Modes仕様の既定動作）なので、回転前(横書き基準)の
 *     ascent/descent非対称性が、回転後のcolumn内左右オフセットにそのまま
 *     対応する。……はフォントの縦書き用OpenType代替グリフ(vertical
 *     alternates)に差し替わっている可能性があり、その場合canvas測定
 *     （常に横書きデフォルトグリフを測る）は実際の描画グリフと一致しない
 *     ため、参考値として扱い断定しない。
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

interface DiagLineSpec {
  id: string;
  label: string;
  prefix: string;
  before: string;
  runChars: [string, string];
  after: string;
  suffix: string;
}

const DIAG_LINES: DiagLineSpec[] = [
  {
    id: "dash-minimal",
    label: "文――字（最小構成）",
    prefix: "",
    before: "文",
    runChars: ["―", "―"],
    after: "字",
    suffix: "",
  },
  {
    id: "ellipsis-minimal",
    label: "文……字（最小構成）",
    prefix: "",
    before: "文",
    runChars: ["…", "…"],
    after: "字",
    suffix: "",
  },
  {
    id: "dash-corpus",
    label: "夕日の差す台所に――、長身の男は立っていた。（golden corpus実例）",
    prefix: "夕日の差す台所",
    before: "に",
    runChars: ["―", "―"],
    after: "、",
    suffix: "長身の男は立っていた。",
  },
  {
    id: "ellipsis-corpus",
    label: "だが男……花厳には髪の事など関係のないことだった。（golden corpus実例）",
    prefix: "だが",
    before: "男",
    runChars: ["…", "…"],
    after: "花",
    suffix: "厳には髪の事など関係のないことだった。",
  },
];

interface CharBoxResult {
  key: string;
  label: string;
  columnThicknessPx: number;
  boxOffsetPx: number;
  boxOffsetRatio: number;
}

interface InkResult {
  key: string;
  label: string;
  actualAscent: number;
  actualDescent: number;
  fontAscent: number;
  fontDescent: number;
  /**
   * グリフのink中心(baseline基準: (actualAscent - actualDescent)/2)が、
   * フォント自身のem-box中心(baseline基準: (fontAscent - fontDescent)/2)
   * からどれだけズレているか。CJKグリフはalphabetic baseline基準では
   * 誰でも大きくascent側に偏る(文字通り「descenderがない」ため)ので、
   * 生のascent-descent非対称性そのものは「普通の文字でも大きく非対称」
   * になり指標として使えない —— fontの基準(em-box)からの差分を取ることで
   * baseline位置の影響を打ち消し、「このグリフだけが自分のem-box内で
   * 偏っているか」を切り出す。text-orientation: mixedによる90°回転後は
   * このbaseline軸オフセットがそのままcolumn内の左右オフセットになる。
   */
  emCenterOffsetPx: number;
  emCenterOffsetRatio: number;
  actualLeft: number;
  actualRight: number;
  leftRightAsymmetryPx: number;
  leftRightAsymmetryRatio: number;
}

const FONT_SIZE_PT = 9;
// ブラウザ標準の pt -> px 変換 (96dpi基準、CSS Values仕様の固定係数)。
// PX_PER_MMのようなpreview専用縮尺はこのPoCでは使わない。
const FONT_SIZE_PX = (FONT_SIZE_PT * 96) / 72;

// BOX/INK 双方でこれ未満は「有意なオフセットなし」とみなす閾値。
// 科学的な閾値ではなく、既存FixedSlot方式が実測ベースで採用してきた
// 「安全マージン」的な運用値の踏襲(目視で気づかれるレベルかの目安)。
const BOX_OFFSET_NEGLIGIBLE_RATIO = 0.03;
const INK_ASYMMETRY_NEGLIGIBLE_RATIO = 0.03;

type DashVerdict = "BOX_CENTERED" | "GLYPH_OPTICAL_OFFSET" | "BOX_NOT_CENTERED" | "UNKNOWN";

function markStyle(role: string): CSSProperties {
  // 測定対象span可視化用のoutlineのみ。outlineはCSS仕様上ボックスモデルの
  // 外側にpaintされるだけで、要素自身の位置・サイズ・周辺のlayoutには
  // 一切影響しない（=「補正」ではなく「印」）。
  if (role === "run") return { outline: "1px solid rgba(220,0,0,0.7)" };
  if (role === "run-char") return { outline: "1px dashed rgba(220,0,0,0.45)" };
  return { outline: "1px solid rgba(0,120,255,0.6)" };
}

export default function DashDiagnostics({ fontFamily }: { fontFamily: string }) {
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const charRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [boxResults, setBoxResults] = useState<CharBoxResult[] | null>(null);
  const [inkResults, setInkResults] = useState<InkResult[] | null>(null);
  const [inkUnsupported, setInkUnsupported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof document === "undefined") return;
      // Shippori Minchoの読み込み完了前に測るとfallback書体の寸法を
      // 拾ってしまうため、exportCapture.tsと同じ流儀でfonts.readyを待つ。
      await document.fonts.ready;
      if (cancelled) return;

      // --- 1. BOX geometry (DOM実測) ---
      const boxes: CharBoxResult[] = [];
      for (const spec of DIAG_LINES) {
        const columnEl = columnRefs.current.get(spec.id);
        if (!columnEl) continue;
        const columnRect = columnEl.getBoundingClientRect();
        const columnCenterX = columnRect.left + columnRect.width / 2;

        const targets: { key: string; label: string }[] = [
          { key: `${spec.id}-before`, label: `[${spec.id}] 直前「${spec.before}」` },
          { key: `${spec.id}-run`, label: `[${spec.id}] run全体「${spec.runChars.join("")}」` },
          { key: `${spec.id}-run0`, label: `[${spec.id}] run 1文字目「${spec.runChars[0]}」` },
          { key: `${spec.id}-run1`, label: `[${spec.id}] run 2文字目「${spec.runChars[1]}」` },
          { key: `${spec.id}-after`, label: `[${spec.id}] 直後「${spec.after}」` },
        ];

        for (const t of targets) {
          const el = charRefs.current.get(t.key);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const charCenterX = r.left + r.width / 2;
          const boxOffsetPx = charCenterX - columnCenterX;
          boxes.push({
            key: t.key,
            label: t.label,
            columnThicknessPx: columnRect.width,
            boxOffsetPx,
            boxOffsetRatio: columnRect.width > 0 ? boxOffsetPx / columnRect.width : 0,
          });
        }
      }

      // --- 2. INK geometry (canvas実測) ---
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const inks: InkResult[] = [];
      let supported = false;

      if (ctx) {
        ctx.font = `${FONT_SIZE_PT}pt ${fontFamily}`;
        ctx.textBaseline = "alphabetic";

        const measuredChars = new Map<string, string>();
        for (const spec of DIAG_LINES) {
          measuredChars.set(`${spec.id}-before`, spec.before);
          measuredChars.set(`${spec.id}-run0`, spec.runChars[0]);
          measuredChars.set(`${spec.id}-run1`, spec.runChars[1]);
          measuredChars.set(`${spec.id}-after`, spec.after);
        }

        for (const [key, ch] of measuredChars) {
          const m = ctx.measureText(ch);
          if (typeof m.actualBoundingBoxAscent !== "number") continue;
          supported = true;
          const actualAscent = m.actualBoundingBoxAscent;
          const actualDescent = m.actualBoundingBoxDescent;
          // fontBoundingBox*が未対応の環境ではem-box基準の比較ができない
          // (=このグリフは測定対象から除外。他グリフの結果には影響しない)。
          const fontAscent = m.fontBoundingBoxAscent;
          const fontDescent = m.fontBoundingBoxDescent;
          if (typeof fontAscent !== "number" || typeof fontDescent !== "number") continue;
          const actualLeft = m.actualBoundingBoxLeft ?? 0;
          const actualRight = m.actualBoundingBoxRight ?? 0;
          // グリフ自身のink中心とfontのem-box中心の差(baseline基準の座標を
          // そのまま引き算するのでbaseline位置そのものは相殺される)。
          const inkCenterFromBaseline = (actualAscent - actualDescent) / 2;
          const emCenterFromBaseline = (fontAscent - fontDescent) / 2;
          const emCenterOffsetPx = inkCenterFromBaseline - emCenterFromBaseline;
          inks.push({
            key,
            label: ch,
            actualAscent,
            actualDescent,
            fontAscent,
            fontDescent,
            emCenterOffsetPx,
            emCenterOffsetRatio: emCenterOffsetPx / FONT_SIZE_PX,
            actualLeft,
            actualRight,
            leftRightAsymmetryPx: actualRight - actualLeft,
            leftRightAsymmetryRatio: (actualRight - actualLeft) / FONT_SIZE_PX,
          });
        }
      }

      if (cancelled) return;
      setBoxResults(boxes);
      setInkResults(inks);
      setInkUnsupported(!supported);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fontFamily]);

  const registerColumn = (id: string) => (el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(id, el);
  };
  const registerChar = (key: string) => (el: HTMLSpanElement | null) => {
    if (el) charRefs.current.set(key, el);
  };

  // ―(U+2015)自体のBOX/INK判定を導出する（section 13のREPORTへ転記する値）。
  //
  // BOXは素のoffsetそのものではなく、同じ行内の直前/直後の通常文字との
  // 差分(differential)で見る —— 実測の結果、column全体に一様にかかる
  // 小さなoffset(P0-A2 concern参照。frame/columnのshrink-to-fit計算に
  // 由来すると見られ、dash特有ではない)が存在することが分かったため、
  // 「dashのbox中心が、同じ行の他文字と比べて特別にズレているか」を
  // 見なければdash固有の問題を切り分けられない。
  const lineBoxDelta = (lineId: string): number | null => {
    if (!boxResults) return null;
    const run = boxResults.find((r) => r.key === `${lineId}-run`);
    const before = boxResults.find((r) => r.key === `${lineId}-before`);
    const after = boxResults.find((r) => r.key === `${lineId}-after`);
    if (!run || !before || !after) return null;
    return run.boxOffsetRatio - (before.boxOffsetRatio + after.boxOffsetRatio) / 2;
  };
  const dashBoxDeltas = ["dash-minimal", "dash-corpus"]
    .map(lineBoxDelta)
    .filter((v): v is number => v !== null);
  const dashInkRows =
    inkResults?.filter((r) => r.key === "dash-minimal-run0" || r.key === "dash-corpus-run0") ?? [];
  const dashRunBox = boxResults?.find((r) => r.key === "dash-minimal-run" || r.key === "dash-corpus-run");
  const dashCharInk = dashInkRows[0];

  let dashVerdict: DashVerdict = "UNKNOWN";
  if (boxResults && inkResults) {
    if (dashBoxDeltas.length === 0 || dashInkRows.length === 0) {
      dashVerdict = "UNKNOWN";
    } else {
      const boxCentered = dashBoxDeltas.every((d) => Math.abs(d) < BOX_OFFSET_NEGLIGIBLE_RATIO);
      const inkAsymmetric = dashInkRows.some(
        (r) => Math.abs(r.emCenterOffsetRatio) >= INK_ASYMMETRY_NEGLIGIBLE_RATIO
      );
      if (boxCentered && inkAsymmetric) {
        dashVerdict = "GLYPH_OPTICAL_OFFSET";
      } else if (boxCentered && !inkAsymmetric) {
        dashVerdict = "BOX_CENTERED";
      } else {
        dashVerdict = "BOX_NOT_CENTERED";
      }
    }
  }

  return (
    <section className="poc-diag-section">
      <h2>P0-A2 診断: ――／…… の中心軸オフセット切り分け</h2>
      <p className="poc-note">
        実装による位置補正（translateX / margin offset / relative left・right /
        scale / overlay / connector / glyphごとの位置補正）は一切行っていません。
        以下はnative CSS（text-orientation: mixed）がそのまま描画した結果を、
        DOM box座標とcanvas ink座標の2種類で「測定」しているだけです。
      </p>

      <div className="poc-diag-lines">
        {DIAG_LINES.map((spec) => (
          <div key={spec.id} className="poc-page-wrap">
            <div className="poc-diag-frame">
              <div ref={registerColumn(spec.id)} className="poc-diag-column poc-vertical-text">
                {spec.prefix}
                <span
                  ref={registerChar(`${spec.id}-before`)}
                  className="poc-diag-mark"
                  style={markStyle("before")}
                >
                  {spec.before}
                </span>
                <span
                  ref={registerChar(`${spec.id}-run`)}
                  className="poc-diag-mark"
                  style={markStyle("run")}
                >
                  <span
                    ref={registerChar(`${spec.id}-run0`)}
                    className="poc-diag-mark"
                    style={markStyle("run-char")}
                  >
                    {spec.runChars[0]}
                  </span>
                  <span
                    ref={registerChar(`${spec.id}-run1`)}
                    className="poc-diag-mark"
                    style={markStyle("run-char")}
                  >
                    {spec.runChars[1]}
                  </span>
                </span>
                <span
                  ref={registerChar(`${spec.id}-after`)}
                  className="poc-diag-mark"
                  style={markStyle("after")}
                >
                  {spec.after}
                </span>
                {spec.suffix}
              </div>
            </div>
            <div className="poc-diag-caption">{spec.label}</div>
          </div>
        ))}
      </div>

      <div className="poc-diag-table-wrap">
        <table className="poc-diag-table">
          <caption>
            1. BOX geometry（DOM実測: 文字spanの中心 − column中心。単位px、比率はcolumn厚みに対する割合）
          </caption>
          <thead>
            <tr>
              <th>measured</th>
              <th>column厚みpx</th>
              <th>box中心オフセットpx</th>
              <th>比率</th>
            </tr>
          </thead>
          <tbody>
            {boxResults === null && (
              <tr>
                <td colSpan={4}>measuring…</td>
              </tr>
            )}
            {boxResults?.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.columnThicknessPx.toFixed(2)}</td>
                <td>{r.boxOffsetPx.toFixed(2)}</td>
                <td>{(r.boxOffsetRatio * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poc-diag-table-wrap">
        <table className="poc-diag-table">
          <caption>
            2. INK geometry（canvas実測、回転前の横書きグリフ基準。emCenterOffset =
            グリフinkの中心 − フォント自身のem-box中心（baseline位置の影響を相殺済み）。
            text-orientation: mixedによる90°回転後、このoffsetがcolumn内の左右オフセットに対応。
            ……は縦書き用OpenType代替グリフに差し替わっている可能性があり参考値・断定不可）
          </caption>
          <thead>
            <tr>
              <th>char (key)</th>
              <th>ink ascent</th>
              <th>ink descent</th>
              <th>font ascent</th>
              <th>font descent</th>
              <th>emCenterOffset px</th>
              <th>emCenterOffset比率</th>
              <th>left</th>
              <th>right</th>
              <th>左右非対称比率</th>
            </tr>
          </thead>
          <tbody>
            {inkResults === null && (
              <tr>
                <td colSpan={10}>measuring…</td>
              </tr>
            )}
            {inkResults?.map((r) => (
              <tr key={r.key}>
                <td>
                  {r.label} ({r.key})
                </td>
                <td>{r.actualAscent.toFixed(2)}</td>
                <td>{r.actualDescent.toFixed(2)}</td>
                <td>{r.fontAscent.toFixed(2)}</td>
                <td>{r.fontDescent.toFixed(2)}</td>
                <td>{r.emCenterOffsetPx.toFixed(2)}</td>
                <td>{(r.emCenterOffsetRatio * 100).toFixed(1)}%</td>
                <td>{r.actualLeft.toFixed(2)}</td>
                <td>{r.actualRight.toFixed(2)}</td>
                <td>{(r.leftRightAsymmetryRatio * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inkUnsupported && (
        <div className="poc-diag-verdict">
          この環境では CanvasRenderingContext2D.measureText() の
          actualBoundingBox* 拡張プロパティが利用できません。INK geometryの
          判定はUNKNOWNとして扱ってください。
        </div>
      )}

      <div className="poc-diag-verdict">
        DASH CENTER (自動判定・閾値{(BOX_OFFSET_NEGLIGIBLE_RATIO * 100).toFixed(0)}
        %/{(INK_ASYMMETRY_NEGLIGIBLE_RATIO * 100).toFixed(0)}%ベースの機械的分類。 最終判断は目視と併用すること):{" "}
        <strong>{dashVerdict}</strong>
        {dashBoxDeltas.length > 0 && (
          <>
            {" "}
            / run vs 隣接文字 box offset差分: {dashBoxDeltas.map((d) => `${(d * 100).toFixed(1)}%`).join(", ")}
          </>
        )}
        {dashRunBox && (
          <>
            {" "}
            / run box offset ratio(素の値): {(dashRunBox.boxOffsetRatio * 100).toFixed(1)}%
          </>
        )}
        {dashCharInk && (
          <>
            {" "}
            / ―(U+2015) emCenterOffset比率: {(dashCharInk.emCenterOffsetRatio * 100).toFixed(1)}%
          </>
        )}
      </div>
    </section>
  );
}

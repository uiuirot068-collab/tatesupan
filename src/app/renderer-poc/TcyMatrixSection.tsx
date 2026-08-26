"use client";

/**
 * TateSpun Renderer PoC — Phase P1-V3B: TCY Typography Method Matrix
 *
 * P1-V3A（READ-ONLY調査）で挙げた標準CSS候補のうち、glyph固有補正を伴わない
 * 2つ（tabular-nums / full-width）を、素の`text-combine-upright: all`と
 * 並べて視覚比較するためのdiagnostic。Font(Noto Serif JP)・9pt・
 * line-height 1.7・writing-mode/text-orientationは3列とも完全に固定 ——
 * 変えているのはTCY数字のCSS設定だけ。
 *
 * 禁止事項の再確認: translate/margin offset/scale/glyph-specific
 * adjustment/12専用・25専用処理は一切なし。gridは既存Font Matrixと同じ
 * 間隔定義の観察専用overlay(layoutには不使用)。
 */
const METHODS = [
  {
    label: "A. BASELINE",
    sublabel: "text-combine-upright: all",
    className: "poc-tcymatrix-tcy-baseline",
  },
  {
    label: "B. TABULAR",
    sublabel: "text-combine-upright: all\n+ font-variant-numeric: tabular-nums",
    className: "poc-tcymatrix-tcy-tabular",
  },
  {
    label: "C. FULL-WIDTH",
    sublabel: "text-combine-upright: all\n+ font-variant-east-asian: full-width",
    className: "poc-tcymatrix-tcy-fullwidth",
  },
] as const;

const FIXTURE_PAIRS = ["11", "12", "25", "88", "00", "99"];

function TestLine({ pair, tcyClassName }: { pair: string; tcyClassName: string }) {
  return (
    <p>
      文<span className={tcyClassName}>{pair}</span>文
    </p>
  );
}

export default function TcyMatrixSection() {
  return (
    <section className="poc-diag-section">
      <h2>P1-V3B 診断: TCY Typography Method Matrix</h2>
      <p className="poc-note">
        Font(Noto Serif JP)・9pt・line-height 1.7・writing-mode: vertical-rl・text-orientation: mixed
        は3列とも完全固定。変えているのはTCY数字のCSS設定（tabular-nums / full-width）だけです。
        glyph固有の補正・12専用/25専用処理・translate/scale等は一切行っていません。gridは観察専用overlayです。
        勝者判定はまだ行いません（Browser Visual QA待ち）。
      </p>
      <div className="poc-tcymatrix-row">
        {METHODS.map((method) => (
          <div key={method.label} className="poc-tcymatrix-col">
            <div className="poc-tcymatrix-label">{method.label}</div>
            <div className="poc-tcymatrix-sublabel">{method.sublabel}</div>
            <div className="poc-tcymatrix-page">
              {FIXTURE_PAIRS.map((pair) => (
                <TestLine key={pair} pair={pair} tcyClassName={method.className} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

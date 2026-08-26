"use client";

/**
 * TateSpun Renderer PoC — Phase P1-V3C: TCY ASCII vs Literal Fullwidth Matrix
 *
 * TCYへ渡す文字そのもの(半角ASCII digitか、Unicode全角数字リテラルか)だけを
 * 比較するdiagnostic。source原稿・tokenizer・normalizationには一切手を
 * 入れない —— これはあくまで表示用fixtureの文字列選択の比較であり、
 * production側のTCY判定(TCY_PATTERN)やsource正規化ロジックへの実装では
 * ない。Font(Noto Serif JP)・9pt・line-height 1.7・writing-mode:
 * vertical-rl・text-orientation: mixed・text-combine-upright: allは
 * 2列とも完全に固定。
 *
 * 禁止事項の再確認: translate/offset/scale/pair-specific correction/
 * 12・25専用処理は一切なし。gridは既存Font/TCY Matrixと同じ間隔定義の
 * 観察専用overlay(layoutには不使用)。
 */
const ASCII_PAIRS = ["11", "12", "25", "88", "00", "99"];
// Unicode fullwidth digit literals (U+FF10-FF19) — 見た目の比較用に直接
// 文字として保持するだけで、ASCII→fullwidth変換ロジックはどこにも無い。
const FULLWIDTH_PAIRS = ["１１", "１２", "２５", "８８", "００", "９９"];

function TestLine({ pair }: { pair: string }) {
  return (
    <p>
      文<span className="poc-tcyfw-tcy">{pair}</span>文
    </p>
  );
}

export default function TcyAsciiFullwidthSection() {
  return (
    <section className="poc-diag-section">
      <h2>P1-V3C 診断: TCY ASCII vs Literal Fullwidth Matrix</h2>
      <p className="poc-note">
        Font(Noto Serif JP)・9pt・line-height 1.7・writing-mode: vertical-rl・text-orientation: mixed・
        text-combine-upright: allは2列とも完全固定。変えているのはTCYへ渡す文字そのもの（半角ASCII数字 /
        Unicode全角数字リテラル）だけです。source原稿・tokenizer・normalizationへの実装は行っていません。
        glyph固有の補正・pair専用処理・translate/scale等も一切ありません。gridは観察専用overlayです。
        勝者判定はまだ行いません（Browser Visual QA待ち）。
      </p>
      <div className="poc-tcyfw-row">
        <div className="poc-tcyfw-col">
          <div className="poc-tcyfw-label">A. ASCII TCY</div>
          <div className="poc-tcyfw-sublabel">{"11 12 25 88 00 99\n+ text-combine-upright: all"}</div>
          <div className="poc-tcyfw-page">
            {ASCII_PAIRS.map((pair) => (
              <TestLine key={pair} pair={pair} />
            ))}
          </div>
        </div>
        <div className="poc-tcyfw-col">
          <div className="poc-tcyfw-label">B. LITERAL FULLWIDTH TCY</div>
          <div className="poc-tcyfw-sublabel">{"１１ １２ ２５ ８８ ００ ９９\n+ text-combine-upright: all"}</div>
          <div className="poc-tcyfw-page">
            {FULLWIDTH_PAIRS.map((pair) => (
              <TestLine key={pair} pair={pair} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

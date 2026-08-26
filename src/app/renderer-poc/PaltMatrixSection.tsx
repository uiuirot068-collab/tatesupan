"use client";

/**
 * TateSpun Renderer PoC — Phase P1-V4B: palt A/B Typography Matrix
 *
 * P1-V4（READ-ONLY調査）で「tategaki.jpの縦書き領域にのみ
 * font-feature-settings: "palt" 0 が明示されており、TateSpun側には
 * 存在しない」ことが確認された。この1点だけを切り分けて比較する
 * diagnostic。Font(Noto Serif JP)・9pt・line-height 1.7・
 * writing-mode: vertical-rl・text-orientation: mixed・letter-spacing
 * (既定値)は2列とも完全に固定 —— 変えているのは
 * font-feature-settings の値（normal / "palt" 0）だけ。
 *
 * 禁止事項の再確認: vpal/vhal/vert/vrt2の追加、translate/offset/scale、
 * overlay追加、connector、dash専用補正、ellipsis専用補正、font変更、
 * production codeへの実装は一切なし。gridは既存Font/TCY Matrixと同じ
 * 間隔定義の観察専用overlay(layoutには不使用)。
 */
const VARIANTS = [
  {
    label: "A. BASELINE",
    sublabel: 'font-feature-settings: normal',
    className: "poc-paltmatrix-baseline",
  },
  {
    label: "B. PALT OFF",
    sublabel: 'font-feature-settings: "palt" 0',
    className: "poc-paltmatrix-palt-off",
  },
] as const;

const FIXTURE_LINES = ["文……文", "文――文", "だが男……花厳には――そう言った。"];

export default function PaltMatrixSection() {
  return (
    <section className="poc-diag-section">
      <h2>P1-V4B 診断: palt A/B Typography Matrix</h2>
      <p className="poc-note">
        Font(Noto Serif JP)・9pt・line-height 1.7・writing-mode: vertical-rl・text-orientation: mixed・
        letter-spacing(既定値)は2列とも完全固定。変えているのは font-feature-settings の値
        （normal / &quot;palt&quot; 0）だけです。vpal/vhal/vert/vrt2の追加、glyph固有の補正、
        dash専用/ellipsis専用処理、translate/scale等は一切行っていません。gridは観察専用overlayです。
        勝者判定はまだ行いません（Browser Visual QA待ち）。
      </p>
      <div className="poc-paltmatrix-row">
        {VARIANTS.map((variant) => (
          <div key={variant.label} className="poc-paltmatrix-col">
            <div className="poc-paltmatrix-label">{variant.label}</div>
            <div className="poc-paltmatrix-sublabel">{variant.sublabel}</div>
            <div className={`poc-paltmatrix-page ${variant.className}`}>
              {FIXTURE_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

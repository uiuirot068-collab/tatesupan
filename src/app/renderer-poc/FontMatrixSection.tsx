"use client";

/**
 * TateSpun Renderer PoC — Phase P1-V2: Typography Font Matrix
 *
 * glyph固有の補正を入れる前に、フォント差だけでdash/ellipsis/TCYの見た目
 * 問題が解決するかを比較するためのdiagnostic。フォント以外の条件
 * (9pt/line-height 1.7/vertical-rl/mixed/text-combine-upright)は固定。
 * 3フォントとも既存layout.tsxでGoogle Fonts読み込み済み、新規font追加なし。
 * 補正(translate/margin offset/scale/glyph-specific correction等)は
 * 一切行わない — グリッドはP1のp1-diag-gridと同じ間隔の観察専用overlay。
 */
const FONTS = [
  { label: "Noto Serif JP", fontFamily: '"Noto Serif JP", serif' },
  { label: "Shippori Mincho", fontFamily: '"Shippori Mincho", serif' },
  { label: "Zen Old Mincho", fontFamily: '"Zen Old Mincho", serif' },
] as const;

const TEST_LINES = ["文25文", "文12文", "文……文", "文――文"];

function TestLine({ line }: { line: string }) {
  const parts = line.split(/(\d{2}|――|……)/).filter(Boolean);
  return (
    <p>
      {parts.map((part, i) =>
        /^\d{2}$/.test(part) ? (
          <span key={i} className="poc-fontmatrix-tcy">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

export default function FontMatrixSection() {
  return (
    <section className="poc-diag-section">
      <h2>P1-V2 診断: Typography Font Matrix</h2>
      <p className="poc-note">
        フォント以外の条件（9pt / line-height 1.7 / writing-mode: vertical-rl / text-orientation: mixed /
        text-combine-upright / letter-spacing / font features）はすべて同一。補正は一切行っていません
        —— gridは観察専用overlayです。Browser Visual QA待ち（数値判定なし）。
      </p>
      <div className="poc-fontmatrix-row">
        {FONTS.map((font) => (
          <div key={font.label} className="poc-fontmatrix-col">
            <div className="poc-fontmatrix-label">{font.label}</div>
            <div className="poc-fontmatrix-page" style={{ fontFamily: font.fontFamily }}>
              {TEST_LINES.map((line) => (
                <TestLine key={line} line={line} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

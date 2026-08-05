import {
  PAPER_SIZES,
  type PageLayout,
  type PageSettings,
  type PaperSizeKey,
} from "@/lib/pageLayout";

interface PageSettingsPanelProps {
  settings: PageSettings;
  layout: PageLayout;
  onChange: (next: PageSettings) => void;
}

export default function PageSettingsPanel({
  settings,
  layout,
  onChange,
}: PageSettingsPanelProps) {
  const update = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <details className="border-b border-ink/10" open>
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5">
        ページ設定（用紙・余白・文字組み）
      </summary>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-4">
          <span className="text-xs text-ink/60">用紙サイズ</span>
          <select
            value={settings.paperSize}
            onChange={(e) => update("paperSize", e.target.value as PaperSizeKey)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            {Object.entries(PAPER_SIZES).map(([key, size]) => (
              <option key={key} value={key}>
                {size.label}（{size.widthMm}×{size.heightMm}mm）
              </option>
            ))}
          </select>
        </label>

        <MarginField
          label="天（上）"
          value={settings.marginTop}
          onChange={(v) => update("marginTop", v)}
        />
        <MarginField
          label="地（下）"
          value={settings.marginBottom}
          onChange={(v) => update("marginBottom", v)}
        />
        <MarginField
          label="ノド（閉じ側）"
          value={settings.marginGutter}
          onChange={(v) => update("marginGutter", v)}
        />
        <MarginField
          label="小口（外側）"
          value={settings.marginOuter}
          onChange={(v) => update("marginOuter", v)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">
            フォントサイズ（pt）
          </span>
          <input
            type="number"
            min={4}
            max={36}
            step={0.5}
            value={settings.fontSizePt}
            onChange={(e) => update("fontSizePt", Number(e.target.value))}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">行間倍率</span>
          <input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.lineHeightRatio}
            onChange={(e) => update("lineHeightRatio", Number(e.target.value))}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-ink/10 bg-ink/5 px-4 py-3 text-center">
        <LayoutStat label="1行の文字数" value={`${layout.charsPerLine} 字`} />
        <LayoutStat label="1ページの行数" value={`${layout.linesPerPage} 行`} />
        <LayoutStat label="1ページの文字数" value={`${layout.charsPerPage} 字`} />
      </dl>
    </details>
  );
}

function MarginField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink/60">{label} mm</span>
      <input
        type="number"
        min={0}
        max={60}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
      />
    </label>
  );
}

function LayoutStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-semibold text-paper-ink">
        {value}
      </span>
      <span className="text-[11px] text-ink/60">{label}</span>
    </div>
  );
}

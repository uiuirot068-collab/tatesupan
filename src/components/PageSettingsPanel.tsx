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
    <details className="border-b border-zinc-200 dark:border-zinc-800" open>
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50">
        ページ設定（用紙・余白・文字組み）
      </summary>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-4">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">用紙サイズ</span>
          <select
            value={settings.paperSize}
            onChange={(e) => update("paperSize", e.target.value as PaperSizeKey)}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            フォントサイズ（pt）
          </span>
          <input
            type="number"
            min={4}
            max={36}
            step={0.5}
            value={settings.fontSizePt}
            onChange={(e) => update("fontSizePt", Number(e.target.value))}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">行間倍率</span>
          <input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.lineHeightRatio}
            onChange={(e) => update("lineHeightRatio", Number(e.target.value))}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-800 dark:bg-zinc-800/40">
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
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label} mm</span>
      <input
        type="number"
        min={0}
        max={60}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
    </label>
  );
}

function LayoutStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
        {value}
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

import {
  PAPER_SIZES,
  type ColumnCount,
  type HashiraPosition,
  type MasterPageSettings,
  type NombrePosition,
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

  const updateMasterPage = <K extends keyof MasterPageSettings>(
    key: K,
    value: MasterPageSettings[K]
  ) => {
    onChange({
      ...settings,
      masterPage: { ...settings.masterPage, [key]: value },
    });
  };

  return (
    <>
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

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">段数</span>
          <select
            value={settings.columnCount}
            onChange={(e) =>
              update("columnCount", Number(e.target.value) as ColumnCount)
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value={1}>1段</option>
            <option value={2}>2段</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">段間 mm</span>
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={settings.columnGapMm}
            disabled={settings.columnCount === 1}
            onChange={(e) => update("columnGapMm", Number(e.target.value))}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink disabled:opacity-40"
          />
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-2 border-t border-ink/10 bg-ink/5 px-4 py-3 text-center sm:grid-cols-4">
        <LayoutStat label="1行の文字数" value={`${layout.charsPerLine} 字`} />
        <LayoutStat label="1段の行数" value={`${layout.linesPerColumn} 行`} />
        <LayoutStat label="1段の文字数" value={`${layout.charsPerColumn} 字`} />
        <LayoutStat label="1ページの文字数" value={`${layout.charsPerPage} 字`} />
      </dl>
    </details>

    <details className="border-b border-ink/10">
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5">
        マスターページ（ノンブル・柱）
      </summary>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">ノンブル表示位置</span>
          <select
            value={settings.masterPage.nombrePosition}
            onChange={(e) =>
              updateMasterPage("nombrePosition", e.target.value as NombrePosition)
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value="center">中央</option>
            <option value="outer">小口側（左右交互）</option>
            <option value="hidden">非表示</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">開始ページ番号</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.masterPage.nombreStart}
            onChange={(e) =>
              updateMasterPage("nombreStart", Number(e.target.value))
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:self-end sm:pb-1.5">
          <input
            type="checkbox"
            checked={settings.masterPage.hideNombreOnFirstPage}
            onChange={(e) =>
              updateMasterPage("hideNombreOnFirstPage", e.target.checked)
            }
            className="h-4 w-4 rounded border-ink/30"
          />
          <span className="text-xs text-ink/60">
            隠しノンブル（表紙・扉など先頭ページを非表示）
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">奇数ページ柱</span>
          <input
            type="text"
            placeholder="例: 作品名"
            value={settings.masterPage.hashiraOdd}
            onChange={(e) => updateMasterPage("hashiraOdd", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">偶数ページ柱</span>
          <input
            type="text"
            placeholder="例: 章名"
            value={settings.masterPage.hashiraEven}
            onChange={(e) => updateMasterPage("hashiraEven", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">柱表示位置</span>
          <select
            value={settings.masterPage.hashiraPosition}
            onChange={(e) =>
              updateMasterPage("hashiraPosition", e.target.value as HashiraPosition)
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value="top">天側（上部）</option>
            <option value="bottom">地側（下部）</option>
          </select>
        </label>
      </div>
    </details>
    </>
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

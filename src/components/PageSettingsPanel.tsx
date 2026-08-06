"use client";

import { useState } from "react";
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
  plotNote: string;
  onPlotNoteChange: (plotNote: string) => void;
  onOpenHelp: () => void;
}

type SettingsTab = "page" | "master" | "plot";

interface SettingsPreset {
  label: string;
  apply: (settings: PageSettings) => PageSettings;
}

const SETTINGS_PRESETS: SettingsPreset[] = [
  {
    label: "文庫本風 (A6)",
    apply: (settings) => ({
      ...settings,
      paperSize: "a6",
      fontFamily: "'Shippori Mincho', serif",
      fontSizePt: 13,
      lineHeightRatio: 1.7,
    }),
  },
  {
    label: "同人誌・一般的な小説風 (A5)",
    apply: (settings) => ({
      ...settings,
      paperSize: "a5",
      fontFamily: "'Shippori Mincho', serif",
      fontSizePt: 14,
      lineHeightRatio: 1.8,
    }),
  },
  {
    label: "Web閲覧最適化",
    apply: (settings) => ({
      ...settings,
      paperSize: "b6",
      fontSizePt: 15,
      lineHeightRatio: 1.9,
    }),
  },
];

export default function PageSettingsPanel({
  settings,
  layout,
  onChange,
  plotNote,
  onPlotNoteChange,
  onOpenHelp,
}: PageSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab | null>("page");
  const [plotMode, setPlotMode] = useState<"edit" | "preview">("edit");

  const toggleTab = (tab: SettingsTab) => {
    setActiveTab((current) => (current === tab ? null : tab));
  };

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
    <div className="border-b border-ink/10">
      <div className="grid grid-cols-4">
        <button
          type="button"
          onClick={() => toggleTab("page")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "page"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "page" ? "▼" : "▶"} ページ設定
        </button>
        <button
          type="button"
          onClick={() => toggleTab("master")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "master"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "master" ? "▼" : "▶"} ノンブル・柱
        </button>
        <button
          type="button"
          onClick={() => toggleTab("plot")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "plot"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "plot" ? "▼" : "▶"} メモ
        </button>
        <button
          type="button"
          onClick={onOpenHelp}
          className="px-3 py-2 text-ink/60 hover:bg-ink/5 rounded font-bold"
          title="使い方ガイド"
        >
          ？
        </button>
      </div>

      {activeTab === "page" && (
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3">
            <span className="text-xs text-ink/60">プリセット適用:</span>
            {SETTINGS_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.apply(settings))}
                className="cursor-pointer select-none rounded-full border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 transition-colors hover:border-accent hover:bg-accent/10 hover:text-ink"
              >
                {preset.label}
              </button>
            ))}
          </div>
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
          <span className="text-xs text-ink/60">フォント</span>
          <select
            value={settings.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value="'Shippori Mincho', serif">しっぽり明朝</option>
            <option value="'Zen Old Mincho', serif">Zenオールド明朝</option>
            <option value="'Noto Serif JP', serif">Noto Serif 明朝</option>
            <option value="'Noto Sans JP', sans-serif">Noto Sans ゴシック</option>
            <option value="serif">システム標準明朝</option>
          </select>
        </label>

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
        </div>
      )}

      {activeTab === "master" && (
        <div className="w-full">
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
            <option value="gutter">ノド（綴じ側）</option>
            <option value="outer">小口（外側）</option>
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

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60 whitespace-nowrap">ノンブル: 地からの距離 mm</span>
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={settings.masterPage.nombreBottomMargin}
            onChange={(e) =>
              updateMasterPage("nombreBottomMargin", Number(e.target.value))
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
            表紙・扉など先頭ページのノンブルを非表示
          </span>
        </label>

        <label className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:self-end sm:pb-1.5">
          <input
            type="checkbox"
            checked={settings.masterPage.showHiddenNombre}
            onChange={(e) =>
              updateMasterPage("showHiddenNombre", e.target.checked)
            }
            className="h-4 w-4 rounded border-ink/30"
          />
          <span className="text-xs text-ink/60">隠しノンブル</span>
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
        </div>
      )}

      {activeTab === "plot" && (
        <div className="w-full">
          <div className="flex items-center justify-end gap-1 px-4 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setPlotMode("edit")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                plotMode === "edit"
                  ? "bg-accent text-paper-ink"
                  : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => setPlotMode("preview")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                plotMode === "preview"
                  ? "bg-accent text-paper-ink"
                  : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              プレビュー
            </button>
          </div>

          <div className="px-4 pb-4">
            {plotMode === "edit" ? (
              <textarea
                value={plotNote}
                onChange={(e) => onPlotNoteChange(e.target.value)}
                placeholder="プロットや設定メモを入力してください&#10;&#10;# 見出し&#10;**太字** や *強調* 、- 箇条書きが使えます"
                spellCheck={false}
                className="h-64 w-full resize-y rounded border border-ink/20 bg-base p-2 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
              />
            ) : (
              <div className="h-64 overflow-y-auto rounded border border-ink/20 bg-base p-3">
                {plotNote.trim() === "" ? (
                  <p className="text-sm text-ink/40">メモはまだありません</p>
                ) : (
                  <MarkdownPreview text={plotNote} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*.+?\*\*|\*.+?\*)/g;
  let lastIndex = 0;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-${count++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-${count++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={key} className="list-disc space-y-1 pl-5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-ink">
              {renderInline(item, `${key}-li-${idx}`)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const listMatch = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const inline = renderInline(heading[2], `h-${idx}`);
      if (level === 1) {
        blocks.push(
          <h1 key={idx} className="mb-1 mt-3 text-lg font-bold text-ink first:mt-0">
            {inline}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={idx} className="mb-1 mt-3 text-base font-bold text-ink first:mt-0">
            {inline}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={idx} className="mb-1 mt-2 text-sm font-bold text-ink first:mt-0">
            {inline}
          </h3>
        );
      }
    } else if (listMatch) {
      listItems.push(listMatch[1]);
    } else if (line.trim() === "") {
      flushList(`list-${idx}`);
      blocks.push(<div key={idx} className="h-2" />);
    } else {
      flushList(`list-${idx}`);
      blocks.push(
        <p key={idx} className="text-sm leading-relaxed text-ink">
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flushList("list-end");

  return <div className="space-y-0.5">{blocks}</div>;
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

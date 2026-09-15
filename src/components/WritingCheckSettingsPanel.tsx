"use client";

import { useState } from "react";
import {
  ALL_TOGGLEABLE_RULE_IDS,
  DEFAULT_ENABLED_RULE_IDS,
  PRESET_DEFINITIONS,
  PRESET_LABELS,
  type WritingCheckDictionaryEntry,
  type WritingCheckNgWordEntry,
  type WritingCheckPresetId,
  type WritingRuleId,
} from "@/lib/writingCheckEngine";

// UI-only presentation labels -- the engine itself carries no UI copy
// beyond each diagnostic's own `message` (see writingCheckEngine/rules/*).
const RULE_LABELS: Record<WritingRuleId, string> = {
  "R1-bracket": "括弧の対応（「」『』（）［］【】）",
  "R2-punct": "句読点の重複／！？後の空白",
  "R9-ellipsis": "三点リーダーの形（… ・・・ ...）",
  "R10-dash": "ダッシュの形（― —）",
  "R3-tcy": "縦中横の記法（[tate]…[/tate]）",
  "R3-ruby": "ルビの記法（｜漢字《かんじ》）",
  "R6-trailing-whitespace": "行末の余分な空白",
  "R7-mixed-indent": "行頭のタブ・全角スペース混在",
  "R8-blank-run": "3行以上の連続する空行",
  "R4-halfwidth-kana": "半角カタカナ",
  "R5-control-char": "制御文字の混入",
  "R11-dictionary": "わたしの辞書（表記ゆれ）",
  "R12-ngword": "NGワード",
};

const CATEGORY_GROUPS: Array<{ label: string; ruleIds: WritingRuleId[] }> = [
  { label: "約物（punctuation）", ruleIds: ["R1-bracket", "R2-punct", "R9-ellipsis", "R10-dash"] },
  { label: "縦書き記法（notation）", ruleIds: ["R3-tcy", "R3-ruby"] },
  { label: "段落・空白（whitespace）", ruleIds: ["R6-trailing-whitespace", "R7-mixed-indent", "R8-blank-run"] },
  { label: "文字（character）", ruleIds: ["R4-halfwidth-kana", "R5-control-char"] },
  { label: "表記（dictionary）", ruleIds: ["R11-dictionary", "R12-ngword"] },
];

type SettingsTab = "preset" | "rules" | "dictionary" | "ngwords" | "help";

interface WritingCheckSettingsPanelProps {
  onClose: () => void;
  presetId: WritingCheckPresetId | null;
  ruleOverrides: Partial<Record<WritingRuleId, boolean>>;
  onSelectPreset: (id: WritingCheckPresetId) => void;
  onSetRuleEnabled: (ruleId: WritingRuleId, enabled: boolean) => void;
  dictionaryEntries: WritingCheckDictionaryEntry[];
  onAddDictionaryEntry: (preferred: string, variants: string[]) => void;
  onRemoveDictionaryEntry: (id: string) => void;
  ngWordEntries: WritingCheckNgWordEntry[];
  onAddNgWordEntry: (term: string, note?: string) => void;
  onRemoveNgWordEntry: (id: string) => void;
}

/**
 * 文章チェック設定 (Phase 3, 15/16/17). A modal, not an inline panel --
 * settings are configured occasionally, not while writing, and this keeps
 * the manuscript's own screen space untouched (matches the existing
 * SearchReplaceModal/BookPartsModal convention: `fixed inset-0` backdrop +
 * click-outside-to-close).
 *
 * All data here (preset, rule overrides, dictionary, NG words) is
 * browser-local only -- see each hook's own doc
 * (`src/hooks/useWritingCheck*.ts`) -- never transmitted anywhere.
 */
export default function WritingCheckSettingsPanel({
  onClose,
  presetId,
  ruleOverrides,
  onSelectPreset,
  onSetRuleEnabled,
  dictionaryEntries,
  onAddDictionaryEntry,
  onRemoveDictionaryEntry,
  ngWordEntries,
  onAddNgWordEntry,
  onRemoveNgWordEntry,
}: WritingCheckSettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>("preset");
  const [dictPreferred, setDictPreferred] = useState("");
  const [dictVariants, setDictVariants] = useState("");
  const [ngTerm, setNgTerm] = useState("");
  const [ngNote, setNgNote] = useState("");

  const isRuleEnabled = (ruleId: WritingRuleId) => ruleOverrides[ruleId] ?? DEFAULT_ENABLED_RULE_IDS[ruleId];

  const handleAddDictionaryEntry = () => {
    const variants = dictVariants.split(/[,、]/).map((v) => v.trim()).filter((v) => v.length > 0);
    if (!dictPreferred.trim() || variants.length === 0) return;
    onAddDictionaryEntry(dictPreferred, variants);
    setDictPreferred("");
    setDictVariants("");
  };

  const handleAddNgWordEntry = () => {
    if (!ngTerm.trim()) return;
    onAddNgWordEntry(ngTerm, ngNote || undefined);
    setNgTerm("");
    setNgNote("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-ink/10 bg-base shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">文章チェック設定</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-ink/50 hover:bg-ink/5">
            閉じる
          </button>
        </div>

        <div className="flex flex-none flex-wrap gap-1 border-b border-ink/10 px-3 py-2">
          {([
            ["preset", "プリセット"],
            ["rules", "ルール"],
            ["dictionary", "わたしの辞書"],
            ["ngwords", "NGワード"],
            ["help", "ヘルプ・プライバシー"],
          ] as Array<[SettingsTab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === id ? "bg-ink text-base" : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "preset" && (
            <div className="space-y-2">
              <p className="text-xs text-ink/60">プリセットは開始設定です。選択後も個別にルールをオン・オフできます。</p>
              {(Object.keys(PRESET_LABELS) as WritingCheckPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectPreset(id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    presetId === id ? "border-ink bg-ink/5 font-semibold text-ink" : "border-ink/15 text-ink/80 hover:bg-ink/5"
                  }`}
                >
                  {PRESET_LABELS[id]}
                </button>
              ))}
              {presetId === null && <p className="text-[11px] text-ink/50">現在はカスタム設定です（個別にルールを変更済み）。</p>}
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-4">
              {CATEGORY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[11px] font-semibold text-ink/50">{group.label}</p>
                  <div className="space-y-1">
                    {group.ruleIds.map((ruleId) => (
                      <label key={ruleId} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-ink/5">
                        <input
                          type="checkbox"
                          checked={isRuleEnabled(ruleId)}
                          onChange={(e) => onSetRuleEnabled(ruleId, e.target.checked)}
                          className="h-3.5 w-3.5 accent-ink"
                        />
                        <span className="text-ink/80">{RULE_LABELS[ruleId]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-ink/40">全 {ALL_TOGGLEABLE_RULE_IDS.length} 項目</p>
            </div>
          )}

          {tab === "dictionary" && (
            <div className="space-y-4">
              <p className="text-xs text-ink/60">表記ゆれの候補（例：サーバ → サーバー）を登録すると、本文中の該当箇所を確認候補として表示します。</p>
              <div className="space-y-2 rounded-lg border border-ink/15 p-3">
                <input
                  value={dictPreferred}
                  onChange={(e) => setDictPreferred(e.target.value)}
                  placeholder="推奨表記（例：サーバー）"
                  className="w-full rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink outline-none focus:border-ink/60"
                />
                <input
                  value={dictVariants}
                  onChange={(e) => setDictVariants(e.target.value)}
                  placeholder="表記ゆれ（カンマ区切り、例：サーバ, ｻｰﾊﾞｰ）"
                  className="w-full rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink outline-none focus:border-ink/60"
                />
                <button
                  type="button"
                  onClick={handleAddDictionaryEntry}
                  className="rounded bg-ink px-3 py-1.5 text-sm text-base hover:opacity-90"
                >
                  追加
                </button>
              </div>
              <ul className="space-y-1">
                {dictionaryEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink/5">
                    <span className="min-w-0 truncate text-ink/80">
                      {entry.variants.join("、")} → <strong>{entry.preferred}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveDictionaryEntry(entry.id)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs text-ink/50 hover:bg-ink/10"
                    >
                      削除
                    </button>
                  </li>
                ))}
                {dictionaryEntries.length === 0 && <li className="px-2 py-1.5 text-xs text-ink/40">まだ登録されていません</li>}
              </ul>
            </div>
          )}

          {tab === "ngwords" && (
            <div className="space-y-4">
              <p className="text-xs text-ink/60">NGワードを登録すると、本文中に含まれる箇所を確認候補として表示します（自動置換はしません）。</p>
              <div className="space-y-2 rounded-lg border border-ink/15 p-3">
                <input
                  value={ngTerm}
                  onChange={(e) => setNgTerm(e.target.value)}
                  placeholder="NGワード"
                  className="w-full rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink outline-none focus:border-ink/60"
                />
                <input
                  value={ngNote}
                  onChange={(e) => setNgNote(e.target.value)}
                  placeholder="メモ（任意）"
                  className="w-full rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink outline-none focus:border-ink/60"
                />
                <button
                  type="button"
                  onClick={handleAddNgWordEntry}
                  className="rounded bg-ink px-3 py-1.5 text-sm text-base hover:opacity-90"
                >
                  追加
                </button>
              </div>
              <ul className="space-y-1">
                {ngWordEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink/5">
                    <span className="min-w-0 truncate text-ink/80">
                      {entry.term}
                      {entry.note && <span className="text-ink/40">（{entry.note}）</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveNgWordEntry(entry.id)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs text-ink/50 hover:bg-ink/10"
                    >
                      削除
                    </button>
                  </li>
                ))}
                {ngWordEntries.length === 0 && <li className="px-2 py-1.5 text-xs text-ink/40">まだ登録されていません</li>}
              </ul>
            </div>
          )}

          {tab === "help" && (
            <div className="space-y-3 text-sm text-ink/80">
              <p>
                文章チェック βは、括弧の対応や句読点の重複、縦中横・ルビの記法崩れなど、機械的に見つけられる確認候補を編集画面にだけ表示する機能です。
              </p>
              <p>赤い波線は「事故確認（原稿事故・高確度）」、黄色い波線は「確認推奨」を表します。どちらも間違いの断定ではなく、確認の目安です。</p>
              <p>
                「直す」「安全な項目をまとめて直す」は、押した時にだけ本文を書き換えます。自動で書き換わることはありません。「元に戻す」で直前の操作を一度だけ取り消せます。
              </p>
              <p>「無視」はその確認候補を一時的に非表示にします（画面を再読み込みすると元に戻ります）。</p>
              <p className="font-semibold">わたしの辞書・NGワードについて</p>
              <p>
                登録した内容は、この端末のブラウザ内（localStorage）にのみ保存されます。サーバーへの送信や、外部のAI・APIへの送信は一切行いません。本文・プレビュー・書き出し（PDF・JPG・TXT）にも一切含まれません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

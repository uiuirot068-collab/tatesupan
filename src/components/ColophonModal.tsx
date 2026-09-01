"use client";

import { useEffect } from "react";
import { FONT_FAMILY_OPTIONS } from "@/constants/fonts";
import {
  COLOPHON_FONT_SAME_AS_BODY,
  COLOPHON_TEMPLATE_IDS,
  COLOPHON_TEMPLATE_LABELS,
  addColophonField,
  moveColophonField,
  removeColophonField,
  resolveColophonInsertion,
  updateColophonField,
  type ColophonPlacement,
  type ColophonSettings,
} from "@/lib/colophon";

/**
 * TSP-LOOP-005 (Human-spec correction §4–5): the 「📖 奥付」 editor.
 *
 * Colophon editing lives here — a dedicated popup opened from the editor
 * toolbar — NOT in the ページ設定 / ノンブル・柱 panel (which must not grow).
 * The colophon data still lives on `PageSettings.colophon`; this modal only
 * reads/writes it. It never touches the editor textarea / input model.
 */
interface ColophonModalProps {
  colophon: ColophonSettings;
  /** 現在の本文ページ数（「本文の何ページ後」入力の目安・範囲外警告に使う）。 */
  bodyPageCount: number;
  onChange: (next: ColophonSettings) => void;
  onClose: () => void;
}

export default function ColophonModal({
  colophon,
  bodyPageCount,
  onChange,
  onClose,
}: ColophonModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const patch = (p: Partial<ColophonSettings>) => onChange({ ...colophon, ...p });
  const setFields = (fields: ColophonSettings["fields"]) => patch({ fields });
  const patchPlacement = (p: Partial<ColophonPlacement>) =>
    patch({ placement: { ...colophon.placement, ...p } });

  const pagePos = colophon.pagePosition;
  const afterBodyPageValue =
    pagePos.mode === "after-body-page" ? String(pagePos.afterBodyPage) : "1";
  const insertion = resolveColophonInsertion(pagePos, bodyPageCount);

  const setPagePositionMode = (mode: "end" | "after-body-page") => {
    if (mode === "end") {
      patch({ pagePosition: { mode: "end" } });
    } else {
      const n = pagePos.mode === "after-body-page" ? pagePos.afterBodyPage : Math.max(1, bodyPageCount);
      patch({ pagePosition: { mode: "after-body-page", afterBodyPage: Math.max(1, Math.floor(n) || 1) } });
    }
  };
  const setAfterBodyPage = (raw: string) => {
    const n = Math.floor(Number(raw));
    // 空欄・不正値でも crash させず、直近の有効値を保つ（1 未満は 1 へ丸め）。
    if (!Number.isFinite(n) || n < 1) {
      patch({ pagePosition: { mode: "after-body-page", afterBodyPage: 1 } });
      return;
    }
    patch({ pagePosition: { mode: "after-body-page", afterBodyPage: n } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">📖 奥付</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={colophon.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="h-4 w-4 rounded border-ink/30"
              />
              <span className="text-ink">奥付を付ける（横書き専用ページを1枚追加）</span>
            </label>

            <p className="rounded border border-ink/15 bg-ink/5 px-2 py-1.5 text-xs leading-snug text-ink/60">
              この機能で作成する奥付は、本文とは独立した横書き専用ページです。本文ページの
              文字数・改ページ・縦書き設定には影響しません。1ファイルにつき1ページのみで、
              縦書きのテキストや画像は入れられません。縦書きの奥付を作りたい場合は、この機能を
              使わず通常の本文ページとして作成してください。
            </p>

            <div className={colophon.enabled ? "flex flex-col gap-3" : "pointer-events-none flex flex-col gap-3 opacity-40"}>
              {/* A. PAGE POSITION — 奥付ページを作品全体のどこへ入れるか。 */}
              <div className="flex flex-col gap-1.5 rounded border border-ink/15 p-2">
                <span className="text-xs font-semibold text-ink/70">配置場所</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="colophon-page-position"
                    checked={pagePos.mode === "after-body-page"}
                    onChange={() => setPagePositionMode("after-body-page")}
                  />
                  <span className="text-ink">本文</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={afterBodyPageValue}
                    disabled={pagePos.mode !== "after-body-page"}
                    onChange={(e) => setAfterBodyPage(e.target.value)}
                    className="w-16 rounded border border-ink/20 bg-base px-1.5 py-1 text-sm text-ink disabled:opacity-40"
                  />
                  <span className="text-ink">P目の後に配置</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="colophon-page-position"
                    checked={pagePos.mode === "end"}
                    onChange={() => setPagePositionMode("end")}
                  />
                  <span className="text-ink">作品最終ページに配置</span>
                </label>
                <span className="text-[11px] text-ink/40">
                  現在の本文は約 {bodyPageCount} ページです。「作品最終ページに配置」は本文が
                  増減しても常に末尾へ追従します。
                </span>
                {insertion.fallback && (
                  <p className="rounded bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-800">
                    指定した {insertion.requestedPage}P目が現在の本文にはありません。奥付は
                    一時的に作品最終ページの後に表示されます（本文が {insertion.requestedPage}P
                    以上になれば元の位置へ戻ります）。指定値は保持されます。
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink/60">テンプレート</span>
                <div className="flex flex-wrap gap-1">
                  {COLOPHON_TEMPLATE_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch({ templateId: id })}
                      className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                        colophon.templateId === id
                          ? "bg-accent text-paper-ink"
                          : "bg-ink/10 text-ink/60 hover:bg-ink/15"
                      }`}
                    >
                      {COLOPHON_TEMPLATE_LABELS[id]}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-ink/40">
                  テンプレートを変更しても入力済みの奥付情報・配置は保持されます。
                </span>
              </div>

              {/* B. BLOCK PLACEMENT — 奥付ページ「内」でのブロック配置（テンプレートとは独立）。 */}
              <div className="flex flex-col gap-2 rounded border border-ink/15 p-2">
                <span className="text-xs font-semibold text-ink/70">配置</span>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-xs text-ink/50">左右</span>
                  {(
                    [
                      ["left", "左寄り"],
                      ["center", "中央寄せ"],
                      ["right", "右寄り"],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="colophon-h-align"
                        checked={colophon.placement.horizontal === v}
                        onChange={() => patchPlacement({ horizontal: v })}
                      />
                      <span className="text-ink">{label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-1 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={colophon.placement.respectGutter}
                      onChange={(e) => patchPlacement({ respectGutter: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-ink/30"
                    />
                    ノドを考慮する
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-xs text-ink/50">上下</span>
                  {(
                    [
                      ["top", "上部寄せ"],
                      ["center", "中央寄せ"],
                      ["bottom", "下部寄せ"],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="colophon-v-align"
                        checked={colophon.placement.vertical === v}
                        onChange={() => patchPlacement({ vertical: v })}
                      />
                      <span className="text-ink">{label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-1 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={colophon.placement.respectVerticalMargins}
                      onChange={(e) => patchPlacement({ respectVerticalMargins: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-ink/30"
                    />
                    天地の余白を考慮する
                  </label>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink/60">奥付フォント</span>
                <select
                  value={colophon.fontFamily}
                  onChange={(e) => patch({ fontFamily: e.target.value })}
                  className="max-w-xs rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
                >
                  <option value={COLOPHON_FONT_SAME_AS_BODY}>本文と同じ</option>
                  {FONT_FAMILY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink/60">項目（項目名そのものも変更できます）</span>
                <div className="flex flex-col gap-1.5">
                  {colophon.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-wrap items-center gap-1.5 rounded border border-ink/10 bg-base px-2 py-1.5"
                    >
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => setFields(updateColophonField(colophon.fields, field.id, { label: e.target.value }))}
                        placeholder="項目名"
                        className="w-24 rounded border border-ink/20 bg-base px-1.5 py-1 text-xs text-ink"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => setFields(updateColophonField(colophon.fields, field.id, { value: e.target.value }))}
                        placeholder="値"
                        className="min-w-0 flex-1 rounded border border-ink/20 bg-base px-1.5 py-1 text-xs text-ink"
                      />
                      <label className="flex cursor-pointer items-center gap-1 text-[11px] text-ink/60">
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onChange={(e) => setFields(updateColophonField(colophon.fields, field.id, { visible: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-ink/30"
                        />
                        表示
                      </label>
                      <button
                        type="button"
                        onClick={() => setFields(moveColophonField(colophon.fields, field.id, -1))}
                        disabled={index === 0}
                        aria-label="上へ移動"
                        className="rounded border border-ink/20 px-1.5 py-0.5 text-xs text-ink/60 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => setFields(moveColophonField(colophon.fields, field.id, 1))}
                        disabled={index === colophon.fields.length - 1}
                        aria-label="下へ移動"
                        className="rounded border border-ink/20 px-1.5 py-0.5 text-xs text-ink/60 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setFields(removeColophonField(colophon.fields, field.id))}
                        aria-label="この項目を削除"
                        className="rounded border border-ink/20 px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-500/10"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setFields(addColophonField(colophon.fields))}
                  className="mt-1 w-fit rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
                >
                  ＋ 項目を追加
                </button>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink/60">自由記述（無断転載について・SNS・謝辞など）</span>
                <textarea
                  value={colophon.freeText}
                  onChange={(e) => patch({ freeText: e.target.value })}
                  spellCheck={false}
                  rows={4}
                  placeholder="例: 本書の無断転載・複製を禁じます。"
                  className="w-full resize-y rounded border border-ink/20 bg-base p-2 text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
                />
              </label>

              <p className="rounded border border-ink/15 bg-ink/5 px-2 py-1.5 text-[11px] leading-snug text-ink/50">
                配置・ノド・天地の設定で領域が足りず内容が収まらない場合はプレビューに警告が
                表示されます。β版では自動でのページ分割・文字の縮小・切り捨ては行いません。
                本文でノンブルを表示している場合は、奥付ページにも実際の作品ページ順に沿った
                続きのページ番号が表示されます。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

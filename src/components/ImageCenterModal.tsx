"use client";

import { useState, type HTMLAttributes } from "react";
import ViewportModal from "./ViewportModal";
import { imageCenterStatusLabel, summarizeImageCenter, type ImageCenterEntry } from "@/lib/imageCenter";

/**
 * Phase 12 画像管理センター — one dialog listing every 挿絵 the manuscript
 * references, opened from the Preview footer's 画像 button, the ⚠️画像切れ
 * popover, or the export preflight's image issue. Purely presentational: the
 * inventory (lib/imageCenter.ts) and every action (navigation, 差し替え, 削除,
 * 再同期, 通知解除) are the editor's existing ones, passed in.
 */
export interface ImageCenterModalProps {
  entries: ImageCenterEntry[];
  /** False while the Preview shows its provisional pre-V2 list (pages not known yet). */
  pagesKnown: boolean;
  /** IndexedDB presence is being checked. */
  checkingOriginals: boolean;
  busy: boolean;
  /** Result of the last 再同期 (ids that had no original), shown inline. */
  notice: string | null;
  canEdit: boolean;
  onClose: () => void;
  onNavigate: (bodyIndex: number) => void;
  onReplace: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onResync: (imageIds: string[]) => void;
  onDismissWarning: (imageId: string) => void;
}

const POSITION_LABEL: Record<ImageCenterEntry["position"], string> = {
  top: "天",
  center: "中央",
  bottom: "地",
  full: "ページ全体",
};

function statusClass(status: ImageCenterEntry["status"]): string {
  return status === "ok"
    ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
    : "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100";
}

export default function ImageCenterModal({
  entries,
  pagesKnown,
  checkingOriginals,
  busy,
  notice,
  canEdit,
  onClose,
  onNavigate,
  onReplace,
  onDelete,
  onResync,
  onDismissWarning,
}: ImageCenterModalProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const summary = summarizeImageCenter(entries);
  const repairableIds = entries.filter((entry) => entry.repairable).map((entry) => entry.id);

  return (
    <ViewportModal
      title="画像管理"
      titleId="image-center-title"
      closeLabel="画像管理を閉じる"
      onClose={onClose}
      panelClassName="max-w-lg"
      overlayProps={{ "data-image-center": "" } as HTMLAttributes<HTMLDivElement>}
      footer={(
        <>
          {canEdit && repairableIds.length > 0 && (
            <button
              type="button"
              data-image-center-resync-all=""
              disabled={busy}
              onClick={() => onResync(repairableIds)}
              className="mr-auto rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              修復可能な画像をまとめて再同期（{repairableIds.length}）
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-base">
            閉じる
          </button>
        </>
      )}
    >
      <p className="mb-2 text-xs text-ink/65" data-image-center-summary="">
        挿絵 {summary.total} 点（正常 {summary.ok}・要対応 {summary.broken}）
        {checkingOriginals && " ／ 端末内の元画像を確認中…"}
      </p>
      {!pagesKnown && (
        <p className="mb-2 rounded bg-ink/5 px-2 py-1 text-[11px] text-ink/60">組版の準備中です。ページ番号は準備ができると表示されます。</p>
      )}
      {notice && (
        <p role="status" className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {notice}
        </p>
      )}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/55">この作品には挿絵がありません。</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-image-center-entry={entry.id}
              data-image-center-status={entry.status}
              className="flex gap-3 rounded border border-ink/10 p-2"
            >
              <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded border border-ink/10 bg-paper">
                {entry.thumbnail ? (
                  <div
                    role="img"
                    aria-label={`挿絵${entry.order}`}
                    className="h-full w-full bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${JSON.stringify(entry.thumbnail)})` }}
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] leading-tight text-ink/45">画像なし</span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">挿絵{entry.order}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusClass(entry.status)}`}>{imageCenterStatusLabel(entry.status)}</span>
                  {entry.warningPending && (
                    <span className="rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-100">画像切れ通知中</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-ink/45" title={entry.id}>
                  ID: {entry.id}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/60">
                  {POSITION_LABEL[entry.position]}・{entry.widthMm}×{entry.heightMm}mm・重なり順 {entry.layerOrder ?? "標準"}
                  {entry.markerCount > 1 && `・${entry.markerCount}か所`}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/60">
                  端末内の元画像:{" "}
                  {entry.localOriginal === null ? "確認中" : entry.localOriginal ? "あり" : "なし"}
                  {entry.status !== "ok" && (entry.repairable ? "（再同期で修復できます）" : entry.localOriginal === false ? "（画像を選び直すか削除してください）" : "")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {pagesKnown &&
                    entry.pageIndices.map((pageIndex) => (
                      <button
                        key={pageIndex}
                        type="button"
                        data-image-center-goto={pageIndex + 1}
                        onClick={() => onNavigate(pageIndex)}
                        className="rounded border border-ink/20 px-2 py-1 text-[11px] hover:bg-ink/5"
                      >
                        {pageIndex + 1}Pへ移動
                      </button>
                    ))}
                  {canEdit && entry.repairable && (
                    <button
                      type="button"
                      data-image-center-resync={entry.id}
                      disabled={busy}
                      onClick={() => onResync([entry.id])}
                      className="rounded border border-ink/20 px-2 py-1 text-[11px] hover:bg-ink/5 disabled:opacity-40"
                    >
                      再同期
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      data-image-center-replace={entry.id}
                      disabled={busy}
                      onClick={() => onReplace(entry.id)}
                      className="rounded border border-ink/20 px-2 py-1 text-[11px] hover:bg-ink/5 disabled:opacity-40"
                    >
                      {entry.status === "ok" ? "画像を差し替える" : "画像を選び直す"}
                    </button>
                  )}
                  {canEdit &&
                    (confirmDeleteId === entry.id ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] text-ink/70">
                          原稿から{entry.markerCount > 1 ? `${entry.markerCount}か所すべて` : ""}削除しますか？
                        </span>
                        <button
                          type="button"
                          data-image-center-delete-confirm={entry.id}
                          disabled={busy}
                          onClick={() => {
                            setConfirmDeleteId(null);
                            onDelete(entry.id);
                          }}
                          className="rounded border border-red-400/60 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          削除する
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded border border-ink/20 px-2 py-1 text-[11px] hover:bg-ink/5"
                        >
                          やめる
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-image-center-delete={entry.id}
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="rounded border border-ink/20 px-2 py-1 text-[11px] text-ink/70 hover:bg-ink/5 disabled:opacity-40"
                      >
                        削除
                      </button>
                    ))}
                  {entry.warningPending && entry.status === "ok" && (
                    <button
                      type="button"
                      data-image-center-dismiss={entry.id}
                      onClick={() => onDismissWarning(entry.id)}
                      className="text-[11px] text-ink/50 underline hover:text-ink"
                    >
                      通知解除
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ViewportModal>
  );
}

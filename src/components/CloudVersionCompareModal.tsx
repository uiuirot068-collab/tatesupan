"use client";

import type { HTMLAttributes } from "react";
import ViewportModal from "./ViewportModal";
import { countVisualLength } from "@/lib/tategaki";
import { CLOUD_COMPARE_COPY, formatCloudVersionTime } from "@/lib/cloudVersionCompare";

interface VersionSide {
  title: string;
  content: string;
  /** この画面の版: 開いた・保存したクラウド版の時刻 / クラウド版: いまの保存時刻 */
  updatedAt: string | null;
}

interface CloudVersionCompareModalProps {
  screen: VersionSide;
  cloud: VersionSide;
  busy?: boolean;
  onOverwrite: () => void;
  onOpenCloud: () => void;
  onCancel: () => void;
}

/**
 * CST-PORT-014: 「クラウドに保存」の直前に、クラウド版の方が新しいと
 * わかったときの確認画面（COLUMNSTAND B5 の window.confirm を TateSpun の
 * ダイアログに）。2つの版を並べて、題名・文字数・時刻で見比べて選ぶ。
 */
export default function CloudVersionCompareModal({
  screen,
  cloud,
  busy = false,
  onOverwrite,
  onOpenCloud,
  onCancel,
}: CloudVersionCompareModalProps) {
  const sides = [
    { key: "screen", label: CLOUD_COMPARE_COPY.screenLabel, timeLabel: CLOUD_COMPARE_COPY.screenTimeLabel, side: screen },
    { key: "cloud", label: CLOUD_COMPARE_COPY.cloudLabel, timeLabel: CLOUD_COMPARE_COPY.cloudTimeLabel, side: cloud },
  ] as const;

  return (
    <ViewportModal
      title={CLOUD_COMPARE_COPY.title}
      titleId="cloud-version-compare-title"
      closeLabel="クラウド版との比較を閉じる"
      onClose={busy ? () => undefined : onCancel}
      panelClassName="max-w-lg"
      overlayProps={{ "data-cloud-version-compare": "" } as HTMLAttributes<HTMLDivElement>}
      footer={(
        <>
          <button
            type="button"
            data-cloud-version-compare-action="cancel"
            disabled={busy}
            className="rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5 disabled:opacity-50"
            onClick={onCancel}
          >
            {CLOUD_COMPARE_COPY.cancel}
          </button>
          <button
            type="button"
            data-cloud-version-compare-action="open-cloud"
            disabled={busy}
            className="rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5 disabled:opacity-50"
            onClick={onOpenCloud}
          >
            {CLOUD_COMPARE_COPY.openCloud}
          </button>
          <button
            type="button"
            data-cloud-version-compare-action="overwrite"
            disabled={busy}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90 disabled:opacity-50"
            onClick={onOverwrite}
          >
            {CLOUD_COMPARE_COPY.overwrite}
          </button>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-ink">{CLOUD_COMPARE_COPY.lead}</p>
      <dl className="mt-4 grid grid-cols-2 border-y border-ink/15 text-xs">
        {sides.map(({ key, label, timeLabel, side }, index) => (
          <div
            key={key}
            data-cloud-version-compare-side={key}
            className={`min-w-0 py-3 ${index === 0 ? "pr-3" : "border-l border-ink/15 pl-3"}`}
          >
            <dt className="font-semibold text-ink">{label}</dt>
            <dd className="mt-2 truncate text-ink/80" title={side.title || "無題"}>
              {side.title || "無題"}
            </dd>
            <dd className="mt-1 tabular-nums text-ink/70">
              {countVisualLength(side.content).toLocaleString("ja-JP")}文字
            </dd>
            <dd className="mt-2 text-ink/60">{timeLabel}</dd>
            <dd className="tabular-nums text-ink/80">{formatCloudVersionTime(side.updatedAt)}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink/70">
        <li>「{CLOUD_COMPARE_COPY.overwrite}」… {CLOUD_COMPARE_COPY.overwriteNote}</li>
        <li>「{CLOUD_COMPARE_COPY.openCloud}」… {CLOUD_COMPARE_COPY.openCloudNote}</li>
      </ul>
    </ViewportModal>
  );
}

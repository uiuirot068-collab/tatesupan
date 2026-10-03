"use client";

/**
 * 3D preview — compact control bar.
 * CST-PORT-012: COLUMNSTAND `EditorBook3DToolbar.tsx` (same buttons, order and labels).
 * "The book is the hero": one low bar, icon buttons, labels in title/aria-label,
 * short status text only. Scrolls horizontally on narrow screens instead of
 * wrapping into tall rows, so it never squeezes the 3D stage.
 */
import type { ReactNode } from "react";
import type { Book3DOpenState } from "@/lib/book3d/book3dModel";
import { BOOK3D_BINDING_LABEL, type Book3DBinding } from "@/lib/book3d/book3dBinding";

const OPEN_SHORT: Record<Book3DOpenState, { short: string; label: string }> = {
  closed: { short: "閉", label: "閉じる" },
  ajar: { short: "半", label: "少し開く" },
  open: { short: "開", label: "開く" },
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`eb3d-tool ${pressed ? "is-on" : ""} ${className ?? ""}`}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Book3DToolbar({
  zoom,
  openState,
  binding,
  showGutterGuide,
  status,
  statusTitle,
  notice,
  onZoom,
  onRotate,
  onFront,
  onSpine,
  onBack,
  onOpenView,
  onReset,
  onOpenStateChange,
  onBindingChange,
  onShowGutterGuideChange,
}: {
  zoom: number;
  openState: Book3DOpenState;
  binding: Book3DBinding;
  showGutterGuide: boolean;
  status: string;
  /** tooltip for the status line (defaults to the status itself) */
  statusTitle?: string;
  /** optional non-blocking note shown above the status line */
  notice?: string | null;
  onZoom: (delta: number) => void;
  onRotate: (dyaw: number, dpitch: number) => void;
  onFront: () => void;
  onSpine: () => void;
  onBack: () => void;
  onOpenView: () => void;
  onReset: () => void;
  onOpenStateChange: (state: Book3DOpenState) => void;
  onBindingChange: (binding: Book3DBinding) => void;
  onShowGutterGuideChange: (value: boolean) => void;
}) {
  return (
    <div className="eb3d-bar-wrap">
      {/*
        Desktop / tablet: one row, in this DOM order.
        Phones (≤560px, editor-v3.css): the items wrap into two rows via the eb3d-m-* order
        classes, without horizontal scrolling —
          row A (視点): zoom | rotate | 開いた本 reset
          row B (本):   表 背 裏 | 閉 半 開 | 製本方式 | ノド注意
      */}
      <div className="eb3d-bar" role="toolbar" aria-label="3D表示の操作">
        <div className="eb3d-group eb3d-m-1">
          <IconButton label="縮小" onClick={() => onZoom(-0.1)}>
            <Icon><circle cx="9" cy="9" r="5.5" /><path d="M6.5 9h5M13.2 13.2 17 17" /></Icon>
          </IconButton>
          <span className="eb3d-zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <IconButton label="拡大" onClick={() => onZoom(0.1)}>
            <Icon><circle cx="9" cy="9" r="5.5" /><path d="M6.5 9h5M9 6.5v5M13.2 13.2 17 17" /></Icon>
          </IconButton>
        </div>

        <span className="eb3d-sep eb3d-m-2" aria-hidden="true" />

        <div className="eb3d-group eb3d-m-3">
          <IconButton label="左に回転" onClick={() => onRotate(-30, 0)}>
            <Icon><path d="M7 5H3v4" /><path d="M3.5 8.5A7 7 0 1 1 5 14.5" /></Icon>
          </IconButton>
          <IconButton label="右に回転" onClick={() => onRotate(30, 0)}>
            <Icon><path d="M13 5h4v4" /><path d="M16.5 8.5A7 7 0 1 0 15 14.5" /></Icon>
          </IconButton>
          <IconButton label="上に傾ける" onClick={() => onRotate(0, 8)}>
            <Icon><path d="M5 12l5-5 5 5" /></Icon>
          </IconButton>
          <IconButton label="下に傾ける" onClick={() => onRotate(0, -8)}>
            <Icon><path d="M5 8l5 5 5-5" /></Icon>
          </IconButton>
        </div>

        <span className="eb3d-sep eb3d-m-hide" aria-hidden="true" />

        <div className="eb3d-group eb3d-m-7">
          <IconButton label="表（表紙を正面に）" onClick={onFront}>
            <Icon><rect x="5" y="3" width="10" height="14" rx="1" /><path d="M8 7h4" /></Icon>
          </IconButton>
          <IconButton label="背を見る" onClick={onSpine}>
            <Icon><rect x="8" y="3" width="4" height="14" rx="1" /></Icon>
          </IconButton>
          <IconButton label="裏表紙を見る" onClick={onBack}>
            <Icon><rect x="5" y="3" width="10" height="14" rx="1" /><path d="M8 13h4" /></Icon>
          </IconButton>
        </div>
        <span className="eb3d-sep eb3d-m-4 eb3d-m-only" aria-hidden="true" />
        <div className="eb3d-group eb3d-m-5">
          <IconButton label="開いた本を見る" onClick={onOpenView} pressed={openState === "open"}>
            <Icon><path d="M10 5.5C8 4 5 4 2.5 4.5v10C5 14 8 14 10 15.5 12 14 15 14 17.5 14.5v-10C15 4 12 4 10 5.5z" /><path d="M10 5.5v10" /></Icon>
          </IconButton>
          <IconButton label="正面に戻す（リセット）" onClick={onReset}>
            <Icon><path d="M4 10a6 6 0 1 0 2-4.5" /><path d="M4 3.5V7h3.5" /></Icon>
          </IconButton>
        </div>

        <span className="eb3d-row-break eb3d-m-6" aria-hidden="true" />

        <span className="eb3d-sep eb3d-m-8" aria-hidden="true" />

        <div className="eb3d-seg eb3d-m-9" role="group" aria-label="開き方">
          {(["closed", "ajar", "open"] as const).map((state) => (
            <button
              key={state}
              type="button"
              className={openState === state ? "is-on" : ""}
              aria-pressed={openState === state}
              title={OPEN_SHORT[state].label}
              aria-label={OPEN_SHORT[state].label}
              onClick={() => onOpenStateChange(state)}
            >
              {OPEN_SHORT[state].short}
            </button>
          ))}
        </div>

        <label className="eb3d-select eb3d-m-10" title="製本方式（3D確認用）">
          <span className="eb3d-visually-hidden">製本方式</span>
          <select
            value={binding}
            onChange={(event) => onBindingChange(event.target.value as Book3DBinding)}
          >
            {(Object.keys(BOOK3D_BINDING_LABEL) as Book3DBinding[]).map((id) => (
              <option key={id} value={id}>{BOOK3D_BINDING_LABEL[id]}</option>
            ))}
          </select>
        </label>

        <IconButton
          label={showGutterGuide ? "ノド注意範囲を隠す" : "ノド注意範囲を表示"}
          onClick={() => onShowGutterGuideChange(!showGutterGuide)}
          pressed={showGutterGuide}
          className="eb3d-m-11"
        >
          <Icon><rect x="3" y="4" width="14" height="12" rx="1" /><path d="M10 4v12" /><path d="M8 6v8M12 6v8" strokeDasharray="1.5 1.8" /></Icon>
        </IconButton>
      </div>
      {notice ? (
        <p className="eb3d-notice" role="note">
          <span aria-hidden="true">⚠</span>
          {notice}
        </p>
      ) : null}
      <p className="eb3d-status" title={statusTitle ?? status}>{status}</p>
    </div>
  );
}



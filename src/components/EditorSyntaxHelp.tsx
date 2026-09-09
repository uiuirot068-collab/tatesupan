"use client";

import { useCallback, useState, type HTMLAttributes } from "react";
import ViewportModal from "./ViewportModal";

export const EDITOR_SYNTAX_HELP =
  "ルビ：｜漢字《かんじ》／縦中横：半角数字2桁を自動検知・[tate]A5[/tate]／改ページ：【改ページ】（詳しい使い方はヘルプ）";

const COMPACT_SYNTAX_HELP =
  "ルビ：｜漢字《かんじ》／縦中横：半角数字2桁を自動検知…";

/** Compact footer help with mouse, keyboard, and touch access to full text. */
export default function EditorSyntaxHelp() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        data-editor-footer-help=""
        aria-label={EDITOR_SYNTAX_HELP}
        aria-expanded={open}
        title={EDITOR_SYNTAX_HELP}
        onClick={() => setOpen(true)}
        className="block min-w-0 max-w-full cursor-help truncate whitespace-nowrap rounded text-left leading-relaxed text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {COMPACT_SYNTAX_HELP}
      </button>

      {open && (
        <ViewportModal
          title="入力記法"
          titleId="editor-syntax-help-title"
          closeLabel="入力記法の説明を閉じる"
          onClose={close}
          panelClassName="max-w-md"
          overlayProps={{ "data-editor-syntax-help-modal": "" } as HTMLAttributes<HTMLDivElement>}
          dialogProps={{ "data-editor-syntax-help-dialog": "" } as HTMLAttributes<HTMLDivElement>}
          footer={(
            <button
              type="button"
              data-editor-syntax-help-close=""
              onClick={close}
              className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-base hover:opacity-90"
            >
              閉じる
            </button>
          )}
        >
          <p data-editor-syntax-help-full="" className="text-sm leading-relaxed text-ink/75">
            {EDITOR_SYNTAX_HELP}
          </p>
        </ViewportModal>
      )}
    </>
  );
}

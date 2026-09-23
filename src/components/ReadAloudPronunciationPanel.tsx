"use client";

import { useState } from "react";
import { isValidPronunciationReading, type PronunciationEntry } from "@/lib/readAloudPronunciation";
import type { HeldSelection } from "@/lib/readAloudHeldSelection";

/**
 * TSP-B4 (Revision 3) 音読の読み辞書: register a corrected reading for the current manuscript
 * selection, and manage what has been registered so far. Lives in the Review Hub's 音読β section
 * (full settings), not the compact Dock/mini-bar controls. The manuscript string is never touched —
 * only the text handed to the speech engine changes (`readAloudPronunciation.ts`).
 */

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent";

export const READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE =
  "読みの登録はこの端末のブラウザに保存されます。原稿本文や読み辞書をTateSpunから外部サービスへ送信しません。";

export const READ_ALOUD_PRONUNCIATION_NEEDS_SELECTION_NOTE = "先に本文で読みを直したい言葉を選んでください。";

export interface ReadAloudPronunciationSectionProps {
  /** The writer's currently held 選択範囲 (Revision 2), used as 表記. Registration is unavailable without one. */
  held: HeldSelection | null;
  entries: readonly PronunciationEntry[];
  onUpsert: (surface: string, reading: string) => void;
  onRemove: (id: string) => void;
}

export function ReadAloudPronunciationSection({ held, entries, onUpsert, onRemove }: ReadAloudPronunciationSectionProps) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [readingDraft, setReadingDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const openRegister = () => {
    setReadingDraft("");
    setRegisterOpen(true);
  };
  const closeRegister = () => setRegisterOpen(false);
  const saveRegister = () => {
    if (!held || !isValidPronunciationReading(readingDraft)) return;
    onUpsert(held.text, readingDraft);
    setRegisterOpen(false);
  };
  const readingValid = isValidPronunciationReading(readingDraft);

  const startEdit = (entry: PronunciationEntry) => {
    setEditingId(entry.id);
    setEditDraft(entry.reading);
  };
  const saveEdit = (surface: string) => {
    if (!isValidPronunciationReading(editDraft)) return;
    onUpsert(surface, editDraft);
    setEditingId(null);
  };

  return (
    <div data-read-aloud-pronunciation="" className="mt-2 space-y-1.5 border-t border-ink/10 pt-2">
      <p className="text-[11px] font-semibold text-ink/80">音読の読みを直す</p>

      {!registerOpen ? (
        <button type="button" data-read-aloud-pronunciation-register-open="" onClick={openRegister} className={PILL_BUTTON}>
          音読の読みを登録
        </button>
      ) : !held ? (
        <p data-read-aloud-pronunciation-need-selection="" role="status" className="text-[11px] text-ink/70">
          {READ_ALOUD_PRONUNCIATION_NEEDS_SELECTION_NOTE}
        </p>
      ) : (
        <div data-read-aloud-pronunciation-form="" className="space-y-1.5 rounded-lg border border-ink/15 p-2">
          <p className="text-[11px] text-ink/60">
            表記: <strong data-read-aloud-pronunciation-surface="" className="font-semibold text-ink">{held.text}</strong>
          </p>
          <label className="flex items-center gap-1.5 text-[11px] text-ink/70">
            <span className="shrink-0">読み</span>
            <input
              type="text"
              data-read-aloud-pronunciation-reading=""
              value={readingDraft}
              onChange={(event) => setReadingDraft(event.target.value)}
              placeholder="ひらがな・カタカナで入力"
              className="min-w-0 flex-1 rounded border border-ink/20 bg-base px-1.5 py-0.5 text-[11px] text-ink"
            />
          </label>
          {readingDraft.length > 0 && !readingValid ? (
            <p data-read-aloud-pronunciation-invalid="" role="alert" className="text-[11px] text-ink/70">
              読みはひらがな・カタカナで入力してください。
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-read-aloud-pronunciation-save=""
              disabled={!readingValid}
              onClick={saveRegister}
              className={PILL_BUTTON}
            >
              保存
            </button>
            <button type="button" data-read-aloud-pronunciation-cancel="" onClick={closeRegister} className={PILL_BUTTON}>
              やめる
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <details data-read-aloud-pronunciation-list="" className="text-[11px]">
          <summary className="cursor-pointer select-none text-ink/70">登録した読み（{entries.length}件）</summary>
          <ul className="mt-1 divide-y divide-ink/10">
            {entries.map((entry) => (
              <li key={entry.id} data-read-aloud-pronunciation-item={entry.id} className="flex items-center justify-between gap-2 py-1.5">
                {editingId === entry.id ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">
                      {entry.surface} →{" "}
                      <input
                        type="text"
                        data-read-aloud-pronunciation-edit-input=""
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        className="min-w-0 rounded border border-ink/20 bg-base px-1 py-0.5 text-[11px] text-ink"
                      />
                    </span>
                    <button
                      type="button"
                      data-read-aloud-pronunciation-edit-save=""
                      disabled={!isValidPronunciationReading(editDraft)}
                      onClick={() => saveEdit(entry.surface)}
                      className={PILL_BUTTON}
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-ink/80">
                      {entry.surface} → <strong>{entry.reading}</strong>
                    </span>
                    <button type="button" data-read-aloud-pronunciation-edit="" onClick={() => startEdit(entry)} className={PILL_BUTTON}>
                      編集
                    </button>
                    <button
                      type="button"
                      data-read-aloud-pronunciation-remove=""
                      onClick={() => onRemove(entry.id)}
                      className={PILL_BUTTON}
                    >
                      削除
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p data-read-aloud-pronunciation-privacy="" className="text-[11px] text-ink/60">
        {READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE}
      </p>
    </div>
  );
}

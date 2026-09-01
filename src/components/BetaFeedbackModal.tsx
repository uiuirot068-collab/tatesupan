"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOWED_IMAGE_MIME,
  FEEDBACK_FAILURE_MESSAGE,
  FEEDBACK_GUIDANCE,
  FEEDBACK_IMAGE_HINT,
  FEEDBACK_IMAGE_PRIVACY_NOTICE,
  FEEDBACK_SUCCESS_MESSAGE,
  MAX_FEEDBACK_IMAGES,
  MAX_IMAGE_BYTES,
  REVIEW_CHECKLIST_ITEMS,
  REVIEW_INTRO,
  canSubmitFeedback,
  validateSubmissionShape,
} from "@/lib/betaFeedback";
import { submitBetaFeedback } from "@/lib/betaFeedbackClient";

/**
 * TSP-LOOP-006 — 「β版フィードバック」モーダル。
 *
 * β 限定機能。エディタツールバーの黄色い「報告」ボタンからのみ開く。
 * 2 タブ（気になる事 / review）。既定は「気になる事」。
 * 原稿・タイトル・ドキュメント ID は一切参照しない（props に渡さない）。
 */
interface BetaFeedbackModalProps {
  onClose: () => void;
}

type TabId = "feedback" | "review";
type SendState = "idle" | "sending" | "success" | "error";

interface Attachment {
  id: string;
  file: File;
  url: string;
}

export default function BetaFeedbackModal({ onClose }: BetaFeedbackModalProps) {
  const [tab, setTab] = useState<TabId>("feedback");

  // --- 気になる事 ---
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedbackState, setFeedbackState] = useState<SendState>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  // --- review ---
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [reviewState, setReviewState] = useState<SendState>("idle");

  // 現在の添付を ref で追跡し、閉じる／アンマウント時に確実に revoke する
  // （deps 固定 effect のクロージャ問題を避ける）。
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const handleClose = () => {
    attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const canSend = canSubmitFeedback(message, attachments.length);
  const checkedItems = useMemo(
    () => REVIEW_CHECKLIST_ITEMS.filter((item) => checked[item]),
    [checked]
  );

  const handlePickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // `files` は input.files のライブ参照。この後 input.value を空にすると
    // このリストも空になるため、まず配列へスナップショットしてから消す。
    // （React の setState updater は同期実行されないので、updater 内で
    //   `files` を読むと空になっている＝画像が1枚も入らない不具合だった。）
    const picked = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setFeedbackError(null);
    const room = MAX_FEEDBACK_IMAGES - attachments.length;
    if (room <= 0) {
      setFeedbackError("画像は4枚までです。");
      return;
    }

    const added: Attachment[] = [];
    let error: string | null = null;
    for (const file of picked.slice(0, room)) {
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
        error = "対応していない画像形式です（JPEG / PNG / WebP のみ）。";
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        error = "画像1枚のサイズが大きすぎます（5MBまで）。";
        continue;
      }
      added.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    if (error) setFeedbackError(error);
    if (added.length > 0) {
      setAttachments((prev) => [...prev, ...added].slice(0, MAX_FEEDBACK_IMAGES));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSendFeedback = async () => {
    if (sendingRef.current || !canSend) return;
    const submission = {
      type: "feedback" as const,
      message,
      images: attachments.map((a) => a.file),
    };
    const shape = validateSubmissionShape(submission);
    if (!shape.ok) {
      setFeedbackError(shape.reason);
      return;
    }
    sendingRef.current = true;
    setFeedbackState("sending");
    setFeedbackError(null);
    const { ok } = await submitBetaFeedback(submission);
    sendingRef.current = false;
    if (ok) {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setMessage("");
      setAttachments([]);
      setFeedbackState("success");
    } else {
      // 失敗時は入力・画像プレビューを維持する。
      setFeedbackState("error");
    }
  };

  const handleSendReview = async () => {
    if (reviewState === "sending") return;
    const submission = {
      type: "review" as const,
      checkedItems: [...checkedItems],
      note,
    };
    const shape = validateSubmissionShape(submission);
    if (!shape.ok) {
      setReviewState("error");
      return;
    }
    setReviewState("sending");
    const { ok } = await submitBetaFeedback(submission);
    if (ok) {
      setChecked({});
      setNote("");
      setReviewState("success");
    } else {
      setReviewState("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="β版フィードバック"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">β版フィードバック</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="閉じる"
            className="rounded p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-1 border-b border-ink/10">
          <TabButton active={tab === "feedback"} onClick={() => setTab("feedback")}>
            気になる事
          </TabButton>
          <TabButton active={tab === "review"} onClick={() => setTab("review")}>
            review
          </TabButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "feedback" ? (
            <div className="flex flex-col gap-3">
              <p className="whitespace-pre-line text-xs leading-relaxed text-ink/70">
                {FEEDBACK_GUIDANCE}
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="ここに入力してください"
                className="w-full resize-y rounded border border-ink/20 bg-base p-2 text-sm text-ink outline-none focus:border-ink/40"
              />

              <div className="flex flex-col gap-2">
                <p className="text-xs text-ink/60">{FEEDBACK_IMAGE_HINT}</p>
                <p className="text-[11px] text-amber-700">{FEEDBACK_IMAGE_PRIVACY_NOTICE}</p>

                {attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <li key={a.id} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.url}
                          alt="添付プレビュー"
                          className="h-16 w-16 rounded border border-ink/15 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          aria-label="この画像を削除"
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink/20 bg-base text-xs text-ink/70 shadow hover:bg-ink/5"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= MAX_FEEDBACK_IMAGES}
                    className="rounded border border-ink/20 px-2 py-1 text-xs text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ＋ 画像を追加
                  </button>
                  <span className="text-xs text-ink/50">
                    画像 {attachments.length} / {MAX_FEEDBACK_IMAGES}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_MIME.join(",")}
                  multiple
                  hidden
                  onChange={(e) => handlePickFiles(e.target.files)}
                />
              </div>

              {feedbackError && (
                <p className="text-xs text-red-600">{feedbackError}</p>
              )}
              {feedbackState === "success" && (
                <p className="text-xs font-medium text-emerald-700">
                  {FEEDBACK_SUCCESS_MESSAGE}
                </p>
              )}
              {feedbackState === "error" && (
                <p className="whitespace-pre-line text-xs text-red-600">
                  {FEEDBACK_FAILURE_MESSAGE}
                </p>
              )}

              <button
                type="button"
                onClick={handleSendFeedback}
                disabled={!canSend || feedbackState === "sending"}
                className="self-start rounded bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {feedbackState === "sending" ? "送信中…" : "匿名で送信する"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed text-ink/70">{REVIEW_INTRO}</p>
              <ul className="flex flex-col gap-1.5">
                {REVIEW_CHECKLIST_ITEMS.map((item) => (
                  <li key={item}>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(checked[item])}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [item]: e.target.checked }))
                        }
                        className="h-3.5 w-3.5 accent-accent"
                      />
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
              <label className="flex flex-col gap-1 text-xs text-ink/70">
                気になったことがあればどうぞ
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded border border-ink/20 bg-base p-2 text-sm text-ink outline-none focus:border-ink/40"
                />
              </label>

              {reviewState === "success" && (
                <p className="text-xs font-medium text-emerald-700">
                  {FEEDBACK_SUCCESS_MESSAGE}
                </p>
              )}
              {reviewState === "error" && (
                <p className="text-xs text-red-600">{FEEDBACK_FAILURE_MESSAGE}</p>
              )}

              <button
                type="button"
                onClick={handleSendReview}
                disabled={reviewState === "sending"}
                className="self-start rounded bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reviewState === "sending" ? "送信中…" : "reviewを送信"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
        active
          ? "border-amber-500 font-medium text-ink"
          : "border-transparent text-ink/50 hover:text-ink/80"
      }`}
    >
      {children}
    </button>
  );
}

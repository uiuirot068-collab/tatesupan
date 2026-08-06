"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { createDocument, db, deleteDocument, listDocuments, type DocumentRecord } from "@/lib/db";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { CombineModal } from "@/components/CombineModal";

const FREE_DOCUMENT_LIMIT = 15;

function estimateCharCount(content: string): number {
  return content.replace(/\s/g, "").length;
}

function formatUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const router = useRouter();
  const documents = useLiveQuery(() => listDocuments(), []);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const count = await db.documents.count();
      if (count >= FREE_DOCUMENT_LIMIT) {
        setIsLimitModalOpen(true);
        return;
      }
      const id = await createDocument();
      router.push(`/editor?id=${id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDocument(id);
    setPendingDeleteId(null);
  };

  const pendingDoc = documents?.find((doc) => doc.id === pendingDeleteId);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
        <h1 className="flex items-center gap-2">
          <Logo />
          <span className="font-normal text-sm text-ink/50">縦書きWebエディタ</span>
        </h1>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-8 px-4 py-10">
        <Image
          src="/caroad_main1.png"
          alt="縦書きWebエディタ"
          width={384}
          height={578}
          priority
          className="h-auto w-full max-w-[220px] sm:max-w-[260px]"
        />

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-base shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          + 新しい作品を作成する
        </button>

        <section className="w-full">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink/70">作品一覧</h2>
            <button
              type="button"
              onClick={() => setIsCombineModalOpen(true)}
              disabled={!documents || documents.length < 2}
              className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-40"
            >
              📚 短編集を作成
            </button>
          </div>

          {documents === undefined && (
            <p className="text-sm text-ink/50">読み込み中…</p>
          )}

          {documents !== undefined && documents.length === 0 && (
            <p className="text-sm text-ink/50">まだ作品がありません。上のボタンから作成してください。</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents?.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onOpen={() => router.push(`/editor?id=${doc.id}`)}
                onDelete={() => setPendingDeleteId(doc.id)}
              />
            ))}
          </div>
        </section>
      </main>

      {pendingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-ink">
              「{pendingDoc.title || "無題のドキュメント"}」を削除しますか？この操作は取り消せません。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleDelete(pendingDoc.id)}
                className="rounded bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <CombineModal
        isOpen={isCombineModalOpen}
        onClose={() => setIsCombineModalOpen(false)}
        onSuccess={(newDocumentId) => {
          setIsCombineModalOpen(false);
          router.push(`/editor?id=${newDocumentId}`);
        }}
        documents={documents ?? []}
      />

      {isLimitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsLimitModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ink">作品数の保存上限に達しています</h3>
            <p className="mt-2 text-sm text-ink/70">
              無料プランでローカル保存できる作品数は最大{FREE_DOCUMENT_LIMIT}作品までです。新しい作品を作成するには、不要な作品を削除するか、既存の作品を編集してください。
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  onOpen,
  onDelete,
}: {
  doc: DocumentRecord;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-ink/10 bg-base p-4 text-left shadow-sm transition-colors hover:border-accent/60"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-ink">
          {doc.title || "無題のドキュメント"}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="削除"
          title="削除"
          className="shrink-0 rounded p-1 text-xs text-ink/40 hover:bg-red-500/10 hover:text-red-500"
        >
          削除
        </button>
      </div>
      <p className="text-xs text-ink/50">最終更新: {formatUpdatedAt(doc.updatedAt)}</p>
      <p className="text-xs text-ink/50">文字数目安: {estimateCharCount(doc.content)} 字</p>
    </div>
  );
}

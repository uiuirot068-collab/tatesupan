"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  createDocument,
  db,
  deleteDocument,
  ensureSampleProject,
  listDocuments,
} from "@/lib/db";
import { CombineModal } from "@/components/CombineModal";
import { Header } from "@/components/Header";
import { Bookshelf } from "@/components/bookshelf/Bookshelf";

const FREE_DOCUMENT_LIMIT = 15;

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    ensureSampleProject();
  }, []);
  const documents = useLiveQuery(() => listDocuments(), []);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const count = await db.documents.filter((doc) => !doc.isSample).count();
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
    <div data-bookshelf-page className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center gap-8 px-4 py-10">
        <Image
          src="/caroad_main1.png"
          alt="縦書きWebエディタ"
          width={384}
          height={578}
          priority
          className="h-auto w-full max-w-[220px] sm:max-w-[260px]"
        />

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-base shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            + 新しい作品を作成する
          </button>
          <button
            type="button"
            onClick={() => setIsCombineModalOpen(true)}
            disabled={!documents || documents.length < 2}
            className="bg-[#c5a059] hover:bg-[#b38f48] text-white font-medium px-4 py-2 rounded-full transition-colors disabled:opacity-40"
          >
            総集編を編成する
          </button>
        </div>

        <section className="w-full">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink/70">あなたの本棚</h2>
          </div>

          {documents === undefined && (
            <p className="text-sm text-ink/50">読み込み中…</p>
          )}

          {documents !== undefined && documents.length === 0 && (
            <p className="text-sm text-ink/50">まだ作品がありません。上のボタンから作成してください。</p>
          )}

          {documents && documents.length > 0 && (
            <Bookshelf
              documents={documents}
              onOpen={(id) => router.push(`/editor?id=${id}`)}
              onRename={async (id, title) => {
                await db.documents.update(id, { title });
              }}
              onDelete={setPendingDeleteId}
            />
          )}
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

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
import { useAuth } from "@/components/AuthProvider";
import { LOCAL_ONLY_NOTICE_SESSION_KEY } from "@/lib/localOnlyNotice";
import { getProjectsResult } from "@/lib/supabase/projects";
import type { Project } from "@/types/database";

// ローカル（このブラウザの IndexedDB）に保存できる作品数の上限。
// 全プラン共通（Traveler / Resident / Light / Unlimited）。サンプル（使い方ガイド）は含まない。
const LOCAL_DOCUMENT_LIMIT = 60;
type BookshelfTab = "local" | "cloud";

export default function Home() {
  const router = useRouter();
  const { user, session, isLoading: isAuthLoading } = useAuth();
  useEffect(() => {
    ensureSampleProject();
  }, []);
  const documents = useLiveQuery(() => listDocuments(), []);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);
  const [localOnlyNotice, setLocalOnlyNotice] = useState<{ count: number } | null>(null);
  const [selectedBookshelfTab, setSelectedBookshelfTab] = useState<BookshelfTab | null>(null);
  const [cloudResult, setCloudResult] = useState<{
    userId: string;
    sessionToken: string;
    projects: Project[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user || !session) return;
    let cancelled = false;

    void getProjectsResult().then(({ data, error }) => {
      if (!cancelled) {
        setCloudResult({
          userId: user.id,
          sessionToken: session.access_token,
          projects: data,
          error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const count = await db.documents.filter((doc) => !doc.isSample).count();
      if (count >= LOCAL_DOCUMENT_LIMIT) {
        setIsLimitModalOpen(true);
        return;
      }
      const id = await createDocument();
      router.push(`/editor?id=${id}`);
    } finally {
      setCreating(false);
    }
  };

  // ログイン状態で、このブラウザに保存された作品が1件以上ある場合、
  // ログインセッションにつき1回だけ安全案内を表示する。
  // 注意: ここでは自動アップロード・自動マージ・自動削除は一切行わない。
  // DocumentRecord には「ログアウト中に作成されたか」を判定する情報がないため、
  // 文言・ロジックとも「ブラウザに保存されているかどうか」だけを事実として扱う。
  useEffect(() => {
    if (!user || documents === undefined) return;
    if (sessionStorage.getItem(LOCAL_ONLY_NOTICE_SESSION_KEY)) return;
    const localCount = documents.filter((doc) => !doc.isSample).length;
    if (localCount === 0) return;
    sessionStorage.setItem(LOCAL_ONLY_NOTICE_SESSION_KEY, "1");
    setLocalOnlyNotice({ count: localCount });
  }, [user, documents]);

  const handleDelete = async (id: number) => {
    await deleteDocument(id);
    setPendingDeleteId(null);
  };

  const pendingDoc = documents?.find((doc) => doc.id === pendingDeleteId);
  const visibleCloudResult =
    user && session &&
    cloudResult?.userId === user.id &&
    cloudResult.sessionToken === session.access_token
      ? cloudResult
      : null;
  const localProjectCount = documents?.filter((doc) => !doc.isSample).length ?? 0;
  const cloudIsResolved = !!visibleCloudResult && !visibleCloudResult.error;
  const showEmptyState =
    documents !== undefined &&
    localProjectCount === 0 &&
    (user
      ? cloudIsResolved && visibleCloudResult.projects.length === 0
      : !isAuthLoading);
  const initialBookshelfTab: BookshelfTab =
    user && localProjectCount === 0 && cloudIsResolved && visibleCloudResult.projects.length > 0
      ? "cloud"
      : "local";
  const activeBookshelfTab =
    selectedBookshelfTab === "cloud" && !user
      ? "local"
      : (selectedBookshelfTab ?? initialBookshelfTab);

  return (
    <div data-bookshelf-page className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center px-4 py-10">
        <Image
          src="/caroad_main1.png"
          alt="縦書きWebエディタ"
          width={384}
          height={578}
          priority
          className="mb-8 h-auto w-full max-w-[220px] sm:max-w-[260px]"
        />

        <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
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

        <section className="w-full" aria-label="本棚">
          <div
            className="mx-auto mb-5 flex w-fit max-w-full rounded-full border border-ink/12 bg-ink/[0.025] p-0.5"
            role="tablist"
            aria-label="表示する本棚"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeBookshelfTab === "local"}
              onClick={() => setSelectedBookshelfTab("local")}
              className={`relative min-h-9 rounded-full px-4 py-1.5 text-xs font-medium transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] sm:text-sm ${
                activeBookshelfTab === "local"
                  ? "bg-ink/10 text-ink ring-1 ring-inset ring-ink/10"
                  : "text-ink/65 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              このブラウザの本棚 <span className="ml-1 tabular-nums">{documents === undefined ? "…" : localProjectCount}</span>
            </button>
            {user && (
              <button
                type="button"
                role="tab"
                aria-selected={activeBookshelfTab === "cloud"}
                onClick={() => setSelectedBookshelfTab("cloud")}
                className={`relative min-h-9 rounded-full px-4 py-1.5 text-xs font-medium transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] sm:text-sm ${
                  activeBookshelfTab === "cloud"
                    ? "bg-ink/10 text-ink ring-1 ring-inset ring-ink/10"
                    : "text-ink/65 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                クラウドの本棚 <span className="ml-1 tabular-nums">{cloudIsResolved ? visibleCloudResult.projects.length : "…"}</span>
              </button>
            )}
          </div>

          <div role="tabpanel">
            {activeBookshelfTab === "local" && (
              <>
                {documents === undefined && <p className="text-center text-sm text-ink/50">読み込み中…</p>}
                {documents && documents.length > 0 && (
                  <Bookshelf
                    documents={documents}
                    onOpen={(id) => router.push(`/editor?id=${id}`)}
                    onRename={async (id, title) => {
                      await db.documents.update(id, { title });
                    }}
                    onDelete={setPendingDeleteId}
                    showLocalOnlyLabel={!!user}
                    showEmptyState={showEmptyState}
                  />
                )}
              </>
            )}

            {activeBookshelfTab === "cloud" && user && (
              <>
                {!visibleCloudResult && <p className="text-center text-sm text-ink/50">クラウド作品を読み込み中…</p>}
                {visibleCloudResult?.error && (
                  <p className="text-center text-sm text-ink/60">
                    クラウド作品を読み込めませんでした。このブラウザの作品は引き続き利用できます。
                  </p>
                )}
                {cloudIsResolved && visibleCloudResult.projects.length === 0 && (
                  <p className="py-16 text-center text-sm text-ink/50">クラウドに保存された本はまだありません。</p>
                )}
                {cloudIsResolved && visibleCloudResult.projects.length > 0 && (
                  <Bookshelf
                    cloudProjects={visibleCloudResult.projects}
                    onOpenCloud={(id) => router.push(`/editor?cloudId=${encodeURIComponent(id)}`)}
                  />
                )}
              </>
            )}
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
            <h3 className="text-sm font-semibold text-ink">このブラウザの本棚がいっぱいです</h3>
            <p className="mt-2 text-sm text-ink/70">
              このブラウザには最大{LOCAL_DOCUMENT_LIMIT}作品まで保存できます。不要な作品を整理するか、会員の場合は必要な作品をクラウドに保存できます。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-base hover:opacity-90"
              >
                本棚を確認する
              </button>
            </div>
          </div>
        </div>
      )}

      {localOnlyNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setLocalOnlyNotice(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ink">
              このブラウザに保存されている作品があります
            </h3>
            <p className="mt-2 text-sm text-ink/70">
              このブラウザには作品が{localOnlyNotice.count}件保存されています。
            </p>
            <p className="mt-2 text-sm text-ink/70">
              作品は消えておらず、このままこのブラウザで編集できます。
            </p>
            <p className="mt-2 text-sm text-ink/70">
              ブラウザ保存の作品はクラウド保存とは別に管理されています。
            </p>
            <p className="mt-2 text-sm text-ink/70">
              別の端末や別のブラウザで利用したい場合は、必要な作品をクラウドに保存してください。
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setLocalOnlyNotice(null)}
                className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-base hover:opacity-90"
              >
                このまま使う
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

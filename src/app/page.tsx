"use client";

import Image from "next/image";
import Link from "next/link";
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
import HelpModal from "@/components/HelpModal";
import { Header } from "@/components/Header";
import { Bookshelf } from "@/components/bookshelf/Bookshelf";
import { useAuth } from "@/components/AuthProvider";
import { withBasePath } from "@/lib/basePath";
import { LOCAL_ONLY_NOTICE_SESSION_KEY } from "@/lib/localOnlyNotice";
import { INQUIRY_FORM_URL } from "@/components/legal/LegalArticle";
import { getProjectsResult } from "@/lib/supabase/projects";
import { getCloudPlan, type CloudPlan } from "@/lib/supabase/plans";
import {
  getProjectCloudImageMetas,
  type ProjectCloudImageMeta,
} from "@/lib/supabase/manuscriptImages";
import type { Project } from "@/types/database";

// ローカル（このブラウザの IndexedDB）に保存できる作品数の上限。
// 全プラン共通（Traveler / Resident / Light / Unlimited）。サンプル（使い方ガイド）は含まない。
const LOCAL_DOCUMENT_LIMIT = 60;

// public/help/backup-caroad.png — TSP-LOOP-021 §6 で受領済み（1036×816 透過PNG,
// 〜154KB）。バックアップ案内カードのイラストとして表示する。差し替え時も
// このカードだけを見ればよいよう、参照は withBasePath("/help/…") 経由で統一。
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [localOnlyNotice, setLocalOnlyNotice] = useState<{ count: number } | null>(null);
  const [selectedBookshelfTab, setSelectedBookshelfTab] = useState<BookshelfTab | null>(null);
  const [cloudResult, setCloudResult] = useState<{
    userId: string;
    sessionToken: string;
    projects: Project[];
    error: string | null;
  } | null>(null);
  const [cloudPlan, setCloudPlan] = useState<CloudPlan | null>(null);
  // TSP-LOOP-007: クラウド作品ごとの一時挿絵の期限/欠損状態（軽量・1クエリ）。
  const [cloudImageMetas, setCloudImageMetas] = useState<Map<string, ProjectCloudImageMeta>>(
    new Map()
  );

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

    void getProjectCloudImageMetas().then((metas) => {
      if (!cancelled) setCloudImageMetas(metas);
    });

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  // 短編集・再録本メーカー（今後リリース予定）の利用可否判定用。
  // 未ログイン時は下記 userStatus の算出側で null（Traveler）扱いにするため、
  // ここではログイン時のみ取得すれば足りる。
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void getCloudPlan().then(({ plan }) => {
      if (!cancelled) setCloudPlan(plan);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

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
  // 実作品（使い方ガイドを除く）がLocal・Cloudいずれかに1件以上あるかどうか。
  // Cloud未解決中はLocalの件数だけで判定し、誤って非空Visualへ切り替えない。
  const isNonEmptyVisual =
    documents !== undefined &&
    (localProjectCount > 0 ||
      (!!user && cloudIsResolved && visibleCloudResult.projects.length > 0));
  const outerClassName = isNonEmptyVisual
    ? "flex min-h-dvh flex-col bg-[linear-gradient(to_bottom,#aeb4c0,#69738a)] px-0 min-[641px]:px-[29px] min-[921px]:px-[82px] dark:bg-[linear-gradient(to_bottom,#1B2433,#080B12)]"
    : "flex min-h-dvh flex-col bg-[#f9f8f6] dark:bg-[#11151D]";
  const nonEmptyShellClassName =
    "flex min-h-dvh w-full max-w-[1160px] flex-1 flex-col mx-auto bg-[#f9f8f6] text-[#1f2a44] shadow-[0_0_0_1px_rgba(31,42,68,0.04)] dark:bg-[#11151D] dark:text-[#D4DBE7] dark:shadow-none";

  const renderBrandPanel = (mode: "onboarding" | "informational") => {
    const onboarding = mode === "onboarding";
    return (
      <section
        data-home-brand-panel={mode}
        className={`w-full overflow-hidden ${onboarding ? "max-w-[980px] bg-transparent px-2 py-8 sm:px-8 sm:py-10" : "border-y border-ink/10 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.16),transparent_42%),linear-gradient(135deg,#fffdf8,#f1ece3)] px-5 py-7 sm:px-8 sm:py-8 dark:border-[#2A3240] dark:bg-[linear-gradient(135deg,#171C26,#11151D)]"}`}
        aria-labelledby={`tatespun-home-title-${mode}`}
      >
        <div className={`grid items-center ${onboarding ? "grid-cols-1 gap-8 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(230px,310px)] min-[720px]:gap-12" : "grid-cols-[minmax(0,1fr)_80px] gap-5 sm:grid-cols-[minmax(0,1fr)_112px]"}`}>
          <div>
            {!onboarding && <p className="text-[10px] font-bold tracking-[0.2em] text-accent dark:text-[#C6AF63]">MANUSCRIPT TO BOOK</p>}
            <h1 id={`tatespun-home-title-${mode}`} className={`${onboarding ? "font-serif text-[clamp(34px,7vw,60px)] leading-[1.18]" : "mt-2 font-serif text-[clamp(24px,4vw,38px)] leading-tight"} font-medium tracking-[0.02em] text-ink dark:text-[#D4DBE7]`}>
              {onboarding ? <><span className="block">どこで綴っても、</span><span className="block">ひとつの本になる。</span></> : "どこで綴っても、ひとつの本になる。"}
            </h1>
            {!onboarding && <p className="mt-2 text-sm text-ink/70 dark:text-[#AEB7C6]">小説同人誌のための縦組み・入稿準備Webエディタ</p>}
            <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-ink/65 sm:text-xs dark:text-[#AEB7C6]">
              <li>原稿を持ち込む</li><li aria-hidden="true">→</li><li>本の形で確認する</li><li aria-hidden="true">→</li><li>PDF / JPGで持ち帰る</li><li aria-hidden="true">→</li><li>入稿前に確認する</li>
            </ol>
            {onboarding && (
              <div data-home-onboarding-actions="" className="mt-5 grid max-w-xl gap-3">
                <button type="button" onClick={handleCreate} disabled={creating} className="w-fit rounded-full bg-ink px-7 py-3 text-sm font-semibold text-base shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[#C6AF63] dark:text-[#11151D]">＋ 新しい作品を作成する</button>
                <Link data-home-demo-card="" href="/editor?demo=1" className="group block max-w-md rounded-xl border border-ink/20 bg-white/60 px-4 py-3 text-ink hover:bg-white dark:border-[#3A4658] dark:bg-[#171C26] dark:text-[#D4DBE7]"><strong className="block text-sm">3分でわかる TateSpun おためしデモ</strong><span className="mt-1 block text-xs leading-relaxed text-ink/55 dark:text-[#939DAF]">実際のエディターを触りながら、基本操作を順番に試せます。</span><span data-home-demo-cta="" className="mt-2 inline-flex rounded-full border border-ink/25 px-4 py-1.5 text-sm font-semibold text-ink transition-colors group-hover:bg-ink/5 dark:border-[#4A5668] dark:text-[#D4DBE7] dark:group-hover:bg-[#1D2430]">デモを始める ▶</span></Link>
              </div>
            )}
            {!onboarding && <p className="mt-3 max-w-3xl text-[10px] leading-4 text-ink/50 dark:text-[#939DAF]">他のアプリの原稿もTXTで持ち込めます。プレビューと書き出しはブラウザ内で処理し、原稿や画像をAI・外部サービスへ無断送信しません。出力ファイルはあなたのものです。</p>}
          </div>
          <Image src={withBasePath("/caroad_main1.png")} alt="縦書きWebエディタ" width={384} height={578} priority={onboarding} className={`h-auto w-full ${onboarding ? "max-w-[310px] justify-self-center max-[719px]:hidden min-[720px]:justify-self-end" : "max-w-[112px] justify-self-end"}`} />
        </div>
      </section>
    );
  };

  const homeContent = (
    <>
      <Header variant={isNonEmptyVisual ? "home" : "editor"} />

      <main
        className={
          isNonEmptyVisual
            ? "mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 py-10"
            : "mx-auto flex min-h-0 w-full max-w-[1160px] flex-1 flex-col items-center px-4 py-6 sm:py-10"
        }
      >
        {isNonEmptyVisual ? (
          <section data-home-returning-bookshelf="" className="w-full" aria-label="本棚">
            <div className="mb-5 border-b border-ink/10 pb-4 dark:border-[#2A3240]">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-accent dark:text-[#C6AF63]">YOUR BOOKSHELF</p>
              <h1 className="mt-1 font-serif text-2xl font-medium text-ink sm:text-3xl dark:text-[#D4DBE7]">あなたの本棚</h1>
              <div data-home-returning-actions="" className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleCreate} disabled={creating} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-base disabled:opacity-50 dark:bg-[#C6AF63] dark:text-[#11151D]">新しい作品を作成する</button>
                <Link href="/editor?demo=1" className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink dark:border-[#3A4658] dark:text-[#D4DBE7]">おためしデモ</Link>
                <button type="button" onClick={() => setIsCombineModalOpen(true)} disabled={!documents || documents.length < 2} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink/70 hover:bg-ink/5 disabled:opacity-40 dark:border-[#3A4658] dark:text-[#D4DBE7]">総集編を編成する</button>
              </div>
            </div>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex w-fit max-w-full flex-wrap rounded-full border border-ink/12 bg-ink/[0.025] p-0.5"
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
                      ? "bg-ink/10 text-ink ring-1 ring-inset ring-ink/10 dark:bg-[#1D2430] dark:text-[#D4DBE7] dark:ring-[#3A4658]"
                      : "text-ink/65 hover:bg-ink/5 hover:text-ink dark:text-[#939DAF] dark:hover:bg-[#1D2430] dark:hover:text-[#D4DBE7]"
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
                        ? "bg-ink/10 text-ink ring-1 ring-inset ring-ink/10 dark:bg-[#1D2430] dark:text-[#D4DBE7] dark:ring-[#3A4658]"
                        : "text-ink/65 hover:bg-ink/5 hover:text-ink dark:text-[#939DAF] dark:hover:bg-[#1D2430] dark:hover:text-[#D4DBE7]"
                    }`}
                  >
                    クラウドの本棚 <span className="ml-1 tabular-nums">{cloudIsResolved ? visibleCloudResult.projects.length : "…"}</span>
                  </button>
                )}
              </div>
              <p className="text-sm text-ink/55 dark:text-[#939DAF]">
                {activeBookshelfTab === "cloud" ? "クラウド保存された作品" : "この端末に保存されている作品"}
              </p>
            </div>

            <div
              role="tabpanel"
              className="rounded-[18px] border border-[rgba(31,42,68,0.14)] bg-[rgba(255,255,255,0.56)] px-2.5 pt-4 pb-6 shadow-[0_18px_48px_rgba(26,31,45,0.08)] sm:px-6 sm:pt-5 sm:pb-7 dark:border-[#2A3240] dark:bg-[#171C26] dark:shadow-none"
            >
              <div className="flex items-center justify-between gap-4 pb-3">
                <div className="grid gap-1">
                  <span className="text-sm font-extrabold tracking-[0.14em] text-accent dark:text-[#C6AF63]">BOOKS</span>
                  <strong className="text-lg font-bold text-ink dark:text-[#D4DBE7]">
                    {activeBookshelfTab === "cloud" ? "クラウドの本棚" : "このブラウザの本棚"}
                  </strong>
                </div>
              </div>

              <div className="mt-[25px]">
                {activeBookshelfTab === "local" && (
                  <>
                    {documents === undefined && <p className="text-center text-sm text-ink/50">読み込み中…</p>}
                    {documents && documents.length > 0 && (
                      <>
                        <Bookshelf
                          documents={documents}
                          onOpen={(id) => router.push(`/editor?id=${id}`)}
                          onRename={async (id, title) => {
                            await db.documents.update(id, { title });
                          }}
                          onDelete={setPendingDeleteId}
                          showLocalOnlyLabel={!!user}
                          showEmptyState={showEmptyState}
                          collapsible
                        />
                        <p className="mt-1 text-center text-sm text-ink/55 dark:text-[#939DAF]">
                          作品はこの本棚から、いつでも続きを開けます。
                        </p>
                      </>
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
                      <>
                        <Bookshelf
                          cloudProjects={visibleCloudResult.projects}
                          cloudImageMetas={cloudImageMetas}
                          onOpenCloud={(id) => router.push(`/editor?cloudId=${encodeURIComponent(id)}`)}
                          collapsible
                        />
                        <p className="mt-1 text-center text-sm text-ink/55 dark:text-[#939DAF]">
                          作品はこの本棚から、いつでも続きを開けます。
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section data-home-empty-onboarding="" className="w-full" aria-label="最初の一冊">
            {documents === undefined && <p className="text-center text-sm text-ink/50">読み込み中…</p>}
            {documents !== undefined && (
              <>
                {renderBrandPanel("onboarding")}
                <section data-home-empty-bookshelf="" aria-labelledby="empty-bookshelf-title" className="mx-auto mt-12 w-full max-w-[820px] border-t border-ink/10 pt-12 dark:border-[#2A3240] sm:mt-16 sm:pt-14">
                  <div className="px-2 sm:px-7">
                    <p className="text-[10px] font-semibold tracking-[0.2em] text-accent dark:text-[#C6AF63]">YOUR BOOKSHELF</p>
                    <h2 id="empty-bookshelf-title" className="mt-1 font-serif text-2xl font-medium text-ink dark:text-[#D4DBE7]">あなたの本棚</h2>
                  </div>
                  <div className="relative z-10 mt-1">
                    <Bookshelf
                      documents={documents}
                      onOpen={(id) => router.push(`/editor?id=${id}`)}
                      showEmptyState
                    />
                  </div>
                </section>
              </>
            )}
          </section>
        )}
      </main>

      {/* NON-EMPTY / EMPTY共通の下部帯（Quick Actions / About / Footer）。
          data-nonempty-shellの外（Empty分岐）でも同じ1160px幅に収まるよう、
          data-nonempty-shellと同じmax-widthをここでも明示している。 */}
      <div className="mx-auto w-full max-w-[1160px]">
        <section
          className="px-4 pt-[45px] pb-[65px] sm:px-[clamp(20px,5vw,62px)] sm:pt-[50px] sm:pb-[90px]"
          aria-labelledby="quick-actions-title"
        >
          <div className="mb-[22px] text-center">
            <p className="mb-2 text-sm font-extrabold tracking-[0.18em] text-accent dark:text-[#C6AF63]">FROM THE SHELF</p>
            <h2 id="quick-actions-title" className="mt-[3px] font-serif text-3xl font-medium text-ink dark:text-[#D4DBE7]">
              本棚からできること
            </h2>
          </div>

          <div className="mx-auto grid max-w-[760px] grid-cols-1 gap-[10px] sm:grid-cols-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="grid min-h-[120px] content-center place-items-center gap-2 rounded-[14px] border border-[rgba(31,42,68,0.14)] bg-[rgba(255,255,255,0.56)] text-ink transition-transform hover:border-[rgba(31,42,68,0.28)] hover:-translate-y-0.5 disabled:opacity-50 sm:min-h-[148px] dark:border-[#2A3240] dark:bg-[#171C26] dark:text-[#D4DBE7] dark:hover:border-[#3A4658]"
            >
              <span aria-hidden="true" className="text-[28px] text-accent dark:text-[#C6AF63]">✎</span>
              <strong className="text-lg">新しい本を書く</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">新しい作品を作成する</small>
            </button>

            <button
              type="button"
              onClick={() => setIsCombineModalOpen(true)}
              disabled={!documents || documents.length < 2}
              className="grid min-h-[120px] content-center place-items-center gap-2 rounded-[14px] border border-[rgba(31,42,68,0.14)] bg-[rgba(255,255,255,0.56)] text-ink transition-transform hover:border-[rgba(31,42,68,0.28)] hover:-translate-y-0.5 disabled:opacity-50 sm:min-h-[148px] dark:border-[#2A3240] dark:bg-[#171C26] dark:text-[#D4DBE7] dark:hover:border-[#3A4658]"
            >
              <span aria-hidden="true" className="text-[28px] text-accent dark:text-[#C6AF63]">▤</span>
              <strong className="text-lg">本をまとめる</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">短編集・再録集を編成する</small>
            </button>

            {/* 「使い方を見る」: 新規ガイドページは作らず、ヘッダーの「？」と同じ
                既存の HelpModal（使い方ガイド）を開く。 */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="grid min-h-[120px] content-center place-items-center gap-2 rounded-[14px] border border-[rgba(31,42,68,0.14)] bg-[rgba(255,255,255,0.56)] text-ink transition-transform hover:border-[rgba(31,42,68,0.28)] hover:-translate-y-0.5 sm:min-h-[148px] dark:border-[#2A3240] dark:bg-[#171C26] dark:text-[#D4DBE7] dark:hover:border-[#3A4658]"
            >
              <span aria-hidden="true" className="text-[28px] text-accent dark:text-[#C6AF63]">?</span>
              <strong className="text-lg">使い方を見る</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">本棚・エディタ・書き出し</small>
            </button>
          </div>

          {/* TSP-LOOP-008 / TSP-LOOP-021 §1 / §5: 画像保存の説明。
              「この端末で使うとき（A）」と「クラウド保存を使うとき（B）」を
              はっきり分ける。72時間タイマーはBのクラウド一時コピーだけに
              かかる。実機テスターが「72時間以内に触らないと画像が消える？」と
              誤解したため、"何もしなくて大丈夫" を明示する。「ブラウザ保存だから
              絶対に消えない」とは書かない。 */}
          <aside
            aria-labelledby="image-storage-note-title"
            className="mx-auto mt-[26px] max-w-[760px] rounded-[14px] border border-[rgba(31,42,68,0.14)] border-l-[3px] border-l-accent bg-[rgba(198,175,99,0.06)] px-5 py-5 sm:px-7 sm:py-6 dark:border-[#2A3240] dark:border-l-[#C6AF63] dark:bg-[rgba(198,175,99,0.05)]"
          >
            <h3
              id="image-storage-note-title"
              className="mb-1 font-serif text-lg font-medium text-ink dark:text-[#D4DBE7]"
            >
              ◇ TateSpunは画像挿入が可能！
            </h3>
            <p className="mb-4 font-serif text-base text-ink/80 dark:text-[#B9C2D0]">
              でも、画像はどこに保存される？
            </p>

            <div className="space-y-4 text-sm leading-relaxed text-ink/75 dark:text-[#B9C2D0]">
              <div>
                <p className="mb-1 font-semibold text-ink dark:text-[#D4DBE7]">A. この端末で使うとき</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>挿入した画像は、TateSpunがこの端末のブラウザに保存する作業データと一緒に保存され、作品にそのまま使われます。</li>
                  <li>この端末内の画像には、下記の「クラウド一時コピーの72時間」は関係ありません。TateSpun側でこの端末の画像を72時間後に削除することはありません。</li>
                  <li>ただし、ブラウザのデータ削除・別のブラウザ・別の端末・端末の故障や初期化などでは、この作業データを引き継げないことがあります。ブラウザ保存が永久に残ることを保証するものではありません。</li>
                </ul>
              </div>

              <div>
                <p className="mb-1 font-semibold text-ink dark:text-[#D4DBE7]">B. クラウド保存を使うとき（会員）</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>別の端末でも作品を復元できるよう、画像の一時コピーがクラウドへアップロードされます。</li>
                  <li>β版では、このクラウド上の一時コピーの寿命は72時間です。</li>
                  <li>画像を含むクラウド保存に再度成功すると、期限はその時点から72時間に更新されます。</li>
                </ul>
              </div>

              <p className="rounded-[10px] border border-l-[3px] border-l-accent bg-[rgba(198,175,99,0.1)] px-4 py-3 font-medium text-ink dark:border-[#2A3240] dark:border-l-[#C6AF63] dark:bg-[rgba(198,175,99,0.08)] dark:text-[#D4DBE7]">
                72時間で削除されるのは、クラウド上の一時コピーです。原稿本文や、この端末の画像を72時間後に削除するという意味ではありません。この端末で作業を続けるだけなら、72時間以内に何かをする必要はありません。
              </p>
            </div>
          </aside>

          {/* TSP-LOOP-021 §3 / §6: 原稿バックアップのやさしい注意喚起（法的な
              免責文ではなく、友達口調のリマインド）。イラストは受領済み。 */}
          <aside
            aria-labelledby="backup-reminder-title"
            className="mx-auto mt-[14px] flex max-w-[760px] items-center gap-4 rounded-[14px] border border-[rgba(31,42,68,0.14)] bg-[rgba(255,255,255,0.5)] px-5 py-5 sm:px-7 sm:py-6 dark:border-[#2A3240] dark:bg-[#171C26]"
          >
            <Image
              src={withBasePath("/help/backup-caroad.png")}
              alt="原稿のバックアップをすすめる、カロードのイラスト"
              width={1036}
              height={816}
              className="h-auto w-[120px] shrink-0 sm:w-[150px] md:w-[180px]"
            />
            <div>
              <h3
                id="backup-reminder-title"
                className="mb-2 font-serif text-lg font-medium text-ink dark:text-[#D4DBE7]"
              >
                ◇ 大切な原稿は、ときどきバックアップを
              </h3>
              <p className="text-sm leading-relaxed text-ink/75 dark:text-[#B9C2D0]">
                ブラウザのデータ削除や端末トラブルに備えて、本文の控えや、PDF・JPGなどの書き出しデータを、別の場所にも保存しておくと安心です。
              </p>
            </div>
          </aside>
        </section>

        {isNonEmptyVisual ? renderBrandPanel("informational") : <section
          className="border-t border-[rgba(31,42,68,0.14)] bg-ink/[0.025] px-[18px] py-[50px] sm:px-[clamp(24px,6vw,72px)] sm:py-[54px] dark:border-[#2A3240]"
          aria-label="TateSpunについて"
        >
          <div className="grid grid-cols-1 items-center gap-[30px] min-[921px]:grid-cols-[1fr_180px]">
            <div className="text-center min-[921px]:text-left">
              <p className="mb-2 text-sm font-extrabold tracking-[0.18em] text-accent dark:text-[#C6AF63]">TATESPUN</p>
              <h2 className="mt-1 text-balance font-serif text-3xl font-medium text-ink dark:text-[#D4DBE7]">書く場所は、静かでいい。</h2>
              <p className="mt-2.5 text-sm text-ink/55 dark:text-[#939DAF]">
                TateSpunは、縦書きで書く・整える・本にするための道具です。
                <br />
                本棚は、その途中に何度でも戻ってくる場所。
              </p>
            </div>

            <div className="flex justify-center min-[921px]:justify-end">
              <Image
                src={withBasePath("/caroad_main2.png")}
                alt="TateSpun"
                width={384}
                height={341}
                className="h-auto w-[150px] dark:hidden"
              />
              <Image
                src={withBasePath("/caroad_main3.png")}
                alt="TateSpun"
                width={384}
                height={341}
                className="hidden h-auto w-[150px] dark:block"
              />
            </div>
          </div>
        </section>}

        <footer className="flex flex-col items-center gap-3 border-t border-[rgba(31,42,68,0.14)] px-[clamp(20px,5vw,58px)] pt-[25px] pb-10 text-center dark:border-[#2A3240] sm:flex-row sm:flex-wrap sm:items-center sm:text-left">
          <div className="flex items-baseline gap-1.5">
            <strong className="text-base font-bold text-ink dark:text-[#D4DBE7]">TateSpun</strong>
            <span className="text-sm text-ink/55 dark:text-[#939DAF]">/ SpunTales</span>
          </div>

          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start"
            aria-label="フッター"
          >
            <Link
              href="/terms"
              className="text-sm text-ink/60 hover:text-ink dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
            >
              利用規約
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-ink/60 hover:text-ink dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
            >
              プライバシーポリシー
            </Link>
            <a
              href={INQUIRY_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink/60 hover:text-ink dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
            >
              お問い合わせ
            </a>
          </nav>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="ページ上部へ戻る"
            className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[rgba(31,42,68,0.14)] text-ink transition-colors hover:border-[rgba(31,42,68,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:border-[#2A3240] dark:text-[#D4DBE7] dark:hover:border-[#3A4658] sm:mx-0 sm:ml-auto"
          >
            ↑
          </button>
        </footer>
      </div>
    </>
  );

  return (
    <div data-bookshelf-page className={outerClassName}>
      {isNonEmptyVisual ? (
        <div data-nonempty-shell className={nonEmptyShellClassName}>
          {homeContent}
        </div>
      ) : (
        homeContent
      )}

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
        userStatus={{ plan: user ? cloudPlan : null }}
      />

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

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

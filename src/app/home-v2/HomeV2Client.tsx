"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  createDocument,
  db,
  deleteDocument,
  ensureSampleProject,
  listDocuments,
  type DocumentRecord,
} from "@/lib/db";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { CombineModal } from "@/components/CombineModal";
import HelpModal from "@/components/HelpModal";
import { Header } from "@/components/Header";
import { UpdateHistoryAccordion } from "@/components/UpdateHistoryAccordion";
import { Bookshelf } from "@/components/bookshelf/Bookshelf";
import { useAuth } from "@/components/AuthProvider";
import { withBasePath } from "@/lib/basePath";
import { LOCAL_ONLY_NOTICE_SESSION_KEY } from "@/lib/localOnlyNotice";
import { INQUIRY_FORM_URL } from "@/components/legal/LegalArticle";
import {
  SUPPORT_FANBOX_URL,
  SUPPORT_OFUSE_URL,
  SUPPORT_HEADING,
  SUPPORT_BODY,
  SUPPORT_FANBOX_LABEL,
  SUPPORT_OFUSE_LABEL,
  SUPPORT_NOTE,
} from "@/lib/supportLinks";
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

const QA_BOOKS: DocumentRecord[] = [
  {
    id: -101,
    title: "雨音の向こう側",
    content: "Human QA専用の読み取り専用サンプルです。",
    settings: DEFAULT_PAGE_SETTINGS,
    plotNote: "",
    updatedAt: Date.UTC(2026, 8, 24, 10, 30),
  },
  {
    id: -102,
    title: "星を綴じる夜",
    content: "V2本棚の表示確認にだけ使用します。",
    settings: DEFAULT_PAGE_SETTINGS,
    plotNote: "",
    updatedAt: Date.UTC(2026, 8, 18, 18, 0),
  },
];

// public/help/backup-caroad.png — TSP-LOOP-021 §6 で受領済み（1036×816 透過PNG,
// 〜154KB）。バックアップ案内カードのイラストとして表示する。差し替え時も
// このカードだけを見ればよいよう、参照は withBasePath("/help/…") 経由で統一。
type BookshelfTab = "local" | "cloud";

interface HomeV2ClientProps {
  allowQaMode?: boolean;
}

export default function HomeV2Client({ allowQaMode = false }: HomeV2ClientProps) {
  const router = useRouter();
  const demo = useSearchParams().get("demo");
  const qaMode = allowQaMode && (demo === "empty" || demo === "books") ? demo : undefined;
  const { user: authUser, session: authSession, isLoading: authIsLoading } = useAuth();
  const user = qaMode ? null : authUser;
  const session = qaMode ? null : authSession;
  const isAuthLoading = qaMode ? false : authIsLoading;
  useEffect(() => {
    if (!qaMode) void ensureSampleProject();
  }, [qaMode]);
  const storedDocuments = useLiveQuery(
    () => (qaMode ? Promise.resolve([] as DocumentRecord[]) : listDocuments()),
    [qaMode]
  );
  const documents = useMemo(
    () => (qaMode === "empty" ? [] : qaMode === "books" ? QA_BOOKS : storedDocuments),
    [qaMode, storedDocuments]
  );
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);
  // 「本をまとめる」を作品2冊未満で押したときの案内（無反応にしない）。
  const [showCombineGuide, setShowCombineGuide] = useState(false);
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
  // Phase 3: on phones, a small dock (次の一冊 / 続きを書く) appears once the
  // shelf's own actions have scrolled out of view.
  const [dockVisible, setDockVisible] = useState(false);
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
    if (qaMode) {
      router.push("/editor?demo=1");
      return;
    }
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
    // Inherited production behavior: surface the one-per-session safety notice
    // after synchronizing its sessionStorage guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalOnlyNotice({ count: localCount });
  }, [user, documents]);

  const handleDelete = async (id: number) => {
    if (qaMode) {
      setPendingDeleteId(null);
      return;
    }
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
  // 「本をまとめる」は自分の作品（使い方ガイドのサンプルは数えない）が2冊以上あるときに開く。
  const canCombine = localProjectCount >= 2;
  const handleCombineClick = () => {
    if (qaMode) return;
    if (canCombine) {
      setShowCombineGuide(false);
      setIsCombineModalOpen(true);
      return;
    }
    setShowCombineGuide(true);
    window.requestAnimationFrame(() => {
      const guide = document.getElementById("home-combine-guide");
      guide?.scrollIntoView({ behavior: "smooth", block: "center" });
      guide?.focus({ preventScroll: true });
    });
  };
  // Display only (the shelf's own order and data are untouched): the works
  // this browser holds, most recently written first, for the shelf's
  // "RECENTLY" line and its count / last-written date.
  const recentDocuments = useMemo(
    () => (documents ?? []).filter((doc) => !doc.isSample).sort((a, b) => b.updatedAt - a.updatedAt),
    [documents]
  );
  const formatShelfDate = (time: number) =>
    new Date(time).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
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
  useEffect(() => {
    if (!isNonEmptyVisual || typeof IntersectionObserver === "undefined") return;
    const actions = document.querySelector("[data-home-returning-actions]");
    if (!actions) return;
    const observer = new IntersectionObserver(([entry]) => {
      setDockVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(actions);
    return () => observer.disconnect();
  }, [isNonEmptyVisual]);
  const outerClassName = isNonEmptyVisual
    ? "home-v2-shell flex min-h-dvh flex-col px-0 min-[641px]:px-[29px] min-[921px]:px-[82px]"
    : "home-v2-shell flex min-h-dvh flex-col";
  const nonEmptyShellClassName =
    "flex min-h-dvh w-full max-w-[1160px] flex-1 flex-col mx-auto bg-[rgba(250,248,242,0.78)] text-[#17243a] shadow-[0_0_0_1px_rgba(31,42,68,0.05),0_26px_90px_rgba(31,42,68,0.12)] backdrop-blur-[2px] dark:bg-[rgba(16,21,29,0.9)] dark:text-[#E4DFD3] dark:shadow-none";

  // Phase 3: the four steps from manuscript to book, drawn as one thread
  // with large numerals (the same four steps the brand panel always listed).
  const bookSteps: { title: string; body: string }[] = [
    { title: "原稿を持ち込む", body: "ここで書きはじめても、他のアプリの原稿をTXTで読み込んでも。" },
    { title: "本の形で確認する", body: "縦組みのプレビューで、ページの見え方をそのまま確かめます。" },
    { title: "PDF / JPGで持ち帰る", body: "書き出しはブラウザ内で処理します。出力ファイルはあなたのものです。" },
    { title: "入稿前に確認する", body: "完成前チェックで、入稿前の見落としを一つずつ確かめます。" },
  ];
  const renderSteps = (compact: boolean) => (
    <ol className={`home-p3-thread ${compact ? "home-p3-thread-compact" : ""}`}>
      {bookSteps.map((step, index) => (
        <li key={step.title} className="home-p3-step">
          <span aria-hidden="true" className="home-p3-step-no">{String(index + 1).padStart(2, "0")}</span>
          <strong className="home-p3-step-title">{step.title}</strong>
          {!compact && <span className="home-p3-step-body">{step.body}</span>}
        </li>
      ))}
    </ol>
  );

  const renderBrandPanel = (mode: "onboarding" | "informational") => {
    const onboarding = mode === "onboarding";
    if (onboarding) {
      return (
        // Phase 3 (state A): a full-bleed ink cover. The first view says what
        // TateSpun is in one line, makes the first book the one strong action,
        // and keeps Demo / HOW TO as two equal, quieter doors.
        <section
          data-home-brand-panel={mode}
          className="home-p3-cover w-full"
          aria-labelledby={`tatespun-home-title-${mode}`}
        >
          <div className="relative mx-auto grid w-full max-w-[1160px] grid-cols-1 gap-10 px-5 pt-12 pb-14 sm:px-10 sm:pt-16 sm:pb-20 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] min-[900px]:gap-16">
            <div className="min-w-0">
              <p className="home-p3-chip home-p3-chip-invert">Manuscript to Book</p>
              <h1 id={`tatespun-home-title-${mode}`} className="home-p3-cover-title mt-6 font-serif font-medium">
                <span className="block">どこで綴っても、</span><span className="block">ひとつの本になる。</span>
              </h1>
              <p className="home-p3-cover-lead mt-6 max-w-xl font-serif">書きかけの原稿をひらいて、縦組みで確かめる。<br className="hidden sm:block" />物語が紙の本になる、その直前までを静かに支えます。</p>
              <div data-home-onboarding-actions="" className="mt-9 grid max-w-2xl gap-7">
                <button type="button" onClick={handleCreate} disabled={creating} className="home-p3-cta home-p3-cta-gold w-fit">最初の一冊を書きはじめる <span aria-hidden="true">→</span></button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link data-home-demo-card="" href="/editor?demo=1" className="home-p3-ticket group"><span className="home-p3-ticket-kicker">Try · 3 min</span><strong className="block font-serif text-[15px] font-medium">3分でわかる TateSpun おためしデモ</strong><span className="mt-1 block text-xs leading-relaxed opacity-75">実際のエディターを触りながら、基本操作を順番に試せます。</span><span data-home-demo-cta="" className="home-p3-ticket-cta">デモを始める →</span></Link>
                  {/* TSP-HOWTO-BETA-016B: a first-time user needs two equally
                      obvious paths — try the demo, or read HOW TO — in the
                      same visual family, side by side. */}
                  <Link data-home-howto-card="" href="/howto" className="home-p3-ticket group"><span className="home-p3-ticket-kicker">Read · Guide</span><strong className="block font-serif text-[15px] font-medium">TateSpunの使い方を見る</strong><span className="mt-1 block text-xs leading-relaxed opacity-75">原稿を持ち込んで、本の形を確認し、書き出すまでの流れを画像つきで紹介します。</span><span data-home-howto-cta="" className="home-p3-ticket-cta">HOW TOを見る →</span></Link>
                </div>
              </div>
            </div>
            <div className="relative hidden items-end justify-end gap-6 min-[900px]:flex" aria-hidden="true">
              <p className="home-p3-cover-vertical font-serif">一冊目は、ここから。</p>
              <Image src={withBasePath("/caroad_main1.png")} alt="" width={384} height={578} priority className="h-auto w-[170px]" />
            </div>
          </div>
        </section>
      );
    }
    return (
      // Phase 3 (state B): the brand as a quiet colophon below the shelf.
      <section
        data-home-brand-panel={mode}
        className="home-v2-about w-full overflow-hidden px-5 py-14 sm:px-[clamp(24px,6vw,72px)] sm:py-16"
        aria-labelledby={`tatespun-home-title-${mode}`}
      >
        <div className="relative z-[1] grid grid-cols-[minmax(0,1fr)_80px] items-center gap-5 sm:grid-cols-[minmax(0,1fr)_112px]">
          <div>
            <p className="home-p3-chip">Manuscript to Book</p>
            <h2 id={`tatespun-home-title-${mode}`} className="home-v2-title mt-4 font-serif text-[clamp(26px,4vw,40px)] font-medium leading-tight tracking-[0.035em]">どこで綴っても、ひとつの本になる。</h2>
            <p className="mt-3 text-sm text-ink/70 dark:text-[#AEB7C6]">小説同人誌のための縦組み・入稿準備Webエディタ</p>
            <div className="mt-6">{renderSteps(true)}</div>
            <p className="mt-5 max-w-3xl text-[11px] leading-5 text-ink/55 dark:text-[#939DAF]">他のアプリの原稿もTXTで持ち込めます。プレビューと書き出しはブラウザ内で処理し、原稿や画像をAI・外部サービスへ無断送信しません。出力ファイルはあなたのものです。</p>
          </div>
          <div className="relative">
            <Image src={withBasePath("/caroad_main1.png")} alt="縦書きWebエディタ" width={384} height={578} className="relative h-auto w-full max-w-[112px] justify-self-end" />
          </div>
        </div>
      </section>
    );
  };

  const homeContent = (
    <>
      <Header variant="home" />

      <main
        className={
          isNonEmptyVisual
            ? "mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 flex-col px-4 pt-8 pb-10 sm:px-6 sm:pt-10"
            : "flex min-h-0 w-full flex-1 flex-col items-center"
        }
      >
        {isNonEmptyVisual ? (
          <section data-home-returning-bookshelf="" className="w-full" aria-label="本棚">
            {/* Phase 3 (state B): the shelf is the emotional lead. A large
                title with the shelf's own count (and a row of spines that
                grows with it), one primary action, and the last work written
                in -- one tap back into it -- beside it. */}
            <div className="home-v2-shelf-head relative pb-6">
              <span aria-hidden="true" className="home-v2-watermark">BOOKSHELF</span>
              <div className="grid grid-cols-1 gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] min-[900px]:items-end">
                <div className="min-w-0">
                  <p className="home-p3-chip">Your Bookshelf</p>
                  <h1 className="mt-4 font-serif text-[clamp(34px,5.4vw,56px)] font-medium leading-[1.12] tracking-[0.05em] text-ink dark:text-[#E4DFD3]">あなたの本棚</h1>
                  {recentDocuments.length > 0 && (
                    <div data-home-shelf-meta="" className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
                      <p className="flex items-baseline gap-1 text-ink dark:text-[#E4DFD3]">
                        <span className="home-p3-count font-serif tabular-nums">{recentDocuments.length}</span>
                        <span className="font-serif text-[16px]">冊</span>
                      </p>
                      <span aria-hidden="true" className="home-p3-meter">
                        {recentDocuments.slice(0, 24).map((doc, index) => (
                          <i key={doc.id} style={{ height: `${16 + ((index * 7) % 10)}px` }} data-tone={index % 4} />
                        ))}
                        <i data-next="" />
                      </span>
                      <p className="pb-1 text-xs text-ink/60 dark:text-[#939DAF]">
                        最後に書いた日 <span className="tabular-nums">{formatShelfDate(recentDocuments[0].updatedAt)}</span>
                      </p>
                    </div>
                  )}
                  <div data-home-returning-actions="" className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-3">
                    <button type="button" onClick={handleCreate} disabled={creating} className="home-p3-cta mr-3 inline-flex items-center gap-2">
                      <span aria-hidden="true" className="text-base leading-none">＋</span>次の一冊を書く
                    </button>
                    <Link href="/editor?demo=1" className="home-v2-quiet-link">おためしデモ</Link>
                    <button type="button" onClick={handleCombineClick} aria-disabled={!canCombine || undefined} aria-controls="home-combine-guide" className="home-v2-quiet-link">総集編を編成する</button>
                    <Link data-home-howto-top-action="" href="/howto" className="home-v2-quiet-link">TateSpun How to →</Link>
                  </div>
                </div>
                {recentDocuments[0] && (
                  <button
                    type="button"
                    data-home-continue=""
                    onClick={() => router.push(qaMode ? "/editor?demo=1" : `/editor?id=${recentDocuments[0].id}`)}
                    className="home-p3-continue group"
                  >
                    <span className="home-p3-chip">Continue</span>
                    <span className="mt-3 block font-serif text-[13px] text-ink/60 dark:text-[#AEB7C6]">いちばん最近の作品</span>
                    <span className="mt-1 block truncate font-serif text-[clamp(22px,2.6vw,28px)] font-medium leading-snug text-ink dark:text-[#E4DFD3]">{recentDocuments[0].title || "無題のドキュメント"}</span>
                    <span className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--home-line)] pt-3">
                      <span className="text-[11px] tabular-nums text-ink/55 dark:text-[#939DAF]">{formatShelfDate(recentDocuments[0].updatedAt)}</span>
                      <span className="home-p3-continue-cta">続きを書く <span aria-hidden="true">→</span></span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

            {/* The shelf on a mat: the books are the content, set on a
                framed paper ground (no heavy card), with the next book's
                empty spine waiting at its end. */}
            <div
              role="tabpanel"
              aria-label={activeBookshelfTab === "cloud" ? "クラウドの本棚" : "このブラウザの本棚"}
              className="home-p3-mat px-2 pt-2 pb-7 sm:px-6"
            >
              {/* The next book's place on the shelf: adding a work reads as
                  putting one more spine on it (same action as 次の一冊を書く). */}
              {activeBookshelfTab === "local" && (
                <button
                  type="button"
                  data-home-next-book=""
                  onClick={handleCreate}
                  disabled={creating}
                  title="本棚に次の一冊を加える（新しい作品を作成）"
                  className="home-v2-next-spine home-p3-slot mt-3 mb-1 sm:absolute sm:top-4 sm:right-6 sm:z-20 sm:m-0"
                >
                  <span aria-hidden="true" className="text-lg leading-none">＋</span>
                  <span className="home-v2-next-spine-label">次の一冊</span>
                </button>
              )}

              <div>
                {activeBookshelfTab === "local" && (
                  <>
                    {documents === undefined && <p className="text-center text-sm text-ink/50">読み込み中…</p>}
                    {documents && documents.length > 0 && (
                      <>
                        <Bookshelf
                          documents={documents}
                          onOpen={(id) => router.push(qaMode ? "/editor?demo=1" : `/editor?id=${id}`)}
                          onRename={qaMode ? undefined : async (id, title) => {
                            await db.documents.update(id, { title });
                          }}
                          onDelete={qaMode ? undefined : setPendingDeleteId}
                          showLocalOnlyLabel={!!user}
                          showEmptyState={showEmptyState}
                          collapsible
                        />
                        <p className="mt-1 text-center font-serif text-sm text-ink/55 dark:text-[#939DAF]">
                          一冊ずつ、背表紙が増えていく。続きは、いつでもこの棚から。
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

            {/* The works written in most recently after the one above, as a
                quiet numbered index (the shelf stays the place to manage). */}
            {activeBookshelfTab === "local" && recentDocuments.length > 1 && (
              <div data-home-recent="" className="mt-10">
                <p className="home-v2-label">Recently</p>
                <ol className="mt-3 grid border-t border-ink/12 sm:grid-cols-3 sm:border-t-0 dark:border-[#2A3240]">
                  {recentDocuments.slice(1, 4).map((doc, index) => (
                    <li key={doc.id} className="border-b border-ink/12 sm:border-t sm:border-b-0 dark:border-[#2A3240] sm:[&+li]:border-l">
                      <button
                        type="button"
                        onClick={() => router.push(qaMode ? "/editor?demo=1" : `/editor?id=${doc.id}`)}
                        className="home-v2-index-row group"
                      >
                        <span className="home-v2-index-no">{String(index + 2).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1 truncate text-left font-serif text-[15px] text-ink dark:text-[#D4DBE7]">{doc.title || "無題のドキュメント"}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-ink/50 dark:text-[#939DAF]">{formatShelfDate(doc.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        ) : (
          <section data-home-empty-onboarding="" className="w-full" aria-label="最初の一冊">
            {documents === undefined && <p className="py-16 text-center text-sm text-ink/50">読み込み中…</p>}
            {documents !== undefined && (
              <>
                {renderBrandPanel("onboarding")}
                {/* The empty shelf, framed on a mat with a vertical title:
                    not "nothing here yet" but room that is waiting. */}
                <section data-home-empty-bookshelf="" aria-labelledby="empty-bookshelf-title" className="home-p3-sided mx-auto mt-16 w-full max-w-[1040px] px-4 sm:mt-20 sm:px-6">
                  <div className="home-p3-side">
                    <p className="home-p3-chip">Your Bookshelf</p>
                    <h2 id="empty-bookshelf-title" className="home-p3-side-title font-serif font-medium text-ink dark:text-[#D4DBE7]">あなたの本棚</h2>
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-[15px] leading-8 text-ink/70 dark:text-[#AEB7C6]">まだ空いている棚は、次の一冊のための場所です。<br />書きはじめた作品は、ここに一冊ずつ並んでいきます。</p>
                    <div className="home-p3-mat relative mt-5 px-2 pt-4 pb-6 sm:px-6">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          data-home-next-book=""
                          onClick={handleCreate}
                          disabled={creating}
                          title="本棚に最初の一冊を加える（新しい作品を作成）"
                          className="home-v2-next-spine home-p3-slot"
                        >
                          <span aria-hidden="true" className="text-lg leading-none">＋</span>
                          <span className="home-v2-next-spine-label">最初の一冊</span>
                        </button>
                      </div>
                      <div className="relative z-10 sm:-mt-10">
                        <Bookshelf
                          documents={documents}
                          onOpen={(id) => router.push(qaMode ? "/editor?demo=1" : `/editor?id=${id}`)}
                          showEmptyState
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* How a manuscript becomes a book: four numbered steps on
                    one thread, so a first-time visitor sees the whole path. */}
                <section data-home-first-steps="" aria-labelledby="first-steps-title" className="home-p3-sided mx-auto mt-20 w-full max-w-[1040px] px-4 sm:px-6">
                  <div className="home-p3-side">
                    <p className="home-p3-chip">How it works</p>
                    <h2 id="first-steps-title" className="home-p3-side-title font-serif font-medium text-ink dark:text-[#D4DBE7]">本になるまで</h2>
                  </div>
                  <div className="min-w-0">
                    {renderSteps(false)}
                    <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-3">
                      <Link href="/editor?demo=1" className="home-p3-pill">デモで試す →</Link>
                      <Link href="/howto" className="home-p3-pill">HOW TOで読む →</Link>
                    </div>
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
          className="home-v2-section-rule home-p3-sided mt-16 px-4 pt-[58px] pb-[72px] sm:mt-20 sm:px-6 sm:pt-[72px] sm:pb-[96px] min-[1100px]:px-[60px]"
          aria-labelledby="quick-actions-title"
        >
          <div className="home-p3-side">
            <p className="home-p3-chip">From the Shelf</p>
            <h2 id="quick-actions-title" className="home-p3-side-title font-serif font-medium text-ink dark:text-[#D4DBE7]">
              本棚からできること
            </h2>
          </div>
          <div className="min-w-0">
          {/* A numbered index, not a row of cards: three actions separated by
              hairlines (same actions, handlers and disabled rules as before). */}
          <div className="home-v2-action-index grid grid-cols-1 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="home-v2-action-card"
            >
              <span className="home-v2-index-no">01</span>
              <strong className="font-serif text-lg font-medium">新しい本を書く</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">新しい作品を作成する</small>
              <span aria-hidden="true" className="home-v2-action-arrow">→</span>
            </button>

            <button
              type="button"
              onClick={handleCombineClick}
              aria-disabled={!canCombine || undefined}
              aria-controls="home-combine-guide"
              className="home-v2-action-card"
            >
              <span className="home-v2-index-no">02</span>
              <strong className="font-serif text-lg font-medium">本をまとめる</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">
                {canCombine ? "短編集・再録集を編成する" : "作品が2冊以上になるとまとめられます"}
              </small>
              <span aria-hidden="true" className="home-v2-action-arrow">→</span>
            </button>

            {/* 「使い方を見る」: 新規ガイドページは作らず、ヘッダーの「？」と同じ
                既存の HelpModal（使い方ガイド）を開く。 */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="home-v2-action-card"
            >
              <span className="home-v2-index-no">03</span>
              <strong className="font-serif text-lg font-medium">使い方を見る</strong>
              <small className="text-sm text-ink/55 dark:text-[#939DAF]">本棚・エディタ・書き出し</small>
              <span aria-hidden="true" className="home-v2-action-arrow">→</span>
            </button>
          </div>

          {/* 作品2冊未満で「本をまとめる」を押したときの案内。理由と次にできることを並べる。 */}
          {showCombineGuide && !canCombine && (
            <div
              id="home-combine-guide"
              role="status"
              tabIndex={-1}
              className="home-v2-combine-guide"
            >
              <p className="text-sm leading-relaxed text-ink/75 dark:text-[#C9D1DE]">
                本をまとめるには、このブラウザの本棚に作品が2冊以上必要です（いま{localProjectCount}冊）。
                まずは作品を書いて、本棚に並べてみましょう。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button type="button" onClick={handleCreate} disabled={creating} className="home-p3-cta inline-flex items-center gap-2">
                  <span aria-hidden="true" className="text-base leading-none">＋</span>新しい本を書く
                </button>
                <Link href="/editor?demo=1" className="home-v2-quiet-link">おためしデモで試す</Link>
              </div>
            </div>
          )}

          {/* 画像保存ガイド。初期状態では各説明を閉じ、必要な項目だけ読める
              COLUMNSTAND系のコンパクトなアコーディオン構成にする。 */}
          <aside
            aria-labelledby="image-storage-note-title"
            className="mt-16 border-b border-[rgba(31,42,68,0.14)] dark:border-[#2A3240]"
          >
            <div className="py-4">
              <p className="home-p3-chip">Image Storage Guide</p>
              <h3
                id="image-storage-note-title"
                className="mt-3 font-serif text-lg font-medium text-ink dark:text-[#D4DBE7]"
              >
                画像の保存と、期限切れについて
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink/55 dark:text-[#939DAF]">
                画像は「この端末に残る元画像」と「別端末で開くためのクラウド一時コピー」を分けて扱います。必要な項目だけ開いて確認できます。
              </p>
            </div>

            <div className="border-t border-[rgba(31,42,68,0.12)] dark:border-[#2A3240]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink marker:hidden dark:text-[#D4DBE7] [&::-webkit-details-marker]:hidden">
                  <span>ブラウザでは常時保存</span>
                  <span aria-hidden="true" className="ml-auto text-xs text-accent transition-transform group-open:rotate-180 dark:text-[#C6AF63]">▼</span>
                </summary>
                <div className="pb-4 pr-8 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
                  <p>挿入した画像は、この端末のブラウザ内に作業データとして保存されます。クラウド一時コピーの72時間制限は、この端末に保存された画像には適用されません。</p>
                  <p className="mt-2">ただし、ブラウザのサイトデータ削除・別ブラウザへの移動・端末の故障や初期化などでは引き継げない場合があります。</p>
                </div>
              </details>
            </div>

            <div className="border-t border-[rgba(31,42,68,0.12)] dark:border-[#2A3240]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink marker:hidden dark:text-[#D4DBE7] [&::-webkit-details-marker]:hidden">
                  <span>クラウドでは72時間</span>
                  <span aria-hidden="true" className="ml-auto text-xs text-accent transition-transform group-open:rotate-180 dark:text-[#C6AF63]">▼</span>
                </summary>
                <div className="pb-4 pr-8 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
                  <p>会員がクラウド保存すると、別端末でも作品を開けるよう画像の一時コピーをクラウドへ保存します。この一時コピーは72時間保持され、画像を含むクラウド保存に再度成功すると、その時点から72時間に更新されます。</p>
                  <p className="mt-2 font-medium text-ink dark:text-[#D4DBE7]">72時間で整理されるのはクラウド上の一時コピーだけです。原稿本文や、この端末の画像を削除するという意味ではありません。</p>
                </div>
              </details>
            </div>

            <div className="border-t border-[rgba(31,42,68,0.12)] dark:border-[#2A3240]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink marker:hidden dark:text-[#D4DBE7] [&::-webkit-details-marker]:hidden">
                  <span>期限切れ・画像切れには警告</span>
                  <span aria-hidden="true" className="ml-auto text-xs text-accent transition-transform group-open:rotate-180 dark:text-[#C6AF63]">▼</span>
                </summary>
                <div className="pb-4 pr-8 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
                  <p>クラウド上の一時コピーが期限切れ・欠損になり、今のブラウザにも元画像がない場合は「⚠️画像切れ」としてお知らせします。今のブラウザに元画像が残っている場合は、通常どおり編集・表示できます。</p>
                </div>
              </details>
            </div>

            <div className="border-t border-[rgba(31,42,68,0.12)] dark:border-[#2A3240]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink marker:hidden dark:text-[#D4DBE7] [&::-webkit-details-marker]:hidden">
                  <span>画像切れページを確認・同じ場所へ差し替え</span>
                  <span aria-hidden="true" className="ml-auto text-xs text-accent transition-transform group-open:rotate-180 dark:text-[#C6AF63]">▼</span>
                </summary>
                <div className="pb-4 pr-8 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
                  <p>画像を読み込めないページはプレビューのフッターから一覧で確認できます。該当ページへ移動し、その場で画像を差し替えられます。ページ内の配置・サイズ・誌面上の位置関係はできるだけ維持します。</p>
                </div>
              </details>
            </div>

            <div className="border-t border-[rgba(31,42,68,0.12)] dark:border-[#2A3240]">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink marker:hidden dark:text-[#D4DBE7] [&::-webkit-details-marker]:hidden">
                  <span>書き出しは該当ページだけ停止</span>
                  <span aria-hidden="true" className="ml-auto text-xs text-accent transition-transform group-open:rotate-180 dark:text-[#C6AF63]">▼</span>
                </summary>
                <div className="pb-4 pr-8 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
                  <p>画像切れがあるページを含むJPG・PDFの書き出しは停止します。一方、画像切れを含まないページだけを単ページで書き出す場合は、そのまま出力できます。</p>
                </div>
              </details>
            </div>
          </aside>

          {/* TSP-LOOP-021 §3 / §6: 原稿バックアップのやさしい注意喚起（法的な
              免責文ではなく、友達口調のリマインド）。イラストは受領済み。 */}
          <aside
            aria-labelledby="backup-reminder-title"
            className="mt-8 flex items-center gap-5 border-l-2 border-[color:var(--home-gold)] py-2 pl-5 sm:gap-7 sm:pl-7"
          >
            <Image
              src={withBasePath("/help/backup-caroad.png")}
              alt="原稿のバックアップをすすめる、カロードのイラスト"
              width={1036}
              height={816}
              className="h-auto w-[96px] shrink-0 sm:w-[120px] md:w-[140px] dark:brightness-0 dark:invert dark:opacity-80"
            />
            <div>
              <h3
                id="backup-reminder-title"
                className="mb-2 font-serif text-lg font-medium text-ink dark:text-[#D4DBE7]"
              >
                大切な原稿は、ときどきバックアップを
              </h3>
              <p className="text-sm leading-relaxed text-ink/75 dark:text-[#B9C2D0]">
                ブラウザのデータ削除や端末トラブルに備えて、本文の控えや、PDF・JPGなどの書き出しデータを、別の場所にも保存しておくと安心です。
              </p>
            </div>
          </aside>
          </div>
        </section>

        {/* Phase 3: one closing band in ink -- the page ends on the next
            book, the same action as the first view. */}
        <section data-home-closing="" className="home-p3-closing" aria-labelledby="home-closing-title">
          <div className="mx-auto flex max-w-[960px] flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-16">
            <div>
              <p className="home-p3-chip home-p3-chip-invert">{isNonEmptyVisual ? "Next Book" : "First Book"}</p>
              <h2 id="home-closing-title" className="mt-4 font-serif text-[clamp(24px,3.6vw,36px)] font-medium tracking-[0.05em]">
                {isNonEmptyVisual ? "次の一冊を、この棚に。" : "最初の一冊を、この棚に。"}
              </h2>
            </div>
            <button type="button" onClick={handleCreate} disabled={creating} className="home-p3-cta home-p3-cta-gold shrink-0">
              {isNonEmptyVisual ? "次の一冊を書く" : "最初の一冊を書きはじめる"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {isNonEmptyVisual ? renderBrandPanel("informational") : <section
          className="border-t border-[rgba(31,42,68,0.14)] bg-ink/[0.025] px-[18px] py-[50px] sm:px-[clamp(24px,6vw,72px)] sm:py-[54px] dark:border-[#2A3240]"
          aria-label="TateSpunについて"
        >
          <div className="grid grid-cols-1 items-center gap-[30px] min-[921px]:grid-cols-[1fr_180px]">
            <div className="text-center min-[921px]:text-left">
              <p className="home-p3-chip mb-2">TateSpun</p>
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
                className="hidden h-auto w-[150px] dark:block dark:brightness-0 dark:invert dark:opacity-80"
              />
            </div>
          </div>
        </section>}

        <section
          data-product-policy=""
          className="border-t border-[rgba(31,42,68,0.14)] bg-ink/[0.018] px-[18px] py-[42px] sm:px-[clamp(24px,6vw,72px)] dark:border-[#2A3240] dark:bg-[#11151D]"
          aria-labelledby="tatespun-product-policy-title"
        >
          <div className="mx-auto max-w-3xl">
            <p className="home-p3-chip">Development Policy</p>
            <h2 id="tatespun-product-policy-title" className="mt-2 font-serif text-2xl font-medium text-ink dark:text-[#D4DBE7]">
              TateSpunは、使いながら育てています。
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
              <p>
                TateSpunは、私自身が小説を書くためにも使っているエディターです。
                なので「書いていて、これが欲しい」と思った機能は、これからも追加していきます。
              </p>
              <p>
                β版の公開期間中にも、いくつか機能追加や改善を予定しています。追加・変更した内容は随時お知らせします。
              </p>
              <p>
                中には、使う人によっては必要のない機能もあると思います。そこはご容赦ください。できるだけ必要な機能だけを選んで使えるようにして、機能が増えてもごちゃごちゃしない、書きやすい環境に整えていきたいと思っています。
              </p>
              <p>
                もし機能が増えたことで使いづらくなったところがあれば、どうぞ遠慮なく教えてください。使いながら、整えながら、TateSpunを育てていきます。
              </p>
            </div>
          </div>
        </section>

        <section
          data-support-links=""
          className="border-t border-[rgba(31,42,68,0.14)] px-[18px] py-[42px] text-center sm:px-[clamp(24px,6vw,72px)] dark:border-[#2A3240]"
          aria-labelledby="support-links-title"
        >
          <p className="home-p3-chip">Support</p>
          <h2 id="support-links-title" className="mt-2 font-serif text-xl font-medium text-ink dark:text-[#D4DBE7]">
            {SUPPORT_HEADING}
          </h2>
          <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-ink/70 dark:text-[#AEB7C6]">
            {SUPPORT_BODY}
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <a
              href={SUPPORT_FANBOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-[280px] rounded-full border border-ink/20 px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 sm:w-auto dark:border-[#3A4658] dark:text-[#D4DBE7] dark:hover:bg-[#1D2430]"
            >
              {SUPPORT_FANBOX_LABEL}
            </a>
            <a
              href={SUPPORT_OFUSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-[280px] rounded-full border border-ink/20 px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 sm:w-auto dark:border-[#3A4658] dark:text-[#D4DBE7] dark:hover:bg-[#1D2430]"
            >
              {SUPPORT_OFUSE_LABEL}
            </a>
          </div>
          <p className="mt-3 text-xs text-ink/50 dark:text-[#939DAF]">{SUPPORT_NOTE}</p>
        </section>

        <UpdateHistoryAccordion />

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
              href="/howto"
              className="text-sm text-ink/60 hover:text-ink dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
            >
              HOW TO
            </Link>
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
    <div data-home-v2-page data-bookshelf-page data-qa-mode={qaMode} className={outerClassName}>
      {isNonEmptyVisual ? (
        <div data-nonempty-shell className={nonEmptyShellClassName}>
          {homeContent}
        </div>
      ) : (
        homeContent
      )}

      {isNonEmptyVisual && (
        <nav data-home-dock="" data-visible={dockVisible ? "" : undefined} aria-label="本棚の操作" aria-hidden={!dockVisible} inert={!dockVisible} className="home-p3-dock">
          {recentDocuments[0] && (
            <button type="button" onClick={() => router.push(qaMode ? "/editor?demo=1" : `/editor?id=${recentDocuments[0].id}`)} className="home-p3-dock-continue">
              <span className="block text-[10px] tracking-[0.18em] opacity-70">CONTINUE</span>
              <span className="block truncate font-serif text-sm">{recentDocuments[0].title || "無題のドキュメント"}</span>
            </button>
          )}
          <button type="button" onClick={handleCreate} disabled={creating} className="home-p3-dock-create">＋ 次の一冊</button>
        </nav>
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


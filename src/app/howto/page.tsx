"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import BetaFeedbackModal from "@/components/BetaFeedbackModal";
import HelpModal from "@/components/HelpModal";
import {
  HOWTO_IMAGES,
  EDITOR_PAGE_EXPLANATION_TITLE,
  EDITOR_PAGE_EXPLANATION_BODY,
  TITLE_AND_FILENAME_EXPLANATION,
  PDF_FILENAME_EXPLANATION,
  resolveAffiliateFooterConfig,
} from "@/lib/howtoContent";
import {
  SUPPORT_FANBOX_URL,
  SUPPORT_OFUSE_URL,
  SUPPORT_HEADING,
  SUPPORT_BODY,
  SUPPORT_FANBOX_LABEL,
  SUPPORT_OFUSE_LABEL,
  SUPPORT_NOTE,
} from "@/lib/supportLinks";
import {
  USE_CASES_HEADING,
  USE_CASES_LEAD,
  USE_CASE_EXAMPLES,
  USE_CASES_NOT_YET_HEADING,
  USE_CASES_NOT_YET,
} from "@/lib/useCaseExamples";
import { parseUpdateHistory, type UpdateHistoryEntry } from "@/lib/updateHistory";
import "./howto.css";

/**
 * TSP-HOWTO-BETA-016 — `/howto`, the beta's first-time-user onboarding guide.
 *
 * Distinct from `/guide` ("何ができるか" catalogue) and from `HelpModal`
 * ("困ったときの詳しい参照"): this page teaches the normal TateSpun journey
 * end-to-end (原稿を持ち込む → 編集する → 本の形を確認する → 必要な設定を
 * する → 入稿前チェック → PDF/JPGを書き出す) for someone who has never used
 * the app before.
 *
 * Content/layout is adapted from the approved docs/howto (Draft v3.4) static
 * mockup — same copy, same visual language (own scoped stylesheet, see
 * `./howto.css`) — wired into a real route: real images (no more IMAGE
 * FILE placeholders), basePath-safe asset paths, and the same HelpModal /
 * BetaFeedbackModal the rest of the app already uses (no forked Help/
 * Feedback logic). Two explanations the v3.4 draft didn't yet cover were
 * added: Editor Pages (split/join) inside the manuscript-bring-in chapter,
 * and the shipped PDF safe-filename field inside the export chapter.
 */

interface UpdateLogEntry {
  date: string;
  type: string;
  title: string;
  body: string;
}

const formatCanonicalLogDate = (date: string) => {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : date;
};

const toHowToLogEntry = (entry: UpdateHistoryEntry): UpdateLogEntry => ({
  date: formatCanonicalLogDate(entry.date),
  type: entry.type ?? "improvement",
  title: entry.title,
  body: entry.detail,
});

const asset = (file: string) => withBasePath(`/howto/assets/${file}`);
// TSP-RC-HOWTO-FINALIZE-003: self-hosted β guide video + poster, produced to
// the spec recorded in roadmap §18 (H.264/AAC, faststart, ~960px wide,
// <25 MiB) -- verified present and valid before wiring this in.
const HOWTO_GUIDE_VIDEO_SRC = withBasePath("/howto/media/tatespun-beta-guide.mp4");
const HOWTO_GUIDE_VIDEO_POSTER = withBasePath("/howto/media/tatespun-beta-guide-poster.webp");
// TSP-RC-AFFILIATE-FOOTER-001: no config anywhere in this repo/env today --
// see resolveAffiliateFooterConfig's own doc. Resolved once at module scope
// since these are build-time NEXT_PUBLIC_ values, same pattern as every
// other NEXT_PUBLIC_* flag in this codebase (e.g. BETA_FEEDBACK_ENABLED).
const AFFILIATE_FOOTER = resolveAffiliateFooterConfig({
  amazonUrl: process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_URL,
  amazonAssociateOperatorName: process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_OPERATOR_NAME,
  rakutenUrl: process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_URL,
});

// Phase 3: one table of contents, in reading order, for the desktop side
// rail (same chapters and names the hero menu already lists).
const HOWTO_TOC: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "よく使う操作", items: [{ href: "#quick-reference", label: "操作と場所の早見表" }] },
  { group: "使い方の例", items: [{ href: "#use-cases", label: USE_CASES_HEADING }] },
  {
    group: "まずは知ってほしい５つの機能",
    items: [
      { href: "#my-check", label: "マイチェック" },
      { href: "#writing-check", label: "文章チェックβ" },
      { href: "#body-notation", label: "本文記法" },
      { href: "#work-counter", label: "作業カウンター" },
      { href: "#varied-use", label: "多様な使い方" },
    ],
  },
  {
    group: "文章見直しツール",
    items: [
      { href: "#review-writing-check", label: "文章チェックβ" },
      { href: "#review-work-counter", label: "作業カウンター" },
      { href: "#review-read-aloud", label: "音読β" },
      { href: "#review-description-check", label: "描写語・修飾表現チェックβ" },
    ],
  },
  {
    group: "便利な小技10選β版",
    items: [
      { href: "#settings", label: "設定" },
      { href: "#preview", label: "プレビュー機能" },
      { href: "#four-buttons", label: "便利な４ボタン" },
      { href: "#memo", label: "メモ機能" },
      { href: "#focus-mode", label: "集中モード" },
      { href: "#folio-header", label: "ノンブル・柱" },
      { href: "#image-insert", label: "画像挿入機能" },
      { href: "#colophon", label: "奥付機能" },
      { href: "#dark-mode", label: "ダークモード" },
      { href: "#export", label: "多機能書き出し" },
    ],
  },
  { group: "困ったとき", items: [{ href: "#faq", label: "FAQ" }, { href: "#report", label: "困ったとき" }] },
];

// Phase 3: the operations people look for most, and where each one lives
// (the same places each chapter's 「場所」 line gives), linking to the chapter.
const HOWTO_QUICK_REFERENCE: { task: string; where: string; href: string }[] = [
  { task: "用紙・フォント・余白を変える", where: "テキストエディター直上→▶設定", href: "#settings" },
  { task: "ルビ・縦中横・改ページを入れる", where: "タイトル下／ヘルプの中", href: "#body-notation" },
  { task: "本の形で確かめる", where: "プレビュー（ズーム50％・100％・200％）", href: "#preview" },
  { task: "元に戻す・改ページ・検索・置換", where: "テキストエディター直上の４ボタン", href: "#four-buttons" },
  { task: "文章を見直す", where: "「見直し」→文章チェックβ・作業カウンター など", href: "#review-tools" },
  { task: "挿絵を入れる", where: "プレビュー画面→ページ上［…］内", href: "#image-insert" },
  { task: "奥付を入れる", where: "▶本づくり→奥付（縦）、奥付（横）", href: "#colophon" },
  { task: "PDF・JPGで書き出す", where: "プレビュー画面左側「書き出し▼」", href: "#export" },
];

export default function HowToPage() {
  const [fiveOpen, setFiveOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logs, setLogs] = useState<UpdateLogEntry[]>([]);
  const [visibleLogCount, setVisibleLogCount] = useState(8);
  const [logLoadError, setLogLoadError] = useState(false);
  const [activeTocHref, setActiveTocHref] = useState<string | null>(null);
  const [allTipsOpen, setAllTipsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  // TSP-COPY-001: the full table of contents opens as a sheet from the top
  // of the page and from the sticky bar, so any chapter is one tap away.
  useEffect(() => {
    if (!tocOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTocOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.getElementById("howto-toc-close")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [tocOpen]);

  // Phase 3: tips chapters are collapsible. Any in-page link (hero menu,
  // rail, quick reference, a shared #hash URL) opens the chapter it points
  // at before the browser scrolls to it.
  useEffect(() => {
    const openTarget = (hash: string) => {
      if (!hash || hash.length < 2) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      const details = target?.closest("details");
      if (details && !details.open) details.open = true;
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (link) openTarget(link.getAttribute("href") ?? "");
    };
    const onHash = () => {
      openTarget(window.location.hash);
      document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
    };
    if (window.location.hash) onHash();
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  // Phase 3: the side rail marks the chapter being read.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = HOWTO_TOC.flatMap((group) => group.items.map((item) => item.href.slice(1)));
    const targets = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveTocHref(`#${visible[0].target.id}`);
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const toggleAllTips = () => {
    const next = !allTipsOpen;
    document.querySelectorAll<HTMLDetailsElement>("details.tip").forEach((el) => {
      el.open = next;
    });
    setAllTipsOpen(next);
  };

  useEffect(() => {
    // Browser-only query-param read for the internal `?labels=1` review mode
    // (see docs/howto TEXT_MAP.md) — cannot run during static-export
    // prerendering, so this one-time mount effect is unavoidable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowLabels(new URLSearchParams(window.location.search).get("labels") === "1");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/data/tatespun-update-history.json"), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("canonical update history fetch failed");
        return r.json();
      })
      .then((value: unknown) => {
        if (cancelled) return;
        setLogs(parseUpdateHistory(value).map(toHowToLogEntry));
        setLogLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLogLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const visibleLogs = sortedLogs.slice(0, visibleLogCount);

  return (
    <div
      className={`howto-page${showLabels ? " show-copy-ids" : ""}`}
      data-howto-page=""
      lang="ja"
    >
      <h1 className="sr-only">HOW TO TateSpun｜タテスパン使い方ガイド</h1>
      <main className="manual">
        <section className="hero" id="howto-top">
          <div className="hero-left">
            <div className="hero-brand">
              <span className="howto-label">HOW TO</span>
              <strong>TateSpun</strong>
            </div>
            <p className="hero-copy" data-copy-id="TEXT_HERO_BODY_01">
              色々出来るTateSpun<br />是非知ってもらいたい機能を<br />こちらのページにまとめました。
              <br />ブラウザだけで動作し、原稿はあなたのものです。
            </p>
            <div className="hero-pills">
              <Link className="pill dark" href="/" data-copy-id="TEXT_HERO_CHIP_01">
                本棚に戻る
              </Link>
              <Link className="pill gold" href="/editor?demo=1" data-copy-id="TEXT_HERO_CHIP_02">
                デモを見る
              </Link>
            </div>
            <button
              type="button"
              className="hero-toc-open"
              data-howto-toc-open="hero"
              aria-haspopup="dialog"
              aria-expanded={tocOpen}
              onClick={() => setTocOpen(true)}
            >
              <span>このページの目次をひらく</span>
              <span aria-hidden="true">→</span>
            </button>
            {/* Phase 3: where to start. Three chapters in reading order on one
                thread, so a first-time reader knows what to read first. */}
            <div className="start-path-block">
              <p className="howto-chip">Start Here</p>
              <p className="start-path-title">はじめての方は、この順番で。</p>
              <ol className="start-path">
                <li><a href="#five-features"><span className="start-no" aria-hidden="true">01</span><b>まずは知ってほしい５つの機能</b><small>最初に読むならここから</small></a></li>
                <li><a href="#review-tools"><span className="start-no" aria-hidden="true">02</span><b>文章見直しツール</b><small>書けたら、見直しに</small></a></li>
                <li><a href="#tips"><span className="start-no" aria-hidden="true">03</span><b>便利な小技10選β版</b><small>必要になったときに</small></a></li>
              </ol>
              <p className="start-path-help">困ったときは <a href="#faq">FAQ</a> ／ <a href="#report">困ったとき</a> へ。</p>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-visual">
              <img src={asset(HOWTO_IMAGES.hero.file)} alt={HOWTO_IMAGES.hero.alt} />
            </div>
            <p className="howto-chip hero-index-chip">Contents</p>
            <nav className="hero-index" aria-label="ページ案内">
              <button
                type="button"
                className="hero-simple-link"
                data-howto-help-cta="hero-nav"
                onClick={() => setHelpOpen(true)}
              >
                ヘルプを見る
              </button>
              <div className="hero-menu-block">
                <div className="hero-menu-row">
                  <button
                    className="accordion-toggle"
                    type="button"
                    aria-expanded={fiveOpen}
                    aria-controls="hero-five-panel"
                    aria-label="5つの機能メニューを開く"
                    onClick={() => setFiveOpen((v) => !v)}
                  >
                    <span className="hamburger"><i></i><i></i><i></i></span>
                  </button>
                  <a className="hero-menu-title" href="#five-features" data-copy-id="TEXT_HERO_MENU_01">
                    まずは知ってほしい<br />５つの機能
                  </a>
                </div>
                <ol className="hero-submenu" id="hero-five-panel" hidden={!fiveOpen}>
                  <li><a href="#my-check">マイチェック</a></li>
                  <li><a href="#writing-check">文章チェックβ</a></li>
                  <li><a href="#body-notation">本文記法</a></li>
                  <li><a href="#work-counter">作業カウンター</a></li>
                  <li><a href="#varied-use">多様な使い方</a></li>
                </ol>
              </div>
              <a className="hero-simple-link" href="#review-tools" data-copy-id="TEXT_HERO_MENU_REVIEW">
                文章見直し<br />ツール
              </a>
              <div className="hero-menu-block">
                <div className="hero-menu-row">
                  <button
                    className="accordion-toggle"
                    type="button"
                    aria-expanded={tipsOpen}
                    aria-controls="hero-tips-panel"
                    aria-label="便利な小技10選メニューを開く"
                    onClick={() => setTipsOpen((v) => !v)}
                  >
                    <span className="hamburger"><i></i><i></i><i></i></span>
                  </button>
                  <a className="hero-menu-title" href="#tips" data-copy-id="TEXT_HERO_MENU_02">
                    便利な小技<br />10選β版
                  </a>
                </div>
                <ol className="hero-submenu" id="hero-tips-panel" hidden={!tipsOpen}>
                  <li><a href="#settings">設定</a></li>
                  <li><a href="#preview">プレビュー機能</a></li>
                  <li><a href="#four-buttons">便利な４ボタン</a></li>
                  <li><a href="#memo">メモ機能</a></li>
                  <li><a href="#focus-mode">集中モード</a></li>
                  <li><a href="#folio-header">ノンブル・柱</a></li>
                  <li><a href="#image-insert">画像挿入機能</a></li>
                  <li><a href="#colophon">奥付機能</a></li>
                  <li><a href="#dark-mode">ダークモード</a></li>
                  <li><a href="#export">多機能書き出し</a></li>
                </ol>
              </div>
              <a className="hero-simple-link" href="#faq" data-copy-id="TEXT_HERO_MENU_03">FAQ</a>
              <a className="hero-simple-link" href="#report" data-copy-id="TEXT_HERO_MENU_04">困ったとき</a>
              <a className="hero-simple-link" href="#devlog" data-copy-id="TEXT_HERO_MENU_05">更新・デバック</a>
            </nav>
          </div>
        </section>

        <header className="guide-header">
          <a className="guide-logo" href="#howto-top" aria-label="HOW TO TateSpun のトップへ戻る">
            <img className="guide-cat" src={asset(HOWTO_IMAGES.guideCat.file)} alt={HOWTO_IMAGES.guideCat.alt} />
            <div><span>HOW TO</span><b>TateSpun</b></div>
          </a>
          {/* TSP-RC-HOWTO-HEADER-CORRECTION-002: original wording/structure
              restored (TSP-RC-HOWTO-RESPONSIVE-VIDEO-001's shortened labels
              and forced-2-row-at-every-width layout were rejected by Human
              QA). The `<br />` per item is the original design, unchanged at
              every width; `.guide-links a/button` now carries
              `word-break: keep-all` (howto.css) so a narrow container wraps
              at the `<br />`/word boundary only, never mid-character -- that
              missing rule, not the label text or the <br/> itself, was the
              actual root cause of the character-by-character collapse. */}
          <div className="guide-links">
            <a href="#five-features" data-copy-id="TEXT_NAV_01">まずは知ってほしい<br />５つの機能</a>
            <a href="#review-tools" data-copy-id="TEXT_NAV_REVIEW">文章見直し<br />ツール</a>
            <a href="#tips" data-copy-id="TEXT_NAV_02">便利な小技<br />10選β版</a>
            <a href="#faq" data-copy-id="TEXT_NAV_03">FAQ<br /><span>困ったとき</span></a>
            <button
              type="button"
              className="help-cta"
              data-howto-help-cta="sticky-nav"
              onClick={() => setHelpOpen(true)}
            >
              ヘルプ
            </button>
            <button
              type="button"
              className="toc-cta"
              data-howto-toc-open="sticky-nav"
              aria-haspopup="dialog"
              aria-expanded={tocOpen}
              onClick={() => setTocOpen(true)}
            >
              目次
            </button>
          </div>
        </header>

        {tocOpen && (
          <div className="toc-sheet-backdrop" onClick={() => setTocOpen(false)}>
            <div
              className="toc-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="howto-toc-title"
              data-howto-toc-sheet=""
              onClick={(event) => event.stopPropagation()}
            >
              <div className="toc-sheet-head">
                <p className="howto-chip">Contents</p>
                <h2 id="howto-toc-title">目次</h2>
                <button id="howto-toc-close" type="button" className="toc-sheet-close" onClick={() => setTocOpen(false)}>
                  閉じる
                </button>
              </div>
              <div className="toc-sheet-body">
                {HOWTO_TOC.map((group) => (
                  <div key={group.group} className="toc-sheet-group">
                    <p className="toc-sheet-group-title">{group.group}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <a href={item.href} onClick={() => setTocOpen(false)}>{item.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="howto-layout">
          <nav className="howto-rail" aria-label="目次">
            <p className="howto-chip">Contents</p>
            {HOWTO_TOC.map((group) => (
              <div key={group.group} className="rail-group">
                <p className="rail-group-title">{group.group}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <a href={item.href} aria-current={activeTocHref === item.href ? "location" : undefined}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="howto-flow">
        <section className="quick-ref" id="quick-reference" aria-labelledby="quick-reference-title">
          <p className="howto-chip">Quick Reference</p>
          <h2 id="quick-reference-title">よく使う操作と、その場所</h2>
          <p className="section-hint">やりたいことから探せます。項目を選ぶと、くわしい説明の章へ移動します。</p>
          <ol className="quick-ref-list">
            {HOWTO_QUICK_REFERENCE.map((row) => (
              <li key={row.href}>
                <a href={row.href}>
                  <b>{row.task}</b>
                  <span>{row.where}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* TSP-COPY-001: what TateSpun can be used for besides a printed
            novel, and what does not work yet (same copy as the Home). */}
        <section className="use-cases" id="use-cases" aria-labelledby="use-cases-title">
          <p className="howto-chip">Ways to Use</p>
          <h2 id="use-cases-title">{USE_CASES_HEADING}</h2>
          <p className="section-hint">{USE_CASES_LEAD}</p>
          <ul className="use-case-list">
            {USE_CASE_EXAMPLES.map((item) => (
              <li key={item.title}>
                <b>{item.title}</b>
                <span>{item.body}</span>
              </li>
            ))}
          </ul>
          <h3 className="use-case-notyet-title">{USE_CASES_NOT_YET_HEADING}</h3>
          <ul className="use-case-list use-case-notyet">
            {USE_CASES_NOT_YET.map((item) => (
              <li key={item.title}>
                <b>{item.title}</b>
                <span>{item.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="intro" id="five-features">
          <div className="intro-title">
            <p className="howto-chip">Chapter 1 · Essentials</p>
            <span aria-hidden="true"></span>
            <b data-copy-id="TEXT_INTRO_TITLE">まずは知ってほしい<br />５つの機能</b>
          </div>
          <div className="intro-copy">
            <p data-copy-id="TEXT_INTRO_BODY_01"><a href="#my-check">1. 完成前マイチェックリスト＋PDF書き出し前チェック</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_02"><a href="#writing-check">2. 文章チェックβ</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_03"><a href="#body-notation">3. ルビ・縦中横・改ページの本文記法</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_04"><a href="#work-counter">4. 作業カウンター＋一時停止</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_05"><a href="#varied-use">5. 「ここで書かなくてもいい」原稿持ち込み運用</a></p>
          </div>

          {/* TSP-RC-HOWTO-FINALIZE-003: self-hosted from public/howto/media/
              -- no YouTube/external embed. Native <video>, no autoplay, no
              forced mute, no loop; controls + poster + preload="metadata"
              keep initial page weight low. */}
          <div className="guide-video-block">
            <p className="guide-video-intro" data-copy-id="TEXT_GUIDE_VIDEO_INTRO">
              β版公開前に制作したTateSpunの案内動画です。現在とは一部、画面や表記が異なる場合があります。
            </p>
            <video
              className="guide-video"
              controls
              playsInline
              preload="metadata"
              poster={HOWTO_GUIDE_VIDEO_POSTER}
            >
              <source src={HOWTO_GUIDE_VIDEO_SRC} type="video/mp4" />
              この環境では動画を再生できません。
            </video>
          </div>
        </section>

        <section className="chapter essential" id="my-check">
          <h2 data-eyebrow="ESSENTIAL 01 / 05" data-copy-id="TEXT_SECTION_01_TITLE">1. 完成前マイチェックリスト＋PDF書き出し前チェック</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_01_SUBTITLE">場所：▶本づくり→完成前チェック</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.myCheck.file)} alt={HOWTO_IMAGES.myCheck.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_01_HEADING_01">使うタイミング</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_01_BODY_01">書き出し・入稿直前にチェックできるよう、着手直後や原稿中に頭の中を整理したいときに設定しておくのがおすすめです。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_01_HEADING_02">メリット</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_01_BODY_02">項目はプリセットを3種類用意しており、自分専用の確認項目・セットも作れます。指定したリストは任意でPDF書き出し直前に表示できます。その場合は、全項目を確認してからPDF書き出しへ進めます。書き出し・入稿事故の防止にお役立てください。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_01_HEADING_03">併せて知ってほしい機能！</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_01_BODY_03">
                  PDF用チェックリストを設定していても、JPGはそのまま書き出せます。
                  <ul>
                    <li>PDFは「入稿前だから慎重に確認」</li>
                    <li>JPGは「ちょっと見た目を確認したいからすぐ出す」</li>
                    <li>地味ですが、実際の作業ではかなり便利です！</li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="chapter essential" id="writing-check">
          <h2 data-eyebrow="ESSENTIAL 02 / 05" data-copy-id="TEXT_SECTION_02_TITLE">2. 文章チェックβ</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_02_SUBTITLE">場所：「見直し」→文章チェックβ</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.writingCheck.file)} alt={HOWTO_IMAGES.writingCheck.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_02_HEADING_01">使うタイミング</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_02_BODY_01">常に使用していてもよいですし、完成稿を最後にざっと確認するときに使うのも便利です。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_02_HEADING_02">メリット</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_02_BODY_02">本文を書きながらでは見逃しやすい部分を、完成後に改めて確認するきっかけになります。自己確認系は赤波線、確認事項系は黄色波線、NGワードは紫波線と、何がチェックポイントなのか分かりやすく設計しています。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_02_HEADING_03">併せて知ってほしい機能！</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_02_BODY_03">
                  <p><strong>【わたしの辞書】</strong><br />表記ゆれを起こしやすい単語を事前に登録しておくと、よく間違える単語に黄色の波線が付くようになります。</p>
                  <p><strong>【NGワード】</strong><br />NGワードを登録すると、本文中に含まれる箇所を確認候補として紫の波線で表示します（自動置換はしません）。</p>
                  <p><strong>【無視する・直す】</strong><br />画面下部に「事故確認／確認事項」が出ているときに該当箇所を押すと、一覧が表示されます。意図した内容であれば「無視」を押すことで波線を消せます。<br /><small>※「無視」はその確認候補を一時的に非表示にしますが、画面を再読み込みすると再度表示されます。</small></p>
                  <p><strong>【直す／安全な項目をまとめて直す】</strong><br />黄色の波線が出ている部分に対応しています。ボタンを押したときにだけ本文を書き換えます。ボタンを押す以外で自動的に書き換わることはありません。「元に戻す」で直前の操作を一度だけ取り消せます。</p>
                  <p>波線はプレビュー画面・出力には表示されないので、安心してご活用ください。</p>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="chapter essential" id="body-notation">
          <h2 data-eyebrow="ESSENTIAL 03 / 05" data-copy-id="TEXT_SECTION_03_TITLE">3. ルビ・縦中横・改ページの本文記法</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_03_SUBTITLE">場所：タイトル下／ヘルプの中</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.bodyNotation.file)} alt={HOWTO_IMAGES.bodyNotation.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_03_HEADING_01">使うタイミング</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_03_BODY_01">特殊な読み、縦書き中の数字・英数字、章の強制改ページを入れたいときにご活用ください！</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_03_HEADING_02">メリット</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_03_BODY_02">知らないと普通に入力するだけで終わってしまう便利機能です。<br /><code>｜親文字《よみ》</code>、<code>[tate]縦中横[/tate]</code>、<code>【改ページ】</code> と書いて指定できます。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_03_HEADING_03">併せて知ってほしい機能！</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_03_BODY_03">改ページは、タイトル下のボタンひとつで本文に入力されます。<br />ルビ・縦中横はヘルプ内にコピーボタンがあるので、コピーして該当場所へ貼り付けてから中身を書き換えてください。「どう打つんだっけ？」となったときにも、暗記不要で使える便利機能です。</div>
              </section>
            </div>
          </div>
        </section>

        <section className="chapter essential" id="work-counter">
          <h2 data-eyebrow="ESSENTIAL 04 / 05" data-copy-id="TEXT_SECTION_04_TITLE">4. 作業カウンター</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_04_SUBTITLE">場所：「見直し」→作業カウンター</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.workCounter.file)} alt={HOWTO_IMAGES.workCounter.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_04_HEADING_01">使うタイミング</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_04_BODY_01">実際に原稿へ向き合った時間を残したいときに。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_04_HEADING_02">メリット</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_04_BODY_02">設定をいじる時間、休憩、宅配での離席などは一時停止にして、実作業時間と分けられます。モーダルを閉じても一時停止を続行できるので、「文章を書いている時間だけ記録したい」という方も安心です。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_04_HEADING_03">併せて知ってほしい機能！</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_04_BODY_03">頑張った記録は、ぜひSNSへシェアしましょう！ 作業カウントは「入力した数」「貼り付けた文字数」をカウントするため、Delete／Backspaceで削除した文字も、それまで入力した文字数として残ります。そのとき頑張って書いた文字の総量を確認できる機能です。</div>
              </section>
            </div>
          </div>
        </section>

        <section className="chapter essential" id="varied-use">
          <h2 data-eyebrow="ESSENTIAL 05 / 05" data-copy-id="TEXT_SECTION_05_TITLE">5. 「ここで書かなくてもいい」原稿持ち込み運用</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_05_SUBTITLE">場所：▶本づくり→原稿ファイル</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.txtImportExport.file)} alt={HOWTO_IMAGES.txtImportExport.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_05_HEADING_01">使うタイミング</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_05_BODY_01">普段はお気に入りのアプリで執筆しながら、ページ数の確認やPDFの書き出し、書店委託用サンプルページの画像づくりなどにご活用ください。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_05_HEADING_02">メリット</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_05_BODY_02">TateSpunに執筆環境を乗り換える必要はありません。最後に原稿を持ってきて、「本の形にする・確認する・持ち帰る」という使い方ができます。</div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_05_HEADING_03">併せて知ってほしい機能！</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_05_BODY_03">
                  <p><strong>TXTデータの読み込み・出力</strong><br />場所：▶本づくり→原稿ファイル</p>
                  <p>メモ帳などで書いた <code>.txt</code> データを読み込めます。逆に、TateSpunで使っているマークダウン形式のまま保存することもできます。</p>
                  <p>さらに、文章校正（行頭下げ等）をした状態で、マークダウンのない整形TXTを書き出すこともできます。作品公開サイトへ持っていくときにも便利です！</p>
                </div>
              </section>
              <section className="copy-block">
                <h3 data-copy-id="TEXT_SECTION_05_HEADING_04">{EDITOR_PAGE_EXPLANATION_TITLE}</h3>
                <div className="copy-body" data-copy-id="TEXT_SECTION_05_BODY_04">{EDITOR_PAGE_EXPLANATION_BODY}</div>
              </section>
            </div>
          </div>
        </section>

        <section className="review-tools-guide" id="review-tools">
          <p className="howto-chip">Chapter 2 · Review</p>
          <h2 data-copy-id="TEXT_REVIEW_TOOLS_TITLE">文章見直し<br />ツール</h2>
          <p className="review-tools-lead" data-copy-id="TEXT_REVIEW_TOOLS_LEAD">
            エディターの「見直し」には、原稿を書きながら確認したい機能をまとめています。PCではプレビュー下の見直しバー、モバイルではエディター下の1行バーから開けます。
          </p>

          <div className="review-tools-usage">
            <h3>よく使う機能はフッターに最大2つまで</h3>
            <p>
              各機能の「フッターに表示」から、すぐ触りたい機能を最大2つまで選べます。フッター表示は機能そのもののON／OFFとは別です。フッターから外しても「見直し」を開けばいつでも使えます。設定はこのブラウザに保存されます。
            </p>
          </div>

          <div className="review-tool-sections">
            <article className="review-tool-section" id="review-writing-check">
              <h3>文章チェックβ</h3>
              <div className="review-tool-copy">
                <p>入力中の文章から、括弧の閉じ忘れや句読点の重複など「確認した方がよい箇所」を波線でお知らせする機能です。「見直し」からいつでもオン／オフを切り替えられます。設定はこの端末に保存され、本文には記録されません。</p>

                <h4>赤い波線・黄色い波線について</h4>
                <p>波線は「文章が間違っている」と断定するものではありません。小説・創作では意図的な表現もあるため、内容を確認したうえで最終的には作者ご自身がご判断ください。TateSpunが文章を自動で書き換えることはありません。</p>
                <ul>
                  <li><strong>赤い波線（事故確認）:</strong> 括弧の対応ミスなど、原稿の事故である可能性が高い確認候補</li>
                  <li><strong>黄色い波線（確認推奨）:</strong> 三点リーダー・ダッシュの形や表記ゆれなど、文脈によって判断が分かれる確認候補</li>
                </ul>

                <h4>現在チェックするもの</h4>
                <ul>
                  <li>括弧の対応（「」 『』 （） ［］ 【】 の閉じ忘れ・対応ミス）</li>
                  <li>句読点の重複や、疑問符・感嘆符の直後に空白なしで本文が続く箇所</li>
                  <li>TateSpun記法の一部の入力ミス</li>
                  <li>三点リーダー・ダッシュの形</li>
                  <li>行末の余分な空白、行頭のタブと全角スペースの混在、連続する空行</li>
                  <li>半角カタカナ、登録した表記ゆれ（わたしの辞書）・NGワード</li>
                </ul>

                <h4>直す・無視・まとめて直す</h4>
                <p>「直す」はその1件だけを提案どおりに修正し、「無視」はその候補を一時的に非表示にします。「安全な項目をまとめて直す」は、書き換え内容が一意に決まる項目だけをまとめて修正します。「元に戻す」で直前の操作を一度だけ取り消せます。</p>

                <h4>設定・辞書・プライバシー</h4>
                <p>「⚙ 設定」から「入稿前おすすめ」「記号だけ」「しっかりチェック」のプリセットや、個別ルールを切り替えられます。「わたしの辞書」と「NGワード」も登録できます。判定はブラウザ内で行われ、この機能のために本文や登録内容を外部AI／APIへ送りません。波線はプレビュー・JPG・PDFにも出力されません。</p>
              </div>
            </article>

            <article className="review-tool-section" id="review-work-counter">
              <h3>作業カウンター</h3>
              <div className="review-tool-copy">
                <p>「作業スタート」から「作業終了」までの実作業時間と、その作業中に新しく入力した文字数を記録する機能です。タイトル横に表示される「現在の原稿文字数」とは別の値です。</p>

                <h4>作業中の操作</h4>
                <ul>
                  <li><strong>作業スタート:</strong> その作品の記録を開始</li>
                  <li><strong>一時停止:</strong> 作業時間のカウントを停止。一時停止中の時間は実作業時間に含まれません</li>
                  <li><strong>作業を再開する:</strong> 一時停止した続きから記録を再開</li>
                  <li><strong>作業終了:</strong> 今回の作業記録を確定</li>
                </ul>

                <h4>作業終了後・作業記録</h4>
                <p>作業を終了すると、今回書いた文字数・実作業時間・開始時刻・終了時刻を確認できます。結果はテキストとしてコピーしたり、Xへシェアしたりできます。「作業記録」では過去の完了した作業を見返せます。</p>

                <h4>文字数の数え方</h4>
                <p>作品全体の現在文字数ではなく、作業中に入力した文字数を積み上げます。そのため、あとから文字を削除した場合でも「現在の原稿文字数」と一致しないことがあります。Undo／Redoなど一部の操作は加算されません。記録は作品ごとに、このブラウザ内へ保存されます。</p>
              </div>
            </article>

            <article className="review-tool-section" id="review-read-aloud">
              <h3>音読β</h3>
              <div className="review-tool-copy">
                <p>原稿をブラウザや端末の読み上げ機能で音読し、目で読むだけでは気づきにくい文章の引っかかりや誤字を確認するための機能です。</p>

                <h4>読み上げる範囲と操作</h4>
                <p>「選択範囲」「現在の段落」「全文」から読み上げる範囲を選べます。読み上げ中は一時停止・再開・停止ができ、速度も調整できます。利用できる環境では読み上げに使う音声も選べます。</p>
                <p>音声読み上げに対応していないブラウザや、端末に日本語音声がない環境では使用できない場合があります。</p>

                <h4>読み辞書</h4>
                <p>固有名詞など、読み上げ方を直したい言葉と読みを登録できます。読み方は <strong>本文に明示したルビ → 音読βの読み辞書 → ブラウザ／端末の通常の読み方</strong> の順で優先されます。読み辞書は本文を書き換えず、このブラウザ内に保存されます。</p>

                <h4>プライバシー</h4>
                <p>この端末の音声を選んでいる場合、音読のために原稿を外部へ送りません。オンライン音声を選んだ場合は、読み上げる本文がブラウザの音声サービスへ送られる場合があり、その場合は画面にも注意が表示されます。</p>
              </div>
            </article>

            <article className="review-tool-section" id="review-description-check">
              <h3>描写語・修飾表現チェックβ</h3>
              <div className="review-tool-copy">
                <p>原稿の中から、描写や修飾として働いている表現を見つけ、黄色系の色で「見直し候補」として表示する機能です。文章の良し悪しや、削除した方がよい表現を判定するものではありません。</p>

                <h4>A・B・Cについて</h4>
                <ul>
                  <li><strong>A｜直接的な説明:</strong> 状態・評価・様子などを直接説明している表現</li>
                  <li><strong>B｜描写的な修飾:</strong> 比喩や様子など、描写として働く連体・連用修飾</li>
                  <li><strong>C｜広い修飾:</strong> 時間・場所・用途・所属・識別など、より広い種類の修飾</li>
                </ul>
                <p>A・B・Cは重要度や「直した方がよい順番」ではなく、表現の種類です。確認したい種類だけを個別にオン／オフできます。最初はAだけが選ばれています。</p>

                <h4>候補を確認する</h4>
                <p>色の付いた箇所をクリック／タップすると、候補になった理由を確認できます。「前へ」「次へ」で候補を順番に見たり、「候補の一覧」から該当箇所へ移動したりできます。残した方がよい表現も多いため、最終的には作者ご自身で判断してください。</p>

                <h4>オン／オフとプライバシー</h4>
                <p>「描写語・修飾表現チェックβを使う」からいつでもオン／オフできます。オフのあいだは解析を行いません。判定はブラウザ内で行われ、この機能のために原稿本文を外部AI／APIへ送信しません。自動で削除・書き換えることもありません。</p>
              </div>
            </article>
          </div>
        </section>

        <section className="tips-index" id="tips">
          <p className="howto-chip">Chapter 3 · Tips</p>
          <h2 data-copy-id="TEXT_TIPS_TITLE">便利な小技 10選β版</h2>
          <p className="section-hint">各項目は、見出しを押すとひらきます。</p>
          <button type="button" className="tips-toggle-all" aria-pressed={allTipsOpen} onClick={toggleAllTips}>
            {allTipsOpen ? "10項目をすべて閉じる" : "10項目をすべてひらく"}
          </button>
          <ol>
            <li><a href="#settings">設定</a></li>
            <li><a href="#preview">プレビュー機能</a></li>
            <li><a href="#four-buttons">便利な４ボタン</a></li>
            <li><a href="#memo">メモ機能</a></li>
            <li><a href="#focus-mode">集中モード</a></li>
            <li><a href="#folio-header">ノンブル・柱</a></li>
            <li><a href="#image-insert">画像挿入機能</a></li>
            <li><a href="#colophon">奥付機能</a></li>
            <li><a href="#dark-mode">ダークモード</a></li>
            <li><a href="#export">多機能書き出し</a></li>
          </ol>
        </section>

        <details className="chapter tip" id="settings">
          <summary className="tip-summary" data-eyebrow="TIPS 01 / 10">
            <h2 data-copy-id="TEXT_SECTION_06_TITLE">1. 本の見た目を細かく調整「設定」</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_06_SUBTITLE">場所：テキストエディター直上→▶設定</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.settings.file)} alt={HOWTO_IMAGES.settings.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_06_BODY_01">
                設定では、一般的な組版のプリセットを用意しています。<br /><small>※現段階では特殊サイズには対応していません。</small>
                <p>フォントから段組まで設定可能です。</p>
                <p>天地・小口・ノドの余白も指定できます。余白から指定する方法に加え、文字数・行数を指定して余白を逆算設定することも可能です。合同誌・アンソロジーなど、組版を合わせる必要があるときに便利です。</p>
                <p>余白から「1ページに何文字入るか」が分かるのも便利なポイントです！</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="preview">
          <summary className="tip-summary" data-eyebrow="TIPS 02 / 10">
            <h2 data-copy-id="TEXT_SECTION_07_TITLE">2. 色々見られるプレビュー機能</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_07_SUBTITLE">場所：テキストタイトル入力欄の下</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.preview.file)} alt={HOWTO_IMAGES.preview.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_07_BODY_01">
                <p><strong>【画面上の「○字×○行／全○ページ」を見る】</strong><br />設定を開かなくても、現在の本の密度・ページ数を把握できます。「あと何ページ増えそう？」を見る目安にもなって便利です。</p>
                <p><strong>【ズーム50％・100％・200％を使い分ける】</strong></p>
                <ul>
                  <li>50％：本全体のバランスを見る</li>
                  <li>100％：通常確認</li>
                  <li>200％：ルビ・句読点・細かい組版を見る</li>
                </ul>
                <p><strong>【ページの入れ替えができる】</strong><br />ページ上の［…］を押すと入れ替え機能があります。1ページ目をチェックしたあと、Shiftを押しながら任意のページをチェックすると、その間のページもまとめて選択されます。</p>
                <p><strong>【プレビュー画面を気持ちよく見られる】</strong><br />マウスでも、指でも、スクロールでも、見たい場所へすいすい動かしてチェックできます。</p>
                <p><strong>【プレビューページの点線について】</strong><br />指定サイズの部分に点線が入り、その外側は天地左右3mmの塗り足し部分です。画像配置などで天地指定をすると、塗り足し部分に配置される設計です。</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="four-buttons">
          <summary className="tip-summary" data-eyebrow="TIPS 03 / 10">
            <h2 data-copy-id="TEXT_SECTION_08_TITLE">3. タイトル下の便利な４ボタン</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_08_SUBTITLE">場所：テキストエディター直上</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.fourButtons.file)} alt={HOWTO_IMAGES.fourButtons.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_08_BODY_01">
                <ul>
                  <li>「あ！」と思ったときに「↶元に戻す」「↷やり直す」</li>
                  <li>改ページしたいときは、改行をたくさん入れなくてもボタンひとつでマークダウンを入力できます。章替わり・場面転換・扉の後などに便利です！</li>
                </ul>
                <p>集中モードでも表示されているので、いつでも活用できます。キャラ名変更、漢字表記、三点リーダーなどを統一するときにも便利です。</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="memo">
          <summary className="tip-summary" data-eyebrow="TIPS 04 / 10">
            <h2 data-copy-id="TEXT_SECTION_09_TITLE">4. 本文には入れない作業を残す「メモ機能」</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_09_SUBTITLE">場所：テキストタイトル入力欄の下→▶メモ</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.memo.file)} alt={HOWTO_IMAGES.memo.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_09_BODY_01">
                「書いている間に思いついたこと」をメモできます。編集・確定機能があるので、誤操作で消えにくい設計です。プロットや起承転結、オチのifパターン、最新情報のメモまで幅広く使えます。
                <p>書いているときの日記代わりに活用すると、見返したときにも楽しいです！</p>
                <p>本文にTODOを書いて、そのまま消し忘れる事故を避けやすい機能でもあります。</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="focus-mode">
          <summary className="tip-summary" data-eyebrow="TIPS 05 / 10">
            <h2 data-copy-id="TEXT_SECTION_10_TITLE">5. “書くときだけ”余計なUIを消す「集中モード」</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_10_SUBTITLE">場所：ヘッダー「集中モード」</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.focusMode.file)} alt={HOWTO_IMAGES.focusMode.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_10_BODY_01">
                プレビュー、設定、文章チェック、作業カウント、文字数などをいったん隠して、作業に集中できます。
                <p>特にモバイル版では各種ボタンが多く、テキストエディターが小さくなりやすいため、ぜひご活用ください！</p>
                <p>集中モードでも、プレビューはすぐに見られる状態です。</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="folio-header">
          <summary className="tip-summary" data-eyebrow="TIPS 06 / 10">
            <h2 data-copy-id="TEXT_SECTION_11_TITLE">6. 本に合わせて変えられるノンブル・柱</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_11_SUBTITLE">場所：▶設定→ページ・ノンブル・柱</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.folioHeader.file)} alt={HOWTO_IMAGES.folioHeader.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_11_BODY_01">
                ノンブル・柱は固定ではなく、本に合わせて文字サイズ・フォントを変えられます。
                <p>ノンブルは基本的に中央配置ですが、小口・ノド側への配置も可能です。「ノンブル非表示」をチェックすると、断ち切りの内側近くに隠しノンブルが表示されます。通常ノンブルと隠しノンブルの両方を載せることも可能です。</p>
                <p>柱はヘッダー・フッター・ノド・小口中央など、好きな場所へ配置できます。<small>※ノンブルの位置と重ならないよう、各自でご調整ください。</small></p>
                <p>作品全体、長編では章ごと、任意のページ、左右それぞれなど、用途に合わせて設定できます。</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="image-insert">
          <summary className="tip-summary" data-eyebrow="TIPS 07 / 10">
            <h2 data-copy-id="TEXT_SECTION_12_TITLE">7. 挿絵を挿入できる「画像挿入機能」</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_12_SUBTITLE">場所：プレビュー画面→ページ上［…］内</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.imageInsert.file)} alt={HOWTO_IMAGES.imageInsert.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_12_BODY_01">
                挿絵・扉絵などを本文中へ入れたいときは、この機能をどうぞ！ PSDデータも配置可能です（高画質PNGへ変換されます）。
                <p>文章だけの本ではなく、画像を含む構成もページ単位で確認できます。ちょっとした図解を載せたいときにも便利です。</p>
                <p><small>※天地中央以外の細かな場所への配置はできません。<br />※文章の上にかぶさる形で配置されます。テキストエディターには <code>【IMG:…:center】</code> 等と入力されるため、前後に改ページマークダウンを入れることをおすすめします。</small></p>
                <div className="mt-4 rounded border border-ink/10 p-3">
                  <p><strong>画像の72時間保存について</strong></p>
                  <p>72時間の対象は、クラウド作品を別の端末でも開けるように保存する<strong>クラウド上の一時画像コピーだけ</strong>です。この端末のブラウザに保存されている元画像を72時間後に削除する仕組みではありません。</p>
                  <p>画像を含むクラウド保存が正常に完了すると、その時点から一時コピーの期限が72時間に更新されます。期限切れが近い／超過したクラウド作品は、トップページの本棚の背表紙に⚠️が表示されます。</p>
                  <p><strong>画像切れになった場合</strong>、今のブラウザにも元画像がなければ、作業中に該当ページを知らせる警告が出ます。プレビューの画像位置にはCaroadと「再配置してください」の案内が表示され、フッターの「⚠️画像切れ」からページへ移動して、その場で画像を差し替えられます。</p>
                  <p>画像が不要になった場合は、原稿からその画像を削除してください。手動で復旧済みなのに通知だけ残っている場合は、フッターの通知解除を使えます。未解決の画像そのものを通知解除だけで無視することはできません。</p>
                </div>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="colophon">
          <summary className="tip-summary" data-eyebrow="TIPS 08 / 10">
            <h2 data-copy-id="TEXT_SECTION_13_TITLE">8. 横書きの奥付が配置できる「奥付機能」</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_13_SUBTITLE">場所：▶本づくり→奥付（縦）、奥付（横）</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.colophon.file)} alt={HOWTO_IMAGES.colophon.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_13_BODY_01">
                縦と横で、別機能の奥付を付けられます。
                <p><strong>奥付（縦）</strong><br />項目を入力すると、本文の末尾にテキストとして入力されます。テキストエディター内でさらに細かく調整できます。</p>
                <p><strong>奥付（横）</strong><br />TateSpun内で唯一、横書き表記ができる機能です。横書き専用ページをプレビュー内に1枚追加します。テキストエディターではなく、再度「本づくり→奥付（横）」を開くと編集できます。任意の位置にページを配置できます。</p>
                <p>複数種類のテンプレートと配置位置を指定でき、項目も細かくカスタマイズ可能です。1冊につき1ページのみの機能なので、奥付以外にも活用方法がある……かも!?</p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="dark-mode">
          <summary className="tip-summary" data-eyebrow="TIPS 09 / 10">
            <h2 data-copy-id="TEXT_SECTION_14_TITLE">9. 目の疲れにはダークモードを使おう</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_14_SUBTITLE">場所：ヘッダー「画面モード」</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.darkMode.file)} alt={HOWTO_IMAGES.darkMode.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_14_BODY_01">
                TateSpunは初期設定でライトモードになっています。
                <p>長時間明るい画面を見続けると、疲れ目の原因に……。ボタンを押すとダークモードになるので、状況に合わせてモードを変えてみましょう。</p>
                <p><small>※プレビュー画面は白い紙のままです。デスクトップ版でそれが眩しい方は、プレビュー画面上部の「▶プレビュー」の▶を押すと格納できるのでご活用ください。</small></p>
              </div>
            </div>
          </div>
        </details>

        <details className="chapter tip" id="export">
          <summary className="tip-summary" data-eyebrow="TIPS 10 / 10">
            <h2 data-copy-id="TEXT_SECTION_15_TITLE">10. 多機能書き出し・書き出し中断</h2>
            <div className="subhead" data-copy-id="TEXT_SECTION_15_SUBTITLE">場所：プレビュー画面左側「書き出し▼」</div>
            <span className="tip-toggle" aria-hidden="true"></span>
          </summary>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.exportMenu.file)} alt={HOWTO_IMAGES.exportMenu.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_15_BODY_01">
                TateSpunでは現在、JPG／JPG一括（個別・ZIP）／PDFの書き出しが可能です。
                <p>JPGは断ち切りの内側の画像を出力します。サイズは高さ1600px固定のため、原寸書き出しではない点をご承知おきください。</p>
                <p>PDFは全ページ・個別ページの書き出しに加え、次の3パターンで出力できます。</p>
                <ul>
                  <li>仕上がりサイズ（塗り足し内側）</li>
                  <li>断ち落としサイズ（塗り足し3mm込み・トンボなし）</li>
                  <li>入稿用フルサイズ（トンボ＋塗り足し3mm付き）</li>
                </ul>
                <p><strong>作品タイトルと保存名</strong><br />{TITLE_AND_FILENAME_EXPLANATION}</p>
                <p data-copy-id="TEXT_SECTION_15_BODY_02">{PDF_FILENAME_EXPLANATION}</p>
                <p>PDFの解像度・フォント埋め込み・縦組み記号のβ版注意点は、このページ下部の<a href="#faq">FAQ</a>にまとめています。</p>
                <p>デスクトップ版では、出力中にEscを押すと出力を中断できます。「書き出し途中にミスに気付いたけれど、出力が長い……」というときにご活用ください。</p>
                <p><strong>画像切れがあるときは、画像切れを含むページだけ書き出しを停止します。</strong>たとえば12Pだけ画像切れしている場合、5Pだけの単ページ書き出しは可能ですが、12Pを含むJPG・複数ページ出力・全ページPDFは停止します。画像を再配置するか、不要な画像を削除すると再び書き出せます。</p>
              </div>
            </div>
          </div>
        </details>

        <section className="faq" id="faq">
          <p className="howto-chip">Questions</p>
          <h2 data-copy-id="TEXT_FAQ_TITLE">FAQ</h2>
          <p className="section-hint">質問をタップすると、答えがひらきます。</p>

          <details className="faq-item">
            <summary className="faq-q">600dpiでPDFを書き出す必要はありますか？</summary>
            <div className="faq-text" data-copy-id="TEXT_FAQ_PDF_DPI">
              <p><strong>いいえ。TateSpunのPDF出力は、600dpiなどの固定解像度に依存していません。</strong></p>
              <p>本文文字は埋め込みフォントと文字の配置情報を中心に保持し、一部の縦組み字形やトンボなどはベクターデータ（線や輪郭を座標として保持するデータ）としてPDFへ出力します。ページサイズもmm・pt単位の実寸座標で保持されるため、本文文字やトンボの品質は「300dpi」「600dpi」といった画像解像度によって決まるものではありません。</p>
              <p>なお、原稿内に写真やイラストなどの画像を使用する場合は、その画像自体には実効解像度（元画像のピクセル数と、紙面上で使用する大きさから決まるppi）が関係します。印刷所から画像解像度の指定がある場合は、その指定をご確認ください。</p>
              <p>また、印刷所からPDF/Xなど特定のPDF形式を指定されている場合は、印刷所の入稿仕様を優先してください。</p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-q">縦組みで、かぎ括弧の文末の「。」「、」や全角の「！？」「？！」の位置がずれます。</summary>
            <div className="faq-text" data-copy-id="TEXT_FAQ_VERTICAL_PUNCTUATION">
              <p>現在（2026年9月時点）のβ版では、縦組みの約物（句読点・かぎ括弧・感嘆符などの記号）の組版に一部既知の制限があります。</p>
              <p>たとえば「明日も、同じ場所で。」のように、閉じかぎ括弧「」」の直前へ「。」「、」を置いた場合、句読点の位置や文字間隔が不自然になることがあります。</p>
              <p>また、全角の連続記号「！？」「？！」などは、縦組み時の配置によって一部の記号がずれて見える場合があります。</p>
              <p>β版では、気になる場合は「閉じかぎ括弧直前の句点を省く」「全角の！？・？！を半角の!?・?!に置き換える」などの方法をご検討ください。これらは今後の組版改善対象です。</p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-q">印刷所のパソコンにTateSpunと同じフォントがなくても大丈夫ですか？</summary>
            <div className="faq-text" data-copy-id="TEXT_FAQ_FONT_EMBEDDING">
              <p>はい。TateSpunのPDFでは、使用するフォントをPDF内に埋め込んで出力します。そのため、PDFを開く側のパソコンに同じフォントがインストールされていなくても、基本的にはPDF内のフォント情報を使って同じ文字を表示できます。</p>
              <p>現在TateSpunで使用しているShippori Minchoは、SIL Open Font License 1.1のフォントで、PDFへのフォント埋め込みが認められています。</p>
              <p>ただし、印刷所によってPDF/Xなど独自の入稿形式が指定されている場合があります。最終入稿前には、利用する印刷所の入稿仕様もあわせてご確認ください。</p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-q">不具合があったら？</summary>
            <div className="faq-text" data-copy-id="TEXT_FAQ_LEAD">
              <p>エディター内のβ版フィードバック（「報告」ボタン）から送信できます。</p>
              <p>いただいたご報告は真摯に受け止めますが、即時の実装・修正や、すべての内容への対応をお約束するものではありません。</p>
              <p>報告時には、不具合の原因調査のため、ユーザーの利用環境に関する情報を自動で取得します。機種・ブラウザ等に依存するエラーかどうかを調べるために活用しますので、あらかじめご了承ください。</p>
              <p>お名前・住所などの個人情報は書き込まないようお願いいたします。自動で取得するのはブラウザ・端末・表示環境等の情報であり、お名前や住所・所在地を取得するものではありません。作品本文・作品タイトル・ドキュメントIDも自動送信しない設定になっていますので、ご安心ください。</p>
            </div>
          </details>
        </section>

        <section className="greeting" id="report">
          <h2>ごあいさつ。</h2>
          <p>caroad（運営者）です。ここまでご覧くださり、ありがとうございます。</p>
          <p>Windows／Chrome・Googleスマートフォンを中心に動作確認をしています。加えて、協力者によりiPhone／iPad／Safariでの動作確認も行いました。</p>
          <p>それ以外の環境については、2026年9月現在、十分な動作確認を行えていないため、不具合が発生した場合でも対応が難しいことがあります。</p>
          <p>いつでも立ち寄れて、いつでも戻ってこられる場所。そんなTateSpunを目指しています。</p>
          <p>一人でも多くの創作者の皆さまに、快適に執筆活動をしていただけるよう努めてまいります。一緒に育てていけるブラウザアプリだと思って、ご活用いただけるとうれしいです。</p>
          <p>何卒よろしくお願い申し上げます。</p>

          <div className="contact-block">
            <h3>困ったときは</h3>
            <p>詳しい使い方は「ヘルプ」に、不具合や気になる点は「報告」からいつでもどうぞ。</p>
            <div className="contact-actions">
              <button type="button" data-howto-help-cta="" onClick={() => setHelpOpen(true)}>
                ヘルプを見る
              </button>
              {BETA_FEEDBACK_ENABLED && (
                <button
                  type="button"
                  className="primary"
                  data-howto-feedback-cta=""
                  onClick={() => setFeedbackOpen(true)}
                >
                  報告
                </button>
              )}
            </div>
          </div>
        </section>

          </div>
        </div>

        <section className="support-footer" id="support-tatespun" aria-labelledby="support-tatespun-title">
          <h2 id="support-tatespun-title" data-copy-id="TEXT_SUPPORT_TITLE">{SUPPORT_HEADING}</h2>
          <p className="support-lead" data-copy-id="TEXT_SUPPORT_LEAD">{SUPPORT_BODY}</p>
          <div className="support-actions">
            <a
              className="support-button"
              data-support-cta="fanbox"
              href={SUPPORT_FANBOX_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {SUPPORT_FANBOX_LABEL}
            </a>
            <a
              className="support-button"
              data-support-cta="ofuse"
              href={SUPPORT_OFUSE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {SUPPORT_OFUSE_LABEL}
            </a>
          </div>
          <p className="support-note" data-copy-id="TEXT_SUPPORT_NOTE">{SUPPORT_NOTE}</p>
        </section>

        <section className="devlog" id="devlog">
          <div className="devlog-heading">
            <div>
              <span>UPDATE / DEBUG LOG</span>
              <h2 data-copy-id="TEXT_DEVLOG_TITLE">更新・デバッグログ</h2>
            </div>
          </div>
          <div className="log-list">
            {logLoadError && (
              <p className="log-empty">更新履歴を読み込めませんでした。時間をおいてもう一度ご確認ください。</p>
            )}
            {!logLoadError && sortedLogs.length === 0 && (
              <p className="log-empty">更新履歴を読み込み中です…</p>
            )}
            {visibleLogs.map((entry, i) => (
              <article className="log-row" key={`${entry.date}-${i}`}>
                <div className="log-date">{entry.date}</div>
                <div className="log-type">{entry.type}</div>
                <div>
                  <div className="log-title">{entry.title}</div>
                  <div className="log-body">{entry.body}</div>
                </div>
              </article>
            ))}
          </div>
          {visibleLogCount < sortedLogs.length && (
            <button
              className="more-logs"
              type="button"
              onClick={() => setVisibleLogCount((v) => v + 8)}
            >
              もっと見る
            </button>
          )}
        </section>

        {/* TSP-RC-AFFILIATE-FOOTER-001: hidden entirely unless at least one
            of Amazon/Rakuten has real config (resolveAffiliateFooterConfig).
            No support/donation-style call to action -- plain "buy via this
            link" wording only, per Amazon/Rakuten program compliance. */}
        {AFFILIATE_FOOTER.showSection && (
          <section className="affiliate-footer" id="shopping-links">
            <h2 data-copy-id="TEXT_AFFILIATE_TITLE">お買い物リンク</h2>
            <p className="affiliate-lead" data-copy-id="TEXT_AFFILIATE_LEAD">
              TateSpunでは、Amazon・楽天市場のお買い物リンクをご案内しています。
            </p>
            <div className="affiliate-actions">
              {AFFILIATE_FOOTER.amazon && (
                <a
                  className="affiliate-button"
                  data-affiliate-cta="amazon"
                  href={AFFILIATE_FOOTER.amazon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Amazonでお買い物（外部サイトが新しいタブで開きます）"
                >
                  Amazonでお買い物
                </a>
              )}
              {AFFILIATE_FOOTER.rakuten && (
                <a
                  className="affiliate-button"
                  data-affiliate-cta="rakuten"
                  href={AFFILIATE_FOOTER.rakuten.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="楽天市場でお買い物（外部サイトが新しいタブで開きます）"
                >
                  楽天市場でお買い物
                </a>
              )}
            </div>
            <p className="affiliate-disclosure" data-copy-id="TEXT_AFFILIATE_DISCLOSURE_GENERAL">
              このページにはアフィリエイトリンクが含まれます。リンク経由の購入により、運営者が紹介料を受け取る場合があります。
            </p>
            {AFFILIATE_FOOTER.amazon && (
              <p className="affiliate-disclosure" data-copy-id="TEXT_AFFILIATE_DISCLOSURE_AMAZON">
                Amazonのアソシエイトとして、{AFFILIATE_FOOTER.amazon.operatorName}は適格販売により収入を得ています。
              </p>
            )}
          </section>
        )}
      </main>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {BETA_FEEDBACK_ENABLED && feedbackOpen && (
        <BetaFeedbackModal onClose={() => setFeedbackOpen(false)} />
      )}
    </div>
  );
}

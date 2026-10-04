"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import BetaFeedbackModal from "@/components/BetaFeedbackModal";
import HelpModal from "@/components/HelpModal";
import { resolveAffiliateFooterConfig } from "@/lib/howtoContent";
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
  USE_CASE_PREPARING_LABEL,
  USE_CASE_DETAIL_LABEL,
  SHORT_POEM_STEPS_HEADING,
  SHORT_POEM_STEPS,
} from "@/lib/useCaseExamples";
import { parseUpdateHistory, type UpdateHistoryEntry } from "@/lib/updateHistory";
import { FEATURES, TIPS, HERO_IMAGE, GUIDE_CAT, type HowtoItem } from "./content";
import "./howto-v2.css";

/**
 * TSP-HOWTO-001 — redesigned HOW TO, built beside the live `/howto` so the
 * current page stays untouched until なつお approves the swap.
 *
 * Layout follows the 「HOW TO TateSpun 再設計案」 design (なつお, 2026-10-04):
 * a header that hides while scrolling down, a hero, 「はじめかた」 in three
 * steps, the 5 essentials as tabs, the 10 tips as cards that open a dialog,
 * help + FAQ, the greeting letter with the support block, and the update log
 * (newest 3 + fold, kept from TSP-HISTORY-001). Every chapter of the current
 * page is kept (quick reference, use cases, short poems, review tools).
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

const RECENT_LOG_COUNT = 3;

const toHowToLogEntry = (entry: UpdateHistoryEntry): UpdateLogEntry => ({
  date: formatCanonicalLogDate(entry.date),
  type: entry.type ?? "improvement",
  title: entry.title,
  body: entry.detail,
});

const asset = (file: string) => withBasePath(`/howto/assets/${file}`);
const HOWTO_GUIDE_VIDEO_SRC = withBasePath("/howto/media/tatespun-beta-guide.mp4");
const HOWTO_GUIDE_VIDEO_POSTER = withBasePath("/howto/media/tatespun-beta-guide-poster.webp");
const AFFILIATE_FOOTER = resolveAffiliateFooterConfig({
  amazonUrl: process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_URL,
  amazonAssociateOperatorName: process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_OPERATOR_NAME,
  rakutenUrl: process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_URL,
});

// Same rows as /howto; the chapters they point at now live in the 5選 tabs
// or the 小技 dialogs, which the hash router below opens.
const HOWTO_QUICK_REFERENCE: { task: string; where: string; href: string }[] = [
  { task: "Word・TXTの原稿を読み込む", where: "▶本づくり→原稿ファイル", href: "#varied-use" },
  { task: "用紙・フォント・余白を変える", where: "テキストエディター直上→▶設定", href: "#settings" },
  { task: "ルビ・縦中横・改ページを入れる", where: "タイトル下／ヘルプの中", href: "#body-notation" },
  { task: "本の形で確かめる", where: "プレビュー（ズーム50％・100％・200％）", href: "#preview" },
  { task: "元に戻す・改ページ・検索・置換", where: "テキストエディター直上の４ボタン", href: "#four-buttons" },
  { task: "文章を見直す", where: "「見直し」→文章チェックβ・作業カウンター など", href: "#review-tools" },
  { task: "挿絵を入れる", where: "プレビュー画面→ページ上［…］内", href: "#image-insert" },
  { task: "奥付を入れる", where: "▶本づくり→奥付（縦）、奥付（横）", href: "#colophon" },
  { task: "PDF・JPGで書き出す", where: "プレビュー画面左側「書き出し▼」", href: "#export" },
];

const indexOfItem = (items: HowtoItem[], id: string) =>
  items.findIndex((item) => item.id === id || item.alias?.includes(id));

// Old /howto anchors that moved into the 文章見直しツール chapter.
const MOVED_ANCHORS: Record<string, string> = {
  "writing-check": "review-writing-check",
  "work-counter": "review-work-counter",
};

const Arrow = ({ dir = "right" }: { dir?: "right" | "down" | "up" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "right" && <path d="M5 12h14M13 6l6 6-6 6" />}
    {dir === "down" && <path d="M12 5v14M6 13l6 6 6-6" />}
    {dir === "up" && <path d="M12 19V5M6 11l6-6 6 6" />}
  </svg>
);

const Pin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const Plus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function HowToV2Page() {
  const [feat, setFeat] = useState(0);
  const [tip, setTip] = useState(-1);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logs, setLogs] = useState<UpdateLogEntry[]>([]);
  const [olderLogsOpen, setOlderLogsOpen] = useState(false);
  const [logLoadError, setLogLoadError] = useState(false);
  const lastY = useRef(0);
  const menuOpenRef = useRef(false);
  const tipReturnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  // Header hides while scrolling down and comes back on the way up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setHidden(y > lastY.current && y > 160 && !menuOpenRef.current);
      setSolid(y > 40);
      setShowTop(y > 900);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openTip = useCallback((index: number, from?: HTMLElement | null) => {
    tipReturnFocus.current = from ?? (document.activeElement as HTMLElement | null);
    setTip(index);
  }, []);

  const closeTip = useCallback(() => {
    setTip(-1);
    requestAnimationFrame(() => tipReturnFocus.current?.focus());
  }, []);

  // In-page anchors (and shared #hash URLs, incl. the old /howto ones) open
  // the 5選 tab or the 小技 dialog they name.
  useEffect(() => {
    const route = (hash: string): boolean => {
      if (!hash || hash.length < 2) return false;
      const id = decodeURIComponent(hash.slice(1));
      const f = indexOfItem(FEATURES, id);
      if (f >= 0) {
        setFeat(f);
        document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
        return true;
      }
      const t = indexOfItem(TIPS, id);
      if (t >= 0) {
        document.getElementById("tips")?.scrollIntoView({ behavior: "smooth" });
        openTip(t);
        return true;
      }
      const moved = MOVED_ANCHORS[id];
      const target = document.getElementById(moved ?? id);
      const details = target?.closest("details");
      if (details && !details.open) details.open = true;
      if (moved) {
        target?.scrollIntoView({ behavior: "smooth" });
        return true;
      }
      return false;
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      setMenuOpen(false);
      if (route(href)) {
        event.preventDefault();
        if (tip >= 0 && indexOfItem(TIPS, href.slice(1)) < 0) setTip(-1);
      }
    };
    const onHash = () => {
      if (!route(window.location.hash)) {
        document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
      }
    };
    if (window.location.hash) onHash();
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [openTip, tip]);

  // Dialog: Esc closes, ←/→ move between tips, the page behind stops scrolling.
  useEffect(() => {
    if (tip < 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTip();
      if (event.key === "ArrowRight") setTip((v) => (v + 1) % TIPS.length);
      if (event.key === "ArrowLeft") setTip((v) => (v + TIPS.length - 1) % TIPS.length);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    document.getElementById("v2-tip-close")?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [tip, closeTip]);

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
  // TSP-HISTORY-001: only the newest few updates show; the rest fold away.
  const visibleLogs = olderLogsOpen ? sortedLogs : sortedLogs.slice(0, RECENT_LOG_COUNT);
  const olderLogCount = Math.max(0, sortedLogs.length - RECENT_LOG_COUNT);

  const current = FEATURES[feat];
  const nextFeat = (feat + 1) % FEATURES.length;
  const openedTip = tip >= 0 ? TIPS[tip] : null;

  const NAV = [
    { href: "#start", label: "はじめかた", long: "はじめかた" },
    { href: "#features", label: "5つの機能", long: "まずは知ってほしい5つの機能" },
    { href: "#tips", label: "小技10選", long: "便利な小技10選" },
    { href: "#review-tools", label: "見直し", long: "文章見直しツール" },
    { href: "#help", label: "困ったとき", long: "困ったとき・FAQ" },
  ];

  return (
    <div className="htv2" id="top" lang="ja" data-howto-page="v2">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&display=swap" />

      <header className={`v2-hdr${hidden ? " is-hidden" : ""}${solid || menuOpen ? " is-solid" : ""}`}>
        <div className="v2-hdr-in">
          <a className="v2-logo" href="#top" aria-label="HOW TO TateSpun のトップへ戻る">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="v2-logo-cat" src={asset(GUIDE_CAT.file)} alt="" width={44} height={44} />
            <span className="v2-logo-txt"><small>HOW TO</small><b>TateSpun</b></span>
          </a>
          <nav className="v2-gnav" aria-label="ページ内メニュー">
            {NAV.map((item) => (
              <a key={item.href} className="v2-gl" href={item.href}>{item.label}</a>
            ))}
            <button type="button" className="v2-gl v2-gl-btn" onClick={() => setHelpOpen(true)}>ヘルプ</button>
            <Link className="v2-btn v2-sm v2-pri v2-demo" href="/editor?demo=1">
              デモを見る
              <Arrow />
            </Link>
            <button
              className="v2-menu-btn"
              type="button"
              aria-label="メニューを開閉する"
              aria-expanded={menuOpen}
              aria-controls="v2-mnav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
          </nav>
        </div>
      </header>
      {menuOpen && (
        <nav className="v2-mnav" id="v2-mnav" aria-label="メニュー">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>{item.long}<span aria-hidden="true">→</span></a>
          ))}
          <button type="button" onClick={() => { setMenuOpen(false); setHelpOpen(true); }}>ヘルプを見る<span aria-hidden="true">→</span></button>
          <Link href="/editor?demo=1">デモを見る<span aria-hidden="true">→</span></Link>
          <Link href="/">本棚に戻る<span aria-hidden="true">→</span></Link>
        </nav>
      )}

      <main>
        {/* ============ HERO ============ */}
        <section className="v2-hero">
          <div className="v2-wrap v2-hero-grid">
            <div>
              <span className="v2-eyebrow">HOW TO TateSpun</span>
              <h1 className="v2-mincho">
                <span className="v2-nw">縦書きの</span><span className="v2-nw">本づくりを、</span><br />
                <span className="v2-nw"><span className="v2-mk">3ステップ</span>で。</span>
              </h1>
              <p className="v2-hero-lead">
                色々出来るTateSpun<br />是非知ってもらいたい機能を<br />こちらのページにまとめました。
                <br />ブラウザだけで動作し、原稿はあなたのものです。
              </p>
              <div className="v2-hero-cta">
                <a className="v2-btn v2-pri" href="#start">
                  はじめかたを見る
                  <Arrow dir="down" />
                </a>
                <Link className="v2-btn" href="/editor?demo=1">デモを見る</Link>
                <Link className="v2-btn v2-ghost" href="/">本棚に戻る</Link>
              </div>
              <div className="v2-hero-meta">
                <span>インストール不要</span>
                <span>PDF・JPG書き出し</span>
                <span>β版公開中</span>
              </div>
            </div>
            <div className="v2-hero-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(HERO_IMAGE.file)} alt={HERO_IMAGE.alt} />
            </div>
          </div>
        </section>

        <hr className="v2-dash" />

        {/* ============ START: 3 STEPS ============ */}
        <section className="v2-sec" id="start">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">はじめかた</span>
              <div>
                <h2 className="v2-mincho">はじめての方は、この順番で。</h2>
                <p>気になるところだけ、各ステップのリンクから詳しく読めます。</p>
              </div>
            </div>

            <ol className="v2-steps">
              <li className="v2-step">
                <span className="v2-num">01</span>
                <h3>原稿を用意する</h3>
                <p>エディターに直接書くか、ほかのアプリで書いた原稿（TXT・Word）を読み込みます。</p>
                <div className="v2-step-links">
                  <a className="v2-chip" href="#varied-use">原稿の持ち込み</a>
                  <a className="v2-chip" href="#body-notation">本文記法</a>
                </div>
              </li>
              <li className="v2-step">
                <span className="v2-num">02</span>
                <h3>本の形に整える</h3>
                <p>用紙・フォント・余白を決めて、プレビューで仕上がりを確かめます。</p>
                <div className="v2-step-links">
                  <a className="v2-chip" href="#settings">設定</a>
                  <a className="v2-chip" href="#preview">プレビュー</a>
                  <a className="v2-chip" href="#folio-header">ノンブル・柱</a>
                </div>
              </li>
              <li className="v2-step">
                <span className="v2-num">03</span>
                <h3>確かめて、書き出す</h3>
                <p>完成前チェックで最終確認して、PDF・JPGに書き出します。</p>
                <div className="v2-step-links">
                  <a className="v2-chip" href="#export">書き出し</a>
                  <a className="v2-chip" href="#my-check">マイチェック</a>
                </div>
              </li>
            </ol>

            <div className="v2-video">
              <video className="v2-video-el" controls playsInline preload="metadata" poster={HOWTO_GUIDE_VIDEO_POSTER}>
                <source src={HOWTO_GUIDE_VIDEO_SRC} type="video/mp4" />
                この環境では動画を再生できません。
              </video>
              <div>
                <h3 className="v2-mincho">動画で、ひととおり見る。</h3>
                <p>β版公開前に制作したTateSpunの案内動画です。現在とは一部、画面や表記が異なる場合があります。</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 5 FEATURES ============ */}
        <section className="v2-sec v2-tint" id="features" aria-labelledby="v2-features-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">五つの機能</span>
              <div>
                <h2 className="v2-mincho" id="v2-features-title">まずは知ってほしい<br />５つの機能</h2>
                <p>はじめての1冊で、かならず通る5つです。</p>
              </div>
            </div>

            <div className="v2-feat">
              <div className="v2-ftabs" role="tablist" aria-label="5つの機能">
                {FEATURES.map((f, i) => (
                  <button
                    key={f.id}
                    id={`v2-ftab-${f.id}`}
                    className={`v2-ftab${i === feat ? " is-on" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={i === feat}
                    aria-controls="v2-fpanel"
                    tabIndex={i === feat ? 0 : -1}
                    onClick={() => setFeat(i)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                      event.preventDefault();
                      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                      const next = (i + step + FEATURES.length) % FEATURES.length;
                      setFeat(next);
                      document.getElementById(`v2-ftab-${FEATURES[next].id}`)?.focus();
                    }}
                  >
                    <span className="v2-num">{f.no}</span>
                    <span><b>{f.short}</b><small>{f.kicker}</small></span>
                  </button>
                ))}
              </div>

              <div className="v2-fpanel" id="v2-fpanel" role="tabpanel" aria-labelledby={`v2-ftab-${current.id}`} key={current.id}>
                <figure className="v2-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(current.image.file)} alt={current.image.alt} loading="lazy" />
                </figure>
                <div className="v2-fbody">
                  <span className="v2-place"><Pin />{current.place}</span>
                  <h3 className="v2-mincho"><span className="v2-fno">ESSENTIAL {current.no} / 05</span>{current.title}</h3>
                  <div className="v2-copy">{current.body}</div>
                  <div className="v2-fnext">
                    <button className="v2-btn v2-sm" type="button" onClick={() => {
                      setFeat(nextFeat);
                      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                    }}>
                      次の機能：{FEATURES[nextFeat].short}
                      <Arrow />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 10 TIPS ============ */}
        <section className="v2-sec" id="tips" aria-labelledby="v2-tips-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">十の小技</span>
              <div>
                <h2 className="v2-mincho" id="v2-tips-title">便利な小技<br />10選β版</h2>
                <p>慣れてきたら。カードを押すと、画面の写真と使い方がひらきます。</p>
              </div>
            </div>
            <ul className="v2-tips">
              {TIPS.map((t, i) => (
                <li key={t.id}>
                  <button className="v2-tip" type="button" aria-haspopup="dialog" onClick={(event) => openTip(i, event.currentTarget)}>
                    <span className="v2-tip-shot">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset(t.image.file)} alt="" loading="lazy" />
                    </span>
                    <span className="v2-tip-txt">
                      <span className="v2-num">{t.no}</span>
                      <b>{t.short}</b>
                      <span className="v2-one">{t.kicker}</span>
                      <span className="v2-more">くわしく<Plus /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="v2-dash" />

        {/* ============ REVIEW TOOLS ============ */}
        <section className="v2-sec" id="review-tools" aria-labelledby="v2-review-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">見直す</span>
              <div>
                <h2 className="v2-mincho" id="v2-review-title">文章見直し<br />ツール</h2>
                <p>エディターの「見直し」には、原稿を書きながら確認したい機能をまとめています。PCではプレビュー下の見直しバー、モバイルではエディター下の1行バーから開けます。</p>
              </div>
            </div>

            <div className="v2-review">
              <div className="v2-review-usage">
                <h3>よく使う機能はフッターに最大2つまで</h3>
                <p>各機能の「フッターに表示」から、すぐ触りたい機能を最大2つまで選べます。フッター表示は機能そのもののON／OFFとは別です。フッターから外しても「見直し」を開けばいつでも使えます。設定はこのブラウザに保存されます。</p>
              </div>
              <div className="v2-acc">
                <details id="review-writing-check">
                  <summary><span className="v2-acc-no">A</span>文章チェックβ<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-acc-body v2-copy">
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
                </details>
                <details id="review-work-counter">
                  <summary><span className="v2-acc-no">B</span>作業カウンター<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-acc-body v2-copy">
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
                </details>
                <details id="review-read-aloud">
                  <summary><span className="v2-acc-no">C</span>音読β<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-acc-body v2-copy">
                    <p>原稿をブラウザや端末の読み上げ機能で音読し、目で読むだけでは気づきにくい文章の引っかかりや誤字を確認するための機能です。</p>
                    <h4>読み上げる範囲と操作</h4>
                    <p>「選択範囲」「現在の段落」「全文」から読み上げる範囲を選べます。読み上げ中は一時停止・再開・停止ができ、速度も調整できます。利用できる環境では読み上げに使う音声も選べます。</p>
                    <p>音声読み上げに対応していないブラウザや、端末に日本語音声がない環境では使用できない場合があります。</p>
                    <h4>読み辞書</h4>
                    <p>固有名詞など、読み上げ方を直したい言葉と読みを登録できます。読み方は <strong>本文に明示したルビ → 音読βの読み辞書 → ブラウザ／端末の通常の読み方</strong> の順で優先されます。読み辞書は本文を書き換えず、このブラウザ内に保存されます。</p>
                    <h4>プライバシー</h4>
                    <p>この端末の音声を選んでいる場合、音読のために原稿を外部へ送りません。オンライン音声を選んだ場合は、読み上げる本文がブラウザの音声サービスへ送られる場合があり、その場合は画面にも注意が表示されます。</p>
                  </div>
                </details>
                <details id="review-description-check">
                  <summary><span className="v2-acc-no">D</span>描写語・修飾表現チェックβ<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-acc-body v2-copy">
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
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* ============ USE CASES ============ */}
        <section className="v2-sec v2-tint" id="use-cases" aria-labelledby="v2-use-cases-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">使い方の例</span>
              <div>
                <h2 className="v2-mincho" id="v2-use-cases-title">{USE_CASES_HEADING}</h2>
                <p>{USE_CASES_LEAD}</p>
              </div>
            </div>
            <ul className="v2-cases">
              {USE_CASE_EXAMPLES.map((item) => (
                <li key={item.title}>
                  <b>{item.title}{item.preparing && <em className="v2-preparing">{USE_CASE_PREPARING_LABEL}</em>}</b>
                  <span>{item.body}</span>
                  {item.detail && (
                    <details className="v2-case-detail">
                      <summary>{item.detail.summary}</summary>
                      <p>{item.detail.body}</p>
                    </details>
                  )}
                  {item.elsewhere && (
                    <a href={item.elsewhere.href} className="v2-case-more">{item.elsewhere.label} <i aria-hidden="true">→</i></a>
                  )}
                  {item.howtoHash && (
                    <a href={item.howtoHash} className="v2-case-more">{USE_CASE_DETAIL_LABEL} <i aria-hidden="true">→</i></a>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="v2-cases-sub">{USE_CASES_NOT_YET_HEADING}</h3>
            <ul className="v2-cases v2-cases-notyet">
              {USE_CASES_NOT_YET.map((item) => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                  {item.detail && (
                    <details className="v2-case-detail">
                      <summary>{item.detail.summary}</summary>
                      <p>{item.detail.body}</p>
                    </details>
                  )}
                  {item.elsewhere && (
                    <a href={item.elsewhere.href} className="v2-case-more">{item.elsewhere.label} <i aria-hidden="true">→</i></a>
                  )}
                </li>
              ))}
            </ul>

            <div className="v2-poems" id="short-poems">
              <h3 className="v2-mincho">{SHORT_POEM_STEPS_HEADING}</h3>
              <ol>
                {SHORT_POEM_STEPS.map((step, i) => (
                  <li key={step.title}>
                    <span className="v2-num">{String(i + 1).padStart(2, "0")}</span>
                    <div><b>{step.title}</b><span>{step.body}</span></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ============ QUICK REFERENCE ============ */}
        <section className="v2-sec" id="quick-reference" aria-labelledby="v2-quick-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">早見表</span>
              <div>
                <h2 className="v2-mincho" id="v2-quick-title">よく使う操作と、その場所</h2>
                <p>やりたいことから探せます。項目を選ぶと、くわしい説明の章へ移動します。</p>
              </div>
            </div>
            <ol className="v2-quick">
              {HOWTO_QUICK_REFERENCE.map((row) => (
                <li key={row.task}>
                  <a href={row.href}>
                    <b>{row.task}</b>
                    <span>{row.where}</span>
                    <Arrow />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <hr className="v2-dash" />

        {/* ============ HELP / FAQ ============ */}
        <section className="v2-sec" id="help" aria-labelledby="v2-help-title">
          <div className="v2-wrap">
            <div className="v2-sec-head">
              <span className="v2-spine">困ったとき</span>
              <div>
                <h2 className="v2-mincho" id="v2-help-title">困ったときは、ここから。</h2>
              </div>
            </div>
            <div className="v2-help" id="report">
              <div className="v2-help-cards">
                <div className="v2-hcard v2-dark">
                  <h3>困ったときは</h3>
                  <p>詳しい使い方は「ヘルプ」に、不具合や気になる点は「報告」からいつでもどうぞ。</p>
                  <div className="v2-hcard-actions">
                    <button className="v2-btn v2-sm" type="button" data-howto-help-cta="" onClick={() => setHelpOpen(true)}>ヘルプを見る</button>
                    {BETA_FEEDBACK_ENABLED && (
                      <button className="v2-btn v2-sm" type="button" data-howto-feedback-cta="" onClick={() => setFeedbackOpen(true)}>報告</button>
                    )}
                  </div>
                </div>
                <div className="v2-hcard">
                  <h3>動作を確認している環境</h3>
                  <p>Windows／Chrome・Googleスマートフォンを中心に動作確認をしています。加えて、協力者によりiPhone／iPad／Safariでの動作確認も行いました。</p>
                  <p>それ以外の環境については、2026年9月現在、十分な動作確認を行えていないため、不具合が発生した場合でも対応が難しいことがあります。</p>
                </div>
              </div>

              <div className="v2-faq" id="faq">
                <details>
                  <summary><span className="v2-q">Q</span>600dpiでPDFを書き出す必要はありますか？<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-a">
                    <p><strong>いいえ。TateSpunのPDF出力は、600dpiなどの固定解像度に依存していません。</strong></p>
                    <p>本文文字は埋め込みフォントと文字の配置情報を中心に保持し、一部の縦組み字形やトンボなどはベクターデータ（線や輪郭を座標として保持するデータ）としてPDFへ出力します。ページサイズもmm・pt単位の実寸座標で保持されるため、本文文字やトンボの品質は「300dpi」「600dpi」といった画像解像度によって決まるものではありません。</p>
                    <p>なお、原稿内に写真やイラストなどの画像を使用する場合は、その画像自体には実効解像度（元画像のピクセル数と、紙面上で使用する大きさから決まるppi）が関係します。印刷所から画像解像度の指定がある場合は、その指定をご確認ください。</p>
                    <p>また、印刷所からPDF/Xなど特定のPDF形式を指定されている場合は、印刷所の入稿仕様を優先してください。</p>
                  </div>
                </details>
                <details>
                  <summary><span className="v2-q">Q</span>縦組みで、かぎ括弧の文末の「。」「、」や全角の「！？」「？！」の位置がずれます。<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-a">
                    <p>現在（2026年9月時点）のβ版では、縦組みの約物（句読点・かぎ括弧・感嘆符などの記号）の組版に一部既知の制限があります。</p>
                    <p>たとえば「明日も、同じ場所で。」のように、閉じかぎ括弧「」」の直前へ「。」「、」を置いた場合、句読点の位置や文字間隔が不自然になることがあります。</p>
                    <p>また、全角の連続記号「！？」「？！」などは、縦組み時の配置によって一部の記号がずれて見える場合があります。</p>
                    <p>β版では、気になる場合は「閉じかぎ括弧直前の句点を省く」「全角の！？・？！を半角の!?・?!に置き換える」などの方法をご検討ください。これらは今後の組版改善対象です。</p>
                  </div>
                </details>
                <details>
                  <summary><span className="v2-q">Q</span>印刷所のパソコンにTateSpunと同じフォントがなくても大丈夫ですか？<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-a">
                    <p>はい。TateSpunのPDFでは、使用するフォントをPDF内に埋め込んで出力します。そのため、PDFを開く側のパソコンに同じフォントがインストールされていなくても、基本的にはPDF内のフォント情報を使って同じ文字を表示できます。</p>
                    <p>現在TateSpunで使用しているShippori Minchoは、SIL Open Font License 1.1のフォントで、PDFへのフォント埋め込みが認められています。</p>
                    <p>ただし、印刷所によってPDF/Xなど独自の入稿形式が指定されている場合があります。最終入稿前には、利用する印刷所の入稿仕様もあわせてご確認ください。</p>
                  </div>
                </details>
                <details>
                  <summary><span className="v2-q">Q</span>不具合があったら？<span className="v2-pm" aria-hidden="true"><Plus /></span></summary>
                  <div className="v2-a">
                    <p>エディター内のβ版フィードバック（「報告」ボタン）から送信できます。</p>
                    <p>いただいたご報告は真摯に受け止めますが、即時の実装・修正や、すべての内容への対応をお約束するものではありません。</p>
                    <p>報告時には、不具合の原因調査のため、ユーザーの利用環境に関する情報を自動で取得します。機種・ブラウザ等に依存するエラーかどうかを調べるために活用しますので、あらかじめご了承ください。</p>
                    <p>お名前・住所などの個人情報は書き込まないようお願いいたします。自動で取得するのはブラウザ・端末・表示環境等の情報であり、お名前や住所・所在地を取得するものではありません。作品本文・作品タイトル・ドキュメントIDも自動送信しない設定になっていますので、ご安心ください。</p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LETTER + SUPPORT ============ */}
        <section className="v2-sec v2-sec-tight">
          <div className="v2-wrap">
            <div className="v2-letter">
              <div className="v2-support" id="support-tatespun" aria-labelledby="support-tatespun-title">
                <span className="v2-eyebrow">SUPPORT</span>
                <h3 className="v2-mincho" id="support-tatespun-title">{SUPPORT_HEADING}</h3>
                <p>{SUPPORT_BODY}</p>
                <div className="v2-support-actions">
                  <a className="v2-btn v2-sm" data-support-cta="ofuse" href={SUPPORT_OFUSE_URL} target="_blank" rel="noopener noreferrer">{SUPPORT_OFUSE_LABEL}</a>
                  <a className="v2-btn v2-sm" data-support-cta="fanbox" href={SUPPORT_FANBOX_URL} target="_blank" rel="noopener noreferrer">{SUPPORT_FANBOX_LABEL}</a>
                </div>
                <p className="v2-support-note">{SUPPORT_NOTE}</p>
              </div>
              <div className="v2-letter-v" id="greeting">
                <h2>ごあいさつ。</h2>
                <p>caroad（運営者）です。ここまでご覧くださり、ありがとうございます。</p>
                <p>いつでも立ち寄れて、いつでも戻ってこられる場所。そんなTateSpunを目指しています。</p>
                <p>一人でも多くの創作者の皆さまに、快適に執筆活動をしていただけるよう努めてまいります。一緒に育てていけるブラウザアプリだと思って、ご活用いただけるとうれしいです。</p>
                <p>何卒よろしくお願い申し上げます。</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LOG ============ */}
        <section className="v2-sec v2-sec-log" id="devlog" aria-labelledby="v2-devlog-title">
          <div className="v2-wrap">
            <div className="v2-sec-head v2-sec-head-sm">
              <span className="v2-spine">更新記録</span>
              <div>
                <h2 className="v2-mincho" id="v2-devlog-title">更新・デバッグログ</h2>
              </div>
            </div>
            <div className="v2-log" id="devlog-list">
              {logLoadError && <p className="v2-log-empty">更新履歴を読み込めませんでした。時間をおいてもう一度ご確認ください。</p>}
              {!logLoadError && sortedLogs.length === 0 && <p className="v2-log-empty">更新履歴を読み込み中です…</p>}
              {visibleLogs.map((entry, i) => (
                <article className="v2-log-row" key={`${entry.date}-${i}`}>
                  <time>{entry.date}</time>
                  <span className={`v2-badge${/fix|bug/i.test(entry.type) ? " is-fix" : ""}`}>{entry.type}</span>
                  <div><b>{entry.title}</b><span>{entry.body}</span></div>
                </article>
              ))}
            </div>
            {olderLogCount > 0 && (
              <div className="v2-log-more">
                <button
                  className="v2-btn v2-sm"
                  type="button"
                  aria-expanded={olderLogsOpen}
                  aria-controls="devlog-list"
                  onClick={(event) => {
                    const button = event.currentTarget;
                    setOlderLogsOpen((v) => !v);
                    // Folding a long list would leave the reader far below it:
                    // follow the button back up to where the newest 3 end.
                    if (olderLogsOpen) {
                      requestAnimationFrame(() => button.scrollIntoView({ block: "center" }));
                    }
                  }}
                >
                  {olderLogsOpen ? "過去の更新をたたむ" : `過去の更新を見る（${olderLogCount}件）`}
                </button>
              </div>
            )}
          </div>
        </section>

        {AFFILIATE_FOOTER.showSection && (
          <section className="v2-sec v2-sec-tight v2-affiliate" id="shopping-links">
            <div className="v2-wrap">
              <h2>お買い物リンク</h2>
              <p>TateSpunでは、Amazon・楽天市場のお買い物リンクをご案内しています。</p>
              <div className="v2-support-actions">
                {AFFILIATE_FOOTER.amazon && (
                  <a className="v2-btn v2-sm" data-affiliate-cta="amazon" href={AFFILIATE_FOOTER.amazon.url} target="_blank" rel="noopener noreferrer" aria-label="Amazonでお買い物（外部サイトが新しいタブで開きます）">Amazonでお買い物</a>
                )}
                {AFFILIATE_FOOTER.rakuten && (
                  <a className="v2-btn v2-sm" data-affiliate-cta="rakuten" href={AFFILIATE_FOOTER.rakuten.url} target="_blank" rel="noopener noreferrer" aria-label="楽天市場でお買い物（外部サイトが新しいタブで開きます）">楽天市場でお買い物</a>
                )}
              </div>
              <p className="v2-support-note">このページにはアフィリエイトリンクが含まれます。リンク経由の購入により、運営者が紹介料を受け取る場合があります。</p>
              {AFFILIATE_FOOTER.amazon && (
                <p className="v2-support-note">Amazonのアソシエイトとして、{AFFILIATE_FOOTER.amazon.operatorName}は適格販売により収入を得ています。</p>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="v2-wrap v2-foot">
        <a className="v2-logo" href="#top"><span className="v2-logo-txt"><small>HOW TO</small><b>TateSpun</b></span></a>
        <div className="v2-foot-links">
          <Link href="/">本棚に戻る</Link>
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
          <a href="#quick-reference">早見表</a>
          <a href="#devlog">更新・デバッグログ</a>
        </div>
      </footer>

      <a className={`v2-to-top${showTop ? "" : " is-off"}`} href="#top" aria-label="ページの先頭へ">
        <Arrow dir="up" />
      </a>

      {openedTip && (
        <div className="v2-scrim">
          <button className="v2-scrim-close" type="button" tabIndex={-1} aria-label="閉じる" onClick={closeTip}></button>
          <div className="v2-modal" role="dialog" aria-modal="true" aria-labelledby="v2-tip-title" id={openedTip.id} key={openedTip.id}>
            <button id="v2-tip-close" className="v2-x" type="button" aria-label="閉じる" onClick={closeTip}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <figure className="v2-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(openedTip.image.file)} alt={openedTip.image.alt} />
            </figure>
            <div className="v2-mbody">
              <span className="v2-num v2-mno">{openedTip.no}</span>
              <h3 className="v2-mincho" id="v2-tip-title">{openedTip.title}</h3>
              <span className="v2-place"><Pin />{openedTip.place}</span>
              <div className="v2-copy">{openedTip.body}</div>
              <div className="v2-mnavs">
                <button className="v2-btn v2-sm" type="button" onClick={() => setTip((tip + TIPS.length - 1) % TIPS.length)}>← 前の小技</button>
                <button className="v2-btn v2-sm v2-pri" type="button" onClick={() => setTip((tip + 1) % TIPS.length)}>次の小技 →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {BETA_FEEDBACK_ENABLED && feedbackOpen && <BetaFeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

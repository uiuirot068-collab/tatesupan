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
  PDF_FILENAME_EXPLANATION,
  resolveAffiliateFooterConfig,
} from "@/lib/howtoContent";
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

const FALLBACK_LOGS: UpdateLogEntry[] = [
  {
    date: "2026-09-12",
    type: "update",
    title: "HOW TO TateSpun v3.4",
    body: "Hero画像を差し替え、説明文とFAQ構成を更新しました。",
  },
  {
    date: "2026-09-12",
    type: "fix",
    title: "Section 05",
    body: "「ここで書かなくてもいい」原稿持ち込み運用の場所を「▶オプション→TXT出入力」に修正しました。",
  },
  {
    date: "2026-09-12",
    type: "fix",
    title: "画像ファイル名",
    body: "各項目に合わせた推奨ファイル名を追加しました。",
  },
];

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

export default function HowToPage() {
  const [fiveOpen, setFiveOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logs, setLogs] = useState<UpdateLogEntry[]>(FALLBACK_LOGS);
  const [visibleLogCount, setVisibleLogCount] = useState(8);

  useEffect(() => {
    // Browser-only query-param read for the internal `?labels=1` review mode
    // (see docs/howto TEXT_MAP.md) — cannot run during static-export
    // prerendering, so this one-time mount effect is unavoidable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowLabels(new URLSearchParams(window.location.search).get("labels") === "1");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/howto/updates.json"), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("updates.json fetch failed");
        return r.json();
      })
      .then((d: { updates?: UpdateLogEntry[] } | UpdateLogEntry[]) => {
        if (cancelled) return;
        const rows = Array.isArray(d) ? d : (d.updates ?? []);
        if (rows.length > 0) setLogs(rows);
      })
      .catch(() => {
        /* keep FALLBACK_LOGS */
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
            <div className="hero-pills">
              <Link className="pill dark" href="/" data-copy-id="TEXT_HERO_CHIP_01">
                本棚に戻る
              </Link>
              <Link className="pill gold" href="/editor?demo=1" data-copy-id="TEXT_HERO_CHIP_02">
                デモを見る
              </Link>
            </div>
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
                  <li><a href="#work-counter">作業カウント</a></li>
                  <li><a href="#varied-use">多様な使い方</a></li>
                </ol>
              </div>
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
          <div className="hero-right">
            <div className="hero-visual">
              <img src={asset(HOWTO_IMAGES.hero.file)} alt={HOWTO_IMAGES.hero.alt} />
            </div>
            <p className="hero-copy" data-copy-id="TEXT_HERO_BODY_01">
              色々出来るTateSpun<br />是非知ってもらいたい機能を<br />こちらのページにまとめました。
              <br />ブラウザだけで動作し、原稿はあなたのものです。
            </p>
            <div className="scroll-arrow" aria-hidden="true">↓</div>
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
          </div>
        </header>

        <section className="intro" id="five-features">
          <div className="intro-title">
            <span aria-hidden="true"></span>
            <b data-copy-id="TEXT_INTRO_TITLE">まずは知ってほしい<br />５つの機能</b>
          </div>
          <div className="intro-copy">
            <p data-copy-id="TEXT_INTRO_BODY_01"><a href="#my-check">1. 完成前マイチェックリスト＋PDF書き出し前チェック</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_02"><a href="#writing-check">2. 文章チェックβ</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_03"><a href="#body-notation">3. ルビ・縦中横・改ページの本文記法</a></p>
            <p data-copy-id="TEXT_INTRO_BODY_04"><a href="#work-counter">4. 作業カウント＋一時停止</a></p>
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

        <section className="chapter" id="my-check">
          <h2 data-copy-id="TEXT_SECTION_01_TITLE">1. 完成前マイチェックリスト＋PDF書き出し前チェック</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_01_SUBTITLE">場所：▶オプション→完成前チェックリスト</div>
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

        <section className="chapter" id="writing-check">
          <h2 data-copy-id="TEXT_SECTION_02_TITLE">2. 文章チェックβ</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_02_SUBTITLE">場所：テキスト入力エディターの下部</div>
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

        <section className="chapter" id="body-notation">
          <h2 data-copy-id="TEXT_SECTION_03_TITLE">3. ルビ・縦中横・改ページの本文記法</h2>
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

        <section className="chapter" id="work-counter">
          <h2 data-copy-id="TEXT_SECTION_04_TITLE">4. 作業カウント</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_04_SUBTITLE">場所：テキストエディター下部</div>
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

        <section className="chapter" id="varied-use">
          <h2 data-copy-id="TEXT_SECTION_05_TITLE">5. 「ここで書かなくてもいい」原稿持ち込み運用</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_05_SUBTITLE">場所：▶オプション→TXT出入力</div>
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
                  <p><strong>TXTデータの読み込み・出力</strong><br />場所：▶オプション→TXT出入力</p>
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

        <section className="tips-index" id="tips">
          <h2 data-copy-id="TEXT_TIPS_TITLE">便利な小技 10選β版</h2>
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

        <section className="chapter" id="settings">
          <h2 data-copy-id="TEXT_SECTION_06_TITLE">1. 本の見た目を細かく調整「設定」</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_06_SUBTITLE">場所：テキストエディター直上→▶設定</div>
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
        </section>

        <section className="chapter" id="preview">
          <h2 data-copy-id="TEXT_SECTION_07_TITLE">2. 色々見られるプレビュー機能</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_07_SUBTITLE">場所：テキストタイトル入力欄の下</div>
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
        </section>

        <section className="chapter" id="four-buttons">
          <h2 data-copy-id="TEXT_SECTION_08_TITLE">3. タイトル下の便利な４ボタン</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_08_SUBTITLE">場所：テキストエディター直上</div>
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
        </section>

        <section className="chapter" id="memo">
          <h2 data-copy-id="TEXT_SECTION_09_TITLE">4. 本文には入れない作業を残す「メモ機能」</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_09_SUBTITLE">場所：テキストタイトル入力欄の下→▶メモ</div>
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
        </section>

        <section className="chapter" id="focus-mode">
          <h2 data-copy-id="TEXT_SECTION_10_TITLE">5. “書くときだけ”余計なUIを消す「集中モード」</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_10_SUBTITLE">場所：ヘッダー「集中モード」</div>
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
        </section>

        <section className="chapter" id="folio-header">
          <h2 data-copy-id="TEXT_SECTION_11_TITLE">6. 本に合わせて変えられるノンブル・柱</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_11_SUBTITLE">場所：▶設定→ページ・ノンブル・柱</div>
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
        </section>

        <section className="chapter" id="image-insert">
          <h2 data-copy-id="TEXT_SECTION_12_TITLE">7. 挿絵を挿入できる「画像挿入機能」</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_12_SUBTITLE">場所：プレビュー画面→ページ上［…］内</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.imageInsert.file)} alt={HOWTO_IMAGES.imageInsert.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_12_BODY_01">
                挿絵・扉絵などを本文中へ入れたいときは、この機能をどうぞ！ PSDデータも配置可能です（高画質PNGへ変換されます）。
                <p>文章だけの本ではなく、画像を含む構成もページ単位で確認できます。ちょっとした図解を載せたいときにも便利です。</p>
                <p><small>※天地中央以外の細かな場所への配置はできません。<br />※文章の上にかぶさる形で配置されます。テキストエディターには <code>【IMG:…:center】</code> 等と入力されるため、前後に改ページマークダウンを入れることをおすすめします。</small></p>
                <p><small>※クラウドに保存したファイルに画像が含まれている場合、画像を72時間保持できます。画像の期限切れが近い／超過した場合は、トップページの本棚の帯部分に三角の「！」マークが表示されます。クラウドで持ち出す際はご注意ください。画像についての詳細はトップページの「画像について」をご確認ください。</small></p>
              </div>
            </div>
          </div>
        </section>

        <section className="chapter" id="colophon">
          <h2 data-copy-id="TEXT_SECTION_13_TITLE">8. 横書きの奥付が配置できる「奥付機能」</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_13_SUBTITLE">場所：▶オプション→奥付（縦）、奥付（横）</div>
          <div className="chapter-grid">
            <div className="image-frame">
              <img src={asset(HOWTO_IMAGES.colophon.file)} alt={HOWTO_IMAGES.colophon.alt} loading="lazy" />
            </div>
            <div className="chapter-copy">
              <div className="copy-body" data-copy-id="TEXT_SECTION_13_BODY_01">
                縦と横で、別機能の奥付を付けられます。
                <p><strong>奥付（縦）</strong><br />項目を入力すると、本文の末尾にテキストとして入力されます。テキストエディター内でさらに細かく調整できます。</p>
                <p><strong>奥付（横）</strong><br />TateSpun内で唯一、横書き表記ができる機能です。横書き専用ページをプレビュー内に1枚追加します。テキストエディターではなく、再度「オプション→奥付（横）」を開くと編集できます。任意の位置にページを配置できます。</p>
                <p>複数種類のテンプレートと配置位置を指定でき、項目も細かくカスタマイズ可能です。1冊につき1ページのみの機能なので、奥付以外にも活用方法がある……かも!?</p>
              </div>
            </div>
          </div>
        </section>

        <section className="chapter" id="dark-mode">
          <h2 data-copy-id="TEXT_SECTION_14_TITLE">9. 目の疲れにはダークモードを使おう</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_14_SUBTITLE">場所：ヘッダー「画面モード」</div>
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
        </section>

        <section className="chapter" id="export">
          <h2 data-copy-id="TEXT_SECTION_15_TITLE">10. 多機能書き出し・書き出し中断</h2>
          <div className="subhead" data-copy-id="TEXT_SECTION_15_SUBTITLE">場所：プレビュー画面左側「書き出し▼」</div>
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
                <p data-copy-id="TEXT_SECTION_15_BODY_02">{PDF_FILENAME_EXPLANATION}</p>
                <p>デスクトップ版では、出力中にEscを押すと出力を中断できます。「書き出し途中にミスに気付いたけれど、出力が長い……」というときにご活用ください。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <h2 data-copy-id="TEXT_FAQ_TITLE">FAQ</h2>
          <div className="faq-item">
            <div className="faq-q">不具合があったら？</div>
            <div className="faq-text" data-copy-id="TEXT_FAQ_LEAD">
              <p>エディター内のβ版フィードバック（「報告」ボタン）から送信できます。</p>
              <p>いただいたご報告は真摯に受け止めますが、即時の実装・修正や、すべての内容への対応をお約束するものではありません。</p>
              <p>報告時には、不具合の原因調査のため、ユーザーの利用環境に関する情報を自動で取得します。機種・ブラウザ等に依存するエラーかどうかを調べるために活用しますので、あらかじめご了承ください。</p>
              <p>お名前・住所などの個人情報は書き込まないようお願いいたします。自動で取得するのはブラウザ・端末・表示環境等の情報であり、お名前や住所・所在地を取得するものではありません。作品本文・作品タイトル・ドキュメントIDも自動送信しない設定になっていますので、ご安心ください。</p>
            </div>
          </div>
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

        <section className="devlog" id="devlog">
          <div className="devlog-heading">
            <div>
              <span>UPDATE / DEBUG LOG</span>
              <h2 data-copy-id="TEXT_DEVLOG_TITLE">更新・デバッグログ</h2>
            </div>
            <p>別ページを増やさず、このページの最下部へ追記していきます。</p>
          </div>
          <div className="log-list">
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

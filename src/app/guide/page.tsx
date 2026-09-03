"use client";

import Link from "next/link";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";

/**
 * TSP-LOOP-024 —「もっと詳しく TateSpun の機能を見る」feature guide.
 *
 * Distinct from the おためしデモ: the demo answers「どう使うの？」, this page
 * answers「何ができるの？」. Standalone route — reachable from STEP 10 and
 * directly. No tutorial state, no editor.
 */

interface Card {
  n: string;
  title: string;
  body: string;
}

const CARDS: Card[] = [
  {
    n: "01",
    title: "書きながら縦書きプレビュー",
    body:
      "文章を書いたその場で、実際の本に近いページを確認。組版してから『読みにくかった』と気づくのを減らせます。",
  },
  {
    n: "02",
    title: "JPG・PDF・Web版へ書き出し",
    body:
      "SNS用画像、確認用PDF、Web閲覧用など、用途に合わせてそのまま出力できます。",
  },
  {
    n: "03",
    title: "小説向けの本格的な縦書き組版",
    body:
      "ルビ・縦中横・約物・――・……などに対応。『文字を縦に並べただけ』ではない、小説らしいページを作れます。",
  },
  {
    n: "04",
    title: "【改ページ】でページを自由に区切る",
    body:
      "章の開始、場面転換、あとがきなど、『ここから新しいページにしたい』を作者自身で指定できます。",
  },
  {
    n: "05",
    title: "本文に画像を配置",
    body:
      "挿絵、章扉、ロゴ、装飾などを文章と一緒に配置できます。クラウド上の画像はβ版では一時保存ですが、手元の元画像まで消える仕組みではありません。",
  },
  {
    n: "06",
    title: "目次も作れる",
    body: "本文だけでなく、目次までTateSpun内で作成できます。",
  },
  {
    n: "07",
    title: "縦書き・横書きの奥付",
    body:
      "作品に合わせて奥付を作成。本文は縦書き、奥付は横書きという本にも対応できます。",
  },
  {
    n: "08",
    title: "本の見た目を細かく調整",
    body:
      "本文フォント・文字サイズ・余白・段組・ノンブルなどを変更できます。",
  },
  {
    n: "09",
    title: "文章チェックβ",
    body:
      "括弧の閉じ忘れなど、気になる箇所をブラウザ内でチェック。原稿を勝手に外部AIへ送信しません。",
  },
  {
    n: "10",
    title: "置換機能",
    body: "名前や表記、記号などをまとめて置換。長い原稿ほど便利になります。",
  },
];

export default function FeatureGuidePage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">TateSpun でできること</h1>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-ink/25 px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-ink/5"
        >
          本棚へ戻る
        </Link>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-ink/70">
        操作の流れは「おためしデモ」で試せます。ここでは、TateSpun で何ができるかをまとめています。
      </p>

      <div className="grid gap-3 sm:grid-cols-2" data-feature-cards="">
        {CARDS.map((card) => (
          <section
            key={card.n}
            data-feature-card={card.n}
            className="rounded-2xl border border-ink/12 bg-base/70 p-4"
          >
            <p className="text-[11px] font-semibold tracking-widest text-accent">
              CARD {card.n}
            </p>
            <h2 className="mt-1 text-sm font-bold text-ink">{card.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">
              {card.body}
            </p>
          </section>
        ))}
      </div>

      {BETA_FEEDBACK_ENABLED && (
        <section
          data-feature-card="beta"
          className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4"
        >
          <h2 className="text-sm font-bold text-amber-900">
            β版を一緒に育ててもらえたらうれしいです
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-900/80">
            「気になる事」や review を、編集画面の「報告」ボタンから TateSpun 内で送れます。
          </p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/editor?demo=1"
          className="rounded-full border border-ink/25 px-4 py-2 text-xs font-medium text-ink/75 hover:bg-ink/5"
        >
          おためしデモをもう一度
        </Link>
        <Link
          href="/"
          className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-base hover:opacity-90"
        >
          本棚へ戻る
        </Link>
      </div>
    </main>
  );
}

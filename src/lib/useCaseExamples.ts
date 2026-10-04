// TSP-COPY-001: what TateSpun can be used for besides a printed novel, and
// what it cannot do yet. Shown on the first-visit Home and as a HOW TO
// chapter, so both pages always say the same thing.

export type UseCaseExample = {
  title: string;
  body: string;
  /** Not available yet: shown with a 「準備中」 mark. */
  preparing?: boolean;
  /** HOW TO chapter that explains how to do it. */
  howtoHash?: string;
  /** A folded note (opened with ▼) under the body. */
  detail?: { summary: string; body: string };
  /** A sibling SpunTales tool that fits better (site-absolute path). */
  elsewhere?: { label: string; href: string };
};

// COLUMNSTAND lives outside TateSpun's basePath, so it is a site-absolute link.
const COLUMNSTAND_LINK = { label: "横書きや写真入りの誌面なら COLUMNSTAND", href: "/columnstand/" };

export const USE_CASE_DETAIL_LABEL = "くわしく";

// Shown near the top of the first-visit Home, pointing down to the examples.
export const USE_CASES_TEASER = "Web小説・短歌・会報などにも。使い方の例を見る";

export const USE_CASE_PREPARING_LABEL = "準備中";

export const USE_CASES_HEADING = "小説の本のほかにも";
export const USE_CASES_LEAD = "縦書きで読む文章なら、こんな使い方もできます。";

export const USE_CASE_EXAMPLES: UseCaseExample[] = [
  {
    title: "Web小説を縦書きで読み返す",
    body: "投稿サイトの原稿を貼り付けるか、TXTやWordのファイルを読み込んで、縦書きの見え方を確かめられます。用紙は「Web閲覧用」も選べます。",
    howtoHash: "#varied-use",
  },
  {
    title: "短歌・詩・エッセイの小冊子",
    body: "改ページで一首・一篇ずつページを分けて、文庫やA6などの小さな本の形で確かめられます。",
    howtoHash: "#short-poems",
  },
  {
    title: "会報・サークルの冊子",
    body: "A5やB5の用紙で組んで、印刷所に出せるPDF（トンボ・塗り足し付き）で書き出せます。",
    howtoHash: "#export",
  },
  {
    title: "挿絵や扉絵の入った本",
    body: "ページの中央に画像を置いて、文章と絵の並びをページ単位で確かめられます。",
    howtoHash: "#image-insert",
  },
  {
    title: "宣伝用のサンプル画像",
    body: "好きなページをJPGで書き出して、SNSでの告知や書店委託のサンプルに使えます。",
    howtoHash: "#export",
  },
  {
    title: "合同誌・アンソロジー",
    body: "参加者の原稿を「本をまとめる」で一冊に並べる機能は、いま準備中です。",
    detail: {
      summary: "今のおすすめの進め方",
      body: "現在は、参加者のみなさんにTateSpunで原稿を入力・確認してもらい、「▶本づくり→原稿ファイル」の「TXTを書き出す」で書き出したファイルを主催の方へ送ってもらう方法がおすすめです。主催の方は、届いた原稿をひとつの作品に順に貼り付け、あいだに改ページを入れて全体を調整します。",
    },
    preparing: true,
    howtoHash: "#settings",
  },
];

// SPN-XFIX-001: 「短歌・詩・エッセイの小冊子」の「くわしく」の行き先（HOW TO）。
export const SHORT_POEM_STEPS_HEADING = "短歌・詩の小冊子をつくる手順";
export const SHORT_POEM_STEPS: { title: string; body: string }[] = [
  {
    title: "一首・一篇ごとにページを分ける",
    body: "一首（一篇）を書き終えたら、タイトル下の「改ページ」を押してから次を書きます。1ページに一首ずつ並びます。",
  },
  {
    title: "小さな本の用紙と、大きめの文字にする",
    body: "▶設定の用紙サイズを「文庫」や「A6」にし、フォントサイズを14〜16ptくらいにして「設定を反映」を押します。",
  },
  {
    title: "ページの真ん中に置く",
    body: "▶設定の「本文を用紙の中央に置く」を押すと、いちばん長い一首に合わせて、縦方向・横方向の中央に置けます。",
  },
  {
    title: "本の形で確かめて、書き出す",
    body: "プレビューの「見開き」や「3D」で本の形を確かめ、印刷にはPDF、1ページずつの画像にはJPGで書き出します。",
  },
  {
    title: "Xに貼る画像にする",
    body: "用紙を「SNS用 正方形」か「SNS用 4:5」にして中央に置き、JPGで書き出すと、そのまま投稿に使えます。",
  },
];

export const USE_CASES_NOT_YET_HEADING = "今はできないこと";

export const USE_CASES_NOT_YET: UseCaseExample[] = [
  {
    title: "Kindleなど電子書籍用のファイル",
    body: "書き出せるのはPDFとJPGです。EPUBなどの電子書籍の形式には対応していません。",
  },
  {
    title: "本文の横書き",
    body: "本文は縦書きだけです。横書きにできるのは奥付のみです。",
    elsewhere: COLUMNSTAND_LINK,
  },
  {
    title: "写真やイラストを自由に並べるレイアウト",
    body: "画像はページの中央に置く形で、細かな位置は決められません。",
    elsewhere: COLUMNSTAND_LINK,
  },
  {
    title: "何人かで同じ原稿を同時に書くこと",
    body: "原稿は、ひとつのブラウザでひとりが書く形です。",
  },
];

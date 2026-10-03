// TSP-COPY-001: what TateSpun can be used for besides a printed novel, and
// what it cannot do yet. Shown on the first-visit Home and as a HOW TO
// chapter, so both pages always say the same thing.

export type UseCaseExample = {
  title: string;
  body: string;
  /** Not available yet: shown with a 「準備中」 mark. */
  preparing?: boolean;
};

export const USE_CASE_PREPARING_LABEL = "準備中";

export const USE_CASES_HEADING = "小説の本のほかにも";
export const USE_CASES_LEAD = "縦書きで読む文章なら、こんな使い方もできます。";

export const USE_CASE_EXAMPLES: UseCaseExample[] = [
  {
    title: "Web小説を縦書きで読み返す",
    body: "投稿サイトの原稿を貼り付けるか、TXTやWordのファイルを読み込んで、縦書きの見え方を確かめられます。用紙は「Web閲覧用」も選べます。",
  },
  {
    title: "短歌・詩・エッセイの小冊子",
    body: "改ページで一首・一篇ずつページを分けて、文庫やA6などの小さな本の形で確かめられます。",
  },
  {
    title: "会報・サークルの冊子",
    body: "A5やB5の用紙で組んで、印刷所に出せるPDF（トンボ・塗り足し付き）で書き出せます。",
  },
  {
    title: "挿絵や扉絵の入った本",
    body: "ページの中央に画像を置いて、文章と絵の並びをページ単位で確かめられます。",
  },
  {
    title: "宣伝用のサンプル画像",
    body: "好きなページをJPGで書き出して、SNSでの告知や書店委託のサンプルに使えます。",
  },
  {
    title: "合同誌・アンソロジー",
    body: "参加者の原稿を「本をまとめる」で一冊に並べる機能は、いま準備中です。",
    preparing: true,
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
  },
  {
    title: "写真やイラストを自由に並べるレイアウト",
    body: "画像はページの中央に置く形で、細かな位置は決められません。",
  },
  {
    title: "何人かで同じ原稿を同時に書くこと",
    body: "原稿は、ひとつのブラウザでひとりが書く形です。",
  },
];

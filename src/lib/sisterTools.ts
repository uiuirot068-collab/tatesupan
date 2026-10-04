// TSP-HOWTO-001: other SpunTales tools that TateSpun sends people on to,
// shown under 「小説の本のほかにも」 on the Home and on HOW TO so both pages
// say the same thing. They live outside TateSpun's basePath, so the links
// are site-absolute (with the trailing slash those sites need).

export type SisterTool = {
  heading: string;
  body: string;
  label: string;
  href: string;
};

export const SISTER_TOOLS: SisterTool[] = [
  {
    heading: "ZINEやコラムなら、COLUMNSTANDも。",
    body: "TateSpunは、縦書きの文章を本の形に整えるのが得意なエディターです。同じSpunTalesのCOLUMNSTANDは、縦書き・横書きの段組テンプレートで、文章と写真・イラストを並べた誌面づくりが得意です。ZINEやコラム、会報をつくるときは、COLUMNSTANDもあわせて使ってみてください。",
    label: "COLUMNSTANDを見る",
    href: "/columnstand/",
  },
  {
    heading: "プロットや予定づくりは、ことばテラスで。",
    body: "ことばテラスには、文章を書く人のための道具を集めています。プロット帳のShioriaで物語の流れを練ったり、Kokoyomiで制作の予定を立てたり。書きはじめる前の準備に、ぜひ使ってみてください。",
    label: "ことばテラスを見る",
    href: "/kotoba-terrace/",
  },
];

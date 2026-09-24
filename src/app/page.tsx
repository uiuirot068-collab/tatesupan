import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "TateSpun（タテスパン）｜同人小説の縦書き・PDF組版Webエディタ",
  description:
    "同人小説の原稿を縦書きで確認・調整し、PDFやJPGへ書き出せるWebエディタ。ノンブル・柱・奥付・挿絵・入稿前確認まで、ブラウザで本づくりを支えます。",
  alternates: {
    canonical: "https://spuntales.net/tatespun/",
  },
};

export default function Home() {
  return <HomeClient />;
}

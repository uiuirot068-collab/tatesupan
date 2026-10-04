import type { Metadata } from "next";
import { pageMetadata } from "@/app/seo";

export const metadata: Metadata = pageMetadata({
  title: "エディタ｜TateSpun（タテスパン）｜SpunTales",
  description:
    "原稿を書きながら、縦書きの本の形をその場で確かめるTateSpunのエディタ。ノンブル・柱・奥付・挿絵を整えて、PDFやJPGへ書き出せます。",
  path: "/tatespun/editor",
});

export default function EditorLayout({ children }: LayoutProps<"/editor">) {
  return children;
}

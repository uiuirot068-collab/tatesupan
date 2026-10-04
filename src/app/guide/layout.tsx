import type { Metadata } from "next";
import { pageMetadata } from "@/app/seo";

export const metadata: Metadata = pageMetadata({
  title: "TateSpun でできること｜縦書きエディタの機能一覧｜SpunTales",
  description:
    "TateSpunでできることのまとめ。書きながら縦書きプレビュー、JPG・PDF・Web版への書き出し、挿絵の配置、目次、奥付、本の見た目の調整、見直しツール、検索・置換、完成前マイチェックリストまで。",
  path: "/tatespun/guide",
});

export default function GuideLayout({ children }: LayoutProps<"/guide">) {
  return children;
}

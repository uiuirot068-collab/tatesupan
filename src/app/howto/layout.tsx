import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "TateSpunの使い方｜縦書き原稿・PDF書き出し・入稿準備ガイド",
  description:
    "TateSpunの使い方を画像つきで解説。原稿の読み込み、縦書きプレビュー、ノンブル・柱・奥付・挿絵、PDF・JPG書き出し、入稿前の確認まで順番に案内します。",
  alternates: {
    canonical: "https://spuntales.net/tatespun/howto",
  },
};

export default function HowToLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { pageMetadata } from "@/app/seo";
import type { ReactNode } from "react";

// TSP-HOWTO-001: the previous HOW TO design, kept for reference after the
// redesign replaced /howto. Canonical points at /howto; never in search.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "TateSpunの使い方｜縦書き原稿・PDF書き出し・入稿準備ガイド",
    description:
      "TateSpunの使い方を画像つきで解説。原稿の読み込み、縦書きプレビュー、ノンブル・柱・奥付・挿絵、PDF・JPG書き出し、入稿前の確認まで順番に案内します。",
    path: "/tatespun/howto",
  }),
  robots: { index: false, follow: true },
};

export default function HowToV1Layout({ children }: { children: ReactNode }) {
  return children;
}

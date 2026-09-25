import type { Metadata } from "next";
import { Suspense } from "react";
import HomeV2Client from "./HomeV2Client";
import "./home-v2.css";

export const metadata: Metadata = {
  title: "TateSpun Home V2 | Preview",
  description: "TateSpunトップページV2の独立プレビュー。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomeV2Page() {
  return (
    <Suspense fallback={null}>
      <HomeV2Client />
    </Suspense>
  );
}


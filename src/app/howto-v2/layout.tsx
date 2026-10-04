import type { Metadata } from "next";
import type { ReactNode } from "react";

// TSP-HOWTO-001: the redesign was reviewed here before it replaced /howto.
// Kept only to forward old links; never in search.
export const metadata: Metadata = {
  title: "TateSpunの使い方",
  robots: { index: false, follow: true },
};

export default function HowToV2Layout({ children }: { children: ReactNode }) {
  return children;
}

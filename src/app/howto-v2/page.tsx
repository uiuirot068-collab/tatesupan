"use client";

import { useEffect } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";

/** TSP-HOWTO-001: `/howto-v2` became `/howto`; forward, keeping the #chapter. */
export default function HowToV2Redirect() {
  useEffect(() => {
    window.location.replace(withBasePath(`/howto${window.location.hash}`));
  }, []);

  return (
    <main style={{ padding: "4rem 1rem", textAlign: "center" }}>
      <Link href="/howto">HOW TO TateSpun へ移動します</Link>
    </main>
  );
}

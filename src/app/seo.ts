import type { Metadata } from "next";

// Search and share-card info for each TateSpun page (SPN-SEO-001).
// Served at spuntales.net/tatespun/..., so URLs here are absolute.
export const SITE_ORIGIN = "https://spuntales.net";
const SHARE_IMAGE = { url: `${SITE_ORIGIN}/image/card.png`, width: 800, height: 418 };

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = `${SITE_ORIGIN}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "SpunTales",
      locale: "ja_JP",
      title,
      description,
      url,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}

import type { Metadata } from "next";

// Only reached from a reset email, so keep it out of search results (SPN-SEO-001).
export const metadata: Metadata = {
  title: "パスワードの再設定｜TateSpun",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: LayoutProps<"/auth/reset-password">) {
  return children;
}

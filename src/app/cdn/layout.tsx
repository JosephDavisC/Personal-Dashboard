import type { Metadata } from "next";

export const metadata: Metadata = {
  // Override root layout manifest so CDN pages don't try to fetch /manifest.json
  manifest: null,
  appleWebApp: undefined,
};

export default function CdnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

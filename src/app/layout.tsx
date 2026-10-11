import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import { SITE } from "@/config/site";
import { APP_URL } from "@/lib/app-url";
import { isReadOnlyDemo } from "@/lib/demo";

const manrope = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#09090b",
};

const DESCRIPTION =
  "One screen for your daily life: calendar, tasks, shifts and earnings, job applications and a diary. Open source and self-hosted.";

// Built per request so the link-preview image URL uses this instance's real
// public address (APP_URL or NEXTAUTH_URL) instead of whatever existed at build time.
export async function generateMetadata(): Promise<Metadata> {
  const title = isReadOnlyDemo() ? `${SITE.appName} · Live demo` : SITE.appName;
  const image = { url: "/og-image.jpg", width: 1200, height: 630, alt: `${SITE.appName} home screen` };
  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: title,
      template: "%s | Dashboard",
    },
    description: DESCRIPTION,
    // Link previews in WhatsApp, iMessage, Slack, LinkedIn, X and others
    openGraph: { type: "website", siteName: SITE.appName, title, description: DESCRIPTION, url: "/", images: [image] },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [image.url] },
    robots: { index: false, follow: false },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Dashboard",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

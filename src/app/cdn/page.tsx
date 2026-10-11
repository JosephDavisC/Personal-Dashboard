import type { Metadata } from "next";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: `Shared files | ${SITE.appName}`,
  description: `Media sharing by ${SITE.appName}`,
  robots: { index: false, follow: false },
};

export default function CdnHomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-8">
      {/* Gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 backdrop-blur-sm">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-12 w-12 rounded-lg"
          />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {SITE.appName}
        </h1>
        <p className="mt-3 text-sm text-white/40 sm:text-base">
          Shared files
        </p>

      </div>
    </div>
  );
}

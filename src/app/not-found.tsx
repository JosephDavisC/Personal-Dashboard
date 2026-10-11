import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#141B2D] px-4 text-center">
      <h1 className="font-heading text-8xl font-extrabold leading-none text-slate-100 md:text-9xl">
        404
      </h1>
      <p className="mt-4 max-w-md text-lg text-slate-400">
        This page does not exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:gap-3"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Dashboard
      </Link>
    </div>
  );
}

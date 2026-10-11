import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import { SITE } from "@/config/site";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = params.error;
  const accessDenied = error === "AccessDenied";
  const oauthError = error === "OAuthCallback" || error === "Callback" || error === "OAuthAccountNotLinked";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(222,40%,8%)] p-4">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + branding */}
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            width={56}
            height={56}
            className="mx-auto mb-4 rounded-xl shadow-lg shadow-blue-500/20"
          />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white">
            {SITE.appName}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Sign in to continue
          </p>
        </div>

        {/* Access denied banner */}
        {accessDenied && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <ShieldX className="h-5 w-5 shrink-0 text-red-400" />
            <span>Access denied. This account is not authorized.</span>
          </div>
        )}

        {/* OAuth error banner (Google blocked the sign-in) */}
        {oauthError && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <ShieldX className="h-5 w-5 shrink-0 text-red-400" />
            <span>Sign-in failed. This account is not authorized to access this app.</span>
          </div>
        )}

        {/* Glass card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button
              type="submit"
              size="lg"
              className="w-full gap-3 rounded-xl bg-white py-6 text-base font-semibold text-gray-900 transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/10"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            Access restricted to authorized accounts
          </p>
        </div>

      </div>
    </div>
  );
}

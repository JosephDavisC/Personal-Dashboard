import { authMiddleware, isDemoMode } from "@/lib/auth";

export default authMiddleware((req) => {
  // Demo mode: no sign-in, see isDemoMode() in lib/auth.ts
  if (isDemoMode()) {
    return;
  }

  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";
  const isPrivacyPage = pathname === "/privacy";
  const isHealthCheck = pathname === "/api/health";
  const isPublicAsset = pathname === "/manifest.json" || pathname === "/sw.js";
  const isCronEndpoint = pathname === "/api/sites/cron" || pathname === "/api/backup/cron" || pathname === "/api/backup/sheets-sync" || pathname === "/api/email/weekly-summary" || pathname === "/api/push/cron";
  const isMediaShare = pathname.startsWith("/cdn") || pathname.startsWith("/api/media/share");

  if (isAuthRoute || isLoginPage || isPrivacyPage || isHealthCheck || isPublicAsset || isCronEndpoint || isMediaShare) {
    if (isLoginPage && isLoggedIn) {
      return Response.redirect(new URL("/dashboard", req.nextUrl));
    }
    return;
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

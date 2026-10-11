import NextAuth, { type Session } from "next-auth";
import Google from "next-auth/providers/google";
import { headers } from "next/headers";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Persistence is best-effort: the jwt callback also runs inside middleware
// (edge sandbox) where Prisma is unavailable, so DB failures must never
// break auth — the JWT's own copy of the token still works.
async function saveRefreshToken(refreshToken: string) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.googleCredential.upsert({
      where: { id: "default" },
      update: { refreshToken },
      create: { id: "default", refreshToken },
    });
  } catch (e) {
    console.error("Failed to persist Google refresh token:", e);
  }
}

async function getStoredRefreshToken(): Promise<string | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const cred = await prisma.googleCredential.findUnique({ where: { id: "default" } });
    return cred?.refreshToken ?? null;
  } catch {
    return null;
  }
}

async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error ?? "Failed to refresh token");
  }

  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    refreshToken: data.refresh_token,
  };
}

const { handlers, auth: nextAuth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          // No "prompt" param: returning sign-ins skip the consent screen
          // entirely. Google only sends a refresh_token on the first grant
          // (or after prompt=consent), so the jwt callback falls back to
          // the stored token. The reconnect toast forces prompt=consent
          // when a fresh refresh token is genuinely needed.
          access_type: "offline",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 180 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = allowedEmails.includes(user.email.toLowerCase());

      // Log the attempt
      try {
        const { prisma } = await import("@/lib/prisma");
        const hdrs = await headers();
        await prisma.loginLog.create({
          data: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            success: allowed,
            ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null,
            userAgent: hdrs.get("user-agent") ?? null,
          },
        });
      } catch (e) {
        console.error("Failed to log login attempt:", e);
      }

      return allowed;
    },
    async jwt({ token, account }) {
      // Initial sign-in: store all tokens
      if (account) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
        token.error = undefined;
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
          await saveRefreshToken(account.refresh_token);
        } else {
          // Silent re-login: Google omits refresh_token after the first
          // grant, so reuse this JWT's copy or the shared stored one
          token.refreshToken =
            token.refreshToken ?? (await getStoredRefreshToken()) ?? undefined;
        }
        return token;
      }

      // Token still valid (with 60s buffer)
      if (
        typeof token.expiresAt === "number" &&
        Date.now() < (token.expiresAt as number) * 1000 - 60_000
      ) {
        return token;
      }

      // Token expired — refresh with this JWT's token, then the shared
      // stored token (another device may have rotated it)
      const candidates: string[] = [];
      if (token.refreshToken) candidates.push(token.refreshToken as string);
      const stored = await getStoredRefreshToken();
      if (stored && !candidates.includes(stored)) candidates.push(stored);

      if (candidates.length === 0) {
        token.accessToken = undefined;
        token.error = "NoRefreshToken";
        return token;
      }

      for (const refreshToken of candidates) {
        try {
          const refreshed = await refreshGoogleToken(refreshToken);
          token.accessToken = refreshed.accessToken;
          token.expiresAt = refreshed.expiresAt;
          token.refreshToken = refreshed.refreshToken ?? refreshToken;
          token.error = undefined;
          // Google may rotate the refresh token — share the new one
          if (refreshed.refreshToken) {
            await saveRefreshToken(refreshed.refreshToken);
          }
          return token;
        } catch (error) {
          console.error("Failed to refresh Google access token:", error);
        }
      }

      token.accessToken = undefined;
      token.error = "RefreshTokenError";
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

import { NextResponse } from "next/server";

/** Defense-in-depth auth guard for API routes. Returns session or 401 response. */
export { handlers, signIn, signOut };

/**
 * Demo mode skips Google sign-in entirely and treats every request as the owner.
 * Only for trying the app locally: never enable it on an instance reachable
 * from the internet. DEV_BYPASS_AUTH is the older development-only switch.
 */
export function isDemoMode(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true")
  );
}

const DEMO_SESSION = {
  user: { name: "Alex Demo", email: "demo@localhost" },
  expires: "2999-01-01T00:00:00.000Z",
} as Session;

/** Current session, or the demo session when demo mode is on. */
export async function auth(): Promise<Session | null> {
  if (isDemoMode()) return DEMO_SESSION;
  return nextAuth();
}

/** NextAuth's middleware wrapper, used by src/middleware.ts. */
export const authMiddleware = nextAuth;

export async function requireAuth() {
  const session = await auth();
  if (!session) {
    return { session: null as never, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, unauthorized: null };
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

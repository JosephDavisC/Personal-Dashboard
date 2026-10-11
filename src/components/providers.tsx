"use client";

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useState } from "react";
import { toast } from "sonner";
import { useSyncPolling } from "@/hooks/useSyncPolling";
import { signIn } from "next-auth/react";

function SyncPolling() {
  useSyncPolling();
  return null;
}

let lastAuthToast = 0;

function handleAuthError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const isTokenError = msg.includes("re-login") || msg.includes("token expired") || msg.includes("Unauthorized");
  if (!isTokenError) return;
  // Debounce: only show once per 10s
  const now = Date.now();
  if (now - lastAuthToast < 10_000) return;
  lastAuthToast = now;
  toast.error("Google session expired", {
    description: "Please sign in again to reconnect.",
    // Force consent so Google issues a fresh refresh token (normal
    // sign-ins skip the consent screen and don't mint one)
    action: { label: "Sign in", onClick: () => signIn("google", {}, { prompt: "consent" }) },
    duration: 15_000,
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: true,
          },
        },
        queryCache: new QueryCache({
          onError: (error) => handleAuthError(error),
        }),
        mutationCache: new MutationCache({
          onError: (error) => handleAuthError(error),
        }),
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SyncPolling />
        {children}
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

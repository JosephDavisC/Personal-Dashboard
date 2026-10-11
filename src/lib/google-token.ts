import { auth, isDemoMode } from "@/lib/auth";

// Deliberately avoids the words "re-login" and "Unauthorized", so the app's
// "Google session expired, sign in again" toast never fires for it.
export const GOOGLE_NOT_CONNECTED =
  "Google is not connected in this demo. Add Google OAuth credentials to use it.";

/** True in demo mode when no Google account is signed in (the usual demo case). */
export async function isDemoWithoutGoogle(): Promise<boolean> {
  if (!isDemoMode()) return false;
  const session = await auth();
  return !session?.accessToken;
}

/** The signed-in user's Google access token, or a clear error explaining why there is none. */
export async function getGoogleAccessToken(): Promise<string> {
  const session = await auth();
  if (isDemoMode() && !session?.accessToken) {
    throw new Error(GOOGLE_NOT_CONNECTED);
  }
  if (session?.error) {
    throw new Error("Google token expired. Please re-login.");
  }
  if (!session?.accessToken) {
    throw new Error("No access token available. Please re-login.");
  }
  return session.accessToken;
}

import { redirect } from "next/navigation";

import { isAuthDevBypassEnabled } from "@/server/config/env";

/**
 * POST-only sign-in handler. Credentials are read from FormData (request body)
 * and never placed in the URL, browser history, or logs.
 *
 * P0-2 fix: when AUTH_DEV_BYPASS is disabled the action must fail closed
 * and never redirect to the protected /portal (which the proxy would bounce
 * back to /entrar, creating a loop). Real Neon Auth verification (P1-04)
 * will replace the dev-only branch below; until then the handler redirects
 * to /entrar?error=auth_not_configured. No session cookie is forged here.
 */
export async function signInAction(formData: FormData): Promise<void> {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const bypassEnabled = isAuthDevBypassEnabled();

  // Dev bypass: allow empty submit without credentials for local walkthrough.
  if (bypassEnabled && !email && !password) {
    redirect("/portal");
  }

  // Fail closed when the dev bypass is off: provider verification (P1-04)
  // is not yet implemented, so do not advance to /portal. Do not reflect
  // email/password in the redirect URL and do not log credentials.
  if (!bypassEnabled) {
    redirect("/entrar?error=auth_not_configured");
  }

  // Bypass is enabled at this point; enforce basic presence for the
  // credentialed dev flow.
  if (!email || !password) {
    redirect("/entrar?error=credentials_required");
  }

  // Dev-only path: bypass is enabled and credentials were supplied.
  // P1-04 will replace this with gateway.signIn(email, password) and
  // session-cookie establishment without ever placing the password in the URL.
  redirect("/portal");
}

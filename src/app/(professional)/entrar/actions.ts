import { redirect } from "next/navigation";

import { getRuntimeMode } from "@/runtime/mode";
import { getNeonAuthServer } from "@/server/auth/neon-server";
import { isAuthDevBypassEnabled } from "@/server/config/env";

/**
 * POST-only sign-in handler. Credentials are read from FormData (request body)
 * and never placed in the URL, browser history, or logs.
 *
 * The explicit local bypass never creates a session cookie. Outside that
 * development-only mode, credential verification and session management stay
 * inside the official Neon Auth server adapter.
 */
export async function signInAction(formData: FormData): Promise<void> {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (getRuntimeMode() !== "server") {
    redirect("/portal");
  }

  if (isAuthDevBypassEnabled()) {
    redirect("/portal");
  }

  if (!email || !password) {
    redirect("/entrar?error=credentials_required");
  }

  const result = await getNeonAuthServer().signIn.email({ email, password });
  if (result.error) {
    redirect("/entrar?error=invalid_credentials");
  }

  redirect("/portal");
}

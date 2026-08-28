import { redirect } from "next/navigation";

/**
 * POST-only handler for password-reset requests. Keeps the e-mail out of the
 * URL and browser history; the response intentionally does not reveal whether
 * the account exists.
 */
export async function requestPasswordResetAction(
  formData: FormData,
): Promise<void> {
  "use server";

  // Read and trim, but never log or echo the address in a way that confirms existence.
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  void email;

  // Placeholder until P1-04 wires Neon Auth recovery. Always redirect to the
  // same confirmation, without leaking account existence via URL.
  redirect("/entrar?reset=sent");
}

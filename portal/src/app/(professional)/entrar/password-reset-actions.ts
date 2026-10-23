"use server";

import { headers } from "next/headers";

import { getRuntimeMode } from "@/runtime/mode";
import { getNeonAuthServer } from "@/server/auth/neon-server";
import {
  RESET_ERROR_MESSAGES,
  parseRecoveryEmail,
  parseResetToken,
  validateNewPassword,
  type PasswordResetState,
} from "@/server/auth/password-reset-policy";
import { HttpError } from "@/server/http/errors";
import { getPublicBaseUrl } from "@/server/http/base-url";
import { logger } from "@/server/observability/logger";
import { enforceRateLimit } from "@/server/security/rate-limit";

const RESET_PATH = "/entrar/redefinir";

// Identical for known and unknown e-mails so the form cannot be used to probe
// which professionals have an account.
const NEUTRAL_SENT: PasswordResetState = { status: "sent" };

/**
 * Requests a password-reset e-mail from Neon Auth. The redirect target is
 * built from the allow-listed public origin, never from submitted input. The
 * result never depends on whether the account exists.
 */
export async function requestPasswordResetAction(
  _previous: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  if (getRuntimeMode() !== "server") {
    // Demo has no auth backend: simulate the neutral confirmation only.
    return NEUTRAL_SENT;
  }

  const email = parseRecoveryEmail(formData.get("email"));
  if (!email) return { status: "error", message: RESET_ERROR_MESSAGES.email };

  try {
    await enforceRateLimit(
      "password-reset",
      email,
      new Headers(await headers()),
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 429)
      return { status: "error", message: RESET_ERROR_MESSAGES.rateLimited };
    return { status: "error", message: RESET_ERROR_MESSAGES.transport };
  }

  try {
    const redirectTo = `${await getPublicBaseUrl()}${RESET_PATH}`;
    const result = await getNeonAuthServer().requestPasswordReset({
      email,
      redirectTo,
    });
    if (result.error) {
      // Never log the e-mail address or any token.
      logger.warn(
        { status: result.error.status, code: result.error.code },
        "password reset request rejected by auth provider",
      );
      return { status: "error", message: RESET_ERROR_MESSAGES.transport };
    }
  } catch {
    logger.warn("password reset request failed before reaching auth provider");
    return { status: "error", message: RESET_ERROR_MESSAGES.transport };
  }

  return NEUTRAL_SENT;
}

/**
 * Completes a reset with the single-use token from the e-mail link. Neon Auth
 * (Better Auth) creates the credential account when the user has none, so
 * users provisioned without a password can set their first one here.
 */
export async function resetPasswordAction(
  _previous: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const demo = getRuntimeMode() !== "server";

  const token = parseResetToken(formData.get("token"));
  if (!demo && !token)
    return {
      status: "invalid_token",
      message: RESET_ERROR_MESSAGES.invalidToken,
    };

  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { status: "error", message: invalid };

  if (demo) return { status: "success" };

  try {
    await enforceRateLimit(
      "password-reset",
      `token:${token}`,
      new Headers(await headers()),
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 429)
      return { status: "error", message: RESET_ERROR_MESSAGES.rateLimited };
    return { status: "error", message: RESET_ERROR_MESSAGES.transport };
  }

  try {
    const result = await getNeonAuthServer().resetPassword({
      newPassword: password,
      token: token!,
    });
    if (result.error) {
      logger.warn(
        { status: result.error.status, code: result.error.code },
        "password reset rejected by auth provider",
      );
      switch (result.error.code) {
        case "INVALID_TOKEN":
          return {
            status: "invalid_token",
            message: RESET_ERROR_MESSAGES.invalidToken,
          };
        case "PASSWORD_TOO_SHORT":
          return { status: "error", message: RESET_ERROR_MESSAGES.tooShort };
        case "PASSWORD_TOO_LONG":
          return { status: "error", message: RESET_ERROR_MESSAGES.tooLong };
        default:
          return { status: "error", message: RESET_ERROR_MESSAGES.transport };
      }
    }
  } catch {
    logger.warn("password reset failed before reaching auth provider");
    return { status: "error", message: RESET_ERROR_MESSAGES.transport };
  }

  return { status: "success" };
}

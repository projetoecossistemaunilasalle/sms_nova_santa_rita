import { z } from "zod";

// Matches the account creation policy (see createAccountSchema). Neon Auth
// itself only enforces 8..128, so the portal's stricter minimum is applied
// before any request leaves the server.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
const TOKEN_MAX_LENGTH = 512;

export type PasswordResetState = {
  status: "idle" | "sent" | "success" | "error" | "invalid_token";
  message?: string;
};

export const RESET_ERROR_MESSAGES = {
  email: "Informe um e-mail válido.",
  rateLimited:
    "Muitas solicitações de recuperação. Aguarde 15 minutos e tente novamente.",
  transport:
    "Não foi possível concluir a solicitação agora. Tente novamente em instantes.",
  tooShort: `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  tooLong: `Use uma senha com no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  mismatch: "A confirmação não é igual à nova senha.",
  invalidToken:
    "Este link de redefinição é inválido ou expirou. Solicite um novo link.",
} as const;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export function parseRecoveryEmail(value: unknown): string | null {
  const parsed = emailSchema.safeParse(typeof value === "string" ? value : "");
  return parsed.success ? parsed.data : null;
}

export function parseResetToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length > 0 && token.length <= TOKEN_MAX_LENGTH ? token : null;
}

/** Returns a PT-BR message for the first problem, or null when acceptable. */
export function validateNewPassword(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return RESET_ERROR_MESSAGES.tooShort;
  if (password.length > PASSWORD_MAX_LENGTH)
    return RESET_ERROR_MESSAGES.tooLong;
  if (password !== confirmation) return RESET_ERROR_MESSAGES.mismatch;
  return null;
}

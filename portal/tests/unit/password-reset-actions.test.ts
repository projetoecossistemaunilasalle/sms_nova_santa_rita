import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  enforceRateLimit: vi.fn(),
  requestHeaders: new Headers(),
  env: {
    APP_RUNTIME_MODE: "server" as "server" | "demo",
    ALLOWED_ORIGINS: ["https://portal.example.test"],
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => mocks.requestHeaders,
}));
vi.mock("@/server/auth/neon-server", () => ({
  getNeonAuthServer: () => ({
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
  }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/server/config/env", () => ({
  getRuntimeEnv: () => mocks.env,
}));
vi.mock("@/server/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/app/(professional)/entrar/password-reset-actions";
import { HttpError } from "@/server/http/errors";
import {
  PASSWORD_MAX_LENGTH,
  RESET_ERROR_MESSAGES,
  type PasswordResetState,
} from "@/server/auth/password-reset-policy";

const idle: PasswordResetState = { status: "idle" };
const goodPassword = "a-long-enough-passphrase";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_RUNTIME_MODE", "server");
  mocks.env.APP_RUNTIME_MODE = "server";
  mocks.requestHeaders = new Headers({
    host: "portal.example.test",
    "x-forwarded-proto": "https",
  });
  mocks.requestPasswordReset.mockResolvedValue({
    data: { status: true },
    error: null,
  });
  mocks.resetPassword.mockResolvedValue({
    data: { status: true },
    error: null,
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
});

describe("requestPasswordResetAction", () => {
  it("redirects to the reset page on the allow-listed request origin", async () => {
    const result = await requestPasswordResetAction(
      idle,
      form({ email: "  Pro@Example.TEST " }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "pro@example.test",
      redirectTo: "https://portal.example.test/entrar/redefinir",
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      "password-reset",
      "pro@example.test",
      expect.any(Headers),
    );
  });

  it("ignores a forged Host and falls back to the first allowed origin", async () => {
    mocks.requestHeaders = new Headers({
      host: "evil.example",
      "x-forwarded-proto": "https",
    });

    await requestPasswordResetAction(idle, form({ email: "a@b.test" }));

    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectTo: "https://portal.example.test/entrar/redefinir",
      }),
    );
  });

  it("never takes the redirect from submitted fields", async () => {
    await requestPasswordResetAction(
      idle,
      form({ email: "a@b.test", redirectTo: "https://evil.example/x" }),
    );

    const call = mocks.requestPasswordReset.mock.calls[0]![0] as {
      redirectTo: string;
    };
    expect(call.redirectTo.startsWith("https://portal.example.test/")).toBe(
      true,
    );
  });

  it("returns the same neutral state whether or not the account exists", async () => {
    // Better Auth answers success for unknown e-mails; the action must not
    // add any distinguishing signal of its own.
    const known = await requestPasswordResetAction(
      idle,
      form({ email: "known@example.test" }),
    );
    mocks.requestPasswordReset.mockResolvedValueOnce({
      data: { status: true, message: "If this email exists" },
      error: null,
    });
    const unknown = await requestPasswordResetAction(
      idle,
      form({ email: "nobody@example.test" }),
    );

    expect(unknown).toEqual(known);
    expect(known).toEqual({ status: "sent" });
  });

  it("rejects malformed e-mails without calling the provider", async () => {
    const result = await requestPasswordResetAction(
      idle,
      form({ email: "not-an-email" }),
    );

    expect(result).toEqual({
      status: "error",
      message: RESET_ERROR_MESSAGES.email,
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("reports rate limiting without calling the provider", async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      new HttpError(429, "RATE_LIMITED", "Too many requests."),
    );

    const result = await requestPasswordResetAction(
      idle,
      form({ email: "a@b.test" }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(RESET_ERROR_MESSAGES.rateLimited);
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows a generic error on provider or transport failure", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce({
      data: null,
      error: { status: 502, statusText: "Bad Gateway", code: "NETWORK_ERROR" },
    });
    const rejected = await requestPasswordResetAction(
      idle,
      form({ email: "a@b.test" }),
    );
    mocks.requestPasswordReset.mockRejectedValueOnce(new Error("boom"));
    const thrown = await requestPasswordResetAction(
      idle,
      form({ email: "a@b.test" }),
    );

    const generic = {
      status: "error",
      message: RESET_ERROR_MESSAGES.transport,
    };
    expect(rejected).toEqual(generic);
    expect(thrown).toEqual(generic);
  });

  it("only simulates the confirmation in the demo target", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "demo");

    const result = await requestPasswordResetAction(
      idle,
      form({ email: "a@b.test" }),
    );

    expect(result).toEqual({ status: "sent" });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });
});

describe("resetPasswordAction", () => {
  const valid = {
    token: "single-use-token",
    password: goodPassword,
    confirmation: goodPassword,
  };

  it("resets with the token and the new password", async () => {
    const result = await resetPasswordAction(idle, form(valid));

    expect(result).toEqual({ status: "success" });
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: goodPassword,
      token: "single-use-token",
    });
  });

  it("requires a token", async () => {
    const result = await resetPasswordAction(
      idle,
      form({ ...valid, token: "  " }),
    );

    expect(result.status).toBe("invalid_token");
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("validates password length and confirmation before any request", async () => {
    const short = await resetPasswordAction(
      idle,
      form({ ...valid, password: "short", confirmation: "short" }),
    );
    const long = await resetPasswordAction(
      idle,
      form({
        ...valid,
        password: "x".repeat(PASSWORD_MAX_LENGTH + 1),
        confirmation: "x".repeat(PASSWORD_MAX_LENGTH + 1),
      }),
    );
    const mismatch = await resetPasswordAction(
      idle,
      form({ ...valid, confirmation: `${goodPassword}!` }),
    );

    expect(short.message).toBe(RESET_ERROR_MESSAGES.tooShort);
    expect(long.message).toBe(RESET_ERROR_MESSAGES.tooLong);
    expect(mismatch.message).toBe(RESET_ERROR_MESSAGES.mismatch);
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("maps an invalid or expired token to the invalid_token state", async () => {
    mocks.resetPassword.mockResolvedValueOnce({
      data: null,
      error: { status: 400, statusText: "Bad Request", code: "INVALID_TOKEN" },
    });

    const result = await resetPasswordAction(idle, form(valid));

    expect(result).toEqual({
      status: "invalid_token",
      message: RESET_ERROR_MESSAGES.invalidToken,
    });
  });

  it("maps provider password-length errors and falls back to a generic error", async () => {
    mocks.resetPassword.mockResolvedValueOnce({
      data: null,
      error: { status: 400, statusText: "", code: "PASSWORD_TOO_SHORT" },
    });
    const short = await resetPasswordAction(idle, form(valid));
    mocks.resetPassword.mockRejectedValueOnce(new Error("network"));
    const thrown = await resetPasswordAction(idle, form(valid));

    expect(short.message).toBe(RESET_ERROR_MESSAGES.tooShort);
    expect(thrown).toEqual({
      status: "error",
      message: RESET_ERROR_MESSAGES.transport,
    });
  });

  it("rate-limits attempts and never echoes the token", async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      new HttpError(429, "RATE_LIMITED", "Too many requests."),
    );

    const result = await resetPasswordAction(idle, form(valid));

    expect(result.message).toBe(RESET_ERROR_MESSAGES.rateLimited);
    expect(JSON.stringify(result)).not.toContain("single-use-token");
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("only simulates success in the demo target", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "demo");

    const result = await resetPasswordAction(
      idle,
      form({ password: goodPassword, confirmation: goodPassword }),
    );

    expect(result).toEqual({ status: "success" });
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});

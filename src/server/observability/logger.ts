import pino from "pino";

const sensitivePaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "authorization",
  "cookie",
  "token",
  "activityToken",
  "attemptToken",
  "sessionToken",
  "password",
  "secret",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "APPLICATION_SECRET",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: sensitivePaths,
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

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
  // Player entry credential (`?cred=` query parameter read by the player
  // entry component and hashed by the jogar actions) and the launch token
  // minted by the jogar actions and carried by game-host.
  "cred",
  "*.cred",
  "launchToken",
  "*.launchToken",
  // Raw player credential values and their SHA-256 hashes (tokenHash is the
  // CredentialMaterial key used by the player-access issuer and stores).
  "credential",
  "*.credential",
  "playerCredential",
  "*.playerCredential",
  "entryCredential",
  "*.entryCredential",
  "credentialHash",
  "*.credentialHash",
  "tokenHash",
  "*.tokenHash",
  // HTTP logs must stay pathname-only: the only call site
  // (src/server/http/route.ts) logs `path` from `nextUrl.pathname`. These
  // URL-shaped keys are censored as a second layer for top-level keys — pino
  // wildcards match one nesting level, so nested URL keys would slip through;
  // the pathname-only invariant is enforced at the call site.
  "url",
  "href",
  "req.url",
  "request.url",
];

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      base: undefined,
      redact: {
        paths: sensitivePaths,
        censor: "[REDACTED]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export const logger = createLogger();

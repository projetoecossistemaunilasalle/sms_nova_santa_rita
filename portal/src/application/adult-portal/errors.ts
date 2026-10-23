export class AdultPortalError extends Error {
  constructor(
    message: string,
    readonly code:
      "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT",
  ) {
    super(message);
    this.name = "AdultPortalError";
  }
}

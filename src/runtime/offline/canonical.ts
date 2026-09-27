import {
  stateSaveConflictV1Schema,
  type StateSaveConflictV1,
} from "@/contracts/v1";

import type { EventRequestIdentity } from "./types";

export function parseStateConflictResponse(
  error: unknown,
): StateSaveConflictV1 | null {
  const candidate =
    error && typeof error === "object" && "response" in error
      ? (error as { response?: unknown }).response
      : error;
  const parsed = stateSaveConflictV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export async function eventRequestIdentity(value: {
  client_event_id: string;
}): Promise<EventRequestIdentity> {
  const canonicalContent = stableJson(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "client_event_id"),
    ),
  );
  const subtle = globalThis.crypto?.subtle;
  if (!subtle)
    throw new Error("Web Crypto SHA-256 is required for event retries");
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalContent),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { canonicalContent, fingerprint };
}

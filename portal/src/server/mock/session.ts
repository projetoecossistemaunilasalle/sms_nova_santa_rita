import "server-only";

import { cookies } from "next/headers";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { getRuntimeMode } from "@/runtime/mode";
import {
  MOCK_SESSION_COOKIE,
  MOCK_SESSION_TTL_SECONDS,
  MockSessionRegistry,
} from "./database";

const globalForMock = globalThis as unknown as {
  portalMockSessions?: MockSessionRegistry;
};

function registry(): MockSessionRegistry {
  if (getRuntimeMode() !== "demo") {
    throw new Error("Mock persistence is unavailable in server mode.");
  }
  return (globalForMock.portalMockSessions ??= new MockSessionRegistry());
}

export async function findMockDatabase() {
  const id = (await cookies()).get(MOCK_SESSION_COOKIE)?.value;
  return registry().get(id);
}

export async function getMockDatabase() {
  const database = await findMockDatabase();
  if (!database) {
    throw new AdultPortalError(
      "Sessão expirada. Entre novamente.",
      "UNAUTHENTICATED",
    );
  }
  return database;
}

export async function startMockSession(): Promise<void> {
  const store = await cookies();
  const sessions = registry();
  // Signing back in resumes this browser's workspace until expiry or reset.
  if (sessions.get(store.get(MOCK_SESSION_COOKIE)?.value)) return;
  store.set(MOCK_SESSION_COOKIE, sessions.create(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MOCK_SESSION_TTL_SECONDS,
    // The mock is deliberately usable over HTTP on localhost.
    secure: false,
  });
}

export async function endMockSession(): Promise<void> {
  const store = await cookies();
  registry().delete(store.get(MOCK_SESSION_COOKIE)?.value);
  store.delete(MOCK_SESSION_COOKIE);
}

"use server";

import { redirect } from "next/navigation";

import { getRuntimeMode } from "@/runtime/mode";
import { getNeonAuthServer } from "@/server/auth/neon-server";
import { endMockSession } from "@/server/mock/session";

export async function signOutAction(): Promise<void> {
  if (getRuntimeMode() === "server") {
    await getNeonAuthServer().signOut();
  } else {
    await endMockSession();
  }
  redirect("/entrar");
}

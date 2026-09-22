"use server";

import { redirect } from "next/navigation";

import { getRuntimeMode } from "@/runtime/mode";
import { getNeonAuthServer } from "@/server/auth/neon-server";

export async function signOutAction(): Promise<void> {
  if (getRuntimeMode() === "server") {
    await getNeonAuthServer().signOut();
  }
  redirect("/entrar");
}

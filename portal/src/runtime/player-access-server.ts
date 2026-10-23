import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getAuthGateway } from "@/server/auth/gateway";
import { getPlayerAccessService } from "@/server/services/player-access-container";

export async function getPlayerAccessPageData(classGroupId: string) {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");
  return (await getPlayerAccessService()).getClassWorkflow(
    session.actor.profileId,
    classGroupId,
  );
}

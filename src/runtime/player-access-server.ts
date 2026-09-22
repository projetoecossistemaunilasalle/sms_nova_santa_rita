import "server-only";

import { connection } from "next/server";

import { getAuthGateway } from "@/server/auth/gateway";
import { getPlayerAccessService } from "@/server/services/player-access-container";

export async function getPlayerAccessPageData(classGroupId: string) {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) throw new Error("Authenticated portal session required.");
  return getPlayerAccessService().getClassWorkflow(
    session.actor.profileId,
    classGroupId,
  );
}

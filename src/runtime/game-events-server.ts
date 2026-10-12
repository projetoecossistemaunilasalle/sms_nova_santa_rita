import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getAuthGateway } from "@/server/auth/gateway";
import { getGameEventReportService } from "@/server/services/game-event-container";

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");
  return session.actor.profileId;
}

export async function getResultReportsPageData() {
  const id = await profileId();
  return (await getGameEventReportService()).listClassReports(id);
}

export async function getClassResultsPageData(classGroupId: string) {
  const id = await profileId();
  return (await getGameEventReportService()).getClassReport(id, classGroupId);
}

export async function getPlayerResultsPageData(
  classGroupId: string,
  playerSlotId: string,
) {
  const id = await profileId();
  return (await getGameEventReportService()).getPlayerReport(
    id,
    classGroupId,
    playerSlotId,
  );
}
